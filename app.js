/* JARVIS 1.0 — estados de voz y procesamiento, reconocimiento progresivo */
"use strict";

const $ = id => document.getElementById(id);
const KEYS = {
  notes: "jarvis-v3-notes",
  tasks: "jarvis-v3-tasks",
  chat: "jarvis-v3-chat",
  settings: "jarvis-v3-settings"
};

const safeRead = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
const read = (key, fallback = []) => {
  const value = safeRead(key, fallback);
  return Array.isArray(value) ? value : fallback;
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
const safeText = (tag, text, className) => {
  const node = document.createElement(tag);
  node.textContent = String(text ?? "");
  if (className) node.className = className;
  return node;
};

const settings = Object.assign(
  { voiceReplies: true, saveChat: true, shareMemoryWithAI: false, syncToken: "", voiceName: "", voiceLang: "", voiceRate: 1, voicePitch: 1 },
  safeRead(KEYS.settings, {})
);

function saveSettings() {
  write(KEYS.settings, settings);
}

function getSelectedVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find(voice => voice.name === settings.voiceName && voice.lang === settings.voiceLang) ||
    voices.find(voice => /^es(?:-|$)/i.test(voice.lang)) || null;
}

function speak(text, force = false) {
  if ((!settings.voiceReplies && !force) || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-ES";
  const voice = getSelectedVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  utterance.rate = Math.min(1.25, Math.max(0.75, Number(settings.voiceRate) || 1));
  utterance.pitch = Math.min(1.3, Math.max(0.7, Number(settings.voicePitch) || 1));
  window.speechSynthesis.speak(utterance);
}

function refreshVoiceList() {
  if (!("speechSynthesis" in window)) return;
  const select = $("voiceSelect");
  if (!select) return;
  const allVoices = window.speechSynthesis.getVoices();
  const spanish = allVoices.filter(voice => /^es(?:-|$)/i.test(voice.lang));
  const voices = spanish.length ? spanish : allVoices;
  const previous = settings.voiceName + "|" + settings.voiceLang;
  select.replaceChildren();

  const automatic = document.createElement("option");
  automatic.value = "";
  automatic.textContent = "Automática (predeterminada)";
  select.append(automatic);

  voices.forEach(voice => {
    const option = document.createElement("option");
    option.value = voice.name + "|" + voice.lang;
    option.textContent = voice.name + " (" + voice.lang + ")" + (voice.default ? " · predeterminada" : "");
    select.append(option);
  });

  select.value = previous;
  if (select.value !== previous) select.value = "";
  $("voiceSupport").textContent = voices.length
    ? (spanish.length ? voices.length + " voces disponibles en español en este dispositivo." : "No hay voces españolas detectadas; se muestran las voces instaladas.")
    : "El navegador todavía no ha cargado voces. Vuelve a abrir esta lista en unos segundos.";
}

function say(text, who = "assistant", persist = true) {
  const row = safeText("div", "", "message " + who);
  row.append(safeText("b", who === "assistant" ? "JARVIS" : "TÚ"));
  row.append(safeText("p", text));
  $("chatLog").append(row);
  $("chatLog").scrollTop = $("chatLog").scrollHeight;

  if (persist && settings.saveChat) {
    const history = read(KEYS.chat);
    history.push({ text, who, at: new Date().toISOString() });
    write(KEYS.chat, history.slice(-60));
  }
}

function restoreChat() {
  if (!settings.saveChat) return;
  read(KEYS.chat).forEach(message => say(message.text, message.who, false));
}

function setView(name) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.toggle("active", view.id === "view-" + name);
  });
  document.querySelectorAll(".nav").forEach(button => {
    button.classList.toggle("active", button.dataset.view === name);
  });
  const titles = {
    home: "Centro de mando",
    memory: "Memoria",
    tasks: "Mis tareas",
    research: "Investigación",
    tools: "Herramientas"
  };
  $("pageTitle").textContent = titles[name] || "JARVIS";
}

document.querySelectorAll(".nav").forEach(button => {
  button.addEventListener("click", () => setView(button.dataset.view));
});
document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => setView(button.dataset.go));
});

