/**
 * Puppeteer 浏览器启动与页面工具
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { NAVIGATION_TIMEOUT_MS, ROOT_DIR } = require('./config');

let browserInstance = null;

/** 各平台系统 Chrome 常见路径 */
const SYSTEM_CHROME_PATHS = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
};

/**
 * 解析可执行的 Chrome 路径：优先 Puppeteer 缓存，否则用本机已安装的 Chrome
 */
function resolveExecutablePath() {
  try {
    const bundled = puppeteer.executablePath();
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch {
    /* 未安装 puppeteer 自带 Chrome */
  }

  const candidates = SYSTEM_CHROME_PATHS[process.platform] || [];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`[浏览器] 使用系统 Chrome: ${p}`);
      return p;
    }
  }

  return null;
}

/**
 * 统一启动配置（login / 批量截图共用）
 */
function getLaunchOptions(overrides = {}) {
  const { forLogin, ...rest } = overrides;
  const headless = rest.headless ?? false;
  const options = {
    headless: headless === true ? 'new' : headless,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1920,1080',
      '--lang=zh-CN,zh',
      ...(rest.args || []),
    ],
    ignoreHTTPSErrors: true,
    ...rest,
  };

  // 登录模式：独立配置目录 + 去掉自动化标记，地址栏可正常手动输入网址
  if (forLogin) {
    options.userDataDir = path.join(ROOT_DIR, '.chrome-login-profile');
    options.ignoreDefaultArgs = ['--enable-automation'];
  }

  const executablePath = resolveExecutablePath();
  if (executablePath) {
    options.executablePath = executablePath;
  } else {
    console.warn(
      '[浏览器] 未找到 Chrome。请执行: npm run install:chrome\n' +
        '或安装 Google Chrome 后重试。'
    );
  }

  return options;
}

/** 启动浏览器（独立脚本也可用） */
async function launchBrowser(overrides = {}) {
  return puppeteer.launch(getLaunchOptions(overrides));
}

/**
 * 启动或复用浏览器实例
 * @param {boolean} headless - true 无头，false 可视化
 */
async function getBrowser(headless = true) {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  browserInstance = await launchBrowser({ headless });

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
  launchBrowser,
  getLaunchOptions,
  resolveExecutablePath,
  closeBrowser,
  newPage,
  safeGoto,
  delay,
  pageContainsText,
  sanitizeFilename,
};
