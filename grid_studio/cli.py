"""Command-line interface for headless / batch gridding."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="grid-studio",
        description="GRID_STUDIO – batch gridding for geochemical / geophysical data",
    )
    parser.add_argument("--input", "-i", required=True, help="Path to input data file (CSV, XLSX, SHP, GeoJSON, NetCDF)")
    parser.add_argument("--x", required=True, help="Column name for X / Easting coordinates")
    parser.add_argument("--y", required=True, help="Column name for Y / Northing coordinates")
    parser.add_argument("--z", required=True, help="Column name for the Z / value field to grid")
    parser.add_argument(
        "--method",
        choices=["idw", "kriging", "rbf", "triangulate"],
        default="idw",
        help="Gridding algorithm (default: idw)",
    )
    parser.add_argument("--resolution", "-r", type=float, default=100.0, help="Grid cell size in data units (default: 100)")
    parser.add_argument("--output", "-o", required=True, help="Output file path (.tif, .asc, .nc, .csv)")
    parser.add_argument("--crs", default=None, help="EPSG code or proj string for the output CRS (e.g. EPSG:32754)")
    # IDW specific
    parser.add_argument("--idw-power", type=float, default=2.0, help="IDW power parameter (default: 2)")
    # Kriging specific
    parser.add_argument("--kriging-model", default="spherical", choices=["spherical", "exponential", "gaussian", "linear"], help="Kriging variogram model (default: spherical)")
    # RBF specific
    parser.add_argument("--rbf-function", default="thin_plate_spline", help="SciPy RBFInterpolator kernel name (default: thin_plate_spline)")
    return parser


def cli_main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    input_path = Path(args.input)
    output_path = Path(args.output)

    # ── Load data ────────────────────────────────────────────────────────────
    from grid_studio.io.readers import load_points  # noqa: PLC0415

    df = load_points(input_path, x_col=args.x, y_col=args.y, z_col=args.z)
    print(f"Loaded {len(df)} sample points from '{input_path}'.")

    # ── Grid ─────────────────────────────────────────────────────────────────
    from grid_studio.core.engine import GridEngine  # noqa: PLC0415

    engine = GridEngine(
        method=args.method,
        resolution=args.resolution,
        idw_power=args.idw_power,
        kriging_model=args.kriging_model,
        rbf_function=args.rbf_function,
    )
    result = engine.run(df, x_col=args.x, y_col=args.y, z_col=args.z)
    print(f"Grid computed: {result.grid.shape[0]} rows × {result.grid.shape[1]} cols.")

    # ── Export ───────────────────────────────────────────────────────────────
    from grid_studio.io.writers import write_grid  # noqa: PLC0415

    write_grid(result, output_path, crs=args.crs)
    print(f"Grid written to '{output_path}'.")


if __name__ == "__main__":
    cli_main(sys.argv[1:])
