# 한글 크로스워드 퍼즐

카테고리별 단어로 가로·세로 크로스워드를 자동 생성하는 웹 UI입니다.

## 실행 방법

로컬 서버 없이 `index.html`을 브라우저에서 바로 열어도 됩니다.

```bash
# Python이 있다면
python -m http.server 8080
# http://localhost:8080 접속
```

## 기능

- 5개 카테고리 (동물, 음식, 과일, 직업, 자연)
- 단어 수 4~12개 조절
- 한글 음절 단위 교차 배치
- 가로/세로 넘버링 및 힌트 목록
- 직접 입력 풀이 / 정답 보기

## 파일 구조

- `index.html` — 메인 UI
- `styles.css` — 스타일
- `data/categories.js` — 카테고리·단어·힌트 데이터
- `js/crossword.js` — 배치·넘버링 알고리즘
- `js/app.js` — UI 로직
