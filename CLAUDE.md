# CLAUDE.md — working notes and verified state

**This file is the single source of truth for what is broken, what is fixed, and
what must not be touched.** `README.md` is the public front page.
`docs/ROADMAP.md` is what is still to build.
`tools/PROJECT.md` is the source of truth for the **asset pipeline** — MoO1 and
MoO2 decoders, palette map, extraction order.
`CONTRIBUTING.md` is how to work here — read it before changing anything.

Last reconciled against the code and commit history through 2026-10-20 (`82f6949`). This was a remote source review; generated asset outputs and live on-air behaviour were not rerun during the documentation pass.

---

## 0. The rule that matters most

**Verify behaviour, not presence.** This project has a long history of documents
claiming fixes that had not landed, and of fixes aimed at the wrong cause. Two
examples from recent rounds, both of which would have cost a full session if taken
on faith:

- A brief asserted that every page load fired one TTS request per voice in the
  catalogue. It does not. Those log lines were `tools/voice_audition.py` run by
  hand against the same server. A clean boot makes three requests.
- The same brief asserted the asset extractor emitted magenta transparency and
  rainbow palettes. It does not. 120 sampled assets: zero fuchsia pixels, all
  RGBA with real alpha.

Both were plausible, both were written confidently, both were wrong. Before
acting on any claim in any document — including this one — run the command next
to it.

The corollary bit twice on audio: **a measurement that passes can still be the
wrong measurement.** Pop detection said the mix was clean for three sessions
while the owner could plainly hear crackle, because the fault was clipping, not
discontinuity. When someone says they hear a problem and your metric disagrees,
the metric is the thing to doubt.

---

## 1. Current verified state

| | |
|---|---|
| Voice engine | Kokoro-82M, local, in-process, ~7× realtime on CPU |
| Fallback | `edge-tts` (cloud) when `.venv` is absent |
| Assets (MoO1) | 873 graphics items / 4,205 frames across 22 archives — decodes byte-exact |
| Assets (MoO2) | 6,502 graphics items across 285 archives — decoder correct, palette map from community sources |
| Merged manifest | 342 directory keys and 0 duplicate ids are expected. The last verifier/README output says 7,374 items, while §3's post-merge audit records 7,375; rerun merge + verification locally before treating the one-item count as reconciled |
| Admitted pools | MoO1 + MoO2: 147 broll (86+61) · 219 portrait (136+83) · 1,005 sprite (396+609) · 154 chrome (12+142) · 15 glitch. `STATIC_DENY` (scene-compositor.js) is enforced **inside `GNNAssets.find()`**, so every consumer gets it |
| Output ceiling | peak 0.872 under deliberate overload, zero clipped samples |
| Per-line loudness | −19.3 to −20.3 LUFS, 1.0 LU spread, true peak −3.0 dBFS |
| Spoken lines | 22 consecutive, 0 truncated |
| Broadcast | runs the full rundown with zero exceptions over 90 s+ |
| Frame | 320×180 design grid, 1280×720 canvas, follows the window, full-bleed |
| Cast placement | `CAST.h` 0.300 of frame height, seated at per-set `deskLine` from `layout.json` (0.4680–0.5690) |
| Plates | conditioned at canvas resolution, not the design grid |
| Cast | 14 profiles in `js/cast.js`, 14 entries in `main.js`'s `ROSTER`; 13 seatable |
| Voices | 12 neural voices plus `vox_unit` (a DSP chain over `am_michael`, not a model) — 13 entries in `server.py:LOCAL_VOICES` |
| Robot | Generated anchor, same four plates as everyone else. The MoO1 25-cel keyed set, `tools/key_robot.py` and their `verify_assets.py` checks are retired |
| Anchor variants | every seated species has `desk_hero` and `speaking`; `listening_flip` derived via head-only mirror |
| Studio sets | Ten sets, all scheduled — all 10 measured and calibrated in `layout.json` |
| Cutaways | generated plates in `assets/generated/cutaways/`, routed via `GENERATED`; MOO1 composites are the fallback |
| Commercial breaks | a **pod of 2–3 spots** (~40–60 s), each with its own announcer; the ident gets its own. Content: 21 shop products, 14 infomercials, 5 named sponsors, 10 show promos + 6 Council notices, and a generator with 22 hooks · 14 claims · 28 taglines · 22 legal lines |
| Commercial footage | per-beat pools after the deny list: ident 68 · hook 108 · body 594 · claim 67 · tag 88 · legal 88 |
| Palettes | per-item `FONTS` *or* `IFONTS` references in `palette_map.json` (`"IFONTS:3"`); settled by eye in `tools/palette_review.py`, never by metric — see §3 |
| Backdrops | generated; full set in `assets/generated/backdrops/` |
| Real stock crawl | live Yahoo Finance via `curl_cffi` on `/api/market`, per-segment color crawl |
| Logging subsystem | dual-file: `gnn-transcript.log` (ms dialogue) & `gnn-server.log` (universal sink); 250MB rotation |
| Diagnostic tests | 26 standalone CDP runners and monitors preserved in `tools/tests/` |
| Show logos | twelve in `assets/generated/logos/`; six on their shows' promos, `galaxy_shop` closing every shop spot. Six still unused (ROADMAP §5) |
| Sponsors & testimonials | five named sponsors with crests (`generated/sponsors/`) closing their spots; six testimonial portraits on eight infomercials' claim beats |
| Lore separation | in-universe bulletins air only in *Imperial Historical Wire* (`LORE_BLOCKS`); every other block reads real news only. 75 original + 46 archive bulletins + 49 hand-picked MoO2 transmissions (`assets/moo2-transmissions.json`) |
| Schedule | **24 shows on a 96-slot day** (`DAY_GRID`, `broadcast-director.js`), read from the clock at every cold open; a show ends on its quarter hour; weather every even hour. Shows `draw` from 12 topic buckets and borrow when empty |
| Monitor | one 16:9 rectangle (`GNNCutsceneManager.PIP`) for icons and footage; generated bezel — gunmetal, brass on the archive/diplomatic/celebrity sets — its opening measured from its own alpha |
| Show config | set, pair and title card per show from `assets/generated/show-config.json`, **by id**; cards for 19 shows composed by `tools/compose_titlecards.py` |
| New commercials | **Orion Salvage Auction** — MoO2 `APP_PICS` (212 applied-research renders) as numbered lots on the pedestal, copy by category · **Honest Gnolam's Starships** — a different archive hull (≈570, both games) on the shipyard pad each shot · **Colonial Marine Corps** recruitment over the ground war |
| Ground war | `groundwar` recipe (scene-compositor.js): MoO2 `COLGCBT` infantry, tanks and power armour in two tinted armies on a MoO2 planet surface, running in, trading tracer fire, dying. **Lore stories and the recruitment spot only** — excluded from random recipe picks (`LORE_ONLY`) |
| Pronunciation | Kokoro uses `js/pronounce-kokoro.js` (generated, verified against misaki by `tools/pronounce_kokoro.py`); other engines use `PRONOUNCE` |
| Research Exchange | commercial built wholly from MoO1 `TECHNO`: lab console + one of 40 schematics on its monitor (`LAB_SCREEN` 116×76 at 147,55), sold for research points |
| Cutaway footage | MoO2 cinematics, **full-screen**, 33 vetted segments across 9 videos, line-doubled where Smacker halved them, loaded uncached (`?cutaways=footage` forces it) |
| Glitch engine | 22 faults + 3 rare events (30–70 min clock), none repeating within four; 35 secrets. Every fault looked at on a frame sheet (`tools/tests/faultsheet.py`) |
| Story icons | regenerating into `assets/generated/icons/` |
| Prompt library | `assets/generated/Prompts/` |
| Speaker attribution | per-line; `activeSeatForLine()` and `speakerIsSeated()` in the director |
| Main desk beat | `human`, `mrrshan_f`, `human_f`, `alkari_f` cover world · diplomacy · science · tech · fleet · anomaly |
| Two-anchor beats | `GNNScript.banterBeat()` and `exchange()` return tagged arrays |
| Cold open rundown | `GNNScript.rundownOpen()` names three queued stories |
| Boot sequence | `main.js:runBootSequence()` holds director behind the title card over `track_09` (~22s) |
| Scene review | `tools/scene_review.html` — recipes as `.webm` or contact sheet, plus deny-flag UI |
| Studio review | `tools/studio_review.html` — desk-line slider across all ten sets |
| Interview tuner | `tools/interview_tuner.html` — slider tuning for the EMBASSY composition, saved to `INTERVIEW_DEFAULTS` |

Verify all of it:

```bash
./start.sh --bg
python3 tools/verify_assets.py          # all runtime paths resolve locally (passes clean)
python3 tools/drive.py 90 /tmp/run      # full rundown, counts exceptions
python3 tools/audio_probe.py 110        # clips + level-relative pops
./stop.sh
```

The `[GNN Assets]` line in `gnn-server.log` reports the runtime's flattened
manifest count. The available documentation disagrees by one item: the last
verifier/README output says 7,374, while §3's post-merge audit says 7,375.
Run the local extraction, merge and `tools/verify_assets.py`, then compare the
fresh boot log before calling the total reconciled; the earlier 13,144-item /
5,769-duplicate manifest state is the separate bug fixed in §3.

---

## 2. Architecture constraints — do not break

Load-bearing. Each one is here because breaking it caused a bug that took a
session to find.

1. **Canvas compositing order** in `renderer.js`:
   Inside `drawViewport()`: clear → backdrop + ghost anomaly (window layer outside studio)
   → set plate (opaque walls/desk) → cast plates → monitor icon → post-process blit
   → alert border → Orion badge → caption. The viewport *is* the canvas: the picture
   fills the window. The MOO1 TV chrome (`background_tv.png`) is deliberately not drawn.
2. **All production assets stay in `assets/`.** Generated art goes in
   `assets/generated/`. Extracted assets are gitignored — see §7.
3. **The bottom of the frame is a stack and `GNNRenderer.bottomStack()` owns
   it** — ticker, then the name/LIVE row, then the chyron. Same rule for any
   label placed after another: measure it (`ctx.measureText`), never assume a
   fixed offset.
4. **Server runs via `python3 server.py` on port 8080**, started through
   `./start.sh` so the `.venv` interpreter is used.
5. **Never `substring(0, N)` / `slice(0, N)` on read copy** without
   sentence-boundary detection.
6. **Google Fonts loading stays in a non-blocking `try/catch`** in `main.js`.
7. **`musicBaseGain` is set inside `playMusic()`** before any `duckMusic()`.
   Ducking is a *multiplier*, never an absolute gain.
8. **Every gain change on a live signal path goes through `ramp()`.** An
   instantaneous `setValueAtTime` on an audible node is a step discontinuity.
9. **Voice is the 0 dB anchor.** Effects and music are mixed and ducked under it.
10. **Nothing goes after the limiter except the mute/volume fader, and that
    fader never exceeds 1.0.** Make-up gain belongs in front of the limiter.
11. **Asset consumers query a pool**, never re-derive size filters locally.
    `GNNAssets.find({ pool: 'broll' })`.
12. **The test harness launches Chromium muted.** `GNN_HARNESS_AUDIO=1` to hear.
13. **Any async call fired from `update()` reserves its state synchronously
    and clears it in `finally`.** The frame loop keeps running across an
    `await`. The pattern is `breakArming` and `twoWayArming`.
14. **A skipped pixel and a pixel written as index 0 are different things.**
    In MoO1 delta frames, `skip` means "leave the previous value"; a payload
    value of `0` means "erase this pixel". Do not conflate them. This is the
    rule that fixed the missile-trail bug and its follow-on artifacts.

---

## 3. Bugs fixed, with the evidence

Kept because each one explains a constraint above, and because the wrong
diagnosis is as useful to record as the right one.

### A placed story could wait forever, and feeds had three silent faults
Found while making the trailer's chosen headlines air on cue:
- **Placed stories** (importance 9000+: injects, review tools) went behind
  the three stories teased at cold open, could be pushed back by the topic
  interleave, and — if their words missed the show's topic — were filed in
  another topic's queue and never aired. They now go to the front of the
  current show's queue, whatever their topic.
- **Newsletter plugs read as news.** Guardian summaries carry "Sign up for
  the US Breaking News email" glued onto the story ("…emailFlorida's
  governor…"); `cleanFeedText` strips them.
- **UN News** sends gzip unasked; the proxy passed it through and every poll
  failed as "Invalid feed XML". `handle_feed` decompresses.
- **Live Science** moved to `feeds.xml` and its redirect drops to plain HTTP,
  which the proxy refuses (correctly). URL updated.
- **The topic queues were unbounded** (archives held 367); capped at 60 per
  topic, lowest-scoring dropped.

Also: `tools/tests/prune.py` crashed on `_moo2_keys`, did not know MoO2 paths,
and would have dropped `_moo2_keys` from the file it rewrote. Fixed; it
pruned `INTRO2/item_02` (the game's credits, deleted by the owner after it
aired behind a correspondent), now also in `STATIC_DENY`.

### The booth ident played twice
Owner: the robot announcer said "This is the Galactic News Network" twice
before a show. The director queued it once — the transcript shows one line
per boot — but the log showed a second 34-character `vox_unit` synthesis
three seconds later, a cache hit on the same text, with no speech line of
its own. `GNNTTS.setVoice()` restarted the line in progress whenever the
voice changed — meant for the viewer's voice picker — and the director calls
it at every cold open for the incoming lead, a second before the ident ends.
Any show whose lead voice differed from the one already set heard the ident
twice; it became common when the 96-slot day put the robot, Darlok and Meklar
(all `vox_unit`) in lead seats. A restart is now opt-in (`{ restart: true }`,
only from the picker). `tools/tests/speechgaps.py` counts ident starts: 1.

→ **A convenience for one caller is a side effect for every other caller.**

