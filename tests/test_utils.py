"""Tests for grid_studio.utils.stats and grid_studio.utils.coords."""

from __future__ import annotations

import numpy as np
import pytest

from grid_studio.utils.stats import summary_stats
from grid_studio.utils.coords import extent_from_points


class TestSummaryStats:
    def test_basic_values(self):
        data = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        stats = summary_stats(data)
        assert stats["count"] == 5
        assert stats["min"] == 1.0
        assert stats["max"] == 5.0
        assert stats["mean"] == pytest.approx(3.0)
        assert stats["median"] == pytest.approx(3.0)

    def test_nan_ignored(self):
        data = np.array([1.0, np.nan, 3.0])
        stats = summary_stats(data)
        assert stats["count"] == 2
        assert stats["mean"] == pytest.approx(2.0)

    def test_all_nan_returns_nan(self):
        data = np.array([np.nan, np.nan])
        stats = summary_stats(data)
        for v in stats.values():
            assert np.isnan(v)

    def test_percentiles(self):
        data = np.linspace(0, 100, 101)
        stats = summary_stats(data)
        assert stats["p10"] == pytest.approx(10.0, abs=1.0)
        assert stats["p90"] == pytest.approx(90.0, abs=1.0)


class TestExtentFromPoints:
    def test_basic_extent(self):
        x = np.array([1.0, 5.0, 3.0])
        y = np.array([2.0, 4.0, 6.0])
        x_min, y_min, x_max, y_max = extent_from_points(x, y)
        assert x_min == 1.0
        assert x_max == 5.0
        assert y_min == 2.0
        assert y_max == 6.0

    def test_with_padding(self):
        x = np.array([0.0, 10.0])
        y = np.array([0.0, 10.0])
        x_min, y_min, x_max, y_max = extent_from_points(x, y, padding=5.0)
        assert x_min == pytest.approx(-5.0)
        assert y_min == pytest.approx(-5.0)
        assert x_max == pytest.approx(15.0)
        assert y_max == pytest.approx(15.0)
