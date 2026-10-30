const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const USER = '11111111-1111-4111-8111-111111111111';
const COURSE = '22222222-2222-4222-8222-222222222222';
const MATERIAL = '33333333-3333-4333-8333-333333333333';
const question = (i = 0) => ({ question: `Question ${i}?`, options: ['A', 'B', 'C', 'D'],
  correctIndex: 1, hint: 'Read slide 1.', explanation: 'B is supported by [Page 1].' });

function setup(options = {}) {
  let handler;
  const calls = [];
  const cache = new Map();
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
  const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'public-test-key',
    GEMINI_API_KEY: 'private-test-key', ...options.env };
  const fetch = async (url, init = {}) => {
    calls.push({ url, ...init });
    if (url.endsWith('/auth/v1/user')) return json(options.badSession ? {} : { id: USER }, options.badSession ? 401 : 200);
    if (url.includes('/rest/v1/courses?')) return json(options.foreignCourse ? [] : [{ name: 'Databases' }]);
    if (url.includes('/rest/v1/materials?')) return json(options.foreignFile ? [] : [{
      id: MATERIAL, course_id: COURSE, user_id: USER, name: options.fileName || 'slides.pdf',
      size: options.fileSize || 30, storage_path: options.path || `${USER}/${COURSE}/slides.pdf`,
    }]);
    if (url.includes('/storage/v1/')) return new Response(options.pdf || '%PDF-1.7\nTest slides');
    if (url.includes('/rest/v1/ai_generations')) {
      if (options.databaseError) return json({}, 403);
      if (init.method === 'POST') {
        const entry = JSON.parse(init.body);
        cache.set(entry.id, entry.result);
        return new Response(null, { status: 201 });
      }
      const id = new URL(url).searchParams.get('id').slice(3);
      return json(cache.has(id) ? [{ result: cache.get(id) }] : []);
    }
    if (url.startsWith('https://generativelanguage.googleapis.com/')) {
      if (options.quotaError) return json({}, 429);
      if (options.googleStatus) return json({ error: { message: options.googleMessage || 'Provider error' } }, options.googleStatus);
      if (!url.includes(':generateContent')) {
        if (options.modelTimeout) throw new DOMException('Timed out', 'TimeoutError');
        return json({ name: 'models/gemini-3.8-flash', supportedGenerationMethods: options.noGeneration ? [] : ['generateContent'] });
      }
      if (options.generationTimeout) throw new DOMException('Timed out', 'TimeoutError');
      const payload = options.output ?? { markdown: '# Source notes\nFact [Page 1]' };
      return json({ candidates: [{ finishReason: options.finishReason || 'STOP', content: {
        parts: [{ text: options.rawOutput || JSON.stringify(payload) }],
      } }] });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  vm.runInNewContext(fs.readFileSync('supabase/functions/study_ai/handler.js', 'utf8'), {
    Deno: { env: { get: key => env[key] }, serve: callback => { handler = callback; } },
    fetch, crypto: webcrypto, Response, Request, TextEncoder, TextDecoder, Uint8Array,
    AbortSignal, btoa, console,
  });
  async function request(body, { auth = 'Bearer user-session', method = 'POST' } = {}) {
    const res = await handler(new Request('https://test.supabase.co/functions/v1/study_ai', {
      method, headers: auth ? { Authorization: auth } : {},
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    }));
    return { status: res.status, data: res.status === 204 || method === 'OPTIONS' ? null : await res.json() };
  }
  return { request, calls, cache };
}
const pdfRequest = { action: 'notes', courseId: COURSE, materialId: MATERIAL };
const aiCalls = fixture => fixture.calls.filter(c => c.url.includes('generativelanguage'));

test('preflight works and unauthenticated requests never call Gemini', async () => {
  const f = setup();
  assert.equal((await f.request({}, { method: 'OPTIONS', auth: '' })).status, 200);
  assert.equal((await f.request(pdfRequest, { auth: '' })).status, 401);
  assert.equal((await f.request({}, { method: 'GET' })).status, 405);
  assert.equal(aiCalls(f).length, 0);
});
test('expired sessions cannot generate', async () => {
  const f = setup({ badSession: true });
  assert.equal((await f.request(pdfRequest)).status, 401);
  assert.equal(aiCalls(f).length, 0);
});
test('status reports configuration without spending Gemini credits', async () => {
  const f = setup({ env: { GEMINI_API_KEY: '' } });
  assert.equal((await f.request({ action: 'status' })).data.configured, false);
  assert.equal((await f.request(pdfRequest)).status, 503);
  assert.equal(aiCalls(f).length, 0);
});
test('setup checks real key/model access without a generation or document upload', async () => {
  const f = setup();
  const result = await f.request({ action: 'status' });
  assert.equal(result.data.verified, true);
  assert.equal(result.data.version, 2);
  assert.equal(aiCalls(f).length, 1);
  assert.equal(aiCalls(f)[0].body, undefined);
  assert.equal(aiCalls(f)[0].url.includes(':generateContent'), false);
  assert.equal(f.calls.some(c => c.url.includes('/storage/')), false);
  for (const [options, expected] of [
    [{ googleStatus: 400, googleMessage: 'API key not valid. private-test-key' }, /Google rejected GEMINI_API_KEY/],
    [{ googleStatus: 403 }, /denied Gemini access/],
    [{ googleStatus: 404 }, /GEMINI_MODEL/],
    [{ noGeneration: true }, /does not support content generation/],
  ]) {
    const res = await setup(options).request({ action: 'status' });
    assert.equal(res.status, 502);
    assert.match(res.data.error, expected);
    assert.equal(JSON.stringify(res.data).includes('private-test-key'), false);
  }
});
test('timeouts identify the failed stage and credentials are redacted from provider errors', async () => {
  const metadata = await setup({ modelTimeout: true }).request({ action: 'status' });
  assert.equal(metadata.status, 504);
  assert.match(metadata.data.error, /Gemini model access check timed out/);
  const generation = await setup({ generationTimeout: true }).request(pdfRequest);
  assert.equal(generation.status, 504);
  assert.match(generation.data.error, /Google did not finish within 90 seconds/);
  const failed = await setup({ googleStatus: 400,
    googleMessage: 'Invalid parameter. Key=private-test-key https://example.test/?key=another-secret AIzaAnotherSecretValue12345' }).request(pdfRequest);
  assert.match(failed.data.error, /Invalid parameter/);
  assert.equal(/private-test-key|another-secret|AIzaAnotherSecretValue12345/.test(JSON.stringify(failed.data)), false);
});
test('PDF bytes reach Gemini, scoped JWT reaches Storage, and identical requests use cache', async () => {
  const f = setup();
  const first = await f.request(pdfRequest);
  assert.equal(first.status, 200);
  assert.equal(first.data.isDemo, false);
  assert.equal(first.data.sourceName, 'slides.pdf');
  assert.equal(first.data.cached, false);
  const call = aiCalls(f)[0];
  assert.equal(call.headers['x-goog-api-key'], 'private-test-key');
  assert.ok(!call.url.includes('private-test-key'));
  const payload = JSON.parse(call.body);
  assert.equal(payload.generationConfig.thinkingConfig.thinkingLevel, 'LOW');
  assert.equal(payload.generationConfig.maxOutputTokens, 6000);
  assert.match(Buffer.from(payload.contents[0].parts[1].inlineData.data, 'base64').toString(), /^%PDF-/);
  assert.equal(f.calls.find(c => c.url.includes('/storage/')).headers.Authorization, 'Bearer user-session');
  const second = await f.request(pdfRequest);
  assert.equal(second.data.cached, true);
  assert.equal(aiCalls(f).length, 1);
  assert.equal(f.cache.size, 1);
  assert.equal(JSON.stringify(first.data).includes('private-test-key'), false);
  await f.request({ ...pdfRequest, topicName: 'Normalization' });
  assert.equal(aiCalls(f).length, 2);
});
test('foreign courses and files are rejected before contacting Gemini', async () => {
  for (const options of [{ foreignCourse: true }, { foreignFile: true }, { path: `other/${COURSE}/slides.pdf` }]) {
    const f = setup(options);
    assert.equal((await f.request(pdfRequest)).status, 404);
    assert.equal(aiCalls(f).length, 0);
  }
});
test('rejects unsupported, oversized, and mislabeled files', async () => {
  for (const [options, status] of [[{ fileName: 'slides.pptx' }, 415],
    [{ fileSize: 11 * 1024 * 1024 }, 413], [{ pdf: 'This is not a PDF' }, 415]]) {
    const f = setup(options);
    assert.equal((await f.request(pdfRequest)).status, status);
    assert.equal(aiCalls(f).length, 0);
  }
});
test('requires source material and validates bounded request settings', async () => {
  const f = setup();
  for (const bad of [{ action: 'notes' }, { ...pdfRequest, count: '3' },
    { ...pdfRequest, count: 100 }, { ...pdfRequest, difficulty: 'invalid' },
    { ...pdfRequest, style: 'invalid' }, { ...pdfRequest, materialId: '../other' },
    { action: 'notes', syllabusContext: 'x'.repeat(20001) }]) {
    assert.equal((await f.request(bad)).status, 400);
  }
  assert.equal(aiCalls(f).length, 0);
});
test('pasted text works without a file or course', async () => {
  const f = setup();
  const res = await f.request({ action: 'notes', syllabusContext: 'A primary key uniquely identifies a row.' });
  assert.equal(res.status, 200);
  assert.equal(res.data.sourceName, 'Pasted source text');
  assert.equal(f.calls.some(c => c.url.includes('/storage/')), false);
});
test('validates quiz shape, count, options, answer index and explanations', async () => {
  const body = { ...pdfRequest, action: 'quiz', count: 3 };
  const valid = Array.from({ length: 3 }, (_, i) => question(i));
  const good = setup({ output: { questions: valid } });
  assert.equal((await good.request(body)).data.questions[2].id, 3);
  for (const broken of [valid.slice(0, 2),
    [{ ...question(), correctIndex: 4 }, ...valid.slice(1)],
    [{ ...question(), correctIndex: 1.5 }, ...valid.slice(1)],
    [{ ...question(), options: ['A', 'a', 'C', 'D'] }, ...valid.slice(1)],
    [{ ...question(), explanation: '' }, ...valid.slice(1)]]) {
    const f = setup({ output: { questions: broken } });
    assert.equal((await f.request(body)).status, 502);
    assert.equal(f.cache.size, 0);
  }
});
test('provider failures never return template content or enter the cache', async () => {
  for (const [options, status] of [[{ quotaError: true }, 429], [{ rawOutput: 'invalid JSON' }, 502],
    [{ finishReason: 'MAX_TOKENS' }, 502], [{ output: { error: 'Unreadable' } }, 422],
    [{ output: { markdown: '' } }, 502]]) {
    const f = setup(options);
    const res = await f.request(pdfRequest);
    assert.equal(res.status, status);
    assert.equal(res.data.markdown, undefined);
    assert.equal(f.cache.size, 0);
  }
});
test('missing database setup fails before a billed generation', async () => {
  const f = setup({ databaseError: true });
  assert.equal((await f.request(pdfRequest)).status, 503);
  assert.equal(aiCalls(f).length, 0);
});
test('topic extraction remains supported with validated UUID-backed results', async () => {
  const f = setup({ output: { topics: [{ name: 'Keys', difficulty: 'easy', weightage: 20 }] } });
  const res = await f.request({ action: 'topics', syllabusContext: 'Keys and normalization.' });
  assert.equal(res.status, 200);
  assert.match(res.data.topics[0].id, /^[0-9a-f-]{36}$/);
});

test('frontend sends session-authenticated source IDs and surfaces server errors', async () => {
  const requests = [];
  const context = {
    isPreviewMode: () => false,
    window: { supabaseClient: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'test-session' } } }) },
      functions: { invoke: async (name, options) => {
        requests.push({ name, ...options });
        return { data: { success: true, markdown: 'Notes' } };
      } },
    } },
  };
  vm.runInNewContext(fs.readFileSync('js/ai-service.js', 'utf8'), context);
  await context.window.aiService.generateStudyNotes({ courseId: COURSE, materialId: MATERIAL });
  assert.equal(requests[0].name, 'study_ai');
  assert.equal(requests[0].body.materialId, MATERIAL);
  assert.equal(requests[0].body.action, 'notes');
  context.window.supabaseClient.functions.invoke = async () => ({ error: {
    context: { json: async () => ({ error: 'Gemini quota reached.' }) },
  } });
  await assert.rejects(context.window.aiService.generateMockQuiz({}), /Gemini quota reached/);
  assert.match((await context.window.aiService.generateTopicsFromSyllabus('Source')).error, /quota reached/);
  context.window.supabaseClient.functions.invoke = async () => ({ error: {
    context: { status: 404, json: async () => ({ code: 'NOT_FOUND', message: 'Requested function was not found' }) },
  } });
  await assert.rejects(context.window.aiService.generateStudyNotes({}), /Deploy it with that exact name/);
  context.window.supabaseClient.functions.invoke = async () => ({ error: {
    context: { status: 401, json: async () => ({ code: 401, message: 'Invalid JWT' }) },
  } });
  await assert.rejects(context.window.aiService.generateStudyNotes({}), /Invalid JWT/);
  context.window.supabaseClient.functions.invoke = async () => ({ error: new Error('Failed to fetch') });
  await assert.rejects(context.window.aiService.generateStudyNotes({}), /same Supabase project/);
  context.isPreviewMode = () => true;
  await assert.rejects(context.window.aiService.generateStudyNotes({}), /Sign in/);
});
