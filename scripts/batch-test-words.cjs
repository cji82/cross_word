const { execSync } = require('child_process');
const path = require('path');

const script = path.join(__dirname, 'validate-stdict.cjs');

function test(word) {
  try {
    const out = execSync(`node "${script}" --test=${word}`, { encoding: 'utf8' });
    return JSON.parse(out.trim()).status;
  } catch {
    return 'error';
  }
}

const candidates = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['파파야', '별과', '치자', '산사', '월귤'];

for (const word of candidates) {
  console.log(`${word}\t${test(word)}`);
}
