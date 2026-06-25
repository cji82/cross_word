const MAX_GRID_SIZE = 30;
const MIN_GRID_SIZE = 9;
const MAX_PUZZLE_DIMENSION = 13;
const MAX_GENERATE_ATTEMPTS = 48;
const PLACEMENT_PASSES = 8;
const RECENT_WORD_LIMIT = 50;
const RECENT_START_LIMIT = 30;
const ALL_CATEGORY_KEY = 'all';

const categoryWordCache = new Map();
const recentWordsByCategory = new Map();
const recentStartsByCategory = new Map();

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createEmptyGrid(size) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function getSyllables(entry) {
  return entry.syllables ?? splitSyllables(entry.word);
}

function canPlace(grid, syllables, row, col, dir) {
  const size = grid.length;
  const len = syllables.length;
  const dr = dir === 'across' ? 0 : 1;
  const dc = dir === 'across' ? 1 : 0;

  const endRow = row + dr * (len - 1);
  const endCol = col + dc * (len - 1);
  if (endRow < 0 || endCol < 0 || endRow >= size || endCol >= size) return false;

  const beforeR = row - dr;
  const beforeC = col - dc;
  if (beforeR >= 0 && beforeC >= 0 && grid[beforeR][beforeC] !== null) return false;

  const afterR = endRow + dr;
  const afterC = endCol + dc;
  if (afterR < size && afterC < size && grid[afterR][afterC] !== null) return false;

  for (let i = 0; i < len; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const cell = grid[r][c];
    const ch = syllables[i];

    if (cell !== null && cell !== ch) return false;

    if (cell === null) {
      if (dir === 'across') {
        if (r > 0 && grid[r - 1][c] !== null) return false;
        if (r < size - 1 && grid[r + 1][c] !== null) return false;
      } else {
        if (c > 0 && grid[r][c - 1] !== null) return false;
        if (c < size - 1 && grid[r][c + 1] !== null) return false;
      }
    }
  }

  return true;
}

function placeWord(grid, syllables, row, col, dir) {
  const dr = dir === 'across' ? 0 : 1;
  const dc = dir === 'across' ? 1 : 0;
  for (let i = 0; i < syllables.length; i++) {
    grid[row + dr * i][col + dc * i] = syllables[i];
  }
}

function buildCharIndex(grid) {
  const index = new Map();
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const ch = grid[r][c];
      if (ch === null) continue;
      if (!index.has(ch)) index.set(ch, []);
      index.get(ch).push(r, c);
    }
  }
  return index;
}

function findPlacements(grid, syllables) {
  const index = buildCharIndex(grid);
  const placements = [];
  const seen = new Set();

  const tryAdd = (row, col, dir) => {
    const key = `${row},${col},${dir}`;
    if (seen.has(key)) return;
    if (!canPlace(grid, syllables, row, col, dir)) return;
    seen.add(key);
    placements.push({ row, col, dir });
  };

  for (let i = 0; i < syllables.length; i++) {
    const positions = index.get(syllables[i]);
    if (!positions) continue;

    for (let p = 0; p < positions.length; p += 2) {
      const r = positions[p];
      const c = positions[p + 1];
      tryAdd(r, c - i, 'across');
      tryAdd(r - i, c, 'down');
    }
  }

  return placements;
}

function getBounds(grid) {
  let minR = grid.length;
  let minC = grid[0].length;
  let maxR = 0;
  let maxC = 0;
  let filled = 0;

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === null) continue;
      filled++;
      minR = Math.min(minR, r);
      minC = Math.min(minC, c);
      maxR = Math.max(maxR, r);
      maxC = Math.max(maxC, c);
    }
  }

  if (filled === 0) return { rows: 0, cols: 0, filled: 0 };

  return {
    rows: maxR - minR + 1,
    cols: maxC - minC + 1,
    filled,
  };
}

