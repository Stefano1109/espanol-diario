// Español Diario — app logic (V1)
import { SpeechEngine, MicRecorder, resampleTo16k, trimSilence, encodeWav } from "./engine.js";

const $app = document.getElementById("app");
const $tabs = document.getElementById("tabs");
const KEY = "esp-diario-v1";
const MODEL_KEY = "es-ctc-int8-9539b206";
const MODEL_PARTS = 10;

// ---------- small utils ----------
const pad2 = n => String(n).padStart(2, "0");
const dstr = d => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
const today = () => dstr(new Date());
const addDays = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return dstr(d); };
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00") - Date.parse(a + "T00:00:00")) / 86400000);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a, n) => shuffle(a).slice(0, n);
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

// ---------- icons ----------
const I = {
  close: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  speaker: (s = 24) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>`,
  playS: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  mic: (s = 30) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>`,
  stop: '<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  flame: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z"/></svg>',
  cards: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="13" height="15" rx="2"/><path d="M8 3h11a1 1 0 0 1 1 1v13"/><path d="M8 10h5M8 14h3"/></svg>',
  ear: '<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="5" height="6" rx="1.5"/><rect x="16" y="14" width="5" height="6" rx="1.5"/></svg>',
  check: (s = 20) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>`,
  checkC: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
  circle: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>',
  lock: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  bulb: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/></svg>',
  search: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  home: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/></svg>',
  map: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4l-5 2v14l5-2 6 2 5-2V4l-5 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  book: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M9 9h6M9 13h4"/></svg>',
  gear: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
};

// ---------- state ----------
const DEFAULT = {
  v: 1, updatedAt: 0,
  settings: { lang: "en", newPerDay: 5, reviewCap: 20, pass: 70, lowToReview: true, slowDefault: false },
  cards: {},          // id -> {S, D, last, due, reps, lapses, introduced}
  introduced: [],     // word ids in order introduced
  days: {},           // n -> {vocab, module, moduleDone, done, date, stats}
  lowSentences: [],   // {es, au, day, dur, ref, score}
  speakHistory: [],   // {day, date, avg}
};
let state = load();
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function merge(base, s) {
  const out = clone(base);
  for (const k of Object.keys(s || {})) out[k] = (k === "settings") ? Object.assign(out.settings, s.settings) : s[k];
  return out;
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return merge(DEFAULT, s); } catch (e) {}
  return clone(DEFAULT);
}
let remoteDoc = null, remoteTimer = null;
function save() {
  state.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  if (remoteDoc) { clearTimeout(remoteTimer); remoteTimer = setTimeout(pushRemote, 1500); }
}
async function pushRemote() {
  try { await remoteDoc.set({ json: JSON.stringify(state), updatedAt: state.updatedAt }); } catch (e) {}
}
async function initRemote() {
  try {
    if (!window.claude || !window.claude.use) return;
    const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!db || !user) return;
    const id = await user.id();
    if (!id) return;
    remoteDoc = db.doc("data/users/" + id + "/progress");
    const snap = await remoteDoc.get();
    const data = snap.exists ? snap.data() : null;
    const remote = data && typeof data.json === "string" ? JSON.parse(data.json) : null;
    if (remote && remote.v === 1 && remote.updatedAt > state.updatedAt) {
      state = merge(DEFAULT, remote);
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      if (view.name === "home" || view.name === "map" || view.name === "words" || view.name === "settings") render();
    } else if (!remote || remote.updatedAt < state.updatedAt) {
      pushRemote();
    }
  } catch (e) {}
}

const L = (zh, en) => state.settings.lang === "zh" ? zh : en;
const isZh = () => state.settings.lang === "zh";

// ---------- course ----------
let COURSE = [];
const dayOf = n => COURSE[n - 1];
const wordId = (n, i) => n + "-" + i;
function wordById(id) { const [n, i] = id.split("-").map(Number); return { day: n, i, w: dayOf(n).words[i] }; }
const tMean = w => isZh() ? w.zh : w.en;
const tEx = w => isZh() ? w.exZh : w.exEn;
const tNote = w => isZh() ? w.note : w.noteEn;
const tPos = w => isZh() ? w.pos : w.posEn;
const tTheme = d => isZh() ? d.theme : d.themeEn;
const tGram = d => isZh() ? d.grammar : d.grammarEn;
const tName = (dl, k) => isZh() ? dl[k].name : dl[k].nameEn;

// ---------- audio ----------
const urls = {}, packs = {};
function loadPack(n) {
  if (!packs[n]) packs[n] = (async () => {
    const r = await fetch(`data/audio-${n}.json`);
    if (!r.ok) return;
    const j = await r.json();
    for (const [id, b64] of Object.entries(j)) {
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      urls[id] = URL.createObjectURL(new Blob([bin], { type: "audio/mpeg" }));
    }
  })().catch(() => { delete packs[n]; });
  return packs[n];
}
const player = new Audio();
player.preload = "auto";
let playToken = 0;
function play(id, slow) {
  const my = ++playToken;
  return new Promise(res => {
    const u = urls[id] || (id && id.startsWith("blob:") ? id : null);
    if (!u) return res();
    const rate = slow ? 0.7 : (state.settings.slowDefault ? 0.85 : 1);
    player.onended = () => res(); player.onerror = () => res();
    player.src = u;
    player.defaultPlaybackRate = rate; player.playbackRate = rate;
    try { player.preservesPitch = true; player.webkitPreservesPitch = true; } catch (e) {}
    const p = player.play();
    if (p && p.catch) p.catch(() => res());
    player.onpause = () => { if (my !== playToken) res(); };
  });
}
function stopAudio() { playToken++; try { player.pause(); } catch (e) {} }

// ---------- scoring engine ----------
const engine = { p: null, state: "idle", pct: 0, err: "", eng: null };
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("esp-diario", 1);
    r.onupgradeneeded = () => { const db = r.result; db.createObjectStore("models"); db.createObjectStore("rec"); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbGet(store, key) {
  try { const db = await idb(); return await new Promise(res => { const q = db.transaction(store).objectStore(store).get(key); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); } catch (e) { return undefined; }
}
async function idbPut(store, key, val) {
  try { const db = await idb(); await new Promise(res => { const tx = db.transaction(store, "readwrite"); tx.objectStore(store).put(val, key); tx.oncomplete = res; tx.onerror = res; tx.onabort = res; }); } catch (e) {}
}
async function modelBytes(onPct) {
  const cached = await idbGet("models", MODEL_KEY);
  if (cached && cached.byteLength > 100e6) { onPct(100); return new Uint8Array(cached); }
  const parts = []; let got = 0; const total = 131652445;
  for (let i = 0; i < MODEL_PARTS; i++) {
    const r = await fetch(`model/part${i}.wasm`);
    if (!r.ok) throw new Error("model part " + i + " HTTP " + r.status);
    const reader = r.body && r.body.getReader ? r.body.getReader() : null;
    if (reader) {
      for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; onPct(Math.min(99, Math.round(got * 100 / total))); }
    } else { const b = new Uint8Array(await r.arrayBuffer()); parts.push(b); got += b.length; onPct(Math.min(99, Math.round(got * 100 / total))); }
  }
  const all = new Uint8Array(got); let o = 0;
  for (const p of parts) { all.set(p, o); o += p.length; }
  parts.length = 0;
  idbPut("models", MODEL_KEY, all.buffer);
  onPct(100);
  return all;
}
function getEngine() {
  if (engine.p) return engine.p;
  engine.state = "loading"; engine.err = ""; refreshEngine();
  engine.p = (async () => {
    const ort = await import("./ort/ort.wasm.bundle.min.mjs");
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmBinary = await (await fetch("ort/ort-wasm-simd-threaded.wasm")).arrayBuffer();
    const tokens = (await (await fetch("model/tokens.txt")).text()).trim().split("\n").map(l => l.slice(0, l.lastIndexOf(" ")));
    const bytes = await modelBytes(p => { engine.pct = p; refreshEngine(); });
    engine.state = "init"; refreshEngine();
    const eng = new SpeechEngine(ort, tokens);
    await eng.load(bytes);
    engine.eng = eng; engine.state = "ready"; refreshEngine();
    return eng;
  })().catch(e => { engine.state = "error"; engine.err = String(e && e.message || e); engine.p = null; refreshEngine(); throw e; });
  return engine.p;
}
function engineLabel() {
  switch (engine.state) {
    case "loading": return L(`正在下载评分模型 ${engine.pct}%（约 130 MB，只需一次）`, `Downloading the scoring model ${engine.pct}% (about 130 MB, one time only)`);
    case "init": return L("正在启动评分模型…", "Starting the scoring model…");
    case "ready": return L("评分模型已就绪", "Scoring model ready");
    case "error": return L("评分模型加载失败：", "Scoring model failed to load: ") + engine.err;
    default: return L("评分模型未加载", "Scoring model not loaded");
  }
}
function refreshEngine() { document.querySelectorAll("[data-engine]").forEach(el => el.textContent = engineLabel()); }

// ---------- FSRS (v4.5 default weights) ----------
const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5, FACTOR = 19 / 81, RET = 0.9;
const clampD = d => Math.min(10, Math.max(1, d));
const initD = g => clampD(W[4] - (g - 3) * W[5]);
const retr = (t, S) => Math.pow(1 + FACTOR * t / S, DECAY);
const ivlFor = S => Math.max(1, Math.round(S / FACTOR * (Math.pow(RET, 1 / DECAY) - 1)));
function schedule(card, g, now) {
  let S, D;
  if (!card || !card.S) { S = W[g - 1]; D = initD(g); }
  else {
    const t = Math.max(0, daysBetween(card.last, now)), R = retr(t, card.S);
    D = clampD(W[7] * initD(4) + (1 - W[7]) * (card.D - W[6] * (g - 3)));
    if (g === 1) S = Math.min(card.S, W[11] * Math.pow(card.D, -W[12]) * (Math.pow(card.S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R)));
    else S = card.S * (Math.exp(W[8]) * (11 - card.D) * Math.pow(card.S, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * (g === 2 ? W[15] : 1) + 1);
  }
  const ivl = g === 1 ? 1 : ivlFor(S);
  return { S, D, last: now, due: addDays(now, ivl), ivl, reps: ((card && card.reps) || 0) + 1, lapses: ((card && card.lapses) || 0) + (g === 1 ? 1 : 0), introduced: (card && card.introduced) || now };
}
const mastery = c => !c ? 0 : c.S < 2 ? 1 : c.S < 7 ? 2 : c.S < 21 ? 3 : 4;
const isHard = c => c && c.lapses >= 2;
function ivlText(days) {
  if (days <= 1) return L("明天", "tomorrow");
  return L(`${days} 天后`, `in ${days} days`);
}

// ---------- day logic ----------
function dayRec(n) { return state.days[n] || (state.days[n] = {}); }
function currentDay() { for (let n = 1; n <= 30; n++) if (!(state.days[n] && state.days[n].done)) return n; return 31; }
function doneToday() { return Object.values(state.days).some(d => d.done && d.date === today() && !d.skipped); }
function streak() {
  const dates = new Set(Object.values(state.days).filter(d => d.done && !d.skipped && d.date).map(d => d.date));
  let s = 0, d = today();
  if (!dates.has(d)) d = addDays(d, -1);
  while (dates.has(d)) { s++; d = addDays(d, -1); }
  return s;
}
function backlog(n) {
  const out = [];
  for (let k = 1; k <= Math.min(n, 30); k++) dayOf(k).words.forEach((w, i) => { const id = wordId(k, i); if (!state.cards[id]) out.push(id); });
  return out;
}
function dueIds() {
  const t = today();
  return Object.entries(state.cards).filter(([, c]) => c.due <= t).sort((a, b) => a[1].due < b[1].due ? -1 : a[1].due > b[1].due ? 1 : a[1].S - b[1].S).map(([id]) => id);
}
function vocabPlan(n) {
  const d = dayOf(n);
  const due = dueIds();
  let extra = [];
  if (d.type === "review" || d.type === "test") extra = Object.entries(state.cards).filter(([id, c]) => isHard(c) && !due.includes(id)).map(([id]) => id).slice(0, 10);
  const reviews = due.slice(0, state.settings.reviewCap).concat(extra);
  const fresh = (d.type === "review" || d.type === "test") ? [] : backlog(n).slice(0, state.settings.newPerDay);
  return { reviews, fresh };
}
function recommended(d) { return d.type === "speak" ? "speak" : d.type === "listen" ? "listen" : d.type; }

// ---------- views ----------
let view = { name: "home" };
let S = null; // active session
function go(name, extra) { stopAudio(); view = Object.assign({ name }, extra || {}); render(); window.scrollTo(0, 0); }
function render() {
  if (!COURSE.length) return;
  const fn = VIEWS[view.name] || VIEWS.home;
  $app.innerHTML = fn();
  const tab = ["home", "map", "words", "settings"].includes(view.name);
  $app.classList.toggle("has-nav", tab);
  $tabs.hidden = !tab;
  if (tab) $tabs.querySelector(".in").innerHTML = [["home", I.home, L("今天", "Today")], ["map", I.map, L("课程地图", "Course")], ["words", I.book, L("词库", "Words")], ["settings", I.gear, L("设置", "Settings")]]
    .map(([k, ic, lab]) => `<button type="button" data-act="tab" data-v="${k}" class="${view.name === k ? "on" : ""}" ${view.name === k ? 'aria-current="page"' : ""}>${ic}${lab}</button>`).join("");
  document.documentElement.lang = isZh() ? "zh-CN" : "en";
  if (view.after) { const f = view.after; view.after = null; f(); }
}
function topBar(label, i, n, color) {
  return `<div class="top"><button type="button" class="icon-btn" data-act="quit" aria-label="${L("退出", "Quit")}">${I.close}</button>
    <div class="grow"><div class="lab"><span>${esc(label)}</span><span class="muted tabular">${i} / ${n}</span></div>
    <div class="bar"><i style="width:${Math.round(i * 100 / n)}%;${color ? "background:" + color : ""}"></i></div></div></div>`;
}

const VIEWS = {};

// ===== HOME =====
VIEWS.home = () => {
  const n = currentDay();
  if (n > 30) return `<div class="stack"><div class="title-xl">${L("30 天完成！", "30 days complete!")}</div>
    <p class="muted">${L("你已经完成全部 30 天。可以在设置里跳回任意一天复习，下一阶段内容正在准备。", "You've finished all 30 days. Jump back to any day in Settings to review; the next stage is on its way.")}</p></div>`;
  const d = dayOf(n), rec = state.days[n] || {};
  const plan = vocabPlan(n);
  const vocabCount = plan.reviews.length + plan.fresh.length;
  const vocabDone = rec.vocab || vocabCount === 0;
  const sk = streak();
  const dt = doneToday();
  const reco = recommended(d);
  const phase = n <= 15 ? L("阶段一 · 现在时巩固", "Stage 1 · Present tense") : L("阶段二 · 喜好与计划", "Stage 2 · Likes & plans");
  let week = "";
  for (let k = Math.max(1, n - 6); k <= n; k++) {
    const r = state.days[k]; const t = dayOf(k).type;
    const lab = t === "listen" ? L("听", "L") : t === "speak" ? L("说", "S") : t === "review" ? L("复", "R") : L("测", "T");
    const doneK = r && r.done;
    const bg = !doneK ? "" : r.module === "speak" ? "background:var(--clay);color:var(--on-clay)" : "background:var(--teal);color:var(--on-teal)";
    week += `<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:34px;height:34px;border-radius:10px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;${doneK ? bg : "background:var(--surface);border:2px dashed var(--faint);box-sizing:border-box;color:var(--muted)"}">${doneK ? lab : k === n ? "?" : lab}</div><span class="tiny ${k === n ? "" : "muted"}" style="${k === n ? "font-weight:700" : ""}">${k === n ? L("今天", "Today") : k}</span></div>`;
  }
  const modTile = (kind) => {
    const isL = kind === "listen";
    const on = reco === kind;
    const desc = isL ? L("辨音 · 句子 · 对话<br>全部选择题 · 约 10 分钟", "Sounds · sentences · dialogue<br>All multiple choice · ~10 min")
      : L("跟读打分 · 角色扮演<br>约 10 分钟", "Scored read-aloud · role-play<br>~10 min");
    return `<button type="button" data-act="start-mod" data-v="${kind}" style="background:${on ? "var(--clay-soft)" : "var(--surface)"};border:2px solid ${on ? "var(--clay)" : "transparent"};border-radius:18px;padding:16px 14px;display:flex;flex-direction:column;align-items:flex-start;gap:10px;text-align:left;color:var(--ink);position:relative;box-shadow:var(--shadow)">
      ${on ? `<span class="pill" style="position:absolute;top:12px;right:12px;background:var(--clay);color:var(--on-clay)">${L("推荐", "Planned")}</span>` : ""}
      <span style="color:${on ? "var(--clay)" : "var(--ink)"}">${isL ? I.ear : I.mic(26)}</span>
      <span style="font-size:17px;font-weight:700">${isL ? L("听力", "Listening") : L("口语", "Speaking")}</span>
      <span class="small muted" style="line-height:1.4">${desc}</span></button>`;
  };
  let step2;
  if (d.type === "review" || d.type === "test") {
    step2 = `<button type="button" class="btn btn-clay wide" data-act="start-mod" data-v="${d.type}">${d.type === "review" ? L("开始复习：听力 + 口语", "Start review: listening + speaking") : L("开始测验", "Start the test")}</button>`;
  } else step2 = `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">${modTile("listen")}${modTile("speak")}</div>`;
  const modDone = rec.moduleDone;
  return `<div class="stack" style="gap:18px">
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div><div class="muted" style="font-size:15px;font-weight:600">¡Hola! ${L("今天也来 15 分钟", "15 minutes today")}</div>
      <div class="title-xl">${L(`第 ${n} 天`, `Day ${n}`)} <span class="muted" style="font-size:18px;font-weight:600">/ 30</span></div></div>
      <div class="pill" style="background:var(--surface);color:var(--clay);font-size:14px;padding:8px 12px;box-shadow:var(--shadow)">${I.flame}${L(`连续 ${sk} 天`, `${sk}-day streak`)}</div>
    </div>
    <div class="stack" style="gap:8px"><div class="row small muted" style="justify-content:space-between;font-weight:600"><span>${phase}</span><span class="tabular">${n - 1} / 30</span></div>
      <div class="bar" style="height:8px"><i style="width:${Math.round((n - 1) * 100 / 30)}%"></i></div></div>
    ${dt ? `<div class="notice">${L("今天的训练已经完成，明天再来。想多练可以继续下面这一天。", "Today's session is done. Come back tomorrow, or carry on with the next day if you want more practice.")}</div>` : ""}
    <div style="background:var(--night);color:var(--on-night);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:6px">
      <div class="small" style="color:var(--night-muted);font-weight:600">${L("今日主题", "Today's theme")}</div>
      <div style="font-size:22px;font-weight:800">${esc(tTheme(d))} · <span lang="es">${esc(d.themeEs)}</span></div>
      <div style="font-size:14px;color:var(--night-muted)">${esc(tGram(d))}</div>
    </div>
    <div class="stack" style="gap:10px"><div class="eyebrow">${L("第 1 步 · 每天必做", "Step 1 · Every day")}</div>
      <div class="card row" style="gap:14px">
        <div style="width:48px;height:48px;border-radius:14px;background:var(--teal-soft);color:var(--teal);display:flex;align-items:center;justify-content:center;flex-shrink:0">${I.cards}</div>
        <div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:700">${L("词汇", "Vocabulary")}</div>
          <div class="small muted">${vocabDone ? L("已完成", "Done") : L(`${plan.reviews.length} 张待复习 · ${plan.fresh.length} 个新词 · 约 5 分钟`, `${plan.reviews.length} to review · ${plan.fresh.length} new · ~5 min`)}</div></div>
        ${vocabDone ? `<span class="ok">${I.checkC}</span>` : `<button type="button" class="btn btn-teal" style="min-height:44px" data-act="start-vocab">${L("开始", "Start")}</button>`}
      </div></div>
    <div class="stack" style="gap:10px"><div class="eyebrow">${d.type === "review" || d.type === "test" ? L("第 2 步", "Step 2") : L("第 2 步 · 二选一", "Step 2 · Pick one")}</div>
      ${modDone ? `<div class="card row"><span class="ok">${I.checkC}</span><span style="font-weight:700">${L("今天的练习已完成", "Today's practice is done")}</span></div>` : step2}</div>
    <div class="stack" style="gap:10px"><div class="eyebrow">${L("最近 7 天", "Last 7 days")}</div>
      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px">${week}</div></div>
  </div>`;
};

