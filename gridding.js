/* ================================================================
   Gridding / interpolation routines
   All methods return { values, nx, ny, xmin, ymin, cellSize, nodata }
   NaN represents blanked (no-data) cells.
   ================================================================ */

const NODATA = -9999;

/**
 * Build the output grid geometry from point extent + cell size.
 * `padding` is a fractional expansion of the extent (0.05 = 5%).
 */
function buildGridGeometry(points, cellSize, padding = 0.05) {
  let xmin = Infinity,
    xmax = -Infinity,
    ymin = Infinity,
    ymax = -Infinity;
  for (const p of points) {
    if (p.x < xmin) xmin = p.x;
    if (p.x > xmax) xmax = p.x;
    if (p.y < ymin) ymin = p.y;
    if (p.y > ymax) ymax = p.y;
  }
  const dx = xmax - xmin,
    dy = ymax - ymin;
  const px = dx * padding,
    py = dy * padding;
  xmin -= px;
  xmax += px;
  ymin -= py;
  ymax += py;

  const nx = Math.max(2, Math.ceil((xmax - xmin) / cellSize) + 1);
  const ny = Math.max(2, Math.ceil((ymax - ymin) / cellSize) + 1);
  return { xmin, ymin, xmax, ymax, nx, ny, cellSize };
}

/** Map (x,y) → nearest grid indices (i col, j row). */
function xyToIJ(x, y, geom) {
  const i = Math.round((x - geom.xmin) / geom.cellSize);
  const j = Math.round((y - geom.ymin) / geom.cellSize);
  return { i, j };
}

/** Iterate every cell centre. cb(i, j, x, y). */
function forEachCell(geom, cb) {
  for (let j = 0; j < geom.ny; j++) {
    const y = geom.ymin + j * geom.cellSize;
    for (let i = 0; i < geom.nx; i++) {
      const x = geom.xmin + i * geom.cellSize;
      cb(i, j, x, y);
    }
  }
}

/* ---------- spatial index: simple bucket grid for neighbour queries ---------- */

function buildBucketIndex(points, bucketSize) {
  const buckets = new Map();
  const key = (bi, bj) => `${bi},${bj}`;
  for (let k = 0; k < points.length; k++) {
    const p = points[k];
    const bi = Math.floor(p.x / bucketSize);
    const bj = Math.floor(p.y / bucketSize);
    const kk = key(bi, bj);
    let arr = buckets.get(kk);
    if (!arr) {
      arr = [];
      buckets.set(kk, arr);
    }
    arr.push(k);
  }
  return { buckets, bucketSize, key };
}

/** Return indices of points within `radius` of (x,y). */
function queryNear(index, points, x, y, radius) {
  const r = radius;
  const r2 = r * r;
  const bi0 = Math.floor((x - r) / index.bucketSize);
  const bi1 = Math.floor((x + r) / index.bucketSize);
  const bj0 = Math.floor((y - r) / index.bucketSize);
  const bj1 = Math.floor((y + r) / index.bucketSize);
  const out = [];
  for (let bj = bj0; bj <= bj1; bj++) {
    for (let bi = bi0; bi <= bi1; bi++) {
      const arr = index.buckets.get(index.key(bi, bj));
      if (!arr) continue;
      for (const idx of arr) {
        const p = points[idx];
        const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d2 <= r2) out.push({ idx, d2 });
      }
    }
  }
  return out;
}

/** Return the single nearest point index. */
function queryNearest(index, points, x, y) {
  // Search out in expanding rings until we find at least one point,
  // then check surrounding buckets for a possibly-closer one.
  const bs = index.bucketSize;
  const bi = Math.floor(x / bs);
  const bj = Math.floor(y / bs);
  let bestIdx = -1;
  let bestD2 = Infinity;
  for (let ring = 0; ring < 200; ring++) {
    for (let dj = -ring; dj <= ring; dj++) {
      for (let di = -ring; di <= ring; di++) {
        // only cells on the ring boundary
        if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
        const arr = index.buckets.get(index.key(bi + di, bj + dj));
        if (!arr) continue;
        for (const idx of arr) {
          const p = points[idx];
          const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
          if (d2 < bestD2) {
            bestD2 = d2;
            bestIdx = idx;
          }
        }
      }
    }
    // Expand one more ring after finding a candidate to be safe,
    // since a closer point could lie in a diagonally-adjacent bucket.
    if (bestIdx >= 0 && ring >= 1) return { idx: bestIdx, d2: bestD2 };
  }
  return { idx: bestIdx, d2: bestD2 };
}

/* ---------- median-based auto search radius ---------- */