function estimateBoundsAfterPlace(grid, syllables, pick) {
  const dr = pick.dir === 'across' ? 0 : 1;
  const dc = pick.dir === 'across' ? 1 : 0;
  let minR = grid.length;
  let minC = grid[0].length;
  let maxR = 0;
  let maxC = 0;

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === null) continue;
      minR = Math.min(minR, r);
      minC = Math.min(minC, c);
      maxR = Math.max(maxR, r);
      maxC = Math.max(maxC, c);
    }
  }

  for (let i = 0; i < syllables.length; i++) {
    const r = pick.row + dr * i;
    const c = pick.col + dc * i;
    minR = Math.min(minR, r);
    minC = Math.min(minC, c);
    maxR = Math.max(maxR, r);
    maxC = Math.max(maxC, c);
  }

  if (maxR < minR) return 0;
  return (maxR - minR + 1) * (maxC - minC + 1);
}

function countCrossings(grid, syllables, pick) {
  const dr = pick.dir === 'across' ? 0 : 1;
  const dc = pick.dir === 'across' ? 1 : 0;
  let crosses = 0;

  for (let i = 0; i < syllables.length; i++) {
    if (grid[pick.row + dr * i][pick.col + dc * i] !== null) crosses++;
  }

  return crosses;
}

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

function scorePlacementOption(grid, syllables, pick) {
  const area = estimateBoundsAfterPlace(grid, syllables, pick);
  const crosses = countCrossings(grid, syllables, pick);
  const center = Math.floor(grid.length / 2);
  const dist = Math.abs(pick.row - center) + Math.abs(pick.col - center);
  return crosses * 25 - area * 3 - dist * 0.1;
}

function pickPlacementWithLookahead(grid, syllables, placements, upcoming) {
  if (placements.length === 0) return null;
  if (placements.length === 1) return placements[0];

  const ranked = [...placements].sort(
    (a, b) => scorePlacementOption(grid, syllables, b) - scorePlacementOption(grid, syllables, a)
  );
  const sample = ranked.slice(0, Math.min(6, ranked.length));

  let bestPick = sample[0];
  let bestFuture = -1;

  for (const pick of sample) {
    const trial = cloneGrid(grid);
    placeWord(trial, syllables, pick.row, pick.col, pick.dir);

    let future = 0;
    for (const entry of upcoming.slice(0, 10)) {
      if (findPlacements(trial, entry.syllables).length > 0) future++;
    }

    const score = future * 12 + scorePlacementOption(grid, syllables, pick);
    if (score > bestFuture) {
      bestFuture = score;
      bestPick = pick;
    }
  }

  return bestPick;
}

function pickBestPlacement(grid, syllables, placements) {
  if (placements.length === 0) return null;
  if (placements.length === 1) return placements[0];

  const sample =
    placements.length <= 12 ? placements : shuffle(placements).slice(0, 12);

  let best = sample[0];
  let bestScore = -Infinity;

  for (const pick of sample) {
    const score = scorePlacementOption(grid, syllables, pick);
    if (score > bestScore) {
      bestScore = score;
      best = pick;
    }
  }

  return best;
}

function trimGrid(grid) {
  let minR = grid.length;
  let minC = grid[0].length;
  let maxR = 0;
  let maxC = 0;

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== null) {
        minR = Math.min(minR, r);
        minC = Math.min(minC, c);
        maxR = Math.max(maxR, r);
        maxC = Math.max(maxC, c);
      }
    }
  }

  if (maxR < minR) return { cells: [], rows: 0, cols: 0 };

  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;
  const cells = Array.from({ length: rows }, (_, ri) =>
    Array.from({ length: cols }, (_, ci) => grid[minR + ri][minC + ci])
  );

  return { cells, rows, cols, offsetR: minR, offsetC: minC };
}

function buildClueMap(placedEntries) {
  const map = new Map();
  for (const entry of placedEntries) {
    map.set(entry.word, entry.clue);
  }
  return map;
}

