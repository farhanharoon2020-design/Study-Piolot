/**
 * syllabus.js
 * Syllabus tab (within Course Details).
 *
 * Supports:
 * - Toggle between PDF upload and paste-text modes
 * - Drag-and-drop and browse for PDF files
 * - Textarea for pasted syllabus text
 * - File size and type validation
 * - Save syllabus to localStorage (text) / IndexedDB (file blob)
 * - Remove / replace file
 * - Generate topics button (delegates to topics.js stub)
 *
 * NOTE: PDF text extraction is not implemented in this frontend stage.
 * The generate-topics button shows the AI-pending message.
 */

const SYLLABUS_MAX_SIZE_MB = 20;
const SYLLABUS_MAX_SIZE    = SYLLABUS_MAX_SIZE_MB * 1024 * 1024;

let syllabusMode      = 'upload'; // 'upload' | 'paste'
let pendingSyllabusFile = null;   // File object selected but not yet saved

/* ============================================================
   INIT (called by course-details.js when Syllabus tab opens)
   ============================================================ */
function initSyllabusTab() {
  if (!courseId) return;
  if (document.getElementById('syllabus-tab-initialized')) return;
  const guard = document.createElement('span');
  guard.id = 'syllabus-tab-initialized';
  guard.hidden = true;
  document.getElementById('tab-syllabus')?.appendChild(guard);

  // Toggle upload / paste
  document.getElementById('syl-toggle-upload')?.addEventListener('click', () => setSyllabusMode('upload'));
  document.getElementById('syl-toggle-paste')?.addEventListener('click',  () => setSyllabusMode('paste'));

  // Drop zone
  setupSyllabusDropZone();

  // Browse button
  document.getElementById('syl-browse-btn')?.addEventListener('click', () => {
    document.getElementById('syl-file-input')?.click();
  });

  // File input
  const fileInput = document.getElementById('syl-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleSyllabusFile(fileInput.files[0]);
      fileInput.value = '';
    });
  }

  // Remove file button
  document.getElementById('syl-remove-file-btn')?.addEventListener('click', () => {
    pendingSyllabusFile = null;
    renderSyllabusState();
  });

  // Save button
  document.getElementById('syl-save-btn')?.addEventListener('click', handleSyllabusSave);

  // Generate topics button
  document.getElementById('syl-generate-btn')?.addEventListener('click', handleSyllabusGenerate);

  // Load existing syllabus
  loadExistingSyllabus();
}

/* ============================================================
   MODE TOGGLE
   ============================================================ */
function setSyllabusMode(mode) {
  syllabusMode = mode;

  const uploadToggle = document.getElementById('syl-toggle-upload');
  const pasteToggle  = document.getElementById('syl-toggle-paste');
  const uploadPanel  = document.getElementById('syl-upload-panel');
  const pastePanel   = document.getElementById('syl-paste-panel');

  if (uploadToggle) uploadToggle.classList.toggle('active', mode === 'upload');
  if (pasteToggle)  pasteToggle.classList.toggle('active',  mode === 'paste');
  if (uploadPanel)  uploadPanel.hidden = mode !== 'upload';
  if (pastePanel)   pastePanel.hidden  = mode !== 'paste';
}

/* ============================================================
   DROP ZONE
   ============================================================ */
function setupSyllabusDropZone() {
  const zone = document.getElementById('syl-drop-zone');
  if (!zone) return;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleSyllabusFile(file);
  });
  zone.addEventListener('click', () => document.getElementById('syl-file-input')?.click());
}

/* ============================================================
   FILE VALIDATION + SELECTION
   ============================================================ */
function handleSyllabusFile(file) {
  // Type check: PDF only for syllabus
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'pdf') {
    showToast('Only PDF files are accepted for syllabus upload.', 'error');
    return;
  }
  if (file.size > SYLLABUS_MAX_SIZE) {
    showToast(`File exceeds the ${SYLLABUS_MAX_SIZE_MB} MB size limit.`, 'error');
    return;
  }

  pendingSyllabusFile = file;
  renderSyllabusState();
}

/* ============================================================
   RENDER STATE
   ============================================================ */
