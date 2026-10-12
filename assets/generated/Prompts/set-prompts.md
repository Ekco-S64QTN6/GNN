# Newsroom set — the prompt

## The style, settled

Every version of this I have written has asked for pixel art in some form —
first "1993 VGA, 320x200 DOS screen", then "crisp clean pixels", then
"painterly pixel art of the highest craft". All three produced pixel art,
which is not what the set should be. The cast plates read as high-fidelity
illustration; a pixel-art room next to them looks like a cheaper asset from
a different project.

The reference point is **Master of Orion 2 or 3, not Master of Orion 1** —
the pre-rendered look of a space strategy game made a decade later, with
smooth shading, volumetric light and specular metal. The prompt below says
that, and excludes pixel art, dithering and retro styling outright rather
than leaving it to tone.

The cast prompts in `prompts.md` keep their own style line. A face at that
density reads as deliberate; a room does not.

## What the last two returns fixed and broke

The painterly instruction did get rich shading rather than flat fills, so
that half worked. Four other things did not, and three were my wording:

- **The station name** — the exclusion list allowed "a station name" without
  saying which, so one model wrote `STATION NAME` and the other invented
  `HORIZON NEWS`. Now specified as GNN / GALACTIC NEWS NETWORK.
- **The desk's back edge** — Grok returned one straight run, Gemini a
  faceted hexagon that eats the centre. The anchors occupy 27% to 73% of
  the image width, so the back edge must be straight across all of it. Now
  stated in capitals.
- **The grime** — I asked for "scuffed", "worn paint" and "weathering" to
  give surfaces something to shade, and got rust streaks.
- **The gloom** — "charcoal and gunmetal" and low-key lighting gave a room
  that is mostly black. A news studio is brightly and evenly lit.

---

## The prompt

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

Clean, well-maintained surfaces: polished metal, brushed steel, smoked
glass, crisp paint. No rust, no grime, no weathering, no decay. Bright,
even, confident studio lighting.

The set of a science-fiction television news studio, brightly lit,
photographed head-on from a camera at seated eye level. No people anywhere.

The back wall is one enormous curved panoramic window, gently arched,
spanning about eighty percent of the image width and reaching from just
below the ceiling down to roughly the middle of the frame. Slim light
mullions divide it into tall panes.

A pale structural column stands at each end of the window, each carrying a
tall vertical strip of cool white light. Above, a curved ceiling soffit
follows the arc of the window, its underside set with recessed downlights,
and behind it an exposed lighting truss carrying studio lamps aimed down
into the room, filling it with light.

The side walls, beyond the columns, are clean ribbed metal panelling with
neat vents and seams, receding toward the back. High on each side wall,
well above head height, a wall-mounted monitor on a bracket, dark and
switched off.

Centred in the room stands a wide anchor desk, seen slightly from above so
both its top surface and its front face are visible.

THE BACK EDGE OF THE DESK IS ONE STRAIGHT UNBROKEN HORIZONTAL LINE running
across the middle sixty percent of the image. No facets, no angled
segments, no stepped sections along that back edge — a single flat run, wide
enough for two people to sit side by side behind it with clear space
between them. Only beyond that straight run, at the far left and right
ends, may the desk angle forward toward the camera.

The desk's front face carries a lit strip along its upper edge, a large
recessed centre panel reading GNN in bold letters with GALACTIC NEWS
NETWORK in small letters beneath it, and a smaller readout panel either
side. Its top edge sits about three fifths of the way down the image.
Nothing rests on it and nobody sits at it.

The floor is polished metal plating, bright and mirror-smooth like a
spaceship deck, filling the foreground and reflecting the lit front of the
desk and the lights above it in long soft highlights. Faint inlaid guide
lines and a few neatly taped cable runs toward the edges.

Apart from the desk the room is unfurnished: no control panels, no
counters, no consoles, no equipment at waist or desk height on either side.

Palette: pale steel and bone white, cool white light strips, warm amber
accents, bright overall.

Every pane of the window is a flat area of pure black, showing nothing at
all — no stars, no planet, no nebula, no glow. Nothing else in the room may
be pure black.

Do not include: pixel art, dithering, visible pixels, retro 8-bit or 16-bit
styling, rust, grime, weathering, decay, dim or moody lighting, flat
untextured surfaces, large areas of a single colour, any lettering anywhere
except GNN and GALACTIC NEWS NETWORK on the front of the desk, people,
chairs, control consoles, counters or any furniture other than the one
desk, modern logos, real-world brand names, watermarks, signatures.
```

---

## When it lands

Save as `assets/generated/set/studio_wide_empty.png`, delete
`assets/generated/set/desk_oval_front.png`, run
`python3 tools/condition_plates.py`.

The renderer already handles the desk being part of the set: with no desk
plate it seats the anchors at `DESK_LINE`, currently 0.60. If the desk in
the scene sits somewhere other than three fifths down, that is one number
and I will match it.

## Still not built

The sixteen `backdrops/` prompts have never been generated and nothing is
composited into the keyed window yet, so the glass stays black. Short job
once one backdrop exists.
