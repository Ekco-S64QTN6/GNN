
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

---

## Commercial Backdrops — Round 2 (2026-10-17)
Twenty-two more plates. Each one is already wired into `js/cutscene-manager.js` (`INFOMERCIAL_SCENES`) or `js/script-writer.js` (`SPONSORS[].stage`) and goes on air the moment the file exists — until then each spot keeps its current picture. Run `python3 tools/condition_plates.py` after dropping them in.

**Infomercial plates are the whole picture** — nothing is composited over them, the way the Antares IV vista works. Only the three `galaxy_shop_*` sets get a product still on their pedestal, so those prompts keep the pedestal empty and centred.

---

### `infomercials/ocean_villa_interior.png`

Save the result as `assets/generated/infomercials/ocean_villa_interior.png`.

Used by: **Ocean World Timeshare (TRILARIAN DEEP WATER RESORTS)**. The whole picture is the product — no still is composited over it.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. the interior of a luxury submerged villa three hundred metres under an alien ocean, photographed head-on from the living room, no people, a huge curved panoramic window filling the back wall showing a sunlit blue-green ocean with shafts of light, drifting bioluminescent jellyfish and a coral reef, a low white curved sofa and a glass table in the foreground, soft caustic light patterns rippling across the white floor and ceiling. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: ocean teal and turquoise, pearl white furniture, soft gold sunlight shafts, pale bioluminescent cyan. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/companionship_lounge.png`

Save the result as `assets/generated/infomercials/companionship_lounge.png`.

Used by: **Interspecies Companionship Registry (THE LONELY STARS SOCIETY)**. Warm, slightly too earnest. The joke is in the sincerity.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. an intimate orbital observation lounge set for a romantic dinner for two, photographed head-on, no people, a small round table with two mismatched chairs of different alien designs, one tall and narrow, one wide and low, candles in glowing crystal holders, a single alien flower in a vase, a vast window behind showing a pink and violet nebula and a ringed planet, soft warm lighting. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: warm rose and amber candlelight, violet and pink nebula, deep plum shadows, brass accents. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/debt_relief_office.png`

Save the result as `assets/generated/infomercials/debt_relief_office.png`.

Used by: **Interstellar Debt Consolidation (THE ORION DEBT RELIEF BUREAU)**. Reassuring corporate blandness with a hint of menace.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a reassuring corporate finance office on a busy trade station, photographed head-on, no people, a tidy steel desk with a single data terminal and a potted alien plant, a wall of glowing holographic graph panels behind it all showing lines trending downward into calm, a window on the right with a view of freighter traffic queuing at a docking ring, clean even office lighting. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: calm corporate blue and slate grey, soft white light, a single reassuring green accent, chrome trim. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/cybernetic_clinic.png`

Save the result as `assets/generated/infomercials/cybernetic_clinic.png`.

Used by: **Cybernetic Joint Replacement (MEKLAR LIFESPAN SOLUTIONS)**. Clean, clinical, robotic. Falls back to the supplement lab until it exists.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a gleaming cybernetic surgery clinic, photographed head-on, no people, an empty padded treatment chair in the centre under an articulated multi-armed robotic surgical rig, a wall rack behind displaying polished replacement robotic knees, elbows and hands on lit shelves, holographic skeleton diagram panels, sterile white and chrome surfaces. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: sterile white and polished chrome, cool cyan instrument light, small amber warning accents. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/cryosleep_bay.png`

Save the result as `assets/generated/infomercials/cryosleep_bay.png`.

Used by: **Cryosleep Injury Claims (VEX & SAKKRA ATTORNEYS)**. Eerie and a little neglected — the setting of the grievance.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a long colony-ship cryosleep bay, photographed down the central aisle with strong perspective, no people, rows of upright frosted cryogenic pods on both sides with soft blue interior glow, one pod near the front standing open and empty with mist spilling out onto the floor, a flickering status light, cold vapour hanging in the air. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: icy blue and frost white, deep steel grey, one warning red light. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/flight_simulator_cockpit.png`

Save the result as `assets/generated/infomercials/flight_simulator_cockpit.png`.

Used by: **Learn to Pilot From Home (ALTAIR SKY ACADEMY)**. The aspiration: the captain's chair.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. the cockpit of a small sleek starship seen from just behind the empty pilot's seat, no people, a wide wraparound canopy showing a star field streaking into hyperspace lines, glowing control yokes and throttle levers, rows of illuminated switches and holographic flight readouts without any text, the curve of a blue planet falling away below. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: deep space blue, white star streaks, glowing cyan and amber instrument light, gunmetal cockpit. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/orbital_memorial_chapel.png`

Save the result as `assets/generated/infomercials/orbital_memorial_chapel.png`.

