/*
 * Koi Pond renderer — turns a contribution count into an animated SVG pond.
 * Works in Node (used by generate.js / the GitHub Action) and in the browser (demo.html).
 * No dependencies. Animations are SMIL/CSS-free so they play inside a GitHub README <img>.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KoiPond = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STAGES = [
    { min: 0,    name: 'HATCHLING', unlock: 'A tiny pale koi hatches in a quiet pond' },
    { min: 25,   name: 'FRY',       unlock: 'First orange scale · lily pads drift in' },
    { min: 100,  name: 'YOUNG',     unlock: 'Red Kohaku markings · reeds grow at the edges' },
    { min: 250,  name: 'JUVENILE',  unlock: 'Black sumi spots · a friend joins · pebbles settle' },
    { min: 500,  name: 'ADULT',     unlock: 'Blue back scales · lotus flowers bloom · a third koi' },
    { min: 1000, name: 'ELDER',     unlock: 'Metallic shimmer · the moon rises · fireflies' },
    { min: 2000, name: 'LEGEND',    unlock: 'Golden fins · sakura petals fall · a school of four' },
    { min: 5000, name: 'DRAGON',    unlock: 'The koi climbed the waterfall and became a dragon' },
  ];
  // Koi size at the start of each stage (it keeps growing between milestones).
  const SIZES = [0.42, 0.55, 0.68, 0.8, 0.92, 1.04, 1.14, 1.24, 1.32];

  const f = (n) => +Number(n).toFixed(2);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  function hash(s) {
    let h = 2166136261;
    for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function stageFor(total) {
    let i = 0;
    STAGES.forEach((s, k) => { if (total >= s.min) i = k; });
    const next = STAGES[i + 1] || null;
    const progress = next ? (total - STAGES[i].min) / (next.min - STAGES[i].min) : 1;
    const p = Math.max(0, Math.min(1, progress));
    return { index: i, stage: STAGES[i], next, progress: p, size: SIZES[i] + (SIZES[i + 1] - SIZES[i]) * p };
  }

  /* ---------- koi ---------- */
  const BODY = 'M48,0 C48,-13 32,-19 12,-18 C-10,-17 -28,-9 -40,-3 L-40,3 C-28,9 -10,17 12,18 C32,19 48,13 48,0 Z';
  const TAIL = 'M2,0 C-8,-5 -20,-18 -34,-21 C-28,-10 -27,-4 -26,0 C-27,4 -28,10 -34,21 C-20,18 -8,5 2,0 Z';
  const FIN = 'M0,0 C-3,-7 -13,-14 -21,-12 C-16,-7 -8,-2 0,0 Z';

  function mainKoiLook(i) {
    const spots = [];
    if (i === 1) spots.push([30, -1, 8, 6, '#f08a24', 1]);
    if (i >= 2) spots.push([34, 0, 12, 10, '#e0442b', 1], [8, -5, 14, 10, '#e0442b', 1], [-18, 4, 10, 7, '#ef6a2e', 1]);
    if (i >= 3) spots.push([16, 7, 6, 5, '#16161c', 1], [-6, -9, 5, 4, '#16161c', 1], [-27, -2, 4, 3, '#16161c', 1]);
    if (i >= 4) spots.unshift([-4, 0, 34, 4, '#3d6fb0', 0.55]);
    const dragon = i >= 7;
    return {
      body: dragon ? '#ffd75e' : i === 0 ? '#ece6da' : '#f6f2ea',
      edge: dragon ? '#d4901a' : '#d6cdbd',
      fin: i >= 6 ? '#ffcf5a' : '#ffffff',
      finOp: i >= 6 ? 0.85 : 0.7,
      dorsal: dragon ? '#b06a10' : '#9a8f80',
      spots,
      scales: i >= 4,
      shimmer: i >= 5,
      whiskers: dragon,
      aura: dragon,
      wag: 1.1 - i * 0.05,
    };
  }
  const FRIENDS = [
    { body: '#f39a2c', edge: '#c86d12', fin: '#f9b860', finOp: 0.8, dorsal: '#a85a10', spots: [], scales: true, wag: 0.9 },             // Ogon (orange)
    { body: '#f3f0ea', edge: '#cfc6b6', fin: '#ffffff', finOp: 0.7, dorsal: '#555', spots: [[26, 4, 9, 7, '#1a1a20', 1], [0, -6, 11, 8, '#1a1a20', 1], [-22, 3, 7, 5, '#1a1a20', 1]], wag: 1.0 }, // Shiro Utsuri
    { body: '#e6edf5', edge: '#9fb4cc', fin: '#dbe8f7', finOp: 0.75, dorsal: '#4a6f9a', spots: [[-4, 0, 34, 5, '#4f86c9', 0.7], [30, 0, 10, 9, '#e0442b', 1], [-16, -6, 6, 5, '#e0442b', 1]], scales: true, wag: 0.95 }, // Asagi
  ];

  function koi(o, id) {
    let s = '';
    s += `<g transform="translate(7 10)" opacity=".28" filter="url(#kp-blur)"><path d="${BODY}"/><path d="${TAIL}" transform="translate(-38 0)"/></g>`;
    if (o.aura) s += `<ellipse rx="78" ry="40" fill="url(#kp-aura)"><animate attributeName="opacity" values=".45;1;.45" dur="2.6s" repeatCount="indefinite"/></ellipse>`;
    s += `<g transform="translate(-38 0)"><g><path d="${TAIL}" fill="${o.fin}" fill-opacity="${o.finOp}"/><animateTransform attributeName="transform" type="rotate" values="-16;16;-16" dur="${f(o.wag)}s" repeatCount="indefinite"/></g></g>`;
    for (const side of [1, -1]) {
      s += `<g transform="translate(22 ${-13 * side}) scale(1 ${side})"><g><path d="${FIN}" fill="${o.fin}" fill-opacity="${o.finOp}"/><animateTransform attributeName="transform" type="rotate" values="0;-24;0" dur="${f(o.wag * 1.3)}s" repeatCount="indefinite"/></g></g>`;
      s += `<g transform="translate(-10 ${-11 * side}) scale(.6 ${0.6 * side})"><path d="${FIN}" fill="${o.fin}" fill-opacity="${o.finOp}"/></g>`;
    }
    s += `<defs><clipPath id="kp-c${id}"><path d="${BODY}"/></clipPath><linearGradient id="kp-g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.edge}"/><stop offset=".5" stop-color="${o.body}"/><stop offset="1" stop-color="${o.edge}"/></linearGradient></defs>`;
    s += `<path d="${BODY}" fill="url(#kp-g${id})"/>`;
    s += `<g clip-path="url(#kp-c${id})">`;
    for (const [x, y, rx, ry, c, op] of o.spots) s += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" fill-opacity="${op}"/>`;
    if (o.scales) {
      let d = '';
      for (let x = -30; x < 36; x += 7) for (let y = -15; y <= 15; y += 6) d += `M${x},${y}q3,3 6,0`;
      s += `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".7"/>`;
    }
    if (o.shimmer) s += `<g transform="rotate(20)"><rect x="-6" y="-40" width="12" height="80" fill="#fff" opacity=".45"><animateTransform attributeName="transform" type="translate" values="-80 0;90 0" dur="3.4s" repeatCount="indefinite"/></rect></g>`;
    s += `<ellipse cx="18" cy="-7" rx="24" ry="4" fill="#fff" opacity=".2"/></g>`;
    s += `<path d="M30,0 L-30,0" stroke="${o.dorsal}" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>`;
    s += `<circle cx="39" cy="-8" r="1.9" fill="#111"/><circle cx="39" cy="8" r="1.9" fill="#111"/>`;
    if (o.whiskers) {
      for (const side of [1, -1]) {
        s += `<path d="M46,${4 * side} c8,${4 * side} 14,${2 * side} 24,${12 * side}" fill="none" stroke="#ffd75e" stroke-width="1.5" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="0 46 ${4 * side};${10 * side} 46 ${4 * side};0 46 ${4 * side}" dur="2s" repeatCount="indefinite"/></path>`;
      }
    }
    return s;
  }

  function swimmer(inner, scale, path, dur, phase, reverse, clock) {
    const begin = -((clock + phase) % dur);
    const dir = reverse ? ' keyPoints="1;0" keyTimes="0;1" calcMode="linear" rotate="auto-reverse"' : ' rotate="auto"';
    return `<g><animateMotion path="${path}" dur="${dur}s" begin="${f(begin)}s" repeatCount="indefinite"${dir}/>` +
      `<g transform="scale(${f(scale)})"><g>${inner}<animateTransform attributeName="transform" type="rotate" values="-4;4;-4" dur="2.3s" repeatCount="indefinite"/></g></g></g>`;
  }

  /* ---------- pond decor ---------- */
  function lilyPad(x, y, r, rot, bob) {
    const a = (14 * Math.PI) / 180;
    const x1 = f(r * Math.cos(-a)), y1 = f(r * Math.sin(-a)), x2 = f(r * Math.cos(a)), y2 = f(r * Math.sin(a));
    let veins = '';
    for (let k = 1; k < 8; k++) { const t = a + (k * (2 * Math.PI - 2 * a)) / 8; veins += `M0,0L${f(r * 0.85 * Math.cos(t))},${f(r * 0.85 * Math.sin(t))}`; }
    return `<g transform="translate(${f(x)} ${f(y)})"><g><g transform="rotate(${f(rot)})">` +
      `<ellipse cx="4" cy="6" rx="${r}" ry="${r}" fill="#000" opacity=".25" filter="url(#kp-blur)"/>` +
      `<path d="M0,0L${x1},${y1}A${r},${r} 0 1 0 ${x2},${y2}Z" fill="#3a8a4f" stroke="#2a6a3b" stroke-width="1.5"/>` +
      `<path d="${veins}" stroke="#2f7442" stroke-width="1"/></g>` +
      `<animateTransform attributeName="transform" type="translate" values="0 0;${bob} ${-bob};0 0" dur="${6 + bob}s" repeatCount="indefinite"/></g></g>`;
  }
  function lotus(x, y, s) {
    let p = '';
    for (let k = 0; k < 8; k++) p += `<ellipse cx="0" cy="-9" rx="4.5" ry="9" fill="#f6a5c0" stroke="#e57aa0" stroke-width=".6" transform="rotate(${k * 45})"/>`;
    for (let k = 0; k < 6; k++) p += `<ellipse cx="0" cy="-6" rx="3.5" ry="6.5" fill="#fbd0de" transform="rotate(${k * 60 + 30})"/>`;
    return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><g>${p}<circle r="3.2" fill="#ffd34d"/>` +
      `<animateTransform attributeName="transform" type="rotate" values="0;8;0" dur="7s" repeatCount="indefinite"/></g></g>`;
  }
  function reeds(x, y, dir, n, R) {
    let s = '';
    for (let k = 0; k < n; k++) {
      const len = 40 + R() * 45, ang = dir + (R() - 0.5) * 70, rad = (ang * Math.PI) / 180;
      const ex = f(len * Math.cos(rad)), ey = f(len * Math.sin(rad));
      const cx = f(ex * 0.5 + (R() - 0.5) * 18), cy = f(ey * 0.5 + (R() - 0.5) * 18);
      const ox = f(x + (R() - 0.5) * 30), oy = f(y + (R() - 0.5) * 30);
      s += `<g transform="translate(${ox} ${oy})"><path d="M0,0Q${cx},${cy} ${ex},${ey}" fill="none" stroke="${R() > 0.5 ? '#4f8f3a' : '#3b7330'}" stroke-width="${f(2 + R() * 2)}" stroke-linecap="round">` +
        `<animateTransform attributeName="transform" type="rotate" values="-3;3;-3" dur="${f(3 + R() * 3)}s" repeatCount="indefinite"/></path></g>`;
    }
    return s;
  }
  function ripple(x, y, delay, max) {
    return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="2" ry="1.4" fill="none" stroke="#bfe3ff" stroke-width="1.2">` +
      `<animate attributeName="rx" values="2;${max}" dur="5s" begin="${f(delay)}s" repeatCount="indefinite"/>` +
      `<animate attributeName="ry" values="1.4;${f(max * 0.7)}" dur="5s" begin="${f(delay)}s" repeatCount="indefinite"/>` +
      `<animate attributeName="stroke-opacity" values=".5;0" dur="5s" begin="${f(delay)}s" repeatCount="indefinite"/></ellipse>`;
  }

  /* ---------- heatmap ---------- */
  const LEVEL_COLORS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
  function fakeWeeks(total, seed) {
    const R = rng(seed || 7);
    const activity = Math.min(1, total / 2500);
    const weeks = [];
    for (let w = 0; w < 53; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const lvl = R() < activity * (0.35 + 0.65 * (w / 53)) ? 1 + Math.floor(R() * 4 * Math.max(0.3, activity)) : 0;
        days.push({ level: Math.min(4, lvl) });
      }
      weeks.push(days);
    }
    return weeks;
  }

  /* ---------- the pond ---------- */
  function renderPond(data) {
    const user = data.user || 'you';
    const total = Math.max(0, Math.floor(data.total || 0));
    const clock = data.clock || 0;
    const weeks = data.weeks || fakeWeeks(total, hash(user));
    const st = stageFor(total);
    const i = st.index;
    const R = rng(hash(user));
    const W = 840, H = 600, P = { x: 20, y: 70, w: 800, h: 320 };
    const cx = P.x + P.w / 2, cy = P.y + P.h / 2;

    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(user)}'s koi pond: ${fmt(total)} contributions, stage ${st.stage.name}">`;
    s += `<defs>
<filter id="kp-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="kp-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.5"/></filter>
<radialGradient id="kp-water" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="${i >= 5 ? '#1d3f63' : '#22587d'}"/><stop offset=".6" stop-color="${i >= 5 ? '#122a45' : '#163c5a'}"/><stop offset="1" stop-color="#0a1c2e"/></radialGradient>
<radialGradient id="kp-aura"><stop offset="0" stop-color="#ffd75e" stop-opacity=".55"/><stop offset="1" stop-color="#ffd75e" stop-opacity="0"/></radialGradient>
<radialGradient id="kp-moon"><stop offset="0" stop-color="#fffbe6" stop-opacity=".9"/><stop offset=".45" stop-color="#fff4c2" stop-opacity=".35"/><stop offset="1" stop-color="#fff4c2" stop-opacity="0"/></radialGradient>
<linearGradient id="kp-fall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8f6ff"/><stop offset="1" stop-color="#7fc4f0" stop-opacity=".2"/></linearGradient>
<clipPath id="kp-pond"><rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="16"/></clipPath>
</defs>`;
    s += `<rect width="${W}" height="${H}" rx="18" fill="#0d1117"/><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="18" fill="none" stroke="#30363d"/>`;

    // header
    const font = `font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"`;
    s += `<circle cx="38" cy="38" r="14" fill="#2f81f7"/><circle cx="38" cy="38" r="14" fill="url(#kp-water)" opacity=".7"/><text x="38" y="43" text-anchor="middle" font-size="14" ${font}>🎏</text>`;
    s += `<text x="62" y="44" fill="#e6edf3" font-size="18" font-weight="700" ${font}>@${esc(user)}'s koi pond</text>`;
    const bw = st.stage.name.length * 10.5 + 30;
    const gold = i >= 6;
    s += `<rect x="${f(W - 22 - bw)}" y="22" width="${f(bw)}" height="32" rx="8" fill="${gold ? '#3d2f0a' : '#0f2a17'}" stroke="${gold ? '#e3b341' : '#3fb950'}" stroke-width="1.5"/>`;
    s += `<text x="${f(W - 22 - bw / 2)}" y="43" text-anchor="middle" fill="${gold ? '#f2cc60' : '#7ee787'}" font-size="15" font-weight="800" letter-spacing="1" ${font}>${st.stage.name}</text>`;

    // pond
    s += `<g clip-path="url(#kp-pond)">`;
    s += `<rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" fill="url(#kp-water)"/>`;
    // soft caustic light
    for (let k = 0; k < 5; k++) {
      const x = P.x + R() * P.w, y = P.y + R() * P.h;
      s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(60 + R() * 60)}" ry="${f(25 + R() * 25)}" fill="#7fd0ff" opacity=".05"><animateTransform attributeName="transform" type="translate" values="0 0;${f(20 + R() * 30)} ${f(R() * 10)};0 0" dur="${f(14 + R() * 8)}s" repeatCount="indefinite"/></ellipse>`;
    }
    // pebbles on the floor (JUVENILE+)
    const pebbleRand = rng(hash(user) ^ 0xbeef);
    if (i >= 3) {
      for (let k = 0; k < 34; k++) {
        const edge = pebbleRand() < 0.7;
        const x = P.x + pebbleRand() * P.w;
        const y = edge ? (pebbleRand() < 0.5 ? P.y + 6 + pebbleRand() * 26 : P.y + P.h - 6 - pebbleRand() * 26) : P.y + pebbleRand() * P.h;
        const g = 120 + Math.floor(pebbleRand() * 80);
        s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(3 + pebbleRand() * 6)}" ry="${f(2 + pebbleRand() * 4)}" fill="rgb(${g},${g - 8},${g - 20})" opacity=".35" transform="rotate(${f(pebbleRand() * 180)} ${f(x)} ${f(y)})"/>`;
      }
    }
    // moon reflection (ELDER+)
    if (i >= 5) {
      s += `<g><circle cx="690" cy="140" r="60" fill="url(#kp-moon)"/><circle cx="690" cy="140" r="17" fill="#fffbea" opacity=".75"/>`;
      for (let k = 0; k < 4; k++) s += `<rect x="${660 + k * 6}" y="${128 + k * 8}" width="${60 - k * 10}" height="1.5" fill="#0d2a44" opacity=".5"/>`;
      s += `<animate attributeName="opacity" values=".8;1;.8" dur="5s" repeatCount="indefinite"/></g>`;
    }
    // waterfall (DRAGON)
    if (i >= 7) {
      s += `<rect x="96" y="${P.y}" width="70" height="44" fill="url(#kp-fall)" opacity=".9"/>`;
      for (let k = 0; k < 7; k++) s += `<line x1="${100 + k * 10}" y1="${P.y}" x2="${100 + k * 10}" y2="${P.y + 44}" stroke="#ffffff" stroke-opacity=".7" stroke-width="2" stroke-dasharray="6 10"><animate attributeName="stroke-dashoffset" values="16;0" dur="${f(0.4 + k * 0.05)}s" repeatCount="indefinite"/></line>`;
      for (let k = 0; k < 6; k++) s += ripple(108 + k * 10, P.y + 50, k * 0.7, 18);
    }
    // ripples
    for (let k = 0; k < 6; k++) s += ripple(P.x + 60 + R() * (P.w - 120), P.y + 40 + R() * (P.h - 80), R() * 5, 26 + R() * 20);

    // koi (main + friends)
    const loops = [
      `M180,${cy} C180,${cy - 120} 660,${cy - 120} 660,${cy} C660,${cy + 120} 180,${cy + 120} 180,${cy} Z`,
      `M${cx},${cy} C${cx + 100},${cy - 110} ${cx + 290},${cy - 90} ${cx + 270},${cy} C${cx + 250},${cy + 90} ${cx + 100},${cy + 110} ${cx},${cy} C${cx - 100},${cy - 110} ${cx - 280},${cy - 90} ${cx - 270},${cy} C${cx - 250},${cy + 90} ${cx - 100},${cy + 110} ${cx},${cy} Z`,
      `M560,${cy + 20} C560,${cy - 80} 760,${cy - 80} 760,${cy + 20} C760,${cy + 110} 560,${cy + 110} 560,${cy + 20} Z`,
      `M90,${cy} C90,${cy - 90} 330,${cy - 90} 330,${cy} C330,${cy + 90} 90,${cy + 90} 90,${cy} Z`,
    ];
    const friends = i >= 6 ? 3 : i >= 4 ? 2 : i >= 3 ? 1 : 0;
    for (let k = 0; k < friends; k++) {
      const look = Object.assign({}, FRIENDS[k], i >= 6 ? { fin: '#ffcf5a', finOp: 0.8 } : {});
      s += swimmer(koi(look, 'f' + k), st.size * (0.62 + k * 0.04), loops[k + 1], 20 + k * 4, k * 7, k % 2 === 0, clock);
    }
    s += swimmer(koi(mainKoiLook(i), 'main'), st.size, loops[0], 24, 0, false, clock);

    // fireflies (ELDER+)
    if (i >= 5) {
      for (let k = 0; k < 12; k++) {
        const x = P.x + 20 + R() * (P.w - 40), y = P.y + 20 + R() * (P.h - 40), d = f(2 + R() * 3);
        s += `<g><circle cx="${f(x)}" cy="${f(y)}" r="4" fill="#fff7a1" filter="url(#kp-glow)"/><circle cx="${f(x)}" cy="${f(y)}" r="1.4" fill="#fffde0"/>` +
          `<animate attributeName="opacity" values="0;1;0" dur="${d}s" begin="${f(R() * 3)}s" repeatCount="indefinite"/>` +
          `<animateTransform attributeName="transform" type="translate" values="0 0;${f((R() - 0.5) * 30)} ${f((R() - 0.5) * 20)};0 0" dur="${f(6 + R() * 4)}s" repeatCount="indefinite"/></g>`;
      }
    }
    // lily pads + lotus (FRY+ / ADULT+)
    const pads = [[110, 120, 26, 20], [740, 335, 30, 200], [700, 110, 21, 90], [150, 348, 23, 300], [560, 362, 18, 40], [320, 98, 19, 160], [430, 360, 16, 250]];
    const padCount = [0, 2, 3, 4, 5, 6, 7, 7][i];
    const lotusOn = i >= 6 ? [0, 1, 2, 3, 5] : i >= 5 ? [0, 1, 3] : i >= 4 ? [0, 1] : [];
    for (let k = 0; k < padCount; k++) {
      const [x, y, r, rot] = pads[k];
      s += lilyPad(x, y, r, rot, 2 + (k % 3));
      if (lotusOn.includes(k)) s += lotus(x + r * 0.15, y - r * 0.1, 0.9 + r / 60);
    }
    // reeds (YOUNG+)
    if (i >= 2) {
      s += reeds(P.x + 4, P.y + 4, 45, 9, rng(hash(user) ^ 0x1234));
      s += reeds(P.x + P.w - 4, P.y + P.h - 4, 225, 9, rng(hash(user) ^ 0x4321));
      if (i >= 4) s += reeds(P.x + P.w - 4, P.y + 4, 135, 6, rng(hash(user) ^ 0x9999));
    }
    // sakura petals (LEGEND+)
    if (i >= 6) {
      const PR = rng(hash(user) ^ 0x5a5a);
      for (let k = 0; k < 14; k++) {
        const y0 = P.y + PR() * P.h, dur = f(18 + PR() * 14);
        const path = `M${P.x - 20},${f(y0)} C${f(P.x + 250)},${f(y0 - 60 + PR() * 120)} ${f(P.x + 550)},${f(y0 - 60 + PR() * 120)} ${P.x + P.w + 20},${f(y0 + (PR() - 0.5) * 80)}`;
        s += `<g><animateMotion path="${path}" dur="${dur}s" begin="${f(-PR() * dur)}s" repeatCount="indefinite" rotate="auto"/>` +
          `<g><path d="M0,0 C3,-4 9,-4 10,0 C9,4 3,4 0,0 Z" fill="#ffc1d6" stroke="#f08db0" stroke-width=".5"/><animateTransform attributeName="transform" type="rotate" values="0;360" dur="${f(5 + PR() * 5)}s" repeatCount="indefinite"/></g></g>`;
      }
    }
    // surface sheen
    s += `<rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" fill="none" stroke="#9bd5ff" stroke-opacity=".08" stroke-width="10"/>`;
    s += `</g>`;
    s += `<rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="16" fill="none" stroke="#2b3b4f"/>`;

    // stats row
    const yS = P.y + P.h;
    s += `<text x="24" y="${yS + 44}" ${font}><tspan fill="#e6edf3" font-size="30" font-weight="700" font-style="italic" font-family="Georgia,'Times New Roman',serif">${fmt(total)}</tspan><tspan fill="#8b949e" font-size="15" dx="8">contributions</tspan></text>`;
    s += `<text x="${W - 24}" y="${yS + 30}" text-anchor="end" fill="${gold ? '#f2cc60' : '#7ee787'}" font-size="13" ${font}>✦ ${esc(st.stage.unlock)}</text>`;
    const nextTxt = st.next ? `Next: ${st.next.name} at ${fmt(st.next.min)} · ${fmt(st.next.min - total)} to go` : 'Final form reached 🐉';
    s += `<text x="${W - 24}" y="${yS + 48}" text-anchor="end" fill="#8b949e" font-size="12" ${font}>${esc(nextTxt)}</text>`;
    s += `<rect x="${P.x}" y="${yS + 60}" width="${P.w}" height="6" rx="3" fill="#21262d"/>`;
    s += `<rect x="${P.x}" y="${yS + 60}" width="${f(Math.max(6, P.w * st.progress))}" height="6" rx="3" fill="${gold ? '#e3b341' : '#3fb950'}"/>`;

    // heatmap (last 53 weeks)
    const cell = 11, gap = 3, wk = weeks.slice(-53);
    const gx = P.x + (P.w - wk.length * (cell + gap) + gap) / 2, gy = yS + 82;
    wk.forEach((week, w) => week.forEach((d, k) => {
      const day = d.weekday != null ? d.weekday : k;
      s += `<rect x="${f(gx + w * (cell + gap))}" y="${gy + day * (cell + gap)}" width="${cell}" height="${cell}" rx="2.5" fill="${LEVEL_COLORS[d.level || 0]}"/>`;
    }));
    s += `</svg>`;
    return s;
  }

  return { renderPond, stageFor, fakeWeeks, STAGES };
});