function estimateSearchRadius(points, geom) {
  // Rough heuristic: median nearest-neighbour distance × 5, but at least 3 cell sizes.
  const sample = Math.min(points.length, 200);
  const step = Math.max(1, Math.floor(points.length / sample));
  const nnDists = [];
  const bs = Math.max(geom.cellSize, (geom.xmax - geom.xmin) / 40);
  const idx = buildBucketIndex(points, bs);
  for (let k = 0; k < points.length; k += step) {
    const p = points[k];
    // find nearest OTHER point
    let best = Infinity;
    for (let ring = 0; ring < 6; ring++) {
      const bi = Math.floor(p.x / bs);
      const bj = Math.floor(p.y / bs);
      for (let dj = -ring; dj <= ring; dj++) {
        for (let di = -ring; di <= ring; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
          const arr = idx.buckets.get(idx.key(bi + di, bj + dj));
          if (!arr) continue;
          for (const j of arr) {
            if (j === k) continue;
            const d2 = (points[j].x - p.x) ** 2 + (points[j].y - p.y) ** 2;
            if (d2 < best) best = d2;
          }
        }
      }
      if (best < Infinity && ring >= 1) break;
    }
    if (best < Infinity) nnDists.push(Math.sqrt(best));
  }
  if (nnDists.length === 0) return Math.max(geom.cellSize * 10, (geom.xmax - geom.xmin) / 20);
  nnDists.sort((a, b) => a - b);
  const median = nnDists[Math.floor(nnDists.length / 2)];
  const auto = median * 5;
  return Math.max(auto, geom.cellSize * 3);
}

/* ============================================================
   1. Inverse Distance Weighting (IDW)
   ============================================================ */

function gridIDW(points, geom, options = {}) {
  const power = options.power ?? 2;
  let radius = options.radius && options.radius > 0 ? options.radius : estimateSearchRadius(points, geom);
  const values = new Float32Array(geom.nx * geom.ny);
  const bucketSize = Math.max(radius / 2, geom.cellSize);
  const index = buildBucketIndex(points, bucketSize);
  const eps2 = (geom.cellSize * 0.001) ** 2;

  forEachCell(geom, (i, j, x, y) => {
    const near = queryNear(index, points, x, y, radius);
    if (near.length === 0) {
      // widen fallback: just take the nearest one point
      const n1 = queryNearest(index, points, x, y);
      if (n1.idx >= 0) values[j * geom.nx + i] = points[n1.idx].z;
      else values[j * geom.nx + i] = NaN;
      return;
    }
    let sw = 0,
      swz = 0,
      exact = null;
    for (const { idx, d2 } of near) {
      if (d2 < eps2) {
        exact = points[idx].z;
        break;
      }
      const w = 1 / Math.pow(d2, power / 2);
      sw += w;
      swz += w * points[idx].z;
    }
    values[j * geom.nx + i] = exact !== null ? exact : swz / sw;
  });

  return { values, ...geom, searchRadius: radius, nodata: NaN };
}

/* ============================================================
   2. Nearest Neighbour
   ============================================================ */

function gridNearestNeighbour(points, geom, options = {}) {
  const values = new Float32Array(geom.nx * geom.ny);
  const bucketSize = Math.max(geom.cellSize * 4, (geom.xmax - geom.xmin) / 30);
  const index = buildBucketIndex(points, bucketSize);

  forEachCell(geom, (i, j, x, y) => {
    const n = queryNearest(index, points, x, y);
    values[j * geom.nx + i] = n.idx >= 0 ? points[n.idx].z : NaN;
  });

  return { values, ...geom, nodata: NaN };
}

/* ============================================================
   3. Minimum Curvature (Briggs 1974)

   Iterative biharmonic relaxation:
   - Seed grid with a nearest-neighbour pass.
   - Constrain cells that contain data points to their value.
   - Repeatedly update every free cell with the discrete biharmonic
     stencil (∇⁴u = 0 → u = average of 8 neighbours in a specific
     weighted pattern), with successive-over-relaxation for speed.
   ============================================================ */

