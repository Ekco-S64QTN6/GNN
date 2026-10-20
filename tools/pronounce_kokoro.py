#!/usr/bin/env python3
"""pronounce_kokoro.py — check every pronunciation rule against Kokoro itself.

`PRONOUNCE` in js/tts.js respells names the voice gets wrong. Most of its
respellings mark stress with capitals — `you-KRAYN`, `MAH-lee`, `TAL-ih-bahn`
— and Kokoro's phonemiser reads a capitalised chunk it does not know as an
initialism. So the respelling *caused* the fault it was written to fix:
Ukraine went out as "you K-R-A-Y-N", Mali as "M-A-H lee", Pakistan as
"P-A-K ih-stan". Meanwhile Kokoro's own dictionary had most of those words
right to begin with.

This tool asks Kokoro (misaki, in .venv) what it does with each rule, and
writes js/pronounce-kokoro.js, which tts.js applies when the engine is
Kokoro. For each rule:

  drop   Kokoro's dictionary already knows the word (rating 3 or 4) and
         the rule is not a deliberate correction — leave the word alone.
  ipa    Kokoro does not know it: replace it with misaki's inline phoneme
         markup `[word](/phonemes/)`, built syllable by syllable from the
         respelling, primary stress on the capitalised syllable.
  keep   anything else (initialisms spelled with spaces, lowercase
         respellings that already phonemise cleanly, function rules).

OVERRIDES are words whose dictionary entry is the wrong sense or simply
wrong (Niger the river vs the country, Macron the diacritic). EXTRAS are
names added from the news corpus that Kokoro gets wrong and no rule covers.

The cloud and browser voices keep the original table; markup is
Kokoro-only and is stripped anywhere else.

    .venv/bin/python tools/pronounce_kokoro.py            # write the table
    .venv/bin/python tools/pronounce_kokoro.py --report   # print every decision
    .venv/bin/python tools/pronounce_kokoro.py --say Houthi Ukraine
"""
import argparse
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TTS_JS = os.path.join(ROOT, 'js', 'tts.js')
OUT_JS = os.path.join(ROOT, 'js', 'pronounce-kokoro.js')

# Words the dictionary has, but in the wrong sense or wrongly. Phonemes in
# misaki's American set (A = "ay", I = "eye", O = "oh", W = "ow", Y = "oy").
OVERRIDES = {
    'Niger': 'niʒˈɛɹ',
    'Nigerien': 'niʒˈɛɹiən',
    'Macron': 'mɑkɹˈOn',
    'Erdogan': 'ˈɛɹdOwɑn',
    'Erdoğan': 'ˈɛɹdOwɑn',
    'Houthi': 'hˈuθi',
    'Houthis': 'hˈuθiz',
    'Huawei': 'wˈɑwA',
    'Xiaomi': 'ʃWmˈi',
    'Wagner': 'vˈɑɡnəɹ',
    'Gerber': 'ɡˈɜɹbəɹ',
    'Ivanti': 'ɪvˈɑnti',
    'Qatar': 'kˈʌtɑɹ',
    'Qatari': 'kʌtˈɑɹi',
    'Kyiv': 'kˈiv',
    'Mrrshan': 'mˈɜɹʃɑn',
    # Dictionary entries that spell an acronym-word out letter by letter.
    'AUKUS': 'ˈɔkəs',
    'MAGA': 'mˈæɡə',
    'OTAN': 'Otˈɑn',
    'Lesotho': 'ləsˈutu',
    'Asmara': 'ɑsmˈɑɹə',
    'Tigray': 'tˈiɡɹA',
    'Guinea-Bissau': 'ɡˈɪni bɪsˈW',
    "Côte d'Ivoire": 'kˈOt divwˈɑɹ',
    'Hyundai': 'hˈʌndA',
    'Zelensky': 'zɛlˈɛnski',
    'Zelenskyy': 'zɛlˈɛnski',
    'convoy': 'kˈɑnvY',
    'convoys': 'kˈɑnvYz',
    'buoy': 'bˈui',
    'buoys': 'bˈuiz',
    'bouy': 'bˈui',
    'bouys': 'bˈuiz',
    'corvette': 'kɔɹˈvɛt',
    'Reykjavik': 'ˈɹAkjəvik',
    'Reykjavík': 'ˈɹAkjəvik',
    'Volodymyr Zelensky': 'vˌɑlədˈɪmɪɹ zɛlˈɛnski',
    'Volodymyr Zelenskyy': 'vˌɑlədˈɪmɪɹ zɛlˈɛnski',
}

