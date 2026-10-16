# ROADMAP — 24/7 Galactic News Network (GNN) Simulation

**Canonical Forward Architecture & Production Roadmap**  
*Last Updated: October 14, 2026*  
*Related Documents: [`CLAUDE.md`](../CLAUDE.md) (Constraints & Working Notes), [`docs/Gemini_report.md`](Gemini_report.md) (Master Technical Report)*

---

## 1. The Target: A Living 24/7 Galactic News Network

The ultimate goal of GNN is to create the complete illusion of an authentic, round-the-clock television news network broadcast across the *Master of Orion* galaxy. 

Just like tuning into CNN, BBC News, or Fox News at any hour of the day, a viewer joining GNN should immediately experience:
1. **Real-world news as the primary journalistic core** — real headlines, real financial markets, and real geopolitical developments read earnestly by alien and human anchors without parodying the facts.
2. **Inhabited sci-fi newsroom culture** — anchors with distinctive registers, rivalries, tics, and personal agendas who react to the news, pass the desk, and banter naturally.
3. **True 24/7 daypart programming** — distinct named shows that rotate according to the time of day, from high-energy morning market opens to primetime investigative panels, heated political shouting matches, late-night anomaly logs, and cheesy overnight shopping / infomercials.
4. **Rich commercial breaks & in-universe consumer capitalism** — multi-shot sponsor spots, late-night infomercials, class-action lawsuit syndications, and spoof shopping networks (QVC in space) powered by ChatGPT/DALL-E image generation and local neural speech.

---

## 2. Landed Subsystems & Verified Milestones

The following capabilities are fully built, tested, and active in the codebase:

