// Progressive enhancements. All navigation, docs and image links work without JavaScript.
for (const button of document.querySelectorAll('[data-copy]')) {
  const command = document.getElementById(button.dataset.copy);
  if (!command) continue;
  button.hidden = false;
  button.addEventListener('click', async () => {
    const status = button.closest('.command-panel')?.querySelector('[role="status"]');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(command.textContent.trim());
      if (status) status.textContent = 'Commands copied.';
    } catch {
      // Do not claim success when browser clipboard permission is unavailable.
      command.focus();
      if (status)
        status.textContent = 'Copy unavailable. Select the commands and copy them manually.';
    }
  });
}
const viewer = document.querySelector('.image-viewer');
if (viewer && typeof viewer.showModal === 'function') {
  let opener;
  const viewerImage = viewer.querySelector('.viewer-image');
  const caption = viewer.querySelector('#viewer-caption');
  const closeButton = viewer.querySelector('.viewer-close');
  for (const link of document.querySelectorAll('[data-viewer]')) {
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const sourceImage = link.querySelector('img');
      if (!sourceImage || !viewerImage || !caption) return;
      event.preventDefault();
      opener = link;
      viewerImage.src = sourceImage.currentSrc || sourceImage.src;
      viewerImage.alt = sourceImage.alt;
      caption.textContent = link.dataset.caption;
      viewer.showModal();
      closeButton.focus();
    });
  }
  closeButton.addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', (event) => {
    if (event.target !== viewer) return;
    const bounds = viewer.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      viewer.close();
  });
  viewer.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      closeButton.focus();
    }
  });
  viewer.addEventListener('close', () => opener?.focus());
}
