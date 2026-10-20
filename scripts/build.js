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

// Generate the 6 alias routes: /1, /2, /3, /4, /5, /6
const aliasRoutes = ['1', '2', '3', '4', '5', '6'];
const indexSrc = path.join(rootDir, 'index.html');
const indexHtml = fs.readFileSync(indexSrc, 'utf8');

aliasRoutes.forEach(route => {
  // 1. Root folder (e.g. ./1/index.html)
  const rootRouteDir = path.join(rootDir, route);
  if (!fs.existsSync(rootRouteDir)) {
    fs.mkdirSync(rootRouteDir, { recursive: true });
  }
  fs.writeFileSync(path.join(rootRouteDir, 'index.html'), indexHtml);

  // 2. Public folder (e.g. ./public/1/index.html)
  const publicRouteDir = path.join(publicDir, route);
  if (!fs.existsSync(publicRouteDir)) {
    fs.mkdirSync(publicRouteDir, { recursive: true });
  }
  fs.writeFileSync(path.join(publicRouteDir, 'index.html'), indexHtml);
});

console.log('Build successful: static assets and 6 route paths (1-6) synced to root and public/');
