// Mini-game: a random Pokédex number is given, name the Pokémon you think has that number.
// Relies on globals from script.js (nationalEntries, norm, nameOf, spriteUrl, state, confirmDialog).
const GAME_KEY = 'pokemon-quiz-game';
const MODE_KEY = 'pokemon-quiz-mode';
const SERIES_SIZES = [5, 10, 20];

const GAME_UI = {
  fr: {
    quiz: 'Quiz', game: 'Numéro', rounds: 'Manches', score: 'Score', avg: 'Écart moyen', best: 'Meilleur écart',
    regionsLabel: 'Régions',
    format: 'Format', free: 'Libre', series: (n) => `Partie de ${n} manches`,
    prompt: 'Quel Pokémon porte ce numéro ?', placeholder: 'Nomme un Pokémon…', validate: 'Valider',
    unknown: 'Aucun Pokémon ne porte ce nom.', next: 'Manche suivante', skip: 'Passer',
    reset: 'Réinitialiser le score', restart: 'Recommencer la partie', replay: 'Nouvelle partie',
    resetConfirm: 'Effacer les statistiques du mode libre ?', yours: 'Ta réponse', answer: 'Réponse',
    exact: 'Exact !', gap: (d) => `Écart : ${d}`, pts: (p) => `+${p} points`,
    higher: 'Le bon numéro était plus grand.', lower: 'Le bon numéro était plus petit.',
    tiers: ['Brûlant', 'Très proche', 'Proche', 'Loin', 'Très loin'],
    finished: (s, max) => `Partie terminée : ${s} / ${max} points`, record: (r) => `Record : ${r}`,
    newRecord: 'Nouveau record !',
  },
  en: {
    quiz: 'Quiz', game: 'Number', rounds: 'Rounds', score: 'Score', avg: 'Average gap', best: 'Best gap',
    regionsLabel: 'Regions',
    format: 'Format', free: 'Free play', series: (n) => `${n}-round game`,
    prompt: 'Which Pokémon has this number?', placeholder: 'Name a Pokémon…', validate: 'Submit',
    unknown: 'No Pokémon has that name.', next: 'Next round', skip: 'Skip',
    reset: 'Reset score', restart: 'Restart game', replay: 'New game',
    resetConfirm: 'Erase the free-play stats?', yours: 'Your answer', answer: 'Answer',
    exact: 'Exact!', gap: (d) => `Gap: ${d}`, pts: (p) => `+${p} points`,
    higher: 'The right number was higher.', lower: 'The right number was lower.',
    tiers: ['Burning', 'Very close', 'Close', 'Far', 'Very far'],
    finished: (s, max) => `Game over: ${s} / ${max} points`, record: (r) => `Record: ${r}`,
    newRecord: 'New record!',
  },
};

const emptyStats = () => ({ rounds: 0, score: 0, sumGap: 0, best: null });

const G = {
  mode: 'quiz', target: null, guess: null,
  format: 'free',            // 'free' or a number of rounds
  free: emptyStats(),        // cumulative stats of the free mode
  series: emptyStats(),      // stats of the series in progress
  regions: regions.map((r) => r.key), // regions that can appear
  records: {},               // best series score per length and region set
  newRecord: false,
};
const g = (id) => document.getElementById(id);
const gt = () => GAME_UI[state.lang];
const padId = (id) => '#' + String(id).padStart(4, '0');
const entryById = (id) => nationalEntries.find((e) => e.id === id);
const activeStats = () => (G.format === 'free' ? G.free : G.series);
const pool = () => regions.filter((r) => G.regions.includes(r.key)).flatMap((r) => r.entries);
const recordKey = () => `${G.format}|${G.regions.join(',')}`;
const seriesDone = () => G.format !== 'free' && G.series.rounds >= G.format;

function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem(GAME_KEY) || '{}');
    if (s.free) G.free = { ...G.free, ...s.free };
    if (s.series) G.series = { ...G.series, ...s.series };
    if (s.records) G.records = s.records;
    const saved = (s.regions || []).filter((k) => regions.some((r) => r.key === k));
    if (saved.length) G.regions = saved;
    if (s.format === 'free' || SERIES_SIZES.includes(s.format)) G.format = s.format || 'free';
    if (entryById(s.target) && pool().some((e) => e.id === s.target)) G.target = s.target;
    G.mode = localStorage.getItem(MODE_KEY) === 'game' ? 'game' : 'quiz';
  } catch (e) { /* ignore corrupt storage */ }
}

function saveGame() {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify({
      free: G.free, series: G.series, records: G.records, format: G.format, regions: G.regions, target: G.target,
    }));
    localStorage.setItem(MODE_KEY, G.mode);
  } catch (e) { /* storage unavailable */ }
}

function newRound() {
  if (seriesDone()) G.series = emptyStats();
  G.newRecord = false;
  const p = pool();
  G.target = p[Math.floor(Math.random() * p.length)].id;
  G.guess = null;
  saveGame();
  renderGame();
  g('gInput').value = '';
  g('gInput').focus();
}

// Tier index 0 (burning) .. 4 (very far) from the gap between guessed and target numbers.
function tierOf(gap) {
  if (gap <= 5) return 0;
  if (gap <= 25) return 1;
  if (gap <= 100) return 2;
  if (gap <= 300) return 3;
  return 4;
}

