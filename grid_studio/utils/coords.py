"""Coordinate reference system and projection helpers."""

from __future__ import annotations

import numpy as np


def reproject_points(
    x: np.ndarray,
    y: np.ndarray,
    source_crs: str,
    target_crs: str,
) -> tuple[np.ndarray, np.ndarray]:
    """Reproject point coordinates from *source_crs* to *target_crs*.

    Parameters
    ----------
    x, y:
        1-D arrays of input coordinates.
    source_crs, target_crs:
        Coordinate reference system identifiers accepted by *pyproj*,
        e.g. ``"EPSG:4326"`` or ``"EPSG:32754"``.

    Returns
    -------
    tuple[np.ndarray, np.ndarray]
        Reprojected (x, y) coordinate arrays.
    """
    try:
        from pyproj import Transformer  # type: ignore[import]
    except ImportError as exc:
        raise ImportError("pyproj is required for reprojection: pip install pyproj") from exc

    transformer = Transformer.from_crs(source_crs, target_crs, always_xy=True)
    x_out, y_out = transformer.transform(x, y)
    return np.array(x_out), np.array(y_out)


def extent_from_points(
    x: np.ndarray,
    y: np.ndarray,
    padding: float = 0.0,
) -> tuple[float, float, float, float]:
    """Return the bounding box of a set of points.

    Parameters
    ----------
    x, y:
        1-D coordinate arrays.
    padding:
        Optional extra margin added to each side (in the same units as
        *x* / *y*).

    Returns
    -------
    tuple[float, float, float, float]
        ``(x_min, y_min, x_max, y_max)``
    """
    return (
        float(x.min()) - padding,
        float(y.min()) - padding,
        float(x.max()) + padding,
        float(y.max()) + padding,
    )
