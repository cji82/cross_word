# 파일 구조 및 역할

한글 크로스워드 퍼즐 프로젝트의 디렉터리·파일별 역할 정리입니다.

## 데이터 흐름

```
scripts/seed-data/          시드 단어 목록
        ↓
scripts/build-word-packs.cjs   표준국어대사전·우리말샘 조회 → 단서 생성
        ↓
scripts/word-packs/         카테고리별 확장 워드팩 (500개)
        ↓
scripts/generate-categories.cjs   기본 120 + EXTRA + 워드팩 병합·검증
        ↓
data/categories.js          인코딩된 최종 데이터
        ↓
js/category-loader.js       브라우저에서 복호화 → window.CATEGORIES
        ↓
js/crossword.js, js/app.js  퍼즐 생성·게임 UI
```

---

## 루트

| 파일 | 역할 |
|------|------|
| `index.html` | 앱 진입점. 카테고리 선택, 퍼즐 그리드, 단서 패널, 타이머·결과·기록 UI |
| `styles.css` | 전체 레이아웃·색상·반응형·퍼즐 격자 스타일 |
| `README.md` | 실행 방법, 기능 설명, 데이터 재생성·단서 품질 규칙 |
| `fileinfo.md` | 이 문서. 파일별 역할 정리 |

---

## `js/` — 브라우저 실행 코드

| 파일 | 역할 |
|------|------|
| `app.js` | 게임 메인 컨트롤러. 카테고리·단어 수 선택, 퍼즐 생성 트리거, 셀 입력·채점, 타이머, 결과 표시, LocalStorage 기록(최근 50건) |
| `crossword.js` | 퍼즐 생성 엔진. 단어 배치(가로·세로), 격자 크기 조절, 번호 매기기, 단서 목록 구성, 최근 단어 중복 완화 |
| `category-loader.js` | `data/categories.js`의 `__CW` 페이로드를 XOR 복호화해 `window.CATEGORIES`에 노출 |
| `hangul.js` | 한글 음절 분리(`splitSyllables`), 정규화, 최소 2음절 검증 등 한글 처리 유틸 |

---

## `data/` — 빌드 산출물

| 파일 | 역할 |
|------|------|
| `categories.js` | **런타임이 읽는 최종 데이터.** 카테고리 5종 × 620단어(단어+단서). Base64+XOR 인코딩. 직접 수정하지 않고 `generate-categories.cjs`로 재생성 |

---

## `docs/` — 문서·에셋

| 파일 | 역할 |
|------|------|
| `images/01-home.png` | README용 메인 화면 스크린샷 |

---

## `scripts/` — Node.js 빌드·검증 도구

### 핵심 파이프라인

| 파일 | 역할 |
|------|------|
| `generate-categories.cjs` | **데이터 소스의 중심.** 카테고리별 기본 120단어(`DATA`), 보충 단어(`EXTRA_WORDS`), 워드팩 병합. 동음이의어 치환(`WORD_REPLACEMENTS`), 단서 길이·중복 검증 후 `data/categories.js` 출력 |
| `build-word-packs.cjs` | 시드 후보에서 신규 단어를 골라 사전 조회·단서 생성. 카테고리당 500개 목표. `--category=animals` 등으로 단일 카테고리만 실행 가능 |
| `clue-dictionary.cjs` | 표준국어대사전·우리말샘 HTTP 조회, 정의→단서 변환, `MANUAL_CLUES` 수동 단서, 단서 유효성 검사(10~25자, 정답 미포함) |
| `category-encoding.cjs` | `categories.js`용 XOR+Base64 인코딩/디코딩. 스크립트에서 기존 데이터 읽을 때 사용 |
| `factual-clues.js` | 사전 자동 단서가 부정확할 때 덮어쓰는 **수동 보정 단서** 맵 (`FACTUAL_CLUES`) |

### 검증·보조

| 파일 | 역할 |
|------|------|
| `validate-stdict.cjs` | `categories.js` 단어를 표준국어대사전·우리말샘에 대조. `--test=단어`로 단일 단어 테스트 가능 |
| `batch-test-words.cjs` | CLI에서 여러 후보 단어의 사전 등록 여부를 한 번에 확인 (`validate-stdict.cjs` 래퍼) |
| `sync-clues-from-dict.cjs` | 기존 카테고리 데이터의 단서를 사전 정의 기반으로 일괄 동기화·리포트 생성 (수동 검토 전제) |
| `sanitize-seed-data.cjs` | 시드 목록에서 색상+과일 합성어, 분류학 `-류` 용어 등 품질 낮은 후보 제거 |

### 빌드 상태

| 파일 | 역할 |
|------|------|
| `word-pack-progress.json` | 워드팩 빌드 진행 상태. 성공(`done`)·실패(`failed`) 단어별 기록. 중단 후 이어서 빌드할 때 사용 |

---

## `scripts/seed-data/` — 단어 후보·시드

| 파일 | 역할 |
|------|------|
| `animals.js` | 동물 카테고리 1차 시드 단어 배열 |
| `food.js` | 음식 카테고리 1차 시드 |
| `fruits.js` | 과일 카테고리 1차 시드 |
| `jobs.js` | 직업 카테고리 1차 시드 |
| `nature.js` | 자연 카테고리 1차 시드 |
| `additional.cjs` | 카테고리별 대량 추가 후보 단어 |
| `supplements.cjs` | 카테고리별 보충 후보 단어 |
| `candidates-v2-{category}.js` | 2차 확장 후보 (5카테고리) |
| `candidates-v3-{category}.js` | 3차 확장 후보 (5카테고리) |
| `candidates-v4-animals.js` | 동물 4차 후보 |
| `candidates-v4-nature.js` | 자연 4차 후보 |
| `candidates-v5-animals.js` | 동물 5차 후보 |
| `candidates-v6-animals.js` | 동물 6차 후보 |
| `candidates-v6-jobs.js` | 직업 6차 후보 |
| `candidates-v7-animals.js` | 동물 7차 후보 |
| `candidates-v8-animals.js` | 동물 8차 후보 |

> `build-word-packs.cjs`는 v8 → v7 → … → v2 → additional → supplements → 기본 시드 순으로 후보를 합칩니다.  
> `generate-categories.cjs`의 `DATA`(120) + `EXTRA_WORDS`와 중복되지 않는 단어만 워드팩에 추가됩니다.

---

## `scripts/word-packs/` — 생성된 워드팩

| 파일 | 역할 |
|------|------|
| `animals.js` | 동물 확장 500단어 `{ word, clue }[]` |
| `food.js` | 음식 확장 500단어 |
| `fruits.js` | 과일 확장 500단어 |
| `jobs.js` | 직업 확장 500단어 |
| `nature.js` | 자연 확장 500단어 |

`generate-categories.cjs`가 이 파일들을 읽어 카테고리당 총 **620개**를 맞춥니다.

---

## `.cursor/` — 에디터 규칙

| 파일 | 역할 |
|------|------|
| `rules/word-clue-quality.mdc` | 단어·단서 추가 시 사전 확인, 10~25자 규칙, 카테고리 맥락 준수 등 Cursor AI 가이드 |

---

## 자주 쓰는 명령

```bash
# 워드팩 재생성 (시간 소요, API 조회)
node scripts/build-word-packs.cjs

# categories.js 빌드
node scripts/generate-categories.cjs

# 시드 정리
node scripts/sanitize-seed-data.cjs

# 사전 검증
node scripts/validate-stdict.cjs
node scripts/batch-test-words.cjs 참개 야생마 왕거미
```
