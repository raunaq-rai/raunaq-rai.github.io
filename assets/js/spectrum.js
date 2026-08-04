/* Interactive stacked spectrum. No dependencies. */
(function (global) {
  'use strict';

  // tier 0 is drawn first when space is short, tier 2 last.
  var LINES = [
    { label: 'Lyα',            wave: 1215.67,  tier: 0, kind: 'emission' },
    { label: 'N V',                 wave: 1240,     tier: 1, kind: 'emission' },
    { label: 'Si II',               wave: 1263,     tier: 2, kind: 'emission' },
    { label: 'Si IV',               wave: 1404,     tier: 2, kind: 'emission' },
    { label: 'N IV]',               wave: 1486.5,   tier: 0, kind: 'emission' },
    { label: 'Si II',               wave: 1530,     tier: 2, kind: 'emission' },
    { label: 'C IV',                wave: 1550,     tier: 0, kind: 'emission' },
    { label: 'He II',               wave: 1640.42,  tier: 1, kind: 'emission' },
    { label: 'O III]',              wave: 1660,     tier: 2, kind: 'emission' },
    { label: 'O III]',              wave: 1666,     tier: 1, kind: 'emission' },
    { label: 'N III]',              wave: 1749.67,  tier: 0, kind: 'emission' },
    { label: 'Si III]',             wave: 1883.0,   tier: 2, kind: 'emission' },
    { label: 'C III]',              wave: 1906.734, tier: 0, kind: 'emission' },
    { label: '[O II]',              wave: 3727.09,  tier: 0, kind: 'emission' },
    { label: 'H10',                 wave: 3797.9,   tier: 2, kind: 'emission' },
    { label: 'H9',                  wave: 3835.4,   tier: 2, kind: 'emission' },
    { label: 'Ne III',              wave: 3869,     tier: 1, kind: 'emission' },
    { label: 'H8 + He I',           wave: 3889,     tier: 2, kind: 'emission' },
    { label: 'Hε + Ne III',    wave: 3970,     tier: 2, kind: 'emission' },
    { label: 'Hδ',             wave: 4102.5,   tier: 1, kind: 'emission' },
    { label: 'Hγ',             wave: 4340.5,   tier: 1, kind: 'emission' },
    { label: '[O III] 4363',        wave: 4364,     tier: 0, kind: 'emission' },
    { label: 'He I',                wave: 4471.7,   tier: 2, kind: 'emission' },
    { label: 'Hβ',             wave: 4861.3,   tier: 0, kind: 'emission' },
    { label: '[O III]',             wave: 4958.9,   tier: 1, kind: 'emission' },
    { label: '[O III]',             wave: 5008,     tier: 0, kind: 'emission' },
    { label: '[N II]',              wave: 6548.0,   tier: 1, kind: 'emission' },
    { label: 'Hα',             wave: 6562.8,   tier: 0, kind: 'emission' },
    { label: '[N II]',              wave: 6583.4,   tier: 0, kind: 'emission' },
    { label: '[S II]',              wave: 6716.4,   tier: 1, kind: 'emission' },
    { label: '[S II]',              wave: 6730.8,   tier: 2, kind: 'emission' },

    { label: 'Si II',               wave: 1260.422, tier: 1, kind: 'absorption' },
    { label: 'O I + S II',          wave: 1302,     tier: 0, kind: 'absorption' },
    { label: 'C II',                wave: 1334.532, tier: 0, kind: 'absorption' },
    { label: 'Si IV',               wave: 1393.3,   tier: 0, kind: 'absorption' },
    { label: 'Si IV',               wave: 1402.770, tier: 1, kind: 'absorption' },
    { label: 'Si II',               wave: 1526,     tier: 1, kind: 'absorption' },
    { label: 'C IV',                wave: 1548.195, tier: 0, kind: 'absorption' },
    { label: 'Fe II',               wave: 1608.451, tier: 1, kind: 'absorption' },
    { label: 'Al II',               wave: 1670.787, tier: 0, kind: 'absorption' }
  ];

  /**
   * Vertical range covering samples i0..i1 inclusive, with headroom for labels.
   * Non-finite samples are ignored. Always returns hi > lo.
   */
  function yRangeFor(flux, err, i0, i1, showBand) {
    var lo = Infinity;
    var hi = -Infinity;

    for (var i = Math.max(0, i0); i <= Math.min(flux.length - 1, i1); i++) {
      var f = flux[i];
      if (f === null || !isFinite(f)) continue;
      var e = showBand && err[i] !== null && isFinite(err[i]) ? err[i] : 0;
      if (f - e < lo) lo = f - e;
      if (f + e > hi) hi = f + e;
    }

    if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
    if (hi - lo < 1e-9) { hi = lo + 1; }

    var span = hi - lo;
    return { lo: lo - span * 0.18, hi: hi + span * 0.42 };
  }

  /**
   * Choose which line labels can be drawn without colliding.
   * Walks tier 0, then 1, then 2, keeping a label only if it is at least
   * minGapPx from every label already kept. Returns ascending by wavelength.
   */
  function chooseLabels(lines, waveLo, waveHi, pixelWidth, minGapPx, kind) {
    var span = waveHi - waveLo;
    if (span <= 0 || pixelWidth <= 0) return [];

    var keptX = [];
    var kept = [];

    for (var tier = 0; tier <= 2; tier++) {
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.tier !== tier) continue;
        if (kind && line.kind !== kind) continue;
        if (line.wave <= waveLo || line.wave >= waveHi) continue;

        var x = ((line.wave - waveLo) / span) * pixelWidth;
        var clear = true;
        for (var k = 0; k < keptX.length; k++) {
          if (Math.abs(x - keptX[k]) < minGapPx) { clear = false; break; }
        }
        if (clear) { keptX.push(x); kept.push(line); }
      }
    }

    kept.sort(function (a, b) { return a.wave - b.wave; });
    return kept;
  }

  var PAPER = '#FCFBF8', INK = '#16181C', RULE = '#E3DED3';
  var ACCENT = '#1F3A5F', OXIDE = '#8C3A2B', MUTED = '#6E6E68';
  var PAD = { top: 46, right: 14, bottom: 34, left: 52 };

  function mount(root) {
    var canvas = root.querySelector('canvas[data-spectrum]');
    if (!canvas) return;

    var ctx = canvas.getContext('2d');
    var readout = root.querySelector('[data-readout]');
    var rangeLabel = root.querySelector('[data-range]');

    var state = {
      data: null,
      lo: 0, hi: 0,            // wavelength window
      show: { emission: true, absorption: true, band: true },
      drag: null,              // {x0, x1} in css pixels
      hover: null              // css pixel x
    };

    fetch('/assets/data/stack.json')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        state.data = d;
        state.lo = d.wave_start;
        state.hi = d.wave_start + (d.n - 1) * d.wave_step;
        resize();
      })
      .catch(function () {
        root.querySelector('.spectrum-canvas-wrap').innerHTML =
          '<img src="/assets/img/spectrum-fallback.png" alt="Stacked spectrum" style="width:100%">';
      });

    function indexOfWave(w) {
      var d = state.data;
      return Math.round((w - d.wave_start) / d.wave_step);
    }

    function cssWidth() { return canvas.clientWidth; }
    function cssHeight() { return canvas.clientHeight; }

    function plotBox() {
      return {
        x: PAD.left,
        y: PAD.top,
        w: cssWidth() - PAD.left - PAD.right,
        h: cssHeight() - PAD.top - PAD.bottom
      };
    }

    function xToWave(x) {
      var box = plotBox();
      var t = (x - box.x) / box.w;
      return state.lo + t * (state.hi - state.lo);
    }

    function waveToX(w) {
      var box = plotBox();
      return box.x + ((w - state.lo) / (state.hi - state.lo)) * box.w;
    }

    function niceTicks(lo, hi, target) {
      var raw = (hi - lo) / target;
      var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
      var norm = raw / mag;
      var step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
      var ticks = [];
      for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
      return ticks;
    }

    function resize() {
      if (!state.data) return;
      var ratio = window.devicePixelRatio || 1;
      var w = canvas.clientWidth;
      var h = Math.max(300, Math.min(420, Math.round(w * 0.40)));
      canvas.style.height = h + 'px';
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    }

    function draw() {
      var d = state.data;
      if (!d) return;

      var box = plotBox();
      var i0 = Math.max(0, indexOfWave(state.lo));
      var i1 = Math.min(d.n - 1, indexOfWave(state.hi));
      var y = yRangeFor(d.flux, d.err, i0, i1, state.show.band);

      function yToPx(v) { return box.y + box.h - ((v - y.lo) / (y.hi - y.lo)) * box.h; }

      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, cssWidth(), cssHeight());

      // Axes
      ctx.strokeStyle = RULE;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(box.x, box.y); ctx.lineTo(box.x, box.y + box.h);
      ctx.moveTo(box.x, box.y + box.h); ctx.lineTo(box.x + box.w, box.y + box.h);
      ctx.stroke();

      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = MUTED;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      niceTicks(state.lo, state.hi, 8).forEach(function (t) {
        var px = waveToX(t);
        ctx.beginPath();
        ctx.moveTo(px, box.y + box.h); ctx.lineTo(px, box.y + box.h + 3);
        ctx.stroke();
        ctx.fillText(String(Math.round(t)), px, box.y + box.h + 6);
      });

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      niceTicks(y.lo, y.hi, 5).forEach(function (t) {
        var py = yToPx(t);
        if (py < box.y || py > box.y + box.h) return;
        ctx.beginPath();
        ctx.moveTo(box.x - 3, py); ctx.lineTo(box.x, py);
        ctx.stroke();
        ctx.fillText(t.toFixed(Math.abs(t) < 10 ? 1 : 0), box.x - 6, py);
      });

      // Zero line
      if (y.lo < 0 && y.hi > 0) {
        ctx.strokeStyle = RULE;
        ctx.beginPath();
        ctx.moveTo(box.x, yToPx(0)); ctx.lineTo(box.x + box.w, yToPx(0));
        ctx.stroke();
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();

      // Uncertainty band
      if (state.show.band) {
        ctx.fillStyle = 'rgba(31, 58, 95, 0.14)';
        ctx.beginPath();
        var started = false;
        for (var i = i0; i <= i1; i++) {
          if (d.flux[i] === null || d.err[i] === null) continue;
          var px = waveToX(d.wave_start + i * d.wave_step);
          var py = yToPx(d.flux[i] + d.err[i]);
          if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
        }
        for (var j = i1; j >= i0; j--) {
          if (d.flux[j] === null || d.err[j] === null) continue;
          ctx.lineTo(waveToX(d.wave_start + j * d.wave_step), yToPx(d.flux[j] - d.err[j]));
        }
        ctx.closePath();
        ctx.fill();
      }

      // Trace
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      var pen = false;
      for (var k = i0; k <= i1; k++) {
        if (d.flux[k] === null) { pen = false; continue; }
        var kx = waveToX(d.wave_start + k * d.wave_step);
        var ky = yToPx(d.flux[k]);
        if (!pen) { ctx.moveTo(kx, ky); pen = true; } else { ctx.lineTo(kx, ky); }
      }
      ctx.stroke();
      ctx.restore();

      // Line identifications
      ctx.font = '9.5px Inter, sans-serif';
      if (state.show.emission) {
        drawLabels(chooseLabels(LINES, state.lo, state.hi, box.w, 11, 'emission'),
                   ACCENT, box, true);
      }
      if (state.show.absorption) {
        drawLabels(chooseLabels(LINES, state.lo, state.hi, box.w, 11, 'absorption'),
                   OXIDE, box, false);
      }

      // Drag selection
      if (state.drag) {
        ctx.fillStyle = 'rgba(31, 58, 95, 0.10)';
        var dx = Math.min(state.drag.x0, state.drag.x1);
        ctx.fillRect(dx, box.y, Math.abs(state.drag.x1 - state.drag.x0), box.h);
      }

      // Hover crosshair
      if (state.hover !== null && !state.drag) {
        ctx.strokeStyle = 'rgba(31, 58, 95, 0.45)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(state.hover, box.y); ctx.lineTo(state.hover, box.y + box.h);
        ctx.stroke();
      }

      // Axis titles
      ctx.fillStyle = '#3C3E42';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('Rest wavelength  [Å]', box.x + box.w / 2, cssHeight() - 6);
      ctx.save();
      ctx.translate(13, box.y + box.h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Flux', 0, 0);
      ctx.restore();

      rangeLabel.textContent = Math.round(state.lo) + ' – ' + Math.round(state.hi) + ' Å';
    }

    function drawLabels(lines, colour, box, above) {
      ctx.save();
      ctx.strokeStyle = colour;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 0.5;
      lines.forEach(function (line) {
        var px = waveToX(line.wave);
        ctx.beginPath();
        if (above) { ctx.moveTo(px, box.y); ctx.lineTo(px, box.y + box.h); }
        else { ctx.moveTo(px, box.y + box.h * 0.62); ctx.lineTo(px, box.y + box.h); }
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      ctx.fillStyle = colour;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      lines.forEach(function (line) {
        var px = waveToX(line.wave);
        ctx.save();
        if (above) { ctx.translate(px, box.y - 4); }
        else { ctx.translate(px, box.y + box.h * 0.62 - 4); }
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(line.label, 0, 0);
        ctx.restore();
      });
      ctx.restore();
    }

    function localX(event) {
      var rect = canvas.getBoundingClientRect();
      return event.clientX - rect.left;
    }

    canvas.addEventListener('mousedown', function (e) {
      var x = localX(e);
      state.drag = { x0: x, x1: x };
      draw();
    });

    window.addEventListener('mousemove', function (e) {
      if (!state.data) return;
      var box = plotBox();
      var x = localX(e);

      if (state.drag) {
        state.drag.x1 = Math.max(box.x, Math.min(box.x + box.w, x));
        draw();
        return;
      }

      var rect = canvas.getBoundingClientRect();
      var inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                   e.clientY >= rect.top && e.clientY <= rect.bottom &&
                   x >= box.x && x <= box.x + box.w;

      if (!inside) {
        if (state.hover !== null) { state.hover = null; readout.hidden = true; draw(); }
        return;
      }

      state.hover = x;
      var w = xToWave(x);
      var i = Math.max(0, Math.min(state.data.n - 1, indexOfWave(w)));
      var f = state.data.flux[i];
      var er = state.data.err[i];

      readout.hidden = false;
      readout.innerHTML =
        Math.round(w) + ' Å<br>' +
        (f === null ? 'no data' : f.toFixed(2) + ' ± ' + er.toFixed(2));
      readout.style.left = Math.min(x + 12, canvas.clientWidth - 96) + 'px';
      readout.style.top = (box.y + 6) + 'px';
      draw();
    });

    window.addEventListener('mouseup', function () {
      if (!state.drag) return;
      var box = plotBox();
      var a = Math.min(state.drag.x0, state.drag.x1);
      var b = Math.max(state.drag.x0, state.drag.x1);
      state.drag = null;

      // Ignore accidental clicks: require a selection at least 8 px wide.
      if (b - a >= 8) {
        var lo = xToWave(Math.max(box.x, a));
        var hi = xToWave(Math.min(box.x + box.w, b));
        if (hi - lo > state.data.wave_step * 4) { state.lo = lo; state.hi = hi; }
      }
      draw();
    });

    canvas.addEventListener('dblclick', reset);

    function reset() {
      var d = state.data;
      if (!d) return;
      state.lo = d.wave_start;
      state.hi = d.wave_start + (d.n - 1) * d.wave_step;
      draw();
    }

    root.querySelector('[data-reset]').addEventListener('click', reset);

    Array.prototype.forEach.call(root.querySelectorAll('[data-toggle]'), function (button) {
      button.addEventListener('click', function () {
        var key = button.getAttribute('data-toggle');
        state.show[key] = !state.show[key];
        button.setAttribute('aria-pressed', String(state.show[key]));
        draw();
      });
    });

    window.addEventListener('resize', resize);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('spectrum');
    if (root) mount(root);
  });

  global.Spectrum = { LINES: LINES, yRangeFor: yRangeFor, chooseLabels: chooseLabels, mount: mount };
}(window));
