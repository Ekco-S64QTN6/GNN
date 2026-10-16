
# GNN — Daypart Show Logo & Broadcast Overlay Prompts

Generated for the new daypart shows defined in ROADMAP.md §3 that don't yet have logos, plus broadcast system overlays (boot splash test card, breaking news alert frame). The existing five show logos (`main_desk`, `market_desk`, `fleet_briefing`, `tech_desk`, `the_spotlight`) are in `misc_new_prompts_test.md` — this file covers the remaining shows and system assets.

---

## How to use this

**Copy the whole fenced block and paste it. That is the entire job.** Each block already says what size to make the image, so there is nothing to set up beforehand and nothing to remember. Everything outside the block is for you — where to save the file, and the occasional note.

Show logos are `1024x1024` — square marks on full transparency, matching the existing logos in `logos/`.

Broadcast overlays use `1792x1024` — full-bleed plates matching the broadcast frame at 1.78:1.

**Nothing has to be the right pixel size or colour count** when it leaves the image model. `tools/condition_plates.py` fits every plate to the frame, removes the black fringe left on cut-out edges, hardens the alpha and cuts the palette to 256. Shape is the only thing you have to get right.

**Run the conditioner on each batch before judging it:** `python3 tools/condition_plates.py --preview`.

**Do not paraphrase the style or negative lines.** They are what makes generated art cut together with the art decoded from the game.

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


# New Daypart Show Logos

### `logos/galactic_morning_watch.png`

Save the result as `assets/generated/logos/galactic_morning_watch.png`.

The 06:00–09:00 GST morning wire show. Fast, snappy, high-energy sunrise energy.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a television show title logo: the letters GNN in a bold geometric capital letterform with a subtle bevel, and beneath them in smaller capitals the words GALACTIC MORNING WATCH, and above the letters a small emblem of a rising sun cresting over the curved horizon of a planet, warm rays radiating outward, the emblem in polished gold with amber and orange gradient rays. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: warm amber, sunrise orange, polished gold, cream white lettering. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than GNN and GALACTIC MORNING WATCH, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `logos/sector_midday_wire.png`

Save the result as `assets/generated/logos/sector_midday_wire.png`.

The 09:00–12:00 GST geopolitics and council desk broadcast.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a television show title logo: the letters GNN in a bold geometric capital letterform with a subtle bevel, and beneath them in smaller capitals the words SECTOR MIDDAY WIRE, and above the letters a small emblem of a telegraph key sending an electrical pulse along a wire that arcs into a small star, the emblem in brushed silver with electric blue pulse highlights. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: brushed silver, electric blue, clean white, cool grey lettering. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than GNN and SECTOR MIDDAY WIRE, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `logos/deep_space_economy.png`

Save the result as `assets/generated/logos/deep_space_economy.png`.

The 12:00–15:00 GST markets, trade, and mining financial broadcast.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a television show title logo: the letters GNN in a bold geometric capital letterform with a subtle bevel, and beneath them in smaller capitals the words DEEP SPACE ECONOMY, and above the letters a small emblem of a stylised line graph trending upward with small data nodes at its peaks, set against a faint grid backdrop, the emblem in polished brass with a green trend-line and amber node dots. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: polished brass, market green trend line, amber nodes, deep navy backdrop, cream lettering. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than GNN and DEEP SPACE ECONOMY, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `logos/evening_rim_report.png`

Save the result as `assets/generated/logos/evening_rim_report.png`.

The 15:00–18:00 GST flagship primetime broadcast.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a television show title logo: the letters GNN in a bold geometric capital letterform with a subtle bevel, and beneath them in smaller capitals the words THE EVENING RIM REPORT, and above the letters a small emblem of a planet's terminator line with the darkened hemisphere facing right and the lit crescent on the left, city lights twinkling on the dark side, the emblem in polished steel with deep navy and amber city-glow accents. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: deep navy, polished steel, warm amber city glow, ivory lettering. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than GNN and THE EVENING RIM REPORT, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `logos/council_crossfire.png`

Save the result as `assets/generated/logos/council_crossfire.png`.

The 18:00–21:00 GST high-conflict debate panel. Hot, confrontational energy.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a television show title logo: the letters GNN in a bold geometric capital letterform with a subtle bevel, and beneath them in smaller capitals the words COUNCIL CROSSFIRE, and above the letters a small emblem of two crossed lightning bolts meeting at a central impact flash, the bolts in polished chrome with a hot red-orange spark burst at the intersection. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: hot red-orange, polished chrome, hazard amber, bone white lettering on dark. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than GNN and COUNCIL CROSSFIRE, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `logos/anomaly_late_night.png`

Save the result as `assets/generated/logos/anomaly_late_night.png`.

