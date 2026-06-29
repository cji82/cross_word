'use strict';

const fs = require('fs');
const path = require('path');
const {
  sleep,
  lookupDefinition,
  wordToClue,
  isValidClue,
  isTruncatedClue,
  MANUAL_CLUES,
} = require('./clue-dictionary.cjs');

const PACK_DIR = path.join(__dirname, 'word-packs');
const DELAY_MS = 420;
const CATEGORY_KEYS = ['animals', 'food', 'fruits', 'jobs', 'nature'];

function writePackFile(categoryKey, entries) {
  const packPath = path.join(PACK_DIR, `${categoryKey}.js`);
  const lines = ["'use strict';", '', 'module.exports = ['];
  for (const { word, clue } of entries) {
    lines.push(`  { word: '${word}', clue: '${clue.replace(/'/g, "\\'")}' },`);
  }
  lines.push('];', '');
  fs.writeFileSync(packPath, lines.join('\n'), 'utf8');
}

function loadPack(categoryKey) {
  const packPath = path.join(PACK_DIR, `${categoryKey}.js`);
  delete require.cache[require.resolve(packPath)];
  return require(packPath);
}

async function repairCategory(categoryKey, onlyCategory) {
  if (onlyCategory && onlyCategory !== categoryKey) return { fixed: 0, failed: 0 };

  const pack = loadPack(categoryKey);
  let fixed = 0;
  let failed = 0;

  for (let i = 0; i < pack.length; i++) {
    const entry = pack[i];
    if (isValidClue(entry.clue, entry.word) && !isTruncatedClue(entry.clue)) continue;

    const manual = MANUAL_CLUES[entry.word];
    if (manual && isValidClue(manual, entry.word)) {
      pack[i] = { word: entry.word, clue: manual };
      fixed++;
      continue;
    }

    process.stdout.write(`\r[${categoryKey}] ${i + 1}/${pack.length} ${entry.word}`.padEnd(48));
    try {
      const lookup = await lookupDefinition(entry.word, categoryKey);
      const clue = wordToClue(entry.word, categoryKey, lookup);
      if (isValidClue(clue, entry.word)) {
        pack[i] = { word: entry.word, clue };
        fixed++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    await sleep(DELAY_MS);
  }

  const sorted = [...pack].sort((a, b) => a.word.localeCompare(b.word, 'ko'));
  writePackFile(categoryKey, sorted);
  console.log(`\n[${categoryKey}] 수정 ${fixed}개 · 실패 ${failed}개`);
  return { fixed, failed };
}

async function main() {
  const onlyCategory = process.argv.find((arg) => arg.startsWith('--category='))?.slice(11);
  let totalFixed = 0;
  let totalFailed = 0;

  for (const categoryKey of CATEGORY_KEYS) {
    const result = await repairCategory(categoryKey, onlyCategory);
    totalFixed += result.fixed;
    totalFailed += result.failed;
  }

  console.log(`\n완료: 수정 ${totalFixed}개 · 실패 ${totalFailed}개`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