function formatDue(value) {
  if (!value) return "";
  let date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parts = value.split("-").map(Number);
    date = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return value;
  const dateText = date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  if (!value.includes("T")) return dateText;
  return dateText + " · " + date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderMemory() {
  const list = $("memoryList");
  list.replaceChildren();
  const notes = read(KEYS.notes).filter(item => !item.deletedAt);
  $("memoryCount").textContent = notes.length;

  if (!notes.length) {
    list.append(safeText("p", "Todavía no hay notas guardadas.", "empty"));
    return;
  }

  notes.forEach((item, index) => {
    const row = safeText("div", "", "data-item");
    row.append(safeText("span", item.text, "item-text"));
    row.append(safeText("small", new Date(item.created).toLocaleDateString("es-ES")));
    const remove = safeText("button", "Borrar", "delete-btn");
    remove.addEventListener("click", () => {
      const all = read(KEYS.notes);
      const visible = all.filter(item => !item.deletedAt);
      const target = visible[index];
      if (target) {
        target.deletedAt = new Date().toISOString();
        target.updatedAt = target.deletedAt;
      }
      write(KEYS.notes, all);
      renderMemory();
      syncNow(true);
    });
    row.append(remove);
    list.append(row);
  });
}

function renderTasks() {
  const list = $("taskList");
  const tasks = read(KEYS.tasks).filter(task => !task.deletedAt);
  list.replaceChildren();

  const pending = tasks.filter(task => !task.done);
  $("taskCount").textContent = pending.length;
  $("taskSummary").textContent = pending.length + " pendientes";
  $("homeTasks").replaceChildren();

  if (!tasks.length) {
    list.append(safeText("p", "Todavía no tienes tareas.", "empty"));
  }

  tasks.forEach((task, index) => {
    const row = safeText("div", "", "data-item" + (task.done ? " done" : ""));
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = !!task.done;
    check.setAttribute("aria-label", "Marcar tarea como completada");
    check.addEventListener("change", () => {
      const all = read(KEYS.tasks);
      const visible = all.filter(item => !item.deletedAt);
      visible[index].done = check.checked;
      visible[index].updatedAt = new Date().toISOString();
      write(KEYS.tasks, all);
      renderTasks();
      syncNow(true);
    });
    row.append(check);

    const label = safeText("span", task.text, "item-text");
    const details = "Prioridad: " + (task.priority || "Normal") +
      (task.due ? " · Fecha: " + formatDue(task.due) : "");
    label.append(safeText("small", details));
    row.append(label);

    const remove = safeText("button", "Borrar", "delete-btn");
    remove.addEventListener("click", () => {
      const all = read(KEYS.tasks);
      const visible = all.filter(item => !item.deletedAt);
      const target = visible[index];
      if (target) {
        target.deletedAt = new Date().toISOString();
        target.updatedAt = target.deletedAt;
      }
      write(KEYS.tasks, all);
      renderTasks();
      syncNow(true);
    });
    row.append(remove);
    list.append(row);
  });

  pending.slice(0, 4).forEach(task => {
    const label = task.text + (task.due ? " · " + formatDue(task.due) : "");
    $("homeTasks").append(safeText("div", label, "compact-item"));
  });
  if (!pending.length) {
    $("homeTasks").append(safeText("p", "No tienes tareas pendientes.", "empty"));
  }
}

function renderAll() {
  renderTasks();
  renderMemory();
}

function makeId() {
  if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "jv-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function addTask(text, priority = "Normal", due = "") {
  const tasks = read(KEYS.tasks);
  const now = new Date().toISOString();
  tasks.push({
    id: makeId(),
    text,
    priority,
    done: false,
    due,
    notified: false,
    created: now,
    updatedAt: now
  });
  write(KEYS.tasks, tasks);
  renderTasks();
  checkReminders();
  syncNow(true);
}

function addNote(text) {
  const notes = read(KEYS.notes);
  const now = new Date().toISOString();
  notes.unshift({ id: makeId(), text, created: now, updatedAt: now });
  write(KEYS.notes, notes);
  renderMemory();
  syncNow(true);
}

function ymd(date) {
  return date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0");
}

/* Interpreta expresiones sencillas: hoy, mañana, pasado mañana y a las 18:30. */
function extractSchedule(source, defaultReminder = false) {
  let cleaned = String(source || "").trim();
  const now = new Date();
  let date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let hasDate = false;
  let hasTime = false;
  let timeAmbiguous = false;
  let hour = 9;
  let minute = 0;

  const relative = cleaned.match(/\b(pasado mañana|mañana|hoy)\b/i);
  if (relative) {
    hasDate = true;
    const term = relative[1].toLocaleLowerCase("es");
    if (term === "mañana") date.setDate(date.getDate() + 1);
    if (term === "pasado mañana") date.setDate(date.getDate() + 2);
    cleaned = cleaned.replace(relative[0], " ");
  } else {
    const explicit = cleaned.match(/\b(?:el\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
    if (explicit) {
      let year = explicit[3] ? Number(explicit[3]) : now.getFullYear();
      if (year < 100) year += 2000;
      date = new Date(year, Number(explicit[2]) - 1, Number(explicit[1]));
      if (!explicit[3] && date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        date.setFullYear(date.getFullYear() + 1);
      }
      hasDate = !Number.isNaN(date.getTime());
      cleaned = cleaned.replace(explicit[0], " ");
    }
  }

  const wordHours = { una: 1, una: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
  const time = cleaned.match(/\ba\s+las\s+(\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?::(\d{2}))?\s*(?:h|horas)?(?:\s+de\s+la\s+(mañana|tarde|noche))?\b/i);
  if (time) {
    const rawHour = time[1].toLocaleLowerCase("es");
    hour = wordHours[rawHour] || Number(rawHour);
    minute = Number(time[2] || 0);
    const daypart = (time[3] || "").toLocaleLowerCase("es");
    if (daypart === "tarde" && hour < 12) hour += 12;
    if (daypart === "noche" && hour < 12) hour += 12;
    if (daypart === "mañana" && hour === 12) hour = 0;
    timeAmbiguous = !daypart && hour >= 1 && hour <= 12;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      hasTime = true;
      cleaned = cleaned.replace(time[0], " ");
    }
  }

  if (hasTime && !hasDate) {
    const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
    if (candidate.getTime() <= now.getTime()) date.setDate(date.getDate() + 1);
  }

  if (defaultReminder && hasDate && !hasTime) {
    hasTime = true;
    hour = 9;
    minute = 0;
  }

  cleaned = cleaned
    .replace(/\b(?:para|el día)\s*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .trim();

  let due = "";
  if (hasDate && hasTime) {
    due = ymd(date) + "T" + String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
  } else if (hasDate) {
    due = ymd(date);
  }
  return { text: cleaned, due, hasDate, hasTime, timeAmbiguous };
}

function dueDescription(value) {
  return formatDue(value).replace(" · ", " a las ");
}

function buildCalendarIntent(title, startDate) {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return false;
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const encode = value => encodeURIComponent(String(value)).replace(/'/g, "%27");
  const intent = "intent://calendar/events#Intent" +
    ";scheme=content" +
    ";action=android.intent.action.INSERT" +
    ";type=vnd.android.cursor.item/event" +
    ";S.title=" + encode(title) +
    ";l.beginTime=" + start.getTime() +
    ";l.endTime=" + end.getTime() +
    ";end";
  window.location.href = intent;
  return true;
}

const AI_ENDPOINT = "https://mi-jarvis.lekramelpro.workers.dev";

function syncRecordKey(item, kind) {
  if (item.id) return String(item.id);
  const created = String(item.created || "legacy");
  const content = String(item.text || "").slice(0, 120);
  return kind + ":" + created + ":" + content;
}

function syncRecordTime(item) {
  const value = item.updatedAt || item.deletedAt || item.created || "";
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function mergeSyncRecords(localItems, remoteItems, kind) {
  const merged = new Map();
  [...remoteItems, ...localItems].forEach(raw => {
    if (!raw || typeof raw.text !== "string") return;
    const item = Object.assign({}, raw, {
      id: syncRecordKey(raw, kind),
      updatedAt: raw.updatedAt || raw.deletedAt || raw.created || new Date(0).toISOString()
    });
    const previous = merged.get(item.id);
    if (!previous || syncRecordTime(item) >= syncRecordTime(previous)) {
      merged.set(item.id, item);
    }
  });
  return Array.from(merged.values());
}

function stableSyncRecords(items, kind) {
  return mergeSyncRecords([], items, kind)
    .sort((a, b) => a.id.localeCompare(b.id));
}

let syncInProgress = false;

async function syncRequest(action, data) {
  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + settings.syncToken
    },
    body: JSON.stringify({ action, data })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "No se pudo sincronizar.");
  return result;
}

async function syncNow(silent = false, forcePush = true) {
  if (!settings.syncToken) {
    if ($("syncStatus")) $("syncStatus").textContent = "Primero crea y guarda una clave de sincronización.";
    if (!silent) say("Primero introduce y guarda tu clave de sincronización.");
    return false;
  }
  if (syncInProgress) return false;
  syncInProgress = true;
  const button = $("syncNow");
  const status = $("syncStatus");
  if (button) button.disabled = true;
  if (status) status.textContent = "Sincronizando memoria…";

  try {
    const remote = await syncRequest("sync_pull");
    const remoteNotes = Array.isArray(remote.data?.notes) ? remote.data.notes : [];
    const remoteTasks = Array.isArray(remote.data?.tasks) ? remote.data.tasks : [];
    const notes = mergeSyncRecords(read(KEYS.notes), remoteNotes, "note");
    const tasks = mergeSyncRecords(read(KEYS.tasks), remoteTasks, "task");
    const changedRemotely =
      JSON.stringify(stableSyncRecords(notes, "note")) !== JSON.stringify(stableSyncRecords(remoteNotes, "note")) ||
      JSON.stringify(stableSyncRecords(tasks, "task")) !== JSON.stringify(stableSyncRecords(remoteTasks, "task"));

    write(KEYS.notes, notes);
    write(KEYS.tasks, tasks);
    renderAll();

    if (forcePush || changedRemotely) {
      await syncRequest("sync_push", { notes, tasks });
    }
    if (status) status.textContent = "Sincronizado · " + new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    if (!silent) say("Memoria y tareas sincronizadas con tus otros dispositivos.");
    return true;
  } catch (error) {
    if (status) status.textContent = "No se ha podido sincronizar: " + error.message;
    if (!silent) say("Error de sincronización: " + error.message);
    return false;
  } finally {
    syncInProgress = false;
    if (button) button.disabled = false;
  }
}


async function askJarvis(text) {
  const saved = read(KEYS.chat).slice(-8);
  const history = saved.map((message, index) => ({
    role: message.who === "assistant" ? "model" : "user",
    text: String(message.text || "").slice(index === saved.length - 1 && message.who !== "assistant" ? 0 : -1800)
  }));

  if (
    !history.length ||
    history[history.length - 1].role !== "user" ||
    history[history.length - 1].text !== text
  ) {
    history.push({ role: "user", text });
  }

  const memory = [];
  if (settings.shareMemoryWithAI) {
    const notes = read(KEYS.notes)
      .filter(note => !note.deletedAt)
      .slice(0, 10)
      .map(note => "Nota guardada: " + String(note.text || "").slice(0, 220));
    const tasks = read(KEYS.tasks)
      .filter(task => !task.deletedAt)
      .slice(0, 10)
      .map(task => (task.done ? "Tarea completada: " : "Tarea pendiente: ") +
        String(task.text || "").slice(0, 160) +
        (task.due ? " · Fecha: " + formatDue(task.due) : ""));
    memory.push(...notes, ...tasks);
    memory.push("Fecha y hora local del usuario: " + new Date().toLocaleString("es-ES"));
  }

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, memory })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No se pudo obtener respuesta.");
    if (typeof data.reply !== "string" || !data.reply.trim()) {
      throw new Error("La IA no ha devuelto una respuesta.");
    }
    return data.reply.trim();
  } catch (error) {
    return error.message ||
      "No he podido conectar con mi inteligencia artificial. Comprueba la conexión e inténtalo de nuevo.";
  }
}

function describePendingTasks() {
  const pending = read(KEYS.tasks).filter(task => !task.done && !task.deletedAt);
  if (!pending.length) return "No tienes tareas pendientes.";
  return "Tienes " + pending.length + " tareas pendientes: " +
    pending.map(task => task.text + (task.due ? " (" + dueDescription(task.due) + ")" : "")).join("; ");
}

function describeMemory() {
  const notes = read(KEYS.notes).filter(note => !note.deletedAt);
  if (!notes.length) return "Todavía no tienes notas guardadas.";
  return "Tienes " + notes.length + " notas guardadas. " +
    notes.slice(0, 5).map((note, index) => (index + 1) + ". " + note.text).join(" ");
}

let commandQueue = Promise.resolve();

function processCommand(raw) {
  const text = String(raw || "").trim();
  if (!text) return commandQueue;
  commandQueue = commandQueue.then(() => processCommandInternal(text)).catch(error => {
    $("systemState").textContent = "ERROR";
    const message = "Ha ocurrido un error al procesar la orden: " + (error?.message || "error desconocido") + ".";
    say(message);
    speak(message);
  });
  return commandQueue;
}

async function processCommandInternal(raw) {
  const text = String(raw || "").trim();
  if (!text) return;
  say(text, "user");
  $("systemState").textContent = "PROCESANDO";

  const commandText = text.replace(/^[\s.,;:¡¿]*(?:(?:oye|hey|hola)\s+)?jarvis[\s,.:;¡¿-]*/i, "").trim() || text;
  const low = commandText.toLocaleLowerCase("es");
  let reply = "";
  let useAI = false;
  let match;

  match = commandText.match(/^(?:(?:por favor)\s*)?(?:agéndame|agendame|agenda|programa|añade|anade|agrega|crea|pon|ponme|mete|meteme|anota)\s+(?:(?:una?|el|la)\s+)?(?:(?:cita|reunión|reunion|evento)\s+)?(?:(?:en|al)\s+(?:mi\s+)?calendario\s+)?(.+)/i);
  if (match) {
    const calendarDetails = match[1].replace(/\b(?:en|al)\s+(?:mi\s+)?calendario\b/ig, " ").trim();
    const schedule = extractSchedule(calendarDetails, false);
    const hasClearTime = schedule.hasTime;
    if (!schedule.hasDate || !hasClearTime || schedule.timeAmbiguous) {
      reply = "Puedo preparar el evento en el calendario de tu Samsung. Dime el día y la hora exactos. Si dices «a las seis», aclara si es de la mañana o de la tarde; por ejemplo: «agenda una cita mañana a las seis de la tarde».";
    } else {
      const title = (schedule.text || "Cita").replace(/^(?:una\s+)?(?:cita|reunión|reunion|evento)\s*/i, "").trim() || "Cita";
      if (buildCalendarIntent(title, schedule.due)) {
        reply = "He preparado «" + title + "» para " + dueDescription(schedule.due) + ". Android abrirá la aplicación de calendario disponible. Revisa los datos y pulsa Guardar; el evento no se añade hasta que lo confirmes allí.";
      } else {
        reply = "No he podido preparar el evento. Comprueba la fecha y la hora.";
      }
    }
  } else if ((match = commandText.match(/^(?:recuérdame|recuerdame|avísame|avisame)\s+(.+)/i))) {
    const schedule = extractSchedule(match[1], true);
    const taskText = schedule.text || "Recordatorio";
    if (!schedule.due) {
      addTask(taskText);
      reply = "He guardado «" + taskText + "» como tarea. Para programar el aviso, dime el día y la hora, por ejemplo: «recuérdame estudiar mañana a las 18:00».";
    } else {
      addTask(taskText, "Normal", schedule.due);
      reply = "He programado el recordatorio de «" + taskText + "» para " +
        dueDescription(schedule.due) + ". Para recibir el aviso, activa las notificaciones y mantén JARVIS abierto.";
    }
  } else if ((match = commandText.match(/^(?:añade|agrega|crea|apunta)\s+(?:una\s+)?tarea\s+(?:de\s+)?(.+)/i))) {
    const schedule = extractSchedule(match[1], false);
    const taskText = schedule.text || "Nueva tarea";
    addTask(taskText, "Normal", schedule.due);
    reply = "He añadido la tarea: " + taskText +
      (schedule.due ? " · Fecha: " + dueDescription(schedule.due) : "") + ".";
  } else if ((match = commandText.match(/^(?:guarda|anota|recuerda)\s+(?:que\s+)?(.+)/i))) {
    addNote(match[1]);
    reply = "He guardado en memoria: " + match[1] + ".";
  } else if (/^(?:busca|investiga|buscar)\s+(.+)/i.test(commandText)) {
    const query = commandText.replace(/^(?:busca|investiga|buscar)\s+/i, "");
    window.open("https://www.google.com/search?q=" + encodeURIComponent(query), "_blank", "noopener,noreferrer");
    reply = "He abierto una búsqueda sobre: " + query + ".";
  } else if (/^(?:abre|inicia)\s+(calendar|calendario|drive|gmail|correo)/i.test(commandText)) {
    const app = commandText.match(/(calendar|calendario|drive|gmail|correo)/i)[0].toLowerCase();
    const urls = {
      calendar: "https://calendar.google.com/",
      calendario: "https://calendar.google.com/",
      drive: "https://drive.google.com/",
      gmail: "https://mail.google.com/",
      correo: "https://mail.google.com/"
    };
    window.open(urls[app], "_blank", "noopener,noreferrer");
    reply = "Abriendo " + app + ".";
  } else if (/qué tareas|mis tareas|pendientes/.test(low)) {
    reply = describePendingTasks();
  } else if (/qué recuerdas|mis notas|qué sabes de mí|memoria/.test(low)) {
    reply = describeMemory();
  } else if (/qué hora|dime la hora/.test(low)) {
    reply = "Son las " + new Date().toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit"
    }) + ".";
  } else if (/qué fecha|qué día es|fecha de hoy/.test(low)) {
    reply = "Hoy es " + new Date().toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }) + ".";
  } else if (/ayuda|qué puedes hacer|comandos/.test(low)) {
    reply = "Puedo conversar contigo, guardar notas, gestionar tareas y recordatorios, consultar pendientes y preparar eventos para tu calendario Android. En el móvil, revisa el evento y pulsa Guardar para confirmarlo. También puedo responder por voz si está activado.";
  } else {
    useAI = true;
  }

  if (useAI) {
    $("systemState").textContent = "CONSULTANDO IA";
    reply = await askJarvis(text);
  }
  $("systemState").textContent = "RESPUESTA LISTA";
  say(reply);
  speak(reply);
  window.setTimeout(() => {
    if ($("systemState").textContent === "RESPUESTA LISTA") $("systemState").textContent = "ASISTENTE CONECTADO";
  }, 1800);
}

