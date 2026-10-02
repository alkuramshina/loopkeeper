import '@testing-library/jest-dom/vitest';
HTMLDialogElement.prototype.show = function () {
  this.open = true;
};

// JSDOM does not implement the native dialog API used by ModalDialog.
if (
  !Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
}
if (!Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')) {
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
}
