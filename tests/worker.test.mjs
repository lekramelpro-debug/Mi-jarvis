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

test("utiliza Cloudflare cuando devuelve una respuesta válida", async () => {
  const originalFetch = globalThis.fetch;
  let fallbackCalled = false;
  globalThis.fetch = async () => {
    fallbackCalled = true;
    throw new Error("Gemini no debería haberse llamado");
  };
  try {
    const response = await worker.fetch(
      makeRequest({ messages: validMessages }),
      { AI: { run: async () => ({ choices: [{ message: { content: "Respuesta principal" } }] }) } }
    );
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "cloudflare");
    assert.equal(data.reply, "Respuesta principal");
    assert.equal(fallbackCalled, false);
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
