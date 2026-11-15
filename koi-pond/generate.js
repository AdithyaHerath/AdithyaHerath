#!/usr/bin/env node
/*
 * Fetches your all-time contribution count + last year's calendar from the GitHub
 * GraphQL API and writes koi-pond/pond.svg.
 *
 *   GITHUB_TOKEN=... node koi-pond/generate.js [username]
 *   node koi-pond/generate.js [username] --count 1234      (offline, fake heatmap)
 */
const fs = require('fs');
const path = require('path');
const { renderPond, stageFor } = require('./render.js');

const args = process.argv.slice(2);
const countIdx = args.indexOf('--count');
const forcedCount = countIdx >= 0 ? Number(args[countIdx + 1]) : null;
const user = args.find((a, k) => !a.startsWith('--') && args[k - 1] !== '--count') || process.env.GH_USER || 'AdithyaHerath';
const token = process.env.GITHUB_TOKEN;
const out = path.join(__dirname, 'pond.svg');

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

async function gql(query) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'koi-pond-generator' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors || json));
  return json.data;
}

async function fetchStats() {
  const login = JSON.stringify(user);
  const first = await gql(`{ user(login: ${login}) { contributionsCollection {
    contributionYears
    contributionCalendar { weeks { contributionDays { contributionLevel weekday } } }
  } } }`);
  const cc = first.user.contributionsCollection;
  const years = cc.contributionYears;
  const perYear = years.map((y) => `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") { contributionCalendar { totalContributions } }`).join('\n');
  const totals = await gql(`{ user(login: ${login}) { ${perYear} } }`);
  const total = years.reduce((sum, y) => sum + totals.user[`y${y}`].contributionCalendar.totalContributions, 0);
  const weeks = cc.contributionCalendar.weeks.map((w) => w.contributionDays.map((d) => ({ level: LEVELS[d.contributionLevel] || 0, weekday: d.weekday })));
  return { total, weeks };
}

(async () => {
  let data;
  if (forcedCount != null) data = { total: forcedCount };
  else {
    if (!token) throw new Error('Set GITHUB_TOKEN (or pass --count N for an offline render).');
    data = await fetchStats();
  }
  fs.writeFileSync(out, renderPond({ user, ...data }));
  const st = stageFor(data.total);
  console.log(`${user}: ${data.total} contributions → ${st.stage.name} (${Math.round(st.progress * 100)}% to next) → ${out}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
