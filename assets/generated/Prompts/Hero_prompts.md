
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

## The style, and why this file looks the way it does

The cast is drawn in the house style of a mid-1990s DOS-era strategy game portrait — the look of a character-selection screen from that era. Crisp dark outlines, deliberate pixel clusters, stepped colour transitions, ordered checkerboard dithering across shaded areas, a small palette. Every prompt below leads with the same preamble and repeats the same negative list. The wording is not decorative; `smooth shading`, `polished metallic highlights`, `high fidelity`, `finely detailed`, `volumetric light` and `specular highlights` have all been removed from the preamble because modern image models read those words as instructions to produce a photoreal CGI render, which is not the target.

The reference plates are `human_desk_hero.png` and `mrrshan_desk_hero.png`. When a prompt produces something that does not match those two plates, the model has drifted and the image should be regenerated rather than accepted.

---

## Anchor Portraits

Three states per species. The engine crossfades `desk_hero` into `speaking` on whoever is talking and holds `listening` on everyone else, so the three have to be the same drawing with one thing changed — **make the hero first, then ask for the other two as edits of it.** Generating them separately gives three subtly different characters and the crossfade turns into a lurch.

No desk in these: the desk is its own plate, and the anchors sit between the room and it. The hands matter — an anchor with their hands on the desk reads as sitting at it, and one cropped at the chest reads as standing behind it. Draw the hands resting on nothing; the desk arrives under them later.

The female variants are separate species entries, generated from their own prompt rather than as an edit of the male. That is deliberate: the model handles a described female character better than it handles an instruction to change a male drawing into a female one, and every attempt to use the male as a starting point produced a male body with a slightly different head.

Psilon has no female variant. Robot has no female variant.

---

### Bulrathi

#### `anchors/bulrathi_desk_hero.png`

Save the result as `assets/generated/anchors/bulrathi_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a Bulrathi, a large brown-furred bear-like alien, heavy brow, broad shoulders, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a human face, a single pair of eyes, hair, skin, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
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
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Psilon

#### `anchors/psilon_desk_hero.png`

Save the result as `assets/generated/anchors/psilon_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a Psilon, a slender grey-skinned alien with an enormous domed cranium and huge black eyes, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: cyan and magenta on deep indigo, phosphor-green readouts. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a human face, hair, skin, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
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
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Mrrshan

#### `anchors/mrrshan_desk_hero.png`

Save the result as `assets/generated/anchors/mrrshan_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a Mrrshan, a tawny feline alien with slit pupils, tufted ears and a short muzzle, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a human face, hair, skin, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
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
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Meklar

#### `anchors/meklar_desk_hero.png`

Save the result as `assets/generated/anchors/meklar_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a Meklar, a cyborg with a segmented metal faceplate, exposed cabling and a single glowing optical band, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a human face, hair, skin, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
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
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Sakkra

#### `anchors/sakkra_desk_hero.png`

Save the result as `assets/generated/anchors/sakkra_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a Sakkra, a green reptilian alien with a crested skull and vertical slit pupils, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a human face, hair, skin, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
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
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Alkari

#### `anchors/alkari_desk_hero.png`

Save the result as `assets/generated/anchors/alkari_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a Alkari, an avian alien with a hooked beak, crest feathers and bright round eyes, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, beak closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: muted teal and bone white, warning-stripe yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a human face, hair, skin, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/alkari_speaking.png`

Save the result as `assets/generated/anchors/alkari_speaking.png`.

**Upload `alkari_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the beak as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/alkari_listening.png`

Save the result as `assets/generated/anchors/alkari_listening.png`.

**Upload `alkari_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Beak stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Darlok

#### `anchors/darlok_desk_hero.png`

Save the result as `assets/generated/anchors/darlok_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a Darlok, a hooded shadow-shrouded figure whose face is an indistinct darkness with two faint red points, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a human face, hair, skin, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
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
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Silicoid

#### `anchors/silicoid_desk_hero.png`

Save the result as `assets/generated/anchors/silicoid_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a Silicoid, a crystalline rock-bodied being with faceted mineral plates and glowing seams, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a human face, hair, skin, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
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
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Klackon

#### `anchors/klackon_desk_hero.png`

Save the result as `assets/generated/anchors/klackon_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a Klackon, an insectoid alien with chitinous plating, mandibles and compound eyes, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a human face, hair, skin, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
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
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Human Commander

#### `anchors/human_desk_hero.png`

Save the result as `assets/generated/anchors/human_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a Human Commander, a grey-haired human officer in a high-collar uniform, lined face, calm expression, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
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
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Robot

The station's service robot, Unit 7. He was the MOO1 anchor in the original game — a golden boxy-headed machine with four red eyes and a horizontal mechanical mouth slot. He used to be 25 separate cels under a different naming convention and is now a normal species in the anchor pipeline.

#### `anchors/robot_desk_hero.png`

