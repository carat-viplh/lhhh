/**
 * Cookie 持久化：按域名保存/加载，支持免登录
 */
const fs = require('fs');
const path = require('path');
const { COOKIES_DIR } = require('./config');

function ensureCookiesDir() {
  if (!fs.existsSync(COOKIES_DIR)) {
    fs.mkdirSync(COOKIES_DIR, { recursive: true });
  }
}

/** 将 URL 转为安全的 cookie 文件名 */
function hostnameFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/\./g, '_');
    return host || 'default';
  } catch {
    return 'default';
  }
}

function cookieFilePath(url) {
  return path.join(COOKIES_DIR, `${hostnameFromUrl(url)}.json`);
}

/**
 * 从文件加载 Cookie 到页面上下文
 */
async function loadCookies(page, url) {
  ensureCookiesDir();
  const file = cookieFilePath(url);
  if (!fs.existsSync(file)) return false;

  try {
    const cookies = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(cookies) && cookies.length > 0) {
      await page.setCookie(...cookies);
      return true;
    }
  } catch (err) {
    console.warn(`[Cookie] 加载失败 ${file}:`, err.message);
  }
  return false;
}

/**
 * 将当前页面 Cookie 保存到文件
 */
async function saveCookies(page, url) {
  ensureCookiesDir();
  const cookies = await page.cookies();
  const file = cookieFilePath(url);
  fs.writeFileSync(file, JSON.stringify(cookies, null, 2), 'utf8');
  console.log(`[Cookie] 已保存: ${file}`);
}

module.exports = {
  ensureCookiesDir,
  hostnameFromUrl,
  cookieFilePath,
  loadCookies,
  saveCookies,
  COOKIES_DIR,
};
