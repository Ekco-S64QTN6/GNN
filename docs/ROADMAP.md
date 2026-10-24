# ROADMAP — 24/7 Galactic News Network (GNN)

**The forward plan.** What GNN is for, what is built, and what comes next —
in the order it should be done.
*Last updated: October 22, 2026*

Related documents: [`CLAUDE.md`](../CLAUDE.md) is the source of truth for
current state, fixed bugs and the constraints that must not break.
[`tools/PROJECT.md`](../tools/PROJECT.md) is the asset pipeline: decoders,
palettes, extraction order. [`assets/README.md`](../assets/README.md) is the
LBX container and manifest schema.

> **How to use this document.** Every item names the file it touches and
> how to tell it is done. When something lands, move it to §3 with the
> command that proves it, and record the evidence in `CLAUDE.md` §3. The
> project's standing rule applies here too: **verify behaviour, not
> presence.** An item is done when it has been watched working on air,
> not when the code for it exists.

---

## 1. The target

A channel you could leave on in the corner of a room for a week and keep
finding something you had not seen.

1. **Real news, read straight.** Real headlines, real markets, real
   politics — read by alien and human anchors who take them seriously.
   Never parodied, never translated into lore.
2. **A newsroom with people in it.** Anchors with registers, rivalries,
   tics and opinions of each other, who react, hand over, argue and get
   interrupted.
3. **A schedule.** Named shows that follow the clock, from the morning
   watch to the overnight archive, each with its own set, desk, pair and
   feel.
4. **An in-universe channel around the news.** Commercials, shopping,
   infomercials, network promos, public notices — all fiction, all clearly
   separate from the news.
5. **A station that is alive and a little broken.** Faults, interference,
   footage nobody filmed, and secrets a regular viewer earns.

**The rule over all of it: repetition is the enemy.** A viewer who sees
the same line, shot, fault or spot twice in an evening starts to see the
machinery. Every content pool should be large enough, and every picker
memory-aware enough, that an evening never repeats itself.

### Hard lines

- **Lore and real news never mix.** In-universe material airs only in its
  own show (*Imperial Historical Wire*), in commercials, and in faults and
  secrets. Never in commentary on a real story. Enforced by `LORE_BLOCKS`
  in `broadcast-director.js`; keep it that way.
- **No pixel-art generation.** Generated art follows `STYLE` in
  `tools/prompt_bridge.py` — pre-rendered early-2000s space strategy, not
  pixel art. The archive supplies the pixels.
- **No automatic palette picking.** Two attempts failed validation 0 of 6
  (`CLAUDE.md` §3). Palettes are settled by eye in
  `tools/palette_review.py`.

---

## 2. The broadcast day

**96 quarter-hour slots, four shows an hour, 24 shows.** `DAY_GRID` in
`broadcast-director.js`, read from the viewer's local clock at *every* cold
open. A show runs to the end of its slot, so the channel stays on the clock;
one that closes early (the wire ran dry) hands to the next slot's show
rather than re-opening. No show airs twice running — the grid is checked
when the page loads and a bad grid warns in the console. Weather at the top
of every even hour. `?block=<id>` pins a show, `?clock=off` walks the list
in order at fifteen minutes a show.

A **show** is a presentation — title, set, pair, title card. It **draws**
stories from one or more topic **buckets** (`draws`), so twenty-four shows
share twelve buckets rather than splitting the wire twenty-four ways. A show
whose buckets are empty borrows from the fullest, rather than airing dead
time. Set, pair and card come from `assets/generated/show-config.json` by id
(`tools/show-editor.html` edits it); a new show needs an entry there and in
`SHOW_SCHEDULE`, nothing else. Any pair sits correctly at any set — the
renderer seats them on each set's own measured desk line — so a new pairing
needs no new art. Title cards for the composed shows come from
`tools/compose_titlecards.py`.

