const DEFAULTS = {
  deepseekApiKey: "",
  deepseekModel: "deepseek-v4-flash",
  ankiConnectUrl: "http://127.0.0.1:8765",
  ankiDeckName: "YouTube Mining",
  ankiNoteType: "YT Immersion Mining",
  sourceLanguage: "ja"
};

async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

async function ankiInvoke(action, params, settings) {
  const res = await fetch(settings.ankiConnectUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: 6, params })
  });
  if (!res.ok) throw new Error(`AnkiConnect HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`AnkiConnect: ${json.error}`);
  return json.result;
}

async function ensureDeckAndModel(settings) {
  const decks = await ankiInvoke("deckNames", {}, settings);
  if (!decks.includes(settings.ankiDeckName)) {
    await ankiInvoke("createDeck", { deck: settings.ankiDeckName }, settings);
  }
  const models = await ankiInvoke("modelNames", {}, settings);
  if (!models.includes(settings.ankiNoteType)) {
    await ankiInvoke("createModel", {
      modelName: settings.ankiNoteType,
      inOrderFields: ["Audio", "Sentence", "Translation", "Source"],
      css: ".card { font-family: -apple-system, sans-serif; font-size: 22px; text-align: center; } .sentence { font-size: 28px; margin: 16px 0; } .translation { color: #666; font-size: 20px; } .source { font-size: 12px; color: #999; margin-top: 24px; }",
      cardTemplates: [
        {
          Name: "Audio → Sentence",
          Front: "{{Audio}}",
          Back: '{{Audio}}<hr><div class="sentence">{{Sentence}}</div><div class="translation">{{Translation}}</div><div class="source">{{Source}}</div>'
        }
      ]
    }, settings);
  }
}

async function addCard({ sentence, translation, audioBase64, audioFilename, source }) {
  const settings = await getSettings();
  await ensureDeckAndModel(settings);
  return ankiInvoke("addNote", {
    note: {
      deckName: settings.ankiDeckName,
      modelName: settings.ankiNoteType,
      fields: { Audio: "", Sentence: sentence, Translation: translation || "", Source: source || "" },
      options: { allowDuplicate: true },
      audio: audioBase64
        ? [{ filename: audioFilename, data: audioBase64, fields: ["Audio"] }]
        : []
    }
  }, settings);
}

async function translate(text, sourceLang) {
  const settings = await getSettings();
  if (!settings.deepseekApiKey) throw new Error("DeepSeek API key not set in extension options.");
  const langName = sourceLang === "zh" ? "Mandarin Chinese" : "Japanese";
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.deepseekApiKey}`
    },
    body: JSON.stringify({
      model: settings.deepseekModel,
      messages: [
        {
          role: "system",
          content: `You translate ${langName} sentences to natural English. Output ONLY the English translation, nothing else — no quotes, no romanisation, no notes.`
        },
        { role: "user", content: text }
      ],
      temperature: 0.2
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DeepSeek HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

async function ankiHealthCheck() {
  const settings = await getSettings();
  const v = await ankiInvoke("version", {}, settings);
  return { ok: true, version: v, deck: settings.ankiDeckName };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "translate") {
        const t = await translate(msg.text, msg.sourceLang);
        sendResponse({ ok: true, translation: t });
      } else if (msg.type === "addCard") {
        const id = await addCard(msg.payload);
        sendResponse({ ok: true, noteId: id });
      } else if (msg.type === "ankiHealth") {
        const r = await ankiHealthCheck();
        sendResponse(r);
      } else if (msg.type === "getSettings") {
        sendResponse({ ok: true, settings: await getSettings() });
      } else {
        sendResponse({ ok: false, error: `Unknown message type: ${msg.type}` });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message || String(e) });
    }
  })();
  return true;
});
