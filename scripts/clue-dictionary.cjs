'use strict';

const https = require('https');

const MIN_CLUE_LEN = 10;
const MAX_CLUE_LEN = 36;
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
  참기름: '참깨를 볶아 짠 고소한 기름',
  결명자차: '볶은 결명자를 넣고 끓인 차',
  계란빵: '밀가루에 달걀을 넣고 찐 빵',
  고춧가루: '붉은 고추를 말려 빻은 가루',
  김치국: '김치로 끓여 만든 국',
  소시지: '고기를 양념해 창자에 넣은 음식',
  어묵: '생선살을 다져 뭉친 가공 식품',
  위스키: '곡물을 발효해 증류한 술',
  파김치: '파로 담근 김치',
  개구리참외: '성환 일대에서 재배하는 참외 품종',
  참제비: '집에서 사는 제비를 뜻하는 말',
  동박새: '도서 지방에 서식하는 작은 새',
  바지락: '사할린 등지에 분포하는 조개',
  비단뱀: '작은 동물이나 새를 잡아먹는 뱀',
  쇠오리: '하천과 호수에 사는 오리',
  야생동물: '자연에서 스스로 사는 동물',
  야크: '히말라야에 사는 털이 긴 소',
  진돗개: '전남 진도에서 기르는 우리나 개',
  호박벌: '호박 꽃가루를 모으는 벌',
  골수박: '해골을 수박에 비유해 부르는 말',
  귤빛부전나비: '한국과 일본에 분포하는 나비',
  긴잎산딸기: '장미과 낙엽 활엽 관목',
  매실차: '매실 가루를 꿀에 타 마시는 차',
  브라질너트: '아마존 유역에서 나는 큰 나무',
  황밤: '말려 껍질과 보늬를 벗긴 밤',
  강사: '학교나 학원에서 가르치는 사람',
  경비하다: '도난이나 침략을 막아 지키다',
  교사자: '남을 꾀어 나쁜 일을 하게 하는 사람',
  시스템분석가: '시스템 설계를 위해 문제를 분석하는 사람',
  중등교사: '중학교나 고등학교에서 가르치는 교사',
  고개: '산과 산 사이를 넘는 길목',
  내권: '혼인하여 남자의 짝이 된 여자',
  반사성운: '별빛을 반사해 밝게 보이는 구름',
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
            const chunks = [];
            res.on('data', (chunk) => {
              chunks.push(chunk);
            });
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
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

const COMPLETE_CLUE_ENDING =
  /(?:다|임|함|됨|종|물|새|풀|나무|과일|음식|요리|반찬|국수|찌개|구이|볶음|조림|전골|덮밥|찜|탕|죽|밥|면|떡|젓갈|김치|튀김|전|사람|직업|담당|전문가|기술자|의사|간호사|변호사|교사|군인|선원|조종사|미용사|요리사|제빵사|바리스타|셰프|감독|배우|가수|작가|화가|교수|연구원|과학자|엔지니어|개발자|디자이너|마케터|상담사|복지사|코치|심판|약사|사서|안내원|가이드|은행원|공무원|외교관|아나운서|진행자|성우|모델|조각가|현상|지형|암석|광물|식물|바람|비|눈|구름|번개|천둥|무지개|태양|위성|별|새벽|황혼|일출|일몰|강|산|숲|바다|호수|연못|폭포|동굴|사막|빙하|화산|지진|해일|조수|해류|몬순|우박|뇌우|이슬|서리|안개|소나기|장마|태풍|폭풍|계절|기후|기온|기압|습도|지평선|해안선|퇴적층|화강암|현무암|간헐천|열대림|원시림|습지|늪지|간석지|자갈밭|암초|설원|눈사태|침엽수|낙엽수|교목|관목|여러해살이풀|한해살이풀|바닷물고기|민물고기|포유류|설치류|맹금류|갑각류|연체동물|파충류|양서류|곤충|조류|어류|품종|천연기념물|국립공원|의 종류|의 하나|을 뜻|를 뜻|으로 불|으로 알|으로 쓰|에 속하는 종|에 사는|을 키우|를 먹|을 만|를 만)$/;

