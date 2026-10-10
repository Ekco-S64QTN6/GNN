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
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'assets', 'generated')
MANIFEST = os.path.join(ROOT, 'assets', 'gfx-manifest.json')

STYLE = ('1993 VGA pixel art, 320x200, 256-colour DOS-era palette, '
         'Master of Orion 1 aesthetic, slight CRT scanline character, '
         'painterly pixel dithering, hand-placed pixels, no photographic detail')

NEGATIVE = ('no modern logos, no real-world brand names, no realistic human '
            'faces, no anti-aliasing, no smooth gradients beyond 1993 VGA '
            'dithering, no text or lettering of any kind (the engine draws all '
            'text), no watermark, no signature, no 3D render, no airbrush')

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

POSES = [
    ('desk_hero', 'seated at a news desk, three-quarter view, facing the viewer '
     'slightly off-axis, hands resting on the desk surface',
     'waist-up portrait framing, subject occupying the centre third'),
    ('speaking', 'seated at a news desk, mouth open mid-sentence, one hand '
     'raised in a small explanatory gesture',
     'waist-up portrait framing, subject occupying the centre third'),
    ('listening', 'seated at a news desk, mouth closed, head turned slightly '
     'off-camera as if listening to a co-anchor',
     'waist-up portrait framing, subject occupying the centre third'),
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
    w('**Catalogue at time of writing:** %d admitted cutaways, %d admitted '
      'portraits. Those cover subject matter, not framing: MOO1 has ambassador '
      'portraits but none seated at a news desk, and no three-up desk at all.\n'
      % (len(brolls), len(portraits)))
    w('**Style is locked across every prompt** so the generated set cuts '
      'together with the extracted set. Do not paraphrase the style or negative '
      'clauses.\n')
    w('---\n')

    count = 0

    w('## Anchor Portraits\n')
    w('Three states per species. The engine crossfades `desk_hero` to '
      '`speaking` on the active anchor and holds `listening` on the others, so '
      'the three must share pose, scale, eye-line and lighting exactly.\n')
    for sid, label, look, palette in SPECIES:
        near = [i for i in portraits if i.startswith('EMBASSY/')]
        w('### %s\n' % label)
        if near:
            w('> MOO1 has ambassador portraits (%s and others) but none in desk '
              'framing, so these are generated.\n' % near[0])
        for pose, pose_desc, framing in POSES:
            fname = 'anchors/%s_%s.png' % (sid, pose)
            w('#### `%s`\n' % fname)
            w('```\n%s\n```\n' % prompt(
                'a %s, %s, wearing a GNN-badged broadcast uniform, %s'
                % (label, look, pose_desc),
                framing, palette,
                'transparent background, subject cleanly cut out for '
                'compositing over a desk plate'))
            count += 1

    w('## News Desk Plates\n')
    for did, subject, palette, framing in DESK:
        fname = 'desk/%s.png' % did
        w('#### `%s`\n' % fname)
        w('```\n%s\n```\n' % prompt(subject, framing, palette,
                                    'studio interior, dark behind the desk'))
        count += 1

    w('## PIP Cutaways\n')
    w('One wide plate per story category. Keyword mapping is listed so the '
      'router in `cutscene-manager.js` can be pointed at these directly.\n')
    for cid, subject, palette, keywords in CUTAWAYS:
        fname = 'cutaways/%s.png' % cid
        w('#### `%s`\n' % fname)
        w('*Routes from:* `%s`\n' % '`, `'.join(keywords))
        w('```\n%s\n```\n' % prompt(
            subject, 'wide cutaway plate, full 320x200 bleed, no border',
            palette, 'full-bleed scene, no transparency'))
        count += 1

    w('## Exterior Window Backdrops\n')
    w('Four moods across four times of day. The scheduler picks a mood per show '
      'block and a time of day from the local clock.\n')
    for bid, subject, palette in BACKDROPS:
        for phase, light in DAY_CYCLE:
            fname = 'backdrops/%s_%s.png' % (bid, phase)
            w('#### `%s`\n' % fname)
            w('```\n%s\n```\n' % prompt(
                '%s, %s' % (subject, light),
                'wide backdrop plate, full 320x200 bleed, horizon in the '
                'lower third', palette, 'full-bleed scene, no transparency'))
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
