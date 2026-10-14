```markdown
# GNN — Generated Asset Prompts

Produced by `tools/prompt_bridge.py`. Each one is a gap the Master of Orion 1 catalogue cannot fill: it has 75 usable cutaways and 124 portraits, but none cut out for a news set and nothing resembling a studio to put them in.

---

## How to use this

**Copy the whole fenced block and paste it. That is the entire job.** Each block already says what size to make the image, so there is nothing to set up beforehand and nothing to remember. Everything outside the block is for you — where to save the file, and the occasional note.

Two shapes are used. Rooms, backdrops and cutaways are `1792x1024`, because the broadcast frame is 320x180 (1.78:1) and a wide plate covers it without losing its sides. Characters and props are `1024x1024`, because they are subjects cut out on transparency rather than pictures of a frame.

**The window panes are cut out of the plate with real alpha.** Every room prompt below leads with a hard transparency requirement and repeats it at the point of the window description. The image model must output a PNG with an RGBA alpha channel, and the window opening itself must contain transparent pixels — not black fill, not white fill, not any colour or simulated glow. The conditioner preserves that alpha through the resize and the palette step, so the renderer composites the backdrop directly into the transparent region.

**The model will not always honor alpha on the first try.** When it fails, the failure looks like a window filled with flat white or flat black instead of transparent pixels. If that happens, do not accept the image; regenerate. The prompts below are written to make this less likely, not to make it impossible.

**Nothing has to be the right pixel size or colour count** when it leaves the image model. `tools/condition_plates.py` fits every plate to the frame, removes the black fringe left on cut-out edges, hardens the alpha and cuts the palette to 256. Shape is the only thing you have to get right.

**Run the conditioner on each batch before judging it:** `python3 tools/condition_plates.py --preview`. For anchors it also checks the three states line up and tells you if they do not.

**Do not paraphrase the style or negative lines.** They are what makes generated art cut together with the art decoded from the game.

---

# The studio sets

Ten rooms, one per show block plus a few for the blocks that do not exist yet. Each is a complete newsroom in one image: the desk is drawn into the plate, not composited on from a separate image, because two separately-generated images never agreed on perspective, lighting or style.

Every prompt below shares the same skeleton — the hard alpha requirement at the top, style preamble, "Not pixel art" paragraph, "Clean, well-maintained surfaces", the room description, the desk, the floor, the furniture exclusion, the palette, the transparency repeat, and the exclusion list. Only the material palette, the window shape, the desk branding and one or two descriptive details change between sets.

The panels that follow all use the same wording for the desk structure, the back edge, the desk position on the frame, and the "apart from the desk the room is unfurnished" line, verbatim. Only the materials, the branding subtitle and the palette vary. Do not rewrite these blocks; if a set needs a different desk shape, that is a code change in the renderer, not a prompt change.

---

## 1. Main News Desk — `studio_wide_empty.png`

```
CRITICAL OUTPUT REQUIREMENT — REAL ALPHA TRANSPARENCY

Output a PNG with a genuine RGBA alpha channel. This is a compositing asset,
not a flattened illustration.

The window opening is the cutout region. It must contain actual transparent
pixels (alpha = 0), not white, not black, not coloured, not blurred, not
foggy, not luminous, not simulated transparency in any form. Do not render
any scene, background, atmosphere, lighting, reflection, star, planet,
nebula, glow, or other visual content inside that region — leave it empty.

The transparency must be present in the actual pixel data of the exported
PNG, not merely represented visually. Every part of the image that is not
the window opening must be fully opaque (alpha = 255) except for natural
anti-aliasing along the window mullions and the outer silhouette.

Treat the window opening as a geometric constraint. Everything outside it
must be rendered as instructed below. If genuine alpha transparency cannot
be produced, do not substitute a white or coloured fill and present it as
transparent — output nothing rather than a fake.

---

Create a 1792x1024 PNG image.

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

**The interior of every window pane is the transparent cutout region
specified above.** Only the mullions, the surrounding frame, and the
structure that borders the opening are drawn. Inside the mullions there is
nothing — transparent pixels only.

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

REMINDER: the window opening is real alpha transparency in the PNG, not a
colour, not a fill, not a glow, not a scene.

Do not include: pixel art, dithering, visible pixels, retro 8-bit or 16-bit
styling, rust, grime, weathering, decay, dim or moody lighting, flat
untextured surfaces, large areas of a single colour, any lettering anywhere
except GNN and GALACTIC NEWS NETWORK on the front of the desk, people,
chairs, control consoles, counters or any furniture other than the one
desk, modern logos, real-world brand names, watermarks, signatures.
```

---

## 2. Markets — `market_wide_empty.png`

```
CRITICAL OUTPUT REQUIREMENT — REAL ALPHA TRANSPARENCY

