/**
 * global-materials.js
 * Global Study Materials page (materials.html).
 *
 * Shows ALL uploaded materials across all courses.
 * Supports: filename search, course filter, open, download, delete.
 * Upload here requires course selection first.
 */

const GM_MAX_SIZE_MB = 50;
const GM_MAX_SIZE    = GM_MAX_SIZE_MB * 1024 * 1024;

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initGlobalMaterials();
});

function initGlobalMaterials() {
  const courses = getCourses();

  if (courses.length === 0) {
    showGlobalMaterialsState('no-courses');
    return;
  }

  // Populate course filter dropdown
  populateCourseFilter(courses);
  populateUploadCourseSelect(courses);

  // Bind search and filter
  document.getElementById('gm-search')?.addEventListener('input', renderGlobalMaterials);
  document.getElementById('gm-course-filter')?.addEventListener('change', renderGlobalMaterials);

  // Upload area
  document.getElementById('gm-upload-btn')?.addEventListener('click', () => openModal('gm-upload-modal'));
  document.getElementById('gm-upload-modal-close')?.addEventListener('click', () => closeModal('gm-upload-modal'));
  document.getElementById('gm-upload-cancel')?.addEventListener('click', () => closeModal('gm-upload-modal'));
  document.getElementById('gm-upload-confirm')?.addEventListener('click', handleGlobalUpload);

  // Drop zone in upload modal
  const zone = document.getElementById('gm-drop-zone');
  if (zone) {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      updateGMFileList(Array.from(e.dataTransfer.files));
    });
    zone.addEventListener('click', () => document.getElementById('gm-file-input')?.click());
  }

  const fileInput = document.getElementById('gm-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      updateGMFileList(Array.from(fileInput.files));
      fileInput.value = '';
    });
  }

  document.getElementById('gm-browse-btn')?.addEventListener('click', () => {
    document.getElementById('gm-file-input')?.click();
  });

  renderGlobalMaterials();
}

let gmPendingFiles = [];

function updateGMFileList(files) {
  gmPendingFiles = files;
  const listEl = document.getElementById('gm-selected-files');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (files.length === 0) {
    listEl.hidden = true;
    return;
  }
  listEl.hidden = false;
  files.forEach(f => {
    const li = document.createElement('li');
    li.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;padding:4px 0;color:var(--text-primary)';
    li.innerHTML = getFileIcon(f.name);
    const span = document.createElement('span');
    span.textContent = `${f.name} (${formatFileSize(f.size)})`;
    li.appendChild(span);
    listEl.appendChild(li);
  });
}

/* ============================================================
   STATES
   ============================================================ */
function showGlobalMaterialsState(state) {
  const noCourses   = document.getElementById('gm-no-courses');
  const noFiles     = document.getElementById('gm-no-files');
  const tableWrap   = document.getElementById('gm-table-wrap');
  const toolbarEl   = document.getElementById('gm-toolbar');

  if (noCourses) noCourses.style.display = state === 'no-courses' ? 'flex' : 'none';
  if (noFiles)   noFiles.style.display   = state === 'no-files'   ? 'flex' : 'none';
  if (tableWrap) tableWrap.style.display = state === 'table'      ? 'block' : 'none';
  if (toolbarEl) toolbarEl.style.display = state === 'no-courses' ? 'none'  : 'flex';
}

/* ============================================================
   POPULATE DROPDOWNS
   ============================================================ */
