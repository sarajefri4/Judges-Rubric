/* ── Scoring Page ─────────────────────────────────────────────────────────── */
const CRITERIA = [
  {
    key: 'impact',
    label: 'Business Impact',
    weight: 0.30,
    desc: 'How meaningful, actionable, and relevant is the insight drawn from the data?',
    rubric: [
      'Insight is vague or disconnected from any real business problem; no actionable value demonstrated.',
      'Some relevance to a business need but linkage is weak; impact is implied rather than shown.',
      'Clear connection to a business problem; moderate practical value with a plausible use case.',
      'Strong business relevance; impact is well-articulated with measurable or concrete outcomes described.',
      'High-confidence, compelling impact; actionable next steps clearly defined with strong scalability or strategic value.',
    ],
  },
  {
    key: 'analysis',
    label: 'Quality of Analysis',
    weight: 0.25,
    desc: 'How effectively was the data explored and leveraged using Sigma to derive the insight?',
    rubric: [
      'Data barely explored; Sigma used minimally or incorrectly; insight is unsupported by the analysis.',
      'Some data exploration done but surface-level; Sigma features underutilized; methodology is unclear.',
      'Data explored reasonably well using Sigma; insight is grounded in the data with a clear methodology.',
      'Effective use of Sigma to explore and interrogate the data; analysis is rigorous and well-structured.',
      'Exceptional use of Sigma; deep, creative data exploration with a robust methodology that strongly supports the insight.',
    ],
  },
  {
    key: 'story',
    label: 'Storytelling & Presentation',
    weight: 0.30,
    desc: 'How clearly and compellingly is the insight communicated?',
    rubric: [
      'Insight is hard to follow; no clear narrative or structure; presentation is unpolished and difficult to engage with.',
      'Some structure present but the story feels incomplete or disjointed; presentation lacks confidence or clarity.',
      'Clear and logical narrative with a reasonably polished presentation; insight is communicated effectively.',
      'Compelling story with strong visual and verbal delivery; audience is engaged and the insight is well-presented.',
      'Exceptional storytelling and presentation; memorable, polished, and persuasive — the insight and delivery are outstanding.',
    ],
  },
  {
    key: 'feasibility',
    label: 'Feasibility',
    weight: 0.15,
    desc: 'Can this insight realistically be acted upon, and does the team understand its implications?',
    rubric: [
      'Insight cannot realistically be acted upon; team shows no understanding of real-world constraints.',
      'Some awareness of implementation but significant gaps; team struggles to explain practical application.',
      'Insight is actionable in principle; team demonstrates a reasonable understanding of its implications.',
      'Clearly actionable with a realistic path to implementation; team shows strong grasp of real-world applicability.',
      'Highly feasible and immediately applicable; team confidently addresses implications, constraints, and next steps.',
    ],
  },
];

const RUBRIC_LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

let session   = null;
let teams     = [];
let scoredMap = new Map(); // teamId → score object
let activeTeamId = null;

(async () => {
  session = await requireJudgeSession();
  if (!session) return;

  document.getElementById('header-title').textContent = session.judgeName;
  document.getElementById('header-sub').textContent   = 'April 22';

  document.getElementById('logout-btn').addEventListener('click', logout);

  try {
    await Promise.all([loadTeams(), loadMyScores()]);
  } catch (err) {
    document.getElementById('loading-state').innerHTML =
      `<p class="text-danger text-sm">Failed to load: ${escHtml(err.message)}</p>`;
    return;
  }

  renderTeamTabs();

  if (teams.length === 0) {
    document.getElementById('loading-state').innerHTML =
      '<p class="text-muted text-center">No teams configured yet. Contact admin.</p>';
    return;
  }

  // Activate first unscored team, or first team if all scored
  const firstUnscored = teams.find(t => !scoredMap.has(t.id));
  activateTeam((firstUnscored || teams[0])?.id);
})();

/* ── Load Data ───────────────────────────────────────────────────────────── */
async function loadTeams() {
  teams = await apiGet(`/api/days/${session.dayId}/teams`);
}

