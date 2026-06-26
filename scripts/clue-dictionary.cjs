'use strict';

const https = require('https');

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

const MANUAL_CLUES = {
  홍로: '붉게 달아 익는 사과 품종',
  피칸: '피칸나무의 열매로, 견과류의 하나',
  망아지: '어린 말이라 부르는 동물',
  송아지: '어린 소라 부르는 동물',
  민물장어: '민물에 사는 장어류 고기',
  쭈꾸미: '작은 오징어과 연체동물',
  민물새우: '민물에 사는 작은 새우',
  수사슴: '뿔 달린 수컷 사슴',
  산고양이: '산에서 사는 고양잇과 동물',
  산양: '산에서 사는 뿔 달린 초식동물',
  민물게: '민물에 사는 작은 게',
  열무김치: '열무로 담근 여름 김치',
  배추김치: '배추로 담근 대표 김치',
  젓갈: '젓으로 담근 반찬 종류',
  콩나물무침: '콩나물을 무친 반찬',
  찐만두: '찜통에 찐 만두 요리',
  고추장볶음: '고추장에 볶은 요리',
  멸치젓: '멸치로 담근 젓갈',
  오징어젓: '오징어로 담근 젓갈',
  편육: '삶은 고기를 얇게 썬 음식',
  돈부리: '돼지고기를 얹은 덮밥',
  파구이: '파를 넣어 구운 요리',
  호박씨: '호박 열매 속의 씨',
  해바라기씨: '해바라기에서 나는 씨',
  건살구: '말려서 만든 살구 건과일',
  청밤: '아직 익지 않은 푸른 밤',
  청호두: '아직 덜 익은 푸른 호두',
  백체리: '흰색 과육의 체리 품종',
  왕밤: '알이 큰 밤나무 열매',
  건사과: '말려서 만든 사과 건과일',
  수박씨: '수박 속에 든 검은 씨',
  포도씨: '포도 알 속에 든 씨',
  참외씨: '참외 속에 든 씨앗',
  산딸: '산에서 나는 작은 딸기',
  야자: '열대 지방의 야자나무',
  성악가: '성악으로 노래하는 가수',
  위성: '행성 주위를 도는 천체',
  장미: '가시 달린 향기 나는 꽃',
  산파도: '바다에서 밀려오는 큰 파도',
  산모래: '바람에 날린 고운 모래',
  서해: '한반도 서쪽에 있는 바다',
  늪지: '물이 고인 습한 땅',
  결빙: '물이 얼어 꽁꽁 어는 현상',
  등압선: '기압이 같은 지점을 잇는 선',
};

const CATEGORY_HINTS = {
  animals: /동물|포유|조류|파충|양서|곤충|어류|갑각|과에|목에|류에|과의|설치|맹수|가축|야생/,
  food: /음식|요리|찌개|국수|국밥|반찬|먹|식품|볶|구이|튀김|밥|면|떡|탕|찜/,
  fruits: /과일|열매|나무|베리/,
  jobs: /직업|직원|전문|종사|하는 사람|사무|의사|교사|간호|변호|설계|개발|상담|안내|방송|출판|디자인/,
  nature: /현상|지형|지역|하늘|바다|산|강|숲|구름|비|눈|바람|지표|암석|식물|풀|날씨/,
};

const CATEGORY_NEGATIVE = {
  animals: /술|소주|음식|요리|건물|질병/,
  food: /동물|식물학|질병|병원/,
  fruits: /술|소주|화로|질병|병원|건물/,
  jobs: /동물|식물|지형|술$/,
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
    let disMatch;
    while ((disMatch = disRe.exec(block)) !== null) {
      const def = stripHtml(disMatch[1]);
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

function wordToClue(word, categoryKey, lookup) {
  const manual = MANUAL_CLUES[word];
  if (manual) return manual;
  if (!lookup) return null;
  return definitionToClue(lookup.definition, word, categoryKey);
}

function isValidClue(clue, word) {
  return (
    clue &&
    clue.length >= MIN_CLUE_LEN &&
    clue.length <= MAX_CLUE_LEN &&
    !clue.includes(word) &&
    !isBrokenClue(clue)
  );
}

module.exports = {
  MIN_CLUE_LEN,
  MAX_CLUE_LEN,
  MANUAL_CLUES,
  sleep,
  lookupDefinition,
  definitionToClue,
  wordToClue,
  isBrokenClue,
  isValidClue,
};