### Every hand-over between anchors carried one or two beats of dead air
Measured from the media elements (`tools/tests/speechgaps.py`): 2.2 s median
silence between lines, up to 5 s. Three causes stacked: the hold after a
read was 1.5–3.6 s of deliberate dead air; several segments held for their
lines' *estimated* length plus a second, so a voice faster than the estimate
left the difference silent; and every queued line was synthesised only when
its turn came. Holds shortened (`PACE`), estimate holds replaced by a 500 ms
floor (segments already wait for `speaking` to clear), `LINE_GAP_MS` 420→240,
and the pump prefetches the next queued line while the current one plays.
After: 1.25 s median, 0.3–0.5 s inside an exchange, ~1.2 s between stories.
No line cut off mid-speech in either run.

### The listening plates moved the whole body
When one anchor stops speaking the other switches to `listening`, a separate
generation whose shoulders, collar and hands sit a few pixels off the hero
(5–29% of body pixels differed). The owner fixed the speaking plates by hand
— the talking head pasted onto the hero. `tools/fix_listening.py` does the
same for both listening states: neck from the silhouette, or below the
mouth (taken from the speaking plate) where a mane hides the neck — the
Bulrathi's came out at row 30, above the eyes — head aligned to the hero's
by silhouette, hero below the cut. Originals in
`_inbox/listening_before_fix/`. After: worst body difference 0.5% (palette
noise). Contact sheet: `docs/listening_fix.png`.

**It failed on five species and was reverted for them**: human, human_f,
Sakkra, Psilon, Klackon. The owner saw it in the trailer — the face turning
was "horrifying". Aligning a turned head to the hero's head by silhouette
rescales and shifts it (up to 8%), so on each switch the face jumps and
warps. Exactly the lesson already recorded above: *grafting one generation's
head onto another's body does not work*. The graft is kept for the species
the owner has not flagged; any of them can be reverted the same way — copy
the original back from `_inbox/listening_before_fix/`.

→ **Read §3 before building a tool it already warns against.**

### Kesh, the male Alkari, spoke in a woman's voice
`bf_emma`, while Kira (`alkari_f`) is the female of the pair. He is on
`am_puck` now — added to `server.py:LOCAL_VOICES`; Kokoro ships six male
voices the station had never used (adam, echo, eric, liam, onyx, puck).
Set in three places: `cast.js`, `main.js` ROSTER, `show-config.json` cast.

### Another agent stripped 971 comment lines from the director
And ran it through a formatter that broke the indentation and turned the
header into "G N*N". No code changed. 111 of the 144 comment blocks were put
back where the code they describe still exists unchanged (839 lines); 21
were left out because that code has since been rewritten. `cast.js` lost its
field schema the same way; restored.

→ **Comments here are the record of why. Do not strip them.**

### Archive stills were the main commercial look; the icons were mislabelled
Owner: the generated infomercial plates look best and should carry the
breaks; MoO footage next; archive stills and backgrounds as a rare
throwback. Every shot without its own stage — and every shot of a
procedural spot — used to fall through to archive stills. Each spot now
rolls a **look** once (`rollLook()`, cutscene-manager.js): `plate` 65% (one
generated stage for its product shots, generated backdrops and space
cutaways for ident, logo and legal), `footage` 25% (MoO2 cinematics, 4.5 s
a shot), `archive` 10% (the old path). `?commercials=plate|footage|archive`
forces one. Spots with their own stage keep it for their product shots.

The story icons' table labelled the MoO1 files by position and the
positions were wrong — the QUAKE icon was keyed to colony stories, WASTE to
first contact, VIRUS to elections. Rebuilt from the name lettered on each
icon. The generated icons (`assets/generated/icons/`, same 22 subjects) are
the default, with the name and double border drawn inside the monitor in
the MoO1 icon's colour; the MoO1 icon is a throwback for about one story in
fourteen, chosen by headline hash so it holds for the whole story.

The icon box and the footage monitor were two rectangles of different
sizes. One rectangle now (`GNNCutsceneManager.PIP`, read by the renderer),
about 18% larger. A generated bezel (`Prompts/Monitor_Frame_prompts.md`,
green-screen keyed by `condition_plates.py`) frames both when it exists; its
opening is measured from its own alpha, so any shape of frame fits.

### Commercial backgrounds blown up past their resolution
Owner, from screenshots: the show logos were too big and broke up, the
picture behind them was a lone planet sphere zoomed in, the nebulae looked
bad and came up constantly, and a claim shot had yellow and blue blotches
over a landscape. Four causes, four fixes:

- **Logos** went through the 320×180 compositor buffer and were blown up 4×
  nearest-neighbour at 56% of the frame. They are a full-resolution overlay
  now (`scene.overlays`, `drawOverlays()`), a third of the frame, centred.
- **CMBTPLNT** is ten planet spheres; cover-fitted, a small circle fills the
  frame. Out of every commercial beat. Logos sit over STARVIEW (a planet and
  open space), which the owner said looks right.
- **STARBG** is 21 cut-out nebulae ~190 px wide (coverage ~0.5). Out of every
  full-frame use — commercial ident/hook/tag/legal, the tactical, survey and
  deepfield recipes, the ground war sky, and `SPRITE_DIRS`.
- **The blotches** were the `industry` recipe's BEAMS/BLDG cels added with
  `lighter` blending and pulsing. Removed; claim shots take a clean picture
  from their own pool.

And MoO2 **FLEET** — leader portraits and buttons, not ships — was in the
commercial body pool and `SPRITE_DIRS`. Out of both.

→ **Size is not role, and a pool is only as good as its worst member.**
Contact-sheet a pool at the size it airs before adding an archive to it.

### The pronunciation rules were causing the spelled-out words
Owner: *"lot of words used in news stories get spelled out or said
incorrectly — Ukraine is one."* Kokoro said Ukraine perfectly. `PRONOUNCE`
rewrote it to `you-KRAYN` first, and Kokoro's phonemiser reads a capitalised
chunk it does not know as an initialism — "you K-R-A-Y-N". 142 rules marked
stress with capitals that way; Mali came out "M-A-H lee", Pakistan "P-A-K
ih-stan", Taliban, Qatar, Rwanda, Uganda, Somalia, Hyundai the same.

Found by running every rule and every word the station has read (7,742,
from the server log, transcript and local digests) through misaki itself
in `.venv` — the phonemes show a spelled word unambiguously, no listening
needed. `tools/pronounce_kokoro.py` now audits the table against Kokoro and
writes `js/pronounce-kokoro.js`: 91 rules dropped where Kokoro's dictionary
already has the word, 52 replaced by misaki's inline phoneme markup
— the word in square brackets, then its phonemes between slashes in parentheses — (stress taken from the capitalised syllable), plus
overrides where the dictionary is the wrong sense (Niger, Macron) or spells
an acronym-word out (AUKUS, MAGA, OTAN), and 81 news names from the corpus
(Houthi read "HOW-thy", Peskov, Lavrov, Khamenei, Kharkiv…). `tts.js` uses it
only when the engine is Kokoro; the cloud and browser voices keep the old
table, and the server strips markup before a cloud voice. Ten real
headlines through the page's own `sanitize()` then misaki: 0 spelled.

→ **A fix that is never run through the thing it fixes is a guess.** Run
`tools/pronounce_kokoro.py --say WORD` before adding a rule, and re-run the
tool after editing `PRONOUNCE`. Never mark stress with capitals for Kokoro.

### Four of the nine videos aired squashed
intro and three endings decode at 480×160 — Smacker's line-doubled format,
meant to be shown at 480×320. Drawn as decoded they were half height and,
cover-fitted, cropped to their middle third. `cutscene-manager.js:unsquash()`
doubles them per cutaway. Footage cutaways now play **full-screen** (owner's
request), labelled `◆ ARCHIVE` so in-universe film never claims to be pictures
of a real event, drawn at full resolution rather than through the 320×180
compositor buffer; vetted segments went from 18 to 33.

### Every show opened on the same track; thirteen sirens never played
Cold open always played `beds[8]`, so 96 shows a day shared one sting. Each
show now has its own theme (`showIdx * 7 + 3` over the 57 tracks — 7 is
coprime with 57, so no two of the 24 collide). The breaking klaxon was
always `sfx_03`; it draws from the `siren` role now. Plain commercial shots
all fired one `servo`; they pick from eight cues including the click, tick
and three intro stings nothing called. Every role, and so all 109 effects
and 5 stings, now has a caller.

### Ten shows on a ten-slot clock, and only the first one followed it
`HOUR_TO_BLOCK` picked the show for the *first* cold open; every cold open
after that advanced to the next show in list order, whatever the time. A
session started at 08:00 was airing the 14:00 show by 09:30. Shows are now
a 96-slot day read at **every** cold open, a show runs to the end of its
quarter hour (`showLengthMs`, not a fixed `SHOW_MS`), and a show that closes
early hands to the next slot's show instead of re-opening itself. Checked
with a mocked clock: close at 08:14:30 → morning watch for 15.5 min; at
08:29:00 → diplomacy for 16.0; at 08:46:00 → morning watch for 14.0.

Twenty-four shows would have split the wire twenty-four ways, because each
show id was also its story bucket. Shows now `draw` from topic buckets, and
leftover stories return to *their* bucket rather than the outgoing show's.

### Four shows aired on another show's set
The renderer swaps set, pair and backdrop by **block index**. `main.js`
built the set list from `SET_FILES` and the pairs from `SHOW_PAIRS`, lined up
with the schedule only by position — and the positions did not line up.
*Anomaly: Deep Dark* aired at the weather desk, the *Evening Rim Report* on
the anomaly set, *Colonial Mining & Trade* on the sports set, the *Machine
Intelligence Log* on the spotlight set. A set that failed to load would have
shifted every later show by one more. Meanwhile `show-config.json` — the
file `tools/show-editor.html` edits — was read by nothing, so editing a show
changed nothing on air.

Found by looking at the first composed title cards: the *Machine
Intelligence Log* card showed THE SPOTLIGHT on its desk. Sets and pairs now
come from `show-config.json` by show id (`GNNDirector.scheduleIds()`), with
the positional tables as fallback. Backdrops are deliberately not taken from
the config — it names two, and the window rotates through sixteen.

The config's `trade_minerals` pair (bulrathi · meklar) contradicted the
show's own generated card (bulrathi · darlok); the card wins.

→ **Two lists that must agree by position will not.** Look things up by id.

### No breaking story could fire in a session's first six minutes
`lastBreakingAt` started at `0` and was compared against `performance.now()`,
which also starts at zero on page load — so the six-minute keyword cooldown
was already running at boot. Orion Mode's injected story and any forced test
were silently read as ordinary stories. It starts at `-Infinity` now, and a
story injected *as* breaking bypasses the cooldown, which exists to stop
three "emergency" headlines in a row tripping the klaxon three times.

### Every commercial dissolve faded up from black
A dissolve drew the incoming shot at rising opacity over a black fill — the
outgoing shot was never drawn — so for the first frames of every dissolve
the picture was nearly black. The outgoing shot is now held on its last
frame underneath. Measured 60 ms into every new shot across two breaks:
**0 of 18** near-black.

### The breaking-news overlay would have washed out the picture
`overlays/breaking_news_frame.png` came back with its interior filled with
white at ~37% opacity instead of clear. `condition_plates.py:do_overlays()`
clears translucent pale pixels and writes `overlays/keyed/` (74% of the
frame cleared); `drawAlertBorder()` draws it, with the old drawn border as
fallback.

### `window.GNNTextEngine` is undefined
The modules are top-level `const`s, which are global bindings but **not**
`window` properties. A harness or tool that guards with `if (window.GNNX)`
silently does nothing. The first composed title cards went out with the
caption still on them that way. Name the module bare, or check `typeof`.
`GNNRenderer.setCleanFrame(true)` exists for tools that photograph the studio.

### The speech watchdog cleared the queue mid-read
`say()` set the watchdog deadline from the line *it had just queued*,
overwriting the deadline of the line already playing. Queue a short line
behind a long read and the deadline dropped below the read's own length;
the watchdog then decided speech had hung, bumped the token and emptied the
queue. Anything queued behind a story — two-way lines, panel lines, the
second line of an exchange, every secret — could vanish, and how often
depended on how long the story was. That is why it looked random.

Found by `tools/tests/spamcheck.py`: eight secret words typed, `interject`
reporting each as queued, **zero** spoken. `say()` now only ever *extends*
the deadline, to cover everything still waiting. After: two lines play back
to back after a 24 s read.

→ **A watchdog that a new job can shorten is not a watchdog.** Same family
as the race fixed by the speech queue: state shared by every line, set by
whichever line spoke last.

### The staff-channel secret swallowed every other secret
Typing `gnn` injected a *breaking* story, and breaking news cancels the
speech queue — correctly for real breaking news, wrongly for a secret. Any
other secret line already waiting was dropped. It is an interjection now;
breaking news is left to Orion Mode, which is meant to seize the channel.

### Secrets typed during a read never played
Interjections expire if they wait too long, so a stale line is not read
long after its moment. The first expiry was 6 s, shorter than a single
story read — a secret typed mid-story always expired. 45 s now, which
covers the longest read plus the other queued line; at most two can be
queued at once, so the backlog is bounded anyway.

### Lore was read as news
A third of banter beats after a *real* story were a MoO1 event bulletin
under a SECTOR WIRE cue, and `banter()` fell back to the same thing; a BBC
story was followed by "the Psilon colony on Mentar reports a plague". Three
more leaks were found afterwards and closed:

