# Icon prompts — 22 assets in the current style

## On the sheet approach

A single sheet is the thing you'd *want*, and it's the thing that won't work. Image models don't reliably produce fixed grids: cell sizes drift, subjects come back at wildly different scales within the same sheet, the last row gets cramped or omitted, and the model tends to draw frame lines and labels you then have to strip. You'd still be cutting 22 cells out by hand and re-registering them, which is more work than running 22 prompts.

The existing pipeline has no sheet-splitting logic at all — `condition_plates.py` handles whole plates only. So the individual prompts below are the reliable path, follow the exact format of the anchor prompts in `prompts.md`, and drop into `assets/generated/icons/` where the current pattern puts generated art.

Each prompt is `1024x1024` with transparency, matching the pattern for cut-out subjects. Nothing needs to be the right final size out of the model — conditioning handles the resize.

---

## Icons

Each of the 22 in the current set, in the pre-rendered style, one prompt per icon.

### Guardian

#### `icons/guardian.png`

Save the result as `assets/generated/icons/guardian.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a heavy armoured guardian spacecraft seen in three-quarter view, its hull plated and riveted, weapon pods slung along its flanks, a single large sensor eye at its prow with a faint amber glow, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: cold steel blues and gunmetal greys, hazard amber accents. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Genocide

#### `icons/genocide.png`

Save the result as `assets/generated/icons/genocide.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a skull and crossbones mounted on a military hazard placard, the skull in polished bone-white with hollow dark eye sockets, the bones crossed behind it at a diagonal, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: bone white and blood red, gunmetal accents. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Status

#### `icons/status.png`

Save the result as `assets/generated/icons/status.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a row of five vertical bar-chart columns of different heights in different colours, standing on a shared metal baseline with a small readout tick beneath each, each bar softly glowing at its top edge, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: cyan and magenta on deep indigo, phosphor-green readouts. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Planets

#### `icons/planets.png`

Save the result as `assets/generated/icons/planets.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. three planets of different sizes and colours arranged in a loose diagonal, the largest a banded gas giant with a faint ring, a smaller rocky world behind it, a small cratered moon in front, all lit from the same side so the light agrees, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Revolt

#### `icons/revolt.png`

Save the result as `assets/generated/icons/revolt.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a military dagger driven point-down into a dark surface, the polished blade catching light along its edge, the guard and grip worked in dark metal with a ribbed texture, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: gunmetal grey and blood red, dark steel. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Orion

#### `icons/orion.png`

Save the result as `assets/generated/icons/orion.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a tall robed figure seen from the front, face lost in shadow beneath a deep hood, a soft glow of pale light at the chest where a medallion hangs, two slender horn-like antennae rising above the cowl, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: warm gold and deep blue, pale white light. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Depleted

#### `icons/depleted.png`

Save the result as `assets/generated/icons/depleted.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a grey barren planet with a heavily cratered and pitted surface, no clouds, no continents, no water, its rocks lit coldly from one side, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: cool grey and dull ochre, no warm light. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Donation

#### `icons/donation.png`

Save the result as `assets/generated/icons/donation.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a small stack of gold bullion bars in a loose three-two-one pyramid, each bar with a shallow bevel along its upper face and a soft specular sheen, warm rim light from one side, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: warm gold and amber, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Mining

#### `icons/mining.png`

Save the result as `assets/generated/icons/mining.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a heavy industrial mining drill mounted on a steel frame, its corkscrew bit biting into a slab of dark rock, small fragments thrown up around the point of contact, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: rust orange and iron grey, sodium-lamp yellow. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Fertile

#### `icons/fertile.png`

Save the result as `assets/generated/icons/fertile.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a blue-green habitable planet with visible continents, white cloud swirls and polar ice caps, lit warmly from one side with a soft blue atmospheric rim, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: deep ocean blue and forest green, bone-white cloud. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Space Amoeba

#### `icons/space_amoeba.png`

Save the result as `assets/generated/icons/space_amoeba.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a translucent amoeboid space creature, its body a soft irregular blob of pale violet with a darker nucleus at its centre, several trailing pseudopods drifting outward, lit so its inner glow reads against its own skin, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: pale violet and phosphor green, deep indigo. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Space Crystal

#### `icons/space_crystal.png`

Save the result as `assets/generated/icons/space_crystal.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a sharp faceted crystal formation floating in space, its surfaces glowing from within with a cold cyan light, its edges hard and its faces catching specular highlights, a handful of detached shards orbiting the main body, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: cyan and magenta on deep indigo, cold white light. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Rebels

