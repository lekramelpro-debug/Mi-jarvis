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
