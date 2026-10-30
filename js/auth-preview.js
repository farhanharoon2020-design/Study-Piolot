/**
 * auth-preview.js
 * Handles account interactions (login, register, forgot-password, reset-password),
 * Supabase Auth, and preview-mode navigation.
 */

/* ============================================================
   AUTH SERVICE IMPLEMENTATIONS
   ============================================================ */

/**
 * Sign in with email and password via Supabase (or fallback notice)
 */
async function authSignIn(email, password) {
  if (isSupabaseConfigured() && window.supabaseClient) {
    try {
      const res = await window.supabaseClient.auth.signInWithPassword({ email, password });
      if (res.data?.user) {
        // Update local profile with authenticated email & user metadata name
        const profile = typeof getProfile === 'function' ? getProfile() : {};
        profile.email = res.data.user.email;
        if (res.data.user.user_metadata?.name) {
          profile.name = res.data.user.user_metadata.name;
        }
        if (typeof saveProfile === 'function') {
          saveProfile(profile);
        }
      }
      return res;
    } catch (e) {
      return { error: { message: e.message || 'Error communicating with Supabase.' } };
    }
  }

  return {
    error: {
      message: 'Supabase is not configured yet. Please enter your Supabase URL & Anon Key or use "Preview workspace".',
      needsConfig: true,
    },
  };
}

/**
 * Sign up a new user via Supabase
 */
async function authSignUp(name, email, password) {
  if (isSupabaseConfigured() && window.supabaseClient) {
    try {
      const res = await window.supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });
      return res;
    } catch (e) {
      return { error: { message: e.message || 'Error communicating with Supabase.' } };
    }
  }

  return {
    error: {
      message: 'Supabase is not configured yet. Please configure your Supabase credentials or explore via "Preview workspace".',
      needsConfig: true,
    },
  };
}

/**
 * Send password reset email
 */
async function authSendReset(email) {
  if (isSupabaseConfigured() && window.supabaseClient) {
    try {
      const currentOrigin = window.location.origin;
      const pathWithoutFile = window.location.pathname.replace(/[^/]*$/, '');
      const redirectTo = `${currentOrigin}${pathWithoutFile}reset-password.html`;

      return await window.supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
    } catch (e) {
      return { error: { message: e.message || 'Error sending password reset email.' } };
    }
  }

  return {
    error: {
      message: 'Password reset emails require Supabase connection, which is not set up yet.',
      needsConfig: true,
    },
  };
}

/**
 * Update user password after recovery redirect
 */
async function authUpdatePassword(newPassword) {
  if (isSupabaseConfigured() && window.supabaseClient) {
    try {
      return await window.supabaseClient.auth.updateUser({ password: newPassword });
    } catch (e) {
      return { error: { message: e.message || 'Error updating password.' } };
    }
  }

  return {
    error: {
      message: 'Password update requires Supabase connection, which is not set up yet.',
      needsConfig: true,
    },
  };
}

/**
 * Sign out user from Supabase and clear session
 */
async function authSignOut() {
  if (isSupabaseConfigured() && window.supabaseClient) {
    try {
      await window.supabaseClient.auth.signOut();
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  }
  setPreviewMode(false);
  window.location.href = 'login.html';
}

/* ============================================================
   VALIDATION HELPERS
   ============================================================ */

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function showFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (input) input.classList.add('error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'flex';
  }
}

function clearFieldError(fieldId) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (input) input.classList.remove('error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }
}

function clearAllErrors(...fieldIds) {
  fieldIds.forEach(clearFieldError);
}

function setFormMessage(elId, message, type = 'info') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.className = `auth-info-box ${type === 'error' ? 'error-banner' : ''}`;
  el.style.display = message ? 'block' : 'none';
}

/* ============================================================
   SUPABASE CONNECTION CONFIG MODAL
   ============================================================ */