// ===== VOCAB SESSION =====
function startVocab() {
  const n = currentDay();
  const plan = vocabPlan(n);
  const q = plan.fresh.map(id => ({ id, kind: "new" })).concat(plan.reviews.map(id => ({ id, kind: "review" })));
  if (!q.length) { dayRec(n).vocab = true; save(); checkDayDone(n); return go("home"); }
  S = { type: "vocab", n, q, i: 0, flipped: false, stats: { reviews: 0, good: 0, fresh: 0 }, requeued: new Set() };
  const days = new Set(q.map(x => wordById(x.id).day));
  Promise.all([...days].map(loadPack)).then(() => { if (view.name === "vocab") autoPlayWord(); });
  go("vocab", { after: autoPlayWord });
}
function autoPlayWord() { const it = S && S.q[S.i]; if (it && urls[wordById(it.id).w.aw]) play(wordById(it.id).w.aw); }
VIEWS.vocab = () => {
  const it = S.q[S.i]; const { w } = wordById(it.id);
  const showBack = it.kind === "new" || S.flipped;
  const card = state.cards[it.id];
  const ex = w.ex;
  const back = `
    <div class="row" style="gap:8px;flex-wrap:wrap">${tPos(w).split("·").map(p => `<span class="chip ${/→/.test(p) ? "chip-clay" : "chip-teal"}">${esc(p.trim())}</span>`).join("")}</div>
    <div style="font-size:24px;font-weight:700">${esc(tMean(w))}</div>
    <div style="height:1px;background:var(--line)"></div>
    <div class="stack" style="gap:8px"><div class="tiny muted" style="font-weight:700">${L("例句", "Example")}</div>
      <div class="row" style="align-items:flex-start"><div style="flex:1;min-width:0"><div lang="es" style="font-size:19px;font-weight:600;line-height:1.4">${esc(ex)}</div><div class="small muted">${esc(tEx(w))}</div></div>
      <button type="button" class="play sm" data-act="play" data-v="${w.ax}" aria-label="${L("播放例句", "Play the example")}">${I.playS}</button></div></div>
    <div style="background:var(--bg);border-radius:14px;padding:14px;display:flex;gap:10px;align-items:flex-start;color:var(--clay)">${I.bulb}<div class="small" style="color:var(--ink);line-height:1.55"><b>${L("语法小解：", "Grammar tip: ")}</b>${esc(tNote(w))}</div></div>`;
  let footer;
  if (it.kind === "new") footer = `<button type="button" class="btn btn-teal wide" data-act="new-next">${L("记住了，下一个", "Got it — next")}</button>`;
  else if (!S.flipped) footer = `<button type="button" class="btn btn-dark wide" data-act="flip">${L("显示答案", "Show answer")}</button>`;
  else {
    const t = today(); const iv = g => { const c = schedule(card, g, t); return g === 1 ? L("今天再来", "again today") : ivlText(c.ivl); };
    footer = `<div class="small muted" style="text-align:center;font-weight:600">${L("你刚才想起来了吗？", "Did you remember it?")}</div>
      <div class="rate"><button type="button" class="r-again" data-act="rate" data-v="1">${L("忘了", "Forgot")}<small>${iv(1)}</small></button>
      <button type="button" class="r-hard" data-act="rate" data-v="2">${L("模糊", "Hard")}<small>${iv(2)}</small></button>
      <button type="button" class="r-good" data-act="rate" data-v="3">${L("记得", "Got it")}<small style="opacity:.85">${iv(3)}</small></button></div>`;
  }
  return `<div class="stack" style="gap:18px;flex:1">
    ${topBar(it.kind === "new" ? L("词汇 · 新词", "Vocabulary · new word") : L("词汇 · 复习", "Vocabulary · review"), S.i + 1, S.q.length)}
    <div class="card stack" style="flex:1;border-radius:24px;padding:24px 22px;gap:18px">
      <div class="row" style="justify-content:space-between"><div lang="es" style="font-size:34px;font-weight:800;letter-spacing:-.5px;min-width:0;overflow-wrap:anywhere">${esc(w.w)}</div>
      <button type="button" class="play" data-act="play" data-v="${w.aw}" aria-label="${L("播放发音", "Play pronunciation")}">${I.speaker()}</button></div>
      ${showBack ? back : `<div class="muted" style="margin-top:auto;text-align:center">${L("先在心里想想意思，再看答案", "Recall the meaning, then check")}</div>`}
    </div>
    <div class="stack" style="gap:10px">${footer}</div></div>`;
};
function vocabAdvance() {
  S.flipped = false; S.i++;
  if (S.i >= S.q.length) {
    const n = S.n; dayRec(n).vocab = true; dayRec(n).vocabStats = S.stats; save();
    S = null; checkDayDone(n);
    return go(state.days[n].done ? "done" : "home", state.days[n].done ? { n } : {});
  }
  render(); autoPlayWord();
}