Output a PNG with a genuine RGBA alpha channel. This is a compositing asset,
not a flattened illustration.

The window opening is the cutout region. It must contain actual transparent
pixels (alpha = 0), not white, not black, not coloured, not blurred, not
foggy, not luminous, not simulated transparency in any form. Do not render
any scene, background, atmosphere, lighting, reflection, star, planet,
nebula, glow, or other visual content inside that region — leave it empty.

The transparency must be present in the actual pixel data of the exported
PNG, not merely represented visually. Every part of the image that is not
the window opening must be fully opaque (alpha = 255) except for natural
anti-aliasing along the window mullions and the outer silhouette.

Treat the window opening as a geometric constraint. Everything outside it
must be rendered as instructed below. If genuine alpha transparency cannot
be produced, do not substitute a white or coloured fill and present it as
transparent — output nothing rather than a fake.

---

Create a 1792x1024 PNG image.

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

**The interior of every window pane is the transparent cutout region
specified above.** Only the mullions, the surrounding frame, and the
structure that borders the opening are drawn. Inside the mullions there is
nothing — transparent pixels only.

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

REMINDER: the window opening is real alpha transparency in the PNG, not a
colour, not a fill, not a glow, not a scene.

Do not include: pixel art, dithering, visible pixels, retro 8-bit or 16-bit
styling, rust, grime, weathering, decay, dim or moody lighting, flat
untextured surfaces, large areas of a single colour, any lettering anywhere
except GNN and MARKET DESK on the front of the desk, people, chairs,
control consoles, counters or any furniture other than the one desk,
modern logos, real-world brand names, watermarks, signatures.
```

---

## 3. Geopolitics and war — `geopolitics_wide_empty.png`

```
CRITICAL OUTPUT REQUIREMENT — REAL ALPHA TRANSPARENCY

Output a PNG with a genuine RGBA alpha channel. This is a compositing asset,
not a flattened illustration.

The viewport opening is the cutout region. It must contain actual
transparent pixels (alpha = 0), not white, not black, not coloured, not
blurred, not foggy, not luminous, not simulated transparency in any form.
Do not render any scene, background, atmosphere, lighting, reflection,
star, planet, nebula, glow, or other visual content inside that region —
leave it empty.

The transparency must be present in the actual pixel data of the exported
PNG, not merely represented visually. Every part of the image that is not
the viewport opening must be fully opaque (alpha = 255) except for natural
anti-aliasing along the structural bracing and the outer silhouette.

Treat the viewport opening as a geometric constraint. Everything outside it
must be rendered as instructed below. If genuine alpha transparency cannot
be produced, do not substitute a white or coloured fill and present it as
transparent — output nothing rather than a fake.

---

Create a 1792x1024 PNG image.

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

**The interior of every viewport pane is the transparent cutout region
specified above.** Only the bracing, the frame, and the structure that
borders the opening are drawn. Inside the bracing there is nothing —
transparent pixels only.

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

REMINDER: the viewport opening is real alpha transparency in the PNG, not a
colour, not a fill, not a glow, not a scene.

Do not include: pixel art, dithering, visible pixels, retro 8-bit or 16-bit
styling, rust, grime, weathering, decay, dim or moody lighting, flat
untextured surfaces, large areas of a single colour, any lettering anywhere
except GNN and FLEET BRIEFING on the front of the desk, people, chairs,
control consoles, counters or any furniture other than the one desk,
modern logos, real-world brand names, watermarks, signatures.
```

---

## 4. AI and technology — `tech_wide_empty.png`

```
CRITICAL OUTPUT REQUIREMENT — REAL ALPHA TRANSPARENCY

Output a PNG with a genuine RGBA alpha channel. This is a compositing asset,
not a flattened illustration.

The window opening is the cutout region. It must contain actual transparent
pixels (alpha = 0), not white, not black, not coloured, not blurred, not
foggy, not luminous, not simulated transparency in any form. Do not render
any scene, background, atmosphere, lighting, reflection, star, planet,
nebula, glow, or other visual content inside that region — leave it empty.

The transparency must be present in the actual pixel data of the exported
PNG, not merely represented visually. Every part of the image that is not
the window opening must be fully opaque (alpha = 255) except for natural
anti-aliasing along the window mullions and the outer silhouette.

Treat the window opening as a geometric constraint. Everything outside it
must be rendered as instructed below. If genuine alpha transparency cannot
be produced, do not substitute a white or coloured fill and present it as
transparent — output nothing rather than a fake.

