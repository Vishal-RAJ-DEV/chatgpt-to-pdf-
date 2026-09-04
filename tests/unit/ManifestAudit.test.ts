import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('Manifest Audit & Production Permissions Minimization Tests', () => {
  const manifestPath = path.resolve(process.cwd(), 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  it('1. complies with Manifest V3 specification requirements', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('ChatGPT PDF Exporter');
    expect(manifest.version).toBe('0.1.0');
    expect(manifest.description).toBeDefined();
    expect(manifest.minimum_chrome_version).toBe('110');
  });

  it('2. enforces strict permissions minimization (no over-privileged permissions)', () => {
    const allowedPermissions = ['storage', 'activeTab'];
    const declaredPermissions: string[] = manifest.permissions || [];

    // Verify only minimum required permissions are requested
    expect(declaredPermissions.length).toBeLessThanOrEqual(allowedPermissions.length);
    for (const perm of declaredPermissions) {
      expect(allowedPermissions).toContain(perm);
    }

    // Verify forbidden high-risk permissions are NOT present
    const forbiddenPermissions = [
      '<all_urls>',
      'tabs',
      'scripting',
      'webRequest',
      'cookies',
      'debugger',
      'proxy',
      'nativeMessaging',
    ];
    for (const forbidden of forbiddenPermissions) {
      expect(declaredPermissions).not.toContain(forbidden);
    }
  });

  it('3. restricts content script match patterns to chatgpt.com domain only', () => {
    expect(manifest.content_scripts).toBeDefined();
    expect(manifest.content_scripts.length).toBeGreaterThan(0);

    const scriptEntry = manifest.content_scripts[0];
    expect(scriptEntry.matches).toContain('https://chatgpt.com/*');
    expect(scriptEntry.matches.length).toBe(1);
    expect(scriptEntry.matches).not.toContain('<all_urls>');
    expect(scriptEntry.matches).not.toContain('*://*/*');
  });

  it('4. verifies manifest-referenced source files exist in repository', () => {
    expect(manifest.action.default_popup).toBe('src/ui/popup/popup.html');
    expect(fs.existsSync(path.resolve(process.cwd(), manifest.action.default_popup))).toBe(true);

    expect(manifest.options_page).toBe('src/ui/options/options.html');
    expect(fs.existsSync(path.resolve(process.cwd(), manifest.options_page))).toBe(true);
  });
});