- commentary lines filled `{PLACE}` and `{FACTION}` from the in-universe
  star and race lists ("the Klackon delegation has not put its version on
  the record" — said about a real story);
- the cold open's rundown tease and the breaking intro called the real-news
  feed "the sector wire";
- lore bulletins were written to the shared real-news ledger.

Lore now airs only in *Imperial Historical Wire* (`LORE_BLOCKS`,
`broadcast-director.js`), which reads bulletins as its rundown and leaves
the RSS queue alone. `lorecheck.py` verifies both halves: lore block 5
archive stories, Evening Rim 3 real stories and 0 bulletins.

→ **Separation is a property to test, not a switch to flip.** The first
fix closed two of five leaks.

### MoO2 "bulletins" were mostly interface text
Sampled: game help ("Click here to change the name of your ship"), French,
Italian, Spanish and German strings, a DOS extender banner, code
identifiers. Merged into the bulletin pool they would have been nine
sector-wire picks in ten. The ship-class list carried debug and file
strings ("Emmxxxx0", "Vgafileh", "Yomama") that commercials would have read
as hull names; the star list held a metal and a race (Zortrium, Mrrshan).
The runtime now takes only race and star names from MoO2 (`asset-registry.js`
allowlist), and `cleanVocab()` filters the merged lists whether or not the
MoO2 file exists. The extraction itself is still wrong — ROADMAP §4.4.

### Three of the new faults were invisible on air
Every glitch fired without error; a frame sheet showed three that changed
nothing on screen. Cross-talk footage and the shop bleed were *screened* at
20–30% over a lit studio — mostly dark space screened over bright set adds
nothing. Their footage also loaded when the fault fired, so a three-second
fault was over before its frames arrived. Both bleeds are drawn solid now,
and footage is staged ahead of the fault that uses it. The Antaran
intrusion's "UNIDENTIFIED CARRIER" strap was set but never drawn. And
colour bars kept the live teleprompter on top, which read as a graphic over
a working broadcast — a fault that replaces the picture now takes the
captions with it (`GNNGlitch.hidesGraphics()`).

→ **A fault that does not crash is not a fault that shows.** Look at the
sheet.

### Footage would have filled memory on a long run
The MoO2 cinematics are 1,835 frames, about 528 MB decoded, and every image
loaded went into a cache that is never emptied. A channel meant to run for
days would eventually have held all of it. `loadImage(src, { cache: false })`
keeps footage out of the cache; the glitch engine holds its clip frames in
slots that are released with the fault.

### The shop showed empty pedestals
The twelve products added to the shop had no stills. Three shots of an
empty showroom while the announcer described what was not on it. Until a
still exists, the product uses the showroom only for its opening shot.
Prompts for all twelve are in `Prompts/Product_Stills_prompts.md`; the
engine already points at the filenames.

### Picking a palette automatically does not work — tried twice, recorded so it is not tried a third time
Owner: *"there is still some moo1 and moo2 assets with wrong color palette
FONT IFONT numbers… some items in folders use different numbers than other
items in the folder."* Per-archive assignments are right (`scan_moo2_quality.py`
reports 0 archives above 40% collapse); what is left is per-item.

Two principled automatic pickers were built in `tools/palette_fit.py` and
**validated before use** against six archives already settled by community
data and by eye (CMBTSHP/MISL/FGTR/PLNT on 1, SHIPS/SHIPS2 on 12):

1. **Ramp smoothness** — mean colour step between adjacent opaque pixels,
   on the theory that the right palette makes the artist's shading ramps
   smooth. **0 of 6.** It rewards whichever palette has the least internal
   contrast, so the flattest palette wins every archive.
2. **The same, normalised against the palette's own shuffle**, to cancel that
   contrast bias. **0 of 6.**

Neither was shipped. What `palette_fit.py` does instead is the weaker,
defensible thing: report items whose **palette-index range** is unlike their
siblings' (median/MAD over a 16-bucket index histogram). That is a fact about
the file, not a judgement about colour. Full scan: 497 items across 40
archives, written to `docs/palette-outliers.txt`. **It over-flags**: SHIPS
had 42 outliers and they are right — each race's ships draw from a different
region of the palette.

The decision goes to the eye. `tools/palette_review.py` builds a page of the
outliers that are in a pool (an item in no pool never reaches the screen),
each row starting with the **frame actually on air, read from disk**, then
the item under every FONTS and IFONTS palette. Click the right tile, save
`palette-picks.json`, `--apply` it. 74 rows where a pick can change the
result.

The first version of that page rendered the *configured* palette in
isolation and called it current. For SHIPS that showed dull grey hulls
where the broadcast has gold, green and red ones, because SHIPS builds its
colours by merging **palette-holder** items in sequence as the archive is
walked. Re-implementing the extractor's six palette rules in a preview would
drift; reading the extractor's output cannot. Rows from holder archives are
sorted last and marked: a pick there *replaces* the holder colours, which is
only right if the on-air frame is broken.

`IFONTS` could not be written down per item before: it was one command-line
switch for the whole extraction run, so an archive mixing the two could
never come out right. `extract_moo2.parse_palette_ref()` now accepts
`"IFONTS:3"` (and `"FONTS:3"`) anywhere `palette_map.json` takes a palette —
archive entries and `_item_palettes` — while a plain integer keeps its old
meaning, so every existing entry resolves exactly as before.

→ **Validate a metric against known answers before it is allowed an
opinion.** Both of these looked principled. Both were wrong.

### Commercial breaks ignored the deny list
`STATIC_DENY` lived in `scene-compositor.js` and only the compositor's own
recipes consulted it. Commercial footage is picked with
`GNNAssets.pick(heroPoolFor(kind))` — straight from the pool query, unfiltered
— so every beat could land on the interface panels, keyed-out figures and
inverted COUNCIL frames the list was written to keep off air. The VORTEX
hook list was the clearest case: items 01–34 were all denied, and the one
left eligible, `item_00`, is the scrambled magenta one.

The deny check is now **inside `GNNAssets.find()`**, so `pick`, `pickMany`
and every future caller inherit it. Looked up at call time, since the
compositor loads after the registry.

Found by contact-sheeting the entire broll pool (147 items) and looking.
Added to the list from that: `VORTEX/item_00` (scrambled), `INTRO2/item_00`
(black edge to edge), `SPIES/item_00` and `item_27` (cut-outs on black).

→ **A pool query that returns denied items is a pool query every caller has
to remember to filter, and one forgot.** Constraint 11, applied to the deny
list.

### Each commercial beat drew from a handful of pictures
Measured per beat after the deny list: **`claim` could reach 2 images** —
both the TECHNO lab console — `legal` 4, and every `tag` was a nebula. Most
archives named in `heroPoolFor()` contributed nothing: menus (`INSTALL`,
`MAINMENU`, `NEWGAME`, `CONFIRM`, `BUFFER0`), denied archives (`COUNCIL`,
`DESIGN`), or names with no broll in them. Meanwhile 30 MoO2 planet-surface
landscapes and 10 planet spheres were admitted to the pool and named by no
beat.

The lists were rebuilt from the contact sheet. After: ident 68 · hook 108 ·
body 594 · claim 67 · tag 88 · legal 88. UI archives are out of the lists
altogether — they contributed nothing, but naming a menu archive in a footage
list is an invitation for the next classifier change to put a button on air.

### A break was one advert
`startCommercialBreak` built a station ident and five beats of a single
sponsor. With 9 shop products, 6 infomercials and 4 promos in rotation, the
same handful recurred within the hour, and a break was over before it read
as one.

A break is now a **pod of 2–3 spots** (35% three), no brand twice, at most
one network promo. `buildShot` already stored the script on each shot and
the card and plate code already read `shot.script` before the break's, so
each spot draws its own brand and product with nothing downstream changed.
Each spot gets its own announcer and the ident gets one of its own — it used
to read in whichever voice was picked last, often the first spot's. A forced
kind (`opts.kind`, used by the review tools) stays a single spot. Verified in
the running app: three breaks of 11–14 shots, 43–56 s, distinct announcers
per spot, no page errors.

Content grew to fill it: 21 shop products (was 9), 14 infomercials (was 6),
promos for the channel's ten real shows (was four generic, three naming
shows the channel does not run) plus six Council public-service notices, and
the procedural generator's banks from 5 hooks · 4 claims · 10 taglines · 6
legal lines to 22 · 14 · 28 · 22.

`promo()` returned no `kind` field, so the `[GNN Commercial:Script]` log line
had always reported promos as `commercial`. It carries `kind: 'promo'` now.

### Every MoO2 item was in the manifest twice
`assets/gfx-manifest.json` held 13,144 items across 658 keys with **5,769
duplicate ids**, against the 7,375 / 342 this file stated. 316 hollow MoO2
stubs — `source: 'moo2'`, no pools, no measurements — sat under plain keys
(`ANTAROOM`, `BEAMS`, …), left by an earlier run. `merge_moo2_manifests.py`
assumes any plain key left after its cleanup is MoO1, so it read the ghosts as
MoO1 archives; every real MoO2 archive then "collided" with its own ghost and
was written under a `_moo2` suffix beside it — and the next merge saw the
ghosts as MoO1 again.

It broke nothing on air, by luck: the ghosts had no pools, so pool queries
never matched them, and `byId` kept the real entry because the suffixed keys
came last. It doubled the boot log's asset count — the "asset count needs
reconciling" item that had been open in §7.

The merge now recognises a MoO2 list **by content** (`source: 'moo2'`), not
by name. The cleanup run at the time reported 342 keys, 7,375 items, 0
 duplicate ids, with every pool size identical. Only the four real name
collisions keep the suffix. The current exact item count still needs a fresh
local merge/verify comparison; the README's recorded verifier output is 7,374.

→ **When the name is the thing that went wrong, identify by content.**

### `verify_assets.py` had crashed since the MoO2 merge
It walked every manifest key, including `_moo2_keys` (a list of strings), and
died on the first one — so the first command in §1's "verify all of it" block
failed on every run. It also built MoO2 frame paths without the `moo2/`
prefix. Both fixed; it now checks 10,722 paths.

With it running, it reported 51 missing: the retired MoO1 robot's 25 source
cels and 25 keyed cels, and `desk_oval_front.png`. Nothing reads any of them
— the robot is a generated anchor and the desk is part of the set plate. The
checks were removed and `tools/key_robot.py` deleted with them, which closes
the §7 retirement item. **It now passes clean.**

### MoO1 delta frames left the previous frame under the new one
Owner's original bug: missiles and other moving sprites **painted across the
screen** instead of moving cleanly from A to B. Each frame stacked on the
previous one, so a missile smeared from its launch point to its current
position.

The decoder was clearing every re-encoded column before applying the delta's
runs. That is the opposite of what a delta column means. A delta column
describes **only the pixels that changed**. Pixels inside it that the encoder
did not touch stay as they were on the previous frame — that is what `skip`
reserves — and do not become transparent. The clear loop turned every
unchanged pixel transparent, which then made the anchor's pre-existing
artifacts (INTRO's striped sky, LANDING's column scars) look like decoder
failures when they were the column-clear bug in a different shape.

The second half of the same rule: a payload value of `0` **is** a write. It
means the encoder erased this pixel — the missile moved on — and it writes
through as transparent. A skipped pixel and a pixel written as `0` are
different operations. Only the encoder knows which is which.

Fixed in `tools/lbx.py` by removing the clear loop and removing the
`px != TRANSPARENT` guard. Both edits are two lines long; the reasoning
behind them is the whole of the fix.

→ **See constraint 14.**

### MoO2 frame decoder was reading the wrong grammar
The MoO2 decoder read the first word of a frame body as a relative Y
coordinate, which is what the frame **marker** occupies. Everything shifted
by two bytes from there. `declared_length` values like `257 = 0x0101` were
pixel bytes read as a length; `x` values like `55809 = 0xDA01` were pixel
bytes read as coordinates. The decoder was producing a plausible-looking
sprite because enough runs happened to land near where they should.

Verified against the file: the frame body starts `01 00 <initial_y>`, exactly
as the community `liblbx` spec documents. Rewrote `_decode_moo2_one()` as a
command-stream decoder: validate the marker, read initial Y, loop over
`(length, x_advance, pixels)` and `(0, y_advance)` commands, recognise
`(0, 1000)` as the end marker, skip odd-length padding.

Along the way, two additional format facts surfaced:

- Raw frames (flag `0x0100`) pad their body to a **4-byte boundary**, so
  `len(body)` runs 1–3 bytes over `w × h` on the items that need it. STARBG
  items 17, 29, 41, 45, 49 are the ones that surfaced this. The decoder now
  copies `min(len(body), pixel_count)` and treats the pad as not-pixel-data.
- Every MoO2 frame carries a **6-byte trailer** after its `(0, 1000)`
  terminator. Some are zeros, some are not. Not pixel data, not an error.
  The decoder retains them in `_moo2_trailer_cache[idx]` for later
  investigation.

Warning count on `SHIPS.LBX` went from 293 → 26 → 0. The remaining 26 were
empty sentinel frames on items 405, 406 and 425–448 — 1×1 placeholders with
a stray `initial_y = 636`, no runs. Suppressing that warning when no runs
precede the terminator closed the last of them.

### MoO1 fullscreen art needed opaque index 0, except the overlays
After the delta fix, INTRO scenes showed checkered transparency through what
should be sky. Index 0 is transparent in a sprite and black in a fullscreen —
the game paints the sky, the starfield, the space behind the window, and a
decoded-as-transparent frame only reads correctly when composited over black.

Fixed by adding an `opaque_zero` flag on the render path, set for any item
in `OPAQUE_ZERO_ARCHIVES` with `w >= 300 and h >= 180`. SPIES and EMBASSY
items 12–17 are the exceptions: they are 320×200 overlays, not fullscreens,
and want index 0 transparent so the studio shows through.

→ **Size is not role.** Two archives can produce the same size of item at
the same colour depth with opposite transparency requirements.

### MoO2 archives don't all share one palette, and the map had guesses
`COLONY2` was rendering in inverted colours. So was VORTEX items 2–34. The
palette map's early values were first-pass guesses.

