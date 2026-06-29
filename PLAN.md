# 남은 작업 계획

단서 품질 개선(36자 확장·깨진 글자 수정) 이후 마무리할 항목입니다.

## 현재 상태 (2026-06-26)

| 항목 | 상태 |
|------|------|
| 단서 최대 길이 | 25자 → **36자** (`clue-dictionary.cjs`) |
| 깨진 글자(U+FFFD) | 워드팩 **0개** |
| 워드팩 개수 | animals 500 · food 499 · fruits 501 · jobs **491** · nature **486** |
| `data/categories.js` | **미갱신** (`generate-categories.cjs` 실패) |
| 퍼즐 생성 크래시 | `crossword.js` `canPlace` 경계 검사 수정 완료 |

## 1. 워드팩 단어 수 보충

`fix-pack-clues.cjs` 실행으로 품질 미달 항목이 제거되어 일부 카테고리가 500개 미만입니다.

```bash
node scripts/build-word-packs.cjs --category=jobs
node scripts/build-word-packs.cjs --category=nature
node scripts/build-word-packs.cjs --category=food   # 499 → 500
```

목표: 카테고리별 워드팩 **500개**, 병합 후 **620개** 달성.

## 2. categories.js 재생성

```bash
node scripts/generate-categories.cjs
```

검증 항목:
- 카테고리당 620단어
- 단서 길이 10~36자
- 잘림·깨짐·정답 포함 없음

## 3. 남은 단서 품질 정리 (선택)

잘린 문장이 남아 있으면:

```bash
node scripts/repair-truncated-clues.cjs
node scripts/fix-pack-clues.cjs
node scripts/generate-categories.cjs
```

## 4. 최종 확인

- 로컬 서버에서 퍼즐 생성·단서 표시 확인
- `전체` 카테고리에서 깨진 글자·중간 끊김 없는지 샘플 검수
- 필요 시 `node scripts/validate-stdict.cjs` 사전 검증

## 관련 스크립트

| 파일 | 역할 |
|------|------|
| `scripts/clue-dictionary.cjs` | 단서 생성·검증 (36자, UTF-8) |
| `scripts/fix-pack-clues.cjs` | 수동 단서 적용·깨진 항목 제거 |
| `scripts/repair-truncated-clues.cjs` | 사전 재조회로 잘린 단서 수정 |
| `scripts/generate-categories.cjs` | `data/categories.js` 빌드 |
