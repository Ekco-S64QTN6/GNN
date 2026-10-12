# Show logos and title cards

Two asset types here, and they have very different costs. Worth being straight about that before the prompts.

**The logos are easy.** A wordmark on transparency, five of them, drops straight into the engine as a fading overlay.

**The cast title cards are not.** The existing anchor art is all *seated* with hands clasped — every prompt in `prompts.md` asks for that explicitly. A standing cast photo needs new drawings of every character in a standing pose. Two ways to do it:

- **One-shot title cards** — one image per show with both anchors already composited into the set. Five generations total. Simple, fast, testable today. The cost is that the set and the characters will look *slightly* different from the broadcast versions, because the model is drawing its own studio each time.
- **Standing anchor plates** — one transparent plate per character in a standing pose, composited in the engine over the studio. Consistent with the broadcast. Costs ~10 new character generations (one per seat across five shows), and they'd sit in `anchors/standing/` as a new class of asset.

The prompts below are the **one-shot** version. That's the thing to test first — five images tells you if the whole idea works before you commit to ten character plates.

The title card asks for the logo **baked into the image**. If you'd rather overlay the standalone logo in the engine and keep the card clean, drop that line — but baking it in is the version that looks like an actual broadcast bumper.

---

# Show logos

Five, one per show. Square, transparent, sized to scale anywhere — full-frame bumper, corner bug, lower-third mark. No drop shadow, no outer glow: the engine owns the fade and any compositing halo.

### `logos/main_desk.png`

Save the result as `assets/generated/logos/main_desk.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a television show title logo: the letters GNN in a bold geometric capital letterform with a subtle bevel, and beneath them in smaller capitals the words MAIN DESK, and above the letters a small globe emblem with a single thin orbital ring crossing it at a shallow angle, the emblem in brushed steel with faint amber glow at its highlight. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: pale steel and bone white, cool white light, warm amber accents. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than GNN and MAIN DESK, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### `logos/market_desk.png`

Save the result as `assets/generated/logos/market_desk.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a television show title logo: the letters GNN in a bold geometric capital letterform with a subtle bevel, and beneath them in smaller capitals the words MARKET DESK, and above the letters a small emblem of a beam balance scale with a single gold coin resting in each pan, the emblem in polished brass with warm reflected light. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: deep forest green, warm brass, cream, amber highlights. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than GNN and MARKET DESK, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### `logos/fleet_briefing.png`

Save the result as `assets/generated/logos/fleet_briefing.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a television show title logo: the letters GNN in a bold geometric capital letterform with a subtle bevel, and beneath them in smaller capitals the words FLEET BRIEFING, and above the letters a small emblem of a stylised starship chevron seen head-on, a downward-pointing arrowhead of polished steel with a thin warning-red band across its face. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: gunmetal grey, warning red, sand, cold white highlights. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than GNN and FLEET BRIEFING, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### `logos/tech_desk.png`

Save the result as `assets/generated/logos/tech_desk.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a television show title logo: the letters GNN in a bold geometric capital letterform with a subtle bevel, and beneath them in smaller capitals the words TECH DESK, and above the letters a small emblem of a circuit node — a glowing cyan dot with four short traces running outward in a cross, each trace terminating in a small square pad, the whole emblem softly edge-lit. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: cyan, magenta, deep indigo, phosphor green, pale composite white. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than GNN and TECH DESK, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### `logos/the_spotlight.png`

Save the result as `assets/generated/logos/the_spotlight.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a television show title logo: the letters GNN in a bold geometric capital letterform with a subtle bevel, and beneath them in smaller capitals the words THE SPOTLIGHT, and above the letters a small emblem of a six-pointed star with a soft beam of pale light widening upward from it, the star in polished gold with a bright specular centre. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: hot pink, violet, gold, warm cream. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than GNN and THE SPOTLIGHT, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

# Cast title cards

Five, one per show. Full-bleed `1792x1024`, same shape as the cutaways. Both anchors in frame, posed, in front of the set that belongs to that show, with the show's title mark in the composition.

Each character description is lifted verbatim from that character's `_desk_hero.png` prompt in `prompts.md`. Only two things change: the pose (`seated` → `standing`, hands clasped → arms at sides, chest-up framing → full body), and the group-shot framing around them. Everything else — the species description, the uniform, the GNN badge — is unchanged, which is what keeps the figures recognisable as the same characters.

Two-anchor group shots are the hardest thing to ask an image model for. Expect to run a few attempts per card. The most common failure modes to watch for: the two characters drift into being the same species, the left one mirrors the right, hands end up wrong, and the set drifts from the one in `set-prompts.md`.

### `titlecards/main_desk.png`

Save the result as `assets/generated/titlecards/main_desk.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a wide broadcast title card for the television programme GNN MAIN DESK, two figures standing side by side in a brightly lit starship news studio. On the left, a Human Commander, a grey-haired human officer in a high-collar uniform, lined face, calm expression, wearing a GNN-badged broadcast uniform, standing upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms relaxed at their sides, full body visible from head to feet. On the right, a Mrrshan Matriarch, a tawny feline alien with slit pupils, tufted ears and a short muzzle, finer-boned and longer-maned than the male, jewelled cuffs on the ears, wearing a GNN-badged broadcast uniform, standing upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms relaxed at their sides, full body visible from head to feet. Both about the same height, a comfortable quarter-frame of clear space between them. The set recedes behind them: a curved panoramic window behind a wide oval anchor desk, pale structural columns at either end carrying vertical strips of cool white light, a curved ceiling soffit overhead with recessed downlights. The window is filled with a black starfield and a distant blue-green planet. The desk sits in the mid-ground, its back edge one straight unbroken horizontal line, its front face carrying a lit strip and a recessed panel reading GNN with GALACTIC NEWS NETWORK small beneath it. The words GNN MAIN DESK sit as a title mark in the upper right of the frame, in bold geometric capitals with a subtle bevel.

