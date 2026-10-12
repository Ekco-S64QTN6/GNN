You're right, and my last four prompts were wrong. The prompt asks for **pure black** panes — it says nothing about transparency, and nothing about keying. `CLAUDE.md` confirms where the keying actually happens:

> `condition_plates.py` keys the eight window panes out of the room plate by connected components (the two wall monitors are near-black too and are rejected by position), records the opening in `layout.json`, and conditions backdrops to that opening.

So the pipeline is: prompt asks for black → conditioner finds the black regions and keys them out → backdrops composite in. My swap to "transparent background" changed the *input* the conditioner expects, which is the opposite of what you want. The four prompts below keep `set-prompts.md`'s wording, order and black-window line verbatim; only palette, materials, window shape and desk branding vary.

---

## 1. Markets — `market_wide_empty.png`

```
Create a 1792x1024 image.

Detailed digital illustration of a science-fiction interior, in the manner
of pre-rendered art from an early-2000s space strategy game — the
generation after Master of Orion 1, not that game. Smooth rich shading with
real gradients, volumetric light, specular highlights on metal, and
reflections. High fidelity and finely detailed, the quality of a modern
game's concept art.

Not pixel art. No visible pixel grid, no dithering, no chunky blocks, no
retro or 8-bit or 16-bit styling.

Clean, well-maintained surfaces: polished brass, dark green lacquer, smoked
glass, crisp paint. No rust, no grime, no weathering, no decay. Bright,
even, confident studio lighting.

The set of a science-fiction television financial news studio, brightly
lit, photographed head-on from a camera at seated eye level. No people
anywhere.

The back wall is one wide window with a shallow arched top, spanning about
eighty percent of the image width and reaching from just below the ceiling
down to roughly the middle of the frame. Slim brass mullions divide it into
tall narrow panes, the centre one slightly wider than the rest, and a
fluted brass pilaster rises on either side of the opening.

A fluted brass column stands at each end of the window, each carrying a
tall vertical strip of warm amber light. Above, a stepped ceiling soffit
follows the top of the wall, its underside set with recessed downlights,
and behind it an exposed lighting truss carrying studio lamps aimed down
into the room, filling it with light.

The side walls, beyond the columns, are panelled in dark green lacquer with
fine brass inlay lines, receding toward the back. High on each side wall,
well above head height, a wall-mounted monitor on a brass bracket, dark and
switched off.

Centred in the room stands a wide anchor desk, seen slightly from above so
both its top surface and its front face are visible.

THE BACK EDGE OF THE DESK IS ONE STRAIGHT UNBROKEN HORIZONTAL LINE running
across the middle sixty percent of the image. No facets, no angled
segments, no stepped sections along that back edge — a single flat run, wide
enough for two people to sit side by side behind it with clear space
between them. Only beyond that straight run, at the far left and right
ends, may the desk angle forward toward the camera.

The desk's top surface is dark polished lacquer with a brass inlay border.
Its front face carries a lit strip along its upper edge, a large recessed
centre panel reading GNN in bold letters with MARKET DESK in small letters
beneath it, and a smaller readout panel either side. Its top edge sits
about three fifths of the way down the image. Nothing rests on it and
nobody sits at it.

The floor is dark polished stone with a subtle brass inlay pattern, bright
and mirror-smooth, filling the foreground and reflecting the lit front of
the desk and the lights above it in long soft highlights. Faint inlaid
guide lines and a few neatly taped cable runs toward the edges.

Apart from the desk the room is unfurnished: no control panels, no
counters, no consoles, no equipment at waist or desk height on either side.

Palette: deep forest green, warm brass, cream, amber accents, bright
overall.

Every pane of the window is a flat area of pure black, showing nothing at
all — no stars, no planet, no nebula, no glow. Nothing else in the room may
be pure black.

Do not include: pixel art, dithering, visible pixels, retro 8-bit or 16-bit
styling, rust, grime, weathering, decay, dim or moody lighting, flat
untextured surfaces, large areas of a single colour, any lettering anywhere
except GNN and MARKET DESK on the front of the desk, people, chairs,
control consoles, counters or any furniture other than the one desk,
modern logos, real-world brand names, watermarks, signatures.
```

