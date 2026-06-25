const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isExactStdictHit(html, word) {
  const countMatch = html.match(/찾기 결과 \(총\s+(\d+)\s*개\)/);
  if (!countMatch) return false;
  if (Number(countMatch[1]) === 0) return false;
  const escaped = escapeRegExp(word);
  return new RegExp(
    `class=["']t_blue1["']>\\s*${escaped}(?:<sup>\\d+<\\/sup>)?<\\/a>[^「]{0,240}「`
  ).test(html);
}

function fetchSearch(word) {
  return new Promise((resolve, reject) => {
    https
      .get(
        `https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=${encodeURIComponent(word)}`,
        { agent },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve(data));
        }
      )
      .on('error', reject);
  });
}

(async () => {
  const words = ['고양이', '유튜버', '분지', '골드바', '구렁이', '라면', '개발자', '하우스딸기'];
  for (const word of words) {
    const html = await fetchSearch(word);
    console.log(word, isExactStdictHit(html, word));
  }
})();