async function loadMyScores() {
  const scores = await apiGet('/api/scores/my-scores');
  scoredMap.clear();
  for (const s of scores) {
    scoredMap.set(s.team_id, s);
  }
}

/* ── Team Tabs ───────────────────────────────────────────────────────────── */
function renderTeamTabs() {
  const scroll = document.getElementById('teams-scroll');
  scroll.innerHTML = '';

  for (const team of teams) {
    const btn = document.createElement('button');
    btn.className = 'team-btn';
    btn.textContent = team.name;
    btn.dataset.teamId = team.id;
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', `${team.name}${scoredMap.has(team.id) ? ' (scored)' : ''}`);
    if (scoredMap.has(team.id)) btn.classList.add('scored');
    btn.addEventListener('click', () => activateTeam(team.id));
    scroll.appendChild(btn);
  }

  updateProgressPill();
}

function updateTeamTab(teamId) {
  const btn = document.querySelector(`.team-btn[data-team-id="${teamId}"]`);
  if (!btn) return;
  if (scoredMap.has(teamId)) {
    btn.classList.add('scored');
    btn.setAttribute('aria-label', `${teams.find(t => t.id === teamId)?.name} (scored)`);
  }
}

function setActiveTab(teamId) {
  for (const btn of document.querySelectorAll('.team-btn')) {
    btn.classList.remove('active');
    btn.removeAttribute('aria-current');
  }
  const active = document.querySelector(`.team-btn[data-team-id="${teamId}"]`);
  if (active) {
    active.classList.add('active');
    active.setAttribute('aria-current', 'true');
    active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }
}

function updateProgressPill() {
  const total = teams.length;
  const done  = scoredMap.size;
  document.getElementById('progress-pill').textContent = `${done}/${total} scored`;
}

/* ── Activate Team ───────────────────────────────────────────────────────── */
function activateTeam(teamId) {
  if (!teamId || !teams.find(t => t.id === teamId)) return;
  activeTeamId = teamId;
  setActiveTab(teamId);
  renderScoringPanel(teamId);
}

/* ── Scoring Panel ───────────────────────────────────────────────────────── */
function renderScoringPanel(teamId) {
  const team      = teams.find(t => t.id === teamId);
  const existing  = scoredMap.get(teamId) || null;
  const loading   = document.getElementById('loading-state');
  const panel     = document.getElementById('team-panel');

  loading.classList.add('hidden');
  panel.classList.remove('hidden');

  const allScored = teams.length > 0 && scoredMap.size === teams.length;

  panel.innerHTML = `
    ${allScored ? `
      <div class="all-scored-banner" role="status">
        <h3>All teams scored!</h3>
        <p>You've submitted scores for every team. You can still review and update any score by selecting a team above.</p>
      </div>
    ` : ''}

    <div class="team-heading">
      <h2>${escHtml(team.name)}</h2>
      ${existing
        ? '<span class="status-pill status-done">✓ Submitted</span>'
        : '<span class="status-pill status-none">Not yet scored</span>'
      }
    </div>

    <div id="criteria-container">
      ${CRITERIA.map(c => criterionCardHTML(c, existing ? existing[c.key] : 3)).join('')}
    </div>

    <div class="notes-section">
      <label for="notes-input">Notes <span class="text-muted text-sm">(optional)</span></label>
      <textarea
        id="notes-input"
        class="input"
        placeholder="Optional comments about this team's presentation…"
        rows="3"
        maxlength="1000"
      >${escHtml(existing?.notes || '')}</textarea>
    </div>
  `;

  // Wire up sliders
  for (const c of CRITERIA) {
    const slider  = document.getElementById(`slider-${c.key}`);
    const display = document.getElementById(`val-${c.key}`);
    initSlider(slider, display);
    slider.addEventListener('input', () => {
      updateTotal();
      updateRubricHighlight(c.key, parseInt(slider.value));
    });
    updateRubricHighlight(c.key, parseInt(existing ? existing[c.key] : 3));
  }

  updateTotal();

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.textContent = existing ? 'Update Score' : 'Submit Score';
  submitBtn.onclick     = submitScore;
}

