import '@testing-library/jest-dom/vitest';

// JSDOM does not implement the native dialog API used by ModalDialog.
HTMLDialogElement.prototype.showModal ??= function () { this.open = true; };
HTMLDialogElement.prototype.close ??= function () { this.open = false; };
