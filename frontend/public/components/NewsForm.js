import { api } from '/api.js';
import { state, setState } from '/state.js';

const DEFAULT_COLORS = [
  { id: 'amber', label: 'Оранжево-жёлтый', value: '#F59E0B' },
  { id: 'teal', label: 'Бирюзовый', value: '#006D5B' },
  { id: 'blue', label: 'Синий', value: '#3B82F6' },
  { id: 'rose', label: 'Розовый', value: '#F43F5E' },
  { id: 'violet', label: 'Фиолетовый', value: '#8B5CF6' },
  { id: 'emerald', label: 'Зелёный', value: '#10B981' },
  { id: 'orange', label: 'Оранжевый', value: '#F97316' },
  { id: 'sky', label: 'Голубой', value: '#0EA5E9' },
  { id: 'slate', label: 'Серый', value: '#64748B' },
  { id: 'lime', label: 'Лаймовый', value: '#84CC16' },
];

let colorsLoadPromise = null;

function ensureColorsLoaded() {
  const hasColors = Array.isArray(state.colors) && state.colors.length > 0;
  if (hasColors || colorsLoadPromise) return;

  colorsLoadPromise = api.getColors()
    .then(realColors => {
      if (Array.isArray(realColors) && realColors.length > 0) {
        setState({ colors: realColors });
        return;
      }
      setState({ colors: DEFAULT_COLORS });
    })
    .catch(() => {
      setState({ colors: DEFAULT_COLORS });
    })
    .finally(() => {
      colorsLoadPromise = null;
    });
}

