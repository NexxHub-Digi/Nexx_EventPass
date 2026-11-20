import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = readFileSync(new URL('../src/app/manifest.ts', import.meta.url), 'utf8');
const iconRoute = readFileSync(new URL('../src/app/api/pwa-icon/[size]/route.tsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');

test('PWA links an installable, standalone manifest from every route', () => {
  assert.match(layout, /manifest:\s*'\/manifest\.webmanifest'/);
  assert.match(manifest, /start_url:\s*'\/'/);
  assert.match(manifest, /scope:\s*'\/'/);
  assert.match(manifest, /display:\s*'standalone'/);
  assert.match(manifest, /prefer_related_applications:\s*false/);
});

test('Android install icons are PNG at both required sizes', () => {
  assert.match(manifest, /'192x192'.*'image\/png'/);
  assert.match(manifest, /'512x512'.*'image\/png'/);
  assert.match(manifest, /purpose:\s*'maskable'/);
  assert.match(iconRoute, /requestedSize !== '192' && requestedSize !== '512'/);
  assert.match(iconRoute, /new ImageResponse\(/);
  assert.match(layout, /\/api\/pwa-icon\/192/);
  assert.match(layout, /\/api\/pwa-icon\/512/);
});
