/**
 * Thin shims over APIs whose global names were deprecated in v13 and are
 * namespaced from then on. Keeping them in one place makes the rest of the
 * module read the same on 13 and 14.
 */

export const renderTemplate = (path, data) =>
  (foundry.applications.handlebars?.renderTemplate ?? globalThis.renderTemplate)(path, data);

export const loadTemplates = (paths) =>
  (foundry.applications.handlebars?.loadTemplates ?? globalThis.loadTemplates)(paths);

export function filePickerClass() {
  return foundry.applications.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
}

export function dialogClass() {
  return foundry.applications.api.DialogV2;
}
