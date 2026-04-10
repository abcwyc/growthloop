import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer-core';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

const COOKIE_PATH = path.join(process.cwd(), 'data', 'xhs-cookies.json');
const DATA_DIR = path.join(process.cwd(), 'data');

const CHROMIUM_PATHS = [
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
];

function findChromium(): string {
  for (const p of CHROMIUM_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return CHROMIUM_PATHS[0];
}

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  browserInstance = await (puppeteer as unknown as { launch: (opts: Record<string, unknown>) => Promise<Browser> }).launch({
    headless: true,
    executablePath: findChromium(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,800',
    ],
  });

  browserInstance.on('disconnected', () => {
    browserInstance = null;
  });

  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance && browserInstance.connected) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export async function saveCookies(page: Page): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
}

export async function loadCookies(page: Page): Promise<boolean> {
  if (!fs.existsSync(COOKIE_PATH)) return false;
  try {
    const raw = fs.readFileSync(COOKIE_PATH, 'utf-8');
    const cookies = JSON.parse(raw);
    if (!Array.isArray(cookies) || cookies.length === 0) return false;
    await page.setCookie(...cookies);
    return true;
  } catch {
    return false;
  }
}

export function hasSavedCookies(): boolean {
  if (!fs.existsSync(COOKIE_PATH)) return false;
  try {
    const raw = fs.readFileSync(COOKIE_PATH, 'utf-8');
    const cookies = JSON.parse(raw);
    return Array.isArray(cookies) && cookies.length > 0;
  } catch {
    return false;
  }
}

export function readCookieFile(): Array<{ name: string; value: string; [k: string]: unknown }> {
  if (!fs.existsSync(COOKIE_PATH)) return [];
  try {
    const raw = fs.readFileSync(COOKIE_PATH, 'utf-8');
    const cookies = JSON.parse(raw);
    return Array.isArray(cookies) ? cookies : [];
  } catch {
    return [];
  }
}

export function clearCookies(): void {
  if (fs.existsSync(COOKIE_PATH)) {
    fs.unlinkSync(COOKIE_PATH);
  }
}
