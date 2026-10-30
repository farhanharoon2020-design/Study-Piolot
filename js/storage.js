/**
 * storage.js
 * Data-access layer for StudyPilot with seamless Supabase synchronization.
 *
 * Uses:
 * - LocalStorage for instant cached reads (courses, profile, syllabus text, topics)
 * - IndexedDB for offline / local uploaded file blobs
 * - Supabase PostgreSQL Database for cloud storage (courses, syllabi, topics, materials, profiles)
 * - Supabase Storage bucket ("studypilot-materials") for cloud documents & files
 */

/* ============================================================
   KEYS & HELPERS
   ============================================================ */
const KEYS = {
  COURSES: 'sp_courses',
  PROFILE: 'sp_profile',
  PREVIEW: 'sp_preview_mode',
};

// Cached active user ID for synchronous check
let _currentSupabaseUserId = null;

function isSupabaseUserActive() {
  return (
    typeof isSupabaseConfigured === 'function' &&
    isSupabaseConfigured() &&
    Boolean(window.supabaseClient) &&
    Boolean(_currentSupabaseUserId)
  );
}

function getActiveUserId() {
  return _currentSupabaseUserId;
}

function lsGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('StudyPilot: localStorage read error', key, e);
    return fallback;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('StudyPilot: localStorage write error', key, e);
    if (e.name === 'QuotaExceededError' && typeof showToast === 'function') {
      showToast('Storage is full. Please delete some materials or clear data.', 'error');
    }
    return false;
  }
}

function lsRemove(key) {
  try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
}

/* ============================================================
   PREVIEW MODE FLAG
   ============================================================ */
function setPreviewMode(enabled) { lsSet(KEYS.PREVIEW, enabled); }
function isPreviewMode()         { return lsGet(KEYS.PREVIEW, false); }

/* ============================================================
   SUPABASE REAL-TIME DATA SYNC
   ============================================================ */

/**
 * Synchronize all cloud data from Supabase PostgreSQL tables into local cache
 */
async function syncFromSupabase() {
  if (typeof isSupabaseConfigured !== 'function' || !isSupabaseConfigured() || !window.supabaseClient) {
    return false;
  }

  try {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session || !session.user) {
      _currentSupabaseUserId = null;
      return false;
    }

    _currentSupabaseUserId = session.user.id;
    const userId = session.user.id;

    // 1. Fetch Profile
    const { data: profileRow } = await window.supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileRow) {
      const localProf = getProfile();
      localProf.name = profileRow.name || localProf.name || session.user.user_metadata?.name || '';
      localProf.email = session.user.email || profileRow.email;
      localProf.degree = profileRow.degree || localProf.degree;
      localProf.semester = profileRow.semester || localProf.semester;
      localProf.studyTime = profileRow.study_time || localProf.studyTime;
      localProf.studyDuration = profileRow.study_duration || localProf.studyDuration;
      lsSet(KEYS.PROFILE, localProf);
    } else {
      // Create empty profile row if not exists
      const initialProf = getProfile();
      initialProf.email = session.user.email;
      if (session.user.user_metadata?.name) initialProf.name = session.user.user_metadata.name;
      lsSet(KEYS.PROFILE, initialProf);
      await window.supabaseClient.from('profiles').upsert({
        id: userId,
        email: session.user.email,
        name: initialProf.name || '',
      });
    }

    // 2. Fetch Courses
    const { data: courseRows } = await window.supabaseClient
      .from('courses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (courseRows) {
      const mappedCourses = courseRows.map(c => ({
        id: c.id,
        name: c.name,
        code: c.code || '',
        examDate: c.exam_date || '',
        priority: c.priority || 'medium',
        difficulty: c.difficulty || 'medium',
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));
      lsSet(KEYS.COURSES, mappedCourses);

      // 3. For each course, fetch its syllabus, topics, and materials
      for (const course of mappedCourses) {
        // Syllabus
        const { data: sylRow } = await window.supabaseClient
          .from('syllabi')
          .select('*')
          .eq('course_id', course.id)
          .maybeSingle();

        if (sylRow) {
          lsSet(`sp_syllabus_${course.id}`, {
            type: sylRow.type,
            text: sylRow.text || '',
            fileName: sylRow.file_name || '',
            filePath: sylRow.file_path || '',
            fileSize: sylRow.file_size || 0,
          });
        }

        // Topics
        const { data: topicRows } = await window.supabaseClient
          .from('topics')
          .select('*')
          .eq('course_id', course.id)
          .order('order_index', { ascending: true });

        if (topicRows) {
          lsSet(`sp_topics_${course.id}`, topicRows.map(t => ({
            id: t.id,
            name: t.name,
            difficulty: t.difficulty,
            weightage: t.weightage,
          })));
        }

        // Materials
        const { data: matRows } = await window.supabaseClient
          .from('materials')
          .select('*')
          .eq('course_id', course.id)
          .order('uploaded_at', { ascending: false });

        if (matRows) {
          lsSet(`sp_materials_meta_${course.id}`, matRows.map(m => ({
            id: m.id,
            name: m.name,
            mimeType: m.mime_type,
            size: m.size,
            storagePath: m.storage_path,
            uploadedAt: m.uploaded_at,
          })));
        }
      }
    }

    return true;
  } catch (err) {
    console.error('StudyPilot: Supabase sync error:', err);
    return false;
  }
}