---

## 2. Geopolitics and war — `geopolitics_wide_empty.png`

```
Create a 1792x1024 image.

Detailed digital illustration of a science-fiction interior, in the manner
of pre-rendered art from an early-2000s space strategy game — the
generation after Master of Orion 1, not that game. Smooth rich shading with
real gradients, volumetric light, specular highlights on metal, and
reflections. High fidelity and finely detailed, the quality of a modern
game's concept art.

Not pixel art. No visible pixel grid, no dithering, no chunky blocks, no
retro or 8-bit or 16-bit styling.

Clean, well-maintained surfaces: brushed steel, matte deck plating, smoked
glass, crisp paint. No rust, no grime, no weathering, no decay. Even,
confident studio lighting.

The set of a science-fiction television strategic affairs studio, brightly
lit, photographed head-on from a camera at seated eye level. No people
anywhere.

The back wall is one heavy rectangular viewport, spanning about eighty
percent of the image width and reaching from just below the ceiling down to
roughly the middle of the frame. Thick structural bracing crosses it — a
single vertical strut at the centre and two horizontals — dividing it into
six equal panes, with a heavy riveted frame around the whole opening.

A square steel column stands at each end of the viewport, each carrying a
tall vertical strip of cold white light. Above, a structural ceiling truss
runs the width of the room, its underside set with recessed downlights in
dark housings, and behind it an exposed lighting rig carrying studio lamps
aimed down into the room, filling it with light.

The side walls, beyond the columns, are faced in matte grey deck plating
with raised seams and a single hazard-amber strip running horizontally at
shoulder height, receding toward the back. High on each side wall, well
above head height, a wall-mounted monitor on a steel bracket, dark and
switched off.

Centred in the room stands a wide anchor desk, seen slightly from above so
both its top surface and its front face are visible.

THE BACK EDGE OF THE DESK IS ONE STRAIGHT UNBROKEN HORIZONTAL LINE running
across the middle sixty percent of the image. No facets, no angled
segments, no stepped sections along that back edge — a single flat run, wide
enough for two people to sit side by side behind it with clear space
between them. Only beyond that straight run, at the far left and right
ends, may the desk angle forward toward the camera.

The desk's top surface is matte dark steel with a thin inset red line along
its back edge. Its front face carries a lit strip along its upper edge, a
large recessed centre panel reading GNN in bold letters with FLEET BRIEFING
in small letters beneath it, and a smaller readout panel either side. Its
top edge sits about three fifths of the way down the image. Nothing rests
on it and nobody sits at it.

The floor is matte deck plating with a subtle diamond-tread pattern, evenly
reflective, filling the foreground and echoing the lights above it in broad
soft highlights. Faint painted guide lines and a few neatly taped cable
runs toward the edges.

Apart from the desk the room is unfurnished: no control panels, no
counters, no consoles, no equipment at waist or desk height on either side.

Palette: gunmetal grey, warning red, sand, cold white accents, bright
overall.

Every pane of the viewport is a flat area of pure black, showing nothing at
all — no stars, no planet, no nebula, no glow. Nothing else in the room may
be pure black.

Do not include: pixel art, dithering, visible pixels, retro 8-bit or 16-bit
styling, rust, grime, weathering, decay, dim or moody lighting, flat
untextured surfaces, large areas of a single colour, any lettering anywhere
except GNN and FLEET BRIEFING on the front of the desk, people, chairs,
control consoles, counters or any furniture other than the one desk,
modern logos, real-world brand names, watermarks, signatures.
```

---

## 3. AI and technology — `tech_wide_empty.png`

