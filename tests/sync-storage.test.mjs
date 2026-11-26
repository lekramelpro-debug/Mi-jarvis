import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const helperStart = app.indexOf("function writeSyncSnapshot(notes, tasks)");
const helperEnd = app.indexOf("\\nlet syncInProgress", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "No se ha encontrado writeSyncSnapshot");
const helperSource = app.slice(helperStart, helperEnd);

function runHelper(storage) {
  const context = {
    KEYS: { notes: "jarvis-v3-notes", tasks: "jarvis-v3-tasks" },
    localStorage: storage,
    JSON
  };
  vm.runInNewContext(helperSource + "\\nglobalThis.writeSyncSnapshot = writeSyncSnapshot;", context);
  return context.writeSyncSnapshot;
}

function createStorage(initial = new Map(), overrides = {}) {
  const values = new Map(initial);
  const storage = {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    ...overrides
  };
  return storage;
}

test("guarda notas y tareas y devuelve true cuando ambas escrituras funcionan", () => {
  const storage = createStorage();
  const writeSyncSnapshot = runHelper(storage);
  const notes = [{ id: "n1", text: "Nota nueva" }];
  const tasks = [{ id: "t1", text: "Tarea nueva" }];

  assert.equal(writeSyncSnapshot(notes, tasks), true);
  assert.equal(storage.values.get("jarvis-v3-notes"), JSON.stringify(notes));
  assert.equal(storage.values.get("jarvis-v3-tasks"), JSON.stringify(tasks));
});

test("restaura los valores anteriores si falla la segunda escritura", () => {
  const oldNotes = '[{"id":"old","text":"Conservar"}]';
  const storage = createStorage(new Map([["jarvis-v3-notes", oldNotes]]));
  const originalSetItem = storage.setItem.bind(storage);
  let failNextTaskWrite = true;
  storage.setItem = (key, value) => {
    if (key === "jarvis-v3-tasks" && failNextTaskWrite) {
      failNextTaskWrite = false;
      throw new Error("QuotaExceededError");
    }
    originalSetItem(key, value);
  };

  const writeSyncSnapshot = runHelper(storage);
  assert.equal(writeSyncSnapshot([{ id: "new" }], [{ id: "task" }]), false);
  assert.equal(storage.values.get("jarvis-v3-notes"), oldNotes);
  assert.equal(storage.values.has("jarvis-v3-tasks"), false);
});

test("no escribe nada si no puede leer la instantánea anterior", () => {
  let writes = 0;
  const storage = createStorage(new Map(), {
    getItem() {
      throw new Error("StorageUnavailable");
    },
    setItem() {
      writes++;
    }
  });

  assert.equal(runHelper(storage)([], []), false);
  assert.equal(writes, 0);
});

test("no se envía la memoria al servidor si falla el guardado local", () => {
  const start = app.indexOf("async function syncNow(");
  const end = app.indexOf("\\n\\nasync function askJarvis", start);
  assert.ok(start >= 0 && end > start, "No se ha encontrado syncNow");
  const sync = app.slice(start, end);
  const guard = sync.indexOf("if (!writeSyncSnapshot(notes, tasks))");
  const push = sync.indexOf('await syncRequest("sync_push"');

  assert.ok(guard >= 0, "Falta la comprobación del guardado local");
  assert.ok(push > guard, "La escritura remota debe ocurrir después del guardado local");
  assert.match(sync.slice(guard, push), /throw new Error/);
});
