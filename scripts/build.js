const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Copy root static files
const filesToCopy = [
  'index.html',
  'styles.css',
  'app.js',
  'apple-icon.png',
  'icon.svg',
  'icon-dark-32x32.png',
  'icon-light-32x32.png'
];

filesToCopy.forEach(file => {
  const src = path.join(rootDir, file);
  const dest = path.join(publicDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
});

// Copy images directory
const imagesSrc = path.join(rootDir, 'images');
const imagesDest = path.join(publicDir, 'images');

if (!fs.existsSync(imagesDest)) {
  fs.mkdirSync(imagesDest, { recursive: true });
}

if (fs.existsSync(imagesSrc)) {
  fs.readdirSync(imagesSrc).forEach(file => {
    const s = path.join(imagesSrc, file);
    const d = path.join(imagesDest, file);
    if (fs.statSync(s).isFile()) {
      fs.copyFileSync(s, d);
    }
  });
}

console.log('Build successful: static assets synced to public/');
