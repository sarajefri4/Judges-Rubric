/* ── Admin Setup Page ─────────────────────────────────────────────────────── */
(async () => {
  const session = await getSession();
  if (session && session.type === 'admin') {
    showSetup();
  } else {
    document.getElementById('pin-modal').classList.remove('hidden');
  }

  document.getElementById('pin-form').addEventListener('submit', async e => {
    e.preventDefault();
    const pin   = document.getElementById('admin-pin').value.trim();
    const errEl = document.getElementById('pin-error');
    const btn   = document.getElementById('pin-submit');
    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Checking…';
    try {
      await apiPost('/api/auth/admin', { pin });
      document.getElementById('pin-modal').classList.add('hidden');
      showSetup();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Unlock';
    }
  });

  document.getElementById('admin-pin').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('pin-form').requestSubmit();
  });
})();

async function showSetup() {
  document.getElementById('setup-ui').classList.remove('hidden');
  document.getElementById('save-bar').classList.remove('hidden');
  await loadConfig();
}

/* ── State ───────────────────────────────────────────────────────────────── */
let state = { eventName: 'DATATHON', theme: 'green', rubric: [], days: [], teams: [], judges: [] };

async function loadConfig() {
  try {
    const [settings, config] = await Promise.all([
      apiGet('/api/admin/settings'),
      apiGet('/api/admin/config'),
    ]);
    state.eventName = settings.eventName || 'DATATHON';
    state.theme     = settings.theme     || 'green';
    state.rubric    = settings.rubric    || [];
    state.days      = config.days        || [];
    state.teams     = config.teams       || [];
    state.judges    = config.judges      || [];
    renderGeneralSettings();
    renderDays();
    renderRubric();
  } catch (err) {
    showToast('Failed to load configuration: ' + err.message, 'error');
  }
}

/* ── Section 1: General Settings ────────────────────────────────────────── */
function renderGeneralSettings() {
  document.getElementById('event-name-input').value = state.eventName;
  applyTheme(state.theme);
  for (const btn of document.querySelectorAll('.theme-swatch')) {
    const isActive = btn.dataset.theme === state.theme;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }
}

// Wire theme swatches
document.getElementById('theme-switcher').addEventListener('click', e => {
  const swatch = e.target.closest('.theme-swatch');
  if (!swatch) return;
  const theme = swatch.dataset.theme;
  state.theme = theme;
  applyTheme(theme);
  for (const btn of document.querySelectorAll('.theme-swatch')) {
    const isActive = btn.dataset.theme === theme;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }
});

/* ── Section 2: Days, Teams & Judges ────────────────────────────────────── */
function renderDays() {
  const container = document.getElementById('days-container');
  container.innerHTML = '';
  for (const day of state.days) {
    const dayTeams  = state.teams.filter(t => t.day_id === day.id);
    const dayJudges = state.judges.filter(j => j.day_id === day.id);
    container.appendChild(createDaySection(day, dayTeams, dayJudges));
  }
}