$("memoryForm").addEventListener("submit", event => {
  event.preventDefault();
  const text = $("memoryInput").value.trim();
  if (!text) return;
  addNote(text);
  $("memoryInput").value = "";
  say("He guardado esa nota en la memoria de este dispositivo.");
});

$("taskForm").addEventListener("submit", event => {
  event.preventDefault();
  const text = $("taskInput").value.trim();
  if (!text) return;
  addTask(text, $("taskPriority").value, $("taskDate").value || "");
  $("taskInput").value = "";
  $("taskDate").value = "";
  const notificationsAvailable = "Notification" in window && Notification.permission === "granted";
  say("Tarea añadida. " + (notificationsAvailable
    ? "Comprobaré el recordatorio mientras JARVIS esté abierto."
    : "Activa las notificaciones en Herramientas para recibir avisos."));
});

function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("exportMemory").addEventListener("click", () => {
  download("jarvis-memoria.json", read(KEYS.notes));
});
$("exportAll").addEventListener("click", () => {
  download("jarvis-copia-seguridad.json", {
    version: 4,
    notes: read(KEYS.notes),
    tasks: read(KEYS.tasks),
    chat: read(KEYS.chat),
    exportedAt: new Date().toISOString()
  });
});

$("importFile").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.notes) || !Array.isArray(data.tasks)) {
      throw new Error("Formato no válido");
    }
    if (!confirm("La importación sustituirá las notas y tareas actuales de este navegador. ¿Continuar?")) return;
    write(KEYS.notes, data.notes);
    write(KEYS.tasks, data.tasks);
    if (Array.isArray(data.chat)) write(KEYS.chat, data.chat);
    $("chatLog").replaceChildren();
    restoreChat();
    renderAll();
    say("Copia de seguridad importada correctamente.");
  } catch {
    alert("No se pudo importar el archivo. Comprueba que sea una copia de JARVIS válida.");
  } finally {
    event.target.value = "";
  }
});

