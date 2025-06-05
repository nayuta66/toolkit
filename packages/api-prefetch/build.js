const fs = require('fs');
const path = require('path');

// 确保 dist 目录存在
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 复制源文件到 dist
const srcFile = path.join(__dirname, 'src', 'index.js');
const distFile = path.join(__dirname, 'dist', 'index.js');

fs.copyFileSync(srcFile, distFile);

console.log('Build completed: src/index.js -> dist/index.js'); 