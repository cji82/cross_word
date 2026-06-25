const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const DELAY_MS = 450;
const PROGRESS_PATH = path.join(__dirname, 'clue-sync-progress.json');
const REPORT_PATH = path.join(__dirname, 'clue-sync-report.json');
const FACTUAL_PATH = path.join(__dirname, 'factual-clues.js');
const MIN_CLUE_LEN = 10;
const MAX_CLUE_LEN = 25;
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) cross_word-clue-sync/1.0',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

const SEARCH_ALIASES = {
  패션후르츠: ['패션프루트'],
  드래곤후르츠: ['용설란', '드래곤프루트'],
};

const CATEGORY_HINTS = {
  animals: /동물|포유|조류|파충|양서|곤충|어류|갑각|과에|목에|류에|과의|설치|맹수|가축|야생/,
  food: /음식|요리|찌개|국수|국밥|반찬|먹|식품|볶|구이|튀김|밥|면|떡|탕|찜/,
  fruits: /과일|열매|나무|베리/,
  jobs: /직업|직원|전문|종사|하는 사람|사무|의사|교사|간호|변호|설계|개발|상담|안내|방송|출판|디자인/,
  nature: /현상|지형|지역|하늘|바다|산|강|숲|구름|비|눈|바람|지표|암석|식물|풀|날씨/,
};

const MANUAL_CLUES = {
  홍로: '붉게 달아 익는 사과 품종',
  피칸: '피칸나무의 열매로, 견과류의 하나',
};

const CATEGORY_NEGATIVE = {
  animals: /술|소주|음식|요리|건물|질병/,
  food: /동물|식물학|질병|병원/,
  fruits: /술|소주|화로|질병|병원|건물/,
  jobs: /동물|식물|지형|술$/ ,
  nature: /음식|직업|병원|질병|읍|면의|위치해|동에|리에/,
};

