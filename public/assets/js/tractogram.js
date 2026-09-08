/* Home-page tractogram: the HCP1065 population-average streamlines drawn with
   NiiVue straight onto the page, on the site's own blue. Drag to turn it; a
   single switch starts and stops the slow spin. The library and the streamlines
   (a few megabytes together) only load once the section is near the viewport. */
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

  var DEG_PER_SEC = 7, IDLE_MS = 2500;
  var nv = null, spinning = true, lastTouch = 0, prev;

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

  function tick(now) {
    requestAnimationFrame(tick);
    if (!nv || !spinning || document.hidden) return;
    if (now - lastTouch < IDLE_MS) { prev = undefined; return; }
    if (prev === undefined) prev = now;
    var dt = Math.min(now - prev, 100) / 1000; prev = now;
    nv.scene.renderAzimuth = (nv.scene.renderAzimuth + DEG_PER_SEC * dt) % 360;
    nv.drawScene();
  }
  function touched() { lastTouch = performance.now(); prev = undefined; }

  function setSpin(on) {
    spinning = on; prev = undefined; lastTouch = 0;
    if (spinBtn) { spinBtn.setAttribute('aria-pressed', String(on)); spinBtn.querySelector('span').textContent = on ? 'Spinning' : 'Spin'; }
  }
  if (spinBtn) spinBtn.addEventListener('click', function () { setSpin(!spinning); });

  async function boot() {
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
        var id = nv.meshes[0].id;
        nv.setMeshProperty(id, 'fiberColor', 'Local');
        nv.setMeshProperty(id, 'fiberDither', 0.1);
        nv.setMeshProperty(id, 'fiberRadius', 0.4);
      }
      nv.scene.renderAzimuth = 120;
      nv.scene.renderElevation = 15;
      nv.scene.volScaleMultiplier = 1.4;
      nv.drawScene();
      /* the page keeps scrolling over the brain: the wheel is not a zoom here */
      stage.addEventListener('wheel', function (e) { e.stopPropagation(); }, { capture: true, passive: true });
      ['pointerdown', 'pointermove', 'touchstart', 'touchmove'].forEach(function (evt) {
        canvas.addEventListener(evt, touched, { passive: true });
      });
      say('');
      stage.classList.add('is-ready');
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
