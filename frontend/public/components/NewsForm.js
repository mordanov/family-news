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

export function renderNewsForm(container, onSaved) {
  const editing = state.editingNews;
  const isEdit = !!editing;
  const colors = state.colors.length ? state.colors : DEFAULT_COLORS;
  if (!state.colors.length) {
    api.getColors().then(realColors => setState({ colors: realColors })).catch(() => {});
  }

  const existingPhotos = isEdit ? (editing.photos || []) : [];

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

        ${isEdit && existingPhotos.length > 0 ? `
        <div class="field">
          <label>Текущие фото <span class="hint">(нажмите ✕ чтобы удалить)</span></label>
          <div class="existing-photos" id="existing-photos">
            ${existingPhotos.map(p => `
              <div class="existing-photo-wrap" data-photo-id="${p.id}">
                <img src="${p.thumbnail_url}" alt="фото" class="existing-thumb"/>
                <button class="remove-existing-photo" data-photo-id="${p.id}" title="Удалить">✕</button>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <div class="field">
          <label>Фотографии <span class="hint">(до 10, можно из галереи или камеры)</span></label>
          <div class="photo-upload-area" id="photo-drop">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>Перетащите фото сюда или</span>
            <label class="btn-upload">
              Выбрать файлы
              <input type="file" id="photo-input" multiple accept="image/*" style="display:none"/>
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
      if (!file.type.startsWith('image/')) continue;
      newFiles.push(file);
      const reader = new FileReader();
      reader.onload = e => {
        const wrap = document.createElement('div');
        wrap.className = 'preview-wrap';
        wrap.innerHTML = `
          <img src="${e.target.result}" class="preview-thumb" alt="preview"/>
          <button class="remove-preview" title="Удалить">✕</button>
        `;
        wrap.querySelector('.remove-preview').addEventListener('click', () => {
          newFiles = newFiles.filter(f => f !== file);
          wrap.remove();
        });
        previewList.appendChild(wrap);
      };
      reader.readAsDataURL(file);
    }
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
  const close = () => setState({ showForm: false, editingNews: null });
  container.querySelector('#close-form').addEventListener('click', close);
  container.querySelector('#cancel-form').addEventListener('click', close);
  container.querySelector('#form-overlay').addEventListener('click', e => {
    if (e.target.id === 'form-overlay') close();
  });

  // Save
  container.querySelector('#save-form').addEventListener('click', async () => {
    const desc = container.querySelector('#news-desc').value.trim();
    const datetimeVal = container.querySelector('#news-datetime').value; // "YYYY-MM-DDTHH:MM"
    const errEl = container.querySelector('#form-error');
    if (!desc) { errEl.textContent = 'Введите описание'; errEl.classList.remove('hidden'); return; }

    const saveBtn = container.querySelector('#save-form');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохраняем…';
    errEl.classList.add('hidden');

    try {
      const fd = new FormData();
      fd.append('description', desc);
      fd.append('color', selectedColor);
      if (datetimeVal) fd.append('created_at', datetimeVal);
      newFiles.forEach(f => fd.append('new_photos', f));
      if (isEdit) {
        fd.append('delete_photo_ids', JSON.stringify(deletedPhotoIds));
        await api.updateNews(editing.id, fd);
      } else {
        newFiles.forEach(f => fd.append('photos', f));
        await api.createNews(fd);
      }
      close();
      onSaved();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Сохранить' : 'Добавить';
    }
  });
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Convert a Date to "YYYY-MM-DDTHH:MM" for datetime-local input (local time). */
function _toDatetimeLocal(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

