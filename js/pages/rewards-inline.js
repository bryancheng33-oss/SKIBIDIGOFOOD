/* ====================================================================
   LUCKY WHEEL ENGINE
   ====================================================================

   DESIGN PRINCIPLES
   ─────────────────
   1. Winner is determined by weighted RNG BEFORE the animation starts.
      The wheel always stops exactly on the pre-decided winner.
      Animation is purely cosmetic — not a game mechanic.

   2. Segment angles are proportional to probability.
      "Nothing" = 72 % of the wheel area.
      "Points"  = 27 % of the wheel area.
      "Mystery" =  1 % of the wheel area.

   3. Canvas API draws every frame via requestAnimationFrame.
      No CSS transitions — full control over every pixel.

   4. Easing: ease-out-quart (fast start → smooth halt).
      Duration: 5 s.  Minimum full rotations: 7.

   5. Pointer is fixed at the top. The wheel rotates clockwise.
      After total rotation R degrees, the segment under the pointer
      is the one whose arc contains (R mod 360)°, measured clockwise
      from the top of the original un-rotated wheel.

   COORDINATE SYSTEM
   ─────────────────
   • Canvas zero-angle = 3 o'clock (east), clockwise = positive.
   • Our "wheel angle" zero = 12 o'clock (top), clockwise = positive.
   • Conversion: canvasRad = toRad(wheelDeg − 90)

   SEGMENT LAYOUT (clockwise from top)
   ────────────────────────────────────
   Segment           Prob    Sweep       StartDeg   MidDeg
   Nothing-A       21.7 %     78°           0°        39°
   Points            33 %    118.8°         78°       137.4°
   Nothing-B       21.7 %     78°         196.8°      235.8°
   Mystery            2 %      7.2°       274.8°      278.4°
   Nothing-C       21.7 %     78°         282°        321°
   ────────────────────────────────────
   Total            100 %    360°

==================================================================== */

requireAuth();

function tr(key, vars) {
  return window.I18N ? I18N.t(key, vars) : key;
}

function rewardEsc(value) {
  if (typeof sgfEscapeHtml === 'function') return sgfEscapeHtml(value);
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function currentLang() { return 'en'; }

function syncWheelStaticText() {
  const vars = getWheelTextVars();
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  set('bday-title', tr('rewards.birthdaySpecial'));
  set('bday-btn-label', tr('rewards.claimBirthday'));
  set('wheelTitle', tr('rewards.wheelTitle'));
  set('wheelSubtitle', tr('rewards.wheelSubtitle', vars));
  set('wheelStatCost', tr('rewards.statCost', vars));
  set('wheelStatJackpot', tr('rewards.statJackpot', vars));
  set('wheelStatRare', tr('rewards.statRare', vars));
  set('hubLabel', tr('rewards.hubSpin'));
  set('hubCost', tr('rewards.hubCost', vars));
  set('spinBtnLabel', isSpinning ? tr('rewards.spinning') : tr('rewards.spinButton'));
  set('spinCostNote', tr('rewards.spinCostNote', vars));
  set('spinHint', tr('rewards.spinHint', vars));
  set('balanceTitle', tr('rewards.balanceTitle'));
  set('balanceLabel', tr('rewards.balanceLabel'));
  set('probTitle', tr('rewards.probabilities'));
  set('resultIdle', tr('rewards.resultIdle', vars));
  set('historyTitle', tr('rewards.recentSpins'));
  set('historyClear', tr('common.clear'));
}

function syncSegmentLabels() {
  SEGMENTS.forEach(seg => {
    if (seg.type === 'nothing') {
      seg.label = 'NOTHING';
      seg.sublabel = null;
    } else if (seg.type === 'points') {
      seg.label = 'POINTS';
      seg.sublabel = formatPointsRange(WHEEL_CONFIG.pointsValues[0], WHEEL_CONFIG.pointsValues[WHEEL_CONFIG.pointsValues.length - 1]);
    } else if (seg.type === 'mystery') {
      seg.label = 'MYSTERY';
      seg.sublabel = formatProb(WHEEL_CONFIG.mysteryProb);
    }
  });
}

let lastResultState = null;

const WHEEL_CONFIG = Object.freeze({
  spinCost: 30,
  minRotations: 7,
  maxRotations: 11,
  durationMs: 5000,
  nothingProb: 0.72,
  pointsProb: 0.27,
  mysteryProb: 0.01,
  pointsValues: [30, 50, 80, 100, 150],
  mysteryRange: { min: 120, max: 220 },
});

const TOTAL_WIN_PROB = WHEEL_CONFIG.pointsProb + WHEEL_CONFIG.mysteryProb;

function formatProb(prob) {
  const pct = prob * 100;
  const rounded = Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1);
  return `${rounded}%`;
}

