import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");

test("mantiene visible una alternativa manual cuando el navegador no ofrece instalación automática", () => {
  assert.match(app, /if \(!installPrompt\)\s*\{[\s\S]*?Añadir a pantalla de inicio/);
  assert.match(app, /installButton\.hidden = false/);
  assert.match(app, /beforeinstallprompt/);
});

test("oculta el acceso de instalación cuando la PWA ya está instalada", () => {
  assert.match(app, /display-mode:\s*standalone/);
  assert.match(app, /window\.addEventListener\("appinstalled"/);
  assert.match(app, /installButton\.hidden = true/);
});

test("la página y el service worker usan la misma versión de caché", () => {
  const htmlVersion = html.match(/app\.js\?v=jarvis-(\d+)/)?.[1];
  const cacheVersion = serviceWorker.match(/jarvis-cache-v(\d+)/)?.[1];
  const workerAppVersion = serviceWorker.match(/app\.js\?v=jarvis-(\d+)/)?.[1];
  assert.ok(htmlVersion, "Falta versión de app.js en index.html");
  assert.equal(cacheVersion, htmlVersion);
  assert.equal(workerAppVersion, htmlVersion);
});

test("actualiza la PWA desde la red y conserva fallback cuando no hay conexión", () => {
  const networkFetch = serviceWorker.indexOf("fetch(event.request)");
  const cacheFallback = serviceWorker.indexOf("caches.match(event.request)");
  assert.ok(networkFetch >= 0, "Falta la petición de red");
  assert.ok(cacheFallback > networkFetch, "La caché debe consultarse después de fallar la red");
  assert.match(serviceWorker, /\.catch\(async \(\) =>/);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);
  assert.match(serviceWorker, /caches\.match\("\.\/index\.html"\)/);
});
