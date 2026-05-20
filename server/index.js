/**
 * Express 服务：静态前端 + 批量截图 API
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { runBatchTask, SCREENSHOTS_DIR } = require('./scraper');
const { ensureCookiesDir, COOKIES_DIR } = require('./cookies');

const app = express();
const PORT = process.env.PORT || 3888;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.use(express.json({ limit: '2mb' }));
app.use(express.static(PUBLIC_DIR));

// 确保目录存在
[SCREENSHOTS_DIR, COOKIES_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
ensureCookiesDir();

/** 任务状态（简单内存存储，单任务） */
let taskState = {
  running: false,
  progress: null,
  lastResult: null,
};

/**
 * POST /api/execute
 * 接收前端配置，执行批量截图
 */
app.post('/api/execute', async (req, res) => {
  if (taskState.running) {
    return res.status(409).json({
      ok: false,
      message: '已有任务正在执行，请稍后再试',
    });
  }

  const {
    companies = [],
    sites = [],
    triggerText = '',
    headless = true,
    waitMs = 3000,
  } = req.body;

  if (!companies.length) {
    return res.status(400).json({ ok: false, message: '请至少添加一个企业名称' });
  }
  if (!sites.length) {
    return res.status(400).json({ ok: false, message: '请至少添加一个查询网站' });
  }

  taskState.running = true;
  taskState.progress = { current: 0, total: companies.length * sites.length };
  taskState.lastResult = null;

  // 立即响应，后台执行
  res.json({
    ok: true,
    message: '任务已启动',
    total: companies.length * sites.length,
  });

  try {
    const output = await runBatchTask(
      { companies, sites, triggerText, headless, waitMs },
      (progress) => {
        taskState.progress = progress;
      }
    );
    taskState.lastResult = output;
  } catch (err) {
    taskState.lastResult = {
      error: err.message,
      results: [],
      summary: { total: 0, success: 0, skipped: 0, failed: 0 },
    };
  } finally {
    taskState.running = false;
  }
});

/** GET /api/status - 查询任务进度与结果 */
app.get('/api/status', (req, res) => {
  res.json({
    running: taskState.running,
    progress: taskState.progress,
    lastResult: taskState.lastResult,
  });
});

/** GET /api/screenshots - 列出已保存截图 */
app.get('/api/screenshots', (req, res) => {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    return res.json({ files: [] });
  }
  const files = fs
    .readdirSync(SCREENSHOTS_DIR)
    .filter((f) => f.endsWith('.png'))
    .map((f) => ({
      name: f,
      url: `/screenshots/${encodeURIComponent(f)}`,
    }))
    .sort((a, b) => b.name.localeCompare(a.name));
  res.json({ files });
});

// 截图静态访问
app.use('/screenshots', express.static(SCREENSHOTS_DIR));

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('  企业信用批量查询截图工具');
  console.log('========================================');
  console.log(`  访问地址: http://localhost:${PORT}`);
  console.log(`  截图目录: ${SCREENSHOTS_DIR}`);
  console.log(`  Cookie 目录: ${COOKIES_DIR}`);
  console.log('  首次登录: npm run login');
  console.log('========================================\n');
});
