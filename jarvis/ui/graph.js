/* הגרף.
 *
 * קנבס ולא SVG: SVG דורש צומת DOM לכל אלמנט ונתקע סביב 1500 צמתים.
 * הדחייה בין צמתים משתמשת ברשת מרחבית עם מרחק ניתוק, כך שהעלות
 * נשארת כמעט לינארית במקום ריבועית.
 */

const TYPE_COLOR = {
  'רעיון': '#4fd3e4', 'מחקר': '#9d8bf0', 'מתחרה': '#e8b04b',
  'כסף': '#ef7d90', 'לימוד': '#6fcf8f', 'אישי': '#8894a3',
};
const FALLBACK_COLORS = ['#4fd3e4', '#9d8bf0', '#e8b04b', '#ef7d90', '#6fcf8f', '#8894a3'];

const REPULSION      = 4200;   // עוצמת הדחייה
const CUTOFF         = 190;    // מעבר למרחק הזה לא מחשבים דחייה בכלל
const CELL           = CUTOFF; // גודל תא ברשת המרחבית
const SPRING         = 0.0092; // משיכה לאורך קשת
const REST_LEN       = 108;
const CENTER_PULL    = 0.0016;
const DAMPING        = 0.86;
const ALPHA_FLOOR    = 0.028;  // לא יורד לאפס — הגרף ממשיך לנשום
const PULSE_EVERY_MS = 3400;

export function typeColor(type, allTypes) {
  if (TYPE_COLOR[type]) return TYPE_COLOR[type];
  const i = Math.max(0, (allTypes || []).indexOf(type));
  return FALLBACK_COLORS[i % FALLBACK_COLORS.length];
}

export class Graph {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.nodes = [];
    this.edges = [];
    this.byId = new Map();
    this.types = [];

    this.scale = 1;
    this.ox = 0;
    this.oy = 0;
    this.alpha = 1;

    this.hover = null;
    this.focus = null;
    this.pathSet = new Set();
    this.pathNodes = [];
    this.hidden = new Set();

    this.pulses = [];
    this.lastPulse = 0;

    this.onFocus = () => {};
    this.onPath = () => {};

    this._drag = null;
    this._dragNode = null;
    this._labelBoxes = [];

