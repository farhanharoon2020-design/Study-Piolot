/**
 * ai-lab.js
 * Controller for AI Study Lab:
 * - Generates notes via Gemini AI
 * - Formats markdown into clean structured HTML
 * - Interactive Mock Quiz runner with instant feedback and explanations
 * - Scorecards and saved notes management
 * - Shows server AI configuration status
 */

let activeCourses = [];
let currentNote = null;
let currentQuiz = null;

// Quiz Runner State
let quizState = {
  active: false,
  questions: [],
  currentIndex: 0,
  score: 0,
  selectedAnswers: {}, // questionId -> optionIndex
  revealed: {},        // questionId -> true
  startTime: null,
};

/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  setSidebarActive();
  updateGeminiStatusBadge();

  // Wait for cloud materials before building file selectors.
  if (!isPreviewMode()) await syncFromSupabase();
  activeCourses = getCourses();
  populateCourseDropdowns();

  // Tab switching
  setupTabs();

  // Setup Key Modal
  setupKeyModal();

  // Setup Notes Generators
  setupNotesTab();

  // Setup Quiz Arena
  setupQuizTab();

  // Setup History Tab
  setupHistoryTab();

  // Parse URL query params (e.g. ?courseId=xxx&topic=yyy&mode=notes|quiz)
  handleQueryParams();
});

/* ============================================================
   STATUS BADGE & API KEY MODAL
   ============================================================ */

async function updateGeminiStatusBadge() {
  const dot = document.getElementById('header-status-dot');
  const label = document.getElementById('header-status-text');
  const detail = document.getElementById('gemini-setup-status');
  const button = document.getElementById('gemini-test-btn');
  if (label) label.textContent = 'Checking AI setup...';
  if (detail) detail.textContent = 'Checking Gemini API access...';
  if (button) { button.disabled = true; button.textContent = 'Checking...'; }
  const result = await aiService.testGeminiConnection();
  if (dot) {
    dot.classList.toggle('demo', !result.success);
    dot.style.background = result.success ? '#10B981' : '#F59E0B';
  }
  if (label) label.textContent = result.success ? 'Gemini configured' : 'AI setup needed';
  if (detail) detail.textContent = result.message;
  if (button) { button.disabled = false; button.textContent = 'Check Setup'; }
}
function setupKeyModal() {
  const modalId = 'gemini-key-modal-backdrop';
  ['api-key-header-btn', 'configure-gemini-btn'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => openModal(modalId));
  });
  document.getElementById('gemini-modal-close')?.addEventListener('click', () => closeModal(modalId));
  document.getElementById('gemini-test-btn')?.addEventListener('click', updateGeminiStatusBadge);
}
function populateMaterialSelect(mode, selectedId = '') {
  const select = document.getElementById(`${mode}-material-select`);
  const courseId = document.getElementById(`${mode}-course-select`)?.value;
  if (!select) return;
  select.innerHTML = '<option value="">-- Choose an uploaded PDF --</option>';
  const materials = courseId ? getCourseMaterials(courseId) : [];
  materials.forEach(material => {
    const option = document.createElement('option');
    option.value = material.id;
    const supported = /\.pdf$/i.test(material.name) && material.size <= 10 * 1024 * 1024 && material.storagePath;
    option.disabled = !supported;
    option.textContent = material.name + (supported ? '' : ' (needs a synced PDF, max 10 MB)');
    select.appendChild(option);
  });
  if (selectedId) select.value = selectedId;
  else {
    const available = Array.from(select.options).filter(o => o.value && !o.disabled);
    if (available.length === 1) select.value = available[0].value;
  }
}

/* ============================================================
   TABS MANAGEMENT
   ============================================================ */

function setupTabs() {
  const tabs = document.querySelectorAll('.tab-bar .tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      activateTab(target);
    });
  });
}