---

Create a 1792x1024 PNG image.

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

**The interior of every window pane is the transparent cutout region
specified above.** Only the mullions, the surrounding frame, and the
structure that borders the opening are drawn. Inside the mullions there is
nothing — transparent pixels only.

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

REMINDER: the window opening is real alpha transparency in the PNG, not a
colour, not a fill, not a glow, not a scene.

Do not include: pixel art, dithering, visible pixels, retro 8-bit or 16-bit
styling, rust, grime, weathering, decay, dim or moody lighting, flat
untextured surfaces, large areas of a single colour, any lettering anywhere
except GNN and TECH DESK on the front of the desk, people, chairs, control
consoles, counters or any furniture other than the one desk, modern logos,
real-world brand names, watermarks, signatures.
```

---

## 5. Celebrity and entertainment — `celebrity_wide_empty.png`

```
CRITICAL OUTPUT REQUIREMENT — REAL ALPHA TRANSPARENCY

Output a PNG with a genuine RGBA alpha channel. This is a compositing asset,
not a flattened illustration.

The arch opening is the cutout region. It must contain actual transparent
pixels (alpha = 0), not white, not black, not coloured, not blurred, not
foggy, not luminous, not simulated transparency in any form. Do not render
any scene, background, atmosphere, lighting, reflection, star, planet,
nebula, glow, or other visual content inside that region — leave it empty.

The transparency must be present in the actual pixel data of the exported
PNG, not merely represented visually. Every part of the image that is not
the arch opening must be fully opaque (alpha = 255) except for natural
anti-aliasing along the gold mullions and the outer silhouette.

Treat the arch opening as a geometric constraint. Everything outside it
must be rendered as instructed below. If genuine alpha transparency cannot
be produced, do not substitute a white or coloured fill and present it as
transparent — output nothing rather than a fake.

---

Create a 1792x1024 PNG image.

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

**The interior of every arch pane is the transparent cutout region
specified above.** Only the mullions, the keystone, the trim, and the
structure that borders the opening are drawn. Inside the mullions there is
nothing — transparent pixels only.

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

REMINDER: the arch opening is real alpha transparency in the PNG, not a
colour, not a fill, not a glow, not a scene.

Do not include: pixel art, dithering, visible pixels, retro 8-bit or 16-bit
styling, rust, grime, weathering, decay, dim or moody lighting, flat
untextured surfaces, large areas of a single colour, any lettering anywhere
except GNN and THE SPOTLIGHT on the front of the desk, people, chairs,
control consoles, counters or any furniture other than the one desk,
modern logos, real-world brand names, watermarks, signatures.
```

---

## 6. Sports and Fleet Briefs — `sports_wide_empty.png`

```
CRITICAL OUTPUT REQUIREMENT — REAL ALPHA TRANSPARENCY

Output a PNG with a genuine RGBA alpha channel. This is a compositing asset,
not a flattened illustration.

The window opening is the cutout region. It must contain actual transparent
pixels (alpha = 0), not white, not black, not coloured, not blurred, not
foggy, not luminous, not simulated transparency in any form. Do not render
any scene, background, atmosphere, lighting, reflection, star, planet,
nebula, glow, or other visual content inside that region — leave it empty.

The transparency must be present in the actual pixel data of the exported
PNG, not merely represented visually. Every part of the image that is not
the window opening must be fully opaque (alpha = 255) except for natural
anti-aliasing along the window mullions and the outer silhouette.

Treat the window opening as a geometric constraint. Everything outside it
must be rendered as instructed below. If genuine alpha transparency cannot
be produced, do not substitute a white or coloured fill and present it as
transparent — output nothing rather than a fake.

---

Create a 1792x1024 PNG image.

Detailed digital illustration of a science-fiction interior, in the manner
of pre-rendered art from an early-2000s space strategy game — the
generation after Master of Orion 1, not that game. Smooth rich shading with
real gradients, volumetric light, specular highlights on metal, and
reflections. High fidelity and finely detailed, the quality of a modern
game's concept art.

Not pixel art. No visible pixel grid, no dithering, no chunky blocks, no
retro or 8-bit or 16-bit styling.

Clean, well-maintained surfaces: brushed composite panel, matte black
rubber, smoked glass, crisp paint. No rust, no grime, no weathering, no
decay. Bright, focused, energetic studio lighting.

The set of a science-fiction television sports and mission-coverage studio,
brightly lit, photographed head-on from a camera at seated eye level. No
people anywhere.

The back wall is one broad rectangular window with gently chamfered top
corners, spanning about eighty percent of the image width and reaching from
just below the ceiling down to roughly the middle of the frame. Slim
composite mullions divide it into four wide panes, with a soft orange light
strip running along the top of the opening.

