"""Data readers – load scatter-point datasets into a Pandas DataFrame."""

from __future__ import annotations

from pathlib import Path

import pandas as pd


_SUPPORTED = {
    ".csv": "_read_csv",
    ".tsv": "_read_tsv",
    ".txt": "_read_csv",
    ".xlsx": "_read_excel",
    ".xls": "_read_excel",
    ".shp": "_read_shapefile",
    ".geojson": "_read_geojson",
    ".json": "_read_geojson",
    ".nc": "_read_netcdf",
}


def load_points(
    path: str | Path,
    x_col: str,
    y_col: str,
    z_col: str,
    *,
    crs: str | None = None,
) -> pd.DataFrame:
    """Load a point dataset and return a DataFrame with *x_col*, *y_col*, *z_col*.

    Supported formats: CSV/TSV, Excel (.xlsx/.xls), Shapefile, GeoJSON, NetCDF.

    Parameters
    ----------
    path:
        Path to the input file.
    x_col, y_col, z_col:
        Column names for easting/longitude, northing/latitude, and the
        value field to grid.
    crs:
        Optional coordinate-reference-system string (only used when
        loading spatial formats that may lack CRS metadata).

    Returns
    -------
    pd.DataFrame
        DataFrame guaranteed to contain *x_col*, *y_col*, and *z_col*.

    Raises
    ------
    ValueError
        If the file format is not supported or required columns are absent.
    FileNotFoundError
        If *path* does not exist.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Input file not found: {path}")

    suffix = path.suffix.lower()
    handler_name = _SUPPORTED.get(suffix)
    if handler_name is None:
        raise ValueError(
            f"Unsupported file format: '{suffix}'. "
            f"Supported formats: {', '.join(_SUPPORTED)}"
        )

    handler = globals()[handler_name]
    df = handler(path)

    _validate_columns(df, x_col, y_col, z_col, path)
    # Keep only rows with valid coordinate and value data
    df = df.dropna(subset=[x_col, y_col, z_col]).reset_index(drop=True)
    return df


# ── Format handlers ────────────────────────────────────────────────────────────

def _read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path)


def _read_tsv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, sep="\t")


def _read_excel(path: Path) -> pd.DataFrame:
    return pd.read_excel(path)


def _read_shapefile(path: Path) -> pd.DataFrame:
    try:
        import geopandas as gpd  # type: ignore[import]
    except ImportError as exc:
        raise ImportError("geopandas is required to read shapefiles: pip install geopandas") from exc

    gdf = gpd.read_file(path)
    df = pd.DataFrame(gdf.drop(columns="geometry"))
    # Attach geometry coordinates as explicit columns if not already present
    if "x" not in df.columns and "X" not in df.columns:
        df["x"] = gdf.geometry.x
        df["y"] = gdf.geometry.y
    return df


def _read_geojson(path: Path) -> pd.DataFrame:
    return _read_shapefile(path)  # geopandas handles GeoJSON too


def _read_netcdf(path: Path) -> pd.DataFrame:
    try:
        import netCDF4 as nc  # type: ignore[import]
        import numpy as np
    except ImportError as exc:
        raise ImportError("netCDF4 is required to read NetCDF files: pip install netCDF4") from exc

    ds = nc.Dataset(path)
    data: dict[str, list] = {}
    for var_name, var in ds.variables.items():
        if var.ndim == 1:
            data[var_name] = var[:].tolist()
    ds.close()
    return pd.DataFrame(data)


# ── Validation ─────────────────────────────────────────────────────────────────

def _validate_columns(df: pd.DataFrame, x_col: str, y_col: str, z_col: str, path: Path) -> None:
    missing = [c for c in (x_col, y_col, z_col) if c not in df.columns]
    if missing:
        raise ValueError(
            f"Column(s) {missing} not found in '{path}'. "
            f"Available columns: {list(df.columns)}"
        )
