# GNN — Generated Asset Prompts

Produced by `tools/prompt_bridge.py`. Each one is a gap the Master of Orion 1 catalogue cannot fill: it has 76 usable cutaways and 132 portraits, but none cut out for a news set and nothing resembling a studio to put them in.

---

## How to use this

**Paste the fenced block. Nothing outside it.** Everything else on the page is for you, not for the image model — filenames, sizes and the occasional note about why an asset is the shape it is.

**Use the size given under each filename.** Full-bleed plates are `1792x1024`, because the broadcast frame is 320x180 (1.78:1) and a landscape plate covers it without losing its sides. Cut-out characters and props are `1024x1024`, because they are subjects on transparency rather than pictures of a frame.

**Nothing has to be the right pixel size or colour count** when it leaves the image model. `tools/condition_plates.py` fits every plate to the frame, removes the black fringe left on cut-out edges, hardens the alpha and cuts the palette to 256. Shape is the only thing you have to get right.

**Run the conditioner on each batch before judging it:** `python3 tools/condition_plates.py --preview`. For anchors it also checks the three states line up and tells you if they do not.

**Do not paraphrase the style or negative lines.** They are what makes generated art cut together with the art decoded from the game.

---

## Anchor Portraits

Three states per species. The engine crossfades `desk_hero` into `speaking` on whoever is talking and holds `listening` on everyone else, so the three have to be the same drawing with one thing changed — **make the hero first, then ask for the other two as edits of it.** Generating them separately gives three subtly different characters and the crossfade turns into a lurch.

No desk in these: the desk is its own plate, and the anchors sit between the room and it.

### Bulrathi

#### `anchors/bulrathi_desk_hero.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/bulrathi_desk_hero.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Bulrathi, a large brown-furred bear-like alien, heavy brow, broad shoulders, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

**Negative prompt:** no captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/bulrathi_speaking.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/bulrathi_speaking.png`</sub>

Upload `bulrathi_desk_hero.png` and ask for this edit.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

#### `anchors/bulrathi_listening.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/bulrathi_listening.png`</sub>

Upload `bulrathi_desk_hero.png` and ask for this edit.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

### Psilon

#### `anchors/psilon_desk_hero.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/psilon_desk_hero.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Psilon, a slender grey-skinned alien with an enormous domed cranium and huge black eyes, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: cyan and magenta on deep indigo, phosphor-green readouts. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

**Negative prompt:** no captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/psilon_speaking.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/psilon_speaking.png`</sub>

Upload `psilon_desk_hero.png` and ask for this edit.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

#### `anchors/psilon_listening.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/psilon_listening.png`</sub>

Upload `psilon_desk_hero.png` and ask for this edit.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

### Mrrshan

#### `anchors/mrrshan_desk_hero.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/mrrshan_desk_hero.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Mrrshan, a tawny feline alien with slit pupils, tufted ears and a short muzzle, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

**Negative prompt:** no captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/mrrshan_speaking.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/mrrshan_speaking.png`</sub>

Upload `mrrshan_desk_hero.png` and ask for this edit.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

#### `anchors/mrrshan_listening.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/mrrshan_listening.png`</sub>

Upload `mrrshan_desk_hero.png` and ask for this edit.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

### Meklar

#### `anchors/meklar_desk_hero.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/meklar_desk_hero.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Meklar, a cyborg with a segmented metal faceplate, exposed cabling and a single glowing optical band, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

**Negative prompt:** no captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/meklar_speaking.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/meklar_speaking.png`</sub>

Upload `meklar_desk_hero.png` and ask for this edit.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

#### `anchors/meklar_listening.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/meklar_listening.png`</sub>

Upload `meklar_desk_hero.png` and ask for this edit.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

### Sakkra

#### `anchors/sakkra_desk_hero.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/sakkra_desk_hero.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Sakkra, a green reptilian alien with a crested skull and vertical slit pupils, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

**Negative prompt:** no captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/sakkra_speaking.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/sakkra_speaking.png`</sub>

Upload `sakkra_desk_hero.png` and ask for this edit.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

#### `anchors/sakkra_listening.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/sakkra_listening.png`</sub>

Upload `sakkra_desk_hero.png` and ask for this edit.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

### Alkari

#### `anchors/alkari_desk_hero.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/alkari_desk_hero.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Alkari, an avian alien with a hooked beak, crest feathers and bright round eyes, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: muted teal and bone white, warning-stripe yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

