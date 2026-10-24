# Contributing to GNN

This is for anyone changing the code, human or agent. GNN has been worked on
by several AI agents in turn, and most of what is below was learned the hard
way: each rule names the thing that went wrong without it. Read the rule
*and* the reason. The reason is what tells you when the rule applies.

`CLAUDE.md` is the source of truth for what is broken, fixed and fragile.
`docs/ROADMAP.md` is what to build next. This file is how to work.

---

## 1. Before you touch anything

1. **Read `CLAUDE.md` §0 to §2** — the rule that matters most, the verified
   state, and the fourteen constraints that must not break. Then skim §3's
   headings: if you are about to build something, §3 may record that it was
   tried and why it failed (palette pickers, head grafting, plate
   registration were each built twice).
2. **The station may be on air.** The owner runs it for hours at a time.
   Do not stop or restart it, and do not point a test browser at port 8080.
   Test against a second server:

   ```bash
   GNN_PORT=8091 setsid .venv/bin/python server.py > /tmp/gnn-test.log 2>&1 &
   GNN_URL=http://localhost:8091/ GNN_CDP_PORT=9444 python3 tools/tests/breakcheck.py 3
   ```

   A non-default port writes its own pid file (`.gnn-server-8091.pid`);
   `./stop.sh` also reaps any browser on CDP port 9333, which is why the
   harness uses 9444 here. If a change needs a restart of the real
   station, collect it and tell the owner — do not do it yourself.
3. **Run the offline checks** before and after: `tools/tests/offline.sh`.
   GitHub runs the asset-free part of it (`.github/workflows/offline-checks.yml`:
   JS syntax, `server.py`, `content_check.py`, `test_moo2_tools.py`) on every pull
   request, and `main` only accepts a pull request whose `offline-checks` passed.
   `verify_assets.py` needs the extracted, git-ignored assets, so it stays local.
   No server, no browser, safe on air, exit code 1 on failure.

---

## 2. Verify behaviour, not presence

The project's first rule, and the one most often broken.

- **A fix is done when it has been watched working, not when the code for
  it exists.** Measure from the outside: media-element events, the frame
  loop, the pixels on disk. `tools/tests/breakcheck.py` found the
  commercial break's real faults; reading the code had suggested others
  that turned out not to matter.
- **Check that your test can fail.** Plant the fault and see it caught
  before you trust a pass. `content_check.py` was validated by breaking four
  things in a copy of the tree; it caught all four.
- **Validate a metric against known answers before it gets an opinion.**
  Two palette pickers scored 0 of 6 on archives whose answer was known. A
  speech detector rated MIDI music — which cannot contain a voice — above
  real speech. None of them shipped.
- **When the owner hears or sees a problem and your measurement disagrees,
  doubt the measurement.** Pop detection passed for three sessions while
  the owner could hear the clipping.
- **When something is slow, check that it was even sent.** Six seconds of
  silence before a commercial were blamed on synthesis; the request was
  queued in the browser behind sixteen prefetches.
- **An intermittent fault is a race, a cache or an ordering problem.** Not
  a mystery, and not "flaky".

---

## 3. Fix the problem you were given, and only that

- **Scope a fix to the case that was broken.** A cap meant to stop MoO2 film
  freezing on its last frame was applied to every animation, and the MoO1
  missile battery was cut off before it fired. Ask which other inputs reach
  the line you are changing.
- **A convenience for one caller is a side effect for every other.**
  `setVoice()` restarted the current line for the voice picker; the director
  calls it at every show and the booth ident played twice.
- **Find the cause before writing the fix.** Two of the causes in an
  earlier audit (`CLAUDE.md` §10) were wrong although their symptoms were
  real — a missing `sys.path` line that was present but one directory
  short; a feed-level link the code never reads. Run the failing thing,
  then explain it.
- **Identity is not a shared attribute.** Every NOAA alert carried the same
  link, and the ledger treats a shared link as the same story — one space
  weather story aired, ever. Fourteen anchor lines named "Hale" as the
  partner of anchors who never sit with Hale. Match by a real key; write
  `{TO}` instead of a name.
- **An estimate must be tracked, or it becomes permanent.** Three product
  slots were marked "estimates until the art exists". The art arrived, no
  one re-measured, and every product on those sets floated until the owner
  noticed. If
  you leave a placeholder, put it on the roadmap, not just in a comment.

---

## 4. Code

- **Match the file you are in.** 4-space indent, single quotes, semicolons,
  modules as `const GNNName = (() => { ... return { ... }; })();`. These are
  global bindings but **not** `window` properties — guard with `typeof`,
  never `if (window.GNNX)` (`CLAUDE.md` §3).
