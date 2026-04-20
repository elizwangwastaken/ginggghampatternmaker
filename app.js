/* ─────────────────────────────────────────
   Gingggggham Pattern Maker — App Logic
───────────────────────────────────────── */

// ── State ──────────────────────────────────
const DEFAULT_STATE = {
  squareWidth:   60,
  squareHeight:  60,
  color1:        '#e63946',
  color1Opacity: 100,
  color2:        '#457b9d',
  color2Opacity: 100,
  bgColor:       '#ffffff',
  overlapAuto:   true,
  overlapColor:  '#8b0000',
  isPlaid:       false,
  noiseAmount:   0,
};

const state = { ...DEFAULT_STATE };

// ── DOM refs ────────────────────────────────
const $ = id => document.getElementById(id);

const squareWidthSliderInput  = $('squareWidthSlider');
const squareWidthInput        = $('squareWidth');
const squareWidthUnit         = $('squareWidthUnit');
const widthAxisTag            = $('widthAxisTag');
const squareHeightSliderInput = $('squareHeightSlider');
const squareHeightInput       = $('squareHeight');
const heightSliderRow         = $('heightSliderRow');

const color1Input         = $('color1');
const color1OpacityInput  = $('color1Opacity');
const color1OpacityValue  = $('color1OpacityValue');
const color2Input         = $('color2');
const color2OpacityInput  = $('color2Opacity');
const color2OpacityValue  = $('color2OpacityValue');
const bgColorInput        = $('bgColor');
const overlapAutoInput    = $('overlapAuto');
const overlapColorInput   = $('overlapColor');

const previewEl           = $('preview');
const previewMeta         = $('previewMeta');
const colorStrip          = $('colorStrip');
const patternNote         = $('patternNote');
const copySVGBtn          = $('copySVG');
const downloadPNGBtn      = $('downloadPNG');
const toast               = $('toast');

const color1Preview       = $('color1Preview');
const color2Preview       = $('color2Preview');
const bgColorPreview      = $('bgColorPreview');
const overlapColorPreview = $('overlapColorPreview');
const color1Hex           = $('color1Hex');
const color2Hex           = $('color2Hex');
const bgColorHex          = $('bgColorHex');
const overlapColorHex     = $('overlapColorHex');
const overlapSwatch       = document.querySelector('.overlap-swatch');

const segBtns             = document.querySelectorAll('.seg-btn');
const allSliders          = document.querySelectorAll('.slider');

const noiseAmountInput    = $('noiseAmount');
const noiseAmountNum      = $('noiseAmountNum');
const resetBtn            = $('resetSettings');
const randomizePaletteBtn = $('randomizePalette');

// Maximum PNG export dimension — prevents canvas memory crash
const MAX_EXPORT_PX = 6000;

// ── Color Utilities ─────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b]
    .map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
    .join('');
}

// Photoshop multiply: (A × B) / 255 per channel
function multiplyBlend(hex1, hex2) {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);
  return rgbToHex(
    (a.r * b.r) / 255,
    (a.g * b.g) / 255,
    (a.b * b.b) / 255,
  );
}