**Negative prompt:** no captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/alkari_speaking.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/alkari_speaking.png`</sub>

Upload `alkari_desk_hero.png` and ask for this edit.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

#### `anchors/alkari_listening.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/alkari_listening.png`</sub>

Upload `alkari_desk_hero.png` and ask for this edit.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

### Darlok

#### `anchors/darlok_desk_hero.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/darlok_desk_hero.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Darlok, a hooded shadow-shrouded figure whose face is an indistinct darkness with two faint red points, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

**Negative prompt:** no captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/darlok_speaking.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/darlok_speaking.png`</sub>

Upload `darlok_desk_hero.png` and ask for this edit.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

#### `anchors/darlok_listening.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/darlok_listening.png`</sub>

Upload `darlok_desk_hero.png` and ask for this edit.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

### Silicoid

#### `anchors/silicoid_desk_hero.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/silicoid_desk_hero.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Silicoid, a crystalline rock-bodied being with faceted mineral plates and glowing seams, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

**Negative prompt:** no captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/silicoid_speaking.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/silicoid_speaking.png`</sub>

Upload `silicoid_desk_hero.png` and ask for this edit.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

#### `anchors/silicoid_listening.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/silicoid_listening.png`</sub>

Upload `silicoid_desk_hero.png` and ask for this edit.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

### Klackon

#### `anchors/klackon_desk_hero.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/klackon_desk_hero.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Klackon, an insectoid alien with chitinous plating, mandibles and compound eyes, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

**Negative prompt:** no captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/klackon_speaking.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/klackon_speaking.png`</sub>

Upload `klackon_desk_hero.png` and ask for this edit.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

#### `anchors/klackon_listening.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/klackon_listening.png`</sub>

Upload `klackon_desk_hero.png` and ask for this edit.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

### Human Commander

#### `anchors/human_desk_hero.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/human_desk_hero.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a Human Commander, a grey-haired human officer in a high-collar uniform, lined face, calm expression, wearing a GNN-badged broadcast uniform, upright and square to camera, shoulders level, looking straight down the lens, mouth closed, arms down and out of frame. Head, shoulders and chest only — no desk, no table, no furniture, nothing beneath or in front of the figure. Framing: head and shoulders, chest cropped at the bottom edge of the frame, the head occupying the upper middle. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

**Negative prompt:** no captions, headlines, tickers, labels or lettering anywhere other than the small GNN badge on the uniform, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `anchors/human_speaking.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/human_speaking.png`</sub>

Upload `human_desk_hero.png` and ask for this edit.

```
EDIT: open the mouth as if mid-word. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

#### `anchors/human_listening.png`

<sub>1024x1024 &middot; save as `assets/generated/anchors/human_listening.png`</sub>

Upload `human_desk_hero.png` and ask for this edit.

```
EDIT: turn the eyes slightly off-camera, as if attending to a co-anchor. Change nothing else. Do not re-pose, re-scale, re-frame, re-light or redraw any other part.

Keep the transparent background. Add no text or lettering.
```

## Newsroom Set

The room the anchors sit in, as separate layers: the engine draws the room, then the anchors, then the desk in front of them. One baked picture of the whole scene would have nobody able to sit at it.

The window in the back wall must be **flat pure black** — that is what the engine keys the exterior backdrop into. Nothing else in the room may be pure black.

#### `set/studio_wide_empty.png`

<sub>1792x1024 &middot; save as `assets/generated/set/studio_wide_empty.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. the interior of a starship television studio: bevelled hull wall panels, a large octagonal viewport dominating the centre of the back wall, angled instrument consoles built into the side walls with rows of lit indicator buttons, a raised circular floor dais with an inlaid trim ring. No desk, no furniture in the centre, no figures. Framing: wide empty set plate, the window centred on the back wall, floor occupying the lower third, the centre of the room completely empty. Palette: muted teal and bone white, warning-stripe yellow. Background: the window opening is a flat area of pure black, showing nothing at all — no stars, no planet, no light.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `set/desk_oval_front.png`

