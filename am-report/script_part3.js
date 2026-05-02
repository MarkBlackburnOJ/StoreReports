(function(){
'use strict';
const D = window.__D;
const { fmt, escapeHTML, icon, deltaSpan } = window.__helpers;
const $ = sel => document.querySelector(sel);

function kClass(d, mode){
  if (d == null) return 'flat';
  if (Math.abs(d) < 0.05) return 'flat';
  if (Math.abs(d) < 0.5 && Number.isInteger(d)) return 'flat';
  return mode === 'count' ? (d > 0 ? 'up-bad' : 'down-good') : (d > 0 ? 'up-good' : 'down-bad');
}
function kText(d){
  if (d == null) return '—';
  if (Math.abs(d) < 0.5 && Number.isInteger(d)) return '0';
  return (d > 0 ? '▲ +' : '▼ ') + Math.round(d).toLocaleString('en-US');
}
function kTextDec(d){
  if (d == null) return '—';
  if (Math.abs(d) < 0.05) return '0';
  return (d > 0 ? '▲ +' : '▼ ') + d.toFixed(1);
}
function kTextK(d){
  if (d == null) return '—';
  if (Math.abs(d) < 0.5) return '0';
  const abs = Math.abs(d);
  let s;
  if (abs >= 1e6) s = (abs/1e6).toFixed(2) + 'M';
  else if (abs >= 1e4) s = (abs/1e3).toFixed(1) + 'K';
  else s = Math.round(abs).toLocaleString('en-US');
  return (d > 0 ? '▲ +' : '▼ ') + s;
}

function renderHero(view){
  const P = view.portfolio;
  $('#hero-tag').textContent = `${fmt.int(view.stores.length)} stores · ${fmt.int(P.total_active)} active items · latest vs previous week`;
  $('#k-health-pct').textContent = P.health_pct.toFixed(1) + '%';

  // Issues row
  $('#k-oos').textContent = fmt.int(P.total_oos);
  $('#k-oos-delta-wrap').innerHTML = `<span class="kpi-delta ${kClass(P.total_oos - P.total_oos_7d, 'count')}">${kText(P.total_oos - P.total_oos_7d)}</span>`;

  $('#k-phantom').textContent = fmt.int(P.total_phantom);
  $('#k-phantom-delta-wrap').innerHTML = `<span class="kpi-delta ${kClass(P.total_phantom - P.total_phantom_7d, 'count')}">${kText(P.total_phantom - P.total_phantom_7d)}</span>`;

  $('#k-low').textContent = fmt.int(P.total_low);
  $('#k-low-delta-wrap').innerHTML = `<span class="kpi-delta ${kClass(P.total_low - P.total_low_7d, 'count')}">${kText(P.total_low - P.total_low_7d)}</span>`;

  $('#k-lost').textContent = fmt.int(Math.round(P.lost_daily_sales));
  const lostD = +(P.lost_daily_sales - P.lost_daily_sales_7d).toFixed(1);
  $('#k-lost-delta-wrap').innerHTML = `<span class="kpi-delta ${kClass(lostD, 'count')}">${kTextDec(lostD)}</span>`;

  // Stock & movement row
  $('#k-soh').textContent = fmt.intK(P.total_soh);
  const sohD = P.total_soh - P.total_soh_7d;
  $('#k-soh-delta-wrap').innerHTML = `<span class="kpi-delta ${kClass(sohD, 'pos')}">${kTextK(sohD)}</span>`;

  $('#k-healthy').textContent = fmt.int(P.total_healthy);
  $('#k-healthy-delta-wrap').innerHTML = `<span class="kpi-delta ${kClass(P.total_healthy - P.total_healthy_7d, 'pos')}">${kText(P.total_healthy - P.total_healthy_7d)}</span>`;
  $('#k-healthy-sub').textContent = (P.total_active > 0 ? (100 * P.total_healthy / P.total_active).toFixed(1) : '0') + '% of active';

  $('#k-disc').textContent = fmt.int(P.total_disc_count);
  // For Discontinued, MORE is bad (more dead stock items). Use 'count' mode.
  $('#k-disc-delta-wrap').innerHTML = `<span class="kpi-delta ${kClass(P.total_disc_count - P.total_disc_count_7d, 'count')}">${kText(P.total_disc_count - P.total_disc_count_7d)}</span>`;
  $('#k-disc-sub').textContent = `${fmt.intK(P.total_disc_units)} units of dead stock`;

  $('#k-resolved').textContent = fmt.int(P.total_resolved);
}

function renderTimeline(view){
  const P = view.portfolio;
  const s = P.series;
  const rows = [
    { label: 'Out of stock',         formula: 'Status=04 AND SOH=0 AND DROS>0',     swatch: 'crit',    values: s.oos,       mode: 'count' },
    { label: 'Possible phantom',     formula: 'SOH>0 AND no sales 60d+',            swatch: 'phantom', values: s.phantom,   mode: 'count' },
    { label: 'Low cover < 14d',      formula: '0 < SOH/DROS < 14',                   swatch: 'warn',    values: s.low,       mode: 'count' },
    { label: 'Healthy items',        formula: '14 ≤ SOH/DROS < 180',                 swatch: 'healthy', values: s.healthy,   mode: 'pos' },
    { label: 'Lost daily sales',     formula: 'Σ DROS for OOS items',                swatch: 'steel',   values: s.lost,      mode: 'count', isFloat: true },
    { label: 'Total SOH',            formula: 'Σ SOH',                                swatch: 'info',    values: s.soh,       mode: 'pos',   isBigNum: true },
    { label: 'Discontinued + SOH',   formula: 'Status≠04 AND SOH>0',                 swatch: 'steel',   values: s.disc_count,mode: 'count' },
  ];

  let html = '';
  rows.forEach(r => {
    const fmtCell = (v, isLatest) => {
      const cls = isLatest ? 'latest-cell num' : 'num';
      if (v == null) return `<td class="${cls} dim">—</td>`;
      if (r.isFloat) return `<td class="${cls}">${Number(v).toFixed(0)}</td>`;
      if (r.isBigNum) return `<td class="${cls}">${fmt.intK(v)}</td>`;
      return `<td class="${cls}">${fmt.int(v)}</td>`;
    };
    const v7 = r.values[0], vL = r.values[1];
    let deltaCell = '<td class="delta-cell delta-flat">—</td>';
    if (v7 != null && vL != null){
      const d = vL - v7;
      let cls = 'delta-flat', txt = '0';
      if (Math.abs(d) >= 0.05){
        cls = (r.mode === 'count') ? (d > 0 ? 'delta-bad' : 'delta-good') : (d > 0 ? 'delta-good' : 'delta-bad');
        const arrow = d > 0 ? '▲' : '▼', sign = d > 0 ? '+' : '';
        let num;
        if (r.isFloat) num = d.toFixed(1);
        else if (r.isBigNum) {
          const abs = Math.abs(d);
          if (abs >= 1e6) num = (abs/1e6).toFixed(2) + 'M';
          else if (abs >= 1e4) num = (abs/1e3).toFixed(1) + 'K';
          else num = Math.abs(Math.round(d)).toLocaleString('en-US');
        }
        else num = Math.abs(Math.round(d)).toLocaleString('en-US');
        txt = `${arrow} ${sign}${num}`;
      }
      deltaCell = `<td class="delta-cell ${cls}">${txt}</td>`;
    }
    html += `<tr>
      <td><div class="kpi-name"><span class="swatch ${r.swatch}"></span>
        <div class="kpi-name-text"><span>${escapeHTML(r.label)}</span>
        <span class="kpi-name-formula">${escapeHTML(r.formula)}</span></div></div></td>
      ${fmtCell(r.values[0], false)}${fmtCell(r.values[1], true)}${deltaCell}
    </tr>`;
  });
  $('#timeline-body').innerHTML = html;
}

function renderSpotlights(view){
  const cfg = [
    ['improved',  view.spotlights.most_improved,  s => `<div class="stat">${fmt.signedDec(s.health_delta_7d)}</div>`],
    ['regressed', view.spotlights.most_regressed, s => `<div class="stat">${fmt.signedDec(s.health_delta_7d)}</div>`],
    ['priority',  view.spotlights.priority,       s => `<div class="stat">${fmt.dec(s.lost_daily_sales, 1)}/d</div>`],
    ['persistent',view.spotlights.persistent,     s => `<div class="stat">${fmt.int(s.persistent)}</div>`],
  ];
  cfg.forEach(([id, list, statFn]) => {
    const el = $('#spotlight-' + id);
    if (!list || list.length === 0){
      el.innerHTML = '<li style="color:var(--mute);font-style:italic">No data</li>';
      return;
    }
    el.innerHTML = list.map((s, i) => `
      <li><span class="rank">${i+1}</span>
        <div class="store"><div class="store-code">${escapeHTML(s.site_code)}</div>
        <div class="store-name">${escapeHTML(s.site_description)}</div></div>
        ${statFn(s)}</li>`).join('');
  });
}

window.__renderHero = renderHero;
window.__renderTimeline = renderTimeline;
window.__renderSpotlights = renderSpotlights;
})();
