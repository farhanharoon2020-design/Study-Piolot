/**
 * common.js
 * Shared utilities used across all pages:
 * - Toast notification system
 * - Modal open/close helpers
 * - Sidebar active-state and mobile drawer
 * - Topbar profile link
 * - SVG icon helper
 * - Misc DOM helpers
 */

/* ============================================================
   TOAST SYSTEM
   ============================================================ */

/**
 * Show a toast notification.
 * @param {string} message - The text to display.
 * @param {'success'|'error'|'info'|'warning'} type - Toast variant.
 * @param {number} duration - Auto-dismiss time in ms (default 3500).
 */
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
  }

  const icons = {
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');

  const iconEl = document.createElement('span');
  iconEl.className = 'toast-icon';
  iconEl.innerHTML = icons[type] || icons.info;

  const msgEl = document.createElement('span');
  msgEl.className = 'toast-message';
  msgEl.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');
  closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  toast.appendChild(iconEl);
  toast.appendChild(msgEl);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  function dismiss() {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }

  closeBtn.addEventListener('click', dismiss);
  if (duration > 0) setTimeout(dismiss, duration);
}

/* ============================================================
   MODAL HELPERS
   ============================================================ */

/**
 * Open a modal by its backdrop ID.
 * Traps focus inside; closes on Escape or backdrop click.
 */
function openModal(backdropId) {
  const backdrop = document.getElementById(backdropId);
  if (!backdrop) return;

  backdrop.classList.add('open');
  backdrop.removeAttribute('hidden');

  // Focus first focusable element
  const focusable = backdrop.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length) focusable[0].focus();

  // Close on backdrop click (not modal content click)
  backdrop.addEventListener('click', function onBdClick(e) {
    if (e.target === backdrop) {
      closeModal(backdropId);
      backdrop.removeEventListener('click', onBdClick);
    }
  });

  // Close on Escape
  function onEsc(e) {
    if (e.key === 'Escape') {
      closeModal(backdropId);
      document.removeEventListener('keydown', onEsc);
    }
  }
  document.addEventListener('keydown', onEsc);

  // Store opener element to restore focus
  backdrop._opener = document.activeElement;
}

/**
 * Close a modal by its backdrop ID.
 */
function closeModal(backdropId) {
  const backdrop = document.getElementById(backdropId);
  if (!backdrop) return;
  backdrop.classList.remove('open');

  // Restore focus to opener
  if (backdrop._opener && typeof backdrop._opener.focus === 'function') {
    backdrop._opener.focus();
  }
}

/* ============================================================
   SIDEBAR ACTIVE STATE
   ============================================================ */

/**
 * Highlight the correct sidebar link based on current page filename.
 * Each sidebar link should have data-page="filename.html".
 */
function setSidebarActive() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const page = link.getAttribute('data-page');
    if (!page) return;
    const pages = page.split(',').map(p => p.trim());
    if (pages.some(p => currentPage === p || currentPage.startsWith(p.replace('.html', '')))) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    }
  });
}

/* ============================================================
   MOBILE SIDEBAR DRAWER
   ============================================================ */

function initMobileSidebar() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar  = document.querySelector('.sidebar');
  const overlay  = document.getElementById('sidebar-overlay');

  if (!menuBtn || !sidebar) return;

  function openSidebar() {
    sidebar.classList.add('open');
    if (overlay) overlay.classList.add('open');
    menuBtn.setAttribute('aria-expanded', 'true');
    // Focus first link
    const firstLink = sidebar.querySelector('.sidebar-link');
    if (firstLink) firstLink.focus();
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.focus();
  }

  menuBtn.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) closeSidebar();
    else openSidebar();
  });

  if (overlay) overlay.addEventListener('click', closeSidebar);

  // Close sidebar on Escape when open
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
  });
}

/* ============================================================
   CONFIRM DIALOG (simple modal-based)
   ============================================================ */

/**
 * Show a simple confirmation dialog.
 * @param {string} title
 * @param {string} message
 * @param {string} confirmLabel - Label for the confirm button.
 * @param {Function} onConfirm - Called if user confirms.
 * @param {'danger'|'primary'} variant
 */
function showConfirm(title, message, confirmLabel, onConfirm, variant = 'danger') {
  // Remove any existing confirm dialog
  const existing = document.getElementById('confirm-modal-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'confirm-modal-backdrop';
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'confirm-modal-title');

  backdrop.innerHTML = `
    <div class="modal" style="max-width:400px">
      <div class="modal-header">
        <div>
          <h2 id="confirm-modal-title">${escapeHtml(title)}</h2>
          <p>${escapeHtml(message)}</p>
        </div>
        <button class="modal-close" id="confirm-close-btn" aria-label="Cancel">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="confirm-cancel-btn">Cancel</button>
        <button class="btn btn-${variant}" id="confirm-ok-btn">${escapeHtml(confirmLabel)}</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));

  function closeConfirm() {
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 220);
  }

  backdrop.querySelector('#confirm-close-btn').addEventListener('click', closeConfirm);
  backdrop.querySelector('#confirm-cancel-btn').addEventListener('click', closeConfirm);
  backdrop.querySelector('#confirm-ok-btn').addEventListener('click', () => {
    closeConfirm();
    onConfirm();
  });

  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeConfirm(); });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { closeConfirm(); document.removeEventListener('keydown', onEsc); }
  });

  // Focus confirm button
  setTimeout(() => backdrop.querySelector('#confirm-ok-btn').focus(), 50);
}

/* ============================================================
   DOM HELPERS
   ============================================================ */

/**
 * Safely escape HTML to prevent XSS when inserting text into HTML contexts.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format bytes to human-readable size string.
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Format a date string to a readable format.
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

/**
 * Get file extension from filename.
 */
function getFileExt(filename) {
  return filename.split('.').pop().toLowerCase();
}

/**
 * Return an SVG icon string for a given file extension.
 */
function getFileIcon(filename) {
  const ext = getFileExt(filename);
  const pdfExts   = ['pdf'];
  const imgExts   = ['jpg','jpeg','png','gif','webp','svg','bmp'];
  const wordExts  = ['doc','docx'];
  const slideExts = ['ppt','pptx'];
  const sheetExts = ['xls','xlsx','csv'];
  const textExts  = ['txt','md','rtf'];

  if (pdfExts.includes(ext))   return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
  if (imgExts.includes(ext))   return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  if (wordExts.includes(ext))  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
  if (slideExts.includes(ext)) return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
  if (sheetExts.includes(ext)) return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>`;
  if (textExts.includes(ext))  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="12" y1="9" x2="8" y2="9"/></svg>`;
  // generic file
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
}

/**
 * Generate a UUID v4.
 */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Toggle password field visibility.
 * @param {HTMLInputElement} input
 * @param {HTMLButtonElement} btn
 */
function togglePasswordVisibility(input, btn) {
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  btn.setAttribute('aria-label', isText ? 'Show password' : 'Hide password');
  btn.innerHTML = isText
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}

/* ============================================================
   INIT ON EVERY PAGE
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  setSidebarActive();
  initMobileSidebar();
});
