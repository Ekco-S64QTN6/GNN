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

STYLE = ('1993 VGA pixel art, 256-colour DOS-era palette, Master of Orion 1 '
         'aesthetic, chunky visible pixels as if drawn for a 320x200 DOS '
         'screen, painterly pixel dithering, hand-placed pixels, no '
         'photographic detail')

# All runtime text — headlines, chyrons, the ticker — is drawn by the engine,
# so a plate with lettering baked into it is a plate with a frozen headline.
# The one exception is the station badge on an anchor's uniform, which is part
# of the costume; it is allowed only on the prompts that have a uniform in
# them, because offering the exception to a landscape backdrop just invites
# lettering into a picture that should have none.
_NEG_BASE = ('no modern logos, no real-world brand names, no realistic human '
             'faces, no anti-aliasing, no smooth gradients beyond 1993 VGA '
             'dithering, no watermark, no signature, no 3D render, no airbrush')
NEGATIVE = ('no captions, headlines, tickers, labels, letters, numbers or '
            'writing of any kind anywhere in the image, ' + _NEG_BASE)
NEGATIVE_UNIFORM = ('no captions, headlines, tickers, labels or lettering '
                    'anywhere other than the small GNN badge on the uniform, '
                    + _NEG_BASE)

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
     'broad shoulders', 'military'),
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
     'wide empty set plate, the window centred on the back wall, floor '
     'occupying the lower third, the centre of the room completely empty',
     'the window opening is a flat area of pure black, showing nothing at '
     'all — no stars, no planet, no light'),
    ('desk_oval_front',
     'an oval television news desk seen straight on, brushed metal top, curved '
     'front panel with a lit strip running around it and a blank recessed plate '
     'in the centre for a station emblem. The desk only, nothing behind it',
     'station',
     'foreground layer, the desk filling the lower half of the frame, drawn as '
     'it would be seen from a camera at seated eye level',
     'transparent background, the desk cleanly cut out'),
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


def prompt(subject, framing, palette, background, negative=None):
    return (
        '%s. %s. Framing: %s. Palette: %s. Background: %s.\n\n'
        '**Negative prompt:** %s'
        % (STYLE, subject, framing, PALETTES[palette], background,
           negative or NEGATIVE)
    )


LANDSCAPE = '1792x1024'
SQUARE = '1024x1024'


