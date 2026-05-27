import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const pub = join(__dir, '..', 'public');

const svg = readFileSync(join(pub, 'icon-192.svg'));

await sharp(svg).resize(192, 192).png().toFile(join(pub, 'icon-192.png'));
console.log('✓ icon-192.png');

await sharp(svg).resize(512, 512).png().toFile(join(pub, 'icon-512.png'));
console.log('✓ icon-512.png');

await sharp(svg).resize(180, 180).png().toFile(join(pub, 'apple-touch-icon.png'));
console.log('✓ apple-touch-icon.png');

await sharp(svg).resize(32, 32).png().toFile(join(pub, 'favicon-32.png'));
console.log('✓ favicon-32.png');

console.log('All icons generated!');