function createDaySection(day, dayTeams, dayJudges) {
  const section = document.createElement('section');
  section.className = 'day-section';
  section.dataset.dayId = day.id;

  section.innerHTML = `
    <div class="panel">
      <div class="day-edit-header">
        <input type="text" class="input day-name-input" value="${escHtml(day.name)}"
          placeholder="Day name" maxlength="60" aria-label="Day name">
        <input type="text" class="input day-date-input" value="${escHtml(day.date)}"
          placeholder="Date (e.g. April 20)" maxlength="40" aria-label="Day date">
        <button class="btn btn-ghost btn-icon delete-day-btn" type="button"
          aria-label="Delete this day" title="Delete day">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:8px;">
        <div>
          <p class="subsection-label">Teams</p>
          <div class="item-list" id="teams-${day.id}"></div>
          <button class="btn btn-ghost btn-sm mt-12" type="button" data-add-team="${day.id}">+ Add Team</button>
        </div>
        <div>
          <p class="subsection-label">Judges</p>
          <div class="item-list" id="judges-${day.id}"></div>
          <button class="btn btn-ghost btn-sm mt-12" type="button" data-add-judge="${day.id}">+ Add Judge</button>
        </div>
      </div>
    </div>
  `;

  // Wire delete day
  section.querySelector('.delete-day-btn').addEventListener('click', () => deleteDay(day.id, section));
  section.querySelector(`[data-add-team]`).addEventListener('click', () =>
    document.getElementById(`teams-${day.id}`).appendChild(createTeamRow(day.id)));
  section.querySelector(`[data-add-judge]`).addEventListener('click', () =>
    document.getElementById(`judges-${day.id}`).appendChild(createJudgeRow(day.id)));

  const teamsList  = section.querySelector(`#teams-${day.id}`);
  const judgesList = section.querySelector(`#judges-${day.id}`);

  for (const t of dayTeams)  teamsList.appendChild(createTeamRow(day.id, t));
  for (const j of dayJudges) judgesList.appendChild(createJudgeRow(day.id, j));

  return section;
}

