# Changelog

## 0.5.10

- Make Save and apply show clean/dirty/saving state: it is only green when
  settings have unsaved changes.

## 0.5.9

- Add a visible Anchoring Depth Callout panel to the web app, including enable,
  target depth band, timing controls, live depth status, and Anchor dropped.

## 0.5.8

- Start the plugin by default so Console BITE can see the Instrument Alerts
  status projection and anchoring depth-callout capability on fresh installs.
- Keep the alert engine and depth callouts internally disabled by default, so
  auto-starting the plugin does not create unexpected spoken alerts.

## 0.5.3

- Clone repeated level schema fragments so the Signal K plugin CI schema
  validator sees a JSON-clean plugin configuration schema.

## 0.5.2

- Add Signal K AppStore relationship metadata recommending AJRM Marine Audio
  for spoken instrument alerts.
- Add the reusable Signal K plugin CI workflow.

## 0.5.1

- Update the public GitHub install command to use HTTPS for fresh Pi installs.

## 0.5.0

- Initial public beta release as AJRM Marine Instrument Alerts.
