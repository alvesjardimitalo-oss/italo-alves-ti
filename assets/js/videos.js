/* Carrega reprodutores externos apenas após clique explícito. */
document.addEventListener('click', function(event) {
  const button = event.target.closest('.video-play');
  if (!button) return;
  const card = button.closest('.video-aula');
  if (!card) return;
  const id = card.getAttribute('data-video-id') || '';
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
  const cover = card.querySelector('.video-capa');
  if (!cover || cover.querySelector('iframe')) return;
  const iframe = document.createElement('iframe');
  iframe.title = card.getAttribute('data-video-title') || 'Vídeo educativo';
  iframe.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.allowFullscreen = true;
  cover.replaceChildren(iframe);
});