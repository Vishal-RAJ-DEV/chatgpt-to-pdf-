import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 1. Read canonical manifest version
const manifestPath = path.join(projectRoot, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '0.1.0';

const distDir = path.join(projectRoot, 'dist');
const zipFileName = `chatgpt-pdf-exporter-v${version}.zip`;
const zipPath = path.join(distDir, zipFileName);

console.log(`[Package] Creating release bundle: ${zipFileName}...`);

if (!fs.existsSync(distDir)) {
  console.error('[Package] Error: dist/ directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

// Remove old zip if present
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Collect all files in dist/ except existing .zip files
function getFilesRecursively(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getFilesRecursively(fullPath));
    } else if (!entry.name.endsWith('.zip')) {
      files.push(fullPath);
    }
  }
  return files;
}

const filesToZip = getFilesRecursively(distDir);
if (filesToZip.length === 0) {
  console.error('[Package] Error: No build output files found in dist/.');
  process.exit(1);
}

// Create ZIP using platform tool
const isWindows = process.platform === 'win32';
if (isWindows) {
  // Use PowerShell Compress-Archive
  const relativeFiles = filesToZip.map((f) => `'${path.relative(distDir, f)}'`).join(',');
  const psCommand = `powershell -Command "Set-Location -Path '${distDir}'; Compress-Archive -Path ${relativeFiles} -DestinationPath '${zipPath}' -Force"`;
  execSync(psCommand, { stdio: 'inherit' });
} else {
  // Use zip utility on Linux/macOS
  execSync(`cd "${distDir}" && zip -r "${zipPath}" . -x "*.zip"`, { stdio: 'inherit' });
}

if (fs.existsSync(zipPath)) {
  const stats = fs.statSync(zipPath);
  const sizeKb = (stats.size / 1024).toFixed(2);
  console.log(`[Package] Release package created successfully!`);
  console.log(`  Path: ${zipPath}`);
  console.log(`  Size: ${sizeKb} KB`);
  console.log(`  Version: v${version}`);
} else {
  console.error('[Package] Error: Failed to create zip package.');
  process.exit(1);
}
