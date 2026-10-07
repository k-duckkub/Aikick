// Native horizontal scrolling handles touch and trackpads. Entrance animations
// use transform/opacity; arrows appear when the actual animations finish.
export function initSkillCarousel() {
  const root = document.querySelector('[data-skill-carousel]');
  if (!root) return;
  const track = root.querySelector('.skills-track');
  const slides = [...root.querySelectorAll('.skill-slide')];
  const pages = [...root.querySelectorAll('[data-skill-page]')];
  const previous = root.querySelector('[data-skill-prev]');
  const next = root.querySelector('[data-skill-next]');
  const status = root.querySelector('.skill-status');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0, width = 0, visible = false, ready = false;
  let revision = 0, jobs = [], starting = false, started = -1;
  let queued = false, drag = null;
  const clamp = i => Math.max(0, Math.min(slides.length - 1, i));

  const cancel = () => {
    revision++;
    for (const job of jobs) job.cancel();
    jobs = [];
    starting = false;
  };
  const finish = token => {
    if (token !== revision) return;
    for (const job of jobs) job.cancel();
    jobs = [];
    ready = true;
    root.classList.add('is-ready');
    previous.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    status.textContent = `ทักษะ ${current + 1} จาก ${slides.length}: ${slides[current].querySelector('.skill-title').textContent}`;
  };
  const play = async () => {
    if (!visible || starting || started === current) return;
    starting = true;
    const token = revision, slide = slides[current];
    try { await slide.querySelector('img').decode(); } catch {}
    if (token !== revision) return;
    starting = false;
    if (!visible) return;
    started = current;
    root.classList.add('has-entered');
    if (motion.matches || !slide.animate) { finish(token); return; }
    jobs = [
      slide.querySelector('.skill-visual').animate([
        { opacity: 0, transform: 'translate3d(36px, 26px, 0) scale(0.76) rotate(-9deg)' },
        { opacity: 1, transform: 'translate3d(0, -8px, 0) scale(1.04) rotate(2deg)', offset: 0.76 },
        { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1) rotate(0deg)' },
      ], { duration: 760, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }),
      slide.querySelector('.skill-copy').animate([
        { opacity: 0, transform: 'translate3d(0, 18px, 0)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0)' },
      ], { duration: 420, delay: 220, easing: 'ease-out', fill: 'both' }),
    ];
    Promise.allSettled(jobs.map(job => job.finished)).then(() => finish(token));
  };
  const select = i => {
    cancel();
    current = clamp(i);
    started = -1;
    ready = false;
    root.classList.remove('is-ready');
    previous.disabled = next.disabled = true;
    slides.forEach((slide, index) => {
      slide.classList.toggle('is-active', index === current);
      slide.setAttribute('aria-hidden', String(index !== current));
      slide.inert = index !== current;
    });
    pages.forEach((page, index) => page.setAttribute('aria-pressed', String(index === current)));
    root.style.setProperty('--c', slides[current].style.getPropertyValue('--c'));
    play();
  };
  const measure = () => {
    const nextWidth = track.clientWidth;
    if (!nextWidth || nextWidth === width) return;
    width = nextWidth;
    // Resize follows the selected slide immediately, without changing the slide.
    track.style.scrollBehavior = 'auto';
    track.scrollLeft = current * width;
    requestAnimationFrame(() => { track.style.scrollBehavior = ''; });
  };
  const go = i => {
    if (!width) measure();
    track.scrollTo({ left: clamp(i) * width, behavior: motion.matches ? 'auto' : 'smooth' });
  };
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (drag || !width) return;
      const i = clamp(Math.round(track.scrollLeft / width));
      if (i !== current) select(i);
    });
  };

  root.classList.add('is-enhanced');
  root.querySelector('.skill-arrows').hidden = false;
  root.querySelector('.skill-navigation').hidden = false;
  slides.forEach(slide => { slide.querySelector('img').draggable = false; });
  measure();
  select(0);
  track.addEventListener('scroll', onScroll, { passive: true });
  previous.addEventListener('click', () => { if (ready) go(current - 1); });
  next.addEventListener('click', () => { if (ready) go(current + 1); });
  pages.forEach(page => page.addEventListener('click', () => go(Number(page.dataset.skillPage))));
  root.addEventListener('keydown', event => {
    const i = event.key === 'ArrowRight' ? current + 1 : event.key === 'ArrowLeft' ? current - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : null;
    if (i === null) return;
    event.preventDefault();
    go(i);
  });

  // Touch stays native, so vertical page scrolling remains available. Mouse
  // dragging uses cached coordinates and does not measure layout during moves.
  track.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    event.preventDefault();
    drag = { id: event.pointerId, x: event.clientX, left: track.scrollLeft, index: current };
    root.classList.add('is-dragging');
    track.setPointerCapture(event.pointerId);
    track.focus({ preventScroll: true });
  });
  track.addEventListener('pointermove', event => {
    if (drag?.id === event.pointerId) track.scrollLeft = drag.left - (event.clientX - drag.x);
  });
  const endDrag = event => {
    if (drag?.id !== event.pointerId) return;
    const start = drag, delta = event.clientX - start.x;
    const nearest = clamp(Math.round(track.scrollLeft / width));
    let target = nearest;
    if (event.type !== 'pointercancel' && Math.abs(delta) > Math.min(80, width * 0.12) && nearest === start.index) target = clamp(start.index + (delta < 0 ? 1 : -1));
    drag = null;
    root.classList.remove('is-dragging');
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    go(target);
    onScroll();
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('lostpointercapture', event => { if (drag?.id === event.pointerId) endDrag(event); });

  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(track);
  else addEventListener('resize', measure, { passive: true });
  document.fonts?.ready.then(measure);
  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      near.disconnect();
      slides.forEach(slide => { const img = slide.querySelector('img'); img.loading = 'eager'; img.decode().catch(() => {}); });
    }, { rootMargin: '400px' });
    near.observe(root);
    const view = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.18;
      for (const job of jobs) visible ? job.play() : job.pause();
      if (visible) play();
    }, { threshold: [0, 0.18] });
    view.observe(root);
  } else { visible = true; play(); }
  motion.addEventListener?.('change', () => {
    if (motion.matches && !ready) { cancel(); started = current; root.classList.add('has-entered'); finish(revision); }
  });
}