Framing: wide title card plate, full bleed to all four edges, no border and no frame, the two figures centred and clearly readable at a glance, the set behind them filling the frame edge to edge, empty space around the title mark.

Palette: warm ambers and oxblood reds, brass highlights, cool white light, bright overall. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, any text other than GNN, GALACTIC NEWS NETWORK, GNN MAIN DESK and the small GNN badge on each anchor's uniform, people other than the two figures, chairs, extra furniture, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### `titlecards/market_desk.png`

Save the result as `assets/generated/titlecards/market_desk.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a wide broadcast title card for the television programme GNN MARKET DESK, two figures standing side by side in a brightly lit starship financial news studio. On the left, a Mrrshan, a tawny feline alien with slit pupils, tufted ears and a short muzzle, wearing a GNN-badged broadcast uniform, standing upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms relaxed at their sides, full body visible from head to feet. On the right, a Meklar, a cyborg with a segmented metal faceplate, exposed cabling and a single glowing optical band, wearing a GNN-badged broadcast uniform, standing upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms relaxed at their sides, full body visible from head to feet. Both about the same height, a comfortable quarter-frame of clear space between them. The set recedes behind them: a wide window with a shallow arched top behind a wide anchor desk, slim brass mullions, fluted brass pilasters on either side, a stepped ceiling overhead with recessed warm downlights. The window is filled with a black starfield and a distant amber world. The desk sits in the mid-ground, its back edge one straight unbroken horizontal line, its top surface dark polished lacquer with a brass border, its front face carrying a lit strip and a recessed panel reading GNN with MARKET DESK small beneath it. The words GNN MARKET DESK sit as a title mark in the upper right of the frame, in bold geometric capitals with a subtle bevel.

Framing: wide title card plate, full bleed to all four edges, no border and no frame, the two figures centred and clearly readable at a glance, the set behind them filling the frame edge to edge, empty space around the title mark.

Palette: deep forest green, warm brass, cream, amber highlights, bright overall. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, any text other than GNN, GALACTIC NEWS NETWORK, GNN MARKET DESK and the small GNN badge on each anchor's uniform, people other than the two figures, chairs, extra furniture, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### `titlecards/fleet_briefing.png`

Save the result as `assets/generated/titlecards/fleet_briefing.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a wide broadcast title card for the television programme GNN FLEET BRIEFING, two figures standing side by side in a brightly lit starship strategic affairs studio. On the left, a Bulrathi, a large brown-furred bear-like alien, heavy brow, broad shoulders, wearing a GNN-badged broadcast uniform, standing upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms relaxed at their sides, full body visible from head to feet. On the right, a Darlok, a hooded shadow-shrouded figure whose face is an indistinct darkness with two faint red points, wearing a GNN-badged broadcast uniform, standing upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms relaxed at their sides, full body visible from head to feet. Both about the same height, a comfortable quarter-frame of clear space between them. The set recedes behind them: a heavy rectangular viewport behind a wide anchor desk with thick structural bracing dividing it into panes, square steel columns at either end carrying vertical strips of cold white light, an exposed ceiling truss overhead with downward spotlights. The window is filled with a black starfield and a distant shipyard silhouette. The desk sits in the mid-ground, its back edge one straight unbroken horizontal line, its top surface matte dark steel with a thin inset red line, its front face carrying a lit strip and a recessed panel reading GNN with FLEET BRIEFING small beneath it. The words GNN FLEET BRIEFING sit as a title mark in the upper right of the frame, in bold geometric capitals with a subtle bevel.

Framing: wide title card plate, full bleed to all four edges, no border and no frame, the two figures centred and clearly readable at a glance, the set behind them filling the frame edge to edge, empty space around the title mark.

