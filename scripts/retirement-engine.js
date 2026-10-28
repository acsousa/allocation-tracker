/* Build-time extraction: the standalone tool and portfolio app share one engine. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
function extractRetirementEngine(source = fs.readFileSync(path.join(root, 'app.html'), 'utf8')) {
  const start = source.indexOf('const RETIRE_DATA = {');
  const end = source.indexOf('/* ---- Portfolio glue:', start);
  if (start < 0 || end < 0 || !source.slice(start, end).includes('function runProjection(cfg)')) throw new Error('Retirement engine boundaries changed; review extraction.');
  return source.slice(start, end);
}
function buildRetirementSimulator(source) {
  const adapter = fs.readFileSync(path.join(root, 'assets/retirement-simulator-model.js'), 'utf8');
  // REFERENCE_DATA is referenced only by the spouse branch; this adapter never enables it.
  return `(function(){\n'use strict';\n${extractRetirementEngine(source)}\n${adapter}\n})();\n`;
}
module.exports = { extractRetirementEngine, buildRetirementSimulator };