/* ============================================================
   COURSES
   ============================================================ */

/** @returns {Array} All saved courses */
function getCourses() {
  return lsGet(KEYS.COURSES, []);
}

/** @returns {Object|null} Single course by ID */
function getCourse(id) {
  return getCourses().find(c => c.id === id) || null;
}

/**
 * Create a new course.
 * @param {{name:string, code?:string, examDate?:string, priority:string, difficulty:string}} data
 * @returns {Object} The created course object.
 */
function createCourse(data) {
  const courses = getCourses();
  const course = {
    id: generateId(),
    name: data.name.trim(),
    code: data.code ? data.code.trim() : '',
    examDate: data.examDate || '',
    priority: data.priority || 'medium',
    difficulty: data.difficulty || 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  courses.push(course);
  lsSet(KEYS.COURSES, courses);

  // Async Supabase Sync
  if (isSupabaseUserActive()) {
    window.supabaseClient
      .from('courses')
      .insert({
        id: course.id,
        user_id: getActiveUserId(),
        name: course.name,
        code: course.code,
        exam_date: course.examDate,
        priority: course.priority,
        difficulty: course.difficulty,
      })
      .then(({ error }) => {
        if (error) console.error('Supabase createCourse error:', error);
      });
  }

  return course;
}

/**
 * Update an existing course.
 * @param {string} id
 * @param {Object} updates
 * @returns {Object|null} Updated course or null if not found.
 */
function updateCourse(id, updates) {
  const courses = getCourses();
  const idx = courses.findIndex(c => c.id === id);
  if (idx === -1) return null;

  courses[idx] = { ...courses[idx], ...updates, updatedAt: new Date().toISOString() };
  lsSet(KEYS.COURSES, courses);

  // Async Supabase Sync
  if (isSupabaseUserActive()) {
    const payload = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.code !== undefined) payload.code = updates.code.trim();
    if (updates.examDate !== undefined) payload.exam_date = updates.examDate;
    if (updates.priority !== undefined) payload.priority = updates.priority;
    if (updates.difficulty !== undefined) payload.difficulty = updates.difficulty;

    window.supabaseClient
      .from('courses')
      .update(payload)
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Supabase updateCourse error:', error);
      });
  }

  return courses[idx];
}

/**
 * Delete a course and ALL associated data.
 * @param {string} id
 */
async function deleteCourse(id) {
  // Remove course record locally
  const courses = getCourses().filter(c => c.id !== id);
  lsSet(KEYS.COURSES, courses);

  // Remove associated local data
  lsRemove(`sp_syllabus_${id}`);
  lsRemove(`sp_topics_${id}`);

  // Remove materials metadata & IDB blobs
  const meta = lsGet(`sp_materials_meta_${id}`, []);
  lsRemove(`sp_materials_meta_${id}`);

  for (const m of meta) {
    await idbDeleteBlob(m.id);
  }

  // Supabase Sync (Cascading delete automatically handles related child rows)
  if (isSupabaseUserActive()) {
    window.supabaseClient
      .from('courses')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Supabase deleteCourse error:', error);
      });
  }
}

/* ============================================================
   SYLLABUS
   ============================================================ */

/** @returns {{type:'text'|'file', text?:string, fileName?:string, filePath?:string, fileSize?:number}|null} */
function getCourseSyllabus(courseId) {
  return lsGet(`sp_syllabus_${courseId}`, null);
}

