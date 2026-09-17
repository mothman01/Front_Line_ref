// Mobile navigation toggle
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');

  if (!toggle || !nav) return;

  toggle.addEventListener('click', function () {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
})();

// Slideshow (homepage gallery)
(function () {
  const slideshow = document.querySelector('.slideshow');
  if (!slideshow) return;

  const slides = Array.from(slideshow.querySelectorAll('.slide'));
  const dots = Array.from(slideshow.querySelectorAll('.dot'));
  const prev = slideshow.querySelector('.prev');
  const next = slideshow.querySelector('.next');
  let current = 0;
  let timer;

  function show(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle('active', i === current));
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
  }

  function advance() {
    show(current + 1);
  }

  if (next) next.addEventListener('click', () => { show(current + 1); restart(); });
  if (prev) prev.addEventListener('click', () => { show(current - 1); restart(); });
  dots.forEach((d) => d.addEventListener('click', () => { show(Number(d.dataset.index)); restart(); }));

  function restart() {
    clearInterval(timer);
    timer = setInterval(advance, 5000);
  }

  if (slides.length > 1) timer = setInterval(advance, 5000);
})();

// Admin: drag-and-drop image upload
(function () {
  const dropzone = document.getElementById('image-dropzone');
  if (!dropzone) return;

  const fileInput = document.getElementById('image-file-input');
  const csrf = document.getElementById('csrf-token')?.value;
  const thumbs = document.getElementById('image-thumbs');

  function handleFiles(files) {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadImage(file.name, file.type, e.target.result);
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(filename, mimeType, dataUrl) {
    const res = await fetch('/admin/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _csrf: csrf, filename, mimeType, dataUrl }),
    });
    if (res.ok) location.reload();
    else alert('Upload failed.');
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => handleFiles(fileInput.files));

  // Delete image buttons
  thumbs?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.remove-img');
    if (!btn) return;
    const id = btn.dataset.id;
    const res = await fetch('/admin/images/' + id, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _csrf: csrf }),
    });
    if (res.ok) location.reload();
  });
})();
