# GRID_STUDIO

A desktop gridding studio for geochemical and geophysical data. GRID_STUDIO provides an interactive environment for loading scattered point data, configuring interpolation and gridding parameters, visualising the resulting grids, and exporting them in industry-standard raster formats.

---

## Features

- **Multiple gridding algorithms** – Inverse Distance Weighting (IDW), Kriging (ordinary & simple), Radial Basis Functions (RBF), Natural Neighbour, Triangulation with Linear Interpolation
- **Flexible data ingest** – CSV/TSV, Microsoft Excel, Esri Shapefile, GeoJSON, and NetCDF point datasets
- **Interactive map canvas** – pan, zoom, and query the computed grid; scatter overlay of the raw sample points
- **Grid export** – GeoTIFF, Esri ASCII Grid (.asc), NetCDF-4, and CSV matrix
- **Project files** – save and reload complete gridding sessions (data + parameters + output paths)
- **Batch mode** – command-line interface for scripted, headless gridding workflows

---

## Requirements

| Requirement | Version |
|---|---|
| Python | ≥ 3.9 |
| NumPy | ≥ 1.23 |
| SciPy | ≥ 1.9 |
| Pandas | ≥ 1.5 |
| GeoPandas | ≥ 0.12 |
| Matplotlib | ≥ 3.6 |
| PyQt6 *or* PySide6 | ≥ 6.4 |
| Rasterio | ≥ 1.3 |
| scikit-learn | ≥ 1.1 |
| pyKrige | ≥ 0.7 |
| netCDF4 | ≥ 1.6 |

> Optional: `GDAL` (≥ 3.5) for extended raster/vector format support.

---

## Installation

```bash
# 1 – Clone the repository
git clone https://github.com/MarcusSkelton/GRID_STUDIO.git
cd GRID_STUDIO

# 2 – Create a virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 3 – Install dependencies
pip install -r requirements.txt

# 4 – (Optional) install as an editable package
pip install -e .
```

---

## Quick Start

### GUI

```bash
python -m grid_studio
```

This opens the main application window. From there you can:
1. **File ▸ Open Data…** – load a CSV or shapefile containing your sample points.
2. Select the **X**, **Y**, and **Z** (value) columns in the *Data* panel.
3. Choose a gridding algorithm and configure its parameters in the *Gridding* panel.
4. Click **Run Grid** to compute the grid.
5. Inspect the result in the *Map* panel, then use **File ▸ Export Grid…** to save.

### Command Line (batch mode)

```bash
python -m grid_studio.cli \
    --input  samples/au_ppb.csv \
    --x      Easting \
    --y      Northing \
    --z      Au_ppb \
    --method idw \
    --resolution 25 \
    --output grids/au_ppb_idw.tif
```

Run `python -m grid_studio.cli --help` for the full list of options.

---

## Project Structure

```
GRID_STUDIO/
├── grid_studio/          # Main Python package
│   ├── __init__.py
│   ├── __main__.py       # Entry point  →  python -m grid_studio
│   ├── core/             # Gridding algorithms and engine
│   │   ├── __init__.py
│   │   ├── engine.py     # GridEngine orchestrator
│   │   ├── idw.py        # Inverse Distance Weighting
│   │   ├── kriging.py    # Kriging (ordinary & simple)
│   │   ├── rbf.py        # Radial Basis Functions
│   │   └── triangulate.py# Triangulation / Natural Neighbour
│   ├── io/               # Data readers and writers
│   │   ├── __init__.py
│   │   ├── readers.py    # CSV, Excel, Shapefile, GeoJSON, NetCDF
│   │   └── writers.py    # GeoTIFF, ASCII Grid, NetCDF-4, CSV
│   ├── ui/               # PyQt6 / PySide6 GUI components
│   │   ├── __init__.py
│   │   ├── main_window.py
│   │   ├── data_panel.py
│   │   ├── gridding_panel.py
│   │   └── map_canvas.py
│   └── utils/            # Shared helpers
│       ├── __init__.py
│       ├── coords.py     # CRS / coordinate helpers
│       └── stats.py      # Descriptive statistics helpers
├── tests/                # pytest test suite
│   ├── conftest.py
│   ├── test_idw.py
│   ├── test_kriging.py
│   ├── test_rbf.py
│   ├── test_readers.py
│   └── test_writers.py
├── examples/             # Sample datasets and scripts
│   └── batch_example.py
├── docs/                 # Documentation sources
├── requirements.txt
├── pyproject.toml
└── README.md
```

---

## Running Tests

```bash
pip install pytest
pytest tests/
```

---

## Contributing

Pull requests are welcome. For significant changes, please open an issue first to discuss the proposed change.

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Commit your changes: `git commit -m "Add my feature"`.
4. Push to the branch: `git push origin feature/my-feature`.
5. Open a Pull Request.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
