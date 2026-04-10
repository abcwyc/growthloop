import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
await page.goto('https://www.xiaohongshu.com', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));

const qrInfo = await page.evaluate(() => {
  const imgs = document.querySelectorAll('img[src*="qr"]');
  return Array.from(imgs).map((img, i) => ({
    idx: i,
    src: img.src?.slice(0, 120),
    width: img.width,
    height: img.height,
    parentClass: img.parentElement?.className?.toString?.().slice(0, 100),
    grandParentClass: img.parentElement?.parentElement?.className?.toString?.().slice(0, 100),
    inLoginContainer: !!img.closest('.login-container'),
    inLoginModal: !!img.closest('.login-modal'),
  }));
});
console.log(JSON.stringify(qrInfo, null, 2));

const container = await page.$('.login-container');
if (container) {
  await container.screenshot({ path: '/tmp/xhs-login-container.png' });
  console.log('login-container screenshot saved');
}

const qrEl = await page.$('.login-modal img[src*="qr"]');
if (qrEl) {
  await qrEl.screenshot({ path: '/tmp/xhs-qrcode.png' });
  console.log('QR code element screenshot saved');
}

await browser.close();
console.log('Done');
