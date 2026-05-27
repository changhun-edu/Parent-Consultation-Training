/* =====================================================
   training.js  –  분기형 상담 훈련 게임 로직
   ===================================================== */

const DIFFICULTY_LABEL = { 1: '⭐ 초급', 2: '⭐⭐ 중급', 3: '⭐⭐⭐ 고급' };
const QUALITY_META = {
  excellent: { label: '탁월한 선택 ✨', color: 'var(--green)'  },
  good:      { label: '좋은 선택 👍',   color: 'var(--blue)'   },
  fair:      { label: '무난한 선택 📋',  color: 'var(--yellow)' },
  poor:      { label: '위험한 선택 ⚠️',  color: 'var(--red)'    },
};

/* ── 게임 상태 ──────────────────────────────────────── */
const state = {
  scenario: null,
  currentNodeId: null,
  emotionLevel: 0,
  history: [],       // { nodeId, choice } 배열
  phase: 'loading',  // loading | question | feedback | complete
};

/* ── DOM 요소 참조 ──────────────────────────────────── */
const $ = id => document.getElementById(id);

/* ── 초기화 ─────────────────────────────────────────── */
async function init() {
  const params = new URLSearchParams(location.search);
  const id     = params.get('id');
  if (!id) { location.href = 'index.html'; return; }

  try {
    const data = await fetch('data/scenarios.json').then(r => r.json());
    state.scenario = data.scenarios.find(s => s.id === id);
  } catch { showError('시나리오 데이터를 불러오지 못했습니다.'); return; }

  if (!state.scenario) { location.href = 'index.html'; return; }

  state.currentNodeId = state.scenario.startNodeId;
  state.emotionLevel  = state.scenario.initialEmotion;

  applyScenarioMeta();
  updateEmotionBar(state.emotionLevel, true);
  renderNode();
}

/* ── 시나리오 정보 적용 ─────────────────────────────── */
function applyScenarioMeta() {
  const s = state.scenario;
  document.title = `${s.title} – 학부모 상담 훈련`;
  setText('scenario-title',     s.title);
  setText('scenario-category',  s.categoryIcon + ' ' + s.category);
  setText('scenario-situation', s.situation);
  setText('parent-name-header', s.parentName);

  $('scenario-category').style.color = s.categoryColor;
  // difficulty-badge: className + textContent 동시 설정
  const diffBadge = $('difficulty-badge');
  diffBadge.className   = `badge badge--d${s.difficulty}`;
  diffBadge.textContent = DIFFICULTY_LABEL[s.difficulty];
}

/* ── 노드 렌더링 ────────────────────────────────────── */
function renderNode() {
  const node = state.scenario.nodes[state.currentNodeId];
  if (!node) { showError('노드를 찾을 수 없습니다.'); return; }

  // 진행 표시
  updateProgress();

  // 학부모 메시지 애니메이션
  const msgEl = $('parent-message');
  msgEl.classList.remove('anim-fade-in');
  void msgEl.offsetWidth; // reflow
  msgEl.textContent = node.parentMessage;
  msgEl.classList.add('anim-fade-in');

  // 종료 노드 처리
  if (node.isEnd) { showEndScreen(node); return; }

  // 선택지 표시
  state.phase = 'question';
  $('choices-wrap').style.display = 'block';
  $('feedback-panel').style.display = 'none';
  $('next-btn').style.display = 'none';
  renderChoices(node.choices);
}

/* ── 선택지 렌더링 ──────────────────────────────────── */
function renderChoices(choices) {
  const wrap = $('choices-list');
  wrap.innerHTML = '';

  choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn anim-fade-inL';
    btn.style.animationDelay = `${i * 90}ms`;
    btn.dataset.quality = choice.quality;
    // XSS 방지: innerHTML 대신 DOM 직접 생성
    const numSpan  = document.createElement('span');
    numSpan.className   = 'choice-btn__num';
    numSpan.textContent = i + 1;
    const textSpan = document.createElement('span');
    textSpan.className   = 'choice-btn__text';
    textSpan.textContent = choice.text;
    btn.appendChild(numSpan);
    btn.appendChild(textSpan);
    btn.addEventListener('click', () => selectChoice(choice, btn));
    wrap.appendChild(btn);
  });
}

