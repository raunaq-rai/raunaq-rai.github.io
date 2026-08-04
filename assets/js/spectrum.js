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

  global.Spectrum = { LINES: LINES, yRangeFor: yRangeFor, chooseLabels: chooseLabels };
}(window));
