const $ = (id) => document.getElementById(id);

function checkAnki() {
  $("ankiStatus").textContent = "Checking AnkiConnect…";
  $("ankiStatus").className = "row";
  chrome.runtime.sendMessage({ type: "ankiHealth" }, (r) => {
    if (r && r.ok) {
      $("ankiStatus").textContent = `AnkiConnect v${r.version} ✓ deck: ${r.deck}`;
      $("ankiStatus").className = "row ok";
    } else {
      $("ankiStatus").textContent = `AnkiConnect: ${r?.error || "no response"}`;
      $("ankiStatus").className = "row err";
    }
  });
}

function checkApiKey() {
  chrome.runtime.sendMessage({ type: "getSettings" }, (r) => {
    if (r && r.ok) {
      const has = !!(r.settings.deepseekApiKey && r.settings.deepseekApiKey.length);
      $("apiStatus").textContent = has
        ? `DeepSeek key set (model: ${r.settings.deepseekModel})`
        : "DeepSeek API key not set — open Settings.";
      $("apiStatus").className = has ? "row ok" : "row err";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  checkAnki();
  checkApiKey();
  $("open").addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("recheck").addEventListener("click", checkAnki);
});
