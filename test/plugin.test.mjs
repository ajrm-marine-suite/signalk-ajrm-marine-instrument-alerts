import test from "node:test";
import assert from "node:assert/strict";
import ajrmMarineInstrumentAlerts from "../plugin/index.js";

test("subscribed values publish Audible Instruments notifications", () => {
  let deltaHandler;
  const messages = [];
  const app = {
    subscriptionmanager: {
      subscribe(_subscription, unsubscribes, _onError, onDelta) {
        deltaHandler = onDelta;
        unsubscribes.push(() => {});
      },
    },
    getSelfPath() {
      return null;
    },
    getDataDirPath() {
      return null;
    },
    handleMessage(_pluginId, message) {
      messages.push(message);
    },
    setPluginStatus() {},
    error() {},
  };
  const plugin = ajrmMarineInstrumentAlerts(app);
  plugin.start({
    monitors: [
      {
        id: "depth",
        label: "Depth below keel",
        path: "environment.depth.belowKeel",
        unit: "metres",
        levels: {
          information: { enabled: false },
          warning: { minimum: 3, repeatSeconds: 60 },
          danger: { minimum: 2, repeatSeconds: 15 },
        },
      },
    ],
  });

  deltaHandler({
    updates: [
      {
        timestamp: "2026-06-18T12:00:00.000Z",
        values: [{ path: "environment.depth.belowKeel", value: 1.8 }],
      },
    ],
  });

  const published = messages.at(-1).updates[0].values[0];
  assert.equal(published.path, "notifications.environment.depth.belowKeel");
  assert.equal(published.value.state, "alarm");
  assert.deepEqual(published.value.method, ["visual", "sound"]);
  assert.equal(published.value.data.level, "danger");
  assert.match(published.value.message, /Depth below keel 1.8 metres/);
  const ajrmMarineNotifications = published.value.data.ajrmMarineNotifications;
  assert.ok(ajrmMarineNotifications.providerSessionId);
  assert.equal(ajrmMarineNotifications.sourceSequence, 1);
  assert.ok(ajrmMarineNotifications.correlationId);
  assert.deepEqual(
    {
      lifecycle: ajrmMarineNotifications.lifecycle,
      subjectKey: ajrmMarineNotifications.subjectKey,
      historyPolicy: ajrmMarineNotifications.history.policy,
      priority: ajrmMarineNotifications.priority.score,
      title: ajrmMarineNotifications.presentation.title,
    },
    {
      lifecycle: "active",
      subjectKey: "audible-instruments:depth",
      historyPolicy: "on-resolve",
      priority: 850,
      title: "Depth below keel",
    },
  );
});

test("status advertises anchoring depth callout capability", () => {
  let status = null;
  const app = {
    subscriptionmanager: {
      subscribe(_subscription, unsubscribes) {
        unsubscribes.push(() => {});
      },
    },
    getSelfPath() {
      return null;
    },
    getDataDirPath() {
      return null;
    },
    handleMessage() {},
    setPluginStatus() {},
    error() {},
  };
  const plugin = ajrmMarineInstrumentAlerts(app);
  plugin.start({});
  plugin.registerWithRouter({
    get(path, handler) {
      if (path === "/status") handler({}, { json(value) { status = value; } });
    },
    put() {},
    post() {},
  });
  assert.equal(status.depthCallout.supported, true);
  assert.equal(status.depthCallout.available, true);
  assert.equal(status.depthCallout.path, "environment.depth.belowKeel");
  assert.equal(status.depthCallout.audio, true);
  assert.equal(status.depthCallout.active, false);
});

test("depth callout announces sparse anchoring depth changes when enabled", () => {
  let deltaHandler;
  const messages = [];
  const app = {
    subscriptionmanager: {
      subscribe(subscription, unsubscribes, _onError, onDelta) {
        assert.ok(subscription.subscribe.some((item) => item.path === "environment.depth.belowKeel"));
        deltaHandler = onDelta;
        unsubscribes.push(() => {});
      },
    },
    getSelfPath() {
      return null;
    },
    getDataDirPath() {
      return null;
    },
    handleMessage(_pluginId, message) {
      messages.push(message);
    },
    setPluginStatus() {},
    error() {},
  };
  const plugin = ajrmMarineInstrumentAlerts(app);
  plugin.start({
    monitors: [],
    depthCallout: {
      enabled: true,
      path: "environment.depth.belowKeel",
      sayUnits: true,
      minimumIntervalSeconds: 1,
    },
  });

  deltaHandler({
    updates: [
      {
        timestamp: "2026-07-03T12:00:00.000Z",
        values: [{ path: "environment.depth.belowKeel", value: 6.2 }],
      },
      {
        timestamp: "2026-07-03T12:00:01.500Z",
        values: [{ path: "environment.depth.belowKeel", value: 5.1 }],
      },
      {
        timestamp: "2026-07-03T12:00:03.000Z",
        values: [{ path: "environment.depth.belowKeel", value: 2.4 }],
      },
    ],
  });

  const callouts = messages
    .map((message) => message.updates[0].values[0])
    .filter((value) => value.path === "notifications.environment.depth.callout");
  assert.equal(callouts.length, 3);
  assert.equal(callouts[0].value.message, "Depth 6 meters.");
  assert.equal(callouts[1].value.message, "Depth 5 meters.");
  assert.equal(callouts[2].value.message, "Depth 2.4 meters.");
  assert.equal(callouts[2].value.data.category, "instrument-depth-callout");
  assert.equal(callouts[2].value.data.announcement.shouldAnnounce, true);
});
