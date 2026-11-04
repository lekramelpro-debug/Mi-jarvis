const ALLOWED_ORIGIN = "https://lekramelpro-debug.github.io";
const MODEL = "gemini-3.5-flash";

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
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) }
  });
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin !== ALLOWED_ORIGIN) return json({ error: "Origen no permitido." }, 403, origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== "POST") return json({ error: "Método no permitido." }, 405, origin);
    if (!env.GEMINI_API_KEY) return json({ error: "Falta configurar la clave privada de Gemini en Cloudflare." }, 503, origin);

    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 18000) return json({ error: "Mensaje demasiado largo." }, 413, origin);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Solicitud no válida." }, 400, origin); }
    if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 14) {
      return json({ error: "Conversación no válida." }, 400, origin);
    }
    const contents = [];
    for (const item of body.messages) {
      if (!item || !["user", "model"].includes(item.role) || typeof item.text !== "string") continue;
      const text = item.text.trim().slice(0, 1600);
      if (text) contents.push({ role: item.role, parts: [{ text }] });
    }
    if (!contents.length || contents[contents.length - 1].role !== "user") {
      return json({ error: "No se ha recibido un mensaje válido." }, 400, origin);
    }

    const system = "Eres JARVIS, un asistente personal útil, educado, sereno y resolutivo. Responde siempre en español natural, salvo que el usuario pida otro idioma. Sé claro y práctico, adapta las explicaciones a un estudiante adolescente, fomenta decisiones seguras y responsables. No afirmes haber realizado acciones que no hayas ejecutado. No puedes acceder por tu cuenta a archivos, cuentas, calendario ni al dispositivo: explica tus límites con honestidad. No solicites contraseñas, claves API ni datos privados. Responde con brevedad razonable y usa listas cuando ayuden.";
    let upstream;
    try {
      upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 700 }
        })
      });
    } catch {
      return json({ error: "No se ha podido conectar con Gemini. Inténtalo de nuevo." }, 502, origin);
    }
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : 502;
      return json({ error: status === 429 ? "Se ha alcanzado temporalmente el límite gratuito de Gemini. Prueba más tarde." : "Gemini no ha podido responder. Revisa la configuración de la conexión." }, status, origin);
    }
    const reply = data.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
    if (!reply) return json({ error: "Gemini no ha devuelto una respuesta de texto." }, 502, origin);
    return json({ reply }, 200, origin);
  }
};
