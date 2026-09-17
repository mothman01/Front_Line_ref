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

// Rich-text editor (contenteditable) for bio/about
(function () {
  const editors = document.querySelectorAll('.rich-content');
  if (!editors.length) return;

  // Toolbar command handling
  document.querySelectorAll('.rich-toolbar').forEach((toolbar) => {
    toolbar.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const cmd = btn.dataset.cmd;
        const value = btn.dataset.value || null;
        const targetId = toolbar.dataset.target;
        const editor = document.getElementById(targetId);
        if (!editor) return;
        editor.focus();
        document.execCommand(cmd, false, value);
      });
    });
  });

  // On form submit, copy editor HTML into the hidden textarea.
  const form = document.getElementById('content-form');
  if (form) {
    form.addEventListener('submit', () => {
      const bioEditor = document.getElementById('bio_body_editor');
      const bioTextarea = document.getElementById('bio_body_textarea');
      if (bioEditor && bioTextarea) bioTextarea.value = bioEditor.innerHTML;

      const aboutEditor = document.getElementById('about_body_editor');
      const aboutTextarea = document.getElementById('about_body_textarea');
      if (aboutEditor && aboutTextarea) aboutTextarea.value = aboutEditor.innerHTML;
    });
  }
})();

// Profile picture upload
(function () {
  const btn = document.getElementById('profile-upload-btn');
  const input = document.getElementById('profile-file-input');
  const csrf = document.getElementById('profile-csrf')?.value;
  if (!btn || !input) return;

  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const res = await fetch('/admin/profile-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _csrf: csrf, filename: file.name, mimeType: file.type, dataUrl: e.target.result }),
      });
      if (res.ok) location.reload();
      else alert('Upload failed.');
    };
    reader.readAsDataURL(file);
  });
})();