function populateCourseFilter(courses) {
  const sel = document.getElementById('gm-course-filter');
  if (!sel) return;
  sel.innerHTML = '<option value="">All courses</option>';
  courses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

function populateUploadCourseSelect(courses) {
  const sel = document.getElementById('gm-upload-course');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select a course</option>';
  courses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

/* ============================================================
   RENDER TABLE
   ============================================================ */
function renderGlobalMaterials() {
  const search    = document.getElementById('gm-search')?.value?.toLowerCase() || '';
  const courseFilter = document.getElementById('gm-course-filter')?.value || '';

  let materials = getAllMaterials();

  if (courseFilter) {
    materials = materials.filter(m => m.courseId === courseFilter);
  }
  if (search) {
    materials = materials.filter(m => m.name.toLowerCase().includes(search));
  }

  const total = getAllMaterials().length;

  if (total === 0) {
    showGlobalMaterialsState('no-files');
    return;
  }

  if (materials.length === 0) {
    // Has files but search filtered all out
    showGlobalMaterialsState('no-files');
    const noFiles = document.getElementById('gm-no-files');
    if (noFiles) {
      const h2 = noFiles.querySelector('h2');
      const p  = noFiles.querySelector('p');
      if (h2) h2.textContent = 'No results';
      if (p)  p.textContent  = 'Try a different search or filter.';
    }
    return;
  }

  showGlobalMaterialsState('table');
  const tbody = document.getElementById('gm-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  materials.forEach(mat => {
    const tr = document.createElement('tr');

    // File name
    const nameTd = document.createElement('td');
    const cell = document.createElement('div');
    cell.className = 'file-name-cell';
    const icon = document.createElement('div');
    icon.className = 'file-type-icon';
    icon.innerHTML = getFileIcon(mat.name);
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name-text';
    nameSpan.textContent = mat.name;
    cell.appendChild(icon); cell.appendChild(nameSpan);
    nameTd.appendChild(cell);

    // Course name
    const courseTd = document.createElement('td');
    courseTd.style.fontSize = '13px';
    courseTd.style.color    = 'var(--text-secondary)';
    const courseLink = document.createElement('a');
    courseLink.href = `course-details.html?id=${mat.courseId}&tab=materials`;
    courseLink.textContent = mat.courseName;
    courseLink.style.color = 'var(--primary)';
    courseTd.appendChild(courseLink);

    // Size
    const sizeTd = document.createElement('td');
    sizeTd.textContent = formatFileSize(mat.size);
    sizeTd.style.fontSize = '13px';
    sizeTd.style.color    = 'var(--text-secondary)';

    // Date
    const dateTd = document.createElement('td');
    dateTd.textContent = formatDate(mat.uploadedAt);
    dateTd.style.fontSize = '13px';
    dateTd.style.color    = 'var(--text-secondary)';

    // Actions
    const actTd = document.createElement('td');
    const actDiv = document.createElement('div');
    actDiv.className = 'table-actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'btn btn-ghost btn-sm';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => openMaterialFile(mat.id));

    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn btn-ghost btn-sm';
    dlBtn.textContent = 'Download';
    dlBtn.addEventListener('click', () => downloadMaterialFile(mat.id, mat.name));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-ghost btn-sm';
    delBtn.style.color = 'var(--danger)';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => confirmGMDelete(mat));

    actDiv.appendChild(openBtn);
    actDiv.appendChild(dlBtn);
    actDiv.appendChild(delBtn);
    if (/\.pdf$/i.test(mat.name) && mat.storagePath && mat.size <= 10 * 1024 * 1024) {
      ['notes', 'quiz'].forEach(mode => {
        const link = document.createElement('a');
        link.className = 'btn btn-ghost btn-sm';
        link.textContent = mode === 'notes' ? 'AI Notes' : 'AI Quiz';
        const params = new URLSearchParams({ courseId: mat.courseId, materialId: mat.id, mode });
        link.href = `ai-lab.html?${params}`;
        actDiv.appendChild(link);
      });
    }

    actTd.appendChild(actDiv);

    tr.appendChild(nameTd);
    tr.appendChild(courseTd);
    tr.appendChild(sizeTd);
    tr.appendChild(dateTd);
    tr.appendChild(actTd);
    tbody.appendChild(tr);
  });
}

/* ============================================================
   UPLOAD
   ============================================================ */
async function handleGlobalUpload() {
  const courseId = document.getElementById('gm-upload-course')?.value;
  if (!courseId) {
    showToast('Please select a course for these files.', 'warning');
    return;
  }
  if (!gmPendingFiles.length) {
    showToast('Please select at least one file.', 'warning');
    return;
  }

  const btn = document.getElementById('gm-upload-confirm');
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }

  let uploaded = 0;
  for (const file of gmPendingFiles) {
    if (file.size > GM_MAX_SIZE) {
      showToast(`"${file.name}" exceeds ${GM_MAX_SIZE_MB} MB and was skipped.`, 'error');
      continue;
    }
    const id = generateId();
    try {
      await idbSaveBlob(id, file);
      let storagePath = '';
      if (typeof uploadMaterialToSupabase === 'function' && typeof isSupabaseUserActive === 'function' && isSupabaseUserActive()) {
        storagePath = await uploadMaterialToSupabase(courseId, file, id);
      }
      addMaterialMeta(courseId, {
        id, name: file.name, mimeType: file.type, size: file.size,
        storagePath: storagePath || '',
        uploadedAt: new Date().toISOString(),
      });
      uploaded++;
    } catch {
      showToast(`Could not save "${file.name}".`, 'error');
    }
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Upload files'; }
  gmPendingFiles = [];
  updateGMFileList([]);
  closeModal('gm-upload-modal');

  if (uploaded > 0) {
    showToast(`${uploaded} file${uploaded > 1 ? 's' : ''} uploaded.`, 'success');
    renderGlobalMaterials();
  }
}

/* ============================================================
   DELETE
   ============================================================ */
function confirmGMDelete(mat) {
  showConfirm(
    'Delete file?',
    `"${mat.name}" will be permanently removed.`,
    'Delete file',
    async () => {
      await deleteMaterial(mat.courseId, mat.id);
      showToast(`"${mat.name}" deleted.`, 'info');
      renderGlobalMaterials();
    },
    'danger'
  );
}