<sub>1792x1024 &middot; save as `assets/generated/set/desk_oval_front.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an oval television news desk seen straight on, brushed metal top, curved front panel with a lit strip running around it and a blank recessed plate in the centre for a station emblem. The desk only, nothing behind it. Framing: foreground layer, the desk filling the lower half of the frame, drawn as it would be seen from a camera at seated eye level. Palette: muted teal and bone white, warning-stripe yellow. Background: transparent background, the desk cleanly cut out.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `set/console_left.png`

<sub>1024x1024 &middot; save as `assets/generated/set/console_left.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an angled wall-mounted instrument console with rows of small lit square indicator buttons and two small readout screens, seen from its right. Framing: single prop plate, the console filling the frame. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: transparent background, cleanly cut out.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `set/console_right.png`

<sub>1024x1024 &middot; save as `assets/generated/set/console_right.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an angled wall-mounted instrument console with rows of small lit square indicator buttons and two small readout screens, seen from its left. Framing: single prop plate, the console filling the frame. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: transparent background, cleanly cut out.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

## News Desk Plates — superseded

`set/desk_oval_front.png` above is the desk. The earlier three-up and two-up prompts drew a desk *and* the studio behind it as one picture, which cannot work now that the anchors composite between them. **Do not generate these.** Listed only so the filenames are not reused.

## PIP Cutaways

The footage behind the anchor's shoulder. One plate per story category; the keywords are what routes a story to it.

#### `cutaways/starship_battle.png`

<sub>1792x1024 &middot; save as `assets/generated/cutaways/starship_battle.png`</sub>

*Routes from:* `fleet`, `war`, `invasion`, `attack`

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. two capital starships exchanging beam fire across open space, hull plating glowing where it is struck, debris tumbling. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/space_vortex.png`

<sub>1792x1024 &middot; save as `assets/generated/cutaways/space_vortex.png`</sub>

*Routes from:* `physics`, `quantum`, `anomaly`, `wormhole`

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a swirling gravitational vortex tearing a hole in a starfield, light bending around its rim. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/planet_invasion.png`

<sub>1792x1024 &middot; save as `assets/generated/cutaways/planet_invasion.png`</sub>

*Routes from:* `invasion`, `troops`, `siege`

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. drop-pods streaking down through a planet atmosphere toward a defended colony, flak bursts around them. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/hacker_code.png`

<sub>1792x1024 &middot; save as `assets/generated/cutaways/hacker_code.png`</sub>

*Routes from:* `hack`, `cyber`, `breach`, `malware`

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a dim terminal room, cascading columns of alien glyphs on a wall of screens, one operator silhouetted. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cyan and magenta on deep indigo, phosphor-green readouts. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/council_vote.png`

<sub>1792x1024 &middot; save as `assets/generated/cutaways/council_vote.png`</sub>

*Routes from:* `vote`, `council`, `senate`, `legislation`

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a tiered alien council chamber mid-vote, delegates of several species raising voting tokens. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: warm ambers and oxblood reds, brass highlights. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/asteroid_mining.png`

<sub>1792x1024 &middot; save as `assets/generated/cutaways/asteroid_mining.png`</sub>

*Routes from:* `mining`, `minerals`, `resources`

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. mining rigs clamped to a tumbling asteroid, ore conveyors and floodlights against black space. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/virus_outbreak.png`

<sub>1792x1024 &middot; save as `assets/generated/cutaways/virus_outbreak.png`</sub>

*Routes from:* `plague`, `virus`, `outbreak`, `disease`

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a quarantined colony dome interior, figures in sealed suits under harsh amber warning light. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cyan and magenta on deep indigo, phosphor-green readouts. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/station_trade.png`

<sub>1792x1024 &middot; save as `assets/generated/cutaways/station_trade.png`</sub>

*Routes from:* `trade`, `cargo`, `economy`, `shipping`

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a busy orbital trade station with freighters docked at radial arms, cargo moving along lit gantries. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/solar_flare.png`

<sub>1792x1024 &middot; save as `assets/generated/cutaways/solar_flare.png`</sub>

*Routes from:* `solar`, `flare`, `star`, `radiation`

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an enormous solar prominence arcing off a star, a small silhouetted station in the foreground. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/black_hole.png`

<sub>1792x1024 &middot; save as `assets/generated/cutaways/black_hole.png`</sub>

