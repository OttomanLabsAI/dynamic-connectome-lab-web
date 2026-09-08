/* Research page — the four figures from the lab's Google Site, rebuilt as
   interactive models with sliders. Plain canvas, no libraries. Every panel is
   an illustrative model of the mechanism the text describes, not lab data. */
(function () {
  'use strict';
  var INK = '#10263B', INK2 = '#405162', INK3 = '#707D89', LINE = '#CFD4D8', ACCENT = '#009BC1', GOLD = '#DEB406', RED = '#B91C2E', TEAL = '#37B4B0';
  var FONT = '"Inter", system-ui, sans-serif';

  /* ── helpers ────────────────────────────────────────────────────────── */
  function rng(seed) { var s = (seed * 2654435761) >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function erf(x) { var t = 1 / (1 + 0.3275911 * Math.abs(x)); var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x < 0 ? -y : y; }
  function fmt(v, d) { return Number(v).toFixed(d === undefined ? 0 : d); }

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }

  function canvasPanel(host, aspect, title) {
    var wrap = el('div', 'ifig-panel');
    if (title) wrap.appendChild(el('div', 'ifig-title', title));
    var c = document.createElement('canvas');
    wrap.appendChild(c);
    host.appendChild(wrap);
    var api = { canvas: c, ctx: c.getContext('2d'), w: 0, h: 0, draw: null };
    function size() {
      var w = wrap.clientWidth, h = Math.round(w * aspect), dpr = window.devicePixelRatio || 1;
      if (w === 0) return;
      c.style.height = h + 'px';
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      api.w = w; api.h = h;
      api.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (api.draw) api.draw();
    }
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(wrap); else window.addEventListener('resize', size);
    api.size = size;
    return api;
  }

  function slider(host, opt) {
    var lab = el('label', 'ctl');
    lab.appendChild(el('span', 'ctl-name', opt.label));
    var input = document.createElement('input');
    input.type = 'range'; input.min = opt.min; input.max = opt.max; input.step = opt.step || 1; input.value = opt.value;
    var out = el('output', 'ctl-val');
    var show = function () { out.textContent = (opt.format ? opt.format(+input.value) : input.value) + (opt.unit ? ' ' + opt.unit : ''); };
    input.addEventListener('input', function () { show(); opt.onChange(+input.value); });
    lab.appendChild(input); lab.appendChild(out);
    host.appendChild(lab);
    show();
    return { get: function () { return +input.value; }, set: function (v) { input.value = v; show(); } };
  }
  function button(host, label, onClick, primary) {
    var b = el('button', 'ctl-btn' + (primary ? ' is-primary' : ''), label); b.type = 'button';
    b.addEventListener('click', onClick); host.appendChild(b); return b;
  }
  function toggle(host, label, value, onChange) {
    var lab = el('label', 'ctl ctl-toggle');
    var input = document.createElement('input'); input.type = 'checkbox'; input.checked = value;
    input.addEventListener('change', function () { onChange(input.checked); });
    lab.appendChild(input); lab.appendChild(el('span', 'ctl-name', label));
    host.appendChild(lab);
    return { get: function () { return input.checked; } };
  }

  function axes(ctx, box, xr, yr, xl, yl, xt, yt) {
    ctx.save();
    ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.fillStyle = INK3; ctx.font = '11px ' + FONT;
    ctx.strokeRect(box.x + .5, box.y + .5, box.w, box.h);
    var sx = function (v) { return box.x + (v - xr[0]) / (xr[1] - xr[0]) * box.w; };
    var sy = function (v) { return box.y + box.h - (v - yr[0]) / (yr[1] - yr[0]) * box.h; };
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    xt.forEach(function (t) { var x = sx(t); ctx.beginPath(); ctx.moveTo(x, box.y + box.h); ctx.lineTo(x, box.y + box.h + 4); ctx.stroke(); ctx.fillText(String(t), x, box.y + box.h + 6); });
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    yt.forEach(function (t) { var y = sy(t); ctx.beginPath(); ctx.moveTo(box.x - 4, y); ctx.lineTo(box.x, y); ctx.stroke(); ctx.fillText(String(t), box.x - 7, y); });
    ctx.fillStyle = INK2; ctx.font = '12px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (xl) ctx.fillText(xl, box.x + box.w / 2, box.y + box.h + 30);
    if (yl) { ctx.save(); ctx.translate(box.x - 46, box.y + box.h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yl, 0, 0); ctx.restore(); }
    ctx.restore();
    return { sx: sx, sy: sy };
  }

  /* jet-like colour map, as in the original MATLAB figure */
  function jet(t) {
    t = Math.max(0, Math.min(1, t));
    var r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 3)));
    var g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 2)));
    var b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 1)));
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  /* ── 01 · Stimulation field + LFP (VERTEX-style) ────────────────────── */
  function stimulation(root) {
    var canv = el('div', 'ifig-canvases two');
    var ctl = el('div', 'ifig-controls');
    root.appendChild(canv); root.appendChild(ctl);
    var A = canvasPanel(canv, 0.86, 'Extracellular potential around the electrode (mV)');
    var B = canvasPanel(canv, 0.86, 'Local field potential at the recording site');

    var state = { I: 200, sigma: 0.3, sep: 0.15, ex: 0.68, ey: 0.42, interval: 300, dist: 0.6, t: 0 };
    var r = rng(11), neurons = [];
    for (var i = 0; i < 520; i++) neurons.push([r(), r()]);

    // potential (mV) at (x,y) in mm for a bipolar electrode: two poles, opposite sign
    function V(x, y) {
      var I = state.I * 1e-6, k = I / (4 * Math.PI * state.sigma);      // volts·metre
      var d = state.sep / 2;
      var r1 = Math.max(0.02, Math.hypot(x - state.ex, y - (state.ey - d))) * 1e-3;
      var r2 = Math.max(0.02, Math.hypot(x - state.ex, y - (state.ey + d))) * 1e-3;
      return (k / r1 - k / r2) * 1e3;
    }
    var field = document.createElement('canvas'), FR = 110; field.width = FR; field.height = FR;
    function renderField() {
      var img = field.getContext('2d').createImageData(FR, FR), p = img.data;
      for (var j = 0; j < FR; j++) for (var i = 0; i < FR; i++) {
        var v = V((i + .5) / FR, 1 - (j + .5) / FR), c = jet((v + 300) / 600), o = (j * FR + i) * 4;
        p[o] = c[0]; p[o + 1] = c[1]; p[o + 2] = c[2]; p[o + 3] = 255;
      }
      field.getContext('2d').putImageData(img, 0, 0);
    }
    A.draw = function () {
      var ctx = A.ctx, w = A.w, h = A.h; ctx.clearRect(0, 0, w, h);
      var side = Math.min(w - 70, h - 34), bx = 24, by = 14;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(field, bx, by, side, side);
      ctx.fillStyle = 'rgba(120,120,120,.55)';
      neurons.forEach(function (n) { ctx.beginPath(); ctx.arc(bx + n[0] * side, by + (1 - n[1]) * side, 3.2, 0, 7); ctx.fill(); });
      // electrode
      var ex = bx + state.ex * side, ey = by + (1 - state.ey) * side;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ex, ey - state.sep / 2 * side); ctx.lineTo(ex, ey + state.sep / 2 * side); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex, ey, 4, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, 7); ctx.stroke();
      // recording site
      var ang = -0.6, rx = ex + Math.cos(ang) * state.dist * side, ry = ey + Math.sin(ang) * state.dist * side;
      rx = Math.max(bx + 6, Math.min(bx + side - 6, rx)); ry = Math.max(by + 6, Math.min(by + side - 6, ry));
      ctx.strokeStyle = '#fff'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(rx, ry); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(rx, ry, 4.5, 0, 7); ctx.fill(); ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = INK; ctx.font = '600 10px ' + FONT; ctx.textAlign = rx > bx + side - 30 ? 'right' : 'left'; ctx.fillText('rec', rx > bx + side - 30 ? rx - 7 : rx + 7, ry + 4);
      // colour bar
      var cx = bx + side + 12, ch = side;
      for (var k = 0; k < ch; k++) { var c = jet(1 - k / ch); ctx.fillStyle = 'rgb(' + c.join(',') + ')'; ctx.fillRect(cx, by + k, 12, 1.5); }
      ctx.strokeStyle = LINE; ctx.strokeRect(cx + .5, by + .5, 12, ch);
      ctx.fillStyle = INK3; ctx.font = '10px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      [300, 200, 100, 0, -100, -200, -300].forEach(function (t) { ctx.fillText(String(t), cx + 16, by + (1 - (t + 300) / 600) * ch); });
      ctx.save(); ctx.translate(cx + 44, by + ch / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillStyle = INK2; ctx.font = '11px ' + FONT; ctx.fillText('mV', 0, 0); ctx.restore();
      ctx.fillStyle = INK3; ctx.font = '10px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('1 mm × 1 mm of tissue · drag the electrode', bx + side / 2, by + side + 6);
    };
    // drag the electrode
    (function () {
      var dragging = false;
      function pos(e) { var rct = A.canvas.getBoundingClientRect(); var side = Math.min(A.w - 70, A.h - 34); return [(e.clientX - rct.left - 24) / side, 1 - (e.clientY - rct.top - 14) / side]; }
      A.canvas.addEventListener('pointerdown', function (e) { dragging = true; A.canvas.setPointerCapture(e.pointerId); move(e); });
      A.canvas.addEventListener('pointermove', function (e) { if (dragging) move(e); });
      A.canvas.addEventListener('pointerup', function () { dragging = false; });
      A.canvas.addEventListener('pointercancel', function () { dragging = false; });
      function move(e) { var p = pos(e); state.ex = Math.max(.05, Math.min(.95, p[0])); state.ey = Math.max(.05, Math.min(.95, p[1])); renderField(); A.draw(); B.draw(); }
      A.canvas.style.touchAction = 'none'; A.canvas.style.cursor = 'crosshair';
    })();

    // LFP: baseline plus, per pulse, a fast positive transient and a slow negative wave.
    function lfp(t) {
      var amp = state.I / 200 * (0.6 / state.dist) * 0.5;
      var y = -0.7 + 0.03 * Math.sin(t / 7) + 0.02 * Math.sin(t / 3.1);
      for (var p = 1600; p < 1900 + 1; p += state.interval) {
        var dt = t - p; if (dt < 0) continue;
        y += 3.6 * amp * Math.exp(-dt / 3) * 2;
        y -= 2.3 * amp * (dt / 60) * Math.exp(1 - dt / 60) * 2;
      }
      return y;
    }
    B.draw = function () {
      var ctx = B.ctx, w = B.w, h = B.h; ctx.clearRect(0, 0, w, h);
      var box = { x: 58, y: 14, w: w - 72, h: h - 60 };
      var s = axes(ctx, box, [1300, 1950], [-4, 4], 'Time (ms)', 'LFP (mV)', [1400, 1600, 1800], [-4, -2, 0, 2, 4]);
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.8; ctx.beginPath();
      for (var t = 1300; t <= 1950; t += 0.5) { var y = Math.max(-4, Math.min(4, lfp(t))); if (t === 1300) ctx.moveTo(s.sx(t), s.sy(y)); else ctx.lineTo(s.sx(t), s.sy(y)); }
      ctx.stroke();
      ctx.fillStyle = INK3; ctx.font = '10px ' + FONT; ctx.textAlign = 'left';
      for (var p = 1600; p <= 1950; p += state.interval) { ctx.fillStyle = GOLD; ctx.fillRect(s.sx(p) - 1, box.y, 2, 6); ctx.fillStyle = INK3; }
      ctx.fillText('▮ stimulation pulses', box.x + 6, box.y + 14);
    };

    slider(ctl, { label: 'Stimulation current', min: 20, max: 500, step: 10, value: 200, unit: 'µA', onChange: function (v) { state.I = v; renderField(); A.draw(); B.draw(); } });
    slider(ctl, { label: 'Electrode separation', min: 0.04, max: 0.4, step: 0.01, value: 0.15, unit: 'mm', format: function (v) { return fmt(v, 2); }, onChange: function (v) { state.sep = v; renderField(); A.draw(); } });
    slider(ctl, { label: 'Tissue conductivity', min: 0.1, max: 0.6, step: 0.01, value: 0.3, unit: 'S/m', format: function (v) { return fmt(v, 2); }, onChange: function (v) { state.sigma = v; renderField(); A.draw(); } });
    slider(ctl, { label: 'Recording distance', min: 0.15, max: 1, step: 0.01, value: 0.6, unit: 'mm', format: function (v) { return fmt(v, 2); }, onChange: function (v) { state.dist = v; A.draw(); B.draw(); } });
    slider(ctl, { label: 'Pulse interval', min: 60, max: 340, step: 10, value: 300, unit: 'ms', onChange: function (v) { state.interval = v; B.draw(); } });
    renderField(); A.size(); B.size();
  }

  /* ── 02 · ROC curves for surgery-outcome prediction ─────────────────── */
  function roc(root) {
    var canv = el('div', 'ifig-canvases two');
    var ctl = el('div', 'ifig-controls');
    root.appendChild(canv); root.appendChild(ctl);
    var state = { n: 33, thr: 0.5, d1: 2.7, d2: 2.2, seed: 556 };
    var panels = [
      { title: 'within-region networks (HighRes)', key: 'd1', api: canvasPanel(canv, 0.92, '<i>within</i>-region networks · HighRes') },
      { title: 'between-region networks (LowRes)', key: 'd2', api: canvasPanel(canv, 0.92, '<i>between</i>-region networks · LowRes') },
    ];
    function sample(dprime, seed) {
      // n patients: ~55% good outcome (positives). Scores ~ N(d', 1) for positives, N(0, 1) for negatives.
      var r = rng(seed), pos = [], neg = [];
      var nPos = Math.round(state.n * 0.55), nNeg = state.n - nPos;
      for (var i = 0; i < nPos; i++) pos.push(gauss(r) + dprime);
      for (var j = 0; j < nNeg; j++) neg.push(gauss(r));
      return { pos: pos, neg: neg };
    }
    function curve(s) {
      var all = s.pos.map(function (v) { return [v, 1]; }).concat(s.neg.map(function (v) { return [v, 0]; })).sort(function (a, b) { return b[0] - a[0]; });
      var pts = [[0, 0]], tp = 0, fp = 0, auc = 0;
      all.forEach(function (x) { if (x[1]) tp++; else { fp++; auc += tp; } pts.push([fp / s.neg.length, tp / s.pos.length]); });
      return { pts: pts, auc: auc / (s.pos.length * s.neg.length) };
    }
    function atThreshold(s, thr) {
      // threshold as a quantile of all scores (0 = classify everyone as good outcome)
      var all = s.pos.concat(s.neg).sort(function (a, b) { return a - b; });
      var cut = all[Math.min(all.length - 1, Math.floor(thr * all.length))];
      var tp = s.pos.filter(function (v) { return v >= cut; }).length, fp = s.neg.filter(function (v) { return v >= cut; }).length;
      var sen = tp / s.pos.length, spec = 1 - fp / s.neg.length, acc = (tp + (s.neg.length - fp)) / (s.pos.length + s.neg.length);
      return { fpr: 1 - spec, tpr: sen, sen: sen, spec: spec, acc: acc };
    }
    panels.forEach(function (p) {
      p.api.draw = function () {
        var ctx = p.api.ctx, w = p.api.w, h = p.api.h; ctx.clearRect(0, 0, w, h);
        var box = { x: 58, y: 12, w: w - 72, h: h - 52 };
        var s = axes(ctx, box, [0, 1], [0, 1], 'False positive rate', 'True positive rate', [0, 0.2, 0.4, 0.6, 0.8, 1], [0, 0.2, 0.4, 0.6, 0.8, 1]);
        var smp = sample(state[p.key], state.seed + (p.key === 'd1' ? 0 : 100)), c = curve(smp), q = atThreshold(smp, state.thr);
        // area
        ctx.fillStyle = 'rgba(0,155,193,.12)'; ctx.beginPath(); ctx.moveTo(s.sx(0), s.sy(0));
        c.pts.forEach(function (pt) { ctx.lineTo(s.sx(pt[0]), s.sy(pt[1])); }); ctx.lineTo(s.sx(1), s.sy(0)); ctx.closePath(); ctx.fill();
        // reference line
        ctx.strokeStyle = RED; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(s.sx(0), s.sy(0)); ctx.lineTo(s.sx(1), s.sy(1)); ctx.stroke();
        // ROC steps
        ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath();
        c.pts.forEach(function (pt, i) { if (i === 0) ctx.moveTo(s.sx(pt[0]), s.sy(pt[1])); else ctx.lineTo(s.sx(pt[0]), s.sy(pt[1])); }); ctx.stroke();
        // current classifier
        ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(s.sx(q.fpr), s.sy(q.tpr), 5, 0, 7); ctx.fill();
        // legend + stats
        ctx.font = '11px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
        var lx = box.x + box.w * 0.42, ly = box.y + box.h * 0.62;
        ctx.font = '600 12px ' + FONT; ctx.fillText('AUC = ' + fmt(c.auc, 2), lx, ly);
        ctx.font = '11px ' + FONT; ctx.fillStyle = INK2;
        ctx.fillText('Acc. = ' + fmt(q.acc * 100, 1) + '%', lx, ly + 16);
        ctx.fillStyle = '#0a6b3a'; ctx.fillText('Sen. = ' + fmt(q.sen * 100, 0) + '%   Spec. = ' + fmt(q.spec * 100, 0) + '%', lx, ly + 32);
        ctx.fillStyle = INK2;
        ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, ly + 50); ctx.lineTo(lx + 18, ly + 50); ctx.stroke(); ctx.fillText('ROC curve', lx + 24, ly + 50);
        ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(lx + 9, ly + 66, 4, 0, 7); ctx.fill(); ctx.fillStyle = INK2; ctx.fillText('Current classifier', lx + 24, ly + 66);
        ctx.strokeStyle = RED; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(lx, ly + 82); ctx.lineTo(lx + 18, ly + 82); ctx.stroke(); ctx.fillText('Reference line', lx + 24, ly + 82);
      };
    });
    var redraw = function () { panels.forEach(function (p) { p.api.draw(); }); };
    slider(ctl, { label: 'Classifier threshold', min: 0.02, max: 0.98, step: 0.01, value: 0.5, format: function (v) { return fmt(v * 100, 0) + '%'; }, onChange: function (v) { state.thr = v; redraw(); } });
    slider(ctl, { label: 'Patients', min: 10, max: 200, step: 1, value: 33, onChange: function (v) { state.n = v; redraw(); } });
    slider(ctl, { label: 'Separation, within-region', min: 0, max: 4, step: 0.05, value: 2.7, unit: "d′", format: function (v) { return fmt(v, 2); }, onChange: function (v) { state.d1 = v; redraw(); } });
    slider(ctl, { label: 'Separation, between-region', min: 0, max: 4, step: 0.05, value: 2.2, unit: "d′", format: function (v) { return fmt(v, 2); }, onChange: function (v) { state.d2 = v; redraw(); } });
    button(ctl, 'New cohort', function () { state.seed++; redraw(); });
    panels.forEach(function (p) { p.api.size(); });
  }

  /* ── 03 · Spatial growth of a network (connectome development) ──────── */
  function growth(root) {
    var canv = el('div', 'ifig-canvases wide');
    var ctl = el('div', 'ifig-controls');
    var stats = el('div', 'ifig-stats');
    root.appendChild(canv); root.appendChild(stats); root.appendChild(ctl);
    var A = canvasPanel(canv, 0.56, 'Spatial growth: each new neuron connects to existing ones with probability <i>β · e<sup>−α · distance</sup></i>');
    var state = { alpha: 10, beta: 0.7, N: 120, windows: false, seed: 3 };
    var nodes = [], edges = [], adj = [], timer = null, r;

    function reset() { nodes = []; edges = []; adj = []; r = rng(state.seed); if (timer) { clearInterval(timer); timer = null; } A.draw(); showStats(); }
    function addNode() {
      if (nodes.length >= state.N) return false;
      var tries = 0;
      while (tries++ < 40) {
        var n = { x: 0.06 + r() * 0.88, y: 0.06 + r() * 0.88, t: nodes.length / state.N };
        var links = [];
        nodes.forEach(function (m, j) {
          var d = Math.hypot(n.x - m.x, n.y - m.y);
          var p = state.beta * Math.exp(-state.alpha * d);
          if (state.windows && ((n.t < 0.5) !== (m.t < 0.5))) p *= 0.12;   // different time window
          if (r() < p) links.push(j);
        });
        if (nodes.length === 0 || links.length) {
          var i = nodes.length; nodes.push(n); adj.push([]);
          links.forEach(function (j) { edges.push([i, j]); adj[i].push(j); adj[j].push(i); });
          return true;
        }
      }
      return false;
    }
    function measures() {
      var n = nodes.length; if (n < 3) return null;
      var C = 0, cnt = 0;
      for (var i = 0; i < n; i++) { var k = adj[i].length; if (k < 2) continue; var links = 0; for (var a = 0; a < k; a++) for (var b = a + 1; b < k; b++) if (adj[adj[i][a]].indexOf(adj[i][b]) > -1) links++; C += links / (k * (k - 1) / 2); cnt++; }
      C = cnt ? C / cnt : 0;
      var Ltot = 0, pairs = 0, comps = 0, seen = new Array(n).fill(false);
      for (var s = 0; s < n; s++) {
        var dist = new Array(n).fill(-1), q = [s]; dist[s] = 0;
        if (!seen[s]) { comps++; }
        for (var h = 0; h < q.length; h++) { var u = q[h]; seen[u] = true; adj[u].forEach(function (v) { if (dist[v] < 0) { dist[v] = dist[u] + 1; q.push(v); } }); }
        for (var t = 0; t < n; t++) if (t !== s && dist[t] > 0) { Ltot += dist[t]; pairs++; }
      }
      var L = pairs ? Ltot / pairs : 0, kavg = 2 * edges.length / n;
      var Crand = kavg / n, Lrand = kavg > 1 ? Math.log(n) / Math.log(kavg) : 0;
      var sigma = (Crand > 0 && Lrand > 0 && L > 0) ? (C / Crand) / (L / Lrand) : 0;
      return { n: n, e: edges.length, C: C, L: L, comps: comps, sigma: sigma, k: kavg };
    }
    function showStats() {
      var m = measures();
      stats.innerHTML = m ? '<span><b>' + m.n + '</b> neurons</span><span><b>' + m.e + '</b> connections</span><span><b>' + fmt(m.k, 1) + '</b> mean degree</span><span><b>' + fmt(m.C, 2) + '</b> clustering C</span><span><b>' + fmt(m.L, 2) + '</b> path length L</span><span><b>' + fmt(m.sigma, 1) + '</b> small-world σ</span><span><b>' + m.comps + '</b> cluster' + (m.comps === 1 ? '' : 's') + '</span>' : '<span>Press <b>Grow</b> to start adding neurons.</span>';
    }
    A.draw = function () {
      var ctx = A.ctx, w = A.w, h = A.h; ctx.clearRect(0, 0, w, h);
      var side = Math.min(w, h), ox = (w - side) / 2, oy = (h - side) / 2;
      ctx.strokeStyle = LINE; ctx.lineWidth = 1;
      edges.forEach(function (e) { var a = nodes[e[0]], b = nodes[e[1]]; ctx.beginPath(); ctx.moveTo(ox + a.x * side, oy + a.y * side); ctx.lineTo(ox + b.x * side, oy + b.y * side); ctx.strokeStyle = 'rgba(16,38,59,.28)'; ctx.stroke(); });
      nodes.forEach(function (n) {
        var young = n.t;   // 0 = oldest
        ctx.fillStyle = 'rgb(' + Math.round(20 + 130 * young) + ',' + Math.round(90 + 110 * young) + ',' + Math.round(170 + 60 * young) + ')';
        ctx.beginPath(); ctx.arc(ox + n.x * side, oy + n.y * side, 5.5, 0, 7); ctx.fill();
      });
      ctx.fillStyle = INK3; ctx.font = '10px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgb(20,90,170)'; ctx.beginPath(); ctx.arc(ox + 10, oy + 12, 5, 0, 7); ctx.fill(); ctx.fillStyle = INK3; ctx.fillText('old', ox + 20, oy + 7);
      ctx.fillStyle = 'rgb(150,200,230)'; ctx.beginPath(); ctx.arc(ox + 50, oy + 12, 5, 0, 7); ctx.fill(); ctx.fillStyle = INK3; ctx.fillText('young', ox + 60, oy + 7);
    };
    function grow() {
      if (timer) return;
      timer = setInterval(function () { var ok = true; for (var i = 0; i < 2 && ok; i++) ok = addNode(); A.draw(); showStats(); if (!ok || nodes.length >= state.N) { clearInterval(timer); timer = null; } }, 60);
    }
    slider(ctl, { label: 'Distance dependence α', min: 0, max: 20, step: 0.5, value: 10, format: function (v) { return fmt(v, 1); }, onChange: function (v) { state.alpha = v; } });
    slider(ctl, { label: 'Connection probability β', min: 0.05, max: 1, step: 0.05, value: 0.7, format: function (v) { return fmt(v, 2); }, onChange: function (v) { state.beta = v; } });
    slider(ctl, { label: 'Neurons', min: 20, max: 250, step: 5, value: 120, onChange: function (v) { state.N = v; } });
    toggle(ctl, 'Time windows (old connect to old, young to young)', false, function (v) { state.windows = v; });
    button(ctl, 'Grow', grow, true);
    button(ctl, 'Reset', function () { state.seed++; reset(); });
    reset(); A.size();
    if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (en) { if (en.some(function (e) { return e.isIntersecting; })) { io.disconnect(); grow(); } }, { rootMargin: '0px 0px -20% 0px' }); io.observe(root); }
  }

  /* ── 04 · Hierarchical modular network + spreading activation ───────── */
  function hierarchy(root) {
    var canv = el('div', 'ifig-canvases wide');
    var ctl = el('div', 'ifig-controls');
    var stats = el('div', 'ifig-stats');
    root.appendChild(canv); root.appendChild(stats); root.appendChild(ctl);
    var A = canvasPanel(canv, 0.7, 'Modules within modules — click a node to start activity spreading');
    var state = { M: 5, S: 4, n: 5, p1: 0.85, p2: 0.03, p3: 0.001, rewire: 0, spread: 0.6, seed: 9 };
    var nodes = [], edges = [], adj = [], active = [], refr = [], history = [], timer = null, step = 0, ever = [];

    function build() {
      var r = rng(state.seed); nodes = []; edges = []; adj = [];
      for (var m = 0; m < state.M; m++) for (var s = 0; s < state.S; s++) for (var i = 0; i < state.n; i++) nodes.push({ m: m, s: s, i: i });
      nodes.forEach(function () { adj.push([]); });
      for (var a = 0; a < nodes.length; a++) for (var b = a + 1; b < nodes.length; b++) {
        var na = nodes[a], nb = nodes[b], p = na.m !== nb.m ? state.p3 : na.s !== nb.s ? state.p2 : state.p1;
        if (r() < p) { edges.push([a, b]); adj[a].push(b); adj[b].push(a); }
      }
      // random rewiring: each edge moved to a random pair with probability `rewire`
      if (state.rewire > 0) {
        edges = edges.map(function (e) {
          if (r() >= state.rewire) return e;
          var x = Math.floor(r() * nodes.length), y = Math.floor(r() * nodes.length); if (x === y) return e; return [x, y];
        });
        adj = nodes.map(function () { return []; });
        edges.forEach(function (e) { adj[e[0]].push(e[1]); adj[e[1]].push(e[0]); });
      }
      // layout: modules on a ring, sub-modules on a ring inside, nodes on a ring inside that
      var R = 0.36, rM = 0.17, rS = 0.055;
      nodes.forEach(function (nd) {
        var aM = (nd.m / state.M) * Math.PI * 2 - Math.PI / 2, cxM = 0.5 + Math.cos(aM) * (state.M === 1 ? 0 : R), cyM = 0.5 + Math.sin(aM) * (state.M === 1 ? 0 : R);
        var aS = (nd.s / state.S) * Math.PI * 2 + aM, cxS = cxM + (state.S === 1 ? 0 : Math.cos(aS) * rM * 0.62), cyS = cyM + (state.S === 1 ? 0 : Math.sin(aS) * rM * 0.62);
        var aI = (nd.i / state.n) * Math.PI * 2 + aS; nd.x = cxS + Math.cos(aI) * rS * 0.7; nd.y = cyS + Math.sin(aI) * rS * 0.7;
        nd.cxM = cxM; nd.cyM = cyM; nd.cxS = cxS; nd.cyS = cyS;
      });
      resetActivity();
    }
    function resetActivity() { active = nodes.map(function () { return false; }); refr = nodes.map(function () { return 0; }); ever = nodes.map(function () { return false; }); history = []; step = 0; if (timer) { clearInterval(timer); timer = null; } A.draw(); showStats(); }
    function seedAt(i) { resetActivity(); active[i] = true; ever[i] = true; history.push(1 / nodes.length); run(); }
    function tick() {
      var r = Math.random, next = nodes.map(function () { return false; });
      nodes.forEach(function (nd, i) {
        if (refr[i] > 0) refr[i]--;
        if (!active[i]) return;
        adj[i].forEach(function (j) { if (!active[j] && refr[j] === 0 && r() < state.spread) next[j] = true; });
        refr[i] = 1;   // just fired: rests for one step
      });
      active = next; step++;
      active.forEach(function (a, i) { if (a) ever[i] = true; });
      var frac = active.filter(Boolean).length / nodes.length; history.push(frac);
      if (frac === 0 || step >= 40) { clearInterval(timer); timer = null; }
      A.draw(); showStats();
    }
    function run() { if (timer) return; timer = setInterval(tick, 260); }
    function showStats() {
      var n = nodes.length, act = active.filter(Boolean).length, everN = ever.filter(Boolean).length;
      var mods = {}; nodes.forEach(function (nd, i) { if (ever[i]) mods[nd.m] = 1; });
      stats.innerHTML = '<span><b>' + n + '</b> nodes</span><span><b>' + edges.length + '</b> edges</span><span><b>' + step + '</b> of 40 steps</span><span><b>' + fmt(act / n * 100, 0) + '%</b> active now</span><span><b>' + fmt(everN / n * 100, 0) + '%</b> of nodes reached</span><span><b>' + Object.keys(mods).length + ' of ' + state.M + '</b> modules reached</span><span>' + (timer ? 'spreading…' : history.length ? (history[history.length - 1] === 0 ? 'activity died out' : 'still going after 40 steps') : 'click a node to seed activity') + '</span>';
    }
    A.draw = function () {
      var ctx = A.ctx, w = A.w, h = A.h; ctx.clearRect(0, 0, w, h);
      var side = Math.min(w, h * 1.0), ox = (w - side) / 2, oy = (h - side) / 2;
      var X = function (v) { return ox + v * side; }, Y = function (v) { return oy + v * side; };
      ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(16,38,59,.35)'; ctx.lineWidth = 1;
      var seenM = {}, seenS = {};
      nodes.forEach(function (nd) {
        if (!seenM[nd.m]) { seenM[nd.m] = 1; ctx.beginPath(); ctx.arc(X(nd.cxM), Y(nd.cyM), 0.16 * side, 0, 7); ctx.stroke(); }
        var ks = nd.m + '-' + nd.s; if (!seenS[ks]) { seenS[ks] = 1; ctx.beginPath(); ctx.arc(X(nd.cxS), Y(nd.cyS), 0.055 * side, 0, 7); ctx.stroke(); }
      });
      ctx.setLineDash([]);
      edges.forEach(function (e) {
        var a = nodes[e[0]], b = nodes[e[1]], far = a.m !== b.m, both = active[e[0]] && active[e[1]];
        ctx.strokeStyle = both ? GOLD : far ? 'rgba(16,38,59,.55)' : 'rgba(16,38,59,.22)'; ctx.lineWidth = far ? 0.9 : 0.8;
        ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b.x), Y(b.y)); ctx.stroke();
      });
      nodes.forEach(function (nd, i) {
        ctx.fillStyle = active[i] ? GOLD : refr[i] > 0 ? 'rgba(16,38,59,.3)' : INK;
        ctx.beginPath(); ctx.arc(X(nd.x), Y(nd.y), active[i] ? 5 : 3.2, 0, 7); ctx.fill();
      });
      // activity trace
      if (history.length > 1) {
        var bx = ox + side * 0.02, by = oy + side * 0.02, bw = side * 0.22, bh = side * 0.1;
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = LINE; ctx.strokeRect(bx + .5, by + .5, bw, bh);
        ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.beginPath();
        history.forEach(function (v, k) { var x = bx + (k / 40) * bw, y = by + bh - v * bh; if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke();
        ctx.fillStyle = INK3; ctx.font = '9px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('active nodes over time', bx + 4, by + bh + 3);
      }
    };
    A.canvas.addEventListener('click', function (e) {
      var rct = A.canvas.getBoundingClientRect(), side = Math.min(A.w, A.h), ox = (A.w - side) / 2, oy = (A.h - side) / 2;
      var px = (e.clientX - rct.left - ox) / side, py = (e.clientY - rct.top - oy) / side, best = -1, bd = 0.05;
      nodes.forEach(function (nd, i) { var d = Math.hypot(nd.x - px, nd.y - py); if (d < bd) { bd = d; best = i; } });
      if (best > -1) seedAt(best);
    });
    A.canvas.style.cursor = 'pointer';
    var rebuild = function () { build(); };
    slider(ctl, { label: 'Modules', min: 2, max: 8, step: 1, value: 5, onChange: function (v) { state.M = v; rebuild(); } });
    slider(ctl, { label: 'Sub-modules per module', min: 1, max: 6, step: 1, value: 4, onChange: function (v) { state.S = v; rebuild(); } });
    slider(ctl, { label: 'Nodes per sub-module', min: 3, max: 9, step: 1, value: 5, onChange: function (v) { state.n = v; rebuild(); } });
    slider(ctl, { label: 'Within sub-module density', min: 0.1, max: 1, step: 0.05, value: 0.85, format: function (v) { return fmt(v, 2); }, onChange: function (v) { state.p1 = v; rebuild(); } });
    slider(ctl, { label: 'Between sub-module density', min: 0, max: 0.3, step: 0.01, value: 0.03, format: function (v) { return fmt(v, 2); }, onChange: function (v) { state.p2 = v; rebuild(); } });
    slider(ctl, { label: 'Between module density', min: 0, max: 0.03, step: 0.001, value: 0.001, format: function (v) { return fmt(v, 3); }, onChange: function (v) { state.p3 = v; rebuild(); } });
    slider(ctl, { label: 'Random rewiring', min: 0, max: 1, step: 0.05, value: 0, format: function (v) { return fmt(v * 100, 0) + '%'; }, onChange: function (v) { state.rewire = v; rebuild(); } });
    slider(ctl, { label: 'Spreading probability', min: 0.05, max: 1, step: 0.05, value: 0.6, format: function (v) { return fmt(v, 2); }, onChange: function (v) { state.spread = v; } });
    button(ctl, 'Seed a random node', function () { seedAt(Math.floor(Math.random() * nodes.length)); }, true);
    button(ctl, 'New network', function () { state.seed++; rebuild(); });
    build(); A.size();
  }

  var FIGS = { stimulation: stimulation, roc: roc, growth: growth, hierarchy: hierarchy };
  document.querySelectorAll('[data-fig]').forEach(function (root) { var f = FIGS[root.getAttribute('data-fig')]; if (f) f(root); });
})();