// rgba() string for canvas drawing (opacity 0–100)
function hexRgba(hex, opacity) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${opacity / 100})`;
}

// Approximate overlap for swatch display (full-opacity multiply result)
function approxOverlap() {
  return state.overlapAuto
    ? multiplyBlend(state.color1, state.color2)
    : state.overlapColor;
}

// HSL → hex for random palette generation
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return '#' + [f(0), f(8), f(4)]
    .map(v => Math.round(v * 255).toString(16).padStart(2, '0'))
    .join('');
}

// ── Slider Track Fill ────────────────────────
// Sets --fill custom property so the CSS track gradient matches the thumb.
function updateTrack(input) {
  const min = parseFloat(input.min) || 0;
  const max = parseFloat(input.max) || 100;
  const pct = ((parseFloat(input.value) - min) / (max - min)) * 100;
  input.style.setProperty('--fill', `${pct}%`);
}

// ── Swatch Color Helper ──────────────────────
function setSwatchColor(el, hex, opacity = 100) {
  el.style.setProperty('--swatch-color', hexRgba(hex, opacity));
}

// ── SVG Generation ──────────────────────────
//
// Auto mode (mix-blend-mode: multiply):
//   Layer 1 — horizontal stripes: bgColor on even rows, color2 on odd rows
//   Layer 2 — vertical multiply:  white (no-op) on even cols, color1 on odd cols
//
// Custom mode: explicit 4-rect tile, no blend mode.
//
// Export = 4 tiles per axis (8×8 cells).
// Preview = tiles at actual squareWidth px — bigger slider value = bigger tiles.

function buildAutoSVG(unitW, unitH, totalW, totalH) {
  const c1Op  = state.color1Opacity / 100;
  const c2Op  = state.color2Opacity / 100;
  const tileW = unitW * 2;
  const tileH = unitH * 2;
  const { defs: grainDefs, layer: grainLayer } = buildGrainLayer(totalW, totalH);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" shape-rendering="crispEdges">
  <defs>
    <pattern id="h" x="0" y="0" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse">
      <rect x="0" y="0"       width="${tileW}" height="${unitH}" fill="${state.bgColor}"/>
      <rect x="0" y="${unitH}" width="${tileW}" height="${unitH}" fill="${state.color2}" fill-opacity="${c2Op}"/>
    </pattern>
    <pattern id="v" x="0" y="0" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse">
      <rect x="0"       y="0" width="${tileW}" height="${tileH}" fill="#ffffff"/>
      <rect x="${unitW}" y="0" width="${unitW}" height="${tileH}" fill="${state.color1}" fill-opacity="${c1Op}"/>
    </pattern>${grainDefs}
  </defs>
  <rect width="${totalW}" height="${totalH}" fill="url(#h)"/>
  <rect width="${totalW}" height="${totalH}" fill="url(#v)" style="mix-blend-mode:multiply"/>${grainLayer}
</svg>`;
}