function collectWords(grid, clueMap) {
  const rows = grid.length;
  const cols = grid[0].length;
  const across = [];
  const down = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === null) continue;

      const startsAcross =
        (c === 0 || grid[r][c - 1] === null) &&
        c + 1 < cols &&
        grid[r][c + 1] !== null;

      const startsDown =
        (r === 0 || grid[r - 1][c] === null) &&
        r + 1 < rows &&
        grid[r + 1][c] !== null;

      if (startsAcross) {
        let word = '';
        let cc = c;
        while (cc < cols && grid[r][cc] !== null) {
          word += grid[r][cc];
          cc++;
        }
        if (word.length >= 2) {
          across.push({ row: r, col: c, word, clue: clueMap.get(word) ?? word });
        }
      }

      if (startsDown) {
        let word = '';
        let rr = r;
        while (rr < rows && grid[rr][c] !== null) {
          word += grid[rr][c];
          rr++;
        }
        if (word.length >= 2) {
          down.push({ row: r, col: c, word, clue: clueMap.get(word) ?? word });
        }
      }
    }
  }

  return { across, down };
}

function assignNumbers(across, down) {
  const all = [
    ...across.map((w) => ({ ...w, dir: 'across' })),
    ...down.map((w) => ({ ...w, dir: 'down' })),
  ];

  all.sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col));

  const numberMap = new Map();
  let num = 1;

  for (const item of all) {
    const key = `${item.row},${item.col}`;
    if (!numberMap.has(key)) {
      numberMap.set(key, num++);
    }
    item.number = numberMap.get(key);
  }

  const numberedAcross = across
    .map((w) => ({ ...w, number: numberMap.get(`${w.row},${w.col}`) }))
    .sort((a, b) => a.number - b.number);

  const numberedDown = down
    .map((w) => ({ ...w, number: numberMap.get(`${w.row},${w.col}`) }))
    .sort((a, b) => a.number - b.number);

  return { across: numberedAcross, down: numberedDown, numberMap };
}

function sharedCharCount(a, b) {
  const setA = a.syllableSet;
  const setB = b.syllableSet;
  let count = 0;
  for (const ch of setA) {
    if (setB.has(ch)) count++;
  }
  return count;
}

function wordsConnect(a, b) {
  return sharedCharCount(a, b) > 0;
}

function getRecentWords(categoryKey) {
  if (!recentWordsByCategory.has(categoryKey)) {
    recentWordsByCategory.set(categoryKey, []);
  }
  return recentWordsByCategory.get(categoryKey);
}

function recordUsedWords(categoryKey, words) {
  const recent = getRecentWords(categoryKey);
  const incoming = words.map((w) => (typeof w === 'string' ? w : w.word));
  const merged = [...incoming, ...recent.filter((w) => !incoming.includes(w))];
  recentWordsByCategory.set(categoryKey, merged.slice(0, RECENT_WORD_LIMIT));
}

function getRecentStarts(categoryKey) {
  if (!recentStartsByCategory.has(categoryKey)) {
    recentStartsByCategory.set(categoryKey, []);
  }
  return recentStartsByCategory.get(categoryKey);
}

function recordStartWord(categoryKey, word) {
  if (!word) return;
  const recent = getRecentStarts(categoryKey);
  recentStartsByCategory.set(
    categoryKey,
    [word, ...recent.filter((w) => w !== word)].slice(0, RECENT_START_LIMIT)
  );
}

