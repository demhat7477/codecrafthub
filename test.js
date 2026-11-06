// Automated tests for the CodeCraftHub API.
// Run with: npm test
// Uses a temporary data file, so your real courses.json is never touched.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codecrafthub-'));
process.env.DATA_FILE = path.join(tmpDir, 'courses.json');
const app = require('./app');

let server;
let base;

before(async () => {
    server = app.listen(0);
    await new Promise(r => server.once('listening', r));
    base = `http://localhost:${server.address().port}`;
});

after(() => {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function call(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    const res = await fetch(base + url, opts);
    return { status: res.status, body: await res.json() };
}

const python = {
    name: 'Python Basics',
    description: 'Learn Python fundamentals',
    target_date: '2025-12-31',
    status: 'Not Started'
};

test('GET /api/courses returns empty list and creates the file', async () => {
    const r = await call('GET', '/api/courses');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.count, 0);
    assert.ok(fs.existsSync(process.env.DATA_FILE));
});

test('POST creates a course with id 1 and created_at', async () => {
    const r = await call('POST', '/api/courses', python);
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.body.course.id, 1);
    assert.match(r.body.course.created_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    const saved = JSON.parse(fs.readFileSync(process.env.DATA_FILE, 'utf8'));
    assert.strictEqual(saved.length, 1);
});

test('POST accepts German status and stores the English value', async () => {
    const r = await call('POST', '/api/courses', { ...python, name: 'Node.js', description: 'Learn Express APIs', status: 'In Bearbeitung' });
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.body.course.id, 2);
    assert.strictEqual(r.body.course.status, 'In Progress');
});

test('POST rejects missing fields', async () => {
    const r = await call('POST', '/api/courses', { name: 'Only name' });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /description, target_date, status/);
});

test('POST rejects invalid status', async () => {
    const r = await call('POST', '/api/courses', { ...python, status: 'Done' });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /Status must be one of/);
});

test('POST rejects invalid date', async () => {
    const r = await call('POST', '/api/courses', { ...python, target_date: '2025-02-30' });
    assert.strictEqual(r.status, 400);
});

test('POST rejects empty body and broken JSON', async () => {
    assert.strictEqual((await call('POST', '/api/courses', {})).status, 400);
    const r = await call('POST', '/api/courses', '{"name": ');
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.error, 'Invalid JSON in request body');
});

test('GET /api/courses/:id returns the course, 404 or 400', async () => {
    assert.strictEqual((await call('GET', '/api/courses/1')).body.course.name, 'Python Basics');
    assert.strictEqual((await call('GET', '/api/courses/99')).status, 404);
    assert.strictEqual((await call('GET', '/api/courses/abc')).status, 400);
});

test('PUT updates only the given fields', async () => {
    const r = await call('PUT', '/api/courses/1', { status: 'In Progress' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.course.status, 'In Progress');
    assert.strictEqual(r.body.course.name, 'Python Basics');
    assert.strictEqual((await call('PUT', '/api/courses/1', { status: 'xyz' })).status, 400);
    assert.strictEqual((await call('PUT', '/api/courses/99', { status: 'Completed' })).status, 404);
});

test('GET /api/courses/stats counts by status', async () => {
    const r = await call('GET', '/api/courses/stats');
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.body.stats, {
        total_courses: 2,
        by_status: { 'Not Started': 0, 'In Progress': 2, 'Completed': 0 }
    });
});

test('GET /api/courses/search finds by name/description', async () => {
    const r = await call('GET', '/api/courses/search?q=python');
    assert.strictEqual(r.body.count, 1);
    assert.strictEqual((await call('GET', '/api/courses/search')).status, 400);
});

test('DELETE removes the course', async () => {
    const r = await call('DELETE', '/api/courses/1');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.deleted_course.id, 1);
    assert.strictEqual((await call('DELETE', '/api/courses/1')).status, 404);
    assert.strictEqual((await call('GET', '/api/courses')).body.count, 1);
});

test('corrupt courses.json gives a 500 error instead of losing data', async () => {
    fs.writeFileSync(process.env.DATA_FILE, '{ not json');
    const r = await call('GET', '/api/courses');
    assert.strictEqual(r.status, 500);
    assert.strictEqual(fs.readFileSync(process.env.DATA_FILE, 'utf8'), '{ not json');
});

test('CORS header is sent so a browser dashboard can call the API', async () => {
    const res = await fetch(base + '/api/courses', { headers: { Origin: 'http://example.com' } });
    assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
});

test('dashboard.html is served', async () => {
    const res = await fetch(base + '/dashboard.html');
    assert.strictEqual(res.status, 200);
    assert.match(await res.text(), /<title>CodeCraftHub: Your Learning Management Platform<\/title>/);
});
