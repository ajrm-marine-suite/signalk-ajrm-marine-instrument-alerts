"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const createPlugin = require("../plugin");

test("is an inert retirement marker directing users to Instruments", () => {
  const errors = [];
  const statuses = [];
  const plugin = createPlugin({
    setPluginError(message) { errors.push(message); },
    setPluginStatus(message) { statuses.push(message); },
  });
  assert.equal(plugin.id, "signalk-ajrm-marine-instrument-alerts");
  assert.deepEqual(plugin.schema.properties, {});
  assert.equal(plugin.registerWithRouter, undefined);
  plugin.start();
  assert.match(errors[0], /Instruments v0\.8\.0 or later/);
  assert.equal(statuses[0], errors[0]);
});