**The interior of every window pane is the transparent cutout region
specified above.** Only the mullions, the surrounding frame, and the
structure that borders the opening are drawn. Inside the mullions there is
nothing — transparent pixels only.

A broad flat column stands at each end of the window, each carrying a tall
vertical strip of launch-pad orange light. Above, a curved ceiling soffit
follows the top of the window, its underside set with a row of recessed
downlights in grey housings, and behind it an exposed lighting truss
carrying studio lamps aimed down into the room, filling it with light.

The side walls, beyond the columns, are faced in brushed composite panel
with a horizontal band of matte black running at shoulder height, receding
toward the back. High on each side wall, well above head height, a wide
slim wall-mounted monitor on a composite bracket, dark and switched off.

Centred in the room stands a wide anchor desk, seen slightly from above so
both its top surface and its front face are visible.

THE BACK EDGE OF THE DESK IS ONE STRAIGHT UNBROKEN HORIZONTAL LINE running
across the middle sixty percent of the image. No facets, no angled
segments, no stepped sections along that back edge — a single flat run, wide
enough for two people to sit side by side behind it with clear space
between them. Only beyond that straight run, at the far left and right
ends, may the desk angle forward toward the camera.

The desk's top surface is matte black with a soft orange trim line along
its border. Its front face carries a lit strip along its upper edge, a
large recessed centre panel reading GNN in bold letters with SPORTS AND
FLEET in small letters beneath it, and a smaller readout panel either side
with faint green glow. Its top edge sits about three fifths of the way down
the image. Nothing rests on it and nobody sits at it.

The floor is dark polished composite with a subtle tread pattern, softly
reflective, filling the foreground and echoing the lights above it in
broad soft highlights. Faint painted guide lines and a few neatly taped
cable runs toward the edges.

Apart from the desk the room is unfurnished: no control panels, no
counters, no consoles, no equipment at waist or desk height on either side.

Palette: launch-bay blue, pad orange, matte black, cool white, bright
overall.

REMINDER: the window opening is real alpha transparency in the PNG, not a
colour, not a fill, not a glow, not a scene.

Do not include: pixel art, dithering, visible pixels, retro 8-bit or 16-bit
styling, rust, grime, weathering, decay, dim or moody lighting, flat
untextured surfaces, large areas of a single colour, any lettering anywhere
except GNN and SPORTS AND FLEET on the front of the desk, people, chairs,
control consoles, counters or any furniture other than the one desk,
modern logos, real-world brand names, watermarks, signatures.
```

---

## 7. Diplomatic Chamber — `diplomatic_wide_empty.png`

```
CRITICAL OUTPUT REQUIREMENT — REAL ALPHA TRANSPARENCY

Output a PNG with a genuine RGBA alpha channel. This is a compositing asset,
not a flattened illustration.

The window opening is the cutout region. It must contain actual transparent
pixels (alpha = 0), not white, not black, not coloured, not blurred, not
foggy, not luminous, not simulated transparency in any form. Do not render
any scene, background, atmosphere, lighting, reflection, star, planet,
nebula, glow, or other visual content inside that region — leave it empty.

The transparency must be present in the actual pixel data of the exported
PNG, not merely represented visually. Every part of the image that is not
the window opening must be fully opaque (alpha = 255) except for natural
anti-aliasing along the mullions and the outer silhouette.

Treat the window opening as a geometric constraint. Everything outside it
must be rendered as instructed below. If genuine alpha transparency cannot
be produced, do not substitute a white or coloured fill and present it as
transparent — output nothing rather than a fake.

---

Create a 1792x1024 PNG image.

Detailed digital illustration of a science-fiction interior, in the manner
of pre-rendered art from an early-2000s space strategy game — the
generation after Master of Orion 1, not that game. Smooth rich shading with
real gradients, volumetric light, specular highlights on metal, and
reflections. High fidelity and finely detailed, the quality of a modern
game's concept art.

Not pixel art. No visible pixel grid, no dithering, no chunky blocks, no
retro or 8-bit or 16-bit styling.

Clean, well-maintained surfaces: pale marble, dark walnut wood, brushed
gold, smoked glass. No rust, no grime, no weathering, no decay. Warm, even,
formal studio lighting.

The set of a science-fiction television diplomatic-affairs studio, brightly
lit, photographed head-on from a camera at seated eye level. No people
anywhere.

The back wall is one tall formal window, spanning about eighty percent of
the image width and reaching from just below the ceiling down to roughly
the middle of the frame. Deep-set stone mullions divide it into three tall
panes, with a shallow ornamental arch across the top of the opening.