async function deleteDay(dayId, sectionEl) {
  const confirmed = window.confirm('Delete this day and all its teams, judges, and scores?');
  if (!confirmed) return;
  try {
    await apiFetch(`/api/admin/days/${dayId}`, { method: 'DELETE' });
    sectionEl.remove();
    // Remove from local state
    state.days   = state.days.filter(d => d.id !== dayId);
    state.teams  = state.teams.filter(t => t.day_id !== dayId);
    state.judges = state.judges.filter(j => j.day_id !== dayId);
    showToast('Day deleted');
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

// Add new day button
document.getElementById('add-day-btn').addEventListener('click', async () => {
  const nameEl = document.getElementById('new-day-name');
  const dateEl = document.getElementById('new-day-date');
  const name   = nameEl.value.trim();
  const date   = dateEl.value.trim();
  if (!name || !date) { showToast('Enter both a day name and date', 'error'); return; }
  try {
    const result = await apiPost('/api/admin/days', { name, date });
    const newDay = { id: result.id, name, date };
    state.days.push(newDay);
    document.getElementById('days-container').appendChild(createDaySection(newDay, [], []));
    nameEl.value = '';
    dateEl.value = '';
    showToast('Day added');
  } catch (err) {
    showToast('Failed to add day: ' + err.message, 'error');
  }
});

function createTeamRow(dayId, team = null) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.dataset.dayId = dayId;
  if (team) row.dataset.teamId = team.id;

  row.innerHTML = `
    <input type="text" class="input" placeholder="Team name"
      value="${team ? escHtml(team.name) : ''}" aria-label="Team name" maxlength="80">
    <button class="btn btn-ghost btn-icon" type="button" title="Remove" aria-label="Remove team">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;
  row.querySelector('button').addEventListener('click', () => row.remove());
  return row;
}

function createJudgeRow(dayId, judge = null) {
  const row = document.createElement('div');
  row.className = 'item-row judge-row';
  row.style.flexWrap = 'wrap';
  row.dataset.dayId = dayId;
  if (judge) row.dataset.judgeId = judge.id;

  const hasPinBadge = judge ? '<span class="has-pin-badge">has PIN</span>' : '';

  row.innerHTML = `
    <input type="text" class="input" placeholder="Judge name"
      value="${judge ? escHtml(judge.name) : ''}" aria-label="Judge name" maxlength="80"
      style="flex:1;min-width:120px;">
    <div class="pin-field-wrap" style="flex:1;min-width:100px;">
      <input type="password" class="input judge-pin-input" placeholder="${judge ? 'New PIN (leave blank to keep)' : 'PIN (optional)'}"
        maxlength="20" aria-label="Judge PIN" autocomplete="off" style="flex:1;">
      <button class="toggle-pin" type="button" aria-label="Show/hide PIN" tabindex="-1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
      ${hasPinBadge}
    </div>
    <button class="btn btn-ghost btn-icon" type="button" title="Remove" aria-label="Remove judge">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  row.querySelector('.toggle-pin').addEventListener('click', () => {
    const pinInput = row.querySelector('.judge-pin-input');
    pinInput.type = pinInput.type === 'password' ? 'text' : 'password';
  });
  row.querySelector('[aria-label="Remove judge"]').addEventListener('click', () => row.remove());
  return row;
}

/* ── Section 3: Scoring Rubric ──────────────────────────────────────────── */
function renderRubric() {
  const container = document.getElementById('rubric-container');
  container.innerHTML = '';

  for (const c of state.rubric) {
    container.appendChild(createCriterionCard(c));
  }
  updateWeightTotal();
}

function createCriterionCard(c) {
  const card = document.createElement('div');
  card.className = 'rubric-criterion';
  card.dataset.key = c.key;

  const subPointsHtml = (c.subPoints || []).map((p, i) => `
    <div class="subpoint-row" data-idx="${i}">
      <input type="text" class="input subpoint-input" value="${escHtml(p)}"
        placeholder="Sub-point" maxlength="120" aria-label="Sub-point ${i + 1}">
      <button class="btn btn-ghost btn-icon remove-subpoint" type="button" aria-label="Remove sub-point">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');

  const LEVEL_LABELS = ['Poor (0)', 'Fair (2.5)', 'Good (5)', 'Very good (7.5)', 'Excellent (10)'];
  const ratingsHtml = (c.ratings || []).slice(0, 5).map((r, i) => `
    <div class="rating-row">
      <span class="rating-num">${LEVEL_LABELS[i]?.split(' ')[0] || (i + 1)}</span>
      <input type="text" class="input rating-input" value="${escHtml(r)}"
        placeholder="${LEVEL_LABELS[i] || ''}" maxlength="150" aria-label="Rating level ${i + 1}">
    </div>
  `).join('');

  card.innerHTML = `
    <div class="rubric-criterion-top">
      <div>
        <p class="subsection-label" style="margin-bottom:6px;">Category Title</p>
        <input type="text" class="input criterion-label" value="${escHtml(c.label)}"
          placeholder="Category name" maxlength="60" aria-label="Category title">
      </div>
      <div class="rubric-weight-wrap">
        <div>
          <p class="subsection-label" style="margin-bottom:6px;">Weight</p>
          <div style="display:flex;align-items:center;gap:4px;">
            <input type="number" class="input criterion-weight" value="${c.weight}"
              min="0" max="100" step="1" aria-label="${escHtml(c.label)} weight">
            <span class="text-muted" style="font-size:0.9rem;">%</span>
          </div>
        </div>
      </div>
    </div>

    <p class="subsection-label" style="margin-bottom:6px;">Description</p>
    <textarea class="input criterion-desc" rows="2" maxlength="300"
      placeholder="Category description" aria-label="Category description"
      style="resize:vertical;">${escHtml(c.desc)}</textarea>

    <p class="subsection-label" style="margin:12px 0 6px;">Sub-points</p>
    <div class="subpoints-list">${subPointsHtml}</div>
    <button class="btn btn-ghost btn-sm mt-8 add-subpoint" type="button">+ Add sub-point</button>

    <p class="subsection-label" style="margin:12px 0 6px;">Rating descriptions <span class="text-muted text-sm">(0 → 10)</span></p>
    <div class="ratings-list">${ratingsHtml}</div>
  `;

  card.querySelector('.add-subpoint').addEventListener('click', () => {
    const list = card.querySelector('.subpoints-list');
    const idx  = list.children.length;
    const div  = document.createElement('div');
    div.className = 'subpoint-row';
    div.innerHTML = `
      <input type="text" class="input subpoint-input" value="" placeholder="Sub-point" maxlength="120" aria-label="Sub-point">
      <button class="btn btn-ghost btn-icon remove-subpoint" type="button" aria-label="Remove sub-point">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    div.querySelector('.remove-subpoint').addEventListener('click', () => div.remove());
    list.appendChild(div);
  });

  card.querySelectorAll('.remove-subpoint').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.subpoint-row').remove());
  });

  card.querySelector('.criterion-weight').addEventListener('input', updateWeightTotal);

  return card;
}

