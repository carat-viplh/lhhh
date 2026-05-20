/**
 * 服务端默认配置
 */
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SCREENSHOTS_DIR = path.join(ROOT_DIR, 'screenshots');
const COOKIES_DIR = path.join(ROOT_DIR, 'cookies');

/** 页面加载后额外等待时间（毫秒），可由前端覆盖 */
const DEFAULT_WAIT_MS = 3000;

/** 导航超时（毫秒） */
const NAVIGATION_TIMEOUT_MS = 60000;

/** 搜索框候选选择器（按优先级尝试） */
const SEARCH_INPUT_SELECTORS = [
  'input[type="search"]',
  'input[name="keyword"]',
  'input[name="searchWord"]',
  'input[name="q"]',
  'input[name="query"]',
  'input[name="key"]',
  'input[id="keyword"]',
  'input[id="searchWord"]',
  'input[id="search"]',
  'input[id="q"]',
  'input[placeholder*="搜索"]',
  'input[placeholder*="查询"]',
  'input[placeholder*="企业"]',
  'input[placeholder*="关键字"]',
  'input[placeholder*="关键词"]',
  'input.search-input',
  'input.search',
  '.search-input input',
  '#search-input',
  'form input[type="text"]',
];

/** 搜索按钮候选选择器 */
const SEARCH_BUTTON_SELECTORS = [
  'button[type="submit"]',
  'input[type="submit"]',
  'button.search-btn',
  'a.search-btn',
  '.search-btn',
  '#searchBtn',
  '#btnSearch',
  'button:has-text("搜索")',
  '[onclick*="search"]',
];

module.exports = {
  ROOT_DIR,
  SCREENSHOTS_DIR,
  COOKIES_DIR,
  DEFAULT_WAIT_MS,
  NAVIGATION_TIMEOUT_MS,
  SEARCH_INPUT_SELECTORS,
  SEARCH_BUTTON_SELECTORS,
};