**The interior of every window pane is the transparent cutout region
specified above.** Only the mullions, the ornamental arch, and the
structure that borders the opening are drawn. Inside the mullions there is
nothing — transparent pixels only.

A marble pilaster stands at each end of the window, each carrying a tall
vertical strip of warm golden light. Above, a coffered ceiling soffit
follows the top of the wall, its underside set with recessed downlights in
shallow cups, and behind it an exposed lighting truss carrying studio lamps
aimed down into the room, filling it with light.

The side walls, beyond the pilasters, are panelled in dark walnut with gold
pinstripe inlay between the panels, receding toward the back. High on each
side wall, well above head height, a small framed wall-mounted monitor on a
gold bracket, dark and switched off.

Centred in the room stands a wide anchor desk, seen slightly from above so
both its top surface and its front face are visible.

THE BACK EDGE OF THE DESK IS ONE STRAIGHT UNBROKEN HORIZONTAL LINE running
across the middle sixty percent of the image. No facets, no angled
segments, no stepped sections along that back edge — a single flat run, wide
enough for two people to sit side by side behind it with clear space
between them. Only beyond that straight run, at the far left and right
ends, may the desk angle forward toward the camera.

The desk's top surface is dark polished walnut with a thin gold inlay
border. Its front face carries a lit strip along its upper edge, a large
recessed centre panel reading GNN in bold letters with COUNCIL FLOOR in
small letters beneath it, and a smaller readout panel either side. Its top
edge sits about three fifths of the way down the image. Nothing rests on it
and nobody sits at it.

The floor is dark polished marble with faint gold inlay, bright and
mirror-smooth, filling the foreground and reflecting the lit front of the
desk and the lights above it in long soft highlights. Faint inlaid guide
lines and a few neatly taped cable runs toward the edges.

Apart from the desk the room is unfurnished: no control panels, no
counters, no consoles, no equipment at waist or desk height on either side.

Palette: pale marble, dark walnut, warm gold, cream, bright overall.

REMINDER: the window opening is real alpha transparency in the PNG, not a
colour, not a fill, not a glow, not a scene.

Do not include: pixel art, dithering, visible pixels, retro 8-bit or 16-bit
styling, rust, grime, weathering, decay, dim or moody lighting, flat
untextured surfaces, large areas of a single colour, any lettering anywhere
except GNN and COUNCIL FLOOR on the front of the desk, people, chairs,
control consoles, counters or any furniture other than the one desk,
modern logos, real-world brand names, watermarks, signatures.
```

---

## 8. Late Night Anomaly Log — `anomaly_wide_empty.png`

```
CRITICAL OUTPUT REQUIREMENT — REAL ALPHA TRANSPARENCY

Output a PNG with a genuine RGBA alpha channel. This is a compositing asset,
not a flattened illustration.

The window opening is the cutout region. It must contain actual transparent
pixels (alpha = 0), not white, not black, not coloured, not blurred, not
foggy, not luminous, not simulated transparency in any form. Do not render
any scene, background, atmosphere, lighting, reflection, star, planet,
nebula, glow, or other visual content inside that region — leave it empty.

The transparency must be present in the actual pixel data of the exported
PNG, not merely represented visually. Every part of the image that is not
the window opening must be fully opaque (alpha = 255) except for natural
anti-aliasing along the steel mullions and the outer silhouette.

Treat the window opening as a geometric constraint. Everything outside it
must be rendered as instructed below. If genuine alpha transparency cannot
be produced, do not substitute a white or coloured fill and present it as
transparent — output nothing rather than a fake.

---

Create a 1792x1024 PNG image.

Detailed digital illustration of a science-fiction interior, in the manner
of pre-rendered art from an early-2000s space strategy game — the
generation after Master of Orion 1, not that game. Smooth rich shading with
real gradients, volumetric light, specular highlights on metal, and
reflections. High fidelity and finely detailed, the quality of a modern
game's concept art.

Not pixel art. No visible pixel grid, no dithering, no chunky blocks, no
retro or 8-bit or 16-bit styling.

Clean, well-maintained surfaces: dark matte panel, brushed steel, smoked
glass, crisp paint. No rust, no grime, no weathering, no decay. Low, cool,
blue-tinted lighting.

The set of a science-fiction television anomaly-monitoring studio, darkly
lit, photographed head-on from a camera at seated eye level. No people
anywhere.

The back wall is one tall narrow window, spanning about seventy percent of
the image width and reaching from just below the ceiling down to roughly
the middle of the frame. Slim steel mullions divide it into three tall
panes, and a soft blue light strip runs along the top of the opening.

