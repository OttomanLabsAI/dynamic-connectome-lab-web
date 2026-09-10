/* Home-page tractogram: the HCP1065 population-average streamlines drawn with
   NiiVue straight onto the page, on the site's own blue. The strands draw
   themselves along their paths once, then the model turns slowly. Drag to turn
   it; a single switch stops and restarts the spin, which is on to begin
   with. The library and the
   streamlines (a few megabytes together) only load once the section is near
   the viewport. */
(function () {
  'use strict';
  var stage = document.getElementById('tractogram');
  if (!stage) return;
  var canvas = stage.querySelector('canvas');
  var status = stage.querySelector('.tract-status');
  var bar = stage.querySelector('.tract-bar');
  var spinBtn = stage.querySelector('.tract-spin');
  var LIB = stage.getAttribute('data-lib');
  var TRACT = stage.getAttribute('data-tract');
  var BG = (stage.getAttribute('data-bg') || '#10263B').replace('#', '');
  var bg = [parseInt(BG.slice(0, 2), 16) / 255, parseInt(BG.slice(2, 4), 16) / 255, parseInt(BG.slice(4, 6), 16) / 255, 1];

  var DEG_PER_SEC = 7, IDLE_MS = 2500, GROW_MS = 2400;
  var nv = null, spinning = true, dragging = false, lastTouch = 0, prev;
  var growUntil = 0, growMesh = null, growTotal = 0, growStep = 30;
  var stillMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function say(text, pct) {
    if (!status) return;
    status.textContent = text || '';
    status.hidden = !text;
    if (bar) { bar.hidden = pct === undefined; if (pct !== undefined) bar.style.width = pct + '%'; }
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.niivue) return resolve();
      var el = document.createElement('script');
      el.src = src; el.onload = resolve; el.onerror = function () { reject(new Error('could not load the viewer')); };
      document.head.appendChild(el);
    });
  }

  function fetchWithProgress(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var total = Number(res.headers.get('content-length')) || 0;
      if (!res.body || !total) return res.arrayBuffer();
      var reader = res.body.getReader(), chunks = [], got = 0;
      return (function pump() {
        return reader.read().then(function (step) {
          if (step.done) {
            var out = new Uint8Array(got), at = 0;
            chunks.forEach(function (c) { out.set(c, at); at += c.length; });
            return out.buffer;
          }
          chunks.push(step.value); got += step.value.length;
          say('Loading the tractogram… ' + Math.round(got / total * 100) + '%', Math.round(got / total * 100));
          return pump();
        });
      })();
    });
  }

  /* ── Fitting the brain to the canvas ──────────────────────────────────
     NiiVue sizes the model against the canvas's *shorter* side, so on a wide
     desktop canvas the height is what runs out first and on a narrow phone
     canvas it is the width — which is why a single fixed zoom cropped the
     sides off on a phone. W_PER_SIDE and H_PER_SIDE are the drawn brain's
     width and height as a fraction of that shorter side, per unit of
     volScaleMultiplier, measured at the widest point of a full turn so that
     nothing clips part-way round. The margins keep a little air around it;
     the 1.4 cap is the framing the desktop already had. */
  var W_PER_SIDE = 0.85, H_PER_SIDE = 0.692;
  function fitScale() {
    var w = canvas.clientWidth || stage.clientWidth || 1;
    var h = canvas.clientHeight || stage.clientHeight || 1;
    var side = Math.min(w, h);
    return Math.min(1.4, 0.90 * w / (W_PER_SIDE * side), 0.97 * h / (H_PER_SIDE * side));
  }

  var resizePending = false;
  function onResize() {
    if (!nv || resizePending) return;
    resizePending = true;
    requestAnimationFrame(function () {
      resizePending = false;
      nv.scene.volScaleMultiplier = fitScale();
      nv.drawScene();
    });
  }

  /* ── Growing the strands ──────────────────────────────────────────────
     NiiVue draws each streamline segment as one block of fiberSides*6 indices,
     laid down in order along the path, one streamline after the next. Sorting
     those blocks by how far along its own path each one sits — every strand's
     first segment, then every strand's second, and so on — means that drawing
     only the first N indices draws every strand grown to the same fraction of
     its own length. The animation is then just a number, indexCount, with no
     geometry to rebuild: the expensive part happens once, here.

     The index array is caught as NiiVue uploads it rather than read back off
     the GPU, which would cost a stall and a second copy of ~64 MB. */
  function captureIndices(gl, build) {
    var caught = null, orig = gl.bufferData;
    gl.bufferData = function (target, data, usage) {
      if (target === gl.ELEMENT_ARRAY_BUFFER && data && data.BYTES_PER_ELEMENT === 4 && data.length > 3000) caught = data;
      return orig.call(gl, target, data, usage);
    };
    try { build(); } finally { gl.bufferData = orig; }
    return caught;
  }

  function sortBlocksByArc(mesh, idx) {
    var per = mesh.fiberSides * 6, off = mesh.offsetPt0, lens = mesh.fiberLengths;
    if (!per || !off || !lens) return false;
    var minLen = mesh.fiberLength, count = off.length - 1, blocks = 0, l;
    for (l = 0; l < count; l++) if (!(lens[l] < minLen)) blocks += off[l + 1] - off[l] - 1;
    /* If the buffer is not laid out the way this reads it — a different
       viewer, or fibres dropped by a filter — leave it alone and skip the
       animation rather than scrambling the geometry. */
    if (!blocks || blocks * per !== idx.length) return false;

    var BUCKETS = 2048, key = new Uint16Array(blocks), b = 0, s, segs;
    for (l = 0; l < count; l++) {
      if (lens[l] < minLen) continue;
      segs = off[l + 1] - off[l] - 1;
      for (s = 0; s < segs; s++) key[b++] = Math.floor((s + 1) / segs * (BUCKETS - 1));
    }
    var tally = new Uint32Array(BUCKETS + 1), i;
    for (b = 0; b < blocks; b++) tally[key[b] + 1]++;
    for (i = 0; i < BUCKETS; i++) tally[i + 1] += tally[i];
    var dest = new Uint32Array(blocks);
    for (b = 0; b < blocks; b++) dest[b] = tally[key[b]]++;

    /* Permute the blocks where they lie, following each cycle, so no second
       copy of the index array is ever allocated. */
    var seen = new Uint8Array(blocks), held = new Uint32Array(per), spare = new Uint32Array(per);
    var at, to, start;
    for (start = 0; start < blocks; start++) {
      if (seen[start]) continue;
      seen[start] = 1;
      if (dest[start] === start) continue;
      held.set(idx.subarray(start * per, start * per + per));
      at = start;
      for (;;) {
        to = dest[at];
        spare.set(idx.subarray(to * per, to * per + per));
        idx.set(held, to * per);
        held.set(spare);
        seen[to] = 1;
        at = to;
        if (dest[at] === start) { idx.set(held, start * per); break; }
      }
    }
    return true;
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (!nv || document.hidden) return;
    if (growUntil) {
      var x = Math.min(1, 1 - (growUntil - now) / GROW_MS);
      if (x < 0) x = 0;
      /* Even, readable growth: a gentle start and finish, constant in between. */
      var eased = x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
      growMesh.indexCount = Math.floor(growTotal * eased / growStep) * growStep;
      if (x >= 1) { growMesh.indexCount = growTotal; growUntil = 0; prev = undefined; }
      nv.drawScene();
      return;
    }
    if (!spinning) return;
    if (now - lastTouch < IDLE_MS) { prev = undefined; return; }
    if (prev === undefined) prev = now;
    var dt = Math.min(now - prev, 100) / 1000; prev = now;
    nv.scene.renderAzimuth = (nv.scene.renderAzimuth + DEG_PER_SEC * dt) % 360;
    nv.drawScene();
  }
  function touched() { lastTouch = performance.now(); prev = undefined; }

  /* The label stays "Spin" either way — it names what the switch does, and
     aria-pressed and the knob say which way it is set. It starts on. */
  function setSpin(on) {
    spinning = on; prev = undefined; lastTouch = 0;
    if (spinBtn) spinBtn.setAttribute('aria-pressed', String(on));
  }
  if (spinBtn) spinBtn.addEventListener('click', function () { setSpin(!spinning); });

  async function boot() {
    if (TRACT === 'offline') { say('The interactive brain model (6 MB) plays on the hosted demo, not in this offline copy.'); if (spinBtn) spinBtn.hidden = true; return; }
    try {
      say('Loading the viewer…');
      await loadScript(LIB);
      var buffer = await fetchWithProgress(TRACT);
      say('Drawing…');
      nv = new niivue.Niivue({
        backColor: bg,
        show3Dcrosshair: false,
        isColorbar: false,
        dragAndDropEnabled: false,
        isOrientCube: false,
        sliceType: niivue.SLICE_TYPE.RENDER,
        fontMinPx: 0
      });
      await nv.attachToCanvas(canvas);
      await nv.addMeshFromUrl({ url: TRACT, buffer: buffer });
      nv.setSliceType(niivue.SLICE_TYPE.RENDER);
      if (nv.meshes && nv.meshes.length) {
        var mesh = nv.meshes[0], id = mesh.id;
        nv.setMeshProperty(id, 'fiberColor', 'Local');
        nv.setMeshProperty(id, 'fiberDither', 0.1);
        /* Setting the radius is the call that rebuilds the fibre geometry, so
           it is the one to catch the index buffer from. */
        if (stillMotion) {
          nv.setMeshProperty(id, 'fiberRadius', 0.4);
        } else {
          var idx = captureIndices(nv.gl, function () {
            nv.setMeshProperty(id, 'fiberRadius', 0.4);
          });
          if (idx && sortBlocksByArc(mesh, idx)) {
            nv.gl.bindVertexArray(null);
            nv.gl.bindBuffer(nv.gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
            nv.gl.bufferData(nv.gl.ELEMENT_ARRAY_BUFFER, idx, nv.gl.STATIC_DRAW);
            growMesh = mesh; growTotal = idx.length; growStep = mesh.fiberSides * 6;
            mesh.indexCount = 0;
          }
          idx = null;
        }
      }
      nv.scene.renderAzimuth = 120;
      nv.scene.renderElevation = 15;
      nv.scene.volScaleMultiplier = fitScale();
      nv.drawScene();
      /* the page keeps scrolling over the brain: the wheel is not a zoom here */
      stage.addEventListener('wheel', function (e) { e.stopPropagation(); }, { capture: true, passive: true });
      /* Only a drag holds the spin off. Listening to every pointermove meant
         that merely moving the mouse across the brain — or the page scrolling
         under a resting cursor — read as interaction and parked the spin for
         IDLE_MS, over and over, so it stopped as soon as anyone looked at it.
         Pointer events cover touch as well: a swipe the browser claims for
         scrolling arrives as a pointercancel, which lets the spin straight
         back rather than counting as a turn of the model. */
      canvas.addEventListener('pointerdown', function () { dragging = true; touched(); }, { passive: true });
      canvas.addEventListener('pointermove', function (e) { if (dragging || e.buttons) touched(); }, { passive: true });
      ['pointerup', 'pointerleave'].forEach(function (evt) {
        canvas.addEventListener(evt, function () { if (dragging) { dragging = false; touched(); } }, { passive: true });
      });
      canvas.addEventListener('pointercancel', function () {
        dragging = false; lastTouch = 0; prev = undefined;
      }, { passive: true });
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);
      say('');
      stage.classList.add('is-ready');
      if (growMesh) growUntil = performance.now() + GROW_MS;
      requestAnimationFrame(tick);
    } catch (err) {
      say('The tractogram could not be drawn here (' + (err && err.message ? err.message : err) + ').');
      if (bar) bar.hidden = true;
    }
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); boot(); }
    }, { rootMargin: '400px 0px' });
    io.observe(stage);
  } else boot();
})();
