"""Which feeds actually return items through rss2json, which is the only
path the app has. A feed that 200s direct can still come back empty here."""
import json, sys, time, urllib.parse, urllib.request

CANDIDATES = {
 'current': [
  'https://feeds.arstechnica.com/arstechnica/index',
  'https://feeds.arstechnica.com/arstechnica/science',
  'https://www.nasa.gov/rss/dyn/breaking_news.rss',
  'https://www.space.com/feeds/all',
  'https://spaceflightnow.com/feed/',
  'https://www.esa.int/rssfeed/Our_Activities/Space_News',
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
  'https://feeds.bbci.co.uk/news/technology/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://www.technologyreview.com/feed/',
  'https://news.ycombinator.com/rss',
  'https://www.wired.com/feed/rss',
  'https://techcrunch.com/feed/',
  'https://www.theverge.com/rss/index.xml',
  'https://search.cnbc.com/rs/search/combinednewsletter/rss?partnerId=wrss01&id=100003114',
  'https://www.nature.com/nature.rss',
 ],
 'sport': [
  'https://feeds.bbci.co.uk/sport/rss.xml',
  'https://www.espn.com/espn/rss/news',
  'https://www.skysports.com/rss/12040',
 ],
 'markets': [
  'https://feeds.content.dowjones.io/public/rss/mw_topstories',
  'https://www.cnbc.com/id/10001147/device/rss/rss.html',
  'https://feeds.bbci.co.uk/news/business/rss.xml',
 ],
 'diplomacy': [
  'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
  'https://feeds.bbci.co.uk/news/politics/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
 ],
 'anomaly': [
  'https://phys.org/rss-feed/',
  'https://www.livescience.com/feeds/all',
  'https://www.sciencedaily.com/rss/strange_offbeat.xml',
  'https://www.newscientist.com/feed/home/',
 ],
 'space': [
  'https://www.nasa.gov/feed/',
  'https://science.nasa.gov/feed/',
  'https://skyandtelescope.org/feed/',
 ],
}


def probe(f):
    u = 'https://api.rss2json.com/v1/api.json?rss_url=' + urllib.parse.quote(f, safe='')
    try:
        d = json.load(urllib.request.urlopen(u, timeout=35))
    except Exception as e:
        return None, str(e)[:40]
    if d.get('status') != 'ok':
        return None, str(d.get('message'))[:40]
    items = d.get('items', [])
    return items, d.get('feed', {}).get('title', '')


for cat, feeds in CANDIDATES.items():
    print('== %s ==' % cat, flush=True)
    for f in feeds:
        items, note = probe(f)
        short = f.split('//')[1][:52]
        if items is None:
            print('   %-54s FAIL  %s' % (short, note), flush=True)
        else:
            sample = items[0]['title'][:44] if items else ''
            print('   %-54s %2d  %-28s | %s' % (short, len(items), note[:28], sample), flush=True)
        time.sleep(2.5)
