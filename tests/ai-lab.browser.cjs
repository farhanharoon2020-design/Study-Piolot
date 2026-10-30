// Browser integration test: all external requests are mocked or blocked.
// Requires Playwright and an installed Edge/Chromium browser.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const course = '22222222-2222-4222-8222-222222222222';
const material = '33333333-3333-4333-8333-333333333333';
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end(); return;
  }
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)];
  res.setHeader('Content-Type', type || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.STUDYPILOT_BROWSER || 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ course, material }) => {
      const user = '11111111-1111-4111-8111-111111111111';
      window.aiRequests = [];
      const rows = {
        courses: [{ id: course, name: 'Database Systems', code: 'CS301' }],
        materials: [
          { id: material, course_id: course, name: 'Lecture 1.pdf', mime_type: 'application/pdf', size: 2048,
            storage_path: `${user}/${course}/${material}_Lecture_1.pdf` },
          { id: 'unsupported', course_id: course, name: 'Lecture 2.pptx', size: 2048, storage_path: 'test.pptx' },
        ],
        topics: [{ id: 'topic', name: 'Primary keys', difficulty: 'easy' }],
      };
      window.testClient = {
        auth: { getSession: async () => ({ data: { session: { user: { id: user, email: 'test@example.com' } } } }) },
        from(table) {
          const query = {
            select() { return this; }, eq() { return this; }, order() { return this; },
            maybeSingle: async () => ({ data: table === 'profiles' ? { name: 'Test Student' } : null }),
            then(resolve) { return Promise.resolve({ data: rows[table] || [] }).then(resolve); },
          };
          return query;
        },
        functions: { invoke: async (name, { body }) => {
          window.aiRequests.push({ name, body });
          if (body.action === 'status') return { data: { success: true, configured: true, model: 'test-model' } };
          if (window.failAI) return { error: { context: { json: async () => ({ error: 'Gemini quota reached.' }) } } };
          const result = { success: true, isDemo: false, generationId: 'test-generation',
            materialId: body.materialId, sourceName: 'Lecture 1.pdf' };
          if (body.action === 'notes') result.markdown = '# Primary keys\nA key uniquely identifies a row. [Page 1]\n<img src=x onerror=alert(1)>';
          else result.questions = Array.from({ length: body.count }, (_, i) => ({ id: i + 1,
            question: `Which key identifies row ${i + 1}?`, options: ['Foreign', 'Primary', 'Any', 'None'],
            correctIndex: 1, hint: 'Unique rows.', explanation: 'A primary key identifies a row. [Page 1]' }));
          return { data: result };
        } },
      };
    }, { course, material });
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.startsWith(base)) {
        const file = path.resolve(root, '.' + new URL(url).pathname);
        const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)];
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          return route.fulfill({ status: 404, body: '' });
        }
        return route.fulfill({ contentType: type || 'application/octet-stream', body: fs.readFileSync(file) });
      }
      if (url.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')) {
        return route.fulfill({ contentType: 'text/javascript', body: 'window.supabase = { createClient: () => window.testClient };' });
      }
      return route.abort();
    });
    await page.goto(`${base}/ai-lab.html?courseId=${course}&materialId=${material}`);
    await page.waitForFunction(() => document.getElementById('notes-material-select').value !== '');
    assert.equal(await page.locator('#notes-material-select').inputValue(), material);
    assert.equal(await page.locator('#notes-material-select option[value="unsupported"]').isDisabled(), true);
    await page.locator('#generate-notes-btn').click();
    await page.locator('#notes-result-state:not(.hidden)').waitFor();
    assert.match(await page.locator('#notes-content-viewer').innerText(), /uniquely identifies/);
    assert.equal(await page.locator('#notes-content-viewer img').count(), 0);
    const notesRequest = await page.evaluate(() => window.aiRequests.find(r => r.body.action === 'notes'));
    assert.equal(notesRequest.body.materialId, material);
    assert.equal(notesRequest.body.courseId, course);
    await page.locator('#save-notes-btn').click();
    assert.equal(await page.evaluate(() => getSavedNotes().length), 1);
    fs.mkdirSync(path.join(root, 'tmp', 'ai-checks'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'tmp', 'ai-checks', 'notes-desktop.png'), fullPage: true });

    await page.locator('#quiz-from-notes-btn').click();
    assert.equal(await page.locator('#quiz-material-select').inputValue(), material);
    await page.locator('#quiz-count-select').selectOption('3');
    await page.locator('#start-quiz-btn').click();
    await page.locator('#quiz-runner-screen:not(.hidden)').waitFor();
    for (let i = 0; i < 3; i++) {
      await page.locator('#quiz-options-container button').nth(1).click();
      await page.locator(i === 2 ? '#quiz-finish-btn' : '#quiz-next-btn').click();
    }
    assert.equal(await page.locator('#results-score-percent').innerText(), '100%');
    await page.locator('#quiz-save-score-btn').click();
    assert.equal(await page.evaluate(() => getSavedQuizResults()[0].score), 3);

    // Quota errors restore controls and do not produce a demo quiz.
    await page.goto(`${base}/ai-lab.html?courseId=${course}&materialId=${material}&mode=quiz`);
    await page.waitForFunction(() => document.getElementById('quiz-material-select').value !== '');
    await page.evaluate(() => { window.failAI = true; });
    await page.locator('#start-quiz-btn').click();
    await page.waitForFunction(() => !document.getElementById('start-quiz-btn').disabled);
    assert.equal(await page.locator('#quiz-setup-screen').isVisible(), true);
    assert.equal(await page.locator('#quiz-runner-screen').isVisible(), false);
    assert.match(await page.locator('.toast').last().innerText(), /quota reached/);
    assert.match(await page.locator('#quiz-error-message').innerText(), /quota reached/);

    await page.goto(`${base}/materials.html`);
    await page.locator('a', { hasText: 'AI Notes' }).first().waitFor();
    assert.match(await page.locator('a', { hasText: 'AI Notes' }).first().getAttribute('href'), new RegExp(material));
    await page.locator('a', { hasText: 'AI Notes' }).first().click();
    await page.waitForFunction(() => document.getElementById('notes-material-select')?.value !== '');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#tab-btn-notes').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo(0, 0);
    });
    await page.waitForFunction(() => scrollY === 0);
    await page.screenshot({ path: path.join(root, 'tmp', 'ai-checks', 'notes-mobile.png'), fullPage: true });
    await page.goto(`${base}/settings.html`);
    await page.waitForFunction(() => document.getElementById('gemini-settings-status').textContent === 'Server configured');
    assert.equal(await page.locator('#settings-gemini-key').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: PDF selection, source IDs, escaped notes, notes-to-quiz, scoring, error recovery, mobile width, settings. External requests blocked.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