function isBrokenClue(clue) {
  if (!clue) return true;
  if (/(?:것으|으로|하여|해서|이를|에게|기획하|제작하|만들하|취재하|위치해|의하|강하|같)$/.test(clue)) {
    return true;
  }
  if (/[을를이가은는과와도에서로]$/.test(clue)) return true;
  if (/(?:한다|있다|된다)$/.test(clue)) return true;
  return false;
}

function isTruncatedClue(clue) {
  if (!clue || isBrokenClue(clue)) return true;
  if (
    /(?:이르|통틀|통하|위하|대하|관하|따라|부터|까지|사이에|안에|밖에|속에|위한|있는|없는|하는|되는|인한|라고|이라|라는|입은|위해|통해|대해|관해|따른|과의|를 통|을 통|에 있|에 속|에 사|에 흐|에 내|에 분|에 형|에 만|에 일|에 피|에 솟|으로 이|으로 굳|으로 만|으로 보|으로 나|으로 쌓|으로 흐|으로 밝|의 바|의 네|의 세|비슷한데|같은데|여러|많이|작고|크고|길고)$/.test(
      clue
    )
  ) {
    return true;
  }
  if (/통틀어?\s*이르/.test(clue) && !/이르는/.test(clue)) return true;
  if (/[은는이가]\s*\d+$/.test(clue)) return true;
  if (/\d$/.test(clue) && clue.length >= 18) return true;
  if (clue.length >= 35 && !COMPLETE_CLUE_ENDING.test(clue)) return true;
  return false;
}

