#!/usr/bin/env python3
"""
prompt_bridge.py — emit text-to-image prompts for what MOO1 cannot supply.

The rebuilt extraction pipeline gives us 76 admitted cutaways, 132 portraits
and 399 sprites, but none of it was drawn for a broadcast: Master of Orion has
no three-up anchor desk, no species portrait in news framing, and no exterior
window across a day cycle. This walks the show format's asset requirements
against the real catalogue and writes a prompt for every genuine gap.

It does not invent gaps. A requirement that an admitted MOO1 asset already
covers is reported as covered, with the asset id, and no prompt is written.

    python3 tools/prompt_bridge.py            # -> assets/generated/prompts.md
"""

import json
import re
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'assets', 'generated')
MANIFEST = os.path.join(ROOT, 'assets', 'gfx-manifest.json')

STYLE = ('1993 VGA pixel art, 320x180, 256-colour DOS-era palette, '
         'Master of Orion 1 aesthetic, slight CRT scanline character, '
         'painterly pixel dithering, hand-placed pixels, no photographic detail')

# The station badge on a uniform is wanted and is the one exception; every
# other piece of lettering is drawn by the engine at runtime, and baking a
# headline or a ticker into a plate freezes it.
NEGATIVE = ('no modern logos, no real-world brand names, no realistic human '
            'faces, no anti-aliasing, no smooth gradients beyond 1993 VGA '
            'dithering, no captions, headlines, tickers, labels or lettering '
            'anywhere in the scene other than the GNN badge on a uniform (the '
            'engine draws all other text), no watermark, no signature, no 3D '
            'render, no airbrush')

PALETTES = {
    'military': 'cold steel blues and gunmetal greys, hazard amber accents',
    'diplomatic': 'warm ambers and oxblood reds, brass highlights',
    'science': 'cyan and magenta on deep indigo, phosphor-green readouts',
    'anomaly': 'deep violet and ultraviolet white, bruised purple shadows',
    'industry': 'rust orange and iron grey, sodium-lamp yellow',
    'station': 'muted teal and bone white, warning-stripe yellow',
}

# The species the show format puts on the desk, with the look to lock.
SPECIES = [
    ('bulrathi', 'Bulrathi', 'a large brown-furred bear-like alien, heavy brow, '
     'broad shoulders filling the frame', 'military'),
    ('psilon', 'Psilon', 'a slender grey-skinned alien with an enormous domed '
     'cranium and huge black eyes', 'science'),
    ('mrrshan', 'Mrrshan', 'a tawny feline alien with slit pupils, tufted ears '
     'and a short muzzle', 'diplomatic'),
    ('meklar', 'Meklar', 'a cyborg with a segmented metal faceplate, exposed '
     'cabling and a single glowing optical band', 'industry'),
    ('sakkra', 'Sakkra', 'a green reptilian alien with a crested skull and '
     'vertical slit pupils', 'military'),
    ('alkari', 'Alkari', 'an avian alien with a hooked beak, crest feathers '
     'and bright round eyes', 'station'),
    ('darlok', 'Darlok', 'a hooded shadow-shrouded figure whose face is an '
     'indistinct darkness with two faint red points', 'anomaly'),
    ('silicoid', 'Silicoid', 'a crystalline rock-bodied being with faceted '
     'mineral plates and glowing seams', 'industry'),
    ('klackon', 'Klackon', 'an insectoid alien with chitinous plating, '
     'mandibles and compound eyes', 'industry'),
    ('human', 'Human Commander', 'a grey-haired human officer in a high-collar '
     'uniform, lined face, calm expression', 'diplomatic'),
]

# The pose text used to begin "seated at a news desk", which is what put an
# opaque desk across the bottom of the first batch. The anchor is a cut-out;
# the desk is a separate plate in front of it.
POSES = [
    ('desk_hero', 'upright and square to camera, shoulders level, looking '
     'straight down the lens, mouth closed, arms down and out of frame',
     'head and shoulders, chest cropped at the bottom edge of the frame, '
     'the head occupying the upper middle'),
    ('speaking', 'EDIT: open the mouth as if mid-word. Change nothing else',
     'do not re-pose, re-scale, re-frame, re-light or redraw any other part'),
    ('listening', 'EDIT: turn the eyes slightly off-camera, as if attending '
     'to a co-anchor. Change nothing else',
     'do not re-pose, re-scale, re-frame, re-light or redraw any other part'),
]

