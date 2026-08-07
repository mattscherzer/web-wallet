const sharp = require('sharp');
const fs = require('fs');

async function generate() {
  await sharp('public/favicon.svg')
    .resize(192, 192)
    .png()
    .toFile('public/icon-192.png');

  await sharp('public/favicon.svg')
    .resize(512, 512)
    .png()
    .toFile('public/icon-512.png');

  await sharp('public/favicon.svg')
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 245, g: 246, b: 250, alpha: 1 } // #f5f6fa
    })
    .png()
    .toFile('public/icon-512-maskable.png');
}

generate().catch(console.error);
