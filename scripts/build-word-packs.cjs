'use strict';

const fs = require('fs');
const path = require('path');
const { loadCategoriesFile } = require('./category-encoding.cjs');
const {
  sleep,
  lookupDefinition,
  wordToClue,
  isValidClue,
  MANUAL_CLUES,
} = require('./clue-dictionary.cjs');

const ROOT = path.join(__dirname, '..');
const PACK_DIR = path.join(__dirname, 'word-packs');
const PROGRESS_PATH = path.join(__dirname, 'word-pack-progress.json');
const ADD_PER_CATEGORY = 500;
const DELAY_MS = 420;
const CATEGORY_KEYS = ['animals', 'food', 'fruits', 'jobs', 'nature'];

const CANDIDATE_SKIP = {
  animals: /(?:공포증|재단|도감|교상|알레르기|기생|독성|시험|시대|학자|뽐프|경보|곡선|결핵|경계|의연체동물|갑각류알레르기|국제맹금류)/,
  food: /(?:알레르기|중독|질$|병$|학$|학자$)/,
  fruits: /(?:알레르기|중독|질$|병$|학$|씨앗$|씨$)/,
  jobs: /(?:학$|학자$|연구$)/,
  nature: /(?:학$|학자$|연구$|측정$)/,
};

const TAXONOMY_ONLY = /^(포유류|조류|어류|파충류|양서류|갑각류|연체동물|설치류|맹금류|곤충|곤충강|연체동물문)$/;

function countSyllables(word) {
  return [...String(word).normalize('NFC')].length;
}

function isHangulWord(word) {
  return /^[가-힣]+$/.test(word) && countSyllables(word) >= 2 && countSyllables(word) <= 8;
}

function loadExistingWords() {
  const categories = loadCategoriesFile(path.join(ROOT, 'data', 'categories.js'));
  const byCategory = {};

  for (const key of CATEGORY_KEYS) {
    byCategory[key] = new Set(categories[key].words.map((entry) => entry.word));
  }

  return byCategory;
}

function loadCandidateWords(categoryKey) {
  const v8Path = path.join(__dirname, 'seed-data', `candidates-v8-${categoryKey}.js`);
  const v7Path = path.join(__dirname, 'seed-data', `candidates-v7-${categoryKey}.js`);
  const v6Path = path.join(__dirname, 'seed-data', `candidates-v6-${categoryKey}.js`);
  const v5Path = path.join(__dirname, 'seed-data', `candidates-v5-${categoryKey}.js`);
  const v4Path = path.join(__dirname, 'seed-data', `candidates-v4-${categoryKey}.js`);
  const v3Path = path.join(__dirname, 'seed-data', `candidates-v3-${categoryKey}.js`);
  const v2Path = path.join(__dirname, 'seed-data', `candidates-v2-${categoryKey}.js`);
  const additional = require('./seed-data/additional.cjs')[categoryKey] || [];
  const supplements = require('./seed-data/supplements.cjs')[categoryKey] || [];
  const seed = require(path.join(__dirname, 'seed-data', `${categoryKey}.js`));
  const v6 = fs.existsSync(v6Path) ? require(v6Path) : [];
  const v7 = fs.existsSync(v7Path) ? require(v7Path) : [];
  const v8 = fs.existsSync(v8Path) ? require(v8Path) : [];
  const v5 = fs.existsSync(v5Path) ? require(v5Path) : [];
  const v4 = fs.existsSync(v4Path) ? require(v4Path) : [];
  const v3 = fs.existsSync(v3Path) ? require(v3Path) : [];
  const v2 = fs.existsSync(v2Path) ? require(v2Path) : [];
  return [...v8, ...v7, ...v6, ...v5, ...v4, ...v3, ...v2, ...additional, ...supplements, ...seed];
}

function loadProgress() {
  if (!fs.existsSync(PROGRESS_PATH)) {
    return { packs: {} };
  }
  return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf8');
}

function loadPackFile(categoryKey) {
  const packPath = path.join(PACK_DIR, `${categoryKey}.js`);
  if (!fs.existsSync(packPath)) return [];
  delete require.cache[require.resolve(packPath)];
  return require(packPath);
}

function writePackFile(categoryKey, entries) {
  fs.mkdirSync(PACK_DIR, { recursive: true });
  const packPath = path.join(PACK_DIR, `${categoryKey}.js`);
  const lines = ["'use strict';", '', 'module.exports = ['];

  for (const { word, clue } of entries) {
    lines.push(`  { word: '${word}', clue: '${clue.replace(/'/g, "\\'")}' },`);
  }

  lines.push('];', '');
  fs.writeFileSync(packPath, lines.join('\n'), 'utf8');
}

