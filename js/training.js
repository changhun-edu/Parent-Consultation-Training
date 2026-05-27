/* =====================================================
   training.js  –  자유 입력 + 키워드 자동 평가
   흐름: 학부모 발화 → 교사 직접 입력 → 자동 평가
         → 모범 답변 제시 → 다음 상황
   ===================================================== */

const DIFFICULTY_LABEL = { 1:'⭐ 초급', 2:'⭐⭐ 중급', 3:'⭐⭐⭐ 고급' };

/* ── 평가 루브릭 ────────────────────────────────────
   각 항목: 해당 키워드가 입력에 포함될수록 점수 부여
   ──────────────────────────────────────────────── */
const RUBRIC = [
  {
    key: 'empathy', label: '공감 표현', icon: '💛', max: 30, perHit: 12,
    words: ['많이','충분히','이해합니다','이해해요','걱정','마음이','속상',
            '놀라셨겠','안타깝','힘드셨겠','당황하셨겠','그러셨겠','아쉬우셨',
            '힘들었겠','속상하셨겠','서운하셨겠'],
  },
  {
    key: 'solution', label: '해결 방향', icon: '🔧', max: 25, perHit: 9,
    words: ['확인','살펴보','이야기 나누','알려드리','연락드리','방법을','조치',
            '지도하겠','도움','함께','노력','챙기겠','처리하겠','파악하겠'],
  },
  {
    key: 'fact', label: '사실 기반', icon: '📋', max: 20, perHit: 8,
    words: ['직접','확인했','상황을','당시','기록','목격','보았','살펴봤','제가 보'],
  },
  {
    key: 'followup', label: '후속 약속', icon: '📅', max: 15, perHit: 9,
    words: ['연락드리겠','문자','알려드리겠','다시 연락','확인하겠습니다',
            '살펴보겠','내일','이번 주','금요일'],
  },
  {
    key: 'defensive', label: '방어적 표현', icon: '⚠️', max: 0, perHit: -15, penalty: true,
    words: ['규정상','원래 그런','어쩔 수 없','흔한','경미한','별거 아','그런 사실이 없',
            '아닌데요','저는 잘못이'],
  },
];

/* ── 게임 상태 ──────────────────────────────────── */
const state = {
  scenario:      null,
  currentNodeId: null,
  emotionLevel:  0,
  phase: 'loading',   // loading | input | evaluated | complete
  turnHistory:   [],  // [{ parentMsg, teacherInput, result }]
  currentResult: null,
  allScores:     [],
};

const $ = id => document.getElementById(id);

/* ════════════════════════════════════════════════════
   초기화
   ════════════════════════════════════════════════════ */
async function init() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { location.href = 'index.html'; return; }

  try {
    const data = await fetch('data/scenarios.json').then(r => r.json());
    state.scenario = data.scenarios.find(s => s.id === id);
  } catch { showError('데이터를 불러오지 못했습니다.'); return; }

  if (!state.scenario) { location.href = 'index.html'; return; }

  state.currentNodeId = state.scenario.startNodeId;
  state.emotionLevel  = state.scenario.initialEmotion;

  applyMeta();
  updateEmotionBar(state.emotionLevel, true);

  // Ctrl+Enter 제출
  $('teacher-textarea').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); submitResponse(); }
  });
  $('teacher-textarea').addEventListener('input', updateCharCount);

  renderNode();
}

/* ════════════════════════════════════════════════════
   시나리오 메타 정보 적용
   ════════════════════════════════════════════════════ */
function applyMeta() {
  const s = state.scenario;
  document.title = `${s.title} – 학부모 상담 훈련`;
  setText('scenario-title',     s.title);
  setText('scenario-category',  s.categoryIcon + ' ' + s.category);
  setText('scenario-situation', s.situation);
  setText('parent-name-header', s.parentName);
  setText('parent-name-bubble', s.parentName);
  $('scenario-category').style.color = s.categoryColor;
  const db = $('difficulty-badge');
  db.className   = `badge badge--d${s.difficulty}`;
  db.textContent = DIFFICULTY_LABEL[s.difficulty];
}

/* ════════════════════════════════════════════════════
   노드 렌더링
   ════════════════════════════════════════════════════ */
