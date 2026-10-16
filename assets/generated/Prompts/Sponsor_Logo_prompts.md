
# GNN — Corporate Sponsor Logo & Badge Prompts

Generated for commercial break sponsor cards, bug overlays, and infomercial title treatments. Each logo is a standalone insignia on transparency, designed to composite at any scale as a corner bug, lower-third sponsor card, or full-frame commercial bumper.

---

## How to use this

**Copy the whole fenced block and paste it. That is the entire job.** Each block already says what size to make the image, so there is nothing to set up beforehand and nothing to remember. Everything outside the block is for you — where to save the file, and the occasional note.

Sponsor logos are `1024x1024` — square marks on full transparency, same sizing as the show logos in `misc_new_prompts_test.md`.

**Nothing has to be the right pixel size or colour count** when it leaves the image model. `tools/condition_plates.py` fits every plate to the frame, removes the black fringe left on cut-out edges, hardens the alpha and cuts the palette to 256. Shape is the only thing you have to get right.

**Run the conditioner on each batch before judging it:** `python3 tools/condition_plates.py --preview`.

**Do not paraphrase the style or negative lines.** They are what makes generated art cut together with the art decoded from the game.

---

## Sponsor Logos

### `sponsors/orion_heavy_industries.png`

Save the result as `assets/generated/sponsors/orion_heavy_industries.png`.

Used for: Commercial break sponsor bumpers — *"This broadcast brought to you by Orion Heavy Industries."*

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a corporate logo insignia for a galactic shipbuilding megacorporation: a heavy stylised capital O containing a silhouette of a dreadnought warship in profile, flanked by two small orbital rings, the whole emblem rendered in brushed gunmetal steel with riveted edges and a warm amber backlight glow behind the O, beneath the emblem in smaller bold capitals the words ORION HEAVY INDUSTRIES. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: gunmetal grey, brushed steel, warm amber glow, bone white lettering. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than ORION HEAVY INDUSTRIES, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `sponsors/sirius_hyperdrive.png`

Save the result as `assets/generated/sponsors/sirius_hyperdrive.png`.

Used for: Commercial break sponsor bumpers — *"Sirius Hyper-Drive Systems — Moving the galaxy, one jump at a time."*

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a corporate logo insignia for a galactic propulsion engineering firm: a stylised starburst with elongated horizontal streaks radiating from a bright white central point suggesting a hyperspace jump, enclosed in a thin circular border of polished chrome, beneath the emblem in smaller bold capitals the words SIRIUS HYPER-DRIVE SYSTEMS. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: electric blue streaks, polished chrome ring, bright white central flare, cool blue-white lettering. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than SIRIUS HYPER-DRIVE SYSTEMS, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `sponsors/betelgeuse_pharmaceuticals.png`

Save the result as `assets/generated/sponsors/betelgeuse_pharmaceuticals.png`.

Used for: Overnight infomercial sponsor cards — *"Betelgeuse Pharmaceuticals — Better living through stellar chemistry."*

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a corporate logo insignia for a galactic pharmaceutical corporation: a stylised caduceus staff with twin helical strands suggesting DNA rather than snakes, a glowing amber star at the top of the staff, enclosed in a rounded shield shape of polished white enamel with a thin emerald green border, beneath the emblem in smaller bold capitals the words BETELGEUSE PHARMACEUTICALS. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: emerald green, clinical white enamel, warm amber star, silver staff. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than BETELGEUSE PHARMACEUTICALS, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `sponsors/rigel_agricultural_cartel.png`

Save the result as `assets/generated/sponsors/rigel_agricultural_cartel.png`.

Used for: Commercial break sponsor bumpers — *"Rigel Agricultural Cartel — Feeding ten thousand worlds."*

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a corporate logo insignia for a galactic agricultural conglomerate: a stylised sheaf of alien grain stalks tied together with a golden band, set against a disc of fertile green planet seen from orbit, thin golden border ring, beneath the emblem in smaller bold capitals the words RIGEL AGRICULTURAL CARTEL. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: harvest gold, fertile verdant green, warm earth brown, cream lettering. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than RIGEL AGRICULTURAL CARTEL, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `sponsors/darlok_security_solutions.png`

Save the result as `assets/generated/sponsors/darlok_security_solutions.png`.

Used for: Ominous late-night commercial bumpers — *"Darlok Security Solutions — You won't see us. That's the point."*

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a corporate logo insignia for a shadowy galactic security corporation: a hooded silhouette face in profile with two faint red points for eyes, enclosed in a hexagonal border of dark brushed titanium, a single thin red scan-line crossing the hexagon diagonally, beneath the emblem in smaller bold capitals the words DARLOK SECURITY SOLUTIONS. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: near-black titanium, deep charcoal, faint red accents, muted grey lettering. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than DARLOK SECURITY SOLUTIONS, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `sponsors/vex_sakkra_law.png`

Save the result as `assets/generated/sponsors/vex_sakkra_law.png`.

Used for: Overnight class-action legal syndication bumpers — *"Have you or a loved one been exposed to unshielded Zortrium radiation?"*

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a law firm insignia for a galactic class-action legal practice: a balanced scales of justice emblem with a small atom symbol on one pan and a stack of credits on the other, the scales mounted on a polished marble column, enclosed in a formal oval border of dark burgundy with gold trim, beneath the emblem in smaller serif capitals the words VEX & SAKKRA ATTORNEYS AT LAW. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: burgundy, polished gold, white marble, cream serif lettering. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than VEX & SAKKRA ATTORNEYS AT LAW, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

**6 sponsor logo prompts.** Save each one to the path under its filename, then run `python3 tools/condition_plates.py --preview`.
