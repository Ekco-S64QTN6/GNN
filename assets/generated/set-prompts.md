# Newsroom set — the prompt

Written from the reference the owner generated, not invented. My previous
attempts were wrong in two specific, measurable ways:

| | mine | the reference |
|---|---|---|
| window width | ~50% of the frame | **~80%** — it spans nearly the whole back wall |
| window height | ~33% | **~37%**, and it starts just under the ceiling |
| the room | "spare and open", "almost bare" | **dense** — console wings, light columns, ceiling soffit, cable runs |

The second one is the real error. A television studio is not minimalist
architecture; it is a room packed with equipment, screens, lighting rigs and
cabling, and that clutter is what makes it read as a working newsroom rather
than a lobby. Every prompt I wrote asked for the opposite.

---

## The prompt

```
Create a 1792x1024 image.

Highly detailed modern pixel art, rich colour, crisp clean pixels with
careful dithering — the look of a modern pixel-art game rather than a 1990s
one. Cinematic, densely detailed, confident lighting.

The set of a science-fiction television news studio, photographed head-on
from a camera at seated eye level. Empty — no people, no anchor desk in the
centre.

The back wall is one enormous curved panoramic window, gently arched,
spanning about eighty percent of the image width and reaching from just
below the ceiling down to roughly the middle of the frame. Slim dark
mullions divide it into a few tall panes. It is the dominant feature of the
room.

Framing it: a heavy dark structural column at each end of the window, each
carrying a tall vertical strip of cool white light running floor to
ceiling. Above, a curved ceiling soffit follows the arc of the window, its
underside set with recessed downlights, and behind it exposed lighting
trusses and rigging.

Flanking the empty centre, at desk height, an angled console wing on each
side: banks of illuminated control panels, small readout monitors, switch
rows and status lamps, turned inward toward the middle of the room. Warm
amber light strips run along their front edges. Loose cable runs cross the
floor behind them.

The floor is dark polished composite, reflecting the lights, and fills the
foreground of the frame. The far wall reads as genuinely distant — this is a
large room, not a corridor.

The centre of the room, between the two console wings, is completely empty
floor. Nothing stands there.

Palette: charcoal and gunmetal, cool white and cyan light strips, warm amber
accents.

Every pane of the window is a flat area of pure black, showing nothing at
all — no stars, no planet, no nebula, no glow. Nothing else in the room may
be pure black.

Do not include: captions, headlines, tickers, labels, letters, numbers or
writing of any kind, people, an anchor desk or any furniture in the centre
of the room, modern logos, real-world brand names, watermarks, signatures.
```

---

## Two things about that prompt worth knowing

**The window must come back pure black.** The reference has Earth and a
starfield painted into it, which looks far better — but the engine keys the
backdrop into that area, so anything drawn there becomes a permanent
painted-on sky that no story can change. If the model insists on filling it,
generate it anyway and say so; blacking it out afterwards is a two-minute job
and better than fighting the prompt.

**No desk in the centre.** The reference's desk is magnificent and is also
the reason the shot works, but ours is a separate plate so the anchors can
sit between the room and it. The side console wings are part of the room and
should stay — they are most of what makes it look like a studio.

## Variants, if the first comes back close but not right

Change one line of the prompt above and regenerate:

- **Too dark** — replace the palette line with: *"Palette: pale grey and
  brushed steel, bright even studio lighting, cyan and amber accents."*
- **Too cluttered in the centre** — add to the end: *"The middle third of
  the image, from the floor up to the window, is clear empty space."*
- **Window still too small** — replace the window sentence with: *"The back
  wall is almost entirely one vast curved window, edge to edge, interrupted
  only by two narrow columns at the far left and right."*
- **Camera still too close** — add: *"Shot from far back with a wide lens;
  the window is a long way from the camera and the floor runs a long way
  toward it."*

## Still not built

The sixteen `backdrops/` prompts in `prompts.md` have never been generated,
and the engine does not yet composite anything into the keyed window. The
glass stays black until that is wired — say the word and it is a short job
once one backdrop exists.
