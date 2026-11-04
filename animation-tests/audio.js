// node audio.js <page.html> <out.wav> — dumps the page's synthesized score (window.__renderAudio) to WAV
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.error('[err]', e.message));
  await p.goto('file://' + path.resolve(process.argv[2]) + '?w=270&h=480'); await p.waitForFunction(() => window.__ready === true);
  fs.writeFileSync(process.argv[3], Buffer.from(await p.evaluate(() => window.__renderAudio()), 'base64')); await b.close(); console.log('wrote', process.argv[3]); })();
