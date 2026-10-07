// เอฟเฟกต์บนหน้า: เผยเนื้อหาตอนเลื่อน, parallax ของฉากบนสุด, การ์ดเรืองแสง/เอียงตามเมาส์,
// เส้นทางภารกิจ และปุ่มสมัครบน header ที่โผล่เฉพาะตอนไม่มีปุ่มสมัครอื่นอยู่ในจอ
// ทั้งหมดเป็นส่วนเสริม เนื้อหาอ่านได้ครบแม้ไฟล์นี้ไม่ทำงาน
import { reduced, coarse } from './gfx.js';
import './motion.js';

export function initFx() {
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  const heroInner = hero?.querySelector('.hero-inner');
  const heroLogo = hero?.querySelector('.hero-logo');
  const heroHam = hero?.querySelector('.hero-ham');
  const heroLayers = [...(hero?.querySelectorAll('.sc-layer') || [])].map(el => ({ el, depth: Number(el.style.getPropertyValue('--k')) }));
  const terrain = [...(hero?.querySelectorAll('.sc-terrain') || [])];
  let mouseX = 0, mouseY = 0, heroDirty = true, heroWidth = 1, heroTop = 0;
  const paintHero = progress => {
    if (heroInner) {
      heroInner.style.translate = `0 ${progress * 50}px`;
      heroInner.style.opacity = Math.max(0, 1 - progress * 1.15);
    }
    for (const { el, depth } of heroLayers) el.style.translate = `${-mouseX * depth}px ${-mouseY * depth + progress * depth * 5}px`;
    for (const el of terrain) el.style.translate = `${-mouseX * 60}px ${progress * 120}px`;
    if (heroHam) heroHam.style.translate = `${mouseX * 34}px ${mouseY * 24 + progress * 160}px`;
    if (heroLogo) heroLogo.style.transform = `perspective(1000px) rotateY(${mouseX * 12}deg) rotateX(${-mouseY * 10}deg)`;
    heroDirty = false;
  };
  const road = document.querySelector('.road');
  const hasIO = 'IntersectionObserver' in window;

  // Use browser visibility notifications instead of measuring every pending item on scroll.
  let pending = [...document.querySelectorAll('.reveal')];
  const reveal = vh => {
    if (!pending.length) return;
    const shown = [];
    pending = pending.filter(el => {
      if (el.getBoundingClientRect().top > vh * 0.94) return true; // ยังอยู่ใต้จอ
      shown.push(el); // อยู่ในจอ หรือถูกเลื่อนผ่านไปแล้ว (เช่น กระโดดด้วยลิงก์เมนู)
      return false;
    });
    for (const el of shown) el.classList.add('in'); // เขียนทีหลังอ่านครบ
  };
  if (reduced) {
    pending.forEach(el => el.classList.add('in'));
    pending = [];
  } else if (hasIO) {
    const visible = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (!en.isIntersecting && en.boundingClientRect.bottom > 0) continue;
        en.target.classList.add('in');
        visible.unobserve(en.target);
      }
    }, { rootMargin: '0px 0px -40px 0px' });
    pending.forEach(el => visible.observe(el));
    pending = [];
  }

  // These dimensions change with layout, not with the scroll position.
  let heroH = 0, roadTop = 0, roadH = 0, measured = false;
  const measure = () => {
    heroH = hero && !reduced && !coarse ? hero.offsetHeight || 1 : 0;
    if (heroH) {
      heroWidth = hero.clientWidth || 1;
      heroTop = hero.getBoundingClientRect().top + scrollY;
    }
    const r = road?.getBoundingClientRect();
    roadTop = r ? r.top + scrollY : 0;
    roadH = r?.height || 0;
    measured = true;
  };
  let previousHero = '', previousRoad = '', previousHeader;

  // งานที่ผูกกับการเลื่อน รวมไว้ในเฟรมเดียว
  let queued = false;
  const onScroll = () => {
    queued = false;
    // อ่านตำแหน่งทั้งหมดก่อน แล้วค่อยเขียน — ไม่บังคับให้เบราว์เซอร์คำนวณ layout ซ้ำกลางเฟรม (ลื่นขึ้นมากบน iOS)
    const y = scrollY, vh = innerHeight;
    if (!measured) measure();
    const roadY = roadTop - y;
    reveal(vh);
    const scrolled = y > 12;
    if (previousHeader !== scrolled) {
      header?.classList.toggle('scrolled', scrolled);
      previousHeader = scrolled;
    }
    if (heroH && y <= heroH) {
      const value = (y / heroH).toFixed(3);
      if (value !== previousHero || heroDirty) paintHero(y / heroH);
      previousHero = value;
    }
    // เส้นทางภารกิจค่อย ๆ เติมสีตามการเลื่อน
    if (roadH && roadY + roadH > -200 && roadY < vh + 200) {
      const p = reduced ? 1 : Math.min(1, Math.max(0, (vh * 0.8 - roadY) / (roadH * 0.9 || 1)));
      const value = p.toFixed(4);
      if (value !== previousRoad) road.style.setProperty('--p', value);
      previousRoad = value;
    }
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(onScroll);
  };
  const layoutChanged = () => { measured = false; queue(); };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', layoutChanged, { passive: true });
  onScroll();
  // ฟอนต์/รูปที่โหลดทีหลังทำให้ตำแหน่งขยับ จึงตรวจซ้ำอีกรอบ
  addEventListener('load', layoutChanged, { once: true });
  document.fonts?.ready.then(layoutChanged);
  if ('ResizeObserver' in window) {
    const layout = new ResizeObserver(layoutChanged);
    [document.querySelector('main'), hero, road].filter(Boolean).forEach(el => layout.observe(el));
  }
  setTimeout(layoutChanged, 600);

  if (hasIO) {
    // หยุดแอนิเมชันของส่วนที่อยู่นอกจอ เพื่อไม่ให้เครื่องทำงานกับสิ่งที่มองไม่เห็น
    const idle = new IntersectionObserver(entries => {
      for (const en of entries) en.target.classList.toggle('is-off', !en.isIntersecting);
    }, { rootMargin: '120px' });
    document.querySelectorAll('.hero, .section, .cz').forEach(el => idle.observe(el));

    // ปุ่มสมัครบน header: แสดงเฉพาะตอนที่ไม่มีปุ่มสมัครหลักอยู่ในจอ (เห็นปุ่มสมัครทีละปุ่ม)
    const mains = document.querySelectorAll('main a[data-register]');
    if (header && mains.length) {
      header.classList.add('cta-auto');
      const seen = new Set();
      const io = new IntersectionObserver(entries => {
        for (const en of entries) en.isIntersecting ? seen.add(en.target) : seen.delete(en.target);
        header.classList.toggle('show-cta', seen.size === 0);
      });
      mains.forEach(el => io.observe(el));
    }

    // โมเดล 3D: โหลดเมื่อเลื่อนใกล้ถึงส่วนนั้นเท่านั้น
    const stage = document.querySelector('canvas[data-model]')?.closest('.section');
    if (stage) {
      const near = new IntersectionObserver(entries => {
        if (!entries.some(en => en.isIntersecting)) return;
        near.disconnect();
        import('./models.js').then(m => m.initModels()).catch(() => {});
      }, { rootMargin: '500px' });
      near.observe(stage);
    }
  }

  // เอฟเฟกต์ตามเมาส์ (เฉพาะอุปกรณ์ที่มีเมาส์)
  if (!coarse && !reduced) {
    if (hero) {
      hero.addEventListener('pointermove', ev => {
        mouseX = ev.clientX / heroWidth - 0.5;
        mouseY = (ev.clientY - heroTop + scrollY) / (heroH || 1) - 0.5;
        heroDirty = true;
        queue();
      });
      hero.addEventListener('pointerleave', () => {
        mouseX = mouseY = 0;
        heroDirty = true;
        queue();
      });
    }
    document.addEventListener('pointermove', ev => {
      const el = ev.target.closest?.('.glow');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      if (el.classList.contains('tilt')) {
        el.style.setProperty('--rx', (x - 0.5).toFixed(3));
        el.style.setProperty('--ry', (y - 0.5).toFixed(3));
      }
    }, { passive: true });
    document.querySelectorAll('.tilt').forEach(el =>
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--rx', 0);
        el.style.setProperty('--ry', 0);
      }));
  }
}