function pickRandomStartWord(allWords, categoryKey) {
  const recent = new Set(getRecentWords(categoryKey));
  const recentStarts = new Set(getRecentStarts(categoryKey));

  const ranked = shuffle(allWords).map((entry) => {
    let score = Math.random() * 10;
    if (recentStarts.has(entry.word)) score -= 25;
    if (recent.has(entry.word)) score -= 12;
    return { entry, score };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked[0].entry;
}

function buildWordPool(allWords, count, categoryKey) {
  const target = Math.min(count, allWords.length);
  const recent = new Set(getRecentWords(categoryKey));
  const startWord = pickRandomStartWord(allWords, categoryKey);
  let cluster = buildClusterFromSeed(startWord, allWords, target, recent);

  if (cluster.length < target) {
    const used = new Set(cluster.map((w) => w.word));
    const extras = shuffle(allWords.filter((w) => !used.has(w.word)));
    cluster = [...cluster, ...extras.slice(0, target - cluster.length)];
  }

  return {
    words: shuffle(cluster),
    startWord: startWord.word,
  };
}

function buildClusterFromSeed(seed, allWords, target, recentSet) {
  const cluster = [seed];
  const used = new Set([seed.word]);
  const pool = allWords.filter((w) => !used.has(w.word));

  while (cluster.length < target && pool.length > 0) {
    const candidates = pool.filter((w) => cluster.some((c) => wordsConnect(c, w)));
    if (candidates.length === 0) break;

    const ranked = candidates.map((candidate) => {
      let score = 0;
      for (const placed of cluster) {
        score += sharedCharCount(placed, candidate);
      }
      score += candidate.syllables.length * 0.1;
      if (recentSet.has(candidate.word)) score -= 8;
      score += Math.random() * 2.5;
      return { candidate, score };
    });

    ranked.sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, Math.min(8, ranked.length));
    const pick = top[(Math.random() * top.length) | 0].candidate;

    cluster.push(pick);
    used.add(pick.word);
    const idx = pool.indexOf(pick);
    pool[idx] = pool[pool.length - 1];
    pool.pop();
  }

  return cluster;
}

function orderWordsByConstraint(wordEntries, grid, placedEntries) {
  const placedSet = new Set(placedEntries.map((entry) => entry.word));
  const remaining = wordEntries.filter((entry) => !placedSet.has(entry.word));

  return remaining
    .map((entry) => ({
      entry,
      options: findPlacements(grid, entry.syllables).length,
    }))
    .sort((a, b) => {
      if (a.options === 0 && b.options === 0) return 0;
      if (a.options === 0) return 1;
      if (b.options === 0) return -1;
      if (a.options !== b.options) return a.options - b.options;
      const connA = placedEntries.reduce((sum, placed) => sum + sharedCharCount(placed, a.entry), 0);
      const connB = placedEntries.reduce((sum, placed) => sum + sharedCharCount(placed, b.entry), 0);
      if (connB !== connA) return connB - connA;
      return b.entry.syllables.length - a.entry.syllables.length;
    })
    .map((item) => item.entry);
}

function getPlacementGoals(requestedCount) {
  const minAcceptable = Math.max(4, Math.ceil(requestedCount * 0.45));
  const minPlaced = Math.max(5, Math.ceil(requestedCount * 0.85));
  const targetPlaced = requestedCount;
  return { minAcceptable, minPlaced, targetPlaced, requestedCount };
}

function isValidResult(trimmed, placed, minRequired) {
  if (placed.length < minRequired) return false;
  if (trimmed.rows > MAX_PUZZLE_DIMENSION || trimmed.cols > MAX_PUZZLE_DIMENSION) {
    return false;
  }

  const clueMap = buildClueMap(placed);
  const { across, down } = collectWords(trimmed.cells, clueMap);
  const clueCount = across.length + down.length;
  return clueCount >= 4;
}

function orderWordsForPlacement(wordEntries) {
  return [...wordEntries].sort((a, b) => b.syllables.length - a.syllables.length);
}

function countFilledCells(cells) {
  let filled = 0;
  for (const row of cells) {
    for (const cell of row) {
      if (cell !== null) filled++;
    }
  }
  return filled;
}

function padGridToMinSize(cells, minSize) {
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  if (rows >= minSize && cols >= minSize) {
    return { cells, offsetR: 0, offsetC: 0, rows, cols };
  }

  const targetRows = Math.max(rows, minSize);
  const targetCols = Math.max(cols, minSize);
  const top = Math.floor((targetRows - rows) / 2);
  const left = Math.floor((targetCols - cols) / 2);
  const padded = Array.from({ length: targetRows }, () =>
    Array.from({ length: targetCols }, () => null)
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      padded[r + top][c + left] = cells[r][c];
    }
  }

  return { cells: padded, offsetR: top, offsetC: left, rows: targetRows, cols: targetCols };
}

