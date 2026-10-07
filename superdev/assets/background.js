// Textures baked from the original Blender scene; browser transforms handle motion.
import sprites from './3d/background-sprites.js';
import { reduced, saveData } from './gfx.js';

export async function initBg3d() {
  if (saveData || document.querySelector('.bg3d')) return;
  const sky = document.createElement('div');
  sky.className = 'bg3d';
  sky.setAttribute('aria-hidden', 'true');
  const nativeScroll = !reduced && CSS.supports('animation-timeline: scroll(root block)');
  // The painted starfield carries the small particles; keep a few foreground rocks/stars.
  const selected = sprites.items.filter((data, index) => data.kind === 'planet' || data.kind === 'portal' || index % 6 === 0);
  const items = selected.map((data, index) => {
    const node = document.createElement('span');
    node.className = `bg-item${nativeScroll ? ' bg-scroll' : ''}`;
    const image = document.createElement('img');
    image.className = `bg-art${data.kind === 'planet' || data.kind === 'portal' ? ' bg-drift' : ''}`;
    image.src = `assets/img/motion/${data.file}`;
    image.alt = '';
    image.width = data.pixelWidth || 768;
    image.height = data.pixelHeight || 768;
    image.decoding = 'async';
    image.style.animationDuration = `${7 + index % 5}s`;
    image.style.animationDelay = `${-index * 0.7}s`;
    node.append(image);
    sky.append(node);
    return { node, image, data, scale: 1 };
  });
  (document.querySelector('.starfield') || document.body.firstElementChild).after(sky);

  let width = 0, height = 0, maxScroll = 1, queued = false;
  const readPage = () => { maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight); };
  const position = () => {
    queued = false;
    const cameraY = -Math.min(1, scrollY / maxScroll) * sprites.col;
    for (const item of items) item.node.style.transform = `translate3d(0,${cameraY * item.scale}px,0)`;
  };
  const queuePosition = () => {
    if (nativeScroll || queued) return;
    queued = true;
    requestAnimationFrame(position);
  };
  const resize = () => {
    const w = sky.clientWidth, h = sky.clientHeight;
    readPage();
    if (w === width && h === height) { queuePosition(); return; }
    width = w; height = h;
    const aspect = w / h;
    const halfWidth = Math.max(12 * Math.min(1, aspect / 1.6), 5.6);
    const kx = Math.min(1, Math.max(0.46, aspect / 1.6));
    for (const item of items) {
      const [x, y, z] = item.data.center;
      item.scale = w / (2 * halfWidth) * 16 / Math.max(5, 16 - z);
      const iw = (item.data.width || item.data.span) * item.scale, ih = (item.data.height || item.data.span) * item.scale;
      const [ox, oy] = item.data.offset || [0, 0];
      item.node.style.cssText = `width:${iw}px;height:${ih}px;left:${w / 2 + (x * kx + ox) * item.scale - iw / 2}px;top:${h / 2 - (y - oy) * item.scale - ih / 2}px;--travel:${-sprites.col * item.scale}px;z-index:${Math.round(z * 100) + 2000}`;
      item.image.style.setProperty('--float', `${Math.min(12, item.data.bob * item.scale)}px`);
    }
    queuePosition();
  };
  resize();
  let timer;
  addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(resize, 120); }, { passive: true });
  if (!nativeScroll) {
    addEventListener('scroll', queuePosition, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(() => { readPage(); queuePosition(); }).observe(document.body);
  }
  if ('IntersectionObserver' in window) {
    const visible = new IntersectionObserver(entries => {
      for (const entry of entries) entry.target.firstElementChild.classList.toggle('is-off', !entry.isIntersecting);
    }, { rootMargin: '80px' });
    items.filter(item => item.image.classList.contains('bg-drift')).forEach(item => visible.observe(item.node));
  }
  await Promise.all(items.slice(0, 13).map(item => item.image.decode().catch(() => {})));
  sky.classList.add('on');
  if (location.search.includes('perf')) window.__backgroundMotion = { nativeScroll, items };
}
