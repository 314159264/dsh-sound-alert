// Smoke test: load lib/client.js in a mocked browser-ish environment and
// verify the ModuleLoader contract (factory -> exports with apply/inject).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const code = readFileSync(new URL('./lib/client.js', import.meta.url), 'utf8');

let captured = null;
const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
  },
  AudioContext: undefined,
  webkitAudioContext: undefined,
  __ModuleLoader__: { load: (spec) => { captured = spec; } },
};

// execute the bundle
(0, eval)(code);

if (!captured || captured.id !== 'dsh-sound-alert') {
  throw new Error('bundle did not register via __ModuleLoader__.load');
}
if (typeof captured.factory !== 'function') {
  throw new Error('bundle factory is not a function');
}

const reactMock = {
  createElement: () => ({}),
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useEffect: () => {},
  useRef: (init) => ({ current: init }),
};

const exportsObj = captured.factory((name) => {
  if (name === 'react') return reactMock;
  throw new Error('unexpected require: ' + name);
});

if (typeof exportsObj.apply !== 'function') throw new Error('exports.apply must be a function');
if (!Array.isArray(exportsObj.inject) || !exportsObj.inject.includes('slots')) {
  throw new Error('exports.inject must include "slots"');
}
console.log('client bundle OK: id =', captured.id, '| apply =', typeof exportsObj.apply, '| inject =', JSON.stringify(exportsObj.inject));

// localStorage round-trip through a full apply (mock ctx.slots)
const registrations = [];
const mockCtx = {
  slots: {
    register: (opts, render) => {
      registrations.push({ name: opts.name, opts, hasRender: typeof render === 'function' });
      return () => {};
    },
    inject: (name, cb) => { cb(); },
  },
};
exportsObj.apply(mockCtx);
for (const reg of registrations) {
  console.log('slot registered:', reg.name, '| render =', reg.hasRender, '| opts =', JSON.stringify(reg.opts));
}
if (registrations.length !== 2) throw new Error('expected 2 slot registrations');
console.log('host half import:');
const host = await import(new URL('./lib/index.js', import.meta.url).href);
console.log('  index.js exports:', Object.keys(host), '| apply =', typeof host.apply);
