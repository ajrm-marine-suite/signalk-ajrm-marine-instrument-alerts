# AJRM Marine Instrument Alerts

## Version 1 baseline

`v0.6.1` makes anchoring depth callouts and **Anchor dropped** one-shot events.
The newest callout supersedes an older queued depth, clears from the retained
Signal K notification after 30 seconds, and clears sooner in safely deeper
water. The separate configured shallow-depth alarm keeps its own threshold and
hysteresis lifecycle.

`v0.5.7` publishes Instrument Alerts status under
`vessels.self.plugins.ajrmMarineInstrumentAlerts` so Console BITE, Capture, and
Snapshot can verify depth-callout capability from captured Signal K state.

`v0.5.6` adds the first server-side anchoring depth callout capability. It is
off by default and reads the configured depth path only when enabled, announcing
depth changes only inside the configured anchoring target depth band.
The status endpoint advertises the capability for BITE and future UI controls.

Depth callouts and **Anchor dropped** are one-shot events, not continuing
shallow-water alarms. The temporary notification at
`notifications.environment.depth.callout` is explicitly cleared 30 seconds
after the latest callout, with each newer callout resetting that timer. It is
also cleared immediately when depth rises above the configured upper target
band plus hysteresis.

The configured depth monitor remains independent. If
`environment.depth.belowKeel` continues to meet an Information, Warning, or
Danger threshold, its notification at
`notifications.environment.depth.belowKeel` remains active until that
threshold clears with the monitor's own hysteresis. Clearing a one-shot
callout never hides a continuing shallow-depth condition.

`v0.5.0` promotes the current configurable instrument and rate-of-change
notification provider as the working baseline. It remains provider-owned policy
published through standard Signal K notifications and does not intentionally
change runtime behavior from `v0.5.0`.

`v0.5.0` adds provider session, source sequence, and end-to-end correlation
identifiers without changing monitor thresholds or delivery behavior.

> **Alpha Release disclaimer:** This software is Alpha Release and has not been tested in live environments and must not be relied upon for navigation or safety. The Authors do not accept any responsibility for loss or damage as a result of using this software.

AJRM Marine Instrument Alerts is a Signal K plugin and web app for configurable instrument monitoring. It owns the alert decision and publishes standards-compatible Signal K notifications. AJRM Marine Notifications provides shared priority, supersession, history, and delivery projections; AJRM Marine Audio renders its audio projection through Piper, the Pi speaker, and the live MP3 stream.

Each monitored Signal K path can have independent **Information**, **Warning**, and **Danger** rules:

- Trigger below a minimum value.
- Trigger above a maximum value.
- Trigger when the value rises faster than a configured amount per minute.
- Trigger when the value falls faster than a configured amount per minute.
- Repeat at a different interval for each severity.
- Apply value and rate hysteresis to avoid chatter near a boundary.

The Signal K plugin configuration supplies startup defaults. The AJRM Marine Instrument Alerts web app can add, remove, enable, and tune monitors while the plugin is running. Web changes are persisted in `ajrm-marine-instrument-alerts-settings.json` in the plugin data directory and take precedence over startup defaults.

For compatibility with other Signal K applications, each active monitor publishes the standard notification fields `state`, `method`, and `message`. The notification path mirrors the monitored source path where possible, for example:

```text
environment.depth.belowKeel
-> notifications.environment.depth.belowKeel
```

Information maps to Signal K `alert`, Warning maps to `warn`, and Danger maps to `alarm`. Clearing a condition publishes `null` at the same path. The optional `data.ajrmMarineNotifications` extension carries the richer provider-authored lifecycle and priority contract.

## Included Defaults

- **Depth below keel** is enabled, with Information at 5 m, Warning at 3 m, and Danger at 2 m.
- **Engine room temperature** is included but disabled until its path and limits are checked for the vessel. It demonstrates absolute temperature and degrees-per-minute rise triggers.

Signal K stores temperatures in Kelvin, speed in metres per second, and angles in radians. The web app provides common conversions to Celsius, knots, and degrees, plus optional scale and offset fields in the saved model.

## Install

After the repository has been created and tagged:

```bash
cd ~/.signalk
npm install git+https://github.com/ajrm-marine-suite/signalk-ajrm-marine-instrument-alerts.git#v0.6.1 --omit=dev --no-package-lock
sudo systemctl restart signalk
```

Open **AJRM Marine Instrument Alerts** from the Signal K webapps page.

Install and enable AJRM Marine Notifications before AJRM Marine Companion and AJRM Marine Audio.

## Tests

```bash
npm test
```

AJRM Marine Instrument Alerts is authored and maintained by Anthony McDonald, with assistance from William McAusland. It builds on the Signal K project and the work of Signal K plugin authors.


## Public Beta

Instrument threshold and trend announcements for AJRM Marine Suite.

Development assistance: OpenAI Codex helped with code generation, refactoring, and automated testing during the beta development cycle.
## License and commercial use

This software is licensed under the GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later). You may use, study, share, and modify it under that licence. If you modify it and make it available to users over a network, the corresponding source code must also be made available under the AGPL.

Commercial licensing is available by arrangement for organisations that want different terms.
