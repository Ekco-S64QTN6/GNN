# Newsroom set — four rooms to try

The last set of prompts were five descriptions of the room that already
exists, which is why none of them helped. These are four different rooms.

What is wrong with the current one, concretely:

- **The window is a slot.** It sits behind the anchors' heads at roughly a
  quarter of the frame's width and a sixth of its height. There is nowhere
  to put a planet, a fleet or a starfield and have anyone notice. It needs
  to be the dominant feature of the back wall.
- **It is a corridor, not a newsroom.** Instrument alcoves down both side
  walls reads as a ship's passageway. A newsroom is a room you could put a
  camera crew in.
- **The camera is too close.** The anchors are composited at a fixed size,
  so a tight room makes them look enormous in it. The back wall has to read
  as genuinely far away.

## What every one of these has to get right

- **The window is pure black.** The engine keys the space backdrop into it,
  so it must be a flat black area with nothing drawn in it — no stars, no
  planet, no glow. Nothing else in the room may be pure black.
- **The window is big**: roughly half the image wide and a third of it tall,
  centred on the back wall. State it in the prompt; models under-size
  windows otherwise.
- **The centre of the room is empty.** Two anchors and a desk are
  composited in afterwards. Their heads land at about 0.29 of the frame
  height and the desk's top edge at about 0.55, so the band between is
  going to be covered — the depth has to come from the floor in front, the
  ceiling, and the walls out to the sides.
- **1792x1024**, saved as `assets/generated/set/studio_wide_empty.png`, then
  `python3 tools/condition_plates.py`.

---

## A — Orbital observation deck

A viewing gallery converted into a studio. The back wall is one enormous
curved window and almost nothing else.

```
Create a 1792x1024 image.

Highly detailed modern pixel art, rich colour, crisp clean pixels with
careful dithering — the look of a modern pixel-art game, not a 1990s one.

The interior of an orbital observation deck being used as a television
studio, empty of people and furniture. A single vast curved panoramic
window dominates the back wall, filling roughly half the width of the image
and a third of its height, running from well above head height down to
waist height, divided by a few slender structural ribs. The room around it
is spare and open: a broad clear floor stretching toward the camera,
subtle inset lighting along the floor edge, a low ceiling rail of soft
downlights, and bare panelled side walls angling away out of frame. Seen
from a camera at seated eye level, looking level, with the window clearly
distant — the room should read as large and deep, not as a corridor.
Nothing in the middle of the room.

Palette: cool steel and slate blue, bone white trim, warm amber floor
lighting.

The window is a flat area of pure black, showing nothing at all.

Do not include: captions, headlines, tickers, labels, letters, numbers or
writing of any kind, people, desks, chairs or furniture of any sort, modern
logos, real-world brand names, watermarks, signatures.
```

---

## B — Hangar gallery

The newsroom overlooks a working dock. Scale and activity beyond the glass,
which also gives the backdrop somewhere believable to live.

```
Create a 1792x1024 image.

Highly detailed modern pixel art, rich colour, crisp clean pixels with
careful dithering.

The interior of a television studio built on a gallery above a starship
docking bay, empty of people and furniture. The back wall is an enormous
angled window looking out over the bay, filling roughly half the width of
the image and a third of its height, its frame a heavy industrial truss
with rivets and cable runs. Inside, the room is a working gallery: a broad
steel floor with painted deck markings in the foreground, handrails along
the sides, heavy ceiling girders overhead with clamp lights, and equipment
lockers set back against the side walls well out of the centre. Camera at
seated eye level, looking level, the window clearly distant so the gallery
reads as a large deep space. Nothing in the middle of the room.

Palette: gunmetal and oxidised steel, hazard yellow markings, cold white
work lights.

The window is a flat area of pure black, showing nothing at all.

Do not include: captions, headlines, tickers, labels, letters, numbers or
writing of any kind, people, desks, chairs or furniture of any sort, modern
logos, real-world brand names, watermarks, signatures.
```

---

## C — Atrium

A tall room rather than a wide one. The height is what makes the anchors
look small in it.

```
Create a 1792x1024 image.

Highly detailed modern pixel art, rich colour, crisp clean pixels with
careful dithering.

The interior of a tall atrium aboard a space station, set up as a
television studio, empty of people and furniture. The back wall rises well
above the camera and carries one huge window — roughly half the width of
the image and a third of its height, centred, with a heavy arched frame
and slender vertical mullions. Galleries and walkways run along both side
walls at two levels, receding toward the back, their railings catching the
light. A polished floor fills the foreground with soft reflections. High
overhead, a lighting rig on a lattice. Camera low, at seated eye level,
looking level across the space, with the far wall clearly distant so the
room reads as tall and deep. Nothing in the middle of the room.

Palette: pale stone grey and teal glass, brass railings, warm overhead
light.

The window is a flat area of pure black, showing nothing at all.

Do not include: captions, headlines, tickers, labels, letters, numbers or
writing of any kind, people, desks, chairs or furniture of any sort, modern
logos, real-world brand names, watermarks, signatures.
```

---

## D — Command spire

Glass wrapping the back and both sides, like a control tower. The most
dramatic of the four and the one that makes the backdrop do the most work.

```
Create a 1792x1024 image.

Highly detailed modern pixel art, rich colour, crisp clean pixels with
careful dithering.

The interior of a glass-walled command spire high above a planet, in use as
a television studio, empty of people and furniture. Tall windows wrap the
back wall and curve away along both sides, the central pane filling roughly
half the width of the image and a third of its height, their frames thin
and dark so the glass dominates. The floor is dark polished composite with
faint inlaid light strips running toward the back, catching reflections in
the foreground. A slim ring of ceiling lights above. The room is almost
bare — the architecture is the set. Camera at seated eye level looking
level out through the glass, the far wall clearly distant. Nothing in the
middle of the room.

Palette: near-black charcoal and deep blue glass, thin cyan light strips,
a single warm accent.

Every window pane is a flat area of pure black, showing nothing at all.

Do not include: captions, headlines, tickers, labels, letters, numbers or
writing of any kind, people, desks, chairs or furniture of any sort, modern
logos, real-world brand names, watermarks, signatures.
```

---

## One thing worth knowing before you spend a generation

The backdrops that go behind the window **do not exist yet** — the sixteen
`backdrops/` prompts in `prompts.md` have never been generated, and the
engine does not yet composite them into the keyed area. So whichever room
you pick, the window will be black until that is built.

If you want to see a room working with something behind the glass before
committing to it, generate one backdrop as well — `backdrops/earth_globe_day.png`
is the obvious one — and say so, and I will wire the keying.
