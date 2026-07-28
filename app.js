/* ================================================================
   App state + event wiring
   ================================================================ */

const state = {
  rawRows: null, // parsed CSV rows
  columns: [], // column names
  points: null, // [{x,y,z}]
  grid: null,
  palette: 'viridis',
  reverse: false,
  logScale: false,
  showPoints: false,
};

/* ---------------- CSV parsing ---------------- */

function parseCSV(text) {
  // Handles CSV or TSV, with quoted values, ignores blank lines.
  // Detects delimiter from the first non-empty line.
  const cleaned = text.replace(/^\uFEFF/, ''); // strip BOM
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { columns: [], rows: [] };
  const first = lines[0];
  const delimiter = detectDelimiter(first);
  const parseLine = line => {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inQ = false;
        } else {
          cur += c;
        }
      } else {
        if (c === '"') inQ = true;
        else if (c === delimiter) {
          out.push(cur);
          cur = '';
        } else cur += c;
      }
    }
    out.push(cur);
    return out.map(s => s.trim());
  };

  const header = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseLine(lines[i]);
    if (parts.length === 1 && parts[0] === '') continue;
    const row = {};
    for (let k = 0; k < header.length; k++) row[header[k]] = parts[k];
    rows.push(row);
  }
  return { columns: header, rows };
}

function detectDelimiter(line) {
  const candidates = [',', '\t', ';', '|'];
  let best = ',',
    bestCount = 0;
  for (const c of candidates) {
    const count = line.split(c).length - 1;
    if (count > bestCount) {
      best = c;
      bestCount = count;
    }
  }
  return best;
}

/** Try to auto-detect X, Y, Z columns by name and value type. */
function guessColumns(columns, sampleRow) {
  const norm = columns.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const xIdx = norm.findIndex(
    c => c === 'x' || c === 'easting' || c === 'east' || c === 'mgae' || c === 'lon' || c === 'longitude' || c.startsWith('x_') || c.endsWith('east'),
  );
  const yIdx = norm.findIndex(
    c => c === 'y' || c === 'northing' || c === 'north' || c === 'mgan' || c === 'lat' || c === 'latitude' || c.startsWith('y_') || c.endsWith('north'),
  );

  // Value: prefer the LAST column whose sample value parses as a finite number
  // and that isn't X or Y. This matches the near-universal convention of the
  // analyte column being last (e.g. Sample_ID, Easting, Northing, Cu_ppm).
  let zIdx = -1;
  if (sampleRow) {
    for (let i = columns.length - 1; i >= 0; i--) {
      if (i === xIdx || i === yIdx) continue;
      const v = parseFloat(sampleRow[columns[i]]);
      if (isFinite(v)) {
        zIdx = i;
        break;
      }
    }
  }
  if (zIdx < 0) zIdx = columns.findIndex((c, i) => i !== xIdx && i !== yIdx);

  return {
    x: xIdx >= 0 ? columns[xIdx] : columns[0],
    y: yIdx >= 0 ? columns[yIdx] : columns[1] || columns[0],
    z: zIdx >= 0 ? columns[zIdx] : columns[columns.length - 1],
  };
}

/* ---------------- File handling ---------------- */

const fileInput = document.getElementById('file-input');
const fileDrop = document.getElementById('file-drop');
const fileDropTitle = fileDrop.querySelector('.file-drop-title');
const columnFields = document.getElementById('column-fields');
const dataStats = document.getElementById('data-stats');
const runBtn = document.getElementById('run-btn');

fileInput.addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) loadFile(f);
});

