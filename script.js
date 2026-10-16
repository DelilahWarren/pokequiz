const STORAGE_KEY = 'pokemon-quiz-v2';
const NATIONAL = 'national';
const TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy', 'nuclear'];
const TYPE_FR = {
  normal: 'Normal', fire: 'Feu', water: 'Eau', electric: 'Électrik', grass: 'Plante', ice: 'Glace',
  fighting: 'Combat', poison: 'Poison', ground: 'Sol', flying: 'Vol', psychic: 'Psy', bug: 'Insecte',
  rock: 'Roche', ghost: 'Spectre', dragon: 'Dragon', dark: 'Ténèbres', steel: 'Acier', fairy: 'Fée', nuclear: 'Nucléaire',
};
const TYPE_EN = Object.fromEntries(TYPES.map((t) => [t, t[0].toUpperCase() + t.slice(1)]));

const UI = {
  fr: {
    title: 'Quiz Pokédex', national: 'National', placeholder: 'Nomme un Pokémon…',
    showTypes: 'Afficher les types', showSilhouettes: 'Afficher les silhouettes', typeHelp: 'Clique un type pour surligner les Pokémon restants, ou une case pour obtenir un indice.',
    giveUp: 'Abandonner', resetPage: 'Réinitialiser la page', resetAll: 'Tout réinitialiser',
    ok: 'Dernier : ', already: 'Déjà trouvé.', none: 'Aucun Pokémon ne correspond.',
    done: 'Page complétée, félicitations !', giveUpConfirm: 'Révéler tous les Pokémon restants de cette page ?',
    resetPageConfirm: 'Réinitialiser cette page ?', resetAllConfirm: 'Effacer toute la progression ?',
    yes: 'Oui', no: 'Non', hintAsk: 'Voulez-vous un indice pour la case {n} ?', hintSilhouette: 'Silhouette', hintType: 'Type', cancel: 'Annuler',
  },
  en: {
    title: 'Pokédex Quiz', national: 'National', placeholder: 'Name a Pokémon…',
    showTypes: 'Show types', showSilhouettes: 'Show silhouettes', typeHelp: 'Click a type to highlight remaining Pokémon, or a cell to get a hint.',
    giveUp: 'Give up', resetPage: 'Reset page', resetAll: 'Reset all',
    ok: 'Last: ', already: 'Already found.', none: 'No Pokémon matches.',
    done: 'Page complete, congratulations!', giveUpConfirm: 'Reveal all remaining Pokémon on this page?',
    resetPageConfirm: 'Reset this page?', resetAllConfirm: 'Erase all progress?',
    yes: 'Yes', no: 'No', hintAsk: 'Do you want a hint for cell {n}?', hintSilhouette: 'Silhouette', hintType: 'Type', cancel: 'Cancel',
  },
};

const $ = (id) => document.getElementById(id);
const el = {
  title: $('appTitle'), lang: $('uiLanguage'), tabs: $('tabs'), form: $('answerForm'), input: $('answerInput'),
  bar: $('barFill'), progress: $('progressText'), msg: $('messageBox'), showTypes: $('showTypes'),
  showTypesLabel: $('showTypesLabel'), showSilhouettes: $('showSilhouettes'), showSilhouettesLabel: $('showSilhouettesLabel'), typeHelp: $('typeHelp'), chips: $('typeChips'),
  giveUp: $('giveUpButton'), resetPage: $('resetPageButton'), resetAll: $('resetAllButton'),
  grid: $('grid'), overlay: $('confirmOverlay'), confirmMsg: $('confirmMessage'),
  yes: $('confirmYes'), no: $('confirmNo'),
  hintOverlay: $('hintOverlay'), hintMsg: $('hintMessage'), hintSil: $('hintSilhouette'),
  hintType: $('hintType'), hintCancel: $('hintCancel'),
};

const regions = window.quizCategories.pokemons.pages;
const nationalRegions = regions;
const nationalEntries = nationalRegions.flatMap((r) => r.entries);

const state = {
  lang: 'fr', page: NATIONAL, found: new Set(), showTypes: false,
  showSilhouettes: false, typeFilter: null, hintTypes: new Set(), hintSil: new Set(),
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    state.found = new Set(s.found || []);
    state.lang = s.lang || state.lang;
    state.page = s.page || state.page;
    state.showTypes = !!s.showTypes;
    state.showSilhouettes = !!s.showSilhouettes;
    state.hintTypes = new Set(s.hintTypes || []);
    state.hintSil = new Set(s.hintSil || []);
  } catch (e) { /* corrupt storage: start fresh */ }
  if (state.page !== NATIONAL && !regions.some((r) => r.key === state.page)) state.page = NATIONAL;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      found: [...state.found], lang: state.lang, page: state.page, showTypes: state.showTypes,
      showSilhouettes: state.showSilhouettes, hintTypes: [...state.hintTypes], hintSil: [...state.hintSil],
    }));
  } catch (e) { /* storage unavailable */ }
}