Save the result as `assets/generated/anchors/robot_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a golden service robot, boxy rectangular head, four glowing red eyes arranged two-by-two on the face, a horizontal mechanical slot below the eyes for a mouth, cylindrical segmented neck, round metal shoulder domes, gold-plated mechanical hands, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: warm gold and polished brass, deep red eye glow, crimson and navy uniform with gold piping. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a human face, a single pair of eyes, an organic mouth, hair, skin, fur or feathers on the head, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/robot_speaking.png`

Save the result as `assets/generated/anchors/robot_speaking.png`.

**Upload `robot_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mechanical mouth slot as if mid-word and brighten the eye glow. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/robot_listening.png`

Save the result as `assets/generated/anchors/robot_listening.png`.

**Upload `robot_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eye glow follows the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Bulrathi Female

#### `anchors/bulrathi_f_desk_hero.png`

Save the result as `assets/generated/anchors/bulrathi_f_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a female Bulrathi, a large brown-furred bear-like alien, heavy brow, softer features and a slighter frame than the male, and a clearly female chest under the uniform, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a male body with a female head, a flat chest, a masculine silhouette, a human face, hair, skin, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/bulrathi_f_speaking.png`

Save the result as `assets/generated/anchors/bulrathi_f_speaking.png`.

**Upload `bulrathi_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/bulrathi_f_listening.png`

Save the result as `assets/generated/anchors/bulrathi_f_listening.png`.

**Upload `bulrathi_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Mrrshan Matriarch

#### `anchors/mrrshan_f_desk_hero.png`

Save the result as `assets/generated/anchors/mrrshan_f_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a female Mrrshan Matriarch, a tawny feline alien with slit pupils, tufted ears and a short muzzle, finer-boned and longer-maned than the male, jewelled cuffs on the ears, and a clearly female chest under the uniform, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a male body with a female head, a flat chest, a masculine silhouette, a human face, human hair, human makeup, lipstick, eyeliner, beauty styling, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
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
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Meklar Female

#### `anchors/meklar_f_desk_hero.png`

Save the result as `assets/generated/anchors/meklar_f_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a female Meklar, a cyborg with a segmented metal faceplate, exposed cabling and a single glowing optical band, a narrower faceplate and slighter frame than the male, and a clearly female chest under the uniform, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a male body with a female head, a flat chest, a masculine silhouette, a human face, hair, skin, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/meklar_f_speaking.png`

Save the result as `assets/generated/anchors/meklar_f_speaking.png`.

**Upload `meklar_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/meklar_f_listening.png`

Save the result as `assets/generated/anchors/meklar_f_listening.png`.

**Upload `meklar_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Sakkra Female

#### `anchors/sakkra_f_desk_hero.png`

Save the result as `assets/generated/anchors/sakkra_f_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a female Sakkra, a green reptilian alien with a smaller crest than the male and vertical slit pupils, finer scales and a slighter frame than the male, and a clearly female chest under the uniform, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a male body with a female head, a flat chest, a masculine silhouette, a human face, hair, skin, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/sakkra_f_speaking.png`

Save the result as `assets/generated/anchors/sakkra_f_speaking.png`.

**Upload `sakkra_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/sakkra_f_listening.png`

Save the result as `assets/generated/anchors/sakkra_f_listening.png`.

**Upload `sakkra_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Alkari Female

#### `anchors/alkari_f_desk_hero.png`

Save the result as `assets/generated/anchors/alkari_f_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a female Alkari, an avian alien with a hooked beak, longer crest feathers than the male and bright round eyes, a slighter frame than the male, and a clearly female chest under the uniform, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, beak closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: muted teal and bone white, warning-stripe yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a male body with a female head, a flat chest, a masculine silhouette, a human face, human hair, glossy featherless skin, wings folded forward across the chest, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/alkari_f_speaking.png`

Save the result as `assets/generated/anchors/alkari_f_speaking.png`.

**Upload `alkari_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the beak as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/alkari_f_listening.png`

Save the result as `assets/generated/anchors/alkari_f_listening.png`.

**Upload `alkari_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Beak stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Darlok Female

#### `anchors/darlok_f_desk_hero.png`

Save the result as `assets/generated/anchors/darlok_f_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a female Darlok, a hooded shadow-shrouded figure whose face is an indistinct darkness with two faint red points, a narrower hood and slighter frame than the male, and a clearly female chest under the uniform, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a male body with a female head, a flat chest, a masculine silhouette, a human face, hair, skin, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/darlok_f_speaking.png`

Save the result as `assets/generated/anchors/darlok_f_speaking.png`.

**Upload `darlok_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/darlok_f_listening.png`

Save the result as `assets/generated/anchors/darlok_f_listening.png`.

