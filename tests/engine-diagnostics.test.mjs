import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { providerDiagnostic } from "../engine-diagnostics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("identifica un timeout sin mostrar el mensaje interno", () => {
  assert.equal(
    providerDiagnostic("Cloudflare", "Cloudflare AI ha superado el tiempo máximo de espera."),
    "Cloudflare: tiempo de espera agotado"
  );
});

test("identifica una configuración ausente", () => {
  assert.equal(
    providerDiagnostic("Gemini", "Gemini no está configurado: falta el secreto GEMINI_API_KEY."),
    "Gemini: configuración o binding no disponible"
  );
});

test("conserva el estado HTTP y el código seguro del proveedor", () => {
  assert.equal(
    providerDiagnostic("Gemini", "Gemini HTTP 429 (RESOURCE_EXHAUSTED)"),
    "Gemini: HTTP 429 (RESOURCE_EXHAUSTED)"
  );
});

test("identifica errores de solicitud o credenciales con HTTP 400", () => {
  assert.equal(
    providerDiagnostic("Gemini", "Gemini HTTP 400 (API_KEY_INVALID)"),
    "Gemini: HTTP 400 (API_KEY_INVALID)"
  );
});

test("clasifica una respuesta vacía", () => {
  assert.equal(
    providerDiagnostic("Cloudflare", "Cloudflare AI no ha devuelto texto."),
    "Cloudflare: respuesta vacía"
  );
});

test("oculta detalles desconocidos que podrían contener datos privados", () => {
  const result = providerDiagnostic("Gemini", "provider internals: key=private-secret-value");
  assert.equal(result, "Gemini: error no clasificado (detalles ocultos)");
  assert.doesNotMatch(result, /private-secret-value/);
});

test("el nombre del Worker coincide con el endpoint de la PWA", async () => {
  const [app, wrangler] = await Promise.all([
    readFile(resolve(root, "app.js"), "utf8"),
    readFile(resolve(root, "wrangler.toml"), "utf8")
  ]);
  const endpoint = app.match(/const AI_ENDPOINT = "https:\/\/([^/]+)\.workers\.dev";/);
  const workerName = wrangler.match(/^name\s*=\s*"([^"]+)"/m);
  assert.ok(endpoint, "No se ha encontrado AI_ENDPOINT en app.js");
  assert.ok(workerName, "No se ha encontrado name en wrangler.toml");
  assert.equal(workerName[1], endpoint[1].split(".")[0]);
});

test("la interfaz muestra el detalle seguro del Worker", async () => {
  const app = await readFile(resolve(root, "app.js"), "utf8");
  assert.match(app, /typeof data\.detail === "string"/);
});

test("Cloudflare Previews usa bindings AI y una D1 aislada", async () => {
  const wrangler = await readFile(resolve(root, "wrangler.toml"), "utf8");
  assert.match(wrangler, /^\[previews\.ai\]\s*\nbinding\s*=\s*"AI"/m);
  assert.match(wrangler, /^\[\[previews\.d1_databases\]\]\s*\nbinding\s*=\s*"DB"/m);
  assert.match(wrangler, /database_name\s*=\s*"jarvis-memory-preview"/);
  assert.match(wrangler, /database_id\s*=\s*"7e71aaaa-8320-4410-97ab-ba4617eaa7de"/);
  assert.doesNotMatch(wrangler, /\[\[previews\.d1_databases\]\][\s\S]*?database_id\s*=\s*"d808c2e4-aa71-45a6-82e1-8b1f89ba7865"/);
});

test("Gemini une las partes de texto con saltos de línea reales", async () => {
  const worker = await readFile(resolve(root, "worker.js"), "utf8");
  assert.match(worker, /\.join\("\\n"\)/);
});


test("la PWA usa caché versionada y estrategia network-first con fallback offline", async () => {
  const [serviceWorker, html] = await Promise.all([
    readFile(resolve(root, "service-worker.js"), "utf8"),
    readFile(resolve(root, "index.html"), "utf8")
  ]);
  assert.match(serviceWorker, /jarvis-cache-v40/);
  assert.match(serviceWorker, /fetch\(event\.request\)\.then/);
  assert.match(serviceWorker, /caches\.match\(event\.request\)/);
  assert.match(serviceWorker, /caches\.match\("\.\/index\.html"\)/);
  assert.match(serviceWorker, /app\.js\?v=jarvis-40/);
  assert.match(html, /app\.js\?v=jarvis-40/);
});

test("la copia de seguridad no incluye la clave privada de sincronización", async () => {
  const app = await readFile(resolve(root, "app.js"), "utf8");
  const start = app.indexOf("const safeSettings = {");
  const end = app.indexOf("\n  };", start);
  assert.ok(start >= 0, "No se ha encontrado el bloque de ajustes seguros");
  assert.ok(end > start, "No se ha podido delimitar el bloque de ajustes seguros");
  const safeSettings = app.slice(start, end);
  assert.doesNotMatch(safeSettings, /syncToken|JARVIS_SYNC_TOKEN/i);
  assert.match(app.slice(end, end + 500), /settings:\s*safeSettings/);
});

test("la copia de seguridad conserva las áreas de progreso principales", async () => {
  const app = await readFile(resolve(root, "app.js"), "utf8");
  const start = app.indexOf('$("exportAll").addEventListener');
  const end = app.indexOf('\n});', start);
  assert.ok(start >= 0 && end > start, "No se ha encontrado la acción de exportación completa");
  const backup = app.slice(start, end);
  for (const field of ["businessTests", "dailySkillProgress", "futsalProgress", "futsalReviews", "weeklyReviews"]) {
    assert.match(backup, new RegExp("\\b" + field + "\\s*:"));
  }
});
