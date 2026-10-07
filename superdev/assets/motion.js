// Defer expensive first-time preparation until a scroll gesture settles.
export let scrolling = false;
const listeners = new Set();
let idleTimer;

const setScrolling = active => {
  if (scrolling === active) return;
  scrolling = active;
  for (const listener of listeners) listener(active);
};

addEventListener('scroll', () => {
  setScrolling(true);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => setScrolling(false), 160);
}, { passive: true });

export function onScrollActivity(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function waitForScrollIdle() {
  if (!scrolling) return Promise.resolve();
  return new Promise(resolve => {
    const unsubscribe = onScrollActivity(active => {
      if (active) return;
      unsubscribe();
      resolve();
    });
  });
}
