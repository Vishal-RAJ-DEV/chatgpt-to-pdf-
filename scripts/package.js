import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Allow custom manifest path for testing or default to root manifest
const manifestPath = process.env.MANIFEST_PATH || path.join(projectRoot, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('[Package] Error: manifest.json not found.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version;

if (!version || typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version.trim())) {
  console.error(`[Package] Error: Invalid or missing manifest.version "${version}". Version must follow semver format (e.g. 0.1.0).`);
  process.exit(1);
}

const distDir = path.join(projectRoot, 'dist');
const zipFileName = `chatgpt-pdf-exporter-v${version.trim()}.zip`;
const zipPath = path.join(distDir, zipFileName);

console.log(`[Package] Creating automated cross-platform release package: ${zipFileName}...`);

if (!fs.existsSync(distDir)) {
  console.error('[Package] Error: dist/ directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

// Remove old zip if present
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Production Allow-list matcher for files inside dist/
const PRODUCTION_ALLOWLIST = [
  /^manifest\.json$/,
  /^content\.js$/,
  /^popup\.js$/,
  /^options\.js$/,
  /^assets\/[^/]+\.js$/,
  /^assets\/[^/]+\.css$/,
  /^src\/ui\/popup\/popup\.html$/,
  /^src\/ui\/options\/options\.html$/,
];

function isProductionArtifact(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  return PRODUCTION_ALLOWLIST.some((pattern) => pattern.test(normalized));
}

// Collect all files in dist/ that match the explicit production allow-list
function getProductionFilesRecursively(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      files = files.concat(getProductionFilesRecursively(fullPath, baseDir));
    } else {
      if (isProductionArtifact(relativePath)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

const filesToZip = getProductionFilesRecursively(distDir);
if (filesToZip.length === 0) {
  console.error('[Package] Error: No production allow-list files found in dist/.');
  process.exit(1);
}

const relativeFilesToZip = filesToZip.map((f) => path.relative(distDir, f));

// Top-level allowable items to preserve folder hierarchy in ZIP
const topLevelItems = Array.from(
  new Set(relativeFilesToZip.map((f) => f.split(path.sep)[0]))
);

// Create ZIP using platform tool
const isWindows = process.platform === 'win32';
if (isWindows) {
  const formattedFileList = topLevelItems.map((f) => `'${f}'`).join(',');
  const psCommand = `powershell -Command "Set-Location -Path '${distDir}'; Compress-Archive -Path ${formattedFileList} -DestinationPath '${zipPath}' -Force"`;
  execSync(psCommand, { stdio: 'inherit' });
} else {
  const formattedFileList = topLevelItems.map((f) => `"${f}"`).join(' ');
  execSync(`cd "${distDir}" && zip -r "${zipPath}" ${formattedFileList} -x "*.zip"`, { stdio: 'inherit' });
}

if (fs.existsSync(zipPath)) {
  const stats = fs.statSync(zipPath);
  const sizeKb = (stats.size / 1024).toFixed(2);
  console.log(`[Package] Release package created successfully!`);
  console.log(`  Path: ${zipPath}`);
  console.log(`  Size: ${sizeKb} KB`);
  console.log(`  Version: v${version}`);
  console.log(`  Files Packaged (${relativeFilesToZip.length}):`);
  relativeFilesToZip.forEach((f) => console.log(`    - ${f}`));
} else {
  console.error('[Package] Error: Failed to create zip package.');
  process.exit(1);
}
