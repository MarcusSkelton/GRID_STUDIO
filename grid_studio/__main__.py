"""Entry point for ``python -m grid_studio``."""

import sys


def main() -> None:
    """Launch GRID_STUDIO.

    If a Qt library is available the GUI is started; otherwise the CLI
    help text is printed so the package is still usable headlessly.
    """
    if "--cli" in sys.argv or "-c" in sys.argv:
        from grid_studio.cli import cli_main  # noqa: PLC0415

        cli_main()
        return

    try:
        from grid_studio.ui.main_window import launch_gui  # noqa: PLC0415

        launch_gui()
    except ImportError:
        print(
            "No Qt backend found. Install PyQt6 or PySide6 for the GUI.\n"
            "Use  python -m grid_studio.cli --help  for headless operation."
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