function puzzleSizePenalty(rows, cols) {
  const maxDim = Math.max(rows, cols);
  const overDim = Math.max(0, maxDim - MAX_PUZZLE_DIMENSION);
  const overMin = Math.max(0, maxDim - MIN_GRID_SIZE);
  return overDim * 400 + rows * cols * 3 + overMin * 25;
}

function scoreResult(result, goals) {
  const { placed, trimmed } = result;
  const placedRatio = placed.length / goals.requestedCount;
  const targetGap = Math.max(0, goals.targetPlaced - placed.length);

  return (
    placed.length * 500 +
    placedRatio * 200 -
    targetGap * 120 -
    puzzleSizePenalty(trimmed.rows, trimmed.cols)
  );
}

function tryGreedyPlacement(words, goals, startWord) {
  const grid = createEmptyGrid(MAX_GRID_SIZE);
  const placed = [];
  const center = Math.floor(MAX_GRID_SIZE / 2);
  const first =
    words.find((w) => w.word === startWord) ?? words[(Math.random() * words.length) | 0];
  const rest = shuffle(words.filter((w) => w.word !== first.word));
  const firstSyllables = first.syllables;
  const firstDir = Math.random() < 0.5 ? 'across' : 'down';
  const firstRow =
    firstDir === 'across' ? center : center - Math.floor(firstSyllables.length / 2);
  const firstCol =
    firstDir === 'across' ? center - Math.floor(firstSyllables.length / 2) : center;

  placeWord(grid, firstSyllables, firstRow, firstCol, firstDir);
  placed.push({ ...first, row: firstRow, col: firstCol, dir: firstDir });

  const tryPlaceList = (list, useLookahead) => {
    const ordered = orderWordsByConstraint(list, grid, placed);

    for (let i = 0; i < ordered.length; i++) {
      const entry = ordered[i];
      if (placed.some((p) => p.word === entry.word)) continue;

      const placements = findPlacements(grid, entry.syllables);
      const upcoming = ordered.slice(i + 1);
      const pick = useLookahead
        ? pickPlacementWithLookahead(grid, entry.syllables, placements, upcoming)
        : pickBestPlacement(grid, entry.syllables, placements);
      if (!pick) continue;

      placeWord(grid, entry.syllables, pick.row, pick.col, pick.dir);
      placed.push({ ...entry, ...pick });
    }
  };

  for (let pass = 0; pass < PLACEMENT_PASSES; pass++) {
    tryPlaceList(pass === 0 ? rest : shuffle(rest), pass >= 2);
  }

  const trimmed = trimGrid(grid);
  if (!isValidResult(trimmed, placed, goals.minAcceptable)) return null;

  return { placed, trimmed };
}

function finalizeGrid(result) {
  const padded = padGridToMinSize(result.trimmed.cells, MIN_GRID_SIZE);
  return {
    ...result,
    trimmed: {
      cells: padded.cells,
      rows: padded.rows,
      cols: padded.cols,
      offsetR: padded.offsetR,
      offsetC: padded.offsetC,
    },
    offsetR: padded.offsetR,
    offsetC: padded.offsetC,
  };
}

function buildPuzzleResult(result) {
  const finalized = finalizeGrid(result);
  const clueMap = buildClueMap(finalized.placed);
  const { across, down } = collectWords(finalized.trimmed.cells, clueMap);
  const numbered = assignNumbers(across, down);

  return {
    grid: finalized.trimmed.cells,
    rows: finalized.trimmed.rows,
    cols: finalized.trimmed.cols,
    across: numbered.across,
    down: numbered.down,
    numberMap: numbered.numberMap,
    placedCount: finalized.placed.length,
    totalRequested: finalized.placed.length,
  };
}