function unitPts() { return 'pts'; }

function formatPointsRange(min, max) {
  return `${min} – ${max} ${unitPts()}`;
}

function getWheelTextVars() {
  return {
    cost: WHEEL_CONFIG.spinCost,
    winRate: formatProb(TOTAL_WIN_PROB),
    rareRate: formatProb(WHEEL_CONFIG.mysteryProb),
    nothingRate: formatProb(WHEEL_CONFIG.nothingProb),
  };
}

/* ──────────────────────────────────────────────────────
   1. SEGMENT DEFINITIONS
   ────────────────────────────────────────────────────── */
const SEGMENTS = [
  {
    key:       'nothing-a',
    label:     'Nothing',
    sublabel:  null,
    prob:      0.24,        // 24 %
    fillStyle: '#20252d',
    rimStyle:  '#343c47',
    textFill:  '#dbe2eb',
    type:      'nothing',
  },
  {
    key:       'points',
    label:     'POINTS',
    sublabel:  null,
    prob:      WHEEL_CONFIG.pointsProb,        // 27 %
    fillStyle: '#fed330',
    rimStyle:  '#e6bc00',
    textFill:  '#1f2937',
    type:      'points',
  },
  {
    key:       'nothing-b',
    label:     'Nothing',
    sublabel:  null,
    prob:      0.24,        // 24 %
    fillStyle: '#1b2027',
    rimStyle:  '#2f3641',
    textFill:  '#d4dbe5',
    type:      'nothing',
  },
  {
    key:       'mystery',
    label:     'MYSTERY',
    sublabel:  null,
    prob:      WHEEL_CONFIG.mysteryProb,        //  1 %
    fillStyle: '#27ae60',
    rimStyle:  '#1e8449',
    textFill:  '#ffffff',
    type:      'mystery',
  },
  {
    key:       'nothing-c',
    label:     'Nothing',
    sublabel:  null,
    prob:      0.24,        // 24 %
    fillStyle: '#171b21',
    rimStyle:  '#29303a',
    textFill:  '#d2d9e2',
    type:      'nothing',
  },
];

/* Verify: probabilities must sum to exactly 1.0 */
(function () {
  const sum = SEGMENTS.reduce((s, g) => s + g.prob, 0);
  if (Math.abs(sum - 1.0) > 1e-9)
    console.error('[Wheel] prob sum =', sum, '(must be 1.0)');
})();

/* ──────────────────────────────────────────────────────
   2. LAYOUT — compute startDeg / sweepDeg / midDeg
   ────────────────────────────────────────────────────── */
let _cum = 0;
SEGMENTS.forEach(seg => {
  seg.startDeg = _cum;
  seg.sweepDeg = seg.prob * 360;          // proportional arc
  seg.midDeg   = seg.startDeg + seg.sweepDeg / 2;  // pointer target
  _cum        += seg.sweepDeg;
});

/* ──────────────────────────────────────────────────────
   3. CANVAS SETUP
   ────────────────────────────────────────────────────── */
const canvas = document.getElementById('wheelCanvas');
const ctx    = canvas.getContext('2d');

