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

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Bulrathi, a large brown-furred bear-like alien, heavy brow, broad shoulders, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
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

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Psilon, a slender grey-skinned alien with an enormous domed cranium and huge black eyes, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: cyan and magenta on deep indigo, phosphor-green readouts. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
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

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Mrrshan, a tawny feline alien with slit pupils, tufted ears and a short muzzle, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
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

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Meklar, a cyborg with a segmented metal faceplate, exposed cabling and a single glowing optical band, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
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

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Sakkra, a green reptilian alien with a crested skull and vertical slit pupils, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
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

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Alkari, an avian alien with a hooked beak, crest feathers and bright round eyes, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: muted teal and bone white, warning-stripe yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
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

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Darlok, a hooded shadow-shrouded figure whose face is an indistinct darkness with two faint red points, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
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

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Silicoid, a crystalline rock-bodied being with faceted mineral plates and glowing seams, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
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

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Mrrshan Matriarch, a tawny feline alien with slit pupils, tufted ears and a short muzzle, finer-boned and longer-maned than the male, jewelled cuffs on the ears, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
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

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Klackon, an insectoid alien with chitinous plating, mandibles and compound eyes, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
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

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Human Commander, a grey-haired human officer in a high-collar uniform, lined face, calm expression, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
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

## Newsroom Set

The room the anchors sit in, as separate layers: the engine draws the room, then the anchors, then the desk in front of them. One baked picture of the whole scene would have nobody able to sit at it.

The window in the back wall must be **flat pure black** — that is what the engine keys the exterior backdrop into. Nothing else in the room may be pure black.

#### `set/studio_wide_empty.png`

Save the result as `assets/generated/set/studio_wide_empty.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. the interior of a starship television studio photographed from a seated camera at desk height, looking level across the room rather than down into it. A long shot: the back wall is far away, the side walls run steeply off toward it, and there is a clear stretch of empty floor between the camera and the back of the room. Bevelled hull panelling, a wide viewport set low in the far back wall at the height of a seated person, instrument consoles recessed into the side walls, overhead lighting rigs catching the tops of the walls, a shallow step in the floor partway back. No desk, no furniture in the centre, no figures. Framing: wide empty set plate, camera at seated eye level and perfectly level — no downward tilt, no view across a table top. One-point perspective with the vanishing point low and central. Deep: foreground floor in the bottom quarter, mid-ground empty, back wall small and distant. Palette: muted teal and bone white, warning-stripe yellow. Background: the viewport opening is a flat area of pure black, showing nothing at all — no stars, no planet, no light.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `set/desk_oval_front.png`

Save the result as `assets/generated/set/desk_oval_front.png`.

```
Create a 1792x1024 image with a fully transparent background.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a television news desk seen dead level from the front at seated eye height, so that only its front face is visible and none of its top surface. A broad shallow slab: a dark front panel with a lit strip along its upper edge, a recessed blank plate in the centre for a station emblem, and a narrow lip of brushed metal along the very top. Much wider than it is tall. The desk only, nothing behind or on it. Framing: front elevation, filling the width of the frame and only the lower third of its height, seen straight on with no perspective on the top surface. Palette: muted teal and bone white, warning-stripe yellow. Background: transparent background, the desk cleanly cut out.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `set/console_left.png`

Save the result as `assets/generated/set/console_left.png`.

```
Create a 1024x1024 image with a fully transparent background.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an angled wall-mounted instrument console with rows of small lit square indicator buttons and two small readout screens, seen from its right. Framing: single prop plate, the console filling the frame. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: transparent background, cleanly cut out.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `set/console_right.png`

Save the result as `assets/generated/set/console_right.png`.

```
Create a 1024x1024 image with a fully transparent background.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an angled wall-mounted instrument console with rows of small lit square indicator buttons and two small readout screens, seen from its left. Framing: single prop plate, the console filling the frame. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: transparent background, cleanly cut out.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

## PIP Cutaways

