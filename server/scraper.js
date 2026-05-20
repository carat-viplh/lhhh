/**
 * 核心抓取逻辑：搜索、条件截图、批量任务
 */
const fs = require('fs');
const path = require('path');
const {
  SCREENSHOTS_DIR,
  DEFAULT_WAIT_MS,
  SEARCH_INPUT_SELECTORS,
  SEARCH_BUTTON_SELECTORS,
} = require('./config');
const { loadCookies, saveCookies } = require('./cookies');
const {
  getBrowser,
  closeBrowser,
  newPage,
  safeGoto,
  delay,
  pageContainsText,
  sanitizeFilename,
} = require('./browser');

function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

/**
 * 尝试在页面中找到搜索框并输入企业名
 */
async function trySearch(page, companyName) {
  for (const selector of SEARCH_INPUT_SELECTORS) {
    try {
      const input = await page.$(selector);
      if (!input) continue;

      const visible = await input.evaluate((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        );
      });
      if (!visible) continue;

      await input.click({ clickCount: 3 });
      await input.type(companyName, { delay: 50 });

      // 尝试点击搜索按钮
      let submitted = false;
      for (const btnSel of SEARCH_BUTTON_SELECTORS) {
        if (btnSel.includes('has-text')) continue;
        try {
          const btn = await page.$(btnSel);
          if (btn) {
            await btn.click();
            submitted = true;
            break;
          }
        } catch {
          /* continue */
        }
      }

      if (!submitted) {
        await page.keyboard.press('Enter');
      }

      await delay(1500);
      try {
        await page.waitForNavigation({
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
      } catch {
        /* 可能 SPA 无整页导航 */
      }
      return true;
    } catch {
      /* 尝试下一个选择器 */
    }
  }
  return false;
}

/**
 * 全屏截图并保存
 */
async function takeFullScreenshot(page, companyName, siteName) {
  ensureScreenshotsDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${sanitizeFilename(companyName)}_${sanitizeFilename(siteName)}_${ts}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  await page.screenshot({
    path: filepath,
    fullPage: true,
    type: 'png',
  });

  return { filename, filepath };
}

/**
 * 处理单个：企业 × 网站
 */
async function processOne(page, options) {
  const {
    companyName,
    siteName,
    siteUrl,
    triggerText,
    waitMs,
    saveCookieAfter,
  } = options;

  const result = {
    companyName,
    siteName,
    siteUrl,
    success: false,
    skipped: false,
    message: '',
    filename: null,
  };

  const hasTrigger = triggerText && String(triggerText).trim();

  const ok = await safeGoto(page, siteUrl);
  if (!ok) {
    result.message = '网站无法打开，已跳过';
    return result;
  }

  await loadCookies(page, siteUrl);
  // 刷新使 Cookie 生效
  await safeGoto(page, siteUrl);
  await delay(waitMs);

  if (!hasTrigger) {
    // 无触发条件：首页直接截图
    try {
      const shot = await takeFullScreenshot(page, companyName, siteName);
      result.success = true;
      result.filename = shot.filename;
      result.message = '首页截图成功';
    } catch (err) {
      result.message = `截图失败: ${err.message}`;
    }
  } else {
    // 有触发条件：先搜索，再检查页面文本
    const searched = await trySearch(page, companyName);
    await delay(waitMs);

    if (!searched) {
      result.skipped = true;
      result.message = '未找到搜索框，已跳过';
      return result;
    }

    const contains = await pageContainsText(page, triggerText);
    if (!contains) {
      result.skipped = true;
      result.message = `页面不包含触发文本「${triggerText}」，已跳过`;
      return result;
    }

    try {
      const shot = await takeFullScreenshot(page, companyName, siteName);
      result.success = true;
      result.filename = shot.filename;
      result.message = '条件匹配，截图成功';
    } catch (err) {
      result.message = `截图失败: ${err.message}`;
    }
  }

  if (saveCookieAfter) {
    try {
      await saveCookies(page, siteUrl);
    } catch {
      /* ignore */
    }
  }

  return result;
}

/**
 * 单个企业在所有配置网站上依次检索截图
 */
async function processCompanyOnAllSites(browser, companyName, sites, taskOpts, reportDone) {
  const companyResults = [];
  const { triggerText, waitMs } = taskOpts;

  for (const site of sites) {
    const siteName = site.name || '未知网站';
    const siteUrl = site.url;
    if (!siteUrl?.trim()) continue;

    if (reportDone.onStart) {
      reportDone.onStart(companyName, siteName);
    }

    const page = await newPage(browser);
    let itemResult;

    try {
      itemResult = await processOne(page, {
        companyName,
        siteName,
        siteUrl: siteUrl.trim(),
        triggerText,
        waitMs,
        saveCookieAfter: false,
      });
    } catch (err) {
      itemResult = {
        companyName,
        siteName,
        siteUrl,
        success: false,
        skipped: true,
        message: `异常已跳过: ${err.message}`,
        filename: null,
      };
    } finally {
      try {
        await page.close();
      } catch {
        /* ignore */
      }
    }

    companyResults.push(itemResult);
    if (reportDone.onFinish) {
      reportDone.onFinish(companyName, siteName, itemResult);
    }
  }

  return companyResults;
}

/**
 * 批量执行任务：多个企业并行，每个企业检索全部配置网站
 */
async function runBatchTask(config, onProgress) {
  const {
    companies = [],
    sites = [],
    triggerText = '',
    headless = true,
    waitMs = DEFAULT_WAIT_MS,
  } = config;

  const validCompanies = companies
    .map((c) => (typeof c === 'string' ? c : c.name))
    .map((n) => n?.trim())
    .filter(Boolean);

  const validSites = sites.filter((s) => s.url?.trim());
  const total = validCompanies.length * validSites.length;
  let completed = 0;

  const reportProgress = (companyName, siteName, status, result) => {
    if (onProgress) {
      onProgress({
        current: completed,
        total,
        companyName,
        siteName,
        status,
        parallel: validCompanies.length > 1,
        result,
      });
    }
  };

  ensureScreenshotsDir();
  const browser = await getBrowser(headless);
  const taskOpts = {
    triggerText,
    waitMs: Number(waitMs) || DEFAULT_WAIT_MS,
  };

  try {
    const companyTasks = validCompanies.map((companyName) =>
      processCompanyOnAllSites(browser, companyName, validSites, taskOpts, {
        onStart: (cn, sn) => reportProgress(cn, sn, 'running'),
        onFinish: (cn, sn, result) => {
          completed += 1;
          reportProgress(cn, sn, 'done', result);
        },
      })
    );

    const nested = await Promise.all(companyTasks);
    const results = nested.flat();

    const summary = {
      total: results.length,
      success: results.filter((r) => r.success).length,
      skipped: results.filter((r) => r.skipped).length,
      failed: results.filter((r) => !r.success && !r.skipped).length,
    };

    return { results, summary };
  } finally {
    await closeBrowser();
  }
}

module.exports = {
  runBatchTask,
  processOne,
  ensureScreenshotsDir,
  SCREENSHOTS_DIR,
};