**The interior of every window pane is the transparent cutout region
specified above.** Only the mullions, the surrounding frame, and the
structure that borders the opening are drawn. Inside the mullions there is
nothing — transparent pixels only.

A dark steel column stands at each end of the window, each carrying a tall
vertical strip of cold blue light. Above, a low ceiling soffit runs across
the top of the wall, its underside set with a sparse row of recessed
downlights in dark housings, and behind it an exposed lighting rig carrying
a few studio lamps aimed down into the room, filling it with a low blue
glow.

The side walls, beyond the columns, are faced in dark matte panel with a
row of thin sensor readout strips glowing faintly green, receding toward
the back. High on each side wall, well above head height, a wall-mounted
monitor on a steel bracket, dark and switched off.

Centred in the room stands a wide anchor desk, seen slightly from above so
both its top surface and its front face are visible.

THE BACK EDGE OF THE DESK IS ONE STRAIGHT UNBROKEN HORIZONTAL LINE running
across the middle sixty percent of the image. No facets, no angled
segments, no stepped sections along that back edge — a single flat run, wide
enough for two people to sit side by side behind it with clear space
between them. Only beyond that straight run, at the far left and right
ends, may the desk angle forward toward the camera.

The desk's top surface is dark matte panel with a faintly glowing cyan line
along its border. Its front face carries a lit strip along its upper edge,
a large recessed centre panel reading GNN in bold letters with ANOMALY LOG
in small letters beneath it, and a smaller readout panel either side
glowing with faint waveform traces. Its top edge sits about three fifths of
the way down the image. Nothing rests on it and nobody sits at it.

The floor is dark matte panel with a faintly reflective finish, filling the
foreground and reflecting the cyan and blue lights above it in soft shallow
highlights. Faint painted guide lines and a few neatly taped cable runs
toward the edges.

Apart from the desk the room is unfurnished: no control panels, no
counters, no consoles, no equipment at waist or desk height on either side.

Palette: deep indigo, cold blue, muted cyan, faint phosphor green, low and
cool overall but with visible detail everywhere.

REMINDER: the window opening is real alpha transparency in the PNG, not a
colour, not a fill, not a glow, not a scene.

Do not include: pixel art, dithering, visible pixels, retro 8-bit or 16-bit
styling, rust, grime, weathering, decay, flat untextured surfaces, large
areas of a single colour, any lettering anywhere except GNN and ANOMALY LOG
on the front of the desk, people, chairs, control consoles, counters or any
furniture other than the one desk, modern logos, real-world brand names,
watermarks, signatures.
```

---

## 9. Weather Center — `weather_wide_empty.png`

```
CRITICAL OUTPUT REQUIREMENT — REAL ALPHA TRANSPARENCY

Output a PNG with a genuine RGBA alpha channel. This is a compositing asset,
not a flattened illustration.

The window opening is the cutout region. It must contain actual transparent
pixels (alpha = 0), not white, not black, not coloured, not blurred, not
foggy, not luminous, not simulated transparency in any form. Do not render
any scene, background, atmosphere, lighting, reflection, star, planet,
nebula, glow, or other visual content inside that region — leave it empty.

The transparency must be present in the actual pixel data of the exported
PNG, not merely represented visually. Every part of the image that is not
the window opening must be fully opaque (alpha = 255) except for natural
anti-aliasing along the mullions and the outer silhouette.

Treat the window opening as a geometric constraint. Everything outside it
must be rendered as instructed below. If genuine alpha transparency cannot
be produced, do not substitute a white or coloured fill and present it as
transparent — output nothing rather than a fake.

---

Create a 1792x1024 PNG image.

Detailed digital illustration of a science-fiction interior, in the manner
of pre-rendered art from an early-2000s space strategy game — the
generation after Master of Orion 1, not that game. Smooth rich shading with
real gradients, volumetric light, specular highlights on metal, and
reflections. High fidelity and finely detailed, the quality of a modern
game's concept art.

Not pixel art. No visible pixel grid, no dithering, no chunky blocks, no
retro or 8-bit or 16-bit styling.

Clean, well-maintained surfaces: brushed composite panel, pale steel,
frosted glass, crisp paint. No rust, no grime, no weathering, no decay.
Bright, cool, even studio lighting.

The set of a science-fiction television weather and climate studio, brightly
lit, photographed head-on from a camera at seated eye level. No people
anywhere.

The back wall is one wide curved window, spanning about eighty percent of
the image width and reaching from just below the ceiling down to roughly
the middle of the frame. Slim composite mullions divide it into four broad
panes, with a soft cyan light strip running along the top of the opening.