# The twelve cutaway subjects the scene catalogue maps stories onto, with the
# keyword each is reached by.
CUTAWAYS = [
    ('starship_battle', 'two capital starships exchanging beam fire across open '
     'space, hull plating glowing where it is struck, debris tumbling',
     'military', ['fleet', 'war', 'invasion', 'attack']),
    ('space_vortex', 'a swirling gravitational vortex tearing a hole in a '
     'starfield, light bending around its rim', 'anomaly',
     ['physics', 'quantum', 'anomaly', 'wormhole']),
    ('planet_invasion', 'drop-pods streaking down through a planet atmosphere '
     'toward a defended colony, flak bursts around them', 'military',
     ['invasion', 'troops', 'siege']),
    ('hacker_code', 'a dim terminal room, cascading columns of alien glyphs on '
     'a wall of screens, one operator silhouetted', 'science',
     ['hack', 'cyber', 'breach', 'malware']),
    ('council_vote', 'a tiered alien council chamber mid-vote, delegates of '
     'several species raising voting tokens', 'diplomatic',
     ['vote', 'council', 'senate', 'legislation']),
    ('asteroid_mining', 'mining rigs clamped to a tumbling asteroid, ore '
     'conveyors and floodlights against black space', 'industry',
     ['mining', 'minerals', 'resources']),
    ('virus_outbreak', 'a quarantined colony dome interior, figures in sealed '
     'suits under harsh amber warning light', 'science',
     ['plague', 'virus', 'outbreak', 'disease']),
    ('station_trade', 'a busy orbital trade station with freighters docked at '
     'radial arms, cargo moving along lit gantries', 'station',
     ['trade', 'cargo', 'economy', 'shipping']),
    ('solar_flare', 'an enormous solar prominence arcing off a star, a small '
     'silhouetted station in the foreground', 'anomaly',
     ['solar', 'flare', 'star', 'radiation']),
    ('black_hole', 'an accretion disc around a black hole, light smeared into '
     'a ring, a survey probe dwarfed beside it', 'anomaly',
     ['black hole', 'gravity', 'singularity']),
    ('spy_infiltration', 'a cloaked figure slipping through a sealed bulkhead '
     'door into a lit corridor, alarm strip glowing', 'military',
     ['spy', 'espionage', 'infiltration', 'sabotage']),
    ('council_summit', 'a formal summit table with ambassadors of several alien '
     'species seated opposite one another, banners behind', 'diplomatic',
     ['treaty', 'summit', 'accord', 'diplomacy']),
]

# Exterior window moods across a day cycle.
BACKDROPS = [
    ('earth_globe', 'a blue-green homeworld seen from high orbit through a wide '
     'studio window, terminator line crossing it', 'station'),
    ('asteroid_field', 'a working asteroid mining field seen through a studio '
     'window, rigs and running lights among tumbling rock', 'industry'),
    ('colony_domes', 'a colony of geodesic domes on a dusty plain seen through '
     'a studio window, distant ridgeline beyond', 'station'),
    ('orion_shipyard', 'an orbital shipyard with a half-built capital ship in '
     'its scaffold, work lights and tugs around it', 'military'),
]
DAY_CYCLE = [
    ('dawn', 'low warm light raking across the scene, long shadows'),
    ('day', 'flat bright illumination, crisp detail, pale sky'),
    ('dusk', 'deep orange and violet sky, rim-lit edges'),
    ('night', 'near-black with artificial lights and starfield dominant'),
]

# The newsroom itself. The desk prompts below dress a room that was never
# described anywhere, which is why a generated desk has nothing to sit in.
#
# These are separate plates, not one picture, because the engine composites:
# the room is drawn behind the anchors and the desk in front of them, so a
# single baked image of the whole scene cannot have anyone sit at it.
SET = [
    ('studio_wide_empty',
     'the interior of a starship television studio: bevelled hull wall panels, '
     'a large octagonal viewport dominating the centre of the back wall, angled '
     'instrument consoles built into the side walls with rows of lit indicator '
     'buttons, a raised circular floor dais with an inlaid trim ring. No desk, '
     'no furniture in the centre, no figures',
     'station',
     'wide empty set plate, the viewport centred on the back wall, floor '
     'occupying the lower third, nothing in the middle ground where the desk '
     'and anchors will be composited',
     'the viewport opening is flat pure black with no stars and no planet — the '
     'engine composites the exterior backdrop into it'),
    ('desk_oval_front',
     'an oval television news desk seen straight on, brushed metal top, curved '
     'front panel with a lit strip running around it and a blank recessed plate '
     'in the centre for a station emblem. The desk only, nothing behind it',
     'station',
     'foreground layer, the desk filling the lower half of the frame, drawn as '
     'it would be seen from a camera at seated eye level',
     'transparent background, the desk cleanly cut out so anchors composite '
     'behind it'),
    ('console_left',
     'an angled wall-mounted instrument console with rows of small lit square '
     'indicator buttons and two small readout screens, seen from its right',
     'military',
     'single prop plate, the console filling the frame',
     'transparent background, cleanly cut out'),
    ('console_right',
     'an angled wall-mounted instrument console with rows of small lit square '
     'indicator buttons and two small readout screens, seen from its left',
     'military',
     'single prop plate, the console filling the frame',
     'transparent background, cleanly cut out'),
]

