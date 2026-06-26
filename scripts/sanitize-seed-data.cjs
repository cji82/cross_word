'use strict';

const fs = require('fs');
const path = require('path');

const SEED_DIR = path.join(__dirname, 'seed-data');
const CATEGORY_KEYS = ['animals', 'food', 'fruits', 'jobs', 'nature'];

const KEEP_COLOR_WORDS = new Set([
  '흰수염고래', '흰꼬리수리', '흰동가리', '붉은발새매', '흰뺨검둥오리', '흰두루미',
  '검은독수리', '붉은털원숭이', '홍학', '홍로', '홍시', '단감', '황도복숭아', '백도복숭아',
  '청귤', '황금향', '백자몽', '홍매실', '청매실', '홍사과', '청사과',
]);

function isBadSeedWord(word) {
  if (KEEP_COLOR_WORDS.has(word)) return false;
  if (/류$/.test(word) && !['석류', '조류', '해류', '기류', '성류'].includes(word)) return true;
  if (/^(북극|남극|동쪽|서쪽|남쪽|북쪽|산|바다|강|호수)(해류|조류|바람|안개)/.test(word)) return true;
  if (/^(청|홍|황|백|흑|금|왕|미니)(사과|배|포도|복숭아|자두|귤|감|망고|바나나|키위|석류|무화과|용과|멜론|수박|참외)/.test(word)) {
    return true;
  }
  if (/^(흰|검은|붉은|푸른)(고래|돌고래|상어|가오리|거북|도마뱀|개구리|두꺼비|독수리|매|수리|부엉이|올빼미|참새|제비|갈매기|기러기|오리|거위|사자|호랑이|표범|치타|늑대|여우|곰|사슴|영양|염소|양|말|당나귀|낙타|코끼리|기린|코뿔소|하마|다람쥐|햄스터|수달|물개|바다사자|펭귄|메기|붕어|잉어|연어|참치|문어|오징어|낙지|주꾸미|새우|게|비버|너구리|오소리|족제비|멧돼지|토끼|앵무새|딱따구리|까마귀|까치|비둘기|황새|두루미)$/.test(word)) {
    return true;
  }
  if (/^(김치|된장|고추장|청국장|순두부|두부|콩비지|감자|고구마|호박|버섯)(볶음|조림|구이|찜|전|튀김|탕|죽|덮밥|비빔밥|국수|샐러드)$/.test(word)) {
    return true;
  }
  if (/^(쇠|멧|큰|작은|검은|붉은|흰|노란|회색)(박새|부엉이|올빼미|독수리|매|수리|참새|제비|갈매기|기러기|오리|거위|백조|칠면조|메추리|공작|앵무새|잉꼬|카나리아|참매|황조롱이|딱따구리|벌새|플라밍고|가마우지|펠리컨|알바트로스|홍학|따오기|두견이|꾀꼬리|직박구리|섬새|진박새|딱새|울새|뻐꾸기|까마귀|까치|비둘기|황새|두루미|원앙|청둥오리|물총새|고니|왜가리|재갈매기|제비|기러기|돌고래|상어|가오리|거북|메기|붕어|잉어|연어|참치|문어|오징어|낙지|새우|게|박쥐|다람쥐|캥거루|원숭이|고양이|개|돼지|소|말|토끼|여우|늑대|곰|사자|호랑이|표범|치타|사슴|영양|염소|양|코끼리|기린|코뿔소|하마|펭귄|물개|바다사자|돌고래|고래|혹등고래|밍크고래)$/.test(word)) {
    return true;
  }
  return false;
}

function sanitizeFile(categoryKey) {
  const filePath = path.join(SEED_DIR, `${categoryKey}.js`);
  const words = require(filePath);
  const additional = require('./seed-data/additional.cjs')[categoryKey] || [];
  const cleaned = [];

  for (const word of [...words, ...additional]) {
    if (!/^[가-힣]{2,8}$/.test(word)) continue;
    if (isBadSeedWord(word)) continue;
    if (!cleaned.includes(word)) cleaned.push(word);
  }

  const lines = ["'use strict';", '', 'module.exports = ['];
  for (const word of cleaned) {
    lines.push(`  '${word}',`);
  }
  lines.push('];', '');
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  return cleaned.length;
}

for (const key of CATEGORY_KEYS) {
  const count = sanitizeFile(key);
  console.log(`${key}: ${count}개`);
}