**The interior of every window pane is the transparent cutout region
specified above.** Only the mullions, the surrounding frame, and the
structure that borders the opening are drawn. Inside the mullions there is
nothing — transparent pixels only.

A pale composite column stands at each end of the window, each carrying a
tall vertical strip of cool teal light. Above, a curved ceiling soffit
follows the arc of the window, its underside set with a long row of
recessed downlights in pale housings, and behind it an exposed lighting
truss carrying studio lamps aimed down into the room, filling it with
light.

The side walls, beyond the columns, are faced in pale composite panel with
a horizontal band of frosted glass at shoulder height, receding toward the
back. High on each side wall, well above head height, a wall-mounted
monitor on a pale bracket, dark and switched off.

Centred in the room stands a wide anchor desk, seen slightly from above so
both its top surface and its front face are visible.

THE BACK EDGE OF THE DESK IS ONE STRAIGHT UNBROKEN HORIZONTAL LINE running
across the middle sixty percent of the image. No facets, no angled
segments, no stepped sections along that back edge — a single flat run, wide
enough for two people to sit side by side behind it with clear space
between them. Only beyond that straight run, at the far left and right
ends, may the desk angle forward toward the camera.

The desk's top surface is pale brushed steel with a thin cyan inlay line
around its border. Its front face carries a lit strip along its upper edge,
a large recessed centre panel reading GNN in bold letters with WEATHER
DESK in small letters beneath it, and a smaller readout panel either side.
Its top edge sits about three fifths of the way down the image. Nothing
rests on it and nobody sits at it.

The floor is pale seamless composite with faintly glowing seams, softly
reflective, filling the foreground and mirroring the lit front of the desk
and the cool lights above it in clean even highlights. Faint inlaid guide
lines and a few neatly taped cable runs toward the edges.

Apart from the desk the room is unfurnished: no control panels, no
counters, no consoles, no equipment at waist or desk height on either side.

Palette: pale composite white, cool teal, soft cyan, muted grey, bright
overall.

REMINDER: the window opening is real alpha transparency in the PNG, not a
colour, not a fill, not a glow, not a scene.

Do not include: pixel art, dithering, visible pixels, retro 8-bit or 16-bit
styling, rust, grime, weathering, decay, dim or moody lighting, flat
untextured surfaces, large areas of a single colour, any lettering anywhere
except GNN and WEATHER DESK on the front of the desk, people, chairs,
control consoles, counters or any furniture other than the one desk,
modern logos, real-world brand names, watermarks, signatures.
```

---

## 10. Archive Vault — `archive_wide_empty.png`

```
CRITICAL OUTPUT REQUIREMENT — REAL ALPHA TRANSPARENCY

Output a PNG with a genuine RGBA alpha channel. This is a compositing asset,
not a flattened illustration.

The window opening is the cutout region. It must contain actual transparent
pixels (alpha = 0), not white, not black, not coloured, not blurred, not
foggy, not luminous, not simulated transparency in any form. Do not render
any scene, background, atmosphere, lighting, reflection, star, planet,
nebula, glow, or other visual content inside that region — leave it empty.

The transparency must be present in the actual pixel data of the exported
PNG, not merely represented visually. Every part of the image that is not
the window opening must be fully opaque (alpha = 255) except for natural
anti-aliasing along the mullion and the outer silhouette.

Treat the window opening as a geometric constraint. Everything outside it
must be rendered as instructed below. If genuine alpha transparency cannot
be produced, do not substitute a white or coloured fill and present it as
transparent — output nothing rather than a fake.

---

Create a 1792x1024 PNG image.

Detailed digital illustration of a science-fiction interior, in the manner
of pre-rendered art from an early-2000s space strategy game — the
generation after Master of Orion 1, not that game. Smooth rich shading with
real gradients, volumetric light, specular highlights on metal, and
reflections. High fidelity and finely detailed, the quality of a modern
game's concept art.

Not pixel art. No visible pixel grid, no dithering, no chunky blocks, no
retro or 8-bit or 16-bit styling.

Clean, well-maintained surfaces: aged brass, dark iron, thick glass rod
casing, dark painted panel. No rust, no grime, no weathering, no decay.
Warm, low, amber-tinted lighting.

The set of a science-fiction television archive and records room, warmly
lit, photographed head-on from a camera at seated eye level. No people
anywhere.

The back wall is one tall narrow window set high, spanning about fifty
percent of the image width and reaching from just below the ceiling down to
about a third of the frame. A single deep iron mullion divides it into two
tall panes. Below the window is a tall wall of brass-framed shelving,
visible to the camera, holding long glass rods of archival data in
individual slots.

