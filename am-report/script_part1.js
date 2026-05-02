(function(){
'use strict';

const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const D = JSON.parse(document.getElementById('payload').textContent);
window.__D = D;

const fmt = {
  int: n => n == null ? '—' : Math.round(Number(n)).toLocaleString('en-US'),
  intK: n => {
    if (n == null) return '—';
    const v = Number(n);
    if (Math.abs(v) >= 1e6) return (v/1e6).toFixed(2) + 'M';
    if (Math.abs(v) >= 1e4) return (v/1e3).toFixed(1) + 'K';
    return Math.round(v).toLocaleString('en-US');
  },
  dec: (n, d=2) => n == null ? '—' : Number(n).toFixed(d),
  pct: (n, d=1) => n == null ? '—' : Number(n).toFixed(d) + '%',
  signed: n => {
    if (n == null) return '—';
    const v = Number(n);
    if (Math.abs(v) < 0.5 && Number.isInteger(v)) return '0';
    return (v > 0 ? '+' : '') + Math.round(v).toLocaleString('en-US');
  },
  signedDec: (n, d=1) => {
    if (n == null) return '—';
    const v = Number(n);
    if (Math.abs(v) < 0.05) return '0';
    return (v > 0 ? '+' : '') + v.toFixed(d);
  },
};

function escapeHTML(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}
function icon(name){ return `<svg class="icon"><use href="#i-${name}"/></svg>`; }
function healthClass(h){
  if (h >= 75) return 'h-75';
  if (h >= 50) return 'h-50';
  if (h >= 25) return 'h-25';
  return 'h-0';
}
function deltaSpan(delta, mode='count'){
  if (delta == null) return '<span class="delta flat">—</span>';
  const v = Number(delta);
  if (Math.abs(v) < 0.05) return '<span class="delta flat">0</span>';
  if (Math.abs(v) < 0.5 && Number.isInteger(v)) return '<span class="delta flat">0</span>';
  const arrow = v > 0 ? '▲' : '▼';
  const sign = v > 0 ? '+' : '';
  let cls;
  if (mode === 'count') cls = v > 0 ? 'up-bad' : 'down-good';
  else                  cls = v > 0 ? 'up-good' : 'down-bad';
  const formatted = Number.isInteger(v) ? Math.round(v).toLocaleString('en-US') : v.toFixed(1);
  return `<span class="delta ${cls}">${arrow} ${sign}${formatted}</span>`;
}
function profileShort(p){
  if (p === 'Corporate Store') return 'Corporate';
  if (p === 'Franchisee Store') return 'Franchise';
  if (p === 'Distribution center') return 'DC';
  return p || '—';
}

// Masthead
$('#m-latest').textContent = D.meta.date_latest;
$('#m-7d').textContent     = D.meta.date_7d;
$('#m-gen').textContent    = D.meta.generated;
$('#footer-gen').textContent = D.meta.generated;
$('#ts-date-7d').textContent     = D.meta.date_7d;
$('#ts-date-latest').textContent = D.meta.date_latest;

// Filter state
const allClientIdx  = D.filter_options.clients.map((_, i) => i);
const allProfileIdx = D.filter_options.profiles.map((_, i) => i);
const allStatusIdx  = D.filter_options.statuses.map((_, i) => i);
const defaultStatusSet = new Set(allStatusIdx);  // No default preselection — show all

const filterState = {
  clients:  new Set(allClientIdx),
  statuses: new Set(defaultStatusSet),
  profiles: new Set(allProfileIdx),
  article_num: '',
  article_desc: '',
  selected_store_idx: null,   // for product table drill-down
};

function isDefaultFilters(){
  if (filterState.clients.size  !== allClientIdx.length)  return false;
  if (filterState.profiles.size !== allProfileIdx.length) return false;
  if (filterState.statuses.size !== defaultStatusSet.size) return false;
  for (const i of filterState.statuses) if (!defaultStatusSet.has(i)) return false;
  if (filterState.article_num)  return false;
  if (filterState.article_desc) return false;
  return true;
}

// Popover factory
function buildPopover(triggerEl, optionLabels, currentSet, kind){
  const pop = document.createElement('div');
  pop.className = 'filter-popover';
  pop.innerHTML = `
    <div class="filter-popover-search">
      <input type="search" placeholder="Search..." autocomplete="off">
    </div>
    <div class="filter-options"></div>
    <div class="filter-popover-footer">
      <button data-act="clear">Clear</button>
      <span class="opt-summary"></span>
      <button data-act="all">Select all</button>
    </div>
  `;
  triggerEl.parentNode.appendChild(pop);

  const optsEl = pop.querySelector('.filter-options');
  const summaryEl = pop.querySelector('.opt-summary');

  function rebuildOptions(searchTerm){
    const term = (searchTerm || '').toLowerCase();
    let html = '';
    optionLabels.forEach((lbl, i) => {
      if (term && !String(lbl).toLowerCase().includes(term)) return;
      const checked = currentSet.has(i) ? 'checked' : '';
      const display = lbl === '' ? '(blank)' : escapeHTML(lbl);
      html += `<label><input type="checkbox" data-idx="${i}" ${checked}><span class="opt-text">${display}</span></label>`;
    });
    optsEl.innerHTML = html || '<div style="padding:14px;color:var(--mute);font-size:12px;text-align:center">No matches</div>';
    summaryEl.textContent = `${currentSet.size} of ${optionLabels.length} selected`;
  }

  rebuildOptions('');

  pop.querySelector('input[type="search"]').addEventListener('input', e => {
    rebuildOptions(e.target.value);
  });
  optsEl.addEventListener('change', e => {
    const cb = e.target.closest('input[type="checkbox"]');
    if (!cb) return;
    const idx = +cb.dataset.idx;
    if (cb.checked) currentSet.add(idx); else currentSet.delete(idx);
    summaryEl.textContent = `${currentSet.size} of ${optionLabels.length} selected`;
    onFilterChange(kind);
  });
  pop.querySelector('[data-act="clear"]').addEventListener('click', () => {
    currentSet.clear();
    rebuildOptions(pop.querySelector('input[type="search"]').value);
    onFilterChange(kind);
  });
  pop.querySelector('[data-act="all"]').addEventListener('click', () => {
    optionLabels.forEach((_, i) => currentSet.add(i));
    rebuildOptions(pop.querySelector('input[type="search"]').value);
    onFilterChange(kind);
  });

  triggerEl.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = pop.classList.contains('open');
    document.querySelectorAll('.filter-popover.open').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.filter-trigger[aria-expanded="true"]').forEach(t => t.setAttribute('aria-expanded', 'false'));
    if (!isOpen){
      pop.classList.add('open');
      triggerEl.setAttribute('aria-expanded', 'true');
      pop.querySelector('input[type="search"]').focus();
    }
  });

  return { pop, rebuildOptions };
}