#### `icons/rebels.png`

Save the result as `assets/generated/icons/rebels.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a military assault rifle seen in full profile, its stock and grip in dark composite, its receiver and barrel in brushed steel, a short curved magazine seated, a small sight rail along the top, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: gunmetal grey and hazard amber, dark composite. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Derelict

#### `icons/derelict.png`

Save the result as `assets/generated/icons/derelict.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a derelict spacecraft drifting in space, its hull broken open along one flank, one engine nacelle torn away leaving a skeletal frame, small debris trailing behind it, no lights along its flanks, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: cold steel blues and gunmetal greys, no interior lights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Pirates

#### `icons/pirates.png`

Save the result as `assets/generated/icons/pirates.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a pirate emblem of a skull above two crossed cutlasses, the skull in dull silver with a wide grin, the cutlasses crossed behind it at their guards with their blades curving outward, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: dull silver and blood red, bone white. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Comet

#### `icons/comet.png`

Save the result as `assets/generated/icons/comet.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a comet streaking across the frame, a bright glowing head with a long blue-white tail trailing behind it, a few small fragments breaking off from the end of the tail, motion along the diagonal, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: cold white and deep blue, cyan highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Virus

#### `icons/virus.png`

Save the result as `assets/generated/icons/virus.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a blocky computer terminal on a small plinth, its screen dark with a jagged red glyph of broken lines running across it, two small lightning symbols arcing off either side of the housing, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: cyan and magenta on deep indigo, phosphor-green glyph. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Diplomat

#### `icons/diplomat.png`

Save the result as `assets/generated/icons/diplomat.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a sealed parchment scroll lying on a dark surface, its edges curled and bound with a wine-red ribbon, a round wax seal impressed into the ribbon at the centre with a faint sunburst pattern, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: warm ambers and oxblood reds, brass highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Waste

#### `icons/waste.png`

Save the result as `assets/generated/icons/waste.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a radiation hazard trefoil symbol centred on a square metal placard, the trefoil in bold red on a dark ground, the placard's four corners riveted and its edges worn smooth, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: bold red on dark steel, bone-white rivets. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Nova

#### `icons/nova.png`

Save the result as `assets/generated/icons/nova.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a star exploding in a violent spiked burst, its central core white-hot with a bright corona, irregular spikes of orange and red radiating outward in every direction, a few shards of light breaking free at the edge, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: white-hot core, orange and red spikes, deep violet shadows. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Quake

#### `icons/quake.png`

Save the result as `assets/generated/icons/quake.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a tall building torn open by an earthquake, its facade cracked and its upper floors sheared off at an angle, a chunk of cornice falling clear of the frame, the ground beneath it split into a jagged crack, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: cold steel blues and gunmetal greys, dust grey. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

### Plague

#### `icons/plague.png`

Save the result as `assets/generated/icons/plague.png`.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. three glass laboratory vials standing in a metal rack, each vial filled with a different shade of green liquid, a thin wisp of vapour rising from the open one, the glass catching specular highlights along its curve, rendered as a compact broadcast icon. Framing: single subject, perfectly centred in the square frame, the subject filling about seventy percent of the frame with even margin on every side, composed so it reads at small size. Palette: phosphor green and bone white, dark steel rack. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, borders or frames, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

## Two things to settle before you run these

**Labels.** The current icons carry their names in a pixel font below the icon, inside a bright green frame. The prompts above produce only the icon artwork — no frame, no lettering, following the exclusion pattern the rest of `prompts.md` uses. If you want the labels baked in the way the old ones are, that's a different prompt and a break from the pattern; more likely you want the engine to draw the label using the existing font and the frame it already draws, at which point dropping the lettering is right.

**Conditioning.** `condition_plates.py` currently handles `set/`, `anchors/` and `cutaways/`. It has no path for `icons/`. Before running the set through, `PLATES`, `ANCHORS` and the cutaway pass all need to know about the new directory — otherwise the icons land on disk and nothing conditions them, same shape of problem as the four new sets.
