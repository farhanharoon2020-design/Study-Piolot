/**
 * courses.js
 * My Courses page logic.
 *
 * Features:
 * - List all courses with search
 * - Add course modal
 * - Edit course modal (same form)
 * - Delete course with confirmation (warns about cascading removal)
 */

/* ============================================================
   STATE
   ============================================================ */
let editingCourseId = null; // null = adding, string = editing

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initCoursesPage();
});

function initCoursesPage() {
  renderCoursesList();

  // Open modal buttons
  document.getElementById('add-course-btn')?.addEventListener('click', openAddCourseModal);
  document.getElementById('add-first-course-btn')?.addEventListener('click', openAddCourseModal);

  // Modal buttons
  document.getElementById('course-modal-close')?.addEventListener('click', () => closeModal('course-modal'));
  document.getElementById('course-cancel-btn')?.addEventListener('click',  () => closeModal('course-modal'));
  document.getElementById('course-form')?.addEventListener('submit', handleCourseFormSubmit);

  // Search
  document.getElementById('courses-search')?.addEventListener('input', handleSearch);

  // Live error clearing in form
  document.querySelectorAll('#course-form .form-input, #course-form .form-select').forEach(el => {
    el.addEventListener('input', () => {
      el.classList.remove('error');
      const errEl = document.getElementById(`${el.id}-error`);
      if (errEl) errEl.textContent = '';
    });
  });
}

/* ============================================================
   RENDER
   ============================================================ */

function renderCoursesList(filter = '') {
  let courses = getCourses();

  if (filter) {
    const q = filter.toLowerCase();
    courses = courses.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q))
    );
  }

  const emptyState    = document.getElementById('courses-empty');
  const emptySearch   = document.getElementById('courses-empty-search');
  const grid          = document.getElementById('courses-grid');
  const searchWrapper = document.getElementById('courses-search-wrapper');

  const total = getCourses().length;

  // Show/hide search bar
  if (searchWrapper) {
    searchWrapper.style.display = total > 0 ? 'flex' : 'none';
  }

  if (!grid) return;
  grid.innerHTML = '';

  if (total === 0) {
    if (emptyState)  emptyState.style.display  = 'flex';
    if (emptySearch) emptySearch.style.display = 'none';
    grid.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  if (courses.length === 0 && filter) {
    // No results for search
    if (emptySearch) emptySearch.style.display = 'flex';
    grid.style.display = 'none';
    return;
  }

  if (emptySearch) emptySearch.style.display = 'none';
  grid.style.display = 'grid';

  courses.forEach(course => {
    grid.appendChild(buildCourseCard(course));
  });
}