/**
 * Save syllabus for a course.
 */
function saveCourseSyllabus(courseId, data) {
  lsSet(`sp_syllabus_${courseId}`, data);

  if (isSupabaseUserActive()) {
    window.supabaseClient
      .from('syllabi')
      .upsert({
        course_id: courseId,
        user_id: getActiveUserId(),
        type: data.type || 'text',
        text: data.text || '',
        file_name: data.fileName || '',
        file_path: data.filePath || '',
        file_size: data.fileSize || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'course_id' })
      .then(({ error }) => {
        if (error) console.error('Supabase saveCourseSyllabus error:', error);
      });
  }
}

function deleteCourseSyllabus(courseId) {
  lsRemove(`sp_syllabus_${courseId}`);

  if (isSupabaseUserActive()) {
    window.supabaseClient
      .from('syllabi')
      .delete()
      .eq('course_id', courseId)
      .then(({ error }) => {
        if (error) console.error('Supabase deleteCourseSyllabus error:', error);
      });
  }
}

/* ============================================================
   TOPICS
   ============================================================ */

/** @returns {Array} Topics for a course */
function getCourseTopics(courseId) {
  return lsGet(`sp_topics_${courseId}`, []);
}

/**
 * Save topics for a course.
 * @param {string} courseId
 * @param {Array<{id, name, difficulty, weightage}>} topics
 */
function saveCourseTopics(courseId, topics) {
  lsSet(`sp_topics_${courseId}`, topics);

  if (isSupabaseUserActive()) {
    const userId = getActiveUserId();
    window.supabaseClient
      .from('topics')
      .delete()
      .eq('course_id', courseId)
      .then(async ({ error }) => {
        if (error) return console.error('Supabase topics cleanup error:', error);
        if (topics && topics.length > 0) {
          const rows = topics.map((t, index) => ({
            id: (t.id && t.id.length > 20) ? t.id : generateId(),
            course_id: courseId,
            user_id: userId,
            name: t.name,
            difficulty: t.difficulty || 'medium',
            weightage: t.weightage || 'medium',
            order_index: index,
          }));
          const { error: insErr } = await window.supabaseClient.from('topics').insert(rows);
          if (insErr) console.error('Supabase topics insert error:', insErr);
        }
      });
  }
}

function deleteCourseTopics(courseId) {
  lsRemove(`sp_topics_${courseId}`);

  if (isSupabaseUserActive()) {
    window.supabaseClient
      .from('topics')
      .delete()
      .eq('course_id', courseId)
      .then(({ error }) => {
        if (error) console.error('Supabase deleteCourseTopics error:', error);
      });
  }
}

/* ============================================================
   MATERIALS (metadata in localStorage / Supabase, blobs in IDB / Supabase Storage)
   ============================================================ */

/** @returns {Array} Material metadata objects for a course */
function getCourseMaterials(courseId) {
  return lsGet(`sp_materials_meta_${courseId}`, []);
}

/** @returns {Array} All materials across all courses */
function getAllMaterials() {
  const courses = getCourses();
  const all = [];
  for (const c of courses) {
    const mats = getCourseMaterials(c.id);
    mats.forEach(m => all.push({ ...m, courseName: c.name, courseId: c.id }));
  }
  return all;
}

/**
 * Add a material record (metadata only).
 */
function addMaterialMeta(courseId, meta) {
  const mats = getCourseMaterials(courseId);
  mats.push(meta);
  lsSet(`sp_materials_meta_${courseId}`, mats);

  if (isSupabaseUserActive()) {
    window.supabaseClient
      .from('materials')
      .insert({
        id: meta.id,
        course_id: courseId,
        user_id: getActiveUserId(),
        name: meta.name,
        mime_type: meta.mimeType || meta.type || 'application/octet-stream',
        size: meta.size || 0,
        storage_path: meta.storagePath || '',
      })
      .then(({ error }) => {
        if (error) console.error('Supabase addMaterialMeta error:', error);
      });
  }
}

/**
 * Upload a material file to Supabase Storage bucket
 */
