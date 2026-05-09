# YT Immersion Mining

A Chrome extension that turns any subtitled YouTube line into an Anki flashcard
with one keypress. The card has the **audio of the line** on the front and the
**original sentence + an English translation** on the back — the standard
"sentence mining" setup that immersion learners use to study Japanese, Mandarin,
and other languages.

- **Hold `Q`** while watching a YouTube video with manual captions on — for as
  long as the clip you want to capture.
- Release `Q`. A small editor pops up with every subtitle line that played
  during the hold, an auto-generated English translation (via DeepSeek), and a
  preview of the audio you just recorded.
- Click **Save to Anki** and the card is added to your deck instantly.

Currently supports **Japanese** and **Mandarin** as source languages.

---

## What you'll need

You only have to do this setup once.

1. **A computer** running macOS, Windows, or Linux. Phones won't work.
2. **Google Chrome** (or any Chromium-based browser like Brave or Edge).
3. **[Anki](https://apps.ankiweb.net/)** — a free flashcard app. Install the
   desktop version. The extension talks to Anki on your computer; it does not
   need an AnkiWeb account.
4. **[AnkiConnect](https://ankiweb.net/shared/info/2055492159)** — a free
   add-on for Anki that lets other apps talk to it. Installation steps below.
5. **A DeepSeek API key** — needed for translations. Sign up at
   [platform.deepseek.com](https://platform.deepseek.com), top up a couple of
   dollars (translations are very cheap, fractions of a cent each), and copy
   your API key.

---

## Step 1 — Install Anki and AnkiConnect

1. Download Anki from [apps.ankiweb.net](https://apps.ankiweb.net/) and install
   it.
2. Open Anki. Go to **Tools → Add-ons → Get Add-ons…**
3. Paste this code: `2055492159` and click **OK**. That installs AnkiConnect.
4. Restart Anki.

You can leave Anki running in the background — the extension only works while
Anki is open on your computer.

---

## Step 2 — Download the extension

1. Click the green **Code** button at the top of this GitHub page → **Download
   ZIP**.
2. Unzip the file. You'll get a folder called `ci-anki-sm-pipeline-main` (or
   similar).
3. Move it somewhere stable — for example, your Documents folder. **Don't
   delete it later**, Chrome loads the extension directly from this folder.

(If you're comfortable with git, `git clone` the repo wherever you like.)

---

## Step 3 — Load the extension into Chrome

1. Open Chrome and go to **`chrome://extensions`** (paste that into the address
   bar).
2. In the top-right, turn on **Developer mode**.
3. Click **Load unpacked** (top-left), and pick the unzipped folder from the
   previous step.
4. The extension appears in your list. Note the **ID** under its name — it's a
   long string of letters like `abcdefghijklmnopabcdefghijklmnop`. **Copy it,
   you'll need it in the next step.**
5. Click the puzzle-piece icon in Chrome's toolbar and pin **YT Immersion
   Mining** so it's easy to find.

---

## Step 4 — Tell AnkiConnect to trust the extension

By default AnkiConnect only listens to Anki itself. We need to give it
permission to accept requests from the extension.

1. In Anki: **Tools → Add-ons**, click **AnkiConnect**, then **Config**.
2. You'll see something that looks like JSON. Find the line that says
   `"webCorsOriginList": [...]`.
3. Change it to include your extension's ID. It should look like this:

   ```json
   "webCorsOriginList": [
     "http://localhost",
     "chrome-extension://PASTE_YOUR_EXTENSION_ID_HERE"
   ]
   ```

   Replace `PASTE_YOUR_EXTENSION_ID_HERE` with the ID you copied in Step 3.
4. Click **OK** and **restart Anki** so the change takes effect.

---

## Step 5 — Add your DeepSeek API key

1. Click the **YT Immersion Mining** icon in Chrome's toolbar.
2. Click **Settings**.
3. Paste your DeepSeek API key into the **DeepSeek API key** field.
4. Pick **Japanese** or **Mandarin** as your source language.
5. (Optional) Change the **Anki deck name** if you want — by default cards go
   into a deck called *YouTube Mining* which is created automatically.
6. Click **Save**, then **Test AnkiConnect**. You should see something like
   "Connected. AnkiConnect v6, deck: YouTube Mining."

If the test fails, double-check Steps 1, 4, and that Anki is actually open.

---

## How to use it

1. Make sure **Anki is open**.
2. Open a YouTube video that has **manual captions** in your target language.
   Click the **CC** button on the video to turn them on. (Auto-generated
   captions — the ones with the little gear icon labelled "auto-translate" —
   are not supported, the quality is too low.)
3. Watch normally. When you hear a sentence (or several) you want to study,
   **press and hold `Q`** for the length of the clip you want. A small red
   "Recording" pill appears at the bottom of the screen with a timer.
4. **Release `Q`** when the clip is done. A panel appears with all the
   subtitle lines that played during the hold, the English translation, and an
   audio preview. Edit either field if you want.
5. Click **Save to Anki**. The card is in your deck immediately. Keep watching.

Tips:
- A short tap of `Q` (under ~120 ms) is ignored, so accidental taps won't
  create empty cards.
- The maximum hold is 30 seconds — recording auto-stops after that.
- If you held `Q` across multiple subtitle lines, they're joined together on
  separate lines in the Sentence field. Edit freely before saving.

The first time you save a card, the extension auto-creates the deck and a note
type called *YT Immersion Mining* with the right card layout (audio on the
front; sentence + translation + a link back to the timestamp on the back).

---

## Switching languages

If you study both Japanese and Mandarin, open the extension's Settings and
change the **Source language** dropdown. You'll probably also want a separate
deck per language — change the **Anki deck name** at the same time
(e.g. `YouTube Mining – JP` and `YouTube Mining – ZH`).

---

## Troubleshooting

**The Sentence field is blank after I release Q.**
No subtitle line was on screen during your hold. Make sure manual captions
are turned on (the **CC** button) and that you held `Q` while text was
visible. Auto-generated captions are not supported.

**Nothing happens when I tap Q.**
Very short taps (under ~120 ms) are ignored to avoid empty cards. Hold the
key down for the full length of the clip you want.

**"AnkiConnect: Failed to fetch"** in the popup.
Anki isn't running, or AnkiConnect isn't installed. Open Anki and try again.

**"AnkiConnect: 403"** or CORS errors.
The extension ID isn't in AnkiConnect's `webCorsOriginList`. Redo Step 4 and
restart Anki.

**Translation says "Translation failed".**
Either your DeepSeek API key is wrong/empty, or you're out of credit. Open
Settings → re-paste the key, or top up your DeepSeek balance.

**The audio on the card is silent.**
This can happen on certain DRM-protected videos or older browsers. Try
refreshing the page and capturing the line again. If it persists, please open
an issue on GitHub.

**I changed something in Settings and it's not taking effect.**
Refresh the YouTube tab — the extension reads its settings when the page
loads.

---

## Privacy

- Your DeepSeek API key is stored locally in your browser
  (`chrome.storage.local`). It is only ever sent to `api.deepseek.com` for
  translations.
- Sentences you mine are sent to DeepSeek for translation. If that's a concern
  for your content, leave the translation field blank in the editor and click
  Save — no DeepSeek call happens unless you let the translation populate.
- Audio and cards go directly from your browser to your local Anki — nothing
  is uploaded to anyone else's server.
- No analytics, no telemetry, no account.

---

## Roadmap (not yet built)

- Netflix support
- Screenshot of the video frame on the back of the card
- Pinyin / tone colours for Mandarin, furigana / pitch accent for Japanese
- Clipboard mining for content the extension can't parse directly
- Vocabulary tracking and comprehension estimates per video

This first release deliberately does the one core thing well. Issues and PRs
welcome.
