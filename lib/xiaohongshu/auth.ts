import type { Page } from 'puppeteer-core';
import { getBrowser, saveCookies, loadCookies, hasSavedCookies, readCookieFile } from './browser';

const XHS_URL = 'https://www.xiaohongshu.com';
const LOGIN_TIMEOUT = 180_000; // 3 minutes
const POLL_INTERVAL = 2_000;

let loginPage: Page | null = null;
let loginStatus: 'idle' | 'waiting' | 'success' | 'expired' = 'idle';

export async function startLogin(): Promise<{ qrCode: string }> {
  const browser = await getBrowser();

  if (loginPage && !loginPage.isClosed()) {
    await loginPage.close();
  }

  loginPage = await browser.newPage();
  await loginPage.setViewport({ width: 1280, height: 800 });
  await loginPage.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  );

  await loginPage.goto(XHS_URL, { waitUntil: 'networkidle2', timeout: 30_000 });
  await delay(4000);

  // Debug: check what elements exist on the page
  const pageInfo = await loginPage.evaluate(() => {
    const modal = document.querySelector('.login-modal');
    const container = document.querySelector('.login-container');
    const qrImgs = document.querySelectorAll('img[src*="qr"]');
    const qrcode = document.querySelector('.qrcode');
    return {
      hasModal: !!modal,
      hasContainer: !!container,
      qrImgCount: qrImgs.length,
      hasQrcode: !!qrcode,
      url: location.href,
    };
  });
  console.log('[XHS] Page state:', JSON.stringify(pageInfo));

  // Strategy 1: find QR code in the auto-opened login modal
  const qrSelectors = [
    '.login-modal img[src*="qr"]',
    '.login-container img[src*="qr"]',
    '.qrcode img',
    '.code-area img',
    'img[src*="qr"]',
  ];

  let qrElement = null;
  for (const sel of qrSelectors) {
    try {
      qrElement = await loginPage.waitForSelector(sel, { timeout: 3_000 });
      if (qrElement) {
        console.log(`[XHS] Found QR code with selector: ${sel}`);
        break;
      }
    } catch { /* try next */ }
  }

  // Strategy 2: if modal didn't auto-open, try clicking login button
  if (!qrElement) {
    console.log('[XHS] QR not found directly, trying login button...');
    const loginBtnSelectors = [
      '.side-bar-component.login-btn',
      '#login-btn',
      '.login-btn',
    ];
    for (const btnSel of loginBtnSelectors) {
      try {
        const btn = await loginPage.$(btnSel);
        if (btn) {
          console.log(`[XHS] Clicking: ${btnSel}`);
          await btn.click();
          await delay(3000);
          break;
        }
      } catch { /* try next */ }
    }
    for (const sel of qrSelectors) {
      try {
        qrElement = await loginPage.waitForSelector(sel, { timeout: 3_000 });
        if (qrElement) {
          console.log(`[XHS] Found QR after click: ${sel}`);
          break;
        }
      } catch { /* try next */ }
    }
  }

  // Strategy 3: fallback — screenshot the login container or entire modal
  if (!qrElement) {
    console.log('[XHS] QR element not found, trying container screenshot...');
    const fallbackSelectors = ['.login-container', '.login-modal', '.reds-modal-open'];
    for (const sel of fallbackSelectors) {
      const container = await loginPage.$(sel);
      if (container) {
        console.log(`[XHS] Using fallback container: ${sel}`);
        const screenshot = await container.screenshot({ encoding: 'base64' });
        loginStatus = 'waiting';
        scheduleExpiry();
        return { qrCode: `data:image/png;base64,${screenshot}` };
      }
    }
    // Last resort: full page screenshot
    console.log('[XHS] Using full page screenshot as last resort');
    const screenshot = await loginPage.screenshot({ encoding: 'base64', clip: { x: 300, y: 100, width: 680, height: 600 } });
    loginStatus = 'waiting';
    scheduleExpiry();
    return { qrCode: `data:image/png;base64,${screenshot}` };
  }

  const screenshot = await qrElement.screenshot({ encoding: 'base64' });
  loginStatus = 'waiting';
  scheduleExpiry();
  return { qrCode: `data:image/png;base64,${screenshot}` };
}

function scheduleExpiry() {
  setTimeout(() => {
    if (loginStatus === 'waiting') {
      loginStatus = 'expired';
      if (loginPage && !loginPage.isClosed()) {
        loginPage.close().catch(() => {});
        loginPage = null;
      }
    }
  }, LOGIN_TIMEOUT);
}

export async function checkLoginStatus(): Promise<{ status: string; username?: string }> {
  if (loginStatus === 'expired') {
    return { status: 'expired' };
  }
  if (loginStatus === 'success') {
    return { status: 'success' };
  }
  if (loginStatus === 'idle' || !loginPage || loginPage.isClosed()) {
    return { status: 'idle' };
  }

  try {
    const loggedIn = await loginPage.evaluate(() => {
      const hasCookie = document.cookie.includes('web_session') || document.cookie.includes('galaxy_creator_session_id');
      const modalGone = !document.querySelector('.login-modal.reds-modal-open');
      const hasUser = !!document.querySelector('.user-avatar, .reds-avatar, [class*="sidebar"] [class*="avatar"]');
      return hasCookie || (modalGone && hasUser);
    });

    if (loggedIn) {
      await saveCookies(loginPage);
      loginStatus = 'success';

      const username = await loginPage.evaluate(() => {
        const el = document.querySelector('[class*="user-name"], .nickname, [class*="nickname"]');
        return el?.textContent?.trim() || '';
      }).catch(() => '');

      await loginPage.close();
      loginPage = null;
      return { status: 'success', username };
    }

    return { status: 'waiting' };
  } catch {
    return { status: 'waiting' };
  }
}

export async function checkSession(): Promise<{ loggedIn: boolean; username?: string }> {
  if (!hasSavedCookies()) {
    return { loggedIn: false };
  }

  // Fast path: check if cookie file contains a session cookie
  // web_session is HttpOnly so document.cookie can't see it
  try {
    const cookieData = readCookieFile();
    const hasSession = cookieData.some(
      (c: { name: string }) =>
        c.name === 'web_session' ||
        c.name === 'galaxy_creator_session_id' ||
        c.name === 'a1',
    );
    if (!hasSession) return { loggedIn: false };

    // Cookie file has session tokens — consider it logged in
    // A full browser validation is too slow (~6s) for a status check
    return { loggedIn: true, username: '' };
  } catch {
    return { loggedIn: false };
  }
}

export function getLoginStatus() {
  return loginStatus;
}

export function resetLoginStatus() {
  loginStatus = 'idle';
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