# Names the news corpus surfaced that Kokoro gets wrong and no rule
# covered. Same phoneme set. Each was checked against misaki's own output.
EXTRAS = {
    # The Bulrathi defence anchor: misaki drops the L ("grome").
    'Grolm': 'ɡɹˈOlm',
    'Peskov': 'pɛskˈɔf',
    'Lavrov': 'lævɹˈɔf',
    'Shoigu': 'ʃYɡˈu',
    'Medvedev': 'mɛdvˈɛdɛf',
    'Navalny': 'nævˈɑlni',
    'Sinwar': 'sɪnwˈɑɹ',
    'Haniyeh': 'hænˈijə',
    'Nasrallah': 'næsɹˈælə',
    'Khamenei': 'kɑmənˈA',
    'Pezeshkian': 'pɛzɛʃkiˈɑn',
    'Raisi': 'ɹIˈisi',
    'Assad': 'ɑsˈɑd',
    'Sisi': 'sˈisi',
    'Modi': 'mˈOdi',
    'Starmer': 'stˈɑɹməɹ',
    'Sunak': 'sˈunæk',
    'Scholz': 'ʃˈOlts',
    'Merz': 'mˈɛɹts',
    'Tusk': 'tˈʊsk',
    'Orbán': 'ˈɔɹbɑn',
    'Orban': 'ˈɔɹbɑn',
    'Fico': 'fˈiʦO',
    'Sánchez': 'sˈɑnʧɛz',
    'Milei': 'mɪlˈA',
    'Lula': 'lˈulə',
    'Sheinbaum': 'ʃˈAnbWm',
    'Maduro': 'mədˈʊɹO',
    'Ishiba': 'iʃˈibə',
    'Kishida': 'kiʃˈidə',
    'Albanese': 'ælbənˈizi',
    'Luxon': 'lˈʌksən',
    'Ramaphosa': 'ɹæməpˈOsə',
    'Tinubu': 'tinˈubu',
    'Ruto': 'ɹˈutO',
    'Abiy': 'ˈæbi',
    'Guterres': 'ɡutˈɛɹɛʃ',
    'Grossi': 'ɡɹˈOsi',
    'Tedros': 'tˈɛdɹOs',
    'Hegseth': 'hˈɛɡsɛθ',
    'Rubio': 'ɹˈubiO',
    'Vance': 'vˈæns',
    'Musk': 'mˈʌsk',
    'Bezos': 'bˈAzOs',
    'Zuckerberg': 'zˈʌkəɹbɜɹɡ',
    'Altman': 'ˈɔltmən',
    'Huang': 'hwˈɑŋ',
    'Nadella': 'nədˈɛlə',
    'Pichai': 'piʧˈI',
    'Kharkiv': 'kˈɑɹkɪv',
    'Odesa': 'Odˈɛsə',
    'Odessa': 'Odˈɛsə',
    'Donetsk': 'dənˈɛtsk',
    'Luhansk': 'luhˈɑnsk',
    'Zaporizhzhia': 'zæpəɹˈɪʒə',
    'Bakhmut': 'bɑxmˈut',
    'Avdiivka': 'ævdˈiɪfkə',
    'Pokrovsk': 'pəkɹˈɔfsk',
    'Kherson': 'kɛɹsˈɔn',
    'Mykolaiv': 'mɪkOlˈIɪv',
    'Rafah': 'ɹˈɑfə',
    'Khan Younis': 'kˈɑn jˈunɪs',
    'Jabalia': 'ʤəbˈɑljə',
    'Hodeidah': 'hOdˈAdə',
    'Sanaa': 'sænˈɑ',
    "Sana'a": 'sænˈɑ',
    'Idlib': 'ˈɪdlɪb',
    'Aleppo': 'əlˈɛpO',
    'Raqqa': 'ɹˈɑkə',
    'Tigray': 'tˈiɡɹA',
    'Amhara': 'æmhˈɑɹə',
    'Kidal': 'kˈidɑl',
    'Goma': 'ɡˈOmə',
    'Darfur': 'dɑɹfˈʊɹ',
    'Yandex': 'jˈɑndɛks',
    'Fujitsu': 'fuʤˈitsu',
    'Nikkei': 'nˈikA',
    'Hang Seng': 'hˈæŋ sˈʌŋ',
    'Shenzhen': 'ʃˈʌnʤʌn',
    'Guangzhou': 'ɡwˈɑŋʤO',
    'Xinjiang': 'ʃˈɪnʤiˈɑŋ',
    'Uyghur': 'wˈiɡəɹ',
    'Uyghurs': 'wˈiɡəɹz',
    'Taiwan': 'tIwˈɑn',
    'Hamas': 'hɑmˈɑs',
}

