/**
 * Frontend unit tests (vanilla JS, no framework needed)
 * Run with: node tests/run_tests.js
 */

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ── State tests ────────────────────────────────────────────────────────

console.log('\n📦 State');

// Minimal state mock
function makeState(initial = {}) {
  const state = { token: null, news: [], page: 1, pages: 1, loading: false, ...initial };
  const listeners = new Set();
  function setState(patch) {
    Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
    listeners.forEach(fn => fn(state));
  }
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  return { state, setState, subscribe };
}

test('initial state has defaults', () => {
  const { state } = makeState();
  assert(state.token === null);
  assert(Array.isArray(state.news));
  assertEqual(state.page, 1);
});

test('setState merges patch', () => {
  const { state, setState } = makeState();
  setState({ token: 'abc', page: 2 });
  assertEqual(state.token, 'abc');
  assertEqual(state.page, 2);
});

test('setState with function receives current state', () => {
  const { state, setState } = makeState({ page: 3 });
  setState(s => ({ page: s.page + 1 }));
  assertEqual(state.page, 4);
});

test('subscribe fires on change', () => {
  const { setState, subscribe } = makeState();
  let calls = 0;
  subscribe(() => calls++);
  setState({ loading: true });
  setState({ loading: false });
  assertEqual(calls, 2);
});

test('unsubscribe stops listener', () => {
  const { setState, subscribe } = makeState();
  let calls = 0;
  const unsub = subscribe(() => calls++);
  setState({ page: 2 });
  unsub();
  setState({ page: 3 });
  assertEqual(calls, 1);
});

// ── Pagination logic tests ─────────────────────────────────────────────

console.log('\n📄 Pagination');

function pageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

test('pageRange for small total returns all pages', () => {
  const r = pageRange(1, 5);
  assertEqual(r.length, 5);
  assertEqual(r[0], 1);
  assertEqual(r[4], 5);
});

test('pageRange includes current and neighbors', () => {
  const r = pageRange(5, 10);
  assert(r.includes(4));
  assert(r.includes(5));
  assert(r.includes(6));
});

test('pageRange always includes first and last', () => {
  const r = pageRange(5, 20);
  assertEqual(r[0], 1);
  assertEqual(r[r.length - 1], 20);
});

test('pageRange uses ellipsis when needed', () => {
  const r = pageRange(10, 20);
  assert(r.includes('…'));
});

// ── Date formatting tests ──────────────────────────────────────────────

console.log('\n📅 Date formatting');

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

test('formatDate returns empty for null', () => {
  assertEqual(formatDate(null), '');
  assertEqual(formatDate(''), '');
});

test('formatDate returns non-empty string for valid ISO', () => {
  const result = formatDate('2024-03-15T14:30:00Z');
  assert(result.length > 0);
  assert(result.includes('2024'));
});

// ── HTML escaping tests ────────────────────────────────────────────────

console.log('\n🔒 HTML escaping');

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

test('escapes ampersand', () => assertEqual(escHtml('a & b'), 'a &amp; b'));
test('escapes less-than', () => assertEqual(escHtml('<script>'), '&lt;script&gt;'));
test('escapes quotes', () => assertEqual(escHtml('"hello"'), '&quot;hello&quot;'));
test('handles empty string', () => assertEqual(escHtml(''), ''));
test('handles null', () => assertEqual(escHtml(null), ''));
test('leaves safe text unchanged', () => assertEqual(escHtml('Hello, мир!'), 'Hello, мир!'));

// ── Color map tests ────────────────────────────────────────────────────

console.log('\n🎨 Color utilities');

const COLORS = [
  { id: 'amber', label: 'Оранжево-жёлтый', value: '#F59E0B' },
  { id: 'teal',  label: 'Бирюзовый',       value: '#006D5B' },
  { id: 'blue',  label: 'Синий',            value: '#3B82F6' },
];

test('color map built correctly from array', () => {
  const map = Object.fromEntries(COLORS.map(c => [c.id, c.value]));
  assertEqual(map['amber'], '#F59E0B');
  assertEqual(map['teal'], '#006D5B');
});

test('unknown color id returns undefined', () => {
  const map = Object.fromEntries(COLORS.map(c => [c.id, c.value]));
  assert(map['nonexistent'] === undefined);
});

test('fallback color used when color missing', () => {
  const map = Object.fromEntries(COLORS.map(c => [c.id, c.value]));
  const colorVal = map['unknown'] || '#F59E0B';
  assertEqual(colorVal, '#F59E0B');
});

// ── API token tests ────────────────────────────────────────────────────

console.log('\n🔑 Token storage');

// Mock localStorage
const mockStorage = {};
const mockLocalStorage = {
  getItem: k => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = v; },
  removeItem: k => { delete mockStorage[k]; },
};

function getToken(ls) { return ls.getItem('token'); }
function setToken(ls, t) { ls.setItem('token', t); }
function clearToken(ls) { ls.removeItem('token'); }

test('token is null initially', () => {
  assert(getToken(mockLocalStorage) === null);
});

test('token stored and retrieved', () => {
  setToken(mockLocalStorage, 'mytoken123');
  assertEqual(getToken(mockLocalStorage), 'mytoken123');
});

test('token cleared', () => {
  setToken(mockLocalStorage, 'mytoken123');
  clearToken(mockLocalStorage);
  assert(getToken(mockLocalStorage) === null);
});

test('auth header uses token', () => {
  setToken(mockLocalStorage, 'bearer-token-xyz');
  const headers = { Authorization: `Bearer ${getToken(mockLocalStorage)}` };
  assertEqual(headers.Authorization, 'Bearer bearer-token-xyz');
});

// ── Summary ────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
