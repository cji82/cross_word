'use strict';

const fs = require('fs');
const path = require('path');
const { MANUAL_CLUES, isCorruptedClue, isValidClue } = require('./clue-dictionary.cjs');

const PACK_DIR = path.join(__dirname, 'word-packs');
const CATEGORY_KEYS = ['animals', 'food', 'fruits', 'jobs', 'nature'];

function writePack(categoryKey, entries) {
  const packPath = path.join(PACK_DIR, `${categoryKey}.js`);
  const lines = ["'use strict';", '', 'module.exports = ['];
  for (const { word, clue } of entries) {
    lines.push(`  { word: '${word}', clue: '${clue.replace(/'/g, "\\'")}' },`);
  }
  lines.push('];', '');
  fs.writeFileSync(packPath, lines.join('\n'), 'utf8');
}

let fixed = 0;
let removed = 0;

for (const categoryKey of CATEGORY_KEYS) {
  const packPath = path.join(PACK_DIR, `${categoryKey}.js`);
  delete require.cache[require.resolve(packPath)];
  const pack = require(packPath);
  const next = [];

  for (const entry of pack) {
    let clue = entry.clue;
    if (MANUAL_CLUES[entry.word]) {
      clue = MANUAL_CLUES[entry.word];
    }
    if (isCorruptedClue(clue) && !MANUAL_CLUES[entry.word]) {
      removed++;
      continue;
    }
    if (!isValidClue(clue, entry.word)) {
      removed++;
      continue;
    }
    if (clue !== entry.clue) fixed++;
    next.push({ word: entry.word, clue });
  }

  writePack(categoryKey, next.sort((a, b) => a.word.localeCompare(b.word, 'ko')));
  console.log(`${categoryKey}: ${next.length}개 (수정 ${fixed}, 제외 ${removed})`);
}
