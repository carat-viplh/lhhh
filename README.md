# 企业信用批量查询截图工具

批量在指定政府官网检索企业名称，支持**条件截图**（页面包含指定文本才截图），自动保存 PNG，用于生成企业信用报告。

## 功能概览

| 模块 | 能力 |
|------|------|
| 前端 | 企业/网站列表管理、localStorage 持久化、触发条件、无头/等待时间配置 |
| 后端 | Puppeteer 自动化、Cookie 免登录、智能搜索框识别、全屏截图、异常跳过 |

## 环境要求

- Node.js **18+**
- macOS / Windows / Linux
- 首次使用各站如需登录，请运行 `npm run login`

## 快速开始

```bash
# 1. 进入项目目录
cd search_screenshot

# 2. 安装依赖
npm install

# 3.（推荐）首次手动登录并保存 Cookie
npm run login

# 4. 启动服务
npm start
```

浏览器访问：**http://localhost:3888**

## 使用流程

### 1. 配置企业与网站

- 在页面中添加企业名称（**每行一个可批量添加**，支持增删改，自动保存到浏览器 localStorage）
- 默认已预设 **38 个核查网站**（来自《副本核查网站》文档），可自行修改或新增
- **截图触发条件**（可选）：
  - **留空**：打开网站首页后直接全屏截图
  - **填写关键词**：自动搜索企业名后，仅当页面正文包含该文本时才截图，否则跳过

### 2. 运行设置

| 选项 | 说明 |
|------|------|
| 页面加载等待 | 导航/搜索后额外等待毫秒数，慢站可调大（如 5000–8000） |
| 无头模式 | 勾选=后台运行；取消=弹出浏览器，便于调试或处理验证码 |

### 3. 执行批量任务

点击 **「开始批量查询截图」**，前端将配置提交后端：**多个企业并行执行**，每个企业都会在**全部已配置网站**中依次检索并截图。

### 4. 查看结果

- 页面底部可预览已保存截图
- 文件目录：`screenshots/`
- 命名规则：`企业名_网站名_时间戳.png`（非法字符会替换为 `_`）

## 登录与 Cookie

部分网站（如国家企业信用信息公示系统）需要登录或验证码：

```bash
npm run login
```

脚本会**依次打开**各核查网站。请在浏览器窗口完成登录后，回到**终端**按回车保存 Cookie（仅改地址栏不按回车不会保存）。

操作提示：`回车` 保存 | `r` 重新打开当前站 | `s` 跳过 | `q` 结束

若地址栏输入无效：先按 `r` 让脚本重新打开，或使用已更新的登录模式（独立 Chrome 配置目录，支持手动输入网址）。

如需为**自定义网站**保存 Cookie，可先 `npm run login` 流程中访问该站，或登录后在该域名下手动触发一次任务（可在 `server/scraper.js` 中将 `saveCookieAfter` 设为 `true` 用于调试）。

## 截图逻辑说明

```
对每个 (企业, 网站):
  ├─ 打开网站（加载已保存 Cookie）
  ├─ 未配置触发关键词？
  │    └─ 是 → 等待 → 全屏截图 → 完成
  └─ 配置了触发关键词？
       ├─ 尝试定位搜索框并搜索企业名
       ├─ 未找到搜索框 → 跳过，继续下一项
       ├─ 页面不包含触发文本 → 跳过
       └─ 包含 → 全屏截图 → 完成
```

**异常容错**：网站打不开、无搜索框、登录失效、超时等均**记录并跳过**，不中断整批任务。

## 项目结构

```
search_screenshot/
├── package.json
├── README.md
├── public/                 # 前端静态资源
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── server/
│   ├── index.js            # Express API + 静态服务
│   ├── scraper.js          # 搜索、条件截图、批量任务
│   ├── browser.js          # Puppeteer 启动与页面工具
│   ├── cookies.js          # Cookie 读写
│   ├── config.js           # 选择器与路径配置
│   └── login.js            # 手动登录脚本
├── screenshots/            # 截图输出（自动创建）
└── cookies/                # Cookie 存储（自动创建）
```

## API 说明

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/execute` | 启动批量任务 |
| GET | `/api/status` | 查询进度与最终结果 |
| GET | `/api/screenshots` | 列出截图文件 |

**POST /api/execute** 请求体示例：

```json
{
  "companies": [{ "name": "示例科技有限公司" }],
  "sites": [{ "name": "信用中国", "url": "https://www.creditchina.gov.cn" }],
  "triggerText": "守信",
  "headless": true,
  "waitMs": 3000
}
```

## 常见问题

### 1. 网站打不开或一直超时

- 调大「页面加载等待」至 5000–10000 ms
- 取消无头模式，观察浏览器实际加载情况
- 检查网络是否能访问该政府网站

### 2. 搜索不到 / 总是跳过

- 政府站结构各异，工具通过多组 CSS 选择器尝试定位搜索框，部分站点可能无法识别
- 无触发条件时可直接截首页；有触发条件时若无法搜索会自动跳过
- 可在 `server/config.js` 的 `SEARCH_INPUT_SELECTORS` 中追加该站专用选择器

### 3. 需要验证码

- 使用 `npm run login` 可视化登录
- 执行时**关闭无头模式**，在浏览器中手动完成验证码后继续（适合少量任务）

### 4. 报错 Could not find Chrome

任选一种方式：

**方式 A（推荐）**：本机已安装 [Google Chrome](https://www.google.com/chrome/) 时，项目会自动使用系统 Chrome，直接重试：

```bash
npm run login
```

**方式 B**：安装 Puppeteer 自带的 Chrome：

```bash
npm run install:chrome
# 或
npx puppeteer browsers install chrome
```

**方式 C**：下载慢时使用国内镜像后再安装：

```bash
export PUPPETEER_DOWNLOAD_HOST=https://npmmirror.com/mirrors
npm run install:chrome
```

### 5. 修改端口

默认端口为 **3888**（避免与常见 3000 冲突）。如需更换：

```bash
PORT=8080 npm start
```

## 注意事项

- 本工具仅供**合法合规**的企业信用信息查询与报告整理使用
- 请遵守各网站 robots 协议与服务条款，合理控制访问频率
- 公示系统、信用中国等站点可能更新页面结构，需适时调整选择器

## 许可证

MIT
