"""Main application window for GRID_STUDIO."""

from __future__ import annotations


def launch_gui() -> None:
    """Initialise and show the main GRID_STUDIO window.

    This function is the single entry point called by ``__main__.py``.
    The Qt event loop is started here and the function blocks until the
    application is closed by the user.
    """
    try:
        from PyQt6.QtWidgets import QApplication  # type: ignore[import]
    except ImportError:
        try:
            from PySide6.QtWidgets import QApplication  # type: ignore[import]
        except ImportError as exc:
            raise ImportError(
                "No Qt backend found. Install PyQt6 or PySide6:\n"
                "  pip install PyQt6\nor\n  pip install PySide6"
            ) from exc

    import sys

    app = QApplication.instance() or QApplication(sys.argv)

    from grid_studio.ui._window import MainWindow  # type: ignore[import]  # noqa: PLC0415

    window = MainWindow()
    window.show()
    sys.exit(app.exec())
