import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const labels = [...html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)];
const explicitlyLabelled = new Set(
  labels.map((match) => match[1].match(/\bfor=["']([^"']+)["']/i)?.[1]).filter(Boolean)
);

function hasAccessibleName(attributes, index) {
  if (/\baria-label\s*=\s*["'][^"']+["']/i.test(attributes)) return true;

  const id = attributes.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
  if (id && explicitlyLabelled.has(id)) return true;

  const before = html.slice(0, index);
  return before.lastIndexOf("<label") > before.lastIndexOf("</label>");
}

test("todos los campos visibles tienen un nombre accesible", () => {
  const controls = [...html.matchAll(/<(input|textarea|select)\b([^>]*)>/gi)];
  const unnamed = controls.filter((match) => {
    const attributes = match[2];
    const type = attributes.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1];
    if (/\bhidden\b/i.test(attributes) || type === "hidden") return false;
    return !hasAccessibleName(attributes, match.index);
  }).map((match) => match[2].match(/\bid=["']([^"']+)/i)?.[1] || match[1]);

  assert.deepEqual(unnamed, [], "Hay campos sin nombre accesible: " + unnamed.join(", "));
});

test("los campos de tarea y búsqueda tienen etiquetas explícitas", () => {
  assert.match(html, /<input\b[^>]*id="taskInput"[^>]*aria-label="Nueva tarea"/);
  assert.match(html, /<input\b[^>]*id="searchInput"[^>]*aria-label="Consulta de búsqueda"/);
});
