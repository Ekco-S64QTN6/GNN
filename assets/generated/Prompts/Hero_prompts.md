# GNN — Generated Asset Prompts

Produced by `tools/prompt_bridge.py`. Each one is a gap the Master of Orion 1 catalogue cannot fill: it has 75 usable cutaways and 124 portraits, but none cut out for a news set and nothing resembling a studio to put them in.

---

## How to use this

**Copy the whole fenced block and paste it. That is the entire job.** Each block already says what size to make the image, so there is nothing to set up beforehand and nothing to remember. Everything outside the block is for you — where to save the file, and the occasional note.

Two shapes are used. Rooms, backdrops and cutaways are `1792x1024`, because the broadcast frame is 320x180 (1.78:1) and a wide plate covers it without losing its sides. Characters and props are `1024x1024`, because they are subjects cut out on transparency rather than pictures of a frame.

**Nothing has to be the right pixel size or colour count** when it leaves the image model. `tools/condition_plates.py` fits every plate to the frame, removes the black fringe left on cut-out edges, hardens the alpha and cuts the palette to 256. Shape is the only thing you have to get right.

**Run the conditioner on each batch before judging it:** `python3 tools/condition_plates.py --preview`. For anchors it also checks the three states line up and tells you if they do not.

**Do not paraphrase the style or negative lines.** They are what makes generated art cut together with the art decoded from the game.

---

## Anchor Portraits

Three states per species. The engine crossfades `desk_hero` into `speaking` on whoever is talking and holds `listening` on everyone else, so the three have to be the same drawing with one thing changed — **make the hero first, then ask for the other two as edits of it.** Generating them separately gives three subtly different characters and the crossfade turns into a lurch.

No desk in these: the desk is its own plate, and the anchors sit between the room and it. The hands matter — an anchor with their hands on the desk reads as sitting at it, and one cropped at the chest reads as standing behind it. Draw the hands resting on nothing; the desk arrives under them later.

### Bulrathi

#### `anchors/bulrathi_desk_hero.png`

Save the result as `assets/generated/anchors/bulrathi_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a Bulrathi, a large brown-furred bear-like alien, heavy brow, broad shoulders, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/bulrathi_speaking.png`

Save the result as `assets/generated/anchors/bulrathi_speaking.png`.

**Upload `bulrathi_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/bulrathi_listening.png`

Save the result as `assets/generated/anchors/bulrathi_listening.png`.

**Upload `bulrathi_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the figure's left, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

### Psilon

#### `anchors/psilon_desk_hero.png`

Save the result as `assets/generated/anchors/psilon_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a Psilon, a slender grey-skinned alien with an enormous domed cranium and huge black eyes, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: cyan and magenta on deep indigo, phosphor-green readouts. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/psilon_speaking.png`

Save the result as `assets/generated/anchors/psilon_speaking.png`.

**Upload `psilon_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/psilon_listening.png`

Save the result as `assets/generated/anchors/psilon_listening.png`.

**Upload `psilon_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the figure's left, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

### Mrrshan

#### `anchors/mrrshan_desk_hero.png`

Save the result as `assets/generated/anchors/mrrshan_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a Mrrshan, a tawny feline alien with slit pupils, tufted ears and a short muzzle, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/mrrshan_speaking.png`

Save the result as `assets/generated/anchors/mrrshan_speaking.png`.

**Upload `mrrshan_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/mrrshan_listening.png`

Save the result as `assets/generated/anchors/mrrshan_listening.png`.

**Upload `mrrshan_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the figure's left, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

### Meklar

#### `anchors/meklar_desk_hero.png`

Save the result as `assets/generated/anchors/meklar_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a Meklar, a cyborg with a segmented metal faceplate, exposed cabling and a single glowing optical band, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/meklar_speaking.png`

Save the result as `assets/generated/anchors/meklar_speaking.png`.

**Upload `meklar_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/meklar_listening.png`

Save the result as `assets/generated/anchors/meklar_listening.png`.

**Upload `meklar_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the figure's left, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

### Sakkra

#### `anchors/sakkra_desk_hero.png`

Save the result as `assets/generated/anchors/sakkra_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a Sakkra, a green reptilian alien with a crested skull and vertical slit pupils, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/sakkra_speaking.png`

Save the result as `assets/generated/anchors/sakkra_speaking.png`.

**Upload `sakkra_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/sakkra_listening.png`

Save the result as `assets/generated/anchors/sakkra_listening.png`.

**Upload `sakkra_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the figure's left, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

### Alkari

#### `anchors/alkari_desk_hero.png`

Save the result as `assets/generated/anchors/alkari_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a Alkari, an avian alien with a hooked beak, crest feathers and bright round eyes, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: muted teal and bone white, warning-stripe yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/alkari_speaking.png`

Save the result as `assets/generated/anchors/alkari_speaking.png`.

**Upload `alkari_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/alkari_listening.png`

Save the result as `assets/generated/anchors/alkari_listening.png`.

**Upload `alkari_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the figure's left, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

### Darlok

#### `anchors/darlok_desk_hero.png`

Save the result as `assets/generated/anchors/darlok_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a Darlok, a hooded shadow-shrouded figure whose face is an indistinct darkness with two faint red points, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/darlok_speaking.png`

Save the result as `assets/generated/anchors/darlok_speaking.png`.

**Upload `darlok_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/darlok_listening.png`

Save the result as `assets/generated/anchors/darlok_listening.png`.

**Upload `darlok_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the figure's left, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

### Silicoid

#### `anchors/silicoid_desk_hero.png`

Save the result as `assets/generated/anchors/silicoid_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a Silicoid, a crystalline rock-bodied being with faceted mineral plates and glowing seams, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/silicoid_speaking.png`

Save the result as `assets/generated/anchors/silicoid_speaking.png`.

**Upload `silicoid_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/silicoid_listening.png`

Save the result as `assets/generated/anchors/silicoid_listening.png`.

**Upload `silicoid_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the figure's left, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

### Mrrshan Matriarch

#### `anchors/mrrshan_f_desk_hero.png`

Save the result as `assets/generated/anchors/mrrshan_f_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a Mrrshan Matriarch, a tawny feline alien with slit pupils, tufted ears and a short muzzle, finer-boned and longer-maned than the male, jewelled cuffs on the ears, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/mrrshan_f_speaking.png`

Save the result as `assets/generated/anchors/mrrshan_f_speaking.png`.

**Upload `mrrshan_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/mrrshan_f_listening.png`

Save the result as `assets/generated/anchors/mrrshan_f_listening.png`.

**Upload `mrrshan_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the figure's left, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

### Klackon

#### `anchors/klackon_desk_hero.png`

Save the result as `assets/generated/anchors/klackon_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a Klackon, an insectoid alien with chitinous plating, mandibles and compound eyes, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/klackon_speaking.png`

Save the result as `assets/generated/anchors/klackon_speaking.png`.

**Upload `klackon_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/klackon_listening.png`

Save the result as `assets/generated/anchors/klackon_listening.png`.

**Upload `klackon_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the figure's left, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

### Human Commander

#### `anchors/human_desk_hero.png`

Save the result as `assets/generated/anchors/human_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a Human Commander, a grey-haired human officer in a high-collar uniform, lined face, calm expression, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/human_speaking.png`

Save the result as `assets/generated/anchors/human_speaking.png`.

**Upload `human_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/human_listening.png`

Save the result as `assets/generated/anchors/human_listening.png`.

**Upload `human_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the figure's left, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```
