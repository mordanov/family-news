import { setState } from '/state.js';

let activeKeyHandler = null;

const SWIPE_TRIGGER_PX = 60;
const MAX_DRAG_SHIFT_PX = 140;
const OVERLAY_PARALLAX_FACTOR = 0.09;

export function renderLightbox(container, lightboxState) {
  const photos = lightboxState.lightboxPhotos || [];
  const count = photos.length;
  const hasCarousel = count > 1;
  const safeIndex = count ? ((lightboxState.lightboxIndex || 0) % count + count) % count : 0;
  const currentUrl = count ? photos[safeIndex] : lightboxState.lightboxUrl;

  if (!currentUrl) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="lightbox-overlay" id="lightbox">
      <button class="lightbox-close" id="lb-close" title="Закрыть">✕</button>
      ${hasCarousel ? `<button class="lightbox-nav prev" id="lb-prev" title="Предыдущее">‹</button>` : ''}
      <img src="${currentUrl}" alt="фото" class="lightbox-img" id="lb-img"/>
      ${hasCarousel ? `<button class="lightbox-nav next" id="lb-next" title="Следующее">›</button>` : ''}
      ${hasCarousel ? `<div class="lightbox-counter">${safeIndex + 1} / ${count}</div>` : ''}
    </div>
  `;

  if (activeKeyHandler) {
    document.removeEventListener('keydown', activeKeyHandler);
    activeKeyHandler = null;
  }

  const close = () => {
    if (activeKeyHandler) {
      document.removeEventListener('keydown', activeKeyHandler);
      activeKeyHandler = null;
    }
    setState({ lightboxUrl: null, lightboxPhotos: [], lightboxIndex: 0 });
  };

  const move = (step) => {
    if (!count) return;
    const nextIndex = (safeIndex + step + count) % count;
    setState({ lightboxUrl: photos[nextIndex], lightboxPhotos: photos, lightboxIndex: nextIndex });
  };

  const overlay = container.querySelector('#lightbox');
  const imageEl = container.querySelector('#lb-img');
  let touchStartX = 0;
  let touchStartY = 0;
  let touchDx = 0;

  const applyOverlayParallax = (dx) => {
    const shifted = dx * OVERLAY_PARALLAX_FACTOR;
    const opacity = Math.max(0.82, 0.88 - Math.abs(dx) / 900);
    overlay.style.transform = `translateX(${shifted}px)`;
    overlay.style.background = `rgba(0,0,0,${opacity})`;
  };

  const resetOverlayParallax = () => {
    overlay.classList.remove('swiping');
    overlay.style.transform = '';
    overlay.style.background = '';
  };

  const resetDragVisual = () => {
    imageEl.classList.remove('swiping');
    imageEl.style.transform = '';
    imageEl.style.opacity = '';
    resetOverlayParallax();
  };

  const onTouchStart = (e) => {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchDx = 0;
    imageEl.classList.add('swiping');
    overlay.classList.add('swiping');
  };

  const onTouchMove = (e) => {
    if (!hasCarousel) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) < Math.abs(dy)) return;
    touchDx = dx;
    const shifted = Math.max(-MAX_DRAG_SHIFT_PX, Math.min(MAX_DRAG_SHIFT_PX, dx));
    imageEl.style.transform = `translateX(${shifted}px) scale(0.985)`;
    imageEl.style.opacity = String(Math.max(0.75, 1 - Math.abs(shifted) / 420));
    applyOverlayParallax(shifted);
  };

  const onTouchEnd = (e) => {
    if (!hasCarousel) {
      resetDragVisual();
      return;
    }
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) {
      resetDragVisual();
      return;
    }

    const dy = t.clientY - touchStartY;
    const isHorizontal = Math.abs(touchDx) >= Math.abs(dy);
    if (!isHorizontal || Math.abs(touchDx) < SWIPE_TRIGGER_PX) {
      imageEl.classList.remove('swiping');
      overlay.classList.remove('swiping');
      imageEl.style.transform = 'translateX(0) scale(1)';
      imageEl.style.opacity = '1';
      overlay.style.transform = 'translateX(0)';
      overlay.style.background = 'rgba(0,0,0,0.88)';
      return;
    }

    const direction = touchDx < 0 ? 1 : -1;
    const exitShift = touchDx < 0 ? -MAX_DRAG_SHIFT_PX : MAX_DRAG_SHIFT_PX;
    imageEl.classList.remove('swiping');
    overlay.classList.remove('swiping');
    imageEl.style.transform = `translateX(${exitShift}px) scale(0.98)`;
    imageEl.style.opacity = '0.82';
    applyOverlayParallax(exitShift);
    setTimeout(() => move(direction), 90);
  };

  container.querySelector('#lb-close').addEventListener('click', close);
  if (hasCarousel) {
    container.querySelector('#lb-prev').addEventListener('click', () => move(-1));
    container.querySelector('#lb-next').addEventListener('click', () => move(1));
  }
  overlay.addEventListener('touchstart', onTouchStart, { passive: true });
  overlay.addEventListener('touchmove', onTouchMove, { passive: true });
  overlay.addEventListener('touchend', onTouchEnd, { passive: true });
  overlay.addEventListener('touchcancel', resetDragVisual, { passive: true });
  overlay.addEventListener('click', e => {
    if (e.target.id === 'lightbox') close();
  });

  activeKeyHandler = (e) => {
    if (e.key === 'Escape') close();
    if (!hasCarousel) return;
    if (e.key === 'ArrowLeft') move(-1);
    if (e.key === 'ArrowRight') move(1);
  };
  document.addEventListener('keydown', activeKeyHandler);
}
