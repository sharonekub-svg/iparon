import { Graph, typeColor } from './graph.js';

/* ── כוונון: הסף שכדאי לשחק איתו ─────────────────────────────────── */
const SILENCE_MS      = 900;   // כמה שקט מסיים תור. זה המספר לכוונן.
const SILENCE_LEVEL   = 0.045; // מתחת לזה נחשב שקט (0..1)
const MIN_SPEECH_MS   = 350;   // קצר מזה — לא שולחים בכלל
const MAX_TURN_MS     = 30000; // תקרת בטיחות לתור אחד
const LEVEL_TICK_MS   = 50;    // קצב דגימת המפלס

const EXAMPLES = [
  'תמצא לי רעיון לאתר עם מעט תחרות בישראל',
  'מה כתוב אצלי על חסם כניסה?',
  'כמה עולה להריץ אתר כזה בחודש?',
  'מי כתב לי ולא עניתי?',
  'מה כדאי לי לעשות היום?',
  'תזכור שאני מעדיף לעבוד בערב',
  'מה מתחרה למחשבון בגרויות?',
];

const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* ── מצב ──────────────────────────────────────────────────────────── */
const S = {
  graph: null,
  status: null,
  muted: false,
  busy: false,
  listening: false,
  speaking: false,
  hiddenTypes: new Set(),
  audio: null,          // ה-<audio> המנגן כרגע
  media: null,          // MediaRecorder
  stream: null,
  actx: null,
  analyser: null,
  levelTimer: null,
  turnStart: 0,
  lastLoud: 0,
  liveBubble: null,
};

