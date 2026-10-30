/**
 * course-details.js
 * Course Details page with three tabs: Syllabus, Study Materials, Topics.
 *
 * URL format: course-details.html?id=COURSE_ID&tab=syllabus|materials|topics
 *
 * Tab state is kept in the URL query parameter so refreshing preserves it.
 */

/* ============================================================
   STATE
   ============================================================ */
let courseId   = null;
let activeCourse = null;

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Parse URL
  const params = new URLSearchParams(window.location.search);
  courseId = params.get('id');

  if (!courseId) {
    showError('No course ID provided.');
    return;
  }

  activeCourse = getCourse(courseId);
  if (!activeCourse) {
    showError('Course not found. It may have been deleted.');
    return;
  }

  renderCourseHeader();
  initTabs(params.get('tab') || 'syllabus');

  // Edit course button
  document.getElementById('edit-course-btn')?.addEventListener('click', openEditModal);
  document.getElementById('course-edit-modal-close')?.addEventListener('click', () => closeModal('course-edit-modal'));
  document.getElementById('course-edit-cancel')?.addEventListener('click',      () => closeModal('course-edit-modal'));
  document.getElementById('course-edit-form')?.addEventListener('submit', handleEditSubmit);
});

/* ============================================================
   ERROR STATE
   ============================================================ */
function showError(msg) {
  const main = document.getElementById('course-main');
  if (!main) return;
  main.innerHTML = `
    <div class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <h2>Course not found</h2>
      <p>${escapeHtml(msg)}</p>
      <a href="courses.html" class="btn btn-primary mt-16">Back to My Courses</a>
    </div>
  `;
}

/* ============================================================
   HEADER
   ============================================================ */
function renderCourseHeader() {
  const nameEl = document.getElementById('course-detail-name');
  const codeEl = document.getElementById('course-detail-code');
  const pillsEl = document.getElementById('course-meta-pills');

  if (nameEl) nameEl.textContent = activeCourse.name;
  if (codeEl) {
    codeEl.textContent = activeCourse.code || '';
    codeEl.style.display = activeCourse.code ? '' : 'none';
  }

  // Set breadcrumb
  const bcCourse = document.getElementById('bc-course-name');
  if (bcCourse) bcCourse.textContent = activeCourse.name;

  // Set page title
  document.title = `${activeCourse.name} – StudyPilot`;

  if (pillsEl) {
    pillsEl.innerHTML = '';
    const pMap = { low: 'badge-low', medium: 'badge-medium', high: 'badge-high' };
    const dMap = { easy: 'badge-easy', medium: 'badge-medium', hard: 'badge-hard' };

    const pPill = makePill(`Priority: ${capitalise(activeCourse.priority)}`, pMap[activeCourse.priority]);
    const dPill = makePill(`Difficulty: ${capitalise(activeCourse.difficulty)}`, dMap[activeCourse.difficulty]);
    pillsEl.appendChild(pPill);
    pillsEl.appendChild(dPill);

    if (activeCourse.examDate) {
      const ePill = document.createElement('div');
      ePill.className = 'meta-pill';
      ePill.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
      const span = document.createElement('span');
      span.textContent = `Exam: ${formatDate(activeCourse.examDate)}`;
      ePill.appendChild(span);
      pillsEl.appendChild(ePill);
    }
  }
}

function makePill(text, badgeClass) {
  const pill = document.createElement('div');
  pill.className = 'meta-pill';
  const badge = document.createElement('span');
  badge.className = `badge ${badgeClass}`;
  badge.textContent = text;
  pill.appendChild(badge);
  return pill;
}

function capitalise(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

/* ============================================================
   TABS
   ============================================================ */
function initTabs(activeTab) {
  const validTabs = ['syllabus', 'materials', 'topics', 'ai'];
  const tab = validTabs.includes(activeTab) ? activeTab : 'syllabus';

  document.querySelectorAll('.tab-btn').forEach(btn => {
    const t = btn.getAttribute('data-tab');
    btn.classList.toggle('active', t === tab);
    btn.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });

  showTab(tab);
}

function switchTab(tab) {
  // Update URL without page reload
  const url = new URL(window.location);
  url.searchParams.set('tab', tab);
  window.history.replaceState({}, '', url);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    const t = btn.getAttribute('data-tab');
    btn.classList.toggle('active', t === tab);
    btn.setAttribute('aria-selected', t === tab ? 'true' : 'false');
  });

  showTab(tab);
}

function showTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.hidden = panel.id !== `tab-${tab}`;
  });

  if (tab === 'syllabus')   initSyllabusTab();
  if (tab === 'materials')  initMaterialsTab();
  if (tab === 'topics')     initTopicsTab();
  if (tab === 'ai')         initCourseAiTab();
}

function initCourseAiTab() {
  const pillsContainer = document.getElementById('course-ai-topics-pills');
  const notesContainer = document.getElementById('course-ai-saved-notes');
  if (!courseId) return;

  const topics = getCourseTopics(courseId);
  if (pillsContainer) {
    pillsContainer.innerHTML = '';
    if (topics.length === 0) {
      pillsContainer.innerHTML = '<span class="text-xs text-secondary">No topics defined yet. Go to Topics tab or Syllabus to add topics.</span>';
    } else {
      topics.forEach(t => {
        const wrap = document.createElement('div');
        wrap.className = 'card flex items-center justify-between gap-12';
        wrap.style.padding = '10px 14px';
        wrap.innerHTML = `
          <strong style="font-size:13.5px; color:#1E1B4B;">${escapeHtml(t.name)}</strong>
          <div class="flex items-center gap-6">
            <a href="ai-lab.html?courseId=${encodeURIComponent(courseId)}&topic=${encodeURIComponent(t.name)}&mode=notes" class="btn btn-ghost btn-sm" style="color:#7548FF; font-size:12px; padding:4px 8px;">
              📝 Notes
            </a>
            <a href="ai-lab.html?courseId=${encodeURIComponent(courseId)}&topic=${encodeURIComponent(t.name)}&mode=quiz" class="btn btn-ghost btn-sm" style="color:#9333EA; font-size:12px; padding:4px 8px;">
              🎯 Quiz
            </a>
          </div>
        `;
        pillsContainer.appendChild(wrap);
      });
    }
  }

  if (notesContainer) {
    const savedNotes = typeof getSavedNotes === 'function' ? getSavedNotes(courseId) : [];
    notesContainer.innerHTML = '';
    if (savedNotes.length === 0) {
      notesContainer.innerHTML = `
        <div class="card" style="text-align:center; padding:24px; color:var(--text-secondary); font-size:13px;">
          No saved AI notes for this course yet. Click "Generate Notes" above to get started!
        </div>
      `;
    } else {
      savedNotes.forEach(n => {
        const row = document.createElement('div');
        row.className = 'card flex items-center justify-between gap-12';
        row.style.padding = '12px 16px';
        const dateStr = n.createdAt ? new Date(n.createdAt).toLocaleDateString() : '';
        row.innerHTML = `
          <div>
            <strong style="font-size:13.5px; color:#1E1B4B; display:block;">${escapeHtml(n.topicName || n.title)}</strong>
            <span class="text-xs text-secondary">${dateStr}</span>
          </div>
          <a href="ai-lab.html?courseId=${encodeURIComponent(courseId)}&mode=history" class="btn btn-ghost btn-sm" style="font-size:12px;">
            Open in Lab &rarr;
          </a>
        `;
        notesContainer.appendChild(row);
      });
    }
  }
}


/* ============================================================
   EDIT COURSE MODAL (same form as courses.js)
   ============================================================ */
function openEditModal() {
  const c = activeCourse;
  document.getElementById('edit-course-name').value       = c.name;
  document.getElementById('edit-course-code').value       = c.code || '';
  document.getElementById('edit-course-exam-date').value  = c.examDate || '';
  document.getElementById('edit-course-priority').value   = c.priority;
  document.getElementById('edit-course-difficulty').value = c.difficulty;
  openModal('course-edit-modal');
}

function handleEditSubmit(e) {
  e.preventDefault();
  const name       = document.getElementById('edit-course-name').value.trim();
  const code       = document.getElementById('edit-course-code').value.trim();
  const examDate   = document.getElementById('edit-course-exam-date').value;
  const priority   = document.getElementById('edit-course-priority').value;
  const difficulty = document.getElementById('edit-course-difficulty').value;

  const nameErr = document.getElementById('edit-course-name-error');
  if (!name) {
    document.getElementById('edit-course-name').classList.add('error');
    if (nameErr) nameErr.textContent = 'Course name is required.';
    return;
  }

  activeCourse = updateCourse(courseId, { name, code, examDate, priority, difficulty });
  closeModal('course-edit-modal');
  renderCourseHeader();
  showToast('Course updated.', 'success');
}