$("searchForm").addEventListener("submit", event => {
  event.preventDefault();
  const query = $("searchInput").value.trim();
  if (query) {
    window.open("https://www.google.com/search?q=" + encodeURIComponent(query), "_blank", "noopener,noreferrer");
  }
});

async function showReminder(task) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const title = "JARVIS · Recordatorio";
  const options = { body: task.text, tag: "jarvis-task-" + task.created };
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch {
    try {
      new Notification(title, options);
    } catch {}
  }
}

function checkReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const tasks = read(KEYS.tasks);
  let changed = false;
  const dueTasks = [];
  const now = Date.now();

  tasks.forEach(task => {
    if (task.done || task.notified || !task.due || !task.due.includes("T")) return;
    const timestamp = new Date(task.due).getTime();
    if (!Number.isNaN(timestamp) && timestamp <= now) {
      task.notified = true;
      changed = true;
      if (timestamp >= now - 24 * 60 * 60 * 1000) dueTasks.push(task);
    }
  });

  if (changed) write(KEYS.tasks, tasks);
  dueTasks.forEach(task => showReminder(task));
}

$("searchInput").setAttribute("aria-label", "Buscar en internet");
$("chatForm").addEventListener("submit", event => {
  event.preventDefault();
  const value = $("chatInput").value;
  $("chatInput").value = "";
  processCommand(value);
});
$("focusInputBtn").addEventListener("click", () => $("chatInput").focus());

