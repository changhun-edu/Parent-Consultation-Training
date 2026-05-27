# 🎓 학부모 상담 훈련 시뮬레이터

> 교사를 위한 분기형 학부모 상담 훈련 서비스  
> AI API 없이 JSON 기반으로 작동하는 순수 정적 웹사이트

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-배포됨-brightgreen?logo=github)](https://YOUR_USERNAME.github.io/teacher-consultation-trainer/)

---

## 📌 서비스 소개

실제 학교 현장에서 발생하는 학부모 상담 상황을 **분기형 선택지**로 연습하고, 즉각적인 피드백과 점수를 받는 훈련 시스템입니다.

- **AI API 불필요** — 모든 시나리오는 JSON 파일로 관리
- **브라우저 기록 저장** — localStorage로 상담 이력 누적
- **GitHub Pages 바로 배포** — 빌드 과정 없음

---

## 🗂️ 포함된 시나리오

| # | 카테고리 | 시나리오 | 난이도 |
|---|---|---|---|
| 1 | 📚 생활지도 | 스마트워치 수거 항의 | ⭐ 초급 |
| 2 | 👥 교우 관계 | 단톡방 소외 항의 | ⭐⭐ 중급 |
| 3 | 🚑 안전사고 | 체육 시간 부상 미연락 | ⭐⭐ 중급 |
| 4 | 🧑‍🏫 교사 태도 | 차별 대우 의심 | ⭐⭐⭐ 고급 |

각 시나리오는 **2단계 분기 구조**로, 첫 선택에 따라 다른 학부모 반응이 펼쳐지고, 최종적으로 6가지 결말 중 하나로 이어집니다.

---

## 📁 파일 구조

```
teacher-consultation-trainer/
├── index.html          # 홈 – 시나리오 목록
├── training.html       # 훈련 화면 (분기 게임)
├── css/
│   └── style.css       # 공유 스타일시트
├── js/
│   ├── home.js         # 홈 페이지 로직
│   └── training.js     # 분기 게임 로직
├── data/
│   └── scenarios.json  # 시나리오 데이터 (수정 가능)
└── README.md
```

---

## 🚀 GitHub Pages 배포 방법

### 1단계: 저장소 생성 및 파일 업로드

```bash
git init
git add .
git commit -m "초기 커밋: 학부모 상담 훈련 시뮬레이터"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/teacher-consultation-trainer.git
git push -u origin main
```

### 2단계: GitHub Pages 활성화

1. GitHub 저장소 → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)`
4. **Save**

### 3단계: 접속

```
https://YOUR_USERNAME.github.io/teacher-consultation-trainer/
```

---

## ✏️ 시나리오 추가 방법

`data/scenarios.json`을 열고 시나리오 객체를 추가합니다.

```json
{
  "id": "s5",
  "category": "카테고리명",
  "categoryIcon": "🔍",
  "categoryColor": "#3b82f6",
  "title": "시나리오 제목",
  "difficulty": 2,
  "situation": "상황 설명...",
  "parentName": "학부모 이름",
  "initialEmotion": 75,
  "startNodeId": "s5-start",
  "nodes": {
    "s5-start": {
      "parentMessage": "학부모 첫 발언...",
      "choices": [
        {
          "id": "s5-c1a",
          "text": "교사 응답...",
          "quality": "excellent",
          "emotionDelta": -25,
          "tip": "피드백 메시지",
          "nextNodeId": "s5-n2a"
        }
      ]
    },
    "s5-n2a": { ... },
    "s5-end-great": {
      "isEnd": true,
      "parentMessage": "마무리 학부모 발언",
      "score": 90,
      "emotionFinal": 20,
      "resultLabel": "탁월한 상담",
      "resultColor": "#22c55e",
      "summary": "종합 평가...",
      "strengths": ["강점1", "강점2"],
      "improvements": [],
      "nextPractice": "다음 연습 제안..."
    }
  }
}
```

### 품질 레벨 기준

| quality | 설명 | emotionDelta 권장 |
|---|---|---|
| `excellent` | 공감+사실+협력 완벽 | -20 ~ -30 |
| `good` | 기본 공감, 다소 부족 | -5 ~ -15 |
| `fair` | 사실 위주, 공감 부족 | 0 ~ +10 |
| `poor` | 방어적/규정 강조 | +15 ~ +25 |

---

## 🛠️ 로컬 실행

```bash
# Python 간단 서버 (JSON fetch를 위해 HTTP 서버 필요)
python3 -m http.server 8080

# 또는 Node.js
npx serve .

# 접속
open http://localhost:8080
```

> ⚠️ `file://` 프로토콜로 직접 열면 `fetch()`가 동작하지 않을 수 있습니다.

---

## 📈 향후 확장 계획

- [ ] 시나리오 3단계 분기 추가
- [ ] 전체 대화 녹화 및 다운로드
- [ ] 카테고리 10개로 시나리오 확장
- [ ] AI API 연동 버전 (선택적)
- [ ] 학교별 커스텀 시나리오 지원

---

## 📄 라이선스

MIT License — 자유롭게 수정 및 배포 가능합니다.
