/**
 * Puppeteer 浏览器启动与页面工具
 */
const puppeteer = require('puppeteer');
const { NAVIGATION_TIMEOUT_MS } = require('./config');

let browserInstance = null;

/**
 * 启动或复用浏览器实例
 * @param {boolean} headless - true 无头，false 可视化
 */
async function getBrowser(headless = true) {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  browserInstance = await puppeteer.launch({
    headless: headless ? 'new' : false,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
      '--lang=zh-CN,zh',
    ],
    ignoreHTTPSErrors: true,
  });

  return browserInstance;
}

async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch {
      /* ignore */
    }
    browserInstance = null;
  }
}

/**
 * 新建页面并设置通用选项
 */
async function newPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
  page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  return page;
}

/**
 * 安全导航，失败不抛错
 */
async function safeGoto(page, url) {
  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    return true;
  } catch (err) {
    console.warn(`[导航失败] ${url}:`, err.message);
    return false;
  }
}

/**
 * 等待指定毫秒
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 检查页面 HTML 是否包含指定文本（不区分大小写）
 */
async function pageContainsText(page, text) {
  if (!text || !String(text).trim()) return true;
  const content = await page.evaluate(() => document.body?.innerText || '');
  return content.toLowerCase().includes(String(text).trim().toLowerCase());
}

/**
 * 清理文件名非法字符
 */
function sanitizeFilename(name) {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

module.exports = {
  getBrowser,
  closeBrowser,
  newPage,
  safeGoto,
  delay,
  pageContainsText,
  sanitizeFilename,
};