Used by: **Final Expense Life Cover for Spacers (FIRST COLONIAL ASSURANCE)**. Dignified and calm. Must not look grim.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a quiet orbital memorial chapel, photographed head-on, no people, rows of simple pale benches facing a tall arched window that looks out on a calm blue planet and a sunrise over its horizon, soft light falling across a small altar with candles and a single sculpted star emblem without letters, a wall of small glowing remembrance lights. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: soft dawn gold and pale blue, warm ivory stone, gentle candlelight. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/gold_exchange_counter.png`

Save the result as `assets/generated/infomercials/gold_exchange_counter.png`.

Used by: **Precious Metals Buy-Back Programme (GNOLAM GOLD EXCHANGE)**. Gaudy. Gold everywhere.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. an opulent precious-metals exchange counter, photographed head-on, no people, a polished marble counter with brass scales and an assay scanner beam, vault door standing open behind it showing stacked glowing gold ingots and coils of gold wire, velvet rope barriers, chandeliers of crystal, a faint sheen on every surface. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: rich gold and brass, deep crimson velvet, black marble, warm chandelier light. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/executive_seminar_hall.png`

Save the result as `assets/generated/infomercials/executive_seminar_hall.png`.

Used by: **Executive Presence Masterclass (SIRIUS EXECUTIVE SERVICES)**. The seminar stage, waiting for its speaker.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a motivational seminar auditorium seen from the back of the audience, no people, rows of empty seats leading down to a bright stage with a single lectern under a dramatic spotlight, an enormous screen behind it showing an abstract upward-rising chart and a stylised mountain peak without any text, sweeping coloured stage lights. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: deep navy auditorium, white-hot spotlight, magenta and gold stage light sweeps. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/hull_breach_corridor.png`

Save the result as `assets/generated/infomercials/hull_breach_corridor.png`.

Used by: **At-Home Hull Patch Kit (TRANS-SECTOR REPAIR SERVICES)**. The problem the product solves. Falls back to the shipyard showroom.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a cramped starship maintenance corridor at night shift, photographed down its length, no people, a small jagged breach in the hull plating on the right wall with a shimmering emergency force-field film holding the vacuum out, stars visible through the hole, amber emergency lights strobing, a tool case standing open on the floor. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: gunmetal grey, amber emergency light, cold starlight blue through the breach. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/freight_cargo_dock.png`

Save the result as `assets/generated/infomercials/freight_cargo_dock.png`.

Used by: **Long-Haul Certification Programme (COLONIAL FREIGHT GUILD)**. Working-class pride. Falls back to the shipyard showroom.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a vast freight docking bay on a trade station, photographed from a raised gantry, no people, a long-haul cargo hauler with a blunt industrial hull docked under floodlights, stacked cargo containers in different colours, loading cranes and magnetic lifters, a huge open bay door showing the stars and a distant gas giant. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: industrial orange and steel grey, sodium floodlight yellow, deep space blue beyond. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/zortrium_mine_shaft.png`

Save the result as `assets/generated/infomercials/zortrium_mine_shaft.png`.

Used by: **Zortrium Exposure Class Action (VEX & SAKKRA ATTORNEYS)**. The ominous setting the lawyers describe. Falls back to the legal office.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a deep zortrium mining shaft lit by work lamps, photographed head-on, no people, a raw seam of glowing green crystalline ore running through the dark rock wall, abandoned mining drills and a hazard barrier, a faint green haze in the air, an elevator cage in the background rising into darkness. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: toxic glowing green, dark basalt grey, harsh white work lamps, hazard amber stripes. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/foundry_floor.png`

Save the result as `assets/generated/infomercials/foundry_floor.png`.

Used by: **Orion Heavy Industries (named sponsor)**. Heavy industry as heroic spectacle.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. an immense orbital foundry, photographed from a high gantry looking along the floor, no people, rivers of molten metal pouring from giant crucibles into hull-plate moulds, colossal robotic arms lifting a glowing starship hull section, showers of sparks, the dark curve of a planet visible through an open bay in the far wall. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: molten orange and white-hot yellow, deep iron grey, cold blue planet light. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/hyperspace_bridge.png`

Save the result as `assets/generated/infomercials/hyperspace_bridge.png`.

Used by: **Sirius Hyper-Drive Systems (named sponsor)**. Speed and prestige.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. the bridge of a luxury starliner at the moment of the jump to hyperspace, photographed from behind the empty command chairs, no people, the forward viewport filled with a tunnel of blue-white light streaks converging to a point, polished white consoles glowing softly, a sense of rushing speed. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: brilliant blue-white light, polished white and silver, deep indigo edges. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/pharmacy_med_bay.png`

Save the result as `assets/generated/infomercials/pharmacy_med_bay.png`.

