const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const DELAY_MS = 500;
const PROGRESS_PATH = path.join(__dirname, 'dict-progress.json');
const FAILURES_PATH = path.join(__dirname, 'dict-failures.json');
const INVALID_PATH = path.join(__dirname, 'dict-invalid.json');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) cross_word-validator/1.0',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

/** 표기 교정: 데이터 단어 → 사전 표준형 (검색 시 함께 시도) */
const SEARCH_ALIASES = {
  패션후르츠: ['패션프루트'],
  드래곤후르츠: ['용설란', '드래곤프루트'],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeHeadword(text) {
  return String(text).replace(/[\^·\s-]/g, '').normalize('NFC');
}

async function fetchUrl(url, headers = {}, retries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const req = https.get(
          url,
          { agent: httpsAgent, headers: { ...BROWSER_HEADERS, ...headers }, timeout: 15000 },
          (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => resolve(data));
          }
        );
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('timeout'));
        });
        req.on('error', reject);
      });
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(2000 * attempt);
    }
  }

  throw lastError;
}

function isExactStdictHit(html, word) {
  const countMatch = html.match(/찾기 결과 \(총\s+(\d+)\s*개\)/);
  if (!countMatch || Number(countMatch[1]) === 0) return false;

  const target = normalizeHeadword(word);
  const headwordRe = /class=["']t_blue1["']>\s*([\s\S]*?)<\/a>/g;
  let match;

  while ((match = headwordRe.exec(html)) !== null) {
    const headword = match[1].replace(/<[^>]+>/g, '');
    if (normalizeHeadword(headword) === target) return true;
  }

  return false;
}

function isExactOpendictHit(html, word) {
  if (html.includes('시스템 오류') || html.length < 2000) return false;

  const exactRe = new RegExp(
    `[‘'"]${escapeRegExp(word)}[’'"]만 찾기[^>]*>총\\s+(\\d+)\\s*개`
  );
  const exactMatch = html.match(exactRe);
  if (exactMatch && Number(exactMatch[1]) > 0) return true;

  const target = normalizeHeadword(word);
  const headwordRes = [
    /search_word_type3_\d+[^>]*>([^<]+)/g,
    /search_word_type1_\d+">([^<]+)/g,
  ];

  for (const re of headwordRes) {
    let match;
    while ((match = re.exec(html)) !== null) {
      const headword = match[1].replace(/<[^>]+>/g, '').split('^').join('');
      if (normalizeHeadword(headword) === target) return true;
    }
  }

  return false;
}

async function lookupStdict(word) {
  const url = `https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=${encodeURIComponent(word)}`;
  const html = await fetchUrl(url);
  return isExactStdictHit(html, word);
}

async function lookupOpendict(word) {
  const url = `https://opendict.korean.go.kr/search/searchResult?query=${encodeURIComponent(word)}`;
  const html = await fetchUrl(url, { Referer: 'https://opendict.korean.go.kr/' });
  return isExactOpendictHit(html, word);
}

async function validateWordForms(word) {
  const forms = [word, ...(SEARCH_ALIASES[word] || [])];
  let stdictForm = null;
  let opendictForm = null;

  for (const form of forms) {
    if (!stdictForm && (await lookupStdict(form))) {
      stdictForm = form;
      break;
    }
  }

  if (stdictForm) {
    return { word, status: 'stdict', matchedForm: stdictForm, suggestedWord: stdictForm };
  }

  for (const form of forms) {
    if (!opendictForm && (await lookupOpendict(form))) {
      opendictForm = form;
      break;
    }
    await sleep(200);
  }

  if (opendictForm) {
    return { word, status: 'opendict', matchedForm: opendictForm, suggestedWord: opendictForm };
  }

  return { word, status: 'invalid', matchedForm: null, suggestedWord: null };
}

function loadWords() {
  const { loadCategoriesFile } = require('./category-encoding.cjs');
  const CATEGORIES = loadCategoriesFile(path.join(ROOT, 'data', 'categories.js'));
  const entries = [];

  for (const [categoryKey, category] of Object.entries(CATEGORIES)) {
    for (const entry of category.words) {
      entries.push({ categoryKey, categoryName: category.name, ...entry });
    }
  }

  return entries;
}

function loadProgress() {
  if (!fs.existsSync(PROGRESS_PATH)) {
    return { checked: {}, results: [] };
  }
  return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf8');
}

async function main() {
  const reset = process.argv.includes('--reset');
  const testWord = process.argv.find((arg) => arg.startsWith('--test='))?.slice(7);

  if (testWord) {
    const result = await validateWordForms(testWord);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const entries = loadWords();
  const uniqueWords = [...new Set(entries.map((e) => e.word))];
  const progress = reset ? { checked: {}, results: [] } : loadProgress();
  const pending = uniqueWords.filter((word) => !progress.checked[word]);

  console.log(
    `사전 검증(표준국어대사전→우리말샘) · ${uniqueWords.length}개 · ${DELAY_MS}ms · 남은 ${pending.length}개`
  );

  let index = uniqueWords.length - pending.length;

  for (const word of pending) {
    index++;
    const sample = entries.find((e) => e.word === word);
    process.stdout.write(`\r[${index}/${uniqueWords.length}] ${word}          `);

    try {
      const result = await validateWordForms(word);
      progress.checked[word] = result.status;
      progress.results = progress.results.filter((item) => item.word !== word);
      progress.results.push({
        word,
        categoryKey: sample.categoryKey,
        categoryName: sample.categoryName,
        ...result,
      });
      saveProgress(progress);
    } catch (error) {
      console.error(`\n요청 실패: ${word} (${error.message})`);
      console.error('진행 저장됨. 같은 명령으로 이어서 실행하세요.');
      process.exitCode = 1;
      return;
    }

    await sleep(DELAY_MS);
  }

  console.log('\n');

  const invalid = progress.results.filter((item) => item.status === 'invalid');
  const spelling = progress.results.filter(
    (item) => item.status !== 'invalid' && item.suggestedWord !== item.word
  );
  const opendictOnly = progress.results.filter((item) => item.status === 'opendict');

  console.log(`표준국어대사전: ${progress.results.filter((r) => r.status === 'stdict').length}개`);
  console.log(`우리말샘만: ${opendictOnly.length}개`);
  console.log(`표기 교정 필요: ${spelling.length}개`);
  console.log(`양쪽 미등재(잘못된 데이터): ${invalid.length}개\n`);

  if (spelling.length) {
    console.log('표기 교정 후보:');
    for (const item of spelling) {
      console.log(`- ${item.word} → ${item.suggestedWord} (${item.categoryName})`);
    }
    console.log('');
  }

  if (invalid.length) {
    console.log('양쪽 미등재:');
    for (const item of invalid) {
      console.log(`- ${item.word} (${item.categoryName})`);
    }
  }

  fs.writeFileSync(
    FAILURES_PATH,
    JSON.stringify(
      progress.results.filter((item) => item.status !== 'stdict'),
      null,
      2
    ),
    'utf8'
  );
  fs.writeFileSync(INVALID_PATH, JSON.stringify(invalid, null, 2), 'utf8');

  console.log(`\n미통과 목록: ${FAILURES_PATH}`);
  console.log(`잘못된 데이터: ${INVALID_PATH}`);

  if (invalid.length > 0 || spelling.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
