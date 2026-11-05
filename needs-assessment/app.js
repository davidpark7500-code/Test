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
  let settings = readJSON(SETTINGS, {});
  // Storage can be unavailable (private mode, embedded previews); keep working in memory.
  const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* in-memory only */ } };
  const persist = () => safeSet(STORE, JSON.stringify(db));
  const persistSettings = () => safeSet(SETTINGS, JSON.stringify(settings));

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
    a.health ??= { energy: null, stress: null, sleepHours: "", sleepQuality: "", exercise: "", meals: "", water: "", caffeine: "", digestion: "", notes: "", safetyFlag: false };
    a.wrap ??= { pain1: "", pain2: "", pain3: "", followUpDate: "", followUpTime: "", notes: "" };
    a.recs ??= {};
    a.recs.override ??= {};
    a.recs.plan ??= {};
    a.avellum ??= { bloodwork: "", panel: "", telehealth: "", peptides: "", notes: "" };
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
    if (at >= 0) cats.splice(at, 0, "health", "goals", "partner"); else cats.push("health", "goals", "partner");
    return ["intro", "household", ...cats, "wrap"];
  };
  const goalById = (id) => C.goals.find((g) => g.id === id);
  const STEP_LABEL = { intro: ["Intro", "Intro"], household: ["Household", "Household"], goals: ["", "Wellness goals"], health: ["", "Health & lifestyle"], partner: ["", C.partner.name], wrap: ["Wrap-up", "Wrap-up"] };

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
      const cat = { id: "goal:" + gid, name: "Goal: " + goal.label, lines: goal.lines, talkingPoint: goal.talkingPoint, goal: true };
      const res = { cat, r: { current: g.current, spend: "" }, score: 0, reasons: [], bucket: "later" };
      if (g.openness === "no") {
        res.bucket = "keep";
        res.reasons.push("Named this goal but isn't open to products for it. Keep it a conversation.");
      } else {
        let s = 5;
        if (g.top === gid || g.selected.length === 1) { s += 4; res.reasons.push("Their #1 wellness goal"); } else res.reasons.push("A goal they named");
        if (g.words.trim()) res.reasons.push(`In their words: “${g.words.trim()}”`);
        for (const sig of healthSignals(a, gid)) { s += sig.pts; res.reasons.push(sig.why); }
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

  // Lifestyle answers that strengthen a goal the client named.
  function healthSignals(a, gid) {
    const h = a.health, out = [];
    const n = (v) => parseFloat(v);
    const add = (pts, why) => out.push({ pts, why });
    if (gid === "energy") {
      if (h.energy != null && h.energy <= 4) add(2, `Rates energy ${h.energy}/10`);
      if (n(h.caffeine) >= 3) add(1, `${h.caffeine} caffeinated drinks a day`);
      if (h.sleepQuality === "Poor") add(1, "Poor sleep may be draining energy");
    }
    if (gid === "sleep") {
      if (h.sleepQuality === "Poor" || h.sleepQuality === "Fair") add(2, `Sleep quality: ${h.sleepQuality.toLowerCase()}`);
      if (n(h.sleepHours) < 6) add(1, `Sleeps about ${h.sleepHours} hrs`);
    }
    if (gid === "stress" && h.stress != null && h.stress >= 7) add(2, `Rates stress ${h.stress}/10`);
    if (gid === "weight" || gid === "gaps") {
      if (h.meals === "Mostly on the go / fast food" || h.meals === "Skips meals often") add(2, `Eating: ${h.meals.toLowerCase()}`);
      if (gid === "gaps" && n(h.water) < 4) add(1, `Only ~${h.water} glasses of water a day`);
    }
    if ((gid === "weight" || gid === "fitness") && h.exercise) add(gid === "fitness" && h.exercise !== "Rarely" ? 1 : 0, `Exercise: ${h.exercise.toLowerCase()}`);
    if (gid === "digestive" && h.digestion === "Often uncomfortable") add(2, "Digestion often uncomfortable");
    return out;
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
      const focus = recommend(a).filter((x) => x.bucket === "focus").map((x) => x.cat.name);
      return `
        <li class="card client">
          <div class="client-main">
            <div class="client-name">${esc(a.client.name || "Unnamed client")}</div>
            <div class="muted small">
              <span class="pill ${a.status}">${a.status === "complete" ? "Complete" : "In progress"}</span>
              ${isSaved(a) ? `<span class="pill saved">Saved to phone</span>` : `<span class="pill unsaved">Not saved to phone</span>`}
              Started ${fmtDate(a.createdAt)}
              ${a.wrap.followUpDate ? ` · Follow-up <strong>${esc(fmtFollowUp(a.wrap))}</strong>` : ""}
            </div>
            ${focus.length ? `<div class="small focus-line">Focus: ${focus.map(esc).join(", ")}</div>` : ""}
          </div>
          <div class="client-actions">
            <a class="btn ghost" href="#/a/${a.id}/0">Edit</a>
            <a class="btn" href="#/a/${a.id}/summary">Summary</a>
            ${isSaved(a) ? "" : `<button class="btn ghost" data-action="save" data-id="${a.id}">Save to phone</button>`}
            <button class="btn ghost danger" data-action="delete" data-id="${a.id}" aria-label="Delete ${esc(a.client.name)}">Delete</button>
          </div>
        </li>`;
    }).join("");

    const unsaved = list.filter((a) => !isSaved(a)).length;
    return `
      <section class="hero">
        <h1 class="hello">Hello<span class="dot-accent">.</span></h1>
        <p class="muted">Learn what they use and what's not working, then build the follow-up from their answers.</p>
        <button class="btn big" data-action="new">Start a new assessment</button>
      </section>

      <section class="card how">
        <details ${list.length ? "" : "open"}>
          <summary><span class="label">New here? Watch how it works</span> <span class="muted small">1:18</span></summary>
          <video src="video/how-it-works.mp4" poster="video/poster.jpg" title="How it works (voice: elevenlabs.io)" controls playsinline preload="metadata"></video>
          <p class="small muted">Voice: elevenlabs.io</p>
          <ol class="process small">
            <li><b>Tell your story.</b> Your why: getting out of debt, saving for a house, helping Mom retire.</li>
            <li><b>Explain today's goal.</b> Find needs in their day-to-day life. No recommendations today.</li>
            <li><b>Ask questions and listen.</b> The focus is on them and their goals.</li>
            <li><b>Schedule the follow-up</b> with recommendations built around their answers.</li>
          </ol>
          <p class="small muted">The goal is a win-win: genuinely make their life better while they help you reach your goals. Build for the long term, and do such a good job they introduce you to friends you can help too.</p>
        </details>
      </section>

      ${unsaved ? `<div class="caution"><strong>${unsaved} assessment${unsaved === 1 ? " isn't" : "s aren't"} saved to your phone yet.</strong> If browser data is cleared, ${unsaved === 1 ? "it's" : "they're"} gone. Tap <em>Save to phone</em> on each one, or <em>Save all</em> below.</div>` : ""}
      <h2>Clients <span class="muted">(${list.length})</span></h2>
      ${list.length ? `<ul class="client-list">${rows}</ul>` : `<p class="muted empty">No assessments yet.</p>`}

      <section class="card data-tools">
        <h3>Your data</h3>
        <p class="small muted">The app keeps everything in this browser. Saved copies go wherever you pick in your phone's share sheet (Files, Google Drive, or Dropbox if the app is installed) and survive clearing browser data. To bring them back, tap <em>Load saved files</em> and pick one or more. Saved files contain clients' health answers, so keep them in a private folder, and delete records for people who don't move forward.</p>
        <div class="row wrap">
          <button class="btn ghost" data-action="export">Save all to phone</button>
          <button class="btn ghost" data-action="import">Load saved files</button>
          <button class="btn ghost" data-action="csv">Export follow-ups (CSV)</button>
        </div>
      </section>`;
  }

  function stepTitle(id) {
    return (STEP_LABEL[id] ?? [null, catById(id).name])[1];
  }

  function progress(a, idx) {
    const s = steps();
    const pct = Math.round(((idx + 1) / s.length) * 100);
    const pad = (n) => String(n).padStart(2, "0");
    const opts = s.map((id, i) => `<option value="${i}" ${i === idx ? "selected" : ""}>${pad(i + 1)}  ${esc(stepTitle(id))}</option>`).join("");
    return `
      <div class="stephead">
        <span class="stepnum">${pad(idx + 1)} <span class="muted">/ ${pad(s.length)}</span></span>
        ${consentOk(a) ? `<label class="jump"><span class="sr">Jump to section</span><select data-jump="${a.id}" aria-label="Jump to section">${opts}</select></label>` : ""}
      </div>
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct}%"></div></div>`;
  }

  // Only requirement to continue: they're OK with notes being taken.
  const consentOk = (a) => !!a.consent.storeConsent;

  function check(path, checked, label, extra = "") {
    return `<label class="check ${extra}"><input type="checkbox" data-path="${path}" ${checked ? "checked" : ""}><span>${label}</span></label>`;
  }

  function viewIntro(a) {
    return `
      <h1>Before you start</h1>
      <div class="card">
        <div class="label">1 · Tell your story</div>
        <p class="small">Share your why in your own words: getting out of debt, saving up for a house, helping Mom retire.</p>
      </div>
      <div class="card script">
        <div class="label">2 · Explain today's goal (read aloud)</div>
        <p>"Thanks for making time. Today isn't a sales pitch, and I won't be recommending anything today. I'd like to learn what you use around the house now, what you like, and what bugs you. If I think something could genuinely work better or cost less, I'll put together a short list for a second meeting. If what you have works, I'll tell you to keep it.</p>
        <p>Mind if I take a few notes as we go?"</p>
      </div>
      <div class="card">
        ${check("consent.storeConsent", a.consent.storeConsent, "They're OK with me taking notes")}
        ${!consentOk(a) ? `<p class="small warn">Tick this to continue.</p>` : ""}
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
        <h1>${esc(c.name)}</h1>
        <div class="card"><p class="muted">Marked as not relevant.</p>
          <button class="btn ghost" data-set="${base}.skip" data-val="false" data-bool>Undo skip</button></div>`;
    }

    return `
      <h1>${esc(c.name)}</h1>
      ${c.caution ? `<div class="caution">${esc(c.caution)}</div>` : ""}
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

  function viewHealth(a) {
    const h = a.health;
    const scale = (path, cur, lo, hi) => Array.from({ length: 10 }, (_, i) => i + 1).map((n) =>
      `<button type="button" class="sat sm ${cur === n ? "on" : ""}" data-set="${path}" data-val="${n}" data-num aria-pressed="${cur === n}">${n}</button>`
    ).join("") + `<span class="muted small sat-legend">1 = ${lo} · 10 = ${hi}</span>`;
    const pick = (path, cur, list) => `<div class="chips">${list.map((v) =>
      `<button type="button" class="chip ${cur === v ? "on" : ""}" data-set="${path}" data-val="${esc(v)}" aria-pressed="${cur === v}">${esc(v)}</button>`).join("")}</div>`;
    return `
      <h1>Health & lifestyle</h1>
      <div class="card script">
        <div class="label">Transition</div>
        <p>"Now some questions about you, not your house. There are no right answers. This helps me figure out what's actually worth suggesting."</p>
      </div>
      <div class="card">
        <div class="label">"How are your energy levels during a normal day?"</div>
        <div class="sat-row">${scale("health.energy", h.energy, "always tired", "great all day")}</div>
        <div class="label">"How would you rate your stress lately?"</div>
        <div class="sat-row">${scale("health.stress", h.stress, "very calm", "very stressed")}</div>
      </div>
      <div class="card">
        <div class="label">"How are you sleeping?"</div>
        ${pick("health.sleepQuality", h.sleepQuality, ["Great", "Good", "Fair", "Poor"])}
        <label>Hours a night, roughly <input type="number" min="0" max="14" step="0.5" inputmode="decimal" data-path="health.sleepHours" value="${esc(h.sleepHours)}"></label>
      </div>
      <div class="card">
        <div class="label">"What does a typical day of eating look like?"</div>
        ${pick("health.meals", h.meals, ["Mostly home-cooked", "Mix of home and takeout", "Mostly on the go / fast food", "Skips meals often"])}
        <div class="grid">
          <label>Glasses of water a day <input type="number" min="0" inputmode="numeric" data-path="health.water" value="${esc(h.water)}"></label>
          <label>Coffee / energy drinks a day <input type="number" min="0" inputmode="numeric" data-path="health.caffeine" value="${esc(h.caffeine)}"></label>
        </div>
      </div>
      <div class="card">
        <div class="label">"How often do you get to exercise or move?"</div>
        ${pick("health.exercise", h.exercise, ["Rarely", "1–2× a week", "3–4× a week", "5+× a week"])}
        <div class="label">"How's your digestion, generally?"</div>
        ${pick("health.digestion", h.digestion, ["Usually fine", "Sometimes off", "Often uncomfortable"])}
        <label>Anything else they shared <input type="text" data-path="health.notes" value="${esc(h.notes)}" placeholder="In their words"></label>
      </div>
      <div class="card">
        <div class="label">Safety check</div>
        <p class="small muted">"Are you on any prescription medications, pregnant or nursing, or managing an ongoing health condition?" Record yes or no only. You don't need details.</p>
        ${check("health.safetyFlag", h.safetyFlag, "Yes: they should check with their doctor before starting any supplement")}
      </div>`;
  }

  function viewPartner(a) {
    const P = C.partner, v = a.avellum;
    const pick = (path, cur, list) => `<div class="chips">${list.map(([val, l]) =>
      `<button type="button" class="chip ${cur === val ? "on" : ""}" data-set="${path}" data-val="${val}" aria-pressed="${cur === val}">${esc(l)}</button>`).join("")}</div>`;
    const yn = [["yes", "Yes"], ["maybe", "Maybe"], ["no", "No"]];
    const fit = partnerFit(a);
    return `
      <h1>${esc(P.name)}</h1>
      <div class="card">
        <div class="label">"Have you heard of things like Ozempic, GLP-1s, or other peptide therapies? You may have heard people use them for all kinds of things, like weight loss, better sleep, or building muscle. Any interest in learning more?"</div>
        ${pick("avellum.peptides", v.peptides, [["interested", "Interested"], ["curious", "Curious, want to learn"], ["no", "Not interested"]])}
      </div>
      <div class="card script">
        <div class="label">Read aloud</div>
        <p>"Amway has a brand new partnership with ${esc(P.name)}, a clinician-led telehealth service plus online pharmacy. You can start with a blood panel via mail or chat with a licensed telehealth clinician to determine whether additional support like peptide therapy is a fit."</p>
      </div>
      ${fit.goals.length ? `<p class="small"><span class="muted">Related goals they named:</span> ${fit.goals.map(esc).join(", ")}</p>` : ""}
      ${a.health.safetyFlag ? `<div class="caution">Their safety check is ticked. If they're interested, they must tell the clinician about their medications or condition.</div>` : ""}
      <div class="card">
        <div class="label">"When did you last have bloodwork done?"</div>
        ${pick("avellum.bloodwork", v.bloodwork, [["recent", "Within the last year"], ["old", "More than a year ago"], ["never", "Never / not sure"]])}
        <div class="label">"Would you want to see your own numbers so any recommendations are based on your data?"</div>
        ${pick("avellum.panel", v.panel, yn)}
        <div class="label">"Would you be open to a telehealth visit with a licensed clinician about your goals?"</div>
        ${pick("avellum.telehealth", v.telehealth, yn)}
        <label>Notes <input type="text" data-path="avellum.notes" value="${esc(v.notes)}" placeholder="Questions they asked, concerns"></label>
      </div>
      <div class="caution small">${esc(P.note)}</div>`;
  }

  function partnerFit(a) {
    const P = C.partner, v = a.avellum;
    const goals = a.goals.selected.filter((g) => P.goals.includes(g)).map((g) => goalById(g)?.label).filter(Boolean);
    const reasons = [];
    if (goals.length) reasons.push(`Related goals: ${goals.join(", ")}`);
    if (v.panel === "yes") reasons.push("Wants to see their own numbers");
    else if (v.panel === "maybe") reasons.push("Maybe interested in a blood panel");
    if (v.bloodwork === "old" || v.bloodwork === "never") reasons.push(v.bloodwork === "never" ? "No recent bloodwork" : "Bloodwork over a year old");
    if (v.telehealth === "yes") reasons.push("Open to a telehealth clinician visit");
    if (v.peptides === "interested") reasons.push("Interested in peptide therapy");
    else if (v.peptides === "curious") reasons.push("Curious about peptide therapy");
    if (v.notes.trim()) reasons.push(`Notes: “${v.notes.trim()}”`);
    const yes = [v.panel, v.telehealth].filter((x) => x === "yes").length + (v.peptides === "interested" ? 1 : 0);
    const maybe = [v.panel, v.telehealth].filter((x) => x === "maybe").length + (v.peptides === "curious" ? 1 : 0);
    const declined = v.panel === "no" && v.telehealth === "no" && v.peptides === "no";
    const level = declined ? "no" : yes >= 1 ? "refer" : maybe >= 1 ? "maybe" : "none";
    return { goals, reasons, level };
  }

  function viewGoals(a) {
    const g = a.goals;
    const chips = C.goals.map((x) => {
      const on = g.selected.includes(x.id);
      return `<button type="button" class="chip ${on ? "on" : ""}" data-toggle="goals.selected" data-val="${x.id}" aria-pressed="${on}">${esc(x.label)}</button>`;
    }).join("");
    const topChips = g.selected.map((id) => {
      const x = goalById(id);
      if (!x) return "";
      const on = g.top === id;
      return `<button type="button" class="chip ${on ? "on" : ""}" data-set="goals.top" data-val="${id}" aria-pressed="${on}">${on ? "" : ""}${esc(x.label)}</button>`;
    }).join("");
    const open = [["yes", "Yes"], ["maybe", "Maybe"], ["no", "No, just habits"]].map(([v, l]) =>
      `<button type="button" class="chip ${g.openness === v ? "on" : ""}" data-set="goals.openness" data-val="${v}" aria-pressed="${g.openness === v}">${l}</button>`
    ).join("");
    return `
      <h1>Wellness goals</h1>
      <div class="caution">Ask freely. Two lines: don't diagnose, and don't say a product treats a condition. Use the catalog's support wording.</div>
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
        </div>
        <div class="caution">
          <strong>Before the follow-up</strong>
          <ul>
            <li>With their OK, create their free customer account at Amway.com. You'll just need their name, phone number, and email.</li>
            <li>Then create a free shopping list so it's ready for the follow-up.</li>
          </ul>
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
    const body = id === "intro" ? viewIntro(a) : id === "household" ? viewHousehold(a) : id === "wrap" ? viewWrap(a) : id === "goals" ? viewGoals(a) : id === "health" ? viewHealth(a) : id === "partner" ? viewPartner(a) : viewCategory(a, catById(id));
    const last = idx === s.length - 1;
    const blocked = id === "intro" && !consentOk(a);
    return `
      ${progress(a, idx)}
      <div class="step">${body}</div>
      <div class="stepnav">
        ${idx > 0 ? `<a class="btn ghost" href="#/a/${a.id}/${idx - 1}">← Back</a>` : `<a class="btn ghost" href="#/">Exit</a>`}
        ${last
          ? `<a class="btn" href="#/a/${a.id}/done">Finish</a>`
          : `<a class="btn ${blocked ? "disabled" : ""}" ${blocked ? 'aria-disabled="true"' : `href="#/a/${a.id}/${idx + 1}"`}>Next →</a>`}
      </div>`;
  }

  function healthLine(a) {
    const h = a.health, bits = [];
    if (h.energy != null) bits.push(`Energy ${h.energy}/10`);
    if (h.stress != null) bits.push(`Stress ${h.stress}/10`);
    if (h.sleepQuality || h.sleepHours) bits.push(`Sleep ${[h.sleepQuality, h.sleepHours && h.sleepHours + " hrs"].filter(Boolean).join(", ")}`);
    if (h.meals) bits.push(h.meals);
    if (h.exercise) bits.push(`Exercise ${h.exercise}`);
    if (h.water) bits.push(`${h.water} glasses water`);
    if (h.caffeine) bits.push(`${h.caffeine} caffeine/day`);
    if (h.digestion) bits.push(`Digestion: ${h.digestion.toLowerCase()}`);
    return bits.length ? `<p class="small"><span class="muted">Health snapshot:</span> ${bits.map(esc).join(" · ")}${h.notes ? ` · “${esc(h.notes)}”` : ""}</p>` : "";
  }

  function partnerSummary(a) {
    const P = C.partner, fit = partnerFit(a);
    if (fit.level === "none" || fit.level === "no") return "";
    return `
      <h2>${esc(P.name)} referral</h2>
      <article class="card rec ${fit.level === "refer" ? "focus" : ""}">
        <p class="small"><strong>${fit.level === "refer" ? "Interested: share the Avellum link at the follow-up." : "Curious: give a short explanation and let them decide."}</strong></p>
        <ul class="reasons">${fit.reasons.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <p class="small"><span class="muted">Link to send:</span> <a href="${esc(P.url)}" target="_blank" rel="noopener">${esc(P.url)}</a></p>
        <p class="small caution">${esc(P.note)}${a.health.safetyFlag ? " <strong>Their safety check is ticked: they must tell the clinician about their medications or condition.</strong>" : ""}</p>
      </article>`;
  }

  // Screen to hand to the client at the end of the appointment.
  function viewDone(a) {
    const first = (a.client.name || "").trim().split(/\s+/)[0];
    const when = a.consent.followUpOk && a.wrap.followUpDate ? fmtFollowUp(a.wrap) : "";
    return `
      <section class="done">
        <h1>${first ? `Thanks, ${esc(first)}.<br>` : "Thank you.<br>"}${when ? "Talk soon." : "This was great."}</h1>
        ${when ? `<p class="done-when">See you ${esc(when)}.</p>` : `<p class="done-when">I'll be in touch if anything comes up that's worth your time.</p>`}
        <a class="btn" href="#/a/${a.id}/summary">Open my notes</a>
      </section>`;
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
          <h3>${esc(x.cat.name)}</h3>
          <button class="btn tiny ghost no-print" data-action="override" data-cat="${x.cat.id}" data-val="later">Move to later</button>
        </header>
        ${x.r.current ? `<p class="small"><span class="muted">Uses now:</span> ${esc(x.r.current)}${x.r.spend ? ` · ~${money(+x.r.spend)}/mo` : ""}</p>` : ""}
        <ul class="reasons">${x.reasons.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <p class="small"><span class="muted">Look at:</span> ${x.cat.lines.map(esc).join(", ")}</p>
        <p class="small tip">${esc(x.cat.talkingPoint)}</p>
        <label class="small">Products I'll bring
          <textarea rows="2" data-path="recs.plan.${x.cat.id}" placeholder="Specific products + cost-per-use vs. what they use now">${esc(a.recs.plan[x.cat.id])}</textarea>
        </label>
      </article>`).join("");

    const mini = (x, actions) => `
      <li class="mini">
        <div><strong>${esc(x.cat.name)}</strong>
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
          <button class="btn ghost" data-action="save" data-id="${a.id}">${isSaved(a) ? "Saved ✓ Save again" : "Save to phone"}</button>
          ${a.status === "complete"
            ? `<button class="btn ghost" data-action="reopen">Reopen</button>`
            : `<button class="btn" data-action="complete">Mark complete &amp; save</button>`}
        </div>
      </div>

      ${a.health.safetyFlag ? `<div class="caution"><strong>Doctor check first.</strong> They take prescription medication, are pregnant/nursing, or manage an ongoing condition. Before recommending any supplement, suggest they show the list to their doctor or pharmacist.</div>` : ""}
      <div class="stats">
        <div class="stat"><div class="label">Follow-up</div><div class="v">${a.consent.followUpOk ? esc(fmtFollowUp(a.wrap) || "Not scheduled") : "Declined"}</div></div>
        <div class="stat"><div class="label">Top priorities</div><div class="v">${cl.values.length ? cl.values.map((v, i) => `${i + 1}. ${esc(valueLabel(v))}`).join("<br>") : "—"}</div></div>
        <div class="stat"><div class="label">Reported spend</div><div class="v">${spend ? `${money(spend)}/mo<br><span class="small muted">${money(spend * 12)}/yr</span>` : "—"}</div></div>
      </div>

      ${pains.length ? `<section class="card"><div class="label">In their words, what they want better</div><ol class="pains">${pains.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></section>` : ""}
      ${healthLine(a)}
      ${a.goals.selected.length ? `<p class="small"><span class="muted">Wellness goals:</span> ${a.goals.selected.map((id) => goalById(id)).filter(Boolean).map((x) => (a.goals.top === x.id ? "" : "") + esc(x.label)).join(", ")}</p>` : ""}
      ${cl.sensitivities.length ? `<p class="small"><span class="muted">Preferences:</span> ${cl.sensitivities.map(esc).join(", ")}</p>` : ""}

      <h2>Focus for the follow-up <span class="muted">(${focus.length})</span></h2>
      ${focus.length ? `<div class="recs">${focusCards}</div>` : `<p class="muted">Nothing stands out as a clear need yet. That's an honest outcome. Consider a light check-in instead of a product presentation.</p>`}

      ${partnerSummary(a)}

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
    document.body.classList.remove("summary-page", "done-page");
    if (parts[0] === "a" && db[parts[1]]) {
      const a = normalize(db[parts[1]]);
      if (parts[2] === "done") {
        if (!consentOk(a)) { location.hash = `#/a/${a.id}/0`; return; }
        document.body.classList.add("done-page");
        app.innerHTML = viewDone(a);
      } else if (parts[2] === "summary") {
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
    if (el.dataset.jump) { location.hash = `#/a/${el.dataset.jump}/${el.value}`; return; }
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
      if (getPath(a, el.dataset.set) === v && !("bool" in el.dataset)) v = "num" in el.dataset ? null : "";
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
      case "complete": a.status = "complete"; touch(a); saveToPhone([a]); render(); break;
      case "save": { const t = db[el.dataset.id]; if (t) saveToPhone([normalize(t)]); break; }
      case "reopen": a.status = "draft"; touch(a); render(); break;
      case "print": window.print(); break;
      case "export": saveToPhone(Object.values(db).map(normalize)); break;
      case "csv": download(`needs-assessment-followups-${today()}.csv`, toCSV(), "text/csv"); break;
      case "import": importFile.click(); break;
    }
  });

  // Reads saved .html copies (data embedded) and older .json backups.
  function parseSaved(text) {
    const t = text.trim();
    if (t.startsWith("<")) {
      const m = t.match(/<script type="application\/json" id="na-data">([\s\S]*?)<\/script>/);
      if (!m) throw new Error("no data");
      return JSON.parse(m[1]); // "<" is stored as \u003c, which JSON decodes
    }
    return JSON.parse(t);
  }

  importFile.addEventListener("change", async () => {
    const files = [...importFile.files];
    importFile.value = "";
    if (!files.length) return;
    let n = 0, bad = 0;
    for (const f of files) {
      try {
        const data = parseSaved(await f.text());
        const incoming = data.assessments || data;
        for (const [id, a] of Object.entries(incoming)) {
          if (!a || typeof a !== "object" || !a.id) continue;
          if (!db[id] || (a.updatedAt || "") >= (db[id].updatedAt || "")) { db[id] = normalize(a); db[id].savedAt = db[id].savedAt || a.updatedAt; n++; }
        }
      } catch { bad++; }
    }
    persist(); render();
    alert(`Loaded ${n} assessment${n === 1 ? "" : "s"}.${bad ? ` ${bad} file${bad === 1 ? " wasn't" : "s weren't"} a saved assessment.` : ""}`);
  });

  // ---------- save to phone ----------
  const isSaved = (a) => !!a.savedAt && a.savedAt >= a.updatedAt;
  const slug = (s) => (s || "client").trim().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "client";

  function saveToPhone(list) {
    if (!list.length) return;
    const one = list.length === 1;
    const name = one ? `Customer-Needs-Assessment_${slug(list[0].client.name)}_${today()}.html` : `Customer-Needs-Assessments_all-${list.length}_${today()}.html`;
    const html = exportHTML(list);
    const markSaved = () => { const now = new Date().toISOString(); list.forEach((a) => { db[a.id].savedAt = now; }); persist(); render(); };
    // Phones: open the share sheet (Save to Files / Drive). Must run inside the tap.
    try {
      const file = new File([html], name, { type: "text/html" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: name }).then(markSaved).catch((e) => {
          if (e && e.name === "AbortError") return; // they cancelled
          download(name, html, "text/html"); markSaved();
        });
        return;
      }
    } catch { /* fall through to download */ }
    download(name, html, "text/html");
    markSaved();
  }

  // A readable copy of the notes that also carries the data, so it can be loaded back in.
  function exportHTML(list) {
    const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), assessments: Object.fromEntries(list.map((a) => [a.id, a])) }).replace(/</g, "\\u003c");
    const sec = (title, body) => (body ? `<h2>${esc(title)}</h2>${body}` : "");
    const li = (arr) => (arr.length ? `<ul>${arr.map((t) => `<li>${t}</li>`).join("")}</ul>` : "");
    const docs = list.map((a) => {
      const recs = recommend(a), cl = a.client, h = a.health;
      const by = (b) => recs.filter((x) => x.bucket === b);
      const fit = partnerFit(a);
      const answers = C.categories.map((c) => {
        const r = a.categories[c.id];
        if (r.skip) return `<li><b>${esc(c.name)}:</b> skipped</li>`;
        if (!(r.current || r.satisfaction != null || r.frustrations.length)) return "";
        const fr = r.frustrations.map((id) => c.frustrations.find((f) => f.id === id)?.label).filter(Boolean);
        return `<li><b>${esc(c.name)}:</b> ${esc(r.current || "—")}${r.satisfaction != null ? ` · ${r.satisfaction}/5` : ""}${r.spend ? ` · $${esc(r.spend)}/mo` : ""}${fr.length ? ` · ${esc(fr.join(", "))}` : ""}${r.other ? ` · “${esc(r.other)}”` : ""}${r.openness ? ` · open: ${esc(r.openness)}` : ""}</li>`;
      }).join("");
      return `<article>
        <h1>${esc(cl.name || "Unnamed client")}</h1>
        <p class="meta">${[cl.phone, cl.email].filter(Boolean).map(esc).join(" · ")}${cl.phone || cl.email ? "<br>" : ""}Assessed ${fmtDate(a.createdAt)}${a.consent.followUpOk && a.wrap.followUpDate ? ` · Follow-up ${esc(fmtFollowUp(a.wrap))}` : ""}</p>
        ${h.safetyFlag ? `<p class="flag">Doctor check first before any supplement (medication, pregnancy/nursing, or ongoing condition).</p>` : ""}
        ${sec("Top priorities", cl.values.length ? `<p>${cl.values.map((v, i) => `${i + 1}. ${esc(valueLabel(v))}`).join("<br>")}</p>` : "")}
        ${sec("In their words", li([a.wrap.pain1, a.wrap.pain2, a.wrap.pain3].filter(Boolean).map(esc)))}
        ${sec("Focus for the follow-up", by("focus").map((x) => `<h3>${esc(x.cat.name)}</h3>${li(x.reasons.map(esc))}<p><i>Look at:</i> ${x.cat.lines.map(esc).join(", ")}</p>${a.recs.plan[x.cat.id] ? `<p><i>Bring:</i> ${esc(a.recs.plan[x.cat.id])}</p>` : ""}`).join(""))}
        ${fit.level === "refer" || fit.level === "maybe" ? sec(C.partner.name + " referral", li(fit.reasons.map(esc))) : ""}
        ${sec("Maybe later", li(by("later").map((x) => esc(x.cat.name))))}
        ${sec("Keep what works", li(by("keep").map((x) => esc(x.cat.name))))}
        ${sec("Health snapshot", healthLine(a).replace(/<span class="muted">Health snapshot:<\/span>/, ""))}
        ${sec("Wellness goals", a.goals.selected.length ? `<p>${a.goals.selected.map((id) => goalById(id)?.label).filter(Boolean).map(esc).join(", ")}${a.goals.words ? ` · “${esc(a.goals.words)}”` : ""}</p>` : "")}
        ${sec("All answers", answers ? `<ul>${answers}</ul>` : "")}
        ${sec("Notes", a.wrap.notes ? `<p>${esc(a.wrap.notes)}</p>` : "")}
      </article>`;
    }).join("");
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Customer Needs Assessment${list.length === 1 ? " · " + esc(list[0].client.name || "") : "s"}</title>
<style>body{font:15px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif;color:#0b0b0b;max-width:680px;margin:0 auto;padding:24px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 6px;border-top:1.5px solid #0b0b0b;padding-top:10px}h3{font-size:15px;margin:12px 0 2px}
.meta{color:#5b6563;margin:0}.flag{background:#eaf6f2;padding:10px 12px}ul{padding-left:18px;margin:4px 0}article{padding-bottom:28px;margin-bottom:28px;border-bottom:6px solid #bde3da}
.note{font-size:12px;color:#5b6563}</style></head><body>
<p class="note">Saved from Customer Needs Assessment on ${esc(new Date().toLocaleString())}. To restore, open the app and tap “Load saved files”. Contains private client information.</p>
${docs}
<script type="application/json" id="na-data">${data}</script>
</body></html>`;
  }

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
    const head = ["Name", "Phone", "Email", "Status", "Assessed", "Follow-up OK", "Follow-up date", "Follow-up time", "Top priorities", "Wellness goals", "Focus categories", "Pain points", "Reported monthly spend", "Doctor check flag", "Avellum interest"];
    const rows = Object.values(db).map(normalize).map((a) => [
      a.client.name, a.client.phone, a.client.email, a.status, a.createdAt.slice(0, 10),
      a.consent.followUpOk ? "Yes" : "No", a.wrap.followUpDate, a.wrap.followUpTime,
      a.client.values.map(valueLabel).join("; "),
      a.goals.selected.map((id) => goalById(id)?.label ?? id).join("; "),
      recommend(a).filter((x) => x.bucket === "focus").map((x) => x.cat.name).join("; "),
      [a.wrap.pain1, a.wrap.pain2, a.wrap.pain3].filter(Boolean).join("; "),
      monthlySpend(a) || "",
      a.health.safetyFlag ? "Yes" : "",
      ({ refer: "Interested", maybe: "Curious", no: "Declined", none: "" })[partnerFit(a).level],
    ]);
    return [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  }

  render();
  lastHash = location.hash;
})();
