# Outstanding art — generated-assets backlog

This file is a prompt/backlog aid, not proof that an output is absent. The
filesystem audit dated 2026-10-17 is historical; the weather cutaway assets
were added and routed after that audit. Check the current tree and runtime
consumer before generating replacements. After generating new art, run
`python3 tools/condition_plates.py` and inspect the result at the size it airs.

## 1. Exists — verify before regenerating

### Weather cutaways

`assets/generated/cutaways/weather_map.png` and
`weather_map_02.png` are present in the repository. The 2026-10-20 runtime
change added both names to the `weather` cutaway pool and added a dedicated
weather topic classifier and sound recipe.

Do not regenerate these files just because they appeared in the old backlog.
Still verify their current rendering at the actual monitor size and on an
on-air weather story. If the image treatment needs conditioning, document the
measured problem and regenerate only the required output.

## 2. Not needed unless the cast grows

### Female variants for six species — 18 plates

`Hero_prompts.md` has prompts for `alkari_f, bulrathi_f, darlok_f, human_f, klackon_f, meklar_f, mrrshan_f, sakkra_f, silicoid_f`
(`_desk_hero`, `_speaking`, `_listening` each). **Nothing in the station
uses them.** The cast is 14 profiles in `js/cast.js`; these would be new
anchors, each needing a cast profile, a voice and a place in
`show-config.json`. Generate them only if you want more anchors — the
prompts are ready in `Hero_prompts.md`.

---

## 3. Not missing — recorded so nobody chases them

- **`overlays/test_card.png`** (`Daypart_Logo_Overlay_prompts.md`). The test
  cards were saved as `titlecards/test_card.png` and `test_card_02.png`,
  which is where the glitch engine reads them. Nothing to do.
- **`monitor_frame.png`, `monitor_frame_brass.png`** — generated, keyed,
  wired: gunmetal by default, brass on the archive, diplomatic and
  celebrity sets.
- **Every infomercial plate, product still, sponsor crest and testimonial**
  — present and conditioned.

---

## 4. Ideas, if you want more

Not required by anything. Each would be wired in on request.

- **Standing pairs for the 19 composed title cards.** The composed cards are
  photographs of the studio; five shows have generated cards with the pair
  standing before the desk. Same prompt style as `standing/*_pairs.png`.
- **Logos for the 17 shows without one** (`logos/`, same style as
  `galactic_morning_watch.png`): Sector Weather Watch, Solar Wind Overnight,
  Rim Sports Wire, The Arena Hour, Market Close, Orbital Briefing, The
  Council Hour, Galactic Spotlight, The Night Desk, Deep Signal, Chronicles
  of the Old Empires, World Desk Tonight, Signal & Circuit, Machine
  Intelligence Log, Council Summit Floor, Colonial Mining & Trade, Imperial
  Historical Wire.
