// Private case-study analytics dashboard. Basic-Auth gated; Supabase service key stays server-side.
const http = require("http");

const SB_URL = process.env.SUPABASE_CS_URL;
const SB_KEY = process.env.SUPABASE_CS_SERVICE_KEY;
const USER = process.env.DASH_USER || "john";
const PASS = process.env.DASH_PASS || "";
const PORT = process.env.PORT || 3000;

async function q(p) {
  const r = await fetch(`${SB_URL}/rest/v1/${p}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  return r.ok ? await r.json() : [];
}
const money = (n) => { n = Number(n) || 0; return n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? "$" + Math.round(n / 1e3) + "K" : "$" + Math.round(n); };
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function authed(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return false;
  const [u, p] = Buffer.from(h.slice(6), "base64").toString().split(":");
  return u === USER && p === PASS;
}

async function renderHtml() {
  const [sum] = await q("v_evd_summary");
  const tools = await q("v_studies_by_tool");
  const cats = await q("v_studies_by_category");
  const weeks = await q("v_studies_by_week?order=iso_week.asc");
  const months = await q("v_studies_by_month?order=month.asc");
  const recent = await q("v_studies_recent");
  const kpis = await q("v_scoreboard_latest?order=metric_key.asc");

  const maxWeek = Math.max(1, ...weeks.map((w) => Number(w.studies)));
  const bars = weeks.map((w) => `<div class="bar" title="${esc(w.iso_week)}: ${w.studies}"><div class="fill" style="height:${Math.round(Number(w.studies) / maxWeek * 100)}%"></div><span>${esc((w.iso_week || "").replace(/^\d+-W?/, ""))}</span></div>`).join("");
  const toolRows = tools.map((t) => `<tr><td>${esc(t.tool)}</td><td class=n>${t.studies}</td><td class=n>${money(t.dollar_impact)}</td></tr>`).join("");
  const catRows = cats.map((c) => `<tr><td>${esc(c.primary_category || "— uncategorized")}</td><td class=n>${c.studies}</td><td class=n>${money(c.dollar_impact)}</td></tr>`).join("");
  const monthRows = months.map((m) => `<tr><td>${esc(m.month)}</td><td class=n>${m.studies}</td><td class=n>${money(m.dollar_impact)}</td></tr>`).join("");
  const recRows = recent.map((r) => `<tr><td class=dt>${esc(r.captured_date)}</td><td>${esc(r.tool)}</td><td>${esc(r.client)}</td><td>${esc(r.title)}</td><td class=n>${money(r.dollar_low)}–${money(r.dollar_high)}</td></tr>`).join("");
  const kpiChips = kpis.map((k) => `<div class=chip><b>${esc(k.metric_value)}</b><span>${esc((k.metric_key || "").replace(/_/g, " "))}</span></div>`).join("");

  return `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>novaX Case-Study Intelligence</title><style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#0b0b0f;color:#e8e8ea;font:15px/1.5 -apple-system,Inter,system-ui,sans-serif;padding:28px;max-width:1100px;margin:0 auto;background-image:radial-gradient(ellipse 80% 50% at 50% 0%,rgba(120,100,200,.14),transparent 60%)}
h1{font-size:1.7rem;font-weight:700;letter-spacing:-.02em}.sub{color:#8a8a93;font-size:.8rem;margin:4px 0 24px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
.kpi{background:linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:18px}
.kpi b{display:block;font-size:1.9rem;font-weight:700;letter-spacing:-.02em}.kpi span{color:#9a9aa3;font-size:.7rem;text-transform:uppercase;letter-spacing:.1em}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:26px}.chip{background:rgba(165,180,252,.1);border:1px solid rgba(165,180,252,.25);border-radius:10px;padding:8px 12px;font-size:.8rem}.chip b{color:#a5b4fc;margin-right:6px}.chip span{color:#9a9aa3}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}
.card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:18px}
.card h2{font-size:.7rem;text-transform:uppercase;letter-spacing:.14em;color:#a5b4fc;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:.85rem}td{padding:7px 6px;border-bottom:1px solid rgba(255,255,255,.06)}td.n{text-align:right;font-variant-numeric:tabular-nums;color:#cfcfd6}td.dt{color:#8a8a93;white-space:nowrap;font-size:.78rem}
.chart{display:flex;align-items:flex-end;gap:5px;height:120px;padding-top:8px}.bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}.bar .fill{width:70%;background:linear-gradient(#a5b4fc,#6e7bd6);border-radius:3px 3px 0 0;min-height:2px}.bar span{font-size:.55rem;color:#7a7a83;margin-top:4px;transform:rotate(-50deg);white-space:nowrap}
.full{grid-column:1/-1}.foot{color:#6a6a73;font-size:.72rem;margin-top:18px;text-align:center}
@media(max-width:760px){.kpis{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}}
</style></head><body>
<h1>novaX · Case-Study Intelligence</h1>
<div class=sub>Live from tars-case-studies · ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC</div>
<div class=kpis>
<div class=kpi><b>${esc(sum?.studies ?? 0)}</b><span>Case studies</span></div>
<div class=kpi><b>${money(sum?.conservative)}</b><span>Conservative value</span></div>
<div class=kpi><b>${money(sum?.moderate)}</b><span>Moderate value</span></div>
<div class=kpi><b>${esc(sum?.revenue_costavoid ?? 0)}</b><span>Revenue / cost-avoid</span></div>
</div>
<div class=chips>${kpiChips}</div>
<div class=grid>
<div class=card><h2>By tool</h2><table>${toolRows}</table></div>
<div class=card><h2>By value category</h2><table>${catRows}</table></div>
<div class="card full"><h2>Studies per week</h2><div class=chart>${bars}</div></div>
<div class=card><h2>By month</h2><table>${monthRows}</table></div>
<div class=card><h2>&nbsp;</h2><table>${recRows.length ? "" : "<tr><td>—</td></tr>"}</table></div>
<div class="card full"><h2>Most recent</h2><table>${recRows}</table></div>
</div>
<div class=foot>Private · Basic-Auth · refreshes as the engine captures new studies</div>
</body></html>`;
}

http.createServer(async (req, res) => {
  if (req.url === "/health") { res.writeHead(200); return res.end("ok"); }
  if (!authed(req)) { res.writeHead(401, { "WWW-Authenticate": 'Basic realm="novaX Case Studies"' }); return res.end("Authentication required"); }
  try {
    const html = await renderHtml();
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(html);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Dashboard error: " + (e && e.message));
  }
}).listen(PORT, () => console.log("dashboard listening on " + PORT));