| Show | Desk | Set | Pair | Draws from | Slots/day |
|---|---|---|---|---|---|
| Galactic Morning Watch | Main Desk | studio | human · mrrshan_f | morning_watch, diplomacy | 6 |
| Deep Space Economy | Trade Desk | market | mrrshan · meklar | economy | 5 |
| Council Crossfire *(debate)* | Sector Debate | geopolitics | mrrshan_f · alkari | crossfire, diplomacy | 3 |
| Deep Survey & Cybernetics | Tech Desk | tech | psilon · klackon | cybernetics | 4 |
| Machine Intelligence Log | Automaton Desk | tech | sakkra · robot | machine_intel, cybernetics | 3 |
| Colonial Mining & Trade | Commerce Desk | market | bulrathi · darlok | trade_minerals, economy | 4 |
| Council Summit Floor | Diplomatic Desk | diplomatic | alkari_f · silicoid | diplomacy | 5 |
| The Evening Rim Report | Prime Desk | celebrity | mrrshan_f · human_f | evening_rim, morning_watch, sports | 5 |
| Anomaly: Deep Dark | Investigation Desk | anomaly | robot · psilon | anomaly | 4 |
| Imperial Historical Wire *(lore)* | Archive Desk | archive | psilon · robot | archives | 4 |
| Sector Weather Watch | Weather Desk | weather | human_f · alkari | weather, cybernetics, morning_watch | 8 |
| Solar Wind Overnight | Weather Desk | weather | silicoid · psilon | weather, cybernetics, anomaly | 4 |
| Rim Sports Wire | Sports Desk | sports | bulrathi · mrrshan | sports | 4 |
| The Arena Hour | Sports Desk | sports | klackon · human | sports, evening_rim | 2 |
| Sector Midday Wire | Main Desk | studio | human_f · mrrshan | morning_watch, diplomacy, economy | 5 |
| Market Close | Trade Desk | market | meklar · human_f | economy, trade_minerals | 2 |
| Orbital Briefing | Fleet Desk | anomaly | alkari · darlok | cybernetics, anomaly | 3 |
| The Council Hour *(debate)* | Sector Debate | diplomatic | bulrathi · psilon | crossfire, diplomacy | 3 |
| Galactic Spotlight | Culture Desk | celebrity | alkari_f · mrrshan_f | evening_rim, sports | 4 |
| The Night Desk | Overnight Desk | studio | darlok · robot | evening_rim, morning_watch, diplomacy | 5 |
| Deep Signal | Investigation Desk | anomaly | silicoid · darlok | anomaly, cybernetics | 4 |
| Chronicles of the Old Empires *(lore)* | Archive Desk | archive | meklar · sakkra | old_empires | 3 |
| World Desk Tonight | World Desk | geopolitics | human · bulrathi | morning_watch, crossfire, diplomacy | 4 |
| Signal & Circuit | Tech Desk | tech | klackon · robot | cybernetics, machine_intel | 2 |

<details><summary><b>The grid</b> — every slot of the day</summary>

| Hour | :00 | :15 | :30 | :45 |
|---|---|---|---|---|
| 00 | Solar Wind Overnight | Deep Signal | Anomaly: Deep Dark | The Night Desk |
| 01 | Anomaly: Deep Dark | Deep Signal | The Night Desk | Anomaly: Deep Dark |
| 02 | Solar Wind Overnight | The Night Desk | Anomaly: Deep Dark | Deep Signal |
| 03 | Imperial Historical Wire | Chronicles of the Old Empires | Imperial Historical Wire | Chronicles of the Old Empires |
| 04 | Solar Wind Overnight | Imperial Historical Wire | Chronicles of the Old Empires | Imperial Historical Wire |
| 05 | Machine Intelligence Log | Signal & Circuit | Machine Intelligence Log | The Night Desk |
| 06 | Sector Weather Watch | Galactic Morning Watch | Rim Sports Wire | Galactic Morning Watch |
| 07 | Orbital Briefing | Galactic Morning Watch | Deep Space Economy | Galactic Morning Watch |
| 08 | Sector Weather Watch | Galactic Morning Watch | Council Summit Floor | Galactic Morning Watch |
| 09 | Deep Space Economy | Orbital Briefing | Council Summit Floor | Sector Midday Wire |
| 10 | Sector Weather Watch | Council Summit Floor | The Council Hour | Council Summit Floor |
| 11 | Sector Midday Wire | Council Summit Floor | Galactic Spotlight | Sector Midday Wire |
| 12 | Sector Weather Watch | Sector Midday Wire | Deep Space Economy | Colonial Mining & Trade |
| 13 | Deep Space Economy | Colonial Mining & Trade | Sector Midday Wire | Deep Space Economy |
| 14 | Sector Weather Watch | Colonial Mining & Trade | Rim Sports Wire | Colonial Mining & Trade |
| 15 | Deep Survey & Cybernetics | Machine Intelligence Log | Deep Survey & Cybernetics | Market Close |
| 16 | Sector Weather Watch | Market Close | Deep Survey & Cybernetics | Orbital Briefing |
| 17 | Signal & Circuit | Deep Survey & Cybernetics | Rim Sports Wire | Galactic Spotlight |
| 18 | Sector Weather Watch | The Evening Rim Report | Rim Sports Wire | The Evening Rim Report |
| 19 | Galactic Spotlight | The Evening Rim Report | The Arena Hour | The Evening Rim Report |
| 20 | Sector Weather Watch | The Evening Rim Report | World Desk Tonight | The Arena Hour |
| 21 | Council Crossfire | The Council Hour | Council Crossfire | World Desk Tonight |
| 22 | Solar Wind Overnight | Council Crossfire | The Council Hour | World Desk Tonight |
| 23 | The Night Desk | Galactic Spotlight | World Desk Tonight | Deep Signal |