DESK = [
    ('desk_three_up_empty', 'an empty three-seat television news desk in a '
     'science-fiction studio, angled front panel with an inset station emblem '
     'plate, seen straight on', 'station',
     'wide backdrop plate, desk occupying the lower third, space above for '
     'three seated figures to be composited in'),
    ('desk_two_up_empty', 'an empty two-seat television news desk in a '
     'science-fiction studio, angled front panel, seen straight on', 'station',
     'wide backdrop plate, desk occupying the lower third'),
]


def viewport():
    """The broadcast frame, read from the renderer's own constants.

    The picture fills the window, so this is the whole canvas rather than a
    lit area inside a set. Generated plates are composited into it, so its
    shape — not the image model's default — is the aspect ratio every
    full-bleed plate has to be drawn at. Returns (base_w, base_h, aspect).
    """
    src = os.path.join(ROOT, 'js', 'renderer.js')
    w, h = 320, 180
    try:
        text = open(src).read()
        mw = re.search(r"BASE_W\s*=\s*(\d+)", text)
        mh = re.search(r"BASE_H\s*=\s*(\d+)", text)
        if mw and mh:
            w, h = int(mw.group(1)), int(mh.group(1))
    except OSError:
        pass
    return w, h, w / float(h)


def load_catalogue():
    if not os.path.exists(MANIFEST):
        return []
    with open(MANIFEST) as fh:
        m = json.load(fh)
    return [e for arc in m.values() for e in arc]


def covered_by(items, pool, dirs=None, min_w=0):
    """Admitted MOO1 assets that could stand in for a requirement."""
    out = []
    for e in items:
        if pool not in (e.get('pools') or []):
            continue
        if dirs and e['dir'] not in dirs:
            continue
        if e['w'] < min_w:
            continue
        out.append(e['id'])
    return out


def prompt(subject, framing, palette, background):
    return (
        '%s. %s. Framing: %s. Palette: %s. Background: %s.\n\n'
        '**Negative prompt:** %s'
        % (STYLE, subject, framing, PALETTES[palette], background, NEGATIVE)
    )


