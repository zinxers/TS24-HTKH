/** Thêm class `closing` để CSS chạy animation đóng, chạy xong mới gọi `done`. Không có animation (jsdom, CSS chưa nạp) thì gọi ngay. */
export function animateOut(dialog: HTMLDialogElement, done: () => void) {
  dialog.classList.add('closing');
  const name = getComputedStyle(dialog).animationName;
  if (!name || name === 'none') return done();
  const onEnd = (e: AnimationEvent) => {
    if (e.target !== dialog) return;
    dialog.removeEventListener('animationend', onEnd);
    // Đã mở lại trong lúc đang đóng (class bị gỡ): không gỡ hộp thoại.
    if (dialog.classList.contains('closing')) done();
  };
  dialog.addEventListener('animationend', onEnd);
}
