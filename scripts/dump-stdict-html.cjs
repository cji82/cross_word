const fs = require('fs');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });
const word = process.argv[2] || '고양이';

https.get(
  `https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=${encodeURIComponent(word)}`,
  { agent },
  (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => {
      fs.writeFileSync('scripts/stdict-sample.html', data, 'utf8');
      const snippets = [];
      let idx = 0;
      while ((idx = data.indexOf(word, idx)) !== -1) {
        snippets.push(data.slice(Math.max(0, idx - 40), idx + 80));
        idx += word.length;
      }
      console.log('matches', snippets.length);
      snippets.slice(0, 5).forEach((s, i) => console.log(`---${i}---\n${s}`));
    });
  }
);
