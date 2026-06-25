const categorySelect = document.getElementById('category');
const wordCountInput = document.getElementById('wordCount');
const wordCountLabel = document.getElementById('wordCountLabel');
const generateBtn = document.getElementById('generateBtn');
const recordsBtn = document.getElementById('recordsBtn');
const emptyState = document.getElementById('emptyState');
const puzzleArea = document.getElementById('puzzleArea');
const puzzleTimerBar = document.getElementById('puzzleTimerBar');
const gameStartOverlay = document.getElementById('gameStartOverlay');
const gameResultBar = document.getElementById('gameResultBar');
const startGameBtn = document.getElementById('startGameBtn');
const replayGameBtn = document.getElementById('replayGameBtn');
const resultTitle = document.getElementById('resultTitle');
const resultCategory = document.getElementById('resultCategory');
const resultTime = document.getElementById('resultTime');
const resultAccuracy = document.getElementById('resultAccuracy');
const resultScore = document.getElementById('resultScore');
const recordsModal = document.getElementById('recordsModal');
const closeRecordsBtn = document.getElementById('closeRecordsBtn');
const recordsList = document.getElementById('recordsList');
const recordsEmpty = document.getElementById('recordsEmpty');
const timerText = document.getElementById('timerText');
const gridEl = document.getElementById('grid');
const acrossClues = document.getElementById('acrossClues');
const downClues = document.getElementById('downClues');
const acrossCount = document.getElementById('acrossCount');
const downCount = document.getElementById('downCount');
const statusText = document.getElementById('statusText');
const puzzleToast = document.getElementById('puzzleToast');
const gridWrap = document.querySelector('.grid-wrap');
const wordInputBar = document.getElementById('wordInputBar');
const wordInput = document.getElementById('wordInput');
const wordInputHint = document.getElementById('wordInputHint');

let toastTimer = null;

let currentPuzzle = null;
let currentCategoryKey = null;
let currentWordCount = 0;
let checked = false;
let gameState = 'idle';
let timerStartMs = null;
let elapsedMs = 0;
let timerInterval = null;
let solveTimeMs = null;
let lastAccuracy = null;
let activeDirection = 'across';
let wordMaps = null;
let currentClue = null;
let selectionRow = null;
let selectionCol = null;
let wordInputComposing = false;

const RECORDS_STORAGE_KEY = 'crossword-game-records';
const MAX_RECORDS = 50;

function canPlay() {
  return gameState === 'playing' && !checked;
}

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function updateTimerDisplay() {
  const ms = gameState === 'playing' && timerStartMs ? Date.now() - timerStartMs : elapsedMs;
  timerText.textContent = formatDuration(ms);
}

function showTimer(show) {
  puzzleTimerBar.classList.toggle('hidden', !show);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (gameState === 'playing' && timerStartMs) {
    elapsedMs = Date.now() - timerStartMs;
  }
}

function startTimer() {
  stopTimer();
  timerStartMs = Date.now();
  elapsedMs = 0;
  solveTimeMs = null;
  lastAccuracy = null;
  gameState = 'playing';
  showTimer(true);
  updateTimerDisplay();
  timerInterval = setInterval(updateTimerDisplay, 250);
}

function resetGameSession() {
  stopTimer();
  gameState = 'idle';
  timerStartMs = null;
  elapsedMs = 0;
  solveTimeMs = null;
  lastAccuracy = null;
  showTimer(false);
  timerText.textContent = '00:00';
}

function showGameOverlay(show) {
  gameStartOverlay.classList.toggle('hidden', !show);
}

function showResultBar(show) {
  gameResultBar.classList.toggle('hidden', !show);
}

function showGameResult({ categoryName, timeStr, accuracy, correct, total, perfect, wrongCount }) {
  resultTitle.textContent = perfect
    ? '완벽하게 맞혔어요!'
    : wrongCount > 0
      ? `게임 결과 · 오답 ${wrongCount}칸`
      : '게임 결과';
  resultCategory.textContent = categoryName;
  resultTime.textContent = timeStr;
  resultAccuracy.textContent = `${accuracy}%`;
  resultScore.textContent = `${correct}/${total}`;
  gameResultBar.classList.toggle('game-result-bar--perfect', perfect);
  showResultBar(true);
}

function formatRecordDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function loadGameRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGameRecord(record) {
  const records = loadGameRecords();
  records.unshift(record);
  if (records.length > MAX_RECORDS) records.length = MAX_RECORDS;
  localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
}

function renderRecordsList() {
  const records = loadGameRecords();
  recordsList.innerHTML = '';

  if (records.length === 0) {
    recordsEmpty.classList.remove('hidden');
    return;
  }

  recordsEmpty.classList.add('hidden');

  records.forEach((record) => {
    const item = document.createElement('article');
    item.className = 'records-item';
    const accuracyClass =
      record.accuracy === 100
        ? 'records-item-accuracy records-item-accuracy--perfect'
        : 'records-item-accuracy';
    item.innerHTML = `
      <p class="records-item-line">
        ${record.categoryName}
        · ${formatDuration(record.solveTimeMs)}
        · <span class="${accuracyClass}">${record.accuracy}%</span> (${record.correct}/${record.total})
        · ${record.gridLabel}
        · ${record.placedCount}단어
        · ${formatRecordDate(record.playedAt)}
      </p>
    `;
    recordsList.appendChild(item);
  });
}

function openRecordsModal() {
  renderRecordsList();
  recordsModal.classList.remove('hidden');
}

function closeRecordsModal() {
  recordsModal.classList.add('hidden');
}

function clearUserAnswers() {
  getCellInputs().forEach((input) => {
    input.value = '';
  });
  clearCheckMarks();
}

function replayGame() {
  if (!currentPuzzle) return;

  showResultBar(false);
  hidePuzzleToast();
  checked = false;
  clearUserAnswers();
  dismissWordInput();
  setWordInputEnabled(true);
  resetGameSession();
  gameState = 'ready';
  showGameOverlay(true);

  const catName = currentCategoryKey ? getCategoryDisplayName(currentCategoryKey) : '';
  setStatus(
    `${catName} · ${currentPuzzle.rows}×${currentPuzzle.cols} · ${currentPuzzle.placedCount}/${currentWordCount}단어 · 게임 시작을 눌러주세요`
  );
}

function isPuzzleComplete() {
  const inputs = getCellInputs();
  return inputs.length > 0 && inputs.every((input) => input.value.trim() !== '');
}

function onCellsChanged() {
  if (!canPlay()) return;
  if (isPuzzleComplete()) {
    finishGame();
  }
}

function startGame() {
  if (!currentPuzzle || gameState !== 'ready') return;
  showGameOverlay(false);
  dismissWordInput();
  startTimer();
  setStatus('풀이 중…');
}

function finishGame() {
  if (!currentPuzzle || checked || gameState !== 'playing') return;
  stopTimer();
  solveTimeMs = elapsedMs;
  gameState = 'finished';
  checkAnswers();
}

function buildWordMaps(puzzle) {
  const acrossMap = new Map();
  const downMap = new Map();

  puzzle.across.forEach((item) => {
    splitSyllables(item.word).forEach((_, i) => {
      acrossMap.set(`${item.row},${item.col + i}`, item);
    });
  });

  puzzle.down.forEach((item) => {
    splitSyllables(item.word).forEach((_, i) => {
      downMap.set(`${item.row + i},${item.col}`, item);
    });
  });

  return { acrossMap, downMap };
}