The community had already solved most of this. Nick Bowler's `liblbx` project
ships `doc/txt/moo2-data.txt` — explicit assignments for 17 archives, item-range
splits for `GAME` and `TECHSEL`, and override chains for `MONSTER` and
`RACESEL`. Wolverine's 2007–2008 Orion Nebula research adds the `COUNCIL`
internal-palette rule and the SHIPS palette-holder mechanism.

`tools/palette_map.json` and `tools/extract_moo2.py` were rebuilt against
those sources. New sections: `_item_split` for `GAME` and `TECHSEL`,
`_palette_overrides` for the override chains. The `TANM_###` family (213
archives) is mapped to `FONTS` item 2. `SHIPS`/`SHIPS2` corrected from 3
to 12.

→ **See `tools/PROJECT.md` §4 for the full source attribution and the list
of archives the community never documented.**

### `extract_moo2.py` was reading only two of the four palette sections
The community palette data uses four layers — archive base, per-item palette,
per-item override, item-range splits/override chains — and the extractor
understood only two. `GAME`'s menu split and `TECHSEL`'s two halves read as a
single palette each. `COUNCIL` and the `MONSTER` chain ignored entirely.

Fixed by adding `_load_range_map()` and `_lookup_range()`, wiring
`item_splits` and `palette_overrides` through `load_palette_map()` and
`extract_archive()`, and applying them in the priority order documented in
the module docstring.

### The two-way queued its audio whether or not the monitor opened
Owner-visible fault, hit only when a correspondent's plate was missing from
`assets/generated/correspondents/`: the anchor asked a question, someone
answered it in a voice, and the over-the-shoulder monitor stayed on the story
icon for the whole beat. Worse, the show's *one* correspondent slot burned —
`correspondentUsed = true` — so the forced panel in the second half never
fired.

`GNNCutsceneManager.openTwoWay()` has always returned `false` when
`correspondentScene()` returns null. `beginTwoWay` fired it as fire-and-forget
and returned `true` unconditionally, so nothing upstream could tell the two
apart.

Fixed: `beginTwoWay` is now `async`, awaits the monitor open, only queues the
lines on success. `beginBanter` awaits the same call and only latches
`correspondentUsed` on a `true` return. A `twoWayArming` flag closes the
frame-loop window the await opens.

→ **An async call whose return value the caller needs is not a call the caller
can ignore.** See constraint 13.

### The DR in a headline read as "Doctor"
A wire headline *"UN OFFICIAL SAYS 'WINDOW OF OPPORTUNITY' FOR PEACE IN DR
CONGO"* was read aloud as **"Doctor Congo."** The token `DR` survives
`unshout()` and was absent from `PRONOUNCE`, so it reached Kokoro as the
literal string.

Fixed by adding `[/\bDR\b/g, 'D R']` and `[/\bDRC\b/g, 'D R C']` to
`PRONOUNCE`, deliberately **without** the `i` flag so the mixed-case `Dr`
still reads as "Doctor".

→ **An all-caps token that is also a common English abbreviation is not
caught by anything in the current pipeline.** `unshout` handles emphasis,
`SPELLED_OUT` handles known initialisms, and neither covers `DR`, `St`, `Mt`,
`No`, `Co`. Any wire headline containing one of those will mispronounce until
it is added to `PRONOUNCE` explicitly.

### The two-way route had no plate and no fallback
Bulrathi correspondent rendering over solid pitch black inside the PIP
monitor. `routeFor()` returns `'interview'` for any story with a dialogue
verb. `'interview'` was absent from `GENERATED`, so `generatedScene()` returned
null and `correspondentScene()` had no fallback.

Fixed by adding `interview: ['council_summit', 'station_trade',
'station_trade_02', 'council_vote', 'council_vote_02']` to `GENERATED`, and
giving `correspondentScene()` an explicit fallback chain.

→ **A route is not a plate.** See §2 constraint 11's corollary.

### The phonetic dictionary did not cover the station's own vocabulary
`PRONOUNCE` had two entries. `convoy` was stressed on the second syllable
(`/kənˈvɔɪ/`, like *convey*), audible inside the sponsor copy. Every species
name was subject to the same guess as `DR`.

Fixed by expanding to the full set — real-world names, common stress errors,
every species, the stars.

### The cold open read a headline with no teaser
The station opened on the first queued story directly. A newscast sign-on
that goes straight into a story reads as a feed reader.

`GNNScript.rundownOpen(queue, showInfo)` returns a three-line tagged exchange.
`beginColdOpen()` uses it when the queue has at least two stories and falls
back to `showOpen()` otherwise. In `broadcast-director.js`, the teased
stories are pinned so subsequent feed replenishments do not displace them.

### The first minute of airtime fought itself for resources
Fixed by holding the director behind a title card while `track_09` plays.
`main.js:runBootSequence()` warms the TTS pipeline, schedules the booth ident
so its last syllable lands one beat before the crossfade, and sets
`window.GNNBootReady` when the fade completes.

### The wire ran dry and the channel had nothing to say
rss2json's **daily** cap leaves every feed erroring at once. `server.py` serves
`/api/localnews`, which parses the newest Gemini digest out of
`~/github/Kaiacord/knowledge_base/news/daily`. `feed-manager.js` falls back
to it when a poll returns nothing.

### The tool fed its own output back in and the mouth rotted
`swap_region()` blends two 256-colour plates and invents colours, and the
result was saved **without quantising** — 1,044 colours on the human. So the
tool's own output failed its own `conditioned_already()` test and was picked
up as source art on the next run. Every run cost another generation of quality.

Fixed by quantising both rebuilt states, refusing to archive a rebuilt state
into `_inbox`, and restoring the raws.

→ **Never write a tool's output where it looks for its input.**

### The anchor spelled words out
Wire headlines arrive in capitals, and every engine reads an all-capital word
as an initialism, so PUTIN came out "P, U, T, I, N" on roughly one read in ten.
`unshout()` treats capitals as formatting when the line is mostly capitals and
as deliberate otherwise.

It mispronounces the occasional genuine one: IAEA becomes "Iaea". That is the
owner's explicit preference — **a wrong pronunciation passes, a spelled-out
word does not.**

### The caption drew over the commercials
A break sets its own type. The teleprompter caption was still being drawn on
top of it. The break owns the frame while it runs.

### Plates were conditioned to the design grid and upscaled back
Everything was fitted to 320×180 and then blown up four times by the canvas,
while the anchors — larger plates drawn smaller — were blown up about twice.

→ **Condition a plate at the size it is drawn.** `condition_plates.py` reads
`BASE_W`/`BASE_H`/`SCALE` out of `renderer.js` so this cannot drift.

### The desk was sized by width and fell out of frame
At full frame width it was 425 px tall in a 720 px frame drawn from the seat
line. It is sized by **height** now.

→ **Size a prop by the dimension that is constrained.**

### Two-state mouths never closed
Cast art with `hero`/`speaking` read the animator's frame index, which is
non-zero for every moment of an utterance. It follows
`GNNAnimator.mouthLevel()` now.

### The mouth never shut, and the cause was the audio fix
The voice is compressed to about a decibel of variation on the way out of the
server, which is what makes the station sit at an even level. The level fix
removed the signal the lip-sync was reading.

Two-state art now flaps on a syllable clock — roughly five a second, shut half
shorter than open. **0 → 71 transitions in ten seconds of speech.**

→ **A fix in one stage can remove the input another stage depends on.**

### The mirrored plate came out as a thumbnail, and flipped the badge
A whole-image horizontal flip turns the glance the right way and turns the
station badge into backwards lettering with it. Mirroring **above the neck
only** moves the face and keeps the uniform.

Deriving it part-way through conditioning then put a miniature in the corner
of its own canvas. It is made from the **finished** plate instead.

→ **Derive a variant from the finished asset, not from the middle of the
pipeline that made it.**

### `neck_row` assumed every head has a neck
A Bulrathi's mane and a Mrrshan's hair run straight into the shoulders. The
pinch now has to be a real one, narrower than the band around it and not
against either end of the search, or a fixed fraction is used.

### Cropping each state to its own content un-registered them
One box, taken from the hero, for the whole species.

### Two generations of anchor plate, one set of filenames
The full-torso set is canonical. The chest-cropped set is archived in
`_inbox/field/`, where it is the right art for a correspondent in the
over-the-shoulder monitor.

**Grafting one generation's head onto the other's body does not work.** No
rigid scale and offset fixes that.

→ **A measurement that says two things match is not the same as them
matching.**

### The glitch engine queried the catalogue with no pool
`ghost_signal` and `interference` called `GNNAssets.pick()` and `find()`
without naming a pool, which reaches past admission entirely. The scrambled
items it actually wanted were admitted to nothing (`pools: []`), which is why
it was querying raw. They have a pool of their own now — `glitch`.

→ **Constraint 11 is not advice.**

### The conditioner was grafting one plate onto another
`graft_body()` pasted the hero's body onto every variant, cut at a row
measured off the *hero's* silhouette and blended as raw RGBA. On the Klackon
the cut fell through the mandibles; on the Mrrshan the blend mixed in the
colour behind transparent pixels, giving **two GNN badges on one chest**.

→ **A plate that is only ever scaled and translated cannot come out
damaged.** Anything that cuts one picture and pastes another onto it can.

### Separate generations do not come back at the same size
`register()` scales and shifts each variant onto the hero, lining up the
lower body. Two refinements on top of that were tried and both reverted.

→ **Registering two whole plates cannot fix this**, because two generations
never agree everywhere.

### The whole body moved when only the mouth should have
`condition_plates.py` now builds `_speaking` as the **finished hero with
its mouth swapped in**, so outside the mouth the two plates are byte-
identical. 2.2% of the human's plate differs, 1.4% of the Klackon's, 3.1% of
the Mrrshan's, all of it one blob on the mouth.

Must be done on the **conditioned** plates. Quantised separately the two get
their own 256-colour palettes and 5% of every pixel flips.

→ **Change only what changed.**

### The caption outran the voice and the mouth stopped mid-sentence
`trimForSynthesis` is exported now and `broadcast-director.js` trims once,
before the text reaches either the caption, the clock or the voice.

→ **One text, trimmed once.**

### The anchors stood behind the desk instead of sitting at it
`DESK_LINE` is **0.468** and `CAST.h` **0.300**. `condition_plates.py` reads
`CAST.h` out of `renderer.js` rather than repeating it.

→ **Size a figure against the thing it has to meet, after placing it there.**

### Easter eggs pointed at a layout that no longer existed
Hit regions come from `GNNRenderer.hitRegions()` now, derived from where the
cast and the monitor are actually drawn this frame.

→ **A hit region belongs to whoever does the drawing.**

### `getcolors()` returns None, and `or []` made that zero
`palette_size()` now returns a large number when the count overflows.

→ **A sentinel is not an empty collection.**

### Static files had no `Cache-Control`
Static responses now send `no-cache, must-revalidate`; unchanged files still
answer 304. **If a fix appears not to have taken effect, suspect this before
re-debugging the fix** — and hard-reload (Ctrl+Shift+R).

### `stop.sh` killed its own shell
Matched strays with `pgrep -f "python3? .*server\.py"`, which also matches any
shell whose argv mentions the file. Now finds the listener by port.

### The README lied
It claimed "zero-cloud" while `edge-tts` called Microsoft on every line. Fixed
by making it true (Kokoro, local) rather than by editing the sentence.

### The same banter line twenty times in one broadcast
`cast.js` held exactly one relationship between `human` and `mrrshan_f`.
Fixed by expanding the table to twelve entries across both directions, adding
a recency buffer to `GNNCast.exchange()`, gating the `banter()` tic branch on
a recent-line check, and dropping the tic from `outOfBreak()`.

→ **A short list is not a diverse one.**

### The break came back twice
Removed the `S.BREAK` case. `beginBreak` owns the return.

→ **One segment, one owner.**

### The sign-off named the wrong anchor
`beginShowClose` asked `speaker()` for the voice, which read the chair.
Fixed by using `GNNScript.desk()[0]` for both.

### The text ran ahead of the voice
Added `waitingForAudio()` to `tts.js`. `text-engine.js` pauses while it is
true.

→ **A flag has to be set at the moment it becomes true.**

### The two-way cluster — three causes behind six symptoms
**Cause one — the wrong seat was being read.** Tagged each queued line with a
`speakerId`, tracked `currentLineSpeaker` in the pump.

**Cause two — the animator read the level regardless of who was speaking.**
Gated on the animator's own `speaking` flag.

**Cause three — the correspondent's flap ran on the voice bus alone.** Also
requires `GNNDirector.speaker()` to match the scene's correspondent.

→ **A voice on the wire is not the same as a person at the desk.**

### The two-way played over the story it replaced
Reserved `S.BANTER` synchronously in `beginBanter`, and queue the three lines
in `beginTwoWay` before the cutaway opens.

→ **`await` is a window for the frame loop to run in.**

### The station ident was stepped on, exactly once
Routed secrets through `GNNDirector.interject()`, which queues.

→ **A non-repeatable bug is a race, not a mystery.**

### The STATUS plate idled
`icon-manager.js` returned the STATUS plate whenever a story matched no
keyword. Fixed by returning `null` on no match.

→ **A fallback becomes a default by accident.**

### Every caption pointed at the speaker's mouth
Moved to one slot (`STATION_BOX`, centred, bottom of the frame), tail removed.

### The commercial card measured with the wrong font
`drawBreakCard` called `ctx.measureText()` before setting `ctx.font`.

### The boot died on a paste
`icon-manager.js` was pasted with two `matchIcon` functions.

→ **When a one-file change produces a black screen, open the browser console
first.**

### The text box appeared one to two seconds before the voice
Deferred the whole swap. `present()` stores the caption in a `pending` slot
and leaves the previous caption on screen.

→ **The label is not the caption.**

