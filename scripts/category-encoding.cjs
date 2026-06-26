'use strict';

const fs = require('fs');

const ENC_KEY = 'cw2026:hangul-xword';

function xorBuffer(buffer, key) {
  const keyBuf = Buffer.from(key, 'utf8');
  const out = Buffer.alloc(buffer.length);
  for (let i = 0; i < buffer.length; i += 1) {
    out[i] = buffer[i] ^ keyBuf[i % keyBuf.length];
  }
  return out;
}

function encodeCategories(data) {
  const json = JSON.stringify(data);
  return xorBuffer(Buffer.from(json, 'utf8'), ENC_KEY).toString('base64');
}

function decodeCategories(payload) {
  const decoded = xorBuffer(Buffer.from(payload, 'base64'), ENC_KEY);
  return JSON.parse(decoded.toString('utf8'));
}

function loadCategoriesFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(/const\s+__CW\s*=\s*['"]([^'"]+)['"]/);
  if (!match) {
    throw new Error(`encoded payload not found: ${filePath}`);
  }
  return decodeCategories(match[1]);
}

module.exports = {
  encodeCategories,
  decodeCategories,
  loadCategoriesFile,
};
