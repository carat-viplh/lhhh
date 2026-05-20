/**
 * 默认核查网站（来源：副本核查网站.docx）
 */
const path = require('path');
const fs = require('fs');

const JSON_PATH = path.join(__dirname, '..', 'public', 'data', 'default-sites.json');

function loadDefaultSites() {
  return JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
}

module.exports = { loadDefaultSites, JSON_PATH };