- **Never run a formatter over a file**, and never rewrite a file to change
  a few lines. A formatter pass once stripped 971 comment lines from the
  director and broke its header; restoring them took a session.
- **Never save one script over another.** `extract_moo2_text.py` held the
  merge script's code; the tests that imported it failed and the
  real extractor existed only in git. After any multi-file edit, read
  `git diff --stat` and account for every file in it.
- **Async calls from `update()` reserve state synchronously** and clear it
  in `finally` (constraint 13). The frame loop runs during every `await`.
- **Every gain change goes through a ramp** (constraint 8). Anchor a ramp
  with `setValueAtTime` first.
- **Asset consumers query a pool**; the deny list lives inside
  `GNNAssets.find()` (constraint 11). Never re-derive a size filter.
- **Change a function's signature, change its tests in the same edit.** The
  MoO2 tests were left failing against the four-layer palette map.

---

## 5. Comments

Comments here are the record of *why*. They are long on purpose. Keep them
true.

- **Explain why, and name the failure it prevents.** "Bottom-aligned, not
  centred: centred, a short product hovered over the pedestal" is useful.
  "Align product" is not.
- **When you change behaviour, rewrite the comment above it in the same
  edit.** A comment said each cold open "advances to the next block instead
  of re-reading the hour" two architectures after it stopped doing so; the
  next agent to trust it would have broken the clock.
- **No labels from documents that are not in the repo.** Comments carried
  `F5:` to `F10:` from a fix list that was deleted; two different fixes were
  both "F8". Say what the fix was.
- **No line numbers, no "the previous build", no "currently".** They are
  wrong the next day. Name the function or the constant instead.
- **Never copy a comment along with code.** A two-way's "no plate for this
  correspondent" explanation sat in the bumper hand-off, describing nothing
  there.
- **Quote the owner when the owner decided.** `(owner)` after a decision
  tells the next agent it is not theirs to undo.
- **Do not strip, shorten or "tidy" comments** you did not write.

---

## 6. Writing for the station

- **Real news is read straight; lore stays in its own show.** Anything that
  airs after a real story — banter, exchanges, handbacks — is a habit or a
  principle, never a claim about the story ("they reached an agreement" is
  false half the time). In-universe pictures (MoO2's GNN event art, the
  diplomat holograms) are denied from every pool and loaded by path where
  they belong (`ROADMAP.md` §1, hard lines).
- **Repetition is the enemy.** Measure it from the logs before adding lines,
  and check coverage, not just size: the exchange table was 34 entries
  deep and covered 3 of the 22 pairs the schedule seats.
- **Pronunciation goes through Kokoro's own phonemiser.** Run
  `.venv/bin/python tools/pronounce_kokoro.py --say "the text"` before adding
  a rule and after; never mark stress with capitals (Kokoro spells them).
  Run new lines through the page's `GNNTTS.sanitize()` first — that is the
  text Kokoro actually receives.

---

## 7. Art and assets

- **Look at it at the size it airs.** Contact-sheet a pool before admitting
  an archive to it; `tools/tests/productsheet.py` before shipping a still,
  a stage or a slot. Size is not role.
- **Palettes are settled by eye** (`tools/palette_review.py`,
  `tools/palette_compare.py`), never by a metric. A run of 24×24 items at
  the head of a MoO2 archive is a set of palette holders; EVENTS and
  DIPLOMAT decoded in the wrong colours until that was checked.
- **Extract to a scratch directory first** (`--out`), look, then extract in
  place. Re-merging the manifest re-pools by size — check what it would
  admit before you run it.
- **Generated art follows `STYLE` in `tools/prompt_bridge.py`.** No pixel-art
  generation; the archive supplies the pixels.

---

## 8. Documents

- **`CLAUDE.md` §3 is written in one style.** Heading: the symptom, as the
  owner saw it. Then the cause, the fix, and the evidence, in prose with the
  numbers you measured. End with `→` and the lesson, if there is one. Do not
  append sections in a different template; §9–§13 were, and their claims
  had to be checked one by one (§10's table records the verdicts).
- **Every number in a document is measured, and says how.** "Up to 6 s" with
  the probe that measured it, not "significant delay".
- **Correct a document the moment you find it wrong.** Stale entries cost
  the next agent a session: the roadmap listed space weather as to-do while
  it was serving, and art as "waiting" that was on disk.
- **`ROADMAP.md` §3 is only for what has been watched on air.** Built but
  not yet seen goes in §4.5, with what to watch for.

---

## 9. Reporting back

- Say what you verified and how; say what you could not verify and why.
- Do not hedge a result you measured, and do not claim one you did not.
- If you changed something that needs a restart or a reload, say so first.
- List what is left undone, with where it is recorded.
