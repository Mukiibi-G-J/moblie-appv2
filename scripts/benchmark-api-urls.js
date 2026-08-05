/**
 * Compare mobile classic REST vs webV2 /api/pages/data/ latency + payload size.
 *
 * Usage (PowerShell):
 *   $env:TENANT="primewise"
 *   $env:TOKEN="eyJ..."   # paste JWT access token
 *   # optional:
 *   # $env:BRANCH_ID="1"
 *   # $env:BASE_URL="https://primewise.zentroapp-backend.com"
 *   # $env:RUNS="5"
 *   node scripts/benchmark-api-urls.js
 *
 * Get TOKEN: login in the app / web, copy accessToken from AsyncStorage / localStorage.
 */

const TENANT = (process.env.TENANT || '').trim().toLowerCase();
const TOKEN = (process.env.TOKEN || '').trim();
const BRANCH_ID = (process.env.BRANCH_ID || '').trim();
const RUNS = Math.max(1, Number(process.env.RUNS || 5));
const ONLY = (process.env.ONLY || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);
const BASE_URL = (
  process.env.BASE_URL ||
  (TENANT ? `https://${TENANT}.zentroapp-backend.com` : '')
).replace(/\/$/, '');

const ALL_PAGES = [
  {
    name: 'Items',
    pageId: 10201,
    pageName: 'ItemList',
    restPath: '/api/items/',
    restParams: {page: 1, page_size: 20, q: ''},
    restParamsFair: {page: 1, page_size: 50, q: ''},
    pageDataExtra: {blocked: 'false'},
  },
  {
    name: 'Customers',
    pageId: 10101,
    pageName: 'CustomerList',
    restPath: '/api/customers/',
    restParams: {page: 1, page_size: 20},
    restParamsFair: {page: 1, page_size: 50},
  },
  {
    name: 'Sales History',
    pageId: 10004,
    pageName: 'PostedSalesInvoiceList',
    restPath: '/api/sales/',
    restParams: {page: 1, page_size: 20, status: 'Posted'},
    restParamsFair: {page: 1, page_size: 50, status: 'Posted'},
  },
  {
    name: 'Vendors',
    pageId: 10303,
    pageName: 'VendorList',
    restPath: '/api/vendors/',
    restParams: {page: 1, page_size: 20},
    restParamsFair: {page: 1, page_size: 50},
  },
  {
    name: 'Expenses',
    pageId: 10520,
    pageName: 'ExpenseList',
    restPath: '/api/expenses/',
    restParams: {page: 1, page_size: 20},
    restParamsFair: {page: 1, page_size: 50},
  },
];

const PAGES = ONLY.length
  ? ALL_PAGES.filter(p => ONLY.includes(p.name.toLowerCase()))
  : ALL_PAGES;

function requireEnv() {
  if (!BASE_URL || !TOKEN) {
    console.error(`
Missing TENANT/TOKEN (or BASE_URL + TOKEN).

PowerShell example:
  $env:TENANT="yourtenant"
  $env:TOKEN="eyJhbGciOi..."
  node scripts/benchmark-api-urls.js
`);
    process.exit(1);
  }
}

function headers() {
  const h = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/json',
  };
  if (BRANCH_ID) {
    h['X-Branch-Id'] = BRANCH_ID;
  }
  return h;
}

