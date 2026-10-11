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

LANDSCAPE = '1792x1024'
SQUARE = '1024x1024'

# Settled by the owner after five rounds of rejected returns, and written
# out in full in `assets/generated/set-prompts.md`. Every earlier version of
# this asked for pixel art under some name — "1993 VGA", "crisp clean
# pixels", "painterly pixel art" — and every one of them produced pixel art,
# which reads as a cheaper asset from a different project beside the cast
# plates. The reference is Master of Orion 2 or 3, not 1: the pre-rendered
# look of a space strategy game made a decade later.
#
# Pixel art is excluded here *and* in the exclusion list, because saying it
# once only sets a tone.
STYLE = ('detailed digital illustration in the manner of pre-rendered art '
         'from an early-2000s space strategy game, the generation after '
         'Master of Orion 1 and not that game, smooth rich shading with real '
         'gradients, volumetric light, specular highlights on metal, high '
         'fidelity and finely detailed, not pixel art, no visible pixel '
         'grid, no dithering, no chunky blocks, no retro or 8-bit or 16-bit '
         'styling')

# All runtime text — headlines, chyrons, the ticker — is drawn by the engine,
# so a plate with lettering baked into it is a plate with a frozen headline.
# The one exception is the station badge on an anchor's uniform, which is part
# of the costume; it is allowed only on the prompts that have a uniform in
# them, because offering the exception to a landscape backdrop just invites
# lettering into a picture that should have none.
#
# Written as a list of things rather than a list of "no X", because these now
# follow "Do not include:" rather than sitting in a negative-prompt field.
_NEG_BASE = ('pixel art, dithering, visible pixels, retro 8-bit or 16-bit '
             'styling, flat untextured surfaces, large areas of a single '
             'colour, modern logos, real-world brand names, photographic '
             'texture, rust, grime, weathering, decay, watermarks, '
             'signatures')
NEGATIVE = ('captions, headlines, tickers, labels, letters, numbers or '
            'writing of any kind anywhere in the image, ' + _NEG_BASE)
NEGATIVE_UNIFORM = ('captions, headlines, tickers, labels or lettering '
                    'anywhere other than the small GNN badge on the uniform, '
                    + _NEG_BASE)
# A news desk carries its station's name; that is furniture, not a headline,
# and it never changes, so baking it in costs nothing.
# A backdrop is the one plate where a window, a room or a person is not a
# small mistake but the whole picture being wrong: the engine composites it
# *into* a window in a room with two people already in it.
NEGATIVE_BACKDROP = ('people, figures, silhouettes, astronauts, crew, any '
                     'window frame, glass, mullions, struts or railings, any '
                     'interior, room, cockpit, bridge or space-station '
                     'module, any foreground object or framing device, '
                     'captions, headlines, tickers, labels, letters, numbers '
                     'or writing of any kind anywhere in the image, '
                     + _NEG_BASE)
NEGATIVE_DESK = ('captions, headlines, tickers or lettering anywhere other '
                 'than the station name on the front of the desk, '
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
    ('mrrshan_f', 'Mrrshan Matriarch', 'a tawny feline alien with slit '
     'pupils, tufted ears and a short muzzle, finer-boned and longer-maned '
     'than the male, jewelled cuffs on the ears', 'diplomatic'),
    ('klackon', 'Klackon', 'an insectoid alien with chitinous plating, '
     'mandibles and compound eyes', 'industry'),
    ('human', 'Human Commander', 'a grey-haired human officer in a high-collar '
     'uniform, lined face, calm expression', 'diplomatic'),
]

