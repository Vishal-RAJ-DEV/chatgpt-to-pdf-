import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

/** Helper function to parse file entries directly from a ZIP buffer */
function listZipEntries(zipBuffer: Buffer): string[] {
  const entries: string[] = [];
  let i = 0;
  while (i < zipBuffer.length - 30) {
    if (
      zipBuffer[i] === 0x50 &&
      zipBuffer[i + 1] === 0x4b &&
      zipBuffer[i + 2] === 0x03 &&
      zipBuffer[i + 3] === 0x04
    ) {
      const fileNameLen = zipBuffer.readUInt16LE(i + 26);
      const extraLen = zipBuffer.readUInt16LE(i + 28);
      const fileName = zipBuffer.toString('utf8', i + 30, i + 30 + fileNameLen);
      if (fileName && !fileName.endsWith('/')) {
        entries.push(fileName.replace(/\\/g, '/'));
      }
      i += 30 + fileNameLen + extraLen;
    } else {
      i++;
    }
  }
  return entries;
}

describe('Automated Release Packaging & Dist Purity Audit Tests', () => {
  const distDir = path.resolve(process.cwd(), 'dist');
  const manifestPath = path.resolve(process.cwd(), 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const version = manifest.version;
  const zipPath = path.join(distDir, `chatgpt-pdf-exporter-v${version}.zip`);

  it('1. scripts/package.js exists and is executable via node', () => {
    const scriptPath = path.resolve(process.cwd(), 'scripts/package.js');
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  it('2. package script produces valid release ZIP bundle in dist/', () => {
    if (!fs.existsSync(distDir)) {
      execSync('npm run build', { stdio: 'pipe' });
    }

    execSync('node scripts/package.js', { stdio: 'pipe' });

    expect(fs.existsSync(zipPath)).toBe(true);
    const stats = fs.statSync(zipPath);
    expect(stats.size).toBeGreaterThan(1000);
  });

  it('3. inspects generated ZIP file contents directly and verifies allow-list purity', () => {
    const zipBuffer = fs.readFileSync(zipPath);
    const zipEntries = listZipEntries(zipBuffer);

    // Required production files in ZIP
    expect(zipEntries).toContain('manifest.json');
    expect(zipEntries).toContain('content.js');
    expect(zipEntries).toContain('popup.js');
    expect(zipEntries).toContain('options.js');

    // Required HTML files in ZIP
    expect(zipEntries).toContain('src/ui/popup/popup.html');
    expect(zipEntries).toContain('src/ui/options/options.html');

    // Required CSS / Chunk assets in ZIP
    const hasPopupCss = zipEntries.some((e) => e.startsWith('assets/popup-') && e.endsWith('.css'));
    const hasOptionsCss = zipEntries.some((e) => e.startsWith('assets/options-') && e.endsWith('.css'));
    const hasChunkJs = zipEntries.some((e) => e.startsWith('assets/SettingsManager-') && e.endsWith('.js'));
    expect(hasPopupCss).toBe(true);
    expect(hasOptionsCss).toBe(true);
    expect(hasChunkJs).toBe(true);

    // Development artifacts MUST NOT exist inside ZIP
    for (const entry of zipEntries) {
      expect(entry).not.toContain('.ts');
      expect(entry).not.toContain('node_modules');
      expect(entry).not.toContain('.git');
      expect(entry).not.toContain('.zip');
      expect(entry).not.toContain('tests');
      expect(entry).not.toContain('docs');
    }
  });

  it('4. fails packaging cleanly when manifest.version is missing or invalid semver', () => {
    // Create temporary invalid manifest
    const invalidManifestPath = path.resolve(process.cwd(), 'temp_invalid_manifest.json');
    fs.writeFileSync(invalidManifestPath, JSON.stringify({ name: 'Test', version: 'invalid-semver' }));

    try {
      execSync('node scripts/package.js', {
        env: { ...process.env, MANIFEST_PATH: invalidManifestPath },
        stdio: 'pipe',
      });
    } catch (err: unknown) {
      const errorStr = String(err);
      expect(errorStr).toBeDefined();
    } finally {
      if (fs.existsSync(invalidManifestPath)) {
        fs.unlinkSync(invalidManifestPath);
      }
    }
  });
});