// ===== LISTENING =====
function mcqFrom(au, es, opts, extra) { const order = shuffle([0, 1, 2]); return Object.assign({ t: "mcq", au, es, opts: order.map(k => opts[k]), right: order.indexOf(0) }, extra || {}); }
function listenSteps(n) {
  const d = dayOf(n), steps = [];
  if (d.type === "listen") {
    for (const p of d.pairs) steps.push({ t: "pair", p, target: Math.random() < .5 ? "a" : "b" });
    for (const s of d.sentences) steps.push(mcqFrom(s.au, s.es, isZh() ? s.opts : s.optsEn, { pack: n }));
    steps.push({ t: "dlg", n, plays: 0 });
    for (const q of d.dialogue.qs) { const order = shuffle([0, 1, 2]); const o = isZh() ? q.opts : q.optsEn; steps.push({ t: "dq", n, q: isZh() ? q.q : q.qEn, opts: order.map(k => o[k]), right: order.indexOf(0) }); }
    steps.push({ t: "script", n });
  } else if (d.type === "speak") {
    // listening practice built from the speaking day's sentences
    const items = d.shadow.map(h => ({ au: h.au, es: h.es, tr: isZh() ? h.zh : h.en }))
      .concat(...d.subs.map(sb => sb.items.map(it => ({ au: it.au, es: it.es, tr: null }))));
    const withTr = items.filter(x => x.tr);
    for (const x of withTr) { const others = pick(withTr.filter(y => y !== x), 2).map(y => y.tr); steps.push(mcqFrom(x.au, x.es, [x.tr, ...others], { pack: n })); }
    for (const q of d.questions) { const tr = isZh() ? q.zh : q.en; const others = pick(d.questions.filter(y => y !== q), 2).map(y => isZh() ? y.zh : y.en); steps.push(mcqFrom(q.au, q.es, [tr, ...others], { pack: n })); }
  }
  return steps;
}
function sentencePool(maxDay) {
  const pool = [];
  for (let k = 1; k <= maxDay; k++) { const d = dayOf(k); if (d.type === "listen") d.sentences.forEach(s => pool.push({ s, k })); }
  return pool;
}
function startListen(n, steps, kind) {
  S = { type: "listen", kind: kind || "listen", n, steps, i: 0, ans: null, correct: 0, total: steps.filter(s => ["pair", "mcq", "dq", "vq"].includes(s.t)).length, plays: 0 };
  const packsNeeded = new Set([n]); steps.forEach(s => s.pack && packsNeeded.add(s.pack));
  Promise.all([...packsNeeded].map(loadPack));
  go("listen");
}
VIEWS.listen = () => {
  const st = S.steps[S.i];
  const label = { pair: L("听力 · 辨音", "Listening · sounds"), mcq: L("听力 · 句子听选", "Listening · sentences"), vq: L("词汇测验", "Vocabulary quiz"), dlg: L("听力 · 对话", "Listening · dialogue"), dq: L("听力 · 对话问题", "Listening · questions"), script: L("对话原文", "Dialogue script") }[st.t];
  const head = topBar(label, S.i + 1, S.steps.length);
  const answered = S.ans !== null;
  const next = `<button type="button" class="btn btn-dark wide" data-act="l-next">${L("继续", "Continue")}</button>`;
  const fb = (ok, extra) => `<div class="feedback" style="margin-top:auto"><div class="row" style="gap:8px;font-weight:800;font-size:16px"><span class="${ok ? "ok" : "bad"}">${ok ? I.checkC : I.close}</span><span class="${ok ? "ok" : "bad"}">${ok ? L("答对了", "Correct") : L("再听一次", "Not quite")}</span></div>${extra || ""}${next}</div>`;
  if (st.t === "pair") {
    const p = st.p;
    const opts = [["a", p.a, isZh() ? p.az : p.azEn], ["b", p.b, isZh() ? p.bz : p.bzEn]];
    const btns = opts.map(([k, es, tr], j) => {
      let cls = ""; if (answered) cls = k === st.target ? "right" : (S.ans === k ? "wrong" : "dim");
      return `<button type="button" class="opt ${cls}" data-act="pair-ans" data-v="${k}" ${answered ? "disabled" : ""}><span class="k">${"AB"[j]}</span><span><span lang="es" class="es">${esc(es)}</span> <span class="muted small">${esc(tr)}</span></span></button>`;
    }).join("");
    return `<div class="stack" style="gap:20px;flex:1">${head}<div class="title-l">${L("你听到的是哪一个？", "Which one do you hear?")}</div>
      <div style="display:flex;justify-content:center;padding:8px 0"><button type="button" class="play big" data-act="play" data-v="${p[st.target === "a" ? "aa" : "ab"]}" aria-label="${L("播放", "Play")}">${I.speaker(48)}</button></div>
      <div class="stack" style="gap:10px">${btns}</div>
      ${answered ? fb(S.ans === st.target, `<div class="row" style="gap:16px"><button type="button" class="btn btn-ghost" data-act="play" data-v="${p.aa}" lang="es">${I.playS} ${esc(p.a)}</button><button type="button" class="btn btn-ghost" data-act="play" data-v="${p.ab}" lang="es">${I.playS} ${esc(p.b)}</button></div>`) : ""}</div>`;
  }
  if (st.t === "mcq" || st.t === "vq" || st.t === "dq") {
    const btns = st.opts.map((o, j) => {
      let cls = ""; if (answered) cls = j === st.right ? "right" : (S.ans === j ? "wrong" : "dim");
      return `<button type="button" class="opt ${cls}" data-act="mcq-ans" data-v="${j}" ${answered ? "disabled" : ""}><span class="k">${"ABC"[j]}</span><span>${esc(o)}</span></button>`;
    }).join("");
    let prompt, player_;
    if (st.t === "dq") {
      prompt = esc(st.q);
      player_ = `<div class="row" style="justify-content:center"><button type="button" class="btn btn-ghost" data-act="play-dlg">${I.speaker(18)} ${L("再听一遍对话", "Replay the dialogue")}</button><button type="button" class="btn btn-ghost" data-act="stop-audio">${L("停止", "Stop")}</button></div>`;
    } else {
      prompt = st.t === "vq" ? `<span lang="es">${esc(st.es)}</span>` : L("听一听，选出正确意思", "Listen and pick the meaning");
      player_ = `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:6px 0"><button type="button" class="play big" data-act="play" data-v="${st.au}" aria-label="${L("播放", "Play")}">${I.speaker(48)}</button>
        <button type="button" class="btn btn-ghost" style="min-height:40px;font-size:13px" data-act="play-slow" data-v="${st.au}">${L("慢速", "Slow")}</button></div>`;
    }
    const extra = st.t !== "dq" && st.t !== "vq" ? `<div class="row"><div style="flex:1;min-width:0"><div lang="es" style="font-size:16px;font-weight:600">${esc(st.es)}</div></div><button type="button" class="play sm" data-act="play" data-v="${st.au}" aria-label="${L("再听原句", "Replay")}">${I.playS}</button></div>` : "";
    return `<div class="stack" style="gap:18px;flex:1">${head}<div class="title-l">${prompt}</div>${player_}<div class="stack" style="gap:10px">${btns}</div>${answered ? fb(S.ans === st.right, extra) : ""}</div>`;
  }
  if (st.t === "dlg") {
    const dl = dayOf(st.n).dialogue;
    return `<div class="stack" style="gap:18px;flex:1">${head}
      <div class="title-l">${esc(isZh() ? dl.title : dl.titleEn)}</div>
      <p class="muted" style="margin:0">${L("先不看文字听两遍，然后回答 5 个问题。答题时还可以重听。", "Listen twice without the text, then answer 5 questions. You can replay while answering.")}</p>
      <div class="card row" style="gap:14px"><div class="avatar">${esc(tName(dl, "A")[0])}</div><span style="font-weight:700">${esc(tName(dl, "A"))}</span><span class="muted">·</span><div class="avatar">${esc(tName(dl, "B")[0])}</div><span style="font-weight:700">${esc(tName(dl, "B"))}</span></div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px 0"><button type="button" class="play big" data-act="play-dlg" aria-label="${L("播放对话", "Play the dialogue")}">${I.speaker(48)}</button>
        <span class="small muted">${L(`已听 ${S.plays} 遍`, `Played ${S.plays} time${S.plays === 1 ? "" : "s"}`)}</span></div>
      <div style="margin-top:auto">${`<button type="button" class="btn btn-dark wide" data-act="l-next" ${S.plays < 1 ? "disabled" : ""}>${L("开始答题", "Answer the questions")}</button>`}</div></div>`;
  }
  if (st.t === "script") {
    const dl = dayOf(st.n).dialogue;
    const lines = dl.lines.map(l => `<div class="list-row" style="align-items:flex-start;padding:10px 0"><div class="avatar">${esc(tName(dl, l.s)[0])}</div><div style="flex:1;min-width:0"><div lang="es" style="font-weight:600">${esc(l.es)}</div><div class="small muted">${esc(isZh() ? l.zh : l.en)}</div></div><button type="button" class="play sm" data-act="play" data-v="${l.au}" aria-label="${L("播放这句", "Play line")}">${I.playS}</button></div>`).join("");
    return `<div class="stack" style="gap:16px;flex:1">${head}<div class="title-l">${L("边听边看原文", "Listen with the script")}</div>
      <button type="button" class="btn btn-ghost" data-act="play-dlg">${I.speaker(18)} ${L("从头播放", "Play from the start")}</button>
      <div class="card" style="padding:4px 16px">${lines}</div>
      <button type="button" class="btn btn-dark wide" data-act="l-next">${L("完成听力", "Finish listening")}</button></div>`;
  }
  return "";
};
async function playDialogue(n) {
  const dl = dayOf(n).dialogue; const my = playToken + 1;
  for (const l of dl.lines) { await play(l.au); if (playToken !== my) return; await new Promise(r => setTimeout(r, 250)); }
}
function listenAdvance() {
  S.ans = null; S.i++;
  if (S.i >= S.steps.length) return finishListen();
  render();
  const st = S.steps[S.i];
  if (st.t === "mcq" || st.t === "vq" || st.t === "pair") setTimeout(() => { const v = st.t === "pair" ? st.p[st.target === "a" ? "aa" : "ab"] : st.au; play(v); }, 200);
}
function finishListen() {
  const n = S.n;
  if (S.kind === "review-listen") { S.listenResult = { correct: S.correct, total: S.total }; return startReviewSpeak(n, S); }
  if (S.kind === "test-vocab") { const prev = { vocabQuiz: { correct: S.correct, total: S.total } }; return startTestListen(n, prev); }
  if (S.kind === "test-listen") { const res = Object.assign({}, S.prev, { listen: { correct: S.correct, total: S.total } }); return startTestSpeak(n, res); }
  const r = dayRec(n); r.module = "listen"; r.moduleDone = true; r.stats = { listen: { correct: S.correct, total: S.total } }; save();
  S = null; checkDayDone(n);
  go("done", { n });
}

