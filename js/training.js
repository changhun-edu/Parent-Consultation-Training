/* =====================================================
   training.js  –  채팅형 다회차 상담 훈련
   
   대화 흐름:
     학부모 발화 → 교사 입력(Enter) → 다음 학부모 발화
     → ... → 모든 대화 끝나면 자동 전체 평가
   
   평가받기 버튼:
     대화 중 언제든 클릭 → 지금까지의 전체 평가
   
   API 없음 - JSON 저장 대화 + 키워드 자동 평가
   ===================================================== */

const DIFFICULTY_LABEL = { 1:'⭐ 초급', 2:'⭐⭐ 중급', 3:'⭐⭐⭐ 고급' };

/* ── 평가 루브릭 ───────────────────────────────────── */
const RUBRIC = [
  { key:'empathy',   label:'공감 표현', icon:'💛', max:30, perHit:12,
    words:['많이','충분히','이해합니다','이해해요','걱정','마음이','속상',
           '놀라셨겠','안타깝','힘드셨겠','당황하셨겠','그러셨겠','아쉬우셨',
           '서운하셨겠','힘들었겠','속상하셨겠','충분히 이해','죄송'] },
  { key:'solution',  label:'해결 방향', icon:'🔧', max:25, perHit:9,
    words:['확인','살펴보','이야기 나누','알려드리','연락드리','방법을','조치',
           '지도하겠','함께','노력','챙기겠','처리하겠','파악하겠','점검'] },
  { key:'fact',      label:'사실 기반', icon:'📋', max:20, perHit:8,
    words:['직접','확인했','상황을','당시','기록','목격','제가 보','처치','양호실'] },
  { key:'followup',  label:'후속 약속', icon:'📅', max:15, perHit:9,
    words:['연락드리겠','문자','알려드리겠','다시 연락','확인하겠습니다',
           '살펴보겠','이번 주','금요일','내일','바로'] },
  { key:'defensive', label:'방어적 표현', icon:'⚠️', max:0, perHit:-15, penalty:true,
    words:['규정상','원래 그런','어쩔 수 없','흔한','경미한','별거 아','그런 사실이 없',
           '아닌데요','저는 잘못이','당연히'] },
];

/* ── 게임 상태 ─────────────────────────────────────── */
const state = {
  scenario:    null,
  turnIndex:   0,
  totalTurns:  0,
  emotionLevel: 0,
  phase: 'loading',   // loading | input | complete
  turnHistory: [],    // [{ parentMsg, teacherInput, score }]
  allScores:   [],
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

  state.totalTurns   = state.scenario.turns.length;
  state.turnIndex    = 0;
  state.emotionLevel = state.scenario.initialEmotion;

  applyMeta();
  updateEmotionBar(state.emotionLevel, true);

  const ta = $('teacher-textarea');
  // Enter → 전송, Shift+Enter → 줄바꿈
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitResponse();
    }
  });
  ta.addEventListener('input', updateCharCount);

  renderTurn();
}

/* ════════════════════════════════════════════════════
   메타 정보
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
   현재 턴 렌더링
   ════════════════════════════════════════════════════ */
function renderTurn() {
  const turn = state.scenario.turns[state.turnIndex];
  if (!turn) { showEndScreen(); return; }

  updateProgress();

  // 학부모 메시지
  const msgEl = $('parent-message');
  msgEl.classList.remove('anim-fade-in');
  void msgEl.offsetWidth;
  msgEl.textContent = turn.parentMessage;
  msgEl.classList.add('anim-fade-in');

  // 이전 응답 관련 패널 모두 숨기기
  $('eval-panel').style.display     = 'none';
  $('model-panel').style.display    = 'none';
  $('next-btn').style.display       = 'none';
  $('teacher-bubble').style.display = 'none';

  state.phase = 'input';
  showInputArea();
}

/* ════════════════════════════════════════════════════
   입력 영역
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
  ta.rows = 2;
  updateCharCount();
  $('submit-btn').disabled = false;
  setTimeout(() => ta.focus(), 200);
}

function updateCharCount() {
  const len = $('teacher-textarea').value.length;
  const el  = $('char-count');
  el.textContent = `${len}자`;
  el.style.color = len < 10 ? 'var(--txt3)' : 'var(--green)';
}

function insertHint(text) {
  const ta  = $('teacher-textarea');
  const val = ta.value;
  ta.value  = val + (val && !val.endsWith(' ') ? ' ' : '') + text;
  ta.focus();
  updateCharCount();
}

/* ════════════════════════════════════════════════════
   답변 전송 → 즉시 다음 대화로
   ════════════════════════════════════════════════════ */
