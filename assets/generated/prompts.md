# GNN — Generated Asset Prompts

Produced by `tools/prompt_bridge.py`. Every prompt below is a gap the Master of Orion 1 catalogue cannot fill in broadcast framing.

Paste each prompt into an image model, then save the result to the filename shown above it, under `assets/generated/`. Directory structure matters — the engine resolves assets by that path.

**Ask for landscape, the widest the model offers — 1792x1024 in ChatGPT.** The broadcast frame is 320x180 (1.78:1) and everything is fitted to it by `tools/condition_plates.py`, which also removes the black edge fringe, cuts the palette to 256 colours and hardens the alpha. Nothing here needs to be the right size or the right number of colours when it leaves the image model; it needs to be the right *shape*, and 1792x1024 is within a hair of the frame.

**Run every finished batch through the conditioner** before judging it: `python3 tools/condition_plates.py --preview`.

**Catalogue at time of writing:** 76 admitted cutaways, 132 admitted portraits. Those cover subject matter, not framing: MOO1 has ambassador portraits, but none cut out for a news set and nothing resembling a studio to put them in.

**Style is locked across every prompt** so the generated set cuts together with the extracted set. Do not paraphrase the style or negative clauses.

---

## Anchor Portraits

Three states per species. The engine crossfades `desk_hero` to `speaking` on the active anchor and holds `listening` on the others, so the three must share pose, scale, eye-line and lighting exactly.

**Generate the hero once, then make the other two by editing that image** — open the mouth, raise a paw — rather than by running the prompt three times. Three independent generations do not match, and the mismatch is not subtle: the first Bulrathi set came back with the head top at 63, 44 and 28 pixels and the shoulder span at 716, 776 and 848, an 18% growth in scale across the three. Crossfaded, that reads as the anchor lurching at the camera.

**No desk in these.** The desk is its own plate and the anchors composite in front of the set and behind it. A desk baked into the character plate is opaque across the full width of the frame and paints over both.

### Bulrathi

> MOO1 has ambassador portraits (EMBASSY/item_00 and others) but none in desk framing, so these are generated.

#### `anchors/bulrathi_desk_hero.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a Bulrathi, a large brown-furred bear-like alien, heavy brow, broad shoulders filling the frame, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor — the engine composites it over the set and the desk plate.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/bulrathi_speaking.png`

*Not a new picture.* Upload `anchors/bulrathi_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/bulrathi_listening.png`

*Not a new picture.* Upload `anchors/bulrathi_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

### Psilon

> MOO1 has ambassador portraits (EMBASSY/item_00 and others) but none in desk framing, so these are generated.

#### `anchors/psilon_desk_hero.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a Psilon, a slender grey-skinned alien with an enormous domed cranium and huge black eyes, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: cyan and magenta on deep indigo, phosphor-green readouts. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor — the engine composites it over the set and the desk plate.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/psilon_speaking.png`

*Not a new picture.* Upload `anchors/psilon_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/psilon_listening.png`

*Not a new picture.* Upload `anchors/psilon_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

### Mrrshan

> MOO1 has ambassador portraits (EMBASSY/item_00 and others) but none in desk framing, so these are generated.

#### `anchors/mrrshan_desk_hero.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a Mrrshan, a tawny feline alien with slit pupils, tufted ears and a short muzzle, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor — the engine composites it over the set and the desk plate.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/mrrshan_speaking.png`

*Not a new picture.* Upload `anchors/mrrshan_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/mrrshan_listening.png`

*Not a new picture.* Upload `anchors/mrrshan_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

### Meklar

> MOO1 has ambassador portraits (EMBASSY/item_00 and others) but none in desk framing, so these are generated.

#### `anchors/meklar_desk_hero.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a Meklar, a cyborg with a segmented metal faceplate, exposed cabling and a single glowing optical band, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor — the engine composites it over the set and the desk plate.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/meklar_speaking.png`

*Not a new picture.* Upload `anchors/meklar_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/meklar_listening.png`

*Not a new picture.* Upload `anchors/meklar_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

### Sakkra

> MOO1 has ambassador portraits (EMBASSY/item_00 and others) but none in desk framing, so these are generated.

#### `anchors/sakkra_desk_hero.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a Sakkra, a green reptilian alien with a crested skull and vertical slit pupils, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor — the engine composites it over the set and the desk plate.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/sakkra_speaking.png`

*Not a new picture.* Upload `anchors/sakkra_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/sakkra_listening.png`

*Not a new picture.* Upload `anchors/sakkra_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

### Alkari

> MOO1 has ambassador portraits (EMBASSY/item_00 and others) but none in desk framing, so these are generated.

#### `anchors/alkari_desk_hero.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a Alkari, an avian alien with a hooked beak, crest feathers and bright round eyes, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: muted teal and bone white, warning-stripe yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor — the engine composites it over the set and the desk plate.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/alkari_speaking.png`

*Not a new picture.* Upload `anchors/alkari_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/alkari_listening.png`

*Not a new picture.* Upload `anchors/alkari_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

