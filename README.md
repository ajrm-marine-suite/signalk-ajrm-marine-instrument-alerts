# AJRM Marine Instrument Alerts (retired)

This package was retired in version 0.8.0. Instrument monitoring, rate rules,
standard Signal K notification publication, anchoring depth callouts, and the
rule editor are now built into AJRM Marine Instruments 0.8.0 or later.

The monitor evaluator remains a separate internal provider module. The merger
does not make the instrument gauges the alert authority and does not require
AJRM Marine Notifications or Audio for standard Signal K notification state.

## Migration

```bash
cd ~/.signalk
npm uninstall signalk-ajrm-marine-instrument-alerts
npm install git+https://github.com/ajrm-marine-suite/signalk-ajrm-marine-instruments.git#v0.8.0 --omit=dev --no-package-lock
sudo systemctl restart signalk
```

Open **AJRM Marine Instruments → Alert settings**. Existing runtime settings in
`ajrm-marine-instrument-alerts-settings.json` are retained.

## License

AGPL-3.0-or-later.