function renderNode() {
  const node = state.scenario.nodes[state.currentNodeId];
  if (!node) { showError('노드를 찾을 수 없습니다.'); return; }

  updateProgress();

  // 학부모 메시지 애니메이션
  const msgEl = $('parent-message');
  msgEl.classList.remove('anim-fade-in');
  void msgEl.offsetWidth;
  msgEl.textContent = node.parentMessage;
  msgEl.classList.add('anim-fade-in');

  if (node.isEnd) { showEndScreen(node); return; }

  // 패널 초기화
  $('eval-panel').style.display      = 'none';
  $('model-panel').style.display     = 'none';
  $('next-btn').style.display        = 'none';
  $('teacher-bubble').style.display  = 'none';

  state.phase = 'input';
  showInputArea();
}

/* ════════════════════════════════════════════════════
   입력 영역 표시
   ════════════════════════════════════════════════════ */
function showInputArea() {
  const wrap = $('teacher-input-wrap');
  wrap.style.display = 'block';
  wrap.classList.remove('anim-fade-in');
  void wrap.offsetWidth;
  wrap.classList.add('anim-fade-in');

  const ta = $('teacher-textarea');
  ta.value = '';
  ta.style.borderColor = '';
  ta.placeholder = '학부모에게 어떻게 응답하시겠습니까?\n\n예시) 어머니, 많이 놀라셨겠어요. 상황을 확인해보고 오늘 중으로 연락드리겠습니다.';
  updateCharCount();
  $('submit-btn').disabled = false;
  setTimeout(() => ta.focus(), 300);
}

/* ── 글자 수 & 상태 ─────────────────────────────── */
function updateCharCount() {
  const len = $('teacher-textarea').value.length;
  const el  = $('char-count');
  el.textContent = `${len}자`;
  el.style.color = len < 20 ? 'var(--txt3)' : len < 50 ? 'var(--yellow)' : 'var(--green)';
}

/* ── 빠른 입력 힌트 삽입 ─────────────────────────── */
function insertHint(text) {
  const ta  = $('teacher-textarea');
  const val = ta.value;
  ta.value  = val + (val && !val.endsWith(' ') ? ' ' : '') + text;
  ta.focus();
  updateCharCount();
}

/* ════════════════════════════════════════════════════
   답변 제출 & 평가
   ════════════════════════════════════════════════════ */