# The pose text used to begin "seated at a news desk", which is what put an
# opaque desk across the bottom of the first batch. The anchor is a cut-out;
# the desk is a separate plate in front of it.
POSES = [
    ('desk_hero', 'seated upright and square to camera, shoulders level, '
     'looking straight down the lens, mouth closed, forearms coming forward '
     'and hands resting loosely clasped in front of them at the very bottom '
     'of the frame, as if on a desk that is not drawn',
     'head, shoulders, chest and hands, cropped just below the hands, the '
     'head occupying the upper third'),
    ('speaking', 'EDIT: open the mouth as if mid-word. Change nothing else',
     'do not re-pose, re-scale, re-frame, re-light or redraw any other part'),
    # "Turn the eyes slightly" was below what the model will act on: nine of
    # eleven came back with the pupils exactly where the hero left them.
    # A head turn is a change it cannot miss, and reads better anyway.
    ('listening', 'EDIT: turn the head about twenty degrees to the figure\'s '
     'left, so they are looking at someone seated beside them rather than '
     'at the camera. The eyes follow the head. Mouth stays closed. This '
     'must be clearly visible — if the head still faces the camera the '
     'edit has failed',
     'same framing, same distance, same lighting; only the head turns'),
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
# What the window LOOKS OUT ON — not a picture of a window.
#
# These said "seen through a studio window", and the model drew the studio:
# `earth_globe_dusk` came back as a shot from inside a space station with a
# man standing in it, which is a room, not a backdrop. The engine keys these
# into the window opening itself, so anything resembling glass, a frame, a
# mullion or an interior arrives twice.
BACKDROPS = [
    ('earth_globe', 'a blue-green homeworld filling most of the frame, seen '
     'from high orbit, the terminator line crossing it and city lights on '
     'the night side', 'station', True),
    ('asteroid_field', 'a working asteroid mining field in open space, rigs '
     'and running lights among slowly tumbling rock', 'industry', True),
    # The only one with an atmosphere, and so the only one with a sky.
    ('colony_domes', 'a colony of geodesic domes on a dusty plain under an '
     'alien sky, a distant ridgeline beyond', 'station', False),
    ('orion_shipyard', 'an orbital shipyard with a half-built capital ship in '
     'its scaffold, work lights and tugs around it', 'military', True),
]
# Two cycles, because three of the four backdrops are in vacuum and there
# is no sky out there to go violet. Asked for one anyway, the model supplies
# an atmosphere, and the quickest way for it to justify one is to put the
# camera somewhere with a window.
DAY_CYCLE = [
    ('dawn', 'low warm light raking across the scene, long shadows'),
    ('day', 'flat bright illumination, crisp detail, pale sky'),
    ('dusk', 'deep orange and violet sky, rim-lit edges'),
    ('night', 'near-black with artificial lights and starfield dominant'),
]
ORBIT_CYCLE = [
    ('dawn', 'the sun low and just clearing the limb, long raking light '
     'across the subject, deep black space behind'),
    ('day', 'full harsh sunlight from one side, crisp unfiltered detail, '
     'hard shadows, deep black space behind'),
    ('dusk', 'the sun almost gone behind the subject, a warm rim of light '
     'along its edge and the rest falling into shadow'),
    ('night', 'unlit by the sun, near-black, picked out only by its own '
     'running lights and a dense starfield behind'),
]

# The newsroom itself. The desk prompts below dress a room that was never
# described anywhere, which is why a generated desk has nothing to sit in.
#
# These are separate plates, not one picture, because the engine composites:
# the room is drawn behind the anchors and the desk in front of them, so a
# single baked image of the whole scene cannot have anyone sit at it.
SET = [
    ('studio_wide_empty',
     'the interior of a starship television studio photographed from a seated '
     'camera at desk height, looking level across the room rather than down '
     'into it. A long shot: the back wall is far away, the side walls run '
     'steeply off toward it, and there is a clear stretch of empty floor '
     'between the camera and the back of the room. Bevelled hull panelling, '
     'a wide viewport set low in the far back wall at the height of a seated '
     'person, instrument consoles recessed into the side walls, overhead '
     'lighting rigs catching the tops of the walls, a shallow step in the '
     'floor partway back. No desk, no furniture in the centre, no figures',
     'station',
     'wide empty set plate, camera at seated eye level and perfectly level — '
     'no downward tilt, no view across a table top. One-point perspective '
     'with the vanishing point low and central. Deep: foreground floor in '
     'the bottom quarter, mid-ground empty, back wall small and distant',
     'the viewport opening is a flat area of pure black, showing nothing at '
     'all — no stars, no planet, no light'),
    ('desk_oval_front',
     'a wide television news desk seen from slightly above, so that both its '
     'dark slate top surface and its front face are visible — the top reads '
     'as a shallow receding plane with a pale bevelled lip along its front '
     'edge, which is what makes it look solid rather than like a painted '
     'wall. A broad trapezoid: the ends taper inward toward the floor and '
     'show a thin angled return, so the desk has thickness and depth. The '
     'front face is brushed pale metal carrying three horizontal lit strips '
     'along its upper edge — rose, pale green and lavender, left to right — '
     'a large recessed dark panel in the centre reading GNN in bold letters '
     'with GALACTIC NEWS NETWORK small beneath it, a smaller recessed '
     'readout panel either side of it with faint glowing text and a coloured '
     'outline, pale vertical ribs at both ends and flanking the centre '
     'panel, and small vent grilles at the bottom corners. The desk only, '
     'nothing behind it and nothing resting on it',
     'station',
     'seen from a camera a little above desk height and straight on, the '
     'desk filling the width of the frame, its top surface occupying the '
     'upper quarter of the shape and the front face the rest',
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


def prompt(subject, framing, palette, background, negative=None,
           size=LANDSCAPE, transparent=False):
    """One self-contained block: everything the model needs, nothing else.

    The size goes inside it. Stated anywhere else it is something the operator
    has to remember to ask for separately, which is a step that gets skipped.
    And "Negative prompt:" is Stable Diffusion syntax — a chat model reads it
    as more description and cheerfully draws a watermark — so it is phrased as
    the plain instruction it needs to be.
    """
    opening = 'Create a %s image%s.' % (
        size, ' with a fully transparent background' if transparent else '')
    return (
        '%s\n\n%s. %s. Framing: %s. Palette: %s. Background: %s.\n\n'
        'Do not include: %s.'
        % (opening, STYLE, subject, framing, PALETTES[palette], background,
           negative or NEGATIVE)
    )


def main():
    items = load_catalogue()
    os.makedirs(OUT_DIR, exist_ok=True)
    L = []
    w = L.append
    count = [0]

    def asset(fname, prompt_text, note=None):
        """One asset: where it is saved, and the single block to paste."""
        w('#### `%s`\n' % fname)
        w('Save the result as `assets/generated/%s`.\n' % fname)
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
    w('**Copy the whole fenced block and paste it. That is the entire job.** '
      'Each block already says what size to make the image, so there is '
      'nothing to set up beforehand and nothing to remember. Everything '
      'outside the block is for you — where to save the file, and the '
      'occasional note.\n')
    w('Two shapes are used. Rooms, backdrops and cutaways are `%s`, because '
      'the broadcast frame is %dx%d (%.2f:1) and a wide plate covers it '
      'without losing its sides. Characters and props are `%s`, because they '
      'are subjects cut out on transparency rather than pictures of a frame.\n'
      % (LANDSCAPE, vw, vh, aspect, SQUARE))
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
      'between the room and it. The hands matter — an anchor with their '
      'hands on the desk reads as sitting at it, and one cropped at the '
      'chest reads as standing behind it. Draw the hands resting on nothing; '
      'the desk arrives under them later.\n')
    for sid, label, look, palette in SPECIES:
        w('### %s\n' % label)
        for pose, pose_desc, framing in POSES:
            fname = 'anchors/%s_%s.png' % (sid, pose)
            if pose == 'desk_hero':
                asset(fname, prompt(
                    'a %s, %s, wearing a GNN-badged broadcast uniform, %s. '
                    'No desk, no table, no furniture and no surface under '
                    'the hands — the hands rest on nothing, and the desk is '
                    'composited in afterwards'
                    % (label, look, pose_desc),
                    framing, palette,
                    'fully transparent, subject cleanly cut out on empty '
                    'transparency with no backdrop, vignette or floor',
                    negative=NEGATIVE_UNIFORM, size=SQUARE,
                    transparent=True))
            else:
                asset(fname,
                      '%s. %s%s.\n\nKeep the image exactly %s with the same '
                      'fully transparent background. Keep the GNN badge on '
                      'the uniform exactly as it is, lettering and all — do '
                      'not blank it or redraw it. Add no other text.'
                      % (pose_desc, framing[0].upper(), framing[1:], SQUARE),
                      note='**Upload `%s_desk_hero.png` first**, then paste '
                           'this. It is an edit of that image, not a new one.'
                           % sid)

    w('## Newsroom Set\n')
    w('The room the anchors sit in, as separate layers: the engine draws the '
      'room, then the anchors, then the desk in front of them. One baked '
      'picture of the whole scene would have nobody able to sit at it.\n')
    w('The window in the back wall must be **flat pure black** — that is what '
      'the engine keys the exterior backdrop into. Nothing else in the room '
      'may be pure black.\n')
    w('**The desk has to show its top.** A desk drawn flat-on is a painted '
      'wall: there is nowhere for an anchor to put their hands, and without '
      'hands on a surface the shot reads as people standing behind a '
      'counter. The visible top plane and the tapered ends are what sell it '
      'as furniture in a room.\n')
    for sid, subject, palette, framing, background in SET:
        wide = sid in ('studio_wide_empty', 'desk_oval_front')
        asset('set/%s.png' % sid,
              prompt(subject, framing, palette, background,
                     negative=(NEGATIVE_DESK if sid == 'desk_oval_front'
                               else None),
                     size=LANDSCAPE if wide else SQUARE,
                     transparent=sid != 'studio_wide_empty'))

    w('## PIP Cutaways\n')
    w('The footage behind the anchor\'s shoulder. One plate per story '
      'category; the keywords are what routes a story to it.\n')
    for cid, subject, palette, keywords in CUTAWAYS:
        asset('cutaways/%s.png' % cid,
              prompt(subject, 'wide cutaway plate, full bleed to all four '
                     'edges, no border and no frame, the subject readable at '
                     'a glance', palette, 'full-bleed scene, no transparency',
                     size=LANDSCAPE),
              note='Shown behind the anchor for stories about: `%s`.'
                   % '`, `'.join(keywords))

    w('## Exterior Window Backdrops\n')
    w('What is seen **through** the window in the back wall — the view '
      'itself, not a picture of a window. The engine keys these into the '
      'window opening, so the glass, the mullions and the room are already '
      'there; a plate that draws them again arrives with two sets. Four '
      'moods across four times of day; the scheduler picks a mood per show '
      'block and the time of day from the clock. The plate is cropped to the '
      'opening, so keep the subject centred and clear of the edges.\n')
    for bid, subject, palette, vacuum in BACKDROPS:
        for phase, light in (ORBIT_CYCLE if vacuum else DAY_CYCLE):
            asset('backdrops/%s_%s.png' % (bid, phase),
                  prompt('%s, %s' % (subject, light),
                         'an unobstructed exterior view with nothing in the '
                         'foreground, as if the camera were outside; wide '
                         'plate, full bleed, the subject centred and clear '
                         'of the edges', palette,
                         'full-bleed scene, no transparency',
                         negative=NEGATIVE_BACKDROP, size=LANDSCAPE))

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