// ===== SPEAKING =====
function speakSteps(n) {
  const d = dayOf(n), st = [];
  if (d.type === "speak") {
    d.warmup.forEach(u => st.push({ t: "warm", u }));
    d.shadow.forEach(h => st.push({ t: "shadow", es: h.es, tr: isZh() ? h.zh : h.en, au: h.au, dur: h.dur, ref: h.ref }));
    st.push({ t: "role", n: n - 1, role: d.roleplay.role, round: 1, k: 0 });
    st.push({ t: "role", n: n - 1, role: d.roleplay.role, round: 2, k: 0 });
    d.subs.forEach(sb => sb.items.forEach(it => st.push({ t: "sub", pattern: sb.pattern, cue: isZh() ? it.cue : it.cueEn, es: it.es, au: it.au, dur: it.dur, ref: it.ref })));
    d.questions.forEach(q => st.push({ t: "q", q }));
    st.push({ t: "free", f: d.free });
  } else if (d.type === "listen") {
    d.sentences.slice(0, 5).forEach(s => st.push({ t: "shadow", es: s.es, tr: (isZh() ? s.opts : s.optsEn)[0], au: s.au, dur: s.dur, ref: null }));
    st.push({ t: "role", n, role: "A", round: 1, k: 0 });
  }
  return st;
}
function startSpeak(n, steps, kind, prev) {
  S = { type: "speak", kind: kind || "speak", n, steps, i: 0, results: [], rec: null, cur: null, prev };
  const packsNeeded = new Set([n]); steps.forEach(s => { if (s.t === "role") packsNeeded.add(s.n); if (s.pack) packsNeeded.add(s.pack); });
  Promise.all([...packsNeeded].map(loadPack));
  getEngine().catch(() => {});
  go("speak");
}
function scoreBlock(r, es) {
  if (!r) return "";
  if (r.error) return `<div class="notice">${esc(r.error)}</div>`;
  const words = es.replace(/[¿¡]/g, "").split(/\s+/).filter(Boolean);
  const pass = state.settings.pass;
  const colored = r.words && r.words.length === words.length ? words.map((w, i) => `<span class="${r.words[i] >= 80 ? "w-ok" : r.words[i] >= pass - 20 ? "w-mid" : "w-low"}">${esc(w)}</span>`).join(" ") : esc(es);
  const weak = r.words ? words.map((w, i) => [w, r.words[i]]).filter(x => x[1] < pass - 20) : [];
  return `<div class="card row" style="gap:18px;align-items:center"><div class="ring ${r.overall < pass ? "low" : ""}"><b class="tabular">${r.overall}</b><span>/ 100</span></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:6px" class="tabular"><div class="kv"><span class="muted">${L("发音准确", "Accuracy")}</span><b>${r.accuracy}</b></div><div class="kv"><span class="muted">${L("流利度", "Fluency")}</span><b>${r.fluency}</b></div><div class="kv"><span class="muted">${L("完整度", "Completeness")}</span><b>${r.completeness}</b></div></div></div>
    <div class="card stack" style="gap:6px"><div lang="es" style="font-size:19px;font-weight:700;line-height:1.6">${colored}</div>
      <div class="small muted">${L("我们听到：", "We heard: ")}<span lang="es">${esc(r.heard || "—")}</span></div>
      ${weak.length ? `<div class="small" style="color:var(--clay);font-weight:600">${L("再练这些词：", "Practise these words: ")}<span lang="es">${weak.map(x => esc(x[0])).join("、")}</span></div>` : ""}
      ${r.overall < pass && state.settings.lowToReview ? `<div class="tiny muted">${L("低于及格线，已加入下次复习", "Below the pass mark, added to your next review")}</div>` : ""}</div>`;
}
function recControls(opts) {
  const rec = S.rec;
  const busy = S.busy;
  const label = rec ? L("点击停止", "Tap to stop") : busy ? (engine.state === "ready" ? L("评分中…", "Scoring…") : L("等待评分模型…", "Waiting for the model…")) : L("点击录音", "Tap to record");
  return `<div class="stack" style="align-items:center;gap:6px">
    <button type="button" class="mic ${rec ? "rec" : ""}" data-act="rec" aria-label="${rec ? L("停止录音", "Stop recording") : L("开始录音", "Start recording")}" ${busy ? "disabled" : ""}>${rec ? I.stop : I.mic()}</button>
    <span class="small muted" style="font-weight:600" id="rec-label">${label}</span>
    ${opts && opts.note ? `<span class="tiny muted">${opts.note}</span>` : ""}</div>`;
}
const engineLine = () => `<div class="loading tiny" data-engine>${engineLabel()}</div>`;
VIEWS.speak = () => {
  const st = S.steps[S.i];
  const label = { warm: L("口语 · 发音热身", "Speaking · warm-up"), shadow: L("口语 · 跟读打分", "Speaking · read-aloud"), role: L("口语 · 角色扮演", "Speaking · role-play"), sub: L("口语 · 替换练习", "Speaking · swap drill"), q: L("口语 · 回答问题", "Speaking · your answers"), free: L("口语 · 自由表达", "Speaking · free talk") }[st.t];
  const head = topBar(label, S.i + 1, S.steps.length, "var(--clay)");
  const cur = S.cur; // result for this step
  const myRec = cur && cur.url ? `<button type="button" class="btn btn-ghost" style="min-height:44px;font-size:14px" data-act="play" data-v="${cur.url}">${L("我的录音", "My recording")}</button>` : "";
  const nextBtn = (txt) => `<button type="button" class="btn btn-dark" style="flex:1" data-act="s-next">${txt || L("下一个", "Next")}</button>`;
  if (st.t === "warm") {
    return `<div class="stack" style="gap:18px;flex:1">${head}<div class="title-l">${L("先听，再模仿", "Listen, then copy")}</div>
      <div class="card stack" style="gap:12px"><div class="row" style="justify-content:space-between"><div lang="es" style="font-size:26px;font-weight:800;min-width:0">${esc(st.u.es)}</div>
      <button type="button" class="play" data-act="play" data-v="${st.u.au}" aria-label="${L("播放", "Play")}">${I.speaker()}</button></div>
      <div class="row" style="gap:10px;align-items:flex-start;color:var(--clay)">${I.bulb}<span class="small" style="color:var(--ink)">${esc(isZh() ? st.u.tip : st.u.tipEn)}</span></div></div>
      <p class="small muted" style="margin:0">${L("单个词不打分：录下来和原音对比就好。", "Single words aren't scored: record yourself and compare with the model voice.")}</p>
      <div style="margin-top:auto" class="stack">${recControls()}<div class="row">${myRec}${nextBtn()}</div></div></div>`;
  }
  if (st.t === "shadow" || st.t === "sub") {
    const top = st.t === "shadow"
      ? `<div class="title-l">${L("听原句，模仿语调读出来", "Listen, then read it with the same rhythm")}</div>
         <div class="card stack" style="gap:12px"><div lang="es" style="font-size:22px;font-weight:700;line-height:1.5">${esc(st.es)}</div><div class="small muted">${esc(st.tr)}</div>
         <div class="row" style="gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-ghost" style="min-height:44px;font-size:14px" data-act="play" data-v="${st.au}">${I.playS} ${L("原句", "Model")}</button><button type="button" class="btn btn-ghost" style="min-height:44px;font-size:14px" data-act="play-slow" data-v="${st.au}">${L("慢速", "Slow")}</button>${myRec}</div></div>`
      : `<div class="title-l">${L("看提示，说出整句", "Say the full sentence")}</div>
         <div class="card stack" style="gap:10px"><div class="small muted">${L("句型", "Pattern")}</div><div lang="es" style="font-size:20px;font-weight:700">${esc(st.pattern)}</div>
         <div class="row"><span class="chip chip-clay" style="font-size:15px">${esc(st.cue)}</span></div>
         ${cur ? `<div class="row" style="gap:10px;flex-wrap:wrap"><span class="small muted">${L("答案：", "Answer: ")}</span><span lang="es" style="font-weight:700">${esc(st.es)}</span><button type="button" class="play sm" data-act="play" data-v="${st.au}" aria-label="${L("播放答案", "Play the answer")}">${I.playS}</button>${myRec}</div>` : ""}</div>`;
    return `<div class="stack" style="gap:16px;flex:1">${head}${top}${scoreBlock(cur && cur.r, st.es)}
      <div style="margin-top:auto" class="stack">${engineLine()}${recControls()}
      ${cur && cur.r ? `<div class="row">${nextBtn()}</div>` : `<button type="button" class="btn btn-ghost" data-act="s-skip">${L("跳过这句", "Skip this one")}</button>`}</div></div>`;
  }
  if (st.t === "role") {
    const dl = dayOf(st.n).dialogue;
    const me = st.role, other = me === "A" ? "B" : "A";
    const lines = dl.lines;
    const hist = lines.slice(0, st.k).map((l, idx) => {
      const mine = l.s === me; const r = S.roleRes && S.roleRes[st.round + "-" + idx];
      if (mine) return `<div class="bubble b-me"><div lang="es" style="font-weight:600">${esc(l.es)}</div>${r ? `<div class="row" style="justify-content:space-between"><span class="tiny muted">${L("我的回答", "You")}</span><span class="pill" style="background:${r.overall >= state.settings.pass ? "var(--teal)" : "var(--clay)"};color:${r.overall >= state.settings.pass ? "var(--on-teal)" : "var(--on-clay)"}">${r.overall} ${L("分", "pts")}</span></div>` : ""}</div>`;
      return `<div class="row" style="align-items:flex-end;gap:8px"><div class="avatar">${esc(tName(dl, l.s)[0])}</div><div class="bubble b-them"><div lang="es" style="font-weight:600">${esc(l.es)}</div><button type="button" class="btn btn-ghost" style="min-height:32px;font-size:12px;padding:0 10px;align-self:flex-start" data-act="play" data-v="${l.au}">${I.playS} ${L("重播", "Replay")}</button></div></div>`;
    }).join("");
    const curL = lines[st.k];
    let bottom = "";
    if (!curL) bottom = `<div class="row">${nextBtn(st.round === 1 ? L("第二轮：只看提示", "Round 2: hints only") : L("继续", "Continue"))}</div>`;
    else if (curL.s === other) bottom = `<button type="button" class="btn btn-dark wide" data-act="role-other">${I.speaker(18)} ${L(`听 ${tName(dl, other)} 说`, `Hear ${tName(dl, other)}`)}</button>`;
    else {
      const showEs = st.round === 1;
      const r = cur && cur.r;
      bottom = `<div class="card stack" style="border:2px solid var(--clay);gap:12px"><div class="small" style="color:var(--clay);font-weight:700">${L("轮到你说", "Your turn")}</div>
        ${showEs ? `<div lang="es" style="font-size:19px;font-weight:700">${esc(curL.es)}</div><div class="small muted">${esc(isZh() ? curL.zh : curL.en)}</div>`
          : `<div style="font-size:19px;font-weight:700">${esc(isZh() ? curL.zh : curL.en)}</div>${S.hint ? `<div class="small muted">${L("提示开头：", "Starts with: ")}<b lang="es" style="color:var(--ink)">${esc(curL.es.split(" ").slice(0, 2).join(" "))}…</b></div>` : `<button type="button" class="btn btn-ghost" style="min-height:40px;font-size:13px;align-self:flex-start" data-act="hint">${L("提示开头", "Show a hint")}</button>`}`}
        ${r ? scoreBlock(r, curL.es) : ""}
        ${engineLine()}${recControls()}
        ${r ? `<div class="row"><button type="button" class="btn btn-dark" style="flex:1" data-act="role-done">${L("继续对话", "Continue")}</button></div>` : `<button type="button" class="btn btn-ghost" data-act="role-skip">${L("跳过", "Skip")}</button>`}</div>`;
    }
    return `<div class="stack" style="gap:16px;flex:1">${head}<div class="row" style="justify-content:space-between"><div class="title-l">${L(`你来演 ${tName(dl, me)}`, `You are ${tName(dl, me)}`)}</div><span class="pill" style="background:var(--soft);color:var(--muted)">${st.round === 1 ? L("第一轮 · 看原文", "Round 1 · with text") : L("第二轮 · 只看提示", "Round 2 · hints only")}</span></div>
      <div class="stack" style="gap:12px">${hist}</div><div style="margin-top:auto">${bottom}</div></div>`;
  }
  if (st.t === "q") {
    const q = st.q;
    return `<div class="stack" style="gap:16px;flex:1">${head}<div class="title-l">${L("用完整句子回答，说真实情况", "Answer in a full sentence, about yourself")}</div>
      <div class="card stack" style="gap:10px"><div class="row" style="justify-content:space-between"><div lang="es" style="font-size:20px;font-weight:700;min-width:0">${esc(q.es)}</div><button type="button" class="play" data-act="play" data-v="${q.au}" aria-label="${L("播放问题", "Play the question")}">${I.speaker()}</button></div><div class="small muted">${esc(isZh() ? q.zh : q.en)}</div></div>
      ${cur && cur.heard !== undefined ? `<div class="card stack" style="gap:8px"><div class="small muted">${L("我们听到：", "We heard: ")}</div><div lang="es" style="font-size:17px;font-weight:600">${esc(cur.heard || "—")}</div>
        <div class="row" style="gap:10px;flex-wrap:wrap"><span class="small muted">${L("参考回答：", "Sample answer: ")}</span><span lang="es" style="font-weight:700">${esc(q.sample)}</span><button type="button" class="play sm" data-act="play" data-v="${q.aa}" aria-label="${L("播放参考回答", "Play the sample")}">${I.playS}</button></div>${myRec}</div>`
        : `<button type="button" class="btn btn-ghost" style="align-self:flex-start;min-height:40px;font-size:13px" data-act="show-sample">${S.showSample ? esc(q.sample) : L("卡住了？看参考回答", "Stuck? See a sample answer")}</button>`}
      <div style="margin-top:auto" class="stack">${engineLine()}${recControls({ note: L("开放回答不打分，只显示识别结果", "Open answers aren't scored; you'll see what we heard") })}<div class="row">${nextBtn()}</div></div></div>`;
  }
  if (st.t === "free") {
    const f = st.f;
    const checks = (isZh() ? f.checklist : f.checklistEn).map((c, j) => `<button type="button" class="chk" data-act="chk" data-v="${j}" aria-pressed="${S.checks && S.checks[j] ? "true" : "false"}"><span class="box">${S.checks && S.checks[j] ? I.check(14) : ""}</span>${esc(c)}</button>`).join("");
    return `<div class="stack" style="gap:16px;flex:1">${head}<div class="title-l">${esc(isZh() ? f.prompt : f.promptEn)}</div>
      <div class="card stack" style="gap:8px"><div class="small muted">${L("可用的框架", "A frame you can use")}</div><div lang="es" style="font-size:17px;font-weight:600">${esc(f.frame)}</div></div>
      ${cur && cur.heard !== undefined ? `<div class="card stack" style="gap:8px"><div class="small muted">${L("我们听到：", "We heard: ")}</div><div lang="es">${esc(cur.heard || "—")}</div>${myRec}</div>` : ""}
      <div class="card stack" style="gap:4px"><div class="small muted" style="font-weight:700">${L("录完后自查", "Check yourself")}</div>${checks}</div>
      <div style="margin-top:auto" class="stack">${engineLine()}${recControls({ note: L("最长 60 秒", "Up to 60 seconds") })}<div class="row">${nextBtn(L("完成口语", "Finish speaking"))}</div></div></div>`;
  }
  return "";
};
async function toggleRec() {
  if (S.busy) return;
  if (!S.rec) {
    const st = S.steps[S.i];
    const maxSec = st.t === "free" ? 60 : st.t === "q" ? 20 : 10;
    const r = new MicRecorder();
    try { await r.start(); }
    catch (e) { S.cur = Object.assign(S.cur || {}, { r: { error: L("无法使用麦克风：请在浏览器里允许麦克风后重试。", "Can't use the microphone. Allow microphone access in your browser, then try again.") } }); return render(); }
    stopAudio();
    S.rec = { r, t0: Date.now(), timer: setTimeout(() => { if (S && S.rec && S.rec.r === r) toggleRec(); }, maxSec * 1000) };
    return render();
  }
  const { r, timer } = S.rec; clearTimeout(timer); S.rec = null; S.busy = true; render();
  const step = S.steps[S.i];
  try {
    const { samples, sampleRate } = await r.stop();
    const x16 = trimSilence(await resampleTo16k(samples, sampleRate));
    const url = URL.createObjectURL(encodeWav(x16));
    let eng = null;
    try { eng = await getEngine(); } catch (e) { eng = null; }
    let target = null, dur = null, ref = null;
    if (step.t === "shadow" || step.t === "sub") { target = step.es; dur = step.dur; ref = step.ref; }
    if (step.t === "role") { const l = dayOf(step.n).dialogue.lines[step.k]; target = l.es; dur = l.dur; ref = l.ref; }
    const res = { url };
    if (!eng) res.r = target ? { error: engineLabel() } : undefined;
    else if (target) {
      if (x16.length < 16000 * 0.3) res.r = { error: L("没有录到声音，请靠近手机再读一遍。", "We didn't catch any speech. Move closer and try again.") };
      else res.r = await eng.score(x16, target, dur, 3.0, ref);
    } else res.heard = await eng.transcribe(x16);
    if (!eng && !target) res.heard = "";
    if (step.t === "free" && S.n) idbPut("rec", "day-" + S.n, new Blob([encodeWav(x16)], { type: "audio/wav" }));
    S.cur = res;
  } catch (e) {
    S.cur = { r: { error: String(e && e.message || e) } };
  }
  S.busy = false;
  render();
}
function recordResult(kind, es, r, extra) {
  if (!r || r.error) return;
  S.results.push(Object.assign({ kind, es, overall: r.overall, accuracy: r.accuracy, fluency: r.fluency, completeness: r.completeness, words: r.words, wordsText: r.wordsText }, extra || {}));
  if (r.overall < state.settings.pass && state.settings.lowToReview && extra && extra.au) {
    state.lowSentences = state.lowSentences.filter(x => x.es !== es).concat([{ es, au: extra.au, day: extra.day, dur: extra.dur, ref: extra.ref, tr: extra.tr, score: r.overall }]).slice(-40);
  } else if (r.overall >= state.settings.pass) {
    state.lowSentences = state.lowSentences.filter(x => x.es !== es);
  }
}
function speakAdvance(skip) {
  const st = S.steps[S.i];
  if (!skip && S.cur && S.cur.r && (st.t === "shadow" || st.t === "sub")) recordResult(st.t, st.es, S.cur.r, { au: st.au, day: st.pack || S.n, dur: st.dur, ref: st.ref, tr: st.tr || st.cue });
  if (st.t === "free") S.free = { heard: S.cur && S.cur.heard, checks: S.checks || [] };
  S.cur = null; S.hint = false; S.showSample = false;
  S.i++;
  if (S.i >= S.steps.length) return finishSpeak();
  render();
  const nx = S.steps[S.i];
  if (nx.t === "shadow") setTimeout(() => play(nx.au), 200);
  if (nx.t === "q") setTimeout(() => play(nx.q.au), 200);
  if (nx.t === "warm") setTimeout(() => play(nx.u.au), 200);
  if (nx.t === "role") setTimeout(roleAuto, 200);
}
function roleAuto() {
  const st = S.steps[S.i]; if (!st || st.t !== "role") return;
  const dl = dayOf(st.n).dialogue; const l = dl.lines[st.k];
  if (l && l.s !== st.role) { play(l.au).then(() => { if (S && S.steps[S.i] === st && dl.lines[st.k] === l) { st.k++; render(); roleAuto(); } }); }
}
function finishSpeak() {
  const n = S.n;
  const res = S.results;
  const rep = {
    avg: Math.round(avg(res.map(r => r.overall))), acc: Math.round(avg(res.map(r => r.accuracy))), flu: Math.round(avg(res.map(r => r.fluency))), comp: Math.round(avg(res.map(r => r.completeness))),
    items: res.filter(r => r.kind === "shadow").map(r => ({ es: r.es, score: r.overall })),
    roleAvg: Math.round(avg(res.filter(r => r.kind === "role").map(r => r.overall))),
    weak: [], free: S.free || null, count: res.length,
  };
  const wmap = {};
  res.forEach(r => (r.wordsText || []).forEach((w, i) => { const s = r.words[i]; if (s < state.settings.pass - 20) wmap[w] = Math.min(wmap[w] ?? 100, s); }));
  rep.weak = Object.entries(wmap).sort((a, b) => a[1] - b[1]).slice(0, 6).map(x => x[0]);
  const prevH = state.speakHistory.filter(h => h.day < n).slice(-1)[0];
  rep.delta = prevH && res.length ? rep.avg - prevH.avg : null;
  if (S.kind === "review-speak" || S.kind === "test-speak") rep.extra = S.prev;
  if (res.length) state.speakHistory = state.speakHistory.filter(h => h.day !== n).concat([{ day: n, date: today(), avg: rep.avg }]);
  const r = dayRec(n); r.module = (S.kind === "speak") ? "speak" : dayOf(n).type; r.moduleDone = true; r.stats = Object.assign({}, r.stats || {}, { speak: rep }, S.prev || {}); save();
  S = null; checkDayDone(n);
  go("report", { n, rep });
}