function activateTab(tabName) {
  document.querySelectorAll('.tab-bar .tab-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-tab') === tabName;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', isTarget);
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.style.display = 'none';
  });

  const activePanel = document.getElementById(`panel-${tabName}`);
  if (activePanel) {
    activePanel.style.display = 'block';
  }

  if (tabName === 'history') {
    renderHistory();
  }
}

/* ============================================================
   COURSES & TOPICS POPULATION
   ============================================================ */

function populateCourseDropdowns() {
  const notesSelect = document.getElementById('notes-course-select');
  const quizSelect = document.getElementById('quiz-course-select');
  const historySelect = document.getElementById('history-course-filter');

  const selects = [notesSelect, quizSelect, historySelect].filter(Boolean);

  selects.forEach(sel => {
    const currentVal = sel.value;
    const isHistory = sel === historySelect;
    sel.innerHTML = isHistory ? '<option value="">All Courses</option>' : '<option value="">-- Choose a course --</option>';

    activeCourses.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.code ? `${c.code} – ${c.name}` : c.name;
      sel.appendChild(opt);
    });

    if (currentVal) sel.value = currentVal;
  });

  // When a course is picked in notes, suggest topics
  notesSelect?.addEventListener('change', () => {
    updateTopicPills(notesSelect.value, 'notes-topic-suggestions', 'notes-topic-input');
    populateMaterialSelect('notes');
  });

  // When a course is picked in quiz, suggest topics
  quizSelect?.addEventListener('change', () => {
    updateTopicPills(quizSelect.value, 'quiz-topic-suggestions', 'quiz-topic-input');
    populateMaterialSelect('quiz');
  });
}

function updateTopicPills(courseId, containerId, inputId) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  if (!container) return;
  container.innerHTML = '';

  if (!courseId) return;

  const topics = getCourseTopics(courseId);
  if (!topics || topics.length === 0) return;

  topics.slice(0, 6).forEach(t => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'badge';
    pill.style.cursor = 'pointer';
    pill.style.background = '#F1F5F9';
    pill.style.border = '1px solid #CBD5E1';
    pill.textContent = t.name;
    pill.addEventListener('click', () => {
      if (input) input.value = t.name;
    });
    container.appendChild(pill);
  });
}

/* ============================================================
   URL QUERY PARAMS HANDLER
   ============================================================ */

function handleQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get('courseId');
  const topic = params.get('topic');
  const mode = params.get('mode'); // 'notes' or 'quiz'

  if (courseId) {
    const notesSelect = document.getElementById('notes-course-select');
    const quizSelect = document.getElementById('quiz-course-select');
    if (notesSelect) {
      notesSelect.value = courseId;
      updateTopicPills(courseId, 'notes-topic-suggestions', 'notes-topic-input');
    }
    if (quizSelect) {
      quizSelect.value = courseId;
      updateTopicPills(courseId, 'quiz-topic-suggestions', 'quiz-topic-input');
    }
  }

  populateMaterialSelect('notes', params.get('materialId') || '');
  populateMaterialSelect('quiz', params.get('materialId') || '');

  if (topic) {
    const notesInput = document.getElementById('notes-topic-input');
    const quizInput = document.getElementById('quiz-topic-input');
    if (notesInput) notesInput.value = topic;
    if (quizInput) quizInput.value = topic;
  }

  if (mode === 'quiz') {
    activateTab('quiz');
  } else if (mode === 'history') {
    activateTab('history');
  } else {
    activateTab('notes');
  }
}

/* ============================================================
   NOTES TAB LOGIC
   ============================================================ */

