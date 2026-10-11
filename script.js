(() => {
  const SHEET_COUNT = 152;
  const FRAMES_PER_SHEET = 8;
  const FRAME_COUNT = 1210;
  const FRAME_WIDTH = 540;
  const FRAME_HEIGHT = 960;
  const journey = document.querySelector('#journey');
  const canvas = document.querySelector('#journeyCanvas');
  const context = canvas.getContext('2d', { alpha: false });
  const loader = document.querySelector('#filmLoader');
  const loaderFill = document.querySelector('#loaderFill');
  const loaderPct = document.querySelector('#loaderPct');
  const loaderLabel = document.querySelector('#loaderLabel');
  const chapters = [...document.querySelectorAll('.chapter')];
  const chapterButtons = [...document.querySelectorAll('[data-chapter]')];
  const starts = chapters.map((chapter) => Number(chapter.dataset.start));
  const sheets = Array.from({ length: SHEET_COUNT });
  const pending = new Map();
  const poster = new Image();
  poster.src = './assets/rameswaram-poster.jpg';
  let activeChapter = -1;
  let lastFrame = -1;
  let initialLoaded = 0;
  let ready = false;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const sheetUrl = (index) => `./assets/frames/${String(index).padStart(3, '0')}.webp`;

  function updateLoader() {
    const ratio = initialLoaded / 6;
    loaderFill.style.transform = `scaleX(${ratio})`;
    loaderPct.textContent = `${Math.round(ratio * 100)}%`;
    if (ratio >= 1 && !ready) {
      ready = true;
      loaderLabel.textContent = 'Your journey is ready';
      loader.classList.add('is-done');
      loader.setAttribute('aria-busy', 'false');
    }
  }

  function loadSheet(index) {
    if (index < 0 || index >= SHEET_COUNT) return Promise.resolve(null);
    if (sheets[index]) return Promise.resolve(sheets[index]);
    if (pending.has(index)) return pending.get(index);
    const promise = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => { sheets[index] = image; pending.delete(index); resolve(image); };
      image.onerror = () => { pending.delete(index); resolve(null); };
      image.src = sheetUrl(index);
    });
    pending.set(index, promise);
    return promise;
  }

  function drawCover(image, sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight) {
    if (!image?.naturalWidth) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = Math.max(width / sw, height / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    context.drawImage(image, sx, sy, sw, sh, (width - dw) / 2, (height - dh) / 2, dw, dh);
  }

  function frameAt(progress) {
    return Math.min(FRAME_COUNT - 1, Math.round(progress * (FRAME_COUNT - 1)));
  }

  function paintFrame(frame) {
    const sheetIndex = Math.floor(frame / FRAMES_PER_SHEET);
    const cell = frame % FRAMES_PER_SHEET;
    const image = sheets[sheetIndex];
    if (image) {
      drawCover(image, (cell % 4) * FRAME_WIDTH, Math.floor(cell / 4) * FRAME_HEIGHT, FRAME_WIDTH, FRAME_HEIGHT);
      lastFrame = frame;
      return;
    }
    drawCover(poster);
    loadSheet(sheetIndex).then(() => { if (frame === frameAt(progress())) paintFrame(frame); });
  }

  function progress() {
    return clamp((window.scrollY - journey.offsetTop) / Math.max(1, journey.offsetHeight - window.innerHeight), 0, 1);
  }

  function chapterFor(value) {
    return starts.reduce((current, start, index) => value >= start ? index : current, 0);
  }

  function preloadWindow(frame) {
    const centre = Math.floor(frame / FRAMES_PER_SHEET);
    for (let index = centre - 2; index <= centre + 8; index += 1) loadSheet(index);
  }

  function update() {
    const value = progress();
    const frame = frameAt(value);
    if (frame !== lastFrame) paintFrame(frame);
    preloadWindow(frame);
    const chapterIndex = chapterFor(value);
    if (chapterIndex !== activeChapter) {
      chapters.forEach((chapter, index) => {
        const selected = index === chapterIndex;
        chapter.classList.toggle('is-active', selected);
        chapter.setAttribute('aria-hidden', String(!selected));
      });
      chapterButtons.forEach((button, index) => index === chapterIndex ? button.setAttribute('aria-current', 'step') : button.removeAttribute('aria-current'));
      document.querySelector('#chapterNumber').textContent = String(chapterIndex + 1).padStart(2, '0');
      document.querySelector('#chapterName').textContent = chapters[chapterIndex].dataset.name;
      activeChapter = chapterIndex;
    }
    document.querySelector('#progressFill').style.transform = `scaleX(${value})`;
  }

  function goToChapter(index) {
    const target = starts[index] ?? 0;
    window.scrollTo({ top: journey.offsetTop + target * (journey.offsetHeight - window.innerHeight), behavior: 'smooth' });
  }

  poster.onload = () => { drawCover(poster); };
  Promise.all(Array.from({ length: 6 }, (_, index) => loadSheet(index).then((image) => { if (image) initialLoaded += 1; updateLoader(); }))).then(update);
  // Warm the remaining source film in a small queue, without flooding mobile memory.
  let nextWarmSheet = 6;
  const warmFilm = async () => {
    while (nextWarmSheet < SHEET_COUNT) {
      const sheet = nextWarmSheet;
      nextWarmSheet += 1;
      await loadSheet(sheet);
    }
  };
  Promise.all(Array.from({ length: 6 }, warmFilm)).catch(() => {});
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  chapterButtons.forEach((button) => button.addEventListener('click', () => goToChapter(Number(button.dataset.chapter))));
  document.querySelector('#nextChapter').addEventListener('click', () => goToChapter(activeChapter >= chapters.length - 1 ? 0 : activeChapter + 1));

  const details = document.querySelector('#details');
  const rsvp = document.querySelector('#rsvpDialog');
  document.querySelectorAll('[data-open-details]').forEach((button) => button.addEventListener('click', () => details.showModal()));
  document.querySelector('[data-close-details]').addEventListener('click', () => details.close());
  document.querySelectorAll('[data-open-rsvp]').forEach((button) => button.addEventListener('click', () => { if (details.open) details.close(); rsvp.showModal(); }));
  document.querySelector('[data-close-rsvp]').addEventListener('click', () => rsvp.close());
  [details, rsvp].forEach((dialog) => dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); }));

  const calendar = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Rahul and Kiran//Wedding Invitation//EN','BEGIN:VEVENT','UID:rahul-kiran-2026@example','DTSTART;VALUE=DATE:20261201','DTEND;VALUE=DATE:20261202','SUMMARY:Rahul & Kiran Wedding and Reception','DESCRIPTION:Wedding and reception. Time and venue to be shared.','END:VEVENT','END:VCALENDAR'].join('\r\n');
  document.querySelector('#saveDate').href = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar' }));

  const form = document.querySelector('#rsvpForm');
  const guestField = document.querySelector('#guestField');
  const syncGuests = () => { const attending = form.elements.attendance.value === 'yes'; guestField.hidden = !attending; form.elements.guests.disabled = !attending; };
  form.elements.attendance.addEventListener('change', syncGuests);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    if (!values.name.trim()) return;
    try { localStorage.setItem('rahul-kiran-rsvp-preview', JSON.stringify(values)); document.querySelector('#rsvpStatus').textContent = `Thank you, ${values.name.trim()}. Your reply is saved on this device.`; }
    catch { document.querySelector('#rsvpStatus').textContent = 'Your browser could not save this reply. Nothing was sent.'; }
  });
})();
