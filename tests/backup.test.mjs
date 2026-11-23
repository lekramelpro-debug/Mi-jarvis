import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

test("la copia de seguridad no incluye la clave privada de sincronización", () => {
  const start = app.indexOf("const safeSettings = {");
  const end = app.indexOf("\n  };", start);
  assert.ok(start >= 0, "No se ha encontrado el bloque de ajustes seguros");
  assert.ok(end > start, "No se ha podido delimitar el bloque de ajustes seguros");
  const safeSettings = app.slice(start, end);
  assert.doesNotMatch(safeSettings, /syncToken|JARVIS_SYNC_TOKEN/i);
  assert.match(app.slice(end, end + 500), /settings:\s*safeSettings/);
});

test("la copia de seguridad conserva los datos de progreso", () => {
  const start = app.indexOf('$("#exportAll").addEventListener');
  const end = app.indexOf("\n});", start);
  assert.ok(start >= 0 && end > start, "No se ha encontrado la acción de exportación");
  const backup = app.slice(start, end);
  for (const field of ["businessTests", "dailySkillProgress", "futsalProgress", "futsalReviews", "weeklyReviews"]) {
    assert.match(backup, new RegExp("(?:\\b" + field + "\\s*:|^\\s*" + field + "\\s*,)", "m"));
  }
});