### Two-way follow-up repeated the naming line
Split the ask pool into `INTRO`, `ASK`, `ASK_FOLLOWUP`.

→ **A name is spoken once per interview.**

### The station open read backward
`SHOW_OPEN` reordered to lead with "This is G N N"; `showOpen()` prepends the
anchor's name.

→ **A sign-on runs person, station, programme.**

### Wire headlines led with a broadcast label
Single regex in `cleanFeedText()`, anchored to the start of the string.

→ **The wire's filing labels are not the headline.**

### The main desk read markets
Removed `markets` from both `human` and `mrrshan_f`.

→ **A beat is a claim.**

### Yahoo Finance CORS and TLS fingerprint gate
Resolved via `/api/market` using `curl_cffi`.

### Stale browser profile cache in Chromium harness
Wipe `~/.cache/gnn-window` when testing static script changes.

### Booth ident play() interruption false alarm
Fixed in `js/tts.js`: on rejection, wait 400ms; if `audioEl.currentTime > 0`
and not paused, treat as Chromium false alarm.

### Ten studio sets desk line disparity
Each set's desk line was measured by eye via `tools/studio_review.html`,
recorded in `layout.json`, read dynamically by `renderer.js:drawCast()`.

### Dual-file transcript and universal subsystem logging
`gnn-transcript.log` and `gnn-server.log`, 250MB rotation, atomic `O_APPEND`.

---

## 4. Claims that did NOT reproduce

Do not re-chase these.

| Claim | Test | Result |
|---|---|---|
| Boot fires one TTS request per voice, `seq=0` | fresh log, one page load | **3 requests** |
| Extractor emits magenta transparency | 120 sampled assets scanned | **0** |
| Extractor emits rainbow palettes | sample + contact sheet by eye | **0**; ~8 scrambled items remain, flagged `noise > 95`, routed to glitch engine |
| Assets use a keyed transparency colour | check PNG mode | **40/40 RGBA** |
| Anchor filename collision blocks all desk work | checked against `main.js` load paths | **Already fixed.** §3 records the fix |
| Voice IDs in `main.js` / `cast.js` are edge-tts IDs | checked ID format | **0** — they are Kokoro IDs |
| `SHIPS` palette 3 is correct | community `liblbx` data | **Wrong.** Community says 12 with override 49. Verified against reference hashes. |
| Varr signed off "with Commander Hale" on the Varr/Vance show | owner's browser log, 18:30 close | **Misheard.** `showClose()` read the seated pair; the line named Commander Vance. Both human anchors carry the title. |

The `seq=0` burst in old logs is `tools/voice_audition.py`.

---

## 5. Tools

| command | does |
|---|---|
| `./start.sh [--bg]` / `./stop.sh` | on/off air |
| `python3 tools/verify_assets.py` | every runtime asset path resolves locally |
| `python3 tools/drive.py 90 /tmp/run` | drives the broadcast over CDP |
| `python3 tools/audio_probe.py 110` | clip count and level-relative pop detection |
| `python3 tools/extract_all.py` | re-decode MoO1 archives (~24 s) |
| `python3 tools/extract_moo2.py` | re-decode MoO2 archives; four-layer palette priority (see `tools/PROJECT.md` §4) |
| `python3 tools/extract_moo2_text.py` | MoO2 NUL-delimited string tables → JSON/TXT |
| `python3 tools/merge_moo2_manifests.py` | fold per-archive MoO2 manifests into `assets/gfx-manifest.json` |
| `python3 tools/palette_compare.py <ARCHIVE> --item N` | render one MoO2 sprite against every FONTS palette |
| `python3 tools/palette_review.py` | **settle per-item palettes by eye**: page of pooled outliers, each showing the on-air frame then every FONTS/IFONTS palette; `--apply picks.json` writes `_item_palettes`; `--archive X` reviews a whole archive |
| `python3 tools/palette_fit.py --scan` | items whose palette-index range is unlike their siblings'. A review queue, **not** a palette picker — `--validate` records why |
| `python3 tools/palette_survey.py` | survey every MoO2 archive across FONTS + IFONTS in one HTML page |
| `python3 tools/moo2_probe.py --archive X --item N` | byte-level LBX inspection |
| `python3 tools/scan_strays.py` / `scan_all.sh` | find unreferenced data in LBX gaps |
| `python3 tools/extract_text.py` | MoO1 text → `assets/moo-strings.json` |
| `python3 tools/build_audio.py` | SFX profiling + MIDI→OGG |
| `python3 tools/condition_plates.py` | generated art → 256-colour plates at draw size |
| `python3 tools/prompt_bridge.py` | regenerate `assets/generated/prompts.md` |
| `python3 tools/voice_audition.py` | audition every voice the running engine offers |
| `python3 tools/fix_listening.py [--preview] [--only a,b]` | give each listening plate the hero's body: turned head grafted onto the hero below the neck (or below the mouth where a mane hides it); originals kept in `_inbox/listening_before_fix/` |
| `python3 tools/capture_gallery.py [shot ...]` | re-shoot the README gallery (`docs/gallery/`) from the running station; `--list` names the shots. Replaces `capture_docs.py`, which hung on feed outages |
| `python3 trailer/record_takes.py [take ...]` | record trailer footage: canvas + master audio bus via in-page `MediaRecorder`, 1280x720 @ ~22 fps, into `trailer/build/takes/` |
| `python3 trailer/make_trailer.py` | cut the trailer from the takes, PIL cards and `build/vo/` narration over the MoO2 intro score, cuts timed to its lift (57 s), peak (80 s) and final hit (101 s) → `trailer/out/gnn_trailer.mp4`, −13 LUFS |
| `.venv/bin/python tools/pronounce_kokoro.py [--say WORD]` | audit `PRONOUNCE` against Kokoro and regenerate `js/pronounce-kokoro.js`; `--say` shows what Kokoro will say |
| `tools/scene_review.html` | recipe preview + deny-flag UI at `/tools/scene_review.html` |
| `tools/studio_review.html` | desk-line slider across all ten sets |
| `tools/interview_tuner.html` | slider tuning for the EMBASSY composition |
| `tools/show-editor.html` | editor for `assets/generated/show-config.json` |
| `assets/generated/Prompts/` | consolidated prompt library |

`tools/lbx.py` is the LBX container + LBXGFX decoder for both games.
`tools/PROJECT.md` is the full asset-pipeline source of truth.
`tools/tests/README.md` describes the diagnostic harness.

---

## 6. Environment

- `.venv` is **Python 3.12**, not the system 3.14: Kokoro's phonemiser
  (`spacy` → `thinc` → `blis`) has no 3.14 wheels, and Arch refuses system-wide
  pip under PEP 668. `start.sh` prefers `.venv/bin/python`.
- Torch in the venv is **CPU-only** and deliberately so.
- `Master of Orion 1/` is gitignored and only needed by the extractors.
  Extracted assets under `assets/cutscenes/`, `assets/audio/`, `assets/icons/`,
  `assets/text/` are also gitignored — see §7.

---

## 7. Known open items

This section is reconciled with the code and commit history through 2026-10-20 (`82f6949`). It separates implementation status from work that still requires the local game archives, visual comparison, or an on-air run. This documentation review did not rerun those live checks.

### Open — asset pipeline

