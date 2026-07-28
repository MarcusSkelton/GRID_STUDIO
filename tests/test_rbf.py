"""Tests for grid_studio.core.rbf and grid_studio.core.triangulate."""

from __future__ import annotations

import numpy as np
import pytest

from grid_studio.core.rbf import rbf_grid
from grid_studio.core.triangulate import triangulate_grid
from grid_studio.core.engine import GridEngine


@pytest.fixture
def linear_data():
    """Points on a regular grid where z = x + y (exact linear field)."""
    x = np.repeat(np.arange(0, 600, 100), 6).astype(float)
    y = np.tile(np.arange(0, 600, 100), 6).astype(float)
    z = x + y
    return x, y, z


class TestRBFGrid:
    def test_output_shape(self, linear_data):
        x, y, z = linear_data
        xi, yi = np.meshgrid(
            np.arange(0, 501, 100, dtype=float),
            np.arange(0, 501, 100, dtype=float),
        )
        result = rbf_grid(x, y, z, xi, yi)
        assert result.shape == xi.shape

    def test_linear_field_recovery(self, linear_data):
        """RBF with 'linear' kernel should recover a linear field closely."""
        x, y, z = linear_data
        xi, yi = np.meshgrid(
            np.arange(100, 400, 100, dtype=float),
            np.arange(100, 400, 100, dtype=float),
        )
        result = rbf_grid(x, y, z, xi, yi, function="linear")
        expected = xi + yi
        np.testing.assert_allclose(result, expected, rtol=1e-3, atol=1e-3)

    def test_engine_rbf_runs(self, simple_points):
        engine = GridEngine(method="rbf", resolution=100.0)
        result = engine.run(simple_points, x_col="x", y_col="y", z_col="z")
        assert result.grid.ndim == 2
        assert result.method == "rbf"


class TestTriangulateGrid:
    def test_output_shape(self, linear_data):
        x, y, z = linear_data
        xi, yi = np.meshgrid(
            np.arange(0, 501, 100, dtype=float),
            np.arange(0, 501, 100, dtype=float),
        )
        result = triangulate_grid(x, y, z, xi, yi)
        assert result.shape == xi.shape

    def test_linear_field_interior(self, linear_data):
        """Linear triangulation must reproduce a linear field inside the hull."""
        x, y, z = linear_data
        # Query only interior points (safe inside convex hull)
        xi, yi = np.meshgrid(
            np.arange(100, 500, 100, dtype=float),
            np.arange(100, 500, 100, dtype=float),
        )
        result = triangulate_grid(x, y, z, xi, yi, method="linear")
        expected = xi + yi
        np.testing.assert_allclose(result, expected, rtol=1e-6, atol=1e-6)

    def test_outside_hull_is_nan(self, linear_data):
        """Points outside the data convex hull should be NaN with linear method."""
        x, y, z = linear_data
        # Query a point far outside
        xi, yi = np.meshgrid([1e6], [1e6])
        result = triangulate_grid(x, y, z, xi, yi, method="linear")
        assert np.isnan(result[0, 0])

    def test_engine_triangulate_runs(self, simple_points):
        engine = GridEngine(method="triangulate", resolution=100.0)
        result = engine.run(simple_points, x_col="x", y_col="y", z_col="z")
        assert result.grid.ndim == 2
        assert result.method == "triangulate"