function buildCourseCard(course) {
  const card = document.createElement('div');
  card.className = 'course-card';

  // Header row: title + actions
  const header = document.createElement('div');
  header.className = 'course-card-header';

  const info = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'course-card-title';
  title.textContent = course.name;
  info.appendChild(title);

  if (course.code) {
    const code = document.createElement('div');
    code.className = 'course-card-code';
    code.textContent = course.code;
    info.appendChild(code);
  }

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'course-card-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-ghost btn-icon';
  editBtn.setAttribute('aria-label', `Edit ${course.name}`);
  editBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  editBtn.addEventListener('click', e => { e.stopPropagation(); openEditCourseModal(course); });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-ghost btn-icon';
  deleteBtn.setAttribute('aria-label', `Delete ${course.name}`);
  deleteBtn.style.color = 'var(--danger)';
  deleteBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  deleteBtn.addEventListener('click', e => { e.stopPropagation(); confirmDeleteCourse(course); });

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  header.appendChild(info);
  header.appendChild(actions);
  card.appendChild(header);

  // Badges
  const badges = document.createElement('div');
  badges.className = 'course-card-badges';
  badges.appendChild(buildBadge(course.priority, 'priority'));
  badges.appendChild(buildBadge(course.difficulty, 'difficulty'));
  card.appendChild(badges);

  // Exam date
  if (course.examDate) {
    const meta = document.createElement('div');
    meta.className = 'course-card-meta';
    meta.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const span = document.createElement('span');
    span.textContent = `Exam: ${formatDate(course.examDate)}`;
    meta.appendChild(span);
    card.appendChild(meta);
  }

  // Open link
  const footer = document.createElement('div');
  footer.className = 'course-card-footer';
  const link = document.createElement('a');
  link.href = `course-details.html?id=${course.id}`;
  link.className = 'course-card-link';
  link.setAttribute('aria-label', `Open ${course.name}`);
  link.innerHTML = `Open course <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
  footer.appendChild(link);
  card.appendChild(footer);

  return card;
}

function buildBadge(value, type) {
  const badge = document.createElement('span');
  const pMap  = { low: 'badge-low', medium: 'badge-medium', high: 'badge-high' };
  const dMap  = { easy: 'badge-easy', medium: 'badge-medium', hard: 'badge-hard' };
  const map   = type === 'priority' ? pMap : dMap;
  badge.className = `badge ${map[value] || 'badge-medium'}`;
  badge.textContent = type === 'priority'
    ? `${capitalise(value)} priority`
    : `${capitalise(value)} difficulty`;
  return badge;
}

function capitalise(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

/* ============================================================
   ADD / EDIT MODAL
   ============================================================ */

function openAddCourseModal() {
  editingCourseId = null;
  resetCourseForm();
  document.getElementById('course-modal-title').textContent  = 'Add course';
  document.getElementById('course-modal-sub').textContent    = 'Set up your course in a few simple steps.';
  document.getElementById('course-submit-btn').textContent   = 'Create course';
  openModal('course-modal');
}

function openEditCourseModal(course) {
  editingCourseId = course.id;
  resetCourseForm();

  document.getElementById('course-modal-title').textContent  = 'Edit course';
  document.getElementById('course-modal-sub').textContent    = 'Update your course details.';
  document.getElementById('course-submit-btn').textContent   = 'Save changes';

  // Populate fields
  document.getElementById('course-name').value       = course.name;
  document.getElementById('course-code').value       = course.code || '';
  document.getElementById('course-exam-date').value  = course.examDate || '';
  document.getElementById('course-priority').value   = course.priority || 'medium';
  document.getElementById('course-difficulty').value = course.difficulty || 'medium';

  openModal('course-modal');
}

function resetCourseForm() {
  const form = document.getElementById('course-form');
  if (!form) return;
  form.reset();
  // Clear errors
  ['course-name', 'course-code', 'course-exam-date', 'course-priority', 'course-difficulty'].forEach(id => {
    const el    = document.getElementById(id);
    const errEl = document.getElementById(`${id}-error`);
    if (el)    el.classList.remove('error');
    if (errEl) errEl.textContent = '';
  });
}

function handleCourseFormSubmit(e) {
  e.preventDefault();

  const name       = document.getElementById('course-name').value.trim();
  const code       = document.getElementById('course-code').value.trim();
  const examDate   = document.getElementById('course-exam-date').value;
  const priority   = document.getElementById('course-priority').value;
  const difficulty = document.getElementById('course-difficulty').value;

  // Validate
  let valid = true;
  const nameErr = document.getElementById('course-name-error');
  if (!name) {
    document.getElementById('course-name').classList.add('error');
    if (nameErr) nameErr.textContent = 'Course name is required.';
    valid = false;
  }

  if (!valid) return;

  if (editingCourseId) {
    updateCourse(editingCourseId, { name, code, examDate, priority, difficulty });
    showToast('Course updated successfully.', 'success');
  } else {
    createCourse({ name, code, examDate, priority, difficulty });
    showToast('Course created!', 'success');
  }

  closeModal('course-modal');
  renderCoursesList(document.getElementById('courses-search')?.value || '');
}

/* ============================================================
   DELETE
   ============================================================ */

function confirmDeleteCourse(course) {
  showConfirm(
    'Delete this course?',
    `This will permanently remove "${course.name}" along with its syllabus, study materials and topics.`,
    'Delete course',
    async () => {
      await deleteCourse(course.id);
      showToast(`"${course.name}" was deleted.`, 'info');
      renderCoursesList(document.getElementById('courses-search')?.value || '');
    },
    'danger'
  );
}

/* ============================================================
   SEARCH
   ============================================================ */

function handleSearch(e) {
  renderCoursesList(e.target.value);
}
