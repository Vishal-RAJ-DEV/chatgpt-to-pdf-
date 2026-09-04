import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('Manifest Audit & Production Permissions Minimization Tests', () => {
  const sourceManifestPath = path.resolve(process.cwd(), 'manifest.json');
  const distManifestPath = path.resolve(process.cwd(), 'dist/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(sourceManifestPath, 'utf8'));

  it('1. complies with Manifest V3 specification requirements', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('ChatGPT PDF Exporter');
    expect(manifest.version).toBe('0.1.0');
    expect(manifest.description).toBeDefined();
    expect(manifest.minimum_chrome_version).toBe('110');
  });

  it('2. verifies declared permissions are restricted to the verified allow-list', () => {
    const allowedPermissions = ['storage', 'activeTab'];
    const declaredPermissions: string[] = manifest.permissions || [];

    // Verify declared permissions match the allow-list
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

  it('5. validates built dist/manifest.json and verifies every manifest-referenced file exists in dist/', () => {
    expect(fs.existsSync(distManifestPath)).toBe(true);
    const distManifest = JSON.parse(fs.readFileSync(distManifestPath, 'utf8'));

    // Validate popup HTML exists inside dist/
    const popupRelPath = distManifest.action.default_popup;
    expect(popupRelPath).toBe('src/ui/popup/popup.html');
    expect(fs.existsSync(path.resolve(process.cwd(), 'dist', popupRelPath))).toBe(true);

    // Validate options HTML exists inside dist/
    const optionsRelPath = distManifest.options_page;
    expect(optionsRelPath).toBe('src/ui/options/options.html');
    expect(fs.existsSync(path.resolve(process.cwd(), 'dist', optionsRelPath))).toBe(true);

    // Validate content script JS files exist inside dist/
    const contentScriptJs = distManifest.content_scripts[0].js;
    expect(contentScriptJs).toContain('content.js');
    for (const scriptFile of contentScriptJs) {
      expect(fs.existsSync(path.resolve(process.cwd(), 'dist', scriptFile))).toBe(true);
    }
  });
});
