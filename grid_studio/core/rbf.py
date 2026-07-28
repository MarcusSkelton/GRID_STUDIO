"""Radial Basis Function (RBF) interpolation using SciPy."""

from __future__ import annotations

import numpy as np


# Kernels for which scipy.interpolate.RBFInterpolator does not require an
# explicit epsilon parameter (they are scale-invariant by construction).
_SCALE_INVARIANT_KERNELS = {"thin_plate_spline", "cubic", "quintic", "linear"}


def rbf_grid(
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray,
    xi: np.ndarray,
    yi: np.ndarray,
    function: str = "thin_plate_spline",
    epsilon: float | None = None,
) -> np.ndarray:
    """Interpolate scattered points onto a regular grid using Radial Basis Functions.

    Parameters
    ----------
    x, y:
        1-D arrays of sample point coordinates.
    z:
        1-D array of sample values.
    xi, yi:
        2-D meshgrid arrays of output cell centres.
    function:
        RBF kernel: ``"thin_plate_spline"`` (default), ``"multiquadric"``,
        ``"inverse_multiquadric"``, ``"inverse_quadratic"``,
        ``"gaussian"``, ``"linear"``, ``"cubic"``, or ``"quintic"``.
    epsilon:
        Shape parameter for scale-dependent kernels (``"multiquadric"``,
        ``"inverse_multiquadric"``, ``"inverse_quadratic"``,
        ``"gaussian"``). If *None* a sensible value is derived from the
        average nearest-neighbour distance of the sample points.

    Returns
    -------
    np.ndarray
        2-D array of RBF estimates, same shape as *xi* / *yi*.
    """
    try:
        from scipy.interpolate import RBFInterpolator  # type: ignore[import]
    except ImportError as exc:
        raise ImportError("scipy is required for RBF gridding. Install it with: pip install scipy") from exc

    points = np.column_stack([x, y])
    query = np.column_stack([xi.ravel(), yi.ravel()])

    kwargs: dict = {"kernel": function}

    if function.lower() not in _SCALE_INVARIANT_KERNELS:
        if epsilon is None:
            # Heuristic: use mean nearest-neighbour distance as shape parameter
            from scipy.spatial import KDTree  # type: ignore[import]

            tree = KDTree(points)
            dists, _ = tree.query(points, k=2)
            epsilon = float(np.mean(dists[:, 1]))
            if epsilon == 0.0:
                epsilon = 1.0
        kwargs["epsilon"] = epsilon

    rbf = RBFInterpolator(points, z, **kwargs)
    values = rbf(query)

    return values.reshape(xi.shape)
