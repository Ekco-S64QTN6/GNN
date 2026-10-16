# Galactic News Network (GNN) — Master Comprehensive Project Review & Canonical Status Report

**Author**: Gemini / Antigravity Assistant  
**Date**: October 14, 2026  
**Document Path**: [`docs/Gemini_report.md`](file:///home/ekco/github/GNN/docs/Gemini_report.md)  
**Status**: Canonical Master Report & Single Source of Truth  
**Supersedes & Archives**: [`docs/DeepSeek_work_report.md`](file:///home/ekco/github/GNN/docs/archive/DeepSeek_work_report.md), [`docs/Deepseek_scratchpad.md`](file:///home/ekco/github/GNN/docs/archive/Deepseek_scratchpad.md), and [`docs/Gemini_scratchpad.md`](file:///home/ekco/github/GNN/docs/archive/Gemini_scratchpad.md).

---

## 1. Executive Summary & Station Overview

The Galactic News Network (GNN) is an autonomous, procedural, broadcast news simulation set in the *Master of Orion* universe. It combines real-world RSS wire feeds, local neural text-to-speech (Kokoro-82M / Edge-TTS fallback), retro Web Audio soundscapes, 1080p AI-conditioned graphics, real-time procedural cutaways, and a 1993 MOO1 aesthetic.

This document synthesizes and consolidates all prior technical audits, handoffs, and recent investigations into a single authoritative record. It details:
- Critical visual & audio bug investigations (Grolm's black backdrop, "convoy" TTS pronunciation, and correspondent uniform badge jitter).
- Resolution of the dual-file transcript & diagnostic logging subsystem with auto-rotation capping.
- The 10-set studio rotation and desk line calibration system.
- Market data crawling via `curl_cffi` TLS impersonation.
- Audio graph stability, boot races, and browser caching gotchas.
- Complete inventory and permanent preservation of 26 development test tools into [`tools/tests/`](file:///home/ekco/github/GNN/tools/tests).

---

## 2. Deep-Dive Bug Investigations & Solutions

### 2.1 Black Background Behind Grolm (Two-Way Remote Correspondent)

#### The Symptom
In [`Screenshot_20261014_065234.png`](file:///home/ekco/github/GNN/Screenshot_20261014_065234.png), Bulrathi Defence Desk correspondent **Grolm** appears in the PIP monitor frame (`· LIVE GROLM`) over a solid pitch-black background (`#000000`) instead of an outpost, orbital dock, or planetary cutaway image.

#### Root Cause Analysis
1. **Route Resolution**: In [`js/broadcast-director.js:beginTwoWay()`](file:///home/ekco/github/GNN/js/broadcast-director.js#L1133-L1136), `kind` is resolved via `GNNCutsceneManager.routeFor(current)`. Stories with dialogue verbs ("said", "told", "interview", "statement") resolve to `'interview'`. Unmatched stories resolve to `null`.
2. **Missing Key in `GENERATED` Registry**: In [`js/cutscene-manager.js:GENERATED`](file:///home/ekco/github/GNN/js/cutscene-manager.js#L115-L134), `'interview'` is **absent** from the route dictionary (`convoy`, `tactical`, `council`, `hack`, `anomaly`, `survey`, `outbreak`, `industry`, `deepfield`).
3. **No Fallback Backdrop**: In [`correspondentScene(sid, kind)`](file:///home/ekco/github/GNN/js/cutscene-manager.js#L275-L280), `const back = (kind && await generatedScene(kind));` evaluates to `null`. The background layer push is bypassed, leaving the scene with **only the correspondent sprite layer**.
4. **Alpha Transparency Reveals Cleared Canvas**: In [`drawCutaway()`](file:///home/ekco/github/GNN/js/cutscene-manager.js#L862-L865), PIP mode clears the destination rect with `ctx.fillStyle = '#000'; ctx.fillRect(...)`. Because the correspondent plate ([`bulrathi_hero.png`](file:///home/ekco/github/GNN/assets/generated/correspondents/bulrathi_hero.png)) is an RGBA sprite with full alpha transparency outside the silhouette, the black canvas shines through.
5. **Reproduction in Test Tools**: Passing `null` as the second argument in `GNNCutsceneManager.openTwoWay('bulrathi', null, ...)` reproduces the bug 100% of the time (as confirmed in `tools/tests/tw.py`).

#### Solution Plan
1. Add `'interview'` to `GENERATED` in [`js/cutscene-manager.js`](file:///home/ekco/github/GNN/js/cutscene-manager.js):
   ```javascript
   interview: ['council_summit', 'station_trade_02', 'council_vote'],
   ```
2. Add a fallback backdrop generator in `correspondentScene(sid, kind)`: If `kind` is null or `generatedScene(kind)` returns null, select an ambient outpost/station plate (`'station_trade'`, `'council_summit'`) so no correspondent is ever rendered over a black void.

---

### 2.2 TTS Mispronunciation of "Convoy" & Phonetic Pipeline

#### The File & The Pipeline
The phonetic correction engine is located in [`js/tts.js`](file:///home/ekco/github/GNN/js/tts.js#L207-L225):
```javascript
const PRONOUNCE = [
    [/\bHouthis\b/gi, 'Hoothees'],
    [/\bHouthi\b/gi, 'Hoothee'],
];

function respell(text) {
    let out = text;
    for (const [re, to] of PRONOUNCE) out = out.replace(re, to);
    return out;
}
```

#### Script Trigger
In [`js/script-writer.js:1027`](file:///home/ekco/github/GNN/js/script-writer.js#L1027), sponsor commercial break hook:
```javascript
'The Council will not save your convoy.',
```

#### Phonetic Analysis
Neural TTS engines (Kokoro-82M / Edge-TTS) frequently treat "convoy" as a verb with second-syllable stress (/kənˈvɔɪ/ like *convey* or french *convoi*) rather than noun stress on the first syllable (/ˈkɒnvɔɪ/). Respelling as `KAHN-voy` or `con-voy` forces proper trochaic lexical stress.

#### Comprehensive Vocabulary Dictionary for `PRONOUNCE`
| Word | Common Mispronunciation | Target Phonetics | Proposed `PRONOUNCE` Mapping |
|---|---|---|---|
| **convoy / convoys** | *con-VOY* / *convey* | *KAHN-voy* /ˈkɒnvɔɪ/ | `[/\bconvoys\b/gi, 'KAHN-voys'], [/\bconvoy\b/gi, 'KAHN-voy']` |
| **Bulrathi** | *Bul-RATH-eye* | *Bull-RAH-thee* | `[/\bBulrathi\b/gi, 'Bull-rah-thee']` |
| **Mrrshan** | Stammers *M-r-r-shan* | *MEER-shahn* | `[/\bMrrshan\b/gi, 'Mur-shahn']` |
| **Alkari** | *Al-CARE-eye* | *Al-KAH-ree* | `[/\bAlkari\b/gi, 'Al-kah-ree']` |
| **Klackon** | *Klay-con* | *KLAK-on* | `[/\bKlackon\b/gi, 'Klak-on']` |
| **Psilon** | *Pee-silon* | *SY-lon* /ˈsaɪlɒn/ | `[/\bPsilon\b/gi, 'Sy-lon']` |
| **Sakkra** | *Sah-KRAY* | *SAH-kruh* | `[/\bSakkra\b/gi, 'Sah-kruh']` |
| **Darlok** | *Dar-LOWK* | *DAR-lok* | `[/\bDarlok\b/gi, 'Dar-lok']` |
| **Meklar** | *MECK-ler* | *MEK-lar* | `[/\bMeklar\b/gi, 'Mek-lar']` |
| **Silicoid** | *Silly-co-id* | *SILL-ih-koyd* | `[/\bSilicoid\b/gi, 'Sill-ih-koyd']` |
| **Chyron** | *Chee-ron* | *KY-ron* /ˈkaɪrɒn/ | `[/\bChyron\b/gi, 'Ky-ron']` |
| **zortrium** | *Zor-trim* | *ZOR-tree-um* | `[/\bzortrium\b/gi, 'Zor-tree-um']` |
| **Antares** | *An-TAIRS* | *An-TAH-reez* | `[/\bAntares\b/gi, 'An-tah-reez']` |
| **Betelgeuse** | *Be-tel-ge-use* | *Beetle-juice* | `[/\bBetelgeuse\b/gi, 'Beetle-juice']` |
| **Aldebaran** | *Al-de-BAR-an* | *Al-DEB-uh-ran* | `[/\bAldebaran\b/gi, 'Al-deb-uh-ran']` |
| **GNN** | *guhn* or *jin* | *G N N* | `[/\bGNN\b/g, 'G N N']` |
| **coup** | *coop* | *coo* /kuː/ | `[/\bcoup\b/gi, 'coo']` |
| **corvette** | *cor-VEET* | *cor-VET* | `[/\bcorvette\b/gi, 'cor-vet']` |
| **Hezbollah** | Inconsistent stress | *Hezb-ullah* | `[/\bHezbollah\b/gi, 'Hezb-ullah']` |
| **Kyiv** | *KEE-ev* | *Keev* /kiːv/ | `[/\bKyiv\b/gi, 'Keev']` |
| **Netanyahu** | Choppy cadence | *Netan-yah-hoo* | `[/\bNetanyahu\b/gi, 'Netan-yah-hoo']` |

---

### 2.3 Mismatching Badges & Jitter on Field Correspondents

#### Problem Analysis
When field correspondents speak in the PIP monitor, [`cutscene-manager.js:tickCorrespondentMouth()`](file:///home/ekco/github/GNN/js/cutscene-manager.js#L216-L239) alternates between `_hero.png` and `_speaking.png` at ~5 Hz. Viewers notice the GNN uniform chest badge mutating, collar seams shifting, and sprite widths twitching (e.g. Meklar: 148px vs 147px; Sakkra: 143px vs 142px; chest pixel delta up to 250).

#### Why `condition_plates.py` Failed to Fix Badges
In [`tools/condition_plates.py`](file:///home/ekco/github/GNN/tools/condition_plates.py):
- **Anchors** ([lines 1212–1300](file:///home/ekco/github/GNN/tools/condition_plates.py#L1212-L1300)): Use `mouth_region()`, `head_region()`, and `swap_region()` to cut only the mouth/head from the variant and graft it onto the `desk_hero` body. The uniform and GNN badge are **100% byte-identical**.
- **Field Correspondents** ([lines 1546–1569](file:///home/ekco/github/GNN/tools/condition_plates.py#L1546-L1569)): The script simply loops over `_inbox/field/`, independently runs `crop_to_content()` on each image, resizes, quantises, and saves. **No body grafting or mouth segmentation occurs.** Because AI diffusion generates independent badges and slight bounding box shifts, the plates jump and twitch.

#### Solution Plan
1. In `tools/condition_plates.py`, group field plates by species.
2. Determine a common bounding box so `_hero` and `_speaking` share exact dimensions.
3. Apply `neck_row(hero_im)` to graft: keep everything below the neck from `_hero.png` verbatim (locking the badge and uniform), and splice only the mouth/face region from `_speaking.png`.
4. Recondition [`assets/generated/correspondents/`](file:///home/ekco/github/GNN/assets/generated/correspondents).

---

## 3. Subsystem Architecture & Historical Issues Synthesis

### 3.1 Dual-File Transcript & Subsystem Logging Subsystem
Recently implemented and verified via live CDP runs:
1. **Dedicated Broadcast Transcript ([`gnn-transcript.log`](file:///home/ekco/github/GNN/gnn-transcript.log))**:
   - Millisecond-precision wall-clock timestamps (`[HH:MM:SS.mmm]`).
   - Dialogue attribution: speaker ID, seat role, addressed partner, verbatim line, active TTS voice.
   - Voice mismatch detection: alerts if an anchor is voiced by the wrong model.
   - Wire story correlation: links spoken copy to source RSS URL and category.
2. **Technical Subsystem Sink ([`gnn-server.log`](file:///home/ekco/github/GNN/gnn-server.log))**:
   - Universal browser logging via [`js/logger.js`](file:///home/ekco/github/GNN/js/logger.js) capturing `console.*` and runtime exceptions with stack traces.
   - Cutscene & commercial composition telemetry: logs recipe names, shot rundowns, backdrop plates, sprites, and sponsor brands.
   - Audio element lifecycle: tracks synthesis duration (ms), byte lengths, play promise resolutions, and `onended` events.
   - Feed manager ingestion cycles: logs item fetch counts, duplicate drops, and pool depth.
3. **Log Rotation Capping**:
   - Automated thread-safe log rotation in [`server.py`](file:///home/ekco/github/GNN/server.py) capped at 250MB (configurable up to 1GB via `GNN_MAX_LOG_MB`) with rolling `.1`, `.2`, `.3` archives.

---

### 3.2 Booth Ident Play() Interruption & Audio Graph Race
- **The Issue**: On cold boots, Chromium rejected the booth ident's `play()` promise with:
  `"The play() request was interrupted because the media was removed from the document."`
  This occurred because `cutElement()` invoked `audioEl.load()`, resetting Chromium's resource-selection state machine.
- **The Fix in [`js/tts.js`](file:///home/ekco/github/GNN/js/tts.js#L14-L18)**:
  On promise rejection, the handler waits 400ms. If `audioEl.currentTime > 0 && !audioEl.paused`, it treats the rejection as an internal Chromium false alarm and allows `onended` to resolve normally.
- **First-Minute Boot Race**: A proposed visual boot splash screen holding until asset manifests, audio context, and wire feeds resolve will eliminate early anchor collision races.

---

### 3.3 Real Market Data Crawl via `curl_cffi`
- **Yahoo Finance CORS & TLS Fingerprint**: Yahoo blocks browser fetch via CORS and rejects standard Python `urllib` requests with HTTP 429 due to TLS fingerprint gating.
- **Solution in [`server.py`](file:///home/ekco/github/GNN/server.py)**: `/api/market` endpoint proxies Yahoo Finance using `curl_cffi` (impersonating Chrome's TLS handshake).
- **Per-Segment Colored Crawl**: [`js/ticker-manager.js`](file:///home/ekco/github/GNN/js/ticker-manager.js) measures and renders colored segments (green for gains, red for losses, amber for status).
- **Cache Gotcha**: Stale browser data in `~/.cache/gnn-window` previously caused older MOO ticker strings to linger; wiping this cache resolves stale module loads.

---

### 3.4 Ten Studio Sets & Desk Line Calibration
Each of the ten rotating studio sets puts its anchor desk at a unique vertical height:
```
studio_wide_empty:      0.4680    celebrity_wide_empty:   0.5150
market_wide_empty:      0.4680    sports_wide_empty:      0.5110
geopolitics_wide_empty: 0.4910    diplomatic_wide_empty:  0.5499
tech_wide_empty:        0.5100    anomaly_wide_empty:     0.5380
weather_wide_empty:     0.5270    archive_wide_empty:     0.5690
```
- Measured in [`tools/studio_review.html`](file:///home/ekco/github/GNN/tools/studio_review.html), stored in `assets/generated/set/layout.json`, and dynamically read by [`js/renderer.js:drawCast()`](file:///home/ekco/github/GNN/js/renderer.js) upon show block switches.

---

### 3.5 Open Change Requests & Technical Debt
1. **Show Rundown Open**: Cold open should summarize 3–5 queued stories before diving into the lead story ("Tonight on GNN: ..."). Requires a sentence-to-noun headline shortener.
2. **MOO1 Extractor Faults (`tools/lbx.py`)**: Delta frame stacking (frames lacking accumulator compositing) and chromatic scrambling affect animated archive cutaways.
3. **Asset Conditioner Ingestion**: `condition_plates.py` currently lacks conditioning rules for `logos/`, `titlecards/`, and `icons/`.
4. **RSS Feed Rate Limiting**: Ensure seamless, silent fallback to `/api/localnews` digests when external `rss2json` daily quotas are exhausted.

---

## 4. Preservation of Test & Diagnostic Tools ([`tools/tests/`](file:///home/ekco/github/GNN/tools/tests))

All 26 ephemeral tools from `/tmp/claude-1000/` have been permanently rescued to prevent deletion:

| Category | Scripts | Description |
|---|---|---|
| **E2E Automation** | `mouthcheck.py`, `docshots.py`, `two.py`, `tw.py`, `pipeline.py`, `breakshot.py` | Automated CDP driving, screenshot capture, and mouth movement verification. |
| **Audio & Sync** | `sync.py`, `envelope.py`, `levelprobe.py`, `ceiling.py`, `jaw4.py`, `voicelevel.py` | Signal envelope sampling, lip-sync drift calculation, and bus clipping tests. |
| **Feed Diagnostics** | `feedsurvey.py`, `feedcheck.py` | RSS endpoint validation across categories. |
| **Vision & Set Tools** | `compose.py`, `compose2.py`, `compare.py`, `prune.py`, `try_landmarks.py` | Set compositing, desk line verification, and MediaPipe landmark detection with `face_landmarker.task`. |

---

## 5. Master Roadmap & Forward Architecture

Implementation sequence:
1. **Housekeeping & Archive**: Move superseded notes into `docs/archive/`. Update `CLAUDE.md`, `README.md`, and expand `docs/ROADMAP.md` for a full 24/7 channel simulation.
2. **Cutscene PIP Fix**: Add `'interview'` route to `GENERATED` and fallback backdrop plate logic in `js/cutscene-manager.js`.
3. **Phonetics Update**: Add `convoy` and alien species dictionary to `js/tts.js`.
4. **Correspondent Badge Stabilization**: Port neck detection and body grafting to `tools/condition_plates.py`.