['dragenter', 'dragover'].forEach(ev =>
  fileDrop.addEventListener(ev, e => {
    e.preventDefault();
    fileDrop.classList.add('dragover');
  }),
);
['dragleave', 'drop'].forEach(ev =>
  fileDrop.addEventListener(ev, e => {
    e.preventDefault();
    fileDrop.classList.remove('dragover');
  }),
);
fileDrop.addEventListener('drop', e => {
  const f = e.dataTransfer.files[0];
  if (f) loadFile(f);
});

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = parseCSV(reader.result);
      if (parsed.rows.length === 0) {
        toast('CSV appears empty', 'error');
        return;
      }
      state.rawRows = parsed.rows;
      state.columns = parsed.columns;
      fileDrop.classList.add('loaded');
      fileDropTitle.textContent = `${file.name} (${parsed.rows.length} rows)`;
      buildColumnSelectors();
      updateData();
    } catch (err) {
      console.error(err);
      toast('Failed to parse CSV: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function buildColumnSelectors() {
  const cols = state.columns;
  const guess = guessColumns(cols, state.rawRows[0]);
  for (const id of ['col-x', 'col-y', 'col-z']) {
    const sel = document.getElementById(id);
    sel.innerHTML = '';
    for (const c of cols) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    }
  }
  document.getElementById('col-x').value = guess.x;
  document.getElementById('col-y').value = guess.y;
  document.getElementById('col-z').value = guess.z;
  columnFields.hidden = false;
  ['col-x', 'col-y', 'col-z'].forEach(id =>
    document.getElementById(id).addEventListener('change', updateData),
  );
}

function updateData() {
  const cx = document.getElementById('col-x').value;
  const cy = document.getElementById('col-y').value;
  const cz = document.getElementById('col-z').value;
  const pts = [];
  for (const r of state.rawRows) {
    const x = parseFloat(r[cx]);
    const y = parseFloat(r[cy]);
    const z = parseFloat(r[cz]);
    if (isFinite(x) && isFinite(y) && isFinite(z)) pts.push({ x, y, z });
  }
  state.points = pts;
  showDataStats();
  updateGridInfo();
  runBtn.disabled = pts.length < 3;
}

function showDataStats() {
  const pts = state.points;
  if (!pts || pts.length === 0) {
    dataStats.hidden = true;
    return;
  }
  let xmin = Infinity,
    xmax = -Infinity,
    ymin = Infinity,
    ymax = -Infinity,
    zmin = Infinity,
    zmax = -Infinity;
  for (const p of pts) {
    if (p.x < xmin) xmin = p.x;
    if (p.x > xmax) xmax = p.x;
    if (p.y < ymin) ymin = p.y;
    if (p.y > ymax) ymax = p.y;
    if (p.z < zmin) zmin = p.z;
    if (p.z > zmax) zmax = p.z;
  }
  dataStats.innerHTML = `
    <div><div class="stat-label">Points</div><div class="stat-value">${pts.length}</div></div>
    <div><div class="stat-label">Value range</div><div class="stat-value">${fmt(zmin)} – ${fmt(zmax)}</div></div>
    <div><div class="stat-label">Extent (m)</div><div class="stat-value">${fmt(xmax - xmin, 0)} × ${fmt(ymax - ymin, 0)}</div></div>
  `;
  dataStats.hidden = false;
}

/* ---------------- Grid info preview ---------------- */

const gridInfo = document.getElementById('grid-info');

function updateGridInfo() {
  if (!state.points || state.points.length === 0) {
    gridInfo.textContent = '—';
    gridInfo.className = 'grid-info muted';
    return;
  }
  const cs = parseFloat(document.getElementById('cell-size').value);
  const pad = parseFloat(document.getElementById('padding').value) / 100;
  if (!isFinite(cs) || cs <= 0) {
    gridInfo.textContent = 'Enter a valid cell size';
    gridInfo.className = 'grid-info error';
    return;
  }
  const geom = buildGridGeometry(state.points, cs, pad);
  const cells = geom.nx * geom.ny;
  const cls = cells > 2_000_000 ? 'grid-info error' : cells > 500_000 ? 'grid-info warning' : 'grid-info';
  gridInfo.className = cls;
  const warn = cells > 2_000_000 ? ' — very large, will be slow' : cells > 500_000 ? ' — large grid' : '';
  gridInfo.textContent = `${geom.nx} × ${geom.ny} cells (${cells.toLocaleString()})${warn}`;
}

['cell-size', 'padding'].forEach(id =>
  document.getElementById(id).addEventListener('input', updateGridInfo),
);

/* ---------------- EPSG picker ---------------- */

