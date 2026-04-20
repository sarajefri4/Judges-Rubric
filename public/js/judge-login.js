/* ── Judge Login ──────────────────────────────────────────────────────────── */
let selectedDayId = null;

(async () => {
  const session = await getSession();
  if (session && session.type === 'judge') {
    window.location.href = '/score';
    return;
  }

  loadDays();

  document.getElementById('back-to-day').addEventListener('click', () => goToStep('day'));
})();

/* ── Step Navigation ─────────────────────────────────────────────────────── */
function goToStep(name) {
  for (const el of document.querySelectorAll('.step')) {
    el.classList.remove('active');
  }
  document.getElementById(`step-${name}`).classList.add('active');
  updateStepIndicator(name);
  const first = document.getElementById(`step-${name}`).querySelector('input, button, [tabindex]');
  first?.focus();
}

function updateStepIndicator(step) {
  const steps  = ['day', 'judge'];
  const labels = { day: 'Select your day', judge: 'Select your name' };
  const idx    = steps.indexOf(step);

  for (let i = 0; i < 2; i++) {
    const dot = document.getElementById(`dot-${i + 1}`);
    dot.classList.remove('active', 'done');
    if (i < idx)  dot.classList.add('done');
    if (i === idx) dot.classList.add('active');
  }
  document.getElementById('step-label').textContent = labels[step] || '';
}

/* ── Load Days ───────────────────────────────────────────────────────────── */
async function loadDays() {
  const container = document.getElementById('day-cards');
  container.innerHTML = '<div class="spinner" aria-label="Loading days"></div>';

  try {
    const days = await apiGet('/api/days');
    if (days.length === 0) {
      container.innerHTML = '<p class="text-muted text-center">No days configured. Contact admin.</p>';
      return;
    }

    container.innerHTML = '';
    for (const day of days) {
      const card = document.createElement('div');
      card.className  = 'day-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `${day.name}, ${day.date}`);
      card.innerHTML = `
        <div class="day-card-name">${escHtml(day.name)}</div>
        <div class="day-card-date">${escHtml(day.date)}</div>
      `;
      card.addEventListener('click', () => selectDay(day));
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectDay(day); });
      container.appendChild(card);
    }
  } catch (err) {
    container.innerHTML = `<p class="text-danger text-sm">Failed to load: ${escHtml(err.message)}</p>`;
  }
}

/* ── Select Day ──────────────────────────────────────────────────────────── */
async function selectDay(day) {
  selectedDayId = day.id;

  for (const c of document.querySelectorAll('.day-card')) {
    c.classList.remove('selected');
  }
  event?.currentTarget?.classList.add('selected');

  document.getElementById('judges-day-label').textContent = `${day.name} — ${day.date}`;
  goToStep('judge');
  loadJudges(day.id);
}

/* ── Load Judges ─────────────────────────────────────────────────────────── */
async function loadJudges(dayId) {
  const grid = document.getElementById('judge-grid');
  grid.innerHTML = '<div class="spinner" aria-label="Loading judges"></div>';

  try {
    const judges = await apiGet(`/api/days/${dayId}/judges`);
    if (judges.length === 0) {
      grid.innerHTML = '<p class="text-muted text-center">No judges configured for this day. Contact admin.</p>';
      return;
    }

    grid.innerHTML = '';
    for (const judge of judges) {
      const card = document.createElement('div');
      card.className  = 'judge-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', judge.name);
      card.innerHTML  = `<span class="judge-card-name">${escHtml(judge.name)}</span>`;
      card.addEventListener('click', () => selectJudge(judge, card));
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectJudge(judge, card); });
      grid.appendChild(card);
    }
  } catch (err) {
    grid.innerHTML = `<p class="text-danger text-sm">Failed to load: ${escHtml(err.message)}</p>`;
  }
}

/* ── Select Judge & Login ─────────────────────────────────────────────────── */
async function selectJudge(judge, cardEl) {
  const errEl = document.getElementById('judge-error');
  errEl.classList.add('hidden');

  for (const c of document.querySelectorAll('.judge-card')) {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
    c.style.pointerEvents = 'none';
  }
  cardEl.classList.add('selected');
  cardEl.setAttribute('aria-pressed', 'true');
  cardEl.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span><span class="judge-card-name">${escHtml(judge.name)}</span>`;

  try {
    await apiPost('/api/auth/judge', { judgeId: judge.id });
    window.location.href = '/score';
  } catch (err) {
    errEl.textContent = `Sign-in failed: ${err.message}. Please try again or contact the admin.`;
    errEl.classList.remove('hidden');
    // Restore cards
    cardEl.innerHTML = `<span class="judge-card-name">${escHtml(judge.name)}</span>`;
    for (const c of document.querySelectorAll('.judge-card')) {
      c.style.pointerEvents = '';
    }
  }
}

/* ── HTML Escape ─────────────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
