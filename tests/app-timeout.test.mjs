import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

test("el aviso de espera usa el timeout real configurado para la IA", () => {
  assert.match(app, /const AI_REQUEST_TIMEOUT_MS = 33000;/);
  assert.match(app, /const AI_REQUEST_TIMEOUT_SECONDS = Math\.ceil\(AI_REQUEST_TIMEOUT_MS \/ 1000\);/);
  assert.match(app, /tiempo máximo de espera de \$\{AI_REQUEST_TIMEOUT_SECONDS\} segundos/);
  assert.doesNotMatch(app, /tiempo máximo de espera de 18 segundos/);
});