const epsgSelect = document.getElementById('epsg-select');
const epsgCustomWrap = document.getElementById('epsg-custom-wrap');
const epsgCustomInput = document.getElementById('epsg-custom');
const epsgCustomHint = document.getElementById('epsg-custom-hint');

function buildEPSGPicker() {
  // Group entries under <optgroup>s in the order they appear in CRS_LIST.
  const groups = new Map();
  for (const c of CRS_LIST) {
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group).push(c);
  }
  epsgSelect.innerHTML = '';
  for (const [name, items] of groups) {
    if (name === 'None') {
      for (const c of items) {
        const opt = document.createElement('option');
        opt.value = String(c.code);
        opt.textContent = c.label;
        epsgSelect.appendChild(opt);
      }
    } else {
      const og = document.createElement('optgroup');
      og.label = name;
      for (const c of items) {
        const opt = document.createElement('option');
        opt.value = String(c.code);
        opt.textContent = c.label;
        og.appendChild(opt);
      }
      epsgSelect.appendChild(og);
    }
  }
  // Default to "No CRS" — the sample loader will bump this to MGA Zone 52 when used.
  epsgSelect.value = '0';
  onEPSGChange();
}

function onEPSGChange() {
  const code = parseInt(epsgSelect.value, 10);
  epsgCustomWrap.hidden = code !== -1;
  if (code === -1) {
    updateCustomEPSGHint();
  }
}

function updateCustomEPSGHint() {
  const v = parseInt(epsgCustomInput.value, 10);
  if (!isFinite(v) || v <= 0) {
    epsgCustomHint.textContent = 'Enter any EPSG code (1024–32767)';
    return;
  }
  const known = findCRS(v);
  if (known) {
    epsgCustomHint.textContent = known.label;
    return;
  }
  const kind = classifyEPSG(v);
  epsgCustomHint.textContent =
    kind === 'geographic'
      ? `EPSG:${v} — treated as geographic (lat/lon degrees)`
      : kind === 'projected'
        ? `EPSG:${v} — treated as projected (linear units)`
        : `EPSG:${v}`;
}

epsgSelect.addEventListener('change', onEPSGChange);
epsgCustomInput.addEventListener('input', updateCustomEPSGHint);
buildEPSGPicker();

/** Read the current EPSG selection. Returns 0 for "no CRS". */
function getSelectedEPSG() {
  const v = parseInt(epsgSelect.value, 10);
  if (v === -1) {
    const custom = parseInt(epsgCustomInput.value, 10);
    return isFinite(custom) && custom > 0 ? custom : 0;
  }
  return isFinite(v) && v > 0 ? v : 0;
}

/** Resolve the CRS kind for the currently-selected code. */
function getSelectedEPSGKind() {
  const code = getSelectedEPSG();
  if (code === 0) return 'none';
  const known = findCRS(code);
  return known ? known.kind : classifyEPSG(code);
}

/* ---------------- Method params visibility ---------------- */

const methodSel = document.getElementById('method');
methodSel.addEventListener('change', updateMethodParams);
function updateMethodParams() {
  const m = methodSel.value;
  document.getElementById('param-power-wrap').hidden = m !== 'idw';
  document.getElementById('param-radius-wrap').hidden = m === 'mc';
  document.getElementById('param-mc-wrap').hidden = m !== 'mc';
}
updateMethodParams();

/* ---------------- Palette selector ---------------- */

const paletteGrid = document.getElementById('palette-grid');
function buildPaletteChips() {
  paletteGrid.innerHTML = '';
  for (const [key, p] of Object.entries(PALETTES)) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'palette-chip' + (key === state.palette ? ' active' : '');
    chip.dataset.palette = key;
    chip.setAttribute('data-testid', `palette-${key}`);
    chip.innerHTML = `
      <div class="palette-swatch" style="background:${paletteToGradient(key)}"></div>
      <div class="palette-name">${p.label}</div>
    `;
    chip.addEventListener('click', () => {
      state.palette = key;
      paletteGrid.querySelectorAll('.palette-chip').forEach(c => c.classList.toggle('active', c.dataset.palette === key));
      if (state.grid) renderGrid();
    });
    paletteGrid.appendChild(chip);
  }
}
buildPaletteChips();