function openSupabaseSetupModal() {
  let modal = document.getElementById('supabase-setup-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'supabase-setup-modal';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal" style="max-width: 480px;">
        <div class="modal-header">
          <div>
            <h2>Connect Supabase</h2>
            <p class="text-sm text-secondary">Enter your Supabase project credentials to enable live Auth, Database & Storage.</p>
          </div>
          <button class="modal-close" id="sp-modal-close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form id="sp-setup-form">
          <div class="modal-body">
            <div class="form-group mb-16">
              <label class="form-label" for="sp-modal-url">Supabase Project URL <span style="color:var(--danger)">*</span></label>
              <input type="url" id="sp-modal-url" class="form-input" placeholder="https://your-project-id.supabase.co" required>
              <span class="text-xs text-secondary mt-4">Found in your Supabase dashboard under Project Settings -> API.</span>
            </div>
            <div class="form-group mb-16">
              <label class="form-label" for="sp-modal-key">Supabase Anon / Publishable Key <span style="color:var(--danger)">*</span></label>
              <input type="text" id="sp-modal-key" class="form-input" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." required>
              <span class="text-xs text-secondary mt-4">Anon key safe for client-side browsers.</span>
            </div>
            <div id="sp-modal-msg" class="auth-info-box mb-12" style="display:none"></div>
          </div>
          <div class="modal-footer">
            <button type="button" id="sp-modal-clear" class="btn btn-ghost btn-sm" style="margin-right:auto">Clear credentials</button>
            <button type="button" id="sp-modal-cancel" class="btn btn-ghost">Cancel</button>
            <button type="submit" class="btn btn-primary">Connect & Save</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#sp-modal-close');
    const cancelBtn = modal.querySelector('#sp-modal-cancel');
    const clearBtn = modal.querySelector('#sp-modal-clear');
    const form = modal.querySelector('#sp-setup-form');

    function hideModal() {
      modal.classList.remove('open');
    }

    closeBtn.addEventListener('click', hideModal);
    cancelBtn.addEventListener('click', hideModal);
    modal.addEventListener('click', e => { if (e.target === modal) hideModal(); });

    clearBtn.addEventListener('click', () => {
      clearSupabaseCredentials();
      document.getElementById('sp-modal-url').value = '';
      document.getElementById('sp-modal-key').value = '';
      showToast('Supabase credentials cleared.', 'info');
      hideModal();
      renderSupabaseStatusBadge();
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const url = document.getElementById('sp-modal-url').value.trim();
      const key = document.getElementById('sp-modal-key').value.trim();

      if (!url.startsWith('https://')) {
        showToast('Supabase URL must start with https://', 'error');
        return;
      }
      if (!key) {
        showToast('Anon key is required.', 'error');
        return;
      }

      saveSupabaseCredentials(url, key);
      showToast('Supabase connected successfully!', 'success');
      hideModal();
      renderSupabaseStatusBadge();
    });
  }

  // Pre-fill current values if available
  const currentUrl = getSupabaseUrl();
  const currentKey = getSupabaseAnonKey();
  const urlInput = modal.querySelector('#sp-modal-url');
  const keyInput = modal.querySelector('#sp-modal-key');
  if (urlInput && isSupabaseConfigured()) urlInput.value = currentUrl;
  if (keyInput && isSupabaseConfigured()) keyInput.value = currentKey;

  modal.classList.add('open');
}

/**
 * Render Supabase indicator badge if container exists
 */
function renderSupabaseStatusBadge() {
  const badgeContainer = document.getElementById('supabase-status-badge');
  if (!badgeContainer) return;

  const connected = isSupabaseConfigured();
  badgeContainer.innerHTML = `
    <button type="button" class="btn btn-sm ${connected ? 'btn-ghost' : 'btn-ghost'}" style="display:inline-flex; align-items:center; gap:6px; font-size:12px; padding:4px 10px; border-radius:20px; border:1px solid ${connected ? '#10B981' : '#F59E0B'}; background:${connected ? '#ECFDF5' : '#FFFBEB'}; color:${connected ? '#065F46' : '#92400E'};">
      <span style="width:7px; height:7px; border-radius:50%; background:${connected ? '#10B981' : '#F59E0B'}; display:inline-block;"></span>
      <span>${connected ? 'Supabase Connected' : 'Connect Supabase'}</span>
    </button>
  `;

  badgeContainer.querySelector('button')?.addEventListener('click', e => {
    e.preventDefault();
    openSupabaseSetupModal();
  });
}

