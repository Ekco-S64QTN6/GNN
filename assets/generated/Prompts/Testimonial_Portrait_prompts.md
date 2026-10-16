
# GNN — Testimonial Portrait Prompts

Generated for GNN Galaxy Shop customer testimonials, infomercial "satisfied customer" inserts, and class-action claimant portraits. Each plate is a `1024x1024` portrait on transparency — an alien or human satisfied customer holding or endorsing a product, composited into a testimonial card overlay by the engine.

---

## How to use this

**Copy the whole fenced block and paste it. That is the entire job.** Each block already says what size to make the image, so there is nothing to set up beforehand and nothing to remember. Everything outside the block is for you — where to save the file, and the occasional note.

Testimonial portraits are `1024x1024` — square subject plates on full transparency.

**Nothing has to be the right pixel size or colour count** when it leaves the image model. `tools/condition_plates.py` fits every plate to the frame, removes the black fringe left on cut-out edges, hardens the alpha and cuts the palette to 256. Shape is the only thing you have to get right.

**Run the conditioner on each batch before judging it:** `python3 tools/condition_plates.py --preview`.

**Do not paraphrase the style or negative lines.** They are what makes generated art cut together with the art decoded from the game.

---

## Testimonial Portraits

### `testimonials/happy_trucker.png`

Save the result as `assets/generated/testimonials/happy_trucker.png`.

A satisfied space trucker for generic product testimonials.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a grizzled human space trucker, middle-aged man in a worn but clean flight jumpsuit with cargo company patches, giving a thumbs-up to camera, broad sincere grin, slightly sunburnt face with laugh lines, ball cap pushed back, the look of a man who has spent decades hauling freight between star systems and genuinely loves a product he just bought. Framing: bust portrait from mid-chest up, centred in frame, head in the upper third. Palette: working blue jumpsuit, warm skin tones, amber patch accents. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `testimonials/alien_mechanic.png`

Save the result as `assets/generated/testimonials/alien_mechanic.png`.

A Sakkra mechanic endorsing a tachyon deflector coil.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a Sakkra alien mechanic, a stocky green-scaled reptilian with a wide blunt snout and small shrewd eyes, wearing oil-stained coveralls and heavy work gloves, holding a futuristic wrench in one hand and gesturing approvingly at camera with the other, an expression of confident expertise. Framing: bust portrait from mid-chest up, centred in frame, head in the upper third. Palette: olive green scales, dark coveralls with orange safety trim, warm workshop lighting. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `testimonials/corporate_executive.png`

Save the result as `assets/generated/testimonials/corporate_executive.png`.

A sleek alien corporate executive for luxury product endorsements.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. an Alkari corporate executive, a tall avian alien with a hooked beak, smooth crest feathers groomed to perfection, and bright sharp round eyes, wearing an immaculately tailored dark business tunic with silver cufflinks and a small corporate pin, one wing-hand resting on a lapel, projecting authority and refined taste, looking directly at camera with a slight tilt of the head suggesting condescending approval. Framing: bust portrait from mid-chest up, centred in frame, head in the upper third. Palette: dark business charcoal tunic, silver accessories, warm amber crest highlights. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `testimonials/mrrshan_beauty.png`

Save the result as `assets/generated/testimonials/mrrshan_beauty.png`.

A glamorous Mrrshan customer for preen serum and cosmetic testimonials.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a glamorous Mrrshan female, a tawny feline alien with slit pupils, tufted ears with jewelled cuffs, a luxuriant mane groomed to a high sheen, wearing an elegant evening wrap over one shoulder, one paw-hand touching her mane as if showing off its shine, looking at camera with a smug, self-satisfied expression. Framing: bust portrait from mid-chest up, centred in frame, head in the upper third. Palette: warm tawny fur, gold jewellery accents, deep violet evening wrap, soft glamour lighting. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `testimonials/radiation_claimant.png`

Save the result as `assets/generated/testimonials/radiation_claimant.png`.

A concerned-looking class-action claimant for Vex & Sakkra Zortrium radiation legal ads.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a worried-looking human shipyard worker, a tired woman in her fifties in a faded dock worker's jumpsuit, hands clasped in front of her, looking at camera with a weary, concerned expression, slight bags under the eyes, short greying hair, the look of someone who has worked the Zortrium smelting lines for twenty years and just found out it was dangerous. Framing: bust portrait from mid-chest up, centred in frame, head in the upper third. Palette: faded industrial grey jumpsuit, warm worried skin tones, flat clinical lighting. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `testimonials/psilon_scientist.png`

Save the result as `assets/generated/testimonials/psilon_scientist.png`.

A Psilon scientist endorsing cognitive supplements — suspiciously enthusiastic.

```
Create a 1024x1024 image with a fully transparent background.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a Psilon scientist, a slender grey-skinned alien with an enormous domed cranium and huge enthusiastic black eyes, wearing a pristine white lab coat over a high-collar tunic, gesturing excitedly toward camera with long thin fingers splayed wide, the expression radiating barely-contained scientific glee that borders on mania, the look of a paid spokesperson who may or may not have invented the product they are selling. Framing: bust portrait from mid-chest up, centred in frame, head in the upper third. Palette: pristine white lab coat, grey skin, phosphor green accent on the tunic collar, clinical lighting. Background: fully transparent, subject cleanly cut out on empty transparency with no backdrop, vignette or floor.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, large areas of a single colour, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

**6 testimonial portrait prompts.** Save each one to the path under its filename, then run `python3 tools/condition_plates.py --preview`.