function submitGuess(ev) {
  ev.preventDefault();
  if (G.guess !== null) return;
  const q = norm(g('gInput').value);
  if (!q) return;
  const hit = nationalEntries.find((e) => norm(e.en) === q || norm(e.fr) === q);
  if (!hit) {
    g('gMessage').textContent = gt().unknown;
    g('gMessage').className = 'message error';
    return;
  }
  const gap = Math.abs(hit.id - G.target);
  const s = activeStats();
  G.guess = hit.id;
  s.rounds += 1;
  s.score += Math.max(0, 100 - gap);
  s.sumGap += gap;
  s.best = s.best === null ? gap : Math.min(s.best, gap);
  if (seriesDone() && s.score > (G.records[recordKey()] || 0)) {
    G.records[recordKey()] = s.score;
    G.newRecord = true;
  }
  saveGame();
  renderGame();
  g('gNext').focus();
}

function pokeCard(label, id) {
  const e = entryById(id);
  return `<div class="gcard"><small>${label}</small>
    <img src="${spriteUrl(id)}" alt="" onerror="this.style.visibility='hidden'" />
    <b>${nameOf(e)}</b><span>${padId(id)}</span></div>`;
}

function renderRegions() {
  g('gRegions').innerHTML = `<span>${gt().regionsLabel}</span>` + regions.map((r) =>
    `<label class="rchip"><input type="checkbox" data-key="${r.key}" ${G.regions.includes(r.key) ? 'checked' : ''} /><span>${r.title}</span></label>`).join('');
}

function renderFormat() {
  const u = gt();
  g('gFormatLabel').textContent = u.format;
  g('gFormat').innerHTML = [`<option value="free">${u.free}</option>`,
    ...SERIES_SIZES.map((n) => `<option value="${n}">${u.series(n)}</option>`)].join('');
  g('gFormat').value = String(G.format);
}

function renderGame() {
  const modeBtns = { quiz: g('modeQuiz'), game: g('modeGame') };
  g('quizView').hidden = G.mode !== 'quiz';
  g('gameView').hidden = G.mode !== 'game';
  Object.entries(modeBtns).forEach(([k, b]) => b.classList.toggle('active', k === G.mode));
  const u = gt();
  modeBtns.quiz.textContent = u.quiz;
  modeBtns.game.textContent = u.game;
  if (G.mode !== 'game') return;
  if (G.target === null) { newRound(); return; }

  renderFormat();
  renderRegions();
  const s = activeStats();
  const series = G.format !== 'free';
  g('gRoundsLabel').textContent = u.rounds;
  g('gScoreLabel').textContent = u.score;
  g('gAvgLabel').textContent = u.avg;
  g('gBestLabel').textContent = u.best;
  g('gRounds').textContent = series ? `${s.rounds} / ${G.format}` : s.rounds;
  g('gScore').textContent = s.score;
  // Average and best gap only make sense once there is a first guess.
  g('gAvgBox').hidden = s.rounds === 0;
  g('gBestBox').hidden = s.rounds === 0;
  g('gAvg').textContent = s.rounds ? (s.sumGap / s.rounds).toFixed(1) : '';
  g('gBest').textContent = s.best === null ? '' : s.best;
  g('gPrompt').textContent = u.prompt;
  g('gNumber').textContent = padId(G.target);
  g('gInput').placeholder = u.placeholder;
  g('gSubmit').textContent = u.validate;
  g('gSkip').textContent = u.skip;
  g('gReset').textContent = series ? u.restart : u.reset;

  const over = G.guess !== null;
  const finished = over && seriesDone();
  g('gNext').textContent = finished ? u.replay : u.next;
  g('gInput').disabled = over;
  g('gSubmit').disabled = over;
  g('gNext').hidden = !over;
  g('gSkip').hidden = over;
  g('gResult').hidden = !over;
  g('gMessage').textContent = '';
  g('gMessage').className = 'message';
  if (!over) return;

  const gap = Math.abs(G.guess - G.target);
  const head = gap === 0 ? u.exact : `${u.tiers[tierOf(gap)]} — ${u.gap(gap)}`;
  const dir = gap === 0 ? '' : (G.guess < G.target ? u.higher : u.lower);
  const summary = finished
    ? `<p class="gfinal">${u.finished(s.score, G.format * 100)}<br>${u.record(G.records[recordKey()])}${G.newRecord ? ` — ${u.newRecord}` : ''}</p>`
    : '';
  g('gResult').innerHTML = `<div class="gcards">${pokeCard(u.yours, G.guess)}${pokeCard(u.answer, G.target)}</div>
    <p class="gverdict tier-${gap === 0 ? 'exact' : tierOf(gap)}">${head}</p>
    <p class="muted">${dir} ${u.pts(Math.max(0, 100 - gap))}</p>${summary}`;
}

function bindGame() {
  g('modeQuiz').addEventListener('click', () => { G.mode = 'quiz'; saveGame(); renderGame(); });
  g('modeGame').addEventListener('click', () => { G.mode = 'game'; saveGame(); renderGame(); g('gInput').focus(); });
  g('gRegions').addEventListener('change', (ev) => {
    const key = ev.target.dataset.key;
    const next = regions.map((r) => r.key).filter((k) => (k === key ? ev.target.checked : G.regions.includes(k)));
    if (!next.length) { renderRegions(); return; } // keep at least one region
    G.regions = next;
    G.series = emptyStats();
    newRound();
  });
  g('gForm').addEventListener('submit', submitGuess);
  g('gNext').addEventListener('click', newRound);
  g('gSkip').addEventListener('click', newRound);
  g('gFormat').addEventListener('change', () => {
    G.format = g('gFormat').value === 'free' ? 'free' : Number(g('gFormat').value);
    G.series = emptyStats();
    newRound();
  });
  g('gReset').addEventListener('click', () => {
    if (G.format !== 'free') {
      G.series = emptyStats();
      newRound();
      return;
    }
    confirmDialog(gt().resetConfirm, () => {
      G.free = emptyStats();
      newRound();
    });
  });
}

loadGame();
bindGame();
renderGame();