def main():
    items = load_catalogue()
    os.makedirs(OUT_DIR, exist_ok=True)
    L = []
    w = L.append
    count = [0]

    def asset(fname, size, prompt_text, note=None):
        """One asset: what to save it as, what size, and what to paste."""
        w('#### `%s`\n' % fname)
        w('<sub>%s &middot; save as `assets/generated/%s`</sub>\n'
          % (size, fname))
        if note:
            w('%s\n' % note)
        w('```\n%s\n```\n' % prompt_text)
        count[0] += 1

    portraits = covered_by(items, 'portrait')
    brolls = covered_by(items, 'broll')
    vw, vh, aspect = viewport()

    w('# GNN — Generated Asset Prompts\n')
    w('Produced by `tools/prompt_bridge.py`. Each one is a gap the Master of '
      'Orion 1 catalogue cannot fill: it has %d usable cutaways and %d '
      'portraits, but none cut out for a news set and nothing resembling a '
      'studio to put them in.\n' % (len(brolls), len(portraits)))
    w('---\n')
    w('## How to use this\n')
    w('**Paste the fenced block. Nothing outside it.** Everything else on the '
      'page is for you, not for the image model — filenames, sizes and the '
      'occasional note about why an asset is the shape it is.\n')
    w('**Use the size given under each filename.** Full-bleed plates are '
      '`%s`, because the broadcast frame is %dx%d (%.2f:1) and a landscape '
      'plate covers it without losing its sides. Cut-out characters and props '
      'are `%s`, because they are subjects on transparency rather than '
      'pictures of a frame.\n' % (LANDSCAPE, vw, vh, aspect, SQUARE))
    w('**Nothing has to be the right pixel size or colour count** when it '
      'leaves the image model. `tools/condition_plates.py` fits every plate to '
      'the frame, removes the black fringe left on cut-out edges, hardens the '
      'alpha and cuts the palette to 256. Shape is the only thing you have to '
      'get right.\n')
    w('**Run the conditioner on each batch before judging it:** '
      '`python3 tools/condition_plates.py --preview`. For anchors it also '
      'checks the three states line up and tells you if they do not.\n')
    w('**Do not paraphrase the style or negative lines.** They are what makes '
      'generated art cut together with the art decoded from the game.\n')
    w('---\n')

    w('## Anchor Portraits\n')
    w('Three states per species. The engine crossfades `desk_hero` into '
      '`speaking` on whoever is talking and holds `listening` on everyone '
      'else, so the three have to be the same drawing with one thing changed '
      '— **make the hero first, then ask for the other two as edits of it.** '
      'Generating them separately gives three subtly different characters and '
      'the crossfade turns into a lurch.\n')
    w('No desk in these: the desk is its own plate, and the anchors sit '
      'between the room and it.\n')
    for sid, label, look, palette in SPECIES:
        w('### %s\n' % label)
        for pose, pose_desc, framing in POSES:
            fname = 'anchors/%s_%s.png' % (sid, pose)
            if pose == 'desk_hero':
                asset(fname, SQUARE, prompt(
                    'a %s, %s, wearing a GNN-badged broadcast uniform, %s. '
                    'Head, shoulders and chest only — no desk, no table, no '
                    'furniture, nothing beneath or in front of the figure'
                    % (label, look, pose_desc),
                    framing, palette,
                    'fully transparent, subject cleanly cut out on empty '
                    'transparency with no backdrop, vignette or floor',
                    negative=NEGATIVE_UNIFORM))
            else:
                asset(fname, SQUARE,
                      '%s. %s%s.\n\nKeep the transparent background. Add no '
                      'text or lettering.'
                      % (pose_desc, framing[0].upper(), framing[1:]),
                      note='Upload `%s_desk_hero.png` and ask for this edit.'
                           % sid)

    w('## Newsroom Set\n')
    w('The room the anchors sit in, as separate layers: the engine draws the '
      'room, then the anchors, then the desk in front of them. One baked '
      'picture of the whole scene would have nobody able to sit at it.\n')
    w('The window in the back wall must be **flat pure black** — that is what '
      'the engine keys the exterior backdrop into. Nothing else in the room '
      'may be pure black.\n')
    for sid, subject, palette, framing, background in SET:
        size = LANDSCAPE if sid == 'studio_wide_empty' else SQUARE
        if sid == 'desk_oval_front':
            size = LANDSCAPE
        asset('set/%s.png' % sid, size,
              prompt(subject, framing, palette, background))

    w('## News Desk Plates — superseded\n')
    w('`set/desk_oval_front.png` above is the desk. The earlier three-up and '
      'two-up prompts drew a desk *and* the studio behind it as one picture, '
      'which cannot work now that the anchors composite between them. **Do '
      'not generate these.** Listed only so the filenames are not reused.\n')

    w('## PIP Cutaways\n')
    w('The footage behind the anchor\'s shoulder. One plate per story '
      'category; the keywords are what routes a story to it.\n')
    for cid, subject, palette, keywords in CUTAWAYS:
        asset('cutaways/%s.png' % cid, LANDSCAPE,
              prompt(subject, 'wide cutaway plate, full bleed to all four '
                     'edges, no border and no frame, the subject readable at '
                     'a glance', palette, 'full-bleed scene, no transparency'),
              note='*Routes from:* `%s`' % '`, `'.join(keywords))

    w('## Exterior Window Backdrops\n')
    w('What is seen through the window in the back wall. Four moods across '
      'four times of day; the scheduler picks a mood per show block and the '
      'time of day from the clock. The engine fits these into the window '
      'opening and crops the overflow, so keep the subject centred and clear '
      'of the edges.\n')
    for bid, subject, palette in BACKDROPS:
        for phase, light in DAY_CYCLE:
            asset('backdrops/%s_%s.png' % (bid, phase), LANDSCAPE,
                  prompt('%s, %s' % (subject, light),
                         'wide backdrop plate, full bleed, horizon in the '
                         'lower third, the subject centred and clear of the '
                         'edges', palette,
                         'full-bleed scene, no transparency'))

    w('---\n')
    w('**%d prompts.** Save each one to the path under its filename, then run '
      '`python3 tools/condition_plates.py --preview`.\n' % count[0])

    dest = os.path.join(OUT_DIR, 'prompts.md')
    with open(dest, 'w') as fh:
        fh.write('\n'.join(L))
    print('%d prompts -> %s' % (count[0], dest))
    print('catalogue: %d admitted cutaways, %d admitted portraits'
          % (len(brolls), len(portraits)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