function getCellEl(row, col) {
  return gridEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

function getInputAt(row, col) {
  const cell = getCellEl(row, col);
  return cell?.querySelector('.cell-input') ?? null;
}

function getClueCells(clue, dir) {
  return splitSyllables(clue.word).map((_, i) => ({
    row: dir === 'across' ? clue.row : clue.row + i,
    col: dir === 'across' ? clue.col + i : clue.col,
  }));
}

function readWordFromCells(clue, dir) {
  return getClueCells(clue, dir)
    .map(({ row, col }) => getInputAt(row, col)?.value ?? '')
    .join('');
}

function fillWordCells(clue, dir, text) {
  const cells = getClueCells(clue, dir);
  const syllables = splitSyllables(text);

  cells.forEach(({ row, col }, i) => {
    const input = getInputAt(row, col);
    if (!input) return;
    const ch = syllables[i] ?? '';
    input.value = ch && isCompleteSyllable(ch) ? ch : '';
  });
}

function showWordInputBar(show) {
  wordInputBar.classList.toggle('hidden', !show);
  if (!show) {
    wordInputBar.style.removeProperty('left');
    wordInputBar.style.removeProperty('top');
    wordInputBar.style.removeProperty('visibility');
  }
}

function getWordBoundsInStage(clue, dir) {
  const cells = getClueCells(clue, dir);
  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;

  cells.forEach(({ row, col }) => {
    const cell = getCellEl(row, col);
    if (!cell) return;
    minLeft = Math.min(minLeft, cell.offsetLeft);
    minTop = Math.min(minTop, cell.offsetTop);
    maxRight = Math.max(maxRight, cell.offsetLeft + cell.offsetWidth);
    maxBottom = Math.max(maxBottom, cell.offsetTop + cell.offsetHeight);
  });

  if (!Number.isFinite(minLeft)) return null;

  return {
    left: minLeft,
    top: minTop,
    width: maxRight - minLeft,
    height: maxBottom - minTop,
    right: maxRight,
    bottom: maxBottom,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function positionWordInputBar() {
  if (!currentClue || !canPlay() || wordInputBar.classList.contains('hidden')) return;

  const stage = gridEl.parentElement;
  if (!stage) return;

  const bounds = getWordBoundsInStage(currentClue, activeDirection);
  if (!bounds) return;

  wordInputBar.style.visibility = 'hidden';

  const pad = 6;
  const gap = 5;
  const stageW = stage.offsetWidth;
  const stageH = stage.offsetHeight;
  const barW = wordInputBar.offsetWidth;
  const barH = wordInputBar.offsetHeight;

  let left;
  let top;

  if (activeDirection === 'across') {
    left = bounds.left + bounds.width / 2 - barW / 2;
    top = bounds.bottom + gap;
    if (top + barH > stageH - pad) {
      top = bounds.top - barH - gap;
    }
  } else {
    left = bounds.right + gap;
    top = bounds.top + bounds.height / 2 - barH / 2;
    if (left + barW > stageW - pad) {
      left = bounds.left - barW - gap;
    }
    if (left < pad) {
      left = bounds.left + bounds.width / 2 - barW / 2;
      top = bounds.bottom + gap;
      if (top + barH > stageH - pad) {
        top = bounds.top - barH - gap;
      }
    }
  }

  left = clamp(left, pad, Math.max(pad, stageW - barW - pad));
  top = clamp(top, pad, Math.max(pad, stageH - barH - pad));

  wordInputBar.style.left = `${left}px`;
  wordInputBar.style.top = `${top}px`;
  wordInputBar.style.visibility = '';
}

function scheduleWordInputPosition() {
  requestAnimationFrame(() => {
    positionWordInputBar();
  });
}

function updateWordInputHint() {
  if (!currentClue) {
    wordInputHint.textContent = '';
    return;
  }
  const dirLabel = activeDirection === 'across' ? '가로' : '세로';
  wordInputHint.textContent = `${dirLabel} · ${currentClue.number}번`;
}

function syncWordInputFromCells() {
  if (!currentClue) {
    wordInput.value = '';
    return;
  }
  wordInput.value = readWordFromCells(currentClue, activeDirection);
}

function applyWordInputToCells() {
  if (!currentClue || !canPlay()) return;
  fillWordCells(currentClue, activeDirection, wordInput.value);
  onCellsChanged();
}

function focusWordInput() {
  if (!canPlay() || !currentClue) return;
  showWordInputBar(true);
  syncWordInputFromCells();
  updateWordInputHint();
  scheduleWordInputPosition();
  wordInput.focus();
  wordInput.select();
}

function setWordInputEnabled(enabled) {
  wordInput.disabled = !enabled;
  if (!enabled) {
    wordInput.blur();
    showWordInputBar(false);
  }
}

function stepFocus(row, col, dRow, dCol) {
  const nextRow = row + dRow;
  const nextCol = col + dCol;
  const input = getInputAt(nextRow, nextCol);
  if (!input) return;

  updateSelection(nextRow, nextCol, dRow !== 0 ? 'down' : dCol !== 0 ? 'across' : undefined);
  focusWordInput();
}

function stepAlongActiveWord(forward) {
  if (selectionRow === null || selectionCol === null) return;
  const dRow = activeDirection === 'across' ? 0 : forward ? 1 : -1;
  const dCol = activeDirection === 'across' ? (forward ? 1 : -1) : 0;
  stepFocus(selectionRow, selectionCol, dRow, dCol);
}

function clearWrongReviewMarks() {
  gridEl.classList.remove('grid--review');
  puzzleArea.classList.remove('puzzle-area--review');
  gridEl.querySelectorAll('.cell-wrong-overlay').forEach((el) => el.remove());
  getCellInputs().forEach((input) => {
    delete input.dataset.userAnswer;
  });
}

function clearCheckMarks() {
  clearWrongReviewMarks();
  gridEl.querySelectorAll('.cell--wrong, .cell--correct, .cell--empty').forEach((el) => {
    el.classList.remove('cell--wrong', 'cell--correct', 'cell--empty');
  });
  acrossClues.querySelectorAll('.clue--wrong').forEach((el) => el.classList.remove('clue--wrong'));
  downClues.querySelectorAll('.clue--wrong').forEach((el) => el.classList.remove('clue--wrong'));
}

function clearHighlights() {
  gridEl.querySelectorAll('.cell--in-word').forEach((el) => el.classList.remove('cell--in-word'));
  gridEl.querySelectorAll('.cell--focused').forEach((el) => el.classList.remove('cell--focused'));
  acrossClues.querySelectorAll('.clue--active').forEach((el) => el.classList.remove('clue--active'));
  downClues.querySelectorAll('.clue--active').forEach((el) => el.classList.remove('clue--active'));
}

function highlightClue(clue, dir) {
  if (!clue) return;
  const list = dir === 'across' ? acrossClues : downClues;
  const li = list.querySelector(`[data-number="${clue.number}"]`);
  if (li) {
    li.classList.add('clue--active');
    li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function highlightWord(clue, dir) {
  if (!clue) return;
  splitSyllables(clue.word).forEach((_, i) => {
    const r = dir === 'across' ? clue.row : clue.row + i;
    const c = dir === 'across' ? clue.col + i : clue.col;
    getCellEl(r, c)?.classList.add('cell--in-word');
  });
}

function getClueStartingAt(row, col, dir) {
  if (!currentPuzzle) return null;
  const list = dir === 'across' ? currentPuzzle.across : currentPuzzle.down;
  return list.find((item) => item.row === row && item.col === col) ?? null;
}

function getClueAt(row, col, dir) {
  if (!wordMaps) return null;
  const key = `${row},${col}`;
  return dir === 'across' ? wordMaps.acrossMap.get(key) : wordMaps.downMap.get(key);
}

function dismissWordInput() {
  wordInput.blur();
  showWordInputBar(false);
  clearHighlights();
  currentClue = null;
  selectionRow = null;
  selectionCol = null;
}

function updateSelection(row, col, dirOverride) {
  if (!wordMaps) return;

  const startAcross = getClueStartingAt(row, col, 'across');
  const startDown = getClueStartingAt(row, col, 'down');
  const acrossClue = getClueAt(row, col, 'across');
  const downClue = getClueAt(row, col, 'down');

  if (dirOverride) {
    activeDirection = dirOverride;
  } else if (startAcross && !startDown) {
    activeDirection = 'across';
  } else if (!startAcross && startDown) {
    activeDirection = 'down';
  } else if (startAcross && startDown) {
    if (activeDirection !== 'across' && activeDirection !== 'down') {
      activeDirection = 'across';
    }
  } else if (acrossClue && !downClue) {
    activeDirection = 'across';
  } else if (!acrossClue && downClue) {
    activeDirection = 'down';
  }

  let clue =
    getClueStartingAt(row, col, activeDirection) ?? getClueAt(row, col, activeDirection);

  if (!clue) {
    activeDirection = acrossClue ? 'across' : 'down';
    clue = acrossClue ?? downClue;
  }

  currentClue = clue;
  selectionRow = row;
  selectionCol = col;

  clearHighlights();
  getCellEl(row, col)?.classList.add('cell--focused');
  highlightWord(clue, activeDirection);
  highlightClue(clue, activeDirection);

  if (canPlay()) {
    showWordInputBar(!!clue);
    syncWordInputFromCells();
    updateWordInputHint();
    if (clue) scheduleWordInputPosition();
  }
}

function selectClue(row, col, dir) {
  updateSelection(row, col, dir);
  focusWordInput();
}

function selectClueByNumber(row, col, number) {
  const startAcross = getClueStartingAt(row, col, 'across');
  const startDown = getClueStartingAt(row, col, 'down');
  let dir;

  if (startAcross?.number === number && startDown?.number === number) {
    dir = activeDirection === 'down' ? 'down' : 'across';
  } else if (startDown?.number === number) {
    dir = 'down';
  } else if (startAcross?.number === number) {
    dir = 'across';
  } else {
    const across = currentPuzzle.across.find((item) => item.number === number);
    const down = currentPuzzle.down.find((item) => item.number === number);
    if (down && down.row === row && down.col === col) dir = 'down';
    else if (across && across.row === row && across.col === col) dir = 'across';
    else dir = down ? 'down' : 'across';
  }

  selectClue(row, col, dir);
}

function toggleDirection(row, col) {
  const startAcross = getClueStartingAt(row, col, 'across');
  const startDown = getClueStartingAt(row, col, 'down');
  if (!startAcross || !startDown) return;
  updateSelection(row, col, activeDirection === 'across' ? 'down' : 'across');
  focusWordInput();
}

function moveSelection(row, col, dir) {
  stepFocus(row, col, dir === 'down' ? 1 : dir === 'up' ? -1 : 0, dir === 'right' ? 1 : dir === 'left' ? -1 : 0);
}

function initCategories() {
  const allOpt = document.createElement('option');
  allOpt.value = ALL_CATEGORY_KEY;
  allOpt.textContent = '전체';
  categorySelect.appendChild(allOpt);

  Object.entries(CATEGORIES).forEach(([key, cat]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = cat.name;
    categorySelect.appendChild(opt);
  });
}

function setStatus(msg) {
  statusText.textContent = msg;
}

function hidePuzzleToast() {
  clearTimeout(toastTimer);
  puzzleToast.classList.add('hidden');
  puzzleToast.classList.remove('puzzle-toast--success', 'puzzle-toast--warn');
}

function showPuzzleToast(message, variant = 'info') {
  puzzleToast.textContent = message;
  puzzleToast.classList.remove('hidden', 'puzzle-toast--success', 'puzzle-toast--warn');
  if (variant === 'success') puzzleToast.classList.add('puzzle-toast--success');
  if (variant === 'warn') puzzleToast.classList.add('puzzle-toast--warn');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(hidePuzzleToast, 4200);
}

function syncCluesLayout() {
  const gridWrap = document.querySelector('.grid-wrap');
  const cluesEl = document.querySelector('.clues');
  if (!gridWrap || !cluesEl || puzzleArea.classList.contains('hidden')) return;

  if (window.innerWidth < 860) {
    cluesEl.classList.remove('clues--split');
    puzzleArea.classList.remove('puzzle-area--clues-split');
    cluesEl.style.removeProperty('--clues-max-height');
    return;
  }

  const gridHeight = gridWrap.offsetHeight;
  cluesEl.classList.remove('clues--split');
  puzzleArea.classList.remove('puzzle-area--clues-split');
  cluesEl.style.removeProperty('--clues-max-height');

  const stackedHeight = cluesEl.scrollHeight;
  const shouldSplit = stackedHeight > gridHeight;

  cluesEl.style.setProperty('--clues-max-height', `${gridHeight}px`);

  if (shouldSplit) {
    cluesEl.classList.add('clues--split');
    puzzleArea.classList.add('puzzle-area--clues-split');
  }
}

function buildNumberGrid(puzzle) {
  const { rows, cols, numberMap } = puzzle;
  const nums = Array.from({ length: rows }, () => Array(cols).fill(null));

  for (const [key, num] of numberMap.entries()) {
    const [r, c] = key.split(',').map(Number);
    nums[r][c] = num;
  }
  return nums;
}

function fitGridToContainer(puzzle) {
  if (!gridWrap || !puzzle) return;

  const maxDim = Math.max(puzzle.rows, puzzle.cols);
  const areaWidth = puzzleArea.clientWidth > 0 ? puzzleArea.clientWidth : window.innerWidth - 40;
  const availableW = Math.min(areaWidth, 560) - 24;
  const sizeByWidth = Math.floor((availableW - maxDim * 2) / maxDim);
  const size = Math.min(42, Math.max(22, sizeByWidth));

  gridEl.style.setProperty('--cell-size', `${size}px`);
  gridEl.style.setProperty('--grid-cols', String(puzzle.cols));
  gridEl.style.setProperty('--grid-rows', String(puzzle.rows));
}

function renderGrid(puzzle, showAnswers) {
  const { grid, rows, cols } = puzzle;
  const numbers = buildNumberGrid(puzzle);

  gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  gridEl.innerHTML = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c];
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      if (ch === null) {
        cell.classList.add('cell--block');
      } else {
        cell.classList.add('cell--active');
        const num = numbers[r][c];
        if (num !== null) {
          const numEl = document.createElement('span');
          numEl.className = 'cell-number';
          numEl.textContent = num;
          numEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!canPlay()) return;
            selectClueByNumber(r, c, num);
          });
          cell.appendChild(numEl);
        }

        const letter = document.createElement('span');
        letter.className = 'cell-letter';
        letter.textContent = showAnswers ? ch : '';
        cell.appendChild(letter);

        if (!showAnswers) {
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'cell-input';
          input.lang = 'ko';
          input.tabIndex = -1;
          input.readOnly = true;
          input.setAttribute('aria-hidden', 'true');
          input.dataset.answer = ch;
          cell.appendChild(input);

          cell.addEventListener('click', () => {
            if (!canPlay()) return;
            selectClue(r, c);
          });
        }
      }

      gridEl.appendChild(cell);
    }
  }

  requestAnimationFrame(() => {
    fitGridToContainer(puzzle);
    syncCluesLayout();
    scheduleWordInputPosition();
  });
}