function buildCustomSVG(unitW, unitH, totalW, totalH) {
  const c1Op  = state.color1Opacity / 100;
  const c2Op  = state.color2Opacity / 100;
  const tileW = unitW * 2;
  const tileH = unitH * 2;
  const { defs: grainDefs, layer: grainLayer } = buildGrainLayer(totalW, totalH);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" shape-rendering="crispEdges">
  <defs>
    <pattern id="gingham" x="0" y="0" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse">
      <rect x="0"        y="0"        width="${unitW}" height="${unitH}" fill="${state.bgColor}"/>
      <rect x="${unitW}" y="0"        width="${unitW}" height="${unitH}" fill="${state.color1}" fill-opacity="${c1Op}"/>
      <rect x="0"        y="${unitH}" width="${unitW}" height="${unitH}" fill="${state.color2}" fill-opacity="${c2Op}"/>
      <rect x="${unitW}" y="${unitH}" width="${unitW}" height="${unitH}" fill="${state.overlapColor}"/>
    </pattern>${grainDefs}
  </defs>
  <rect width="${totalW}" height="${totalH}" fill="url(#gingham)"/>${grainLayer}
</svg>`;
}

function buildSVG(unitW, unitH, totalW, totalH) {
  return state.overlapAuto
    ? buildAutoSVG(unitW, unitH, totalW, totalH)
    : buildCustomSVG(unitW, unitH, totalW, totalH);
}

// ── Grain Noise Layer ────────────────────────
// Injects a grain overlay into the SVG. Higher noiseAmount = more visible texture.
function buildGrainLayer(totalW, totalH) {
  if (state.noiseAmount === 0) return { defs: '', layer: '' };
  // Use two filters: one multiply (darkens), one screen (lightens) for full contrast range
  const opacity = (state.noiseAmount / 100 * 0.7).toFixed(3);
  return {
    defs: `
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves="4" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>`,
    layer: `
  <rect width="${totalW}" height="${totalH}" filter="url(#grain)" opacity="${opacity}" style="mix-blend-mode:overlay; pointer-events:none"/>`,
  };
}

// Preview: tiles shown at actual squareWidth px — drag the slider to see bigger/smaller tiles.
function buildPreviewSVG(containerSize) {
  return buildSVG(state.squareWidth, state.squareHeight, containerSize, containerSize);
}

// Export: 4 tiles per axis (8×8 cells at squareWidth px each).
function buildExportSVG() {
  const tilesPerAxis = 4;
  const totalW = tilesPerAxis * 2 * state.squareWidth;
  const totalH = tilesPerAxis * 2 * state.squareHeight;
  return buildSVG(state.squareWidth, state.squareHeight, totalW, totalH);
}

// ── Render ──────────────────────────────────
function render() {
  const overlap     = approxOverlap();
  const containerSz = previewEl.offsetWidth || 560;

  previewEl.innerHTML = buildPreviewSVG(containerSz);

  setSwatchColor(color1Preview, state.color1, state.color1Opacity);
  setSwatchColor(color2Preview, state.color2, state.color2Opacity);
  setSwatchColor(bgColorPreview, state.bgColor, 100);
  setSwatchColor(overlapColorPreview, overlap, 100);

  color1Hex.textContent       = state.color1.toUpperCase();
  color2Hex.textContent       = state.color2.toUpperCase();
  bgColorHex.textContent      = state.bgColor.toUpperCase();
  overlapColorHex.textContent = state.overlapAuto
    ? `${overlap.toUpperCase()} · blend`
    : overlap.toUpperCase();

  previewMeta.textContent = state.isPlaid
    ? `${state.squareWidth} × ${state.squareHeight}px tiles`
    : `${state.squareWidth}px squares`;

  colorStrip.innerHTML = [
    [state.bgColor,  100,                   'Background'],
    [state.color1,   state.color1Opacity,   'Color 1'],
    [state.color2,   state.color2Opacity,   'Color 2'],
    [overlap,        100,                   'Overlap'],
  ].map(([c, op, label]) =>
    `<div class="color-chip" style="background:${hexRgba(c, op)}" title="${label}"></div>`
  ).join('');

  const tileW = state.squareWidth * 2;
  const tileH = state.squareHeight * 2;
  patternNote.textContent = state.isPlaid
    ? `Tile: ${tileW} × ${tileH}px · repeating`
    : `Tile: ${tileW} × ${tileW}px · repeating`;
}

// ── Plaid Mode Toggle ────────────────────────
function setPlaidMode(isPlaid) {
  state.isPlaid = isPlaid;

  widthAxisTag.textContent      = isPlaid ? '↔' : '';
  heightSliderRow.style.display = isPlaid ? 'flex' : 'none';
  squareWidthUnit.textContent   = 'px';

  segBtns.forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.mode === 'plaid') === isPlaid);
  });

  render();
}

// ── Overlap Mode Toggle ──────────────────────
function setOverlapAuto(isAuto) {
  state.overlapAuto = isAuto;
  overlapColorInput.classList.toggle('visible', !isAuto);
  overlapSwatch.classList.toggle('non-interactive', isAuto);

  if (!isAuto) {
    const blend = multiplyBlend(state.color1, state.color2);
    overlapColorInput.value = blend;
    state.overlapColor = blend;
  }
  render();
}

// ── Toast ────────────────────────────────────
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── Button Success Flash ─────────────────────
function flashSuccess(btn, delay = 1400) {
  btn.classList.add('success');
  btn.disabled = true;
  setTimeout(() => {
    btn.classList.remove('success');
    btn.disabled = false;
  }, delay);
}

// ── Export: Copy SVG ─────────────────────────
copySVGBtn.addEventListener('click', () => {
  const svg = buildExportSVG();
  const doCopy = () => {
    flashSuccess(copySVGBtn);
    showToast('SVG copied to clipboard!');
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(svg).then(doCopy).catch(() => {
      if (fallbackCopy(svg)) doCopy();
    });
  } else if (fallbackCopy(svg)) {
    doCopy();
  }
});

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  document.body.removeChild(ta);
  if (!ok) showToast('Copy failed — try a modern browser.');
  return ok;
}

// ── Export: Download PNG ─────────────────────
downloadPNGBtn.addEventListener('click', () => {
  const unitW = state.squareWidth;
  const unitH = state.squareHeight;
  const tilesPerAxis = 4;
  const cols = tilesPerAxis * 2;
  const rows = tilesPerAxis * 2;
  const w    = cols * unitW;
  const h    = rows * unitH;

  if (w > MAX_EXPORT_PX || h > MAX_EXPORT_PX) {
    showToast(`Too large (${w}×${h}px). Reduce square size.`);
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  if (state.overlapAuto) {
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = hexRgba(state.color2, state.color2Opacity);
    for (let row = 1; row < rows; row += 2) {
      ctx.fillRect(0, row * unitH, w, unitH);
    }

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = hexRgba(state.color1, state.color1Opacity);
    for (let col = 1; col < cols; col += 2) {
      ctx.fillRect(col * unitW, 0, unitW, h);
    }
    ctx.globalCompositeOperation = 'source-over';

  } else {
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, w, h);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const oddRow = row % 2 === 1;
        const oddCol = col % 2 === 1;
        if (!oddRow && !oddCol) continue;

        if (!oddRow &&  oddCol) ctx.fillStyle = hexRgba(state.color1, state.color1Opacity);
        else if (oddRow && !oddCol) ctx.fillStyle = hexRgba(state.color2, state.color2Opacity);
        else                        ctx.fillStyle = state.overlapColor;

        ctx.fillRect(col * unitW, row * unitH, unitW, unitH);
      }
    }
  }

  // Pixel-level noise for PNG export — matches the SVG grain overlay
  if (state.noiseAmount > 0) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const strength = state.noiseAmount / 100 * 110;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * strength;
      data[i]   = Math.max(0, Math.min(255, data[i]   + n));
      data[i+1] = Math.max(0, Math.min(255, data[i+1] + n));
      data[i+2] = Math.max(0, Math.min(255, data[i+2] + n));
    }
    ctx.putImageData(imageData, 0, 0);
  }

  const suffix = state.isPlaid ? `${unitW}x${unitH}px` : `${unitW}px`;
  const link = document.createElement('a');
  link.download = `gingham-${suffix}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();

  flashSuccess(downloadPNGBtn);
  showToast('PNG downloaded!');
});

