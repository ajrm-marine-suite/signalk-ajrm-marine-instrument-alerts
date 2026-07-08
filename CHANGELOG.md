# Changelog

## 0.5.14

- Limit automatic anchoring depth callouts to the configured target depth
  window so deeper water, such as 8 metres with a 2-3 metre target, is tracked
  but not announced.

## 0.5.13

- Rename Instrument Alerts notification provider/category/settings identifiers
  from legacy Audible Instruments wording to AJRM Marine Instrument Alerts.
- Add a bounded migration from the previous settings filename to the new AJRM
  settings filename.

## 0.5.12

- Keep Anchor dropped repeatable for re-anchoring, changing the button to
  "Mark anchor dropped again" after a drop while a recent depth is available.
- Show whether Anchor dropped also set the Traffic profile to Anchor.
- Fall back to Traffic's shared API registry when the local plugin app object
  does not expose the Traffic API.

## 0.5.11

- Make Anchor dropped select the AJRM Marine Traffic Anchor profile when the
  Traffic in-process API is available, while still announcing the measured
  anchor-drop depth.
- Advertise the Anchor dropped Traffic-profile bridge in the status projection
  so Console BITE can verify the deployed capability.

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