// ===== REVIEW (day 15) & TEST (day 30) =====
function startReview(n) {
  const pool = sentencePool(14);
  const steps = pick(pool, 10).map(({ s, k }) => mcqFrom(s.au, s.es, isZh() ? s.opts : s.optsEn, { pack: k }));
  startListen(n, steps, "review-listen");
}
function startReviewSpeak(n, prevS) {
  const low = state.lowSentences.slice().sort((a, b) => a.score - b.score).slice(0, 5);
  let items = low.map(x => ({ t: "shadow", es: x.es, tr: x.tr || "", au: x.au, dur: x.dur, ref: x.ref, pack: x.day }));
  if (items.length < 5) {
    const extra = [];
    for (let k = 2; k <= 14; k++) { const d = dayOf(k); if (d.type === "speak") d.shadow.forEach(h => extra.push({ t: "shadow", es: h.es, tr: isZh() ? h.zh : h.en, au: h.au, dur: h.dur, ref: h.ref, pack: k })); }
    items = items.concat(pick(extra.filter(x => !items.some(y => y.es === x.es)), 5 - items.length));
  }
  const steps = items.concat([{ t: "free", f: { prompt: "用 4–5 句话介绍你自己：名字、家人、作息和爱好", promptEn: "Introduce yourself in 4–5 sentences: name, family, routine, hobbies", frame: "Me llamo… Soy de… Tengo… Normalmente me levanto a las… Me gusta…", checklist: ["说了名字和来自哪里", "说了一个家人", "说了一个时间"], checklistEn: ["Name and where you're from", "One family member", "A time of day"] } }]);
  startSpeak(n, steps, "review-speak", { listen: prevS.listenResult });
}
function startTest(n) {
  const ids = Object.keys(state.cards);
  const pool = ids.length >= 6 ? ids : backlog(29);
  const chosen = pick(pool, Math.min(30, pool.length));
  const steps = chosen.map(id => {
    const { w, day } = wordById(id);
    const others = pick(pool.filter(x => x !== id).map(x => tMean(wordById(x).w)).filter(m => m !== tMean(w)), 2);
    const order = shuffle([0, 1, 2]); const opts = [tMean(w), ...others];
    return { t: "vq", au: w.aw, es: w.w, opts: order.map(k => opts[k]), right: order.indexOf(0), pack: day };
  });
  startListen(n, steps, "test-vocab");
}
function startTestListen(n, prev) {
  const steps = pick(sentencePool(29), 20).map(({ s, k }) => mcqFrom(s.au, s.es, isZh() ? s.opts : s.optsEn, { pack: k }));
  startListen(n, steps, "test-listen"); S.prev = prev;
}
function startTestSpeak(n, prev) {
  const all = [];
  for (let k = 2; k <= 29; k++) { const d = dayOf(k); if (d.type === "speak") d.shadow.forEach(h => all.push({ t: "shadow", es: h.es, tr: isZh() ? h.zh : h.en, au: h.au, dur: h.dur, ref: h.ref, pack: k })); }
  const steps = pick(all, 10).concat([{ t: "free", f: { prompt: "用 1 分钟介绍你自己，和第 15 天的录音对比", promptEn: "Talk about yourself for 1 minute, then compare with your Day 15 recording", frame: "Me llamo… Vivo en… Trabajo… Me gusta… Este fin de semana voy a…", checklist: ["用了 ser 和 estar", "说了喜好", "说了一个计划"], checklistEn: ["Used ser and estar", "Talked about likes", "Talked about a plan"] } }]);
  startSpeak(n, steps, "test-speak", prev);
}

