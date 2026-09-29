/** Phần tử có thể Tab tới, đang hiện trên màn hình. */
export function focusableIn(root: HTMLElement): HTMLElement[] {
  const sel = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  return Array.from(root.querySelectorAll<HTMLElement>(sel)).filter(
    (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
  );
}

/** Giữ Tab trong hộp thoại; gọi từ keydown. */
export function trapTab(root: HTMLElement, e: KeyboardEvent) {
  if (e.key !== "Tab") return;
  const nodes = focusableIn(root);
  if (nodes.length === 0) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
