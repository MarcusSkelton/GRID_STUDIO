"""GridEngine – orchestrates the gridding workflow."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

import numpy as np
import pandas as pd

Method = Literal["idw", "kriging", "rbf", "triangulate"]


@dataclass
class GridResult:
    """Container for a computed grid and its spatial metadata."""

    grid: np.ndarray
    """2-D array of gridded values (NaN where outside the convex hull)."""

    x_min: float
    x_max: float
    y_min: float
    y_max: float
    resolution: float

    method: str = ""
    z_col: str = ""
    stats: dict = field(default_factory=dict)

    @property
    def shape(self) -> tuple[int, int]:
        return self.grid.shape

    @property
    def transform(self):
        """Affine transform for rasterio (top-left origin)."""
        try:
            from rasterio.transform import from_bounds  # type: ignore[import]
        except ImportError as exc:
            raise ImportError("rasterio is required for the transform property: pip install rasterio") from exc

        return from_bounds(self.x_min, self.y_min, self.x_max, self.y_max, self.n_cols, self.n_rows)

    @property
    def n_cols(self) -> int:
        return self.grid.shape[1]

    @property
    def n_rows(self) -> int:
        return self.grid.shape[0]


class GridEngine:
    """High-level interface for running a gridding job.

    Parameters
    ----------
    method:
        Gridding algorithm – one of ``"idw"``, ``"kriging"``, ``"rbf"``,
        or ``"triangulate"``.
    resolution:
        Output cell size in the same units as the input coordinates.
    idw_power:
        Power parameter for IDW (default 2).
    kriging_model:
        Variogram model for Kriging (default ``"spherical"``).
    rbf_function:
        SciPy RBF function name (default ``"multiquadric"``).
    """

    def __init__(
        self,
        method: Method = "idw",
        resolution: float = 100.0,
        idw_power: float = 2.0,
        kriging_model: str = "spherical",
        rbf_function: str = "thin_plate_spline",
    ) -> None:
        self.method = method
        self.resolution = resolution
        self.idw_power = idw_power
        self.kriging_model = kriging_model
        self.rbf_function = rbf_function

    # ------------------------------------------------------------------
    def run(self, df: pd.DataFrame, x_col: str, y_col: str, z_col: str) -> GridResult:
        """Compute a grid from *df* and return a :class:`GridResult`.

        Parameters
        ----------
        df:
            DataFrame containing at least *x_col*, *y_col*, and *z_col*.
        x_col, y_col, z_col:
            Column names for easting, northing, and value respectively.
        """
        x = df[x_col].to_numpy(dtype=float)
        y = df[y_col].to_numpy(dtype=float)
        z = df[z_col].to_numpy(dtype=float)

        x_min, x_max = float(x.min()), float(x.max())
        y_min, y_max = float(y.min()), float(y.max())

        # Build output grid coordinates
        xi = np.arange(x_min, x_max + self.resolution, self.resolution)
        yi = np.arange(y_min, y_max + self.resolution, self.resolution)
        xi_grid, yi_grid = np.meshgrid(xi, yi)

        if self.method == "idw":
            from grid_studio.core.idw import idw_grid  # noqa: PLC0415

            grid = idw_grid(x, y, z, xi_grid, yi_grid, power=self.idw_power)
        elif self.method == "kriging":
            from grid_studio.core.kriging import kriging_grid  # noqa: PLC0415

            grid = kriging_grid(x, y, z, xi, yi, variogram_model=self.kriging_model)
        elif self.method == "rbf":
            from grid_studio.core.rbf import rbf_grid  # noqa: PLC0415

            grid = rbf_grid(x, y, z, xi_grid, yi_grid, function=self.rbf_function)
        elif self.method == "triangulate":
            from grid_studio.core.triangulate import triangulate_grid  # noqa: PLC0415

            grid = triangulate_grid(x, y, z, xi_grid, yi_grid)
        else:
            raise ValueError(f"Unknown gridding method: {self.method!r}")

        valid = grid[~np.isnan(grid)]
        stats = {
            "min": float(valid.min()) if valid.size else float("nan"),
            "max": float(valid.max()) if valid.size else float("nan"),
            "mean": float(valid.mean()) if valid.size else float("nan"),
            "std": float(valid.std()) if valid.size else float("nan"),
        }

        return GridResult(
            grid=grid,
            x_min=x_min,
            x_max=x_max,
            y_min=y_min,
            y_max=y_max,
            resolution=self.resolution,
            method=self.method,
            z_col=z_col,
            stats=stats,
        )
