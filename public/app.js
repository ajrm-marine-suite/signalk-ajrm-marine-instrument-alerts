const API = "../plugins/signalk-ajrm-marine-instrument-alerts";
const LEVELS = ["information", "warning", "danger"];
const DEFAULT_REPEATS = { information: 300, warning: 60, danger: 15 };

const elements = {
  enabled: document.getElementById("enabled"),
  monitors: document.getElementById("monitors"),
  monitorTemplate: document.getElementById("monitorTemplate"),
  addMonitor: document.getElementById("addMonitor"),
  saveSettings: document.getElementById("saveSettings"),
  settingsMessage: document.getElementById("settingsMessage"),
  recentEvents: document.getElementById("recentEvents"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
};

let settings = { enabled: true, monitors: [] };
let refreshTimer = null;
let dirty = false;

elements.enabled.addEventListener("change", markDirty);
elements.addMonitor.addEventListener("click", () => {
  settings.monitors.push(blankMonitor(settings.monitors.length + 1));
  dirty = true;
  renderSettings();
});
elements.saveSettings.addEventListener("click", saveSettings);
elements.monitors.addEventListener("input", markDirty);
elements.monitors.addEventListener("change", markDirty);

start();

async function start() {
  try {
    settings = await getJson(`${API}/settings`);
    renderSettings();
    await refreshStatus();
  } catch (error) {
    setConnection("error", error.message);
    scheduleRefresh(5);
  }
}

async function refreshStatus() {
  try {
    const status = await getJson(`${API}/status`);
    setConnection("ok", `Live v${status.version}`);
    renderLiveStatus(status);
    renderRecentEvents(status.recentEvents || []);
    scheduleRefresh(1);
  } catch (error) {
    setConnection("error", error.message);
    scheduleRefresh(5);
  }
}

function renderSettings() {
  elements.enabled.checked = settings.enabled !== false;
  elements.monitors.replaceChildren();
  settings.monitors.forEach((monitor, index) => {
    const card = elements.monitorTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.index = String(index);
    setField(card, "enabled", monitor.enabled !== false);
    setField(card, "label", monitor.label);
    setField(card, "path", monitor.path);
    setField(card, "unit", monitor.unit);
    setField(card, "conversion", monitor.conversion || "none");
    setField(card, "rateWindowSeconds", monitor.rateWindowSeconds ?? 60);
    setField(card, "minimumRateSampleSeconds", monitor.minimumRateSampleSeconds ?? 10);
    setField(card, "hysteresis", monitor.hysteresis ?? 0);
    setField(card, "rateHysteresisPerMinute", monitor.rateHysteresisPerMinute ?? 0);
    for (const level of LEVELS) {
      const row = card.querySelector(`[data-level="${level}"]`);
      const rule = monitor.levels?.[level] || {};
      setRule(row, "enabled", rule.enabled !== false);
      setRule(row, "minimum", rule.minimum);
      setRule(row, "maximum", rule.maximum);
      setRule(row, "risePerMinute", rule.risePerMinute);
      setRule(row, "fallPerMinute", rule.fallPerMinute);
      setRule(row, "repeatSeconds", rule.repeatSeconds ?? DEFAULT_REPEATS[level]);
    }
    card.querySelector('[data-action="remove"]').addEventListener("click", () => {
      settings.monitors.splice(index, 1);
      dirty = true;
      renderSettings();
    });
    elements.monitors.append(card);
  });
}

function renderLiveStatus(status) {
  const byId = new Map((status.monitors || []).map((monitor) => [monitor.id, monitor]));
  for (const card of elements.monitors.querySelectorAll(".monitor-card")) {
    const index = Number(card.dataset.index);
    const configured = settings.monitors[index];
    const live = byId.get(configured?.id);
    if (!live) continue;
    const state = live.state || {};
    card.dataset.activeLevel = state.activeLevel || "normal";
    card.querySelector(".active-state").textContent = labelLevel(state.activeLevel);
    card.querySelector(".live-value").textContent =
      state.lastValue == null
        ? "--"
        : `${Number(state.lastValue).toFixed(live.decimals ?? 1)} ${live.unit || ""}`.trim();
    card.querySelector(".live-rate").textContent =
      state.ratePerMinute == null
        ? "Rate --"
        : `Rate ${signed(Number(state.ratePerMinute).toFixed(live.decimals ?? 1))} ${live.unit || ""}/min`;
    card.querySelector(".live-updated").textContent = state.updatedAt
      ? `Updated ${new Date(state.updatedAt).toLocaleTimeString()}`
      : "";
  }
}

function renderRecentEvents(events) {
  if (events.length === 0) {
    elements.recentEvents.innerHTML = "<p>None yet.</p>";
    return;
  }
  elements.recentEvents.replaceChildren(
    ...events.slice(0, 20).map((event) => {
      const row = document.createElement("div");
      row.className = `event ${event.level}`;
      row.innerHTML = `<time>${escapeHtml(new Date(event.ts).toLocaleTimeString())}</time><span>${escapeHtml(event.message)}</span>`;
      return row;
    }),
  );
}

async function saveSettings() {
  const payload = readSettingsFromPage();
  const validationError = validateSettings(payload);
  if (validationError) {
    setMessage(validationError, true);
    return;
  }

  elements.saveSettings.disabled = true;
  try {
    const saved = await putJson(`${API}/settings`, payload);
    const verified = await getJson(`${API}/settings`);
    if (JSON.stringify(saved.monitors) !== JSON.stringify(verified.monitors) || saved.enabled !== verified.enabled) {
      throw new Error("Saved settings could not be verified");
    }
    settings = verified;
    dirty = false;
    renderSettings();
    setMessage("Saved and applied");
    await refreshStatus();
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    elements.saveSettings.disabled = false;
  }
}

function readSettingsFromPage() {
  return {
    enabled: elements.enabled.checked,
    monitors: [...elements.monitors.querySelectorAll(".monitor-card")].map((card, index) => {
      const existing = settings.monitors[index] || {};
      const label = readField(card, "label").trim();
      const path = readField(card, "path").trim();
      return {
        ...existing,
        id: existing.id || slug(label || path || `monitor-${index + 1}`),
        enabled: readChecked(card, "enabled"),
        label,
        path,
        unit: readField(card, "unit").trim(),
        conversion: readField(card, "conversion"),
        rateWindowSeconds: readNumber(card, "rateWindowSeconds"),
        minimumRateSampleSeconds: readNumber(card, "minimumRateSampleSeconds"),
        hysteresis: readNumber(card, "hysteresis"),
        rateHysteresisPerMinute: readNumber(card, "rateHysteresisPerMinute"),
        levels: Object.fromEntries(
          LEVELS.map((level) => {
            const row = card.querySelector(`[data-level="${level}"]`);
            return [
              level,
              {
                enabled: row.querySelector('[data-rule="enabled"]').checked,
                minimum: optionalInput(row, "minimum"),
                maximum: optionalInput(row, "maximum"),
                risePerMinute: optionalInput(row, "risePerMinute"),
                fallPerMinute: optionalInput(row, "fallPerMinute"),
                repeatSeconds: Number(row.querySelector('[data-rule="repeatSeconds"]').value),
              },
            ];
          }),
        ),
      };
    }),
  };
}

function validateSettings(value) {
  for (const [index, monitor] of value.monitors.entries()) {
    if (!monitor.label) return `Instrument ${index + 1} needs a label`;
    if (!monitor.path) return `${monitor.label} needs a Signal K path`;
    for (const level of LEVELS) {
      const rule = monitor.levels[level];
      if (!(rule.repeatSeconds >= 1)) return `${monitor.label} ${level} repeat must be at least 1 second`;
    }
  }
  return "";
}

function blankMonitor(number) {
  return {
    id: `instrument-${Date.now()}-${number}`,
    label: `Instrument ${number}`,
    path: "",
    unit: "",
    conversion: "none",
    enabled: true,
    rateWindowSeconds: 60,
    minimumRateSampleSeconds: 10,
    hysteresis: 0,
    rateHysteresisPerMinute: 0,
    levels: {
      information: { enabled: true, repeatSeconds: 300 },
      warning: { enabled: true, repeatSeconds: 60 },
      danger: { enabled: true, repeatSeconds: 15 },
    },
  };
}

function setField(card, name, value) {
  const input = card.querySelector(`[data-field="${name}"]`);
  if (input.type === "checkbox") input.checked = Boolean(value);
  else input.value = value == null ? "" : String(value);
}

function setRule(row, name, value) {
  const input = row.querySelector(`[data-rule="${name}"]`);
  if (input.type === "checkbox") input.checked = Boolean(value);
  else input.value = value == null ? "" : String(value);
}

function readField(card, name) {
  return card.querySelector(`[data-field="${name}"]`).value;
}

function readChecked(card, name) {
  return card.querySelector(`[data-field="${name}"]`).checked;
}

function readNumber(card, name) {
  return Number(readField(card, name));
}

function optionalInput(row, name) {
  const value = row.querySelector(`[data-rule="${name}"]`).value.trim();
  return value === "" ? null : Number(value);
}

function markDirty() {
  dirty = true;
  setMessage("Unsaved changes");
}

function labelLevel(level) {
  if (level === "danger") return "Danger";
  if (level === "warning") return "Warning";
  if (level === "information") return "Information";
  return "Normal";
}

function signed(value) {
  return Number(value) > 0 ? `+${value}` : value;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setMessage(message, error = false) {
  elements.settingsMessage.textContent = message;
  elements.settingsMessage.classList.toggle("error", error);
}

function setConnection(state, text) {
  elements.statusDot.className = state;
  elements.statusText.textContent = text;
}

function scheduleRefresh(seconds) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(refreshStatus, seconds * 1000);
}

async function getJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

async function putJson(url, body) {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(responseBody.error || `HTTP ${response.status}`);
  return responseBody;
}