function setupNotesTab() {
  const genBtn = document.getElementById('generate-notes-btn');
  const emptyState = document.getElementById('notes-empty-state');
  const loadingState = document.getElementById('notes-loading-state');
  const resultState = document.getElementById('notes-result-state');
  const viewer = document.getElementById('notes-content-viewer');

  genBtn?.addEventListener('click', async () => {
    const errorMessage = document.getElementById('notes-error-message');
    if (errorMessage) { errorMessage.hidden = true; errorMessage.textContent = ''; }
    const courseId = document.getElementById('notes-course-select')?.value;
    const topic = document.getElementById('notes-topic-input')?.value.trim();
    const style = document.getElementById('notes-style-select')?.value || 'comprehensive';
    const context = document.getElementById('notes-context-input')?.value.trim();

    const materialId = document.getElementById('notes-material-select')?.value || '';
    if (!materialId && !context) {
      showToast('Select an uploaded PDF or paste source text.', 'warning');
      return;
    }

    const courseObj = activeCourses.find(c => c.id === courseId);
    const courseName = courseObj ? courseObj.name : '';

    // Switch views
    emptyState?.classList.add('hidden');
    resultState?.classList.add('hidden');
    loadingState?.classList.remove('hidden');
    genBtn.disabled = true;

    try {
      const res = await aiService.generateStudyNotes({
        courseName,
        topicName: topic,
        syllabusContext: context,
        courseId,
        materialId,
        style
      });

      currentNote = {
        id: res.generationId,
        materialId: res.materialId,
        sourceName: res.sourceName,
        sourceText: context || '',
        courseId: courseId || '',
        courseName: courseName || 'General',
        topicName: topic || 'Core Principles',
        title: `${topic || courseName} Study Notes`,
        style,
        markdown: res.markdown,
        isDemo: res.isDemo,
        createdAt: new Date().toISOString()
      };

      // Render markdown into formatted HTML
      if (viewer) {
        viewer.innerHTML = formatMarkdownToHtml(res.markdown);
      }

      // Update badges
      const badge = document.getElementById('notes-result-badge');
      if (badge) badge.textContent = res.sourceName || courseName || 'Study Notes';

      const demoNotice = document.getElementById('notes-demo-notice');
      if (demoNotice) {
        if (res.isDemo) demoNotice.classList.remove('hidden');
        else demoNotice.classList.add('hidden');
      }

      loadingState?.classList.add('hidden');
      resultState?.classList.remove('hidden');

      showToast(res.cached ? 'Loaded saved AI notes.' : 'Notes generated from your source.', 'success');
    } catch (err) {
      console.error('Note generation error:', err);
      if (errorMessage) { errorMessage.textContent = err.message; errorMessage.hidden = false; }
      loadingState?.classList.add('hidden');
      emptyState?.classList.remove('hidden');
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      genBtn.disabled = false;
    }
  });

  // Copy Markdown
  document.getElementById('copy-notes-btn')?.addEventListener('click', () => {
    if (!currentNote || !currentNote.markdown) return;
    navigator.clipboard.writeText(currentNote.markdown)
      .then(() => showToast('Notes copied to clipboard!', 'success'))
      .catch(() => showToast('Failed to copy to clipboard.', 'error'));
  });

  // Download TXT
  document.getElementById('download-notes-btn')?.addEventListener('click', () => {
    if (!currentNote) return;
    const blob = new Blob([currentNote.markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(currentNote.topicName || 'Notes').replace(/[^a-zA-Z0-9]/g, '_')}_StudyNotes.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('Exported markdown file.', 'success');
  });

  // Save Note to StudyPilot
  document.getElementById('save-notes-btn')?.addEventListener('click', () => {
    if (!currentNote) return;
    saveGeneratedNote(currentNote);
    showToast('Saved to your Study Notes library!', 'success');
  });

  // Jump from Notes to Quiz
  document.getElementById('quiz-from-notes-btn')?.addEventListener('click', () => {
    if (!currentNote) return;
    const quizCourse = document.getElementById('quiz-course-select');
    const quizTopic = document.getElementById('quiz-topic-input');
    if (quizCourse && currentNote.courseId) quizCourse.value = currentNote.courseId;
    populateMaterialSelect('quiz', currentNote.materialId || '');
    const quizSource = document.getElementById('quiz-context-input');
    if (quizSource) quizSource.value = currentNote.sourceText || '';
    if (quizTopic) quizTopic.value = currentNote.topicName;
    activateTab('quiz');
  });
}

/* ============================================================
   QUIZ ARENA LOGIC
   ============================================================ */

function setupQuizTab() {
  const startBtn = document.getElementById('start-quiz-btn');
  const setupScreen = document.getElementById('quiz-setup-screen');
  const loadingScreen = document.getElementById('quiz-loading-screen');
  const runnerScreen = document.getElementById('quiz-runner-screen');
  const resultsScreen = document.getElementById('quiz-results-screen');

  startBtn?.addEventListener('click', async () => {
    const errorMessage = document.getElementById('quiz-error-message');
    if (errorMessage) { errorMessage.hidden = true; errorMessage.textContent = ''; }
    const courseId = document.getElementById('quiz-course-select')?.value;
    const topic = document.getElementById('quiz-topic-input')?.value.trim();
    const count = parseInt(document.getElementById('quiz-count-select')?.value || '5', 10);
    const difficulty = document.getElementById('quiz-difficulty-select')?.value || 'medium';

    const materialId = document.getElementById('quiz-material-select')?.value || '';
    const context = document.getElementById('quiz-context-input')?.value.trim() || '';
    if (!materialId && !context) {
      showToast('Select an uploaded PDF or paste source text.', 'warning');
      return;
    }

    const courseObj = activeCourses.find(c => c.id === courseId);
    const courseName = courseObj ? courseObj.name : '';

    if (startBtn.disabled) return;
    startBtn.disabled = true;
    setupScreen?.classList.add('hidden');
    resultsScreen?.classList.add('hidden');
    loadingScreen?.classList.remove('hidden');

    try {
      const res = await aiService.generateMockQuiz({
        courseName,
        topicName: topic,
        count,
        difficulty,
        courseId,
        materialId,
        syllabusContext: context
      });

      currentQuiz = {
        id: res.generationId,
        materialId: res.materialId,
        sourceName: res.sourceName,
        sourceText: context,
        courseId: courseId || '',
        courseName: courseName || 'General',
        topicName: topic || 'All Topics',
        difficulty,
        questions: res.questions,
        isDemo: res.isDemo,
        createdAt: new Date().toISOString()
      };

      // Reset runner state
      quizState = {
        active: true,
        questions: res.questions,
        currentIndex: 0,
        score: 0,
        selectedAnswers: {},
        revealed: {},
        startTime: Date.now()
      };

      loadingScreen?.classList.add('hidden');
      runnerScreen?.classList.remove('hidden');

      renderCurrentQuestion();
      showToast(res.cached ? 'Loaded saved AI quiz.' : 'Quiz generated from your source.', 'success');
    } catch (err) {
      console.error('Quiz generation error:', err);
      if (errorMessage) { errorMessage.textContent = err.message; errorMessage.hidden = false; }
      loadingScreen?.classList.add('hidden');
      setupScreen?.classList.remove('hidden');
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      startBtn.disabled = false;
    }
  });

  // Quit Quiz button
  document.getElementById('quiz-quit-btn')?.addEventListener('click', () => {
    showConfirm(
      'Exit Quiz?',
      'Are you sure you want to exit? Your current progress will not be recorded.',
      'Exit',
      () => {
        runnerScreen?.classList.add('hidden');
        resultsScreen?.classList.add('hidden');
        setupScreen?.classList.remove('hidden');
      },
      'danger'
    );
  });

  // Next Question
  document.getElementById('quiz-next-btn')?.addEventListener('click', () => {
    if (quizState.currentIndex < quizState.questions.length - 1) {
      quizState.currentIndex++;
      renderCurrentQuestion();
    }
  });

  // Finish Quiz
  document.getElementById('quiz-finish-btn')?.addEventListener('click', () => {
    showQuizResults();
  });

  // Hint Toggle
  document.getElementById('quiz-hint-toggle')?.addEventListener('click', () => {
    const hintText = document.getElementById('quiz-hint-text');
    if (hintText) hintText.classList.toggle('hidden');
  });

  // Retake Quiz
  document.getElementById('quiz-retake-btn')?.addEventListener('click', () => {
    if (!currentQuiz) return;
    quizState = {
      active: true,
      questions: currentQuiz.questions,
      currentIndex: 0,
      score: 0,
      selectedAnswers: {},
      revealed: {},
      startTime: Date.now()
    };
    resultsScreen?.classList.add('hidden');
    runnerScreen?.classList.remove('hidden');
    renderCurrentQuestion();
  });

  // Save Scorecard to History
  document.getElementById('quiz-save-score-btn')?.addEventListener('click', () => {
    if (!currentQuiz) return;
    const total = quizState.questions.length;
    const score = quizState.score;
    const percentage = Math.round((score / total) * 100);

    const scorecard = {
      id: 'score_' + Date.now(),
      courseId: currentQuiz.courseId,
      courseName: currentQuiz.courseName,
      topicName: currentQuiz.topicName,
      score,
      total,
      percentage,
      difficulty: currentQuiz.difficulty,
      createdAt: new Date().toISOString()
    };

    saveQuizResult(scorecard);
    showToast('Scorecard saved to your History!', 'success');
  });

  // Recommend Notes for Weak Topics
  document.getElementById('quiz-notes-recommend-btn')?.addEventListener('click', () => {
    if (!currentQuiz) return;
    const notesCourse = document.getElementById('notes-course-select');
    const notesTopic = document.getElementById('notes-topic-input');
    if (notesCourse && currentQuiz.courseId) notesCourse.value = currentQuiz.courseId;
    populateMaterialSelect('notes', currentQuiz.materialId || '');
    const notesSource = document.getElementById('notes-context-input');
    if (notesSource) notesSource.value = currentQuiz.sourceText || '';
    if (notesTopic) notesTopic.value = currentQuiz.topicName;
    activateTab('notes');
  });
}

function renderCurrentQuestion() {
  const q = quizState.questions[quizState.currentIndex];
  if (!q) return;

  const total = quizState.questions.length;
  const currentNum = quizState.currentIndex + 1;

  // Header info
  const courseBadge = document.getElementById('quiz-runner-badge');
  const topicLabel = document.getElementById('quiz-runner-topic');
  if (courseBadge) courseBadge.textContent = currentQuiz?.courseName || 'Quiz';
  if (topicLabel) topicLabel.textContent = [currentQuiz?.topicName, currentQuiz?.sourceName].filter(Boolean).join(' · ');

  // Counters
  const counter = document.getElementById('quiz-question-counter');
  const tracker = document.getElementById('quiz-score-tracker');
  const fill = document.getElementById('quiz-progress-fill');
  if (counter) counter.textContent = `Question ${currentNum} of ${total}`;
  if (tracker) tracker.textContent = `Score: ${quizState.score}`;
  if (fill) fill.style.width = `${(currentNum / total) * 100}%`;

  // Title
  const promptEl = document.getElementById('quiz-question-prompt');
  if (promptEl) promptEl.textContent = q.question;

  // Hint
  const hintBox = document.getElementById('quiz-hint-box');
  const hintText = document.getElementById('quiz-hint-text');
  if (hintBox) {
    if (q.hint) {
      hintBox.classList.remove('hidden');
      if (hintText) {
        hintText.textContent = q.hint;
        hintText.classList.add('hidden'); // hidden until user clicks show hint
      }
    } else {
      hintBox.classList.add('hidden');
    }
  }

  // Explanation Box
  const expBox = document.getElementById('quiz-explanation-box');
  if (expBox) expBox.classList.add('hidden');

  // Next/Finish buttons
  const nextBtn = document.getElementById('quiz-next-btn');
  const finishBtn = document.getElementById('quiz-finish-btn');
  if (nextBtn) nextBtn.style.display = 'none';
  if (finishBtn) finishBtn.style.display = 'none';

  // Options
  const container = document.getElementById('quiz-options-container');
  if (!container) return;
  container.innerHTML = '';

  const isAnswered = quizState.revealed[q.id];
  const userChoice = quizState.selectedAnswers[q.id];

  const letters = ['A', 'B', 'C', 'D', 'E'];

  q.options.forEach((optText, optIdx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quiz-option-btn';

    btn.innerHTML = `
      <span class="quiz-option-letter">${letters[optIdx] || optIdx + 1}</span>
      <span style="flex:1;">${escapeHtml(optText)}</span>
    `;

    if (isAnswered) {
      btn.disabled = true;
      if (optIdx === q.correctIndex) {
        btn.classList.add('correct');
      } else if (optIdx === userChoice) {
        btn.classList.add('incorrect');
      }
    } else {
      btn.addEventListener('click', () => handleOptionSelect(q, optIdx));
    }

    container.appendChild(btn);
  });

  // If already answered, show explanation and navigation
  if (isAnswered) {
    revealExplanation(q, userChoice);
    if (currentNum < total) {
      if (nextBtn) nextBtn.style.display = 'inline-flex';
    } else {
      if (finishBtn) finishBtn.style.display = 'inline-flex';
    }
  }
}

function handleOptionSelect(question, selectedIdx) {
  if (quizState.revealed[question.id]) return;

  quizState.revealed[question.id] = true;
  quizState.selectedAnswers[question.id] = selectedIdx;

  const isCorrect = selectedIdx === question.correctIndex;
  if (isCorrect) {
    quizState.score++;
    const tracker = document.getElementById('quiz-score-tracker');
    if (tracker) tracker.textContent = `Score: ${quizState.score}`;
  }

  // Re-render to show colors and explanation
  renderCurrentQuestion();
}

function revealExplanation(question, selectedIdx) {
  const expBox = document.getElementById('quiz-explanation-box');
  if (!expBox) return;

  const isCorrect = selectedIdx === question.correctIndex;
  expBox.classList.remove('hidden', 'wrong');

  if (isCorrect) {
    expBox.innerHTML = `
      <div class="flex items-center gap-6 mb-4 font-bold" style="color:#15803D;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Correct! Well done.
      </div>
      <div>${escapeHtml(question.explanation)}</div>
    `;
  } else {
    expBox.classList.add('wrong');
    const correctLetter = ['A', 'B', 'C', 'D'][question.correctIndex] || (question.correctIndex + 1);
    expBox.innerHTML = `
      <div class="flex items-center gap-6 mb-4 font-bold" style="color:#B45309;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        Incorrect. The correct answer was option (${correctLetter}).
      </div>
      <div>${escapeHtml(question.explanation)}</div>
    `;
  }
}

function showQuizResults() {
  const runnerScreen = document.getElementById('quiz-runner-screen');
  const resultsScreen = document.getElementById('quiz-results-screen');

  runnerScreen?.classList.add('hidden');
  resultsScreen?.classList.remove('hidden');

  const total = quizState.questions.length;
  const score = quizState.score;
  const percentage = Math.round((score / total) * 100);

  const percentEl = document.getElementById('results-score-percent');
  const fracEl = document.getElementById('results-score-fraction');
  const headlineEl = document.getElementById('results-headline');
  const subtextEl = document.getElementById('results-subtext');

  if (percentEl) percentEl.textContent = `${percentage}%`;
  if (fracEl) fracEl.textContent = `${score} / ${total} Correct`;

  if (percentage >= 80) {
    if (headlineEl) headlineEl.textContent = '🌟 Outstanding Mastery!';
    if (subtextEl) subtextEl.textContent = 'You have thoroughly grasped the core nuances of this topic. Ready for the exam!';
  } else if (percentage >= 60) {
    if (headlineEl) headlineEl.textContent = '📚 Good Job!';
    if (subtextEl) subtextEl.textContent = 'Solid foundational knowledge. Review the missed questions below to close remaining gaps.';
  } else {
    if (headlineEl) headlineEl.textContent = '💪 Needs More Review';
    if (subtextEl) subtextEl.textContent = 'We recommend generating a fresh study note on this topic to reinforce tricky definitions.';
  }

  // Populate breakdown list
  const breakdownList = document.getElementById('results-breakdown-list');
  if (!breakdownList) return;
  breakdownList.innerHTML = '';

  quizState.questions.forEach((q, idx) => {
    const userChoice = quizState.selectedAnswers[q.id];
    const isCorrect = userChoice === q.correctIndex;

    const row = document.createElement('div');
    row.className = 'card';
    row.style.padding = '14px 18px';
    row.style.background = isCorrect ? '#F0FDF4' : '#FEF2F2';
    row.style.borderColor = isCorrect ? '#BBF7D0' : '#FECACA';

    row.innerHTML = `
      <div class="flex items-start justify-between gap-12">
        <div style="flex:1;">
          <div class="flex items-center gap-8 mb-4">
            <span class="badge ${isCorrect ? 'badge-success' : 'badge-danger'}" style="font-size:11px;">
              ${isCorrect ? 'Correct' : 'Missed'}
            </span>
            <span class="text-xs font-semibold text-secondary">Q${idx + 1}</span>
          </div>
          <strong style="font-size:14px; color:#1E1B4B; display:block; margin-bottom:6px;">${escapeHtml(q.question)}</strong>
          <div class="text-xs text-secondary mb-4">
            <strong>Correct Answer:</strong> ${escapeHtml(q.options[q.correctIndex])}
          </div>
          <div class="text-xs" style="color:#475569; border-top:1px dashed #CBD5E1; padding-top:6px; margin-top:6px;">
            <strong>Why:</strong> ${escapeHtml(q.explanation)}
          </div>
        </div>
      </div>
    `;

    breakdownList.appendChild(row);
  });
}

/* ============================================================
   HISTORY TAB LOGIC
   ============================================================ */

function setupHistoryTab() {
  const filter = document.getElementById('history-course-filter');
  filter?.addEventListener('change', () => renderHistory());
}

function renderHistory() {
  const courseFilter = document.getElementById('history-course-filter')?.value || '';

  // Render Saved Notes
  const notesContainer = document.getElementById('history-notes-grid');
  if (notesContainer) {
    const savedNotes = getSavedNotes(courseFilter || null);
    notesContainer.innerHTML = '';

    if (savedNotes.length === 0) {
      notesContainer.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align:center; padding:36px; color:var(--text-secondary);">
          No saved study notes found. Generate notes in the first tab and click "Save Note".
        </div>
      `;
    } else {
      savedNotes.forEach(n => {
        const card = document.createElement('div');
        card.className = 'card flex flex-col justify-between';
        card.style.padding = '18px 20px';

        const dateStr = n.createdAt ? new Date(n.createdAt).toLocaleDateString() : '';

        card.innerHTML = `
          <div>
            <div class="flex items-center justify-between gap-8 mb-8">
              <span class="badge badge-primary" style="font-size:11px;">${escapeHtml(n.courseName || 'General')}</span>
              <span class="text-xs text-secondary">${dateStr}</span>
            </div>
            <h3 style="font-size:15px; margin-bottom:6px; color:#1E1B4B;">${escapeHtml(n.topicName || n.title)}</h3>
            <p class="text-xs text-secondary mb-12" style="display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
              ${escapeHtml(n.markdown.slice(0, 140))}...
            </p>
          </div>
          <div class="flex items-center justify-between gap-8 pt-10" style="border-top:1px solid var(--border);">
            <button class="btn btn-ghost btn-sm view-saved-note-btn">View Note</button>
            <button class="btn btn-ghost btn-sm text-secondary delete-saved-note-btn" title="Delete note">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        `;

        card.querySelector('.view-saved-note-btn')?.addEventListener('click', () => openViewNoteModal(n));
        card.querySelector('.delete-saved-note-btn')?.addEventListener('click', () => {
          showConfirm(
            'Delete Note?',
            `Are you sure you want to delete note "${n.topicName}"?`,
            'Delete',
            () => {
              deleteSavedNote(n.id);
              renderHistory();
              showToast('Note deleted.', 'info');
            },
            'danger'
          );
        });

        notesContainer.appendChild(card);
      });
    }
  }

  // Render Saved Quiz Scores
  const quizzesContainer = document.getElementById('history-quizzes-list');
  if (quizzesContainer) {
    const savedQuizzes = getSavedQuizResults(courseFilter || null);
    quizzesContainer.innerHTML = '';

    if (savedQuizzes.length === 0) {
      quizzesContainer.innerHTML = `
        <div class="card" style="text-align:center; padding:32px; color:var(--text-secondary);">
          No quiz history recorded yet. Complete a quiz and save your scorecard!
        </div>
      `;
    } else {
      savedQuizzes.forEach(q => {
        const row = document.createElement('div');
        row.className = 'card flex items-center justify-between gap-16 flex-wrap';
        row.style.padding = '14px 20px';

        const dateStr = q.createdAt ? new Date(q.createdAt).toLocaleDateString() : '';
        const badgeClass = q.percentage >= 80 ? 'badge-success' : (q.percentage >= 60 ? 'badge-warning' : 'badge-danger');

        row.innerHTML = `
          <div class="flex items-center gap-16">
            <div style="width:46px; height:46px; border-radius:50%; background:#F5F3FF; display:flex; align-items:center; justify-content:center; color:var(--primary); font-weight:800; font-size:14px;">
              ${q.percentage}%
            </div>
            <div>
              <div class="flex items-center gap-8 mb-2">
                <span class="badge badge-primary" style="font-size:11px;">${escapeHtml(q.courseName || 'General')}</span>
                <span class="badge ${badgeClass}" style="font-size:11px;">${q.score} / ${q.total}</span>
              </div>
              <strong style="font-size:14px; color:#1E1B4B;">${escapeHtml(q.topicName || 'Mock Quiz')}</strong>
            </div>
          </div>
          <div class="flex items-center gap-12">
            <span class="text-xs text-secondary">${dateStr}</span>
            <button class="btn btn-ghost btn-sm text-secondary delete-score-btn" title="Delete record">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        `;

        row.querySelector('.delete-score-btn')?.addEventListener('click', () => {
          deleteQuizResult(q.id);
          renderHistory();
          showToast('Quiz scorecard removed.', 'info');
        });

        quizzesContainer.appendChild(row);
      });
    }
  }
}

function openViewNoteModal(note) {
  const modalId = 'view-note-modal-backdrop';
  const title = document.getElementById('view-note-title');
  const body = document.getElementById('view-note-body');
  const copyBtn = document.getElementById('view-note-copy');
  const doneBtn = document.getElementById('view-note-done');
  const closeBtn = document.getElementById('view-note-close');

  if (title) title.textContent = `${note.topicName} — Study Note`;
  if (body) body.innerHTML = formatMarkdownToHtml(note.markdown);

  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(note.markdown)
        .then(() => showToast('Copied note to clipboard!', 'success'))
        .catch(() => showToast('Failed to copy.', 'error'));
    };
  }

  if (doneBtn) doneBtn.onclick = () => closeModal(modalId);
  if (closeBtn) closeBtn.onclick = () => closeModal(modalId);

  openModal(modalId);
}

/* ============================================================
   LIGHTWEIGHT MARKDOWN PARSER
   ============================================================ */

function formatMarkdownToHtml(md) {
  if (!md) return '';

  let html = md;

  // Escape HTML entities to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks: ```lang ... ```
  html = html.replace(/```(?:[a-zA-Z0-9]+)?\n([\s\S]*?)```/g, (match, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Unordered list items: * or -
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  // Clean double ul tags
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr style="border:none; border-top:1px solid #E2E8F0; margin:20px 0;">');

  // Paragraphs for standard lines
  const lines = html.split('\n');
  const wrapped = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<li') || trimmed.startsWith('<pre') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<hr')) {
      return line;
    }
    return `<p>${line}</p>`;
  });

  return wrapped.join('\n');
}