// ── Random Palette ────────────────────────────
function applyRandomPalette() {
  const hue  = Math.floor(Math.random() * 360);
  // Analogous hue: +30–90° away for harmonious but distinct second color
  const hue2 = (hue + 30 + Math.floor(Math.random() * 60)) % 360;

  const p = {
    color1: hslToHex(hue,  60 + Math.random() * 25, 30 + Math.random() * 25),
    color2: hslToHex(hue2, 45 + Math.random() * 30, 40 + Math.random() * 20),
    bg:     hslToHex(hue,  12 + Math.random() * 10, 93 + Math.random() *  4),
  };

  state.color1 = p.color1;
  state.color2 = p.color2;
  state.bgColor = p.bg;
  state.color1Opacity = 100;
  state.color2Opacity = 100;

  color1Input.value = state.color1;
  color2Input.value = state.color2;
  bgColorInput.value = state.bgColor;
  color1OpacityInput.value = 100;
  color2OpacityInput.value = 100;
  color1OpacityValue.textContent = '100%';
  color2OpacityValue.textContent = '100%';
  updateTrack(color1OpacityInput);
  updateTrack(color2OpacityInput);

  if (state.overlapAuto) {
    overlapColorInput.value = multiplyBlend(state.color1, state.color2);
  }
  render();
}

randomizePaletteBtn.addEventListener('click', applyRandomPalette);

// ── Event Listeners ──────────────────────────

segBtns.forEach(btn => {
  btn.addEventListener('click', () => setPlaidMode(btn.dataset.mode === 'plaid'));
});

// Square width: slider ↔ number input bidirectional sync
squareWidthSliderInput.addEventListener('input', () => {
  const val = parseInt(squareWidthSliderInput.value, 10);
  state.squareWidth = val;
  squareWidthInput.value = val;
  if (!state.isPlaid) {
    state.squareHeight = val;
    squareHeightSliderInput.value = val;
    squareHeightInput.value = val;
    updateTrack(squareHeightSliderInput);
  }
  updateTrack(squareWidthSliderInput);
  render();
});

squareWidthInput.addEventListener('input', () => {
  const val = parseInt(squareWidthInput.value, 10);
  if (!isNaN(val) && val >= 4) {
    state.squareWidth = val;
    squareWidthSliderInput.value = Math.min(val, parseInt(squareWidthSliderInput.max, 10));
    if (!state.isPlaid) {
      state.squareHeight = val;
      squareHeightInput.value = val;
      squareHeightSliderInput.value = Math.min(val, parseInt(squareHeightSliderInput.max, 10));
      updateTrack(squareHeightSliderInput);
    }
    updateTrack(squareWidthSliderInput);
    render();
  }
});

// Square height (plaid only)
squareHeightSliderInput.addEventListener('input', () => {
  const val = parseInt(squareHeightSliderInput.value, 10);
  state.squareHeight = val;
  squareHeightInput.value = val;
  updateTrack(squareHeightSliderInput);
  render();
});

