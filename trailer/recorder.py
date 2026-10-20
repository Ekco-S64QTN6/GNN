"""In-page recorder: the station's canvas plus its master audio bus.

Records exactly what airs — picture from the canvas (captureStream), sound
from GNNAudio's master bus through a MediaStreamDestination — with
MediaRecorder, then pulls the WebM out over CDP in chunks.
"""
import base64
import time

START_JS = r"""
(function(){
  const canvas = document.getElementById('gnnCanvas');
  const vs = canvas.captureStream(30);
  const tracks = [...vs.getVideoTracks()];
  try {
    const ac = GNNAudio.getContext();
    if (ac) {
      const dest = ac.createMediaStreamDestination();
      GNNAudio.getMasterBus().connect(dest);
      window.__recDest = dest;
      tracks.push(...dest.stream.getAudioTracks());
    }
  } catch (e) { console.warn('rec audio', e); }
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus' : 'video/webm';
  const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 24e6 });
  window.__recChunks = [];
  window.__recBlob = null;
  rec.ondataavailable = (e) => { if (e.data && e.data.size) window.__recChunks.push(e.data); };
  rec.onstop = () => { window.__recBlob = new Blob(window.__recChunks, { type: 'video/webm' }); };
  rec.start(500);
  window.__rec = rec;
  return mime + ' audio=' + tracks.filter(t => t.kind === 'audio').length;
})()
"""

STOP_JS = r"""
(function(){
  window.__rec.stop();
  try { GNNAudio.getMasterBus().disconnect(window.__recDest); } catch (e) {}
  return true;
})()
"""

CHUNK_JS = r"""
(async function(start, len){
  const b = window.__recBlob.slice(start, start + len);
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
})(%d, %d)
"""


def start(cdp):
    return cdp.eval(START_JS)


def stop(cdp, path):
    cdp.eval(STOP_JS)
    for _ in range(80):
        time.sleep(0.25)
        if cdp.eval('!!window.__recBlob'):
            break
    size = cdp.eval('window.__recBlob.size')
    out = bytearray()
    step = 4 * 1024 * 1024
    for off in range(0, size, step):
        res = cdp.send('Runtime.evaluate', expression=CHUNK_JS % (off, step),
                       awaitPromise=True, returnByValue=True)
        out += base64.b64decode(res['result']['value'])
    with open(path, 'wb') as fh:
        fh.write(out)
    return size
