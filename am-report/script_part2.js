(function(){
'use strict';
const D = window.__D;
const filterState = window.__filterState;

// Bitmask v4:
// 0 active   1 oos_l   2 oos_7   3 low_l   4 low_7
// 5 phan_l   6 hea_l   7 hea_7   8 resv    9 newO   10 pers
// 11 phan_7  12 disc_l 13 disc_7

function buildMasks(){
  const am = D.articles_meta;
  const sm = D.stores_meta;
  const numQ  = filterState.article_num.toLowerCase();
  const descQ = filterState.article_desc.toLowerCase();
  const articleMatch = new Uint8Array(am.length);
  for (let i = 0; i < am.length; i++){
    const a = am[i];
    if (!filterState.clients.has(a.client_idx)) continue;
    if (numQ  && !String(a.num).toLowerCase().includes(numQ)) continue;
    if (descQ && !a.desc.toLowerCase().includes(descQ))       continue;
    articleMatch[i] = 1;
  }
  const storeMatch = new Uint8Array(sm.length);
  for (let i = 0; i < sm.length; i++){
    storeMatch[i] = filterState.profiles.has(sm[i].profile_idx) ? 1 : 0;
  }
  const statusMatch = new Uint8Array(D.filter_options.statuses.length);
  filterState.statuses.forEach(i => statusMatch[i] = 1);
  return { articleMatch, storeMatch, statusMatch };
}

function recompute(){
  const rows = D.rows;
  const N = rows.flags.length;
  const am = D.articles_meta;
  const sm = D.stores_meta;
  const { articleMatch, storeMatch, statusMatch } = buildMasks();

  const stores = sm.map((s, i) => ({
    site_code: s.code, site_description: s.name,
    site_profile: D.filter_options.profiles[s.profile_idx] || '',
    profile_idx: s.profile_idx,
    total_articles: 0, active: 0, inactive: 0,
    oos_latest: 0, oos_7d: 0,
    phantom_latest: 0, phantom_7d: 0,
    low_latest: 0, low_7d: 0,
    healthy_latest: 0, healthy_7d: 0,
    resolved: 0, new_oos: 0, persistent: 0,
    soh_total: 0, soh_total_7d: 0,
    dros_total: 0,
    lost_daily_sales: 0, lost_daily_sales_7d: 0,
    disc_soh_count: 0, disc_soh_count_7d: 0,
    disc_soh_units: 0, disc_soh_units_7d: 0,
    _vendors: new Set(), _products: new Set(),
    _idx: i,
  }));

  const profiles = D.filter_options.profiles.map(name => ({
    site_profile: name, active: 0,
    oos_latest: 0, phantom_latest: 0,
    low_latest: 0, healthy_latest: 0,
    persistent: 0, resolved: 0,
    soh_total: 0,
    lost_daily_sales: 0,
    disc_soh_count: 0, disc_soh_units: 0,
    store_count: 0,
  }));

  const clients = D.filter_options.clients.map(name => ({
    client_name: name,
    active: 0, oos_latest: 0, oos_7d: 0,
    phantom_latest: 0, phantom_7d: 0,
    low_latest: 0, low_7d: 0,
    healthy_latest: 0, healthy_7d: 0,
    persistent: 0, resolved: 0, new_oos: 0,
    soh_total: 0, soh_total_7d: 0,
    dros_total: 0,
    lost_daily_sales: 0, lost_daily_sales_7d: 0,
    disc_soh_count: 0, disc_soh_count_7d: 0,
    disc_soh_units: 0, disc_soh_units_7d: 0,
    _stores: new Set(), _skus: new Set(),
  }));

  const ts = {
    oos_7d: 0, oos_latest: 0,
    low_7d: 0, low_latest: 0,
    healthy_7d: 0, healthy_latest: 0,
    phantom_7d: 0, phantom_latest: 0,
    lost_7d: 0, lost_latest: 0,
    soh_7d: 0, soh_latest: 0,
    active: 0, inactive: 0,
    resolved: 0, new_oos: 0, persistent: 0,
    disc_soh_count: 0, disc_soh_count_7d: 0,
    disc_soh_units: 0, disc_soh_units_7d: 0,
  };

  const f_arr  = rows.flags;
  const si_arr = rows.store_idx;
  const ai_arr = rows.article_idx;
  const xi_arr = rows.status_idx;
  const sohL = rows.soh_l, soh7 = rows.soh_7;
  const dL = rows.d_l, d7 = rows.d_7;

  for (let i = 0; i < N; i++){
    const si = si_arr[i];
    if (!storeMatch[si]) continue;
    const ai = ai_arr[i];
    if (!articleMatch[ai]) continue;
    if (!statusMatch[xi_arr[i]]) continue;

    const f = f_arr[i];
    const isAct  = (f >> 0)  & 1;
    const oosL   = (f >> 1)  & 1;
    const oos7   = (f >> 2)  & 1;
    const lowL   = (f >> 3)  & 1;
    const low7   = (f >> 4)  & 1;
    const phanL  = (f >> 5)  & 1;
    const heaL   = (f >> 6)  & 1;
    const hea7   = (f >> 7)  & 1;
    const res    = (f >> 8)  & 1;
    const newO   = (f >> 9)  & 1;
    const pers   = (f >> 10) & 1;
    const phan7  = (f >> 11) & 1;
    const discL  = (f >> 12) & 1;
    const disc7  = (f >> 13) & 1;

    const sL = sohL[i], s7 = soh7[i];
    const droL = dL[i], dro7 = d7[i];

    // Store
    const s = stores[si];
    s.total_articles++;
    if (isAct) {
      s.active++;
      s._vendors.add(am[ai].client_idx);
      s._products.add(ai);
    } else {
      s.inactive++;
    }
    if (oosL) s.oos_latest++;
    if (oos7) s.oos_7d++;
    if (phanL) s.phantom_latest++;
    if (phan7) s.phantom_7d++;
    if (lowL) s.low_latest++;
    if (low7) s.low_7d++;
    if (heaL) s.healthy_latest++;
    if (hea7) s.healthy_7d++;
    if (res)  s.resolved++;
    if (newO) s.new_oos++;
    if (pers) s.persistent++;
    s.soh_total    += sL;
    s.soh_total_7d += s7;
    s.dros_total   += droL;
    if (oosL) s.lost_daily_sales    += droL;
    if (oos7) s.lost_daily_sales_7d += dro7;
    if (discL) { s.disc_soh_count++;     s.disc_soh_units    += sL; }
    if (disc7) { s.disc_soh_count_7d++;  s.disc_soh_units_7d += s7; }

    // Time series
    if (isAct) ts.active++; else ts.inactive++;
    if (oosL) { ts.oos_latest++; ts.lost_latest += droL; }
    if (oos7) { ts.oos_7d++;     ts.lost_7d     += dro7; }
    if (lowL) ts.low_latest++;
    if (low7) ts.low_7d++;
    if (heaL) ts.healthy_latest++;
    if (hea7) ts.healthy_7d++;
    if (phanL) ts.phantom_latest++;
    if (phan7) ts.phantom_7d++;
    if (res)  ts.resolved++;
    if (newO) ts.new_oos++;
    if (pers) ts.persistent++;
    ts.soh_latest += sL;
    ts.soh_7d     += s7;
    if (discL) { ts.disc_soh_count++;     ts.disc_soh_units    += sL; }
    if (disc7) { ts.disc_soh_count_7d++;  ts.disc_soh_units_7d += s7; }

    // Profile
    const pi = sm[si].profile_idx;
    if (pi >= 0){
      const p = profiles[pi];
      if (isAct) p.active++;
      if (oosL) { p.oos_latest++; p.lost_daily_sales += droL; }
      if (phanL) p.phantom_latest++;
      if (lowL) p.low_latest++;
      if (heaL) p.healthy_latest++;
      if (pers) p.persistent++;
      if (res)  p.resolved++;
      p.soh_total += sL;
      if (discL) { p.disc_soh_count++; p.disc_soh_units += sL; }
    }

    // Client
    const ci = am[ai].client_idx;
    if (ci >= 0){
      const c = clients[ci];
      if (isAct) c.active++;
      if (oosL) { c.oos_latest++; c.lost_daily_sales    += droL; }
      if (oos7) { c.oos_7d++;     c.lost_daily_sales_7d += dro7; }
      if (phanL) c.phantom_latest++;
      if (phan7) c.phantom_7d++;
      if (lowL) c.low_latest++;
      if (low7) c.low_7d++;
      if (heaL) c.healthy_latest++;
      if (hea7) c.healthy_7d++;
      if (pers) c.persistent++;
      if (res)  c.resolved++;
      if (newO) c.new_oos++;
      c.soh_total    += sL;
      c.soh_total_7d += s7;
      c.dros_total   += droL;
      if (discL) { c.disc_soh_count++;    c.disc_soh_units    += sL; }
      if (disc7) { c.disc_soh_count_7d++; c.disc_soh_units_7d += s7; }
      c._stores.add(si);
      c._skus.add(ai);
    }
  }

  // Stores post-process
  stores.forEach(s => {
    s.health_pct      = s.active > 0 ? +(100 * s.healthy_latest / s.active).toFixed(1) : 0;
    s.health_pct_7d   = s.active > 0 ? +(100 * s.healthy_7d     / s.active).toFixed(1) : 0;
    s.health_delta_7d = +(s.health_pct - s.health_pct_7d).toFixed(1);
    s.oos_delta       = s.oos_latest     - s.oos_7d;
    s.phantom_delta   = s.phantom_latest - s.phantom_7d;
    s.low_delta       = s.low_latest     - s.low_7d;
    s.healthy_delta   = s.healthy_latest - s.healthy_7d;
    s.soh_delta       = +(s.soh_total - s.soh_total_7d).toFixed(1);
    s.lost_delta      = +(s.lost_daily_sales - s.lost_daily_sales_7d).toFixed(2);
    s.disc_soh_delta       = s.disc_soh_count - s.disc_soh_count_7d;
    s.disc_soh_units_delta = +(s.disc_soh_units - s.disc_soh_units_7d).toFixed(1);
    s.vendor_count    = s._vendors.size;
    s.product_count   = s._products.size;
    delete s._vendors; delete s._products;
    s.soh_total           = +s.soh_total.toFixed(1);
    s.soh_total_7d        = +s.soh_total_7d.toFixed(1);
    s.dros_total          = +s.dros_total.toFixed(2);
    s.lost_daily_sales    = +s.lost_daily_sales.toFixed(2);
    s.lost_daily_sales_7d = +s.lost_daily_sales_7d.toFixed(2);
    s.disc_soh_units      = +s.disc_soh_units.toFixed(1);
    s.disc_soh_units_7d   = +s.disc_soh_units_7d.toFixed(1);
  });
  const activeStores = stores.filter(s => s.total_articles > 0);

  // Profile post-process
  profiles.forEach(p => {
    p.lost_daily_sales = +p.lost_daily_sales.toFixed(2);
    p.soh_total = +p.soh_total.toFixed(1);
    p.disc_soh_units = +p.disc_soh_units.toFixed(1);
  });
  activeStores.forEach(s => { if (s.profile_idx >= 0) profiles[s.profile_idx].store_count++; });
  const profilesActive = profiles.filter(p => p.active > 0 || p.store_count > 0);

  // Client post-process
  clients.forEach(c => {
    c.stores       = c._stores.size;
    c.total_skus   = c._skus.size;
    delete c._stores; delete c._skus;
    c.health_pct   = c.active > 0 ? +(100 * c.healthy_latest / c.active).toFixed(1) : 0;
    c.oos_pct      = c.active > 0 ? +(100 * c.oos_latest     / c.active).toFixed(1) : 0;
    c.oos_delta    = c.oos_latest     - c.oos_7d;
    c.phantom_delta = c.phantom_latest - c.phantom_7d;
    c.low_delta    = c.low_latest     - c.low_7d;
    c.healthy_delta = c.healthy_latest - c.healthy_7d;
    c.lost_delta   = +(c.lost_daily_sales - c.lost_daily_sales_7d).toFixed(2);
    c.soh_delta    = +(c.soh_total - c.soh_total_7d).toFixed(1);
    c.disc_soh_delta       = c.disc_soh_count - c.disc_soh_count_7d;
    c.disc_soh_units_delta = +(c.disc_soh_units - c.disc_soh_units_7d).toFixed(1);
    c.soh_total           = +c.soh_total.toFixed(1);
    c.soh_total_7d        = +c.soh_total_7d.toFixed(1);
    c.lost_daily_sales    = +c.lost_daily_sales.toFixed(2);
    c.lost_daily_sales_7d = +c.lost_daily_sales_7d.toFixed(2);
    c.disc_soh_units      = +c.disc_soh_units.toFixed(1);
    c.disc_soh_units_7d   = +c.disc_soh_units_7d.toFixed(1);
  });
  const clientsActive = clients.filter(c => c.active > 0 || c.oos_latest > 0 || c.disc_soh_count > 0);

  const portfolio = {
    total_stores:     activeStores.length,
    total_active:     ts.active,
    total_inactive:   ts.inactive,
    total_oos:        ts.oos_latest,
    total_oos_7d:     ts.oos_7d,
    total_phantom:    ts.phantom_latest,
    total_phantom_7d: ts.phantom_7d,
    total_low:        ts.low_latest,
    total_low_7d:     ts.low_7d,
    total_healthy:    ts.healthy_latest,
    total_healthy_7d: ts.healthy_7d,
    total_resolved:   ts.resolved,
    total_new_oos:    ts.new_oos,
    total_persistent: ts.persistent,
    total_soh:        +ts.soh_latest.toFixed(0),
    total_soh_7d:     +ts.soh_7d.toFixed(0),
    total_disc_count:    ts.disc_soh_count,
    total_disc_count_7d: ts.disc_soh_count_7d,
    total_disc_units:    +ts.disc_soh_units.toFixed(0),
    total_disc_units_7d: +ts.disc_soh_units_7d.toFixed(0),
    lost_daily_sales:    +ts.lost_latest.toFixed(2),
    lost_daily_sales_7d: +ts.lost_7d.toFixed(2),
    health_pct:    ts.active > 0 ? +(100 * ts.healthy_latest / ts.active).toFixed(1) : 0,
    health_pct_7d: ts.active > 0 ? +(100 * ts.healthy_7d     / ts.active).toFixed(1) : 0,
    series: {
      oos:     [ts.oos_7d, ts.oos_latest],
      low:     [ts.low_7d, ts.low_latest],
      healthy: [ts.healthy_7d, ts.healthy_latest],
      phantom: [ts.phantom_7d, ts.phantom_latest],
      lost:    [+ts.lost_7d.toFixed(2), +ts.lost_latest.toFixed(2)],
      soh:     [+ts.soh_7d.toFixed(0), +ts.soh_latest.toFixed(0)],
      disc_count: [ts.disc_soh_count_7d, ts.disc_soh_count],
      disc_units: [+ts.disc_soh_units_7d.toFixed(0), +ts.disc_soh_units.toFixed(0)],
    },
  };

  const top = (arr, fn, reverse = true) =>
    arr.slice().sort((a,b) => reverse ? fn(b) - fn(a) : fn(a) - fn(b)).slice(0, 5);
  const spotlights = {
    most_improved:  top(activeStores.filter(s => s.active > 0), s => s.health_delta_7d, true),
    most_regressed: top(activeStores.filter(s => s.active > 0), s => s.health_delta_7d, false),
    priority:       top(activeStores, s => s.lost_daily_sales, true),
    persistent:     top(activeStores, s => s.persistent, true),
  };

  return { portfolio, stores: activeStores, profiles: profilesActive, clients: clientsActive, spotlights };
}

// Aggregate products (optionally restricted to one store)
function aggregateProducts(restrictStoreIdx){
  const rows = D.rows;
  const N = rows.flags.length;
  const am = D.articles_meta;
  const { articleMatch, storeMatch, statusMatch } = buildMasks();

  const products = new Map();
  const f_arr  = rows.flags;
  const si_arr = rows.store_idx;
  const ai_arr = rows.article_idx;
  const xi_arr = rows.status_idx;
  const sohL = rows.soh_l, soh7 = rows.soh_7;
  const dL = rows.d_l, d7 = rows.d_7;

  for (let i = 0; i < N; i++){
    const si = si_arr[i];
    if (restrictStoreIdx != null && si !== restrictStoreIdx) continue;
    if (!storeMatch[si]) continue;
    const ai = ai_arr[i];
    if (!articleMatch[ai]) continue;
    if (!statusMatch[xi_arr[i]]) continue;

    const f = f_arr[i];
    const isAct = (f >> 0)  & 1;
    const oosL  = (f >> 1)  & 1;
    const oos7  = (f >> 2)  & 1;
    const lowL  = (f >> 3)  & 1;
    const low7  = (f >> 4)  & 1;
    const phanL = (f >> 5)  & 1;
    const heaL  = (f >> 6)  & 1;
    const hea7  = (f >> 7)  & 1;
    const res   = (f >> 8)  & 1;
    const newO  = (f >> 9)  & 1;
    const pers  = (f >> 10) & 1;
    const phan7 = (f >> 11) & 1;
    const discL = (f >> 12) & 1;
    const disc7 = (f >> 13) & 1;

    const sL = sohL[i], s7 = soh7[i];
    const droL = dL[i], dro7 = d7[i];

    let p = products.get(ai);
    if (!p){
      const a = am[ai];
      p = {
        barcode: a.num,
        product_description: a.desc,
        client_name: D.filter_options.clients[a.client_idx] || '',
        stores_stocking: 0, active_stores: 0,
        soh_total: 0, soh_total_7d: 0,
        dros_total: 0, dros_total_7d: 0,
        oos_stores: 0, oos_stores_7d: 0,
        phantom_stores: 0, phantom_stores_7d: 0,
        low_stores: 0, low_stores_7d: 0,
        healthy_stores: 0, healthy_stores_7d: 0,
        persistent_stores: 0, new_oos_stores: 0, resolved_stores: 0,
        lost_daily_sales: 0, lost_daily_sales_7d: 0,
        disc_soh_stores: 0, disc_soh_stores_7d: 0,
        disc_soh_units: 0, disc_soh_units_7d: 0,
      };
      products.set(ai, p);
    }
    p.stores_stocking++;
    if (isAct) p.active_stores++;
    p.soh_total       += sL;   p.soh_total_7d    += s7;
    p.dros_total      += droL; p.dros_total_7d   += dro7;
    if (oosL) { p.oos_stores++;  p.lost_daily_sales    += droL; }
    if (oos7) { p.oos_stores_7d++; p.lost_daily_sales_7d += dro7; }
    if (phanL) p.phantom_stores++;
    if (phan7) p.phantom_stores_7d++;
    if (lowL) p.low_stores++;
    if (low7) p.low_stores_7d++;
    if (heaL) p.healthy_stores++;
    if (hea7) p.healthy_stores_7d++;
    if (pers) p.persistent_stores++;
    if (newO) p.new_oos_stores++;
    if (res)  p.resolved_stores++;
    if (discL) { p.disc_soh_stores++;    p.disc_soh_units    += sL; }
    if (disc7) { p.disc_soh_stores_7d++; p.disc_soh_units_7d += s7; }
  }

  const out = [];
  for (const p of products.values()){
    p.soh_total        = +p.soh_total.toFixed(1);
    p.soh_total_7d     = +p.soh_total_7d.toFixed(1);
    p.soh_delta        = +(p.soh_total - p.soh_total_7d).toFixed(1);
    p.dros_total       = +p.dros_total.toFixed(2);
    p.dros_total_7d    = +p.dros_total_7d.toFixed(2);
    p.dros_delta       = +(p.dros_total - p.dros_total_7d).toFixed(2);
    p.oos_delta        = p.oos_stores     - p.oos_stores_7d;
    p.phantom_delta    = p.phantom_stores - p.phantom_stores_7d;
    p.low_delta        = p.low_stores     - p.low_stores_7d;
    p.healthy_delta    = p.healthy_stores - p.healthy_stores_7d;
    p.lost_daily_sales       = +p.lost_daily_sales.toFixed(2);
    p.lost_daily_sales_7d    = +p.lost_daily_sales_7d.toFixed(2);
    p.lost_delta             = +(p.lost_daily_sales - p.lost_daily_sales_7d).toFixed(2);
    p.disc_soh_delta         = p.disc_soh_stores - p.disc_soh_stores_7d;
    p.disc_soh_units         = +p.disc_soh_units.toFixed(1);
    p.disc_soh_units_7d      = +p.disc_soh_units_7d.toFixed(1);
    p.disc_soh_units_delta   = +(p.disc_soh_units - p.disc_soh_units_7d).toFixed(1);
    const ss = Math.max(p.stores_stocking, 1);
    p.oos_rate = +(100 * p.oos_stores / ss).toFixed(1);
    if (p.dros_total_7d > 0.001){
      p.dros_change_pct = +(100 * (p.dros_total - p.dros_total_7d) / p.dros_total_7d).toFixed(1);
    } else {
      p.dros_change_pct = p.dros_total > 0.001 ? 999 : 0;
    }
    out.push(p);
  }
  return out;
}

window.__recompute = recompute;
window.__aggregateProducts = aggregateProducts;
})();
