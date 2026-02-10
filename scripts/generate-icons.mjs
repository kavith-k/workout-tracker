import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const staticDir = join(__dirname, '..', 'static');

// Minimal valid 1x1 black pixel PNG (base64 decoded)
// Replace these with proper icons for production
function minimalPng() {
	return Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
		'base64'
	);
}

writeFileSync(join(staticDir, 'pwa-192x192.png'), minimalPng());
writeFileSync(join(staticDir, 'pwa-512x512.png'), minimalPng());
writeFileSync(join(staticDir, 'maskable-icon-512x512.png'), minimalPng());
writeFileSync(join(staticDir, 'apple-touch-icon-180x180.png'), minimalPng());
console.log('Placeholder icons generated. Replace with proper icons for production.');