$("voiceBtn").addEventListener("click", () => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    say("El reconocimiento de voz no está disponible en este navegador. Puedes escribir en el chat.");
    return;
  }

  const recognition = new Recognition();
  recognition.lang = "es-ES";
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  let finalTranscript = "";
  let submitted = false;

  recognition.onstart = () => {
    $("systemState").textContent = "ESCUCHANDO";
    $("voiceBtn").textContent = "🎙 Escuchando…";
    $("voiceBtn").disabled = true;
  };

  recognition.onresult = event => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const part = event.results[i][0].transcript || "";
      if (event.results[i].isFinal) finalTranscript += part + " ";
      else interim += part;
    }
    const heard = (finalTranscript + " " + interim).trim();
    if (heard) {
      $("systemState").textContent = (finalTranscript.trim() ? "TE ESCUCHO: " + heard : "TE ESCUCHO: " + interim.trim()).slice(0, 58);
    }
  };

  recognition.onerror = event => {
    if (event.error !== "no-speech" && event.error !== "aborted") {
      say("No he podido reconocer la voz. Comprueba los permisos del micrófono e inténtalo otra vez.");
    } else if (event.error === "no-speech") {
      say("No he detectado voz. Pulsa el micrófono y vuelve a hablar.");
    }
  };

  recognition.onend = () => {
    $("voiceBtn").disabled = false;
    $("voiceBtn").textContent = "🎙 Hablar con JARVIS";
    const completeTranscript = finalTranscript.trim();
    if (completeTranscript && !submitted) {
      submitted = true;
      $("systemState").textContent = "TRANSCRIPCIÓN LISTA";
      processCommand(completeTranscript);
    } else if ($("systemState").textContent === "ESCUCHANDO" ||
               $("systemState").textContent.startsWith("TE ESCUCHO:")) {
      $("systemState").textContent = "ASISTENTE CONECTADO";
    }
  };

  try {
    recognition.start();
  } catch {
    $("voiceBtn").disabled = false;
    $("voiceBtn").textContent = "🎙 Hablar con JARVIS";
    $("systemState").textContent = "ASISTENTE CONECTADO";
    say("El micrófono ya está activo o el navegador no permite iniciarlo.");
  }
});

