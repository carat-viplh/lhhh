/**
 * 前端：配置管理（localStorage）+ 调用后端批量截图
 */
(function () {
  const STORAGE_KEY = 'credit_screenshot_config';
  const SITES_VERSION_KEY = 'credit_screenshot_sites_version';
  const SITES_DATA_VERSION = 2; // 核查网站 docx 全量 38 站

  let DEFAULT_SITES = [];

  let config = {
    companies: [],
    sites: [],
    triggerText: '',
    waitMs: 3000,
    headless: true,
    sitePageSize: 10,
  };

  let sitePage = 1;
  let pollTimer = null;

  const $ = (sel) => document.querySelector(sel);
  const companyList = $('#companyList');
  const siteList = $('#siteList');
  const triggerText = $('#triggerText');
  const waitMs = $('#waitMs');
  const headless = $('#headless');
  const executeBtn = $('#executeBtn');
  const progressSection = $('#progressSection');
  const progressBar = $('#progressBar');
  const progressText = $('#progressText');
  const resultList = $('#resultList');
  const screenshotList = $('#screenshotList');
  const companyDialog = $('#companyDialog');
  const siteDialog = $('#siteDialog');

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const sitesVersion = parseInt(localStorage.getItem(SITES_VERSION_KEY) || '0', 10);
      const useFullDefaults =
        !sitesVersion || sitesVersion < SITES_DATA_VERSION;

      if (raw) {
        const saved = JSON.parse(raw);
        config = {
          companies: saved.companies || [],
          sites:
            useFullDefaults || !saved.sites?.length
              ? [...DEFAULT_SITES]
              : saved.sites,
          triggerText: saved.triggerText ?? '',
          waitMs: saved.waitMs ?? 3000,
          headless: saved.headless !== false,
          sitePageSize: [10, 20, 30, 40].includes(saved.sitePageSize)
            ? saved.sitePageSize
            : 10,
        };
        if (useFullDefaults) {
          localStorage.setItem(SITES_VERSION_KEY, String(SITES_DATA_VERSION));
          saveConfig();
        }
      } else {
        config.sites = [...DEFAULT_SITES];
        localStorage.setItem(SITES_VERSION_KEY, String(SITES_DATA_VERSION));
      }
    } catch {
      config.sites = [...DEFAULT_SITES];
    }
    applyConfigToUI();
  }

  async function fetchDefaultSites() {
    try {
      const res = await fetch('/data/default-sites.json');
      if (res.ok) return await res.json();
    } catch {
      /* ignore */
    }
    return [
      { name: '国家企业信用信息公示系统', url: 'https://www.gsxt.gov.cn' },
      { name: '信用中国', url: 'https://www.creditchina.gov.cn/' },
      { name: '中华人民共和国国家发展和改革委员会', url: 'http://www.ndrc.gov.cn' },
    ];
  }

  function saveConfig() {
    config.triggerText = triggerText.value.trim();
    config.waitMs = parseInt(waitMs.value, 10) || 3000;
    config.headless = headless.checked;
    config.sitePageSize = parseInt($('#sitePageSize')?.value, 10) || 10;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  function applyConfigToUI() {
    triggerText.value = config.triggerText;
    waitMs.value = config.waitMs;
    headless.checked = config.headless;
    if ($('#sitePageSize')) {
      $('#sitePageSize').value = String(config.sitePageSize || 10);
    }
    renderCompanies();
    renderSites();
  }

  function renderCompanies() {
    companyList.innerHTML = '';
    config.companies.forEach((name, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="item-info"><span class="item-name">${escapeHtml(name)}</span></div>
        <div class="item-actions">
          <button type="button" class="btn btn-sm btn-outline" data-action="edit-company" data-index="${i}">编辑</button>
          <button type="button" class="btn btn-danger" data-action="del-company" data-index="${i}">删除</button>
        </div>`;
      companyList.appendChild(li);
    });
    $('#companyEmpty').hidden = config.companies.length > 0;
  }

  function getSitePageSize() {
    const size = parseInt($('#sitePageSize')?.value, 10) || config.sitePageSize || 10;
    return [10, 20, 30, 40].includes(size) ? size : 10;
  }

  function renderSites() {
    const total = config.sites.length;
    const pageSize = getSitePageSize();
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    if (sitePage > totalPages) sitePage = totalPages;
    if (sitePage < 1) sitePage = 1;

    const start = (sitePage - 1) * pageSize;
    const pageSites = config.sites.slice(start, start + pageSize);

    siteList.innerHTML = '';
    pageSites.forEach((site, idx) => {
      const i = start + idx;
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="item-info">
          <span class="item-name">${escapeHtml(site.name)}</span>
          <span class="item-url">${escapeHtml(site.url)}</span>
        </div>
        <div class="item-actions">
          <button type="button" class="btn btn-sm btn-outline" data-action="edit-site" data-index="${i}">编辑</button>
          <button type="button" class="btn btn-danger" data-action="del-site" data-index="${i}">删除</button>
        </div>`;
      siteList.appendChild(li);
    });

    $('#siteEmpty').hidden = total > 0;
    const pagination = $('#sitePagination');
    if (pagination) {
      pagination.hidden = total === 0;
      $('#sitePageInfo').textContent = `共 ${total} 条，当前第 ${start + 1}-${Math.min(start + pageSize, total)} 条`;
      $('#sitePageNum').textContent = `${sitePage} / ${totalPages}`;
      $('#sitePrev').disabled = sitePage <= 1;
      $('#siteNext').disabled = sitePage >= totalPages;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /** 解析批量企业名：按行/逗号/分号分隔，去重去空 */
  function parseCompanyNames(text) {
    const names = text
      .split(/[\n,，;；]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return [...new Set(names)];
  }

  function openCompanyDialog(index = -1) {
    const isEdit = index >= 0;
    $('#companyEditIndex').value = index;
    $('#companyDialogTitle').textContent = isEdit ? '编辑企业' : '添加企业';
    $('#fieldCompanyBatch').hidden = isEdit;
    $('#fieldCompanySingle').hidden = !isEdit;
    $('#companyNamesInput').required = !isEdit;
    $('#companySingleInput').required = isEdit;

    if (isEdit) {
      $('#companySingleInput').value = config.companies[index];
      $('#companyNamesInput').value = '';
    } else {
      $('#companyNamesInput').value = '';
      $('#companySingleInput').value = '';
    }
    companyDialog.showModal();
  }

  function openSiteDialog(index = -1) {
    const isEdit = index >= 0;
    $('#siteEditIndex').value = index;
    $('#siteDialogTitle').textContent = isEdit ? '编辑网站' : '添加网站';

    if (isEdit) {
      $('#siteNameInput').value = config.sites[index].name;
      $('#siteUrlInput').value = config.sites[index].url;
    } else {
      $('#siteNameInput').value = '';
      $('#siteUrlInput').value = '';
    }
    siteDialog.showModal();
  }

  $('#addCompany').addEventListener('click', () => openCompanyDialog(-1));
  $('#addSite').addEventListener('click', () => openSiteDialog(-1));
  $('#companyDialogCancel').addEventListener('click', () => companyDialog.close());
  $('#siteDialogCancel').addEventListener('click', () => siteDialog.close());

  $('#companyForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const index = parseInt($('#companyEditIndex').value, 10);

    if (index >= 0) {
      const name = $('#companySingleInput').value.trim();
      if (!name) return;
      config.companies[index] = name;
    } else {
      const names = parseCompanyNames($('#companyNamesInput').value);
      if (!names.length) {
        alert('请至少输入一个企业名称（每行一个）');
        return;
      }
      const existing = new Set(config.companies);
      names.forEach((n) => {
        if (!existing.has(n)) {
          config.companies.push(n);
          existing.add(n);
        }
      });
    }
    renderCompanies();
    saveConfig();
    companyDialog.close();
  });

  $('#siteForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const index = parseInt($('#siteEditIndex').value, 10);
    const name = $('#siteNameInput').value.trim();
    const url = $('#siteUrlInput').value.trim();
    if (!name || !url) return;

    const site = { name, url };
    if (index >= 0) config.sites[index] = site;
    else {
      config.sites.push(site);
      const pageSize = getSitePageSize();
      sitePage = Math.ceil(config.sites.length / pageSize);
    }
    renderSites();
    saveConfig();
    siteDialog.close();
  });

  $('#sitePageSize').addEventListener('change', () => {
    config.sitePageSize = getSitePageSize();
    sitePage = 1;
    saveConfig();
    renderSites();
  });

  $('#sitePrev').addEventListener('click', () => {
    if (sitePage > 1) {
      sitePage -= 1;
      renderSites();
    }
  });

  $('#siteNext').addEventListener('click', () => {
    const totalPages = Math.ceil(config.sites.length / getSitePageSize());
    if (sitePage < totalPages) {
      sitePage += 1;
      renderSites();
    }
  });

  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const index = parseInt(btn.dataset.index, 10);

    if (action === 'edit-company') openCompanyDialog(index);
    if (action === 'del-company') {
      config.companies.splice(index, 1);
      renderCompanies();
      saveConfig();
    }
    if (action === 'edit-site') openSiteDialog(index);
    if (action === 'del-site') {
      config.sites.splice(index, 1);
      const totalPages = Math.max(1, Math.ceil(config.sites.length / getSitePageSize()));
      if (sitePage > totalPages) sitePage = totalPages;
      renderSites();
      saveConfig();
    }
  });

  [triggerText, waitMs, headless].forEach((el) => {
    el.addEventListener('change', saveConfig);
    el.addEventListener('input', saveConfig);
  });

  async function executeTask() {
    saveConfig();

    if (!config.companies.length) {
      alert('请至少添加一个企业名称');
      return;
    }
    if (!config.sites.length) {
      alert('请至少添加一个查询网站');
      return;
    }

    executeBtn.disabled = true;
    progressSection.hidden = false;
    resultList.innerHTML = '';
    progressBar.style.width = '0%';
    progressText.textContent = `正在启动：${config.companies.length} 家企业并行，各检索 ${config.sites.length} 个网站…`;

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companies: config.companies.map((name) => ({ name })),
          sites: config.sites,
          triggerText: config.triggerText,
          headless: config.headless,
          waitMs: config.waitMs,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || '启动失败');
        executeBtn.disabled = false;
        return;
      }
      startPolling();
    } catch (err) {
      alert('无法连接后端: ' + err.message);
      executeBtn.disabled = false;
    }
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(pollStatus, 1200);
    pollStatus();
  }

  async function pollStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();

      if (data.progress) {
        const { current, total, companyName, siteName, status, parallel } =
          data.progress;
        const pct = total ? Math.round((current / total) * 100) : 0;
        progressBar.style.width = pct + '%';
        const parallelHint = parallel ? '（多企业并行）' : '';
        progressText.textContent =
          status === 'running'
            ? `进行中 ${current}/${total}${parallelHint}：${companyName} · ${siteName}`
            : `已完成 ${current}/${total}${parallelHint}`;

        if (data.progress.result) appendResult(data.progress.result);
      }

      if (!data.running && data.lastResult) {
        clearInterval(pollTimer);
        pollTimer = null;
        executeBtn.disabled = false;

        const { summary, results } = data.lastResult;
        if (summary) {
          progressText.textContent = `任务完成 — 成功 ${summary.success}，跳过 ${summary.skipped}，失败 ${summary.failed}`;
        }
        if (results) {
          results.forEach((r) => {
            if (!document.querySelector(`[data-result-key="${resultKey(r)}"]`)) {
              appendResult(r);
            }
          });
        }
        loadScreenshots();
      }
    } catch {
      /* retry */
    }
  }

  function resultKey(r) {
    return `${r.companyName}_${r.siteName}_${r.message}`;
  }

  function appendResult(r) {
    const key = resultKey(r);
    if (document.querySelector(`[data-result-key="${key}"]`)) return;

    const li = document.createElement('li');
    li.dataset.resultKey = key;
    let cls = 'result-fail';
    if (r.success) cls = 'result-success';
    else if (r.skipped) cls = 'result-skip';
    li.className = cls;
    li.textContent = `[${r.companyName}] ${r.siteName}：${r.message}${
      r.filename ? ' → ' + r.filename : ''
    }`;
    resultList.appendChild(li);
    resultList.scrollTop = resultList.scrollHeight;
  }

  async function loadScreenshots() {
    try {
      const res = await fetch('/api/screenshots');
      const data = await res.json();
      screenshotList.innerHTML = '';
      const files = data.files || [];
      $('#screenshotEmpty').hidden = files.length > 0;

      files.forEach((f) => {
        const li = document.createElement('li');
        li.innerHTML = `
          <a href="${f.url}" target="_blank" rel="noopener">
            <img src="${f.url}" alt="${escapeHtml(f.name)}" loading="lazy" />
            <span class="file-name">${escapeHtml(f.name)}</span>
          </a>`;
        screenshotList.appendChild(li);
      });
    } catch {
      /* ignore */
    }
  }

  executeBtn.addEventListener('click', executeTask);
  $('#refreshScreenshots').addEventListener('click', loadScreenshots);

  (async function init() {
    DEFAULT_SITES = await fetchDefaultSites();
    loadConfig();
    loadScreenshots();
  })();
})();
