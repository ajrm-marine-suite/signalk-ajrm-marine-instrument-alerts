"use strict";

const fs = require("node:fs");
const path = require("node:path");
const packageInfo = require("../package.json");
const {
  createMonitorState,
  evaluateMonitor,
  safeId,
} = require("./lib/monitor-engine");
const {
  activeEnvelope,
  resetProviderSession,
} = require("./lib/notifications-plus-envelope");

const PLUGIN_ID = "signalk-ajrm-marine-instrument-alerts";
const SETTINGS_FILE = "audible-instruments-settings.json";
const NOTIFICATION_ROOT = "notifications.ajrmMarineInstrumentAlerts";
const LEVEL_SCHEMA = {
  type: "object",
  properties: {
    enabled: { type: "boolean", title: "Enable this level", default: true },
    minimum: {
      type: ["number", "null"],
      title: "Trigger at or below",
      description: "Leave empty to disable the low-value trigger.",
    },
    maximum: {
      type: ["number", "null"],
      title: "Trigger at or above",
      description: "Leave empty to disable the high-value trigger.",
    },
    risePerMinute: {
      type: ["number", "null"],
      title: "Trigger above rise per minute",
      minimum: 0,
    },
    fallPerMinute: {
      type: ["number", "null"],
      title: "Trigger above fall per minute",
      minimum: 0,
    },
    repeatSeconds: {
      type: "integer",
      title: "Repeat interval (seconds)",
      minimum: 1,
      maximum: 86400,
    },
  },
};

function levelSchema(title) {
  return {
    ...LEVEL_SCHEMA,
    title,
    properties: { ...LEVEL_SCHEMA.properties },
  };
}

const DEFAULT_MONITORS = [
  {
    id: "depth-below-keel",
    label: "Depth below keel",
    path: "environment.depth.belowKeel",
    unit: "metres",
    conversion: "none",
    decimals: 1,
    enabled: true,
    rateWindowSeconds: 60,
    minimumRateSampleSeconds: 10,
    hysteresis: 0.2,
    rateHysteresisPerMinute: 0.1,
    levels: {
      information: { enabled: true, minimum: 5, repeatSeconds: 300 },
      warning: { enabled: true, minimum: 3, repeatSeconds: 60 },
      danger: { enabled: true, minimum: 2, repeatSeconds: 15 },
    },
  },
  {
    id: "engine-room-temperature",
    label: "Engine room temperature",
    path: "environment.inside.engineRoom.temperature",
    unit: "degrees Celsius",
    conversion: "kelvinToCelsius",
    decimals: 1,
    enabled: false,
    rateWindowSeconds: 60,
    minimumRateSampleSeconds: 15,
    hysteresis: 1,
    rateHysteresisPerMinute: 0.2,
    levels: {
      information: { enabled: true, maximum: 60, risePerMinute: 1, repeatSeconds: 300 },
      warning: { enabled: true, maximum: 75, risePerMinute: 2, repeatSeconds: 60 },
      danger: { enabled: true, maximum: 90, risePerMinute: 4, repeatSeconds: 15 },
    },
  },
];

