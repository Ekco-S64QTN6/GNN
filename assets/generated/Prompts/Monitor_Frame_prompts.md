# GNN — Monitor Frame Prompts

The over-the-shoulder monitor above the anchors: the bezel around the story
icon and the cutaway footage. Save the result in
`assets/generated/overlays/`, then run `python3 tools/condition_plates.py`
— it keys the green screen out and writes `overlays/keyed/`, which the
renderer picks up on the next load.

**The screen must be flat pure green (#00FF00).** Image models almost never
return a real transparent hole; the conditioner turns the green into the
opening. The renderer measures the opening from the keyed image and fits it
to the monitor exactly, so the frame's thickness and shape are up to the
art — only the green has to be clean and flat, both in the screen and all
around the outside of the bezel, so both key out. The monitor on screen is about 1.45 : 1.

**Do not paraphrase the style or negative lines.**

---

### `overlays/monitor_frame.png`

Save the result as `assets/generated/overlays/monitor_frame.png`.

The default. Matches the studio sets' brushed metal and blue accent light.

```
Create a 1536x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a wall-mounted broadcast studio monitor seen straight on, a thick bezel of brushed gunmetal with rounded corners, thin glowing cyan accent strips along the inner edge of the bezel, two small mounting brackets at the top corners, a few small status lights on the lower bezel, the bezel is slightly wider at the bottom. The entire screen area inside the bezel is filled edge to edge with flat, pure, uniform chroma-key green (#00FF00), with no texture, no gradient, no reflection and nothing displayed on it; the green screen fills the central 78 percent of the width and 74 percent of the height. Framing: the monitor centred and seen straight on, filling most of the image, with the same flat pure chroma-key green (#00FF00) all around the outside of the monitor as well, so that only the bezel itself is not green. Palette: brushed gunmetal and dark steel, glowing cyan accent light, small amber status lights. Background: flat pure chroma-key green (#00FF00), no shadow.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, anything inside the screen area, reflections or glare on the screen, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```

---

### `overlays/monitor_frame_brass.png`

Save the result as `assets/generated/overlays/monitor_frame_brass.png`.

Alternative for the warmer sets (archive, diplomatic, celebrity). Not wired yet — tell Claude if you want it per set.

```
Create a 1536x1024 image.

detailed digital illustration in the manner of pre-rendered art from an early-2000s space strategy game, the generation after Master of Orion 1 and not that game, smooth rich shading with real gradients, volumetric light, specular highlights on metal, high fidelity and finely detailed, not pixel art, no visible pixel grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit styling. a wall-mounted broadcast studio monitor seen straight on, an ornate bezel of polished brass and dark wood with rounded corners, a fine engraved line pattern around the opening, a soft warm glow along the inner edge, small brass mounting brackets at the top corners. The entire screen area inside the bezel is filled edge to edge with flat, pure, uniform chroma-key green (#00FF00), with no texture, no gradient, no reflection and nothing displayed on it; the green screen fills the central 78 percent of the width and 74 percent of the height. Framing: the monitor centred and seen straight on, filling most of the image, with the same flat pure chroma-key green (#00FF00) all around the outside of the monitor as well, so that only the bezel itself is not green. Palette: polished brass, dark walnut wood, warm amber glow. Background: flat pure chroma-key green (#00FF00), no shadow.

Do not include: captions, headlines, tickers, labels, letters, numbers or writing of any kind anywhere in the image, people, anything inside the screen area, reflections or glare on the screen, pixel art, dithering, visible pixels, retro 8-bit or 16-bit styling, flat untextured surfaces, modern logos, real-world brand names, photographic texture, rust, grime, weathering, decay, watermarks, signatures.
```