*Routes from:* `black hole`, `gravity`, `singularity`

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an accretion disc around a black hole, light smeared into a ring, a survey probe dwarfed beside it. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: deep violet and ultraviolet white, bruised purple shadows. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/spy_infiltration.png`

<sub>1792x1024 &middot; save as `assets/generated/cutaways/spy_infiltration.png`</sub>

*Routes from:* `spy`, `espionage`, `infiltration`, `sabotage`

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a cloaked figure slipping through a sealed bulkhead door into a lit corridor, alarm strip glowing. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `cutaways/council_summit.png`

<sub>1792x1024 &middot; save as `assets/generated/cutaways/council_summit.png`</sub>

*Routes from:* `treaty`, `summit`, `accord`, `diplomacy`

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a formal summit table with ambassadors of several alien species seated opposite one another, banners behind. Framing: wide cutaway plate, full bleed to all four edges, no border and no frame, the subject readable at a glance. Palette: warm ambers and oxblood reds, brass highlights. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

## Exterior Window Backdrops

What is seen through the window in the back wall. Four moods across four times of day; the scheduler picks a mood per show block and the time of day from the clock. The engine fits these into the window opening and crops the overflow, so keep the subject centred and clear of the edges.

#### `backdrops/earth_globe_dawn.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/earth_globe_dawn.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a blue-green homeworld seen from high orbit through a wide studio window, terminator line crossing it, low warm light raking across the scene, long shadows. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/earth_globe_day.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/earth_globe_day.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a blue-green homeworld seen from high orbit through a wide studio window, terminator line crossing it, flat bright illumination, crisp detail, pale sky. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/earth_globe_dusk.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/earth_globe_dusk.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a blue-green homeworld seen from high orbit through a wide studio window, terminator line crossing it, deep orange and violet sky, rim-lit edges. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/earth_globe_night.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/earth_globe_night.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a blue-green homeworld seen from high orbit through a wide studio window, terminator line crossing it, near-black with artificial lights and starfield dominant. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/asteroid_field_dawn.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/asteroid_field_dawn.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a working asteroid mining field seen through a studio window, rigs and running lights among tumbling rock, low warm light raking across the scene, long shadows. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/asteroid_field_day.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/asteroid_field_day.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a working asteroid mining field seen through a studio window, rigs and running lights among tumbling rock, flat bright illumination, crisp detail, pale sky. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/asteroid_field_dusk.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/asteroid_field_dusk.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a working asteroid mining field seen through a studio window, rigs and running lights among tumbling rock, deep orange and violet sky, rim-lit edges. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/asteroid_field_night.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/asteroid_field_night.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a working asteroid mining field seen through a studio window, rigs and running lights among tumbling rock, near-black with artificial lights and starfield dominant. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: rust orange and iron grey, sodium-lamp yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/colony_domes_dawn.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/colony_domes_dawn.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a colony of geodesic domes on a dusty plain seen through a studio window, distant ridgeline beyond, low warm light raking across the scene, long shadows. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/colony_domes_day.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/colony_domes_day.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a colony of geodesic domes on a dusty plain seen through a studio window, distant ridgeline beyond, flat bright illumination, crisp detail, pale sky. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/colony_domes_dusk.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/colony_domes_dusk.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a colony of geodesic domes on a dusty plain seen through a studio window, distant ridgeline beyond, deep orange and violet sky, rim-lit edges. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/colony_domes_night.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/colony_domes_night.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. a colony of geodesic domes on a dusty plain seen through a studio window, distant ridgeline beyond, near-black with artificial lights and starfield dominant. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: muted teal and bone white, warning-stripe yellow. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/orion_shipyard_dawn.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/orion_shipyard_dawn.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, low warm light raking across the scene, long shadows. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/orion_shipyard_day.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/orion_shipyard_day.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, flat bright illumination, crisp detail, pale sky. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/orion_shipyard_dusk.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/orion_shipyard_dusk.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, deep orange and violet sky, rim-lit edges. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

#### `backdrops/orion_shipyard_night.png`

<sub>1792x1024 &middot; save as `assets/generated/backdrops/orion_shipyard_night.png`</sub>

```
1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 aesthetic, chunky visible pixels as if drawn for a 320x200 DOS screen, painterly pixel dithering, hand-placed pixels, no photographic detail. an orbital shipyard with a half-built capital ship in its scaffold, work lights and tugs around it, near-black with artificial lights and starfield dominant. Framing: wide backdrop plate, full bleed, horizon in the lower third, the subject centred and clear of the edges. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: full-bleed scene, no transparency.

**Negative prompt:** no captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no smooth gradients beyond 1993 VGA dithering, no watermark, no signature, no 3D render, no airbrush
```

---

**62 prompts.** Save each one to the path under its filename, then run `python3 tools/condition_plates.py --preview`.
