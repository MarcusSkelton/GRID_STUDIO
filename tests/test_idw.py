"""Tests for grid_studio.core.idw."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from grid_studio.core.idw import idw_grid
from grid_studio.core.engine import GridEngine


class TestIDWGrid:
    def _meshgrid(self, x_min=0, x_max=400, y_min=0, y_max=400, step=100):
        xi = np.arange(x_min, x_max + step, step, dtype=float)
        yi = np.arange(y_min, y_max + step, step, dtype=float)
        return np.meshgrid(xi, yi)

    def test_output_shape(self, simple_points):
        xi, yi = self._meshgrid()
        result = idw_grid(
            simple_points["x"].values,
            simple_points["y"].values,
            simple_points["z"].values,
            xi,
            yi,
        )
        assert result.shape == xi.shape

    def test_exact_at_sample_points(self):
        """IDW must reproduce sample values exactly at the sample locations."""
        x = np.array([0.0, 100.0, 200.0])
        y = np.array([0.0, 0.0, 0.0])
        z = np.array([10.0, 20.0, 30.0])
        xi, yi = np.meshgrid(x, [0.0])
        result = idw_grid(x, y, z, xi, yi)
        np.testing.assert_allclose(result[0], z, rtol=1e-6)

    def test_power_zero_raises(self, simple_points):
        xi, yi = self._meshgrid()
        with pytest.raises(ValueError, match="power must be > 0"):
            idw_grid(
                simple_points["x"].values,
                simple_points["y"].values,
                simple_points["z"].values,
                xi,
                yi,
                power=0.0,
            )

    def test_mismatched_inputs_raise(self):
        with pytest.raises(ValueError, match="same shape"):
            idw_grid(
                np.array([0.0, 1.0]),
                np.array([0.0]),
                np.array([1.0]),
                *np.meshgrid([0.0], [0.0]),
            )

    def test_engine_idw_runs(self, simple_points):
        engine = GridEngine(method="idw", resolution=100.0)
        result = engine.run(simple_points, x_col="x", y_col="y", z_col="z")
        assert result.grid.ndim == 2
        assert result.method == "idw"
        assert not np.all(np.isnan(result.grid))

    def test_higher_power_stronger_locality(self, simple_points):
        """Higher power → estimates cluster more tightly around sample values."""
        xi, yi = self._meshgrid(step=50)
        z = simple_points["z"].values

        g2 = idw_grid(simple_points["x"].values, simple_points["y"].values, z, xi, yi, power=2)
        g8 = idw_grid(simple_points["x"].values, simple_points["y"].values, z, xi, yi, power=8)

        # The range of the high-power grid should be >= that of the low-power grid
        range2 = np.nanmax(g2) - np.nanmin(g2)
        range8 = np.nanmax(g8) - np.nanmin(g8)
        assert range8 >= range2 - 1e-9
