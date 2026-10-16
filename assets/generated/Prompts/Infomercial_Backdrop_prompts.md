
# GNN — Infomercial & Galaxy Shop Backdrop Prompts

Generated for the **GNN Galaxy Shop** tele-shopping block (00:00–03:00 GST), **Overnight Infomercials / Paid Programming** (03:00–06:00 GST), and general commercial break demonstration stages. Each plate is a full-bleed `1792x1024` backdrop — a complete set with no people, composited behind product stills or presenters by the engine.

---

## How to use this

**Copy the whole fenced block and paste it. That is the entire job.** Each block already says what size to make the image, so there is nothing to set up beforehand and nothing to remember. Everything outside the block is for you — where to save the file, and the occasional note.

Backdrops are `1792x1024` — wide plates matching the broadcast frame at 1.78:1.

**Nothing has to be the right pixel size or colour count** when it leaves the image model. `tools/condition_plates.py` fits every plate to the frame, removes the black fringe left on cut-out edges, hardens the alpha and cuts the palette to 256. Shape is the only thing you have to get right.

**Run the conditioner on each batch before judging it:** `python3 tools/condition_plates.py --preview`.

**Do not paraphrase the style or negative lines.** They are what makes generated art cut together with the art decoded from the game.

---

## Infomercial & Shopping Stages

### `infomercials/galaxy_shop_stage.png`

Save the result as `assets/generated/infomercials/galaxy_shop_stage.png`.

The primary set for the GNN Galaxy Shop QVC-spoof tele-shopping segments.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a retro sci-fi home shopping network television studio set, photographed head-on from a camera at standing eye level, no people anywhere, a shiny metallic counter in the foreground centre with a clean product display area on top, illuminated holographic display screens in the background wall showing geometric diagrams and price readouts, vibrant neon accent strips in cyan and magenta along the ceiling and counter edges, CRT scanline aesthetic in the background monitors, a rotating display pedestal with a spotlight cone visible stage right of the counter, glossy dark floor reflecting the overhead lights. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the set filling the entire frame. Palette: dark charcoal walls, polished chrome counter, vibrant cyan and magenta neon accents, warm white spotlights. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, chairs, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/galaxy_shop_pedestal.png`

Save the result as `assets/generated/infomercials/galaxy_shop_pedestal.png`.

Close-up product demonstration pedestal for featured items — used as a background composite behind product plates.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a close-up view of a futuristic rotating product display pedestal in a darkened studio environment, the pedestal is a circular polished chrome platform with an inner ring of soft cyan LED lights, a single overhead spotlight creating a dramatic cone of warm amber light on the platform surface, the background is a smooth dark gradient fading to black with faint bokeh circles suggesting studio lights out of focus, reflective dark floor beneath the pedestal. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the pedestal centred in the lower third of the frame. Palette: polished chrome pedestal, cyan LED ring, warm amber spotlight cone, deep black background. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, products on the pedestal, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/legal_office.png`

Save the result as `assets/generated/infomercials/legal_office.png`.

Backdrop for class-action legal syndication commercials. A sombre, respectable law office.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. an interior of a prestigious galactic law firm office, photographed head-on, no people, a wide dark mahogany desk in the foreground, floor-to-ceiling shelves of alien legal volumes behind it, a window on the right showing a city-planet skyline at twilight with orbital traffic lights, warm amber desk lamp casting light across stacked data-pads, framed certificates and species-council seals on the wall, muted prestigious atmosphere, polished dark wood floor. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the office filling the entire frame. Palette: dark mahogany, warm amber lamplight, twilight blue through the window, muted gold accents. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/real_estate_vista.png`

Save the result as `assets/generated/infomercials/real_estate_vista.png`.

Backdrop for Bio-Dome Real Estate infomercial pitches. Beautiful terraformed planet vista.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a breathtaking vista from the observation deck of a newly terraformed planet, no people, looking out across a lush green valley dotted with geodesic bio-domes and landing pads, a crystal-clear lake in the middle distance reflecting a binary sunset with one amber and one blue-white star low on the horizon, wispy clouds in a gradient sky shifting from warm amber near the suns to deep twilight purple overhead, sleek residential structures nestled into hillsides with warm interior light. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the vista filling the entire frame. Palette: verdant green valleys, amber and blue-white sunset, twilight purple sky, warm residential lights. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/supplement_lab.png`

Save the result as `assets/generated/infomercials/supplement_lab.png`.

Backdrop for shady cognitive supplement infomercials. A suspiciously clean alien laboratory.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a suspiciously pristine alien pharmaceutical laboratory, photographed head-on, no people, a white countertop with perfectly arrayed glass vials and beakers containing luminous violet and teal liquids, a large centrifuge and scanning electron device on the bench, the back wall is a bank of frosted glass cabinets lit from within with soft blue light, the floor is white composite tile reflecting the ceiling lights, the overall atmosphere is aggressively clean and clinical in a way that feels performatively trustworthy. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the lab filling the entire frame. Palette: clinical white, frosted blue cabinet glow, luminous violet and teal liquids, chrome instruments. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/shipyard_showroom.png`

Save the result as `assets/generated/infomercials/shipyard_showroom.png`.

Backdrop for luxury starship and vehicle advertisements.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. the interior of a luxury orbital starship dealership showroom, photographed head-on, no people, a vast hangar-like space with a polished obsidian floor reflecting overhead lighting, a wide empty display platform in the centre front where a ship would sit, dramatic track spotlights angled down from exposed ceiling trusses, floor-to-ceiling windows on the far wall showing a docked fleet of gleaming civilian vessels against a starfield, chrome divider columns and velvet rope barriers at the sides. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the showroom filling the entire frame. Palette: polished obsidian, warm spotlights, chrome and velvet, starfield blue through the windows. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, ships on the display platform, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

**6 infomercial backdrop prompts.** Save each one to the path under its filename, then run `python3 tools/condition_plates.py --preview`.
