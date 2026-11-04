(() => {
  "use strict";

  const STORE = "na.assessments.v1";
  const SETTINGS = "na.settings.v1";
  const C = window.CATALOG;
  const app = document.getElementById("app");
  const importFile = document.getElementById("importFile");

  // ---------- storage ----------
  const readJSON = (k, d) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
  };
  let db = readJSON(STORE, {});
  let settings = readJSON(SETTINGS, { iboName: "" });
  const persist = () => localStorage.setItem(STORE, JSON.stringify(db));
  const persistSettings = () => localStorage.setItem(SETTINGS, JSON.stringify(settings));

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function blankCategory() {
    return { skip: false, current: "", satisfaction: null, spend: "", frustrations: [], other: "", openness: "" };
  }

  function normalize(a) {
    a.consent ??= { disclosed: false, storeConsent: false, followUpOk: false };
    a.client ??= {};
    a.client.sensitivities ??= [];
    a.client.values ??= [];
    a.categories ??= {};
    for (const c of C.categories) a.categories[c.id] = { ...blankCategory(), ...(a.categories[c.id] || {}) };
    a.goals ??= { selected: [], top: "", current: "", words: "", tried: "", openness: "" };
    a.wrap ??= { pain1: "", pain2: "", pain3: "", followUpDate: "", followUpTime: "", notes: "" };
    a.recs ??= {};
    a.recs.override ??= {};
    a.recs.plan ??= {};
    a.status ??= "draft";
    return a;
  }

  function newAssessment() {
    const now = new Date().toISOString();
    const a = normalize({ id: uid(), createdAt: now, updatedAt: now, client: { name: "" } });
    db[a.id] = a;
    persist();
    return a;
  }

  function touch(a) { a.updatedAt = new Date().toISOString(); persist(); }

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const getPath = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
  function setPath(o, p, v) {
    const ks = p.split(".");
    let x = o;
    for (let i = 0; i < ks.length - 1; i++) x = x[ks[i]] ??= {};
    x[ks.at(-1)] = v;
  }
  const valueLabel = (id) => C.values.find((v) => v.id === id)?.label ?? id;
  const catById = (id) => C.categories.find((c) => c.id === id);
  const money = (n) => "$" + Math.round(n).toLocaleString();
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");
  const fmtFollowUp = (w) => {
    if (!w.followUpDate) return "";
    const d = new Date(w.followUpDate + "T" + (w.followUpTime || "12:00"));
    const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    return w.followUpTime ? `${date} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : date;
  };

  // Wellness goals sit just before the vitamins/supplements section.
  const steps = () => {
    const cats = C.categories.map((c) => c.id);
    const at = cats.indexOf("nutrition");
    if (at >= 0) cats.splice(at, 0, "goals"); else cats.push("goals");
    return ["intro", "household", ...cats, "wrap"];
  };
  const goalById = (id) => C.goals.find((g) => g.id === id);
  const STEP_LABEL = { intro: ["Intro", "Intro"], household: ["Household", "Household"], goals: ["🎯", "Wellness goals"], wrap: ["Wrap-up", "Wrap-up"] };

  // ---------- recommendation engine ----------
  // Scores each category on dissatisfaction, frustrations (weighted by the client's own top priorities),
  // and openness. "Keep what works" is a deliberate, first-class outcome.
  function recommend(a) {
    const top = a.client.values || [];
    const results = C.categories.map((c) => {
      const r = a.categories[c.id];
      const res = { cat: c, r, score: 0, reasons: [], bucket: "unassessed" };
      if (r.skip) { res.bucket = "skipped"; return res; }
      const touched = r.satisfaction != null || r.frustrations.length || r.current.trim() || r.other.trim() || r.openness;
      if (!touched) return res;

      if (r.openness === "no") {
        res.bucket = "keep";
        res.reasons.push("Not open to switching. Respect that.");
      } else {
        const sat = r.satisfaction ?? 3;
        let s = (5 - sat) * 3;
        if (r.satisfaction != null) res.reasons.push(`Rated current products ${sat}/5`);
        for (const fid of r.frustrations) {
          const f = c.frustrations.find((x) => x.id === fid);
          if (!f) continue;
          s += 2;
          const ranks = f.values.map((v) => top.indexOf(v)).filter((i) => i >= 0);
          if (ranks.length) {
            const best = Math.min(...ranks);
            s += best === 0 ? 3 : 2;
            res.reasons.push(`“${f.label}”, which ties to their #${best + 1} priority (${valueLabel(top[best])})`);
          } else {
            res.reasons.push(`“${f.label}”`);
          }
        }
        if (r.other.trim()) { s += 1; res.reasons.push(`In their words: “${r.other.trim()}”`); }
        if (r.openness === "yes") { s += 3; res.reasons.push("Open to trying something new"); }
        else if (r.openness === "maybe") { s += 1; res.reasons.push("Maybe open to alternatives"); }
        res.score = s;
        res.bucket = s >= 8 ? "focus" : s >= 3 ? "later" : "keep";
        if (res.bucket === "keep") res.reasons.push("Happy with what they have");
      }
      const o = a.recs.override[c.id];
      if (o) { res.bucket = o; res.overridden = true; }
      return res;
    });

    // Each wellness goal the client named becomes a candidate. Their #1 goal ranks highest.
    const g = a.goals;
    for (const gid of g.selected) {
      const goal = goalById(gid);
      if (!goal) continue;
      const cat = { id: "goal:" + gid, icon: goal.icon, name: "Goal: " + goal.label, lines: goal.lines, talkingPoint: goal.talkingPoint, goal: true };
      const res = { cat, r: { current: g.current, spend: "" }, score: 0, reasons: [], bucket: "later" };
      if (g.openness === "no") {
        res.bucket = "keep";
        res.reasons.push("Named this goal but isn't open to products for it. Keep it a conversation.");
      } else {
        let s = 5;
        if (g.top === gid || g.selected.length === 1) { s += 4; res.reasons.push("Their #1 wellness goal"); } else res.reasons.push("A goal they named");
        if (g.words.trim()) res.reasons.push(`In their words: “${g.words.trim()}”`);
        if (g.tried.trim()) { s += 1; res.reasons.push(`Tried before: ${g.tried.trim()}`); }
        if (g.openness === "yes") { s += 3; res.reasons.push("Open to products that support this"); }
        else if (g.openness === "maybe") { s += 1; res.reasons.push("Maybe open to products"); }
        res.score = s;
        res.bucket = s >= 8 ? "focus" : "later";
      }
      const o = a.recs.override[cat.id];
      if (o) { res.bucket = o; res.overridden = true; }
      results.push(res);
    }

    // Cap auto-focus at 3. Fewer, stronger recommendations beat a long list.
    const autoFocus = results.filter((x) => x.bucket === "focus" && !x.overridden).sort((x, y) => y.score - x.score);
    const pinned = results.filter((x) => x.bucket === "focus" && x.overridden).length;
    autoFocus.slice(Math.max(0, 3 - pinned)).forEach((x) => (x.bucket = "later"));

    results.sort((x, y) => y.score - x.score);
    return results;
  }

  const monthlySpend = (a) =>
    C.categories.reduce((sum, c) => {
      const r = a.categories[c.id];
      const n = parseFloat(r.spend);
      return sum + (!r.skip && Number.isFinite(n) ? n : 0);
    }, 0);

  // ---------- views ----------
  function viewHome() {
    const list = Object.values(db).map(normalize).sort((x, y) => (y.updatedAt > x.updatedAt ? 1 : -1));
    const rows = list.map((a) => {
      const focus = recommend(a).filter((x) => x.bucket === "focus").map((x) => x.cat.icon + " " + x.cat.name);
      return `
        <li class="card client">
          <div class="client-main">
            <div class="client-name">${esc(a.client.name || "Unnamed client")}</div>
            <div class="muted small">
              <span class="pill ${a.status}">${a.status === "complete" ? "Complete" : "In progress"}</span>
              Started ${fmtDate(a.createdAt)}
              ${a.wrap.followUpDate ? ` · Follow-up <strong>${esc(fmtFollowUp(a.wrap))}</strong>` : ""}
            </div>
            ${focus.length ? `<div class="small focus-line">Focus: ${focus.map(esc).join(", ")}</div>` : ""}
          </div>
          <div class="client-actions">
            <a class="btn ghost" href="#/a/${a.id}/0">Edit</a>
            <a class="btn" href="#/a/${a.id}/summary">Summary</a>
            <button class="btn ghost danger" data-action="delete" data-id="${a.id}" aria-label="Delete ${esc(a.client.name)}">Delete</button>
          </div>
        </li>`;
    }).join("");

    return `
      <section class="hero">
        <h1>Customer Needs Assessment</h1>
        <p class="muted">Learn what they use and what's not working. Build recommendations for the follow-up from their answers.</p>
        <button class="btn big" data-action="new">+ Start new assessment</button>
      </section>

      <section class="card settings">
        <label>Your name (used in the intro script)
          <input type="text" data-setting="iboName" value="${esc(settings.iboName)}" placeholder="e.g. David Park" autocomplete="name">
        </label>
      </section>

      <h2>Clients <span class="muted">(${list.length})</span></h2>
      ${list.length ? `<ul class="client-list">${rows}</ul>` : `<p class="muted empty">No assessments yet.</p>`}

      <section class="card data-tools">
        <h3>Your data</h3>
        <p class="small muted">Everything stays in this browser. Clearing browser data deletes it, so export a backup regularly. Delete records for people who don't move forward.</p>
        <div class="row wrap">
          <button class="btn ghost" data-action="export">Backup (JSON)</button>
          <button class="btn ghost" data-action="import">Restore backup</button>
          <button class="btn ghost" data-action="csv">Export follow-ups (CSV)</button>
        </div>
      </section>`;
  }

  function progress(a, idx) {
    const s = steps();
    const pct = Math.round((idx / (s.length)) * 100);
    const labels = s.map((id, i) => {
      const [label, title] = STEP_LABEL[id] ?? [catById(id).icon, catById(id).name];
      const done = i < idx ? "done" : i === idx ? "current" : "";
      const locked = i > 0 && !consentOk(a);
      return locked
        ? `<span class="dot ${done}" title="${esc(title)}">${label}</span>`
        : `<a class="dot ${done}" href="#/a/${a.id}/${i}" title="${esc(title)}">${label}</a>`;
    }).join("");
    return `
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct}%"></div></div>
      <nav class="dots" aria-label="Sections">${labels}</nav>`;
  }

  const consentOk = (a) => a.consent.disclosed && a.consent.storeConsent;

  function check(path, checked, label, extra = "") {
    return `<label class="check ${extra}"><input type="checkbox" data-path="${path}" ${checked ? "checked" : ""}><span>${label}</span></label>`;
  }

  function viewIntro(a) {
    const me = settings.iboName.trim() || "[your name]";
    return `
      <h1>Before you start</h1>
      <div class="card script">
        <div class="label">Read aloud</div>
        <p>"Thanks for making time. Just so you know up front: I'm ${esc(me)}, and I'm an independent Amway Business Owner.</p>
        <p>Today isn't a sales pitch. I'd like to learn what you use around the house now, what you like, and what bugs you. If I think something could genuinely work better or cost less, I'll put together a short list for a second meeting. If what you have works, I'll tell you to keep it.</p>
        <p>Is it OK if I take a few notes? They stay on my device, and you can ask me to delete them anytime."</p>
      </div>
      <div class="card">
        ${check("consent.disclosed", a.consent.disclosed, "I said I'm an Amway Business Owner and explained why we're meeting")}
        ${check("consent.storeConsent", a.consent.storeConsent, "They agreed to notes being stored on this device")}
        ${!consentOk(a) ? `<p class="small warn">Both boxes are required before continuing.</p>` : ""}
      </div>`;
  }

  function viewHousehold(a) {
    const cl = a.client;
    const valueChips = C.values.map((v) => {
      const rank = cl.values.indexOf(v.id);
      return `<button type="button" class="chip ${rank >= 0 ? "on" : ""}" data-rank="${v.id}" aria-pressed="${rank >= 0}">
        ${rank >= 0 ? `<span class="rank">${rank + 1}</span>` : ""}${esc(v.label)}</button>`;
    }).join("");
    const sens = C.sensitivities.map((s) => {
      const on = cl.sensitivities.includes(s);
      return `<button type="button" class="chip ${on ? "on" : ""}" data-toggle="client.sensitivities" data-val="${esc(s)}" aria-pressed="${on}">${esc(s)}</button>`;
    }).join("");
    return `
      <h1>Household snapshot</h1>
      <div class="card grid">
        <label>Name <input type="text" data-path="client.name" value="${esc(cl.name)}" autocomplete="off" required></label>
        <label>Phone <input type="tel" data-path="client.phone" value="${esc(cl.phone)}" autocomplete="off"></label>
        <label>Email <input type="email" data-path="client.email" value="${esc(cl.email)}" autocomplete="off"></label>
        <label>People in household <input type="number" min="1" inputmode="numeric" data-path="client.householdSize" value="${esc(cl.householdSize)}"></label>
        <label>Kids at home? <select data-path="client.kids">${opts(["", "No", "Yes, under 5", "Yes, 5–12", "Yes, teens", "Mixed ages"], cl.kids)}</select></label>
        <label>Pets? <input type="text" data-path="client.pets" value="${esc(cl.pets)}" placeholder="e.g. 2 dogs"></label>
      </div>
      <div class="card">
        <div class="label">What matters most when you buy things for the house? <span class="muted">(tap their top 2, in order)</span></div>
        <div class="chips">${valueChips}</div>
      </div>
      <div class="card">
        <div class="label">Preferences <span class="muted">(only what they volunteer)</span></div>
        <div class="chips">${sens}</div>
      </div>`;
  }

  function opts(list, cur) {
    return list.map((o) => `<option value="${esc(o)}" ${o === (cur ?? "") ? "selected" : ""}>${esc(o || "—")}</option>`).join("");
  }

  function viewCategory(a, c) {
    const r = a.categories[c.id];
    const base = `categories.${c.id}`;
    const sat = [1, 2, 3, 4, 5].map((n) =>
      `<button type="button" class="sat ${r.satisfaction === n ? "on" : ""}" data-set="${base}.satisfaction" data-val="${n}" data-num aria-pressed="${r.satisfaction === n}">${n}</button>`
    ).join("");
    const fr = c.frustrations.map((f) => {
      const on = r.frustrations.includes(f.id);
      return `<button type="button" class="chip ${on ? "on" : ""}" data-toggle="${base}.frustrations" data-val="${f.id}" aria-pressed="${on}">${esc(f.label)}</button>`;
    }).join("");
    const open = [["yes", "Yes"], ["maybe", "Maybe"], ["no", "No, happy as is"]].map(([v, l]) =>
      `<button type="button" class="chip ${r.openness === v ? "on" : ""}" data-set="${base}.openness" data-val="${v}" aria-pressed="${r.openness === v}">${l}</button>`
    ).join("");

    if (r.skip) {
      return `
        <h1>${c.icon} ${esc(c.name)}</h1>
        <div class="card"><p class="muted">Marked as not relevant.</p>
          <button class="btn ghost" data-set="${base}.skip" data-val="false" data-bool>Undo skip</button></div>`;
    }

    return `
      <h1>${c.icon} ${esc(c.name)}</h1>
      ${c.caution ? `<div class="caution">⚠️ ${esc(c.caution)}</div>` : ""}
      <div class="card prompts">
        <div class="label">Ask</div>
        <ul>${c.prompts.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      </div>
      <div class="card">
        <label>What they use now
          <textarea rows="2" data-path="${base}.current" placeholder="Brands and products, where they buy them">${esc(r.current)}</textarea>
        </label>
        <div class="label">How happy are they with it?</div>
        <div class="sat-row">${sat}<span class="muted small sat-legend">1 = frustrated · 5 = love it</span></div>
        <label>About how much a month? ($)
          <input type="number" min="0" step="1" inputmode="decimal" data-path="${base}.spend" value="${esc(r.spend)}" placeholder="0">
        </label>
      </div>
      <div class="card">
        <div class="label">Anything that bugs them?</div>
        <div class="chips">${fr}</div>
        <label>In their words
          <input type="text" data-path="${base}.other" value="${esc(r.other)}" placeholder="What they actually said">
        </label>
      </div>
      <div class="card">
        <div class="label">Open to trying something different here?</div>
        <div class="chips">${open}</div>
      </div>
      <button class="btn ghost" data-action="skip" data-cat="${c.id}">Not relevant, skip</button>`;
  }

  function viewGoals(a) {
    const g = a.goals;
    const chips = C.goals.map((x) => {
      const on = g.selected.includes(x.id);
      return `<button type="button" class="chip ${on ? "on" : ""}" data-toggle="goals.selected" data-val="${x.id}" aria-pressed="${on}">${x.icon} ${esc(x.label)}</button>`;
    }).join("");
    const topChips = g.selected.map((id) => {
      const x = goalById(id);
      if (!x) return "";
      const on = g.top === id;
      return `<button type="button" class="chip ${on ? "on" : ""}" data-set="goals.top" data-val="${id}" aria-pressed="${on}">${on ? "⭐ " : ""}${esc(x.label)}</button>`;
    }).join("");
    const open = [["yes", "Yes"], ["maybe", "Maybe"], ["no", "No, just habits"]].map(([v, l]) =>
      `<button type="button" class="chip ${g.openness === v ? "on" : ""}" data-set="goals.openness" data-val="${v}" aria-pressed="${g.openness === v}">${l}</button>`
    ).join("");
    return `
      <h1>🎯 Wellness goals</h1>
      <div class="caution">⚠️ Ask about <strong>goals</strong>, not medical conditions. If they bring up a diagnosis, medication, pregnancy, or ongoing symptoms, don't write it down. Say: <em>"That's a great question for your doctor. Check with them before adding anything new."</em></div>
      <div class="card prompts">
        <div class="label">Ask</div>
        <ul>
          <li>"What are some of your health goals right now? More energy, better sleep, managing your weight, anything like that?"</li>
          <li>"Which one matters most to you?"</li>
          <li>"What are you doing for it now? Have you tried anything that didn't work?"</li>
        </ul>
      </div>
      <div class="card">
        <div class="label">Goals they mention</div>
        <div class="chips">${chips}</div>
        ${g.selected.length > 1 ? `<div class="label">Which matters most?</div><div class="chips">${topChips}</div>` : ""}
        <label>In their words
          <input type="text" data-path="goals.words" value="${esc(g.words)}" placeholder="e.g. &quot;I crash every afternoon around 3&quot;">
        </label>
      </div>
      <div class="card">
        <label>What they're doing for it now
          <input type="text" data-path="goals.current" value="${esc(g.current)}" placeholder="e.g. 3 coffees a day, walks after dinner">
        </label>
        <label>Tried before that didn't work
          <input type="text" data-path="goals.tried" value="${esc(g.tried)}" placeholder="e.g. melatonin made them groggy">
        </label>
      </div>
      <div class="card">
        <div class="label">Open to products that support these goals?</div>
        <div class="chips">${open}</div>
      </div>`;
  }

  function viewWrap(a) {
    const w = a.wrap;
    return `
      <h1>Wrap-up</h1>
      <div class="card script">
        <div class="label">Ask</div>
        <p>"Out of everything we talked about, what are the top one to three things you'd most like to be better?"</p>
      </div>
      <div class="card">
        <label>#1 <input type="text" data-path="wrap.pain1" value="${esc(w.pain1)}"></label>
        <label>#2 <input type="text" data-path="wrap.pain2" value="${esc(w.pain2)}"></label>
        <label>#3 <input type="text" data-path="wrap.pain3" value="${esc(w.pain3)}"></label>
      </div>
      <div class="card">
        ${check("consent.followUpOk", a.consent.followUpOk, "They're OK with a follow-up meeting")}
        ${a.consent.followUpOk ? `
        <div class="grid">
          <label>Follow-up date <input type="date" data-path="wrap.followUpDate" value="${esc(w.followUpDate)}"></label>
          <label>Time <input type="time" data-path="wrap.followUpTime" value="${esc(w.followUpTime)}"></label>
        </div>` : `<p class="small muted">No follow-up? That's fine. Thank them, and consider deleting the record afterward.</p>`}
      </div>
      <div class="card">
        <label>Private notes
          <textarea rows="3" data-path="wrap.notes" placeholder="Anything else worth remembering">${esc(w.notes)}</textarea>
        </label>
      </div>`;
  }

  function viewStep(a, idx) {
    const s = steps();
    idx = Math.max(0, Math.min(idx, s.length - 1));
    if (idx > 0 && !consentOk(a)) idx = 0;
    const id = s[idx];
    const body = id === "intro" ? viewIntro(a) : id === "household" ? viewHousehold(a) : id === "wrap" ? viewWrap(a) : id === "goals" ? viewGoals(a) : viewCategory(a, catById(id));
    const last = idx === s.length - 1;
    const blocked = id === "intro" && !consentOk(a);
    return `
      ${progress(a, idx)}
      <div class="step">${body}</div>
      <div class="stepnav">
        ${idx > 0 ? `<a class="btn ghost" href="#/a/${a.id}/${idx - 1}">← Back</a>` : `<a class="btn ghost" href="#/">Exit</a>`}
        ${last
          ? `<a class="btn" href="#/a/${a.id}/summary">See recommendations →</a>`
          : `<a class="btn ${blocked ? "disabled" : ""}" ${blocked ? 'aria-disabled="true"' : `href="#/a/${a.id}/${idx + 1}"`}>Next →</a>`}
      </div>`;
  }

  function viewSummary(a) {
    const recs = recommend(a);
    const by = (b) => recs.filter((x) => x.bucket === b);
    const focus = by("focus"), later = by("later"), keep = by("keep");
    const cl = a.client;
    const pains = [a.wrap.pain1, a.wrap.pain2, a.wrap.pain3].filter((p) => p && p.trim());
    const spend = monthlySpend(a);

    const focusCards = focus.map((x) => `
      <article class="card rec focus">
        <header>
          <h3>${x.cat.icon} ${esc(x.cat.name)}</h3>
          <button class="btn tiny ghost no-print" data-action="override" data-cat="${x.cat.id}" data-val="later">Move to later</button>
        </header>
        ${x.r.current ? `<p class="small"><span class="muted">Uses now:</span> ${esc(x.r.current)}${x.r.spend ? ` · ~${money(+x.r.spend)}/mo` : ""}</p>` : ""}
        <ul class="reasons">${x.reasons.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <p class="small"><span class="muted">Look at:</span> ${x.cat.lines.map(esc).join(", ")}</p>
        <p class="small tip">💡 ${esc(x.cat.talkingPoint)}</p>
        <label class="small">Products I'll bring
          <textarea rows="2" data-path="recs.plan.${x.cat.id}" placeholder="Specific products + cost-per-use vs. what they use now">${esc(a.recs.plan[x.cat.id])}</textarea>
        </label>
      </article>`).join("");

    const mini = (x, actions) => `
      <li class="mini">
        <div><strong>${x.cat.icon} ${esc(x.cat.name)}</strong>
          ${x.reasons.length ? `<div class="small muted">${esc(x.reasons.slice(0, 2).join(" · "))}</div>` : ""}</div>
        <div class="no-print row">${actions}</div>
      </li>`;

    const unassessed = recs.filter((x) => x.bucket === "unassessed");

    return `
      <div class="summary-head">
        <div>
          <h1>${esc(cl.name || "Unnamed client")}</h1>
          <p class="muted small">
            ${cl.householdSize ? `${esc(cl.householdSize)} in household · ` : ""}
            ${cl.kids && cl.kids !== "No" ? `Kids: ${esc(cl.kids)} · ` : ""}
            ${cl.pets ? `Pets: ${esc(cl.pets)} · ` : ""}
            Assessed ${fmtDate(a.createdAt)}
          </p>
        </div>
        <div class="row no-print">
          <a class="btn ghost" href="#/a/${a.id}/1">Edit answers</a>
          <button class="btn ghost" data-action="print">Print prep sheet</button>
          ${a.status === "complete"
            ? `<button class="btn ghost" data-action="reopen">Reopen</button>`
            : `<button class="btn" data-action="complete">Mark complete</button>`}
        </div>
      </div>

      <div class="stats">
        <div class="stat"><div class="label">Follow-up</div><div class="v">${a.consent.followUpOk ? esc(fmtFollowUp(a.wrap) || "Not scheduled") : "Declined"}</div></div>
        <div class="stat"><div class="label">Top priorities</div><div class="v">${cl.values.length ? cl.values.map((v, i) => `${i + 1}. ${esc(valueLabel(v))}`).join("<br>") : "—"}</div></div>
        <div class="stat"><div class="label">Reported spend</div><div class="v">${spend ? `${money(spend)}/mo<br><span class="small muted">${money(spend * 12)}/yr</span>` : "—"}</div></div>
      </div>

      ${pains.length ? `<section class="card"><div class="label">In their words, what they want better</div><ol class="pains">${pains.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></section>` : ""}
      ${a.goals.selected.length ? `<p class="small"><span class="muted">Wellness goals:</span> ${a.goals.selected.map((id) => goalById(id)).filter(Boolean).map((x) => (a.goals.top === x.id ? "⭐ " : "") + esc(x.label)).join(", ")}</p>` : ""}
      ${cl.sensitivities.length ? `<p class="small"><span class="muted">Preferences:</span> ${cl.sensitivities.map(esc).join(", ")}</p>` : ""}

      <h2>Focus for the follow-up <span class="muted">(${focus.length})</span></h2>
      ${focus.length ? `<div class="recs">${focusCards}</div>` : `<p class="muted">Nothing stands out as a clear need yet. That's an honest outcome. Consider a light check-in instead of a product presentation.</p>`}

      ${later.length ? `<h2>Maybe later</h2><ul class="minis">${later.map((x) => mini(x, `<button class="btn tiny ghost" data-action="override" data-cat="${x.cat.id}" data-val="focus">Move to focus</button>`)).join("")}</ul>` : ""}

      ${keep.length ? `<h2>Keep what works</h2><p class="small muted">Tell them so at the follow-up. It builds trust.</p>
        <ul class="minis">${keep.map((x) => mini(x, `<button class="btn tiny ghost" data-action="override" data-cat="${x.cat.id}" data-val="focus">Move to focus</button>`)).join("")}</ul>` : ""}

      ${unassessed.length ? `<p class="small muted no-print">Not covered: ${unassessed.map((x) => `<a href="#/a/${a.id}/${steps().indexOf(x.cat.id)}">${esc(x.cat.name)}</a>`).join(", ")}</p>` : ""}
      ${Object.keys(a.recs.override).length ? `<button class="btn tiny ghost no-print" data-action="reset-overrides">Reset manual changes</button>` : ""}

      ${a.wrap.notes ? `<section class="card"><div class="label">Notes</div><p>${esc(a.wrap.notes)}</p></section>` : ""}

      <aside class="caution">
        <strong>Follow-up guardrails</strong>
        <ul>
          <li>Start by recapping what <em>they</em> said, not with products.</li>
          <li>Show cost-per-use honestly, including where theirs is cheaper.</li>
          <li>No claims that a product treats, cures, or prevents any condition.</li>
          <li>"Keep what you have" is a valid recommendation.</li>
        </ul>
      </aside>`;
  }

  // ---------- router ----------
  function render() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    document.body.classList.remove("summary-page");
    if (parts[0] === "a" && db[parts[1]]) {
      const a = normalize(db[parts[1]]);
      if (parts[2] === "summary") {
        if (!consentOk(a)) { location.hash = `#/a/${a.id}/0`; return; }
        document.body.classList.add("summary-page");
        app.innerHTML = viewSummary(a);
      } else {
        app.innerHTML = viewStep(a, parseInt(parts[2] || "0", 10) || 0);
      }
    } else {
      app.innerHTML = viewHome();
    }
  }

  function current() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    return parts[0] === "a" ? db[parts[1]] : null;
  }

  let lastHash = "";
  window.addEventListener("hashchange", () => {
    render();
    if (location.hash !== lastHash) window.scrollTo(0, 0);
    lastHash = location.hash;
  });

  // ---------- events ----------
  app.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.setting) { settings[el.dataset.setting] = el.value; persistSettings(); return; }
    const a = current();
    if (!a || !el.dataset.path || el.type === "checkbox") return;
    setPath(a, el.dataset.path, el.value);
    touch(a);
  });

  app.addEventListener("change", (e) => {
    const el = e.target;
    const a = current();
    if (!a || !el.dataset.path) return;
    if (el.type === "checkbox") {
      setPath(a, el.dataset.path, el.checked);
      touch(a);
      render();
    } else if (el.tagName === "SELECT") {
      setPath(a, el.dataset.path, el.value);
      touch(a);
    }
  });

  app.addEventListener("click", (e) => {
    const el = e.target.closest("[data-set],[data-toggle],[data-rank],[data-action]");
    if (!el) return;
    const a = current();

    if (el.dataset.set && a) {
      let v = el.dataset.val;
      if ("num" in el.dataset) v = Number(v);
      if ("bool" in el.dataset) v = v === "true";
      // Tapping the selected option again clears it.
      if (getPath(a, el.dataset.set) === v && !("bool" in el.dataset)) v = el.dataset.set.endsWith("satisfaction") ? null : "";
      setPath(a, el.dataset.set, v);
      touch(a); render(); return;
    }
    if (el.dataset.toggle && a) {
      const arr = getPath(a, el.dataset.toggle) || [];
      const v = el.dataset.val;
      setPath(a, el.dataset.toggle, arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
      if (el.dataset.toggle === "goals.selected") {
        const sel = a.goals.selected;
        if (!sel.includes(a.goals.top)) a.goals.top = "";
      }
      touch(a); render(); return;
    }
    if (el.dataset.rank && a) {
      const vals = a.client.values;
      const v = el.dataset.rank;
      if (vals.includes(v)) a.client.values = vals.filter((x) => x !== v);
      else a.client.values = [...vals, v].slice(-2);
      touch(a); render(); return;
    }

    switch (el.dataset.action) {
      case "new": {
        const n = newAssessment();
        location.hash = `#/a/${n.id}/0`;
        break;
      }
      case "delete": {
        const d = db[el.dataset.id];
        if (d && confirm(`Permanently delete ${d.client.name || "this client"}'s assessment? This can't be undone.`)) {
          delete db[el.dataset.id]; persist(); render();
        }
        break;
      }
      case "skip": {
        a.categories[el.dataset.cat].skip = true; touch(a);
        const i = steps().indexOf(el.dataset.cat);
        location.hash = `#/a/${a.id}/${i + 1}`;
        break;
      }
      case "override": {
        a.recs.override[el.dataset.cat] = el.dataset.val; touch(a); render();
        break;
      }
      case "reset-overrides": a.recs.override = {}; touch(a); render(); break;
      case "complete": a.status = "complete"; touch(a); render(); break;
      case "reopen": a.status = "draft"; touch(a); render(); break;
      case "print": window.print(); break;
      case "export": download(`needs-assessments-backup-${today()}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), assessments: db }, null, 2), "application/json"); break;
      case "csv": download(`needs-assessment-followups-${today()}.csv`, toCSV(), "text/csv"); break;
      case "import": importFile.click(); break;
    }
  });

  importFile.addEventListener("change", async () => {
    const f = importFile.files[0];
    importFile.value = "";
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const incoming = data.assessments || data;
      let n = 0;
      for (const [id, a] of Object.entries(incoming)) {
        if (!a || typeof a !== "object" || !a.id) continue;
        if (!db[id] || (a.updatedAt || "") > (db[id].updatedAt || "")) { db[id] = normalize(a); n++; }
      }
      persist(); render();
      alert(`Restored ${n} assessment${n === 1 ? "" : "s"}.`);
    } catch {
      alert("That file doesn't look like a valid backup.");
    }
  });

  const today = () => new Date().toISOString().slice(0, 10);

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toCSV() {
    const cell = (v) => {
      let s = String(v ?? "");
      if (/^[=+\-@]/.test(s)) s = "'" + s; // block spreadsheet formula injection
      return `"${s.replace(/"/g, '""')}"`;
    };
    const head = ["Name", "Phone", "Email", "Status", "Assessed", "Follow-up OK", "Follow-up date", "Follow-up time", "Top priorities", "Wellness goals", "Focus categories", "Pain points", "Reported monthly spend"];
    const rows = Object.values(db).map(normalize).map((a) => [
      a.client.name, a.client.phone, a.client.email, a.status, a.createdAt.slice(0, 10),
      a.consent.followUpOk ? "Yes" : "No", a.wrap.followUpDate, a.wrap.followUpTime,
      a.client.values.map(valueLabel).join("; "),
      a.goals.selected.map((id) => goalById(id)?.label ?? id).join("; "),
      recommend(a).filter((x) => x.bucket === "focus").map((x) => x.cat.name).join("; "),
      [a.wrap.pain1, a.wrap.pain2, a.wrap.pain3].filter(Boolean).join("; "),
      monthlySpend(a) || "",
    ]);
    return [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  }

  render();
  lastHash = location.hash;
})();