function submitResponse() {
  if (state.phase !== 'input') return;
  const text = $('teacher-textarea').value.trim();
  if (text.length < 3) {
    $('teacher-textarea').style.borderColor = 'var(--red)';
    $('teacher-textarea').focus();
    return;
  }

  state.phase = 'transitioning';
  $('submit-btn').disabled = true;
  $('teacher-input-wrap').style.display = 'none';

  // 점수 계산 (배경 처리, 화면에 즉시 표시 안 함)
  const turn   = state.scenario.turns[state.turnIndex];
  const score  = evaluateInput(text, turn);
  state.allScores.push(score);
  state.turnHistory.push({ parentMsg: turn.parentMessage, teacherInput: text, score });

  // 감정 바만 업데이트
  const delta = score >= 70 ? -18 : score >= 40 ? 3 : 14;
  state.emotionLevel = Math.max(5, Math.min(100, state.emotionLevel + delta));
  updateEmotionBar(state.emotionLevel, false);

  // 평가받기 버튼 활성화 (1턴 이상 완료 시)
  activateEvalBtn();

  // 히스토리에 현재 교환 추가
  appendToHistory(turn.parentMessage, text, score);

  // 마지막 턴이면 전체 평가로
  const isLast = state.turnIndex >= state.totalTurns - 1;
  if (isLast) {
    // 잠깐 딜레이 후 결과 표시
    setTimeout(() => showEndScreen(), 600);
  } else {
    // 다음 턴으로
    state.turnIndex++;
    setTimeout(() => {
      renderTurn();
      // 새 학부모 메시지로 스크롤
      const bubble = document.querySelector('.parent-bubble:not(.history-exchange .parent-bubble)');
      if (bubble) bubble.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  }
}

/* ════════════════════════════════════════════════════
   대화 히스토리에 직접 추가 (채팅창에 누적)
   ════════════════════════════════════════════════════ */
function appendToHistory(parentMsg, teacherInput, score) {
  const wrap  = $('chat-history-wrap');
  const scCol = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--yellow)' : 'var(--red)';

  const div = document.createElement('div');
  div.className = 'history-exchange anim-fade-in';
  div.innerHTML = `
    <div class="parent-bubble">
      <div class="parent-avatar" style="width:32px;height:32px;font-size:15px">👩</div>
      <div class="parent-bubble__body" style="font-size:13px">
        <div class="parent-bubble__name" style="font-size:10px">${escHtml(state.scenario.parentName)}</div>
        ${escHtml(parentMsg)}
      </div>
    </div>
    <div class="teacher-bubble" style="display:flex">
      <div class="teacher-bubble__body" style="font-size:13px">
        <div>${escHtml(teacherInput)}</div>
        <div class="teacher-bubble__meta">
          <span style="font-size:10px;color:var(--txt3)">내 답변</span>
          <span style="font-weight:800;font-size:12px;color:${scCol}">${score}점</span>
        </div>
      </div>
      <div class="teacher-avatar" style="width:32px;height:32px;font-size:15px">🧑‍🏫</div>
    </div>`;
  wrap.appendChild(div);
}

/* ════════════════════════════════════════════════════
   키워드 자동 평가
   ════════════════════════════════════════════════════ */
function evaluateInput(text, turn) {
  let total = 0;
  for (const cfg of RUBRIC) {
    const hits = cfg.words.filter(w => text.includes(w));
    const raw  = Math.min(Math.abs(cfg.max), hits.length * Math.abs(cfg.perHit));
    total += cfg.penalty ? -raw : raw;
  }
  if (text.length < 20) total = Math.floor(total * 0.6);
  return Math.max(0, Math.min(100, total));
}

/* ════════════════════════════════════════════════════
   평가받기 버튼 (헤더)
   ════════════════════════════════════════════════════ */
function activateEvalBtn() {
  const btn = $('eval-btn');
  if (!btn) return;
  btn.style.opacity       = '1';
  btn.style.pointerEvents = 'auto';
  btn.title               = '지금까지의 전체 상담을 평가합니다';
}

function requestEval() {
  if (state.turnHistory.length === 0) return;
  // 현재 입력 중인 내용이 있으면 먼저 전송
  const text = $('teacher-textarea').value.trim();
  if (state.phase === 'input' && text.length >= 3) {
    submitResponse();
    // submitResponse 내부에서 isLast 여부에 따라 showEndScreen 호출됨
    return;
  }
  showEndScreen();
}

/* ════════════════════════════════════════════════════
   전체 평가 화면
   ════════════════════════════════════════════════════ */
function showEndScreen() {
  state.phase = 'complete';

  // 입력 영역 및 학부모 현재 말풍선 숨기기
  $('teacher-input-wrap').style.display = 'none';
  $('eval-panel').style.display         = 'none';
  $('model-panel').style.display        = 'none';
  $('next-btn').style.display           = 'none';
  $('teacher-bubble').style.display     = 'none';

  // 현재 학부모 발화도 히스토리로 이동 (마지막 미응답 발화 처리)
  const currentParentEl = $('parent-message');
  const currentParentMsg = currentParentEl.textContent;
  const alreadyLogged = state.turnHistory.some(h => h.parentMsg === currentParentMsg);
  if (!alreadyLogged && state.turnIndex < state.totalTurns) {
    // 입력 없이 평가받기를 누른 경우 현재 발화는 0점 처리
  }

  const avg = state.allScores.length
    ? Math.round(state.allScores.reduce((a, b) => a + b, 0) / state.allScores.length)
    : 0;

  const tColor = avg >= 80 ? 'var(--green)' : avg >= 60 ? 'var(--blue)' : avg >= 40 ? 'var(--yellow)' : 'var(--red)';
  const tHex   = avg >= 80 ? '#22c55e'  : avg >= 60 ? '#3b82f6'  : avg >= 40 ? '#f59e0b'  : '#ef4444';
  const tEmoji = avg >= 80 ? '🌟' : avg >= 60 ? '👍' : avg >= 40 ? '📚' : '💪';
  const tLabel = avg >= 80 ? '탁월한 상담' : avg >= 60 ? '양호한 상담' : avg >= 40 ? '개선 필요' : '성장 중';

  setText('end-emoji',   tEmoji);
  setText('end-score',   avg + '점');
  setText('end-summary', state.scenario.teachingPoint);

  const rgba  = {
    'var(--green)':  'rgba(34,197,94,',
    'var(--blue)':   'rgba(59,130,246,',
    'var(--yellow)': 'rgba(245,158,11,',
    'var(--red)':    'rgba(239,68,68,',
  }[tColor] || 'rgba(99,102,241,';
  const badge = $('end-label-badge');
  badge.style.background  = rgba + '0.12)';
  badge.style.borderColor = rgba + '0.35)';
  badge.style.color       = tColor;
  badge.textContent       = tLabel;
  $('end-score').style.color = tColor;

  // ── 턴별 점수 + 모범 답변 비교 ───────────────────
  const completedTurns = state.allScores.length;

  // 차트
  $('end-turn-chart').innerHTML = state.allScores.map((s, i) => {
    const c = s >= 70 ? '#22c55e' : s >= 40 ? '#f59e0b' : '#ef4444';
    const h = Math.max(6, (s / 100) * 48);
    return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;max-width:52px">
      <span style="font-size:11px;font-weight:800;color:${c}">${s}</span>
      <div style="width:100%;height:${h}px;background:${c};border-radius:3px;opacity:.85"></div>
      <span style="font-size:10px;color:var(--txt3)">${i+1}회</span>
    </div>`;
  }).join('');

  // ── 턴별 모범 답변 섹션 ──────────────────────────
  const modelSection = $('end-model-section');
  if (modelSection) {
    modelSection.innerHTML = state.turnHistory.map((h, i) => {
      const turn  = state.scenario.turns[i];
      if (!turn) return '';
      const sc    = h.score;
      const scCol = sc >= 70 ? '#22c55e' : sc >= 40 ? '#f59e0b' : '#ef4444';
      return `
      <div style="margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid var(--border2)">
        <div style="font-size:11px;color:var(--txt3);margin-bottom:8px;font-weight:700">
          ${i+1}번째 대화
          <span style="color:${scCol};margin-left:6px">${sc}점</span>
        </div>
        <div style="font-size:12px;color:var(--txt2);margin-bottom:6px;font-style:italic">
          학부모: "${escHtml(h.parentMsg.slice(0,60))}${h.parentMsg.length>60?'…':''}"
        </div>
        <div style="font-size:13px;color:var(--txt);padding:10px 14px;
                    background:rgba(99,102,241,.07);border-left:3px solid #6366f1;
                    border-radius:0 8px 8px 0;margin-bottom:6px;line-height:1.6">
          💬 모범: "${escHtml(turn.modelAnswer)}"
        </div>
        <div style="font-size:11px;color:var(--txt3)">${turn.tip}</div>
      </div>`;
    }).join('');
  }

  // 강점 / 개선점
  const sc2 = state.scenario;
  if (sc2.strengths?.length) {
    $('end-strengths-list').innerHTML = sc2.strengths.map(s => `<li>${s}</li>`).join('');
    $('end-strengths-section').style.display = 'block';
  } else { $('end-strengths-section').style.display = 'none'; }

  if (sc2.improvements?.length) {
    $('end-improvements-list').innerHTML = sc2.improvements.map(s => `<li>${s}</li>`).join('');
    $('end-improvements-section').style.display = 'block';
  } else { $('end-improvements-section').style.display = 'none'; }

  const doneOf = `${completedTurns}/${state.totalTurns}회 대화`;
  setText('end-next-practice',
    `${doneOf} 완료, 평균 ${avg}점. ` +
    (avg >= 70
      ? '훌륭합니다! 다음 단계 시나리오에 도전해보세요.'
      : '공감 표현(💛)과 후속 약속(📅)을 집중 연습해보세요.')
  );

  const es = $('end-screen');
  es.style.display = 'block';
  es.classList.remove('anim-pop-in');
  void es.offsetWidth;
  es.classList.add('anim-pop-in');
  setTimeout(() => es.scrollIntoView({ behavior:'smooth', block:'start' }), 150);

  saveResult(avg, tLabel);
}

/* ════════════════════════════════════════════════════
   재시작
   ════════════════════════════════════════════════════ */
function restartScenario() {
  state.turnIndex    = 0;
  state.emotionLevel = state.scenario.initialEmotion;
  state.phase        = 'input';
  state.turnHistory  = [];
  state.allScores    = [];

  ['end-screen','eval-panel','model-panel','teacher-bubble'].forEach(id => {
    $(id).style.display = 'none';
  });
  $('next-btn').style.display      = 'none';
  $('chat-history-wrap').innerHTML = '';

  // 평가받기 버튼 비활성화
  const btn = $('eval-btn');
  if (btn) {
    btn.style.opacity       = '.5';
    btn.style.pointerEvents = 'none';
  }

  updateEmotionBar(state.emotionLevel, true);
  renderTurn();
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ════════════════════════════════════════════════════
   공통 유틸
   ════════════════════════════════════════════════════ */
function updateProgress() {
  const el = $('turn-count');
  if (el) el.textContent = `${state.turnIndex + 1} / ${state.totalTurns}번째 대화`;
}

function updateEmotionBar(level, instant) {
  const hex   = level > 70 ? '#ef4444' : level > 40 ? '#f59e0b' : '#22c55e';
  const color = level > 70 ? 'var(--red)' : level > 40 ? 'var(--yellow)' : 'var(--green)';
  const label = level > 70 ? '격앙' : level > 40 ? '다소 불안' : '안정';

  const fill = $('emotion-fill');
  if (fill) {
    fill.style.transition      = instant ? 'none' : 'width .9s ease, background-color .9s ease';
    fill.style.width           = level + '%';
    fill.style.backgroundColor = hex;
  }
  const lEl = $('emotion-label');
  if (lEl) { lEl.textContent = label; lEl.style.color = color; }
  const vEl = $('emotion-value');
  if (vEl) { vEl.textContent = level; vEl.style.color = color; }
}

function setText(id, text) { const e = $(id); if (e) e.textContent = text; }

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
      <p style="color:var(--txt2)">${escHtml(msg)}</p>
      <a href="index.html" class="btn btn--ghost">← 홈으로</a>
    </div>`;
}

document.addEventListener('DOMContentLoaded', init);
