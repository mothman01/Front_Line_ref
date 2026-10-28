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

  const readAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Upload one at a time, then reload once so no upload is cut off.
  async function handleFiles(files) {
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    dropzone.classList.add('is-busy');
    let failed = 0;
    for (const file of images) {
      const res = await fetch('/admin/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _csrf: csrf, filename: file.name, mimeType: file.type, dataUrl: await readAsDataUrl(file) }),
      });
      if (!res.ok) failed++;
    }
    if (failed) alert(failed + ' photo(s) failed to upload. Use PNG, JPEG, WebP or GIF under 10 MB.');
    location.reload();
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

// Confirm prompts for destructive admin forms (inline handlers are blocked by CSP)
document.addEventListener('submit', function (e) {
  const msg = e.target.getAttribute && e.target.getAttribute('data-confirm');
  if (msg && !window.confirm(msg)) e.preventDefault();
});

// Admin: per-course photo upload
(function () {
  const csrf = document.getElementById('course-photo-csrf')?.value;
  document.querySelectorAll('.course-photo-btn').forEach((btn) => {
    const input = btn.parentElement.querySelector('.course-photo-input');
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        btn.disabled = true;
        btn.textContent = 'Uploading…';
        const res = await fetch('/admin/course-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _csrf: csrf, courseId: input.dataset.courseId, filename: file.name, mimeType: file.type, dataUrl: e.target.result }),
        });
        if (res.ok) location.reload();
        else {
          const body = await res.json().catch(() => ({}));
          alert(body.error || 'Upload failed.');
          btn.disabled = false;
          btn.textContent = 'Upload Photo';
        }
      };
      reader.readAsDataURL(file);
    });
  });
})();

// Live seat tracker: refreshes "seats left" labels without reloading the page
(function () {
  const labels = Array.from(document.querySelectorAll('[data-seat-id]'));
  if (!labels.length) return;
  const ids = [...new Set(labels.map((el) => el.dataset.seatId))];

  function render(el, s) {
    const long = el.dataset.seatFormat === 'long';
    const full = s.seats_left === 0;
    el.textContent = s.past ? 'Ended' : full ? 'Full' : long ? `${s.seats_left} of ${s.capacity} seats left` : `${s.seats_left} seats left`;
    el.classList.toggle('is-full', full);
    const card = el.closest('.calendar-class');
    if (card) card.classList.toggle('is-full', full);
  }

  async function refresh() {
    if (document.hidden) return;
    try {
      const res = await fetch('/api/seats?ids=' + ids.join(','), { cache: 'no-store' });
      if (!res.ok) return;
      const { seats } = await res.json();
      const byId = Object.fromEntries(seats.map((s) => [String(s.id), s]));
      labels.forEach((el) => byId[el.dataset.seatId] && render(el, byId[el.dataset.seatId]));

      // On a class page, keep the seat picker within what's actually left.
      const picker = document.getElementById('checkout-seats');
      const mine = picker && byId[labels[0].dataset.seatId];
      if (mine) {
        Array.from(picker.options).forEach((o) => { o.disabled = Number(o.value) > mine.seats_left; });
        const btn = document.querySelector('#checkout-form button[type="submit"]');
        if (btn) {
          btn.disabled = mine.seats_left === 0;
          btn.textContent = mine.seats_left === 0 ? 'Class Full' : 'Pay in Full & Reserve';
        }
      }
    } catch {
      // Network blip; try again next tick.
    }
  }

  setInterval(refresh, 15000);
  document.addEventListener('visibilitychange', refresh);
})();

// Class checkout: show the total for the selected number of seats
(function () {
  const picker = document.getElementById('checkout-seats');
  const total = document.getElementById('checkout-total');
  if (!picker || !total) return;
  const unit = Number(total.dataset.unitCents);
  function update() {
    const cents = unit * Number(picker.value || 1);
    const dollars = cents / 100;
    total.textContent = '$' + (Number.isInteger(dollars) ? dollars : dollars.toFixed(2));
  }
  picker.addEventListener('change', update);
  update();
})();

// Admin: customer-view preview (page picker + device sizes)
(function () {
  const frame = document.getElementById('preview-frame');
  if (!frame) return;
  const picker = document.getElementById('preview-page');
  const open = document.getElementById('preview-open');
  const devices = document.querySelectorAll('.preview-devices button');

  picker.addEventListener('change', () => {
    frame.src = picker.value;
    open.href = picker.value;
  });
  document.getElementById('preview-reload').addEventListener('click', () => {
    frame.contentWindow.location.reload();
  });
  devices.forEach((btn) => {
    btn.addEventListener('click', () => {
      devices.forEach((b) => b.classList.toggle('active', b === btn));
      frame.className = 'preview-frame is-' + btn.dataset.device;
    });
  });
  // Keep "Open in new tab" pointed at whatever page the owner clicked to.
  frame.addEventListener('load', () => {
    try {
      const path = frame.contentWindow.location.pathname + frame.contentWindow.location.search;
      open.href = path;
      const match = Array.from(picker.options).find((o) => o.value === path);
      if (match) picker.value = path;
    } catch {
      // Cross-origin (e.g. Stripe) — leave as is.
    }
  });
})();

// Admin: safety rules add/remove
(function () {
  const list = document.getElementById('rule-list');
  const add = document.getElementById('rule-add');
  const tpl = document.getElementById('rule-template');
  if (!list || !add || !tpl) return;
  add.addEventListener('click', () => {
    list.appendChild(tpl.content.cloneNode(true));
    list.lastElementChild.querySelector('input').focus();
  });
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.rule-remove');
    if (btn && window.confirm('Remove this rule? It will be deleted when you save.')) {
      btn.closest('.rule-editor').remove();
    }
  });
})();

// Admin: quick filter for tables (e.g. waivers)
(function () {
  document.querySelectorAll('.table-filter').forEach((input) => {
    const table = document.getElementById(input.dataset.filterTable);
    if (!table) return;
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      table.querySelectorAll('tbody tr').forEach((tr) => {
        tr.hidden = q && !tr.textContent.toLowerCase().includes(q);
      });
    });
  });
})();

// Admin: keyboard access for the photo drop zone
(function () {
  const dz = document.getElementById('image-dropzone');
  if (!dz) return;
  dz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      document.getElementById('image-file-input').click();
    }
  });
})();