function renderClues(puzzle) {
  acrossClues.innerHTML = '';
  downClues.innerHTML = '';

  puzzle.across.forEach((item) => {
    const li = document.createElement('li');
    li.dataset.number = item.number;
    li.dataset.dir = 'across';
    li.innerHTML = `<span class="clue-num">${item.number}</span><span class="clue-text">${item.clue}</span>`;
    li.title = '';
    li.addEventListener('click', () => {
      if (!canPlay()) return;
      selectClue(item.row, item.col, 'across');
    });
    acrossClues.appendChild(li);
  });

  puzzle.down.forEach((item) => {
    const li = document.createElement('li');
    li.dataset.number = item.number;
    li.dataset.dir = 'down';
    li.innerHTML = `<span class="clue-num">${item.number}</span><span class="clue-text">${item.clue}</span>`;
    li.title = '';
    li.addEventListener('click', () => {
      if (!canPlay()) return;
      selectClue(item.row, item.col, 'down');
    });
    downClues.appendChild(li);
  });

  acrossCount.textContent = puzzle.across.length;
  downCount.textContent = puzzle.down.length;
  requestAnimationFrame(syncCluesLayout);
}

function getCellInputs() {
  return [...gridEl.querySelectorAll('.cell-input')];
}

function setupWordInput() {
  wordInput.addEventListener('compositionstart', () => {
    wordInputComposing = true;
  });

  wordInput.addEventListener('compositionend', () => {
    wordInputComposing = false;
    applyWordInputToCells();
  });

  wordInput.addEventListener('input', () => {
    if (wordInputComposing) return;
    applyWordInputToCells();
  });

  wordInput.addEventListener('keydown', (e) => {
    if (!canPlay() || selectionRow === null || selectionCol === null) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      dismissWordInput();
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      toggleDirection(selectionRow, selectionCol);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      stepAlongActiveWord(true);
      return;
    }

    const arrowMap = {
      ArrowRight: 'right',
      ArrowLeft: 'left',
      ArrowDown: 'down',
      ArrowUp: 'up',
    };

    if (arrowMap[e.key]) {
      e.preventDefault();
      moveSelection(selectionRow, selectionCol, arrowMap[e.key]);
    }
  });

  document.addEventListener('pointerdown', (e) => {
    if (!canPlay() || wordInputBar.classList.contains('hidden')) return;

    const target = e.target;
    if (wordInputBar.contains(target)) return;
    if (target.closest('.cell--active')) return;
    if (target.closest('.clue-list li')) return;

    dismissWordInput();
  });
}