</details>

---

## 3. Landed

Built, wired, and seen working. Evidence for each is in `CLAUDE.md` §3.

### Broadcast
| | Verified by |
|---|---|
| **24 shows on a 96-slot day**, each with its own set, pair and card; shows end on the quarter hour | mocked-clock check: early close → next slot, 08:29 → diplomacy for 16.0 min, 08:46 → morning watch for 14.0 min |
| **One speech queue** — nothing speaks directly; 420 ms between lines; caption raised when its own line starts | the ident, break throw and two-way no longer cut each other off |
| **Speech watchdog extends, never shortens.** Queueing a short line behind a long read no longer clears the queue mid-read | `tools/tests/spamcheck.py`: 2 queued secret lines both play after a 24 s read |
| **Show shape** — cold open with a three-story rundown tease, banter, two-anchor exchanges, two-ways, panels, breaks, show close | `drive.py` reaches `SHOW_CLOSE` → `COLD_OPEN` |
| **Remote two-ways and split-screen debate** through the studio monitor | `docs/correspondent.png`; `?block=crossfire` |
| **Lore separated.** *Imperial Historical Wire* reads archive bulletins and nothing else does | live: lore show read 5 bulletins; Evening Rim read 3 real stories, 0 bulletins |
| **Lip-sync gated on the voice**; prompter typed from the audio position | mouth open 1–2% in silence, 56% in speech |
| **Breaking news** — klaxon, the generated breaking-news frame, chyron override; keyword cooldown that no longer blocks the first six minutes | `?block=evening_rim` + `injectBreaking()`, screenshot |
| **Commercial dissolves** cross from the outgoing shot instead of from black | 0 of 18 shot starts near-black |
| **Faults motivated by the news** — a storm triples the odds of snow, a cyber story of macroblocking | 4,000-sample picker: hurricane → snow 13%, vertical hold 12% |
| **Secrets stay found** across reloads (`localStorage`, guarded) | `help` survives a reload |
| **Secrets board** in the settings panel: found secrets by name, the rest as blanks with a hint, "N of 35 found" | screenshot, 2 of 31 after typing two words |
| **Weather shows read weather** — Guardian extreme-weather and severe-weather.eu feeds; a show reads its primary topic first | Sector Weather Watch queue: wildfires, floods, drought, a hurricane |
| **Faults motivated by the news** also respond to elections, market crashes and power-grid stories | `MOTIVES` |
| **Calendar events** — Halloween (rare events every few minutes), New Year's first minute, April Fools (crossed wires), the solstices; each a secret | `calendarEggs()` |
| **Real space weather** — NOAA SWPC alerts (geomagnetic storms, flares, radiation) as stories for the weather desk | `/api/spaceweather` |
| **Space-weather conditions report** — solar wind, K-index, R/S/G scales, the day's odds, the outlook; each NOAA item its own story (they had all been filed as repeats of the first) | live: report + 4 alerts reach the ledger separately, routed `weather` |
| **Commercial breaks without seams** — break assembled during the toss; first spot line on the picture's frame; skip and secrets no longer collide with the break | `breakcheck.py` (exit-coded): 5 breaks, toss → picture 0.3 s, first line −0.01 s, 0 cut lines; `breakedges.py`: all passed |
| **Every pair has its own exchanges** (120 entries, all 24 shows both ways) | live: Oth/Unit 7's new exchange aired on the lore show; `content_check.py` |
| **Captions labelled with their own speaker** | live: 8 of 8 captions match the director's speech log (was "UNIT 7" over Oth's words) |
| **Skip ignored during a show bumper**; the incoming show opens on schedule | live: morning_watch → bumper → skip → economy cold open |
| **Cutaways belong to their story** — a prefetched scene is used only by the story it was built for | live: real-story triggers drew their own outbreak plates while the lore show prefetched |
| **MoO2's own GNN newscast on the lore show** — the EVENTS newsroom with the event picture on its monitor, full-screen, `◆ ARCHIVE`; MoO2 GNN pictures on the monitor for 52 of 75 bulletins | live screenshot; real stories keep ordinary icons and cutaways |
| **Products stand on their sets** | live screenshots on the jewellery, expedition and home sets; `productsheet.py`: 40 pairings |
| **Wire abbreviations and Grolm** said right | live `sanitize()` under Kokoro: Senator, Mount, Company; St. Louis untouched |