/* ============================================================
   PASSWORD VISIBILITY TOGGLES
   ============================================================ */

function initPasswordToggles() {
  document.querySelectorAll('[data-toggle-pw]').forEach(btn => {
    const targetId = btn.getAttribute('data-toggle-pw');
    const input = document.getElementById(targetId);
    if (input) {
      btn.addEventListener('click', () => togglePasswordVisibility(input, btn));
    }
  });
}

/* ============================================================
   LOGIN PAGE
   ============================================================ */

function initLogin() {
  const form = document.getElementById('login-form');
  if (!form) return;

  initPasswordToggles();
  renderSupabaseStatusBadge();

  // If Supabase is not configured yet, show a helpful top note
  if (!isSupabaseConfigured()) {
    setFormMessage(
      'login-msg',
      'Supabase backend not connected yet. Click "Connect Supabase" above or use "Preview workspace" to explore without an account.',
      'info'
    );
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearAllErrors('login-email', 'login-password');

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    let valid = true;

    if (!email) {
      showFieldError('login-email', 'Email is required.');
      valid = false;
    } else if (!isValidEmail(email)) {
      showFieldError('login-email', 'Enter a valid email address.');
      valid = false;
    }
    if (!password) {
      showFieldError('login-password', 'Password is required.');
      valid = false;
    }
    if (!valid) return;

    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    const { data, error } = await authSignIn(email, password);

    btn.disabled = false;
    btn.textContent = 'Sign in';

    if (error) {
      if (error.needsConfig) {
        setFormMessage('login-msg', error.message, 'info');
        openSupabaseSetupModal();
      } else {
        setFormMessage('login-msg', error.message || 'Invalid email or password.', 'error');
      }
    } else {
      setPreviewMode(false);
      showToast('Signed in successfully!', 'success');
      // Trigger Supabase data sync before navigating
      if (typeof syncFromSupabase === 'function') {
        try { await syncFromSupabase(); } catch (err) { /* continue */ }
      }
      window.location.href = 'dashboard.html';
    }
  });

  // Preview workspace link
  document.getElementById('preview-btn')?.addEventListener('click', e => {
    e.preventDefault();
    setPreviewMode(true);
    window.location.href = 'dashboard.html';
  });
}

/* ============================================================
   REGISTER PAGE
   ============================================================ */

function initRegister() {
  const form = document.getElementById('register-form');
  if (!form) return;

  initPasswordToggles();
  renderSupabaseStatusBadge();

  if (!isSupabaseConfigured()) {
    setFormMessage(
      'reg-msg',
      'Supabase backend not connected yet. Click "Connect Supabase" above or use "Preview workspace" on the login page.',
      'info'
    );
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearAllErrors('reg-name', 'reg-email', 'reg-password', 'reg-confirm');

    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    let valid = true;

    if (!name) {
      showFieldError('reg-name', 'Name is required.');
      valid = false;
    }
    if (!email) {
      showFieldError('reg-email', 'Email is required.');
      valid = false;
    } else if (!isValidEmail(email)) {
      showFieldError('reg-email', 'Enter a valid email address.');
      valid = false;
    }
    if (!password) {
      showFieldError('reg-password', 'Password is required.');
      valid = false;
    } else if (password.length < 8) {
      showFieldError('reg-password', 'Password must be at least 8 characters.');
      valid = false;
    }
    if (!confirm) {
      showFieldError('reg-confirm', 'Please confirm your password.');
      valid = false;
    } else if (password && confirm !== password) {
      showFieldError('reg-confirm', 'Passwords do not match.');
      valid = false;
    }
    if (!valid) return;

    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Creating account…';

    const { data, error } = await authSignUp(name, email, password);

    btn.disabled = false;
    btn.textContent = 'Create account';

    if (error) {
      if (error.needsConfig) {
        setFormMessage('reg-msg', error.message, 'info');
        openSupabaseSetupModal();
      } else {
        setFormMessage('reg-msg', error.message, 'error');
      }
    } else {
      // User registered
      if (data?.session) {
        setPreviewMode(false);
        showToast('Account created successfully!', 'success');
        window.location.href = 'dashboard.html';
      } else {
        // Confirmation email sent
        setFormMessage(
          'reg-msg',
          `Account created! A confirmation email has been sent to ${email}. Please check your inbox and verify your email to log in.`,
          'info'
        );
        form.reset();
      }
    }
  });
}