The footage behind the anchor's shoulder. One plate per story category; the keywords are what routes a story to it.

#### `cutaways/starship_battle.png`

Save the result as `assets/generated/cutaways/starship_battle.png`.

Shown behind the anchor for stories about: `fleet`, `war`, `invasion`, `attack`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. two capital starships exchanging beam fire across open space, hull plating glowing where it is struck, debris tumbling. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `cutaways/space_vortex.png`

Save the result as `assets/generated/cutaways/space_vortex.png`.

Shown behind the anchor for stories about: `physics`, `quantum`, `anomaly`, `wormhole`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a swirling gravitational vortex tearing a hole in a starfield, light bending around its rim. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `cutaways/planet_invasion.png`

Save the result as `assets/generated/cutaways/planet_invasion.png`.

Shown behind the anchor for stories about: `invasion`, `troops`, `siege`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. drop-pods streaking down through a planet atmosphere toward a defended colony, flak bursts around them. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `cutaways/hacker_code.png`

Save the result as `assets/generated/cutaways/hacker_code.png`.

Shown behind the anchor for stories about: `hack`, `cyber`, `breach`, `malware`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a dim terminal room, cascading columns of alien glyphs on a wall of screens, one operator silhouetted. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cyan and magenta on deep indigo, phosphor-green readouts. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `cutaways/council_vote.png`

Save the result as `assets/generated/cutaways/council_vote.png`.

Shown behind the anchor for stories about: `vote`, `council`, `senate`, `legislation`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a tiered alien council chamber mid-vote, delegates of several species raising voting tokens. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: warm ambers and oxblood reds, brass highlights. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `cutaways/asteroid_mining.png`

Save the result as `assets/generated/cutaways/asteroid_mining.png`.

Shown behind the anchor for stories about: `mining`, `minerals`, `resources`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. mining rigs clamped to a tumbling asteroid, ore conveyors and floodlights against black space. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `cutaways/virus_outbreak.png`

Save the result as `assets/generated/cutaways/virus_outbreak.png`.

Shown behind the anchor for stories about: `plague`, `virus`, `outbreak`, `disease`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a quarantined colony dome interior, figures in sealed suits under harsh amber warning light. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cyan and magenta on deep indigo, phosphor-green readouts. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `cutaways/station_trade.png`

Save the result as `assets/generated/cutaways/station_trade.png`.

Shown behind the anchor for stories about: `trade`, `cargo`, `economy`, `shipping`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a busy orbital trade station with freighters docked at radial arms, cargo moving along lit gantries. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `cutaways/solar_flare.png`

Save the result as `assets/generated/cutaways/solar_flare.png`.

Shown behind the anchor for stories about: `solar`, `flare`, `star`, `radiation`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an enormous solar prominence arcing off a star, a small silhouetted station in the foreground. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `cutaways/black_hole.png`

Save the result as `assets/generated/cutaways/black_hole.png`.

Shown behind the anchor for stories about: `black hole`, `gravity`, `singularity`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an accretion disc around a black hole, light smeared into a ring, a survey probe dwarfed beside it. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `cutaways/spy_infiltration.png`

Save the result as `assets/generated/cutaways/spy_infiltration.png`.

Shown behind the anchor for stories about: `spy`, `espionage`, `infiltration`, `sabotage`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a cloaked figure slipping through a sealed bulkhead door into a lit corridor, alarm strip glowing. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `cutaways/council_summit.png`

Save the result as `assets/generated/cutaways/council_summit.png`.

Shown behind the anchor for stories about: `treaty`, `summit`, `accord`, `diplomacy`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a formal summit table with ambassadors of several alien species seated opposite one another, banners behind. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: warm ambers and oxblood reds, brass highlights. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

## Exterior Window Backdrops

What is seen through the window in the back wall. Four moods across four times of day; the scheduler picks a mood per show block and the time of day from the clock. The engine fits these into the window opening and crops the overflow, so keep the subject centred and clear of the edges.

#### `backdrops/earth_globe_dawn.png`