### Content
| | Size |
|---|---|
| Commercial breaks | a **pod of 2–3 spots**, each with its own announcer, no brand twice, at most one promo |
| Spot types | 21 shop products · 14 infomercials · 5 named sponsors (with logos) · procedural brand spots · 10 show promos (6 with logos) · 6 Council notices |
| Commercial footage per beat (after deny list) | ident 68 · hook 108 · body 594 · claim 67 · tag 88 · legal 88 |
| Testimonials | 6 portraits on 8 infomercials' claim beats |
| Orion Salvage Auction | MoO2 APP_PICS — 212 applied-research renders — as numbered lots, copy by category (weapon, missile, building, craft, trooper, device, bio, medal) |
| Honest Gnolam's Starships | used-ship dealership, a different archive hull on the pad every shot |
| Colonial Marine Corps | recruitment spot over a six-second ground battle |
| Imperial Research Exchange | technology sold for research points: the MoO1 TECHNO lab console with one of 40 blueprint schematics composited onto its monitor, each named for what it shows |
| Show promos | 24 shows, each with two lines and a tag |
| Lore show copy | 75 original bulletins (one fragment filtered) + 46 archive bulletins + 49 intercepted MoO2 transmissions (a quarter of lore stories) |
| Desk joins | breaks 16 in / 16 out · tosses 18 · show closes 13 · idents 15 · holds 13 · context 20 · asides 24 crew / 22 machine |
| Two-way copy | intros 10 · asks 12 · follow-ups 12 · answers 20 · thanks 9 |

### Picture
| | |
|---|---|
| Story cutaways | three sources: generated plates (26), archive composites, and **MoO2 cinematic footage, full-screen** (33 vetted segments across 9 videos, labelled ARCHIVE) |
| Ground war | COLGCBT troops — infantry, tanks, power armour — fighting it out on a MoO2 planet surface, two tinted armies with tracer fire; illustrates lore stories only |
| Audio | every effect role has a caller (all 109 effects + 5 stings); each of the 24 shows opens on its own theme |
| Pronunciation | Kokoro table verified word by word against misaki (`tools/pronounce_kokoro.py`); 0 spelled-out words in the test headlines |
| Window | eight panes keyed out of each set; 16 backdrops behind them |
| Glitch engine | **22 faults + 3 rare events**, none repeating within four; 35 secrets — see §7 |

### Asset pipeline
| | |
|---|---|
| MoO1 | 872 items / 4,025 frames (local build, 24 Oct), decoded byte-exact |
| MoO2 | 6,300 items in 320 archive keys (local build, 24 Oct), command-stream decoder, four-layer palette map; SOUND.LBX SFX extraction and 9 Smacker source files implemented; 33 cinematic segments vetted for runtime |
| Audio | SOUND.LBX SFX merge is implemented; raw MoO2 music-source decoding/rendering remains open. Existing OGGs under `assets/audio/music/moo2/` are indexed but not generated by `build_audio.py`. |
| Manifest | 7,172 items, 342 keys, **0 duplicate ids** — `verify_assets.py` and the broadcast's `[GNN Assets]` boot line agree (24 Oct). The manifest is untracked, so the count is the local build's |
| Verification | The latest recorded local run checked 10,722 paths; rerun `tools/tests/offline.sh` after asset/code changes before relying on this result |