document.getElementById('reverse-palette').addEventListener('change', e => {
  state.reverse = e.target.checked;
  if (state.grid) renderGrid();
  // rebuild swatch preview to reflect reverse
});
document.getElementById('log-scale').addEventListener('change', e => {
  state.logScale = e.target.checked;
  if (state.grid) renderGrid();
});
document.getElementById('col-min').addEventListener('input', () => state.grid && renderGrid());
document.getElementById('col-max').addEventListener('input', () => state.grid && renderGrid());

/* ---------------- Run gridding ---------------- */

runBtn.addEventListener('click', async () => {
  if (!state.points || state.points.length < 3) return;
  const cs = parseFloat(document.getElementById('cell-size').value);
  const pad = parseFloat(document.getElementById('padding').value) / 100;
  const method = methodSel.value;
  const power = parseFloat(document.getElementById('idw-power').value) || 2;
  const radius = parseFloat(document.getElementById('search-radius').value) || 0;
  const iters = parseInt(document.getElementById('mc-iters').value) || 400;
  const blankDist = parseFloat(document.getElementById('blank-dist').value) || 0;

  runBtn.disabled = true;
  runBtn.querySelector('.btn-label').textContent = 'Computing…';
  // Yield so the UI can update.
  await new Promise(r => setTimeout(r, 20));

  try {
    const t0 = performance.now();
    const grid = computeGrid(state.points, method, cs, {
      padding: pad,
      power,
      radius,
      iterations: iters,
      blankDist,
    });
    const dt = ((performance.now() - t0) / 1000).toFixed(2);
    state.grid = grid;
    renderGrid();
    enableExports(true);
    const methodLabel = { idw: 'IDW', nn: 'Nearest neighbour', mc: 'Minimum curvature' }[method];
    document.getElementById('viewer-title').textContent =
      `${methodLabel} · ${grid.nx}×${grid.ny} · ${cs} m · ${dt}s`;
    toast(`Grid computed in ${dt}s`, 'success');
  } catch (err) {
    console.error(err);
    toast('Gridding failed: ' + err.message, 'error');
  } finally {
    runBtn.disabled = false;
    runBtn.querySelector('.btn-label').textContent = 'Compute grid';
  }
});

/* ---------------- Rendering ---------------- */

const canvas = document.getElementById('grid-canvas');
const ctx = canvas.getContext('2d');
const canvasEmpty = document.getElementById('canvas-empty');

