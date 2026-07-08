const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const EXTENSION_DIR = path.join(ROOT_DIR, 'extension');
const DIST_DIR = path.join(ROOT_DIR, 'dist-extension');

const args = process.argv.slice(2);
const envArg = args.find(arg => arg.startsWith('--env=')) || '--env=production';
const env = envArg.split('=')[1];

console.log(`🚀 Building Momentum Sync Extension for ${env}...`);

// Cleanup dist directory
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// Helper to copy recursively
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    fs.mkdirSync(dest);
    fs.readdirSync(src).forEach(function(childItemName) {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('📁 Copying extension files...');
const items = fs.readdirSync(EXTENSION_DIR);
for (const item of items) {
  // Exclude some files
  if (item === 'TESTING_GUIDE.md' || item === 'HACKERRANK_TESTING_GUIDE.md' || item.endsWith('.zip')) {
    continue;
  }
  copyRecursiveSync(path.join(EXTENSION_DIR, item), path.join(DIST_DIR, item));
}

// Overwrite env.js
console.log('⚙️ Injecting environment variables...');
const envFilePath = path.join(DIST_DIR, 'config', 'env.js');
let backendUrl = 'http://localhost:5000';
let frontendUrl = 'http://localhost:5173';

if (env === 'production') {
  backendUrl = 'https://api.momentum-sync.com'; // Replace with actual production URL
  frontendUrl = 'https://momentum-sync.com'; // Replace with actual production URL
}

const envContent = `/**
 * Momentum Extension — Environment Configuration
 * This file is automatically modified during the production build process.
 * Do not manually change these values for production deployment.
 */
(function () {
  self.__MomentumEnv = {
    NODE_ENV: '${env}',
    BACKEND_URL: '${backendUrl}',
    FRONTEND_URL: '${frontendUrl}'
  };
})();
`;

fs.writeFileSync(envFilePath, envContent, 'utf8');

// Patch manifest.json for production
if (env === 'production') {
  console.log('⚙️ Patching manifest.json for production...');
  const manifestPath = path.join(DIST_DIR, 'manifest.json');
  let manifestContent = fs.readFileSync(manifestPath, 'utf8');
  
  // Replace backend localhost with production API
  manifestContent = manifestContent.replace(
    /"http:\/\/localhost:5000\/\*"/g,
    `"https://api.momentum-sync.com/*"`
  );
  
  fs.writeFileSync(manifestPath, manifestContent, 'utf8');
}

console.log('📦 Creating ZIP archive...');
const zipFile = path.join(ROOT_DIR, 'momentum-sync-v1.0.0.zip');
if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);

try {
  // Use PowerShell Compress-Archive
  const psCommand = `Compress-Archive -Path '${DIST_DIR}\\*' -DestinationPath '${zipFile}' -Force`;
  execSync(`powershell.exe -NoProfile -Command "${psCommand}"`, { stdio: 'inherit' });
  console.log(`✅ Build successful! Generated: ${zipFile}`);
} catch (error) {
  console.error('❌ Failed to create ZIP archive:', error.message);
}