// ===== REPORT / DONE =====
VIEWS.report = () => {
  const { n, rep } = view; const d = dayOf(n);
  const items = rep.items.map(it => `<div class="row tabular" style="justify-content:space-between;min-height:34px;font-size:14px;${it.score < state.settings.pass ? "background:var(--clay-soft);border-radius:10px;padding:0 8px;margin:0 -8px" : ""}"><span lang="es" style="min-width:0">${esc(it.es)}${it.score < state.settings.pass ? `<span class="tiny" style="display:block;color:var(--clay);font-weight:700">${L("已加入下次复习", "Added to your next review")}</span>` : ""}</span><b style="${it.score < state.settings.pass ? "color:var(--clay)" : ""}">${it.score}</b></div>`).join("");
  const extra = rep.extra || {};
  const ex = [];
  if (extra.listen) ex.push(`${L("听力", "Listening")} ${extra.listen.correct}/${extra.listen.total}`);
  if (extra.vocabQuiz) ex.push(`${L("词汇测验", "Vocab quiz")} ${extra.vocabQuiz.correct}/${extra.vocabQuiz.total}`);
  return `<div class="stack" style="gap:14px"><div><div class="title-l">${L("今日口语报告", "Speaking report")}</div><div class="small muted" style="font-weight:600">${L(`第 ${n} 天`, `Day ${n}`)} · ${esc(tTheme(d))}</div></div>
    ${ex.length ? `<div class="card small" style="font-weight:700">${ex.join(" · ")}</div>` : ""}
    ${rep.count ? `<div class="card row" style="gap:18px"><div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div class="ring ${rep.avg < state.settings.pass ? "low" : ""}" style="width:88px;height:88px;border-width:8px"><b class="tabular">${rep.avg}</b><span>/ 100</span></div>
      ${rep.delta !== null ? `<span class="tiny" style="font-weight:700;color:${rep.delta >= 0 ? "var(--teal)" : "var(--clay)"}">${L("比上次", "vs last time")} ${rep.delta >= 0 ? "+" : ""}${rep.delta}</span>` : ""}</div>
      <div style="flex:1;display:flex;flex-direction:column;gap:10px" class="tabular">${[[L("发音准确", "Accuracy"), rep.acc], [L("流利度", "Fluency"), rep.flu], [L("完整度", "Completeness"), rep.comp]].map(([k, v]) => `<div class="stack" style="gap:4px"><div class="kv small"><span class="muted">${k}</span><b>${v}</b></div><div class="bar"><i style="width:${v}%"></i></div></div>`).join("")}</div></div>` : `<div class="notice">${L("这次没有打分记录（可能跳过了全部句子或评分模型没有加载）。", "No scores this time (sentences were skipped or the scoring model didn't load).")}</div>`}
    ${items ? `<div class="card stack" style="gap:4px"><div class="row small muted" style="justify-content:space-between;font-weight:700"><span>${L("跟读", "Read-aloud")} · ${rep.items.length}</span>${rep.roleAvg ? `<span>${L("角色扮演平均", "Role-play avg")} ${rep.roleAvg}</span>` : ""}</div>${items}</div>` : ""}
    ${rep.weak.length ? `<div class="stack" style="gap:8px"><div class="eyebrow">${L("今天要多练的词", "Words to practise")}</div><div class="row" style="gap:8px;flex-wrap:wrap">${rep.weak.map(w => `<span lang="es" class="chip" style="background:var(--surface);border:1.5px solid var(--line);color:var(--ink)">${esc(w)}</span>`).join("")}</div></div>` : ""}
    ${rep.free ? `<div class="card stack" style="gap:8px"><div class="row" style="gap:12px"><button type="button" class="play sm" data-act="play-rec" data-v="${n}" aria-label="${L("播放自由表达录音", "Play your free-talk recording")}">${I.playS}</button><div><div style="font-weight:700">${L("自由表达", "Free talk")}</div><div class="tiny muted">${L("已存档在本机，可在测验日对比", "Saved on this device for comparison on test day")}</div></div></div>${rep.free.heard ? `<div class="small" lang="es">${esc(rep.free.heard)}</div>` : ""}</div>` : ""}
    <button type="button" class="btn btn-dark wide" data-act="to-done" data-v="${n}">${L("完成今日训练", "Finish today")}</button></div>`;
};
VIEWS.done = () => {
  const n = view.n; const r = state.days[n] || {}; const d = dayOf(n);
  const vs = r.vocabStats || {};
  const st = r.stats || {};
  const tiles = [];
  if (vs.reviews !== undefined) { tiles.push([L("复习词汇", "Words reviewed"), vs.reviews]); tiles.push([L("复习正确率", "Review accuracy"), vs.reviews ? Math.round(vs.good * 100 / vs.reviews) + "%" : "—"]); tiles.push([L("新学词汇", "New words"), vs.fresh]); }
  if (st.listen) tiles.push([L("听力正确", "Listening"), `${st.listen.correct}/${st.listen.total}`]);
  if (st.speak && st.speak.count) tiles.push([L("口语平均分", "Speaking avg"), st.speak.avg]);
  const nd = n < 30 ? dayOf(n + 1) : null;
  const missing = !r.done ? (!r.vocab ? L("还差：词汇", "Still to do: vocabulary") : L("还差：听力或口语", "Still to do: listening or speaking")) : "";
  return `<div class="stack" style="gap:20px;padding-top:20px">
    <div class="stack" style="align-items:center;gap:10px"><div style="width:96px;height:96px;border-radius:999px;background:${r.done ? "var(--teal)" : "var(--soft)"};color:${r.done ? "var(--on-teal)" : "var(--muted)"};display:flex;align-items:center;justify-content:center">${I.check(48)}</div>
      <div class="title-xl">${r.done ? L(`第 ${n} 天完成！`, `Day ${n} done!`) : L("这一部分完成了", "Section done")}</div>
      ${missing ? `<div class="small muted" style="font-weight:600">${missing}</div>` : ""}</div>
    ${r.done ? `<div class="card row" style="justify-content:space-between"><span class="row" style="gap:8px;font-weight:800;color:var(--clay)">${I.flame}${L(`连续 ${streak()} 天`, `${streak()}-day streak`)}</span><span class="small muted">${esc(tTheme(d))}</span></div>` : ""}
    ${tiles.length ? `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">${tiles.map(([k, v]) => `<div class="card"><div class="small muted" style="font-weight:600">${k}</div><div class="tabular" style="font-size:26px;font-weight:800">${v}</div></div>`).join("")}</div>` : ""}
    ${nd && r.done ? `<div style="background:var(--night);color:var(--on-night);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:6px"><div class="small" style="color:var(--night-muted);font-weight:600">${L(`明天 · 第 ${n + 1} 天`, `Tomorrow · Day ${n + 1}`)}</div>
      <div style="font-size:20px;font-weight:800">${esc(tTheme(nd))} · ${nd.type === "listen" ? L("推荐听力", "listening") : nd.type === "speak" ? L("推荐口语", "speaking") : nd.type === "review" ? L("复习日", "review day") : L("测验日", "test day")}</div>
      ${nd.words.length ? `<div class="small" style="color:var(--night-muted)">${L("新词：", "New words: ")}<span lang="es">${nd.words.slice(0, 3).map(w => esc(w.w)).join("、")}…</span></div>` : ""}</div>` : ""}
    <button type="button" class="btn btn-teal wide" data-act="tab" data-v="home">${L("返回首页", "Back to home")}</button></div>`;
};
function checkDayDone(n) {
  const r = dayRec(n);
  const plan = vocabPlan(n);
  const vocabOk = r.vocab || (plan.reviews.length + plan.fresh.length === 0);
  if (vocabOk && r.moduleDone && !r.done) { r.done = true; r.date = today(); save(); }
}

// ===== MAP =====
VIEWS.map = () => {
  const cur = currentDay();
  const learned = Object.keys(state.cards).length;
  const row = (k1, k2) => {
    const d = dayOf(k1);
    const done = state.days[k1] && state.days[k1].done && (!k2 || (state.days[k2] && state.days[k2].done));
    const isCur = cur === k1 || cur === k2;
    const status = done ? `<span class="ok">${I.checkC}</span><span class="sr-only" hidden>${L("已完成", "Done")}</span>` : isCur ? `<span class="pill" style="background:var(--clay);color:var(--on-clay)">${L("今天", "Today")}</span>` : `<span style="color:var(--faint)" aria-label="${L("未开始", "Not started")}">${I.circle}</span>`;
    return `<div class="row" style="min-height:50px;${isCur ? "background:var(--clay-soft);border-radius:12px;margin:0 -8px;padding:0 8px" : ""}"><span class="tabular" style="width:44px;font-size:12px;font-weight:700;color:${isCur ? "var(--clay)" : "var(--muted)"}">${k2 ? k1 + "–" + k2 : k1}</span>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:15px;font-weight:700">${esc(tTheme(d))}</span><span class="tiny muted">${esc(tGram(d))}</span></div>${status}</div>`;
  };
  const phase = (a, b, title) => { let h = ""; for (let k = a; k <= b; k++) { const d = dayOf(k); if (d.type === "listen" && k < b) { h += row(k, k + 1); k++; } else h += row(k); } return `<div class="card stack" style="gap:2px"><div class="row" style="justify-content:space-between;padding-bottom:6px"><span style="font-size:15px;font-weight:800">${title}</span><span class="tiny muted" style="font-weight:600">${L(`第 ${a}–${b} 天`, `Days ${a}–${b}`)}</span></div>${h}</div>`; };
  return `<div class="stack"><div class="row" style="justify-content:space-between;align-items:flex-end"><div><div class="title-l" style="font-size:26px">${L("课程地图", "Course map")}</div><div class="small muted" style="font-weight:600">${L("30 天 · 14 个主题 · 140 个新词", "30 days · 14 themes · 140 new words")}</div></div><div class="small ok" style="font-weight:700">${L(`已学 ${learned} 词`, `${learned} words learned`)}</div></div>
    ${phase(1, 15, L("阶段一 · 现在时巩固", "Stage 1 · Present tense"))}${phase(16, 30, L("阶段二 · 喜好与计划", "Stage 2 · Likes & plans"))}</div>`;
};

