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
  const type = lightboxState.lightboxType || 'image';
  const poster = lightboxState.lightboxPoster || '';

  if (!currentUrl) {
    container.innerHTML = '';
    return;
  }

  let mediaHtml = '';
  if (type === 'video') {
    mediaHtml = `<video src="${currentUrl}" class="lightbox-img" id="lb-video" controls autoplay preload="metadata" style="background:#000;max-width:96vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 48px rgba(0,0,0,0.5);object-fit:contain;"${poster ? ` poster='${poster}'` : ''}></video>`;
  } else {
    mediaHtml = `<img src="${currentUrl}" alt="фото" class="lightbox-img" id="lb-img"/>`;
  }

  container.innerHTML = `
    <div class="lightbox-overlay" id="lightbox">
      <button class="lightbox-close" id="lb-close" title="Закрыть">✕</button>
      ${hasCarousel && type !== 'video' ? `<button class="lightbox-nav prev" id="lb-prev" title="Предыдущее">‹</button>` : ''}
      ${mediaHtml}
      ${hasCarousel && type !== 'video' ? `<button class="lightbox-nav next" id="lb-next" title="Следующее">›</button>` : ''}
      ${hasCarousel && type !== 'video' ? `<div class="lightbox-counter">${safeIndex + 1} / ${count}</div>` : ''}
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
    setState({ lightboxUrl: null, lightboxPhotos: [], lightboxIndex: 0, lightboxType: null, lightboxPoster: null });
  };

  const move = (step) => {
    if (!count) return;
    const nextIndex = (safeIndex + step + count) % count;
    setState({ lightboxUrl: photos[nextIndex], lightboxPhotos: photos, lightboxIndex: nextIndex, lightboxType: 'image' });
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
    if (imageEl) {
      imageEl.classList.remove('swiping');
      imageEl.style.transform = '';
      imageEl.style.opacity = '';
    }
    resetOverlayParallax();
  };

  const onTouchStart = (e) => {
    if (!imageEl) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchDx = 0;
    imageEl.classList.add('swiping');
    overlay.classList.add('swiping');
  };

  const onTouchMove = (e) => {
    if (!hasCarousel || !imageEl) return;
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
    if (!hasCarousel || !imageEl) {
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
  if (hasCarousel && type !== 'video') {
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
    if (!hasCarousel || type === 'video') return;
    if (e.key === 'ArrowLeft') move(-1);
    if (e.key === 'ArrowRight') move(1);
  };
  document.addEventListener('keydown', activeKeyHandler);
}