---

## 4. Next — the critical path

The few things that most improve what a viewer sees, in order.

### 4.1 Settle the per-item palettes
`python3 tools/palette_review.py`, open the page, pick, `--apply`,
re-extract. 74 rows where a choice changes the result. Mostly SHIPS (race
colouring — likely correct, check ON AIR first), CMBTSFX, CMBTPLNT.
**Done when** the review page is empty or every remaining row has been
looked at and left deliberately.

### 4.2 Generate the waiting art — *landed, except title cards (§4.3)*
Checked 2026-10-18 with `tools/tests/content_check.py`: all 46 stages and
product stills the commercial code names are on disk. New stills from here
on go in only after being composited on their stage and looked at
(`CLAUDE.md` §14).
- **Space weather** — alerts were already airing; a current-conditions
  report (solar wind, K-index, R/S/G scales, today's odds, the storm
  outlook) now gives the weather desk a real reading on quiet days too.
  *Awaiting its on-air check* (§4.5).

### 4.3 Generated title cards for the composed ones
Nineteen of the 24 cards are photographs of the studio with a branded bar,
made by `tools/compose_titlecards.py` — correct, and better than the slate,
but plainer than the five generated cards where the pair stands in front of
the desk. Standing-pair art for those shows would bring them level. So would
logos: only seven shows have one.

### 4.4 Classify MoO2 narrative text and broaden the runtime allowlist

The NUL-delimited extraction and merge tools now exist:
`extract_moo2_text.py` preserves ordered records and raw bytes, and
`merge_moo2_text.py` produces `assets/moo2-strings.json`. That output is
not yet a clean narrative corpus: it can include help/UI text, identifiers,
format strings and other non-story material. The runtime intentionally admits
only the limited race/star-name fields at present.

Remaining work is to classify and curate English narrative records, reject UI
labels and contaminated/non-English records, and widen the runtime allowlist
only for reviewed strings. Narrative event messages such as “The Antarans
have…” may materially expand the lore show after this curation.

### 4.5 Built, awaiting an on-air check

- **Weather cutaways:** `weather_map.png` and `weather_map_02.png` are
  present and the `weather` classifier, generated cutaway pool and sound
  recipe landed on 2026-10-20. Still inspect the plates at the actual monitor
  size and watch a live weather story before calling this visually verified.
- Keep newly landed, unverified work here until it has been watched on air;
  move it to §3 only with the evidence.

---

## 5. Use what is already on disk

Generated art that exists and is drawn nowhere. Each is a small change
with an immediate visible result.

| Asset | Count | Where it belongs |
|---|---|---|
| `generated/standing/` | 18 (single figures, pairs) | Title cards and show opens: the pair for the block standing in front of the set before they sit. `*_pairs.png` already match four show cards. |
| `generated/logos/` unused | 6 | `main_desk`, `market_desk`, `tech_desk`, `fleet_briefing`, `sector_midday_wire`, `the_spotlight` — desk bumpers between stories, or the corner bug |
| `generated/icons/` | 22 | Story icons beside the chyron |
| MoO2 SFX/music | SOUND.LBX effects decoded and merged; optional pre-rendered OGGs | Use MoO2 combat effects in tactical cutaways. Raw MoO2 music-source decoding/rendering remains open; `build_audio.py` only indexes existing OGGs under `assets/audio/music/moo2/`. |
| MoO2 cinematics, unvetted stretches | ~1,400 frames | `intro` has more clean segments than are listed; `loserfin` and `wininfin` endings have whole scenes unused |
| Sprite pool | 1,005 items | A ship-of-the-week segment; a "fleet review" crawl |
| **MoO2 GNN newsroom** (`EVENTS` item 1, 640×480, 31 frames) | 1 | The original game's Galactic News Network studio: the android anchor at her desk, a blank GNN monitor behind her (screen ≈ x 0.49–0.75, y 0.03–0.27 of the frame — measure before use). The 157×125 event pictures were made for that monitor. Rebuild the original newscast as a full-screen **archive cutaway on the lore show**: newsroom, event picture on its screen. Palette fixed 2026-10-18 (item 0 is its holder). |
| **MoO2 GNN event pictures** (`EVENTS` 2–37) | 36 | 18 identified and on the lore show's monitor (`icon-manager.js`); the other 18 need a name before use. In-universe: lore show only. |
| **MoO2 diplomat holograms** (`DIPLOMAT` 14–38, even) | 13 races × 32 frames | Every species' ambassador as a hologram in the diplomacy chamber, in MoO2's alphabetical race order (Alkari 14 … Trilarian 38). Lore bulletins naming a race; the Council public notices; an in-universe debate. Palette fixed 2026-10-18 (holders 0–12). Their 640×480 partners (odd items) are mostly empty — look before use. |
| **MoO2 leader portraits** (`OFFICER` 24–204, step 6) | ~30 clean | In-universe faces: testimonials on the archive look, a Council notice's speaker. Items 210+ decode in the wrong palette — review first. |