function criterionCardHTML(c, value = 3) {
  const wLabel = `${Math.round(c.weight * 100)}%`;
  return `
    <div class="criterion-card">
      <div class="criterion-header">
        <span class="criterion-name">${escHtml(c.label)}</span>
        <span class="badge badge-accent">${wLabel}</span>
      </div>
      <p class="criterion-desc">${escHtml(c.desc)}</p>
      <details class="rubric-details">
        <summary class="rubric-summary">Scoring guide</summary>
        <div class="rubric-levels" id="rubric-${c.key}">
          ${c.rubric.map((desc, i) => `
            <div class="rubric-level" data-level="${i + 1}">
              <span class="rubric-badge rubric-lvl-${i + 1}">${i + 1} — ${RUBRIC_LABELS[i]}</span>
              <span class="rubric-level-desc">${escHtml(desc)}</span>
            </div>
          `).join('')}
        </div>
      </details>
      <div class="slider-row">
        <input
          type="range"
          id="slider-${c.key}"
          min="1" max="5" step="1"
          value="${value}"
          aria-label="${escHtml(c.label)} score"
          aria-valuemin="1"
          aria-valuemax="5"
          aria-valuenow="${value}"
        >
        <span class="slider-value" id="val-${c.key}" aria-live="polite">${parseInt(value)}</span>
      </div>
      <div class="slider-ticks" aria-hidden="true">
        <span>1<br><small>Poor</small></span>
        <span>2<br><small>Fair</small></span>
        <span>3<br><small>Good</small></span>
        <span>4<br><small>Very good</small></span>
        <span>5<br><small>Excellent</small></span>
      </div>
    </div>
  `;
}

function updateRubricHighlight(key, level) {
  const container = document.getElementById(`rubric-${key}`);
  if (!container) return;
  for (const row of container.querySelectorAll('.rubric-level')) {
    const rowLevel = parseInt(row.dataset.level);
    row.classList.toggle('rubric-active', rowLevel === level);
  }
}

/* ── Update Total ────────────────────────────────────────────────────────── */
function updateTotal() {
  const vals = {};
  for (const c of CRITERIA) {
    vals[c.key] = parseFloat(document.getElementById(`slider-${c.key}`)?.value || 0);
    const slider = document.getElementById(`slider-${c.key}`);
    if (slider) slider.setAttribute('aria-valuenow', vals[c.key]);
  }
  const total = calcTotal(vals.impact, vals.analysis, vals.story, vals.feasibility);
  document.getElementById('total-display').textContent = total.toFixed(1);
}

/* ── Submit Score ────────────────────────────────────────────────────────── */
async function submitScore() {
  const btn   = document.getElementById('submit-btn');
  const team  = teams.find(t => t.id === activeTeamId);
  if (!team) return;

  const payload = {
    teamId:      activeTeamId,
    notes:       document.getElementById('notes-input')?.value || '',
  };
  for (const c of CRITERIA) {
    payload[c.key] = parseFloat(document.getElementById(`slider-${c.key}`)?.value || 0);
  }

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Saving…';

  try {
    const result = await apiPost('/api/scores', payload);
    scoredMap.set(activeTeamId, { ...payload, total: result.total });
    updateTeamTab(activeTeamId);
    updateProgressPill();

    const pill = document.querySelector('.team-heading .status-pill');
    if (pill) {
      pill.className = 'status-pill status-done';
      pill.textContent = '✓ Submitted';
    }

    showToast(`Score saved! ${team.name}: ${result.total.toFixed(1)}/100`);
    btn.textContent = 'Update Score';

    const next = teams.find(t => !scoredMap.has(t.id) && t.id !== activeTeamId);
    if (next) {
      setTimeout(() => activateTeam(next.id), 600);
    } else if (teams.every(t => scoredMap.has(t.id))) {
      setTimeout(() => renderScoringPanel(activeTeamId), 600);
    }
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

/* ── Logout ──────────────────────────────────────────────────────────────── */
async function logout() {
  try {
    await apiPost('/api/auth/logout', {});
  } finally {
    window.location.href = '/';
  }
}

/* ── HTML Escape ─────────────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
