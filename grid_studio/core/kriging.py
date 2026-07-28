"""Kriging interpolation using pyKrige."""

from __future__ import annotations

import numpy as np


def kriging_grid(
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray,
    xi: np.ndarray,
    yi: np.ndarray,
    variogram_model: str = "spherical",
    kriging_type: str = "ordinary",
) -> np.ndarray:
    """Interpolate scattered points onto a regular grid using Kriging.

    Parameters
    ----------
    x, y:
        1-D arrays of sample point coordinates.
    z:
        1-D array of sample values.
    xi, yi:
        1-D arrays of output grid axis coordinates (not meshgrid).
    variogram_model:
        pyKrige variogram model name: ``"spherical"`` (default),
        ``"exponential"``, ``"gaussian"``, or ``"linear"``.
    kriging_type:
        ``"ordinary"`` (default) or ``"simple"``.

    Returns
    -------
    np.ndarray
        2-D grid of kriged estimates, shape ``(len(yi), len(xi))``.
    """
    try:
        from pykrige.ok import OrdinaryKriging  # type: ignore[import]
        from pykrige.sk import SimpleKriging  # type: ignore[import]
    except ImportError as exc:
        raise ImportError("pykrige is required for Kriging. Install it with: pip install pykrige") from exc

    KrigingClass = OrdinaryKriging if kriging_type == "ordinary" else SimpleKriging
    krig = KrigingClass(x, y, z, variogram_model=variogram_model, verbose=False, enable_plotting=False)
    z_grid, _ss = krig.execute("grid", xi, yi)

    # pykrige returns a masked array; fill masked values with NaN
    if hasattr(z_grid, "filled"):
        z_grid = z_grid.filled(np.nan)

    return np.array(z_grid, dtype=float)
