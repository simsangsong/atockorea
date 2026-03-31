/**
 * Fills missing keys in locale JSON files from messages/en.json (does not overwrite existing).
 * Run: node scripts/fill-missing-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const messagesDir = path.join(root, 'messages');

function fillMissing(target, source) {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return target !== undefined ? target : source;
  }
  const out =
    target && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {};
  for (const k of Object.keys(source)) {
    if (!(k in out) || out[k] === undefined) {
      out[k] = source[k];
    } else if (
      typeof source[k] === 'object' &&
      source[k] !== null &&
      !Array.isArray(source[k]) &&
      typeof out[k] === 'object' &&
      out[k] !== null &&
      !Array.isArray(out[k])
    ) {
      out[k] = fillMissing(out[k], source[k]);
    }
  }
  return out;
}

const en = JSON.parse(fs.readFileSync(path.join(messagesDir, 'en.json'), 'utf8'));
const locales = ['ko', 'zh', 'zh-TW', 'es', 'ja'];

for (const loc of locales) {
  const p = path.join(messagesDir, `${loc}.json`);
  const cur = JSON.parse(fs.readFileSync(p, 'utf8'));
  const merged = fillMissing(cur, en);
  fs.writeFileSync(p, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log('Updated', loc);
}