/* ── 선택 처리 ──────────────────────────────────────── */
function selectChoice(choice, clickedBtn) {
  if (state.phase !== 'question') return;
  state.phase = 'feedback';

  state.history.push({ nodeId: state.currentNodeId, choice });

  // 버튼 상태 업데이트
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = true;
    if (btn === clickedBtn) {
      btn.classList.add('choice-btn--selected', `choice-btn--${choice.quality}`);
    } else {
      btn.classList.add('choice-btn--dimmed');
    }
  });

  // 감정 변화
  const newLevel = Math.max(5, Math.min(100, state.emotionLevel + choice.emotionDelta));
  state.emotionLevel = newLevel;
  updateEmotionBar(newLevel, false);

  // 피드백 패널
  showFeedback(choice);
}

/* ── 피드백 패널 ────────────────────────────────────── */
function showFeedback(choice) {
  const meta = QUALITY_META[choice.quality];

  $('feedback-quality-label').textContent = meta.label;
  $('feedback-quality-label').style.color = meta.color;
  $('feedback-tip').textContent            = choice.tip;

  const panel = $('feedback-panel');
  panel.style.borderColor = meta.color;
  panel.style.background  = meta.color.replace('var(', '').replace(')', '') + '12';
  // inline color 직접 적용
  panel.style.background  = hexOrVar(meta.color, '0.07');

  panel.style.display = 'block';
  panel.classList.remove('anim-fade-in');
  void panel.offsetWidth;
  panel.classList.add('anim-fade-in');

  const nextBtn = $('next-btn');
  nextBtn.style.display = 'flex';
  nextBtn.onclick = () => {
    state.currentNodeId = choice.nextNodeId;
    renderNode();
  };
}

/* ── 종료 화면 ──────────────────────────────────────── */
function showEndScreen(node) {
  state.phase = 'complete';

  $('choices-wrap').style.display  = 'none';
  $('feedback-panel').style.display = 'none';
  $('next-btn').style.display       = 'none';

  // 감정 최종값
  updateEmotionBar(node.emotionFinal, false);

  // 점수 색상
  const sc = node.score;
  const scoreColor = sc >= 80 ? 'var(--green)' : sc >= 60 ? 'var(--blue)' : sc >= 40 ? 'var(--yellow)' : 'var(--red)';
  const scoreEmoji = sc >= 80 ? '🌟' : sc >= 60 ? '👍' : sc >= 40 ? '📚' : '💪';

  setText('end-emoji',   scoreEmoji);
  setText('end-score',   sc + '점');
  setText('end-label',   node.resultLabel);
  setText('end-summary', node.summary);
  $('end-score').style.color = scoreColor;
  $('end-label').style.color = scoreColor;
  // scoreColor는 CSS 변수(var(--green) 등)라 suffix 불가 → rgba 직접 매핑
  const scoreBgMap = {
    'var(--green)':  'rgba(34,197,94,',
    'var(--blue)':   'rgba(59,130,246,',
    'var(--yellow)': 'rgba(245,158,11,',
    'var(--red)':    'rgba(239,68,68,',
  };
  const scoreRgba = scoreBgMap[scoreColor] || 'rgba(99,102,241,';
  $('end-label-badge').style.background   = scoreRgba + '0.12)';
  $('end-label-badge').style.borderColor  = scoreRgba + '0.35)';
  $('end-label-badge').style.color        = scoreColor;
  $('end-label-badge').textContent        = node.resultLabel;

  // 강점
  const strEl = $('end-strengths-list');
  if (node.strengths?.length) {
    strEl.innerHTML = node.strengths.map(s => `<li>${s}</li>`).join('');
    $('end-strengths-section').style.display = 'block';
  } else {
    $('end-strengths-section').style.display = 'none';
  }

  // 개선점
  const impEl = $('end-improvements-list');
  if (node.improvements?.length) {
    impEl.innerHTML = node.improvements.map(s => `<li>${s}</li>`).join('');
    $('end-improvements-section').style.display = 'block';
  } else {
    $('end-improvements-section').style.display = 'none';
  }

  // 다음 연습 팁
  setText('end-next-practice', node.nextPractice);

  // 선택 히스토리
  renderChoiceHistory();

  $('end-screen').style.display = 'block';
  $('end-screen').classList.remove('anim-pop-in');
  void $('end-screen').offsetWidth;
  $('end-screen').classList.add('anim-pop-in');

  // localStorage 저장
  saveResult(node);
}

