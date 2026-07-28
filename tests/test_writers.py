"""Tests for grid_studio.io.writers."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from grid_studio.core.engine import GridResult
from grid_studio.io.writers import write_grid


@pytest.fixture
def sample_result() -> GridResult:
    rng = np.random.default_rng(0)
    grid = rng.uniform(0, 100, (10, 10)).astype(float)
    return GridResult(
        grid=grid,
        x_min=0.0,
        x_max=900.0,
        y_min=0.0,
        y_max=900.0,
        resolution=100.0,
        method="idw",
        z_col="Au_ppb",
    )


class TestWriteGrid:
    def test_csv_roundtrip(self, sample_result, tmp_path):
        out = tmp_path / "grid.csv"
        write_grid(sample_result, out)
        import pandas as pd

        df = pd.read_csv(out)
        assert "x" in df.columns
        assert "y" in df.columns
        assert "Au_ppb" in df.columns
        assert len(df) == sample_result.grid.size

    def test_asc_header(self, sample_result, tmp_path):
        out = tmp_path / "grid.asc"
        write_grid(sample_result, out)
        lines = out.read_text().splitlines()
        header_keys = {line.split()[0].lower() for line in lines[:6]}
        assert {"ncols", "nrows", "xllcorner", "yllcorner", "cellsize", "nodata_value"} == header_keys

    def test_asc_correct_dimensions(self, sample_result, tmp_path):
        out = tmp_path / "grid.asc"
        write_grid(sample_result, out)
        lines = out.read_text().splitlines()
        ncols = int(lines[0].split()[1])
        nrows = int(lines[1].split()[1])
        assert ncols == sample_result.n_cols
        assert nrows == sample_result.n_rows
        data_lines = lines[6:]
        assert len(data_lines) == nrows

    def test_unsupported_format_raises(self, sample_result, tmp_path):
        with pytest.raises(ValueError, match="Unsupported output format"):
            write_grid(sample_result, tmp_path / "grid.xyz")

    def test_output_dir_created(self, sample_result, tmp_path):
        out = tmp_path / "nested" / "deep" / "grid.csv"
        write_grid(sample_result, out)
        assert out.exists()