- **Per-item palettes need the owner's eye.** `python3 tools/palette_review.py`
  builds the review page (74 rows: pooled items whose palette-index range is
  unlike their siblings', where a pick can change the result). Apply with
  `--apply palette-picks.json`, then re-extract the archives it names and
  re-run `merge_moo2_manifests.py`. Known bad on air before review: none
  confirmed — the first suspect, `CMBTPLNT/item_30`, rendered green only in
  an isolated preview and is fine on disk (29 colours). Do not trust any
  automatic palette pick; see §3.
- **The outlier list over-flags.** `docs/palette-outliers.txt` lists 497 items
  across 40 archives. SHIPS (42) and the BLDG archives are mostly race- or
  building-coloured variety, not wrong palettes. It is a review queue.
- **MoO1 palettes are out of scope for the review tool.** MoO1 items carry
  their archive's own palette, not FONTS/IFONTS. The known MoO1 colour faults
  are the COLONIES pair below and the COUNCIL archive (denied wholesale).
- **Uncatalogued MoO2 archives** (BEAMS, FLEET, FLTICONS, RACES, RACEOPT,
  DIPLOMAT, APP_PICS — see `tools/PROJECT.md` §4.5) still use first-pass
  picks. `palette_review.py --archive NAME` reviews one whole archive.
- **Fresh clones must extract before `./start.sh`.** `assets/cutscenes/`,
  `assets/audio/`, `assets/icons/`, `assets/text/` are gitignored; the repo
  ships the pipeline, not its output. `tools/PROJECT.md` §6 has the order.
- **`js/cast.js`'s `robot` entry needs a review** — the profile still reads
  as MoO1-lineage. He is seated in five shows (`show-config.json`).

### Open — runtime

- **Generated art still unused**: 18 standing figures and five logos.
  ROADMAP §5 lists where each belongs.
- **Weather cutaway visual check remains.** The `weather_map` and `weather_map_02` assets are committed and routed through the `weather` cutaway pool (2026-10-20). Inspect output at its on-air size and confirm conditioning/appearance; do not treat the route landing as proof of visual quality.

- **Two COLONIES items decode with a scattered-pixel sky** (`item_02`,
  `item_03`), excluded by `COLONIES_SCRAMBLED` in `scene-compositor.js`.
- **The MoO1 composite cutaways remain the fallback** when a story's route
  has no generated plate.
- **Title-card prompts are not right yet**; fallback is one `_standing.png`
  per character over a set plate.
- **`assets/generated/icons/` is partially populated.**
- ~~`capture_docs.py` hangs on 429s~~ — retired for `capture_gallery.py`,
  which drives the director instead; the old file was deleted 2026-10-18.
- ~~`calculateImportance()` suspect regex~~ — checked 2026-10-18: correct;
  whole words only (WAR not WARMING), repeats capped at two.

### Closed — previous verification retained

- MoO2 items carry pools: 61 broll, 609 sprite, 83 portrait, 142 chrome.
- `GNNCutsceneManager.openDebate()` is wired (`beginDebate`, `DEBATE_BLOCKS`).
- `main.js:init()` failure path calls `handleBootFailure()`, which sets
  `window.GNNBootReady`.
- `audio-engine.js:playMusic()` logs only on failure (missing entry, fetch,
  decode).
- MoO2 `SOUND.LBX` effects have an extractor and are merged into the audio manifest when local extraction output exists. The owner's generated manifest has reported 109 effects and 57 music beds, but the repository does not yet automate decoding/rendering all MoO2 music source formats; `build_audio.py` only indexes pre-rendered MoO2 OGGs already under `assets/audio/music/moo2/`.
- MoO2 text extracted and **loaded**: `asset-registry.js` fetches
  `assets/moo2-strings.json`.
- MoO2 video extracted (nine cinematics); 33 vetted segments are routed full-screen by `cutscene-manager.js`. Additional unused segments still need selection/quality review (ROADMAP §5).
- `_palette_overrides` is loaded and applied by `extract_moo2.py`.
- `BACKGRND/item_32` no longer reaches broll: no BACKGRND item is in the pool.
- The duplicate-manifest defect is fixed: 342 keys and 0 duplicate ids. The exact item total still needs a fresh local manifest/verifier comparison because the available docs report 7,374 and 7,375.
- `key_robot.py`, the robot cels and their checks are retired; the renderer's
  `person.frames` branch had already gone.
- README's cast badge reads 14.
- `verify_assets.py` passes clean.

### Lessons that keep needing to be relearned

- **Validate a metric against known answers before it gets an opinion.**
  Pupil centroid, diff percentage, desk detection, head-graft alignment, ramp
  smoothness, shuffle-normalised ramp smoothness: every one looked principled
  and every one contradicted the eye or the known answer. Show a picture.
- **Listen by ear before declaring audio done.**
- **MediaPipe will not rig this cast** — 3 of 11 detect.
- **rss2json has a DAILY cap.** Check it before debugging the feed code.
- **Voice choice is subjective.** Owner's standing judgement: Ryan and the
  older generation held pace. Default prosody is flat.
- `RENDER_FPS` is **20**, not 10.

### Process rules

- **Never put a process pattern in the same command as the text it matches.**
- **`pgrep -f <pattern>` matches the shell that is running the check.**
- **Do not run `./stop.sh` while a CDP probe is running.**

### Notes

- Decoded SFX buffers are never evicted — bounded by the library size.
- Music beds are LRU-capped at 4.

---

## 8. Where the MoO2 work is documented

The MoO2 pipeline is documented in three places, each with a different
audience:

- **`tools/PROJECT.md`** — the full format specification (MoO1 delta
  encoding, MoO2 command-stream grammar, palette hierarchy), the four-layer
  palette map, community source attribution, and the extraction order. This
  is where a cold reader should start.
- **`tools/PROJECT.md` §4** — the specific palette assignments and where
  each came from. Marks which are community-documented and which are our
  visual-inspection candidates.
- **`assets/README.md`** — the LBX container format and the manifest schema.

The external sources, in order of authority:

1. **`liblbx` `moo2-data.txt`** (`github.com/MarcoKull/liblbx`,
   `doc/txt/moo2-data.txt`) — palette assignments, item-range splits,
   override chains, reference output hashes.
2. **Wolverine's 2007–2008 Orion Nebula research** — COUNCIL override rule,
   SHIPS palette-holder mechanism.
3. **The Master of Orion II Online blog** repost of the graphics-format
   write-up (`masteroforion2.blogspot.com`).

None of them cover the whole library. Do not assume an unlisted archive has
a documented palette — check `tools/PROJECT.md` §4.5 first.

---

## 9. Fix Notes — Commercial Break Announcer & Monitor Black Background (2026-10-17)

### 9.1 Commercial Break TTS Announcer Cut Off Mid-Sentence

- **The Problem**: During commercial breaks, the commercial announcer voice was frequently cut off mid-sentence, followed by anchors and remaining commercial shots speaking over each other in an overlapping dialogue collision.
- **Root Cause**:
  1. In `js/broadcast-director.js:beginBreak()`, the loop waiting for the commercial break to finish had a hardcoded limit:
     `for (let i = 0; i < 400 && GNNCutsceneManager.isBreakActive(); i++) await new Promise((r) => setTimeout(r, 150));`
     `400 * 150 ms = 60,000 ms = 60.0 seconds`.
  2. Commercial breaks were upgraded to pods of 2–3 spots (12–16+ shots), typically running 75–110s+. At exactly 60 seconds (around shot 10–12), `beginBreak()` reached iteration 400 and exited while the break was still actively playing.
  3. `beginBreak()` immediately called `say(back)` with `beginHold(..., S.READ)`. `say(back)` pumped `GNNTTS.speak()` for the returning anchor. Because `GNNTTS.speak()` calls `cutElement()` and `resolveNow()` on new speech requests, it terminated the commercial announcer's in-flight sentence instantly.
  4. Simultaneously, `GNNCutsceneManager` was still running its remaining commercial shots, each firing `onBeat()` -> `GNNTTS.speak()`, which then cut off the anchor's signoff, creating a cascading speech battle.
  5. In `js/cutscene-manager.js:advanceShot()`, the `spoken` promise from `onBeat` lacked a `.catch()` rejection handler.
  6. In `js/cutscene-manager.js:update()`, `held >= shot.maxHold` did not check if Kokoro was still speaking, allowing `maxHold` to clip shots if TTS synthesis ran slightly long.
- **What Was Changed**:
  1. In `js/broadcast-director.js:beginBreak()`:
     - Replaced the fixed 400-iteration (60s) loop with a dynamic timeout: `const breakTimeout = Math.max(total * 2.5 + 30000, 180000);` that loops on `while (GNNCutsceneManager.isBreakActive())`. If the watchdog timeout is ever exceeded, it cleanly aborts via `GNNCutsceneManager.abortBreak()`.
     - After `isBreakActive()` clears, added an explicit audio-drain wait: `while (typeof GNNTTS !== 'undefined' && GNNTTS.isSpeaking && GNNTTS.isSpeaking() && performance.now() < speechTimeout) setTimeout(r, 100);` followed by 100 ms of room air before `say(back)` queues the anchor's return. *(This said 300 ms; the code has always waited 100.)*
  2. In `js/cutscene-manager.js`:
     - Added `.catch(() => { shot.voiceDone = true; })` to the `onBeat` promise in `advanceShot()`.
     - In `update()`, guarded `held >= shot.maxHold` with `(!isSpeaking || held >= shot.maxHold + 12000)` so active speech is never truncated by standard max hold timeouts.

---

### 9.2 Correspondent Monitor Window (PIP) Black Background

- **The Problem**: When the two seated anchors brought in a field correspondent through the over-the-shoulder monitor window (`openTwoWay` / `correspondentScene`), a pitch-black background plate was occasionally selected.
- **Root Cause**:
  1. `correspondentScene(sid, kind)` in `js/cutscene-manager.js` resolves backdrops from `GENERATED[kind]`.
  2. For `kind === 'tactical'`, `GENERATED.tactical` listed `planet_invasion_03`.
  3. Inspecting `assets/generated/cutaways/planet_invasion_03.png`, it was a corrupted 23 KB unconditioned file (1792x1024, RGB, only 86 colors, mean pixel brightness ~34 with near-zero blacks). When dimmed with `alpha: 0.55` per the correspondent composite rules, it rendered as an empty black void behind the correspondent.
- **What Was Changed**:
  1. In `js/cutscene-manager.js`: Removed `'planet_invasion_03'` from `GENERATED.tactical`.
  2. Replaced `assets/generated/cutaways/planet_invasion_03.png` with a newly generated, properly conditioned 1280x720 RGBA 256-color median-cut plate (1.2 MB, mean RGB [76, 81, 97]), matching the prompt library (`assets/generated/Prompts/PIP_Cutaway_prompts.md`) and project art direction rules. Any legacy or future reference will render a vibrant tactical battle scene instead of black void.

---

## 10. Full Project Review & Bug Audit

*Comprehensive audit of the GNN codebase across director state machine, audio subsystem, asset pipeline, feed management, and rendering. (No code modifications made for this section).*

> **Status, checked 2026-10-18.** Every item was run against the code.
> | Item | Verdict |
> |---|---|
> | 10.1.1 skip mid-break | real — fixed (§14) |
> | 10.1.2 stale `speechDeadline` | real — fixed (§14) |
> | 10.1.3 copy-pasted comment | real — removed |
> | 10.2.1 unanchored ramp | real — fixed (§14) |
> | 10.2.2 audio element re-created | **not real**: `cutElement()` clears the source of the one element; nothing is re-created |
> | 10.2.3 prefetch contention | real, and worse than stated — the browser's six-connection limit (§14) |
> | 10.3.1 Atom `rel="self"` | **wrong cause**: links are read per entry, never the feed's. The real risk, an entry's first link not being the article, is fixed |
> | 10.3.2 `dirtyKeys` unbounded | **not real**: a set of ledger keys cannot outgrow the ledger |
> | 10.4.1 no ellipsis | real — fixed |
> | 10.4.2 debate PIP coordinates | real in principle; **no overlap in practice** — a debate opened on both debate sets (crossfire, council_hour) puts the monitors in the top corners, clear of the pair. Re-check if debates move to another set |
> | 10.5.1 overwritten extractor | real — the merge script had been saved over `extract_moo2_text.py`; restored from git, the merge kept in `merge_moo2_text.py` |
> | 10.5.2 missing `sys.path` | **wrong cause**: `test_moo2_tools.py` *had* the line; it pointed one directory short (`tools/tools`). Fixed, and the fixtures rebuilt on the decoder's real grammar — 11/11 pass |

### 10.1 Broadcast Director & State Machine (`js/broadcast-director.js`)
1. **`skip()` during commercial break race condition**:
   In `skip()` (line 2471), if `state === S.BREAK`, `skip()` aborts the break and immediately calls `nextStory(now)`, transitioning to `S.READ`. However, the background `beginBreak()` coroutine was suspended in `while (GNNCutsceneManager.isBreakActive())`. As soon as `abortBreak()` clears `breakState`, `beginBreak()` wakes up, waits out speech, calls `say(back)` ("we now return you to regular orbital programming"), and sets state to `S.HOLD` -> `S.READ`. This causes the return-from-break signoff to play over the beginning of the newly skipped story.
   - *Recommendation*: In `beginBreak()`, check `if (state !== S.BREAK) return;` immediately after the break-active while loop to cleanly abandon the continuation if `skip()` preempted it.
2. **Stale `speechDeadline` retention in `cancelSpeech()`**:
   In `cancelSpeech()` (line 879), `speechToken` increments, `speechQueue` is cleared, and `speaking = false`. But `speechDeadline` is left untouched (unlike in `checkSpeechWatchdog`). When a subsequent line calls `say()`, `speechDeadline = Math.max(speechDeadline, performance.now() + waiting * 2.4 + 8000)` will inherit an old deadline that may be far in the future from a previously cancelled long sequence.
   - *Recommendation*: Add `speechDeadline = 0;` inside `cancelSpeech()`.
3. **Stale copy-paste comment in `handoffColdOpen()`**:
   Lines 2518–2520 inside `handoffColdOpen()` contain comments stating "No plate for this correspondent on disk, or a break is active. Do not queue the lines — the caller falls through to a normal banter beat instead", erroneously copied from `beginTwoWay`.

### 10.2 Audio Engine & TTS Pipeline (`js/audio-engine.js`, `js/tts.js`, `server.py`)
1. **Unanchored Web Audio ramp in `playMusic()`**:
   In `audio-engine.js:playMusic()` (line 556), `g.gain.linearRampToValueAtTime(..., ctx.currentTime + fadeIn)` is scheduled without calling `g.gain.setValueAtTime(0.0001, ctx.currentTime)` first. Under the W3C Web Audio specification, if no prior automation event exists on the AudioParam at `currentTime`, the starting value for `linearRampToValueAtTime` is implementation-defined and can cause audible step pops on start (in violation of Architecture Constraint 8).
   - *Recommendation*: Insert `g.gain.setValueAtTime(0.0001, ctx.currentTime);` before the linear ramp.
2. **Audio element rapid re-creation on short phrase overlap**:
   In `js/tts.js:speak()` (line 862), `el.onended` waits `TAIL_MS` (240ms) before invoking `finish('onended')`. If an interjection or rapid line arrives during this 240ms tail, `cutElement()` immediately tears down the audio element and creates a new one, causing DOM churn.
3. **Pre-fetch queue concurrency in `server.py`**:
   `handle_tts` serializes all synthesis under `_tts_lock`. When a commercial break prefetches 15 shots simultaneously (`seq=0`), each request waits in a busy-poll loop (`_tts_lock.acquire(timeout=0.2)`). If a live `speak()` (`seq > 0`) is issued during this prefetch storm, it must queue behind all pending prefetch acquisitions.

### 10.3 Feed Ingestion & Story Deduplication (`js/feed-manager.js`)
1. **Atom `<link>` extraction selecting `rel="self"` instead of article URL**:
   In `fetchFeed()` (line 669), `item.getElementsByTagName('link')[0]` picks the first `<link>` element. In Atom feeds (e.g. Ars Technica or Nature), `<link rel="self" href="...feed.xml" />` frequently precedes `<link rel="alternate" href="...article.html" />`. As a result, `link` gets set to the feed XML endpoint rather than the article page, corrupting story source attribution.
   - *Recommendation*: Look for `link[rel="alternate"]` before falling back to `[0]`.
2. **Unbounded `dirtyKeys` accumulation on persistent offline/error**:
   If `/api/news-ledger` fails (e.g. server down or read-only filesystem), `persistLedger()` catches the error, but `dirtyKeys` is never trimmed and continues to grow indefinitely over days of runtime.

### 10.4 Rendering, UI & Cutscenes (`js/renderer.js`, `js/cutscene-manager.js`)
1. **`wrapLines()` text truncation without ellipsis**:
   In `js/cutscene-manager.js:wrapLines()` (line 2487), when lines exceed `max`, the function returns `out` immediately. Long commercial legal disclaimers or multi-line product claims simply stop mid-word without an ellipsis (`…`), making the caption text look accidentally clipped.
2. **Hardcoded coordinates in dual-PIP debate layout**:
   In `js/cutscene-manager.js:render()` (lines 2331–2332), `PIP_L` and `PIP_R` use hardcoded relative constants (`x: 0.045`, `x: 0.755`). Unlike the single PIP monitor, they do not account for set-specific desk lines or custom studio monitor frames, which can lead to overlap with certain wide studio set desks.

### 10.5 Testing & Verification Suite (`tools/tests/`)
1. **`test_moo2_tools.py` broken imports**:
   `tools/tests/test_moo2_tools.py` attempts `from extract_moo2_text import split_nul_strings`. However, `extract_moo2_text.py` was previously overwritten with `merge_moo2_text.py`, removing `split_nul_strings`. Running the test suite currently fails with `ImportError`.
2. **Missing `sys.path` injection in test runners**:
   Several test scripts in `tools/tests/` assume `tools/` is already in Python's import path. Running them directly with `python3 tools/tests/<script>.py` results in `ModuleNotFoundError: No module named 'lbx'`.
   - *Recommendation*: Add `sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))` at the top of test scripts.

---

## 11. Pronunciation System Restoration: "Convoy" & Trap Overrides

### 11.1 The Problem
TTS mispronounced "Convoy" as `/kənˈvɔɪ/` (stressed on the second syllable like *convey*, audible inside sponsor copy and commercial beats).
It was previously fixed in `PRONOUNCE` in `js/tts.js` using `[/\bconvoys\b/gi, 'KAHN-voys']` and `[/\bconvoy\b/gi, 'KAHN-voy']`.
However, when the new Kokoro pronunciation audit system was introduced (`tools/pronounce_kokoro.py` -> `js/pronounce-kokoro.js`), Kokoro started mispronouncing "Convoy" again.

### 11.2 Root Cause
1. `tools/pronounce_kokoro.py:decide()` automatically audited all rules in `PRONOUNCE`. For any capitalized respelling (`capped = True`), it queried Kokoro's G2P dictionary:
   ```python
   raw, ratings = g2p(plain)
   if ratings and all(r is not None and r >= 3 for r in ratings):
       return 'drop', 'dictionary: ' + raw
   ```
2. Because misaki / CMUDict has an entry for `convoy` (`kˈɑnvˌY`) with rating 4, `decide()` decided that Kokoro did not need the rule and marked it `'drop'`.
3. In `js/pronounce-kokoro.js`, `"\\bconvoy\\b/gi": "drop"` and `"\\bconvoys\\b/gi": "drop"` caused `kokoroTable()` in `js/tts.js` to skip the rules entirely (`if (a === 'drop') continue;`).
4. Without the rule, Kokoro received the unadjusted word "convoy" and applied its default phonetic dictionary (`kˈɑnvˌY`). The secondary stress `ˌ` on the second syllable caused the neural acoustic model to give prominence to "-voy", reverting the spoken word back to the exact mispronunciation the original fix was written to prevent.
5. Other trap entries from the same block (such as unaccented `Reykjavik`, which Kokoro's dictionary had with a `ʤ` "j" sound as `ɹˈAkʤəvˌɪk`, and `corvette`) were also dropped.

### 11.3 What Was Changed
1. **Added to `OVERRIDES` in `tools/pronounce_kokoro.py`**:
   - `'convoy': 'kˈɑnvY'` (forces primary stress on first syllable `ˈɑ` with no secondary stress on second syllable, producing "KAHN-voy").
   - `'convoys': 'kˈɑnvYz'`
   - `'corvette': 'kɔɹˈvɛt'` (ensures stress on "-VET")
   - `'Reykjavik': 'ˈɹAkjəvik'` and `'Reykjavík': 'ˈɹAkjəvik'` (fixes unaccented news feed spelling to match the Icelandic pronunciation with `j` rather than `ʤ`).
2. **Case-insensitive matching in `decide()`**:
   Updated `decide()` to inspect `OVERRIDES` with `key`, `key.lower()`, and `key.capitalize()`.
3. **Regenerated `js/pronounce-kokoro.js`**:
   Ran `.venv/bin/python tools/pronounce_kokoro.py`. The generated table now maps:
   - `\bconvoy\b/gi` -> `{"ipa": "kˈɑnvY"}`
   - `\bconvoys\b/gi` -> `{"ipa": "kˈɑnvYz"}`
   - `\bcorvette\b/gi` -> `{"ipa": "kɔɹˈvɛt"}`
   - `\bReykjavik\b/gi` -> `{"ipa": "ˈɹAkjəvik"}`
4. **Verified Multi-Engine Compatibility**:
   - **Kokoro (local)**: `respellKokoro` wraps the word in misaki inline markup (`[convoy](/kˈɑnvY/)`, `[convoys](/kˈɑnvYz/)`), synthesizing the correct pronunciation locally without DOM/teleprompter letter exposure.
   - **Cloud / Edge-TTS / Web Speech (fallback)**: `respell` continues to use `PRONOUNCE` directly (`KAHN-voy`, `KAHN-voys`), and `server.py` strips any misaki markup before handing text to a cloud voice.

→ **A dictionary hit is not a correct pronunciation.** Dropping a pronunciation rule just because misaki/CMUDict has a rating $\ge 3$ breaks deliberate pronunciation fixes where the dictionary stress or phoneme choice is wrong (like `convoy`'s secondary stress dragging on "voy" or `Reykjavik`'s `ʤ`). Use `OVERRIDES` in `tools/pronounce_kokoro.py` for any word whose dictionary entry sounds wrong on air.

---

## 12. Fix: "Who" Spelled Out as "W H O" in Questions & Commercial Hooks

### 12.1 The Problem
During commercial breaks (and anchor banter), TTS spelled out the English question word "Who" letter-by-letter as "W H O" ("Double-you Aitch Oh is watching your colony tonight?").

### 12.2 Root Cause
In `js/tts.js`, `PRONOUNCE` contained an overly aggressive regex meant to catch the World Health Organization in title-cased headlines:
```javascript
[/\bWho(?=\s+(?:says|said|warns|warned|reports|reported|announces|announced|confirms|confirmed|urges|urged|calls|called|estimates|estimated|finds|found|declares|declared|has|is|was|will|expects|expected|backs|backed|criticizes|criticised|criticizes|criticized|raises|raised|links|linked|advises|advised)\b)/g, 'W H O'],
```
Because the lookahead included common verbs (`is`, `was`, `will`, `has`, `says`, `calls`), ANY English question beginning with "Who" + verb matched:
- Darlok commercial hook: `"Who is watching your colony tonight?"` $\rightarrow$ `"W H O is watching your colony tonight?"`
- Anchor banter: `"Who is saying that, exactly?"` $\rightarrow$ `"W H O is saying that, exactly?"`

### 12.3 What Was Changed
1. **Removed the lookahead rule** from `PRONOUNCE` in `js/tts.js`. All-caps `WHO` continues to be properly expanded to `W H O` by `[/\bWHO\b/g, 'W H O']` (while `Doctor Who` remains protected by the rule preceding it).
2. **Cleaned up duplicate rules**: Removed two redundant duplicate copies of `[/\bWHO\b/g, 'W H O']`.
3. **Regenerated `js/pronounce-kokoro.js`**: Re-ran `.venv/bin/python tools/pronounce_kokoro.py` (rules: 289).
4. **Verified**:
   - `"Who is watching your colony tonight?"` $\rightarrow$ speaks `/hu/` ("Who").
   - `"Who is saying that, exactly?"` $\rightarrow$ speaks `/hu/` ("Who").
   - `"The WHO warns of a new surge."` $\rightarrow$ speaks `"W H O"`.
   - `"Doctor Who is on television."` $\rightarrow$ speaks `"Doctor Who"`.

→ **Never match sentence-initial question words as acronyms.** In English, "Who" followed by an auxiliary or reporting verb is an everyday interrogative pronoun ("Who is watching your colony tonight?", "Who said that?"). Acronyms like the World Health Organization arrive in all-caps (`WHO`).

---

## 13. System Fixes: Pronunciation, Pacing, Show Transitions & Cutscenes

### 13.1 "Who" Spoken Letter-by-Letter in Stories & Uppercase Headlines
- **The Problem**: Normal words "who" in stories and news headlines (e.g. `"Attackers who took control..."`, `"Negotiators who met in Doha"`) were still being pronounced letter-by-letter as "W H O".
- **Root Cause**: In `js/tts.js`, `'WHO'` was present in `SPELLED_OUT`. When uppercase RSS headlines passed through `unshout(text)`, `SPELLED_OUT.has(letters)` was evaluated before `COMMON_SHORT.has(letters)`. Shouted `WHO` was preserved in all-caps, and `PRONOUNCE`'s `[/\bWHO\b/g, 'W H O']` subsequently converted every uppercase occurrence to "W H O".
- **What Was Changed**:
  1. Removed `'WHO'` from `SPELLED_OUT` in `js/tts.js`. `COMMON_SHORT` already contains `'WHO'` and converts all-caps headlines into standard mixed case ("Who").
  2. Scoped the `WHO` pronunciation rule in `PRONOUNCE` so it only matches references to the health organization: `[/\b([Tt]he\s+)?W\.H\.O\.(?:\b|\s|$)/gi, (m, the) => (the ? the : '') + 'W H O ']`, `[/\b([Tt]he\s+)who\b/gi, '$1W H O']`, and contextual verbs/roles (`who director|chief|head|panel|report|reports|reported|warning|warns|health|pandemic|emergency`). Ordinary relative clauses and question words remain un-tampered.

### 13.2 "vs" in News Stories Pronounced as "Vee S" Instead of "Versus"
- **The Problem**: Matchups like `<team> vs <team>`, `<product> vs. <product>`, or legal case citations in news stories were read by TTS as "vee s" ("vee ess").
- **Root Cause**: Neither `js/tts.js` nor the Kokoro dictionary expanded standalone "vs" or "vs.". In uppercase headlines, `unshout()` did not recognize `VS` as a common word and left it capitalized, which the phonemizer spelled out as letters.
- **What Was Changed**:
  1. Added `'VS'` to `COMMON_SHORT` in `js/tts.js`.
  2. Added pronunciation rules to `PRONOUNCE`: `[/\bvs(?:\.|\b)/gi, 'versus']` and `[/\bv\.\s+(?=[A-Z])/gi, 'versus ']`.
  3. Regenerated `js/pronounce-kokoro.js`. All engines (Kokoro local, cloud, and browser fallback) now pronounce "vs" cleanly as "versus" (`/vˈɜɹsəs/`).

### 13.3 Station Ident Pause Regression (~2.7s Dead Air)
- **The Problem**: After an anchor delivered a station ident (e.g., "You are watching G N N. The relay never sleeps."), a long ~2.7-second pause / dead air occurred before the other anchor started reading the next story.
- **Root Cause**:
  1. `beginIdent()` in `js/broadcast-director.js` played the 3.6-second station ident without prefetching the upcoming story during playback.
  2. In `nextStory()`, `GNNTTS.prefetch()` was called without specifying a voice, defaulting to the currently active seat (Chair 1). But `nextStory()` immediately called `passChair()` to alternate anchors, assigning the upcoming story to Chair 2 (`af_bella`). Chair 2 encountered a complete cache miss, requiring a cold 2.2-second Kokoro synthesis.
  3. When Story #25 started synthesizing cold, line 1629 in `nextStory()` fired an uncoordinated prefetch for Story #26, causing HTTP requests to contend for `_tts_lock` in `server.py`.
- **What Was Changed**:
  1. Created `nextStorySpeaker()` and `prefetchUpcomingStory()` in `js/broadcast-director.js`. It inspects the next seat in the rotation (`(seatIndex + 1) % n`) and passes `{ voice: nextSpeaker.voice }` directly to `GNNTTS.prefetch()`.
  2. Hooked `prefetchUpcomingStory()` into `beginIdent()`, `beginToss()`, `beginStructuredBeat()`, `beginExchange()`, `beginColdOpen()`, and `nextStory()`. Upcoming stories are pre-warmed during preceding speech beats, resulting in instant cache hits and zero dead air.

### 13.4 Show Transition Studio Glitch (Old Studio Appearing for Split Second)
- **The Problem**: When a show signed off and the between-show title card appeared, transitioning from the card to the next show momentarily flashed ~1 second of the previous show's studio and signed-off anchors before snapping to the new show.
- **Root Cause**:
  1. When a show signed off and entered `S.HOLD`, `blockIndex` in `js/broadcast-director.js` had not yet advanced to the incoming show (it was only advanced inside `beginColdOpen()`).
  2. When `window.GNNBumper.play()` ran in `js/main.js`, `GNNDirector.getShowInfo()` returned the *old* show block. Line 1155 called `GNNRenderer.setShowBlock(oldBlock)`, resetting the canvas to the old show's set and anchors.
  3. When the title card overlay faded out, it revealed the old studio underneath. Only when `handoffColdOpen()` subsequently executed `beginColdOpen()` did `blockIndex` advance and swap the renderer to the new studio.
  4. Additionally, line 2286 in `broadcast-director.js` checked `blockIndex > 0`, causing transitions to block 0 (wrapping around to the first show) to bypass the bumper entirely.
- **What Was Changed**:
  1. Added `nextBlockIndex()` helper in `js/broadcast-director.js` to determine the upcoming show slot.
  2. In `update()`, before delegating to `window.GNNBumper.play()`, `blockIndex` is advanced to `nextBlockIndex()`, setting `incomingBlockSet = true`.
  3. Changed `blockIndex > 0` to `firstColdOpenDone` so wrap-around transitions to block 0 also run through the bumper.
  4. In `js/main.js`, `playShowBumper()` now receives the incoming show info immediately, loads the incoming show's title card, and calls `GNNRenderer.setShowBlock()` for the *incoming* show while the overlay is 100% opaque. When the overlay fades out, the new studio is already in place with zero flash of old anchors.

### 13.5 Commercial Cutscene Animation Hard Cut / Pausing on Last Frame

> **Partly reversed in §14.** Capping `duration` below the animation's length was applied to *every* animated shot, not just MoO2 footage — so MoO1 animations with an ending (the intro's missile battery) were cut before their payoff. It now applies to `scene.cinematic` only, and `animEnding` is gone.
- **The Problem**: Commercials using cinematic cutscene animations (MoO1/MoO2 clips) hard cut and sat frozen/paused on their last frame for a split second before transitioning to the next beat.
- **Root Cause**:
  1. In `js/cutscene-manager.js:CINEMATICS`, several clip segments had very narrow frame ranges (e.g. `intro` 645 to 656 = 12 frames / 1.6s; `anatkfin` 6 to 27 = 22 frames / 2.9s; `loserfin` 1 to 29 = 29 frames / 3.8s).
  2. `footageShot(beat)` clamped `maxFrames` to 34 (only 4.5s of video).
  3. `buildCommercialShot()` set shot duration to `Math.max(baseDuration, animMs)`. When an animation ran out of frames before `duration` or before voice-over finished, `drawGeneratedScene()` clamped to `layer.frames.length - 1`, freezing the screen on the last frame until the shot expired.
- **What Was Changed**:
  1. Expanded all `CINEMATICS` clip segments to full 50–115 frame windows (6.5s to 15s of continuous action) and removed ultra-short <35-frame snippets.
  2. Increased `footageShot()`'s `maxFrames` from 34 to 60 frames (8.0s of continuous playback).
  3. In `buildCommercialShot()`, capped `duration` for animated scenes to `animMs - 400` so commercial beats transition smoothly while footage is still actively in motion.
  4. In `update()`, added an `animEnding` check (`animMs > 0 && held >= animMs - 300`) so that if an animation ever reaches its final frames and voice-over is completed, `advanceShot(now)` triggers immediately rather than pausing on the frozen cel.

---

## 14. Commercial breaks, checked end to end (2026-10-17)

Gemini's §9 and §13 fixes were checked against a running break, not taken
on faith. `tools/tests/breakcheck.py` (new) forces breaks and times every
seam from the media elements and the frame loop: toss → picture, picture →
first line, line → line, frozen animation tails, last line → desk, cut
lines, frame stalls. `tools/tests/breakedges.py` (new) covers skip and a
secret during a break, and a show promo's content. Both take `GNN_URL`.

The ordinary path was already clean: 0 cut lines, ~0.33 s between
announcer lines, one return to the desk. What was wrong:

- **Skip mid-break** read "we now return you…" over the skipped-to story:
  `beginBreak()` woke on the abort. It returns if the state left `BREAK`.
  A forced break while one is on screen is refused (two continuations).
- **A secret typed mid-break** cut the announcer off: the pump spoke
  straight over `GNNTTS`. The pump waits while a break is active.
- **Dead air before the first spot** (0.3–3.3 s, worst on the footage
  look): a break was assembled only after the toss. `prepareBreak()` runs
  during the toss; `startCommercialBreak(now, { prepared })` starts it.
- **The first shot started seconds old**: the director's `now` predated the
  toss, so an animated ident opened on its last frame. The break reads the
  clock itself.
- **A line up to 6 s late** — first the break's opening line, then, once
  prefetch moved earlier, the anchor's toss. The cause was in the browser:
  a break prefetched 16 lines at once and Chromium allows six connections
  to a host, so a live line waited *in the browser* behind lines needed a
  minute later. `GNNTTS.prefetch` now runs two at a time, in order, and a
  queued prefetch a live line needs is started at once. Measured after: toss
  request → audio 0.6–1.0 s (synthesis); first spot line on the picture's
  frame in 4 of 5 probed breaks. **Still open:** one in five waited 4.4 s —
  not yet traced; `breakcheck.py -v` on a run that shows it is the next step. Two contributing faults fixed on the way: the clip cache was 16
  entries FIFO, so a 16-line break could evict its own ident (48, LRU); and
  the server's TTS lock was polled, so waiters were served in no order (an
  ordered queue, `tts_enter`/`tts_exit`, live `seq > 0` ahead of prefetch).
  → **When a request is slow, find out whether it was even sent.**