Palette: gunmetal grey, warning red, sand, cold white highlights, bright overall. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, any text other than GNN, GALACTIC NEWS NETWORK, GNN FLEET BRIEFING and the small GNN badge on each anchor's uniform, people other than the two figures, chairs, extra furniture, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### `titlecards/tech_desk.png`

Save the result as `assets/generated/titlecards/tech_desk.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a wide broadcast title card for the television programme GNN TECH DESK, two figures standing side by side in a brightly lit starship technology news studio. On the left, a Psilon, a slender grey-skinned alien with an enormous domed cranium and huge black eyes, wearing a GNN-badged broadcast uniform, standing upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms relaxed at their sides, full body visible from head to feet. On the right, a Klackon, an insectoid alien with chitinous plating, mandibles and compound eyes, wearing a GNN-badged broadcast uniform, standing upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms relaxed at their sides, full body visible from head to feet. Both about the same height, a comfortable quarter-frame of clear space between them. The set recedes behind them: a wide curved window behind a wide anchor desk, slim aluminium mullions dividing it into panes, slender square columns at either end carrying vertical strips of phosphor-green light, a seamless curved ceiling overhead with a soft band of downlight. The window is filled with a black starfield and a distant orbital structure silhouette. The desk sits in the mid-ground, its back edge one straight unbroken horizontal line, its top surface pale brushed aluminium with an inset cyan edge-lit line, its front face carrying a lit strip and a recessed panel reading GNN with TECH DESK small beneath it. The words GNN TECH DESK sit as a title mark in the upper right of the frame, in bold geometric capitals with a subtle bevel.

Framing: wide title card plate, full bleed to all four edges, no border and no frame, the two figures centred and clearly readable at a glance, the set behind them filling the frame edge to edge, empty space around the title mark.

Palette: cyan, magenta, deep indigo, phosphor green, pale composite white, bright overall. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, any text other than GNN, GALACTIC NEWS NETWORK, GNN TECH DESK and the small GNN badge on each anchor's uniform, people other than the two figures, chairs, extra furniture, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### `titlecards/the_spotlight.png`

Save the result as `assets/generated/titlecards/the_spotlight.png`.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a wide broadcast title card for the television programme GNN THE SPOTLIGHT, two figures standing side by side in a brightly lit starship entertainment news studio. On the left, a Mrrshan Matriarch, a tawny feline alien with slit pupils, tufted ears and a short muzzle, finer-boned and longer-maned than the male, jewelled cuffs on the ears, wearing a GNN-badged broadcast uniform, standing upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms relaxed at their sides, full body visible from head to feet. On the right, a Alkari, an avian alien with a hooked beak, crest feathers and bright round eyes, wearing a GNN-badged broadcast uniform, standing upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms relaxed at their sides, full body visible from head to feet. Both about the same height, a comfortable quarter-frame of clear space between them. The set recedes behind them: a tall theatrical arch behind a wide anchor desk divided by slim gold mullions into a curved fan of panes, slender gold columns at either end carrying vertical strips of warm rose light, a domed ceiling overhead with a ring of recessed downlights and hidden coloured cove light. The arch is filled with a black starfield and a distant violet nebula. The desk sits in the mid-ground, its back edge one straight unbroken horizontal line, its top surface glossy black lacquer with a gold border, its front face carrying a lit strip and a recessed panel reading GNN with THE SPOTLIGHT small beneath it. The words GNN THE SPOTLIGHT sit as a title mark in the upper right of the frame, in bold geometric capitals with a subtle bevel.

Framing: wide title card plate, full bleed to all four edges, no border and no frame, the two figures centred and clearly readable at a glance, the set behind them filling the frame edge to edge, empty space around the title mark.

Palette: hot pink, violet, gold, warm cream, bright overall. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, any text other than GNN, GALACTIC NEWS NETWORK, GNN THE SPOTLIGHT and the small GNN badge on each anchor's uniform, people other than the two figures, chairs, extra furniture, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

## Things to settle before generating

**Roster choices.** I've picked pairs that fit the show beats — Mrrshan and Meklar on the money desk, Bulrathi and Darlok on the war desk, Psilon and Klackon on tech. If the roster rotates differently, the pairs change; each card is one image, so it's a re-gen, not an edit.

**The Spotlight's cast.** Mrrshan matriarch and Alkari is a guess — no established pair exists for a celebrity/entertainment beat in `cast.js`. Swap freely.

**Conditioning.** Same note as the icons: `condition_plates.py` has no path for `logos/` or `titlecards/`. The logos want the `cutaways/`-style conditioning (fit to a plate size, hard palette) but keep their alpha; the title cards want the cutaway treatment exactly. Both need entries added before anything composites.

**Fades.** Once a logo PNG exists, the fade is an engine change — a new layer in `renderer.js` with a `globalAlpha` ramp, `ramp()`-compliant per constraint 8 if it's animating on an audible path. Nothing in the current renderer handles this yet, so the logos will land on disk before the broadcast can use them.