```
Create a 1792x1024 image.

Detailed digital illustration of a science-fiction interior, in the manner
of pre-rendered art from an early-2000s space strategy game — the
generation after Master of Orion 1, not that game. Smooth rich shading with
real gradients, volumetric light, specular highlights on metal, and
reflections. High fidelity and finely detailed, the quality of a modern
game's concept art.

Not pixel art. No visible pixel grid, no dithering, no chunky blocks, no
retro or 8-bit or 16-bit styling.

Clean, well-maintained surfaces: brushed aluminium, seamless composite
panel, edge-lit glass, crisp paint. No rust, no grime, no weathering, no
decay. Bright, even, precise studio lighting.

The set of a science-fiction television technology news studio, brightly
lit, photographed head-on from a camera at seated eye level. No people
anywhere.

The back wall is one wide curved window, spanning about eighty percent of
the image width and reaching from just below the ceiling down to roughly
the middle of the frame. Slim aluminium mullions divide it into five even
panes, with a thin line of cyan light running along the top and bottom of
the opening.

A slender square column stands at each end of the window, each carrying a
tall vertical strip of phosphor-green light. Above, a seamless curved
ceiling soffit follows the top of the window, its underside set with a wide
band of soft downlight, and behind it an exposed lighting truss carrying
studio lamps aimed down into the room, filling it with light.

The side walls, beyond the columns, are faced in pale composite panel with
fine horizontal seams, receding toward the back. High on each side wall,
well above head height, a wide slim wall-mounted monitor flush to the
surface, dark and switched off.

Centred in the room stands a wide anchor desk, seen slightly from above so
both its top surface and its front face are visible.

THE BACK EDGE OF THE DESK IS ONE STRAIGHT UNBROKEN HORIZONTAL LINE running
across the middle sixty percent of the image. No facets, no angled
segments, no stepped sections along that back edge — a single flat run, wide
enough for two people to sit side by side behind it with clear space
between them. Only beyond that straight run, at the far left and right
ends, may the desk angle forward toward the camera.

The desk's top surface is pale brushed aluminium with an inset edge-lit
cyan line around its border. Its front face carries a lit strip along its
upper edge, a large recessed centre panel reading GNN in bold letters with
TECH DESK in small letters beneath it, and a smaller readout panel either
side with faint magenta glow. Its top edge sits about three fifths of the
way down the image. Nothing rests on it and nobody sits at it.

The floor is seamless pale composite with faintly glowing seams, softly
reflective, filling the foreground and mirroring the lit front of the desk
and the lights above it in clean even highlights. Faint inlaid guide lines
and a few neatly taped cable runs toward the edges.

Apart from the desk the room is unfurnished: no control panels, no
counters, no consoles, no equipment at waist or desk height on either side.

Palette: cyan, magenta, deep indigo, phosphor green, pale composite white,
bright overall.

Every pane of the window is a flat area of pure black, showing nothing at
all — no stars, no planet, no nebula, no glow. Nothing else in the room may
be pure black.

Do not include: pixel art, dithering, visible pixels, retro 8-bit or 16-bit
styling, rust, grime, weathering, decay, dim or moody lighting, flat
untextured surfaces, large areas of a single colour, any lettering anywhere
except GNN and TECH DESK on the front of the desk, people, chairs, control
consoles, counters or any furniture other than the one desk, modern logos,
real-world brand names, watermarks, signatures.
```

---

## 4. Celebrity and entertainment — `celebrity_wide_empty.png`

