"""Convert the stacked z > 6 spectrum into web assets.

Produces a compact JSON file for the interactive figure and a static PNG for
visitors without JavaScript. The source .npz is never committed.

    conda activate jwst && python scripts/prepare_spectrum.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SOURCE_NPZ = (
    Path.home()
    / "Documents/phd/y1/stacking_project/stack_array/stack_zgt6_Muv19_21.npz"
)
JSON_OUT = ROOT / "assets" / "data" / "stack.json"
PNG_OUT = ROOT / "assets" / "img" / "spectrum-fallback.png"

FLUX_DECIMALS = 4
ERR_DECIMALS = 4


def _round_column(values: np.ndarray, decimals: int) -> list[float | None]:
    """Round to a fixed number of decimals, mapping non-finite samples to None."""
    rounded = np.round(np.asarray(values, dtype=float), decimals)
    return [None if not np.isfinite(v) else float(v) for v in rounded]


def build_payload(source: dict[str, np.ndarray]) -> dict:
    """Build the JSON payload from the arrays in the source npz.

    Parameters
    ----------
    source
        Mapping with keys ``wave_angstrom``, ``flux``, ``err`` and ``n_stacked``.

    Returns
    -------
    dict
        Payload with an implicit wavelength grid.

    Raises
    ------
    ValueError
        If the wavelength grid is not uniform, since the implicit grid would
        then misrepresent the data.
    """
    wave = np.asarray(source["wave_angstrom"], dtype=float)
    steps = np.diff(wave)
    if not np.allclose(steps, steps[0], rtol=0, atol=1e-9):
        raise ValueError("Wavelength grid is not uniform; cannot store it implicitly.")

    return {
        "n_stacked": int(source["n_stacked"]),
        "wave_start": float(wave[0]),
        "wave_step": float(steps[0]),
        "n": int(wave.size),
        "flux": _round_column(source["flux"], FLUX_DECIMALS),
        "err": _round_column(source["err"], ERR_DECIMALS),
    }


def write_fallback_png(source: dict[str, np.ndarray]) -> None:
    """Render the default view as a static PNG for the noscript fallback."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    paper, ink, rule, accent = "#FCFBF8", "#16181C", "#E3DED3", "#1F3A5F"
    wave = source["wave_angstrom"]
    flux = source["flux"]
    err = source["err"]

    fig, ax = plt.subplots(figsize=(9.6, 3.3), dpi=180)
    fig.patch.set_facecolor(paper)
    ax.set_facecolor(paper)
    ax.fill_between(wave, flux - err, flux + err, color=accent, alpha=0.14, lw=0)
    ax.plot(wave, flux, color=ink, lw=0.62)
    ax.axhline(0, color=rule, lw=0.8, zorder=0)
    ax.set_xlim(wave[0], wave[-1])
    top = np.nanpercentile(flux, 99.9)
    ax.set_ylim(np.nanpercentile(flux, 0.5) - 0.5, top * 1.15)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("bottom", "left"):
        ax.spines[side].set_color(rule)
        ax.spines[side].set_linewidth(0.9)
    ax.tick_params(colors="#6E6E68", labelsize=7.5, length=3, width=0.8)
    ax.set_xlabel("Rest wavelength  [Å]", fontsize=8, color="#3C3E42")
    ax.set_ylabel("Flux", fontsize=8, color="#3C3E42")
    fig.tight_layout(pad=0.7)

    PNG_OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(PNG_OUT, facecolor=paper)
    plt.close(fig)


def main() -> None:
    """Convert the source stack into the JSON and PNG assets the site ships."""
    data = np.load(SOURCE_NPZ)
    source = {key: data[key] for key in data.files}

    payload = build_payload(source)
    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, separators=(",", ":"))
    JSON_OUT.write_text(text, encoding="utf-8")

    write_fallback_png(source)

    print(f"Wrote {JSON_OUT.relative_to(ROOT)}  ({len(text) / 1000:.0f} kB)")
    print(f"Wrote {PNG_OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