function qs(params) {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function timedGet(url) {
  const started = performance.now();
  const res = await fetch(url, {headers: headers()});
  const buf = Buffer.from(await res.arrayBuffer());
  const ms = performance.now() - started;
  let rowCount = 0;
  try {
    const json = JSON.parse(buf.toString('utf8'));
    if (Array.isArray(json)) {
      rowCount = json.length;
    } else if (Array.isArray(json?.results)) {
      rowCount = json.results.length;
    }
  } catch {
    // ignore parse errors for sizing
  }
  return {
    ok: res.ok,
    status: res.status,
    ms,
    bytes: buf.length,
    rowCount,
    url,
  };
}

async function runMany(url) {
  const samples = [];
  let last = null;
  for (let i = 0; i < RUNS; i += 1) {
    last = await timedGet(url);
    samples.push(last);
  }
  const okSamples = samples.filter(s => s.ok);
  const times = okSamples.map(s => s.ms);
  return {
    last,
    okCount: okSamples.length,
    medianMs: times.length ? median(times) : null,
    minMs: times.length ? Math.min(...times) : null,
    maxMs: times.length ? Math.max(...times) : null,
    bytes: last?.bytes ?? 0,
    rowCount: last?.rowCount ?? 0,
    status: last?.status,
    url,
  };
}

async function resolveListControlId(pageId) {
  const url = `${BASE_URL}/api/pages/page/${qs({PageId: pageId})}`;
  const res = await fetch(url, {headers: headers()});
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed page def PageId=${pageId}: HTTP ${res.status} ${body.slice(0, 180)}`,
    );
  }
  const page = await res.json();
  const controls =
    page?.PageControls ||
    page?.page_controls ||
    page?.Controls ||
    page?.controls ||
    [];

  const scored = controls.map(c => {
    const type = String(c?.ControlType || c?.Type || c?.control_type || '').toLowerCase();
    const name = String(c?.Name || c?.name || c?.Caption || '').toLowerCase();
    let score = 0;
    if (type.includes('repeater') || type.includes('listpart') || type === 'list') {
      score += 5;
    }
    if (name.includes('list') || name.includes('repeater') || name.includes('lines')) {
      score += 2;
    }
    if (Array.isArray(c?.Fields || c?.fields) && (c.Fields || c.fields).length) {
      score += 1;
    }
    return {c, score};
  });
  scored.sort((a, b) => b.score - a.score);
  const list = scored[0]?.c;
  const controlId =
    list?.PageControlId ??
    list?.page_control_id ??
    list?.ControlId ??
    list?.id ??
    list?.ID;
  if (controlId == null) {
    const keys = Object.keys(page || {}).slice(0, 20).join(',');
    const sample = controls
      .slice(0, 3)
      .map(c => `${c?.Name || '?'}:${c?.ControlType || '?'}:${c?.PageControlId ?? '-'}`)
      .join(' | ');
    throw new Error(
      `No list ControlId for PageId=${pageId} (keys=${keys}; controls=${controls.length}; sample=${sample})`,
    );
  }
  return Number(controlId);
}

function fmtMs(n) {
  return n == null ? 'ERR' : `${n.toFixed(0)}ms`;
}

function fmtKb(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

async function main() {
  requireEnv();
  console.log(`\nBenchmark host: ${BASE_URL}`);
  console.log(`Runs per URL: ${RUNS}`);
  console.log(`Branch: ${BRANCH_ID || '(none)'}\n`);

  const rows = [];

  for (const page of PAGES) {
    const restMobileUrl = `${BASE_URL}${page.restPath}${qs(page.restParams)}`;
    const restFairUrl = `${BASE_URL}${page.restPath}${qs(page.restParamsFair)}`;

    console.log(`\n${page.name}`);
    console.log(`  REST mobile (page_size=20)...`);
    const restMobile = await runMany(restMobileUrl);
    console.log(
      `    -> ${restMobile.okCount ? fmtMs(restMobile.medianMs) : `HTTP ${restMobile.status}`} / ${fmtKb(restMobile.bytes)} / rows=${restMobile.rowCount}`,
    );
    console.log(`  REST fair   (page_size=50)...`);
    const restFair = await runMany(restFairUrl);
    console.log(
      `    -> ${restFair.okCount ? fmtMs(restFair.medianMs) : `HTTP ${restFair.status}`} / ${fmtKb(restFair.bytes)} / rows=${restFair.rowCount}`,
    );

    process.stdout.write(`  Resolving ControlId for PageId=${page.pageId}... `);
    let pageData = null;
    try {
      const controlId = await resolveListControlId(page.pageId);
      console.log(controlId);
      const pageDataUrl = `${BASE_URL}/api/pages/data/${qs({
        PageId: page.pageId,
        ControlId: controlId,
        limit: 50,
        offset: 0,
        ...(page.pageDataExtra || {}),
      })}`;
      console.log(`  Page-data   (limit=50)...`);
      pageData = await runMany(pageDataUrl);
      console.log(
        `    -> ${pageData.okCount ? fmtMs(pageData.medianMs) : `HTTP ${pageData.status}`} / ${fmtKb(pageData.bytes)} / rows=${pageData.rowCount}`,
      );
    } catch (e) {
      console.log(`FAILED (${e.message})`);
    }

    rows.push({
      name: page.name,
      restMobile,
      restFair,
      pageData,
      note: pageData ? null : 'page-data unavailable',
    });
  }

  console.log('\n=== Results (median over runs) ===\n');
  console.log(
    [
      'Feature'.padEnd(16),
      'REST×20'.padEnd(18),
      'REST×50'.padEnd(18),
      'PageData×50'.padEnd(18),
      'Faster',
    ].join(' '),
  );
  console.log('-'.repeat(90));

  for (const row of rows) {
    const a = row.restMobile;
    const b = row.restFair;
    const c = row.pageData;
    const candidates = [
      {label: 'REST×20', ms: a?.medianMs},
      {label: 'REST×50', ms: b?.medianMs},
      {label: 'PageData×50', ms: c?.medianMs},
    ].filter(x => x.ms != null);
    const fastest = candidates.sort((x, y) => x.ms - y.ms)[0]?.label || '?';

    const cell = r => {
      if (!r) return 'n/a';
      return r.okCount
        ? `${fmtMs(r.medianMs)}/${fmtKb(r.bytes)}`
        : `HTTP ${r.status}`;
    };

    console.log(
      [
        row.name.padEnd(16),
        cell(a).padEnd(18),
        cell(b).padEnd(18),
        cell(c).padEnd(18),
        fastest,
      ].join(' '),
    );
  }

  console.log(`
Legend: time / payload size
- REST×20 = mobile current style
- REST×50 = same classic URL, fair page size vs web
- PageData×50 = webV2 /api/pages/data/

If PageData×50 is clearly faster/smaller, mobile can adopt those URLs for online lists.
If REST×50 ≈ PageData, the bottleneck is likely network/serializer work, not the URL shape.
`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
