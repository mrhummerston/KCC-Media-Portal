// Kingsway Christian College – Media Equipment Loans Portal
// Cloudflare Pages Function: handles everything under /api/
// Needs: a D1 database bound as "DB", and a secret called TEACHER_CODE.
// Optional: a variable STUDENT_ACCESS = "off" makes the whole site teacher-only.

const OPEN = ["loans", "handbacks"];      // students may save these
const HIDDEN = ["ledger"];                // only teachers can read these
let ready = false;

async function init(db) {
  if (ready) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, json TEXT NOT NULL, updated INTEGER NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS attempts (ip TEXT PRIMARY KEY, fails INTEGER NOT NULL, since INTEGER NOT NULL)").run();
  const seeded = await db.prepare("SELECT v FROM meta WHERE k='seeded'").first();
  if (!seeded) {
    const now = Date.now();
    const stmts = Object.entries(SEED).map(([p, d]) =>
      db.prepare("INSERT OR IGNORE INTO docs (path, json, updated) VALUES (?, ?, ?)").bind(p, JSON.stringify(d), now));
    stmts.push(db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('seeded', 1)"));
    stmts.push(db.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('version', 1)"));
    await db.batch(stmts);
  }
  // one-off inventory changes (run once, then remembered)
  const MIG = "mig-2026-10-audio";
  if (!(await db.prepare("SELECT v FROM meta WHERE k=?").bind(MIG).first())) {
    const { results } = await db.prepare("SELECT path, json FROM docs WHERE path LIKE 'inventory/%'").all();
    const now = Date.now(), stmts = [];
    const inv = results.map(r => ({ path: r.path, d: JSON.parse(r.json) }));
    for (const it of inv) {
      if (/snowball/i.test(it.d.name || "") && it.d.cat !== "audio") {
        it.d.cat = "audio"; it.d.icon = "snowball"; it.d.order = 34.8;
        stmts.push(db.prepare("UPDATE docs SET json=?, updated=? WHERE path=?").bind(JSON.stringify(it.d), now, it.path));
      }
    }
    if (!inv.some(it => /boom/i.test(it.d.name || "")))
      stmts.push(db.prepare("INSERT OR IGNORE INTO docs (path, json, updated) VALUES (?, ?, ?)").bind("inventory/boom-pole", JSON.stringify({ cat: "audio", icon: "boompole", name: "Boom pole", note: "", order: 34.9, qty: 1 }), now));
    if (!inv.some(it => /light(ing)?\s*stand/i.test(it.d.name || "")))
      stmts.push(db.prepare("INSERT OR IGNORE INTO docs (path, json, updated) VALUES (?, ?, ?)").bind("inventory/lighting-stand", JSON.stringify({ cat: "light", icon: "lightstand", name: "Lighting stand", note: "", order: 33.5, qty: 1 }), now));
    stmts.push(db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES (?, 1)").bind(MIG));
    stmts.push(db.prepare("UPDATE meta SET v = v + 1 WHERE k='version'"));
    await db.batch(stmts);
  }
  ready = true;
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const normName = s => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
const anon = b => { const c = { ...b }; delete c.email; delete c.name; delete c.year; return c; };
const PATH_OK = p => /^[a-z-]+\/[A-Za-z0-9_.:~@+\-]{1,200}$/.test(String(p));

export async function onRequest({ request, env, params, waitUntil }) {
  const db = env.DB;
  if (!db) return json({ error: "Database not connected. Add a D1 binding called DB, then redeploy." }, 500);
  if (!env.TEACHER_CODE) return json({ error: "The TEACHER_CODE secret is missing. Add it, then redeploy." }, 500);
  await init(db);

  const route = [].concat(params.path || []).join("/");
  const url = new URL(request.url);
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const code = body.code ?? request.headers.get("x-teacher-code") ?? "";
  // Password guessing protection: 5 wrong tries from one network locks password checks for 1 minute.
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const now = Date.now(), WINDOW = 60000, MAX_FAILS = 5;
  let att = await db.prepare("SELECT fails, since FROM attempts WHERE ip=?").bind(ip).first();
  if (att && now - att.since > WINDOW) { att = null; await db.prepare("DELETE FROM attempts WHERE ip=?").bind(ip).run(); }
  const locked = !!att && att.fails >= MAX_FAILS;
  let teacher = false;
  if (code !== "" && code != null) {
    if (!locked && String(code) === String(env.TEACHER_CODE)) teacher = true;
    else if (!locked) {
      await db.prepare("INSERT INTO attempts (ip, fails, since) VALUES (?, 1, ?) ON CONFLICT(ip) DO UPDATE SET fails = fails + 1").bind(ip, now).run();
    }
  }
  const studentsAllowed = String(env.STUDENT_ACCESS || "on").toLowerCase() !== "off";

  if (route === "config") return json({ studentAccess: studentsAllowed });
  if (route === "verify") return json({ ok: teacher, locked, wait: locked ? Math.ceil((WINDOW - (now - att.since)) / 1000) : 0 });
  if (!studentsAllowed && !teacher) return json({ error: "not_teacher" }, 403);

  if (route === "state") {
    const ver = (await db.prepare("SELECT v FROM meta WHERE k='version'").first())?.v ?? 1;
    const tag = ver + (teacher ? "t" : "s");
    if (url.searchParams.get("v") === tag) return json({ v: tag, same: true });
    const { results } = await db.prepare("SELECT path, json FROM docs").all();
    const docs = {};
    for (const r of results) {
      const col = r.path.split("/")[0];
      if (!teacher && HIDDEN.includes(col)) continue;
      let d = JSON.parse(r.json);
      if (!teacher && col === "loans" && Array.isArray(d.bookings)) {          // students never see who borrowed what
        d = { bookings: d.bookings.map(anon) };
      }
      docs[r.path] = d;
    }
    return json({ v: tag, docs });
  }

  if (route === "mine") {
    const want = normName(url.searchParams.get("name"));
    if (want.split(" ").length < 2) return json({ error: "need_full_name" }, 400);
    const { results } = await db.prepare("SELECT path, json FROM docs WHERE path LIKE 'loans/%'").all();
    const out = [];
    for (const r of results) {
      for (const b of (JSON.parse(r.json).bookings || [])) {
        if (normName(b.name) === want) { const c = { ...b }; delete c.email; out.push({ ...c, owner: r.path.slice(6) }); }
      }
    }
    return json({ bookings: out });
  }

  if (route === "write" && request.method === "POST") {
    const { op, path, data } = body;
    if (!PATH_OK(path)) return json({ error: "bad_path" }, 400);
    if (!["set", "update", "delete"].includes(op)) return json({ error: "bad_op" }, 400);
    const col = path.split("/")[0];
    if (!teacher && (!OPEN.includes(col) || op === "delete")) return json({ error: "not_teacher" }, 403);

    const cur = await db.prepare("SELECT json FROM docs WHERE path=?").bind(path).first();
    const old = cur ? JSON.parse(cur.json) : null;
    const bump = db.prepare("UPDATE meta SET v = v + 1 WHERE k='version'");
    if (op === "delete") {
      await db.batch([db.prepare("DELETE FROM docs WHERE path=?").bind(path), bump]);
    } else {
      const doc = op === "update" && old ? { ...old, ...data } : (data || {});
      if (col === "loans" && Array.isArray(doc.bookings)) {
        const prev = (old && Array.isArray(old.bookings)) ? old.bookings : [];
        if (!teacher) {
          // keep every existing booking exactly as stored; only accept brand-new ones
          const known = new Set(prev.map(b => b.id));
          const fresh = doc.bookings.filter(b => b && b.id && !known.has(b.id)).map(b => ({ ...b, status: "requested" }));   // students can only ask; a teacher confirms
          doc.bookings = [...prev, ...fresh];
          if (fresh.length && env.NOTIFY_URL) {
            const send = fetch(env.NOTIFY_URL, { method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ secret: env.NOTIFY_SECRET || "", site: new URL(request.url).origin, requests: fresh.map(b => ({ name: b.name, year: b.year, email: b.email, pickup: b.pickup || "now", items: (b.items || []).map(i => (i.qty > 1 ? i.qty + " x " : "") + i.name) })) }) }).catch(() => {});
            if (typeof waitUntil === "function") waitUntil(send);
          }
        } else {
          // teacher saves: put back any personal details the page didn't have
          const byId = {}; prev.forEach(b => byId[b.id] = b);
          doc.bookings.forEach(b => { const o = byId[b.id]; if (o) for (const k of ["name", "year", "email"]) if (!b[k] && o[k]) b[k] = o[k]; });
        }
      }
      const text = JSON.stringify(doc);
      if (text.length > 900000) return json({ error: "too_large" }, 413);
      await db.batch([db.prepare("INSERT OR REPLACE INTO docs (path, json, updated) VALUES (?, ?, ?)").bind(path, text, Date.now()), bump]);
    }
    return json({ ok: true });
  }

  if (route === "replace" && request.method === "POST") {      // restore a backup, or clear finished loans
    if (!teacher) return json({ error: "not_teacher" }, 403);
    const docs = body.docs || {};
    if (!Object.keys(docs).some(p => p.startsWith("inventory/"))) return json({ error: "not_a_backup" }, 400);
    const now = Date.now();
    const stmts = [db.prepare("DELETE FROM docs")];
    for (const [p, d] of Object.entries(docs)) if (PATH_OK(p)) stmts.push(db.prepare("INSERT INTO docs (path, json, updated) VALUES (?, ?, ?)").bind(p, JSON.stringify(d), now));
    stmts.push(db.prepare("UPDATE meta SET v = v + 1 WHERE k='version'"));
    await db.batch(stmts);
    return json({ ok: true });
  }

  return json({ error: "not_found" }, 404);
}

const SEED = {"inventory/3-way-grip-tripod":{"cat":"gp-acc","name":"3-way grip tripod","note":"","order":64,"qty":4},"inventory/7artisans-7-5mm-f-2-fisheye":{"cat":"lens","name":"7artisans 7.5mm f/2 fisheye","note":"","order":23,"qty":1},"inventory/altura-wide-angle-super-macro":{"cat":"lens","name":"Altura wide angle super macro","note":"","order":22,"qty":1},"inventory/black-softcase":{"borrowable":false,"cat":"gp-acc","name":"Black softcase","note":"","order":63,"qty":11},"inventory/camera-bag-year-7-kit-studio-2":{"borrowable":false,"cat":"bag","name":"Camera bag","note":"Year 7 kit, Studio 2","order":52,"qty":7,"unlisted":true},"inventory/canon-100mm-macro":{"cat":"lens","name":"Canon 100mm macro","note":"","order":18,"qty":8},"inventory/canon-ef-s-18-135mm":{"cat":"lens","name":"Canon EF-S 18–135mm","note":"","order":17,"qty":10},"inventory/canon-ef-s-18-55mm":{"cat":"lens","name":"Canon EF-S 18–55mm","note":"","order":15,"qty":51},"inventory/canon-ef-s-55-250mm":{"cat":"lens","name":"Canon EF-S 55–250mm","note":"","order":16,"qty":12},"inventory/canon-eos-1100d-year-8-kit":{"cat":"kit","extras":["canon-lp-e10-battery","sd-cards","charger-y8"],"kitLens":"canon-ef-s-18-55mm","name":"Canon EOS 1100D","note":"Year 8","order":0,"qty":13},"inventory/canon-eos-1500d-year-9-kit":{"cat":"kit","extras":["canon-lp-e10-battery","sd-cards","charger-y9"],"kitLens":"canon-ef-s-18-55mm","name":"Canon EOS 1500D","note":"Year 9","order":1,"qty":13},"inventory/canon-eos-200d-ii":{"borrowable":false,"cat":"camera","name":"Canon EOS 200D II","note":"","order":10,"qty":2},"inventory/canon-eos-600d-year-10-kit":{"cat":"kit","extras":["lp-e8-spare-battery-year-10-kit","sd-cards","charger-y10"],"kitLens":"canon-ef-s-18-55mm","name":"Canon EOS 600D","note":"Year 10","order":2,"qty":12},"inventory/canon-eos-650d":{"borrowable":false,"cat":"camera","name":"Canon EOS 650D","note":"","order":11,"qty":2},"inventory/canon-eos-70d-year-12-kit":{"cat":"kit","extras":["canon-lp-e6-e6n-spare-battery-year-12-kit","sd-cards","charger-y12"],"group":"y12","groupOrder":3,"kitLens":"canon-ef-s-18-55mm","name":"Canon EOS 70D","note":"Year 12","order":8,"qty":2},"inventory/canon-eos-750d-year-11-kit":{"cat":"kit","extras":["lp-e17-spare-battery-year-11-kit","sd-cards","charger-y11"],"group":"y11","groupOrder":2,"kitLens":"canon-ef-s-18-55mm","name":"Canon EOS 750D","note":"Year 11","order":5,"qty":6},"inventory/canon-eos-800d-year-11-kit":{"cat":"kit","extras":["lp-e17-spare-battery-year-11-kit","sd-cards","charger-y11"],"group":"y11","groupName":"Canon EOS 750D & 800D","groupOrder":1,"kitLens":"canon-ef-s-18-55mm","name":"Canon EOS 800D","note":"Year 11","order":4,"qty":7},"inventory/canon-eos-80d-year-12-kit":{"cat":"kit","extras":["canon-lp-e6-e6n-spare-battery-year-12-kit","sd-cards","charger-y12"],"group":"y12","groupOrder":2,"kitLens":"canon-ef-s-18-55mm","name":"Canon EOS 80D","note":"Year 12","order":7,"qty":4},"inventory/canon-eos-850d-year-11-kit":{"borrowable":false,"cat":"kit","extras":["lp-e17-spare-battery-year-11-kit","sd-cards","charger-y11"],"kitLens":"canon-ef-s-18-55mm","name":"Canon EOS 850D","note":"Year 11","order":3,"qty":1},"inventory/canon-eos-90d-year-12-kit":{"cat":"kit","extras":["canon-lp-e6-e6n-spare-battery-year-12-kit","sd-cards","charger-y12"],"group":"y12","groupName":"Canon EOS 70D, 80D & 90D","groupOrder":1,"kitLens":"canon-ef-s-18-55mm","name":"Canon EOS 90D","note":"Year 12","order":6,"qty":2},"inventory/canon-lp-e10-battery":{"cat":"power","name":"Canon LP-E10 battery","note":"Canon 1100D & 1500D spare battery","order":37,"qty":38},"inventory/canon-lp-e6-e6n-spare-battery-year-12-kit":{"cat":"power","name":"Canon LP-E6/E6N battery","note":"Canon 70, 80 & 90D spare battery","order":41,"qty":8},"inventory/canon-r50v-14-30mm-kit-lens":{"cat":"kit","contents":"a battery, its own 14–30mm lens and a soft camera bag","extras":["sd-cards","charger-r50v"],"name":"Canon R50V","note":"","order":9,"qty":6},"inventory/charger-r50v":{"cat":"charger","name":"Battery charger","note":"R50V kit","order":42.6,"qty":5},"inventory/charger-y10":{"cat":"charger","name":"Battery charger","note":"Year 10 kit","order":42.3,"qty":5},"inventory/charger-y11":{"cat":"charger","name":"Battery charger","note":"Year 11 kit","order":42.4,"qty":5},"inventory/charger-y12":{"cat":"charger","name":"Battery charger","note":"Year 12 kit","order":42.5,"qty":5},"inventory/charger-y8":{"cat":"charger","name":"Battery charger","note":"Year 8 kit","order":42.1,"qty":5},"inventory/charger-y9":{"cat":"charger","name":"Battery charger","note":"Year 9 kit","order":42.2,"qty":5},"inventory/chest-mount":{"cat":"gp-acc","name":"Chest mount","note":"","order":69,"qty":4},"inventory/dji-lito-x1-drone":{"borrowable":false,"cat":"drone","name":"DJI Lito X1 drone","note":"","order":31,"qty":1},"inventory/extension-pole":{"cat":"gp-acc","name":"Extension pole","note":"","order":68,"qty":2},"inventory/feelworld-fhd-monitor":{"borrowable":false,"cat":"monitor","name":"Feelworld FHD monitor","note":"","order":29,"qty":4},"inventory/floaty-handle":{"cat":"gp-acc","name":"Floaty handle","note":"","order":65,"qty":7},"inventory/gopro-2-battery-charger":{"cat":"gp-power","name":"GoPro 2-battery charger","note":"","order":59,"qty":12},"inventory/gopro-blue-battery":{"cat":"gp-power","name":"GoPro blue battery","note":"","order":58,"qty":16},"inventory/gopro-hero-10":{"cat":"gopro","name":"GoPro Hero 10","note":"","order":55,"qty":2},"inventory/gopro-hero-11":{"borrowable":true,"cat":"gopro","name":"GoPro Hero 11","note":"","order":54,"qty":2},"inventory/gopro-hero-12":{"borrowable":true,"cat":"gopro","name":"GoPro Hero 12","note":"","order":53,"qty":4},"inventory/gopro-hero-9":{"cat":"gopro","name":"GoPro Hero 9","note":"","order":56,"qty":6},"inventory/gopro-microsd-128gb":{"cat":"gp-card","name":"GoPro microSD 128GB","note":"","order":60,"qty":14},"inventory/gopro-white-battery":{"cat":"gp-power","name":"GoPro white battery","note":"","order":57,"qty":10},"inventory/handheld-cages":{"cat":"tripod","icon":"cage","name":"Handheld cage","note":"Neewer or Xgrip","order":27,"qty":20},"inventory/handycams":{"cat":"handycam","extras":["sony-np-fv50-battery-year-7-kit-studio-2"],"name":"Handycams","note":"Year 7 kit, Studio 2","order":13,"qty":21},"inventory/head-mount":{"cat":"gp-acc","name":"Head mount","note":"","order":70,"qty":6},"inventory/hollyview-mars-400-wireless-video-transmitter":{"borrowable":false,"cat":"monitor","name":"Hollyview Mars 400","note":"Wireless video transmitter","order":30,"qty":1},"inventory/insta360-one-r-360-camera":{"borrowable":false,"cat":"camera","name":"Insta360 ONE R","note":"360° camera","order":12,"qty":1},"inventory/jaw-clamp":{"cat":"gp-acc","name":"Jaw clamp","note":"","order":66,"qty":4},"inventory/lapel-kit":{"cat":"audio","icon":"lav","name":"RODE Lapel Kit","note":"2 lapel microphones per kit","order":35.1,"qty":5},"inventory/lp-e17-spare-battery-year-11-kit":{"cat":"power","name":"Canon LP-E17 battery","note":"Canon 750, 800 & 850 spare battery","order":40,"qty":15},"inventory/lp-e8-spare-battery-year-10-kit":{"cat":"power","name":"Canon LP-E8 battery","note":"Canon 600D spare battery","order":39,"qty":10},"inventory/misc-sd-reader":{"cat":"misc","icon":"reader","name":"SD card reader","order":91,"qty":99,"unlimited":true},"inventory/misc-usb":{"cat":"misc","icon":"usb","name":"USB","order":90,"qty":99,"unlimited":true},"inventory/ningaloo-128gb-microsd":{"borrowable":false,"cat":"gp-card","name":"Ningaloo 128GB microSD","note":"","order":61,"qty":6},"inventory/ningaloo-256gb-microsd":{"borrowable":false,"cat":"gp-card","name":"Ningaloo 256GB microSD","note":"","order":62,"qty":6},"inventory/pavotube-6c":{"cat":"light","name":"Pavotube 6C","note":"","order":33,"qty":2},"inventory/pavotube-ii-15c":{"cat":"light","name":"Pavotube II 15C","note":"","order":32,"qty":6},"inventory/podcast-microsd-128gb":{"cat":"audio-card","icon":"card","name":"Podcast microSD 128GB","note":"","order":36.5,"qty":18},"inventory/prop-bandana":{"cat":"props","icon":"bandana","name":"Bandana","order":84,"qty":99,"unlimited":true},"inventory/prop-glasses":{"cat":"props","icon":"glasses","name":"Pair of glasses","order":89,"qty":99,"unlimited":true},"inventory/prop-gun":{"cat":"props","icon":"propgun","name":"Prop gun","order":86,"qty":99,"unlimited":true},"inventory/prop-hat":{"cat":"props","icon":"hat","name":"Hat","order":82,"qty":99,"unlimited":true},"inventory/prop-jacket":{"cat":"props","icon":"jacket","name":"Jacket","order":81,"qty":99,"unlimited":true},"inventory/prop-knife":{"cat":"props","icon":"knife","name":"Prop knife","order":87,"qty":99,"unlimited":true},"inventory/prop-mask":{"cat":"props","icon":"mask","name":"Mask","order":88,"qty":99,"unlimited":true},"inventory/prop-scarf":{"cat":"props","icon":"scarf","name":"Scarf","order":83,"qty":99,"unlimited":true},"inventory/prop-tshirt":{"cat":"props","icon":"tshirt","name":"T-shirt","order":80,"qty":99,"unlimited":true},"inventory/prop-wig":{"cat":"props","icon":"wig","name":"Wig","order":85,"qty":99,"unlimited":true},"inventory/rode-mic-stick":{"cat":"audio","icon":"stick","name":"RODE Microphone Stick","note":"","order":35.2,"qty":5},"inventory/rode-shotgun-microphone":{"cat":"audio","icon":"mic","name":"RODE Shotgun Microphone","note":"","order":34.7,"qty":10},"inventory/rode-single-kit-mic":{"cat":"audio","icon":"wireless1","labels":["A","B","C","D","E"],"name":"RODE Single Kit Microphone","note":"","numbered":true,"order":34.5,"qty":5,"unitWord":"Microphone"},"inventory/rode-wireless-2-set":{"cat":"audio","icon":"wireless","name":"RODE Wireless 2-Set","note":"Two wireless microphones per set","numbered":true,"order":34,"qty":4,"unitWord":"Set"},"inventory/ronin-s-gimbal-with-dual-hand-grip":{"borrowable":false,"cat":"tripod","icon":"rig","name":"Ronin S gimbal with dual hand grip","note":"","order":26,"qty":1},"inventory/sd-cards":{"cat":"card","name":"SD card","note":"","order":43,"qty":111},"inventory/sigma-10-20mm-wide-angle":{"cat":"lens","name":"Sigma 10–20mm wide angle","note":"","order":21,"qty":1},"inventory/sigma-150-600mm-f-5-6-3":{"cat":"lens","name":"Sigma 150–600mm f/5–6.3","note":"","order":20,"qty":1},"inventory/sigma-30mm-f-1-4":{"cat":"lens","name":"Sigma 30mm f/1.4","note":"","order":19,"qty":6},"inventory/sony-np-fv50-battery-year-7-kit-studio-2":{"cat":"power","name":"Sony NP-FV50 battery","note":"Year 7 kit, Studio 2","order":42,"qty":13},"inventory/suction-cup-mount":{"cat":"gp-acc","name":"Suction cup mount","note":"","order":67,"qty":2},"inventory/tripods":{"cat":"tripod","name":"Tripod","note":"","order":24,"qty":39},"inventory/zoom-16gb-card":{"cat":"audio-card","icon":"card","name":"Zoom micro SD","note":"16GB","order":36.6,"qty":8},"inventory/zoom-h1n":{"cat":"audio","name":"Zoom H1n","note":"","order":36,"qty":4},"inventory/snowball-microphone":{"cat":"audio","icon":"snowball","name":"Snowball Microphone","note":"","order":34.8,"qty":5},"inventory/usb-charging-cable":{"cat":"misc","icon":"cable","name":"USB Charging Cable","note":"","order":90.5,"qty":10}};