# Vowel-only and common respelling syllables that misaki has no word for.
SYL = {
    'uh': 'ə', 'ih': 'ɪ', 'ee': 'i', 'oo': 'u', 'ay': 'A', 'eye': 'I',
    'oh': 'O', 'ah': 'ɑ', 'aw': 'ɔ', 'ow': 'W', 'oy': 'Y', 'er': 'ɜɹ',
    'eh': 'ɛ', 'ai': 'I', 'ye': 'jɛ', 'yoo': 'ju', 'yah': 'jɑ',
}
ONSET = {
    '': '', 'b': 'b', 'd': 'd', 'f': 'f', 'g': 'ɡ', 'h': 'h', 'j': 'ʤ', 'k': 'k',
    'l': 'l', 'm': 'm', 'n': 'n', 'p': 'p', 'r': 'ɹ', 's': 's', 't': 't', 'v': 'v',
    'w': 'w', 'y': 'j', 'z': 'z', 'sh': 'ʃ', 'ch': 'ʧ', 'th': 'θ', 'zh': 'ʒ',
    'kh': 'k', 'tr': 'tɹ', 'dr': 'dɹ', 'gr': 'ɡɹ', 'kr': 'kɹ', 'pr': 'pɹ',
    'br': 'bɹ', 'fr': 'fɹ', 'st': 'st', 'sp': 'sp', 'sk': 'sk', 'sl': 'sl',
    'sw': 'sw', 'pl': 'pl', 'bl': 'bl', 'kl': 'kl', 'gl': 'ɡl', 'fl': 'fl',
    'kw': 'kw', 'ts': 'ts', 'vl': 'vl', 'ny': 'nj', 'ky': 'kj', 'py': 'pj',
}
OPEN_SYL = re.compile(r'([bcdfghjklmnpqrstvwxyz]*)(ah|ay|ee|oo|oh|ih|uh|eh|aw|ow|eye|ai|er)')
SPELLED = re.compile(r'ˌ[ɛæ]?[A-Z]?ˌ|ˈAʧ|ˌAʧ|ˌiˌ|ˌɛmˌ|ˌɛnˌ|ˌɛsˌ|ˌɛlˌ|ˌɑɹˌ|ˌAˌ')