### Darlok

> MOO1 has ambassador portraits (EMBASSY/item_00 and others) but none in desk framing, so these are generated.

#### `anchors/darlok_desk_hero.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a Darlok, a hooded shadow-shrouded figure whose face is an indistinct darkness with two faint red points, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor — the engine composites it over the set and the desk plate.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/darlok_speaking.png`

*Not a new picture.* Upload `anchors/darlok_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/darlok_listening.png`

*Not a new picture.* Upload `anchors/darlok_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

### Silicoid

> MOO1 has ambassador portraits (EMBASSY/item_00 and others) but none in desk framing, so these are generated.

#### `anchors/silicoid_desk_hero.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a Silicoid, a crystalline rock-bodied being with faceted mineral plates and glowing seams, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor — the engine composites it over the set and the desk plate.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/silicoid_speaking.png`

*Not a new picture.* Upload `anchors/silicoid_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/silicoid_listening.png`

*Not a new picture.* Upload `anchors/silicoid_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

### Klackon

> MOO1 has ambassador portraits (EMBASSY/item_00 and others) but none in desk framing, so these are generated.

#### `anchors/klackon_desk_hero.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a Klackon, an insectoid alien with chitinous plating, mandibles and compound eyes, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor — the engine composites it over the set and the desk plate.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/klackon_speaking.png`

*Not a new picture.* Upload `anchors/klackon_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/klackon_listening.png`

*Not a new picture.* Upload `anchors/klackon_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

### Human Commander

> MOO1 has ambassador portraits (EMBASSY/item_00 and others) but none in desk framing, so these are generated.

#### `anchors/human_desk_hero.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a Human Commander, a grey-haired human officer in a high-collar uniform, lined face, calm expression, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor — the engine composites it over the set and the desk plate.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/human_speaking.png`

*Not a new picture.* Upload `anchors/human_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/human_listening.png`

*Not a new picture.* Upload `anchors/human_desk_hero.png` and ask for this edit, so the two match it exactly.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

## Newsroom Set

The room the desk sits in. Generated as separate layers rather than one picture, because the engine draws the room behind the anchors and the desk in front of them — a single baked image of the whole scene has nobody able to sit at it.

**Geometry.** The picture fills the window: there is no set around it and no monitor frame inside it. The frame is **320 x 180 source pixels, 1.78:1**, and a full-bleed plate is drawn to cover it. A plate at the image model's default 3:2 loses its sides or its top and bottom to the crop, so ask for landscape.

The window in the back wall is left **flat pure black** so the engine can composite an exterior backdrop into it. Nothing else in the room may be pure black, or it will be treated as window too.

#### `set/studio_wide_empty.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. the interior of a starship television studio: bevelled hull wall panels, a large octagonal viewport dominating the centre of the back wall, angled instrument consoles built into the side walls with rows of lit indicator buttons, a raised circular floor dais with an inlaid trim ring. No desk, no furniture in the centre, no figures. Framing: wide empty set plate, the viewport centred on the back wall, floor occupying the lower third, nothing in the middle ground where the desk and anchors will be composited. Palette: muted teal and bone white, warning-stripe yellow. Background: the viewport opening is flat pure black with no stars and no planet — the engine composites the exterior backdrop into it.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `set/desk_oval_front.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. an oval television news desk seen straight on, brushed metal top, curved front panel with a lit strip running around it and a blank recessed plate in the centre for a station emblem. The desk only, nothing behind it. Framing: foreground layer, the desk filling the lower half of the frame, drawn as it would be seen from a camera at seated eye level. Palette: muted teal and bone white, warning-stripe yellow. Background: transparent background, the desk cleanly cut out so anchors composite behind it.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `set/console_left.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. an angled wall-mounted instrument console with rows of small lit square indicator buttons and two small readout screens, seen from its right. Framing: single prop plate, the console filling the frame. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: transparent background, cleanly cut out.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `set/console_right.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. an angled wall-mounted instrument console with rows of small lit square indicator buttons and two small readout screens, seen from its left. Framing: single prop plate, the console filling the frame. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: transparent background, cleanly cut out.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

## News Desk Plates — superseded

`set/desk_oval_front.png` above is the desk, and it is already made. These earlier three-up and two-up prompts drew a desk *and* the studio behind it as one picture, which cannot work now that anchors composite between the room and the desk. **Do not generate these.** They are kept only so the filenames are not reused for something else.

## PIP Cutaways

One wide plate per story category. Keyword mapping is listed so the router in `cutscene-manager.js` can be pointed at these directly.

#### `cutaways/starship_battle.png`

*Routes from:* `fleet`, `war`, `invasion`, `attack`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. two capital starships exchanging beam fire across open space, hull plating glowing where it is struck, debris tumbling. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/space_vortex.png`

*Routes from:* `physics`, `quantum`, `anomaly`, `wormhole`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a swirling gravitational vortex tearing a hole in a starfield, light bending around its rim. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/planet_invasion.png`

*Routes from:* `invasion`, `troops`, `siege`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. drop-pods streaking down through a planet atmosphere toward a defended colony, flak bursts around them. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/hacker_code.png`