const CATEGORY_BONUS = {
  animals: /육식|초식|애완|서식|사는/,
  food: /끓|넣|볶|구|튀|찜|절|발효/,
  fruits: /달콤|새콤|향|재배|먹는|사과|품종|과학원|열매/,
  jobs: /온라인|플랫폼|콘텐츠|환자|고객|학생|의뢰|시청/,
  nature: /흐르|내리|피|일어나|덮|자라/,
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

function stripHtml(text) {
  return String(text)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchUrl(url, headers = {}, retries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const req = https.get(
          url,
          { agent: httpsAgent, headers: { ...BROWSER_HEADERS, ...headers }, timeout: 20000 },
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
      if (attempt < retries) await sleep(1500 * attempt);
    }
  }

  throw lastError;
}

function parseStdictDefinitions(html, word) {
  const target = normalizeHeadword(word);
  const results = [];
  const re =
    /class=["']t_blue1["']>\s*([\s\S]*?)<\/a>[\s\S]*?<font class="dataLine">([\s\S]*?)<\/font>/g;
  let match;

  while ((match = re.exec(html)) !== null) {
    const headword = normalizeHeadword(stripHtml(match[1]));
    if (headword !== target) continue;
    const def = stripHtml(match[2]);
    if (def) results.push(def);
  }

  return results;
}

function parseOpendictDefinitions(html, word) {
  const target = normalizeHeadword(word);
  const definitions = [];
  const blocks = html.split('<dl>');

  for (const block of blocks) {
    const headMatch = block.match(/search_word_type\d+_\d+[^>]*>([^<]+)/);
    if (!headMatch) continue;
    const headword = normalizeHeadword(stripHtml(headMatch[1]));
    const isExact = headword === target;
    const isCompound = headword.endsWith(target) && headword.length > target.length;
    if (!isExact && !isCompound) continue;

    const disRe = /class="word_dis[^"]*">([^<]+)</g;
    let match;
    while ((match = disRe.exec(block)) !== null) {
      const def = stripHtml(match[1]);
      if (def && !definitions.includes(def)) definitions.push(def);
    }
  }

  return definitions;
}

function scoreDefinition(definition, categoryKey) {
  let score = 0;
  const hint = CATEGORY_HINTS[categoryKey];
  const bonus = CATEGORY_BONUS[categoryKey];

  if (hint?.test(definition)) score += 20;
  if (bonus?.test(definition)) score += 8;
  if (definition.length >= 12 && definition.length <= 90) score += 4;
  if (/하는 사람\.?$/.test(definition) && definition.length < 22) score -= 4;
  if (/온라인|플랫폼|콘텐츠/.test(definition) && categoryKey === 'jobs') score += 10;
  if (/온라인 플랫폼을 활용/.test(definition) && categoryKey === 'jobs') score += 18;
  if (CATEGORY_NEGATIVE[categoryKey]?.test(definition)) score -= 12;
  if (categoryKey === 'fruits' && /과학원|사과|품종/.test(definition)) score += 16;
  if (/광고/.test(definition) && categoryKey === 'jobs') score -= 6;
  if (categoryKey === 'jobs' && /컴퓨터|소프트웨어|코딩/.test(definition)) score += 14;
  if (categoryKey === 'jobs' && /텔레비전 프로그램|영화나/.test(definition)) score -= 12;
  if (categoryKey === 'jobs' && /신문|잡지|방송/.test(definition) && /기사/.test(definition)) score += 12;
  if (categoryKey === 'nature' && /용암|마그마|화산/.test(definition)) score += 14;
  if (categoryKey === 'nature' && /유성|별|우주/.test(definition)) score += 14;
  if (categoryKey === 'nature' && /해일|바다|파도/.test(definition)) score += 14;
  return score;
}

function pickBestDefinition(definitions, categoryKey) {
  if (!definitions.length) return null;
  return [...definitions].sort(
    (a, b) => scoreDefinition(b, categoryKey) - scoreDefinition(a, categoryKey)
  )[0];
}

async function lookupDefinition(word, categoryKey) {
  const forms = [word, ...(SEARCH_ALIASES[word] || [])];

  for (const form of forms) {
    const url = `https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=${encodeURIComponent(form)}`;
    const html = await fetchUrl(url);
    const definitions = parseStdictDefinitions(html, form);
    const definition = pickBestDefinition(definitions, categoryKey);
    if (definition) return { source: 'stdict', form, definition, allDefinitions: definitions };
    await sleep(150);
  }

  for (const form of forms) {
    const url = `https://opendict.korean.go.kr/search/searchResult?query=${encodeURIComponent(form)}`;
    const html = await fetchUrl(url, { Referer: 'https://opendict.korean.go.kr/' });
    const definitions = parseOpendictDefinitions(html, form);
    const definition = pickBestDefinition(definitions, categoryKey);
    if (definition) return { source: 'opendict', form, definition, allDefinitions: definitions };
    await sleep(150);
  }

  return null;
}

function cleanDefinition(definition) {
  return simplifyDefinition(definition.split(/≒|⇒/)[0])
    .replace(/『[^』]*』\s*/g, '')
    .replace(/\([^)]{0,40}\)/g, '')
    .replace(/\[[^\]]{0,40}\]/g, '')
    .replace(/「[^」]{0,40}」/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function simplifyDefinition(definition) {
  return definition
    .replace(/온라인 플랫폼을 활용하여,\s*/g, '')
    .replace(/따위의 일련의 과정을\s*/g, '')
    .replace(/을 활용하여,\s*/g, '');
}

function removeAnswerWord(text, word) {
  return text.replace(new RegExp(escapeRegExp(word), 'g'), '').replace(/\s+/g, ' ').trim();
}

function polishClause(clause) {
  return clause
    .replace(/^의\s+/, '')
    .replace(/의 하나$/, '')
    .replace(/의 한$/, '')
    .replace(/이라고도 한다\.?$/, '')
    .replace(/라고도 한다\.?$/, '')
    .replace(/이라고 한다\.?$/, '')
    .replace(/라고 한다\.?$/, '')
    .replace(/[,.·]+$/, '')
    .trim();
}

function expandOneOfPattern(clause) {
  const oneMatch = clause.match(/^(.+?)의 하나\.?$/);
  if (oneMatch) return `${oneMatch[1]}에 속하는 종`;

  const hanMatch = clause.match(/^(.+?)의 한\.?$/);
  if (hanMatch) return `${hanMatch[1]}에 속하는 종`;

  return clause;
}

function isBrokenClue(clue) {
  if (/(?:것으|으로|하여|해서|이를|에서|에게|기획하|제작하|만들하|취재하|위치해|의하|강하|같)$/.test(clue)) {
    return true;
  }
  if (/[을를이가은는과와도에서로]$/.test(clue)) return true;
  if (/(?:한다|있다|된다)$/.test(clue)) return true;
  return false;
}

function finalizeClue(clue) {
  return clue
    .replace(/(?:한다|있다|된다|인다|온다|간다)$/, '')
    .replace(/[,.·]+$/, '')
    .trim();
}

function trimToLength(text, min, max) {
  let value = text.trim();
  if (value.length <= max) return finalizeClue(value);

  const particles = /[ ,.;·의을를이가은는과와도에서로]+$/;
  for (let i = max; i >= min; i--) {
    const candidate = finalizeClue(value.slice(0, i).replace(particles, '').trim());
    if (candidate.length >= min && candidate.length <= max) return candidate;
  }

  return finalizeClue(value.slice(0, max).replace(particles, '').trim());
}

function scoreClause(clause, categoryKey) {
  let score = 0;

  if (clause.length >= MIN_CLUE_LEN && clause.length <= MAX_CLUE_LEN) score += 20;
  else if (clause.length >= 8 && clause.length <= MAX_CLUE_LEN + 3) score += 8;
  else score -= 6;

  if (CATEGORY_HINTS[categoryKey]?.test(clause)) score += 10;
  if (CATEGORY_BONUS[categoryKey]?.test(clause)) score += 6;
  if (/[가-힣]+(과|목|류|동물|식물|과일|음식|현상)/.test(clause)) score += 6;
  if (/에 속하는 종$/.test(clause)) score += 8;
  if (/한다$|있다$/.test(clause)) score -= 5;

  return score;
}

function definitionToClue(definition, word, categoryKey) {
  const cleaned = cleanDefinition(definition);
  const sentences = cleaned
    .split(/[.。]/)
    .map((part) => polishClause(expandOneOfPattern(removeAnswerWord(part, word))))
    .filter((part) => part.length >= 4);

  const ranked = [...new Set(sentences)].sort(
    (a, b) => scoreClause(b, categoryKey) - scoreClause(a, categoryKey)
  );

  const candidates = [];
  for (const sentence of ranked) candidates.push(sentence);
  for (let i = 0; i < ranked.length - 1; i++) {
    candidates.push(`${ranked[i]} ${ranked[i + 1]}`);
  }
  candidates.push(expandOneOfPattern(polishClause(removeAnswerWord(cleaned, word))));

  for (const candidate of candidates) {
    const clue = trimToLength(candidate, MIN_CLUE_LEN, MAX_CLUE_LEN);
    if (
      clue.length >= MIN_CLUE_LEN &&
      clue.length <= MAX_CLUE_LEN &&
      !clue.includes(word) &&
      !isBrokenClue(clue)
    ) {
      return clue;
    }
  }

  const fallback = trimToLength(
    expandOneOfPattern(polishClause(removeAnswerWord(cleaned, word))),
    MIN_CLUE_LEN,
    MAX_CLUE_LEN
  );
  return fallback.length >= MIN_CLUE_LEN && !fallback.includes(word) ? fallback : null;
}

function loadEntries() {
  const source = fs.readFileSync(path.join(ROOT, 'data', 'categories.js'), 'utf8');
  // eslint-disable-next-line no-eval
  const CATEGORIES = eval(`${source}\n; CATEGORIES`);
  const entries = [];

  for (const [categoryKey, category] of Object.entries(CATEGORIES)) {
    for (const entry of category.words) {
      entries.push({ categoryKey, categoryName: category.name, ...entry });
    }
  }

  return entries;
}

function loadExistingClues() {
  const { FACTUAL_CLUES } = require('./factual-clues.js');
  return FACTUAL_CLUES;
}

function loadProgress() {
  if (!fs.existsSync(PROGRESS_PATH)) {
    return { results: {} };
  }
  return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf8');
}

function writeFactualClues(cluesByWord) {
  const entries = loadEntries();
  const lines = ['module.exports = {', '  FACTUAL_CLUES: {'];

  for (const entry of entries) {
    const clue = cluesByWord[entry.word];
    if (!clue) continue;
    lines.push(`    '${entry.word}': '${clue.replace(/'/g, "\\'")}',`);
  }

  lines.push('  },', '};', '');
  fs.writeFileSync(FACTUAL_PATH, lines.join('\n'), 'utf8');
}

async function main() {
  const reset = process.argv.includes('--reset');
  const testWord = process.argv.find((arg) => arg.startsWith('--test='))?.slice(7);
  const writeOnly = process.argv.includes('--write-only');

  const existing = loadExistingClues();
  const entries = loadEntries();
  const entryByWord = new Map(entries.map((entry) => [entry.word, entry]));
  const progress = reset ? { results: {} } : loadProgress();

  if (testWord) {
    const entry = entryByWord.get(testWord);
    const manual = MANUAL_CLUES[testWord];
    const lookup = manual
      ? { source: 'manual', form: testWord, definition: manual }
      : await lookupDefinition(testWord, entry?.categoryKey ?? 'nature');
    const clue = manual
      ? manual
      : lookup
        ? definitionToClue(lookup.definition, testWord, entry?.categoryKey ?? 'nature')
        : null;
    console.log(
      JSON.stringify(
        {
          category: entry?.categoryKey,
          lookup,
          clue,
          existing: existing[testWord],
        },
        null,
        2
      )
    );
    return;
  }

  if (process.argv.includes('--reprocess')) {
    const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
    const clues = {};

    for (const item of report) {
      const manual = MANUAL_CLUES[item.word];
      let clue = manual
        ? manual
        : item.definition
          ? definitionToClue(item.definition, item.word, item.categoryKey)
          : null;

      if (!clue || isBrokenClue(clue)) {
        clue = item.previousClue ?? existing[item.word] ?? clue;
      }

      item.clue = clue;
      item.changed = clue !== item.previousClue;
      clues[item.word] = clue;
    }

    writeFactualClues(clues);
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(`재처리 완료 · ${report.length}개`);
    return;
  }

  if (writeOnly) {
    const clues = {};
    for (const [word, item] of Object.entries(progress.results)) {
      clues[word] = item.clue || existing[word];
    }
    writeFactualClues(clues);
    console.log(`factual-clues.js 갱신: ${Object.keys(clues).length}개`);
    return;
  }

  const words = [...new Set(entries.map((entry) => entry.word))];
  const pending = words.filter((word) => !progress.results[word]);

  console.log(`사전 기반 단서 동기화 · ${words.length}개 · 남은 ${pending.length}개`);

  let index = words.length - pending.length;

  for (const word of pending) {
    index++;
    const entry = entryByWord.get(word);
    const previous = existing[word];
    process.stdout.write(`\r[${index}/${words.length}] ${word}                    `);

    try {
      const manual = MANUAL_CLUES[word];
      const lookup = manual
        ? { source: 'manual', form: word, definition: manual }
        : await lookupDefinition(word, entry.categoryKey);
      const clue = manual
        ? manual
        : lookup
          ? definitionToClue(lookup.definition, word, entry.categoryKey)
          : null;

      progress.results[word] = {
        word,
        categoryKey: entry.categoryKey,
        source: lookup?.source ?? 'missing',
        matchedForm: lookup?.form ?? null,
        definition: lookup?.definition ?? null,
        clue: clue ?? previous,
        previousClue: previous,
        changed: Boolean(clue && clue !== previous),
        generated: Boolean(clue),
      };
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

  const results = Object.values(progress.results);
  const generated = results.filter((item) => item.generated);
  const missing = results.filter((item) => item.source === 'missing');
  const changed = results.filter((item) => item.changed);

  console.log(`사전 단서 생성: ${generated.length}개`);
  console.log(`기존 단서 유지: ${results.length - generated.length}개`);
  console.log(`변경됨: ${changed.length}개`);
  console.log(`사전 미등재: ${missing.length}개`);

  const clues = {};
  for (const item of results) {
    clues[item.word] = item.clue;
  }
  writeFactualClues(clues);
  fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2), 'utf8');

  console.log(`\n${FACTUAL_PATH} 갱신 완료`);
  console.log(`리포트: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