module.exports = function ajrmMarineInstrumentAlerts(app) {
  const plugin = {};
  let options = normalizeOptions({});
  let states = new Map();
  let unsubscribes = [];
  let recentEvents = [];

  plugin.id = PLUGIN_ID;
  plugin.name = "AJRM Marine Instrument Alerts";
  plugin.description =
    "Monitors Signal K values and announces configurable information, warning, danger, and rate-of-change triggers.";

  plugin.schema = {
    type: "object",
    properties: {
      enabled: {
        type: "boolean",
        title: "Enable AJRM Marine Instrument Alerts",
        default: true,
      },
      monitors: {
        type: "array",
        title: "Monitored instruments and startup defaults",
        description:
          "The AJRM Marine Instrument Alerts web app provides the easiest way to edit these rules while Signal K is running.",
        default: DEFAULT_MONITORS,
        items: {
          type: "object",
          required: ["id", "label", "path"],
          properties: {
            id: { type: "string", title: "Stable monitor ID" },
            label: { type: "string", title: "Spoken label" },
            path: { type: "string", title: "Signal K path" },
            unit: { type: "string", title: "Spoken/display unit" },
            conversion: {
              type: "string",
              title: "Signal K unit conversion",
              enum: ["none", "kelvinToCelsius", "metersPerSecondToKnots", "radiansToDegrees"],
              default: "none",
            },
            scale: { type: "number", title: "Additional scale", default: 1 },
            offset: { type: "number", title: "Additional offset", default: 0 },
            decimals: {
              type: "integer",
              title: "Spoken/display decimal places",
              default: 1,
              minimum: 0,
              maximum: 4,
            },
            enabled: { type: "boolean", title: "Monitor enabled", default: true },
            rateWindowSeconds: {
              type: "integer",
              title: "Rate calculation window (seconds)",
              default: 60,
              minimum: 10,
              maximum: 3600,
            },
            minimumRateSampleSeconds: {
              type: "integer",
              title: "Minimum rate sample duration (seconds)",
              default: 10,
              minimum: 1,
              maximum: 600,
            },
            hysteresis: {
              type: "number",
              title: "Value hysteresis",
              default: 0,
              minimum: 0,
            },
            rateHysteresisPerMinute: {
              type: "number",
              title: "Rate hysteresis per minute",
              default: 0,
              minimum: 0,
            },
            levels: {
              type: "object",
              title: "Severity rules",
              properties: {
                information: levelSchema("Information"),
                warning: levelSchema("Warning"),
                danger: levelSchema("Danger"),
              },
            },
          },
        },
      },
    },
  };

  plugin.start = (pluginOptions = {}) => {
    resetProviderSession();
    options = normalizeOptions({
      ...pluginOptions,
      ...loadRuntimeSettings(),
    });
    resetStates();
    subscribeToMonitors();
    seedCurrentValues();
    app.setPluginStatus(`Started v${packageInfo.version}; ${enabledMonitorCount()} monitor(s)`);
  };

  plugin.stop = () => {
    unsubscribeAll();
    clearPublishedNotifications();
  };

  plugin.registerWithRouter = (router) => {
    router.get("/status", (_req, res) => {
      res.json(statusResponse());
    });

    router.get("/settings", (_req, res) => {
      res.json(settingsResponse());
    });

    router.put("/settings", (req, res) => {
      try {
        const next = normalizeOptions(req.body || {});
        unsubscribeAll();
        clearPublishedNotifications();
        options = next;
        saveRuntimeSettings();
        resetStates();
        subscribeToMonitors();
        seedCurrentValues();
        app.setPluginStatus(`Started v${packageInfo.version}; ${enabledMonitorCount()} monitor(s)`);
        res.json(settingsResponse());
      } catch (error) {
        app.error(`[${PLUGIN_ID}] settings error: ${error.stack || error.message}`);
        res.status(400).json({ ok: false, error: error.message });
      }
    });
  };

  return plugin;

  function normalizeOptions(value) {
    const monitors = Array.isArray(value.monitors) ? value.monitors : DEFAULT_MONITORS;
    const normalized = monitors.map(normalizeMonitor).filter((monitor) => monitor.path);
    return {
      enabled: value.enabled !== false,
      monitors: uniqueMonitorIds(normalized),
    };
  }

  function normalizeMonitor(value, index) {
    const id = safeId(value?.id || value?.label || value?.path || `monitor-${index + 1}`);
    return {
      id,
      label: String(value?.label || value?.path || `Monitor ${index + 1}`).trim(),
      path: String(value?.path || "").trim(),
      unit: String(value?.unit || "").trim(),
      conversion: [
        "none",
        "kelvinToCelsius",
        "metersPerSecondToKnots",
        "radiansToDegrees",
      ].includes(value?.conversion)
        ? value.conversion
        : "none",
      scale: finiteOr(value?.scale, 1),
      offset: finiteOr(value?.offset, 0),
      decimals: clampInteger(value?.decimals, 1, 0, 4),
      enabled: value?.enabled !== false,
      rateWindowSeconds: clampInteger(value?.rateWindowSeconds, 60, 10, 3600),
      minimumRateSampleSeconds: clampInteger(value?.minimumRateSampleSeconds, 10, 1, 600),
      hysteresis: clampNumber(value?.hysteresis, 0, 0, 1000000),
      rateHysteresisPerMinute: clampNumber(
        value?.rateHysteresisPerMinute,
        0,
        0,
        1000000,
      ),
      levels: {
        information: normalizeLevel(value?.levels?.information, 300),
        warning: normalizeLevel(value?.levels?.warning, 60),
        danger: normalizeLevel(value?.levels?.danger, 15),
      },
    };
  }

  function normalizeLevel(value, defaultRepeatSeconds) {
    return {
      enabled: value?.enabled !== false,
      minimum: optionalNumber(value?.minimum),
      maximum: optionalNumber(value?.maximum),
      risePerMinute: optionalPositiveNumber(value?.risePerMinute),
      fallPerMinute: optionalPositiveNumber(value?.fallPerMinute),
      repeatSeconds: clampInteger(value?.repeatSeconds, defaultRepeatSeconds, 1, 86400),
    };
  }

  function uniqueMonitorIds(monitors) {
    const used = new Set();
    return monitors.map((monitor, index) => {
      let id = monitor.id || `monitor-${index + 1}`;
      let suffix = 2;
      while (used.has(id)) id = `${monitor.id}-${suffix++}`;
      used.add(id);
      return { ...monitor, id };
    });
  }

  function subscribeToMonitors() {
    if (!options.enabled || !app.subscriptionmanager?.subscribe) return;
    const paths = [...new Set(options.monitors.filter((item) => item.enabled).map((item) => item.path))];
    if (paths.length === 0) return;
    app.subscriptionmanager.subscribe(
      {
        context: "vessels.self",
        subscribe: paths.map((monitorPath) => ({
          path: monitorPath,
          policy: "instant",
          format: "delta",
        })),
      },
      unsubscribes,
      (error) => app.error(`[${PLUGIN_ID}] subscription error: ${error}`),
      handleDelta,
    );
  }

  function handleDelta(delta) {
    const fallbackTimestamp = Date.now();
    for (const update of delta?.updates || []) {
      const timestamp = Date.parse(update.timestamp) || fallbackTimestamp;
      for (const value of update.values || []) {
        for (const monitor of options.monitors) {
          if (monitor.enabled && monitor.path === value.path) {
            evaluateValue(monitor, value.value, timestamp);
          }
        }
      }
    }
  }

  function seedCurrentValues() {
    if (!options.enabled || typeof app.getSelfPath !== "function") return;
    const timestamp = Date.now();
    for (const monitor of options.monitors) {
      if (!monitor.enabled) continue;
      const value = app.getSelfPath(monitor.path);
      if (value != null) evaluateValue(monitor, value, timestamp);
    }
  }

  function evaluateValue(monitor, rawValue, timestamp) {
    const previous = states.get(monitor.id) || createMonitorState();
    const result = evaluateMonitor({ monitor, rawValue, timestamp, state: previous });
    states.set(monitor.id, result.state);
    if (result.event) publishAnnouncement(monitor, result.event);
    if (result.cleared) clearNotification(monitor.id);
  }

  function publishAnnouncement(monitor, event) {
    const notificationState =
      event.level === "danger" ? "alarm" : event.level === "warning" ? "warn" : "alert";
    recentEvents = [event, ...recentEvents].slice(0, 50);
    const ajrmMarineNotifications = activeEnvelope(monitor, event);
    app.handleMessage(PLUGIN_ID, {
      context: "vessels.self",
      updates: [
        {
          values: [
            {
              path: standardNotificationPath(monitor),
              value: {
                state: notificationState,
                method: ["visual", "sound"],
                message: event.message,
                data: {
                  category: "audible-instrument",
                  monitorId: monitor.id,
                  sourcePath: monitor.path,
                  level: event.level,
                  value: event.value,
                  unit: event.unit,
                  ratePerMinute: event.ratePerMinute,
                  ajrmMarineNotifications,
                  announcement: {
                    id: event.id,
                    ts: event.ts,
                    shouldAnnounce: true,
                    localPlayback: true,
                    streamOutput: true,
                  },
                  alertEvent: {
                    id: event.id,
                    ts: event.ts,
                    vesselName: monitor.label,
                    displayName: monitor.label,
                    state: notificationState,
                    category: "audible-instrument",
                    message: event.message,
                    methods: ["visual", "sound"],
                    shouldAnnounce: true,
                    uiSeverity: event.level,
                    uiLabel: monitor.label,
                  },
                },
              },
            },
          ],
        },
      ],
    });
  }

  function clearNotification(monitorId) {
    app.handleMessage(PLUGIN_ID, {
      context: "vessels.self",
      updates: [
        {
          values: [
            {
              path:
                options.monitors.find((monitor) => monitor.id === monitorId)
                  ? standardNotificationPath(
                      options.monitors.find((monitor) => monitor.id === monitorId),
                    )
                  : `${NOTIFICATION_ROOT}.${monitorId}`,
              value: null,
            },
          ],
        },
      ],
    });
  }

  function clearPublishedNotifications() {
    for (const monitor of options.monitors) clearNotification(monitor.id);
  }

  function resetStates() {
    states = new Map(options.monitors.map((monitor) => [monitor.id, createMonitorState()]));
    recentEvents = [];
  }

  function unsubscribeAll() {
    for (const unsubscribe of unsubscribes) {
      try {
        unsubscribe();
      } catch {
        // Signal K unsubscribe callbacks are best-effort during shutdown/reconfigure.
      }
    }
    unsubscribes = [];
  }

  function settingsResponse() {
    return {
      ok: true,
      plugin: PLUGIN_ID,
      version: packageInfo.version,
      enabled: options.enabled,
      monitors: options.monitors,
    };
  }

  function statusResponse() {
    return {
      ok: true,
      plugin: PLUGIN_ID,
      version: packageInfo.version,
      enabled: options.enabled,
      timestamp: new Date().toISOString(),
      monitors: options.monitors.map((monitor) => ({
        ...monitor,
        state: publicState(states.get(monitor.id) || createMonitorState()),
      })),
      recentEvents,
    };
  }

  function publicState(state) {
    const { samples: _samples, ...publicFields } = state;
    return publicFields;
  }

  function enabledMonitorCount() {
    return options.enabled ? options.monitors.filter((monitor) => monitor.enabled).length : 0;
  }

  function loadRuntimeSettings() {
    try {
      const filePath = settingsFilePath();
      if (!filePath || !fs.existsSync(filePath)) return {};
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      app.error(`[${PLUGIN_ID}] could not load settings: ${error.message}`);
      return {};
    }
  }

  function saveRuntimeSettings() {
    const filePath = settingsFilePath();
    if (!filePath) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(options, null, 2)}\n`);
  }

  function settingsFilePath() {
    if (typeof app.getDataDirPath !== "function") return null;
    return path.join(app.getDataDirPath(), SETTINGS_FILE);
  }
};

function standardNotificationPath(monitor) {
  const sourcePath = String(monitor?.path || "").trim();
  if (/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/.test(sourcePath)) {
    return `notifications.${sourcePath}`;
  }
  return `${NOTIFICATION_ROOT}.${monitor?.id || "instrument"}`;
}

function optionalNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalPositiveNumber(value) {
  const number = optionalNumber(value);
  return number == null ? null : Math.max(0, number);
}

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value, fallback, min, max) {
  return Math.min(max, Math.max(min, finiteOr(value, fallback)));
}

function clampInteger(value, fallback, min, max) {
  return Math.round(clampNumber(value, fallback, min, max));
}