*Routes from:* `hack`, `cyber`, `breach`, `malware`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a dim terminal room, cascading columns of alien glyphs on a wall of screens, one operator silhouetted. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cyan and magenta on deep indigo, phosphor-green readouts. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/council_vote.png`

*Routes from:* `vote`, `council`, `senate`, `legislation`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a tiered alien council chamber mid-vote, delegates of several species raising voting tokens. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: warm ambers and oxblood reds, brass highlights. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/asteroid_mining.png`

*Routes from:* `mining`, `minerals`, `resources`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. mining rigs clamped to a tumbling asteroid, ore conveyors and floodlights against black space. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/virus_outbreak.png`

*Routes from:* `plague`, `virus`, `outbreak`, `disease`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a quarantined colony dome interior, figures in sealed suits under harsh amber warning light. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cyan and magenta on deep indigo, phosphor-green readouts. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/station_trade.png`

*Routes from:* `trade`, `cargo`, `economy`, `shipping`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a busy orbital trade station with freighters docked at radial arms, cargo moving along lit gantries. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/solar_flare.png`

*Routes from:* `solar`, `flare`, `star`, `radiation`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. an enormous solar prominence arcing off a star, a small silhouetted station in the foreground. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/black_hole.png`

*Routes from:* `black hole`, `gravity`, `singularity`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. an accretion disc around a black hole, light smeared into a ring, a survey probe dwarfed beside it. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/spy_infiltration.png`

*Routes from:* `spy`, `espionage`, `infiltration`, `sabotage`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a cloaked figure slipping through a sealed bulkhead door into a lit corridor, alarm strip glowing. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/council_summit.png`

*Routes from:* `treaty`, `summit`, `accord`, `diplomacy`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a formal summit table with ambassadors of several alien species seated opposite one another, banners behind. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: warm ambers and oxblood reds, brass highlights. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

## Exterior Window Backdrops

What is seen through the window in the back wall of the set. Four moods across four times of day; the scheduler picks a mood per show block and a time of day from the local clock.

Generate these the same shape as everything else. The engine fits them into the window opening and crops the overflow, so the subject wants to be centred and nothing important should sit near an edge.

#### `backdrops/earth_globe_dawn.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a blue-green homeworld seen from high orbit through a wide studio window, terminator line crossing it, low warm light raking across the scene, long shadows. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/earth_globe_day.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a blue-green homeworld seen from high orbit through a wide studio window, terminator line crossing it, flat bright illumination, crisp detail, pale sky. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/earth_globe_dusk.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a blue-green homeworld seen from high orbit through a wide studio window, terminator line crossing it, deep orange and violet sky, rim-lit edges. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/earth_globe_night.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a blue-green homeworld seen from high orbit through a wide studio window, terminator line crossing it, near-black with artificial lights and starfield dominant. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/asteroid_field_dawn.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a working asteroid mining field seen through a studio window, rigs and running lights among tumbling rock, low warm light raking across the scene, long shadows. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/asteroid_field_day.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a working asteroid mining field seen through a studio window, rigs and running lights among tumbling rock, flat bright illumination, crisp detail, pale sky. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/asteroid_field_dusk.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a working asteroid mining field seen through a studio window, rigs and running lights among tumbling rock, deep orange and violet sky, rim-lit edges. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/asteroid_field_night.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a working asteroid mining field seen through a studio window, rigs and running lights among tumbling rock, near-black with artificial lights and starfield dominant. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/colony_domes_dawn.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a colony of geodesic domes on a dusty plain seen through a studio window, distant ridgeline beyond, low warm light raking across the scene, long shadows. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/colony_domes_day.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a colony of geodesic domes on a dusty plain seen through a studio window, distant ridgeline beyond, flat bright illumination, crisp detail, pale sky. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/colony_domes_dusk.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a colony of geodesic domes on a dusty plain seen through a studio window, distant ridgeline beyond, deep orange and violet sky, rim-lit edges. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/colony_domes_night.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. a colony of geodesic domes on a dusty plain seen through a studio window, distant ridgeline beyond, near-black with artificial lights and starfield dominant. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/orion_shipyard_dawn.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, low warm light raking across the scene, long shadows. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/orion_shipyard_day.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, flat bright illumination, crisp detail, pale sky. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/orion_shipyard_dusk.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, deep orange and violet sky, rim-lit edges. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/orion_shipyard_night.png`

```
1993 VGA pixel art, 320x180, 256-colour DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering, hand-placed pixels, no photographic detail. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, near-black with artificial lights and starfield dominant. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

**Negative prompt:** no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no captions, headlines, tickers, labels or lettering anywhere in the scene other than the GNN badge on a uniform (the engine draws all other text), no watermark, no signature, no 3D render, no airbrush
```

---

**62 prompts.** Save each to `assets/generated/<path shown>`, then run `python3 tools/verify_assets.py` to confirm the engine resolves them.
