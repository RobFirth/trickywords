// Makes the PNG icons and the favicon from img/icon.svg, in headless Chrome. Run: npm run icons
// Writes img/favicon.svg, img/favicon-32.png, img/apple-touch-icon.png, img/icon-192.png, img/icon-512.png
// and img/icon-maskable-512.png. Icons sit on the page background; the maskable one keeps inside the safe zone.
const puppeteer = require('puppeteer-core'), fs = require('fs'), path = require('path');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const IMG = path.join(__dirname, '..', 'img');
const svg = fs.readFileSync(path.join(IMG, 'icon.svg'), 'utf8');
const BG = '#FFF8E7';

// [file, size, background?, icon share of the square, corner radius share]
const PNGS = [
  ['favicon-32.png', 32, false, 1, 0],
  ['apple-touch-icon.png', 180, true, 0.8, 0],
  ['icon-192.png', 192, true, 0.82, 0.18],
  ['icon-512.png', 512, true, 0.82, 0.18],
  ['icon-maskable-512.png', 512, true, 0.62, 0]
];

(async () => {
  fs.writeFileSync(path.join(IMG, 'favicon.svg'), svg);
  const b = await puppeteer.launch({ headless: 'new', executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await b.newPage();
  for (const [file, size, bg, share, radius] of PNGS) {
    await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    const icon = Math.round(size * share);
    await p.setContent(`<!DOCTYPE html><html><body style="margin:0;background:transparent">
      <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;${bg ? `background:${BG};` : ''}border-radius:${radius * size}px">
      <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" style="width:${icon}px;height:${icon}px"></div></body></html>`);
    await p.evaluate(() => document.querySelector('img').decode());
    await p.screenshot({ path: path.join(IMG, file), omitBackground: !bg || radius > 0 });
    console.log('wrote', file);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
