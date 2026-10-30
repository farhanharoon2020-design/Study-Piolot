/**
 * topics.js
 * Topics tab (within Course Details).
 *
 * Features:
 * - Manual topic add, inline edit (name, difficulty, weightage)
 * - Select with checkboxes
 * - Merge (≥2 selected → choose combined name)
 * - Split (one topic → two or more replacements)
 * - Delete individual topics
 * - Save topics to localStorage
 * - Warn before losing unsaved changes
 *
 * AI generation is stubbed behind aiGenerateTopics() and reports
 * "AI integration is not connected yet."
 */

/* ============================================================
   STATE
   ============================================================ */
let localTopics  = [];    // Working copy – not yet saved
let topicsDirty  = false; // True when there are unsaved changes

/* ============================================================
   AI TOPICS GENERATION
   ============================================================ */
async function aiGenerateTopics(syllabusText) {
  if (typeof window.aiService !== 'undefined' && typeof window.aiService.generateTopicsFromSyllabus === 'function') {
    const courseName = (typeof activeCourse !== 'undefined' && activeCourse?.name) ? activeCourse.name : '';
    return await window.aiService.generateTopicsFromSyllabus(syllabusText, courseName);
  }
  return { error: 'AI service is not loaded.' };
}


/* ============================================================
   INIT (called by course-details.js when Topics tab opens)
   ============================================================ */