// Logical canvas size (matches width/height attributes)
const CANVAS_SIZE = 460;
const CX          = CANVAS_SIZE / 2;
const CY          = CANVAS_SIZE / 2;
const R           = CX - 4;           // outer radius of wheel
const R_RIM       = R - 1;            // inner edge of rim band
const R_RIM_W     = 11;               // rim band radial width
const R_TEXT      = R * 0.69;         // base radius at which labels sit
const R_HUB       = 48;               // radius of hub hole
const NARROW_SEGMENT_DEG = 10;        // use external callout for ultra-thin slices

/**
 * Convert our "clockwise from top" wheel degrees to a
 * canvas arc angle (radians, measured from east, clockwise).
 */
function wDegToRad(wheelDeg) {
  return (wheelDeg - 90) * Math.PI / 180;
}

/**
 * Draw the entire wheel at the given cumulative rotation (degrees).
 * Called every animation frame.
 */
function drawWheel(rotDeg) {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  /* Background disc */
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a0a';
  ctx.fill();

  /* Draw each segment */
  SEGMENTS.forEach(seg => {
    const startRad = wDegToRad(seg.startDeg + rotDeg);
    const endRad   = wDegToRad(seg.startDeg + seg.sweepDeg + rotDeg);

    /* ── Main fill ── */
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, R, startRad, endRad);
    ctx.closePath();
    ctx.fillStyle = seg.fillStyle;
    ctx.fill();

    /* ── Rim band (outer arc strip) ── */
    ctx.beginPath();
    ctx.arc(CX, CY, R_RIM,          startRad, endRad);
    ctx.arc(CX, CY, R_RIM - R_RIM_W, endRad,  startRad, true);
    ctx.closePath();
    ctx.fillStyle = seg.rimStyle;
    ctx.fill();

    /* ── Dividing line at start of segment ── */
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.lineTo(CX + R * Math.cos(startRad), CY + R * Math.sin(startRad));
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    /* ── Label text ── */
    const midRad = wDegToRad(seg.midDeg + rotDeg);

    const labelRadius = seg.sweepDeg >= 70 ? R * 0.61 : seg.sweepDeg >= 32 ? R * 0.66 : R_TEXT;
    const maxTextWidth = Math.max(38, (seg.sweepDeg / 360) * (2 * Math.PI * labelRadius) - 16);

    if (seg.sweepDeg < NARROW_SEGMENT_DEG) {
      const markerRadius = R * 0.76;
      const markerX = CX + markerRadius * Math.cos(midRad);
      const markerY = CY + markerRadius * Math.sin(midRad);
      const labelRadiusOuter = R * 0.92;
      const labelX = CX + labelRadiusOuter * Math.cos(midRad);
      const labelY = CY + labelRadiusOuter * Math.sin(midRad);

      ctx.beginPath();
      ctx.arc(markerX, markerY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(markerX, markerY);
      ctx.lineTo(labelX, labelY);
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(labelX, labelY);
      const normalizedDeg = ((seg.midDeg + rotDeg) % 360 + 360) % 360;
      ctx.rotate(normalizedDeg > 90 && normalizedDeg < 270 ? Math.PI : 0);
      const horizontalBias = Math.cos(midRad);
      let textAlign = 'center';
      let textOffsetX = 0;
      if (horizontalBias < -0.25) {
        textAlign = 'left';
        textOffsetX = 10;
      } else if (horizontalBias > 0.25) {
        textAlign = 'right';
        textOffsetX = -10;
      }
      ctx.textAlign = textAlign;
      ctx.textBaseline = 'middle';
      ctx.font = `800 10px Inter, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = 4;
      ctx.fillText(seg.label, textOffsetX, -9, 60);
      if (seg.sublabel) {
        ctx.font = `600 8px Inter, sans-serif`;
        ctx.globalAlpha = 0.95;
        ctx.fillText(seg.sublabel, textOffsetX, 5, 60);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      return;
    }

    function fitFont(textValue, baseSize, weight) {
      let size = baseSize;
      while (size > 9) {
        ctx.font = `${weight} ${size}px Inter, sans-serif`;
        if (ctx.measureText(textValue).width <= maxTextWidth) return size;
        size -= 1;
      }
      return size;
    }

    ctx.save();
    ctx.translate(
      CX + labelRadius * Math.cos(midRad),
      CY + labelRadius * Math.sin(midRad)
    );
    const normalizedDeg = ((seg.midDeg + rotDeg) % 360 + 360) % 360;
    let textRotation = midRad + Math.PI / 2;
    if (normalizedDeg > 90 && normalizedDeg < 270) {
      textRotation += Math.PI;
    }
    ctx.rotate(textRotation);
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    const primarySize = fitFont(seg.label, seg.sweepDeg >= 70 ? 16 : seg.sweepDeg >= 40 ? 14 : 12, '800');
    const secondarySize = seg.sublabel ? fitFont(seg.sublabel, Math.max(primarySize - 2, 10), '600') : 0;

    ctx.fillStyle = seg.textFill;
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 3;

    const hasSubLabel = !!seg.sublabel && seg.sweepDeg >= 24;
    const primaryY = hasSubLabel ? -(secondarySize * 0.55 + 2) : 0;
    ctx.font = `800 ${primarySize}px Inter, sans-serif`;
    ctx.fillText(seg.label, 0, primaryY);

    if (hasSubLabel) {
      ctx.font = `600 ${secondarySize}px Inter, sans-serif`;
      ctx.globalAlpha = 0.9;
      ctx.fillText(seg.sublabel, 0, primaryY + primarySize * 0.95 + 2);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  });

  /* ── Outer ring stroke ── */
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.strokeStyle = '#596273';
  ctx.lineWidth   = 2;
  ctx.stroke();

  /* ── Tick marks every 6° (one per each 1% of probability) ── */
  for (let d = 0; d < 360; d += 6) {
    const rad     = wDegToRad(d + rotDeg);
    const isMajor = d % 30 === 0;
    const len     = isMajor ? 14 : 7;
    ctx.beginPath();
    ctx.moveTo(CX + R       * Math.cos(rad), CY + R       * Math.sin(rad));
    ctx.lineTo(CX + (R-len) * Math.cos(rad), CY + (R-len) * Math.sin(rad));
    ctx.strokeStyle = isMajor ? '#6c7688' : '#343b47';
    ctx.lineWidth   = isMajor ? 2 : 1;
    ctx.stroke();
  }

  /* ── Hub hole (clears centre so HTML hub overlays it) ── */
  ctx.beginPath();
  ctx.arc(CX, CY, R_HUB, 0, Math.PI * 2);
  ctx.fillStyle = '#0d0d0d';
  ctx.fill();
  /* Hub ring */
  ctx.beginPath();
  ctx.arc(CX, CY, R_HUB, 0, Math.PI * 2);
  ctx.strokeStyle = '#2c2c2c';
  ctx.lineWidth   = 2;
  ctx.stroke();
}

/* Initial static draw */
drawWheel(0);

/* ──────────────────────────────────────────────────────
   4. PROBABILITY TABLE + LEGEND
   ────────────────────────────────────────────────────── */
function buildProbUI() {
  const displayRows = [
    { type: 'nothing', label: tr('rewards.legend.nothing'), prize: tr('rewards.resultHeadline.nothing'), prob: WHEEL_CONFIG.nothingProb, color: '#95a0ad' },
    { type: 'points',  label: tr('rewards.legend.points'), prize: formatPointsRange(WHEEL_CONFIG.pointsValues[0], WHEEL_CONFIG.pointsValues[WHEEL_CONFIG.pointsValues.length - 1]), prob: WHEEL_CONFIG.pointsProb, color: '#fed330' },
    { type: 'mystery', label: tr('rewards.legend.mystery'), prize: tr('rewards.legend.mysteryPrize'), prob: WHEEL_CONFIG.mysteryProb, color: '#27ae60' },
  ];

  document.getElementById('prob-rows').innerHTML = displayRows.map(r => {
    const pct  = formatProb(r.prob);
    const barW = Math.max(r.type === 'mystery' ? 4 : 8, Math.round(r.prob * 100));
    return `
    <div class="prob-row">
      <div class="prob-dot" style="background:${r.color}"></div>
      <div class="prob-name t-${r.type}">${rewardEsc(r.label)}</div>
      <div class="prob-prize">${rewardEsc(r.prize)}</div>
      <div class="prob-bar">
        <div class="prob-bar-fill" style="width:${barW}%;background:${r.color}"></div>
      </div>
      <div class="prob-pct">${rewardEsc(pct)}</div>
    </div>`;
  }).join('');

  document.getElementById('seg-legend').innerHTML = displayRows.map(r => `
    <div class="seg-legend-item">
      <div class="ld" style="background:${r.color}"></div>
      <span>${rewardEsc(r.label)} &mdash; ${rewardEsc(formatProb(r.prob))}</span>
    </div>`).join('');
}

/* ──────────────────────────────────────────────────────
   5. SPIN ENGINE
   ────────────────────────────────────────────────────── */
const SPIN_COST     = WHEEL_CONFIG.spinCost;
const MIN_ROTATIONS = WHEEL_CONFIG.minRotations;
const MAX_ROTATIONS = WHEEL_CONFIG.maxRotations;
const SPIN_DURATION = WHEEL_CONFIG.durationMs;

let currentRotation = 0;      // total degrees rotated so far (never resets)
let isSpinning      = false;
let rafHandle       = null;

/* ── Weighted RNG: returns the winning segment object ── */
function pickWinnerSegment() {
  const r = Math.random();     // uniform [0, 1)
  let accum = 0;
  for (const seg of SEGMENTS) {
    accum += seg.prob;
    if (r < accum) return seg;
  }
  /* Floating-point safety fallback */
  return SEGMENTS[SEGMENTS.length - 1];
}

/* ── Prize value rollers ── */
function rollPointsValue() {
  /*
    Tiered distribution so smaller wins are more common.
    Weights are not probabilities of the spin itself,
    just the distribution WITHIN the Points segment.
  */
  const tiers = [
    { value: WHEEL_CONFIG.pointsValues[0], weight: 38 },
    { value: WHEEL_CONFIG.pointsValues[1], weight: 27 },
    { value: WHEEL_CONFIG.pointsValues[2], weight: 18 },
    { value: WHEEL_CONFIG.pointsValues[3], weight: 11 },
    { value: WHEEL_CONFIG.pointsValues[4], weight:  6 },
  ];
  const total = tiers.reduce((s, t) => s + t.weight, 0);
  let r       = Math.random() * total;
  for (const t of tiers) {
    r -= t.weight;
    if (r <= 0) return t.value;
  }
  return WHEEL_CONFIG.pointsValues[0];
}

function rollMysteryValue() {
  return Math.floor(Math.random() * (WHEEL_CONFIG.mysteryRange.max - WHEEL_CONFIG.mysteryRange.min + 1)) + WHEEL_CONFIG.mysteryRange.min;
}

/* ── Easing: ease-out quart ── */
function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

/* ── Main entry-point called by button / hub ── */
function initSpin() {
  if (isSpinning) return;

  if (State.getPoints() < SPIN_COST) {
    State.notify(tr('rewards.notify.needSpinPoints', { cost: SPIN_COST, points: State.getPoints() }));
    return;
  }

  /* Deduct cost immediately */
  if (!State.deductPoints(SPIN_COST)) return;

  isSpinning = true;
  setUISpinning(true);
  clearResult();
  updateHeader();
  syncBalance();

  /* Pick winner BEFORE any animation */
  const winner = pickWinnerSegment();

  /*
    Compute how much to rotate so the pointer (top = 0°) aligns
    with the mid-point of the winning segment.

    Because the wheel itself rotates clockwise under a fixed pointer,
    the segment midpoint must land at the inverse of the final wheel
    rotation angle.

    We want: (winner.midDeg + finalRotation) mod 360 = 0
    So:      finalRotation mod 360 = (360 - winner.midDeg) mod 360

    Add full turns for drama.
  */
  const currentMod = ((currentRotation % 360) + 360) % 360;
  let   delta      = (((360 - winner.midDeg) - currentMod) + 360) % 360;

  /* Ensure a minimum partial-turn within this rotation batch */
  if (delta < 10) delta += 360;

  const fullTurns   = MIN_ROTATIONS + Math.floor(Math.random() * (MAX_ROTATIONS - MIN_ROTATIONS + 1));
  const totalDelta  = fullTurns * 360 + delta;
  const startRot    = currentRotation;
  const endRot      = startRot + totalDelta;
  const startTime   = performance.now();

  function frame(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / SPIN_DURATION, 1);
    const eased    = easeOutQuart(progress);

    currentRotation = startRot + totalDelta * eased;
    drawWheel(currentRotation);

    if (progress < 1) {
      rafHandle = requestAnimationFrame(frame);
    } else {
      /* Snap to exact angle — eliminates floating-point drift */
      currentRotation = endRot;
      drawWheel(currentRotation);
      onSpinComplete(winner);
    }
  }

  rafHandle = requestAnimationFrame(frame);
}

/* ── Called once the wheel fully stops ── */
function onSpinComplete(winner) {
  isSpinning = false;
  setUISpinning(false);

  let ptsValue = 0;

  if (winner.type === 'points') {
    ptsValue = rollPointsValue();
    State.addPoints(ptsValue);
    State.notify(tr('rewards.notify.winPoints', { pts: ptsValue }));
    lastResultState = { type: 'points', ptsValue };

  } else if (winner.type === 'mystery') {
    ptsValue = rollMysteryValue();
    State.addPoints(ptsValue);
    State.notify(tr('rewards.notify.winMystery', { pts: ptsValue }));
    lastResultState = { type: 'mystery', ptsValue };

  } else {
    State.notify(tr('rewards.notify.nothing', getWheelTextVars()));
    lastResultState = { type: 'nothing' };
  }

  renderLastResult();
  addHistoryEntry({ type: winner.type, ptsValue, createdAt: new Date().toISOString() });
  updateHeader();
  syncBalance();
}

/* ──────────────────────────────────────────────────────
   6. UI HELPERS
   ────────────────────────────────────────────────────── */
function setUISpinning(spinning) {
  const btn  = document.getElementById('spinBtn');
  const hub  = document.getElementById('hubBtn');
  const icon = document.getElementById('spinIcon');

  if (btn) btn.disabled = spinning;
  if (hub) hub.classList.toggle('is-spinning', spinning);
  if (icon) icon.className = spinning ? 'fas fa-circle-notch fa-spin' : 'fas fa-sync-alt';
  syncWheelStaticText();
}

function syncBalance() {
  const el = document.getElementById('ptsBal');
  if (el) el.textContent = State.getPoints();
  if (window.refreshRewardsPage) window.refreshRewardsPage();
}

function showResult(type, badge, headline, sub) {
  const card = document.getElementById('resultCard');
  card.className = `spin-card result-card r-${type}`;

  document.getElementById('resultIdle').style.display    = 'none';
  document.getElementById('resultContent').style.display = 'block';
  document.getElementById('resBadge').textContent        = badge;
  document.getElementById('resHeadline').textContent     = headline;
  document.getElementById('resSub').textContent          = sub;
}

function renderLastResult() {
  if (!lastResultState) {
    clearResult();
    return;
  }
  if (lastResultState.type === 'points') {
    showResult(
      'points',
      tr('rewards.resultBadge.points'),
      tr('rewards.resultHeadline.points', { pts: lastResultState.ptsValue }),
      tr('rewards.resultSub.points')
    );
  } else if (lastResultState.type === 'mystery') {
    showResult(
      'mystery',
      tr('rewards.resultBadge.mystery'),
      tr('rewards.resultHeadline.mystery', { pts: lastResultState.ptsValue }),
      tr('rewards.resultSub.mystery', getWheelTextVars())
    );
  } else {
    showResult(
      'nothing',
      tr('rewards.resultBadge.nothing'),
      tr('rewards.resultHeadline.nothing'),
      tr('rewards.resultSub.nothing', getWheelTextVars())
    );
  }
}

function clearResult() {
  lastResultState = null;
  const card = document.getElementById('resultCard');
  card.className = 'spin-card result-card';
  document.getElementById('resultIdle').style.display    = 'block';
  document.getElementById('resultContent').style.display = 'none';
}

/* ──────────────────────────────────────────────────────
   7. SPIN HISTORY (dynamic + local fallback, last 25 entries)
   ────────────────────────────────────────────────────── */
let spinHistory = [];

function loadSpinHistory() {
  spinHistory = State.getSpinHistory ? State.getSpinHistory() : [];
  renderHistory();
}

function addHistoryEntry(entry) {
  spinHistory = State.addSpinHistoryEntry ? State.addSpinHistoryEntry(entry) : [{ ...entry, createdAt: entry.createdAt || new Date().toISOString() }];
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  if (!spinHistory.length) {
    list.innerHTML = `<div class="history-empty-msg">${rewardEsc(tr('rewards.noSpins'))}</div>`;
    return;
  }
  list.innerHTML = spinHistory.map(h => {
    const dotColor =
      h.type === 'points'  ? '#fed330' :
      h.type === 'mystery' ? '#27ae60' : '#95a0ad';
    const labelColor =
      h.type === 'points'  ? '#c99610' :
      h.type === 'mystery' ? '#0f9f57' : '#334155';
    const createdAt = h.createdAt ? new Date(h.createdAt) : null;
    const displayTime = createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })
      : (h.time || '');
    let label = tr('rewards.history.nothing');
    if (h.type === 'points') {
      label = tr('rewards.history.points', { pts: Number(h.ptsValue) || 0 });
    } else if (h.type === 'mystery') {
      label = tr('rewards.history.mystery', { pts: Number(h.ptsValue) || 0 });
    }
    return `
    <div class="history-entry">
      <div class="he-dot" style="background:${dotColor}"></div>
      <div class="he-label" style="color:${labelColor}">${rewardEsc(label)}</div>
      <div class="he-time">${rewardEsc(displayTime)}</div>
    </div>`;
  }).join('');
}

function clearHistory() {
  spinHistory = State.clearSpinHistory ? State.clearSpinHistory() : [];
  renderHistory();
}

/* ──────────────────────────────────────────────────────
   8. RESPONSIVE CANVAS RESIZE
   ────────────────────────────────────────────────────── */
function resizeCanvas() {
  const stage     = document.querySelector('.wheel-stage');
  const container = document.querySelector('.wheel-panel');
  if (!stage || !container) return;
  const available = Math.min(container.clientWidth, 460);
  const size = available < 460 ? available : 460;
  canvas.style.width   = size + 'px';
  canvas.style.height  = size + 'px';
  stage.style.width    = size + 'px';
  stage.style.height   = size + 'px';
  drawWheel(currentRotation);
}

/* ──────────────────────────────────────────────────────
   9. INIT
   ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  syncSegmentLabels();
  syncWheelStaticText();
  buildProbUI();
  drawWheel(currentRotation);
  syncBalance();
  renderLastResult();
  loadSpinHistory();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
});

window.addEventListener('sgf:langchange', () => {
  syncSegmentLabels();
  syncWheelStaticText();
  buildProbUI();
  drawWheel(currentRotation);
  renderHistory();
  renderLastResult();
});