---

### 5.1 Pronunciation, ongoing
Add a name the moment it is heard wrong: `.venv/bin/python
tools/pronounce_kokoro.py --say NAME` shows what Kokoro will say; add it to
`EXTRAS` (or a lowercase respelling to `PRONOUNCE`) and re-run the tool.
A weekly pass over the transcript for words Kokoro rates below 3 would catch
them before a viewer does.

## 6. Programming — new segments and shows

Every one of these is a new shape on screen, which is the cure for
repetition that more lines in an existing pool cannot be.

### 6.1 Segments inside existing shows
- **Sector Weather** (Morning Watch). Solar wind, flare index, radiation
  belts, ion storms over named systems, on the weather set with the
  backdrops behind. Real data where it exists: NOAA space weather is public
  and real — a real headline read straight, which fits the hard line.
- **Market Close** (Deep Space Economy). A full-frame board of the ticker's
  real quotes at the top of the block, read by the anchor.
- **The Correspondent's Notebook** (Evening Rim). One correspondent, a
  longer two-way, three exchanges instead of one.
- **This Day in the Archive** (any block, once a show). A single archive
  bulletin, flagged clearly as history, read by the machine. *Only if it
  can be framed so it never reads as news* — otherwise keep lore in its
  own show.
- **Viewer Mail** (overnight). Letters from the in-universe audience, read
  by the robot. Fiction, and clearly the station talking to itself.

### 6.2 New blocks
- **GNN Galaxy Shop as a block** — not just a break kind. An hour of
  shopping with a host at a counter, a running stock counter, callers.
  `GNNScript.galaxyShop()` already writes the copy.
- **Overnight Paid Programming as a block** — the infomercials as
  half-hour shows, with testimonial segments and repeated phone numbers.
- **Weekend schedule** — different block order on Saturday and Sunday.

### 6.3 Show texture
- **Show themes.** A music sting and bed per block, from the 97 tracks
  across both games.
- **Lower-third bugs** — the show's logo in the corner during its block.
- **Desk handover on block change** — the outgoing pair hands to the
  incoming pair on air instead of a hard cut.

---

## 7. The glitch engine and secrets

### 7.1 What exists
22 faults (picture: snow, macroblocking, RGB split, freeze, mirror, tube
breathing, hum bar, black frames, vertical hold, tears, palette burn;
cards: colour bars with 1 kHz tone, test card, stand-by slate; cross-talk:
the shopping channel, other footage), 3 rare events on their own
30–70 minute clock (Antaran intrusion, specimen footage, dead air), and 31
secrets: typed words, each species' name, clicks on the monitor and the
anchors, and certain minutes of the day.

### 7.2 Next
- **Anchor misbehaviour.** An anchor reads the wrong prompter line, starts
  a story then apologises, laughs, is caught mid-sentence coming back from
  a break. Uses the existing speech queue and two-anchor lines.
- **The station's own story.** Over days, the faults hint at something:
  the Antaran carrier gets longer each time, a relay goes silent and comes
  back, the machine anchor starts disagreeing with the prompter. A slow
  meta-plot for regular viewers. Fiction, kept inside faults and secrets.