def load_pronounce():
    js = r"""
const src=require('fs').readFileSync(process.argv[1],'utf8');
const i=src.indexOf('const PRONOUNCE = ['), j=src.indexOf('\n    ];', i);
const P=eval(src.slice(i+'const PRONOUNCE = '.length, j+6));
console.log(JSON.stringify(P.map(([re,to])=>({source:re.source,flags:re.flags,
  to: typeof to==='string'?to:null}))));
"""
    out = subprocess.run(['node', '-e', js, TTS_JS], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def make_g2p():
    import warnings
    warnings.filterwarnings('ignore')
    from kokoro import KPipeline
    pipe = KPipeline(lang_code='a', model=False, repo_id='hexgrad/Kokoro-82M')

    def g2p(text):
        ph, toks = pipe.g2p(text)
        return ph, [getattr(t, 'rating', None) for t in toks]
    return g2p


def plain_of(source):
    """The literal word a rule matches, or None for a pattern."""
    s = re.sub(r'\\b|\(\?=.*$|\\\.\?', '', source)
    s = s.replace('\\s+', ' ').replace('\\-', '-').replace('\\.', '.')
    return s if re.fullmatch(r"[A-Za-zÀ-ÿ'’ .\-]+", s) else None


def respelling_ipa(to, g2p):
    """Phonemes for a capitalised respelling, stress on the capital syllable."""
    words = []
    for word in to.split():
        parts = word.split('-')
        out = []
        for k, syl in enumerate(parts):
            low = syl.lower()
            m = OPEN_SYL.fullmatch(low)
            if low in SYL:
                ph = SYL[low]
            elif m and m.group(1) in ONSET:
                # An open respelled syllable — `nah`, `lee`, `koh` — built
                # from its parts; misaki reads `nah` as "næ".
                ph = ONSET[m.group(1)] + SYL[m.group(2)]
            else:
                ph, _ = g2p(low)
                ph = ph.replace('ˈ', '').replace('ˌ', '')
            if not ph:
                return None
            stressed = syl.isupper() and len(syl) > 1
            if not stressed:
                ph = ph.replace('ʌ', 'ə')   # an unstressed "uh" is a schwa
            out.append(('ˈ' if stressed else '') + ph)
        joined = ''.join(out)
        if 'ˈ' not in joined and len(parts) == 1:
            joined = 'ˈ' + joined if len(joined) > 3 else joined
        words.append(joined)
    return ' '.join(words)


def decide(rule, g2p):
    to = rule['to']
    if to is None:
        return 'keep', 'function rule'
    if re.fullmatch(r'([A-Z0-9] ?)+', to.strip()) or re.fullmatch(r'[A-Z] [a-z]+', to):
        return 'keep', 'initialism'
    # Letters said one at a time on purpose — "H five N one": every capital
    # run is a single letter, so none can be misread as an initialism.
    if not re.search(r'[A-Z]{2,}', to) and re.search(r'(^| )[A-Z]( |$)', to):
        return 'keep', 'letters on purpose'
    plain = plain_of(rule['source'])
    capped = bool(re.search(r'[A-Z]{2,}', to))
    if plain:
        key = plain.replace('’', "'")
        override = OVERRIDES.get(key) or OVERRIDES.get(key.lower()) or OVERRIDES.get(key.capitalize())
        if override:
            return 'ipa', override
        if capped:
            raw, ratings = g2p(plain)
            if ratings and all(r is not None and r >= 3 for r in ratings):
                return 'drop', 'dictionary: ' + raw
            ipa = respelling_ipa(to, g2p)
            if ipa:
                return 'ipa', ipa
            return 'drop', 'unbuildable respelling; raw ' + raw
    if capped:
        # A pattern with a capitalised respelling and no single word:
        # lower-case the respelling so no chunk is read as letters.
        return 'lower', to.lower()
    ph, _ = g2p(to)
    if SPELLED.search(ph):
        return 'lower', to.lower()
    return 'keep', 'clean: ' + ph


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--report', action='store_true')
    ap.add_argument('--say', nargs='*')
    args = ap.parse_args()
    g2p = make_g2p()
    if args.say:
        for w in args.say:
            print('%-16s %s' % (w, g2p(w)))
        return 0
    rules = load_pronounce()
    actions = {}
    counts = {}
    for r in rules:
        act, why = decide(r, g2p)
        counts[act] = counts.get(act, 0) + 1
        key = r['source'] + '/' + r['flags']
        if act == 'ipa':
            actions[key] = {'ipa': why}
        elif act == 'drop':
            actions[key] = 'drop'
        elif act == 'lower':
            actions[key] = {'text': why}
        if args.report:
            print('%-6s %-28s %-24s %s' % (act, r['source'][:28], (r['to'] or '')[:24], why[:60]))
    have = {plain_of(r['source']) for r in rules}
    extras = {w: ipa for w, ipa in {**EXTRAS, **OVERRIDES}.items() if w not in have}
    with open(OUT_JS, 'w', encoding='utf-8') as fh:
        fh.write('// GENERATED by tools/pronounce_kokoro.py — do not edit by hand.\n')
        fh.write('// Kokoro-only pronunciation decisions for js/tts.js PRONOUNCE, keyed by\n')
        fh.write('// each rule\'s regex, plus extra names as misaki phoneme markup.\n')
        fh.write('window.GNN_PRONOUNCE_KOKORO = ')
        json.dump({'actions': actions, 'extras': extras}, fh, ensure_ascii=False, indent=1)
        fh.write(';\n')
    print('rules:', len(rules), counts, '| extras:', len(extras), '->', os.path.relpath(OUT_JS, ROOT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
