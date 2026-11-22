import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../worker.js", import.meta.url), "utf8");
const worker = (await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
)).default;

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

test("devuelve un error controlado si ambos motores fallan y no filtra la clave", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: { message: "servicio temporalmente no disponible" } }),
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
    assert.match(body, /ninguno de sus dos motores/);
    assert.doesNotMatch(body, /test-only-secret/);
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