function initTopicsTab() {
  if (!courseId) return;
  if (document.getElementById('topics-tab-initialized')) return;
  const guard = document.createElement('span');
  guard.id = 'topics-tab-initialized';
  guard.hidden = true;
  document.getElementById('tab-topics')?.appendChild(guard);

  // Load saved topics into working copy
  localTopics = getCourseTopics(courseId).map(t => ({ ...t }));
  topicsDirty = false;

  // Toolbar buttons
  document.getElementById('topics-add-btn')?.addEventListener('click', addNewTopic);
  document.getElementById('topics-merge-btn')?.addEventListener('click', mergeSelectedTopics);
  document.getElementById('topics-save-btn')?.addEventListener('click', saveTopics);
  document.getElementById('topics-cancel-btn')?.addEventListener('click', cancelTopicChanges);
  document.getElementById('topics-generate-btn')?.addEventListener('click', handleGenerateTopics);

  renderTopicsTable();

  // Warn before navigating away with unsaved changes
  window.addEventListener('beforeunload', e => {
    if (topicsDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

/* ============================================================
   RENDER
   ============================================================ */
function renderTopicsTable() {
  const empty   = document.getElementById('topics-empty');
  const tableWrap = document.getElementById('topics-table-wrap');
  const tbody   = document.getElementById('topics-tbody');
  const toolbar = document.getElementById('topics-toolbar');
  const statusRow = document.getElementById('topics-status-row');
  const mergeBtn = document.getElementById('topics-merge-btn');
  const generateBtn = document.getElementById('topics-generate-btn');

  if (!tbody) return;

  // Enable Generate only if a syllabus exists
  const syllabus = getCourseSyllabus(courseId);
  if (generateBtn) generateBtn.disabled = !syllabus;

  if (localTopics.length === 0) {
    if (empty)   empty.style.display  = 'flex';
    if (tableWrap) tableWrap.style.display = 'none';
    if (toolbar)   toolbar.style.display   = 'none';
    return;
  }

  if (empty)   empty.style.display  = 'none';
  if (tableWrap) tableWrap.style.display = 'block';
  if (toolbar)   toolbar.style.display   = 'flex';

  // Count selected
  const selectedCount = localTopics.filter(t => t._selected).length;
  if (mergeBtn) {
    mergeBtn.disabled = selectedCount < 2;
    mergeBtn.title    = selectedCount < 2 ? 'Select two or more topics to merge.' : '';
  }

  tbody.innerHTML = '';

  localTopics.forEach((topic, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.topicIdx = idx;

    // Checkbox
    const checkTd = document.createElement('td');
    checkTd.style.width = '36px';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!topic._selected;
    cb.setAttribute('aria-label', `Select topic ${topic.name || 'untitled'}`);
    cb.addEventListener('change', () => {
      localTopics[idx]._selected = cb.checked;
      renderTopicsTable();
    });
    checkTd.appendChild(cb);
    tr.appendChild(checkTd);

    // Name (editable inline input)
    const nameTd = document.createElement('td');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'topic-name-input';
    nameInput.value = topic.name;
    nameInput.placeholder = 'Topic name';
    nameInput.setAttribute('aria-label', 'Topic name');
    nameInput.addEventListener('input', () => {
      localTopics[idx].name = nameInput.value;
      topicsDirty = true;
      nameInput.classList.toggle('error', !nameInput.value.trim());
    });
    nameTd.appendChild(nameInput);
    tr.appendChild(nameTd);

    // Difficulty select
    const diffTd = document.createElement('td');
    diffTd.style.width = '130px';
    const diffSel = document.createElement('select');
    diffSel.className = 'topic-diff-select form-select';
    diffSel.setAttribute('aria-label', 'Topic difficulty');
    [['', 'Select'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      diffSel.appendChild(opt);
    });
    diffSel.value = topic.difficulty || '';
    diffSel.addEventListener('change', () => {
      localTopics[idx].difficulty = diffSel.value;
      topicsDirty = true;
    });
    diffTd.appendChild(diffSel);
    tr.appendChild(diffTd);

    // Weightage
    const weightTd = document.createElement('td');
    weightTd.style.width = '110px';
    const wrapDiv = document.createElement('div');
    wrapDiv.style.display = 'flex';
    wrapDiv.style.alignItems = 'center';
    wrapDiv.style.gap = '4px';
    const weightInput = document.createElement('input');
    weightInput.type = 'number';
    weightInput.className = 'topic-weightage-input';
    weightInput.min = '0';
    weightInput.max = '100';
    weightInput.placeholder = '—';
    weightInput.setAttribute('aria-label', 'Estimated weightage (%)');
    if (topic.weightage !== undefined && topic.weightage !== '') {
      weightInput.value = topic.weightage;
    }
    weightInput.addEventListener('input', () => {
      const v = weightInput.value;
      if (v === '') {
        localTopics[idx].weightage = '';
      } else {
        const num = parseFloat(v);
        if (!isNaN(num) && num >= 0 && num <= 100) {
          localTopics[idx].weightage = num;
          weightInput.classList.remove('error');
        } else {
          weightInput.classList.add('error');
        }
      }
      topicsDirty = true;
    });
    const pctLabel = document.createElement('span');
    pctLabel.textContent = '%';
    pctLabel.style.color = 'var(--text-secondary)';
    pctLabel.style.fontSize = '13px';
    wrapDiv.appendChild(weightInput);
    wrapDiv.appendChild(pctLabel);
    weightTd.appendChild(wrapDiv);
    tr.appendChild(weightTd);

    // Actions
    const actionsTd = document.createElement('td');
    actionsTd.style.width = '230px';
    const actDiv = document.createElement('div');
    actDiv.className = 'table-actions';
    actDiv.style.display = 'flex';
    actDiv.style.alignItems = 'center';
    actDiv.style.gap = '4px';

    const aiNotesLink = document.createElement('a');
    aiNotesLink.className = 'btn btn-ghost btn-sm';
    aiNotesLink.href = `ai-lab.html?courseId=${encodeURIComponent(courseId)}&topic=${encodeURIComponent(topic.name || '')}&mode=notes`;
    aiNotesLink.title = 'Generate AI Notes for this topic';
    aiNotesLink.style.color = '#7548FF';
    aiNotesLink.style.padding = '3px 6px';
    aiNotesLink.innerHTML = `<span style="font-size:12px">📝 Notes</span>`;

    const aiQuizLink = document.createElement('a');
    aiQuizLink.className = 'btn btn-ghost btn-sm';
    aiQuizLink.href = `ai-lab.html?courseId=${encodeURIComponent(courseId)}&topic=${encodeURIComponent(topic.name || '')}&mode=quiz`;
    aiQuizLink.title = 'Take AI Mock Quiz on this topic';
    aiQuizLink.style.color = '#9333EA';
    aiQuizLink.style.padding = '3px 6px';
    aiQuizLink.innerHTML = `<span style="font-size:12px">🎯 Quiz</span>`;

    const splitBtn = document.createElement('button');
    splitBtn.className = 'btn btn-ghost btn-sm';
    splitBtn.setAttribute('aria-label', `Split topic ${topic.name || ''}`);
    splitBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="3" x2="12" y2="21"/><polyline points="18 9 12 3 6 9"/><polyline points="18 15 12 21 6 15"/></svg>`;
    splitBtn.title = 'Split topic';
    splitBtn.addEventListener('click', () => splitTopic(idx));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-icon btn-ghost';
    delBtn.setAttribute('aria-label', `Delete topic ${topic.name || ''}`);
    delBtn.style.color = 'var(--danger)';
    delBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
    delBtn.addEventListener('click', () => deleteTopic(idx));

    actDiv.appendChild(aiNotesLink);
    actDiv.appendChild(aiQuizLink);
    actDiv.appendChild(splitBtn);
    actDiv.appendChild(delBtn);
    actionsTd.appendChild(actDiv);
    tr.appendChild(actionsTd);

    tbody.appendChild(tr);
  });
}

/* ============================================================
   ADD TOPIC
   ============================================================ */
function addNewTopic() {
  localTopics.push({
    id:         generateId(),
    name:       '',
    difficulty: '',
    weightage:  '',
    _selected:  false,
  });
  topicsDirty = true;
  renderTopicsTable();

  // Focus the new row's name input
  const tbody = document.getElementById('topics-tbody');
  if (tbody) {
    const lastInput = tbody.querySelectorAll('.topic-name-input');
    if (lastInput.length) lastInput[lastInput.length - 1].focus();
  }
}

/* ============================================================
   DELETE TOPIC
   ============================================================ */
function deleteTopic(idx) {
  const topicName = localTopics[idx]?.name || 'this topic';
  showConfirm(
    'Delete topic?',
    `Remove "${topicName}" from the list? This is not saved until you click "Save topics".`,
    'Delete',
    () => {
      localTopics.splice(idx, 1);
      topicsDirty = true;
      renderTopicsTable();
    },
    'danger'
  );
}

/* ============================================================
   MERGE TOPICS
   ============================================================ */
function mergeSelectedTopics() {
  const selected = localTopics.filter(t => t._selected);
  if (selected.length < 2) {
    showToast('Select at least two topics to merge.', 'warning');
    return;
  }

  // Build merge dialog
  const combinedName = selected.map(t => t.name).join(' + ');
  showMergeDialog(selected, combinedName);
}

function showMergeDialog(selected, suggestedName) {
  const existing = document.getElementById('merge-modal-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'merge-modal-backdrop';
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'merge-modal-title');

  backdrop.innerHTML = `
    <div class="modal" style="max-width:460px">
      <div class="modal-header">
        <div>
          <h2 id="merge-modal-title">Merge topics</h2>
          <p>Combining ${selected.length} selected topics into one.</p>
        </div>
        <button class="modal-close" id="merge-close" aria-label="Cancel">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label" for="merge-name">Combined topic name</label>
          <input id="merge-name" class="form-input" type="text" value="${escapeHtml(suggestedName)}" placeholder="Combined topic name">
          <span id="merge-name-error" class="field-error" style="display:none"></span>
        </div>
        <div class="form-group">
          <label class="form-label" for="merge-difficulty">Difficulty <span class="optional">(optional)</span></label>
          <select id="merge-difficulty" class="form-select">
            <option value="">Select difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="merge-weightage">Estimated weightage % <span class="optional">(optional)</span></label>
          <input id="merge-weightage" class="form-input" type="number" min="0" max="100" placeholder="0–100">
        </div>
        <div class="info-banner" style="font-size:12px">
          These are estimates for planning only — not official exam predictions.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="merge-cancel">Cancel</button>
        <button class="btn btn-primary" id="merge-confirm">Merge topics</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));

  function closeMerge() {
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 220);
  }

  backdrop.querySelector('#merge-close').addEventListener('click', closeMerge);
  backdrop.querySelector('#merge-cancel').addEventListener('click', closeMerge);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeMerge(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { closeMerge(); document.removeEventListener('keydown', esc); }
  });

  backdrop.querySelector('#merge-confirm').addEventListener('click', () => {
    const name = backdrop.querySelector('#merge-name').value.trim();
    const errEl = backdrop.querySelector('#merge-name-error');
    if (!name) {
      backdrop.querySelector('#merge-name').classList.add('error');
      errEl.textContent = 'Topic name is required.';
      errEl.style.display = 'flex';
      return;
    }
    const difficulty = backdrop.querySelector('#merge-difficulty').value;
    const weightageRaw = backdrop.querySelector('#merge-weightage').value;
    const weightage = weightageRaw !== '' ? parseFloat(weightageRaw) : '';

    // Replace selected topics with merged one; remove others
    const merged = {
      id:         generateId(),
      name,
      difficulty,
      weightage,
      _selected:  false,
    };
    // Keep unselected topics, then insert merged at position of first selected
    const firstIdx = localTopics.findIndex(t => t._selected);
    localTopics = localTopics.filter(t => !t._selected);
    localTopics.splice(firstIdx, 0, merged);
    topicsDirty = true;

    closeMerge();
    renderTopicsTable();
    showToast('Topics merged.', 'success');
  });

  setTimeout(() => backdrop.querySelector('#merge-name').focus(), 50);
}

/* ============================================================
   SPLIT TOPIC
   ============================================================ */
function splitTopic(idx) {
  const topic = localTopics[idx];
  if (!topic) return;

  const existing = document.getElementById('split-modal-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'split-modal-backdrop';
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'split-modal-title');

  backdrop.innerHTML = `
    <div class="modal" style="max-width:460px">
      <div class="modal-header">
        <div>
          <h2 id="split-modal-title">Split topic</h2>
          <p>Splitting "${escapeHtml(topic.name || 'topic')}" into two or more topics.</p>
        </div>
        <button class="modal-close" id="split-close" aria-label="Cancel">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div id="split-rows" style="display:flex;flex-direction:column;gap:10px">
          <div class="form-group split-row">
            <label class="form-label">Replacement topic 1</label>
            <input class="form-input split-name" type="text" placeholder="Topic name">
          </div>
          <div class="form-group split-row">
            <label class="form-label">Replacement topic 2</label>
            <input class="form-input split-name" type="text" placeholder="Topic name">
          </div>
        </div>
        <button class="btn btn-ghost btn-sm mt-8" id="split-add-row" style="width:fit-content">+ Add another topic</button>
        <div class="info-banner mt-8" style="font-size:12px">
          Difficulty and weightage can be edited in the table after splitting.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="split-cancel">Cancel</button>
        <button class="btn btn-primary" id="split-confirm">Split topic</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));

  function closeSplit() {
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 220);
  }

  backdrop.querySelector('#split-close').addEventListener('click', closeSplit);
  backdrop.querySelector('#split-cancel').addEventListener('click', closeSplit);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeSplit(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { closeSplit(); document.removeEventListener('keydown', esc); }
  });

  // Add row button
  backdrop.querySelector('#split-add-row').addEventListener('click', () => {
    const rows = backdrop.querySelector('#split-rows');
    const count = rows.querySelectorAll('.split-row').length + 1;
    const div = document.createElement('div');
    div.className = 'form-group split-row';
    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = `Replacement topic ${count}`;
    const input = document.createElement('input');
    input.className = 'form-input split-name';
    input.type = 'text';
    input.placeholder = 'Topic name';
    div.appendChild(label);
    div.appendChild(input);
    rows.appendChild(div);
    input.focus();
  });

  // Confirm
  backdrop.querySelector('#split-confirm').addEventListener('click', () => {
    const names = Array.from(backdrop.querySelectorAll('.split-name'))
      .map(i => i.value.trim())
      .filter(n => n !== '');

    if (names.length < 2) {
      showToast('Please enter at least two replacement topic names.', 'warning');
      return;
    }

    const replacements = names.map(name => ({
      id:         generateId(),
      name,
      difficulty: '',
      weightage:  '',
      _selected:  false,
    }));

    localTopics.splice(idx, 1, ...replacements);
    topicsDirty = true;

    closeSplit();
    renderTopicsTable();
    showToast('Topic split into ' + names.length + ' topics.', 'success');
  });

  setTimeout(() => backdrop.querySelector('.split-name').focus(), 50);
}

/* ============================================================
   SAVE / CANCEL
   ============================================================ */
function saveTopics() {
  // Validate: no blank topic names
  let valid = true;
  localTopics.forEach(t => {
    if (!t.name.trim()) valid = false;
  });

  if (!valid) {
    showToast('Please fill in all topic names before saving.', 'error');
    // Highlight empty ones
    document.querySelectorAll('.topic-name-input').forEach(input => {
      if (!input.value.trim()) input.classList.add('error');
    });
    return;
  }

  // Clean up working state
  const toSave = localTopics.map(({ _selected, ...t }) => t);
  saveCourseTopics(courseId, toSave);
  localTopics  = toSave.map(t => ({ ...t }));
  topicsDirty  = false;

  showStatus('topics-status-saved', 2000);
  showToast('Topics saved.', 'success');
  renderTopicsTable();
}

function cancelTopicChanges() {
  if (topicsDirty) {
    showConfirm(
      'Discard changes?',
      'Your unsaved topic changes will be lost.',
      'Discard',
      () => {
        localTopics = getCourseTopics(courseId).map(t => ({ ...t }));
        topicsDirty = false;
        renderTopicsTable();
      },
      'danger'
    );
  } else {
    localTopics = getCourseTopics(courseId).map(t => ({ ...t }));
    renderTopicsTable();
  }
}

/* ============================================================
   AI GENERATE (STUB)
   ============================================================ */
async function handleGenerateTopics() {
  // Warn if topics already exist
  if (localTopics.length > 0 || getCourseTopics(courseId).length > 0) {
    showConfirm(
      'Replace existing topics?',
      'Generating new topics will replace your current topic list. Any unsaved changes will also be lost.',
      'Continue',
      () => attemptGenerateTopics(),
      'danger'
    );
  } else {
    attemptGenerateTopics();
  }
}

async function attemptGenerateTopics() {
  showStatus('topics-status-loading', 0);
  hideStatus('topics-status-error');
  hideStatus('topics-status-saved');

  const syllabus = getCourseSyllabus(courseId);
  const text = syllabus?.type === 'text' ? syllabus.text : null;

  const res = await aiGenerateTopics(text);

  hideStatus('topics-status-loading');

  if (res && res.success && res.topics && res.topics.length > 0) {
    localTopics = res.topics.map(t => ({ ...t }));
    topicsDirty = true;
    renderTopicsTable();
    showStatus('topics-status-saved', 3000);
    showToast(`Successfully extracted ${res.topics.length} topics from syllabus! Click Save changes to persist.`, 'success', 4500);
  } else if (res && res.error) {
    const errEl = document.getElementById('topics-status-error');
    if (errEl) {
      const msgSpan = errEl.querySelector('.status-msg');
      if (msgSpan) msgSpan.textContent = res.error;
    }
    showStatus('topics-status-error', 0);
    showToast(res.error, 'error');
  } else {
    showToast('Could not extract topics. Please check your syllabus text.', 'warning');
  }
}

/* ============================================================
   STATUS HELPERS
   ============================================================ */
function showStatus(id, autoDismissMs = 0) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  if (autoDismissMs > 0) setTimeout(() => hideStatus(id), autoDismissMs);
}

function hideStatus(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}