Save the result as `assets/generated/backdrops/earth_globe_dawn.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a blue-green homeworld seen from high orbit through a wide studio window, terminator line crossing it, low warm light raking across the scene, long shadows. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `backdrops/earth_globe_day.png`

Save the result as `assets/generated/backdrops/earth_globe_day.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a blue-green homeworld seen from high orbit through a wide studio window, terminator line crossing it, flat bright illumination, crisp detail, pale sky. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `backdrops/earth_globe_dusk.png`

Save the result as `assets/generated/backdrops/earth_globe_dusk.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a blue-green homeworld seen from high orbit through a wide studio window, terminator line crossing it, deep orange and violet sky, rim-lit edges. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `backdrops/earth_globe_night.png`

Save the result as `assets/generated/backdrops/earth_globe_night.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a blue-green homeworld seen from high orbit through a wide studio window, terminator line crossing it, near-black with artificial lights and starfield dominant. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `backdrops/asteroid_field_dawn.png`

Save the result as `assets/generated/backdrops/asteroid_field_dawn.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a working asteroid mining field seen through a studio window, rigs and running lights among tumbling rock, low warm light raking across the scene, long shadows. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `backdrops/asteroid_field_day.png`

Save the result as `assets/generated/backdrops/asteroid_field_day.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a working asteroid mining field seen through a studio window, rigs and running lights among tumbling rock, flat bright illumination, crisp detail, pale sky. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `backdrops/asteroid_field_dusk.png`

Save the result as `assets/generated/backdrops/asteroid_field_dusk.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a working asteroid mining field seen through a studio window, rigs and running lights among tumbling rock, deep orange and violet sky, rim-lit edges. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `backdrops/asteroid_field_night.png`

Save the result as `assets/generated/backdrops/asteroid_field_night.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a working asteroid mining field seen through a studio window, rigs and running lights among tumbling rock, near-black with artificial lights and starfield dominant. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `backdrops/colony_domes_dawn.png`

Save the result as `assets/generated/backdrops/colony_domes_dawn.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a colony of geodesic domes on a dusty plain seen through a studio window, distant ridgeline beyond, low warm light raking across the scene, long shadows. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `backdrops/colony_domes_day.png`

Save the result as `assets/generated/backdrops/colony_domes_day.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a colony of geodesic domes on a dusty plain seen through a studio window, distant ridgeline beyond, flat bright illumination, crisp detail, pale sky. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `backdrops/colony_domes_dusk.png`

Save the result as `assets/generated/backdrops/colony_domes_dusk.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a colony of geodesic domes on a dusty plain seen through a studio window, distant ridgeline beyond, deep orange and violet sky, rim-lit edges. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `backdrops/colony_domes_night.png`

Save the result as `assets/generated/backdrops/colony_domes_night.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a colony of geodesic domes on a dusty plain seen through a studio window, distant ridgeline beyond, near-black with artificial lights and starfield dominant. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `backdrops/orion_shipyard_dawn.png`

Save the result as `assets/generated/backdrops/orion_shipyard_dawn.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, low warm light raking across the scene, long shadows. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `backdrops/orion_shipyard_day.png`

Save the result as `assets/generated/backdrops/orion_shipyard_day.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, flat bright illumination, crisp detail, pale sky. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `backdrops/orion_shipyard_dusk.png`

Save the result as `assets/generated/backdrops/orion_shipyard_dusk.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, deep orange and violet sky, rim-lit edges. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

#### `backdrops/orion_shipyard_night.png`

Save the result as `assets/generated/backdrops/orion_shipyard_night.png`.

```
Create a 1792x1024 image.

1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, near-black with artificial lights and starfield dominant. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, modern logos, real-world brand names, photorealistic faces or photographic texture, anti-aliasing, smooth gradients beyond 1993 VGA dithering, watermarks, signatures, 3D renders, airbrushed shading.
```

---

**65 prompts.** Save each one to the path under its filename, then run `python3 tools/condition_plates.py --preview`.