/* ── שגיאות: תמיד על המסך, אף פעם לא בשקט ────────────────────────── */
function shout(title, body) {
  const t = el('div', 'toast');
  t.appendChild(el('b', null, title));
  t.appendChild(document.createTextNode(body || ''));
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 9000);
  console.error(title, body);
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  const ctype = res.headers.get('content-type') || '';
  if (!res.ok) {
    let msg = res.statusText;
    if (ctype.includes('json')) {
      try { msg = (await res.json()).error || msg; } catch (_) {}
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return ctype.includes('json') ? res.json() : res.blob();
}

/* ── ריאקטור ──────────────────────────────────────────────────────── */
const REACTOR_LABEL = {
  idle: 'ממתין', listening: 'מקשיב', thinking: 'חושב',
  speaking: 'מדבר', error: 'תקלה',
};
let reactorState = 'idle';
let reactorLevel = 0;

function setReactor(state) {
  reactorState = state;
  const box = $('#reactor');
  box.className = state;
  $('#reactor-state').textContent = REACTOR_LABEL[state] || state;
}

function drawReactor(now) {
  const cv = $('#reactor-canvas');
  const ctx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (cv.width !== 148 * dpr) {
    cv.width = 148 * dpr; cv.height = 148 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const c = 74, t = now / 1000;
  ctx.clearRect(0, 0, 148, 148);

  const color = { idle: '#4d5761', listening: '#4fd3e4', thinking: '#9d8bf0',
                  speaking: '#6fcf8f', error: '#e46b6b' }[reactorState];

  // טבעת חיצונית מסתובבת
  ctx.strokeStyle = color; ctx.globalAlpha = 0.22; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(c, c, 62, 0, Math.PI * 2); ctx.stroke();

  const speed = reactorState === 'thinking' ? 1.5 : 0.42;
  ctx.globalAlpha = 0.85; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c, c, 62, t * speed, t * speed + Math.PI * 0.42);
  ctx.stroke();

  // טבעת פנימית שנושמת עם המפלס
  const pulse = reactorState === 'listening'
    ? 38 + reactorLevel * 20
    : 38 + Math.sin(t * (reactorState === 'speaking' ? 6 : 1.6)) * 3.5;
  ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(c, c, pulse, 0, Math.PI * 2); ctx.stroke();

  // ליבה
  const coreR = 12 + (reactorState === 'listening' ? reactorLevel * 12 : 0);
  const grd = ctx.createRadialGradient(c, c, 0, c, c, coreR + 16);
  grd.addColorStop(0, color);
  grd.addColorStop(1, 'transparent');
  ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.arc(c, c, coreR + 16, 0, Math.PI * 2);
  ctx.fillStyle = grd; ctx.fill();

  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(c, c, coreR, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();

  requestAnimationFrame(drawReactor);
}

/* ── תמלול ושיחה על המסך ──────────────────────────────────────────── */
function bubble(kind, text) {
  const b = el('div', 'turn ' + kind, text);
  $('#transcript').appendChild(b);
  $('#transcript').scrollTop = 1e9;
  return b;
}

function renderCard(card) {
  const box = el('div', 'card' + (card.kind === 'error' ? ' error' : ''));
  box.appendChild(el('b', null, card.title || card.kind));

  if (card.kind === 'search') {
    if (!card.results.length) {
      box.appendChild(el('div', 'card-row', 'אין קבצים תואמים.'));
    }
    for (const r of card.results) {
      const row = el('div', 'card-row');
      row.appendChild(el('div', 'src', r.file));
      row.appendChild(el('div', null, r.title));
      if (r.excerpt) row.appendChild(el('div', 'ex', r.excerpt));
      if (r.confidence < 0.6) {
        row.appendChild(el('div', 'ex', '⚠ חילוץ הטקסט מהקובץ הזה לא אמין.'));
      }
      row.style.cursor = 'pointer';
      row.onclick = () => S.graph.focusNode(r.id);
      box.appendChild(row);
    }
  } else if (card.kind === 'web') {
    for (const r of card.results) {
      const row = el('div', 'card-row');
      const a = el('a', null, r.title || r.url);
      a.href = r.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      row.appendChild(a);
      if (r.snippet) row.appendChild(el('div', 'ex', r.snippet));
      box.appendChild(row);
    }
  } else if (card.kind === 'inbox') {
    for (const m of card.messages) {
      const row = el('div', 'card-row');
      const head = el('div');
      head.appendChild(document.createTextNode(m.from));
      head.appendChild(el('span', m.known ? 'tag-known' : 'tag-new',
        m.known ? 'מוכר' : 'חדש'));
      row.appendChild(head);
      row.appendChild(el('div', 'ex', m.subject));
      if (m.known) row.appendChild(el('div', 'src', m.known_files.join(', ')));
      box.appendChild(row);
    }
  } else if (card.kind === 'brief') {
    if (card.warning) box.appendChild(el('div', 'card-row', '⚠ ' + card.warning));
    for (const e of card.events) {
      box.appendChild(el('div', 'card-row', `${e.time} · ${e.title} — ${e.note}`));
    }
    for (const u of card.unread) {
      box.appendChild(el('div', 'card-row', `לא נקרא: ${u.from} — ${u.subject}`));
    }
    for (const s of card.slipped) {
      box.appendChild(el('div', 'card-row', 'נדחה: ' + s));
    }
  } else if (card.kind === 'memory') {
    const row = el('div', 'card-row');
    row.appendChild(el('div', 'src', card.file));
    row.appendChild(el('div', null, card.fact));
    box.appendChild(row);
  } else if (card.kind === 'plan') {
    for (const b of card.based_on) box.appendChild(el('div', 'card-row', b));
  } else {
    box.appendChild(el('div', 'card-row', card.body || ''));
  }
  return box;
}

function showReply(res) {
  const b = bubble('jarvis', res.text);

  if (res.degraded) {
    const note = { no_model: 'ניתוב ללא מודל', spend_cap: 'תקרת הוצאה',
                   model_error: 'המודל נכשל' }[res.degraded] || res.degraded;
    b.appendChild(el('div', 'turn-tools', '⚠ ' + note));
  } else if (res.tools_used && res.tools_used.length) {
    const bits = res.tools_used.join(' · ');
    const cost = res.searches ? `  ·  ${res.searches} חיפושים` : '';
    b.appendChild(el('div', 'turn-tools', bits + cost));
  }

  for (const card of res.cards || []) b.appendChild(renderCard(card));
  $('#transcript').scrollTop = 1e9;

  if (res.spend) paintSpend(res.spend);
  if (!S.muted && res.text) speak(res.text);
}

/* ── שליחה ────────────────────────────────────────────────────────── */
async function send(text) {
  text = (text || '').trim();
  if (!text || S.busy) return;
  S.busy = true;
  bubble('me', text);
  setReactor('thinking');
  try {
    const res = await api('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    showReply(res);
  } catch (err) {
    shout('השרת לא ענה', err.message);
    bubble('jarvis', 'לא הצלחתי לענות. ' + err.message);
    setReactor('error');
  } finally {
    S.busy = false;
    if (reactorState === 'thinking') setReactor('idle');
  }
}

async function runTool(name, args) {
  if (S.busy) return;
  S.busy = true;
  setReactor('thinking');
  try {
    const res = await api('/api/tool', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, args: args || {} }),
    });
    showReply(res);
  } catch (err) {
    shout('הכלי נכשל', err.message);
  } finally {
    S.busy = false;
    if (reactorState === 'thinking') setReactor('idle');
  }
}

