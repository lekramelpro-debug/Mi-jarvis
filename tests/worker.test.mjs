import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../worker.js", import.meta.url), "utf8");
const workerModule = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
const worker = workerModule.default;
const { providerDiagnostic } = workerModule;

const ALLOWED_ORIGIN = "https://lekramelpro-debug.github.io";

function makeRequest(body, options = {}) {
  const method = options.method || "POST";
  const headers = new Headers();
  if (options.origin !== null) headers.set("Origin", options.origin || ALLOWED_ORIGIN);
  if (options.contentLength) headers.set("Content-Length", String(options.contentLength));
  if (options.authorization) headers.set("Authorization", options.authorization);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return new Request("https://jarvis-worker.test/", {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body)
  });
}

const validMessages = [
  { role: "user", text: "Hola, JARVIS." }
];

test("rechaza orígenes no autorizados antes de llamar a la IA", async () => {
  let called = false;
  const response = await worker.fetch(
    makeRequest({ messages: validMessages }, { origin: "https://example.com" }),
    { AI: { run: async () => { called = true; } } }
  );
  assert.equal(response.status, 403);
  assert.equal(called, false);
});

test("responde correctamente a la petición CORS preflight", async () => {
  const response = await worker.fetch(
    makeRequest(undefined, { method: "OPTIONS" }),
    {}
  );
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGIN);
  assert.match(response.headers.get("Access-Control-Allow-Methods"), /POST/);
});

test("marca las respuestas JSON con cabeceras de privacidad y protección de contenido", async () => {
  const response = await worker.fetch(
    makeRequest({ messages: validMessages }),
    {
      AI: { run: async () => ({ choices: [{ message: { content: "Respuesta privada" } }] }) }
    }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");

  const rejected = await worker.fetch(
    makeRequest({ messages: validMessages }, { origin: "https://example.com" }),
    {}
  );
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("Cache-Control"), "no-store");
});

