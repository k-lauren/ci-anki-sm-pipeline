const FIELDS = [
  "deepseekApiKey",
  "deepseekModel",
  "ankiConnectUrl",
  "ankiDeckName",
  "ankiNoteType",
  "sourceLanguage"
];

const DEFAULTS = {
  deepseekApiKey: "",
  deepseekModel: "deepseek-v4-flash",
  ankiConnectUrl: "http://127.0.0.1:8765",
  ankiDeckName: "YouTube Mining",
  ankiNoteType: "YT Immersion Mining",
  sourceLanguage: "ja"
};

const $ = (id) => document.getElementById(id);

async function load() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  const settings = { ...DEFAULTS, ...stored };
  for (const f of FIELDS) $(f).value = settings[f] ?? "";
}

async function save() {
  const out = {};
  for (const f of FIELDS) out[f] = $(f).value.trim();
  await chrome.storage.local.set(out);
  setStatus("Saved.", "ok");
}

function setStatus(text, cls = "") {
  const el = $("status");
  el.textContent = text;
  el.className = "status " + cls;
}

async function testAnki() {
  setStatus("Testing AnkiConnect…");
  await save();
  chrome.runtime.sendMessage({ type: "ankiHealth" }, (r) => {
    if (r && r.ok) setStatus(`Connected. AnkiConnect v${r.version}, deck: ${r.deck}`, "ok");
    else setStatus(`Failed: ${r?.error || "no response"}`, "err");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  $("save").addEventListener("click", save);
  $("testAnki").addEventListener("click", testAnki);
});