function sanitizeClueText(clue) {
  return String(clue)
    .normalize('NFC')
    .replace(/\uFFFD/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCorruptedClue(clue) {
  return /\uFFFD/.test(clue);
}

function sliceClueText(text, maxLen) {
  return [...String(text).normalize('NFC')].slice(0, maxLen).join('');
}

function rewriteDictionaryPatterns(clause, categoryKey) {
  let text = clause
    .replace(/[을를] 통틀어 이르는 말\.?$/, '의 종류')
    .replace(/을 일상적으로 이르는 말\.?$/, '을 뜻하는 말')
    .replace(/를 일상적으로 이르는 말\.?$/, '를 뜻하는 말')
    .replace(/이라고도 한다\.?$/, '')
    .replace(/라고도 한다\.?$/, '')
    .replace(/우리나라 천연기념물이다\.?/, '천연기념물로 지정된 종')
    .replace(/국립 공원의 하나이다\.?/, '국립공원으로 지정된 산')
    .replace(/한 해의 네 철 가운데 (?:첫째|둘째|셋째|넷째) 철\.?/, (match) => {
      if (match.includes('첫째')) return '봄부터 시작하는 네 계절 중 첫째';
      if (match.includes('둘째')) return '여름에 해당하는 네 계절 중 둘째';
      if (match.includes('셋째')) return '가을에 해당하는 네 계절 중 셋째';
      return '겨울에 해당하는 네 계절 중 넷째';
    });

  if (categoryKey === 'animals') {
    text = text
      .replace(/([가-힣]+)과의 바닷물고기/, '$1과 바닷물고기')
      .replace(/([가-힣]+)과의 민물고기/, '$1과 민물고기')
      .replace(/([가-힣]+)과의 곤충/, '$1과 곤충')
      .replace(/([가-힣]+)과의 새/, '$1과 새')
      .replace(/([가-힣]+)과에 속하는 종/, '$1과 동물');
  }

  if (categoryKey === 'nature') {
    text = text
      .replace(/([가-힣]+)과의 (여러해살이풀|한해살이풀|낙엽 교목|상록 교목|활엽 관목)/, '$1과 $2')
      .replace(/([가-힣]+)뭇과의/, '$1나무과의');
  }

  return text.replace(/\s+/g, ' ').trim();
}

function finalizeClue(clue) {
  return clue
    .replace(/(?:한다|있다|된다|인다|온다|간다)$/, '')
    .replace(/[,.·]+$/, '')
    .trim();
}

function trimToLength(text, min, max) {
  const value = sanitizeClueText(text);
  if (!value) return null;

  if (value.length <= max) {
    const clipped = finalizeClue(value);
    return clipped.length >= min && !isTruncatedClue(clipped) ? clipped : null;
  }

  for (const piece of value.split(/[，,;·]/).map((part) => part.trim()).filter(Boolean)) {
    if (piece.length > max) continue;
    const clipped = finalizeClue(piece);
    if (clipped.length >= min && !isTruncatedClue(clipped)) return clipped;
  }

  const particles = /[ ,.;·의을를이가은는과와도에서로에게]+$/;
  for (let i = max; i >= min; i--) {
    const candidate = finalizeClue(sliceClueText(value, i).replace(particles, '').trim());
    if (candidate.length >= min && candidate.length <= max && !isTruncatedClue(candidate)) {
      return candidate;
    }
  }

  return null;
}

function scoreClause(clause, categoryKey) {
  let score = 0;

  if (clause.length >= MIN_CLUE_LEN && clause.length <= MAX_CLUE_LEN) score += 20;
  else if (clause.length >= 8 && clause.length <= MAX_CLUE_LEN + 3) score += 4;
  else score -= 6;

  if (clause.length >= 12 && clause.length <= 28) score += 12;
  if (clause.length >= 32) score -= 10;

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
    .map((part) =>
      rewriteDictionaryPatterns(
        polishClause(expandOneOfPattern(removeAnswerWord(part, word))),
        categoryKey
      )
    )
    .filter((part) => part.length >= 4);

  const ranked = [...new Set(sentences)].sort(
    (a, b) => scoreClause(b, categoryKey) - scoreClause(a, categoryKey)
  );

  const candidates = [];
  for (const sentence of ranked) candidates.push(sentence);
  for (let i = 0; i < ranked.length - 1; i++) {
    candidates.push(`${ranked[i]} ${ranked[i + 1]}`);
  }
  candidates.push(
    rewriteDictionaryPatterns(
      expandOneOfPattern(polishClause(removeAnswerWord(cleaned, word))),
      categoryKey
    )
  );

  const ordered = [
    ...candidates.filter((text) => text.length <= MAX_CLUE_LEN),
    ...candidates.filter((text) => text.length > MAX_CLUE_LEN),
  ];

  for (const candidate of ordered) {
    const clue =
      candidate.length <= MAX_CLUE_LEN
        ? finalizeClue(candidate)
        : trimToLength(candidate, MIN_CLUE_LEN, MAX_CLUE_LEN);
    if (
      clue &&
      clue.length >= MIN_CLUE_LEN &&
      clue.length <= MAX_CLUE_LEN &&
      !clue.includes(word) &&
      !isTruncatedClue(clue)
    ) {
      return clue;
    }
  }

  return null;
}

function wordToClue(word, categoryKey, lookup) {
  const manual = MANUAL_CLUES[word];
  if (manual) return manual;
  if (!lookup) return null;
  return definitionToClue(lookup.definition, word, categoryKey);
}

function isValidClue(clue, word) {
  const text = sanitizeClueText(clue);
  return (
    text &&
    !isCorruptedClue(text) &&
    text.length >= MIN_CLUE_LEN &&
    text.length <= MAX_CLUE_LEN &&
    !text.includes(word) &&
    !isTruncatedClue(text)
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
  isTruncatedClue,
  isCorruptedClue,
  sanitizeClueText,
  isValidClue,
};