---

## 8. Characters and voice

- **Every species fully varianted.** Eight species still need `speaking`
  and `listening` plates; generate each as an *edit of its own hero*
  (`CLAUDE.md` §3 explains why fresh generations cannot be registered).
- **Facing variants.** `_turn_left` / `_turn_right` so seated pairs can
  look at each other during exchanges, instead of both facing camera.
- **The rig** (after Kaiagotchi). One plate, a hand-placed 20-point face
  rig, and a warp shader: brows, blinks, smiles and head turns become
  parameters the mood table can drive. MediaPipe will not place the
  points (3 of 11 detect); a click-through marker page will. Large, and
  the biggest single gain in how alive the desk looks.
- **Mood that persists.** `js/cast.js` moods are static. Let a run of bad
  news sour an anchor for the rest of the block, and a rival's jab land.
- **Pronunciation.** `PRONOUNCE` in `tts.js` grows only when a word is
  heard wrong. Keep a running list from watch sessions. DR, St, Mt, No, Co
  and the wire titles (Sen., Gov., Gen., Rep. …) are covered, and Grolm
  keeps his L (misaki said "grome").
- **Every pair has its own exchanges** — 4 per scheduled pair, more for the
  pairs that sit longest. Next: deepen the busiest (*Evening Rim* sits four
  slots a night with 6) and let an exchange react to the story's topic.

---

## 9. Engineering

### 9.1 Reliability
- **Memory on a long run.** Footage loads uncached; still images are now
  cached least-recently-used under a 512 MB decoded budget (the generated
  art alone is ~2 GB decoded). The news ledger expires records after 90
  days, and the fuzzy duplicate check memoises tokens (20 stories × 20,000
  records: 1.9 s → 66 ms on the frame loop). Still worth a 12-hour heap
  measurement on air.
- **rss2json's daily cap** is the single most likely way the channel runs
  dry. An API key, or the local digest as a first-class source rather than
  a fallback.
- ~~`capture_docs.py` hangs~~ — replaced by `capture_gallery.py`; deleted.

### 9.2 Tooling
- **A commercial review page** that plays every spot type on demand — a
  pass over `tools/commercial_review.html` to cover pods, sponsors and
  testimonials.
- **A fault review page** — every glitch on demand, with the frame strip
  this session used to check them, so a new fault is looked at before it
  ships.
- **Make the probes assert.** Started: `tools/tests/content_check.py` runs
  offline (no browser, no server) and exits 1 on a structural content fault.
  `tools/tests/` also holds the fault sheet,
  lore/news separation, rapid-typing secret and break-pod probes, but they
  print results for a human to read. Give each a pass/fail exit code so
  they can run together after a change.

- **The debate monitors** (`PIP_L`/`PIP_R`) are fixed fractions. Checked
  2026-10-18 on both sets that air debates: clear of the pair. Measure them
  per set only if debates move to another set.
- **Set lettering.** The geopolitics set — Council Crossfire and World Desk
  Tonight — has "GNN FLEET BRIEFING" on its desk, another show's name.
  A set-art question for the owner.
- **One command for the offline checks** — done: `tools/tests/offline.sh`
  (syntax of every JS file, `content_check`, the MoO2 unit tests,
  `verify_assets`, and the product sheet). Next: give the CDP probes exit
  codes too, so a second script can run them against a test server.

### 9.3 Asset pipeline
- Per-item palette review (§4.1); MoO2 text classification (§4.4).
- **Pool assignment for the remaining MoO2 archives** — RACES and the BLDG
  archives are unpooled and could feed council and industry cutaways once
  looked at. EVENTS and DIPLOMAT are deliberately denied from every pool
  (in-universe; used by path where they belong).
- **Palette holders are easy to miss.** A run of tiny (24×24) items at the
  head of an archive are palette holders for the big items after them —
  EVENTS (1) and DIPLOMAT (13) were both decoding in the wrong colours
  because of it. Check every archive with that shape: `palette_compare.py
  ARCHIVE --item N --override-item H`.
