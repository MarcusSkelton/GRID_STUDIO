"""MainWindow – the primary application window for GRID_STUDIO.

This module provides a minimal working window that can be extended with
full panel widgets (data, gridding parameters, map canvas) as the project
grows.
"""

from __future__ import annotations


def _get_qt():
    """Return the QMainWindow and QLabel classes from whichever Qt binding is available."""
    try:
        from PyQt6.QtWidgets import QMainWindow, QLabel, QWidget, QVBoxLayout  # type: ignore[import]
        from PyQt6.QtCore import Qt  # type: ignore[import]

        return QMainWindow, QLabel, QWidget, QVBoxLayout, Qt
    except ImportError:
        pass

    try:
        from PySide6.QtWidgets import QMainWindow, QLabel, QWidget, QVBoxLayout  # type: ignore[import]
        from PySide6.QtCore import Qt  # type: ignore[import]

        return QMainWindow, QLabel, QWidget, QVBoxLayout, Qt
    except ImportError as exc:
        raise ImportError(
            "No Qt backend found. Install PyQt6 or PySide6:\n"
            "  pip install PyQt6\nor\n  pip install PySide6"
        ) from exc


class MainWindow:
    """Thin wrapper that creates the top-level GRID_STUDIO application window."""

    def __init__(self) -> None:
        QMainWindow, QLabel, QWidget, QVBoxLayout, Qt = _get_qt()

        self._window = QMainWindow()
        self._window.setWindowTitle("GRID_STUDIO")
        self._window.resize(1200, 800)

        central = QWidget()
        layout = QVBoxLayout(central)

        placeholder = QLabel(
            "GRID_STUDIO\n\nGeochemical & Geophysical Gridding Studio\n\n"
            "Use File → Open Data… to load a sample dataset."
        )
        placeholder.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(placeholder)

        self._window.setCentralWidget(central)

    def show(self) -> None:
        self._window.show()
