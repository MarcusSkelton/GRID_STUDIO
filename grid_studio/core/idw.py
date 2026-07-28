"""Inverse Distance Weighting (IDW) gridding."""

from __future__ import annotations

import numpy as np


def idw_grid(
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray,
    xi: np.ndarray,
    yi: np.ndarray,
    power: float = 2.0,
    min_points: int = 1,
) -> np.ndarray:
    """Compute an IDW-interpolated grid.

    Parameters
    ----------
    x, y:
        1-D arrays of sample point coordinates.
    z:
        1-D array of sample values.
    xi, yi:
        2-D meshgrid arrays of output cell centres.
    power:
        Distance-decay exponent (default 2).
    min_points:
        Minimum number of sample points required for a valid estimate.
        Cells without enough contributing points are set to NaN.

    Returns
    -------
    np.ndarray
        2-D array of interpolated values, same shape as *xi* / *yi*.
    """
    if x.shape != y.shape or x.shape != z.shape:
        raise ValueError("x, y, and z must have the same shape.")
    if power <= 0:
        raise ValueError("power must be > 0.")
    if xi.shape != yi.shape:
        raise ValueError("xi and yi must have the same shape.")

    shape = xi.shape
    result = np.empty(shape, dtype=float)

    # Flatten for vectorised distance calculation
    xi_flat = xi.ravel()
    yi_flat = yi.ravel()

    # Distance matrix: (n_cells, n_points)
    dx = xi_flat[:, np.newaxis] - x[np.newaxis, :]
    dy = yi_flat[:, np.newaxis] - y[np.newaxis, :]
    dist = np.hypot(dx, dy)

    # Handle exact coincidences (distance == 0) by assigning that sample's value directly
    exact = dist == 0.0  # (n_cells, n_points) boolean

    # Weights
    with np.errstate(divide="ignore", invalid="ignore"):
        weights = np.where(exact, 0.0, dist ** (-power))

    # For cells with an exact match, override weights so only that point contributes
    exact_cell = exact.any(axis=1)  # (n_cells,)
    weights[exact_cell] = exact[exact_cell].astype(float)

    weight_sum = weights.sum(axis=1)  # (n_cells,)
    valid = weight_sum > 0

    values = np.where(valid, (weights * z[np.newaxis, :]).sum(axis=1) / weight_sum, np.nan)
    result = values.reshape(shape)

    return result
