# AJRM Marine Instrument Alerts

## Current release

Version 0.7.0 is the reviewed provider baseline before this functionality moves
into AJRM Marine Instruments. It declares its API and supported Node runtime,
protects state-changing controls with Signal K access permissions, makes
restart/stop lifecycle handling explicit, and removes the obsolete migration
from the pre-suite Audible Instruments settings filename.

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

> **Alpha Release disclaimer:** This software is Alpha Release and has not been tested in live environments and must not be relied upon for navigation or safety. The Authors do not accept any responsibility for loss or damage as a result of using this software.

AJRM Marine Instrument Alerts is a Signal K plugin and web app for configurable instrument monitoring. It owns the alert decision and publishes standards-compatible Signal K notifications. AJRM Marine Notifications provides shared priority, supersession, history, and delivery projections; AJRM Marine Audio renders its audio projection through Piper, the Pi speaker, and the live MP3 stream.

Each monitored Signal K path can have independent **Information**, **Warning**, and **Danger** rules:

- Trigger below a minimum value.
- Trigger above a maximum value.
- Trigger when the value rises faster than a configured amount per minute.
- Trigger when the value falls faster than a configured amount per minute.
- Repeat at a different interval for each severity.
- Apply value and rate hysteresis to avoid chatter near a boundary.
- Optionally monitor the absolute value, allowing one positive threshold to
  cover equal-magnitude negative and positive readings such as port and
  starboard pilot helm position.

The web app's four rate-tuning fields have hover/focus help with suggested
starting values. As a general baseline, use a 60-second rate window and a
10-second minimum sample. Value hysteresis is expressed in the displayed unit
(for example 0.2 m depth, 1 °C temperature, or 5 m XTE). Rate hysteresis is in
displayed units per minute; start near 10% of the configured Rise/min or
Fall/min threshold, or leave it at zero when no rate rule is used.

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
- **Cross track error** monitors the normalized nullable Instruments path in
  metres using absolute magnitude. It is included with editable 25/50/100 m
  Information/Warning/Danger examples but is disabled by default so the
  skipper can choose limits appropriate to the route and operating area. A
  missing or null XTE never activates the monitor and immediately clears an
  existing XTE condition. Its **Direction wording** is set to **Port / Starboard**,
  so the signed source selects announcements such as “55.0 metres to Port” or
  “55.0 metres to Starboard” while thresholds continue to use absolute metres.

The **Unit** field remains the static measurement unit. Use the separate
**Direction wording** selector when a signed value needs Port/Starboard speech;
this keeps unit configuration independent from directional semantics.

Signal K stores temperatures in Kelvin, speed in metres per second, and angles in radians. The web app provides common conversions to Celsius, knots, and degrees, plus optional scale and offset fields in the saved model.

## Install

```bash
cd ~/.signalk
npm install git+https://github.com/ajrm-marine-suite/signalk-ajrm-marine-instrument-alerts.git#v0.7.0 --omit=dev --no-package-lock
sudo systemctl restart signalk
```

Open **AJRM Marine Instrument Alerts** from the Signal K webapps page.

Install and enable AJRM Marine Notifications before AJRM Marine Audio and any
client that consumes the broker projections.

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
