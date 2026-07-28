"""Tests for grid_studio.io.readers."""

from __future__ import annotations

import textwrap
from pathlib import Path

import pandas as pd
import pytest

from grid_studio.io.readers import load_points


@pytest.fixture
def csv_file(tmp_path: Path) -> Path:
    content = textwrap.dedent(
        """\
        Easting,Northing,Au_ppb
        100.0,200.0,5.3
        150.0,250.0,8.1
        200.0,200.0,3.7
        150.0,150.0,6.9
        """
    )
    p = tmp_path / "samples.csv"
    p.write_text(content)
    return p


@pytest.fixture
def excel_file(tmp_path: Path) -> Path:
    df = pd.DataFrame({"X": [0.0, 1.0, 2.0], "Y": [0.0, 1.0, 2.0], "Cu": [10.0, 20.0, 30.0]})
    p = tmp_path / "samples.xlsx"
    df.to_excel(p, index=False)
    return p


class TestLoadPoints:
    def test_csv_loads_correctly(self, csv_file):
        df = load_points(csv_file, x_col="Easting", y_col="Northing", z_col="Au_ppb")
        assert len(df) == 4
        assert list(df.columns) >= ["Easting", "Northing", "Au_ppb"]

    def test_excel_loads_correctly(self, excel_file):
        df = load_points(excel_file, x_col="X", y_col="Y", z_col="Cu")
        assert len(df) == 3

    def test_missing_column_raises(self, csv_file):
        with pytest.raises(ValueError, match="not found"):
            load_points(csv_file, x_col="Easting", y_col="Northing", z_col="NONEXISTENT")

    def test_file_not_found_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            load_points(tmp_path / "missing.csv", x_col="x", y_col="y", z_col="z")

    def test_unsupported_format_raises(self, tmp_path):
        p = tmp_path / "data.xyz"
        p.write_text("some data")
        with pytest.raises(ValueError, match="Unsupported file format"):
            load_points(p, x_col="x", y_col="y", z_col="z")

    def test_nan_rows_dropped(self, tmp_path):
        content = "x,y,z\n1,2,3\n4,,6\n7,8,\n"
        p = tmp_path / "nans.csv"
        p.write_text(content)
        df = load_points(p, x_col="x", y_col="y", z_col="z")
        assert len(df) == 1
