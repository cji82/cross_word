const HANGUL_SYLLABLE_RE = /^[\uAC00-\uD7A3]$/;
const MIN_QUIZ_SYLLABLES = 2;

function splitSyllables(text) {
  if (!text) return [];

  const normalized = String(text).normalize('NFC');

  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
    return [...segmenter.segment(normalized)].map((part) => part.segment);
  }

  return [...normalized];
}

function normalizeWord(text) {
  return splitSyllables(text).join('');
}

function syllableCount(text) {
  return splitSyllables(text).length;
}

function isCompleteSyllable(ch) {
  return HANGUL_SYLLABLE_RE.test(ch);
}

function isValidQuizWord(text) {
  return syllableCount(text) >= MIN_QUIZ_SYLLABLES;
}

function normalizeWordEntry(entry) {
  const syllables = splitSyllables(entry.word);
  return {
    ...entry,
    word: syllables.join(''),
    syllables,
  };
}

function enrichWordEntry(entry) {
  const normalized = normalizeWordEntry(entry);
  return {
    ...normalized,
    syllableSet: new Set(normalized.syllables),
  };
}