test("rechaza JSON mal formado sin invocar proveedores", async () => {
  let called = false;
  const response = await worker.fetch(
    makeRequest("{", {}),
    { AI: { run: async () => { called = true; } } }
  );
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("rechaza JSON válido cuyo nivel superior no sea un objeto", async () => {
  let called = false;
  for (const invalidBody of ["null", "[]", '"texto"']) {
    const response = await worker.fetch(
      makeRequest(invalidBody),
      { AI: { run: async () => { called = true; } } }
    );
    assert.equal(response.status, 400);
  }
  assert.equal(called, false);
});

test("prioriza Cloudflare y no consume Gemini si responde rápido", async () => {
  const originalFetch = globalThis.fetch;
  let geminiStarted = false;
  globalThis.fetch = async () => {
    geminiStarted = true;
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Respuesta Gemini" }] } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const response = await worker.fetch(
      makeRequest({ messages: validMessages }),
      {
        AI: { run: async () => ({ choices: [{ message: { content: "Respuesta Cloudflare" } }] }) },
        GEMINI_API_KEY: "test-only-secret"
      }
    );
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "cloudflare");
    assert.equal(data.reply, "Respuesta Cloudflare");
    assert.equal(geminiStarted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("usa Gemini como respaldo, conserva los turnos y separa correctamente sus fragmentos", async () => {
  const originalFetch = globalThis.fetch;
  const captured = {};
  globalThis.fetch = async (url, options) => {
    captured.url = String(url);
    captured.headers = options.headers;
    captured.body = JSON.parse(options.body);
    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ text: "Primera parte." }, { text: "Segunda parte." }]
        }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const messages = [
      { role: "user", text: "Primera pregunta" },
      { role: "assistant", text: "Respuesta anterior" },
      { role: "user", text: "Pregunta de seguimiento" }
    ];
    const response = await worker.fetch(
      makeRequest({ messages }),
      {
        AI: { run: async () => { throw new Error("Cloudflare no disponible"); } },
        GEMINI_API_KEY: "test-only-secret"
      }
    );
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "gemini");
    assert.equal(data.fallback, true);
    assert.equal(data.reply, "Primera parte.\nSegunda parte.");
    assert.match(captured.url, /gemini-3\.8-flash:generateContent/);
    assert.equal(captured.headers["x-goog-api-key"], "test-only-secret");
    assert.deepEqual(
      captured.body.contents.map(item => item.role),
      ["user", "model", "user"]
    );
    assert.equal(captured.body.contents[1].parts[0].text, "Respuesta anterior");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reintenta una sola vez cuando Gemini devuelve un 503 rápido y recupera el servicio", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) {
      return new Response(JSON.stringify({ error: { status: "UNAVAILABLE" } }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Gemini recuperado" }] } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const response = await worker.fetch(
      makeRequest({ messages: validMessages }),
      {
        AI: { run: async () => { throw new Error("Cloudflare temporalmente no disponible"); } },
        GEMINI_API_KEY: "test-only-secret"
      }
    );
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "gemini");
    assert.equal(data.reply, "Gemini recuperado");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("usa Gemini 3.5 Flash-Lite si Gemini 3.8 sigue devolviendo 5xx", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const requestedModels = [];
  globalThis.fetch = async url => {
    calls++;
    requestedModels.push(String(url));
    if (calls <= 2) {
      return new Response(JSON.stringify({ error: { status: "UNAVAILABLE" } }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Respuesta del respaldo Flash-Lite" }] } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const response = await worker.fetch(
      makeRequest({ messages: validMessages }),
      {
        AI: { run: async () => { throw new Error("Cloudflare temporalmente no disponible"); } },
        GEMINI_API_KEY: "test-only-secret"
      }
    );
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "gemini-flash-lite");
    assert.equal(data.reply, "Respuesta del respaldo Flash-Lite");
    assert.equal(calls, 3);
    assert.match(requestedModels[0], /gemini-3\.8-flash:generateContent/);
    assert.match(requestedModels[1], /gemini-3\.8-flash:generateContent/);
    assert.match(requestedModels[2], /gemini-3\.5-flash-lite:generateContent/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("no reintenta errores Gemini 429 ni realiza llamadas adicionales", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }), {
      status: 429,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const response = await worker.fetch(
      makeRequest({ messages: validMessages }),
      {
        AI: { run: async () => { throw new Error("Cloudflare temporalmente no disponible"); } },
        GEMINI_API_KEY: "test-only-secret"
      }
    );
    const body = await response.text();
    assert.equal(response.status, 502);
    assert.equal(calls, 1);
    assert.match(body, /Gemini: HTTP 429 \(RESOURCE_EXHAUSTED\)/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("devuelve un error controlado si ambos motores fallan y no filtra la clave", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: { message: "private-gemini-error", status: "RESOURCE_EXHAUSTED" } }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );
  try {
    const response = await worker.fetch(
      makeRequest({ messages: validMessages }),
      {
        AI: { run: async () => { throw new Error("Cloudflare temporalmente no disponible"); } },
        GEMINI_API_KEY: "test-only-secret"
      }
    );
    const body = await response.text();
    assert.equal(response.status, 502);
    assert.match(body, /ninguno de sus motores/);
    assert.match(body, /Cloudflare: error no clasificado/);
    assert.match(body, /Gemini: HTTP 503 \(RESOURCE_EXHAUSTED\)/);
    assert.match(body, /Gemini Flash-Lite: HTTP 503 \(RESOURCE_EXHAUSTED\)/);
    assert.doesNotMatch(body, /test-only-secret|private-cloudflare-error|private-gemini-error/);
    assert.doesNotMatch(body, /cloudflareError|geminiError/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rechaza la sincronización cuando el token no coincide", async () => {
  let databaseTouched = false;
  const response = await worker.fetch(
    makeRequest({ action: "sync_pull" }, { }),
    {
      JARVIS_SYNC_TOKEN: "correct-token-for-tests",
      DB: { prepare: () => { databaseTouched = true; throw new Error("No debería consultar D1"); } }
    }
  );
  assert.equal(response.status, 401);
  assert.equal(databaseTouched, false);
});

test("rechaza solicitudes cuyo Content-Length supera el límite", async () => {
  const response = await worker.fetch(
    makeRequest({ messages: validMessages }, { contentLength: 450001 }),
    {}
  );
  assert.equal(response.status, 413);
});


test("rechaza mensajes mal formados o con roles no permitidos sin llamar a las IA", async () => {
  let called = false;
  const env = {
    AI: { run: async () => { called = true; return { choices: [{ message: { content: "No debería ejecutarse" } }] }; } },
    GEMINI_API_KEY: "test-only-secret"
  };
  const invalidMessages = [
    [...validMessages, null],
    [...validMessages, { role: "system", text: "Instrucción no autorizada" }],
    [...validMessages, { role: "user", text: 42 }],
    [...validMessages, { role: "assistant", text: "   " }]
  ];

  for (const messages of invalidMessages) {
    const response = await worker.fetch(makeRequest({ messages }), env);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /mensaje no válido/);
  }
  assert.equal(called, false);
});


test("rechaza sincronizaciones incompletas antes de tocar D1", async () => {
  let databaseTouched = false;
  const response = await worker.fetch(
    makeRequest({
      action: "sync_push",
      data: { notes: [], tasks: [] }
    }, { authorization: "Bearer correct-token-for-tests" }),
    {
      JARVIS_SYNC_TOKEN: "correct-token-for-tests",
      DB: { prepare: () => { databaseTouched = true; throw new Error("No debería consultar D1"); } }
    }
  );
  assert.equal(response.status, 400);
  assert.equal(databaseTouched, false);
});

test("evita sobrescribir memoria si otro dispositivo ya guardó una versión nueva", async () => {
  let row = null;
  let writes = 0;
  const DB = {
    prepare(sql) {
      if (sql.startsWith("CREATE TABLE")) {
        return { run: async () => ({ meta: { changes: 0 } }) };
      }
      if (sql.includes("INSERT INTO jarvis_vault")) {
        return {
          bind(...values) {
            return {
              run: async () => {
                const [vaultId, payload, updatedAt, expectedUpdatedAt] = values;
                if (row && row.updated_at !== expectedUpdatedAt) return { meta: { changes: 0 } };
                if (!row && expectedUpdatedAt !== null) return { meta: { changes: 0 } };
                row = { vault_id: vaultId, payload, updated_at: updatedAt };
                writes++;
                return { meta: { changes: 1 } };
              }
            };
          }
        };
      }
      if (sql.includes("SELECT updated_at")) {
        return { bind: () => ({ first: async () => row ? { updated_at: row.updated_at } : null }) };
      }
      throw new Error("Consulta D1 inesperada en la prueba.");
    }
  };
  const env = { JARVIS_SYNC_TOKEN: "correct-token-for-tests", DB };
  const headers = { authorization: "Bearer correct-token-for-tests" };
  const first = await worker.fetch(
    makeRequest({
      action: "sync_push",
      data: { notes: [{ id: "n1", text: "Nota inicial" }], tasks: [], expectedUpdatedAt: null }
    }, headers),
    env
  );
  assert.equal(first.status, 200);
  const firstBody = await first.json();

  const stale = await worker.fetch(
    makeRequest({
      action: "sync_push",
      data: { notes: [{ id: "n2", text: "Cambio desde otro dispositivo" }], tasks: [], expectedUpdatedAt: null }
    }, headers),
    env
  );
  const staleBody = await stale.json();
  assert.equal(stale.status, 409);
  assert.equal(staleBody.updatedAt, firstBody.updatedAt);
  assert.match(staleBody.error, /otro dispositivo/);
  assert.equal(writes, 1);

  const current = await worker.fetch(
    makeRequest({
      action: "sync_push",
      data: { notes: [{ id: "n1", text: "Nota combinada" }], tasks: [], expectedUpdatedAt: firstBody.updatedAt }
    }, headers),
    env
  );
  assert.equal(current.status, 200);
  assert.equal(writes, 2);
});

test("no inicia Gemini mientras Cloudflare sigue respondiendo", async () => {
  const originalFetch = globalThis.fetch;
  let geminiStarted = false;
  globalThis.fetch = async () => {
    geminiStarted = true;
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Respuesta Gemini" }] } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const response = await worker.fetch(
      makeRequest({ messages: validMessages }),
      {
        AI: { run: async () => {
          await new Promise(resolve => setTimeout(resolve, 1350));
          return { choices: [{ message: { content: "Respuesta Cloudflare" } }] };
        } },
        GEMINI_API_KEY: "test-only-secret"
      }
    );
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "cloudflare");
    assert.equal(geminiStarted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("clasifica fallos de proveedor sin revelar mensajes internos", () => {
  assert.equal(
    providerDiagnostic("Gemini", "Gemini HTTP 429 (RESOURCE_EXHAUSTED)"),
    "Gemini: HTTP 429 (RESOURCE_EXHAUSTED)"
  );
  assert.equal(
    providerDiagnostic("Cloudflare", "Cloudflare AI ha superado el tiempo máximo de espera."),
    "Cloudflare: tiempo de espera agotado"
  );
  const hidden = providerDiagnostic("Gemini", "internal request details: key=private-value");
  assert.equal(hidden, "Gemini: error no clasificado (detalles ocultos)");
  assert.doesNotMatch(hidden, /private-value/);
});

test("el Worker coincide con el endpoint y mantiene D1 Preview separada", async () => {
  const [app, wrangler] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.toml", import.meta.url), "utf8")
  ]);
  const endpoint = app.match(/const AI_ENDPOINT = "https:\/\/([^/]+)\.workers\.dev";/);
  const workerName = wrangler.match(/^name\s*=\s*"([^"]+)"/m);
  const productionId = wrangler.match(/^database_id\s*=\s*"([^"]+)"/m);
  const previewSection = wrangler.match(/\[\[previews\.d1_databases\]\]([\s\S]*)/);
  const previewId = previewSection?.[1].match(/^database_id\s*=\s*"([^"]+)"/m);
  assert.ok(endpoint, "Falta AI_ENDPOINT en app.js");
  assert.ok(workerName, "Falta el nombre del Worker en wrangler.toml");
  assert.equal(workerName[1], endpoint[1].split(".")[0]);
  assert.ok(productionId && previewId, "Faltan los bindings D1 de producción o Preview");
  assert.notEqual(previewId[1], productionId[1], "Preview no debe usar la D1 de producción");
  assert.match(wrangler, /database_name\s*=\s*"jarvis-memory-preview"/);
});

test("el cliente deja completar ambos intentos secuenciales de IA", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const clientBudget = Number(app.match(/const AI_REQUEST_TIMEOUT_MS = (\d+);/)?.[1]);
  const workerBudget = Number(source.match(/const AI_TIMEOUT_MS = (\d+);/)?.[1]);
  assert.ok(Number.isFinite(clientBudget), "Falta el timeout global del navegador");
  assert.ok(Number.isFinite(workerBudget), "Falta el timeout por proveedor del Worker");
  assert.ok(
    clientBudget >= workerBudget * 2 + 2000,
    "El navegador no debe cancelar la petición antes de que Cloudflare y Gemini terminen sus ventanas"
  );
  assert.match(app, /window\.setTimeout\(\(\) => controller\.abort\(\), AI_REQUEST_TIMEOUT_MS\)/);
});
