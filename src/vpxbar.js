// VectorPC bar: the same top bar in every VectorPC app, with the menu that moves between them.
// Keep identical in each app; the canonical copy is manager/src/vpxbar.js (CSS: the VectorPC bar block in manager/assets/app.css).
export const VPX_HOME = 'https://app.vectorpc.co.za';

const ICONS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  todo: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  support: '<path d="M3 9a2 2 0 0 0 0 6v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 0 0-6V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
  monitor: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  servers: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  zoho: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  solar: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  apps: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// every app, in the order of the home screen; the systems on other addresses open signed in through /go/
export const VPX_APPS = [
  ['home', '/', 'Home'], ['todo', '/todo', 'Tasks'], ['support', '/go/support', 'Support'], ['monitor', '/go/monitor', 'Monitoring'],
  ['servers', '/servers', 'Servers'], ['zoho', '/zoho', 'Zoho'], ['solar', '/go/solar', 'Solar Quotes'],
];

/**
 * The bar. current: which app this is (a VPX_APPS key, or '' for none); app/appHref: the name shown next to
 * VectorPC and where it goes; mark: this app's own copy of the VectorPC mark; slot: this app's own buttons
 * (trusted HTML); base: '' inside the VectorPC app itself, else its address.
 */
export function vpxBar({ current = '', app = '', appHref = '', mark, slot = '', base = VPX_HOME, attrs = '' }) {
  const items = VPX_APPS.map(([k, path, label]) => `<a class="vpx-item${k === current ? ' on" aria-current="page' : ''}" href="${esc(base + path)}"><span class="vpx-ic">${svg(k)}</span><span>${esc(label)}</span></a>`).join('');
  return `<header class="vpx-bar"${attrs}><a class="vpx-brand" href="${esc(base + '/')}" title="VectorPC home"><img src="${esc(mark)}" alt="" width="28" height="28"><b>VectorPC</b></a>`
    + (app ? `<span class="vpx-sep" aria-hidden="true">/</span><a class="vpx-app" href="${esc(appHref || '#')}">${esc(app)}</a>` : '')
    + `<div class="vpx-slot">${slot}</div>`
    + `<details class="vpx-apps"><summary aria-label="Switch app" title="Switch app">${svg('apps')}<span>Apps</span></summary><nav class="vpx-menu" aria-label="VectorPC apps">${items}</nav></details></header>`;
}
