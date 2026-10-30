/**
 * dashboard.js
 * Renders the dashboard page.
 *
 * Shows:
 * - Welcome banner
 * - Three onboarding steps (with active/pending state)
 * - My Courses section – empty state or real course cards
 * - How it works panel
 * - Footer guidance banner
 */

document.addEventListener('DOMContentLoaded', () => {
  renderDashboard();
});

function renderDashboard() {
  const courses = getCourses();
  renderOnboardingSteps(courses);
  renderCourseSection(courses);
}

/* ============================================================
   ONBOARDING STEPS
   ============================================================ */

function renderOnboardingSteps(courses) {
  const step1El = document.getElementById('step-1-num');
  const step2El = document.getElementById('step-2-num');
  const step3El = document.getElementById('step-3-num');
  if (!step1El) return;

  const hasCourses = courses.length > 0;
  const hasSyllabus = hasCourses && courses.some(c => getCourseSyllabus(c.id));
  const hasTopics   = hasCourses && courses.some(c => getCourseTopics(c.id).length > 0);

  // Step 1: Add a course
  if (hasCourses) {
    step1El.classList.remove('pending');
  } else {
    step1El.classList.add('pending');
  }

  // Step 2: Upload syllabus
  if (hasSyllabus) {
    step2El.classList.remove('pending');
  } else {
    step2El.classList.add('pending');
  }

  // Step 3: Review topics
  if (hasTopics) {
    step3El.classList.remove('pending');
  } else {
    step3El.classList.add('pending');
  }
}

/* ============================================================
   COURSES SECTION
   ============================================================ */

function renderCourseSection(courses) {
  const emptyState  = document.getElementById('dash-courses-empty');
  const coursesGrid = document.getElementById('dash-courses-grid');
  const sectionTitle = document.getElementById('dash-courses-title');
  if (!emptyState || !coursesGrid) return;

  if (courses.length === 0) {
    emptyState.style.display  = 'flex';
    coursesGrid.style.display = 'none';
  } else {
    emptyState.style.display  = 'none';
    coursesGrid.style.display = 'grid';
    coursesGrid.innerHTML = '';

    // Show up to 4 most recent courses on dashboard
    const recent = [...courses]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 4);

    recent.forEach(course => {
      coursesGrid.appendChild(buildDashCourseCard(course));
    });

    if (courses.length > 4) {
      const more = document.createElement('div');
      more.style.gridColumn = '1/-1';
      more.style.textAlign  = 'center';
      more.style.padding    = '8px 0';
      const link = document.createElement('a');
      link.href = 'courses.html';
      link.textContent = `View all ${courses.length} courses →`;
      link.className = 'text-primary-color font-semibold text-sm';
      more.appendChild(link);
      coursesGrid.appendChild(more);
    }
  }
}

function buildDashCourseCard(course) {
  const card = document.createElement('div');
  card.className = 'course-card';

  // Header
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

  header.appendChild(info);
  card.appendChild(header);

  // Badges
  const badges = document.createElement('div');
  badges.className = 'course-card-badges';

  const pMap = { low: 'badge-low', medium: 'badge-medium', high: 'badge-high' };
  const dMap = { easy: 'badge-easy', medium: 'badge-medium', hard: 'badge-hard' };

  const pBadge = document.createElement('span');
  pBadge.className = `badge ${pMap[course.priority] || 'badge-medium'}`;
  pBadge.textContent = capitalise(course.priority) + ' priority';
  badges.appendChild(pBadge);

  const dBadge = document.createElement('span');
  dBadge.className = `badge ${dMap[course.difficulty] || 'badge-medium'}`;
  dBadge.textContent = capitalise(course.difficulty);
  badges.appendChild(dBadge);

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

  // Link
  const footer = document.createElement('div');
  footer.className = 'course-card-footer';
  const link = document.createElement('a');
  link.href = `course-details.html?id=${course.id}`;
  link.className = 'course-card-link';
  link.innerHTML = `Open course <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
  footer.appendChild(link);
  card.appendChild(footer);

  return card;
}

function capitalise(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
