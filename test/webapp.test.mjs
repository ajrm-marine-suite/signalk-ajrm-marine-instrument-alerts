import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("web app exposes and persists absolute-value monitoring", async () => {
  const [html, app] = await Promise.all([
    fs.readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    fs.readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /data-field="absoluteValue" type="checkbox"/);
  assert.match(app, /setField\(card, "absoluteValue", monitor\.absoluteValue === true\)/);
  assert.match(app, /absoluteValue: readChecked\(card, "absoluteValue"\)/);
});
