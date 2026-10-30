/**
 * settings.js
 * Profile & Settings page logic.
 *
 * Saves: name, degree, semester, preferred study time, daily duration.
 * Email is read-only in preview mode (no Supabase user yet).
 * Reset demo data clears all local records after confirmation.
 * Exit preview returns to login.html without deleting data.
 */

document.addEventListener('DOMContentLoaded', () => {
  initSettings();
});

function initSettings() {
  loadProfileIntoForm();

  document.getElementById('settings-form')?.addEventListener('submit', handleSettingsSave);
  document.getElementById('exit-preview-btn')?.addEventListener('click', handleExitPreview);
  document.getElementById('reset-data-btn')?.addEventListener('click', handleResetData);
  document.getElementById('supabase-config-btn')?.addEventListener('click', () => {
    if (typeof openSupabaseSetupModal === 'function') openSupabaseSetupModal();
  });
  document.getElementById('auth-signout-btn')?.addEventListener('click', () => {
    if (typeof authSignOut === 'function') authSignOut();
  });

  // Supabase connection badge in settings
  const statusEl = document.getElementById('supabase-settings-status');
  if (statusEl) {
    const isConn = typeof isSupabaseConfigured === 'function' && isSupabaseConfigured();
    statusEl.textContent = isConn ? 'Connected' : 'Not connected';
    statusEl.className = isConn ? 'badge badge-success' : 'badge badge-warning';
  }

  // Toggle rows based on preview mode vs authenticated
  const inPreview = isPreviewMode();
  const signoutRow = document.getElementById('auth-signout-row');
  const signoutHr = document.getElementById('auth-signout-hr');
  const exitPreviewRow = document.getElementById('exit-preview-row');

  if (signoutRow) signoutRow.style.display = inPreview ? 'none' : 'flex';
  if (signoutHr) signoutHr.style.display = inPreview ? 'none' : 'block';
  if (exitPreviewRow) exitPreviewRow.style.display = inPreview ? 'flex' : 'none';

  // Show/hide preview badge based on mode
  const previewBadge = document.getElementById('preview-mode-badge');
  if (previewBadge) {
    previewBadge.hidden = !inPreview;
  }

  // Duration field: validate positive integer on input
  document.getElementById('study-duration')?.addEventListener('input', e => {
    const val = parseInt(e.target.value);
    const errEl = document.getElementById('study-duration-error');
    if (e.target.value && (isNaN(val) || val <= 0)) {
      e.target.classList.add('error');
      if (errEl) { errEl.textContent = 'Enter a positive number of minutes.'; errEl.style.display = 'flex'; }
    } else {
      e.target.classList.remove('error');
      if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    }
  });
}

/* ============================================================
   LOAD PROFILE INTO FORM
   ============================================================ */
function loadProfileIntoForm() {
  const profile = getProfile();

  const nameEl     = document.getElementById('profile-name');
  const emailEl    = document.getElementById('profile-email');
  const degreeEl   = document.getElementById('profile-degree');
  const semEl      = document.getElementById('profile-semester');
  const timeEl     = document.getElementById('study-time');
  const durationEl = document.getElementById('study-duration');

  if (nameEl)     nameEl.value     = profile.name     || '';
  if (degreeEl)   degreeEl.value   = profile.degree   || '';
  if (semEl)      semEl.value      = profile.semester  || '';
  if (timeEl)     timeEl.value     = profile.studyTime || '';
  if (durationEl) durationEl.value = profile.studyDuration || '';

  // Email: read-only in preview mode
  if (emailEl) {
    emailEl.value = isPreviewMode() ? 'Not set (preview mode)' : (profile.email || '');
    emailEl.readOnly = true;
    emailEl.style.background = 'var(--page-bg)';
    emailEl.style.color      = 'var(--text-secondary)';
    emailEl.title = isPreviewMode()
      ? 'Email is not available in preview mode. Sign in with Supabase to use an account.'
      : 'Email is managed by your account provider.';
  }
}

/* ============================================================
   SAVE
   ============================================================ */
function handleSettingsSave(e) {
  e.preventDefault();

  const name         = document.getElementById('profile-name')?.value.trim() || '';
  const degree       = document.getElementById('profile-degree')?.value.trim() || '';
  const semester     = document.getElementById('profile-semester')?.value || '';
  const studyTime    = document.getElementById('study-time')?.value || '';
  const durationRaw  = document.getElementById('study-duration')?.value || '';
  const durationEl   = document.getElementById('study-duration');
  const errEl        = document.getElementById('study-duration-error');

  // Validate duration
  if (durationRaw) {
    const num = parseInt(durationRaw);
    if (isNaN(num) || num <= 0) {
      if (durationEl) durationEl.classList.add('error');
      if (errEl)      { errEl.textContent = 'Enter a positive number of minutes.'; errEl.style.display = 'flex'; }
      return;
    }
  }

  saveProfile({ name, degree, semester, studyTime, studyDuration: durationRaw });
  showToast('Settings saved.', 'success');
}

/* ============================================================
   EXIT PREVIEW
   ============================================================ */
function handleExitPreview() {
  // Just clear the preview flag and redirect – no data deletion
  setPreviewMode(false);
  window.location.href = 'login.html';
}

/* ============================================================
   RESET DATA
   ============================================================ */
function handleResetData() {
  showConfirm(
    'Reset all local data?',
    'This will permanently delete all your courses, syllabi, topics, uploaded files and preferences saved in this browser. This cannot be undone.',
    'Reset everything',
    async () => {
      await resetAllData();
      showToast('All local data has been cleared.', 'info');
      // Reload to reflect empty state
      setTimeout(() => window.location.href = 'login.html', 1200);
    },
    'danger'
  );
}

/* ============================================================
   GEMINI AI SETTINGS
   ============================================================ */
function initGeminiSettings() {
  const status = document.getElementById('gemini-settings-status');
  const detail = document.getElementById('settings-ai-detail');
  async function check() {
    const button = document.getElementById('settings-gemini-test-btn');
    if (button) { button.disabled = true; button.textContent = 'Checking...'; }
    if (detail) detail.textContent = 'Checking Gemini API access...';
    const result = await window.aiService.testGeminiConnection();
    if (status) {
      status.textContent = result.success ? 'Server configured' : 'Setup needed';
      status.className = result.success ? 'badge badge-success' : 'badge badge-warning';
    }
    if (detail) detail.textContent = result.message;
    if (button) { button.disabled = false; button.textContent = 'Check AI Setup'; }
  }
  document.getElementById('settings-gemini-test-btn')?.addEventListener('click', check);
  check();
}
const origInitSettings = initSettings;
initSettings = function() {
  origInitSettings();
  initGeminiSettings();
};
