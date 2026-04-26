import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore.js'

const SWIPE_TRIGGER_PX = 60
const MAX_DRAG_SHIFT_PX = 140
const OVERLAY_PARALLAX_FACTOR = 0.09

export default function Lightbox() {
  const photos = useAppStore((s) => s.lightboxPhotos)
  const index = useAppStore((s) => s.lightboxIndex)
  const closeLightbox = useAppStore((s) => s.closeLightbox)
  const moveLightbox = useAppStore((s) => s.moveLightbox)

  const count = photos.length
  const hasCarousel = count > 1
  const safeIndex = count ? ((index % count) + count) % count : 0
  const currentUrl = count ? photos[safeIndex] : null

  const overlayRef = useRef(null)
  const imgRef = useRef(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchDx = useRef(0)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox()
      if (!hasCarousel) return
      if (e.key === 'ArrowLeft') moveLightbox(-1)
      if (e.key === 'ArrowRight') moveLightbox(1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [hasCarousel, closeLightbox, moveLightbox])

  const applyParallax = (dx) => {
    const overlay = overlayRef.current
    if (!overlay) return
    const shifted = dx * OVERLAY_PARALLAX_FACTOR
    const opacity = Math.max(0.82, 0.88 - Math.abs(dx) / 900)
    overlay.style.transform = `translateX(${shifted}px)`
    overlay.style.background = `rgba(0,0,0,${opacity})`
  }

  const resetVisual = () => {
    const img = imgRef.current
    const overlay = overlayRef.current
    if (img) { img.style.transform = ''; img.style.opacity = '' }
    if (overlay) { overlay.style.transform = ''; overlay.style.background = '' }
  }

  const onTouchStart = (e) => {
    const t = e.changedTouches?.[0]
    if (!t) return
    touchStartX.current = t.clientX
    touchStartY.current = t.clientY
    touchDx.current = 0
  }

  const onTouchMove = (e) => {
    if (!hasCarousel) return
    const t = e.changedTouches?.[0]
    if (!t) return
    const dx = t.clientX - touchStartX.current
    const dy = t.clientY - touchStartY.current
    if (Math.abs(dx) < Math.abs(dy)) return
    touchDx.current = dx
    const shifted = Math.max(-MAX_DRAG_SHIFT_PX, Math.min(MAX_DRAG_SHIFT_PX, dx))
    const img = imgRef.current
    if (img) {
      img.style.transform = `translateX(${shifted}px) scale(0.985)`
      img.style.opacity = String(Math.max(0.75, 1 - Math.abs(shifted) / 420))
    }
    applyParallax(shifted)
  }

  const onTouchEnd = (e) => {
    if (!hasCarousel) { resetVisual(); return }
    const t = e.changedTouches?.[0]
    if (!t) { resetVisual(); return }
    const dy = t.clientY - touchStartY.current
    const isHorizontal = Math.abs(touchDx.current) >= Math.abs(dy)
    if (!isHorizontal || Math.abs(touchDx.current) < SWIPE_TRIGGER_PX) {
      resetVisual()
      return
    }
    const direction = touchDx.current < 0 ? 1 : -1
    const exitShift = touchDx.current < 0 ? -MAX_DRAG_SHIFT_PX : MAX_DRAG_SHIFT_PX
    const img = imgRef.current
    if (img) {
      img.style.transform = `translateX(${exitShift}px) scale(0.98)`
      img.style.opacity = '0.82'
    }
    applyParallax(exitShift)
    setTimeout(() => moveLightbox(direction), 90)
  }

  if (!currentUrl) return null

  return (
    <div
      className="lightbox-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) closeLightbox() }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={resetVisual}
    >
      <button className="lightbox-close" onClick={closeLightbox} title="Закрыть">✕</button>
      {hasCarousel && (
        <button className="lightbox-nav prev" onClick={() => moveLightbox(-1)} title="Предыдущее">‹</button>
      )}
      <img
        ref={imgRef}
        src={currentUrl}
        alt="фото"
        className="lightbox-img"
        style={{ touchAction: 'pan-y' }}
      />
      {hasCarousel && (
        <button className="lightbox-nav next" onClick={() => moveLightbox(1)} title="Следующее">›</button>
      )}
      {hasCarousel && (
        <div className="lightbox-counter">{safeIndex + 1} / {count}</div>
      )}
    </div>
  )
}
