
# GNN — Generated Asset Prompts

Produced by `tools/prompt_bridge.py`. Each one is a gap the Master of Orion 1 catalogue cannot fill: it has 75 usable cutaways and 124 portraits, but none cut out for a news set and nothing resembling a studio to put them in.

---

## How to use this

**Copy the whole fenced block and paste it. That is the entire job.** Each block already says what size to make the image, so there is nothing to set up beforehand and nothing to remember. Everything outside the block is for you — where to save the file, and the occasional note.

Two shapes are used. Rooms, backdrops and cutaways are `1792x1024`, because the broadcast frame is 320x180 (1.78:1) and a wide plate covers it without losing its sides. Characters and props are `1024x1024`, because they are subjects cut out on transparency rather than pictures of a frame.

**Nothing has to be the right pixel size or colour count** when it leaves the image model. `tools/condition_plates.py` fits every plate to the frame, removes the black fringe left on cut-out edges, hardens the alpha and cuts the palette to 256. Shape is the only thing you have to get right.

**Run the conditioner on each batch before judging it:** `python3 tools/condition_plates.py --preview`. For anchors it also checks the three states line up and tells you if they do not.

**Do not paraphrase the style or negative lines.** They are what makes generated art cut together with the art decoded from the game.


## Exterior Window Backdrops

What is seen **through** the window in the back wall — the view itself, not a picture of a window. The engine keys these into the window opening, so the glass, the mullions and the room are already there; a plate that draws them again arrives with two sets. Four moods across four times of day; the scheduler picks a mood per show block and the time of day from the clock. The plate is cropped to the opening, so keep the subject centred and clear of the edges.

#### `backdrops/earth_globe_dawn.png`

Save the result as `assets/generated/backdrops/earth_globe_dawn.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a blue-green homeworld filling most of the frame, seen from high orbit, the terminator line crossing it and city lights on the night side, the sun low and just clearing the limb, long raking light across the subject, deep black space behind. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `backdrops/earth_globe_day.png`

Save the result as `assets/generated/backdrops/earth_globe_day.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a blue-green homeworld filling most of the frame, seen from high orbit, the terminator line crossing it and city lights on the night side, full harsh sunlight from one side, crisp unfiltered detail, hard shadows, deep black space behind. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `backdrops/earth_globe_dusk.png`

Save the result as `assets/generated/backdrops/earth_globe_dusk.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a blue-green homeworld filling most of the frame, seen from high orbit, the terminator line crossing it and city lights on the night side, the sun almost gone behind the subject, a warm rim of light along its edge and the rest falling into shadow. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `backdrops/earth_globe_night.png`

Save the result as `assets/generated/backdrops/earth_globe_night.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a blue-green homeworld filling most of the frame, seen from high orbit, the terminator line crossing it and city lights on the night side, unlit by the sun, near-black, picked out only by its own running lights and a dense starfield behind. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `backdrops/asteroid_field_dawn.png`

Save the result as `assets/generated/backdrops/asteroid_field_dawn.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a working asteroid mining field in open space, rigs and running lights among slowly tumbling rock, the sun low and just clearing the limb, long raking light across the subject, deep black space behind. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `backdrops/asteroid_field_day.png`

Save the result as `assets/generated/backdrops/asteroid_field_day.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a working asteroid mining field in open space, rigs and running lights among slowly tumbling rock, full harsh sunlight from one side, crisp unfiltered detail, hard shadows, deep black space behind. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `backdrops/asteroid_field_dusk.png`

Save the result as `assets/generated/backdrops/asteroid_field_dusk.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a working asteroid mining field in open space, rigs and running lights among slowly tumbling rock, the sun almost gone behind the subject, a warm rim of light along its edge and the rest falling into shadow. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `backdrops/asteroid_field_night.png`

Save the result as `assets/generated/backdrops/asteroid_field_night.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a working asteroid mining field in open space, rigs and running lights among slowly tumbling rock, unlit by the sun, near-black, picked out only by its own running lights and a dense starfield behind. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `backdrops/colony_domes_dawn.png`

Save the result as `assets/generated/backdrops/colony_domes_dawn.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a colony of geodesic domes on a dusty plain under an alien sky, a distant ridgeline beyond, low warm light raking across the scene, long shadows. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `backdrops/colony_domes_day.png`

Save the result as `assets/generated/backdrops/colony_domes_day.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a colony of geodesic domes on a dusty plain under an alien sky, a distant ridgeline beyond, flat bright illumination, crisp detail, pale sky. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `backdrops/colony_domes_dusk.png`

Save the result as `assets/generated/backdrops/colony_domes_dusk.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a colony of geodesic domes on a dusty plain under an alien sky, a distant ridgeline beyond, deep orange and violet sky, rim-lit edges. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `backdrops/colony_domes_night.png`

Save the result as `assets/generated/backdrops/colony_domes_night.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a colony of geodesic domes on a dusty plain under an alien sky, a distant ridgeline beyond, near-black with artificial lights and starfield dominant. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `backdrops/orion_shipyard_dawn.png`

Save the result as `assets/generated/backdrops/orion_shipyard_dawn.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, the sun low and just clearing the limb, long raking light across the subject, deep black space behind. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `backdrops/orion_shipyard_day.png`

Save the result as `assets/generated/backdrops/orion_shipyard_day.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, full harsh sunlight from one side, crisp unfiltered detail, hard shadows, deep black space behind. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `backdrops/orion_shipyard_dusk.png`

Save the result as `assets/generated/backdrops/orion_shipyard_dusk.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, the sun almost gone behind the subject, a warm rim of light along its edge and the rest falling into shadow. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `backdrops/orion_shipyard_night.png`

Save the result as `assets/generated/backdrops/orion_shipyard_night.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, unlit by the sun, near-black, picked out only by its own running lights and a dense starfield behind. Framing: an unobstructed exterior view with nothing in the foreground, as if the camera were outside; wide plate, full bleed, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

Do not include: people, figures, silhouettes, astronauts, crew, any window frame, glass, mullions, struts or railings, any interior, room, cockpit, bridge or space-station module, any foreground object or framing device, captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---
