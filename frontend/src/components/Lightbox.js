import { setState } from '../state.js';

export function renderLightbox(container, url) {
  container.innerHTML = `
    <div class="lightbox-overlay" id="lightbox">
      <button class="lightbox-close" id="lb-close" title="Закрыть">✕</button>
      <img src="${url}" alt="фото" class="lightbox-img" id="lb-img"/>
    </div>
  `;

  const close = () => setState({ lightboxUrl: null });
  container.querySelector('#lb-close').addEventListener('click', close);
  container.querySelector('#lightbox').addEventListener('click', e => {
    if (e.target.id === 'lightbox') close();
  });

  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}