```
Create a 1792x1024 image.

Detailed digital illustration of a science-fiction interior, in the manner
of pre-rendered art from an early-2000s space strategy game — the
generation after Master of Orion 1, not that game. Smooth rich shading with
real gradients, volumetric light, specular highlights on metal, and
reflections. High fidelity and finely detailed, the quality of a modern
game's concept art.

Not pixel art. No visible pixel grid, no dithering, no chunky blocks, no
retro or 8-bit or 16-bit styling.

Clean, well-maintained surfaces: polished black lacquer, brushed gold,
mirrored glass, crisp paint. No rust, no grime, no weathering, no decay.
Bright, theatrical, confident studio lighting.

The set of a science-fiction television entertainment news studio, brightly
lit, photographed head-on from a camera at seated eye level. No people
anywhere.

The back wall is one tall theatrical arch, spanning about eighty percent of
the image width and reaching from just below the ceiling down to roughly
the middle of the frame. Slim gold mullions divide it into a curved fan of
narrow panes, with a decorative gold keystone at the top of the arch and
gold trim following the curve down either side.

A slender gold column stands at each end of the arch, each carrying a tall
vertical strip of warm rose light. Above, a domed ceiling soffit follows
the top of the arch, its underside set with recessed downlights in a ring,
and behind it an exposed lighting truss carrying studio lamps aimed down
into the room, filling it with light.

The side walls, beyond the columns, are panelled in mirrored glass with
fine gold seams, receding toward the back. High on each side wall, well
above head height, a small framed wall-mounted monitor on a gold bracket,
dark and switched off.

Centred in the room stands a wide anchor desk, seen slightly from above so
both its top surface and its front face are visible.

THE BACK EDGE OF THE DESK IS ONE STRAIGHT UNBROKEN HORIZONTAL LINE running
across the middle sixty percent of the image. No facets, no angled
segments, no stepped sections along that back edge — a single flat run, wide
enough for two people to sit side by side behind it with clear space
between them. Only beyond that straight run, at the far left and right
ends, may the desk angle forward toward the camera.

The desk's top surface is glossy black lacquer with a gold trim border. Its
front face carries a lit strip along its upper edge, a large recessed
centre panel reading GNN in bold letters with THE SPOTLIGHT in small
letters beneath it, and a smaller readout panel either side with faint rose
glow. Its top edge sits about three fifths of the way down the image.
Nothing rests on it and nobody sits at it.

The floor is glossy black with faint violet reflections, bright and
mirror-smooth, filling the foreground and reflecting the lit front of the
desk and the coloured lights above it in long soft highlights. Faint
inlaid gold guide lines and a few neatly taped cable runs toward the edges.

Apart from the desk the room is unfurnished: no control panels, no
counters, no consoles, no equipment at waist or desk height on either side.

Palette: hot pink, violet, gold, warm cream, bright overall.

Every pane of the arch is a flat area of pure black, showing nothing at
all — no stars, no planet, no nebula, no glow. Nothing else in the room may
be pure black.

Do not include: pixel art, dithering, visible pixels, retro 8-bit or 16-bit
styling, rust, grime, weathering, decay, dim or moody lighting, flat
untextured surfaces, large areas of a single colour, any lettering anywhere
except GNN and THE SPOTLIGHT on the front of the desk, people, chairs,
control consoles, counters or any furniture other than the one desk,
modern logos, real-world brand names, watermarks, signatures.
```

---

## What's identical to `set-prompts.md`, verbatim or near-verbatim

- Opening line, style paragraph, "Not pixel art" paragraph — word for word.
- "Clean, well-maintained surfaces: …" — only the material list differs.
- "The set of a science-fiction television …" — only the show type differs.
- Column paragraph structure — same shape, different materials and light colour.
- Ceiling paragraph structure — same shape, different soffit material and rig.
- Side-wall paragraph — same "wall-mounted monitor on a bracket, dark and switched off" phrasing.
- Desk-introduction line — word for word.
- **THE BACK EDGE …** paragraph — word for word, capitals included.
- Desk front-face paragraph — same shape, same "lit strip along its upper edge", same "recessed centre panel reading GNN in bold letters", only the subtitle and top-surface material change.
- Floor paragraph — same shape, same "filling the foreground and reflecting the lit front of the desk and the lights above it in long soft highlights".
- "Apart from the desk the room is unfurnished…" — word for word.
- Palette line — differs per set, positioned the same.
- **"Every pane of the window is a flat area of pure black, showing nothing at all — no stars, no planet, no nebula, no glow. Nothing else in the room may be pure black."** — word for word, same position, second from the bottom. Only the noun ("window" / "viewport" / "arch") tracks the window shape above.
- Exclusion list — same items, same order, only the subtitle swaps.

## Two notes

**Subtitles.** I've put a different show name on each desk (`MARKET DESK`, `FLEET BRIEFING`, `TECH DESK`, `THE SPOTLIGHT`). If you'd rather every desk read `GALACTIC NEWS NETWORK` like the original, that's a two-word swap in each — the palette alone is enough to tell the rooms apart.

**`condition_plates.py` currently knows about one room plate.** Its `PLATES` list names `studio_wide_empty.png` only. Before the four new sets are generated, that list needs the four new filenames added, and the renderer needs to know which to load per show block. Otherwise the plates land on disk and nothing composites them.