/* ── דיבור החוצה ──────────────────────────────────────────────────── */
async function speak(text) {
  if (S.muted) return;
  if (!S.status?.voice?.available) return;   // אין קול — הודענו כבר בשורת המצב
  try {
    const blob = await api('/api/speak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    stopSpeaking();

    // המיקרופון מתחרש בזמן דיבור, אחרת הוא מתמלל את עצמו דרך הרמקולים
    // ומדבר עם עצמו לנצח.
    const wasListening = S.listening;
    if (wasListening) pauseListening();

    const audio = new Audio(URL.createObjectURL(blob));
    S.audio = audio;
    S.speaking = true;
    setReactor('speaking');

    const done = () => {
      URL.revokeObjectURL(audio.src);
      S.speaking = false;
      S.audio = null;
      if (wasListening && S.listening) resumeListening();
      else setReactor(S.listening ? 'listening' : 'idle');
    };
    audio.onended = done;
    audio.onerror = () => { shout('הנגן נכשל', 'לא הצלחתי לנגן את התשובה.'); done(); };
    await audio.play();
  } catch (err) {
    shout('הדיבור נכשל', err.message);
    S.speaking = false;
    setReactor('idle');
  }
}

function stopSpeaking() {
  if (S.audio) {
    S.audio.pause();
    S.audio.onended = null;
    URL.revokeObjectURL(S.audio.src);
    S.audio = null;
  }
  S.speaking = false;
}

/* ── האזנה ────────────────────────────────────────────────────────── */
async function startListening() {
  if (S.listening) return;
  if (!S.status?.voice?.available) {
    shout('אין תמלול', S.status?.voice?.reason || 'ElevenLabs לא מוגדר.');
    return;
  }
  try {
    S.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    // החסימה השקטה של המיקרופון היא התקלה הכי מבלבלת בכל הבניין הזה.
    shout('המיקרופון חסום',
      'הדפדפן לא נתן גישה. פתח את הגדרות האתר ואשר מיקרופון. (' + err.name + ')');
    setReactor('error');
    return;
  }

  S.actx = new (window.AudioContext || window.webkitAudioContext)();
  const src = S.actx.createMediaStreamSource(S.stream);
  S.analyser = S.actx.createAnalyser();
  S.analyser.fftSize = 1024;
  src.connect(S.analyser);

  S.listening = true;
  $('#mic').classList.add('on');
  setReactor('listening');
  beginTurn();

  // setInterval ולא requestAnimationFrame: RAF נעצר לגמרי בטאב ברקע,
  // והמיקרופון היה מתחרש בלי שום סימן.
  S.levelTimer = setInterval(levelTick, LEVEL_TICK_MS);
}

function beginTurn() {
  if (!S.stream || !S.listening) return;
  const chunks = [];
  let mime = 'audio/webm';
  for (const c of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported(c)) { mime = c; break; }
  }
  const rec = new MediaRecorder(S.stream, { mimeType: mime });
  S.media = rec;
  S.turnStart = performance.now();
  S.lastLoud = performance.now();

  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = async () => {
    const spoke = performance.now() - S.turnStart;
    clearLive();
    if (spoke < MIN_SPEECH_MS || !chunks.length) {
      if (S.listening) beginTurn();
      return;
    }
    const blob = new Blob(chunks, { type: mime });
    await transcribeAndSend(blob, mime);
    if (S.listening && !S.speaking) beginTurn();
  };
  rec.start();
}

