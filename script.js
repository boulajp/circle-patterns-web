const SIZE = 600;

let fractalCanvas, fractalCtx;
let circlesCanvas, circlesCtx;

let animationId   = null;
let autoTimeoutId = null;
let theta         = 0;
let thetaMax      = 2 * Math.PI;
let thetaStep     = 0;
let params        = {};
let previousPoint = null;
let hasDrawn      = false;
let stepsPerFrame = 1;
let autoMode      = false;
let loopRandom    = false;
let lineColor     = '#e05252';
let showGuides    = false;
let instantMode   = false;

function init() {
  fractalCanvas = document.getElementById('fractalCanvas');
  fractalCtx    = fractalCanvas.getContext('2d');
  circlesCanvas = document.getElementById('circlesCanvas');
  circlesCtx    = circlesCanvas.getContext('2d');

  fractalCanvas.width  = circlesCanvas.width  = SIZE;
  fractalCanvas.height = circlesCanvas.height = SIZE;

  clearFractal();

  document.getElementById('goBtn').addEventListener('click', () => {
    if (autoMode) randomize(); else start();
  });
  document.getElementById('stopBtn').addEventListener('click', stop);
  document.getElementById('resetBtn').addEventListener('click', reset);

  document.querySelectorAll('.btn-preset[data-n]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('iterations').value = btn.dataset.n;
      document.getElementById('multiplier').value = btn.dataset.mult;
      document.getElementById('divisor').value    = btn.dataset.div;
      document.getElementById('resolution').value = btn.dataset.res;
      loopRandom = false;
      setActivePreset(btn);
      start();
    });
  });

  document.getElementById('randomBtn').addEventListener('click', randomize);
  document.getElementById('saveBtn').addEventListener('click', savePNG);
  document.getElementById('autoBtn').addEventListener('click', toggleAuto);

  document.getElementById('guidesBtn').addEventListener('click', () => {
    showGuides = !showGuides;
    const btn = document.getElementById('guidesBtn');
    btn.textContent = showGuides ? 'On' : 'Off';
    btn.classList.toggle('active', showGuides);
  });

  document.getElementById('instantBtn').addEventListener('click', () => {
    instantMode = !instantMode;
    const btn = document.getElementById('instantBtn');
    btn.textContent = instantMode ? 'On' : 'Off';
    btn.classList.toggle('active', instantMode);
  });

  loadFromHash();

  const overlay = document.getElementById('mathOverlay');
  let mathRendered = false;

  document.getElementById('infoBtn').addEventListener('click', () => {
    overlay.classList.add('open');
    if (!mathRendered && typeof renderMathInElement !== 'undefined') {
      renderMathInElement(document.getElementById('mathContent'), {
        delimiters: [
          { left: '\\[', right: '\\]', display: true  },
          { left: '\\(', right: '\\)', display: false },
        ],
      });
      mathRendered = true;
    }
  });

  document.getElementById('mathClose').addEventListener('click', () => overlay.classList.remove('open'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
}

function getParams() {
  return {
    n:    Math.max(1, parseInt(document.getElementById('iterations').value) || 8),
    mult: parseFloat(document.getElementById('multiplier').value) || -5,
    div:  parseFloat(document.getElementById('divisor').value)    || 2,
    res:  Math.max(1, parseFloat(document.getElementById('resolution').value) || 20),
  };
}

function clearFractal() {
  fractalCtx.fillStyle = '#000';
  fractalCtx.fillRect(0, 0, SIZE, SIZE);
  circlesCtx.clearRect(0, 0, SIZE, SIZE);
}

function setProgress(fraction) {
  document.getElementById('progressBar').style.width = `${Math.min(fraction * 100, 100)}%`;
}

function setButtonState(running) {
  document.getElementById('goBtn').disabled    = running;
  document.getElementById('stopBtn').disabled  = !running;
  document.getElementById('resetBtn').disabled = running;
}

function clearAutoMode() {
  autoMode = false;
  const btn = document.getElementById('autoBtn');
  btn.textContent = 'Off';
  btn.classList.remove('active');
}

function cancelAnimation() {
  if (animationId)   { cancelAnimationFrame(animationId); animationId = null; }
  if (autoTimeoutId) { clearTimeout(autoTimeoutId); autoTimeoutId = null; }
}

function loadFromHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  const [n, mult, div, res] = hash.split(',');
  if (n)    document.getElementById('iterations').value = n;
  if (mult) document.getElementById('multiplier').value = mult;
  if (div)  document.getElementById('divisor').value    = div;
  if (res)  document.getElementById('resolution').value = res;
}

function updateHash() {
  const p = getParams();
  history.replaceState(null, '', `#${p.n},${p.mult},${p.div},${p.res}`);
}

