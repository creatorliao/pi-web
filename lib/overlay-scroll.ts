const overlayScrollTimers = new WeakMap<Element, number>();

/** 滚动时给容器加上 is-scrolling，约 800ms 后去掉，配合 overlay 细条显现。 */
export function markOverlayScrolling(target: EventTarget | null): void {
  if (!(target instanceof HTMLElement)) return;
  target.classList.add("is-scrolling");
  const previous = overlayScrollTimers.get(target);
  if (previous !== undefined) window.clearTimeout(previous);
  const next = window.setTimeout(() => {
    target.classList.remove("is-scrolling");
    overlayScrollTimers.delete(target);
  }, 800);
  overlayScrollTimers.set(target, next);
}