**Upload `darlok_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Silicoid Female

#### `anchors/silicoid_f_desk_hero.png`

Save the result as `assets/generated/anchors/silicoid_f_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a female Silicoid, a crystalline rock-bodied being with finer faceted mineral plates and glowing seams, a slighter and more elongated frame than the male, and a clearly female chest under the uniform, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a male body with a female head, a flat chest, a masculine silhouette, a human face, hair, skin, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/silicoid_f_speaking.png`

Save the result as `assets/generated/anchors/silicoid_f_speaking.png`.

**Upload `silicoid_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/silicoid_f_listening.png`

Save the result as `assets/generated/anchors/silicoid_f_listening.png`.

**Upload `silicoid_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Klackon Female

#### `anchors/klackon_f_desk_hero.png`

Save the result as `assets/generated/anchors/klackon_f_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a female Klackon, an insectoid alien with finer chitinous plating than the male, smaller mandibles and compound eyes, a slighter frame than the male, and a clearly female chest under the uniform, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a male body with a female head, a flat chest, a masculine silhouette, a human face, hair, skin, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/klackon_f_speaking.png`

Save the result as `assets/generated/anchors/klackon_f_speaking.png`.

**Upload `klackon_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/klackon_f_listening.png`

Save the result as `assets/generated/anchors/klackon_f_listening.png`.

**Upload `klackon_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

### Human Commander (Female)

#### `anchors/human_f_desk_hero.png`

Save the result as `assets/generated/anchors/human_f_desk_hero.png`.

```
Create a 1024x1024 image with a fully transparent background.

1990s DOS-era sci-fi strategy game character portrait, classic 256-colour VGA pixel art. Hand-crafted pixel clusters, crisp dark outlines, stepped colour transitions, ordered checkerboard dithering across shaded areas, limited palette, high-contrast painted shading translated into deliberate pixel clusters, richly detailed faces and costumes, clean silhouette, symmetrical bust portrait, centered composition, transparent background. Restrained highlights, deep shadows, warm saturated colours, carefully defined material textures, intricate costume trim and insignia. Authentic retro game character-selection portrait, consistent pixel scale and outline weight throughout, no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no background scenery.

a female Human Commander, a brown-haired human officer in a high-collar uniform, lined face, calm expression, and a clearly female chest under the uniform, wearing a GNN-badged broadcast uniform, seated upright and square to camera, shoulders level, looking straight down the lens, mouth closed, forearms coming forward and hands resting loosely clasped in front of them at the very bottom of the frame, as if on a desk that is not drawn. No desk, no table, no furniture and no surface under the hands — the hands rest on nothing, and the desk is composited in afterwards. Framing: head, shoulders, chest and hands, cropped just below the hands, the head occupying the upper third. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: smooth vector edges, photorealism, CGI, modern concept-art rendering, airbrushed gradients, volumetric light, specular highlights, depth of field, ray tracing, anti-aliasing, a male body with a female head, a flat chest, a masculine silhouette, long flowing hair, glamour or fashion styling, heavy makeup, captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

#### `anchors/human_f_speaking.png`

Save the result as `assets/generated/anchors/human_f_speaking.png`.

**Upload `human_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

#### `anchors/human_f_listening.png`

Save the result as `assets/generated/anchors/human_f_listening.png`.

**Upload `human_f_desk_hero.png` first**, then paste this. It is an edit of that image, not a new one.

```
EDIT: turn the head about twenty degrees to the viewer's right, so they are looking at someone seated beside them rather than at the camera. The eyes follow the head. Mouth stays closed. This must be clearly visible — if the head still faces the camera the edit has failed. Same framing, same distance, same lighting; only the head turns.

Keep the image exactly 1024x1024 with the same fully transparent background. Keep the GNN badge on the uniform exactly as it is, lettering and all — do not blank it or redraw it. Add no other text.
```

---

## What changed in this version

**Every prompt now uses the 1990s VGA pixel-art preamble** — the wording in the top-of-file "The style, and why this file looks the way it does" note. The old "detailed digital illustration, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed" preamble is gone. That wording was read by modern image models as an instruction to produce photoreal CGI, which is not the target and is why several rounds of anchors came back looking like 2015 concept art instead of a mid-1990s character-selection screen.

**The DO NOT list is inverted** to match. The old list said `no pixel art, no dithering, no visible pixel grid`. That is the opposite of the target and has been replaced with `no smooth vector edges, no photorealism, no CGI, no modern concept-art rendering, no airbrushed gradients, no volumetric light, no specular highlights, no depth of field, no ray tracing, no anti-aliasing`.

**Two categories of negative line live in every prompt.** The first is the style negatives — the ones above. The second is the character-specific ones — `no human face` on a non-human species, `no flat chest` on a female variant, `no male body with a female head` on a female variant. Both are in the same `Do not include:` paragraph at the end.

**Species coverage was brought up to date.** Added: Robot, Bulrathi Female, Meklar Female, Sakkra Female, Alkari Female, Darlok Female, Silicoid Female, Klackon Female, Human Female. The Mrrshan Matriarch section was reclassified as a female variant, matching the folder-naming convention. Psilon was left male-only — the species reads as sexless in the source material and a female variant on an already-androgynous alien body does not read as female.
```