Used by: **Betelgeuse Pharmaceuticals (named sponsor)**. Clean and trustworthy.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a bright modern starship medical bay pharmacy, photographed head-on, no people, a clean white counter with neatly arranged glowing vials and capsule dispensers, a wall of lit medicine drawers behind it, a soft green medical-cross light emblem without letters, a window showing a calm planet. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: clinical white, soft mint green, gentle teal light, silver trim. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/hydroponic_dome_fields.png`

Save the result as `assets/generated/infomercials/hydroponic_dome_fields.png`.

Used by: **Rigel Agricultural Cartel (named sponsor)**. Abundance under glass.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. the inside of a vast hydroponic farming dome at golden hour, photographed from a raised walkway, no people, terraced rows of lush green crops and golden grain under misting irrigation arms, glowing grow-light strips, the geodesic dome frame overhead with an alien sky and two suns setting beyond the glass. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: lush green and golden wheat, warm sunset amber, pale sky blue through the dome. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/security_monitoring_room.png`

Save the result as `assets/generated/infomercials/security_monitoring_room.png`.

Used by: **Darlok Security Solutions (named sponsor)**. Watchful and shadowy.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a dark security monitoring centre, photographed head-on, no people, a curved wall of dozens of glowing surveillance screens showing station corridors, docking bays and planets from above, a single empty high-backed chair in silhouette facing them, thin red scanning lines, deep shadows. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: deep black and charcoal, cold monitor blue, thin red laser accents. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/galaxy_shop_jewellery.png`

Save the result as `assets/generated/infomercials/galaxy_shop_jewellery.png`.

Used by: **Galaxy Shop — amber brooch, chronowatches, claw sheaths**. Luxury shop set. A product still is composited onto the pedestal: keep it empty and centred.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a luxury jewellery showcase set on a home shopping channel, photographed head-on, no people, a single round black velvet display pedestal in the centre of the frame under a soft spotlight, glass display cases with soft internal lighting along both sides, a deep burgundy curtain backdrop with small twinkling star lights. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the empty display pedestal centred in the frame with clear space above it. Palette: deep burgundy and black velvet, warm gold spotlight, crystal-white sparkle. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, products on the pedestal, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/galaxy_shop_expedition.png`

Save the result as `assets/generated/infomercials/galaxy_shop_expedition.png`.

Used by: **Galaxy Shop — survival envelope, shadow-weave cloak, energy cell, hunting optics**. Rugged outdoor-gear set. A product still is composited onto the pedestal: keep it empty and centred.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a rugged expedition-gear shopping set on a home shopping channel, photographed head-on, no people, a sturdy rock-and-metal display plinth in the centre of the frame under a spotlight, a painted backdrop of an alien canyon with twin moons, coils of climbing rope, a folded camp shelter and supply crates arranged at the sides. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the empty display pedestal centred in the frame with clear space above it. Palette: warm canyon orange and ochre, dusky violet sky, steel grey gear. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, products on the pedestal, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/galaxy_shop_home.png`

Save the result as `assets/generated/infomercials/galaxy_shop_home.png`.

Used by: **Galaxy Shop — basking stone, wind chimes, geode, grooming comb, storage lattice**. Cosy home-goods set. A product still is composited onto the pedestal: keep it empty and centred.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a cosy alien living-room shopping set on a home shopping channel, photographed head-on, no people, a low polished wooden display table in the centre of the frame under a warm spotlight, a comfortable sofa and soft rugs at the sides, a round window showing a gentle alien garden at dusk, warm lamps and shelves of decorative objects. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the empty display pedestal centred in the frame with clear space above it. Palette: warm honey wood, soft cream fabric, lamplight amber, dusky garden green. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, products on the pedestal, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/council_notice_chamber.png`

Save the result as `assets/generated/infomercials/council_notice_chamber.png`.

Used by: **Council public-service notices (`GNNScript.promo()` PSAs)**. Official and solemn. Not wired yet — notices currently use archive footage; wire it into the PSA spot when it exists.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. the empty chamber of the Galactic Council, photographed head-on, no people, a semicircle of tall carved seats of different alien designs facing a raised central dais, a great circular window above showing a spiral galaxy, banners of plain colour without symbols or letters hanging between pillars, soft ceremonial light. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: ceremonial deep blue and gold, white marble, soft galactic light. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `infomercials/operators_call_centre.png`

Save the result as `assets/generated/infomercials/operators_call_centre.png`.

Used by: **Infomercial tag shots — 'operators are standing by'**. Not wired yet — intended for the tag beat of every infomercial.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a busy late-night tele-sales call centre on an orbital station, photographed from the end of the room, no people, long rows of desks each with a glowing headset and a small holographic screen, warm desk lamps, a huge window behind showing a planet at night with city lights, a large ringing-phone light glowing on every desk. Framing: wide backdrop plate, full bleed to all four edges, no border and no frame, the scene filling the entire frame. Palette: night blue, warm desk-lamp amber, glowing cyan screens, city-light gold below. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```