$("voiceReplies").checked = settings.voiceReplies;
$("saveChat").checked = settings.saveChat;
$("shareMemoryWithAI").checked = settings.shareMemoryWithAI;
$("syncTokenInput").value = settings.syncToken || "";
$("voiceRate").value = String(settings.voiceRate || 1);
$("voicePitch").value = String(settings.voicePitch || 1);
$("voiceRateValue").textContent = Number($("voiceRate").value).toFixed(2) + "×";
$("voicePitchValue").textContent = Number($("voicePitch").value).toFixed(2);
refreshVoiceList();
if ("speechSynthesis" in window) {
  window.speechSynthesis.addEventListener("voiceschanged", refreshVoiceList);
}
$("voiceSelect").addEventListener("change", event => {
  const value = event.target.value;
  if (!value) {
    settings.voiceName = "";
    settings.voiceLang = "";
  } else {
    const parts = value.split("|");
    settings.voiceName = parts[0] || "";
    settings.voiceLang = parts[1] || "";
  }
  saveSettings();
});
function saveVoiceTuning() {
  settings.voiceRate = Number($("voiceRate").value);
  settings.voicePitch = Number($("voicePitch").value);
  $("voiceRateValue").textContent = settings.voiceRate.toFixed(2) + "×";
  $("voicePitchValue").textContent = settings.voicePitch.toFixed(2);
  saveSettings();
}
$("voiceRate").addEventListener("input", saveVoiceTuning);
$("voicePitch").addEventListener("input", saveVoiceTuning);
$("testVoice").addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    say("Este navegador no permite cambiar la voz.");
    return;
  }
  speak("Hola. Soy JARVIS. Esta es una prueba de la voz que has seleccionado.", true);
});
$("generateSyncToken").addEventListener("click", () => {
  if (!window.crypto || typeof window.crypto.getRandomValues !== "function") {
    say("Este navegador no permite generar una clave segura.");
    return;
  }
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const token = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  $("syncTokenInput").value = token;
  $("syncStatus").textContent = "Clave generada. Cópiala a Cloudflare como secreto JARVIS_SYNC_TOKEN y después guárdala aquí.";
});
$("copySyncToken").addEventListener("click", async () => {
  const token = $("syncTokenInput").value.trim();
  if (!token) {
    say("Primero genera una clave de sincronización.");
    return;
  }
  try {
    await navigator.clipboard.writeText(token);
    say("Clave copiada. Pégala en Cloudflare como secreto JARVIS_SYNC_TOKEN. No la compartas por el chat.");
  } catch {
    say("No he podido copiarla automáticamente. Selecciona el contenido del campo y cópialo manualmente.");
  }
});
$("saveSyncToken").addEventListener("click", async () => {
  const token = $("syncTokenInput").value.trim();
  if (token.length < 32) {
    say("La clave de sincronización debe tener al menos 32 caracteres. Utiliza una clave aleatoria y no la compartas en el chat.");
    return;
  }
  settings.syncToken = token;
  saveSettings();
  await syncNow(false);
});
$("syncNow").addEventListener("click", () => syncNow(false));

