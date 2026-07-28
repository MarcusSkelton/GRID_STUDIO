"""Triangulation with linear interpolation (Natural Neighbour / Linear)."""

from __future__ import annotations

import numpy as np


def triangulate_grid(
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray,
    xi: np.ndarray,
    yi: np.ndarray,
    method: str = "linear",
) -> np.ndarray:
    """Interpolate scattered points via Delaunay triangulation.

    Points outside the convex hull of the sample data are set to NaN.

    Parameters
    ----------
    x, y:
        1-D arrays of sample point coordinates.
    z:
        1-D array of sample values.
    xi, yi:
        2-D meshgrid arrays of output cell centres.
    method:
        ``"linear"`` (default) or ``"nearest"`` – passed directly to
        :func:`scipy.interpolate.griddata`.

    Returns
    -------
    np.ndarray
        2-D array of interpolated values, same shape as *xi* / *yi*.
    """
    try:
        from scipy.interpolate import griddata  # type: ignore[import]
    except ImportError as exc:
        raise ImportError("scipy is required for triangulation. Install it with: pip install scipy") from exc

    points = np.column_stack([x, y])
    values = griddata(points, z, (xi, yi), method=method, fill_value=np.nan)
    return np.array(values, dtype=float)
