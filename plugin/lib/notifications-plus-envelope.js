"use strict";

const { randomUUID } = require("node:crypto");

const PROVIDER = "audible-instruments";
let providerSessionId = randomUUID();
let sourceSequence = 0;
let monitorCorrelations = new Map();

function activeEnvelope(monitor, event) {
  const level =
    event.level === "danger"
      ? "danger"
      : event.level === "warning"
        ? "warning"
        : "information";
  const subjectKey = `audible-instruments:${monitor.id}`;
  return {
    schemaVersion: 1,
    provider: PROVIDER,
    providerSessionId,
    sourceSequence: ++sourceSequence,
    correlationId: correlationFor(subjectKey),
    subjectKey,
    eventId: event.id,
    revision: Date.parse(event.ts) || Date.now(),
    lifecycle: "active",
    timestamp: event.ts,
    priority: {
      level,
      score: level === "danger" ? 850 : level === "warning" ? 550 : 250,
    },
    supersedes: [],
    history: { policy: "on-resolve" },
    delivery: {
      visual: true,
      audio: true,
      localPlayback: true,
      streamOutput: true,
      repeatSeconds: Number(monitor.levels?.[event.level]?.repeatSeconds) || 0,
      expiresSeconds: 90,
    },
    presentation: {
      title: monitor.label,
      label:
        level === "danger"
          ? "Danger"
          : level === "warning"
            ? "Warning"
            : "Information",
      message: event.message,
      category: "audible-instrument",
      facts: [],
    },
    actions: [],
    context: {
      monitorId: monitor.id,
      path: monitor.path,
      value: event.value,
      unit: event.unit,
      ratePerMinute: event.ratePerMinute,
    },
  };
}

function resolvedEnvelope(monitorId, now = Date.now()) {
  const subjectKey = `audible-instruments:${monitorId}`;
  const result = {
    schemaVersion: 1,
    provider: PROVIDER,
    providerSessionId,
    sourceSequence: ++sourceSequence,
    correlationId: correlationFor(subjectKey),
    subjectKey,
    eventId: `audible-instruments:${monitorId}:resolved:${now}`,
    revision: now,
    lifecycle: "resolved",
    timestamp: new Date(now).toISOString(),
    priority: { level: "information", score: 0 },
    supersedes: [],
    history: { policy: "on-resolve" },
    delivery: {
      visual: false,
      audio: false,
      localPlayback: false,
      streamOutput: false,
      repeatSeconds: 0,
      expiresSeconds: 30,
    },
    presentation: {
      title: "",
      label: "",
      message: "",
      category: "",
      facts: [],
    },
    actions: [],
    context: { monitorId },
  };
  monitorCorrelations.delete(subjectKey);
  return result;
}

function correlationFor(subjectKey) {
  const existing = monitorCorrelations.get(subjectKey);
  if (existing) return existing;
  const correlationId = randomUUID();
  monitorCorrelations.set(subjectKey, correlationId);
  return correlationId;
}

function resetProviderSession() {
  providerSessionId = randomUUID();
  sourceSequence = 0;
  monitorCorrelations = new Map();
}

module.exports = {
  activeEnvelope,
  resetProviderSession,
  resolvedEnvelope,
};
