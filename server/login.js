/**
 * 独立登录脚本：可视化浏览器，手动登录后保存各站 Cookie
 *
 * 用法: npm run login
 */
const readline = require('readline');
const { saveCookies, COOKIES_DIR } = require('./cookies');
const { safeGoto, delay, launchBrowser } = require('./browser');
const fs = require('fs');

const { loadDefaultSites } = require('./default-sites');
const DEFAULT_SITES = loadDefaultSites();

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function openSite(page, site) {
  console.log(`\n>>> 正在打开: ${site.name}`);
  console.log(`    ${site.url}`);
  const ok = await safeGoto(page, site.url);
  if (!ok) {
    console.warn('    ⚠ 自动打开失败，请在浏览器地址栏手动输入上述网址后登录');
  }
  try {
    await page.bringToFront();
  } catch {
    /* ignore */
  }
  await delay(1500);
}

/**
 * 等待用户操作：回车保存 / r 重新打开 / s 跳过 / q 退出
 */
async function waitForLogin(page, site) {
  while (true) {
    let currentUrl = '';
    try {
      currentUrl = page.url();
    } catch {
      currentUrl = site.url;
    }

    const ans = await ask(
      `\n当前页面: ${currentUrl}\n` +
        `  [回车] 保存当前页 Cookie\n` +
        `  [r]    重新自动打开: ${site.url}\n` +
        `  [s]    跳过本站\n` +
        `  [q]    结束登录\n` +
        `请选择 > `
    );

    const cmd = ans.trim().toLowerCase();
    if (cmd === 'q') return 'quit';
    if (cmd === 's') {
      console.log('  已跳过');
      return 'skip';
    }
    if (cmd === 'r') {
      await openSite(page, site);
      continue;
    }

    // 回车或其它：按当前浏览器地址保存 Cookie（支持你在地址栏手动跳转后保存）
    try {
      const urlToSave = page.url();
      await saveCookies(page, urlToSave);
      console.log(`  ✓ 已保存: ${urlToSave}`);
    } catch (err) {
      console.warn(`  保存失败: ${err.message}`);
    }
    return 'done';
  }
}

async function main() {
  if (!fs.existsSync(COOKIES_DIR)) {
    fs.mkdirSync(COOKIES_DIR, { recursive: true });
  }

  console.log('\n========================================');
  console.log('  企业信用查询 - 手动登录保存 Cookie');
  console.log('========================================\n');
  console.log('说明：');
  console.log('  1. 脚本会自动打开每个核查网站，请在【浏览器窗口】里登录');
  console.log('  2. 若自动打开失败，可在地址栏手动输入终端里显示的网址');
  console.log('  3. 登录完成后回到【本终端】按回车保存，不要只在浏览器里操作');
  console.log(`  4. 共 ${DEFAULT_SITES.length} 个网站，输入 q 可提前结束\n`);

  const browser = await launchBrowser({
    headless: false,
    forLogin: true,
    args: ['--window-size=1400,900'],
  });

  // 登录模式不强制改 viewport，避免影响地址栏交互
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  for (const site of DEFAULT_SITES) {
    await openSite(page, site);
    const result = await waitForLogin(page, site);
    if (result === 'quit') {
      console.log('\n已提前结束登录。');
      break;
    }
  }

  console.log('\n完成！Cookie 已保存到 cookies/ 目录。');
  console.log('后续批量查询将自动加载。\n');

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
