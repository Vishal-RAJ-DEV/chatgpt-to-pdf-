/**
 * Popup script — Phase 1.
 *
 * Wires the "Open Settings" button to the extension options page.
 */

document.addEventListener('DOMContentLoaded', () => {
  const settingsBtn = document.getElementById('open-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
});
