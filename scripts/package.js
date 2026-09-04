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

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (err) {
  console.error('[Package] Error: Failed to parse manifest.json as JSON.');
  process.exit(1);
}

const version = manifest.version;

if (!version || typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version.trim())) {
  console.error(`[Package] Error: Invalid or missing manifest.version "${version}". Version must follow semver format (e.g. 0.1.0).`);
  process.exit(1);
}

const distDir = path.join(projectRoot, 'dist');
const zipFileName = `chatgpt-pdf-exporter-v${version.trim()}.zip`;
const zipPath = path.join(distDir, zipFileName);
const stagingDir = path.join(projectRoot, '.temp_release_stage');

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
        files.push({ fullPath, relativePath });
      }
    }
  }
  return files;
}

const allowlistedFiles = getProductionFilesRecursively(distDir);
if (allowlistedFiles.length === 0) {
  console.error('[Package] Error: No production allow-list files found in dist/.');
  process.exit(1);
}

try {
  // Clear staging directory if present
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stagingDir, { recursive: true });

  // Copy ONLY allow-listed files into staging directory preserving relative paths
  for (const file of allowlistedFiles) {
    const destPath = path.join(stagingDir, file.relativePath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(file.fullPath, destPath);
  }

  // Create ZIP from staging directory
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    const psCommand = `powershell -Command "Set-Location -Path '${stagingDir}'; Compress-Archive -Path * -DestinationPath '${zipPath}' -Force"`;
    execSync(psCommand, { stdio: 'inherit' });
  } else {
    execSync(`cd "${stagingDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
  }

  if (fs.existsSync(zipPath)) {
    const stats = fs.statSync(zipPath);
    const sizeKb = (stats.size / 1024).toFixed(2);
    console.log(`[Package] Release package created successfully!`);
    console.log(`  Path: ${zipPath}`);
    console.log(`  Size: ${sizeKb} KB`);
    console.log(`  Version: v${version}`);
    console.log(`  Files Packaged (${allowlistedFiles.length}):`);
    allowlistedFiles.forEach((f) => console.log(`    - ${f.relativePath}`));
  } else {
    console.error('[Package] Error: Failed to create zip package.');
    process.exit(1);
  }
} finally {
  // Clean up staging directory
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}