function submitResponse() {
  if (state.phase !== 'input') return;

  const text = $('teacher-textarea').value.trim();
  if (text.length < 5) {
    const ta = $('teacher-textarea');
    ta.style.borderColor = 'var(--red)';
    ta.focus();
    return;
  }

  state.phase = 'evaluated';
  $('submit-btn').disabled = true;

  const node   = state.scenario.nodes[state.currentNodeId];
  const result = evaluateInput(text, node);
  state.currentResult = result;
  state.allScores.push(result.total);
  state.turnHistory.push({ parentMsg: node.parentMessage, teacherInput: text, result });

  // 입력 영역 숨김
  $('teacher-input-wrap').style.display = 'none';

  // 교사 버블 표시
  showTeacherBubble(text, result.total);

  // 감정 바 갱신
  const delta = result.total >= 70 ? -22 : result.total >= 40 ? 5 : 20;
  state.emotionLevel = Math.max(5, Math.min(100, state.emotionLevel + delta));
  updateEmotionBar(state.emotionLevel, false);

  // 패널 순서 표시
  showEvalPanel(result);
  showModelPanel(result);

  // 다음 버튼
  const nb = $('next-btn');
  nb.textContent = result.nextNodeId
    ? '다음 상황으로 →'
    : '결과 보기 →';
  nb.style.display = 'flex';
  nb.onclick = () => {
    // 현재 턴 히스토리로 이동
    renderChatHistory();
    state.currentNodeId = result.nextNodeId;
    renderNode();
    nb.style.display = 'none';
    // 새 메시지로 스크롤
    setTimeout(() => {
      $('parent-message').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };
}

/* ════════════════════════════════════════════════════
   키워드 기반 평가 엔진
   ════════════════════════════════════════════════════ */
function evaluateInput(text, node) {
  const excellentChoice = node.choices?.find(c => c.quality === 'excellent')
                       || node.choices?.[0];

  const breakdown = {};
  let total = 0;

  for (const cfg of RUBRIC) {
    const hits  = cfg.words.filter(w => text.includes(w));
    const raw   = Math.min(Math.abs(cfg.max), hits.length * Math.abs(cfg.perHit));
    const score = cfg.penalty ? -raw : raw;
    breakdown[cfg.key] = { ...cfg, hits, score };
    total += score;
  }

  // 짧은 답변 페널티
  if (text.length < 30) total = Math.floor(total * 0.65);

  total = Math.max(0, Math.min(100, total));

  return {
    total,
    breakdown,
    modelAnswer: excellentChoice?.text  || '',
    modelTip:    excellentChoice?.tip   || '',
    nextNodeId:  excellentChoice?.nextNodeId ?? null,
    teacherText: text,
  };
}

/* ════════════════════════════════════════════════════
   교사 답변 버블
   ════════════════════════════════════════════════════ */
function showTeacherBubble(text, score) {
  const color = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--yellow)' : 'var(--red)';
  $('teacher-bubble-text').textContent  = text;
  $('teacher-bubble-score').textContent = score + '점';
  $('teacher-bubble-score').style.color = color;

  const bubble = $('teacher-bubble');
  bubble.style.display = 'flex';
  bubble.classList.remove('anim-fade-in');
  void bubble.offsetWidth;
  bubble.classList.add('anim-fade-in');
}

/* ════════════════════════════════════════════════════
   평가 패널
   ════════════════════════════════════════════════════ */
function scoreColor(score, max, isPenalty) {
  if (isPenalty) return score < 0 ? 'var(--red)' : 'var(--txt3)';
  const pct = max > 0 ? score / max : 0;
  return pct >= 0.7 ? 'var(--green)' : pct >= 0.4 ? 'var(--yellow)' : 'var(--red)';
}
function scoreHex(score, max, isPenalty) {
  if (isPenalty) return score < 0 ? '#ef4444' : '#64748b';
  const pct = max > 0 ? score / max : 0;
  return pct >= 0.7 ? '#22c55e' : pct >= 0.4 ? '#f59e0b' : '#ef4444';
}

function showEvalPanel(result) {
  const { total, breakdown } = result;
  const tColor = total >= 80 ? 'var(--green)' : total >= 60 ? 'var(--blue)' : total >= 40 ? 'var(--yellow)' : 'var(--red)';
  const tHex   = total >= 80 ? '#22c55e'  : total >= 60 ? '#3b82f6'  : total >= 40 ? '#f59e0b'  : '#ef4444';
  const grade  = total >= 80 ? '훌륭합니다 ✨' : total >= 60 ? '양호합니다 👍' : total >= 40 ? '개선이 필요합니다 📚' : '다시 시도해보세요 💪';

  setText('eval-total', total + '점');
  $('eval-total').style.color = tColor;
  setText('eval-grade', grade);
  $('eval-grade').style.color = tColor;

  const bar = $('eval-total-bar');
  bar.style.width           = total + '%';
  bar.style.backgroundColor = tHex;

  // 세부 항목
  const bkEl = $('eval-breakdown');
  bkEl.innerHTML = RUBRIC.map(cfg => {
    const item  = breakdown[cfg.key];
    if (!item)  return '';
    if (cfg.penalty && item.hits.length === 0) return ''; // 페널티 없으면 숨김
    const pct   = cfg.penalty
      ? Math.min(100, Math.abs(item.score) / 15 * 100)
      : (cfg.max > 0 ? Math.min(100, item.score / cfg.max * 100) : 0);
    const hex   = scoreHex(item.score, cfg.max, cfg.penalty);
    const sText = cfg.penalty
      ? (item.score < 0 ? `${item.score}점` : '이상 없음')
      : `+${item.score}점`;

    return `
    <div class="eval-item">
      <div class="eval-item__header">
        <span>${cfg.icon} ${cfg.label}</span>
        <span class="eval-item__score" style="color:${hex}">${sText}</span>
      </div>
      <div class="eval-bar-track">
        <div class="eval-bar-fill" style="width:${pct}%;background:${hex}"></div>
      </div>
      ${item.hits.length
        ? `<div class="eval-hits">✓ "${item.hits.slice(0,3).join('" · "')}"</div>`
        : `<div class="eval-hits" style="color:var(--txt3)">해당 표현 없음</div>`}
    </div>`;
  }).join('');

  // 피드백 텍스트
  const tips = [];
  if ((breakdown.empathy?.score  || 0) < 15) tips.push('공감 표현을 먼저 넣어보세요 (예: "많이 놀라셨겠어요")');
  if ((breakdown.solution?.score || 0) < 10) tips.push('구체적인 해결 방향을 제시하세요');
  if ((breakdown.followup?.score || 0) < 8)  tips.push('후속 연락 약속을 추가하면 신뢰가 높아집니다');
  if ((breakdown.defensive?.hits?.length || 0) > 0)
    tips.push(`방어적 표현 주의: "${breakdown.defensive.hits.join('", "')}" `);

  const fbEl = $('eval-feedback');
  if (tips.length) {
    fbEl.className   = 'eval-feedback';
    fbEl.innerHTML   = tips.map(t => `<div class="eval-fb-item">• ${t}</div>`).join('');
    fbEl.style.display = 'block';
  } else {
    fbEl.className   = 'eval-feedback eval-feedback--good';
    fbEl.textContent = '✅ 전반적으로 균형 잡힌 응대입니다!';
    fbEl.style.display = 'block';
  }

  const panel = $('eval-panel');
  panel.style.display = 'block';
  panel.classList.remove('anim-fade-in');
  void panel.offsetWidth;
  panel.classList.add('anim-fade-in');
}

/* ════════════════════════════════════════════════════
   모범 답변 패널
   ════════════════════════════════════════════════════ */
function showModelPanel(result) {
  if (!result.modelAnswer) return;
  $('model-text').textContent = `"${result.modelAnswer}"`;
  $('model-tip').textContent  = result.modelTip;

  const panel = $('model-panel');
  panel.style.display = 'block';
  panel.classList.remove('anim-fade-in');
  void panel.offsetWidth;
  panel.classList.add('anim-fade-in');
}

/* ════════════════════════════════════════════════════
   누적 대화 히스토리 렌더링
   ════════════════════════════════════════════════════ */
function renderChatHistory() {
  const wrap = $('chat-history-wrap');
  // 방금 제출한 턴(마지막)은 현재 화면에 보이므로 히스토리엔 이전 것들만
  const history = state.turnHistory.slice(0, -1);
  if (!history.length) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = history.map(h => {
    const sc    = h.result.total;
    const scCol = sc >= 70 ? 'var(--green)' : sc >= 40 ? 'var(--yellow)' : 'var(--red)';
    return `
    <div class="history-exchange">
      <div class="parent-bubble">
        <div class="parent-avatar" style="width:30px;height:30px;font-size:14px">👩</div>
        <div class="parent-bubble__body" style="font-size:13px">${escHtml(h.parentMsg)}</div>
      </div>
      <div class="teacher-bubble" style="display:flex">
        <div class="teacher-bubble__body" style="font-size:13px">
          <div>${escHtml(h.teacherInput)}</div>
          <div class="teacher-bubble__meta">
            <span style="font-size:11px;color:var(--txt3)">내 답변</span>
            <span style="font-weight:800;font-size:12px;color:${scCol}">${sc}점</span>
          </div>
        </div>
        <div class="teacher-avatar" style="width:30px;height:30px;font-size:14px">🧑‍🏫</div>
      </div>
    </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════
   종료 화면
   ════════════════════════════════════════════════════ */
function showEndScreen(node) {
  state.phase = 'complete';
  ['teacher-input-wrap','eval-panel','model-panel','teacher-bubble'].forEach(id => {
    $(id).style.display = 'none';
  });
  $('next-btn').style.display = 'none';

  updateEmotionBar(node.emotionFinal, false);

  // 실제 교사 점수 평균
  const avg = state.allScores.length
    ? Math.round(state.allScores.reduce((a, b) => a + b, 0) / state.allScores.length)
    : 0;

  const tColor = avg >= 80 ? 'var(--green)' : avg >= 60 ? 'var(--blue)' : avg >= 40 ? 'var(--yellow)' : 'var(--red)';
  const tEmoji = avg >= 80 ? '🌟' : avg >= 60 ? '👍' : avg >= 40 ? '📚' : '💪';
  const tLabel = avg >= 80 ? '탁월한 상담' : avg >= 60 ? '양호한 상담' : avg >= 40 ? '개선 필요' : '성장 중';

  setText('end-emoji',   tEmoji);
  setText('end-score',   avg + '점');
  setText('end-summary', node.summary);

  const scoreBgMap = {
    'var(--green)':  'rgba(34,197,94,',
    'var(--blue)':   'rgba(59,130,246,',
    'var(--yellow)': 'rgba(245,158,11,',
    'var(--red)':    'rgba(239,68,68,',
  };
  const rgba  = scoreBgMap[tColor] || 'rgba(99,102,241,';
  const badge = $('end-label-badge');
  badge.style.background  = rgba + '0.12)';
  badge.style.borderColor = rgba + '0.35)';
  badge.style.color       = tColor;
  badge.textContent       = tLabel;
  $('end-score').style.color = tColor;

  // 턴별 점수 차트
  const chart = $('end-turn-chart');
  chart.innerHTML = state.allScores.map((s, i) => {
    const c   = s >= 70 ? '#22c55e' : s >= 40 ? '#f59e0b' : '#ef4444';
    const h   = Math.max(6, (s / 100) * 48);
    return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;max-width:48px">
      <span style="font-size:11px;font-weight:800;color:${c}">${s}</span>
      <div style="width:100%;height:${h}px;background:${c};border-radius:3px;opacity:.85"></div>
      <span style="font-size:10px;color:var(--txt3)">T${i + 1}</span>
    </div>`;
  }).join('');

  // 강점 / 개선점
  if (node.strengths?.length) {
    $('end-strengths-list').innerHTML = node.strengths.map(s => `<li>${s}</li>`).join('');
    $('end-strengths-section').style.display = 'block';
  } else { $('end-strengths-section').style.display = 'none'; }

  if (node.improvements?.length) {
    $('end-improvements-list').innerHTML = node.improvements.map(s => `<li>${s}</li>`).join('');
    $('end-improvements-section').style.display = 'block';
  } else { $('end-improvements-section').style.display = 'none'; }

  setText('end-next-practice', node.nextPractice);

  const es = $('end-screen');
  es.style.display = 'block';
  es.classList.remove('anim-pop-in');
  void es.offsetWidth;
  es.classList.add('anim-pop-in');

  saveResult(avg, tLabel);
}

/* ════════════════════════════════════════════════════
   재시작
   ════════════════════════════════════════════════════ */
function restartScenario() {
  state.currentNodeId = state.scenario.startNodeId;
  state.emotionLevel  = state.scenario.initialEmotion;
  state.phase         = 'input';
  state.turnHistory   = [];
  state.currentResult = null;
  state.allScores     = [];

  ['end-screen','eval-panel','model-panel','teacher-bubble'].forEach(id => {
    $(id).style.display = 'none';
  });
  $('next-btn').style.display       = 'none';
  $('chat-history-wrap').innerHTML  = '';

  updateEmotionBar(state.emotionLevel, true);
  renderNode();
}

/* ════════════════════════════════════════════════════
   공통 유틸
   ════════════════════════════════════════════════════ */
function updateProgress() {
  const el = $('turn-count');
  if (el) el.textContent = `${state.allScores.length + 1}번째 상황`;
}

function updateEmotionBar(level, instant) {
  const hex   = level > 70 ? '#ef4444' : level > 40 ? '#f59e0b' : '#22c55e';
  const color = level > 70 ? 'var(--red)' : level > 40 ? 'var(--yellow)' : 'var(--green)';
  const label = level > 70 ? '격앙' : level > 40 ? '다소 불안' : '안정';

  const fill = $('emotion-fill');
  if (fill) {
    fill.style.transition       = instant ? 'none' : 'width .9s ease, background-color .9s ease';
    fill.style.width            = level + '%';
    fill.style.backgroundColor  = hex;
  }
  const lEl = $('emotion-label');
  if (lEl) { lEl.textContent = label; lEl.style.color = color; }
  const vEl = $('emotion-value');
  if (vEl) { vEl.textContent = level; vEl.style.color = color; }
}

function setText(id, text) { const e = $(id); if (e) e.textContent = text; }

// XSS 방지용 이스케이프
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function saveResult(score, label) {
  try {
    const h = JSON.parse(localStorage.getItem('ct_history') || '[]');
    h.push({ scenarioId: state.scenario.id, title: state.scenario.title,
             score, label, date: new Date().toLocaleDateString('ko-KR'), timestamp: Date.now() });
    localStorage.setItem('ct_history', JSON.stringify(h));
  } catch {}
}

function showError(msg) {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;
                min-height:100vh;flex-direction:column;gap:16px">
      <p style="color:var(--txt2)">${msg}</p>
      <a href="index.html" class="btn btn--ghost">← 홈으로</a>
    </div>`;
}

document.addEventListener('DOMContentLoaded', init);
