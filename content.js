(() => {
  if (window.__ytImmersionLoaded) return;
  window.__ytImmersionLoaded = true;

  const CAPTION_LOG_MAX = 100;
  const MAX_HOLD_SECONDS = 30;

  const captionLog = [];
  let activeCaption = null;
  let lastCaptionText = "";

  let videoEl = null;
  let captureStream = null;
  let captionObserver = null;

  let activeHold = null;
  let holdIndicator = null;
  let openOverlay = null;

  function log(...a) { console.log("[yt-immersion]", ...a); }

  function getVideo() {
    return document.querySelector("video.html5-main-video") || document.querySelector("video");
  }

  function getCaptionContainer() {
    return document.querySelector(".ytp-caption-window-container");
  }

  function readCaptionText() {
    const container = getCaptionContainer();
    if (!container) return "";
    const segs = container.querySelectorAll(".ytp-caption-segment");
    if (!segs.length) return container.innerText.trim();
    return Array.from(segs).map(s => s.innerText).join(" ").trim();
  }

  function getVideoIdAndTitle() {
    const url = new URL(location.href);
    const videoId = url.searchParams.get("v") || "";
    const title = document.title.replace(/ - YouTube$/, "").trim();
    return { videoId, title };
  }

  async function ensureCaptureStream() {
    if (captureStream && captureStream.active) return captureStream;
    const v = getVideo();
    if (!v) throw new Error("No <video> element found.");
    if (typeof v.captureStream !== "function") throw new Error("captureStream() not available.");
    const full = v.captureStream();
    const audioTracks = full.getAudioTracks();
    if (!audioTracks.length) throw new Error("No audio track on video stream.");
    captureStream = new MediaStream(audioTracks);
    return captureStream;
  }

  function pickMimeType() {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    for (const m of candidates) if (MediaRecorder.isTypeSupported(m)) return m;
    return "";
  }

  function captionTick() {
    const text = readCaptionText();
    if (text === lastCaptionText) return;
    const v = getVideo();
    const now = v ? v.currentTime : 0;
    if (activeCaption) {
      activeCaption.endVideoTime = now;
      captionLog.push(activeCaption);
      while (captionLog.length > CAPTION_LOG_MAX) captionLog.shift();
      activeCaption = null;
    }
    if (text) {
      activeCaption = { text, startVideoTime: now, endVideoTime: null };
    }
    lastCaptionText = text;
  }

  let captionTickScheduled = false;
  function scheduleCaptionTick() {
    if (captionTickScheduled) return;
    captionTickScheduled = true;
    queueMicrotask(() => { captionTickScheduled = false; captionTick(); });
  }

  function setupCaptionObserver() {
    if (captionObserver) captionObserver.disconnect();
    const target = document.querySelector("#movie_player") || document.body;
    captionObserver = new MutationObserver(scheduleCaptionTick);
    captionObserver.observe(target, { childList: true, subtree: true, characterData: true });
  }

  function collectSubtitlesInRange(start, end) {
    const all = captionLog.slice();
    if (activeCaption) {
      all.push({
        text: activeCaption.text,
        startVideoTime: activeCaption.startVideoTime,
        endVideoTime: end
      });
    }
    const overlapping = all
      .filter(c => (c.endVideoTime ?? end) > start && c.startVideoTime < end)
      .sort((a, b) => a.startVideoTime - b.startVideoTime)
      .map(c => c.text.trim())
      .filter(Boolean);
    const out = [];
    for (const t of overlapping) if (out[out.length - 1] !== t) out.push(t);
    return out.join("\n");
  }

  async function startHold() {
    if (activeHold) return;
    try {
      const stream = await ensureCaptureStream();
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const v = getVideo();
      const startVideoTime = v ? v.currentTime : 0;
      const hold = {
        recorder: rec,
        chunks,
        mimeType: rec.mimeType || mimeType || "audio/webm",
        startVideoTime,
        endVideoTime: null,
        startedAt: performance.now(),
        timer: null,
        donePromise: null
      };
      hold.donePromise = new Promise((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: hold.mimeType }));
      });
      rec.start();
      hold.timer = setTimeout(() => stopHold(true), MAX_HOLD_SECONDS * 1000);
      activeHold = hold;
      showHoldIndicator();
    } catch (e) {
      log("startHold failed:", e.message);
      flashToast("Couldn't start recording: " + e.message);
    }
  }

  async function stopHold(autoStopped) {
    if (!activeHold) return;
    const hold = activeHold;
    activeHold = null;
    clearTimeout(hold.timer);
    hideHoldIndicator();
    const v = getVideo();
    hold.endVideoTime = v ? v.currentTime : hold.startVideoTime;
    try {
      if (hold.recorder.state !== "inactive") hold.recorder.stop();
    } catch (e) { log("recorder.stop error:", e.message); }
    const blob = await hold.donePromise;
    const heldMs = performance.now() - hold.startedAt;
    if (heldMs < 120) {
      flashToast("Hold Q a bit longer to capture audio.");
      return;
    }
    if (!blob || blob.size === 0) {
      flashToast("No audio captured.");
      return;
    }
    if (autoStopped) flashToast(`Auto-stopped at ${MAX_HOLD_SECONDS}s.`);
    const text = collectSubtitlesInRange(hold.startVideoTime, hold.endVideoTime);
    openCardEditor({
      text,
      blob,
      mimeType: hold.mimeType,
      startVideoTime: hold.startVideoTime,
      endVideoTime: hold.endVideoTime
    });
  }

  function showHoldIndicator() {
    hideHoldIndicator();
    holdIndicator = document.createElement("div");
    holdIndicator.className = "ytim-hold-indicator";
    holdIndicator.innerHTML = '<span class="ytim-hold-dot"></span><span class="ytim-hold-text">Recording — release Q to save</span><span class="ytim-hold-timer">0.0s</span>';
    document.body.appendChild(holdIndicator);
    const timerEl = holdIndicator.querySelector(".ytim-hold-timer");
    const tick = () => {
      if (!activeHold || !holdIndicator) return;
      const s = (performance.now() - activeHold.startedAt) / 1000;
      timerEl.textContent = s.toFixed(1) + "s";
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function hideHoldIndicator() {
    if (holdIndicator) { holdIndicator.remove(); holdIndicator = null; }
  }

  async function blobToBase64(blob) {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function getSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "getSettings" }, (r) => {
        resolve(r && r.ok ? r.settings : null);
      });
    });
  }

  async function translateViaBg(text, sourceLang) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "translate", text, sourceLang }, (r) => resolve(r));
    });
  }

  async function addCardViaBg(payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "addCard", payload }, (r) => resolve(r));
    });
  }

  function buildOverlay() {
    const wrap = document.createElement("div");
    wrap.className = "ytim-overlay";
    wrap.innerHTML = `
      <div class="ytim-card">
        <div class="ytim-header">
          <span class="ytim-title">New flashcard</span>
          <button class="ytim-close" aria-label="Close">×</button>
        </div>
        <label class="ytim-label">Sentence</label>
        <textarea class="ytim-sentence" rows="3"></textarea>
        <label class="ytim-label">Translation</label>
        <textarea class="ytim-translation" rows="3" placeholder="Translating…"></textarea>
        <div class="ytim-audio">
          <audio class="ytim-audio-el" controls></audio>
        </div>
        <div class="ytim-status"></div>
        <div class="ytim-buttons">
          <button class="ytim-cancel">Cancel</button>
          <button class="ytim-save">Save to Anki</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    return wrap;
  }

  async function openCardEditor(entry) {
    if (openOverlay) {
      openOverlay.remove();
      openOverlay = null;
    }
    const overlay = buildOverlay();
    openOverlay = overlay;

    const sentenceEl = overlay.querySelector(".ytim-sentence");
    const translationEl = overlay.querySelector(".ytim-translation");
    const audioEl = overlay.querySelector(".ytim-audio-el");
    const statusEl = overlay.querySelector(".ytim-status");
    const closeBtn = overlay.querySelector(".ytim-close");
    const cancelBtn = overlay.querySelector(".ytim-cancel");
    const saveBtn = overlay.querySelector(".ytim-save");

    sentenceEl.value = entry.text || "";

    const audioUrl = URL.createObjectURL(entry.blob);
    audioEl.src = audioUrl;

    const settings = await getSettings();
    const sourceLang = settings?.sourceLanguage || "ja";

    const dismiss = () => {
      URL.revokeObjectURL(audioUrl);
      overlay.remove();
      if (openOverlay === overlay) openOverlay = null;
    };
    closeBtn.addEventListener("click", dismiss);
    cancelBtn.addEventListener("click", dismiss);

    if (entry.text && entry.text.trim()) {
      translationEl.disabled = true;
      translationEl.value = "";
      translateViaBg(entry.text, sourceLang).then((r) => {
        translationEl.disabled = false;
        if (r && r.ok) {
          translationEl.value = r.translation;
        } else {
          translationEl.placeholder = "Translation failed — type one manually.";
          statusEl.textContent = `Translation error: ${r?.error || "unknown"}`;
          statusEl.className = "ytim-status err";
        }
      });
    } else {
      translationEl.placeholder = "No subtitles in this clip — sentence is blank.";
    }

    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      cancelBtn.disabled = true;
      statusEl.className = "ytim-status";
      statusEl.textContent = "Saving to Anki…";
      try {
        const { videoId, title } = getVideoIdAndTitle();
        const ext = entry.mimeType.includes("ogg") ? "ogg" : "webm";
        const base = `ytim_${videoId || "v"}_${Math.round(entry.startVideoTime)}_${Date.now()}.${ext}`;
        const audioBase64 = await blobToBase64(entry.blob);
        const sourceStr = videoId
          ? `${title} — https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(entry.startVideoTime)}s`
          : title;
        const r = await addCardViaBg({
          sentence: sentenceEl.value.trim(),
          translation: translationEl.value.trim(),
          audioBase64,
          audioFilename: base,
          source: sourceStr
        });
        if (r && r.ok) {
          statusEl.className = "ytim-status ok";
          statusEl.textContent = `Saved (note ${r.noteId}).`;
          setTimeout(dismiss, 900);
        } else {
          statusEl.className = "ytim-status err";
          statusEl.textContent = `Failed: ${r?.error || "unknown"}`;
          saveBtn.disabled = false;
          cancelBtn.disabled = false;
        }
      } catch (e) {
        statusEl.className = "ytim-status err";
        statusEl.textContent = `Failed: ${e.message}`;
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
      }
    });
  }

  function isTypingTarget(t) {
    if (!t) return false;
    const tag = (t.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || t.isContentEditable;
  }

  function flashToast(text) {
    const t = document.createElement("div");
    t.className = "ytim-toast";
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "q" && e.key !== "Q") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;
    if (openOverlay) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    startHold();
  }, true);

  document.addEventListener("keyup", (e) => {
    if (e.key !== "q" && e.key !== "Q") return;
    if (!activeHold) return;
    e.preventDefault();
    e.stopPropagation();
    stopHold(false);
  }, true);

  window.addEventListener("blur", () => { if (activeHold) stopHold(false); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && activeHold) stopHold(false);
  });

  function attach() {
    const v = getVideo();
    if (!v) return false;
    if (videoEl === v) return true;
    videoEl = v;
    captureStream = null;
    setupCaptionObserver();
    scheduleCaptionTick();
    log("attached to video element");
    return true;
  }

  const attachInterval = setInterval(() => { attach(); }, 1500);
  attach();

  document.addEventListener("yt-navigate-finish", () => {
    setTimeout(() => attach(), 500);
  });

  window.addEventListener("beforeunload", () => {
    clearInterval(attachInterval);
    if (captionObserver) captionObserver.disconnect();
  });
})();
