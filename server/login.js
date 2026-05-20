/**
 * 独立登录脚本：可视化浏览器，手动登录后保存各站 Cookie
 *
 * 用法: npm run login
 */
const readline = require('readline');
const puppeteer = require('puppeteer');
const { saveCookies, COOKIES_DIR } = require('./cookies');
const { safeGoto, delay, newPage } = require('./browser');
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

async function main() {
  if (!fs.existsSync(COOKIES_DIR)) {
    fs.mkdirSync(COOKIES_DIR, { recursive: true });
  }

  console.log('\n========================================');
  console.log('  企业信用查询 - 手动登录保存 Cookie');
  console.log('========================================\n');
  console.log('将依次打开以下网站，请在浏览器中完成登录。');
  console.log('每个站点登录后回到终端按回车保存 Cookie。\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--window-size=1400,900', '--lang=zh-CN,zh'],
    ignoreHTTPSErrors: true,
  });

  const page = await newPage(browser);

  for (const site of DEFAULT_SITES) {
    console.log(`\n>>> 正在打开: ${site.name}`);
    console.log(`    ${site.url}\n`);

    await safeGoto(page, site.url);
    await delay(2000);

    await ask(`已在「${site.name}」完成登录？(按回车保存 Cookie，输入 s 跳过) `).then(
      async (ans) => {
        if (ans.trim().toLowerCase() !== 's') {
          await saveCookies(page, site.url);
        } else {
          console.log('  已跳过');
        }
      }
    );
  }

  console.log('\n全部完成！Cookie 已保存到 cookies/ 目录。');
  console.log('后续批量查询将自动加载，无需重复登录。\n');

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
