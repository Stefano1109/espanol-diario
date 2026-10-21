// Spanish pronunciation scoring engine (browser).
// Mirrors work/asr_core.py + work/scoring.py exactly.
// Model: NeMo FastConformer CTC (Spanish, int8) run with onnxruntime-web.

const SR = 16000, N_FFT = 512, WIN = 400, HOP = 160, N_MELS = 80, BLANK = 1024;
const PUNCT = new Set([",", ".", "?", "¿", "!", "¡", ";", ":", "'", '"', "-", "▁"]);
const MAX_SEGS = 24;

// ---------- features ----------
function hzToMel(f) {
  const fsp = 200 / 3, minLogHz = 1000, minLogMel = minLogHz / fsp, logstep = Math.log(6.4) / 27;
  return f >= minLogHz ? minLogMel + Math.log(f / minLogHz) / logstep : f / fsp;
}
function melToHz(m) {
  const fsp = 200 / 3, minLogHz = 1000, minLogMel = minLogHz / fsp, logstep = Math.log(6.4) / 27;
  return m >= minLogMel ? minLogHz * Math.exp(logstep * (m - minLogMel)) : fsp * m;
}
function buildMel() {
  const nb = N_FFT / 2 + 1;
  const fft = new Float64Array(nb);
  for (let i = 0; i < nb; i++) fft[i] = (SR / 2) * i / (nb - 1);
  const lo = hzToMel(0), hi = hzToMel(SR / 2);
  const melf = new Float64Array(N_MELS + 2);
  for (let i = 0; i < N_MELS + 2; i++) melf[i] = melToHz(lo + (hi - lo) * i / (N_MELS + 1));
  const W = [];
  for (let m = 0; m < N_MELS; m++) {
    const row = new Float32Array(nb);
    const enorm = 2 / (melf[m + 2] - melf[m]);
    const d0 = melf[m + 1] - melf[m], d1 = melf[m + 2] - melf[m + 1];
    for (let k = 0; k < nb; k++) {
      const lower = (fft[k] - melf[m]) / d0;
      const upper = (melf[m + 2] - fft[k]) / d1;
      row[k] = Math.max(0, Math.min(lower, upper)) * enorm;
    }
    // store sparse range for speed
    let s = 0; while (s < nb && row[s] === 0) s++;
    let e = nb - 1; while (e > s && row[e] === 0) e--;
    W.push({ s, e, w: row });
  }
  return W;
}
const MEL = buildMel();
const WINDOW = new Float32Array(WIN);
for (let i = 0; i < WIN; i++) WINDOW[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (WIN - 1));