const MAX_PUZZLE_ROUNDS = 50;

function generatePuzzle() {
  const categoryKey = categorySelect.value;
  const count = Number(wordCountInput.value);

  generateBtn.disabled = true;
  setStatus('퍼즐 생성 중...');

  requestAnimationFrame(() => {
    let puzzle = null;
    let usedStartWord = null;

    for (let round = 0; round < MAX_PUZZLE_ROUNDS; round++) {
      const { words, startWord } = pickRandomWords(categoryKey, count);

      if (words.length < 6) {
        generateBtn.disabled = false;
        setStatus('단어가 부족합니다. 다른 카테고리를 선택해주세요.');
        return;
      }

      if (round > 0) {
        setStatus(`퍼즐 재배치 중... (${round + 1}회)`);
      }

      puzzle = generateCrossword(words, count, startWord);
      if (puzzle) {
        usedStartWord = startWord;
        break;
      }
    }

    generateBtn.disabled = false;

    if (!puzzle) {
      setStatus('배치에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    currentPuzzle = puzzle;
    currentCategoryKey = categoryKey;
    currentWordCount = count;
    checked = false;
    resetGameSession();
    gameState = 'ready';
    emptyState.classList.add('hidden');
    puzzleArea.classList.remove('hidden');
    showGameOverlay(true);
    showResultBar(false);

    renderGrid(puzzle, false);
    renderClues(puzzle);
    wordMaps = buildWordMaps(puzzle);
    activeDirection = 'across';
    currentClue = null;
    selectionRow = null;
    selectionCol = null;
    wordInput.value = '';
    setWordInputEnabled(true);
    dismissWordInput();
    rememberPuzzleWords(categoryKey, puzzle, usedStartWord);

    const catName = getCategoryDisplayName(categoryKey);
    setStatus(
      `${catName} · ${puzzle.rows}×${puzzle.cols} · ${puzzle.placedCount}/${count}단어 · 게임 시작을 눌러주세요`
    );
  });
}

function applyWrongReviewMarks() {
  const wrongInputs = getCellInputs().filter((input) =>
    input.closest('.cell')?.classList.contains('cell--wrong')
  );
  if (wrongInputs.length === 0) return;

  wrongInputs.forEach((input) => {
    const cell = input.closest('.cell');
    if (!cell) return;

    const user = input.dataset.userAnswer ?? '';
    const answer = input.dataset.answer;
    input.value = answer;

    const overlay = document.createElement('div');
    overlay.className = 'cell-wrong-overlay';
    overlay.setAttribute('role', 'note');

    if (user && user !== answer) {
      overlay.innerHTML = `
        <span class="cell-wrong-label">입력</span>
        <span class="cell-wrong-user">${user}</span>
        <span class="cell-wrong-arrow">→</span>
        <span class="cell-wrong-answer">${answer}</span>
      `;
    } else {
      overlay.innerHTML = `
        <span class="cell-wrong-label">빈칸</span>
        <span class="cell-wrong-arrow">→</span>
        <span class="cell-wrong-answer">${answer}</span>
      `;
    }

    cell.appendChild(overlay);
  });

  gridEl.classList.add('grid--review');
  puzzleArea.classList.add('puzzle-area--review');
}

function markWrongClues() {
  const markList = (items, dir) => {
    const list = dir === 'across' ? acrossClues : downClues;
    items.forEach((item) => {
      let hasWrong = false;
      splitSyllables(item.word).forEach((_, i) => {
        const r = dir === 'across' ? item.row : item.row + i;
        const c = dir === 'across' ? item.col + i : item.col;
        const cell = getCellEl(r, c);
        if (cell?.classList.contains('cell--wrong') || cell?.classList.contains('cell--empty')) {
          hasWrong = true;
        }
      });
      if (hasWrong) {
        list.querySelector(`[data-number="${item.number}"]`)?.classList.add('clue--wrong');
      }
    });
  };

  markList(currentPuzzle.across, 'across');
  markList(currentPuzzle.down, 'down');
}

function checkAnswers() {
  if (!currentPuzzle || checked) return;

  let correct = 0;
  let wrong = 0;
  let empty = 0;
  const total = getCellInputs().length;

  clearHighlights();
  clearCheckMarks();
  dismissWordInput();

  getCellInputs().forEach((input) => {
    const cell = input.closest('.cell');
    const answer = input.dataset.answer;
    const user = input.value.trim();

    if (!user) {
      cell.classList.add('cell--wrong', 'cell--empty');
      input.dataset.userAnswer = '';
      empty++;
      wrong++;
    } else if (user === answer) {
      cell.classList.add('cell--correct');
      correct++;
    } else {
      cell.classList.add('cell--wrong');
      input.dataset.userAnswer = user;
      wrong++;
    }
  });

  checked = true;
  setWordInputEnabled(false);
  markWrongClues();
  applyWrongReviewMarks();

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  lastAccuracy = accuracy;
  const timeStr = formatDuration(solveTimeMs ?? elapsedMs);
  const perfect = wrong === 0;
  const catName = currentCategoryKey ? getCategoryDisplayName(currentCategoryKey) : '';

  saveGameRecord({
    id: Date.now(),
    categoryKey: currentCategoryKey,
    categoryName: catName,
    wordCount: currentWordCount,
    gridLabel: `${currentPuzzle.rows}×${currentPuzzle.cols}`,
    placedCount: currentPuzzle.placedCount,
    solveTimeMs: solveTimeMs ?? elapsedMs,
    accuracy,
    correct,
    total,
    playedAt: new Date().toISOString(),
  });

  const resultLine = `${catName} · 풀이 시간 ${timeStr} · 정답률 ${accuracy}% (${correct}/${total})`;
  setStatus(resultLine);
  updateTimerDisplay();
  showGameResult({
    categoryName: catName,
    timeStr,
    accuracy,
    correct,
    total,
    perfect,
    wrongCount: wrong,
  });
}

wordCountInput.addEventListener('input', () => {
  wordCountLabel.textContent = `${wordCountInput.value}개 · 최소 9×9 격자`;
});

generateBtn.addEventListener('click', generatePuzzle);
recordsBtn.addEventListener('click', openRecordsModal);
closeRecordsBtn.addEventListener('click', closeRecordsModal);
recordsModal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-records]')) closeRecordsModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !recordsModal.classList.contains('hidden')) {
    closeRecordsModal();
  }
});
startGameBtn.addEventListener('click', startGame);
replayGameBtn.addEventListener('click', replayGame);
window.addEventListener('resize', () => {
  if (currentPuzzle) fitGridToContainer(currentPuzzle);
  syncCluesLayout();
  scheduleWordInputPosition();
});
gridWrap?.addEventListener('scroll', scheduleWordInputPosition, { passive: true });

setupWordInput();
initCategories();