document.addEventListener('click', e => {
  if (!e.target.closest('.filter-popover') && !e.target.closest('.filter-trigger')){
    document.querySelectorAll('.filter-popover.open').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.filter-trigger[aria-expanded="true"]').forEach(t => t.setAttribute('aria-expanded', 'false'));
  }
});

const popClient  = buildPopover($('.filter-trigger[data-filter="client"]'),
  D.filter_options.clients, filterState.clients, 'client');
const popStatus  = buildPopover($('.filter-trigger[data-filter="status"]'),
  D.filter_options.statuses, filterState.statuses, 'status');
const popProfile = buildPopover($('.filter-trigger[data-filter="profile"]'),
  D.filter_options.profiles, filterState.profiles, 'profile');

let articleNumTimer, articleDescTimer;
$('#f-article-num').addEventListener('input', e => {
  clearTimeout(articleNumTimer);
  articleNumTimer = setTimeout(() => {
    filterState.article_num = e.target.value.trim();
    onFilterChange('article_num');
  }, 200);
});
$('#f-article-desc').addEventListener('input', e => {
  clearTimeout(articleDescTimer);
  articleDescTimer = setTimeout(() => {
    filterState.article_desc = e.target.value.trim();
    onFilterChange('article_desc');
  }, 200);
});

$('#filter-reset').addEventListener('click', () => {
  filterState.clients = new Set(allClientIdx);
  filterState.profiles = new Set(allProfileIdx);
  filterState.statuses = new Set(defaultStatusSet);
  filterState.article_num = '';
  filterState.article_desc = '';
  filterState.selected_store_idx = null;
  $('#f-article-num').value = '';
  $('#f-article-desc').value = '';

  // Rebuild popover checkboxes
  document.querySelectorAll('.filter-popover').forEach(p => {
    const trigger = p.parentNode.querySelector('.filter-trigger');
    if (!trigger) return;
    const kind = trigger.dataset.filter;
    const set = kind === 'client'  ? filterState.clients
              : kind === 'status'  ? filterState.statuses
              : filterState.profiles;
    const total = kind === 'client'  ? D.filter_options.clients.length
                : kind === 'status'  ? D.filter_options.statuses.length
                : D.filter_options.profiles.length;
    p.querySelectorAll('input[type="checkbox"][data-idx]').forEach(cb => {
      cb.checked = set.has(+cb.dataset.idx);
    });
    const sumEl = p.querySelector('.opt-summary');
    if (sumEl) sumEl.textContent = `${set.size} of ${total} selected`;
  });

  onFilterChange('reset');
});

function updateFilterUI(){
  const setTrigger = (kind, set, options, allLabel, singleLabel) => {
    const trigger = document.querySelector(`.filter-trigger[data-filter="${kind}"]`);
    const lblEl = trigger.querySelector('.filter-label-text');
    const isAll = set.size === options.length;
    const isDefault = (kind === 'status') ?
        (set.size === defaultStatusSet.size && [...set].every(i => defaultStatusSet.has(i))) :
        isAll;
    if (set.size === 0){
      lblEl.textContent = 'None selected';
      trigger.classList.add('active');
    } else if (set.size === 1){
      const i = [...set][0];
      lblEl.textContent = singleLabel(options[i]);
      trigger.classList.toggle('active', !isDefault);
    } else if (isAll){
      lblEl.textContent = allLabel;
      trigger.classList.remove('active');
    } else {
      lblEl.textContent = `${set.size} selected`;
      trigger.classList.add('active');
    }
  };
  setTrigger('client', filterState.clients, D.filter_options.clients,
    'All clients', v => v || '(blank)');
  setTrigger('status', filterState.statuses, D.filter_options.statuses,
    'All statuses', v => v ? `${v} (${v === '04' ? 'Active' : 'Status ' + v})` : '(blank)');
  setTrigger('profile', filterState.profiles, D.filter_options.profiles,
    'All profiles', v => profileShort(v));

  $('#filter-reset').disabled = isDefaultFilters() && filterState.selected_store_idx == null;

  const summary = $('#filter-summary');
  if (isDefaultFilters() && filterState.selected_store_idx == null){
    summary.style.display = 'none';
  } else {
    summary.style.display = 'flex';
    summary.innerHTML = `<svg class="icon"><use href="#i-filter"/></svg>Filters active`;
  }
}

window.onFilterChange = function(kind){ updateFilterUI(); };
window.__updateFilterUI = updateFilterUI;
window.__filterState = filterState;
window.__helpers = { fmt, escapeHTML, icon, healthClass, deltaSpan, profileShort };

updateFilterUI();
})();
