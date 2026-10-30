/** Gemini runs in Supabase; provider keys never enter the browser. */
async function invokeStudyAI(action, options = {}) {
  if (typeof isPreviewMode === 'function' && isPreviewMode()) {
    throw new Error('Sign in to generate AI content from your study materials.');
  }
  const client = window.supabaseClient;
  if (!client) throw new Error('Connect Supabase in Settings first.');
  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError || !session) throw new Error('Please sign in to use Gemini.');
  const { data, error } = await client.functions.invoke('study_ai', { body: { ...options, action } });
  if (error) {
    const status = error.context?.status;
    let message = 'Could not connect to study_ai. Check that it is deployed in the same Supabase project as this app and allows browser requests.';
    if (status === 404) message = 'The study_ai function was not found. Deploy it with that exact name in the Supabase project connected to this app.';
    if (status === 401) message = 'The AI function rejected your session. Sign in again and check the function authentication settings.';
    try {
      const details = await error.context.json();
      if (typeof details.error === 'string') message = details.error;
      else if (typeof details.message === 'string') {
        if (status === 401) message += ` Server response: ${details.message}`;
        else if (status !== 404) message = details.message;
      }
    } catch { /* Network errors have no JSON response. */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.success) throw new Error('The AI function returned an invalid response.');
  return data;
}
async function testGeminiConnection() {
  try {
    const result = await invokeStudyAI('status');
    return { success: result.configured, message: result.configured
      ? result.verified
        ? `Google accepted the API key and model (${result.model}). Generate notes to test document processing.`
        : `Server configured (${result.model}), but API access is unverified. Redeploy the updated study_ai function for the access check.`
      : 'Add GEMINI_API_KEY in Supabase Edge Function secrets.' };
  } catch (error) { return { success: false, message: error.message }; }
}
async function generateStudyNotes(options) { return invokeStudyAI('notes', options); }
async function generateMockQuiz(options) { return invokeStudyAI('quiz', options); }
async function generateTopicsFromSyllabus(syllabusText, courseName = '') {
  try {
    return await invokeStudyAI('topics', { syllabusContext: syllabusText, courseName });
  } catch (error) {
    // The existing Topics tab uses an error result to stop its loading state.
    return { error: error.message };
  }
}
window.aiService = { testGeminiConnection, generateStudyNotes, generateMockQuiz, generateTopicsFromSyllabus };
