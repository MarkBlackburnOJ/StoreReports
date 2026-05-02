(function(){
'use strict';
const D = window.__D;
const filterState = window.__filterState;
const { fmt, escapeHTML, icon, healthClass, deltaSpan, profileShort } = window.__helpers;
const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// ---------- cell builders ----------
function pill(v){ return `<td class="num"><span class="health-pill ${healthClass(v)}">${(+v).toFixed(1)}</span></td>`; }
function dlt(v, mode='count'){ return `<td class="num">${deltaSpan(v, mode)}</td>`; }
function ci(v, opts={}){
  const mute = opts.muteIfZero && (!v || v === 0);
  const c = mute ? 'color:var(--mute-3)' :
            opts.color === 'crit' ? 'color:var(--critical-deep);font-weight:700' :
            opts.color === 'warn' ? 'color:var(--warning-deep);font-weight:700' :
            opts.color === 'healthy' ? 'color:var(--healthy-deep);font-weight:700' :
            opts.color === 'phantom' ? 'color:var(--phantom-deep);font-weight:700' : '';
  return `<td class="num"${c?' style="'+c+'"':''}>${fmt.int(v)}</td>`;
}
function cd(v, d=1, opts={}){
  const mute = opts.muteIfZero && (!v || Math.abs(v) < 0.05);
  const c = mute ? 'color:var(--mute-3)' :
            opts.color === 'crit' ? 'color:var(--critical-deep);font-weight:700' : '';
  return `<td class="num"${c?' style="'+c+'"':''}>${fmt.dec(v, d)}</td>`;
}
function cb(v){ return `<td class="num">${fmt.intK(v)}</td>`; }
function cp(v, opts={}){
  if (v == null) return '<td class="num">—</td>';
  const c = opts.color === 'crit' ? 'color:var(--critical-deep);font-weight:700' : '';
  return `<td class="num"${c?' style="'+c+'"':''}>${(+v).toFixed(1)}%</td>`;
}

// ============================================================ KPI TAB DEFINITIONS
// Common id columns per entity type:
const ID_COLS_STORE = [
  { h: 'Code',  k: 'site_code',        cell: r => `<td class="code">${escapeHTML(r.site_code)}</td>` },
  { h: 'Store', k: 'site_description', cell: r => `<td class="name" title="${escapeHTML(r.site_description)}">${escapeHTML(r.site_description)}</td>` },
  { h: 'Profile', k: 'site_profile',   cell: r => `<td class="profile">${profileShort(r.site_profile)}</td>` },
];
const ID_COLS_PRODUCT = [
  { h: 'Article #', k: 'barcode', cell: r => `<td class="code">${escapeHTML(r.barcode)}</td>` },
  { h: 'Description', k: 'product_description', cell: r => `<td class="name" style="max-width:340px" title="${escapeHTML(r.product_description)}">${escapeHTML(r.product_description)}</td>` },
  { h: 'Vendor', k: 'client_name', cell: r => `<td class="mute">${escapeHTML(r.client_name) || '—'}</td>` },
];
const ID_COLS_CLIENT = [
  { h: 'Client', k: 'client_name', cell: r => `<td class="name">${escapeHTML(r.client_name) || '(blank)'}</td>` },
];

// Tab descriptions (used under the tab bar)
const TAB_DESC = {
  overview:    'Broad view of every entity. Sort by any column.',
  oos:         'Out-of-stock focus — current vs previous week. Negative Δ = improving.',
  phantom:     'Possible phantom items — stock recorded but no recent sales. Audit candidates.',
  low:         'Low cover (<14 days of stock). These are tomorrow\'s OOS — order soon.',
  healthy:     'Healthy items — adequate cover, selling normally. The goal state.',
  lost:        'Lost daily sales — units of demand not being fulfilled because items are OOS.',
  soh:         'Stock on hand — total units currently sitting on shelves.',
  disc:        'Discontinued + SOH — inactive items still holding stock (dead inventory). Only visible when Status filter includes non-04 statuses.',
  resolved:    'Items recovered this week — were OOS at previous week, in stock now.',
  new_oos:     'New OOS this week — were in stock at previous week, OOS now. Investigate causes.',
  persistent:  'Persistent OOS — out of stock at both snapshots. Escalation candidates.',
};

// Tab list — same KPIs across all 3 tables
const KPI_TABS = [
  { id: 'overview',   label: 'Overview',    icon: 'grid' },
  { id: 'oos',        label: 'OOS',         icon: 'x-octagon' },
  { id: 'phantom',    label: 'Phantom',     icon: 'eye' },
  { id: 'low',        label: 'Low cover',   icon: 'clock' },
  { id: 'healthy',    label: 'Healthy',     icon: 'check-circle' },
  { id: 'lost',       label: 'Lost sales',  icon: 'dollar' },
  { id: 'soh',        label: 'SOH',         icon: 'archive' },
  { id: 'disc',       label: 'Discontinued', icon: 'trash' },
  { id: 'resolved',   label: 'Resolved',    icon: 'rocket' },
  { id: 'new_oos',    label: 'New OOS',     icon: 'plus-circle' },
  { id: 'persistent', label: 'Persistent',  icon: 'alert-triangle' },
];

// ---------- STORE TABLE COLUMN BUILDERS ----------
function storeCols(tabId){
  const ID = ID_COLS_STORE.map(c => ({ ...c, sort: c.k, num: false }));
  const idMin = ID.slice();   // Code, Store, Profile

  const map = {
    overview: [
      { h: 'Health %', k: 'health_pct', sort: 'health_pct', defDir: 'asc', cell: r => pill(r.health_pct), num: true },
      { h: 'Δ 7d', k: 'health_delta_7d', sort: 'health_delta_7d', cell: r => dlt(r.health_delta_7d, 'pos'), num: true },
      ...idMin,
      { h: 'Active', k: 'active', sort: 'active', cell: r => ci(r.active), num: true },
      { h: 'OOS', k: 'oos_latest', sort: 'oos_latest', cell: r => ci(r.oos_latest, { color: r.oos_latest > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'Healthy', k: 'healthy_latest', sort: 'healthy_latest', cell: r => ci(r.healthy_latest, { color: r.healthy_latest > 0 ? 'healthy' : null }), num: true },
      { h: 'SOH', k: 'soh_total', sort: 'soh_total', cell: r => cb(r.soh_total), num: true },
      { h: 'Lost/day', k: 'lost_daily_sales', sort: 'lost_daily_sales', cell: r => cd(r.lost_daily_sales, 1, { muteIfZero: true }), num: true },
    ],
    oos: [...idMin,
      { h: 'OOS now', k: 'oos_latest', sort: 'oos_latest', defDir: 'desc', cell: r => ci(r.oos_latest, { color: r.oos_latest > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'OOS prev wk', k: 'oos_7d', sort: 'oos_7d', cell: r => ci(r.oos_7d, { muteIfZero: true }), num: true },
      { h: 'Δ', k: 'oos_delta', sort: 'oos_delta', cell: r => dlt(r.oos_delta, 'count'), num: true },
      { h: 'Lost/day', k: 'lost_daily_sales', sort: 'lost_daily_sales', cell: r => cd(r.lost_daily_sales, 1, { muteIfZero: true }), num: true },
    ],
    phantom: [...idMin,
      { h: 'Phantom now', k: 'phantom_latest', sort: 'phantom_latest', defDir: 'desc', cell: r => ci(r.phantom_latest, { color: r.phantom_latest > 0 ? 'phantom' : null, muteIfZero: true }), num: true },
      { h: 'Phantom prev wk', k: 'phantom_7d', sort: 'phantom_7d', cell: r => ci(r.phantom_7d, { muteIfZero: true }), num: true },
      { h: 'Δ', k: 'phantom_delta', sort: 'phantom_delta', cell: r => dlt(r.phantom_delta, 'count'), num: true },
      { h: 'Active', k: 'active', sort: 'active', cell: r => ci(r.active), num: true },
    ],
    low: [...idMin,
      { h: 'Low now', k: 'low_latest', sort: 'low_latest', defDir: 'desc', cell: r => ci(r.low_latest, { color: r.low_latest > 0 ? 'warn' : null, muteIfZero: true }), num: true },
      { h: 'Low prev wk', k: 'low_7d', sort: 'low_7d', cell: r => ci(r.low_7d, { muteIfZero: true }), num: true },
      { h: 'Δ', k: 'low_delta', sort: 'low_delta', cell: r => dlt(r.low_delta, 'count'), num: true },
      { h: 'Active', k: 'active', sort: 'active', cell: r => ci(r.active), num: true },
    ],
    healthy: [...idMin,
      { h: 'Healthy now', k: 'healthy_latest', sort: 'healthy_latest', defDir: 'desc', cell: r => ci(r.healthy_latest, { color: r.healthy_latest > 0 ? 'healthy' : null }), num: true },
      { h: 'Healthy prev wk', k: 'healthy_7d', sort: 'healthy_7d', cell: r => ci(r.healthy_7d), num: true },
      { h: 'Δ', k: 'healthy_delta', sort: 'healthy_delta', cell: r => dlt(r.healthy_delta, 'pos'), num: true },
      { h: 'Health %', k: 'health_pct', sort: 'health_pct', cell: r => pill(r.health_pct), num: true },
    ],
    lost: [...idMin,
      { h: 'Lost/day now', k: 'lost_daily_sales', sort: 'lost_daily_sales', defDir: 'desc', cell: r => cd(r.lost_daily_sales, 1, { muteIfZero: true, color: r.lost_daily_sales > 0 ? 'crit' : null }), num: true },
      { h: 'Lost/day prev wk', k: 'lost_daily_sales_7d', sort: 'lost_daily_sales_7d', cell: r => cd(r.lost_daily_sales_7d, 1, { muteIfZero: true }), num: true },
      { h: 'Δ', k: 'lost_delta', sort: 'lost_delta', cell: r => dlt(r.lost_delta, 'count'), num: true },
      { h: 'OOS', k: 'oos_latest', sort: 'oos_latest', cell: r => ci(r.oos_latest, { color: r.oos_latest > 0 ? 'crit' : null, muteIfZero: true }), num: true },
    ],
    soh: [...idMin,
      { h: 'SOH now', k: 'soh_total', sort: 'soh_total', defDir: 'desc', cell: r => cb(r.soh_total), num: true },
      { h: 'SOH prev wk', k: 'soh_total_7d', sort: 'soh_total_7d', cell: r => cb(r.soh_total_7d), num: true },
      { h: 'Δ SOH', k: 'soh_delta', sort: 'soh_delta', cell: r => dlt(r.soh_delta, 'pos'), num: true },
      { h: 'DROS', k: 'dros_total', sort: 'dros_total', cell: r => cd(r.dros_total, 1, { muteIfZero: true }), num: true },
      { h: 'Active', k: 'active', sort: 'active', cell: r => ci(r.active), num: true },
    ],
    disc: [...idMin,
      { h: 'Disc items now', k: 'disc_soh_count', sort: 'disc_soh_count', defDir: 'desc', cell: r => ci(r.disc_soh_count, { color: r.disc_soh_count > 0 ? 'phantom' : null, muteIfZero: true }), num: true },
      { h: 'Disc prev wk', k: 'disc_soh_count_7d', sort: 'disc_soh_count_7d', cell: r => ci(r.disc_soh_count_7d, { muteIfZero: true }), num: true },
      { h: 'Δ', k: 'disc_soh_delta', sort: 'disc_soh_delta', cell: r => dlt(r.disc_soh_delta, 'count'), num: true },
      { h: 'Dead-stock units', k: 'disc_soh_units', sort: 'disc_soh_units', cell: r => cb(r.disc_soh_units), num: true },
      { h: 'Δ units', k: 'disc_soh_units_delta', sort: 'disc_soh_units_delta', cell: r => dlt(r.disc_soh_units_delta, 'count'), num: true },
    ],
    resolved: [...idMin,
      { h: 'Resolved', k: 'resolved', sort: 'resolved', defDir: 'desc', cell: r => ci(r.resolved, { color: r.resolved > 0 ? 'healthy' : null, muteIfZero: true }), num: true },
      { h: 'OOS still left', k: 'oos_latest', sort: 'oos_latest', cell: r => ci(r.oos_latest, { color: r.oos_latest > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'Health %', k: 'health_pct', sort: 'health_pct', cell: r => pill(r.health_pct), num: true },
    ],
    new_oos: [...idMin,
      { h: 'New OOS', k: 'new_oos', sort: 'new_oos', defDir: 'desc', cell: r => ci(r.new_oos, { color: r.new_oos > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'OOS now total', k: 'oos_latest', sort: 'oos_latest', cell: r => ci(r.oos_latest, { color: r.oos_latest > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'Lost/day', k: 'lost_daily_sales', sort: 'lost_daily_sales', cell: r => cd(r.lost_daily_sales, 1, { muteIfZero: true }), num: true },
    ],
    persistent: [...idMin,
      { h: 'Persistent', k: 'persistent', sort: 'persistent', defDir: 'desc', cell: r => ci(r.persistent, { color: r.persistent > 0 ? 'phantom' : null, muteIfZero: true }), num: true },
      { h: 'OOS now', k: 'oos_latest', sort: 'oos_latest', cell: r => ci(r.oos_latest, { color: r.oos_latest > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'Lost/day', k: 'lost_daily_sales', sort: 'lost_daily_sales', cell: r => cd(r.lost_daily_sales, 1, { muteIfZero: true }), num: true },
    ],
  };
  return map[tabId] || map.overview;
}

// ---------- PRODUCT TABLE COLUMN BUILDERS ----------
function productCols(tabId){
  const ID = ID_COLS_PRODUCT.map(c => ({ ...c, sort: c.k, num: false }));

  const map = {
    overview: [...ID,
      { h: 'Stocked in', k: 'stores_stocking', sort: 'stores_stocking', defDir: 'desc', cell: r => ci(r.stores_stocking), num: true },
      { h: 'OOS stores', k: 'oos_stores', sort: 'oos_stores', cell: r => ci(r.oos_stores, { color: r.oos_stores > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'OOS rate', k: 'oos_rate', sort: 'oos_rate', cell: r => cp(r.oos_rate, { color: r.oos_rate >= 50 ? 'crit' : null }), num: true },
      { h: 'SOH', k: 'soh_total', sort: 'soh_total', cell: r => cb(r.soh_total), num: true },
      { h: 'DROS', k: 'dros_total', sort: 'dros_total', cell: r => cd(r.dros_total, 1, { muteIfZero: true }), num: true },
    ],
    oos: [...ID,
      { h: 'OOS stores now', k: 'oos_stores', sort: 'oos_stores', defDir: 'desc', cell: r => ci(r.oos_stores, { color: r.oos_stores > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'OOS prev wk', k: 'oos_stores_7d', sort: 'oos_stores_7d', cell: r => ci(r.oos_stores_7d, { muteIfZero: true }), num: true },
      { h: 'Δ', k: 'oos_delta', sort: 'oos_delta', cell: r => dlt(r.oos_delta, 'count'), num: true },
      { h: 'OOS rate', k: 'oos_rate', sort: 'oos_rate', cell: r => cp(r.oos_rate, { color: r.oos_rate >= 50 ? 'crit' : null }), num: true },
      { h: 'Stocked in', k: 'stores_stocking', sort: 'stores_stocking', cell: r => ci(r.stores_stocking), num: true },
    ],
    phantom: [...ID,
      { h: 'Phantom now', k: 'phantom_stores', sort: 'phantom_stores', defDir: 'desc', cell: r => ci(r.phantom_stores, { color: r.phantom_stores > 0 ? 'phantom' : null, muteIfZero: true }), num: true },
      { h: 'Phantom prev wk', k: 'phantom_stores_7d', sort: 'phantom_stores_7d', cell: r => ci(r.phantom_stores_7d, { muteIfZero: true }), num: true },
      { h: 'Δ', k: 'phantom_delta', sort: 'phantom_delta', cell: r => dlt(r.phantom_delta, 'count'), num: true },
      { h: 'Stocked in', k: 'stores_stocking', sort: 'stores_stocking', cell: r => ci(r.stores_stocking), num: true },
    ],
    low: [...ID,
      { h: 'Low now', k: 'low_stores', sort: 'low_stores', defDir: 'desc', cell: r => ci(r.low_stores, { color: r.low_stores > 0 ? 'warn' : null, muteIfZero: true }), num: true },
      { h: 'Low prev wk', k: 'low_stores_7d', sort: 'low_stores_7d', cell: r => ci(r.low_stores_7d, { muteIfZero: true }), num: true },
      { h: 'Δ', k: 'low_delta', sort: 'low_delta', cell: r => dlt(r.low_delta, 'count'), num: true },
      { h: 'Stocked in', k: 'stores_stocking', sort: 'stores_stocking', cell: r => ci(r.stores_stocking), num: true },
    ],
    healthy: [...ID,
      { h: 'Healthy now', k: 'healthy_stores', sort: 'healthy_stores', defDir: 'desc', cell: r => ci(r.healthy_stores, { color: r.healthy_stores > 0 ? 'healthy' : null }), num: true },
      { h: 'Healthy prev wk', k: 'healthy_stores_7d', sort: 'healthy_stores_7d', cell: r => ci(r.healthy_stores_7d), num: true },
      { h: 'Δ', k: 'healthy_delta', sort: 'healthy_delta', cell: r => dlt(r.healthy_delta, 'pos'), num: true },
      { h: 'Stocked in', k: 'stores_stocking', sort: 'stores_stocking', cell: r => ci(r.stores_stocking), num: true },
    ],
    lost: [...ID,
      { h: 'Lost/day now', k: 'lost_daily_sales', sort: 'lost_daily_sales', defDir: 'desc', cell: r => cd(r.lost_daily_sales, 1, { muteIfZero: true, color: r.lost_daily_sales > 0 ? 'crit' : null }), num: true },
      { h: 'Lost/day prev wk', k: 'lost_daily_sales_7d', sort: 'lost_daily_sales_7d', cell: r => cd(r.lost_daily_sales_7d, 1, { muteIfZero: true }), num: true },
      { h: 'Δ', k: 'lost_delta', sort: 'lost_delta', cell: r => dlt(r.lost_delta, 'count'), num: true },
      { h: 'OOS stores', k: 'oos_stores', sort: 'oos_stores', cell: r => ci(r.oos_stores, { color: r.oos_stores > 0 ? 'crit' : null, muteIfZero: true }), num: true },
    ],
    soh: [...ID,
      { h: 'SOH now', k: 'soh_total', sort: 'soh_total', defDir: 'desc', cell: r => cb(r.soh_total), num: true },
      { h: 'SOH prev wk', k: 'soh_total_7d', sort: 'soh_total_7d', cell: r => cb(r.soh_total_7d), num: true },
      { h: 'Δ', k: 'soh_delta', sort: 'soh_delta', cell: r => dlt(r.soh_delta, 'pos'), num: true },
      { h: 'Stocked in', k: 'stores_stocking', sort: 'stores_stocking', cell: r => ci(r.stores_stocking), num: true },
      { h: 'DROS', k: 'dros_total', sort: 'dros_total', cell: r => cd(r.dros_total, 1, { muteIfZero: true }), num: true },
    ],
    disc: [...ID,
      { h: 'Disc stores now', k: 'disc_soh_stores', sort: 'disc_soh_stores', defDir: 'desc', cell: r => ci(r.disc_soh_stores, { color: r.disc_soh_stores > 0 ? 'phantom' : null, muteIfZero: true }), num: true },
      { h: 'Disc prev wk', k: 'disc_soh_stores_7d', sort: 'disc_soh_stores_7d', cell: r => ci(r.disc_soh_stores_7d, { muteIfZero: true }), num: true },
      { h: 'Δ stores', k: 'disc_soh_delta', sort: 'disc_soh_delta', cell: r => dlt(r.disc_soh_delta, 'count'), num: true },
      { h: 'Dead-stock units', k: 'disc_soh_units', sort: 'disc_soh_units', cell: r => cb(r.disc_soh_units), num: true },
    ],
    resolved: [...ID,
      { h: 'Resolved', k: 'resolved_stores', sort: 'resolved_stores', defDir: 'desc', cell: r => ci(r.resolved_stores, { color: r.resolved_stores > 0 ? 'healthy' : null, muteIfZero: true }), num: true },
      { h: 'OOS still left', k: 'oos_stores', sort: 'oos_stores', cell: r => ci(r.oos_stores, { color: r.oos_stores > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'Stocked in', k: 'stores_stocking', sort: 'stores_stocking', cell: r => ci(r.stores_stocking), num: true },
    ],
    new_oos: [...ID,
      { h: 'New OOS', k: 'new_oos_stores', sort: 'new_oos_stores', defDir: 'desc', cell: r => ci(r.new_oos_stores, { color: r.new_oos_stores > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'OOS total now', k: 'oos_stores', sort: 'oos_stores', cell: r => ci(r.oos_stores, { color: r.oos_stores > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'Lost/day', k: 'lost_daily_sales', sort: 'lost_daily_sales', cell: r => cd(r.lost_daily_sales, 1, { muteIfZero: true }), num: true },
    ],
    persistent: [...ID,
      { h: 'Persistent', k: 'persistent_stores', sort: 'persistent_stores', defDir: 'desc', cell: r => ci(r.persistent_stores, { color: r.persistent_stores > 0 ? 'phantom' : null, muteIfZero: true }), num: true },
      { h: 'OOS now', k: 'oos_stores', sort: 'oos_stores', cell: r => ci(r.oos_stores, { color: r.oos_stores > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'Lost/day', k: 'lost_daily_sales', sort: 'lost_daily_sales', cell: r => cd(r.lost_daily_sales, 1, { muteIfZero: true }), num: true },
    ],
  };
  return map[tabId] || map.overview;
}

// ---------- CLIENT TABLE COLUMN BUILDERS ----------
function clientCols(tabId){
  const ID = ID_COLS_CLIENT.map(c => ({ ...c, sort: c.k, num: false }));

  const map = {
    overview: [...ID,
      { h: 'Stores', k: 'stores', sort: 'stores', cell: r => ci(r.stores), num: true },
      { h: 'SKUs', k: 'total_skus', sort: 'total_skus', cell: r => ci(r.total_skus), num: true },
      { h: 'Active', k: 'active', sort: 'active', cell: r => ci(r.active), num: true },
      { h: 'Health %', k: 'health_pct', sort: 'health_pct', defDir: 'desc', cell: r => pill(r.health_pct), num: true },
      { h: 'OOS', k: 'oos_latest', sort: 'oos_latest', cell: r => ci(r.oos_latest, { color: r.oos_latest > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'SOH', k: 'soh_total', sort: 'soh_total', cell: r => cb(r.soh_total), num: true },
      { h: 'Lost/day', k: 'lost_daily_sales', sort: 'lost_daily_sales', cell: r => cd(r.lost_daily_sales, 1, { muteIfZero: true }), num: true },
    ],
    oos: [...ID,
      { h: 'OOS now', k: 'oos_latest', sort: 'oos_latest', defDir: 'desc', cell: r => ci(r.oos_latest, { color: r.oos_latest > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'OOS prev wk', k: 'oos_7d', sort: 'oos_7d', cell: r => ci(r.oos_7d, { muteIfZero: true }), num: true },
      { h: 'Δ', k: 'oos_delta', sort: 'oos_delta', cell: r => dlt(r.oos_delta, 'count'), num: true },
      { h: 'OOS %', k: 'oos_pct', sort: 'oos_pct', cell: r => cp(r.oos_pct, { color: r.oos_pct >= 10 ? 'crit' : null }), num: true },
      { h: 'Active', k: 'active', sort: 'active', cell: r => ci(r.active), num: true },
    ],
    phantom: [...ID,
      { h: 'Phantom now', k: 'phantom_latest', sort: 'phantom_latest', defDir: 'desc', cell: r => ci(r.phantom_latest, { color: r.phantom_latest > 0 ? 'phantom' : null, muteIfZero: true }), num: true },
      { h: 'Phantom prev wk', k: 'phantom_7d', sort: 'phantom_7d', cell: r => ci(r.phantom_7d, { muteIfZero: true }), num: true },
      { h: 'Δ', k: 'phantom_delta', sort: 'phantom_delta', cell: r => dlt(r.phantom_delta, 'count'), num: true },
      { h: 'Active', k: 'active', sort: 'active', cell: r => ci(r.active), num: true },
    ],
    low: [...ID,
      { h: 'Low now', k: 'low_latest', sort: 'low_latest', defDir: 'desc', cell: r => ci(r.low_latest, { color: r.low_latest > 0 ? 'warn' : null, muteIfZero: true }), num: true },
      { h: 'Low prev wk', k: 'low_7d', sort: 'low_7d', cell: r => ci(r.low_7d, { muteIfZero: true }), num: true },
      { h: 'Δ', k: 'low_delta', sort: 'low_delta', cell: r => dlt(r.low_delta, 'count'), num: true },
    ],
    healthy: [...ID,
      { h: 'Healthy now', k: 'healthy_latest', sort: 'healthy_latest', defDir: 'desc', cell: r => ci(r.healthy_latest, { color: r.healthy_latest > 0 ? 'healthy' : null }), num: true },
      { h: 'Healthy prev wk', k: 'healthy_7d', sort: 'healthy_7d', cell: r => ci(r.healthy_7d), num: true },
      { h: 'Δ', k: 'healthy_delta', sort: 'healthy_delta', cell: r => dlt(r.healthy_delta, 'pos'), num: true },
      { h: 'Health %', k: 'health_pct', sort: 'health_pct', cell: r => pill(r.health_pct), num: true },
    ],
    lost: [...ID,
      { h: 'Lost/day now', k: 'lost_daily_sales', sort: 'lost_daily_sales', defDir: 'desc', cell: r => cd(r.lost_daily_sales, 1, { muteIfZero: true, color: r.lost_daily_sales > 0 ? 'crit' : null }), num: true },
      { h: 'Lost/day prev wk', k: 'lost_daily_sales_7d', sort: 'lost_daily_sales_7d', cell: r => cd(r.lost_daily_sales_7d, 1, { muteIfZero: true }), num: true },
      { h: 'Δ', k: 'lost_delta', sort: 'lost_delta', cell: r => dlt(r.lost_delta, 'count'), num: true },
    ],
    soh: [...ID,
      { h: 'SOH now', k: 'soh_total', sort: 'soh_total', defDir: 'desc', cell: r => cb(r.soh_total), num: true },
      { h: 'SOH prev wk', k: 'soh_total_7d', sort: 'soh_total_7d', cell: r => cb(r.soh_total_7d), num: true },
      { h: 'Δ', k: 'soh_delta', sort: 'soh_delta', cell: r => dlt(r.soh_delta, 'pos'), num: true },
      { h: 'DROS', k: 'dros_total', sort: 'dros_total', cell: r => cd(r.dros_total, 1, { muteIfZero: true }), num: true },
    ],
    disc: [...ID,
      { h: 'Disc items now', k: 'disc_soh_count', sort: 'disc_soh_count', defDir: 'desc', cell: r => ci(r.disc_soh_count, { color: r.disc_soh_count > 0 ? 'phantom' : null, muteIfZero: true }), num: true },
      { h: 'Disc prev wk', k: 'disc_soh_count_7d', sort: 'disc_soh_count_7d', cell: r => ci(r.disc_soh_count_7d, { muteIfZero: true }), num: true },
      { h: 'Δ', k: 'disc_soh_delta', sort: 'disc_soh_delta', cell: r => dlt(r.disc_soh_delta, 'count'), num: true },
      { h: 'Dead-stock units', k: 'disc_soh_units', sort: 'disc_soh_units', cell: r => cb(r.disc_soh_units), num: true },
    ],
    resolved: [...ID,
      { h: 'Resolved', k: 'resolved', sort: 'resolved', defDir: 'desc', cell: r => ci(r.resolved, { color: r.resolved > 0 ? 'healthy' : null, muteIfZero: true }), num: true },
      { h: 'OOS still left', k: 'oos_latest', sort: 'oos_latest', cell: r => ci(r.oos_latest, { color: r.oos_latest > 0 ? 'crit' : null, muteIfZero: true }), num: true },
    ],
    new_oos: [...ID,
      { h: 'New OOS', k: 'new_oos', sort: 'new_oos', defDir: 'desc', cell: r => ci(r.new_oos, { color: r.new_oos > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'OOS total now', k: 'oos_latest', sort: 'oos_latest', cell: r => ci(r.oos_latest, { color: r.oos_latest > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'Lost/day', k: 'lost_daily_sales', sort: 'lost_daily_sales', cell: r => cd(r.lost_daily_sales, 1, { muteIfZero: true }), num: true },
    ],
    persistent: [...ID,
      { h: 'Persistent', k: 'persistent', sort: 'persistent', defDir: 'desc', cell: r => ci(r.persistent, { color: r.persistent > 0 ? 'phantom' : null, muteIfZero: true }), num: true },
      { h: 'OOS now', k: 'oos_latest', sort: 'oos_latest', cell: r => ci(r.oos_latest, { color: r.oos_latest > 0 ? 'crit' : null, muteIfZero: true }), num: true },
      { h: 'Lost/day', k: 'lost_daily_sales', sort: 'lost_daily_sales', cell: r => cd(r.lost_daily_sales, 1, { muteIfZero: true }), num: true },
    ],
  };
  return map[tabId] || map.overview;
}

// Default sort per tab
const DEF_SORT = {
  overview:   ['health_pct', 'asc'],
  oos:        ['oos_latest', 'desc'],
  phantom:    ['phantom_latest', 'desc'],
  low:        ['low_latest', 'desc'],
  healthy:    ['healthy_latest', 'desc'],
  lost:       ['lost_daily_sales', 'desc'],
  soh:        ['soh_total', 'desc'],
  disc:       ['disc_soh_count', 'desc'],
  resolved:   ['resolved', 'desc'],
  new_oos:    ['new_oos', 'desc'],
  persistent: ['persistent', 'desc'],
};
const DEF_SORT_PRODUCT = {
  overview:   ['stores_stocking', 'desc'],
  oos:        ['oos_stores', 'desc'],
  phantom:    ['phantom_stores', 'desc'],
  low:        ['low_stores', 'desc'],
  healthy:    ['healthy_stores', 'desc'],
  lost:       ['lost_daily_sales', 'desc'],
  soh:        ['soh_total', 'desc'],
  disc:       ['disc_soh_stores', 'desc'],
  resolved:   ['resolved_stores', 'desc'],
  new_oos:    ['new_oos_stores', 'desc'],
  persistent: ['persistent_stores', 'desc'],
};
const DEF_SORT_CLIENT = {
  overview:   ['health_pct', 'desc'],
  oos:        ['oos_latest', 'desc'],
  phantom:    ['phantom_latest', 'desc'],
  low:        ['low_latest', 'desc'],
  healthy:    ['healthy_latest', 'desc'],
  lost:       ['lost_daily_sales', 'desc'],
  soh:        ['soh_total', 'desc'],
  disc:       ['disc_soh_count', 'desc'],
  resolved:   ['resolved', 'desc'],
  new_oos:    ['new_oos', 'desc'],
  persistent: ['persistent', 'desc'],
};

// Build tab buttons into container
function buildTabs(containerId, descId, onTabClick){
  const c = document.getElementById(containerId);
  c.innerHTML = KPI_TABS.map((t, i) => `
    <button class="tbl-tab" data-tab="${t.id}" aria-selected="${i === 0 ? 'true' : 'false'}">
      <svg class="icon"><use href="#i-${t.icon}"/></svg>${escapeHTML(t.label)}
      <span class="tab-count" data-count></span>
    </button>`).join('');
  c.addEventListener('click', e => {
    const btn = e.target.closest('.tbl-tab');
    if (!btn) return;
    c.querySelectorAll('.tbl-tab').forEach(b => b.setAttribute('aria-selected', b === btn ? 'true' : 'false'));
    onTabClick(btn.dataset.tab);
  });
  document.getElementById(descId).textContent = TAB_DESC.overview;
}

// ============================================================ STORE TABLE
const storeState = { tab: 'overview', sort: 'health_pct', dir: 'asc', search: '', page: 0, pageSize: 25, data: [] };

function getFilteredStores(){
  let s = storeState.data.slice();
  if (storeState.search){
    const q = storeState.search.toLowerCase();
    s = s.filter(r =>
      String(r.site_code).toLowerCase().includes(q) ||
      String(r.site_description).toLowerCase().includes(q));
  }
  s.sort((a, b) => {
    let va = a[storeState.sort], vb = b[storeState.sort];
    if (typeof va === 'string'){
      va = va.toLowerCase(); vb = (vb || '').toLowerCase();
      return storeState.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return storeState.dir === 'asc' ? (+va || 0) - (+vb || 0) : (+vb || 0) - (+va || 0);
  });
  return s;
}

// Counts per tab — used to populate tab badges
function storeTabCount(tab, data){
  switch (tab){
    case 'overview':   return data.length;
    case 'oos':        return data.filter(r => r.oos_latest > 0).length;
    case 'phantom':    return data.filter(r => r.phantom_latest > 0).length;
    case 'low':        return data.filter(r => r.low_latest > 0).length;
    case 'healthy':    return data.filter(r => r.healthy_latest > 0).length;
    case 'lost':       return data.filter(r => r.lost_daily_sales > 0).length;
    case 'soh':        return data.length;
    case 'disc':       return data.filter(r => r.disc_soh_count > 0).length;
    case 'resolved':   return data.filter(r => r.resolved > 0).length;
    case 'new_oos':    return data.filter(r => r.new_oos > 0).length;
    case 'persistent': return data.filter(r => r.persistent > 0).length;
    default: return data.length;
  }
}
function productTabCount(tab, data){
  switch (tab){
    case 'overview':   return data.length;
    case 'oos':        return data.filter(r => r.oos_stores > 0).length;
    case 'phantom':    return data.filter(r => r.phantom_stores > 0).length;
    case 'low':        return data.filter(r => r.low_stores > 0).length;
    case 'healthy':    return data.filter(r => r.healthy_stores > 0).length;
    case 'lost':       return data.filter(r => r.lost_daily_sales > 0).length;
    case 'soh':        return data.length;
    case 'disc':       return data.filter(r => r.disc_soh_stores > 0).length;
    case 'resolved':   return data.filter(r => r.resolved_stores > 0).length;
    case 'new_oos':    return data.filter(r => r.new_oos_stores > 0).length;
    case 'persistent': return data.filter(r => r.persistent_stores > 0).length;
    default: return data.length;
  }
}
function clientTabCount(tab, data){
  switch (tab){
    case 'overview':   return data.length;
    case 'oos':        return data.filter(r => r.oos_latest > 0).length;
    case 'phantom':    return data.filter(r => r.phantom_latest > 0).length;
    case 'low':        return data.filter(r => r.low_latest > 0).length;
    case 'healthy':    return data.filter(r => r.healthy_latest > 0).length;
    case 'lost':       return data.filter(r => r.lost_daily_sales > 0).length;
    case 'soh':        return data.length;
    case 'disc':       return data.filter(r => r.disc_soh_count > 0).length;
    case 'resolved':   return data.filter(r => r.resolved > 0).length;
    case 'new_oos':    return data.filter(r => r.new_oos > 0).length;
    case 'persistent': return data.filter(r => r.persistent > 0).length;
    default: return data.length;
  }
}
function updateTabCounts(containerId, countsByTab){
  const c = document.getElementById(containerId);
  c.querySelectorAll('.tbl-tab').forEach(btn => {
    const id = btn.dataset.tab;
    const span = btn.querySelector('[data-count]');
    if (span) span.textContent = fmt.int(countsByTab[id] || 0);
  });
}

function renderStoreTable(){
  const cols = storeCols(storeState.tab);
  const all = getFilteredStores();
  const totalPages = Math.max(1, Math.ceil(all.length / storeState.pageSize));
  if (storeState.page >= totalPages) storeState.page = totalPages - 1;
  if (storeState.page < 0) storeState.page = 0;
  const start = storeState.page * storeState.pageSize;
  const slice = all.slice(start, start + storeState.pageSize);

  $('#store-meta').textContent = `${fmt.int(all.length)} stores`;
  $('#store-page-info').textContent = all.length > 0
    ? `${start + 1}–${Math.min(start + storeState.pageSize, all.length)} of ${fmt.int(all.length)}`
    : '0 of 0';
  $('#store-prev').disabled = storeState.page === 0;
  $('#store-next').disabled = storeState.page >= totalPages - 1;
  $('#store-tab-desc').textContent = TAB_DESC[storeState.tab] || '';

  const headers = cols.map(c => {
    const isActive = c.sort === storeState.sort;
    const arrow = isActive ? (storeState.dir === 'asc' ? '↑' : '↓') : '↕';
    const cls = `${c.num ? 'num ' : ''}${isActive ? 'sort-active ' : ''}`.trim();
    return `<th class="${cls}" data-sort="${c.sort}">${escapeHTML(c.h)} <span class="sort-arrow">${arrow}</span></th>`;
  }).join('');

  let body;
  if (!slice.length){
    body = `<tr><td colspan="${cols.length}" class="empty">No matches.</td></tr>`;
  } else {
    body = slice.map(r => {
      const isSel = filterState.selected_store_idx === r._idx;
      return `<tr class="clickable${isSel ? ' selected' : ''}" data-store-idx="${r._idx}">${cols.map(c => c.cell(r)).join('')}</tr>`;
    }).join('');
  }
  $('#store-table').innerHTML = `<thead><tr>${headers}</tr></thead><tbody>${body}</tbody>`;

  // Update tab counts
  const counts = {};
  KPI_TABS.forEach(t => counts[t.id] = storeTabCount(t.id, storeState.data));
  updateTabCounts('store-tabs', counts);

  // Wire sorts
  $$('#store-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      const c = cols.find(c => c.sort === key);
      const def = c && c.defDir ? c.defDir : 'desc';
      if (storeState.sort === key) storeState.dir = storeState.dir === 'asc' ? 'desc' : 'asc';
      else { storeState.sort = key; storeState.dir = def; }
      storeState.page = 0;
      renderStoreTable();
    });
  });
  // Row click → drill product table
  $$('#store-table tbody tr.clickable').forEach(tr => {
    tr.addEventListener('click', () => {
      const idx = +tr.dataset.storeIdx;
      filterState.selected_store_idx = filterState.selected_store_idx === idx ? null : idx;
      window.__updateFilterUI();
      renderStoreTable();
      renderProductTable();
      if (filterState.selected_store_idx != null){
        const t = $('#product-section');
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// Wire toolbar
let storeSearchTimer;
$('#store-search').addEventListener('input', e => {
  clearTimeout(storeSearchTimer);
  storeSearchTimer = setTimeout(() => {
    storeState.search = e.target.value.trim();
    storeState.page = 0;
    renderStoreTable();
  }, 130);
});
$('#store-prev').addEventListener('click', () => { storeState.page--; renderStoreTable(); });
$('#store-next').addEventListener('click', () => { storeState.page++; renderStoreTable(); });

// ============================================================ PRODUCT TABLE
const productState = { tab: 'overview', sort: 'stores_stocking', dir: 'desc', search: '', page: 0, pageSize: 25, data: [] };

function getFilteredProducts(){
  let p = productState.data.slice();
  if (productState.search){
    const q = productState.search.toLowerCase();
    p = p.filter(r =>
      String(r.barcode).toLowerCase().includes(q) ||
      String(r.product_description).toLowerCase().includes(q));
  }
  p.sort((a, b) => {
    let va = a[productState.sort], vb = b[productState.sort];
    if (typeof va === 'string'){
      va = va.toLowerCase(); vb = (vb || '').toLowerCase();
      return productState.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return productState.dir === 'asc' ? (+va || 0) - (+vb || 0) : (+vb || 0) - (+va || 0);
  });
  return p;
}

function renderProductTable(){
  productState.data = window.__aggregateProducts(filterState.selected_store_idx);

  const pinWrap = $('#product-pin-wrap');
  if (filterState.selected_store_idx != null){
    const sm = D.stores_meta[filterState.selected_store_idx];
    pinWrap.innerHTML = `<div class="store-pin">
      <span class="pin-code">${escapeHTML(sm.code)}</span>
      <span>${escapeHTML(sm.name)}</span>
      <button id="clear-store-pin" title="Clear filter">✕</button></div>`;
    $('#clear-store-pin').addEventListener('click', e => {
      e.stopPropagation();
      filterState.selected_store_idx = null;
      window.__updateFilterUI();
      renderStoreTable(); renderProductTable();
    });
  } else { pinWrap.innerHTML = ''; }

  const cols = productCols(productState.tab);
  const all = getFilteredProducts();
  const totalPages = Math.max(1, Math.ceil(all.length / productState.pageSize));
  if (productState.page >= totalPages) productState.page = totalPages - 1;
  if (productState.page < 0) productState.page = 0;
  const start = productState.page * productState.pageSize;
  const slice = all.slice(start, start + productState.pageSize);

  const restrictMsg = filterState.selected_store_idx != null ? ' for selected store' : '';
  $('#product-meta').textContent = `${fmt.int(all.length)} products${restrictMsg}`;
  $('#product-page-info').textContent = all.length > 0
    ? `${start + 1}–${Math.min(start + productState.pageSize, all.length)} of ${fmt.int(all.length)}`
    : '0 of 0';
  $('#product-prev').disabled = productState.page === 0;
  $('#product-next').disabled = productState.page >= totalPages - 1;
  $('#product-tab-desc').textContent = TAB_DESC[productState.tab] || '';

  const headers = cols.map(c => {
    const isActive = c.sort === productState.sort;
    const arrow = isActive ? (productState.dir === 'asc' ? '↑' : '↓') : '↕';
    const cls = `${c.num ? 'num ' : ''}${isActive ? 'sort-active ' : ''}`.trim();
    return `<th class="${cls}" data-sort="${c.sort}">${escapeHTML(c.h)} <span class="sort-arrow">${arrow}</span></th>`;
  }).join('');

  let body;
  if (!slice.length){
    body = `<tr><td colspan="${cols.length}" class="empty">No products match.</td></tr>`;
  } else {
    body = slice.map(r => `<tr>${cols.map(c => c.cell(r)).join('')}</tr>`).join('');
  }
  $('#product-table').innerHTML = `<thead><tr>${headers}</tr></thead><tbody>${body}</tbody>`;

  const counts = {};
  KPI_TABS.forEach(t => counts[t.id] = productTabCount(t.id, productState.data));
  updateTabCounts('product-tabs', counts);

  $$('#product-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      const c = cols.find(c => c.sort === key);
      const def = c && c.defDir ? c.defDir : 'desc';
      if (productState.sort === key) productState.dir = productState.dir === 'asc' ? 'desc' : 'asc';
      else { productState.sort = key; productState.dir = def; }
      productState.page = 0;
      renderProductTable();
    });
  });
}

let productSearchTimer;
$('#product-search').addEventListener('input', e => {
  clearTimeout(productSearchTimer);
  productSearchTimer = setTimeout(() => {
    productState.search = e.target.value.trim();
    productState.page = 0;
    renderProductTable();
  }, 130);
});
$('#product-prev').addEventListener('click', () => { productState.page--; renderProductTable(); });
$('#product-next').addEventListener('click', () => { productState.page++; renderProductTable(); });

// ============================================================ CLIENT TABLE
const clientState = { tab: 'overview', sort: 'health_pct', dir: 'desc', data: [] };

function renderClientTable(){
  const cols = clientCols(clientState.tab);
  const all = clientState.data.slice().sort((a, b) => {
    let va = a[clientState.sort], vb = b[clientState.sort];
    if (typeof va === 'string'){
      va = va.toLowerCase(); vb = (vb || '').toLowerCase();
      return clientState.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return clientState.dir === 'asc' ? (+va || 0) - (+vb || 0) : (+vb || 0) - (+va || 0);
  });

  $('#client-tab-desc').textContent = TAB_DESC[clientState.tab] || '';

  const headers = cols.map(c => {
    const isActive = c.sort === clientState.sort;
    const arrow = isActive ? (clientState.dir === 'asc' ? '↑' : '↓') : '↕';
    const cls = `${c.num ? 'num ' : ''}${isActive ? 'sort-active ' : ''}`.trim();
    return `<th class="${cls}" data-sort="${c.sort}">${escapeHTML(c.h)} <span class="sort-arrow">${arrow}</span></th>`;
  }).join('');
  let body;
  if (!all.length){
    body = `<tr><td colspan="${cols.length}" class="empty">No clients match.</td></tr>`;
  } else {
    body = all.map(r => `<tr>${cols.map(c => c.cell(r)).join('')}</tr>`).join('');
  }
  $('#client-table').innerHTML = `<thead><tr>${headers}</tr></thead><tbody>${body}</tbody>`;

  const counts = {};
  KPI_TABS.forEach(t => counts[t.id] = clientTabCount(t.id, clientState.data));
  updateTabCounts('client-tabs', counts);

  $$('#client-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      const c = cols.find(c => c.sort === key);
      const def = c && c.defDir ? c.defDir : 'desc';
      if (clientState.sort === key) clientState.dir = clientState.dir === 'asc' ? 'desc' : 'asc';
      else { clientState.sort = key; clientState.dir = def; }
      renderClientTable();
    });
  });
}

// ============================================================ PROFILES
function renderProfiles(view){
  const labels = {
    'Corporate Store':     { name: 'Corporate stores',     icon: 'store' },
    'Franchisee Store':    { name: 'Franchisee stores',    icon: 'users' },
    'Distribution center': { name: 'Distribution centers', icon: 'package' },
  };
  const grid = $('#profile-grid');
  if (!view.profiles.length){
    grid.innerHTML = '<div class="empty">No data for current filters.</div>';
    return;
  }
  grid.innerHTML = view.profiles.map(p => {
    const meta = labels[p.site_profile] || { name: p.site_profile || '(unknown)', icon: 'store' };
    const oosPct = p.active > 0 ? (100 * p.oos_latest / p.active).toFixed(1) : '0.0';
    const heaPct = p.active > 0 ? (100 * p.healthy_latest / p.active).toFixed(1) : '0.0';
    return `<div class="card profile-card">
      <h3>${icon(meta.icon)} ${escapeHTML(meta.name)}</h3>
      <div class="stores-badge">${fmt.int(p.store_count)} stores · ${fmt.int(p.active)} active items</div>
      <div class="profile-stats">
        <div class="profile-stat crit"><div class="v">${fmt.int(p.oos_latest)}</div><div class="l">OOS now (${oosPct}%)</div></div>
        <div class="profile-stat ok"><div class="v">${fmt.int(p.healthy_latest)}</div><div class="l">Healthy (${heaPct}%)</div></div>
        <div class="profile-stat warn"><div class="v">${fmt.int(p.low_latest)}</div><div class="l">Low cover</div></div>
        <div class="profile-stat"><div class="v">${fmt.intK(p.soh_total)}</div><div class="l">Total SOH</div></div>
      </div></div>`;
  }).join('');
}

// ============================================================ SETUP TABS
buildTabs('store-tabs',   'store-tab-desc',   tab => {
  storeState.tab = tab;
  const def = DEF_SORT[tab];
  storeState.sort = def[0]; storeState.dir = def[1]; storeState.page = 0;
  renderStoreTable();
});
buildTabs('product-tabs', 'product-tab-desc', tab => {
  productState.tab = tab;
  const def = DEF_SORT_PRODUCT[tab];
  productState.sort = def[0]; productState.dir = def[1]; productState.page = 0;
  renderProductTable();
});
buildTabs('client-tabs',  'client-tab-desc',  tab => {
  clientState.tab = tab;
  const def = DEF_SORT_CLIENT[tab];
  clientState.sort = def[0]; clientState.dir = def[1];
  renderClientTable();
});

// ============================================================ ORCHESTRATION
function renderAll(){
  const view = window.__recompute();
  window.__renderHero(view);
  window.__renderTimeline(view);
  window.__renderSpotlights(view);

  storeState.data = view.stores;
  if (filterState.selected_store_idx != null
      && !view.stores.some(s => s._idx === filterState.selected_store_idx)){
    filterState.selected_store_idx = null;
  }
  renderStoreTable();
  renderProfiles(view);

  clientState.data = view.clients;
  renderClientTable();
  renderProductTable();

  $('#footer-stats').textContent = `${fmt.int(view.stores.length)} stores · ${fmt.int(view.portfolio.total_active)} active items · 2 snapshots (latest vs previous week)`;
}

window.onFilterChange = function(){
  if (window.__updateFilterUI) window.__updateFilterUI();
  renderAll();
};

renderAll();
})();