// ===== WORDS =====
VIEWS.words = () => {
  const f = view.filter || "all"; const q = (view.q || "").trim().toLowerCase();
  const ids = state.introduced.filter(id => state.cards[id]);
  const t = today();
  let list = ids.map(id => ({ id, c: state.cards[id], ...wordById(id) }));
  const counts = { all: list.length, mastered: list.filter(x => mastery(x.c) >= 3).length, learning: list.filter(x => mastery(x.c) < 3 && !isHard(x.c)).length, hard: list.filter(x => isHard(x.c)).length };
  if (f === "due") list = list.filter(x => x.c.due <= t);
  if (f === "hard") list = list.filter(x => isHard(x.c));
  if (q) list = list.filter(x => x.w.w.toLowerCase().includes(q) || tMean(x.w).toLowerCase().includes(q));
  list.sort((a, b) => a.c.due < b.c.due ? -1 : a.c.due > b.c.due ? 1 : 0);
  const rows = list.slice(0, 200).map(x => {
    const m = mastery(x.c); const d = daysBetween(t, x.c.due);
    const when = d <= 0 ? L("今天", "today") : d === 1 ? L("明天", "tomorrow") : L(`${d} 天后`, `in ${d} days`);
    return `<button type="button" class="list-row" style="width:100%;background:none;border-left:none;border-right:none;border-top:none;text-align:left;color:var(--ink)" data-act="word-play" data-v="${x.id}">
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><span style="font-size:16px;font-weight:700"><span lang="es">${esc(x.w.w)}</span> <span style="font-size:11px;font-weight:600;color:var(--muted)">${esc(tPos(x.w))}</span>${isHard(x.c) ? ` <span class="pill" style="background:var(--clay);color:var(--on-clay);padding:1px 6px;font-size:11px">${L("难词", "Tough")}</span>` : ""}</span><span class="small muted">${esc(tMean(x.w))}</span></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px"><span class="tiny" style="font-weight:700;color:${d <= 0 ? "var(--clay)" : "var(--muted)"}">${when}</span><div class="mast" aria-label="${L("熟练度", "Mastery")} ${m}/4">${[1, 2, 3, 4].map(k => `<i class="${k <= m ? "on" : ""}"></i>`).join("")}</div></div></button>`;
  }).join("");
  const stat = (v, lab, col) => `<div class="card" style="padding:10px;border-radius:14px"><div class="tabular" style="font-size:20px;font-weight:800;${col ? "color:" + col : ""}">${v}</div><div class="tiny muted" style="font-weight:600">${lab}</div></div>`;
  return `<div class="stack"><div class="title-l" style="font-size:26px">${L("词库", "Words")}</div>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${stat(counts.all, L("全部", "All"))}${stat(counts.mastered, L("已掌握", "Known"), "var(--teal)")}${stat(counts.learning, L("学习中", "Learning"))}${stat(counts.hard, L("难词", "Tough"), "var(--clay)")}</div>
    <label class="search">${I.search}<input id="word-search" aria-label="${L("搜索词汇", "Search words")}" placeholder="${L("搜索西语或中文", "Search Spanish or English")}" value="${esc(view.q || "")}"></label>
    <div class="filters">${[["all", L("全部", "All")], ["due", L("今天到期", "Due today")], ["hard", L("难词", "Tough")]].map(([k, lab]) => `<button type="button" data-act="wfilter" data-v="${k}" class="${f === k ? "on" : ""}">${lab}</button>`).join("")}</div>
    <div class="card" style="padding:4px 16px">${rows || `<div class="muted small" style="padding:20px 0;text-align:center">${ids.length ? L("没有符合条件的词", "No words match") : L("学过的词会出现在这里。先去完成今天的词汇吧。", "Words you learn will show up here. Start with today's vocabulary.")}</div>`}</div>
    <div class="tiny muted" style="text-align:center">${L("右侧四格为熟练度 · 点击单词听发音", "The four bars show mastery · tap a word to hear it")}</div></div>`;
};