function levelTick() {
  if (!S.analyser) return;
  const buf = new Uint8Array(S.analyser.fftSize);
  S.analyser.getByteTimeDomainData(buf);

  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  const level = Math.min(1, Math.sqrt(sum / buf.length) * 4.2);
  reactorLevel = level;
  paintBars(level);

  if (!S.media || S.media.state !== 'recording') return;

  const now = performance.now();
  const elapsed = now - S.turnStart;
  if (level > SILENCE_LEVEL) {
    S.lastLoud = now;
    showLive(elapsed);
  }

  const quiet = now - S.lastLoud;
  if ((quiet > SILENCE_MS && elapsed > MIN_SPEECH_MS) || elapsed > MAX_TURN_MS) {
    S.media.stop();
  }
}

function showLive(ms) {
  if (!S.liveBubble) S.liveBubble = bubble('me live', '');
  S.liveBubble.textContent = `שומע… ${(ms / 1000).toFixed(1)} שניות`;
}

function clearLive() {
  if (S.liveBubble) { S.liveBubble.remove(); S.liveBubble = null; }
}

async function transcribeAndSend(blob, mime) {
  setReactor('thinking');
  try {
    const res = await api('/api/listen', {
      method: 'POST',
      headers: { 'content-type': mime },
      body: blob,
    });
    if (res.text) await send(res.text);
  } catch (err) {
    if (err.status === 503) shout('התמלול לא זמין', err.message);
    else shout('התמלול נכשל', err.message);
    setReactor(S.listening ? 'listening' : 'error');
  }
}

function pauseListening() {
  if (S.media && S.media.state === 'recording') {
    S.media.ondataavailable = null;
    S.media.onstop = null;
    S.media.stop();
  }
  S.media = null;
  clearLive();
  paintBars(0);
}

function resumeListening() {
  setReactor('listening');
  beginTurn();
}

function stopListening() {
  S.listening = false;
  pauseListening();
  if (S.levelTimer) { clearInterval(S.levelTimer); S.levelTimer = null; }
  if (S.stream) { S.stream.getTracks().forEach((t) => t.stop()); S.stream = null; }
  if (S.actx) { S.actx.close().catch(() => {}); S.actx = null; }
  S.analyser = null;
  reactorLevel = 0;
  paintBars(0);
  $('#mic').classList.remove('on');
  setReactor('idle');
}

/* קטיעה מפורשת — כפתור המיקרופון, רווח, או Esc */
function bargeIn() {
  stopSpeaking();
  if (S.listening) resumeListening();
  else setReactor('idle');
}

function paintBars(level) {
  const bars = $('#bars').children;
  for (let i = 0; i < bars.length; i++) {
    const weight = 1 - Math.abs(i - (bars.length - 1) / 2) / bars.length;
    const h = 3 + level * 19 * (0.45 + weight);
    bars[i].style.height = h.toFixed(1) + 'px';
    bars[i].style.opacity = (0.3 + level * 0.7).toFixed(2);
  }
}

