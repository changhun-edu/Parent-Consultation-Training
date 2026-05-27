/* =====================================================
   home.js  –  시나리오 목록 페이지 로직
   ===================================================== */

const DIFFICULTY_LABEL = { 1: '⭐ 초급', 2: '⭐⭐ 중급', 3: '⭐⭐⭐ 고급' };

let allScenarios = [];
let activeFilter = 'all';

/* ── 초기화 ─────────────────────────────────────────── */
async function init() {
  await loadScenarios();
  renderStats();
  renderScenarios(allScenarios);
  bindFilters();
  renderHistoryPreview();
}

/* ── 시나리오 로드 ──────────────────────────────────── */
async function loadScenarios() {
  try {
    const res  = await fetch('data/scenarios.json');
    const data = await res.json();
    allScenarios = data.scenarios;
  } catch (e) {
    document.getElementById('scenario-grid').innerHTML =
      '<p style="color:var(--txt3);text-align:center;padding:40px">시나리오를 불러올 수 없습니다.</p>';
  }
}

/* ── 통계 렌더링 ────────────────────────────────────── */
function renderStats() {
  const history = getHistory();
  const total   = history.length;
  const avg     = total ? Math.round(history.reduce((a, h) => a + h.score, 0) / total) : 0;
  const best    = total ? Math.max(...history.map(h => h.score)) : 0;

  setEl('stat-total',    total + '회');
  setEl('stat-avg',      total ? avg + '점' : '-');
  setEl('stat-best',     total ? best + '점' : '-');
  setEl('stat-scenarios', allScenarios.length + '개');
}

/* ── 시나리오 카드 렌더링 ───────────────────────────── */
function renderScenarios(list) {
  const grid = document.getElementById('scenario-grid');
  if (!list.length) {
    grid.innerHTML = '<p style="color:var(--txt3);text-align:center;padding:40px">해당 카테고리의 시나리오가 없습니다.</p>';
    return;
  }

  grid.innerHTML = list.map((s, i) => {
    const history    = getHistory();
    const done       = history.filter(h => h.scenarioId === s.id);
    const bestScore  = done.length ? Math.max(...done.map(h => h.score)) : null;
    const scoreColor = bestScore == null ? '' :
                       bestScore >= 80 ? 'var(--green)' :
                       bestScore >= 60 ? 'var(--blue)'  :
                       bestScore >= 40 ? 'var(--yellow)' : 'var(--red)';

    return `
    <article class="scenario-card card card--hover anim-fade-in"
             style="animation-delay:${i * 60}ms; cursor:pointer;"
             onclick="startScenario('${s.id}')"
             role="button" tabindex="0"
             onkeydown="if(event.key==='Enter')startScenario('${s.id}')">

      <div class="scenario-card__top">
        <div class="scenario-card__meta">
          <span class="cat-icon" style="font-size:20px">${s.categoryIcon}</span>
          <span class="badge badge--d${s.difficulty}">${DIFFICULTY_LABEL[s.difficulty]}</span>
          ${bestScore != null ? `<span class="badge" style="background:${scoreColor}18;border:1px solid ${scoreColor}30;color:${scoreColor}">최고 ${bestScore}점</span>` : ''}
        </div>
        <div class="scenario-card__cat" style="color:${s.categoryColor}">${s.category}</div>
      </div>

      <h3 class="scenario-card__title">${s.title}</h3>
      <p class="scenario-card__situation">${s.situation}</p>

      <div class="scenario-card__opening">
        <span class="scenario-card__opening-icon">💬</span>
        <span class="scenario-card__opening-text">"${s.turns[0].parentMessage.slice(0, 60)}…"</span>
      </div>

      <div class="scenario-card__footer">
        <span style="font-size:12px;color:var(--txt3)">👤 ${s.parentName}</span>
        <span class="btn btn--primary btn--sm">시작하기 →</span>
      </div>
    </article>`;
  }).join('');
}

/* ── 카테고리 필터 ──────────────────────────────────── */
function bindFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filtered = activeFilter === 'all'
        ? allScenarios
        : allScenarios.filter(s => s.category === activeFilter);
      renderScenarios(filtered);
    });
  });
}

/* ── 최근 기록 미리보기 ─────────────────────────────── */
function renderHistoryPreview() {
  const history = getHistory().slice(-3).reverse();
  const el = document.getElementById('history-preview');
  if (!el) return;

  if (!history.length) {
    el.innerHTML = '<p style="color:var(--txt3);font-size:13px;text-align:center;padding:16px 0">아직 상담 기록이 없습니다. 첫 시나리오를 시작해보세요!</p>';
    return;
  }

  el.innerHTML = history.map(h => {
    const sc = allScenarios.find(s => s.id === h.scenarioId);
    const scoreColor = h.score >= 80 ? 'var(--green)' : h.score >= 60 ? 'var(--blue)' : h.score >= 40 ? 'var(--yellow)' : 'var(--red)';
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg2);border:1px solid var(--border2);border-radius:10px;margin-bottom:8px">
      <span style="font-size:20px">${sc ? sc.categoryIcon : '📋'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h.title}</div>
        <div style="font-size:11px;color:var(--txt3)">${h.date} · ${h.label}</div>
      </div>
      <div style="font-size:18px;font-weight:800;color:${scoreColor}">${h.score}점</div>
    </div>`;
  }).join('');
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
  renderScenarios(allScenarios);
}

document.addEventListener('DOMContentLoaded', init);
