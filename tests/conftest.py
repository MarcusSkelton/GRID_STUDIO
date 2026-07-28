"""Shared pytest fixtures for GRID_STUDIO tests."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest


@pytest.fixture
def simple_points() -> pd.DataFrame:
    """A small synthetic point dataset on a 5×5 regular grid."""
    rng = np.random.default_rng(42)
    x = np.repeat(np.arange(0, 500, 100), 5).astype(float)
    y = np.tile(np.arange(0, 500, 100), 5).astype(float)
    z = rng.uniform(0.0, 100.0, size=x.size)
    return pd.DataFrame({"x": x, "y": y, "z": z})


@pytest.fixture
def gradient_points() -> pd.DataFrame:
    """Points whose z value is a simple linear gradient: z = x + y."""
    x = np.repeat(np.arange(0, 600, 100), 6).astype(float)
    y = np.tile(np.arange(0, 600, 100), 6).astype(float)
    z = x + y
    return pd.DataFrame({"x": x, "y": y, "z": z})
