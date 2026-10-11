# Newsroom set — prompts to try

The set reads worse than the cast, and the style line is why. Every prompt in
`prompts.md` opens with *"1993 VGA pixel art, 256-colour DOS-era palette …
chunky visible pixels as if drawn for a 320x200 DOS screen"*, which is right
for a character — a face at that density reads as deliberate pixel art — and
wrong for a room. A wide space is mostly large flat surfaces, and asking for
chunky pixels across them gives coarse banding with nothing to look at,
next to anchors drawn at full detail.

These five drop the DOS-era clause for the set only and ask for modern,
detailed sci-fi pixel art instead. The cast prompts are not changed.

## How to use these

- Generate at **1792x1024**, same as before.
- Save the one you like as `assets/generated/set/studio_wide_empty.png`, then
  run `python3 tools/condition_plates.py`.
- The conditioner still quantises to 256 colours. That is not a problem:
  detail survives quantisation, flat chunk does not. A richly lit, detailed
  render reduced to 256 colours looks far better than a coarse one.
- **The window in the back wall must be flat pure black.** That is what the
  engine keys the exterior backdrop into, and nothing else in the room may
  be pure black.
- The anchors sit with their heads at about 0.29 of the frame height and the
  desk's top edge at about 0.55. Everything between those lines is behind
  the cast, so detail there is wasted; detail in the foreground floor, the
  ceiling and the side walls is what gives the shot depth.

Each block below is complete. Paste one, nothing else.

---

## A — Detailed modern pixel art, deep perspective

```
Create a 1792x1024 image.

Highly detailed modern pixel art, rich 32-bit colour, crisp clean pixels with
careful dithering and no visible compression — the look of a modern pixel-art
game rather than a 1990s one. The interior of a starship television studio,
empty, photographed from a seated camera at desk height looking level across
the room. Deep one-point perspective: the side walls run steeply away toward
a distant back wall, a wide viewport set low in that wall at the height of a
seated person, recessed instrument alcoves glowing along both side walls,
an overhead lighting rig with practical strip lights throwing pools of light
down the walls, and a broad stretch of empty polished floor in the
foreground catching soft reflections. No desk, no furniture in the centre, no
figures, no people.

Palette: cool steel teal and slate, bone white panelling, warm amber practical
lights.

The viewport opening is a flat area of pure black, showing nothing at all — no
stars, no planet, no light.

Do not include: captions, headlines, tickers, labels, letters, numbers or
writing of any kind anywhere in the image, modern logos, real-world brand
names, people, furniture in the centre of the room, watermarks, signatures.
```

---

## B — Wide angle with a strong foreground

Same room, more floor. Use this if the anchors still feel too close to camera.

```
Create a 1792x1024 image.

Highly detailed modern pixel art, rich 32-bit colour, crisp clean pixels with
careful dithering. The interior of a starship television studio, empty, shot
wide from low down so the polished floor fills the bottom third of the frame
and leads the eye back. Strong depth cues: floor panel seams converging
toward a vanishing point, side walls foreshortened hard, a distant back wall
carrying a wide low viewport, overhead lighting trusses receding overhead
with their lamps picked out. Recessed equipment bays glowing along both side
walls. No desk, no furniture in the centre, no figures, no people.

Palette: cool steel teal and slate, bone white panelling, warm amber practical
lights.

The viewport opening is a flat area of pure black, showing nothing at all — no
stars, no planet, no light.

Do not include: captions, headlines, tickers, labels, letters, numbers or
writing of any kind anywhere in the image, modern logos, real-world brand
names, people, furniture in the centre of the room, watermarks, signatures.
```

---

## C — Night broadcast, warmer and darker

Lower key. The anchors are lit warm, so this may seat them better than the
cooler options.

```
Create a 1792x1024 image.

Highly detailed modern pixel art, rich 32-bit colour, crisp clean pixels with
careful dithering. The interior of a starship television studio at night,
empty, from a seated camera at desk height looking level across the room.
Low-key lighting: the room mostly in shadow, lit by amber strip lights along
the side walls and a cool glow from a wide low viewport in the distant back
wall, with soft falloff into the corners. Deep perspective, side walls
running away toward the back wall, dark reflective floor in the foreground
holding the highlights. No desk, no furniture in the centre, no figures, no
people.

Palette: deep slate blue and charcoal, warm amber practicals, a cold cyan
spill from the viewport.

The viewport opening is a flat area of pure black, showing nothing at all — no
stars, no planet, no light.

Do not include: captions, headlines, tickers, labels, letters, numbers or
writing of any kind anywhere in the image, modern logos, real-world brand
names, people, furniture in the centre of the room, watermarks, signatures.
```

---

## D — Bright, clean, broadcast-lit

The opposite extreme: an evenly lit studio with no mood, which reads as a
real newsroom and lets the cast carry the frame.

```
Create a 1792x1024 image.

Highly detailed modern pixel art, rich 32-bit colour, crisp clean pixels with
careful dithering. The interior of a bright, clean starship television
studio, empty, from a seated camera at desk height looking level across the
room. Evenly lit by a broad overhead rig, the way a real studio is lit: few
shadows, bright bone-white wall panels, pale floor. Deep perspective with the
side walls running away toward a distant back wall carrying a wide low
viewport. Trim detail everywhere — panel seams, vents, recessed instrument
bays, cable runs — so the surfaces are not blank. No desk, no furniture in
the centre, no figures, no people.

Palette: bone white and pale grey panelling, soft teal accents, cool neutral
lighting.

The viewport opening is a flat area of pure black, showing nothing at all — no
stars, no planet, no light.

Do not include: captions, headlines, tickers, labels, letters, numbers or
writing of any kind anywhere in the image, modern logos, real-world brand
names, people, furniture in the centre of the room, watermarks, signatures.
```

---

## E — Closest to the current set, just better drawn

If the current room's layout is right and only its quality is wrong, this
keeps the composition and asks for the detail.

```
Create a 1792x1024 image.

Highly detailed modern pixel art, rich 32-bit colour, crisp clean pixels with
careful dithering, in the spirit of Master of Orion but drawn at modern
fidelity rather than at 320x200. The interior of a starship television
studio, empty: bevelled hull wall panels, recessed instrument consoles with
rows of lit indicator buttons down both side walls, a wide low viewport
centred in the back wall, an overhead lighting rig, and a stretch of clean
floor in the foreground. Seen from a seated camera at desk height, looking
level, with the side walls running away in strong perspective toward a
clearly distant back wall. No desk, no furniture in the centre, no figures,
no people.

Palette: muted teal and bone white, warning-stripe yellow accents.

The viewport opening is a flat area of pure black, showing nothing at all — no
stars, no planet, no light.

Do not include: captions, headlines, tickers, labels, letters, numbers or
writing of any kind anywhere in the image, modern logos, real-world brand
names, people, furniture in the centre of the room, watermarks, signatures.
```

---

## If one of these works

Tell me which, and I will fold its style line into `tools/prompt_bridge.py`
so the set, the desk and the props are all generated that way and
`prompts.md` stops contradicting it. The cast keeps the existing style —
mixing them is deliberate, since a face and a room want different densities.
