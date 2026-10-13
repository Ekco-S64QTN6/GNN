
# GNN — Generated Asset Prompts

Produced by `tools/prompt_bridge.py`. Each one is a gap the Master of Orion 1 catalogue cannot fill: it has 75 usable cutaways and 124 portraits, but none cut out for a news set and nothing resembling a studio to put them in.

---

## How to use this

**Copy the whole fenced block and paste it. That is the entire job.** Each block already says what size to make the image, so there is nothing to set up beforehand and nothing to remember. Everything outside the block is for you — where to save the file, and the occasional note.

Two shapes are used. Rooms, backdrops and cutaways are `1792x1024`, because the broadcast frame is 320x180 (1.78:1) and a wide plate covers it without losing its sides. Characters and props are `1024x1024`, because they are subjects cut out on transparency rather than pictures of a frame.

**Nothing has to be the right pixel size or colour count** when it leaves the image model. `tools/condition_plates.py` fits every plate to the frame, removes the black fringe left on cut-out edges, hardens the alpha and cuts the palette to 256. Shape is the only thing you have to get right.

**Run the conditioner on each batch before judging it:** `python3 tools/condition_plates.py --preview`. For anchors it also checks the three states line up and tells you if they do not.

**Do not paraphrase the style or negative lines.** They are what makes generated art cut together with the art decoded from the game.

## PIP Cutaways

The footage behind the anchor's shoulder. One plate per story category; the keywords are what routes a story to it.

#### `cutaways/starship_battle.png`

Save the result as `assets/generated/cutaways/starship_battle.png`.

Shown behind the anchor for stories about: `fleet`, `war`, `invasion`, `attack`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. two capital starships exchanging beam fire across open space, hull plating glowing where it is struck, debris tumbling. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `cutaways/space_vortex.png`

Save the result as `assets/generated/cutaways/space_vortex.png`.

Shown behind the anchor for stories about: `physics`, `quantum`, `anomaly`, `wormhole`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a swirling gravitational vortex tearing a hole in a starfield, light bending around its rim. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `cutaways/planet_invasion.png`

Save the result as `assets/generated/cutaways/planet_invasion.png`.

Shown behind the anchor for stories about: `invasion`, `troops`, `siege`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. drop-pods streaking down through a planet atmosphere toward a defended colony, flak bursts around them. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `cutaways/hacker_code.png`

Save the result as `assets/generated/cutaways/hacker_code.png`.

Shown behind the anchor for stories about: `hack`, `cyber`, `breach`, `malware`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a dim terminal room, cascading columns of alien glyphs on a wall of screens, one operator silhouetted. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cyan and magenta on deep indigo, phosphor-green readouts. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `cutaways/council_vote.png`

Save the result as `assets/generated/cutaways/council_vote.png`.

Shown behind the anchor for stories about: `vote`, `council`, `senate`, `legislation`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a tiered alien council chamber mid-vote, delegates of several species raising voting tokens. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: warm ambers and oxblood reds, brass highlights. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `cutaways/asteroid_mining.png`

Save the result as `assets/generated/cutaways/asteroid_mining.png`.

Shown behind the anchor for stories about: `mining`, `minerals`, `resources`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. mining rigs clamped to a tumbling asteroid, ore conveyors and floodlights against black space. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `cutaways/virus_outbreak.png`

Save the result as `assets/generated/cutaways/virus_outbreak.png`.

Shown behind the anchor for stories about: `plague`, `virus`, `outbreak`, `disease`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a quarantined colony dome interior, figures in sealed suits under harsh amber warning light. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cyan and magenta on deep indigo, phosphor-green readouts. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `cutaways/station_trade.png`

Save the result as `assets/generated/cutaways/station_trade.png`.

Shown behind the anchor for stories about: `trade`, `cargo`, `economy`, `shipping`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a busy orbital trade station with freighters docked at radial arms, cargo moving along lit gantries. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `cutaways/solar_flare.png`

Save the result as `assets/generated/cutaways/solar_flare.png`.

Shown behind the anchor for stories about: `solar`, `flare`, `star`, `radiation`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. an enormous solar prominence arcing off a star, a small silhouetted station in the foreground. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `cutaways/black_hole.png`

Save the result as `assets/generated/cutaways/black_hole.png`.

Shown behind the anchor for stories about: `black hole`, `gravity`, `singularity`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. an accretion disc around a black hole, light smeared into a ring, a survey probe dwarfed beside it. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `cutaways/spy_infiltration.png`

Save the result as `assets/generated/cutaways/spy_infiltration.png`.

Shown behind the anchor for stories about: `spy`, `espionage`, `infiltration`, `sabotage`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a cloaked figure slipping through a sealed bulkhead door into a lit corridor, alarm strip glowing. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `cutaways/council_summit.png`

Save the result as `assets/generated/cutaways/council_summit.png`.

Shown behind the anchor for stories about: `treaty`, `summit`, `accord`, `diplomacy`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a formal summit table with ambassadors of several alien species seated opposite one another, banners behind. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: warm ambers and oxblood reds, brass highlights. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```



**65 prompts.** Save each one to the path under its filename, then run `python3 tools/condition_plates.py --preview`.
