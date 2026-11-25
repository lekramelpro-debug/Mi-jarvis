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
  const start = app.indexOf('$("exportAll").addEventListener');
  const end = app.indexOf("\n});", start);
  assert.ok(start >= 0 && end > start, "No se ha encontrado la acción de exportación");
  const backup = app.slice(start, end);
  for (const field of ["businessTests", "dailySkillProgress", "futsalProgress", "futsalReviews", "weeklyReviews"]) {
    assert.match(backup, new RegExp("(?:\\b" + field + "\\s*:|^\\s*" + field + "\\s*,)", "m"));
  }
});

test("la importación rechaza copias grandes antes de leer o analizar el JSON", () => {
  const start = app.indexOf('$("importFile").addEventListener');
  const end = app.indexOf('$("searchForm").addEventListener', start);
  assert.ok(start >= 0 && end > start, "No se ha encontrado el controlador de importación");
  const handler = app.slice(start, end);
  const sizeGuard = handler.indexOf("file.size > 5 * 1024 * 1024");
  const fileRead = handler.indexOf("await file.text()");
  const jsonParse = handler.indexOf("JSON.parse(");
  assert.ok(sizeGuard >= 0, "Falta el límite de tamaño de la copia");
  assert.ok(fileRead > sizeGuard && jsonParse > sizeGuard, "El tamaño debe comprobarse antes de leer y analizar el archivo");
});