function gridMinCurvature(points, geom, options = {}) {
  const iterations = options.iterations ?? 400;
  const omega = 1.4; // SOR relaxation factor

  const nx = geom.nx;
  const ny = geom.ny;
  const N = nx * ny;
  const values = new Float32Array(N);
  const fixed = new Uint8Array(N); // 1 if a data point falls on the cell
  const fixedVal = new Float32Array(N);
  const counts = new Uint16Array(N);

  // Bin points onto grid nodes; average when multiple fall in the same cell.
  for (const p of points) {
    const { i, j } = xyToIJ(p.x, p.y, geom);
    if (i < 0 || i >= nx || j < 0 || j >= ny) continue;
    const k = j * nx + i;
    if (counts[k] === 0) fixedVal[k] = p.z;
    else fixedVal[k] = (fixedVal[k] * counts[k] + p.z) / (counts[k] + 1);
    counts[k] += 1;
    fixed[k] = 1;
  }

  // Seed with nearest-neighbour so relaxation starts near the solution.
  const bucketSize = Math.max(geom.cellSize * 4, (geom.xmax - geom.xmin) / 30);
  const idx = buildBucketIndex(points, bucketSize);
  forEachCell(geom, (i, j, x, y) => {
    const k = j * nx + i;
    if (fixed[k]) {
      values[k] = fixedVal[k];
    } else {
      const n = queryNearest(idx, points, x, y);
      values[k] = n.idx >= 0 ? points[n.idx].z : 0;
    }
  });

  // Discrete biharmonic stencil for interior points:
  //   u(i,j) = (1/20) * [ 8 * (N+S+E+W) - 2*(NE+NW+SE+SW) - (NN+SS+EE+WW) ]
  // Successive over-relaxation: u_new = u_old + omega * (u_stencil - u_old).
  const at = (i, j) => values[j * nx + i];

  for (let iter = 0; iter < iterations; iter++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (fixed[k]) continue;

        // Boundary cells: use natural (Laplacian) relaxation with reflection.
        if (i < 2 || i >= nx - 2 || j < 2 || j >= ny - 2) {
          let s = 0,
            c = 0;
          if (i > 0) {
            s += at(i - 1, j);
            c++;
          }
          if (i < nx - 1) {
            s += at(i + 1, j);
            c++;
          }
          if (j > 0) {
            s += at(i, j - 1);
            c++;
          }
          if (j < ny - 1) {
            s += at(i, j + 1);
            c++;
          }
          const target = s / c;
          values[k] += omega * (target - values[k]);
          continue;
        }

        // Interior biharmonic stencil.
        const N4 =
          at(i - 1, j) + at(i + 1, j) + at(i, j - 1) + at(i, j + 1);
        const D4 =
          at(i - 1, j - 1) +
          at(i + 1, j - 1) +
          at(i - 1, j + 1) +
          at(i + 1, j + 1);
        const F4 =
          at(i - 2, j) + at(i + 2, j) + at(i, j - 2) + at(i, j + 2);
        const target = (8 * N4 - 2 * D4 - F4) / 20;
        values[k] += omega * (target - values[k]);
      }
    }
  }

  return { values, ...geom, nodata: NaN };
}

/* ============================================================
   Blanking — set cells beyond a distance from any data point to NaN.
   ============================================================ */

function applyBlanking(grid, points, blankDist) {
  if (!blankDist || blankDist <= 0) return grid;
  const bucketSize = Math.max(blankDist, grid.cellSize);
  const idx = buildBucketIndex(points, bucketSize);
  const bd2 = blankDist * blankDist;
  for (let j = 0; j < grid.ny; j++) {
    for (let i = 0; i < grid.nx; i++) {
      const x = grid.xmin + i * grid.cellSize;
      const y = grid.ymin + j * grid.cellSize;
      const near = queryNear(idx, points, x, y, blankDist);
      let ok = false;
      for (const nn of near) {
        if (nn.d2 <= bd2) {
          ok = true;
          break;
        }
      }
      if (!ok) grid.values[j * grid.nx + i] = NaN;
    }
  }
  return grid;
}

/* ============================================================
   Top-level dispatcher
   ============================================================ */

function computeGrid(points, method, cellSize, opts = {}) {
  const geom = buildGridGeometry(points, cellSize, opts.padding ?? 0.05);
  let grid;
  if (method === 'idw') grid = gridIDW(points, geom, opts);
  else if (method === 'nn') grid = gridNearestNeighbour(points, geom, opts);
  else if (method === 'mc') grid = gridMinCurvature(points, geom, opts);
  else throw new Error('Unknown gridding method: ' + method);
  if (opts.blankDist && opts.blankDist > 0) applyBlanking(grid, points, opts.blankDist);
  // Compute value range on non-NaN cells.
  let vmin = Infinity,
    vmax = -Infinity;
  for (let k = 0; k < grid.values.length; k++) {
    const v = grid.values[k];
    if (isFinite(v)) {
      if (v < vmin) vmin = v;
      if (v > vmax) vmax = v;
    }
  }
  grid.vmin = vmin;
  grid.vmax = vmax;
  return grid;
}
