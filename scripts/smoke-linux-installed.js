const assert = require('node:assert/strict');

const port = Number(process.env.PANTORAYA_DEBUG_PORT || 9223);

async function main() {
  const response = await fetch(`http://127.0.0.1:${port}/json`);
  const pages = await response.json();
  const page = pages.find((candidate) => candidate.type === 'page' && candidate.title === 'Pantoraya');
  assert.ok(page, 'Pantoraya window is open');
  assert.match(page.url, /\/\.local\/opt\/Pantoraya\/resources\/app\.asar\//);

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  function evaluate(expression) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => reject(new Error('DevTools evaluation timed out')), 30000);
      const onMessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        socket.removeEventListener('message', onMessage);
        clearTimeout(timer);
        if (message.error || message.result?.exceptionDetails) {
          reject(new Error(JSON.stringify(message.error || message.result.exceptionDetails)));
          return;
        }
        resolve(message.result.result.value);
      };
      socket.addEventListener('message', onMessage);
      socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    });
  }

  try {
    if (process.argv.includes('--reset-only')) {
      await evaluate('resetFile(); true');
      console.log('Pantoraya is ready for manual testing.');
      return;
    }
    const info = await evaluate('({ platform: window.pantoraya.platform, title: document.title, tabs: document.querySelectorAll("[data-converter]").length })');
    assert.equal(info.platform, 'linux');
    assert.ok(info.tabs >= 3);

    const result = await evaluate(`(async () => {
      resetFile();
      const initialLayout = {
        viewport: window.innerHeight,
        headerTop: document.querySelector('.masthead').getBoundingClientRect().top,
        buttonBottom: document.querySelector('.actions').getBoundingClientRect().bottom
      };
      const video = await window.pantoraya.inspectFile('/tmp/pantoraya-smoke.mkv');
      const image = await window.pantoraya.inspectFile('/tmp/pantoraya-smoke.png');
      setFile(image);
      const imageTabSelected = document.querySelector('[data-converter="jpg"]').getAttribute('aria-selected') === 'true';
      setFile(video);
      const videoTabSelected = document.querySelector('[data-converter="mp4"]').getAttribute('aria-selected') === 'true';
      const subtitleLayout = {
        visible: !document.querySelector('#subtitlePicker').classList.contains('hidden'),
        buttonBottom: document.querySelector('.actions').getBoundingClientRect().bottom
      };
      const mp4 = await window.pantoraya.convertMedia('/tmp/pantoraya-smoke.mkv', 'mp4', 'quality', '/tmp/pantoraya-smoke.srt');
      const mp3 = await window.pantoraya.convertMedia('/tmp/pantoraya-smoke.mkv', 'mp3', 'light');
      const jpg = await window.pantoraya.convertMedia('/tmp/pantoraya-smoke.png', 'jpg', 'light');
      return { initialLayout, subtitleLayout, video: { mediaType: video.mediaType, duration: video.duration, thumbnail: !!video.thumbnail }, image: { mediaType: image.mediaType, width: image.width, thumbnail: !!image.thumbnail }, imageTabSelected, videoTabSelected, mp4, mp3, jpg };
    })()`);
    assert.equal(result.video.mediaType, 'video');
    assert.equal(result.image.mediaType, 'image');
    assert.equal(result.video.thumbnail, true);
    assert.equal(result.image.thumbnail, true);
    assert.equal(result.imageTabSelected, true);
    assert.equal(result.videoTabSelected, true);
    assert.ok(result.initialLayout.headerTop <= 16);
    assert.ok(result.initialLayout.viewport - result.initialLayout.buttonBottom <= 14);
    assert.equal(result.subtitleLayout.visible, true);
    assert.ok(result.subtitleLayout.buttonBottom <= result.initialLayout.viewport - 8);
    for (const format of ['mp4', 'mp3', 'jpg']) {
      assert.equal(result[format].success, true);
      assert.ok(result[format].outputBytes > 0);
    }
    console.log(JSON.stringify({ window: info, conversions: result }, null, 2));
  } finally {
    socket.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