function isCandidateWord(word, categoryKey) {
  if (CANDIDATE_SKIP[categoryKey]?.test(word)) return false;
  if (categoryKey === 'animals' && TAXONOMY_ONLY.test(word)) return false;
  return true;
}

function buildCandidateQueue(categoryKey, existingWords, packWords) {
  const used = new Set([...existingWords, ...packWords.map((entry) => entry.word)]);
  const queue = [];

  for (const word of loadCandidateWords(categoryKey)) {
    if (!isHangulWord(word)) continue;
    if (!isCandidateWord(word, categoryKey)) continue;
    if (used.has(word)) continue;
    used.add(word);
    queue.push(word);
  }

  return queue;
}

async function buildCategory(categoryKey, existingWords, progress, onlyCategory) {
  if (onlyCategory && onlyCategory !== categoryKey) return;

  const pack = loadPackFile(categoryKey);
  const packByWord = new Map(pack.map((entry) => [entry.word, entry]));
  const categoryProgress = progress.packs[categoryKey] || { failed: {}, done: {} };
  progress.packs[categoryKey] = categoryProgress;

  for (const word of Object.keys(MANUAL_CLUES)) {
    if (categoryProgress.failed[word]) delete categoryProgress.failed[word];
  }

  const queue = buildCandidateQueue(
    categoryKey,
    existingWords[categoryKey],
    pack
  );

  const target = ADD_PER_CATEGORY;
  let validCount = pack.filter((entry) => isValidClue(entry.clue, entry.word)).length;

  console.log(`\n[${categoryKey}] 현재 ${validCount}개 · 목표 ${target}개 · 후보 ${queue.length}개`);

  for (const word of queue) {
    if (validCount >= target) break;
    if (packByWord.has(word) && isValidClue(packByWord.get(word).clue, word)) continue;
    if (categoryProgress.failed[word]) continue;

    const index = validCount + 1;
    process.stdout.write(`\r[${categoryKey}] ${index}/${target} ${word}                    `);

    try {
      const manual = MANUAL_CLUES[word];
      const lookup = manual ? null : await lookupDefinition(word, categoryKey);
      const clue = wordToClue(word, categoryKey, lookup);

      if (!isValidClue(clue, word)) {
        categoryProgress.failed[word] = {
          reason: lookup ? 'invalid-clue' : 'missing-dict',
          definition: lookup?.definition ?? null,
        };
        saveProgress(progress);
        await sleep(DELAY_MS);
        continue;
      }

      const entry = { word, clue };
      packByWord.set(word, entry);
      categoryProgress.done[word] = { clue, source: manual ? 'manual' : lookup?.source };
      delete categoryProgress.failed[word];
      validCount += 1;

      const sorted = [...packByWord.values()].sort((a, b) => a.word.localeCompare(b.word, 'ko'));
      writePackFile(categoryKey, sorted);
      saveProgress(progress);
    } catch (error) {
      console.error(`\n[${categoryKey}] 실패: ${word} (${error.message})`);
      saveProgress(progress);
      throw error;
    }

    await sleep(DELAY_MS);
  }

  const finalPack = [...packByWord.values()]
    .filter((entry) => isValidClue(entry.clue, entry.word))
    .sort((a, b) => a.word.localeCompare(b.word, 'ko'));
  writePackFile(categoryKey, finalPack);
  console.log(`\n[${categoryKey}] 완료: ${finalPack.length}개`);
}

async function main() {
  const reset = process.argv.includes('--reset');
  const onlyCategory = process.argv.find((arg) => arg.startsWith('--category='))?.slice(11);

  if (reset && fs.existsSync(PROGRESS_PATH)) {
    fs.unlinkSync(PROGRESS_PATH);
    if (fs.existsSync(PACK_DIR)) {
      for (const key of CATEGORY_KEYS) {
        const packPath = path.join(PACK_DIR, `${key}.js`);
        if (fs.existsSync(packPath)) fs.unlinkSync(packPath);
      }
    }
  }

  const existingWords = loadExistingWords();
  const progress = loadProgress();

  for (const categoryKey of CATEGORY_KEYS) {
    await buildCategory(categoryKey, existingWords, progress, onlyCategory);
  }

  console.log('\n워드팩 생성 완료:', PACK_DIR);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
