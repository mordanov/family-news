import { useState, useRef, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { api } from '../api/index.js'

const DEFAULT_COLORS = [
  { id: 'amber',   label: 'Оранжево-жёлтый', value: '#F59E0B' },
  { id: 'teal',    label: 'Бирюзовый',        value: '#006D5B' },
  { id: 'blue',    label: 'Синий',             value: '#3B82F6' },
  { id: 'rose',    label: 'Розовый',           value: '#F43F5E' },
  { id: 'violet',  label: 'Фиолетовый',        value: '#8B5CF6' },
  { id: 'emerald', label: 'Зелёный',           value: '#10B981' },
  { id: 'orange',  label: 'Оранжевый',         value: '#F97316' },
  { id: 'sky',     label: 'Голубой',           value: '#0EA5E9' },
  { id: 'slate',   label: 'Серый',             value: '#64748B' },
  { id: 'lime',    label: 'Лаймовый',          value: '#84CC16' },
]

function toDatetimeLocal(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

function isSupportedMedia(mimeType) {
  return mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/')
}

function ExistingMediaThumb({ item }) {
  const kind = item.media_kind || 'image'
  if (kind === 'image' && item.thumbnail_url) {
    return <img src={item.thumbnail_url} alt="файл" className="existing-thumb" />
  }
  if (kind === 'video') {
    if (item.thumbnail_url) return <img src={item.thumbnail_url} alt="Видео" className="existing-thumb" />
    return <div className="existing-file-badge">Видео</div>
  }
  if (kind === 'audio') return <div className="existing-file-badge">Аудио</div>
  return <div className="existing-file-badge">Файл</div>
}

export default function NewsForm({ onSaved }) {
  const editing = useAppStore((s) => s.editingNews)
  const storeColors = useAppStore((s) => s.colors)
  const closeForm = useAppStore((s) => s.closeForm)
  const isEdit = !!editing

  const colors = storeColors?.length > 0 ? storeColors : DEFAULT_COLORS
  const existingMedia = isEdit ? (editing.media || editing.photos || []) : []
  const defaultDatetime = isEdit && editing.created_at
    ? toDatetimeLocal(new Date(editing.created_at))
    : toDatetimeLocal(new Date())

  const [desc, setDesc] = useState(isEdit ? editing.description : '')
  const [selectedColor, setSelectedColor] = useState(isEdit ? editing.color : 'amber')
  const [datetime, setDatetime] = useState(defaultDatetime)
  const [isPublished, setIsPublished] = useState(isEdit ? !!editing.is_published : false)
  const [newFiles, setNewFiles] = useState([])
  const [deletedPhotoIds, setDeletedPhotoIds] = useState([])
  const [removedExistingIds, setRemovedExistingIds] = useState(new Set())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(0)
  const [uploadTotal, setUploadTotal] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const stagedNewsIdRef = useRef(null)
  const pendingUploadsRef = useRef([])
  const isUploadingRef = useRef(false)

  const close = useCallback((force = false) => {
    if (isUploadingRef.current && !force) return
    closeForm()
  }, [closeForm])

  const addFiles = (files) => {
    const valid = Array.from(files).filter((f) => isSupportedMedia(f.type))
    setNewFiles((prev) => [...prev, ...valid.map((f) => ({ file: f, previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null }))])
  }

  const removeFile = (idx) => {
    setNewFiles((prev) => {
      const next = [...prev]
      if (next[idx]?.previewUrl) URL.revokeObjectURL(next[idx].previewUrl)
      next.splice(idx, 1)
      return next
    })
  }

  const removeExisting = (id) => {
    setRemovedExistingIds((prev) => new Set([...prev, id]))
    setDeletedPhotoIds((prev) => [...prev, id])
  }

  const handleSave = async () => {
    if (!desc.trim()) { setError('Введите описание'); return }
    setError('')
    setSaving(true)

    try {
      if (isEdit) {
        const fd = new FormData()
        fd.append('description', desc.trim())
        fd.append('color', selectedColor)
        if (datetime) fd.append('created_at', datetime)
        fd.append('is_published', String(isPublished))
        newFiles.forEach(({ file }) => fd.append('new_media', file))
        fd.append('delete_photo_ids', JSON.stringify(deletedPhotoIds))
        await api.updateNews(editing.id, fd)
      } else {
        const rawFiles = newFiles.map((f) => f.file)

        if (!stagedNewsIdRef.current) {
          const created = await api.createNewsDraft({
            description: desc.trim(),
            color: selectedColor,
            created_at: datetime || null,
            is_published: isPublished,
          })
          stagedNewsIdRef.current = created.id
          pendingUploadsRef.current = [...rawFiles]
        }

        const total = rawFiles.length
        let done = total - pendingUploadsRef.current.length
        isUploadingRef.current = true
        setUploading(true)
        setUploadTotal(total)
        setUploadDone(done)

        while (pendingUploadsRef.current.length > 0) {
          const nextFile = pendingUploadsRef.current[0]
          await api.uploadNewsMedia(stagedNewsIdRef.current, nextFile)
          pendingUploadsRef.current.shift()
          done += 1
          setUploadDone(done)
        }
      }

      close(true)
      onSaved()
    } catch (e) {
      setError(e.message)
      setSaving(false)
      if (!isEdit) {
        isUploadingRef.current = false
        setUploading(false)
      }
    } finally {
      if (isEdit) setSaving(false)
    }
  }

  const saveLabel = isEdit
    ? (saving ? 'Сохраняем...' : 'Сохранить')
    : (uploading ? 'Загружаем файлы...' : saving ? 'Сохраняем...' : (stagedNewsIdRef.current && pendingUploadsRef.current.length > 0 ? 'Продолжить загрузку' : 'Добавить'))

  const uploadPct = uploadTotal > 0 ? Math.round((uploadDone / uploadTotal) * 100) : 0

  return (
    <div className="modal-overlay" id="form-overlay" onClick={(e) => { if (e.target.id === 'form-overlay') close() }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2>{isEdit ? 'Редактировать новость' : 'Новая новость'}</h2>
          <button className="btn-icon" onClick={() => close()} title="Закрыть">✕</button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {uploading && (
          <div className="upload-overlay">
            <div className="upload-overlay-card">
              <div className="spinner" />
              <p className="upload-overlay-text">Пожалуйста, не закрывайте окно до окончания загрузки</p>
              <div className="upload-progress-caption">{uploadDone} / {uploadTotal}</div>
              <div className="upload-progress-track">
                <div className="upload-progress-bar" style={{ width: `${uploadPct}%` }} />
              </div>
            </div>
          </div>
        )}

        <div className="field">
          <label>Описание</label>
          <textarea rows={5} placeholder="Что произошло?" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>

        <div className="field">
          <label>Цвет рамки</label>
          <div className="color-picker">
            {colors.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`color-dot ${selectedColor === c.id ? 'selected' : ''}`}
                title={c.label}
                style={{ background: c.value, borderColor: c.value }}
                onClick={() => setSelectedColor(c.id)}
              />
            ))}
          </div>
        </div>

        <div className="field">
          <label>Дата и время события</label>
          <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
        </div>

        <div className="field field-checkbox">
          <label className="checkbox-row">
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
            <span>Опубликовать</span>
          </label>
        </div>

        {isEdit && existingMedia.filter((p) => !removedExistingIds.has(p.id)).length > 0 && (
          <div className="field">
            <label>Текущие файлы <span className="hint">(нажмите ✕ чтобы удалить)</span></label>
            <div className="existing-photos">
              {existingMedia
                .filter((p) => !removedExistingIds.has(p.id))
                .map((p) => (
                  <div key={p.id} className="existing-photo-wrap">
                    <ExistingMediaThumb item={p} />
                    <button className="remove-existing-photo" title="Удалить" onClick={() => removeExisting(p.id)}>✕</button>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="field">
          <label>Файлы <span className="hint">(до 100: фото, видео, аудио)</span></label>
          <div
            className={`photo-upload-area${dragOver ? ' drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>Перетащите файлы сюда или</span>
            <label className="btn-upload">
              Выбрать файлы
              <input type="file" multiple accept="image/*,video/*,audio/*" style={{ display: 'none' }} onChange={(e) => addFiles(e.target.files)} />
            </label>
          </div>
          {newFiles.length > 0 && (
            <div className="photo-preview-list">
              {newFiles.map(({ file, previewUrl }, i) => (
                <div key={i} className="preview-wrap">
                  {previewUrl
                    ? <img src={previewUrl} className="preview-thumb" alt="preview" />
                    : (
                      <>
                        <div className="preview-file-badge">{file.type.startsWith('video/') ? 'Видео' : 'Аудио'}</div>
                        <div className="preview-file-name">{file.name}</div>
                      </>
                    )
                  }
                  <button className="remove-preview" title="Удалить" onClick={() => removeFile(i)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => close()}>Отмена</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || uploading}>{saveLabel}</button>
        </div>
      </div>
    </div>
  )
}
