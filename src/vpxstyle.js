// VectorPC bar styles and menu script, copied from the other VectorPC apps (keep identical).
export const vpxCss = `/* VectorPC bar: the same top bar in every VectorPC app (the app, Support, Monitoring, Solar Quotes).
   Keep this block identical in each app; the canonical copy is the VectorPC bar block in manager/assets/app.css. */
.vpx-bar { position: sticky; top: 0; z-index: 60; display: flex; align-items: center; gap: 10px; box-sizing: content-box; height: 52px; padding: env(safe-area-inset-top, 0px) 16px 0; background: #131315; border-bottom: 1px solid rgba(255,255,255,.08); color: #f4f4f5; font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.2; }
.vpx-bar[hidden] { display: none; }
.vpx-bar svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
.vpx-brand { display: flex; align-items: center; gap: 9px; color: #fff; text-decoration: none; font-weight: 750; font-size: 15px; flex-shrink: 0; }
.vpx-brand:hover { text-decoration: none; color: #fff; }
.vpx-brand img { width: 28px; height: 28px; border-radius: 7px; display: block; }
.vpx-sep { color: #52525b; font-size: 18px; font-weight: 300; }
.vpx-app { color: #d4d4d8; font-weight: 600; font-size: 15px; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.vpx-app:hover { color: #fff; text-decoration: none; }
.vpx-slot { flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 6px; min-width: 0; }
.vpx-apps { position: relative; flex-shrink: 0; }
.vpx-apps > summary { list-style: none; display: flex; align-items: center; gap: 7px; height: 36px; padding: 0 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,.12); color: #e4e4e7; font-weight: 600; font-size: 14px; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
.vpx-apps > summary::-webkit-details-marker { display: none; }
.vpx-apps > summary:hover, .vpx-apps[open] > summary { background: rgba(255,255,255,.07); }
.vpx-apps > summary:focus-visible { outline: 2px solid #14c3be; outline-offset: 2px; }
.vpx-menu { position: absolute; right: 0; top: calc(100% + 8px); width: 248px; max-width: calc(100vw - 24px); padding: 6px; display: grid; gap: 2px; background: #1c1b1e; border: 1px solid rgba(255,255,255,.1); border-radius: 14px; box-shadow: 0 18px 40px rgba(0,0,0,.45); }
.vpx-item { display: flex; align-items: center; gap: 11px; padding: 7px 10px; border-radius: 10px; color: #e4e4e7; text-decoration: none; font-size: 14.5px; font-weight: 550; }
.vpx-item:hover { background: rgba(255,255,255,.06); color: #fff; text-decoration: none; }
.vpx-ic { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; background: rgba(10,168,164,.14); color: #14c3be; flex-shrink: 0; }
.vpx-item.on { background: linear-gradient(135deg, #14c3be, #0aa8a4); color: #fff; }
.vpx-item.on .vpx-ic { background: rgba(255,255,255,.18); color: #fff; }
@media (max-width: 640px) {
  .vpx-bar { padding-left: 12px; padding-right: 12px; gap: 8px; }
  .vpx-brand b, .vpx-sep { display: none; }
  .vpx-apps > summary { padding: 0 10px; }
  .vpx-apps > summary span { display: none; }
}
@media print { .vpx-bar { display: none; } }
.vpx-brand img{background:#fff;padding:3px;box-sizing:border-box}`;
export const vpxJs = "// VectorPC bar: close the apps menu on a click outside it or on Escape (same in every VectorPC app).\n(function () {\n  function closeAll(except) { document.querySelectorAll('details.vpx-apps[open]').forEach(function (d) { if (d !== except) d.removeAttribute('open'); }); }\n  document.addEventListener('click', function (e) { closeAll(e.target.closest ? e.target.closest('details.vpx-apps') : null); });\n  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(null); });\n})();\n";