function savePNG() {
  const link = document.createElement('a');
  link.download = `circle-pattern-${Date.now()}.png`;
  link.href = fractalCanvas.toDataURL('image/png');
  link.click();
}

function getInnermostPoint(theta, mult, div, n, a, b, radius) {
  if (n === 1 || div === 0) return { x: a, y: b };
  const cx = a - (radius + radius / div) * Math.sin(theta);
  const cy = b - (radius + radius / div) * Math.cos(theta);
  return getInnermostPoint(mult * theta, mult, div, n - 1, cx, cy, radius / div);
}

function recursiveCircles(theta, mult, div, n, a, b, radius) {
  if (showGuides) {
    circlesCtx.beginPath();
    circlesCtx.arc(a, b, Math.max(1, Math.abs(radius)), 0, 2 * Math.PI);
    circlesCtx.strokeStyle = 'rgba(0, 220, 80, 0.55)';
    circlesCtx.lineWidth = 1;
    circlesCtx.stroke();
  }

  if (n === 1) {
    if (!hasDrawn) {
      previousPoint = { x: a, y: b };
      hasDrawn = true;
    } else {
      fractalCtx.beginPath();
      fractalCtx.moveTo(previousPoint.x, previousPoint.y);
      fractalCtx.lineTo(a, b);
      fractalCtx.strokeStyle = lineColor;
      fractalCtx.lineWidth = 1;
      fractalCtx.stroke();
      previousPoint = { x: a, y: b };
    }
    return;
  }

  if (div === 0) return;

  const cx = a - (radius + radius / div) * Math.sin(theta);
  const cy = b - (radius + radius / div) * Math.cos(theta);
  recursiveCircles(mult * theta, mult, div, n - 1, cx, cy, radius / div);
}

function animate() {
  circlesCtx.clearRect(0, 0, SIZE, SIZE);

  for (let i = 0; i < stepsPerFrame; i++) {
    if (theta > thetaMax) { finish(); return; }
    recursiveCircles(theta, params.mult, params.div, params.n, SIZE / 2, SIZE / 2, SIZE / 6);
    theta += thetaStep;
  }

  setProgress(theta / thetaMax);
  animationId = requestAnimationFrame(animate);
}

function finish() {
  circlesCtx.clearRect(0, 0, SIZE, SIZE);
  setProgress(1);
  animationId = null;

  if (!autoMode) {
    setButtonState(false);
    return;
  }

  const next = loopRandom ? randomize : start;

  if (instantMode) {
    setButtonState(false);
    autoTimeoutId = setTimeout(() => {
      autoTimeoutId = null;
      if (autoMode) next();
    }, 3000);
  } else {
    next();
  }
}

function setActivePreset(el) {
  document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
}

function randomize() {
  loopRandom = true;
  setActivePreset(document.getElementById('randomBtn'));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  document.getElementById('iterations').value = pick([3, 4, 5, 6, 7, 8]);
  document.getElementById('multiplier').value = pick([-8, -7, -6, -5, -4, -3, 4, 5, 6, 7, 8]);
  document.getElementById('divisor').value    = pick([2, 3, 4]);
  document.getElementById('resolution').value = pick([3, 4, 5, 8, 10, 15, 20]);
  start();
}

function start() {
  cancelAnimation();

  params    = getParams();
  theta     = 0;
  thetaStep = (1 / params.res) * 0.01;

  const totalSteps = thetaMax / thetaStep;
  stepsPerFrame = Math.max(1, Math.ceil(totalSteps / 300));

  previousPoint = null;
  hasDrawn      = false;

  clearFractal();
  setProgress(0);
  setButtonState(true);
  updateHash();

  if (instantMode) {
    fractalCtx.beginPath();
    fractalCtx.strokeStyle = lineColor;
    fractalCtx.lineWidth = 1;
    let first = true;
    while (theta <= thetaMax) {
      const { x, y } = getInnermostPoint(theta, params.mult, params.div, params.n, SIZE / 2, SIZE / 2, SIZE / 6);
      if (first) { fractalCtx.moveTo(x, y); first = false; }
      else        { fractalCtx.lineTo(x, y); }
      theta += thetaStep;
    }
    fractalCtx.stroke();
    finish();
  } else {
    animationId = requestAnimationFrame(animate);
  }
}

function stop() {
  clearAutoMode();
  cancelAnimation();
  setButtonState(false);
}

function toggleAuto() {
  autoMode = !autoMode;
  const btn = document.getElementById('autoBtn');
  btn.textContent = autoMode ? 'On' : 'Off';
  btn.classList.toggle('active', autoMode);
}

function reset() {
  stop();
  clearFractal();
  setProgress(0);
}

document.addEventListener('DOMContentLoaded', init);