/* ── לוחות ────────────────────────────────────────────────────────── */
function paintStatus(st) {
  S.status = st;
  const row = $('#status');
  row.textContent = '';

  const add = (text, cls) => row.appendChild(el('div', 'badge ' + (cls || ''), text));

  add(st.vault.demo ? 'דמו' : 'נתונים אמיתיים', st.vault.demo ? '' : 'warn');
  add(`${st.vault.notes} קבצים · ${st.vault.edges} קשרים`);

  if (st.model.available) add('מודל: ' + st.model.model, 'ok');
  else add('אין מודל — ניתוב לפי מילים', 'bad');

  add(st.search_mode === 'anthropic' ? 'חיפוש: Anthropic' : 'חיפוש: חינם', '');

  if (st.voice.available) add('קול: ElevenLabs', 'ok');
  else add('אין קול', 'bad');

  if (st.vault.warning) add('⚠ ' + st.vault.warning, 'bad');
  paintSpend(st.spend);
}

function paintSpend(spend) {
  if (!spend) return;
  const b = $('#spend');
  b.textContent = `${spend.total_usd.toFixed(3)}$ / ${spend.cap_usd.toFixed(2)}$`;
  b.className = 'badge ' + (spend.blocked ? 'bad'
    : spend.total_usd > spend.cap_usd * 0.7 ? 'warn' : '');
}

function paintFilters(counts) {
  const box = $('#filters-list');
  box.textContent = '';
  const types = Object.keys(counts);
  for (const [type, n] of Object.entries(counts)) {
    const row = el('div', 'filter');
    const dot = el('span', 'filter-dot');
    dot.style.background = typeColor(type, types);
    dot.style.color = typeColor(type, types);
    row.appendChild(dot);
    row.appendChild(el('span', 'filter-name', type));
    row.appendChild(el('span', 'filter-n', String(n)));
    row.onclick = () => {
      if (S.hiddenTypes.has(type)) S.hiddenTypes.delete(type);
      else S.hiddenTypes.add(type);
      row.classList.toggle('off', S.hiddenTypes.has(type));
      S.graph.setHidden(S.hiddenTypes);
    };
    box.appendChild(row);
  }
}

function paintHubs(hubs) {
  const box = $('#hubs-list');
  box.textContent = '';
  for (const h of hubs) {
    const row = el('div', 'hub');
    row.appendChild(el('span', 'hub-n', String(h.degree)));
    row.appendChild(el('span', 'hub-t', h.title));
    row.onclick = () => S.graph.focusNode(h.id);
    box.appendChild(row);
  }
}