// ===== SETTINGS =====
VIEWS.settings = () => {
  const s = state.settings;
  const stepper = (key, val, lab) => `<div class="list-row" style="justify-content:space-between"><span style="font-size:15px;font-weight:600">${lab}</span><div class="row" style="gap:4px"><button type="button" class="step" data-act="stepper" data-v="${key}:-1" aria-label="${L("减少", "Decrease")}">−</button><span class="tabular" style="width:36px;text-align:center;font-weight:800">${val}</span><button type="button" class="step" data-act="stepper" data-v="${key}:1" aria-label="${L("增加", "Increase")}">+</button></div></div>`;
  const sec = (t, body) => `<div class="eyebrow" style="padding-left:4px">${t}</div><div class="card" style="padding:0 14px">${body}</div>`;
  const cur = currentDay();
  return `<div class="stack" style="gap:12px"><div class="title-l" style="font-size:26px">${L("设置", "Settings")}</div>
    ${sec(L("讲解语言", "Explanations in"), `<div class="list-row" style="justify-content:space-between"><span style="font-size:15px;font-weight:600">${L("中文 / English", "English / 中文")}</span><div class="seg"><button type="button" data-act="lang" data-v="en" class="${s.lang === "en" ? "on" : ""}">English</button><button type="button" data-act="lang" data-v="zh" class="${s.lang === "zh" ? "on" : ""}">中文</button></div></div>`)}
    ${sec(L("学习安排", "Study plan"), stepper("newPerDay", s.newPerDay, L("每日新词", "New words a day")) + stepper("reviewCap", s.reviewCap, L("每日复习上限", "Daily review limit")) +
      `<div class="list-row" style="justify-content:space-between"><span style="font-size:15px;font-weight:600">${L("跳到第几天", "Jump to day")}</span><div class="row" style="gap:4px"><button type="button" class="step" data-act="jump-step" data-v="-1" aria-label="${L("减少", "Decrease")}">−</button><span class="tabular" style="width:36px;text-align:center;font-weight:800">${view.jump || cur}</span><button type="button" class="step" data-act="jump-step" data-v="1" aria-label="${L("增加", "Increase")}">+</button><button type="button" class="btn btn-ghost" style="min-height:36px;font-size:13px;padding:0 10px" data-act="jump">${L("跳转", "Go")}</button></div></div>`)}
    ${sec(L("声音", "Audio"), `<div class="list-row" style="justify-content:space-between"><span style="font-size:15px;font-weight:600">${L("默认语速", "Default speed")}</span><div class="seg"><button type="button" data-act="speed" data-v="0" class="${!s.slowDefault ? "on" : ""}">${L("正常", "Normal")}</button><button type="button" data-act="speed" data-v="1" class="${s.slowDefault ? "on" : ""}">${L("稍慢", "Slower")}</button></div></div>
      <div class="list-row small muted">${L("发音：拉美（墨西哥）口音，开源语音合成", "Voice: Latin American (Mexico) accent, open-source speech synthesis")}</div>`)}
    ${sec(L("口语评分", "Speaking scores"), stepper("pass", s.pass, L("及格线", "Pass mark")) +
      `<div class="list-row" style="justify-content:space-between"><span style="font-size:15px;font-weight:600">${L("低分句加入复习", "Add low scores to review")}</span><button type="button" class="toggle" data-act="toggle-low" aria-pressed="${s.lowToReview}" aria-label="${L("低分句加入复习", "Add low scores to review")}"><span></span></button></div>
      <div class="list-row" style="justify-content:space-between;gap:10px"><span class="small muted" data-engine style="flex:1">${engineLabel()}</span>${engine.state === "ready" || engine.state === "loading" || engine.state === "init" ? "" : `<button type="button" class="btn btn-ghost" style="min-height:36px;font-size:13px;padding:0 10px" data-act="load-model">${L("下载", "Download")}</button>`}</div>`)}
    ${sec(L("数据", "Data"), `<button type="button" class="list-row" style="width:100%;background:none;border-left:none;border-right:none;border-top:none;color:var(--ink);font-size:15px;font-weight:600;justify-content:space-between" data-act="export">${L("导出进度备份", "Export a backup")}<span class="tiny muted">${state.lastBackup ? L("上次 ", "Last ") + state.lastBackup : ""}</span></button>
      <label class="list-row" style="font-size:15px;font-weight:600;cursor:pointer">${L("从备份恢复", "Restore from a backup")}<input type="file" id="import-file" accept="application/json,.json" style="position:absolute;opacity:0;width:1px;height:1px"></label>
      ${view.confirmReset ? `<div class="list-row" style="justify-content:space-between;gap:8px"><span class="small" style="color:var(--clay);font-weight:700">${L("确定清空全部进度？", "Erase all progress?")}</span><div class="row" style="gap:6px"><button type="button" class="btn btn-ghost" style="min-height:36px;font-size:13px;padding:0 10px" data-act="reset-cancel">${L("取消", "Cancel")}</button><button type="button" class="btn btn-clay" style="min-height:36px;font-size:13px;padding:0 10px" data-act="reset-do">${L("清空", "Erase")}</button></div></div>`
        : `<button type="button" class="list-row" style="width:100%;background:none;border:none;color:var(--clay);font-size:15px;font-weight:700" data-act="reset">${L("重置全部进度", "Reset all progress")}</button>`}`)}
    ${view.msg ? `<div class="notice">${esc(view.msg)}</div>` : ""}
    <div class="tiny muted" style="text-align:center">${L("版本 V1 · 内容：第 1–30 天 · 进度自动保存", "Version V1 · Content: days 1–30 · Progress saves automatically")}</div></div>`;
};
async function exportBackup() {
  const data = JSON.stringify(state);
  const filename = `espanol-diario-${today()}.json`;
  try {
    const dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
    if (dl) { const r = await dl.save({ filename, data }); state.lastBackup = today(); save(); view.msg = L("备份已保存", "Backup saved"); return render(); }
  } catch (e) { if (e && e.code === "cancelled") return; }
  try { await navigator.clipboard.writeText(data); view.msg = L("无法直接保存文件，已把备份内容复制到剪贴板，可以粘贴到备忘录保存。", "Couldn't save a file here, so the backup was copied to your clipboard. Paste it into a note to keep it."); }
  catch (e) { view.msg = L("这个页面暂时无法导出备份。", "Exporting isn't available on this page right now."); }
  render();
}

// ---------- events ----------
$app.addEventListener("input", e => {
  if (e.target.id === "word-search") { view.q = e.target.value; const pos = e.target.selectionStart; render(); const el = document.getElementById("word-search"); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (x) {} } }
});
$app.addEventListener("change", async e => {
  if (e.target.id === "import-file" && e.target.files && e.target.files[0]) {
    try { const s = JSON.parse(await e.target.files[0].text()); if (s && s.v === 1 && s.cards) { state = merge(DEFAULT, s); save(); view.msg = L("已恢复备份", "Backup restored"); } else view.msg = L("这不是有效的备份文件", "That isn't a valid backup file"); }
    catch (x) { view.msg = L("无法读取这个文件", "Couldn't read that file"); }
    render();
  }
});
function onClick(e) {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const act = b.dataset.act, v = b.dataset.v;
  switch (act) {
    case "tab": S = null; return go(v);
    case "quit": stopAudio(); if (S && S.rec) { try { S.rec.r.stop(); } catch (x) {} } S = null; return go("home");
    case "play": return void play(v);
    case "play-slow": return void play(v, true);
    case "stop-audio": return stopAudio();
    case "play-rec": idbGet("rec", "day-" + v).then(bl => { if (bl) play(URL.createObjectURL(bl)); }); return;
    case "start-vocab": return startVocab();
    case "start-mod": {
      const n = currentDay();
      if (v === "listen") return startListen(n, listenSteps(n), "listen");
      if (v === "speak") return startSpeak(n, speakSteps(n), "speak");
      if (v === "review") return startReview(n);
      if (v === "test") return startTest(n);
      return;
    }
    // vocab
    case "flip": S.flipped = true; render(); return;
    case "new-next": { const it = S.q[S.i]; const t = today(); const c = schedule(null, 3, t); c.due = addDays(t, 1); state.cards[it.id] = c; if (!state.introduced.includes(it.id)) state.introduced.push(it.id); S.stats.fresh++; save(); return vocabAdvance(); }
    case "rate": {
      const g = Number(v); const it = S.q[S.i]; const t = today();
      state.cards[it.id] = schedule(state.cards[it.id], g, t);
      S.stats.reviews++; if (g >= 2) S.stats.good++;
      if (g === 1 && !S.requeued.has(it.id)) { S.requeued.add(it.id); S.q.push({ id: it.id, kind: "review" }); }
      save(); return vocabAdvance();
    }
    // listening
    case "pair-ans": if (S.ans !== null) return; S.ans = v; if (v === S.steps[S.i].target) S.correct++; render(); return;
    case "mcq-ans": if (S.ans !== null) return; S.ans = Number(v); if (S.ans === S.steps[S.i].right) S.correct++; render(); return;
    case "play-dlg": { const st = S.steps[S.i]; S.plays++; playDialogue(st.n).then(() => { if (view.name === "listen" && S && S.steps[S.i].t === "dlg") render(); }); if (st.t === "dlg") render(); return; }
    case "l-next": stopAudio(); return listenAdvance();
    // speaking
    case "rec": return void toggleRec();
    case "s-next": stopAudio(); return speakAdvance(false);
    case "s-skip": stopAudio(); return speakAdvance(true);
    case "hint": S.hint = true; render(); return;
    case "show-sample": S.showSample = true; render(); return;
    case "chk": { S.checks = S.checks || []; S.checks[Number(v)] = !S.checks[Number(v)]; render(); return; }
    case "role-other": roleAuto(); return;
    case "role-done": case "role-skip": {
      const st = S.steps[S.i];
      if (act === "role-done" && S.cur && S.cur.r && !S.cur.r.error) { S.roleRes = S.roleRes || {}; S.roleRes[st.round + "-" + st.k] = S.cur.r; const l = dayOf(st.n).dialogue.lines[st.k]; recordResult("role", l.es, S.cur.r, { au: l.au, day: st.n, dur: l.dur, ref: l.ref, tr: isZh() ? l.zh : l.en }); }
      S.cur = null; S.hint = false; st.k++; render(); setTimeout(roleAuto, 150); return;
    }
    case "to-done": return go("done", { n: Number(v) });
    // words
    case "wfilter": view.filter = v; render(); return;
    case "word-play": { const { day, w } = wordById(v); loadPack(day).then(() => play(w.aw)); return; }
    // settings
    case "lang": state.settings.lang = v; save(); render(); return;
    case "speed": state.settings.slowDefault = v === "1"; save(); render(); return;
    case "toggle-low": state.settings.lowToReview = !state.settings.lowToReview; save(); render(); return;
    case "stepper": {
      const [k, dlt] = v.split(":"); const d = Number(dlt);
      const lim = { newPerDay: [1, 10, 1], reviewCap: [10, 60, 5], pass: [50, 90, 5] }[k];
      state.settings[k] = Math.min(lim[1], Math.max(lim[0], state.settings[k] + d * lim[2])); save(); render(); return;
    }
    case "jump-step": view.jump = Math.min(30, Math.max(1, (view.jump || currentDay()) + Number(v))); render(); return;
    case "jump": {
      const target = view.jump || currentDay(); const t = today();
      for (let k = 1; k <= 30; k++) {
        if (k < target) {
          if (!(state.days[k] && state.days[k].done)) state.days[k] = { done: true, skipped: true, date: t };
          dayOf(k).words.forEach((w, i) => { const id = wordId(k, i); if (!state.cards[id]) { const c = schedule(null, 3, t); c.due = t; state.cards[id] = c; state.introduced.push(id); } });
        } else if (state.days[k]) delete state.days[k];
      }
      save(); view.msg = L(`已跳到第 ${target} 天。之前的词会作为复习出现。`, `Moved to day ${target}. Earlier words will come up as reviews.`); render(); return;
    }
    case "load-model": getEngine().catch(() => {}); render(); return;
    case "export": return void exportBackup();
    case "reset": view.confirmReset = true; render(); return;
    case "reset-cancel": view.confirmReset = false; render(); return;
    case "reset-do": { const lang = state.settings.lang; state = clone(DEFAULT); state.settings.lang = lang; save(); view.confirmReset = false; view.msg = L("已清空进度", "Progress erased"); render(); return; }
  }
}
$app.addEventListener("click", onClick);
$tabs.addEventListener("click", onClick);
// live recording timer label
setInterval(() => { if (S && S.rec) { const el = document.getElementById("rec-label"); if (el) el.textContent = L("录音中 ", "Recording ") + Math.floor((Date.now() - S.rec.t0) / 1000) + "s · " + L("点击停止", "tap to stop"); } }, 500);

// ---------- boot ----------
(async () => {
  try {
    COURSE = await (await fetch("data/course.json")).json();
  } catch (e) {
    $app.innerHTML = `<div class="notice">Couldn't load the course data. Reload the page to try again.</div>`; return;
  }
  render();
  initRemote();
  if (engine.state === "idle") idbGet("models", MODEL_KEY).then(c => { if (c) getEngine().catch(() => {}); });
})();
