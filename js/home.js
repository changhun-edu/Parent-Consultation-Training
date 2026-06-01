/* =====================================================
   home.js  –  시나리오 목록 페이지 로직
   (index.html 라이트 테마 구조에 맞춤)
   ===================================================== */

const DIFF_COLOR = { '일반': 'green', '민감': 'yellow', '고난도': 'red' };
const DIFF_LABEL = { '일반': '일반 상황', '민감': '민감 상황', '고난도': '고난도 민원' };
const DIFF_TURNS = { '일반': 6, '민감': 9, '고난도': 12 };

let allScenarios = [];
let filterDiff = 'all';
let filterCat  = 'all';

/* ── 초기화 ─────────────────────────────────────────── */
async function init() {
  await loadScenarios();
  renderStats();
  render();
  setupChips('filter-diff', val => { filterDiff = val; render(); });
  setupChips('filter-cat',  val => { filterCat  = val; render(); });
  renderHistoryPreview();
}

/* ── 시나리오 로드 ──────────────────────────────────── */
async function loadScenarios() {
  try {
    const res  = await fetch('scenarios.json');
    const data = await res.json();
    allScenarios = data.scenarios;
  } catch (e) {
    document.getElementById('scenario-grid').innerHTML =
      `<div class="state-box">
        <div class="state-icon">⚠️</div>
        <div class="state-title">시나리오를 불러올 수 없습니다</div>
        <div class="state-sub">scenarios.json 파일이 같은 폴더에 있는지 확인해 주세요.</div>
      </div>`;
  }
}

/* ── 통계 렌더링 ────────────────────────────────────── */
function renderStats() {
  const history = getHistory();
  const done    = history.length;
  const avg     = done ? Math.round(history.reduce((a, h) => a + h.score, 0) / done) : null;
  const best    = done ? Math.max(...history.map(h => h.score)) : null;

  setEl('stat-total',     allScenarios.length + '개');
  setEl('stat-scenarios', done + '회');

  const avgEl  = document.getElementById('stat-avg');
  const bestEl = document.getElementById('stat-best');
  if (avgEl)  { avgEl.textContent  = avg  != null ? avg  + '점' : '아직 없음'; avgEl.classList.toggle('empty',  avg  == null); }
  if (bestEl) { bestEl.textContent = best != null ? best + '점' : '아직 없음'; bestEl.classList.toggle('empty', best == null); }
}

/* ── 시나리오 카드 렌더링 ───────────────────────────── */
function render() {
  const grid = document.getElementById('scenario-grid');
  let list = allScenarios;
  if (filterDiff !== 'all') list = list.filter(s => s.scenarioType === filterDiff);
  if (filterCat  !== 'all') list = list.filter(s => s.category === filterCat);

  if (!list.length) {
    grid.innerHTML = `<div class="state-box">
      <div class="state-icon">🔍</div>
      <div class="state-title">해당하는 시나리오가 없습니다</div>
      <div class="state-sub">필터 조건을 변경해 보세요</div>
    </div>`;
    return;
  }

  grid.innerHTML = list.map((s, i) => {
    const col   = DIFF_COLOR[s.scenarioType] || 'green';
    const lbl   = DIFF_LABEL[s.scenarioType] || '일반 상황';
    const turns = DIFF_TURNS[s.scenarioType] || 6;

    const history   = getHistory();
    const done      = history.filter(h => h.scenarioId === s.id);
    const bestScore = done.length ? Math.max(...done.map(h => h.score)) : null;
    const scoreCol  = bestScore == null ? '' :
                      bestScore >= 80 ? 'var(--green)' :
                      bestScore >= 60 ? 'var(--teal)'  :
                      bestScore >= 40 ? 'var(--yellow)' : 'var(--red)';

    const stars = s.difficulty === 1 ? '⭐' : s.difficulty === 2 ? '⭐⭐' : '⭐⭐⭐';

    return `<div class="scenario-card ${col} fade-in" style="animation-delay:${i * 0.05}s">
      <div class="scenario-card-top">
        <span class="scenario-diff-badge ${col}">${lbl}</span>
        <span class="scenario-cat-badge">${s.categoryIcon || ''} ${s.category}</span>
        <span class="scenario-turns">${turns}턴</span>
      </div>
      <div class="scenario-title">${s.title}</div>
      <div class="scenario-desc">${s.situation || ''}</div>
      ${bestScore != null ? `<div style="margin-top:6px;font-size:12px;color:${scoreCol};font-weight:700">🏆 최고 ${bestScore}점</div>` : ''}
      <button class="scenario-start-btn" onclick="startScenario('${s.id}')">
        시작하기 →
      </button>
    </div>`;
  }).join('');
}

/* ── 최근 기록 미리보기 ─────────────────────────────── */
function renderHistoryPreview() {
  const history = getHistory().slice(-3).reverse();
  const el = document.getElementById('history-preview');
  if (!el) return;

  if (!history.length) {
    el.innerHTML = `<div class="history-empty-icon">📭</div>
      <div class="history-empty-text">
        아직 상담 기록이 없습니다.<br>
        첫 시나리오를 선택해서 상담을 시작해 보세요!
      </div>`;
    return;
  }

  el.className = '';  // history-empty 클래스 제거
  el.style.cssText = 'margin-top:0';
  el.innerHTML = history.map(h => {
    const sc = allScenarios.find(s => s.id === h.scenarioId);
    const scoreColor = h.score >= 80 ? 'var(--green)' : h.score >= 60 ? 'var(--teal)' : h.score >= 40 ? 'var(--yellow)' : 'var(--red)';
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;box-shadow:var(--card-shadow)">
      <span style="font-size:22px">${sc ? (sc.categoryIcon || '📋') : '📋'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h.title || sc?.title || '상담 기록'}</div>
        <div style="font-size:12px;color:var(--muted)">${h.date || ''} · ${h.label || ''}</div>
      </div>
      <div style="font-size:20px;font-weight:800;color:${scoreColor}">${h.score}점</div>
    </div>`;
  }).join('');
}

/* ── 칩 필터 설정 ────────────────────────────────────── */
function setupChips(groupId, onSelect) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      group.querySelectorAll('.chip').forEach(c => {
        c.classList.remove('active', 'green', 'yellow', 'red');
      });
      chip.classList.add('active');
      const col = chip.dataset.color;
      if (col) chip.classList.add(col);
      onSelect(chip.dataset.val);
    });
  });
}

/* ── 시나리오 시작 ──────────────────────────────────── */
function startScenario(id) {
  location.href = `training.html?id=${id}`;
}

/* ── localStorage 유틸 ──────────────────────────────── */
function getHistory() {
  try { return JSON.parse(localStorage.getItem('ct_history') || '[]'); }
  catch { return []; }
}

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ── 기록 초기화 ────────────────────────────────────── */
function clearHistory() {
  if (!confirm('모든 상담 기록을 초기화할까요?')) return;
  localStorage.removeItem('ct_history');
  renderStats();
  renderHistoryPreview();
}

document.addEventListener('DOMContentLoaded', init);
