# Newsroom set — the prompt

## Why the set looks cheaper than the cast

Measured off the two plates:

| | mean local contrast | pixels sitting in a flat area |
|---|---|---|
| anchor | **27.98** | 6% |
| set | 14.32 | **29%** |

The set has half the shading density and five times the flat area. Every
wall and floor panel is a large block of nearly one colour, while the
anchors are shaded continuously with a dozen tones across a cheekbone. Put
side by side, one looks drawn and the other looks filled in.

That is my fault twice over. The cast prompt asks for **"painterly pixel
dithering, hand-placed pixels"**, which is what gives them that quality. For
the set I first kept the `320x200 DOS screen` clause, which flattens
everything, and when I dropped it I replaced it with **"crisp clean
pixels"** — which is a straight instruction to produce flat graphic
artwork. Both were wrong, in opposite directions.

The style line below asks for the same hand as the character plates,
without the resolution clause.

---

## The prompt

```
Create a 1792x1024 image.

Painterly pixel art of the highest craft. Every surface shaded with many
tones and hand-placed dithering — no flat fills anywhere, no large areas of
a single colour. Strong directional lighting with bloom, bounced light and
soft falloff. Rich material texture: brushed metal, scuffed composite,
smoked glass, worn paint. Dense, atmospheric and deeply detailed, drawn
with the same care as a finely rendered character portrait.

The set of a science-fiction television news studio, photographed head-on
from a camera at seated eye level. Empty — no people, no desk, no consoles,
no furniture of any kind.

The back wall is one enormous curved panoramic window, gently arched,
spanning about eighty percent of the image width and reaching from just
below the ceiling down to roughly the middle of the frame. Slim dark
mullions divide it into tall panes. It is the dominant feature of the room.

A heavy dark structural column stands at each end of the window, each
carrying a tall vertical strip of cool white light running floor to
ceiling, its glow spilling across the panelling beside it. Above, a curved
ceiling soffit follows the arc of the window, its underside set with
recessed downlights that pool on the surfaces below, and behind it an
exposed lighting truss carrying studio lamps on yokes, aimed down into the
room.

The side walls, beyond the columns, are ribbed metal panelling with vents,
seams, conduit runs and weathering, receding toward the back. High on each
side wall, well above head height, a wall-mounted monitor on a bracket,
dark and switched off.

The floor is dark polished composite filling the foreground, marked with
faint inlaid guide lines, crossed by loose cable runs taped down toward the
edges, and holding long soft reflections of the lights above.

The entire middle and lower middle of the room is clear empty floor. There
is nothing standing anywhere in the room — no desk, no control panels, no
counters, no equipment at waist or desk height on either side.

Palette: charcoal and gunmetal, cool white and cyan light strips, warm amber
accents.

Every pane of the window is a flat area of pure black, showing nothing at
all — no stars, no planet, no nebula, no glow. Nothing else in the room may
be pure black.

Do not include: flat untextured surfaces, large areas of a single colour,
minimal or vector-like shapes, captions, headlines, tickers, labels,
letters, numbers or writing of any kind, people, a desk, control consoles,
counters or any furniture whatsoever, modern logos, real-world brand names,
watermarks, signatures.
```

---

## The desk, same problem

The desk plate is flat for the same reason. When you regenerate it, put the
same style block at the top of its prompt in `prompts.md` — or tell me and
I will change it there so it comes out of the generator that way.

## What changed from the last attempt

- **The style line asks for painterly, densely shaded work**, and the
  negative list forbids flat fills and single-colour areas outright. That is
  the whole fix for the quality gap.
- **Lighting is described as doing something** — spilling across panelling,
  pooling on surfaces, reflecting in the floor — rather than just existing.
  Light with somewhere to land is what fills a flat surface with tones.
- **Surfaces have materials**: scuffed, weathered, ribbed, smoked. A named
  material gets shaded; "a wall" gets filled.
- The console wings stay gone, said three times, and everything about the
  window, soffit, columns and floor layout that worked is unchanged.

## Still not built

The sixteen `backdrops/` prompts have never been generated and the engine
does not composite anything into the keyed window yet. The glass stays
black until that is wired — short job once one backdrop exists.