function renderGrid() {
  const grid = state.grid;
  if (!grid) return;
  canvasEmpty.classList.add('hidden');

  // Determine display size — respect the container aspect ratio.
  const wrap = canvas.parentElement;
  const wrapW = wrap.clientWidth - 16;
  const wrapH = wrap.clientHeight - 16;
  const gridAspect = grid.nx / grid.ny;
  const wrapAspect = wrapW / wrapH;
  let displayW, displayH;
  if (gridAspect > wrapAspect) {
    displayW = wrapW;
    displayH = wrapW / gridAspect;
  } else {
    displayH = wrapH;
    displayW = wrapH * gridAspect;
  }

  // The internal resolution IS the grid resolution — we let CSS scale it.
  canvas.width = grid.nx;
  canvas.height = grid.ny;
  canvas.style.width = displayW + 'px';
  canvas.style.height = displayH + 'px';

  const imgData = ctx.createImageData(grid.nx, grid.ny);
  const data = imgData.data;

  // Colour range
  const userMin = parseFloat(document.getElementById('col-min').value);
  const userMax = parseFloat(document.getElementById('col-max').value);
  let vmin = isFinite(userMin) ? userMin : grid.vmin;
  let vmax = isFinite(userMax) ? userMax : grid.vmax;
  if (vmax <= vmin) vmax = vmin + 1;

  const useLog = state.logScale && vmin > 0;
  const lvmin = useLog ? Math.log10(vmin) : vmin;
  const lvmax = useLog ? Math.log10(vmax) : vmax;
  const range = lvmax - lvmin;

  // TIFF-style: canvas top row = high Y (north). Our grid row 0 is at ymin (south).
  // So flip vertically as we blit.
  for (let j = 0; j < grid.ny; j++) {
    const srcRow = grid.ny - 1 - j;
    for (let i = 0; i < grid.nx; i++) {
      const v = grid.values[srcRow * grid.nx + i];
      const k = (j * grid.nx + i) * 4;
      if (!isFinite(v)) {
        data[k] = 0;
        data[k + 1] = 0;
        data[k + 2] = 0;
        data[k + 3] = 0;
      } else {
        const lv = useLog ? (v > 0 ? Math.log10(v) : lvmin) : v;
        const t = (lv - lvmin) / range;
        const [r, g, b] = samplePalette(state.palette, t, state.reverse);
        data[k] = r;
        data[k + 1] = g;
        data[k + 2] = b;
        data[k + 3] = 255;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // Overlay sample points on top of the raster if requested.
  if (state.showPoints && state.points) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 0.5;
    for (const p of state.points) {
      const ci = (p.x - grid.xmin) / grid.cellSize;
      const cj = grid.ny - 1 - (p.y - grid.ymin) / grid.cellSize;
      ctx.beginPath();
      ctx.arc(ci, cj, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  renderLegend(vmin, vmax);
  document.getElementById('toggle-points').disabled = false;
}

function renderLegend(vmin, vmax) {
  const legend = document.getElementById('legend');
  legend.hidden = false;
  document.getElementById('legend-bar').style.background = paletteToGradient(state.palette, state.reverse);
  document.getElementById('legend-min').textContent = fmt(vmin);
  document.getElementById('legend-mid').textContent = fmt((vmin + vmax) / 2);
  document.getElementById('legend-max').textContent = fmt(vmax);
}

window.addEventListener('resize', () => {
  if (state.grid) renderGrid();
});

/* ---------------- Cursor read-out ---------------- */

canvas.addEventListener('mousemove', e => {
  if (!state.grid) return;
  const rect = canvas.getBoundingClientRect();
  const cx = ((e.clientX - rect.left) / rect.width) * state.grid.nx;
  const cy = ((e.clientY - rect.top) / rect.height) * state.grid.ny;
  const i = Math.floor(cx);
  const j = Math.floor(cy);
  if (i < 0 || i >= state.grid.nx || j < 0 || j >= state.grid.ny) return;
  const srcRow = state.grid.ny - 1 - j;
  const v = state.grid.values[srcRow * state.grid.nx + i];
  const x = state.grid.xmin + i * state.grid.cellSize;
  const y = state.grid.ymin + srcRow * state.grid.cellSize;
  document.getElementById('cursor-info').textContent = isFinite(v)
    ? `X ${fmt(x, 1)}  Y ${fmt(y, 1)}  →  ${fmt(v)}`
    : `X ${fmt(x, 1)}  Y ${fmt(y, 1)}  →  no data`;
});
canvas.addEventListener('mouseleave', () => {
  document.getElementById('cursor-info').textContent = 'Hover the grid for cell values';
});

/* ---------------- Toggle points ---------------- */

document.getElementById('toggle-points').addEventListener('click', () => {
  state.showPoints = !state.showPoints;
  document.getElementById('toggle-points').textContent = state.showPoints ? 'Hide points' : 'Show points';
  renderGrid();
});

/* ---------------- Exports ---------------- */

function enableExports(on) {
  ['export-grd', 'export-msh', 'export-tif', 'export-png'].forEach(id => {
    document.getElementById(id).disabled = !on;
  });
}

document.getElementById('export-grd').addEventListener('click', () => {
  if (!state.grid) return;
  exportGRD(state.grid, `${filenameStem()}.grd`);
  toast('Exported Surfer 6 ASCII .grd', 'success');
});
document.getElementById('export-msh').addEventListener('click', () => {
  if (!state.grid) return;
  exportMSH(state.grid, `${filenameStem()}.msh`);
  toast('Exported Gmsh 4.1 .msh', 'success');
});
document.getElementById('export-tif').addEventListener('click', () => {
  if (!state.grid) return;
  const epsgCode = getSelectedEPSG();
  const epsgKind = getSelectedEPSGKind();
  exportGeoTIFF(state.grid, `${filenameStem()}.tif`, { epsgCode, epsgKind });
  const suffix = epsgCode > 0 ? ` · EPSG:${epsgCode}` : ' · no CRS';
  toast('Exported GeoTIFF (Float32)' + suffix, 'success');
});
document.getElementById('export-png').addEventListener('click', () => {
  exportPNG(canvas, `${filenameStem()}.png`);
});

function filenameStem() {
  const method = methodSel.value;
  const cs = document.getElementById('cell-size').value;
  return `grid_${method}_${cs}m`;
}

/* ---------------- Toast ---------------- */

let toastTimer = null;
function toast(msg, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + kind;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3500);
}

/* ---------------- Utility ---------------- */

function fmt(n, digits = 3) {
  if (!isFinite(n)) return '—';
  if (Math.abs(n) >= 10000 || (Math.abs(n) < 0.001 && n !== 0)) return n.toExponential(2);
  return Number(n).toFixed(digits);
}

/* ---------------- Sample data ---------------- */

document.getElementById('load-sample-btn').addEventListener('click', () => {
  loadSampleData();
});

function loadSampleData() {
  // The synthetic dataset lives near Darwin in MGA Zone 52 — preselect that CRS
  // so users can immediately export a properly-georeferenced GeoTIFF.
  epsgSelect.value = '28352';
  onEPSGChange();

  // Synthetic soil Cu (ppm) dataset in a made-up MGA Zone 52 patch near Darwin.
  // Two Gaussian anomalies + a linear trend + noise, ~180 irregularly-spread sites.
  const rng = mulberry32(20260711);
  const cx1 = 700_500,
    cy1 = 8_620_500,
    a1 = 220,
    s1 = 350;
  const cx2 = 701_400,
    cy2 = 8_621_800,
    a2 = 140,
    s2 = 250;
  const bg = 25;
  const trend = (x, y) => 0.02 * (x - 700_000) + 0.015 * (y - 8_620_000);

  const rows = [['Sample_ID', 'Easting', 'Northing', 'Cu_ppm']];
  for (let n = 0; n < 180; n++) {
    // heterogeneous — draw with a mix of grid-like + clustered sampling
    let x, y;
    if (n < 60) {
      // grid-ish
      x = 700_100 + (n % 12) * 180 + (rng() - 0.5) * 60;
      y = 8_620_100 + Math.floor(n / 12) * 210 + (rng() - 0.5) * 60;
    } else if (n < 130) {
      // clustered around anomaly 1
      x = cx1 + (rng() - 0.5) * 700;
      y = cy1 + (rng() - 0.5) * 700;
    } else {
      // clustered around anomaly 2
      x = cx2 + (rng() - 0.5) * 900;
      y = cy2 + (rng() - 0.5) * 900;
    }
    const d1 = Math.hypot(x - cx1, y - cy1);
    const d2 = Math.hypot(x - cx2, y - cy2);
    const v =
      bg +
      trend(x, y) +
      a1 * Math.exp(-(d1 * d1) / (2 * s1 * s1)) +
      a2 * Math.exp(-(d2 * d2) / (2 * s2 * s2)) +
      (rng() - 0.5) * 8;
    rows.push([`S${(n + 1).toString().padStart(4, '0')}`, x.toFixed(2), y.toFixed(2), Math.max(0.5, v).toFixed(2)]);
  }
  const text = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([text], { type: 'text/csv' });
  const file = new File([blob], 'sample_soil_Cu.csv', { type: 'text/csv' });
  loadFile(file);
  toast('Sample data loaded: 180 soil sites, Cu (ppm)', 'success');
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- Theme toggle ---------------- */

(function () {
  const t = document.querySelector('[data-theme-toggle]'),
    r = document.documentElement;
  let d = 'dark';
  r.setAttribute('data-theme', d);
  const svgDark =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
  const svgLight =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  t.innerHTML = svgLight;
  t.addEventListener('click', () => {
    d = d === 'dark' ? 'light' : 'dark';
    r.setAttribute('data-theme', d);
    t.setAttribute('aria-label', 'Switch to ' + (d === 'dark' ? 'light' : 'dark') + ' mode');
    t.innerHTML = d === 'dark' ? svgLight : svgDark;
  });
})();