$("voiceReplies").addEventListener("change", event => {
  settings.voiceReplies = event.target.checked;
  saveSettings();
  if (!settings.voiceReplies && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
});
$("saveChat").addEventListener("change", event => {
  settings.saveChat = event.target.checked;
  if (!settings.saveChat) {
    localStorage.removeItem(KEYS.chat);
    $("chatLog").replaceChildren();
    say("La conversación ya no se guardará en este dispositivo.", "assistant", false);
  }
  saveSettings();
});
$("shareMemoryWithAI").addEventListener("change", event => {
  settings.shareMemoryWithAI = event.target.checked;
  saveSettings();
  say(settings.shareMemoryWithAI
    ? "De acuerdo. Enviaré tus notas guardadas a la IA como contexto para ayudarte a recordar. No incluyas contraseñas ni datos sensibles."
    : "He desactivado el uso de tus notas como contexto de la IA. Seguirán guardadas en este dispositivo.");
});

$("clearChat").addEventListener("click", () => {
  if (!confirm("¿Borrar el historial de conversación de este dispositivo?")) return;
  localStorage.removeItem(KEYS.chat);
  $("chatLog").replaceChildren();
  say("Conversación borrada.", "assistant", false);
});

$("enableNotifications").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    say("Este navegador no admite notificaciones.");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    say("Notificaciones activadas. Los avisos de tareas se mostrarán mientras JARVIS esté abierto.");
    checkReminders();
  } else {
    say("No se han concedido permisos de notificación.");
  }
});

function updateClock() {
  $("clock").textContent = new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
updateClock();
setInterval(updateClock, 30000);

restoreChat();
renderAll();
$("systemState").textContent = "ASISTENTE CONECTADO";

let installPrompt = null;
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  $("installBtn").hidden = false;
});
$("installBtn").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $("installBtn").hidden = true;
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

checkReminders();
setInterval(checkReminders, 15000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkReminders();
});
window.addEventListener("focus", () => {
  checkReminders();
  if (settings.syncToken) syncNow(true, false);
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && settings.syncToken) syncNow(true, false);
});
window.setInterval(() => {
  if (!document.hidden && settings.syncToken) syncNow(true, false);
}, 60000);
if (settings.syncToken) {
  window.setTimeout(() => syncNow(true), 1200);
}