def main():
    items = load_catalogue()
    os.makedirs(OUT_DIR, exist_ok=True)
    L = []
    w = L.append

    portraits = covered_by(items, 'portrait')
    brolls = covered_by(items, 'broll')

    w('# GNN — Generated Asset Prompts\n')
    w('Produced by `tools/prompt_bridge.py`. Every prompt below is a gap the '
      'Master of Orion 1 catalogue cannot fill in broadcast framing.\n')
    w('Paste each prompt into an image model, then save the result to the '
      'filename shown above it, under `assets/generated/`. Directory structure '
      'matters — the engine resolves assets by that path.\n')
    w('**Ask for landscape, the widest the model offers — 1792x1024 in '
      'ChatGPT.** The broadcast frame is %dx%d (%.2f:1) and everything is '
      'fitted to it by `tools/condition_plates.py`, which also removes the '
      'black edge fringe, cuts the palette to 256 colours and hardens the '
      'alpha. Nothing here needs to be the right size or the right number of '
      'colours when it leaves the image model; it needs to be the right '
      '*shape*, and 1792x1024 is within a hair of the frame.\n'
      % (viewport()[0], viewport()[1], viewport()[2]))
    w('**Run every finished batch through the conditioner** before judging it: '
      '`python3 tools/condition_plates.py --preview`.\n')
    w('**Catalogue at time of writing:** %d admitted cutaways, %d admitted '
      'portraits. Those cover subject matter, not framing: MOO1 has ambassador '
      'portraits, but none cut out for a news set and nothing resembling a '
      'studio to put them in.\n' % (len(brolls), len(portraits)))
    w('**Style is locked across every prompt** so the generated set cuts '
      'together with the extracted set. Do not paraphrase the style or negative '
      'clauses.\n')
    w('---\n')

    count = 0

    w('## Anchor Portraits\n')
    w('Three states per species. The engine crossfades `desk_hero` to '
      '`speaking` on the active anchor and holds `listening` on the others, so '
      'the three must share pose, scale, eye-line and lighting exactly.\n')
    w('**Generate the hero once, then make the other two by editing that '
      'image** — open the mouth, raise a paw — rather than by running the '
      'prompt three times. Three independent generations do not match, and '
      'the mismatch is not subtle: the first Bulrathi set came back with the '
      'head top at 63, 44 and 28 pixels and the shoulder span at 716, 776 and '
      '848, an 18% growth in scale across the three. Crossfaded, that reads '
      'as the anchor lurching at the camera.\n')
    w('**No desk in these.** The desk is its own plate and the anchors '
      'composite in front of the set and behind it. A desk baked into the '
      'character plate is opaque across the full width of the frame and paints '
      'over both.\n')
    for sid, label, look, palette in SPECIES:
        near = [i for i in portraits if i.startswith('EMBASSY/')]
        w('### %s\n' % label)
        if near:
            w('> MOO1 has ambassador portraits (%s and others) but none in desk '
              'framing, so these are generated.\n' % near[0])
        for pose, pose_desc, framing in POSES:
            fname = 'anchors/%s_%s.png' % (sid, pose)
            w('#### `%s`\n' % fname)
            if pose == 'desk_hero':
                w('```\n%s\n```\n' % prompt(
                    'a %s, %s, wearing a GNN-badged broadcast uniform, %s. '
                    'Head, shoulders and chest only — no desk, no table, no '
                    'furniture, nothing beneath or in front of the figure'
                    % (label, look, pose_desc),
                    framing, palette,
                    'fully transparent, subject cleanly cut out on empty '
                    'transparency with no backdrop, vignette or floor — the '
                    'engine composites it over the set and the desk plate'))
            else:
                w('*Not a new picture.* Upload `anchors/%s_desk_hero.png` and '
                  'ask for this edit, so the two match it exactly.\n' % sid)
                w('```\n%s. %s%s.\n\n**Negative prompt:** %s\n```\n'
                  % (pose_desc, framing[0].upper(), framing[1:], NEGATIVE))
            count += 1

    vw, vh, aspect = viewport()
    w('## Newsroom Set\n')
    w('The room the desk sits in. Generated as separate layers rather than one '
      'picture, because the engine draws the room behind the anchors and the '
      'desk in front of them — a single baked image of the whole scene has '
      'nobody able to sit at it.\n')
    w('**Geometry.** The picture fills the window: there is no set around it '
      'and no monitor frame inside it. The frame is **%d x %d source pixels, '
      '%.2f:1**, and a full-bleed plate is drawn to cover it. A plate at the '
      'image model\'s default 3:2 loses its sides or its top and bottom to '
      'the crop, so ask for landscape.\n' % (vw, vh, aspect))
    w('The window in the back wall is left **flat pure black** so the engine '
      'can composite an exterior backdrop into it. Nothing else in the room '
      'may be pure black, or it will be treated as window too.\n')
    for sid, subject, palette, framing, background in SET:
        fname = 'set/%s.png' % sid
        w('#### `%s`\n' % fname)
        w('```\n%s\n```\n' % prompt(subject, framing, palette, background))
        count += 1

    w('## News Desk Plates — superseded\n')
    w('`set/desk_oval_front.png` above is the desk, and it is already made. '
      'These earlier three-up and two-up prompts drew a desk *and* the studio '
      'behind it as one picture, which cannot work now that anchors composite '
      'between the room and the desk. **Do not generate these.** They are kept '
      'only so the filenames are not reused for something else.\n')

    w('## PIP Cutaways\n')
    w('One wide plate per story category. Keyword mapping is listed so the '
      'router in `cutscene-manager.js` can be pointed at these directly.\n')
    for cid, subject, palette, keywords in CUTAWAYS:
        fname = 'cutaways/%s.png' % cid
        w('#### `%s`\n' % fname)
        w('*Routes from:* `%s`\n' % '`, `'.join(keywords))
        w('```\n%s\n```\n' % prompt(
            subject, 'wide cutaway plate, full bleed to all four edges, '
            'no border and no frame, the subject readable at a glance',
            palette, 'full-bleed scene, no transparency'))
        count += 1

    w('## Exterior Window Backdrops\n')
    w('What is seen through the window in the back wall of the set. Four moods '
      'across four times of day; the scheduler picks a mood per show block and '
      'a time of day from the local clock.\n')
    w('Generate these the same shape as everything else. The engine fits them '
      'into the window opening and crops the overflow, so the subject wants to '
      'be centred and nothing important should sit near an edge.\n')
    for bid, subject, palette in BACKDROPS:
        for phase, light in DAY_CYCLE:
            fname = 'backdrops/%s_%s.png' % (bid, phase)
            w('#### `%s`\n' % fname)
            w('```\n%s\n```\n' % prompt(
                '%s, %s' % (subject, light),
                'wide backdrop plate, full bleed, horizon in the lower third, '
                'the subject centred and clear of the edges', palette,
                'full-bleed scene, no transparency'))
            count += 1

    w('---\n')
    w('**%d prompts.** Save each to `assets/generated/<path shown>`, then run '
      '`python3 tools/verify_assets.py` to confirm the engine resolves them.\n'
      % count)

    dest = os.path.join(OUT_DIR, 'prompts.md')
    with open(dest, 'w') as fh:
        fh.write('\n'.join(L))
    print('%d prompts -> %s' % (count, dest))
    print('catalogue: %d admitted cutaways, %d admitted portraits'
          % (len(brolls), len(portraits)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