// radix-2 FFT tables for N_FFT
const LOG2 = Math.log2(N_FFT);
const REV = new Uint16Array(N_FFT);
for (let i = 0; i < N_FFT; i++) { let r = 0, x = i; for (let b = 0; b < LOG2; b++) { r = (r << 1) | (x & 1); x >>= 1; } REV[i] = r; }
const COS = new Float64Array(N_FFT / 2), SIN = new Float64Array(N_FFT / 2);
for (let i = 0; i < N_FFT / 2; i++) { COS[i] = Math.cos(-2 * Math.PI * i / N_FFT); SIN[i] = Math.sin(-2 * Math.PI * i / N_FFT); }
function fftPower(frame, out) {
  const re = new Float64Array(N_FFT), im = new Float64Array(N_FFT);
  for (let i = 0; i < N_FFT; i++) re[REV[i]] = i < frame.length ? frame[i] : 0;
  for (let size = 2; size <= N_FFT; size <<= 1) {
    const half = size >> 1, step = N_FFT / size;
    for (let i = 0; i < N_FFT; i += size) {
      for (let j = 0; j < half; j++) {
        const k = j * step, a = i + j, b = a + half;
        const tr = re[b] * COS[k] - im[b] * SIN[k];
        const ti = re[b] * SIN[k] + im[b] * COS[k];
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
  for (let k = 0; k <= N_FFT / 2; k++) out[k] = re[k] * re[k] + im[k] * im[k];
}

export function features(samples) {
  let x = samples;
  if (x.length < WIN) { const p = new Float32Array(WIN); p.set(x); x = p; }
  const T = 1 + Math.floor((x.length - WIN) / HOP);
  const feat = new Float32Array(T * N_MELS); // [T][80]
  const frame = new Float64Array(WIN), pw = new Float64Array(N_FFT / 2 + 1);
  for (let t = 0; t < T; t++) {
    const off = t * HOP;
    for (let i = 0; i < WIN; i++) frame[i] = x[off + i];
    for (let i = WIN - 1; i >= 1; i--) frame[i] -= 0.97 * frame[i - 1];
    frame[0] -= 0.97 * frame[0];
    for (let i = 0; i < WIN; i++) frame[i] *= WINDOW[i];
    fftPower(frame, pw);
    for (let m = 0; m < N_MELS; m++) {
      const { s, e, w } = MEL[m];
      let acc = 0;
      for (let k = s; k <= e; k++) acc += pw[k] * w[k];
      feat[t * N_MELS + m] = Math.log(acc + Math.pow(2, -24));
    }
  }
  // per-feature normalisation (ddof=1)
  for (let m = 0; m < N_MELS; m++) {
    let mean = 0;
    for (let t = 0; t < T; t++) mean += feat[t * N_MELS + m];
    mean /= T;
    let v = 0;
    for (let t = 0; t < T; t++) { const d = feat[t * N_MELS + m] - mean; v += d * d; }
    const std = Math.sqrt(v / Math.max(1, T - 1)) + 1e-5;
    for (let t = 0; t < T; t++) feat[t * N_MELS + m] = (feat[t * N_MELS + m] - mean) / std;
  }
  return { data: feat, T };
}

// ---------- text helpers ----------
function stripAccents(s) {
  return s.normalize("NFD").replace(/[\u0300\u0301\u0308]/g, "").normalize("NFC");
}
function normPiece(tok) {
  if (tok === "<unk>" || tok === "<blk>") return null;
  let s = "";
  for (const c of tok.toLowerCase()) if (!PUNCT.has(c)) s += c;
  return stripAccents(s);
}
export function normText(s) {
  s = stripAccents(s.toLowerCase()).replace(/[^\p{L}\s]/gu, " ");
  return s.replace(/\s+/g, " ").trim();
}
function logAddExp(a, b) {
  if (a === -Infinity) return b;
  if (b === -Infinity) return a;
  const m = Math.max(a, b);
  return m + Math.log(Math.exp(a - m) + Math.exp(b - m));
}

// ---------- engine ----------
export class SpeechEngine {
  constructor(ort, tokens) {
    this.ort = ort;
    this.classes = []; this.classOf = new Map(); this.members = []; this.blankIds = [BLANK];
    tokens.forEach((tok, i) => {
      if (i === BLANK) return;
      const p = normPiece(tok);
      if (p === null) return;
      if (p === "") { this.blankIds.push(i); return; }
      if (!this.classOf.has(p)) { this.classOf.set(p, this.classes.length); this.classes.push(p); this.members.push([]); }
      this.members[this.classOf.get(p)].push(i);
    });
    this.tokens = tokens;
    this.maxLen = Math.max(...this.classes.map(c => c.length));
  }

  async load(modelBytes) {
    this.session = await this.ort.InferenceSession.create(modelBytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  }

  // transcript only (for open answers)
  async transcribe(samples16k) {
    return this.greedy(await this.logprobs(samples16k));
  }

  async logprobs(samples16k) {
    const { data, T } = features(samples16k);
    const inp = new Float32Array(N_MELS * T); // [1, 80, T]
    for (let t = 0; t < T; t++) for (let m = 0; m < N_MELS; m++) inp[m * T + t] = data[t * N_MELS + m];
    const feeds = {
      audio_signal: new this.ort.Tensor("float32", inp, [1, N_MELS, T]),
      length: new this.ort.Tensor("int64", BigInt64Array.from([BigInt(T)]), [1]),
    };
    const out = await this.session.run(feeds);
    const lp = out.logprobs;
    return { data: lp.data, T: lp.dims[1], V: lp.dims[2] };
  }

  greedy(lp) {
    let prev = -1, s = "";
    for (let t = 0; t < lp.T; t++) {
      let best = 0, bv = -Infinity;
      const o = t * lp.V;
      for (let v = 0; v < lp.V; v++) if (lp.data[o + v] > bv) { bv = lp.data[o + v]; best = v; }
      if (best !== prev && best !== BLANK) s += this.tokens[best];
      prev = best;
    }
    return s.replace(/▁/g, " ").trim();
  }

  classLogprobs(lp) {
    const C = this.classes.length, out = new Float64Array(lp.T * (C + 1));
    for (let t = 0; t < lp.T; t++) {
      const o = t * lp.V, q = t * (C + 1);
      for (let c = 0; c < C; c++) {
        const ids = this.members[c];
        let v = lp.data[o + ids[0]];
        for (let k = 1; k < ids.length; k++) v = logAddExp(v, lp.data[o + ids[k]]);
        out[q + c] = v;
      }
      let b = -Infinity;
      for (const id of this.blankIds) b = logAddExp(b, lp.data[o + id]);
      out[q + C] = b;
    }
    return { data: out, T: lp.T, W: C + 1, B: C };
  }

  segmentations(w) {
    const n = w.length, best = Array.from({ length: n + 1 }, () => []);
    best[0] = [[]];
    for (let i = 0; i < n; i++) {
      if (!best[i].length) continue;
      for (let L = 1; L <= Math.min(this.maxLen, n - i); L++) {
        const c = this.classOf.get(w.slice(i, i + L));
        if (c === undefined) continue;
        for (const seg of best[i]) best[i + L].push(seg.concat([c]));
        best[i + L].sort((a, b) => a.length - b.length);
        best[i + L].length = Math.min(best[i + L].length, MAX_SEGS);
      }
    }
    return best[n];
  }

  buildGraph(words) {
    const cls = [], wid = [], preds = [];
    let prevExits = [-1];
    words.forEach((w, wi) => {
      const segs = this.segmentations(w);
      if (!segs.length) return;
      const exits = [];
      for (const seg of segs) {
        let last = null;
        seg.forEach((c, k) => {
          const nid = cls.length;
          cls.push(c); wid.push(wi);
          preds.push(k === 0 ? prevExits.slice() : [last]);
          last = nid;
        });
        exits.push(last);
      }
      prevExits = exits;
    });
    return { cls, wid, preds, finals: prevExits };
  }

  align(clp, words) {
    const { cls, wid, preds, finals } = this.buildGraph(words);
    const N = cls.length, T = clp.T, W = clp.W, B = clp.B, D = clp.data;
    if (!N || finals.includes(-1)) return null;
    const NEG = -1e30, S = 1 + 2 * N;
    let dp = new Float64Array(S).fill(NEG);
    const back = new Int32Array(T * S);
    dp[0] = D[B];
    for (let n = 0; n < N; n++) if (preds[n].includes(-1)) dp[1 + 2 * n] = D[cls[n]];
    for (let t = 1; t < T; t++) {
      const nw = new Float64Array(S).fill(NEG), q = t * W, bo = t * S, eb = D[q + B];
      nw[0] = dp[0] + eb; back[bo] = 0;
      for (let n = 0; n < N; n++) {
        const ti = 1 + 2 * n, bi = 2 + 2 * n;
        let best = dp[ti], arg = ti;
        for (const p of preds[n]) {
          if (p === -1) { if (dp[0] > best) { best = dp[0]; arg = 0; } continue; }
          const pb = 2 + 2 * p, pt = 1 + 2 * p;
          if (dp[pb] > best) { best = dp[pb]; arg = pb; }
          if (cls[p] !== cls[n] && dp[pt] > best) { best = dp[pt]; arg = pt; }
        }
        nw[ti] = best + D[q + cls[n]]; back[bo + ti] = arg;
        if (dp[bi] >= dp[ti]) { nw[bi] = dp[bi] + eb; back[bo + bi] = bi; }
        else { nw[bi] = dp[ti] + eb; back[bo + bi] = ti; }
      }
      dp = nw;
    }
    let end = -1, endv = NEG;
    for (const f of finals) for (const s of [1 + 2 * f, 2 + 2 * f]) if (dp[s] > endv) { endv = dp[s]; end = s; }
    if (endv < -1e29) return null;
    const nodeFrames = new Map();
    let s = end;
    for (let t = T - 1; t >= 0; t--) {
      if (s % 2 === 1) { const n = (s - 1) / 2; if (!nodeFrames.has(n)) nodeFrames.set(n, []); nodeFrames.get(n).push(t); }
      s = back[t * S + s];
    }
    return [...nodeFrames.entries()].sort((a, b) => a[0] - b[0]).map(([n, fr]) => ({ c: cls[n], wi: wid[n], fr }));
  }

  scoreFromLogprobs(lp, text, refDur, strict = 3.0, refWords = null) {
    const words = normText(text).split(" ");
    const nw = words.length;
    const empty = { overall: 0, accuracy: 0, fluency: 0, completeness: 0, words: new Array(nw).fill(0), wordsText: words };
    const clp = this.classLogprobs(lp);
    const best = new Float64Array(clp.T);
    for (let t = 0; t < clp.T; t++) { let b = -Infinity; for (let c = 0; c < clp.W; c++) b = Math.max(b, clp.data[t * clp.W + c]); best[t] = b; }
    const al = this.align(clp, words);
    if (!al) return empty;
    const gop = Array.from({ length: nw }, () => []), span = Array.from({ length: nw }, () => [null, null]);
    for (const { c, wi, fr } of al) {
      let g = 0;
      for (const t of fr) g += clp.data[t * clp.W + c] - best[t];
      gop[wi].push(g / fr.length);
      const lo = Math.min(...fr), hi = Math.max(...fr);
      span[wi][0] = span[wi][0] === null ? lo : Math.min(span[wi][0], lo);
      span[wi][1] = span[wi][1] === null ? hi : Math.max(span[wi][1], hi);
    }
    const wordScores = gop.map((g, i) => {
      if (!g.length) return 0;
      const m = 0.5 * Math.min(...g) + 0.5 * g.reduce((a, b) => a + b, 0) / g.length;
      let sc = Math.round(100 * Math.exp(m / strict));
      // calibrate words the model finds hard even when a native voice says them
      const ref = refWords && refWords.length === nw ? refWords[i] : 100;
      if (ref < 90) sc = Math.min(100, Math.round(sc * 100 / Math.max(ref, 25)));
      return sc;
    });
    const accuracy = wordScores.reduce((a, b) => a + b, 0) / nw;
    const completeness = 100 * wordScores.filter(s => s >= 50).length / nw;
    const fdur = 0.08, spans = span.filter(s => s[0] !== null);
    const speech = (spans[spans.length - 1][1] - spans[0][0] + 1) * fdur;
    let fluency = 100;
    if (refDur) { const r = speech / refDur; if (r > 1.3) fluency -= Math.min(60, (r - 1.3) * 50); }
    let pauses = 0;
    for (let i = 1; i < spans.length; i++) if ((spans[i][0] - spans[i - 1][1]) * fdur > 0.6) pauses++;
    fluency = Math.max(0, fluency - 12 * pauses);
    let overall = 0.6 * accuracy + 0.2 * fluency + 0.2 * completeness;
    if (completeness < 30) overall = Math.min(overall, 20);
    if (Math.min(...wordScores) < 50) overall = Math.min(overall, 85);
    if (completeness < 50) overall = Math.min(overall, accuracy);
    return { overall: Math.round(overall), accuracy: Math.round(accuracy), fluency: Math.round(fluency),
             completeness: Math.round(completeness), words: wordScores, wordsText: words, speech };
  }

  async score(samples16k, text, refDur, strict, refWords) {
    const lp = await this.logprobs(samples16k);
    const r = this.scoreFromLogprobs(lp, text, refDur, strict, refWords);
    r.heard = this.greedy(lp);
    return r;
  }
}

// ---------- audio helpers ----------
export async function resampleTo16k(float32, sampleRate) {
  if (sampleRate === SR) return float32;
  const len = Math.max(1, Math.round(float32.length * SR / sampleRate));
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new Ctx(1, len, SR);
  const buf = ctx.createBuffer(1, float32.length, sampleRate);
  buf.copyToChannel ? buf.copyToChannel(float32, 0) : buf.getChannelData(0).set(float32);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.connect(ctx.destination); src.start();
  const out = await ctx.startRendering();
  return out.getChannelData(0).slice();
}

export function trimSilence(x, sr = SR) {
  // keep 0.3 s around detected speech; simple energy gate
  const win = Math.round(0.02 * sr);
  let maxE = 0; const es = [];
  for (let i = 0; i + win <= x.length; i += win) {
    let e = 0; for (let j = i; j < i + win; j++) e += x[j] * x[j];
    e /= win; es.push(e); if (e > maxE) maxE = e;
  }
  const thr = Math.max(maxE * 0.01, 1e-6);
  let a = es.findIndex(e => e > thr), b = es.length - 1;
  while (b > 0 && es[b] <= thr) b--;
  if (a < 0) return x;
  const pad = Math.round(0.3 * sr / win);
  a = Math.max(0, a - pad); b = Math.min(es.length - 1, b + pad);
  return x.slice(a * win, (b + 1) * win);
}

export function encodeWav(x, sr = SR) {
  const buf = new ArrayBuffer(44 + x.length * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + x.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 0x7fff, true);
  return new Blob([buf], { type: "audio/wav" });
}

// Microphone recorder: AudioWorklet when available, ScriptProcessor otherwise.
export class MicRecorder {
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.chunks = [];
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.mode = "script";
    if (this.ctx.audioWorklet && window.AudioWorkletNode) {
      try {
        const code = `class R extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor('rec-proc',R);`;
        const url = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
        await this.ctx.audioWorklet.addModule(url);
        this.node = new AudioWorkletNode(this.ctx, "rec-proc");
        this.node.port.onmessage = e => this.chunks.push(e.data);
        src.connect(this.node);
        this.mode = "worklet";
      } catch (e) { this.node = null; }
    }
    if (!this.node) {
      this.node = this.ctx.createScriptProcessor(4096, 1, 1);
      this.node.onaudioprocess = e => this.chunks.push(e.inputBuffer.getChannelData(0).slice(0));
      src.connect(this.node);
      this.node.connect(this.ctx.destination);
    }
    this.src = src;
  }
  async stop() {
    const sr = this.ctx.sampleRate;
    try { this.src.disconnect(); this.node.disconnect(); } catch (e) {}
    this.stream.getTracks().forEach(t => t.stop());
    await this.ctx.close();
    let n = 0; for (const c of this.chunks) n += c.length;
    const all = new Float32Array(n); let o = 0;
    for (const c of this.chunks) { all.set(c, o); o += c.length; }
    return { samples: all, sampleRate: sr, mode: this.mode };
  }
}
