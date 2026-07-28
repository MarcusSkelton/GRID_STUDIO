"""Grid writers – export a GridResult to various raster/table formats."""

from __future__ import annotations

from pathlib import Path

import numpy as np

from grid_studio.core.engine import GridResult


_WRITERS = {
    ".tif": "_write_geotiff",
    ".tiff": "_write_geotiff",
    ".asc": "_write_asc",
    ".nc": "_write_netcdf",
    ".csv": "_write_csv",
}


def write_grid(result: GridResult, path: str | Path, *, crs: str | None = None) -> None:
    """Write *result* to *path* in the format inferred from the file extension.

    Parameters
    ----------
    result:
        A :class:`~grid_studio.core.engine.GridResult` produced by
        :class:`~grid_studio.core.engine.GridEngine`.
    path:
        Output file path. The extension determines the format.
    crs:
        Coordinate reference system for raster outputs, e.g. ``"EPSG:32754"``.
        Required for GeoTIFF and NetCDF; ignored for CSV and ASC.

    Raises
    ------
    ValueError
        If the file extension is not supported.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    suffix = path.suffix.lower()
    writer_name = _WRITERS.get(suffix)
    if writer_name is None:
        raise ValueError(
            f"Unsupported output format: '{suffix}'. "
            f"Supported formats: {', '.join(_WRITERS)}"
        )

    writer = globals()[writer_name]
    writer(result, path, crs=crs)


# ── Format writers ─────────────────────────────────────────────────────────────

def _write_geotiff(result: GridResult, path: Path, *, crs: str | None) -> None:
    try:
        import rasterio  # type: ignore[import]
        from rasterio.transform import from_bounds  # type: ignore[import]
    except ImportError as exc:
        raise ImportError("rasterio is required for GeoTIFF output: pip install rasterio") from exc

    transform = from_bounds(
        result.x_min,
        result.y_min,
        result.x_max,
        result.y_max,
        result.n_cols,
        result.n_rows,
    )

    profile = {
        "driver": "GTiff",
        "dtype": "float32",
        "width": result.n_cols,
        "height": result.n_rows,
        "count": 1,
        "nodata": np.nan,
        "transform": transform,
    }
    if crs:
        import rasterio.crs as rcrs  # type: ignore[import]

        profile["crs"] = rcrs.CRS.from_user_input(crs)

    # Flip vertically: rasterio expects top-row first, but our grid is bottom-first
    grid_out = np.flipud(result.grid).astype(np.float32)

    with rasterio.open(path, "w", **profile) as dst:
        dst.write(grid_out, 1)


def _write_asc(result: GridResult, path: Path, *, crs: str | None = None) -> None:  # noqa: ARG001
    """Write Esri ASCII Grid format (.asc)."""
    n_rows, n_cols = result.grid.shape
    nodata_value = -9999.0

    grid_out = np.where(np.isnan(result.grid), nodata_value, result.grid)

    with open(path, "w") as f:
        f.write(f"ncols         {n_cols}\n")
        f.write(f"nrows         {n_rows}\n")
        f.write(f"xllcorner     {result.x_min}\n")
        f.write(f"yllcorner     {result.y_min}\n")
        f.write(f"cellsize      {result.resolution}\n")
        f.write(f"NODATA_value  {nodata_value}\n")
        # ASC is written top-row first
        for row in np.flipud(grid_out):
            f.write(" ".join(f"{v:.6g}" for v in row) + "\n")


def _write_netcdf(result: GridResult, path: Path, *, crs: str | None = None) -> None:
    try:
        import netCDF4 as nc  # type: ignore[import]
    except ImportError as exc:
        raise ImportError("netCDF4 is required for NetCDF output: pip install netCDF4") from exc

    n_rows, n_cols = result.grid.shape
    x_coords = np.linspace(result.x_min, result.x_max, n_cols)
    y_coords = np.linspace(result.y_min, result.y_max, n_rows)

    ds = nc.Dataset(path, "w", format="NETCDF4")
    ds.createDimension("x", n_cols)
    ds.createDimension("y", n_rows)

    xv = ds.createVariable("x", "f8", ("x",))
    xv.units = "m"
    xv.long_name = "Easting"
    xv[:] = x_coords

    yv = ds.createVariable("y", "f8", ("y",))
    yv.units = "m"
    yv.long_name = "Northing"
    yv[:] = y_coords

    zv = ds.createVariable(result.z_col or "z", "f4", ("y", "x"), fill_value=np.float32(np.nan))
    zv.long_name = result.z_col or "gridded_value"
    zv.gridding_method = result.method
    if crs:
        zv.crs = crs
    zv[:, :] = result.grid.astype(np.float32)

    ds.close()


def _write_csv(result: GridResult, path: Path, *, crs: str | None = None) -> None:  # noqa: ARG001
    """Write the grid as a long-format CSV with columns x, y, z."""
    import pandas as pd  # noqa: PLC0415

    n_rows, n_cols = result.grid.shape
    x_coords = np.linspace(result.x_min, result.x_max, n_cols)
    y_coords = np.linspace(result.y_min, result.y_max, n_rows)

    xi, yi = np.meshgrid(x_coords, y_coords)
    df = pd.DataFrame(
        {
            "x": xi.ravel(),
            "y": yi.ravel(),
            result.z_col or "z": result.grid.ravel(),
        }
    )
    df.to_csv(path, index=False)