export function renderNewsForm(container, onSaved) {
  if (state.user?.role !== 'full_access') {
    setState({ showForm: false, editingNews: null });
    return;
  }

  const editing = state.editingNews;
  const isEdit = !!editing;
  const hasColors = Array.isArray(state.colors) && state.colors.length > 0;
  const colors = hasColors ? state.colors : DEFAULT_COLORS;
  if (!hasColors) ensureColorsLoaded();

  const existingMedia = isEdit ? (editing.media || editing.photos || []) : [];

  // Prepare default datetime value: editing → existing created_at, new → now (local)
  const defaultDatetime = isEdit && editing.created_at
    ? _toDatetimeLocal(new Date(editing.created_at))
    : _toDatetimeLocal(new Date());

  container.innerHTML = `
    <div class="modal-overlay" id="form-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h2>${isEdit ? 'Редактировать новость' : 'Новая новость'}</h2>
          <button class="btn-icon" id="close-form" title="Закрыть">✕</button>
        </div>

        <div id="form-error" class="form-error hidden"></div>

        <div id="upload-overlay" class="upload-overlay hidden" aria-live="polite">
          <div class="upload-overlay-card">
            <div class="spinner"></div>
            <p class="upload-overlay-text">Пожалуйста, не закрывайте окно до окончания загрузки</p>
            <div class="upload-progress-caption" id="upload-progress-caption">0 / 0</div>
            <div class="upload-progress-track">
              <div class="upload-progress-bar" id="upload-progress-bar"></div>
            </div>
          </div>
        </div>

        <div class="field">
          <label>Описание</label>
          <textarea id="news-desc" rows="5" placeholder="Что произошло?">${isEdit ? escHtml(editing.description) : ''}</textarea>
        </div>

        <div class="field">
          <label>Цвет рамки</label>
          <div class="color-picker" id="color-picker">
            ${colors.map(c => `
              <button class="color-dot ${(isEdit ? editing.color : 'amber') === c.id ? 'selected' : ''}"
                data-color="${c.id}" title="${c.label}"
                style="background:${c.value}; border-color:${c.value}">
              </button>
            `).join('')}
          </div>
        </div>

        <div class="field">
          <label>Дата и время события</label>
          <input type="datetime-local" id="news-datetime" value="${defaultDatetime}"/>
        </div>

        <div class="field field-checkbox">
          <label class="checkbox-row">
            <input type="checkbox" id="news-publish" ${isEdit && editing.is_published ? 'checked' : ''}/>
            <span>Опубликовать</span>
          </label>
        </div>

        ${isEdit && existingMedia.length > 0 ? `
        <div class="field">
          <label>Текущие файлы <span class="hint">(нажмите ✕ чтобы удалить)</span></label>
          <div class="existing-photos" id="existing-photos">
            ${existingMedia.map(p => `
              <div class="existing-photo-wrap" data-photo-id="${p.id}">
                ${renderExistingMediaPreview(p)}
                <button class="remove-existing-photo" data-photo-id="${p.id}" title="Удалить">✕</button>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <div class="field">
          <label>Файлы <span class="hint">(до 100: фото, видео, аудио)</span></label>
          <div class="photo-upload-area" id="photo-drop">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>Перетащите файлы сюда или</span>
            <label class="btn-upload">
              Выбрать файлы
              <input type="file" id="photo-input" multiple accept="image/*,video/*,audio/*" style="display:none"/>
            </label>
          </div>
          <div class="photo-preview-list" id="photo-previews"></div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" id="cancel-form">Отмена</button>
          <button class="btn-primary" id="save-form">${isEdit ? 'Сохранить' : 'Добавить'}</button>
        </div>
      </div>
    </div>
  `;

  let selectedColor = isEdit ? editing.color : 'amber';
  let newFiles = [];
  let deletedPhotoIds = [];
  let isUploading = false;
  let stagedNewsId = null;
  let pendingUploads = [];

  // Color picker
  container.querySelectorAll('.color-dot').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.color-dot').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = btn.dataset.color;
    });
  });

  // Existing photo delete
  container.querySelectorAll('.remove-existing-photo').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = parseInt(btn.dataset.photoId);
      deletedPhotoIds.push(pid);
      btn.closest('.existing-photo-wrap').remove();
    });
  });

  // File input
  const fileInput = container.querySelector('#photo-input');
  const previewList = container.querySelector('#photo-previews');

  function addFiles(files) {
    for (const file of files) {
      if (!isSupportedMedia(file.type)) continue;
      newFiles.push(file);
      const wrap = document.createElement('div');
      wrap.className = 'preview-wrap';

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = e => {
          wrap.innerHTML = `
            <img src="${e.target.result}" class="preview-thumb" alt="preview"/>
            <button class="remove-preview" title="Удалить">✕</button>
          `;
          bindRemovePreview(wrap, file);
        };
        reader.readAsDataURL(file);
      } else {
        const kind = file.type.startsWith('video/') ? 'Видео' : 'Аудио';
        wrap.innerHTML = `
          <div class="preview-file-badge">${kind}</div>
          <div class="preview-file-name">${escHtml(file.name || kind)}</div>
          <button class="remove-preview" title="Удалить">✕</button>
        `;
        bindRemovePreview(wrap, file);
      }

      previewList.appendChild(wrap);
    }
  }

  function bindRemovePreview(wrap, file) {
    wrap.querySelector('.remove-preview').addEventListener('click', () => {
      newFiles = newFiles.filter(f => f !== file);
      wrap.remove();
    });
  }

  fileInput.addEventListener('change', () => addFiles(fileInput.files));

  // Drag & drop
  const dropArea = container.querySelector('#photo-drop');
  dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.classList.add('drag-over'); });
  dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
  dropArea.addEventListener('drop', e => {
    e.preventDefault();
    dropArea.classList.remove('drag-over');
    addFiles(e.dataTransfer.files);
  });

  // Close / cancel
  const close = (force = false) => {
    if (isUploading && !force) return;
    setState({ showForm: false, editingNews: null });
  };
  container.querySelector('#close-form').addEventListener('click', close);
  container.querySelector('#cancel-form').addEventListener('click', close);
  container.querySelector('#form-overlay').addEventListener('click', e => {
    if (e.target.id === 'form-overlay') close();
  });

  // Save
  container.querySelector('#save-form').addEventListener('click', async () => {
    const desc = container.querySelector('#news-desc').value.trim();
    const datetimeVal = container.querySelector('#news-datetime').value; // "YYYY-MM-DDTHH:MM"
    const isPublished = container.querySelector('#news-publish').checked;
    const errEl = container.querySelector('#form-error');
    if (!desc) { errEl.textContent = 'Введите описание'; errEl.classList.remove('hidden'); return; }

    const saveBtn = container.querySelector('#save-form');
    const overlayEl = container.querySelector('#upload-overlay');
    const progressTextEl = container.querySelector('#upload-progress-caption');
    const progressBarEl = container.querySelector('#upload-progress-bar');

    const setUploadProgress = (done, total) => {
      const safeTotal = Math.max(1, total);
      const percent = Math.min(100, Math.round((done / safeTotal) * 100));
      progressTextEl.textContent = `${done} / ${total}`;
      progressBarEl.style.width = `${percent}%`;
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохраняем…';
    errEl.classList.add('hidden');

    try {
      if (isEdit) {
        const fd = new FormData();
        fd.append('description', desc);
        fd.append('color', selectedColor);
        if (datetimeVal) fd.append('created_at', datetimeVal);
        fd.append('is_published', String(isPublished));
        newFiles.forEach(f => fd.append('new_media', f));
        fd.append('delete_photo_ids', JSON.stringify(deletedPhotoIds));
        await api.updateNews(editing.id, fd);
      } else {
        if (!stagedNewsId) {
          const created = await api.createNewsDraft({
            description: desc,
            color: selectedColor,
            created_at: datetimeVal || null,
            is_published: isPublished,
          });
          stagedNewsId = created.id;
          pendingUploads = [...newFiles];
        }

        const total = newFiles.length;
        let done = total - pendingUploads.length;

        isUploading = true;
        overlayEl.classList.remove('hidden');
        saveBtn.textContent = pendingUploads.length > 0 ? 'Загружаем файлы…' : 'Сохраняем…';
        setUploadProgress(done, total);

        while (pendingUploads.length > 0) {
          const nextFile = pendingUploads[0];
          await api.uploadNewsMedia(stagedNewsId, nextFile);
          pendingUploads.shift();
          done += 1;
          setUploadProgress(done, total);
        }
      }
      close(true);
      onSaved();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit
        ? 'Сохранить'
        : (stagedNewsId && pendingUploads.length > 0 ? 'Продолжить загрузку' : 'Добавить');
    } finally {
      if (!isEdit) {
        isUploading = false;
        overlayEl.classList.add('hidden');
      }
    }
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isSupportedMedia(mimeType) {
  return mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/');
}

function renderExistingMediaPreview(item) {
  const kind = item.media_kind || 'image';
  if (kind === 'image' && item.thumbnail_url) {
    return `<img src="${item.thumbnail_url}" alt="файл" class="existing-thumb"/>`;
  }
  if (kind === 'video') {
    if (item.thumbnail_url) {
      return `<img src="${item.thumbnail_url}" alt="Видео" class="existing-thumb"/>`;
    }
    return '<div class="existing-file-badge">Видео</div>';
  }
  if (kind === 'audio') {
    return '<div class="existing-file-badge">Аудио</div>';
  }
  return '<div class="existing-file-badge">Файл</div>';
}

/** Convert a UTC Date to "YYYY-MM-DDTHH:MM" in Europe/Madrid for datetime-local input. */
function _toDatetimeLocal(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