- **Dissolve underlay jumped back**: the outgoing shot was redrawn at its
  planned `duration`, not when it actually left (`heldMs`).
- `cancelSpeech()` now clears `speechDeadline`; `playMusic()` anchors its
  ramp (§10 items 10.1.1, 10.1.2, 10.2.1, 10.2.3 — all real).

Owner requests handled in the same pass:

- **MoO archive look 10% → 20%**, and each archive spot carries one MoO1
  intro animation (`ARCHIVE_ANIMATIONS`): the missile battery
  (`INTRO/item_02`), the fleet (`INTRO2/item_00`, started past its ten
  black frames — still denied from random picks), the bombing run. Loaded
  whole: `makeLayer` stops at 60 frames and the battery fires at 53–61.
  Rarest spots raised: Gnolam's 7→10%, Marines 4→8%, from the generator.
- **Animations play to their end** (see §13.5 note); MoO2 footage still cuts
  while moving.
- **Show promos** air the show's title card and name its pair: "Join Varr
  and Commander Vance on The Evening Rim Report, for …" (`covers`, per show
  in `SHOW_PROMOS`; pair and card from `show-config.json` via
  `GNNScript.setShows`).
- **Product stills on more spots**, each pairing checked composited on its
  stage: Betelgeuse's three medicines (pill bottle), Sirius's drive, coil
  and nav core, Cybernetic Joint Replacement (servo arm), Final Expense
  (beacon, chapel altar), Precious Metals (watch), Hull Patch Kit (survival
  envelope), and generator hardware that a still reads as
  (`HARDWARE_STILLS`, on the pedestal). New slots for pharmacy, bridge,
  chapel, gold counter, hull corridor; the lab slot enlarged. The resorts
  stay product-free (owner). `sponsored()` picked its product twice.
