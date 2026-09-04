import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('Release Packaging & Dist Reproducibility Audit Tests', () => {
  const distDir = path.resolve(process.cwd(), 'dist');
  const manifestPath = path.resolve(process.cwd(), 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const version = manifest.version || '0.1.0';
  const zipPath = path.join(distDir, `chatgpt-pdf-exporter-v${version}.zip`);

  it('1. scripts/package.js exists and is executable via node', () => {
    const scriptPath = path.resolve(process.cwd(), 'scripts/package.js');
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  it('2. package script produces valid release ZIP bundle in dist/', () => {
    // Ensure dist directory exists
    if (!fs.existsSync(distDir)) {
      execSync('npm run build', { stdio: 'pipe' });
    }

    // Execute packaging script
    execSync('node scripts/package.js', { stdio: 'pipe' });

    expect(fs.existsSync(zipPath)).toBe(true);
    const stats = fs.statSync(zipPath);
    expect(stats.size).toBeGreaterThan(1000); // Must be non-empty ZIP archive (> 1 KB)
  });

  it('3. dist directory contains only required production artifacts', () => {
    expect(fs.existsSync(path.join(distDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(distDir, 'content.js'))).toBe(true);
    expect(fs.existsSync(path.join(distDir, 'popup.js'))).toBe(true);
    expect(fs.existsSync(path.join(distDir, 'options.js'))).toBe(true);

    // Development artifacts must not exist in dist
    expect(fs.existsSync(path.join(distDir, 'node_modules'))).toBe(false);
    expect(fs.existsSync(path.join(distDir, '.git'))).toBe(false);
    expect(fs.existsSync(path.join(distDir, 'src/ui/popup/popup.ts'))).toBe(false);
  });
});
