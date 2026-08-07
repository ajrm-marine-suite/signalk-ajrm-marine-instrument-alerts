"use strict";

const packageInfo = require("../package.json");

module.exports = function retiredInstrumentAlerts(app) {
  return {
    id: "signalk-ajrm-marine-instrument-alerts",
    name: "AJRM Marine Instrument Alerts (retired)",
    description:
      "Retired in v0.8.0. Instrument monitoring and depth callouts are built into AJRM Marine Instruments.",
    schema: { type: "object", properties: {} },
    start() {
      const message =
        `Instrument Alerts v${packageInfo.version} is retired; install AJRM Marine Instruments v0.8.0 or later`;
      app.setPluginError?.(message);
      app.setPluginStatus?.(message);
    },
    stop() {},
  };
};
