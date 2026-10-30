/**
 * materials.js
 * Study Materials tab (within Course Details) logic.
 *
 * This module is loaded on course-details.html and activated
 * when the "Study Materials" tab is shown.
 *
 * Files are stored as blobs in IndexedDB; metadata in localStorage.
 * MAX_FILE_SIZE is enforced at upload time (50 MB per file).
 */

const MATERIALS_MAX_SIZE_MB = 50;
const MATERIALS_MAX_SIZE    = MATERIALS_MAX_SIZE_MB * 1024 * 1024;

/* ============================================================
   INIT (called by course-details.js when tab is opened)
   ============================================================ */
function initMaterialsTab() {
  if (!courseId) return;

  // Guard: only run once
  if (document.getElementById('materials-tab-initialized')) return;
  const guard = document.createElement('span');
  guard.id = 'materials-tab-initialized';
  guard.hidden = true;
  document.getElementById('tab-materials')?.appendChild(guard);

  setupMaterialsDropZone();
  setupMaterialsFileInput();
  renderMaterialsList();

  document.getElementById('materials-browse-btn')?.addEventListener('click', () => {
    document.getElementById('materials-file-input')?.click();
  });
}

/* ============================================================
   DROP ZONE
   ============================================================ */
function setupMaterialsDropZone() {
  const zone = document.getElementById('materials-drop-zone');
  if (!zone) return;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleMaterialFiles(Array.from(e.dataTransfer.files));
  });
  zone.addEventListener('click', () => document.getElementById('materials-file-input')?.click());
}

function setupMaterialsFileInput() {
  const input = document.getElementById('materials-file-input');
  if (!input) return;
  input.addEventListener('change', () => {
    handleMaterialFiles(Array.from(input.files));
    input.value = ''; // reset so same file can be re-selected
  });
}

/* ============================================================
   HANDLE UPLOADED FILES
   ============================================================ */
async function handleMaterialFiles(files) {
  if (!files.length) return;

  let uploaded = 0;
  let errors   = 0;

  for (const file of files) {
    // Validate size
    if (file.size > MATERIALS_MAX_SIZE) {
      showToast(`"${file.name}" exceeds the ${MATERIALS_MAX_SIZE_MB} MB limit and was skipped.`, 'error');
      errors++;
      continue;
    }

    const id = generateId();
    const meta = {
      id,
      name:       file.name,
      mimeType:   file.type || 'application/octet-stream',
      size:       file.size,
      uploadedAt: new Date().toISOString(),
    };

    try {
      await idbSaveBlob(id, file);
      let storagePath = '';
      if (typeof uploadMaterialToSupabase === 'function' && typeof isSupabaseUserActive === 'function' && isSupabaseUserActive()) {
        storagePath = await uploadMaterialToSupabase(courseId, file, id);
      }
      meta.storagePath = storagePath || '';
      addMaterialMeta(courseId, meta);
      uploaded++;
    } catch (err) {
      console.error('Upload error:', err);
      showToast(`Could not save "${file.name}". Storage may be full.`, 'error');
      errors++;
    }
  }

  if (uploaded > 0) {
    showToast(`${uploaded} file${uploaded > 1 ? 's' : ''} uploaded.`, 'success');
    renderMaterialsList();
  }
}

/* ============================================================
   RENDER MATERIALS LIST
   ============================================================ */
function renderMaterialsList() {
  const empty = document.getElementById('materials-empty');
  const table = document.getElementById('materials-table-wrap');
  const tbody = document.getElementById('materials-tbody');

  if (!tbody) return;

  const mats = getCourseMaterials(courseId);

  if (mats.length === 0) {
    if (empty) empty.style.display = 'flex';
    if (table) table.style.display = 'none';
    return;
  }

  if (empty) empty.style.display = 'none';
  if (table) table.style.display = 'block';

  tbody.innerHTML = '';

  mats.forEach(mat => {
    const tr = document.createElement('tr');

    // File name cell
    const nameTd = document.createElement('td');
    const nameCell = document.createElement('div');
    nameCell.className = 'file-name-cell';

    const icon = document.createElement('div');
    icon.className = 'file-type-icon';
    icon.innerHTML = getFileIcon(mat.name);

    const nameText = document.createElement('span');
    nameText.className = 'file-name-text';
    nameText.textContent = mat.name;

    nameCell.appendChild(icon);
    nameCell.appendChild(nameText);
    nameTd.appendChild(nameCell);

    // Type
    const typeTd = document.createElement('td');
    typeTd.textContent = getFileExt(mat.name).toUpperCase();
    typeTd.style.color = 'var(--text-secondary)';
    typeTd.style.fontSize = '13px';

    // Size
    const sizeTd = document.createElement('td');
    sizeTd.textContent = formatFileSize(mat.size);
    sizeTd.style.color = 'var(--text-secondary)';
    sizeTd.style.fontSize = '13px';

    // Upload date
    const dateTd = document.createElement('td');
    dateTd.textContent = formatDate(mat.uploadedAt);
    dateTd.style.color = 'var(--text-secondary)';
    dateTd.style.fontSize = '13px';

    // Actions
    const actionsTd = document.createElement('td');
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'table-actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'btn btn-ghost btn-sm';
    openBtn.textContent = 'Open';
    openBtn.setAttribute('aria-label', `Open ${mat.name}`);
    openBtn.addEventListener('click', () => openMaterialFile(mat.id));

    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn btn-ghost btn-sm';
    dlBtn.textContent = 'Download';
    dlBtn.setAttribute('aria-label', `Download ${mat.name}`);
    dlBtn.addEventListener('click', () => downloadMaterialFile(mat.id, mat.name));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-ghost btn-sm';
    delBtn.style.color = 'var(--danger)';
    delBtn.textContent = 'Delete';
    delBtn.setAttribute('aria-label', `Delete ${mat.name}`);
    delBtn.addEventListener('click', () => confirmDeleteMaterial(mat));

    actionsDiv.appendChild(openBtn);
    actionsDiv.appendChild(dlBtn);
    actionsDiv.appendChild(delBtn);
    if (/\.pdf$/i.test(mat.name) && mat.storagePath && mat.size <= 10 * 1024 * 1024) {
      ['notes', 'quiz'].forEach(mode => {
        const link = document.createElement('a');
        link.className = 'btn btn-ghost btn-sm';
        link.textContent = mode === 'notes' ? 'AI Notes' : 'AI Quiz';
        const params = new URLSearchParams({ courseId: courseId, materialId: mat.id, mode });
        link.href = `ai-lab.html?${params}`;
        actionsDiv.appendChild(link);
      });
    }

    actionsTd.appendChild(actionsDiv);

    tr.appendChild(nameTd);
    tr.appendChild(typeTd);
    tr.appendChild(sizeTd);
    tr.appendChild(dateTd);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
}

/* ============================================================
   DELETE MATERIAL
   ============================================================ */
function confirmDeleteMaterial(mat) {
  showConfirm(
    'Delete file?',
    `"${mat.name}" will be permanently removed from this course.`,
    'Delete file',
    async () => {
      await deleteMaterial(courseId, mat.id);
      showToast(`"${mat.name}" deleted.`, 'info');
      renderMaterialsList();
    },
    'danger'
  );
}