squareHeightInput.addEventListener('input', () => {
  const val = parseInt(squareHeightInput.value, 10);
  if (!isNaN(val) && val >= 4) {
    state.squareHeight = val;
    squareHeightSliderInput.value = Math.min(val, parseInt(squareHeightSliderInput.max, 10));
    updateTrack(squareHeightSliderInput);
    render();
  }
});

color1Input.addEventListener('input', () => {
  state.color1 = color1Input.value;
  if (state.overlapAuto) overlapColorInput.value = multiplyBlend(state.color1, state.color2);
  render();
});

color2Input.addEventListener('input', () => {
  state.color2 = color2Input.value;
  if (state.overlapAuto) overlapColorInput.value = multiplyBlend(state.color1, state.color2);
  render();
});

bgColorInput.addEventListener('input', () => {
  state.bgColor = bgColorInput.value;
  render();
});

color1OpacityInput.addEventListener('input', () => {
  state.color1Opacity = parseInt(color1OpacityInput.value, 10);
  color1OpacityValue.textContent = `${state.color1Opacity}%`;
  updateTrack(color1OpacityInput);
  render();
});

color2OpacityInput.addEventListener('input', () => {
  state.color2Opacity = parseInt(color2OpacityInput.value, 10);
  color2OpacityValue.textContent = `${state.color2Opacity}%`;
  updateTrack(color2OpacityInput);
  render();
});

overlapAutoInput.addEventListener('change', () => {
  setOverlapAuto(overlapAutoInput.checked);
});

overlapColorInput.addEventListener('input', () => {
  if (!state.overlapAuto) {
    state.overlapColor = overlapColorInput.value;
    render();
  }
});

// Noise — slider and number input stay in sync
noiseAmountInput.addEventListener('input', () => {
  state.noiseAmount = parseInt(noiseAmountInput.value, 10);
  noiseAmountNum.value = state.noiseAmount;
  updateTrack(noiseAmountInput);
  render();
});

noiseAmountNum.addEventListener('input', () => {
  const val = Math.max(0, Math.min(100, parseInt(noiseAmountNum.value, 10) || 0));
  state.noiseAmount = val;
  noiseAmountInput.value = val;
  noiseAmountNum.value = val;
  updateTrack(noiseAmountInput);
  render();
});

// Clicking a swatch row opens its color picker
document.querySelectorAll('.color-swatch-item').forEach(item => {
  item.addEventListener('click', e => {
    if (e.target.type === 'color' || e.target.type === 'checkbox') return;
    if (item.classList.contains('overlap-swatch') && state.overlapAuto) return;
    const picker = item.querySelector('input[type="color"]');
    if (picker) picker.click();
  });
});

// ── Reset ────────────────────────────────────
function resetToDefaults() {
  Object.assign(state, DEFAULT_STATE);

  squareWidthSliderInput.value  = Math.min(state.squareWidth,  parseInt(squareWidthSliderInput.max,  10));
  squareWidthInput.value        = state.squareWidth;
  squareHeightSliderInput.value = Math.min(state.squareHeight, parseInt(squareHeightSliderInput.max, 10));
  squareHeightInput.value       = state.squareHeight;

  color1Input.value      = state.color1;
  color1OpacityInput.value = state.color1Opacity;
  color1OpacityValue.textContent = `${state.color1Opacity}%`;

  color2Input.value      = state.color2;
  color2OpacityInput.value = state.color2Opacity;
  color2OpacityValue.textContent = `${state.color2Opacity}%`;

  bgColorInput.value     = state.bgColor;

  overlapAutoInput.checked = true;
  overlapColorInput.value  = multiplyBlend(state.color1, state.color2);
  overlapSwatch.classList.add('non-interactive');
  overlapColorInput.classList.remove('visible');

  noiseAmountInput.value = state.noiseAmount;
  noiseAmountNum.value   = state.noiseAmount;

  allSliders.forEach(updateTrack);
  setPlaidMode(false); // resets seg buttons and calls render()
}

resetBtn.addEventListener('click', resetToDefaults);

// ── Resize via ResizeObserver ─────────────────
const resizeObserver = new ResizeObserver(() => {
  requestAnimationFrame(render);
});
resizeObserver.observe(previewEl);

// ── Init ─────────────────────────────────────
overlapColorInput.value = multiplyBlend(state.color1, state.color2);
allSliders.forEach(updateTrack);
overlapSwatch.classList.add('non-interactive');

render();