/* ── 선택 히스토리 렌더링 ───────────────────────────── */
function renderChoiceHistory() {
  const el = $('choice-history');
  el.innerHTML = state.history.map((item, i) => {
    const meta = QUALITY_META[item.choice.quality];
    return `
    <div class="history-item">
      <div class="history-item__turn">Turn ${i + 1}</div>
      <div class="history-item__body">
        <span class="badge badge--${item.choice.quality}" style="margin-bottom:4px">${meta.label}</span>
        <div class="history-item__text">"${item.choice.text}"</div>
        <div class="history-item__tip">${item.choice.tip}</div>
      </div>
    </div>`;
  }).join('');
}

/* ── 감정 바 업데이트 ───────────────────────────────── */
function updateEmotionBar(level, instant) {
  const color = level > 70 ? 'var(--red)' : level > 40 ? 'var(--yellow)' : 'var(--green)';
  const label = level > 70 ? '격앙' : level > 40 ? '다소 불안' : '안정';

  const fill = $('emotion-fill');
  if (fill) {
    fill.style.transition = instant ? 'none' : 'width .9s ease, background-color .9s ease';
    fill.style.width = level + '%';
    fill.style.backgroundColor = level > 70 ? '#ef4444' : level > 40 ? '#f59e0b' : '#22c55e';
  }
  const labelEl = $('emotion-label');
  if (labelEl) { labelEl.textContent = label; labelEl.style.color = color; }
  const valEl = $('emotion-value');
  if (valEl)   { valEl.textContent = level; valEl.style.color = color; }
}

/* ── 진행 표시 ──────────────────────────────────────── */
function updateProgress() {
  const turnEl = $('turn-count');
  if (turnEl) turnEl.textContent = `${state.history.length + 1}번째 상황`;
}

/* ── localStorage 저장 ──────────────────────────────── */
function saveResult(node) {
  try {
    const history = JSON.parse(localStorage.getItem('ct_history') || '[]');
    history.push({
      scenarioId: state.scenario.id,
      title: state.scenario.title,
      score: node.score,
      label: node.resultLabel,
      date: new Date().toLocaleDateString('ko-KR'),
      timestamp: Date.now(),
    });
    localStorage.setItem('ct_history', JSON.stringify(history));
  } catch {}
}

/* ── 재시작 ─────────────────────────────────────────── */
function restartScenario() {
  state.currentNodeId = state.scenario.startNodeId;
  state.emotionLevel  = state.scenario.initialEmotion;
  state.history       = [];
  state.phase         = 'question';

  $('end-screen').style.display    = 'none';
  $('feedback-panel').style.display = 'none';  // 이전 피드백 잔재 제거
  $('next-btn').style.display       = 'none';  // 다음 버튼 잔재 제거
  $('choices-wrap').style.display   = 'block';
  updateEmotionBar(state.emotionLevel, true);
  renderNode();
}

/* ── 에러 표시 ──────────────────────────────────────── */
function showError(msg) {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px">
      <p style="color:var(--txt2)">${msg}</p>
      <a href="index.html" class="btn btn--ghost">← 홈으로</a>
    </div>`;
}

/* ── 유틸 ───────────────────────────────────────────── */
function setText(id, text) { const e = $(id); if (e) e.textContent = text; }

function hexOrVar(colorVar, alpha) {
  const map = {
    'var(--green)':  `rgba(34,197,94,${alpha})`,
    'var(--blue)':   `rgba(59,130,246,${alpha})`,
    'var(--yellow)': `rgba(245,158,11,${alpha})`,
    'var(--red)':    `rgba(239,68,68,${alpha})`,
  };
  return map[colorVar] || `rgba(99,102,241,${alpha})`;
}

document.addEventListener('DOMContentLoaded', init);