const t = (k) => UI[state.lang][k];

function norm(s) {
  return s.replace('♀', 'f').replace('♂', 'm').normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

function entriesOfPage() {
  return state.page === NATIONAL ? nationalEntries : regions.find((r) => r.key === state.page).entries;
}

const typesOf = (id) => window.pokemonTypes[id] || [];
const nameOf = (e) => (state.lang === 'fr' ? e.fr : e.en);
const typeLabel = (ty) => (state.lang === 'fr' ? TYPE_FR[ty] : TYPE_EN[ty]);
const TANDOR_FIRST_ID = 1026;
const spriteUrl = (id) => id >= TANDOR_FIRST_ID
  ? `tandor-sprites/${id - TANDOR_FIRST_ID}.png`
  : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

function setMessage(text, kind = '') {
  el.msg.textContent = text;
  el.msg.className = 'message ' + kind;
}

const badge = (ty) => `<span class="tbadge ty-${ty}">${typeLabel(ty)}</span>`;

function renderTabs() {
  const tabs = [{ key: NATIONAL, label: t('national'), list: nationalEntries },
    ...regions.map((r) => ({ key: r.key, label: r.title, list: r.entries }))];
  el.tabs.innerHTML = tabs.map((tab) => {
    const n = tab.list.filter((e) => state.found.has(e.id)).length;
    return `<button type="button" class="tab ${tab.key === state.page ? 'active' : ''}" data-key="${tab.key}">
      ${tab.label}<small>${n}/${tab.list.length}</small></button>`;
  }).join('');
}

function cellHtml(e) {
  const found = state.found.has(e.id);
  const types = typesOf(e.id);
  const dim = state.typeFilter && !found && !types.includes(state.typeFilter);
  const hit = state.typeFilter && !found && types.includes(state.typeFilter);
  const showT = found || state.showTypes || state.hintTypes.has(e.id) || hit;
  const img = found || state.showSilhouettes || state.hintSil.has(e.id)
    ? `<img src="${spriteUrl(e.id)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" />`
    : '<span class="noimg">?</span>';
  return `<div class="cell ${found ? 'found' : ''} ${dim ? 'dim' : ''} ${hit ? 'hit' : ''}" data-id="${e.id}">
    <span class="num">#${String(e.id).padStart(4, '0')}</span>
    <div class="pic">${img}</div>
    <span class="name">${found ? nameOf(e) : '???'}</span>
    <div class="types">${showT ? types.map(badge).join('') : ''}</div>
  </div>`;
}

function renderGrid() {
  if (state.page !== NATIONAL) {
    el.grid.className = 'grid flat';
    el.grid.innerHTML = entriesOfPage().map(cellHtml).join('');
    return;
  }
  el.grid.className = 'grid';
  el.grid.innerHTML = nationalRegions.map((r) => {
    const n = r.entries.filter((e) => state.found.has(e.id)).length;
    return `<h2 class="region-title">${r.title} <small>${n}/${r.entries.length}</small></h2>
      <div class="flat">${r.entries.map(cellHtml).join('')}</div>`;
  }).join('');
}

function renderProgress() {
  const list = entriesOfPage();
  const n = list.filter((e) => state.found.has(e.id)).length;
  el.progress.textContent = `${n} / ${list.length}`;
  el.bar.style.width = `${(n / list.length) * 100}%`;
}

function renderChips() {
  el.chips.innerHTML = TYPES.map((ty) =>
    `<button type="button" class="chip ty-${ty} ${state.typeFilter === ty ? 'on' : ''}" data-type="${ty}">${typeLabel(ty)}</button>`).join('');
}

function renderText() {
  document.title = t('title');
  el.title.textContent = t('title');
  el.input.placeholder = t('placeholder');
  el.showTypesLabel.textContent = t('showTypes');
  el.showSilhouettesLabel.textContent = t('showSilhouettes');
  el.showSilhouettes.checked = state.showSilhouettes;
  el.typeHelp.textContent = t('typeHelp');
  el.giveUp.textContent = t('giveUp');
  el.resetPage.textContent = t('resetPage');
  el.resetAll.textContent = t('resetAll');
  el.hintSil.textContent = t('hintSilhouette');
  el.hintType.textContent = t('hintType');
  el.hintCancel.textContent = t('cancel');
  el.yes.textContent = t('yes');
  el.no.textContent = t('no');
  el.showTypes.checked = state.showTypes;
}

function render() {
  renderText();
  renderTabs();
  renderChips();
  renderGrid();
  renderProgress();
  if (typeof renderGame === 'function') renderGame();
}

// Looks up the typed text among all Pokémon, whatever the current page (EN or FR).
// `free` is the first match not found yet, so duplicate names (Nidoran) work.
function findMatch(text) {
  const q = norm(text);
  if (!q) return null;
  const matches = nationalEntries.filter((e) => norm(e.en) === q || norm(e.fr) === q);
  if (!matches.length) return null;
  return { free: matches.find((e) => !state.found.has(e.id)) };
}

function submit(text, auto) {
  const m = findMatch(text);
  if (!m) {
    if (!auto) setMessage(t('none'), 'error');
    return;
  }
  if (!m.free) {
    if (!auto) setMessage(t('already'), 'warn');
    return;
  }
  markFound(m.free);
}

function markFound(entry) {
  state.found.add(entry.id);
  state.hintTypes.delete(entry.id);
  state.hintSil.delete(entry.id);
  el.input.value = '';
  save();
  render();
  const onPage = entriesOfPage().includes(entry);
  const done = onPage && entriesOfPage().every((e) => state.found.has(e.id));
  setMessage(done ? t('done') : t('ok') + nameOf(entry), 'ok');
}

function confirmDialog(message, onYes) {
  el.confirmMsg.textContent = message;
  el.overlay.hidden = false;
  el.yes.onclick = () => { el.overlay.hidden = true; onYes(); };
  el.no.onclick = () => { el.overlay.hidden = true; };
}

let hintTarget = null;

// Offers the hints not already visible on this cell (global toggles count as visible).
function askHint(id) {
  const silVisible = state.showSilhouettes || state.hintSil.has(id);
  const typeVisible = state.showTypes || state.hintTypes.has(id);
  if (silVisible && typeVisible) return;
  hintTarget = id;
  el.hintMsg.textContent = t('hintAsk').replace('{n}', '#' + String(id).padStart(4, '0'));
  el.hintSil.hidden = silVisible;
  el.hintType.hidden = typeVisible || !typesOf(id).length;
  if (el.hintSil.hidden && el.hintType.hidden) return;
  el.hintOverlay.hidden = false;
}

function applyHint(set) {
  set.add(hintTarget);
  el.hintOverlay.hidden = true;
  save();
  renderGrid();
}

function clearHints(ids) {
  ids.forEach((id) => { state.hintTypes.delete(id); state.hintSil.delete(id); });
  state.showTypes = false;
  state.showSilhouettes = false;
  state.typeFilter = null;
}

function bind() {
  // A complete name is validated as soon as it is typed; already-found names are ignored silently,
  // so typing "melo" again on the way to "meloetta" does nothing.
  el.input.addEventListener('input', () => {
    if (findMatch(el.input.value)?.free) submit(el.input.value, true);
  });
  el.form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (el.input.value.trim()) submit(el.input.value, false);
  });
  el.tabs.addEventListener('click', (ev) => {
    const b = ev.target.closest('.tab');
    if (!b) return;
    state.page = b.dataset.key;
    save();
    render();
    el.input.focus();
  });
  el.chips.addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip');
    if (!b) return;
    state.typeFilter = state.typeFilter === b.dataset.type ? null : b.dataset.type;
    renderChips();
    renderGrid();
  });
  el.grid.addEventListener('click', (ev) => {
    const c = ev.target.closest('.cell');
    if (!c || c.classList.contains('found')) return;
    askHint(Number(c.dataset.id));
  });
  el.hintSil.addEventListener('click', () => applyHint(state.hintSil));
  el.hintType.addEventListener('click', () => applyHint(state.hintTypes));
  el.hintCancel.addEventListener('click', () => { el.hintOverlay.hidden = true; });
  el.showTypes.addEventListener('change', () => {
    state.showTypes = el.showTypes.checked;
    save();
    renderGrid();
  });
  el.showSilhouettes.addEventListener('change', () => {
    state.showSilhouettes = el.showSilhouettes.checked;
    save();
    renderGrid();
  });
  el.lang.addEventListener('change', () => {
    state.lang = el.lang.value;
    save();
    render();
  });
  const bulk = (btn, msgKey, fn) => btn.addEventListener('click', () => confirmDialog(t(msgKey), () => {
    fn();
    save();
    render();
  }));
  bulk(el.giveUp, 'giveUpConfirm', () => entriesOfPage().forEach((e) => state.found.add(e.id)));
  bulk(el.resetPage, 'resetPageConfirm', () => {
    const ids = entriesOfPage().map((e) => e.id);
    ids.forEach((id) => state.found.delete(id));
    clearHints(ids);
    setMessage('');
  });
  bulk(el.resetAll, 'resetAllConfirm', () => {
    state.found.clear();
    clearHints([...state.hintTypes, ...state.hintSil]);
    setMessage('');
  });
}

load();
el.lang.innerHTML = '<option value="fr">Français</option><option value="en">English</option>';
el.lang.value = state.lang;
bind();
render();
el.input.focus();