| Subsystem | Features & Capabilities | Verified By |
|---|---|---|
| **Ten Studio Sets** | Ten unique architectural sets (`studio_`, `market_`, `geopolitics_`, `tech_`, `celebrity_`, `sports_`, `diplomatic_`, `anomaly_`, `weather_`, `archive_wide_empty`) with individually tuned desk lines in `layout.json`. | [`tools/studio_review.html`](file:///home/ekco/github/GNN/tools/studio_review.html), `renderer.js:drawCast()` |
| **Real Stock Crawl** | Real financial market crawl powered by `/api/market` using `curl_cffi` to impersonate Chrome TLS handshakes against Yahoo Finance; per-segment color-coded rendering (green gain, red loss, amber status). | `ticker-manager.js`, `server.py:handle_market` |
| **Dual-File Transcript & Subsystem Logging** | Millisecond-precision dialogue and state transcript in [`gnn-transcript.log`](file:///home/ekco/github/GNN/gnn-transcript.log); full browser console & Chromium sink in [`gnn-server.log`](file:///home/ekco/github/GNN/gnn-server.log); auto-rotation capping at 250MB (up to 1GB). | `js/logger.js`, `server.py:handle_transcript` |
| **Commercial Asset & Recipe Traces** | Live telemetry logging exact cutscene recipes (`convoy`, `industry`, `tactical`), shot rundowns, sponsor brands, product names, backdrops, and announcer voice IDs. | `cutscene-manager.js:logCommercialComposition()` |
| **Voice & Attribution Engine** | Local Kokoro-82M neural TTS (~7× realtime on CPU) with Edge-TTS cloud fallback; AnalyserNode-driven lip-sync amplitude gating; per-line speaker attribution (`activeSeatForLine`). | `js/tts.js`, `js/audio-engine.js`, `tools/tests/mouthcheck.py` |
| **Two-Way Field Interviews** | Remote correspondents reporting through the PIP monitor above the desk; brief, standard, and extended interview shapes with follow-ups and anchor introductions. | `docs/correspondent.png`, `tools/tests/tw.py` |
| **Cast & Roster Pipeline** | 12 characters across 11 species plus MOO1 keyed robot; `desk_hero` and `speaking` plates conditioned at canvas resolution; asymmetric relationship tables. | `js/cast.js`, `tools/condition_plates.py` |
| **Preserved Diagnostic Tooling Suite** | 26 standalone CDP test runners, audio monitors, feed checkers, and set visualizers rescued from `/tmp/` into a permanent home. | [`tools/tests/`](file:///home/ekco/github/GNN/tools/tests/README.md) |

---

## 3. The 24/7 Daypart Broadcast Schedule

To create the illusion of a true living network, the broadcast schedule is mapped to Galactic Standard Time (GST, synchronized to Earth local clock or viewer timezone):

```
┌────────────────────────────────────────────────────────────────────────┐
│                      24-HOUR BROADCAST DAYPART CYCLE                   │
├─────────────────┬──────────────────────────┬───────────────────────────┤
│ GST Time Slot   │ Program Name             │ Format & Cast Focus       │
├─────────────────┼──────────────────────────┼───────────────────────────┤
│ 06:00 – 09:00   │ Galactic Morning Watch   │ Fast wire, weather & crawl│
│ 09:00 – 12:00   │ Sector Midday Wire       │ Geopolitics & council desk│
│ 12:00 – 15:00   │ Deep Space Economy       │ Markets, trade & mining   │
│ 15:00 – 18:00   │ The Evening Rim Report   │ Lead primetime anchors    │
│ 18:00 – 21:00   │ Council Crossfire        │ High-conflict debate panel│
│ 21:00 – 00:00   │ Anomaly Late Night       │ Deepfield, science, tech  │
│ 00:00 – 03:00   │ GNN Galaxy Shop (QVC)    │ Tele-shopping & gadgets   │
│ 03:00 – 06:00   │ Overnight Infomercials   │ Paid programming & legal  │
└─────────────────┴──────────────────────────┴───────────────────────────┘
```

### 3.1 Morning & Midday Information Blocks (06:00 – 15:00)
- **Galactic Morning Watch**: High energy, snappy pacing. Fast-moving lower-third chyrons, stellar flare radiation warnings, orbital traffic reports, and rapid-fire RSS headline roundups. Hosted by Commander Hale and Sarek.
- **Deep Space Economy**: Specialized market set (`market_wide_empty`). Real ticker crawl with index changes, commodity updates, corporate earnings, and trade lane tariffs. Hosted by the Trade Desk (Rell / Mrrshan Matriarch).

### 3.2 Primetime & Sector Debate (15:00 – 21:00)
- **The Evening Rim Report**: GNN's flagship broadcast. Slower, authoritative pacing with extended two-way remote dispatches to field correspondents (Grolm, Sorrek, Oth).
- **Council Crossfire (The Shouting Match)**: 
  - A hilarious in-universe parody of *Crossfire* / *Hannity & Colmes* / *Sunday Morning Politics*.
  - A polarized three-way panel: an ultra-hawkish Bulrathi general (`"More dreadnoughts in the Antares corridor!"`), an aloof, condescending Psilon scholar (`"Your primitive kinetic thinking ignores quantum parity"`), and a cynical Darlok spy who claims both sides are compromised.
  - Multi-box PIP display: Anchor in the center, two debate guests in split-screen monitor windows yelling over each other with rapid-fire turns.

### 3.3 GNN Galaxy Shop (The Spoof QVC / Home Shopping Network) (00:00 – 03:00)
During the late-night hours, GNN flips from hard news to tele-shopping consumer madness:
- **Format**: Hyperactive alien hosts with fast-talking pitches, product demonstration stills, countdown timers, and faux caller testimonials.
- **Featured Products**:
  1. *Authentic Klackon Queen Amber Brooches*: "Mined directly from the hive hives of Kholdan! Only 399 Galactic Credits! Calling all Terran mineral collectors!"
  2. *Refurbished Class-3 Tachyon Deflector Coils*: "Guaranteed to deflect micro-meteorites or your money back! Fits any standard civilian star-skiff!"
  3. *Silicoid Crystalline Exfoliating Balm*: "Hardens human dermal layers to basalt grade in three applications!"
  4. *Alkari Feather-Gloss & Anti-Static Preen Serum*: "Essential grooming for the modern high-ranking diplomat."
- **Visual Presentation**:
  - Rotating 3D-styled product pedestals (conditioned ChatGPT generated plates).
  - Prominent on-screen graphics: `CALL 1-800-RIM-DEAL`, `UNITS REMAINING: 17`, `OPERATORS ARE STANDING BY IN ORBIT`.
  - Ticker crawl switches from stock quotes to viewer purchase notices: `"C. Vance from Vega Prime purchased 2 Amber Brooches"`.

### 3.4 Overnight Paid Programming & Shady Infomercials (03:00 – 06:00)
- **Class-Action Legal Syndications**:
  - *"Have you or a loved one been exposed to unshielded Zortrium radiation while docked at an Orion Heavy Industries shipyard? You may be entitled to substantial imperial credits! Contact the Law Offices of Vex & Sakkra today."*
- **Bio-Dome Real Estate Pitches**:
  - *"Own your dream vacation crater on newly terraformed Antares IV! Breathtaking views of binary starsets! Zero down payment for qualified fleet veterans!"*
- **Miracle Psilon Cognitive Supplements**:
  - Shady health tonics promising telepathic clarity and resistance to Darlok mind control.

---

## 4. ChatGPT / DALL-E Image Generation Roadmap for Commercials

Currently, commercials rely heavily on existing cutaways and MOO1 sprites. To build immersive, television-grade commercials and infomercials, we need a dedicated batch of generated visual assets:

### 4.1 Asset Categories & Requirements
1. **Hero Product Stills (`assets/generated/products/`)**:
   - High-contrast, clean 1080p renders of futuristic appliances, glowing fuel cells, tachyon engines, luxury space yachts, luxury chrono-watches, and amber jewelry on velvet stands.
2. **Corporate Sponsor Logos & Badges (`assets/generated/sponsors/`)**:
   - Sleek megacorporation insignias: *Orion Heavy Industries*, *Sirius Hyper-Drive Systems*, *Betelgeuse Pharmaceuticals*, *Rigel Agricultural Cartel*, *Darlok Security Solutions*.
3. **Studio Demonstration Backdrops (`assets/generated/infomercials/`)**:
   - QVC-style sales stages with pedestal lighting, product shelves, and futuristic infomercial presentation backdrops.
4. **Testimonial Portraits**:
   - Satisfied space truckers, alien mechanics, and corporate executives holding products.

### 4.2 Standardized ChatGPT Image Prompts
```markdown
# Product Still Prompt Template:
"Pixel art illustration in 1990s retro sci-fi video game aesthetic, 640x360 resolution upscaled to 1080p. A glowing futuristic tachyon energy cell inside a metallic casing, resting on a dark velvet display pedestal in a luxury orbital showroom. Dramatic rim lighting in cyan and amber, clean dark background, no lettering, Master of Orion style."

# Infomercial Stage Prompt Template:
"Retro sci-fi home shopping network studio set, 1990s TV broadcast aesthetic. Shiny metallic counter in the foreground, illuminated holographic display screens in the background showing geometric diagrams, vibrant neon accents, CRT scanline feel, Master of Orion universe."
```

---

## 5. Engineering Architecture & Feature Roadmap

### Phase 1: Critical Bug Fixes (Completed)
- [x] **Fix Grolm Black Backdrop**:
  - Add `'interview'` route to `GENERATED` in `js/cutscene-manager.js`.
  - Implement fallback location plate selection in `correspondentScene()` so missing routes load `'station_trade'` or `'council_summit'`.
- [x] **Add Phonetic Corrections**:
  - Add `convoy` / `convoys` (`KAHN-voy`) to `PRONOUNCE` in `js/tts.js`.
  - Add core alien species (`Bulrathi`, `Mrrshan`, `Psilon`, `Alkari`, `Klackon`) and space vocabulary (`Antares`, `Betelgeuse`, `zortrium`).
- [x] **Stabilize Correspondent Badges**:
  - Update `tools/condition_plates.py` field correspondent processing to enforce shared crop dimensions, palette unification via `quantise_like`, and adaptive mouth/badge locking.
  - Re-condition `assets/generated/correspondents/`.
  - Ingestion pipeline expanded to condition `titlecards/`, `logos/`, and `icons/`.

### Phase 2: Dynamic Broadcast Polish (Completed)
- [x] **Show Rundown Open**:
  - Implemented cold open headline teaser ("Tonight on GNN: ...") reading 3 summarized headlines (`GNNScript.rundownOpen()`) before transitioning to story 1.
- [x] **Visual Boot Splash Screen**:
  - Conditioned station test cards (`test_card.png`, `test_card_02.png`) and title cards; integrated dynamic pool into `js/main.js` boot overlay.
- [x] **Breaking News Interrupt System**:
  - Audio stinger siren, flashing red alert border, chyron override, and urgent broadcast intro preface (`GNNScript.breakingIntro()`) when high-priority bulletins arrive.

### Phase 3: 24/7 Daypart Scheduling Engine (Completed)
- [x] **Time-Aware Director Scheduler**:
  - Implemented `SHOW_SCHEDULE` and `getShowInfo()` in `js/broadcast-director.js` exposing show title, desk, and genre; integrated into `#segment-badge` in `js/main.js` and `index.css`.
- [x] **QVC Shopping & Infomercial Generators**:
  - Dedicated script generators `galaxyShop()` and `infomercial()` in `js/script-writer.js` with phone hotlines, price tags, and inventory counters.
  - Television shopping on-screen graphics overlay and hotline banners in `drawBreakCard()` in `js/cutscene-manager.js`.
  - Conditioned and ingested all infomercial stages (`1280x720`), testimonial portraits (`320px`), and corporate sponsor insignias (`256px`).
- [x] **Split-Screen Debate Mode**:
  - Implemented `openDebate()` and dual-PIP monitor layout (`mode: 'dual-pip'`) in `js/cutscene-manager.js` for Council Crossfire debates with individual speaker mouth flapping.

### Phase 4: Local LLM Newsroom Dynamics (Ollama Integration)
- [ ] **Real-Time Anchor Reactions**:
  - Off-critical-path Ollama 7B/8B queries to generate one-sentence spontaneous anchor reactions tailored to the exact wire headline.
  - Strict system prompt guardrails: zero hallucinated news, zero lore translation of real names, instant fallback to pre-written character banks.

---

*This document serves as the canonical master roadmap for GNN. As features land, update the Landed table and record verification metrics in [`CLAUDE.md`](../CLAUDE.md).*
