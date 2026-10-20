# Outstanding art — everything still to generate

**The one place to look.** Every other prompt file in this folder is done:
an audit on 2026-10-17 checked all 193 "save the result as" targets against
the disk and found 173 present. This file lists the rest, with the prompt
to copy where one is needed. When you generate one, delete its entry here.

How the audit was run, so it can be re-run:

```
python3 - <<'X'
import re, os, glob
for f in sorted(glob.glob('assets/generated/Prompts/*.md')):
    for t in re.findall(r"[Ss]ave (?:the result |it )?as `([^`]+)`", open(f).read()):
        p = t if t.startswith('assets/') else 'assets/generated/' + t
        if not os.path.exists(p): print(os.path.basename(f), p)
X
```

After generating anything, run `python3 tools/condition_plates.py`.

---

## 1. Wanted — the station uses it as soon as it exists


### `cutaways/weather_map.png` and `cutaways/weather_map_02.png`

For the two weather shows' cutaways in the monitor (*Sector Weather Watch*,
*Solar Wind Overnight*). Tell Claude when they exist and they will be routed
to every weather story. Generate both — one is a planet's surface weather,
the other the space weather around a star.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a glowing holographic weather display floating in a dark broadcast studio, showing a planet seen from orbit with swirling storm fronts, a large hurricane spiral, bands of rain and lightning flickers drawn as luminous translucent layers over the globe, curved pressure lines and wind-direction arrows made of light, a faint grid of latitude and longitude lines around the planet, soft scanlines in the hologram. Framing: wide plate, full bleed to all four edges, no border and no frame, the planet a little right of centre. Palette: deep navy and black, cyan hologram light, white storm clouds, warning amber and red at the hurricane's eye. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, watermarks, signatures.
```

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a glowing holographic space-weather display floating in a dark broadcast studio, showing a star on the left throwing a huge curling solar flare and a wave of charged particles across space towards a small planet on the right, the planet's magnetic field drawn as glowing curved field lines bending under the storm, auroras glowing at its poles, translucent warning rings of light pulsing outward from the flare. Framing: wide plate, full bleed to all four edges, no border and no frame. Palette: deep black and violet, hot orange and yellow flare, cyan and green field lines and aurora. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, watermarks, signatures.
```

Save them as `assets/generated/cutaways/weather_map.png` and
`assets/generated/cutaways/weather_map_02.png`.

---

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