**The interior of both window panes is the transparent cutout region
specified above.** Only the mullion, the surrounding frame, and the
structure that borders the opening are drawn. Inside the mullion there is
nothing — transparent pixels only.

An aged brass column stands at each end of the shelving, each carrying a
tall vertical strip of warm amber light. Above, a low iron ceiling runs
across the top of the wall, its underside set with a sparse row of recessed
downlights in brass housings, and behind it an exposed lighting rig
carrying a few studio lamps aimed down into the room, filling it with warm
light.

The side walls, beyond the columns, are faced in dark painted panel with
rows of small brass-framed drawers, receding toward the back. High on each
side wall, well above head height, a small framed wall-mounted monitor on
a brass bracket, dark and switched off.

Centred in the room stands a wide anchor desk, seen slightly from above so
both its top surface and its front face are visible.

THE BACK EDGE OF THE DESK IS ONE STRAIGHT UNBROKEN HORIZONTAL LINE running
across the middle sixty percent of the image. No facets, no angled
segments, no stepped sections along that back edge — a single flat run, wide
enough for two people to sit side by side behind it with clear space
between them. Only beyond that straight run, at the far left and right
ends, may the desk angle forward toward the camera.

The desk's top surface is dark iron with a thin brass inlay border. Its
front face carries a lit strip along its upper edge, a large recessed
centre panel reading GNN in bold letters with ARCHIVE in small letters
beneath it, and a smaller readout panel either side. Its top edge sits
about three fifths of the way down the image. Nothing rests on it and
nobody sits at it.

The floor is dark polished iron with a faint brass inlay pattern, softly
reflective, filling the foreground and reflecting the amber lights above it
in warm soft highlights. Faint painted guide lines and a few neatly taped
cable runs toward the edges.

Apart from the desk the room is unfurnished: no control panels, no
counters, no consoles, no equipment at waist or desk height on either side.

Palette: aged brass, dark iron, warm amber, cream, deep brown, warm
overall.

REMINDER: the window opening is real alpha transparency in the PNG, not a
colour, not a fill, not a glow, not a scene.

Do not include: pixel art, dithering, visible pixels, retro 8-bit or 16-bit
styling, rust, grime, weathering, decay, flat untextured surfaces, large
areas of a single colour, any lettering anywhere except GNN and ARCHIVE on
the front of the desk, people, chairs, control consoles, counters or any
furniture other than the one desk, modern logos, real-world brand names,
watermarks, signatures.
```

---

## What changed

Every prompt now leads with the block ChatGPT wrote, verbatim. That is the whole change to the structure — the scene description, desk wording, palette line and exclusion list are untouched from the previous version.

Three other adjustments were made inside the body of each prompt to reinforce the alpha requirement at the point where the window is actually described:

1. **The window paragraph now says "The interior of every window pane is the transparent cutout region specified above"** and describes only the mullions and frame as drawn. The old line — "Every pane of the window is cut out of the image — fully transparent" — was structurally identical, but said nothing about the region above. ChatGPT's suggestion to repeat the constraint in the paragraph where the window lives is what makes it harder for the model to ignore.

2. **A "REMINDER" line is added just before the exclusion list.** One sentence, restating that the opening is real alpha. It sits in a position where the model has already built a mental model of the scene, and it is the last content instruction before the do-not list.

3. **The `Do not include` line at the top has been replaced by the longer ChatGPT block.** The old line was there but did not name alpha or the pixel data explicitly. ChatGPT's version does both.

Two things worth knowing before you run these.

**ChatGPT's recommendation is not optimistic about the model's compliance.** Every word of the block it wrote is designed to make the requirement impossible to miss, but the last line of its own advice is that you should *verify or construct the alpha channel after generation rather than trusting the prompt alone*. In practice, if the first attempt comes back with white or black panes instead of transparent ones, the correct response is to regenerate — not to try the prompt again with a different wording. The prompt is as strong as the medium allows.

**The `condition_plates.py` change is still needed.** Even if the model honors alpha perfectly, `main()` still calls `punch_window()` for every room plate. That function calls `window_mask()`, which looks for black pixels in `SET_WINDOWS`. On a plate with real alpha there are no black pixels at the pane locations, so the mask returns `None`, `punch_window` returns the room unchanged, and the transparency survives to the output. That is the correct behaviour, but it is correct by accident. The clean fix, which was in the previous message, is to give `window_mask` an early return when the plate already has transparent regions, and to derive `layout.windows[setName]` from the alpha channel rather than from a threshold. That is a fifteen-line change and it removes the whole black-pixel path.
