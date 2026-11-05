const ALLOWED_ORIGIN = "https://lekramelpro-debug.github.io";
const MODEL = "@cf/zai-org/glm-4.7-flash";

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...cors(origin)
    }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (origin !== ALLOWED_ORIGIN) {
      return json({ error: "Origen no permitido." }, 403, origin);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (request.method !== "POST") {
      return json({ error: "Método no permitido." }, 405, origin);
    }

    if (!env.AI || typeof env.AI.run !== "function") {
      return json({
        error: "Falta conectar Workers AI. En Cloudflare, añade un binding de Workers AI llamado AI y vuelve a desplegar."
      }, 503, origin);
    }

    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 18000) {
      return json({ error: "Mensaje demasiado largo." }, 413, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Solicitud no válida." }, 400, origin);
    }

    if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 14) {
      return json({ error: "Conversación no válida." }, 400, origin);
    }

    const system = "Eres JARVIS, un asistente personal útil, educado, sereno y resolutivo. Responde siempre en español natural, salvo que el usuario pida otro idioma. Sé claro y práctico, adapta las explicaciones a un estudiante adolescente, fomenta decisiones seguras y responsables. No afirmes haber realizado acciones que no hayas ejecutado. No puedes acceder por tu cuenta a archivos, cuentas, calendario ni al dispositivo: explica tus límites con honestidad. No solicites contraseñas, claves API ni datos privados. Responde con brevedad razonable y usa listas cuando ayuden.";

    const messages = [{ role: "system", content: system }];

    for (const item of body.messages) {
      if (!item || !["user", "model", "assistant"].includes(item.role) || typeof item.text !== "string") {
        continue;
      }

      const text = item.text.trim().slice(0, 1600);
      if (!text) continue;

      messages.push({
        role: item.role === "user" ? "user" : "assistant",
        content: text
      });
    }

    if (messages.length < 2 || messages[messages.length - 1].role !== "user") {
      return json({ error: "No se ha recibido un mensaje válido." }, 400, origin);
    }

    try {
      const result = await env.AI.run(MODEL, { messages });
      const reply = result?.choices?.[0]?.message?.content;

      if (typeof reply !== "string" || !reply.trim()) {
        return json({
          error: "El modelo de Cloudflare no ha devuelto una respuesta de texto. Inténtalo de nuevo."
        }, 502, origin);
      }

      return json({ reply: reply.trim() }, 200, origin);
    } catch (error) {
      return json({
        error: "Workers AI no ha podido responder. Comprueba que el binding AI está activo y vuelve a intentarlo."
      }, 502, origin);
    }
  }
};