function renderSyllabusState() {
  const selectedInfo  = document.getElementById('syl-file-selected');
  const selectedName  = document.getElementById('syl-file-name');
  const dropZone      = document.getElementById('syl-drop-zone');
  const generateBtn   = document.getElementById('syl-generate-btn');

  const syllabus = getCourseSyllabus(courseId);

  if (pendingSyllabusFile) {
    // A new file has been selected but not saved yet
    if (selectedInfo) selectedInfo.hidden = false;
    if (selectedName) selectedName.textContent = `${pendingSyllabusFile.name} (${formatFileSize(pendingSyllabusFile.size)}) — unsaved`;
    if (dropZone)     dropZone.hidden = true;
  } else if (syllabus?.type === 'file') {
    // Previously saved file
    if (selectedInfo) selectedInfo.hidden = false;
    if (selectedName) selectedName.textContent = `${syllabus.fileName} (${formatFileSize(syllabus.fileSize)}) — saved`;
    if (dropZone)     dropZone.hidden = true;
  } else {
    if (selectedInfo) selectedInfo.hidden = true;
    if (dropZone)     dropZone.hidden = false;
  }

  // Enable generate button if syllabus exists (either saved or pending)
  const hasSyllabus = !!pendingSyllabusFile || !!syllabus;
  if (generateBtn) {
    generateBtn.disabled = !hasSyllabus;
    generateBtn.title = hasSyllabus ? '' : 'Save a syllabus first to enable topic generation.';
  }
}

/* ============================================================
   LOAD EXISTING
   ============================================================ */
function loadExistingSyllabus() {
  const syllabus = getCourseSyllabus(courseId);
  if (!syllabus) {
    setSyllabusMode('upload');
    renderSyllabusState();
    return;
  }

  if (syllabus.type === 'file') {
    setSyllabusMode('upload');
  } else if (syllabus.type === 'text') {
    setSyllabusMode('paste');
    const textarea = document.getElementById('syl-text');
    if (textarea) textarea.value = syllabus.text || '';
  }

  renderSyllabusState();
}

/* ============================================================
   SAVE
   ============================================================ */
async function handleSyllabusSave() {
  const saveBtn = document.getElementById('syl-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

  try {
    if (syllabusMode === 'upload') {
      if (!pendingSyllabusFile) {
        const existing = getCourseSyllabus(courseId);
        if (!existing) {
          showToast('Please select a PDF file first.', 'warning');
          return;
        }
        showToast('Syllabus already saved.', 'info');
        return;
      }

      // Warn if topics exist
      const existingTopics = getCourseTopics(courseId);
      if (existingTopics.length > 0) {
        const proceed = await promptSyllabusReplaceWarning();
        if (!proceed) return;
      }

      const id = generateId();
      await idbSaveBlob(id, pendingSyllabusFile);

      // Remove old file blob if any
      const oldSyllabus = getCourseSyllabus(courseId);
      if (oldSyllabus?.fileId) await idbDeleteBlob(oldSyllabus.fileId);

      saveCourseSyllabus(courseId, {
        type:     'file',
        fileId:   id,
        fileName: pendingSyllabusFile.name,
        fileSize: pendingSyllabusFile.size,
        savedAt:  new Date().toISOString(),
      });

      pendingSyllabusFile = null;
      showToast('Syllabus saved.', 'success');

    } else {
      // Paste mode
      const text = document.getElementById('syl-text')?.value?.trim() || '';
      if (!text) {
        showToast('Please paste your syllabus text first.', 'warning');
        return;
      }

      const existingTopics = getCourseTopics(courseId);
      if (existingTopics.length > 0) {
        const proceed = await promptSyllabusReplaceWarning();
        if (!proceed) return;
      }

      saveCourseSyllabus(courseId, {
        type:    'text',
        text,
        savedAt: new Date().toISOString(),
      });

      showToast('Syllabus text saved.', 'success');
    }
  } catch (err) {
    console.error('Syllabus save error:', err);
    showToast('Could not save syllabus. Storage may be full.', 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save syllabus'; }
    renderSyllabusState();
  }
}

/**
 * Returns a Promise<boolean> – resolves true if user confirms overwrite.
 */
function promptSyllabusReplaceWarning() {
  return new Promise(resolve => {
    showConfirm(
      'Replace syllabus?',
      'This course already has reviewed topics. Replacing the syllabus will not automatically delete them, but consider reviewing your topics afterwards.',
      'Continue',
      () => resolve(true),
      'danger'
    );
    // If user cancels the confirm dialog, resolve false
    // We achieve this by listening for the confirm-cancel-btn click
    // showConfirm calls onConfirm on OK; on cancel the dialog just closes
    // So we need to detect the backdrop removal
    const check = setInterval(() => {
      if (!document.getElementById('confirm-modal-backdrop')) {
        clearInterval(check);
        resolve(false);
      }
    }, 100);
  });
}

/* ============================================================
   GENERATE (delegates to topics.js AI stub)
   ============================================================ */
function handleSyllabusGenerate() {
  // Switch to the Topics tab and trigger generate there
  const topicsTabBtn = document.querySelector('[data-tab="topics"]');
  if (topicsTabBtn) topicsTabBtn.click();

  // Small delay so the tab renders before triggering generate
  setTimeout(() => {
    const genBtn = document.getElementById('topics-generate-btn');
    if (genBtn && !genBtn.disabled) genBtn.click();
    else {
      showToast('Switch to the Topics tab and click Generate topics.', 'info');
    }
  }, 200);
}
