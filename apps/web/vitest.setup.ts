import '@testing-library/jest-dom/vitest';

// jsdom chưa cài showModal/close của <dialog>; test môi trường node không có HTMLDialogElement.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
}