    this._bind();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    requestAnimationFrame((t) => this._frame(t));
  }

  // ── נתונים ──────────────────────────────────────────────────────
  load(data) {
    const w = this.cv.clientWidth || 1200;
    const h = this.cv.clientHeight || 800;
    this.types = Object.keys(data.counts || {});

    // פריסה התחלתית על מעגל -> מתייצב מהר ובאותה צורה בכל טעינה
    this.nodes = data.nodes.map((n, i) => {
      const a = (i / Math.max(data.nodes.length, 1)) * Math.PI * 2;
      const r = 150 + (i % 7) * 26;
      return {
        ...n,
        x: w / 2 + Math.cos(a) * r,
        y: h / 2 + Math.sin(a) * r,
        vx: 0, vy: 0,
        radius: 4.5 + Math.sqrt(n.degree || 0) * 3.1,
        color: typeColor(n.type, this.types),
      };
    });

    this.byId = new Map(this.nodes.map((n) => [n.id, n]));
    this.edges = data.edges
      .map((e) => ({ a: this.byId.get(e.source), b: this.byId.get(e.target) }))
      .filter((e) => e.a && e.b);

    this.alpha = 1;
    this.focus = null;
    this.pathSet.clear();
    this.pathNodes = [];
  }

  setHidden(types) { this.hidden = new Set(types); }

  visible(n) { return !this.hidden.has(n.type); }

  focusNode(id) {
    const n = this.byId.get(id);
    if (!n) return;
    this.focus = n;
    this.pathSet.clear();
    this.pathNodes = [];
    this.alpha = Math.max(this.alpha, 0.2);
    this.onFocus(n);
  }

  showPath(ids) {
    this.pathNodes = ids;
    this.pathSet = new Set(ids);
  }

  // ── פיזיקה ──────────────────────────────────────────────────────
  _step() {
    const nodes = this.nodes;
    if (!nodes.length) return;

    // רשת מרחבית: כל צומת נכנס לתא, ובודקים רק תאים שכנים.
    const grid = new Map();
    const key = (cx, cy) => cx + ',' + cy;
    for (const n of nodes) {
      const k = key(Math.floor(n.x / CELL), Math.floor(n.y / CELL));
      let bucket = grid.get(k);
      if (!bucket) grid.set(k, (bucket = []));
      bucket.push(n);
    }

    for (const n of nodes) {
      let fx = 0, fy = 0;
      const cx = Math.floor(n.x / CELL);
      const cy = Math.floor(n.y / CELL);

      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const bucket = grid.get(key(gx, gy));
          if (!bucket) continue;
          for (const m of bucket) {
            if (m === n) continue;
            let dx = n.x - m.x, dy = n.y - m.y;
            let d2 = dx * dx + dy * dy;
            if (d2 > CUTOFF * CUTOFF) continue;
            if (d2 < 1) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); d2 = 1; }
            const f = REPULSION / d2;
            const d = Math.sqrt(d2);
            fx += (dx / d) * f;
            fy += (dy / d) * f;
          }
        }
      }
      n.vx += fx * this.alpha;
      n.vy += fy * this.alpha;
    }

    for (const e of this.edges) {
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (d - REST_LEN) * SPRING * this.alpha;
      const ux = (dx / d) * f, uy = (dy / d) * f;
      e.a.vx += ux; e.a.vy += uy;
      e.b.vx -= ux; e.b.vy -= uy;
    }

    const cxr = this.cv.clientWidth / 2, cyr = this.cv.clientHeight / 2;
    for (const n of nodes) {
      if (n === this._dragNode) { n.vx = n.vy = 0; continue; }
      n.vx += (cxr - n.x) * CENTER_PULL * this.alpha;
      n.vy += (cyr - n.y) * CENTER_PULL * this.alpha;
      n.vx *= DAMPING; n.vy *= DAMPING;
      n.x += n.vx; n.y += n.vy;
    }

    // מתקרר עד רצפה — לא נעצר לגמרי, ממשיך לנשום
    if (this.alpha > ALPHA_FLOOR) this.alpha = Math.max(ALPHA_FLOOR, this.alpha * 0.982);
  }

  // ── ציור ────────────────────────────────────────────────────────
  _frame(now) {
    this._step();
    this._pulseTick(now);
    this._draw(now);
    requestAnimationFrame((t) => this._frame(t));
  }

  _pulseTick(now) {
    if (this.edges.length && now - this.lastPulse > PULSE_EVERY_MS) {
      this.lastPulse = now;
      const e = this.edges[(Math.random() * this.edges.length) | 0];
      if (this.visible(e.a) && this.visible(e.b)) {
        this.pulses.push({ e, t: 0 });
      }
    }
    for (const p of this.pulses) p.t += 0.011;
    this.pulses = this.pulses.filter((p) => p.t < 1);
  }

  _draw(now) {
    const ctx = this.ctx;
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.scale, this.scale);

    const lit = this._litSet();

    // קשתות
    for (const e of this.edges) {
      if (!this.visible(e.a) || !this.visible(e.b)) continue;
      const onPath = this.pathSet.has(e.a.id) && this.pathSet.has(e.b.id)
        && this._adjacentOnPath(e.a.id, e.b.id);
      const isLit = lit && (lit.has(e.a.id) && lit.has(e.b.id));

      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
      if (onPath) {
        ctx.strokeStyle = '#4fd3e4';
        ctx.lineWidth = 2 / this.scale;
        ctx.globalAlpha = 0.95;
      } else if (isLit) {
        ctx.strokeStyle = '#4fd3e4';
        ctx.lineWidth = 1.3 / this.scale;
        ctx.globalAlpha = 0.6;
      } else {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 / this.scale;
        ctx.globalAlpha = lit ? 0.03 : 0.085;
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // פעימות
    for (const p of this.pulses) {
      const { a, b } = p.e;
      const t = p.t;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const fade = Math.sin(t * Math.PI);
      ctx.beginPath();
      ctx.arc(x, y, 2.2 / this.scale, 0, Math.PI * 2);
      ctx.fillStyle = '#4fd3e4';
      ctx.globalAlpha = fade * 0.75;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // צמתים
    for (const n of this.nodes) {
      if (!this.visible(n)) continue;
      const dim = lit && !lit.has(n.id);
      const isHover = n === this.hover;
      const isFocus = n === this.focus;
      const r = n.radius * (isHover ? 1.5 : 1);

      ctx.globalAlpha = dim ? 0.1 : 1;

      if ((isHover || isFocus) && !dim) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 7 / this.scale, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = 0.13;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.fill();

      if (isFocus || this.pathSet.has(n.id)) {
        ctx.lineWidth = 1.6 / this.scale;
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.85;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    this._drawLabels(lit);
    ctx.restore();
  }

  /* תוויות: מציירים את המקושרים ביותר ראשונים, ומדלגים על כל תווית
   * שהתיבה שלה מתנגשת בתיבה שכבר הונחה. בלי זה אשכול הרכזות הופך למרק. */
  _drawLabels(lit) {
    const ctx = this.ctx;
    this._labelBoxes.length = 0;
    const size = 11.5 / this.scale;
    ctx.font = `500 ${size}px -apple-system, Rubik, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const ordered = this.nodes
      .filter((n) => this.visible(n))
      .sort((a, b) => (b.degree - a.degree) || a.title.localeCompare(b.title));

    for (const n of ordered) {
      const dim = lit && !lit.has(n.id);
      const forced = n === this.hover || n === this.focus || this.pathSet.has(n.id);
      if (dim && !forced) continue;
      // מתחת לסף זום התוויות של הצמתים הקטנים רק מלכלכות
      if (!forced && this.scale < 0.62 && n.degree < 3) continue;

      const label = n.title.length > 26 ? n.title.slice(0, 25) + '…' : n.title;
      const wpx = ctx.measureText(label).width;
      const x = n.x, y = n.y + n.radius + 5 / this.scale;
      const box = { x0: x - wpx / 2 - 2, y0: y - 1, x1: x + wpx / 2 + 2, y1: y + size + 1 };

      if (!forced && this._collides(box)) continue;
      this._labelBoxes.push(box);

      ctx.globalAlpha = forced ? 1 : 0.62;
      ctx.fillStyle = forced ? '#eaf2f8' : '#93a0ad';
      ctx.fillText(label, x, y);
    }
    ctx.globalAlpha = 1;
  }

  _collides(b) {
    for (const o of this._labelBoxes) {
      if (b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0) return true;
    }
    return false;
  }

  _litSet() {
    const anchor = this.hover || this.focus;
    if (this.pathSet.size) return this.pathSet;
    if (!anchor) return null;
    const set = new Set([anchor.id]);
    for (const e of this.edges) {
      if (e.a === anchor) set.add(e.b.id);
      if (e.b === anchor) set.add(e.a.id);
    }
    return set;
  }

  _adjacentOnPath(a, b) {
    const i = this.pathNodes.indexOf(a);
    const j = this.pathNodes.indexOf(b);
    return i >= 0 && j >= 0 && Math.abs(i - j) === 1;
  }

  // ── אינטראקציה ──────────────────────────────────────────────────
  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.cv.width = w * dpr;
    this.cv.height = h * dpr;
    this.cv.style.width = w + 'px';
    this.cv.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.alpha = Math.max(this.alpha, 0.12);
  }

  _toWorld(px, py) {
    return { x: (px - this.ox) / this.scale, y: (py - this.oy) / this.scale };
  }

  _at(px, py) {
    const p = this._toWorld(px, py);
    let best = null, bestD = Infinity;
    for (const n of this.nodes) {
      if (!this.visible(n)) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      const hit = Math.max(n.radius + 7, 13);
      if (d < hit && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  _bind() {
    const cv = this.cv;

    cv.addEventListener('mousedown', (ev) => {
      const n = this._at(ev.clientX, ev.clientY);
      if (n) {
        this._dragNode = n;
      } else {
        this._drag = { x: ev.clientX, y: ev.clientY, ox: this.ox, oy: this.oy };
        cv.classList.add('dragging');
      }
    });

    window.addEventListener('mousemove', (ev) => {
      if (this._dragNode) {
        const p = this._toWorld(ev.clientX, ev.clientY);
        this._dragNode.x = p.x;
        this._dragNode.y = p.y;
        this.alpha = Math.max(this.alpha, 0.24);
        return;
      }
      if (this._drag) {
        this.ox = this._drag.ox + (ev.clientX - this._drag.x);
        this.oy = this._drag.oy + (ev.clientY - this._drag.y);
        return;
      }
      const n = this._at(ev.clientX, ev.clientY);
      if (n !== this.hover) {
        this.hover = n;
        cv.style.cursor = n ? 'pointer' : 'grab';
      }
    });

    window.addEventListener('mouseup', () => {
      this._dragNode = null;
      this._drag = null;
      cv.classList.remove('dragging');
    });

    cv.addEventListener('click', (ev) => {
      const n = this._at(ev.clientX, ev.clientY);
      if (!n) return;
      if (ev.shiftKey && this.focus && this.focus !== n) {
        this.onPath(this.focus.id, n.id);
      } else {
        this.focusNode(n.id);
      }
    });

    cv.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const factor = ev.deltaY < 0 ? 1.11 : 1 / 1.11;
      const next = Math.min(3.2, Math.max(0.28, this.scale * factor));
      const k = next / this.scale;
      // זום סביב הסמן, לא סביב הפינה
      this.ox = ev.clientX - (ev.clientX - this.ox) * k;
      this.oy = ev.clientY - (ev.clientY - this.oy) * k;
      this.scale = next;
    }, { passive: false });
  }
}