function updateWeightTotal() {
  let total = 0;
  for (const el of document.querySelectorAll('.criterion-weight')) {
    total += parseInt(el.value || 0, 10);
  }
  const display = document.getElementById('weight-total-display');
  display.innerHTML = `<span class="weight-total ${total === 100 ? 'ok' : 'bad'}">
    Weights total: ${total}/100${total === 100 ? ' ✓' : ' — must equal 100'}
  </span>`;
}

/* ── Save ────────────────────────────────────────────────────────────────── */
document.getElementById('save-btn')?.addEventListener('click', saveConfig);

async function saveConfig() {
  const btn      = document.getElementById('save-btn');
  const statusEl = document.getElementById('save-status');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving…';
  statusEl.textContent = '';

  try {
    // Collect general settings
    const eventName = document.getElementById('event-name-input').value.trim() || 'DATATHON';
    const theme     = document.querySelector('.theme-swatch.active')?.dataset.theme || 'green';

    // Collect rubric
    const rubric = collectRubric();
    const weightSum = rubric.reduce((s, c) => s + c.weight, 0);
    if (weightSum !== 100) {
      showToast(`Rubric weights must sum to 100 (currently ${weightSum})`, 'error');
      return;
    }

    // Collect days / teams / judges
    const days = collectDays();

    await Promise.all([
      apiPost('/api/admin/settings', { eventName, theme, rubric }),
      apiPost('/api/admin/setup', { days }),
    ]);

    applyTheme(theme);
    showToast('Configuration saved!');
    statusEl.textContent = 'Saved ✓';
    await loadConfig();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
    statusEl.textContent = 'Save failed';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
      </svg>
      Save Configuration`;
  }
}

function collectRubric() {
  const rubric = [];
  for (const card of document.querySelectorAll('.rubric-criterion')) {
    const key    = card.dataset.key;
    const label  = card.querySelector('.criterion-label').value.trim();
    const weight = parseInt(card.querySelector('.criterion-weight').value || 0, 10);
    const desc   = card.querySelector('.criterion-desc').value.trim();

    const subPoints = [];
    for (const inp of card.querySelectorAll('.subpoint-input')) {
      const v = inp.value.trim();
      if (v) subPoints.push(v);
    }

    const ratings = [];
    for (const inp of card.querySelectorAll('.rating-input')) {
      ratings.push(inp.value.trim());
    }

    rubric.push({ key, label, weight, desc, subPoints, ratings });
  }
  return rubric;
}

function collectDays() {
  const days = [];
  for (const section of document.querySelectorAll('.day-section')) {
    const dayId   = parseInt(section.dataset.dayId, 10);
    const name    = section.querySelector('.day-name-input').value.trim();
    const date    = section.querySelector('.day-date-input').value.trim();
    const teams   = [];
    const judges  = [];

    for (const row of section.querySelectorAll(`#teams-${dayId} .item-row`)) {
      const n  = row.querySelector('input[type="text"]').value.trim();
      const id = row.dataset.teamId ? parseInt(row.dataset.teamId, 10) : undefined;
      if (n) teams.push({ id, name: n });
    }

    for (const row of section.querySelectorAll(`#judges-${dayId} .item-row`)) {
      const nameInp = row.querySelector('input[type="text"]');
      const pinInp  = row.querySelector('.judge-pin-input');
      const n       = nameInp?.value.trim();
      const pin     = pinInp?.value.trim() || undefined;
      const id      = row.dataset.judgeId ? parseInt(row.dataset.judgeId, 10) : undefined;
      if (n) judges.push({ id, name: n, pin });
    }

    days.push({ dayId, name, date, teams, judges });
  }
  return days;
}

/* ── HTML Escape ─────────────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
