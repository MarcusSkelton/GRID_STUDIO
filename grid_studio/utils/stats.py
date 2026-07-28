"""Descriptive statistics helpers for grids and point datasets."""

from __future__ import annotations

import numpy as np
import pandas as pd


def summary_stats(data: np.ndarray | pd.Series) -> dict[str, float]:
    """Return a dictionary of common descriptive statistics.

    Ignores NaN values.

    Parameters
    ----------
    data:
        A 1-D or 2-D array / Pandas Series.

    Returns
    -------
    dict[str, float]
        Keys: ``count``, ``min``, ``max``, ``mean``, ``median``,
        ``std``, ``p10``, ``p25``, ``p75``, ``p90``.
    """
    arr = np.asarray(data, dtype=float).ravel()
    valid = arr[~np.isnan(arr)]

    if valid.size == 0:
        nan = float("nan")
        return {k: nan for k in ("count", "min", "max", "mean", "median", "std", "p10", "p25", "p75", "p90")}

    return {
        "count": float(valid.size),
        "min": float(valid.min()),
        "max": float(valid.max()),
        "mean": float(valid.mean()),
        "median": float(np.median(valid)),
        "std": float(valid.std()),
        "p10": float(np.percentile(valid, 10)),
        "p25": float(np.percentile(valid, 25)),
        "p75": float(np.percentile(valid, 75)),
        "p90": float(np.percentile(valid, 90)),
    }