- **`GENERIC_STAGES`** was every infomercial plate, so a shield was sold in
  the memorial chapel. Showrooms and working spaces only.
- **Break music**: `BREAK_BED_DENY` keeps the MoO2 cinematic soundtracks
  (`*FIN`, `intro`) out; `[GNN Commercial:Music] bed=` names each bed so a
  track with words can be added. A speech detector (syllable-rate
  modulation) was tried first and **failed validation**: MIDI tracks scored
  above real speech. It was not used.
- **The story-start click**: `playRole('blip')` had been called on every
  story for a long time, silently — no effect had the role until the MoO2
  merge. Removed.
- **Sport on non-sports shows**: Evening Rim and Galactic Spotlight drew
  the `sports` bucket, and the empty-show fallback borrowed from the
  fullest bucket (usually sport). `SEGREGATED_BUCKETS`; sport-feed URLs and
  more sport words in `targetShowFor`.
- **Every boot showed Hale and Varr first**: the renderer started on block 0
  and only the first cold open, after the boot card faded, moved it to the
  show on the clock. `runBootSequence()` seats the scheduled show under the
  card. Checked: Evening Rim's pair seated 1.6 s in, card fades at 22.9 s.
- **A test server on another port killed the station**: `server.py` wrote
  `.gnn-server.pid` whatever its port, so `./stop.sh` stopped the wrong
  process and `./start.sh` could report "already on air" with nothing on
  8080. Non-default ports use `.gnn-server-<port>.pid`. Run harness work
  against one with `GNN_URL=… GNN_CDP_PORT=9444` — `stop.sh` reaps 9333.
- **"gigabytes'S Morris"**: `GB`/`TB` expand only after a number.
- **Handbacks named a fixed partner**: fourteen lines across ten profiles
  ("Hale, what does the record tell us?" from Vance, who never sits with
  Hale). They write `{TO}` now, filled with the host (`addressName()`).
  The sign-off itself was right — see §4.

→ **A test that only drives the happy path cannot find the seams.** Every
break fault here was an interruption, a race or a cold cache.

---

## 15. While on air: content, pronunciation, space weather (2026-10-18)

Done with the station broadcasting — nothing restarted, nothing pointed at
port 8080. Verified offline as far as offline goes; the on-air checks are
listed in `docs/ROADMAP.md` §4.5.

### Nineteen of twenty-two pairs had no exchanges
Measured from the server log's spoken lines (533 lines, 384 distinct): the
lines a viewer would notice repeating were Varr and Vance's — one exchange
aired five or six times in an evening. `RELATIONSHIPS` in `cast.js` covered
3 of the 22 pairs the schedule seats (Morning Watch 13, Evening Rim 2,
Council Hour 2). For the other 19, `exchange()` returned null and banter
stitched one anchor's stock opener to the other's stock reaction.

86 exchanges added — four per uncovered pair, two each way, written to each
pair's show and characters; six more for the two thin pairs. Every line is a
habit or a principle, never a claim about the story just read, because they
air straight after real news. All 344 lines through the page's `sanitize()`
and misaki: no spelled-out words.

→ **A table that covers the pair you tested is not a table that covers the
schedule.** `tools/tests/content_check.py` now fails if any scheduled pair
lacks exchanges either way.

### Space weather had aired once, ever
`/api/spaceweather` served NOAA alerts as stories, but every item carried
the link `https://www.swpc.noaa.gov/`, and `findLedgerDuplicate()` treats a
shared canonical link as the same story. After the first, every NOAA item
was filed as a repeat: the ledger held one. Items now carry a `key` (the
alert's product id and issue time; the report's UTC date and quarter) and
are matched by it alone (`exactKey`). A current-conditions report — solar
wind, planetary K, R/S/G scales, the day's odds, the two-day outlook, all
published numbers — leads the list, one per UTC quarter-day, so a quiet day
still gives the weather desk a reading. Builder tested on live NOAA data and
a synthetic storm.

→ **Deduplication by link assumes one link per story.** A source with one
link for everything needs its own identity.

### Wire abbreviations
Kokoro read Mt. and Ft. as letters, Sen. as "sen", Gov. as "guv", Gen. as
"jen", Co. as "koh". Rules in `PRONOUNCE`, titles only with the full stop and
a name after (Amartya Sen untouched), both cases (unshout leaves MT/FT
capitalised); Co. becomes Company after a name and County before one; St.
becomes Street only when no name follows (St. Louis stays "saint"). Fifteen
headline shapes through `sanitize()` then misaki: every word rated 4. Grolm
added to `EXTRAS` — misaki dropped his L.

### `content_check.py`
Offline, exit-coded. Validated before trusted: a copy with the Night Desk's
exchanges removed, a promo title changed, sport added to Evening Rim and a
still renamed — all four caught, exit 1. On the real tree: PASS, and all 46
stages and stills the commercial code names are on disk.

---

## 16. Comments, tests, products, and what MoO2 was hiding (2026-10-18)

Still on air throughout; offline checks only (`tools/tests/offline.sh`, new:
PASS). The on-air checks are in `docs/ROADMAP.md` §4.5. How-to-work rules
drawn from all of this are in `CONTRIBUTING.md` (new).

### Products hovered over three of the shop sets
Owner: products not lining up with the infomercial backgrounds. Every
product still was composited onto the stage it airs on
(`tools/tests/productsheet.py`, new — 40 pairings). The jewellery,
expedition and home sets' slots were "estimates until the art exists", never
re-measured; and `compositeProduct()` centred a product vertically in its
slot, so anything short or wide left a gap underneath and floated anywhere.
Products now stand on the slot's bottom edge, and the three slots are
measured to each pedestal's top face. All 40 pairings re-checked.

→ **A placeholder in a comment is not a task.** Put it on the roadmap.

### Comments that described other code
A mechanical pass (comments naming missing functions or files, line
numbers, numeric claims, fix-list labels) and a reading of the commercial
and director paths found: `F5`–`F10` labels from a deleted fix list (two
different fixes were both "F8"); the `blockIndex`/`firstColdOpenDone`
comments describing the pre-96-slot behaviour, the opposite of today's; a
two-way comment copy-pasted into `handoffColdOpen()`; "420 ms" where the
constant is 240; a slot-table comment calling measured values estimates.
All rewritten to the code. No comment names a function that does not exist.

Reading `handoffColdOpen()` exposed a real edge: Skip during a show bumper
left `blockIndex` and the studio on the incoming show while the outgoing
show's stories read, and the next cold open skipped the incoming show. Skip
is ignored while a bumper hand-off is pending.

### The MoO2 tests and the overwritten extractor
`test_moo2_tools.py` could not import: its path was one directory short.
Past that, `extract_moo2_text.py` held the merge script's code (the real
extractor existed only in git), and the fixtures built MoO2 frames in the
grammar the decoder used before §3's rewrite. Extractor restored, merge
code kept in `merge_moo2_text.py`, fixtures rebuilt on the real grammar,
two call sites updated to the four-layer palette API: 11/11 pass.

### MoO2's own GNN, and its ambassadors
Contact sheets of the 48 MoO2 archives with nothing pooled. Two finds:

- **`EVENTS` is MoO2's Galactic News Network.** Item 1 is its newsroom — an
  android anchor, a GNN monitor — and items 2–37 the event pictures that
  monitor showed, GNN logo in the corner. Item 1 decoded in the wrong
  colours under all thirteen FONTS palettes; item 0 is its palette holder
  (`_item_overrides`). The pictures whose subject is certain now illustrate
  archive bulletins on the lore show (`icon-manager.js`,
  `GNN_EVENT_PICTURES`): 52 of the 75 MoO1 bulletins. Real stories keep the
  ordinary icons — checked.
- **`DIPLOMAT` is every race's ambassador as a hologram**, 32 frames each,
  in MoO2's alphabetical race order. All wrong colours: items 0–12 are
  thirteen palette holders, one per race pair. Mapped and re-extracted after
  checking all thirteen by eye.

Both archives are in-universe and GNN-branded, so both are now in
`STATIC_DENY`: the extractor's size classifier would otherwise pool 35 event
pictures as broll, and a real-news cutaway could land on a space dragon.
They are loaded by path where they belong. Extracted in place without a
re-merge (manifest byte-identical). `OFFICER`, `RACES` and MoO2 `COUNCIL`
also decode wrongly; recorded on the roadmap for review, none pooled.

→ **A run of 24×24 items at the head of a MoO2 archive is a set of palette
holders.** Check for it before calling an archive's colours broken.

### More MoO2 palettes, and the long run
With the station off, the same contact-sheet method found two more:
MoO2 `COUNCIL`'s documented item-0 rule covered items 0–23 of 197 (every
item past 23 was noise; widened to all, checked by eye), and `OFFICER`
210–276 need FONTS 2 (`_item_split`). `OFFICER` 277–343 fit no FONTS
palette, and `_item_split` turned out to drop `"IFONTS:n"` silently — eight
values, identical output. `_load_range_map()` now parses split values with
`parse_palette_ref()` and reports what it cannot use; IFONTS 1–4 do not fit
277–343 either, so they wait (ROADMAP §9.3).

→ **A parser that skips what it cannot read must say so.** The silent
`except: continue` made a valid-looking map entry do nothing. COUNCIL and OFFICER
joined EVENTS and DIPLOMAT in `STATIC_DENY`.

For a channel meant to run for days: the image cache is LRU under 512 MB
decoded; the ledger expires records after 90 days (it had no expiry and
grows ~300–600 records a day); headline tokens are memoised, which took the
fuzzy duplicate check from 1.9 s to 66 ms per 20-story poll at 20,000
records — a stall the viewer would have seen. The retired `capture_docs.py`
was deleted.

### Smaller
Overflowing break-card copy ends in an ellipsis (§10.4.1). An Atom entry
takes its article link (`rel="alternate"`), not whichever link comes first.
Gemini's §10 audit has a verdict on every item (see the table there).

### With the station off: everything watched, and four more fixes
Every item batched while on air was then checked in the running station
(details and evidence in ROADMAP §3). The live checks found four more:

- **The caption named the wrong anchor.** Its label was read at draw time
  from whoever was speaking, so a line without a caption of its own put its
  speaker's name over the previous speaker's words ("UNIT 7" over "I am
  Oth"). The speaker is taken when the caption is applied; 8 of 8 captions
  matched the speech log after. `speakerAnchor()`, left unused, was removed.
- **A cutaway could illustrate the wrong story.** `pendingScene` was not
  tied to the story it was built for, so a late or unconsumed prefetch
  became the next story's picture — in a test, a lore story's ground-war
  scene over a real one. Tied with `pendingFor`; the director passes the
  same object to `prefetch()` and `triggerCutaway()`.
- **Legal shots waited out archive animations**, leaving the picture up two
  seconds past the last line. They keep their own length.
- **Two short MoO1 clips froze** on their last frame under a normal line;
  they play at 8 fps (3.75 s) now.

`breakcheck.py` and `breakedges.py` exit non-zero on failure. MoO2's GNN
newsroom airs as a full-screen archive cutaway for matching lore stories,
the event picture on its monitor — the pictures' logo and rule land on the
monitor's own at (320, 12).

→ **Run the thing, not just the checks.** Two of these four were found by
looking at a screenshot taken for something else.
