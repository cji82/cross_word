# 한글 크로스워드 퍼즐

카테고리별 단어로 가로·세로 크로스워드를 자동 생성하는 웹 앱입니다.

## 실행 방법

`index.html`을 바로 열어도 동작합니다.  
권장: 간단한 로컬 서버로 실행

```bash
python -m http.server 8080
# http://localhost:8080
```

## 현재 기능

- 카테고리 5종 + 통합 카테고리 `전체`
- 카테고리별 단어 120개(총 600단어)
- 퍼즐 생성 후 시작 오버레이 + `게임 시작` 버튼
- 시작 시 타이머 동작, 모든 칸 입력 시 자동 종료/채점
- 결과 요약(풀이 시간, 정답률, 정답 수) + 오답 강조 표시
- `게임 다시하기` 지원
- 풀이 기록 저장/조회(LocalStorage, 최근 50개)

## 스크린샷

### 메인 화면

![메인 화면](docs/images/01-home.png)

## 데이터 관리

- 원본 데이터: `scripts/generate-categories.cjs`
- 생성 결과: `data/categories.js`
- 데이터 재생성:

```bash
node scripts/generate-categories.cjs
```

## 주요 파일

- `index.html` : 메인 UI 구조
- `styles.css` : 전체 스타일
- `js/app.js` : 게임 진행, 입력/채점, 타이머, 기록 UI
- `js/crossword.js` : 퍼즐 배치/번호 매기기/단어 선택 로직
- `data/categories.js` : 최종 카테고리 단어/단서 데이터
- `scripts/generate-categories.cjs` : 데이터 소스/검증/생성 스크립트
