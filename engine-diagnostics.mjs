export function providerDiagnostic(provider, error) {
  const label = provider === "Cloudflare" ? "Cloudflare" : provider === "Gemini" ? "Gemini" : "Motor";
  const message = typeof error === "string"
    ? error
    : String(error?.message || error || "");

  if (/superado el tiempo máximo de espera|timed? ?out|timeout/i.test(message)) {
    return `${label}: tiempo de espera agotado`;
  }
  if (/no está disponible|no está configurado|falta el secreto/i.test(message)) {
    return `${label}: configuración o binding no disponible`;
  }
  if (/no ha devuelto texto|respuesta vacía/i.test(message)) {
    return `${label}: respuesta vacía`;
  }

  const status = message.match(/\b(?:HTTP\s*)?(400|401|402|403|404|408|409|413|422|429|5\d{2})(?:\s+\(([A-Z_]{2,40})\))?/i);
  if (status) {
    return `${label}: HTTP ${status[1]}${status[2] ? ` (${status[2]})` : ""}`;
  }

  return `${label}: error no clasificado (detalles ocultos)`;
}