The 21:00–00:00 GST deepfield, science, and tech late-night show. Mysterious, contemplative.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a television show title logo: the letters GNN in a bold geometric capital letterform with a subtle bevel, and beneath them in smaller capitals the words ANOMALY LATE NIGHT, and above the letters a small emblem of a geometric anomaly symbol — a circle with a diagonal slash through it and a question mark in the upper half, the circle in brushed dark titanium with a faint phosphor-green edge glow. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: dark titanium, phosphor green, deep indigo, muted silver lettering. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than GNN and ANOMALY LATE NIGHT, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `logos/galaxy_shop.png`

Save the result as `assets/generated/logos/galaxy_shop.png`.

The 00:00–03:00 GST QVC-spoof tele-shopping extravaganza. Gaudy, energetic, consumer madness.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a television show title logo: the letters GNN in a bold geometric capital letterform with a subtle bevel, and beneath them in larger flashier capitals the words GALAXY SHOP, and above the letters a small emblem of a shopping bag with a ringed planet emerging from the top, the bag in polished gold with hot magenta and cyan neon trim, the planet in brushed chrome. Framing: single logo mark, perfectly centred in the square frame with even margin on every side, the mark occupying about seventy percent of the frame width, composed so it reads clearly at small size. Palette: polished gold, hot magenta, cyan neon, chrome planet, warm cream lettering. Background: fully transparent, the mark cleanly cut out on empty transparency with no backdrop, vignette, halo or floor.

Do not include: captions, headlines, tickers, any text other than GNN and GALAXY SHOP, any border or frame, any drop shadow or outer glow, a background or scene of any kind, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

# Broadcast System Overlays

### `overlays/test_card.png`

Save the result as `assets/generated/overlays/test_card.png`.

The boot splash / test card screen shown while systems are loading (Web Audio, TTS, RSS). Holds the broadcast until everything is ready.

```
Create a 1792x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a retro television station test card screen for a science-fiction news network, centred composition with the letters GNN large and prominent in the upper centre in bold geometric capitals with a subtle bevel, below the letters a classic TV test pattern with concentric circles, colour calibration bars arranged in horizontal bands (red, green, blue, cyan, magenta, yellow, white, black), a thin crosshair at the exact centre, the words PLEASE STAND BY in clean capital letters in the lower third, the entire card has a faint CRT curvature vignette darkening the extreme corners, light horizontal scan lines visible across the image, the overall feel of a late-night broadcast that hasn't started yet. Framing: full-bleed plate, the test card filling the entire 1792x1024 frame edge to edge. Palette: classic test card primaries and secondaries, cool grey borders, warm amber GNN lettering. Background: full-bleed scene, no transparency.

Do not include: people, studios, furniture, pixel art, dithering, visible individual pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, modern logos, real-world brand names, real-world network names, photographic texture, watermarks, signatures.
```

---

### `overlays/breaking_news_frame.png`

Save the result as `assets/generated/overlays/breaking_news_frame.png`.

A transparent overlay frame for breaking news interrupts. The centre is clear for the anchor feed — only the border and alert elements are rendered.

```
Create a 1792x1024 image with a fully transparent background.

CRITICAL OUTPUT REQUIREMENT — REAL ALPHA TRANSPARENCY

Output a PNG with a genuine RGBA alpha channel. This is a compositing overlay, not a flattened illustration.

The entire centre of the image must contain actual transparent pixels (alpha = 0). Only the border frame elements, alert badges, and corner graphics should be opaque. Do not render any scene, background, or fill in the transparent central area.

---

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a breaking news alert overlay frame for a science-fiction television news broadcast, the frame is a bold pulsing-red border approximately 30 pixels wide running along all four edges of the image, the corners have angular reinforced bracket shapes in bright warning red and white, the top centre of the border contains a horizontal banner badge with the words BREAKING NEWS in bold white capitals on a vivid red field, small rotating hazard chevrons in the upper left and right corners, the entire interior of the frame is completely transparent and empty, designed to overlay live broadcast footage. Framing: full border overlay, edges fully opaque red border, entire interior fully transparent. Palette: vivid warning red, bright white, hazard amber chevrons. Background: fully transparent interior, only the border elements are opaque.

Do not include: any content in the centre of the frame, people, studios, furniture, any text other than BREAKING NEWS, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, modern logos, real-world brand names, photographic texture, watermarks, signatures.
```

---

**9 prompts total (7 daypart logos + 2 broadcast overlays).** Save each one to the path under its filename, then run `python3 tools/condition_plates.py --preview`.

## Conditioning note

`condition_plates.py` does not currently have paths for `overlays/`. The test card goes into a new directory and will need a conditioning entry. The breaking news frame requires alpha preservation similar to the studio sets — use the same RGBA pipeline as `Studio_Newsroom_prompts.md` plates.
