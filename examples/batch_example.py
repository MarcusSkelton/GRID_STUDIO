"""Batch gridding example – demonstrates the GRID_STUDIO CLI workflow in Python.

Run from the repository root::

    python examples/batch_example.py

This script generates a synthetic gold assay dataset, grids it with IDW, and
writes the result to /tmp/grid_studio_example/ as both an ASC and a CSV.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Allow running from the repo root without installing the package
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from grid_studio.core.engine import GridEngine
from grid_studio.io.writers import write_grid

# ── 1. Synthetic dataset ──────────────────────────────────────────────────────
rng = np.random.default_rng(42)

n = 200
x = rng.uniform(300_000, 310_000, n)   # UTM easting  (m)
y = rng.uniform(6_500_000, 6_510_000, n)  # UTM northing (m)
# Simple trend + noise (ppb Au)
z = 5 + 0.0003 * (x - 305_000) + 0.0002 * (y - 6_505_000) + rng.normal(0, 1, n)

df = pd.DataFrame({"Easting": x, "Northing": y, "Au_ppb": z})
print(f"Generated {len(df)} synthetic sample points.")
print(f"Au ppb  min={z.min():.2f}  mean={z.mean():.2f}  max={z.max():.2f}")

# ── 2. IDW gridding ───────────────────────────────────────────────────────────
engine = GridEngine(method="idw", resolution=200, idw_power=2)
result = engine.run(df, x_col="Easting", y_col="Northing", z_col="Au_ppb")
print(f"\nGrid size: {result.n_rows} rows × {result.n_cols} cols  (cell = {result.resolution} m)")
print(f"Grid stats: {result.stats}")

# ── 3. Export ─────────────────────────────────────────────────────────────────
out_dir = Path("/tmp/grid_studio_example")
out_dir.mkdir(parents=True, exist_ok=True)

write_grid(result, out_dir / "au_ppb_idw.asc")
write_grid(result, out_dir / "au_ppb_idw.csv")

print(f"\nOutputs written to {out_dir}/")
print("  au_ppb_idw.asc")
print("  au_ppb_idw.csv")