function pickStartCandidates(normalized, startWord, limit = 8) {
  const all = normalized.map((entry) => entry.word);
  const ordered = startWord
    ? [startWord, ...shuffle(all.filter((w) => w !== startWord))]
    : shuffle(all);
  return [...new Set(ordered)].slice(0, limit);
}

function tryGenerateWithStart(normalized, goals, requestedCount, startWord) {
  let bestResult = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt++) {
    const ordered = shuffle(orderWordsForPlacement(normalized));
    const result = tryGreedyPlacement(ordered, goals, startWord);
    if (!result) continue;

    const score = scoreResult(result, goals);
    if (score > bestScore) {
      bestScore = score;
      bestResult = result;
    }
  }

  if (!bestResult || bestResult.placed.length < goals.minPlaced) return null;

  const puzzle = buildPuzzleResult(bestResult);
  puzzle.totalRequested = requestedCount ?? normalized.length;
  return puzzle;
}

function scoreBuiltPuzzle(puzzle, goals) {
  const placedRatio = puzzle.placedCount / goals.requestedCount;
  const targetGap = Math.max(0, goals.targetPlaced - puzzle.placedCount);

  return (
    puzzle.placedCount * 500 +
    placedRatio * 200 -
    targetGap * 120 -
    puzzleSizePenalty(puzzle.rows, puzzle.cols)
  );
}

function generateCrossword(wordEntries, requestedCount, startWord) {
  const normalized = wordEntries.map((entry) =>
    entry.syllables ? entry : enrichWordEntry(entry)
  );
  const goals = getPlacementGoals(requestedCount ?? normalized.length);
  const starts = pickStartCandidates(normalized, startWord, 10);
  let bestPuzzle = null;
  let bestScore = -Infinity;

  for (const start of starts) {
    const puzzle = tryGenerateWithStart(normalized, goals, requestedCount, start);
    if (!puzzle) continue;

    const score = scoreBuiltPuzzle(puzzle, goals);
    if (score > bestScore) {
      bestScore = score;
      bestPuzzle = puzzle;
    }

    if (puzzle.placedCount >= goals.targetPlaced) {
      return puzzle;
    }
  }

  return bestPuzzle;
}

function getCategoryDisplayName(categoryKey) {
  if (categoryKey === ALL_CATEGORY_KEY) return '전체';
  return CATEGORIES[categoryKey]?.name ?? '';
}

function getEligibleWords(categoryKey) {
  if (categoryKey === ALL_CATEGORY_KEY) {
    if (!categoryWordCache.has(ALL_CATEGORY_KEY)) {
      const seen = new Set();
      const merged = [];

      Object.values(CATEGORIES).forEach((category) => {
        category.words.forEach((raw) => {
          const entry = enrichWordEntry(raw);
          if (!isValidQuizWord(entry.word) || seen.has(entry.word)) return;
          seen.add(entry.word);
          merged.push(entry);
        });
      });

      categoryWordCache.set(ALL_CATEGORY_KEY, merged);
    }
    return categoryWordCache.get(ALL_CATEGORY_KEY);
  }

  if (!categoryWordCache.has(categoryKey)) {
    const category = CATEGORIES[categoryKey];
    if (!category) return [];
    categoryWordCache.set(
      categoryKey,
      category.words.map(enrichWordEntry).filter((entry) => isValidQuizWord(entry.word))
    );
  }
  return categoryWordCache.get(categoryKey);
}

function pickRandomWords(categoryKey, count) {
  const eligible = getEligibleWords(categoryKey);
  if (eligible.length === 0) return { words: [], startWord: null };
  const poolSize = Math.min(eligible.length, count + 24);
  return buildWordPool(eligible, poolSize, categoryKey);
}

function rememberPuzzleWords(categoryKey, puzzle, startWord) {
  const words = new Set();
  puzzle.across.forEach((item) => words.add(item.word));
  puzzle.down.forEach((item) => words.add(item.word));
  recordUsedWords(categoryKey, [...words]);
  recordStartWord(categoryKey, startWord);
}