- **Known palette work:** MoO2 `COUNCIL` uses the item-0 rule across all 197
  items; `OFFICER` items 210–276 use `_item_split` → FONTS 2. The known corrupt
  `OFFICER` duplicate range 143+ is skipped by the extractor, and its old
  per-item overrides were removed on 2026-10-20; it is not a current rendering
  candidate. `RACES` items 32–45 remain a known excluded/unpooled concern.
- ~~`_item_split` did not accept `"IFONTS:n"`~~ — fixed 2026-10-18: split
  values are parsed through `parse_palette_ref()` and unusable entries are
  reported instead of silently skipped.
- **Validate against `liblbx` reference hashes** — SHIPS 42, MONSTER 7,
  STARBG 9, LOGO 0–1, MAINMENU.

---

## 10. Twitch integration

The channel is meant to stream. Chat should be able to find the station's
secrets the way a viewer at the keyboard does — and the station should be
able to notice it has an audience.

### 10.1 Reading chat
Two ways in, both read-only to start:
- **Twitch IRC directly** (recommended). Chat is plain IRC over a WebSocket
  at `wss://irc-ws.chat.twitch.tv`; an anonymous `justinfan12345` login can
  read any channel's chat with no token and no app registration. `server.py`
  holds the socket and forwards messages to the page over the same
  `/api/` bridge the logs use (or a server-sent-events stream), so the
  browser never needs credentials.
- **StreamElements.** The bots already in the room can keep running for
  their own commands; StreamElements also exposes a socket API with a JWT
  from the dashboard, which carries follows, subs, tips and redemptions as
  well as chat. Worth it once events matter (§10.3); not needed for chat
  alone.

### 10.2 Chat triggers the eggs
The glitch engine already has one entry point for typed words (`WORDS` in
`glitch-engine.js`, via its key buffer). Chat feeds the same function, one
message at a time, so every typed secret — `orion`, `1993`, `loknar`, the
species names — works from chat with no second list to keep in sync.
- **Rate limits.** One chat-triggered secret per 30 s globally, one per user
  per five minutes; the interjection queue already caps at two. Raids and
  spam must not turn the broadcast into a jukebox.
- **Credit.** The unlisted-transmission caption names who found it:
  *"◆ UNLISTED TRANSMISSION — FOUND BY <name>"*. Names pass through a
  filter (length, character set, a blocklist) before they reach the screen
  or the voice.
- **Persistent hunt.** The discovered set (`localStorage` now) moves to the
  server when chat is connected, so a secret found by chat stays found for
  the stream; a `!secrets` reply could show the count found of 35.

### 10.3 The station notices its audience
- **Names on air**, sparingly: a follower thanked in the crawl, a sub read
  by the robot as a "new registered receiver on the network". Ticker first
  (silent, safe), voice later.
- **Viewer mail.** A `!mail` message chosen at most once a show, read on the
  *Night Desk* as a letter from a viewer — fiction framing, real name,
  heavily filtered, never read verbatim without the filter. Ties into §6.1.
- **Polls.** Chat picks the next show from two, or which anchor gets the
  last word in *Council Crossfire*.
- **Faults on demand** for channel-point redemptions: a redemption fires a
  named, harmless fault (colour bars, the test card, snow).

### 10.4 Guard rails
Nothing from chat is ever read as news, and nothing from chat reaches the
voice unfiltered. Chat can trigger fiction (eggs, faults, mail); it cannot
put words into the real-news half of the channel. The same hard line that
keeps lore out of the news keeps chat out of it too.

## 11. Further out

- **Local-model reactions** (Phase 5 of the old plan). One sentence per
  story from a local 7–8B model, off the critical path, with strict
  guardrails: no invented facts, no lore applied to real names, instant
  fallback to the written banks. Validated before airing, never trusted.
- **A desktop window, not a browser tab** — the GTK/WebKit wrapper exists
  for Linux; make it the default way to run the channel.

---

## 12. Not on the roadmap

- **Every line generated by a model.** Reactions only, with guardrails.
- **A playable game.** GNN is a broadcast, not a simulation of a match.
- **Multiplayer or networked viewing.** One machine, one channel.
- **Translating real news into lore.** It was planned once and is the
  opposite of what the channel is for.

---

*When an item lands, move it to §3 with its proof and record the evidence
in [`CLAUDE.md`](../CLAUDE.md) §3. Verify behaviour, not presence.*
