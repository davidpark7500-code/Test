// Customer Needs Assessment: emails self-serve results to whoever made the link, and to their customer.
// Paste into a Google Apps Script project on a dedicated sending account, then
// Deploy > Web app (Execute as: Me, Access: Anyone).
// No secrets live here. The shared access code is stored only as a salted hash in Script Properties.

const INVITE_DAYS = 60;
const MAX_BYTES = 300000;
const MAX_FAILS = 10; // wrong access codes allowed per hour
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function doGet() { return json_({ ok: true }); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > MAX_BYTES) return json_({ ok: false, error: "bad" });
    const req = JSON.parse(raw);
    lock.waitLock(20000);
    if (req.action === "mint") return json_(mint_(req));
    if (req.action === "submit") return json_(submit_(req));
    return json_({ ok: false, error: "bad" });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: "server" });
  } finally {
    lock.releaseLock();
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- links ----------
function hash_(code, salt) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ":" + code, Utilities.Charset.UTF_8));
}

// The first access code ever used becomes the code. After that it must match.
// The invite remembers who made it, so results can only go to that person.
function mint_(req) {
  const props = PropertiesService.getScriptProperties();
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get("fails") || 0);
  if (fails >= MAX_FAILS) return { ok: false, error: "locked" };

  const code = String(req.code || "");
  if (code.length < 6) return { ok: false, error: "code" };
  let salt = props.getProperty("salt");
  if (!salt) {
    salt = Utilities.getUuid();
    props.setProperties({ salt: salt, codeHash: hash_(code, salt) });
  } else if (hash_(code, salt) !== props.getProperty("codeHash")) {
    cache.put("fails", String(fails + 1), 3600);
    return { ok: false, error: "code" };
  }

  const ownerName = clean_(req.ownerName).slice(0, 80);
  const ownerEmail = clean_(req.ownerEmail);
  if (!ownerName || !EMAIL.test(ownerEmail)) return { ok: false, error: "bad" };

  pruneInvites_(props);
  const token = Utilities.getUuid().replace(/-/g, "");
  props.setProperty("inv_" + token, JSON.stringify({ created: Date.now(), ownerName: ownerName, ownerEmail: ownerEmail }));
  return { ok: true, token: token };
}

function pruneInvites_(props) {
  const all = props.getProperties();
  Object.keys(all).forEach((k) => {
    if (k.indexOf("inv_") !== 0) return;
    if (expired_(JSON.parse(all[k]))) props.deleteProperty(k);
  });
}

function expired_(inv) { return Date.now() - inv.created > INVITE_DAYS * 86400000; }

// ---------- results ----------
function submit_(req) {
  const props = PropertiesService.getScriptProperties();
  const key = "inv_" + String(req.token || "");
  const stored = props.getProperty(key);
  if (!stored) return { ok: false, error: "invalid" };
  const inv = JSON.parse(stored);
  if (inv.used) return { ok: false, error: "used" };
  if (expired_(inv)) return { ok: false, error: "expired" };

  const a = req.assessment;
  const client = (a && a.client) || {};
  const email = String(client.email || "").trim();
  const name = clean_(client.name) || "Customer";
  if (!a || !/^[\w-]{1,40}$/.test(String(a.id)) || !EMAIL.test(email)) return { ok: false, error: "bad" };
  if (MailApp.getRemainingDailyQuota() < 2) return { ok: false, error: "busy" };

  const answers = sections_(req.answers);
  const owner = sections_(req.owner);
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const file = "Customer-Needs-Assessment_" + name.replace(/[^\w]+/g, "-") + "_" + date + ".json";
  const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), assessments: { [a.id]: a } });

  const ownerIntro = name + " filled out the assessment. To add them to your client list, save the attached file, then tap Load saved files in the app. Reply to this email to reach them.";
  const ownerAll = owner.concat(answers);
  MailApp.sendEmail({
    to: inv.ownerEmail,
    replyTo: email,
    name: "Customer Needs Assessment",
    subject: "New Customer Needs Assessment: " + name,
    body: text_(ownerIntro, ownerAll),
    htmlBody: html_(ownerIntro, ownerAll),
    attachments: [Utilities.newBlob(data, "application/json", file)],
  });

  // The owner has the answers from here on, so the link is spent even if their copy can't be delivered.
  inv.used = Date.now();
  props.setProperty(key, JSON.stringify(inv));

  const intro = "Thanks for filling this out. Here's a copy of your answers. Reply to this email if you'd like to change anything.";
  try {
    MailApp.sendEmail({
      to: email,
      replyTo: inv.ownerEmail,
      name: inv.ownerName,
      subject: "Your Customer Needs Assessment answers",
      body: text_(intro, answers),
      htmlBody: html_(intro, answers),
    });
    return { ok: true, copySent: true };
  } catch (err) {
    console.error(err);
    return { ok: true, copySent: false };
  }
}

function clean_(v) { return String(v == null ? "" : v).replace(/[\r\n]+/g, " ").trim().slice(0, 500); }

// Emails are built here from plain text, so answers can't inject markup.
function sections_(list) {
  return (Array.isArray(list) ? list : []).slice(0, 40).map((s) => ({
    h: clean_(s && s.h),
    lines: (Array.isArray(s && s.lines) ? s.lines : []).slice(0, 40).map(clean_).filter(Boolean),
  })).filter((s) => s.h && s.lines.length);
}

function esc_(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function text_(intro, sections) {
  return [intro].concat(sections.map((s) => s.h.toUpperCase() + "\n" + s.lines.map((l) => "- " + l).join("\n"))).join("\n\n");
}

function html_(intro, sections) {
  const body = sections.map((s) =>
    '<h2 style="font-size:15px;margin:22px 0 6px;padding-top:10px;border-top:2px solid #bde3da">' + esc_(s.h) + "</h2>" +
    '<ul style="margin:4px 0;padding-left:18px">' + s.lines.map((l) => "<li>" + esc_(l) + "</li>").join("") + "</ul>"
  ).join("");
  return '<div style="font:15px/1.55 -apple-system,Helvetica,Arial,sans-serif;color:#0b0b0b;max-width:620px"><p>' + esc_(intro) + "</p>" + body + "</div>";
}