/* ============================================================
   FORGOT PASSWORD PAGE
   ============================================================ */

function initForgotPassword() {
  const form = document.getElementById('forgot-form');
  if (!form) return;

  renderSupabaseStatusBadge();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearAllErrors('forgot-email');

    const email = document.getElementById('forgot-email').value.trim();
    let valid = true;

    if (!email) {
      showFieldError('forgot-email', 'Email is required.');
      valid = false;
    } else if (!isValidEmail(email)) {
      showFieldError('forgot-email', 'Enter a valid email address.');
      valid = false;
    }
    if (!valid) return;

    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    const { error } = await authSendReset(email);

    btn.disabled = false;
    btn.textContent = 'Send reset link';

    if (error) {
      if (error.needsConfig) {
        setFormMessage('forgot-msg', error.message, 'info');
        openSupabaseSetupModal();
      } else {
        setFormMessage('forgot-msg', error.message, 'error');
      }
    } else {
      setFormMessage(
        'forgot-msg',
        `Password reset instructions have been sent to ${email}. Check your inbox and follow the link.`,
        'info'
      );
    }
  });
}

/* ============================================================
   RESET PASSWORD PAGE
   ============================================================ */

function initResetPassword() {
  const form = document.getElementById('reset-form');
  if (!form) return;

  initPasswordToggles();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearAllErrors('reset-password', 'reset-confirm');

    const password = document.getElementById('reset-password').value;
    const confirm = document.getElementById('reset-confirm').value;
    let valid = true;

    if (!password) {
      showFieldError('reset-password', 'Password is required.');
      valid = false;
    } else if (password.length < 8) {
      showFieldError('reset-password', 'Password must be at least 8 characters.');
      valid = false;
    }
    if (!confirm) {
      showFieldError('reset-confirm', 'Please confirm your password.');
      valid = false;
    } else if (password && confirm !== password) {
      showFieldError('reset-confirm', 'Passwords do not match.');
      valid = false;
    }
    if (!valid) return;

    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const { error } = await authUpdatePassword(password);

    btn.disabled = false;
    btn.textContent = 'Save new password';

    if (error) {
      setFormMessage('reset-msg', error.message, 'error');
    } else {
      showToast('Password updated successfully! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
    }
  });
}

/* ============================================================
   AUTHENTICATION GUARD FOR PROTECTED PAGES
   ============================================================ */

async function checkAuthGuard() {
  const rawPage = window.location.pathname.split('/').pop() || 'index.html';
  // Normalise: strip .html so both "login.html" and "login" (clean-URL servers) match
  const page = rawPage.replace(/\.html$/, '') || 'index';
  const publicPages = ['login', 'register', 'forgot-password', 'reset-password', 'index', ''];

  if (isPreviewMode()) {
    return;
  }

  if (isSupabaseConfigured() && window.supabaseClient) {
    try {
      const { data: { session } } = await window.supabaseClient.auth.getSession();

      if (!session && !publicPages.includes(page)) {
        window.location.replace('login.html');
        return;
      }

      if (session && (page === 'login' || page === 'register')) {
        window.location.replace('dashboard.html');
        return;
      }
    } catch (e) {
      console.warn('Auth guard check error:', e);
    }
  }
}

/* ============================================================
   INIT – detect current page and call the right setup
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const rawPage = window.location.pathname.split('/').pop() || '';
  const page = rawPage.replace(/\.html$/, '') || 'index';

  if (page === 'login' || page === 'index') {
    initLogin();
  } else if (page === 'register') {
    initRegister();
  } else if (page === 'forgot-password') {
    initForgotPassword();
  } else if (page === 'reset-password') {
    initResetPassword();
  }

  // Live error clearing as user types
  document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(input => {
    input.addEventListener('input', () => clearFieldError(input.id));
  });

  // Run auth guard
  checkAuthGuard();
});
