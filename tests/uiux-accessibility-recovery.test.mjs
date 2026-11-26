import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('discovery and ticket loading have explicit retry states',()=>{const s=read('src/components/UserPortal.tsx');assert.ok(s.includes('[eventRetry]'));assert.ok(s.includes('[accountRetry]'));assert.ok(s.includes('Retry loading events'));assert.ok(s.includes('Retry loading tickets'));assert.ok(s.includes('Clear filters'));});
test('checkout and QR dialogs restore focus and scroll state',()=>{for(const p of ['src/components/UserPortal.tsx','src/components/RoleWorkspace.tsx']){const s=read(p);assert.ok(s.includes("document.body.style.overflow='hidden'"));assert.ok(s.includes('document.body.style.overflow=previousOverflow'));assert.ok(s.includes('opener.focus()'));assert.ok(s.includes("event.key==='Escape'"));}});
test('mobile styles preserve focus and QR layout',()=>{const s=read('src/app/interface-motion.css');assert.ok(s.includes('max-height:calc(100dvh - 32px)'));assert.ok(s.includes('forced-colors:active'));assert.ok(s.includes('safe-area-inset-bottom'));assert.ok(s.includes('.masque-expanded-code svg'));});