async function paintInspector(node) {
  const box = $('#inspector-body');
  box.textContent = '';
  let note;
  try {
    note = await api('/api/note?id=' + encodeURIComponent(node.id));
  } catch (err) {
    box.appendChild(el('div', 'empty', 'לא הצלחתי לטעון את ההערה.'));
    return;
  }

  const badge = el('span', 'note-type', note.type);
  badge.style.color = typeColor(note.type, Object.keys(S.status?.vault?.counts || {}));
  box.appendChild(badge);
  box.appendChild(el('h3', 'note-title', note.title));
  box.appendChild(el('div', 'note-meta', `${note.file} · ${note.date} · ${note.degree} קשרים`));

  if (note.confidence < 0.6) {
    box.appendChild(el('div', 'empty',
      '⚠ חילוץ הטקסט מהקובץ הזה לא אמין. אל תסמוך על הציטוטים ממנו.'));
  }
  // הכותרת כבר מופיעה למעלה — לא חוזרים עליה מתוך גוף ההערה
  const body = (note.body || '').replace(/^\s*#\s+.*\n+/, '').trim();
  box.appendChild(el('div', 'note-body', body || '(אין טקסט קריא בקובץ)'));

  if (note.neighbours.length) {
    const links = el('div', 'note-links');
    links.appendChild(el('b', null, 'מקושר ל'));
    for (const nid of note.neighbours) {
      const c = el('span', 'chip', nid);
      c.onclick = () => S.graph.focusNode(nid);
      links.appendChild(c);
    }
    box.appendChild(links);
  }
}

/* ── אתחול ────────────────────────────────────────────────────────── */
async function boot() {
  for (let i = 0; i < 13; i++) $('#bars').appendChild(el('i'));
  requestAnimationFrame(drawReactor);
  setReactor('idle');

  S.graph = new Graph($('#graph'));
  window.jarvis = S;   // לניפוי באגים מהקונסולה: jarvis.graph, jarvis.status
  S.graph.onFocus = (n) => paintInspector(n);
  S.graph.onPath = async (a, b) => {
    try {
      const res = await api(`/api/path?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
      if (!res.path.length) { shout('אין מסלול', 'שתי ההערות לא מחוברות.'); return; }
      S.graph.showPath(res.path);
      bubble('jarvis', `מסלול באורך ${res.path.length - 1} קשתות: ` +
        res.path.map((id) => S.graph.byId.get(id)?.title || id).join(' ← '));
    } catch (err) { shout('חישוב המסלול נכשל', err.message); }
  };

  try {
    const st = await api('/api/status');
    paintStatus(st);
    paintFilters(st.vault.counts);
    paintHubs(st.vault.hubs);
    if (!st.model.available) {
      shout('אין מודל שפה',
        st.model.reason + ' התשובות הן ניתוב לפי מילים, לא הבנה.');
    }
    if (!st.voice.available) {
      shout('אין קול', st.voice.reason);
    }
    if (st.vault.warning) shout('בעיה בנתונים', st.vault.warning);
  } catch (err) {
    shout('השרת לא זמין', err.message);
  }

  try {
    S.graph.load(await api('/api/graph'));
  } catch (err) {
    shout('טעינת הגרף נכשלה', err.message);
  }

  // ── קלט ──
  const ask = $('#ask');
  ask.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      const v = ask.value;
      ask.value = '';
      send(v);
    }
  });

  $('#mic').onclick = () => {
    if (S.speaking) { bargeIn(); return; }   // לחיצה בזמן דיבור = קטיעה
    if (S.listening) stopListening();
    else startListening();
  };

  $('#mute').onclick = () => {
    S.muted = !S.muted;
    $('#mute').classList.toggle('on', S.muted);
    $('#mute').textContent = S.muted ? 'מושתק' : 'קול';
    if (S.muted) stopSpeaking();
  };

  $('#brief').onclick = () => runTool('brief_me', {});
  $('#plan').onclick = () => runTool('plan_day', {});
  $('#mem').onclick = async () => {
    try {
      const res = await api('/api/memory');
      const b = bubble('jarvis', res.items.length
        ? `${res.items.length} עובדות בזיכרון.`
        : 'הזיכרון ריק. אמור לי "תזכור ש…" ואשמור.');
      if (res.items.length) {
        b.appendChild(renderCard({
          kind: 'memory-list', title: 'זיכרון',
          body: res.items.map((i) => `${i.date} · ${i.fact}`).join('\n'),
        }));
      }
    } catch (err) { shout('הזיכרון לא נטען', err.message); }
  };

  window.addEventListener('keydown', (ev) => {
    if (ev.target.tagName === 'INPUT') return;
    if (ev.code === 'Space') { ev.preventDefault(); bargeIn(); }
    if (ev.code === 'Escape') { stopSpeaking(); stopListening(); }
  });

  // דוגמה מתחלפת
  let ei = 0;
  const rotate = () => {
    if (document.activeElement !== ask && !ask.value) {
      ask.placeholder = EXAMPLES[ei++ % EXAMPLES.length];
    }
  };
  rotate();
  setInterval(rotate, 4600);
}

boot();
