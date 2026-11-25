// Dashboard and compact list styles, shared by the client page (light) and the admin page (dark).
// Colours come from each page's own variables (--ink, --muted, --line, --card, --accent).
export const dashCss = `
.dash{padding:14px 16px 6px;margin-bottom:16px;overflow:hidden}.dash h2{font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);margin:0 0 8px;font-weight:700}
table.by{width:100%;border-collapse:collapse;font-size:14px}table.by th{text-align:left;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);padding:6px 8px;border-bottom:1px solid var(--line);background:none}
table.by td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:middle}table.by tr:last-child td{border-bottom:0}
table.by .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}table.by a,.dash-co{font-weight:700;text-decoration:none;color:var(--ink);cursor:pointer}
table.by a:hover,.dash-co:hover{color:var(--accent)}table.by tr.sum td{font-weight:700;border-top:2px solid var(--line)}
table.by .share{width:30%;white-space:nowrap}.sbar{display:inline-block;vertical-align:middle;width:calc(100% - 44px);height:8px;border-radius:99px;background:rgba(127,127,127,.16);overflow:hidden}
.sbar i{display:block;height:100%;border-radius:99px;background:var(--accent)}.pct{display:inline-block;width:40px;text-align:right;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.tops{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:4px 22px;padding-bottom:8px}.topcol h3{margin:4px 0 2px;font-size:14px}.topcol h3:empty{display:none}
.topcol ol{list-style:none;margin:0;padding:0}.topcol li a{display:flex;gap:10px;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line);text-decoration:none;color:var(--ink);font-size:13.5px;cursor:pointer}
.topcol li:last-child a{border-bottom:0}.topcol li a:hover .t{color:var(--accent)}.topcol .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.topcol b{white-space:nowrap;font-variant-numeric:tabular-nums}
.lh{margin:0 auto 0 0;font-size:16px;align-self:center}
.list{overflow:hidden}.mrow{display:flex;justify-content:space-between;gap:10px;padding:9px 14px;font-size:12.5px;font-weight:700;background:rgba(127,127,127,.07);border-top:1px solid var(--line);color:var(--muted)}
.mrow:first-child{border-top:0}.mrow b{color:var(--ink)}.mrow.total{font-size:14px;color:var(--ink);border-top:2px solid var(--line)}
details.item{border-top:1px solid var(--line)}details.item>summary{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;list-style:none;font-size:14px}
details.item>summary::-webkit-details-marker{display:none}details.item>summary::before{content:"";flex:none;width:6px;height:6px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(-45deg);transition:transform .15s;margin-right:2px}
details.item[open]>summary::before{transform:rotate(45deg)}details.item>summary:hover{background:rgba(127,127,127,.06)}
details.item .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}details.item[open] .t{white-space:normal}
details.item .co{flex:none;font-size:11.5px;font-weight:700;color:var(--accent);white-space:nowrap}details.item .h{flex:none;min-width:52px;text-align:right;font-variant-numeric:tabular-nums}
details.item .more{padding:0 14px 12px 30px;font-size:14px;color:var(--muted)}details.item .more p{margin:0 0 6px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--ink)}details.item .more p.muted{color:var(--muted)}
details.item.flash>summary{animation:flash 1.6s ease}@keyframes flash{0%,40%{background:rgba(20,195,190,.25)}100%{}}
.presets.cos a{font-size:12.5px}
@media(max-width:600px){table.by .share{display:none}table.by th,table.by td{padding:8px 5px}details.item .co{display:none}details.item>summary{padding:10px 12px}details.item .more{padding-left:26px}}
@media print{details.item .more{display:block!important}details.item>summary::before{display:none}.dash{border:1px solid var(--line)}}
`;