async function uploadMaterialToSupabase(courseId, file, materialId) {
  if (!isSupabaseUserActive()) return null;
  try {
    const userId = getActiveUserId();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${userId}/${courseId}/${materialId}_${cleanFileName}`;

    const { error } = await window.supabaseClient.storage
      .from('studypilot-materials')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.warn('Supabase storage upload error:', error);
      return null;
    }

    return storagePath;
  } catch (err) {
    console.warn('Supabase storage exception:', err);
    return null;
  }
}

/**
 * Remove a material record and its blob.
 */
async function deleteMaterial(courseId, materialId) {
  const mats = getCourseMaterials(courseId);
  const target = mats.find(m => m.id === materialId);
  const remaining = mats.filter(m => m.id !== materialId);
  lsSet(`sp_materials_meta_${courseId}`, remaining);

  await idbDeleteBlob(materialId);

  if (isSupabaseUserActive()) {
    // Delete database record
    window.supabaseClient
      .from('materials')
      .delete()
      .eq('id', materialId)
      .then(({ error }) => {
        if (error) console.error('Supabase deleteMaterial error:', error);
      });

    // Delete storage file if exists
    if (target && target.storagePath) {
      window.supabaseClient.storage
        .from('studypilot-materials')
        .remove([target.storagePath])
        .catch(e => console.warn('Storage remove error:', e));
    }
  }
}

/* ============================================================
   PROFILE
   ============================================================ */

function getProfile() {
  return lsGet(KEYS.PROFILE, {
    name: '', email: '', degree: '', semester: '',
    studyTime: '', studyDuration: '',
  });
}

function saveProfile(data) {
  lsSet(KEYS.PROFILE, data);

  if (isSupabaseUserActive()) {
    window.supabaseClient
      .from('profiles')
      .upsert({
        id: getActiveUserId(),
        name: data.name || '',
        degree: data.degree || '',
        semester: data.semester || '',
        study_time: data.studyTime || '',
        study_duration: String(data.studyDuration || ''),
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error('Supabase saveProfile error:', error);
      });
  }
}

/* ============================================================
   RESET ALL DEMO DATA
   ============================================================ */

async function resetAllData() {
  // Clear materials blobs from IndexedDB first
  const courses = getCourses();
  for (const c of courses) {
    const mats = getCourseMaterials(c.id);
    for (const m of mats) {
      await idbDeleteBlob(m.id);
    }
  }

  // Clear all sp_ keys from localStorage except Supabase config
  const preservedUrl = localStorage.getItem('sp_supabase_url');
  const preservedKey = localStorage.getItem('sp_supabase_anon_key');

  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('sp_')) keysToRemove.push(k);
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  if (preservedUrl) localStorage.setItem('sp_supabase_url', preservedUrl);
  if (preservedKey) localStorage.setItem('sp_supabase_anon_key', preservedKey);
}

/* ============================================================
   INDEXEDDB – LOCAL FILE BLOB STORAGE
   ============================================================ */

const IDB_NAME    = 'studypilot_files';
const IDB_VERSION = 1;
const IDB_STORE   = 'blobs';

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function idbSaveBlob(id, file) {
  try {
    const db = await idbOpen();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put({ id, blob: file, name: file.name, type: file.type });
    return new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror    = e => rej(e.target.error);
    });
  } catch (e) {
    console.error('StudyPilot: IDB save error', e);
    throw e;
  }
}

async function idbGetBlob(id) {
  try {
    const db = await idbOpen();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    return new Promise((res, rej) => {
      const req = store.get(id);
      req.onsuccess = e => res(e.target.result || null);
      req.onerror   = e => rej(e.target.error);
    });
  } catch (e) {
    console.error('StudyPilot: IDB get error', e);
    return null;
  }
}

async function idbDeleteBlob(id) {
  try {
    const db = await idbOpen();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    return new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror    = e => rej(e.target.error);
    });
  } catch (e) {
    console.warn('StudyPilot: IDB delete error', e);
  }
}

/**
 * Download a file from Supabase Storage (or fallback to IndexedDB)
 */
async function downloadMaterialFile(materialId, filename) {
  // 1. Try Supabase Storage if connected
  if (isSupabaseUserActive()) {
    const all = getAllMaterials();
    const m = all.find(item => item.id === materialId);
    if (m && m.storagePath) {
      try {
        const { data, error } = await window.supabaseClient.storage
          .from('studypilot-materials')
          .createSignedUrl(m.storagePath, 60);

        if (data?.signedUrl) {
          const a = document.createElement('a');
          a.href = data.signedUrl;
          a.download = filename || m.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          return;
        }
      } catch (err) {
        console.warn('Supabase signedUrl error, falling back to local IDB:', err);
      }
    }
  }

  // 2. Fallback to local IndexedDB blob
  const record = await idbGetBlob(materialId);
  if (!record) {
    if (typeof showToast === 'function') {
      showToast('File not found in local cache or cloud storage.', 'error');
    }
    return;
  }

  const url = URL.createObjectURL(record.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || record.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Open a file from Supabase Storage (or fallback to IndexedDB) in a new tab
 */
async function openMaterialFile(materialId) {
  // 1. Try Supabase Storage if connected
  if (isSupabaseUserActive()) {
    const all = getAllMaterials();
    const m = all.find(item => item.id === materialId);
    if (m && m.storagePath) {
      try {
        const { data } = await window.supabaseClient.storage
          .from('studypilot-materials')
          .createSignedUrl(m.storagePath, 300);

        if (data?.signedUrl) {
          window.open(data.signedUrl, '_blank');
          return;
        }
      } catch (err) {
        console.warn('Supabase storage open error, falling back to local IDB:', err);
      }
    }
  }

  // 2. Fallback to local IndexedDB
  const record = await idbGetBlob(materialId);
  if (!record) {
    if (typeof showToast === 'function') {
      showToast('File not found in local cache or cloud storage.', 'error');
    }
    return;
  }

  const url = URL.createObjectURL(record.blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

// Automatically initiate sync on page load if Supabase session is present
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && window.supabaseClient) {
    try {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      if (session?.user) {
        _currentSupabaseUserId = session.user.id;
        await syncFromSupabase();
      }
    } catch (e) {
      console.warn('Initial Supabase session sync check:', e);
    }
  }
});

/* ============================================================
   AI NOTES & QUIZ STORAGE
   ============================================================ */

const AI_STORAGE_KEYS = {
  NOTES: 'sp_ai_notes',
  QUIZZES: 'sp_ai_quiz_results'
};

/**
 * Get all saved AI notes, optionally filtered by courseId
 */
function getSavedNotes(courseId = null) {
  const all = lsGet(AI_STORAGE_KEYS.NOTES, []);
  if (!courseId) return all;
  return all.filter(n => n.courseId === courseId);
}

/**
 * Save an AI-generated note
 */
function saveGeneratedNote(note) {
  const all = lsGet(AI_STORAGE_KEYS.NOTES, []);
  const noteId = note.id || ('note_' + Date.now());
  const entry = {
    ...note,
    id: noteId,
    createdAt: note.createdAt || new Date().toISOString()
  };

  const existingIdx = all.findIndex(n => n.id === noteId);
  if (existingIdx >= 0) {
    all[existingIdx] = entry;
  } else {
    all.unshift(entry);
  }

  lsSet(AI_STORAGE_KEYS.NOTES, all);
  return entry;
}

/**
 * Delete a saved note by ID
 */
function deleteSavedNote(noteId) {
  const all = lsGet(AI_STORAGE_KEYS.NOTES, []);
  const filtered = all.filter(n => n.id !== noteId);
  lsSet(AI_STORAGE_KEYS.NOTES, filtered);
  return true;
}

/**
 * Get saved quiz scorecards, optionally filtered by courseId
 */
function getSavedQuizResults(courseId = null) {
  const all = lsGet(AI_STORAGE_KEYS.QUIZZES, []);
  if (!courseId) return all;
  return all.filter(q => q.courseId === courseId);
}

/**
 * Save a quiz attempt scorecard
 */
function saveQuizResult(result) {
  const all = lsGet(AI_STORAGE_KEYS.QUIZZES, []);
  const quizId = result.id || ('quiz_' + Date.now());
  const entry = {
    ...result,
    id: quizId,
    createdAt: result.createdAt || new Date().toISOString()
  };

  all.unshift(entry);
  lsSet(AI_STORAGE_KEYS.QUIZZES, all);
  return entry;
}

/**
 * Delete a quiz result by ID
 */
function deleteQuizResult(quizId) {
  const all = lsGet(AI_STORAGE_KEYS.QUIZZES, []);
  const filtered = all.filter(q => q.id !== quizId);
  lsSet(AI_STORAGE_KEYS.QUIZZES, filtered);
  return true;
}

