import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

test("la sincronización conserva una instantánea anterior si falla una escritura local", () => {
  const start = app.indexOf("function writeSyncSnapshot(notes, tasks)");
  const end = app.indexOf("\nlet syncInProgress", start);
  assert.ok(start >= 0 && end > start, "No se ha encontrado writeSyncSnapshot");
  const helper = app.slice(start, end);

  assert.match(helper, /localStorage\.getItem\(key\)/);
  assert.match(helper, /localStorage\.setItem\(key, JSON\.stringify\(value\)\)/);
  assert.match(helper, /localStorage\.removeItem\(key\)/);
  assert.match(helper, /localStorage\.setItem\(key, rawValue\)/);
  assert.match(helper, /catch\s*\{/);
  assert.match(helper, /return false/);
});

test("no se envía la memoria al servidor si falla el guardado local", () => {
  const start = app.indexOf("async function syncNow(");
  const end = app.indexOf("\n\nasync function askJarvis", start);
  assert.ok(start >= 0 && end > start, "No se ha encontrado syncNow");
  const sync = app.slice(start, end);
  const guard = sync.indexOf("if (!writeSyncSnapshot(notes, tasks))");
  const push = sync.indexOf('await syncRequest("sync_push"');

  assert.ok(guard >= 0, "Falta la comprobación del guardado local");
  assert.ok(push > guard, "La escritura remota debe ocurrir después del guardado local");
  assert.match(sync.slice(guard, push), /throw new Error/);
});
