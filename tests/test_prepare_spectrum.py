"""Tests for the spectrum data preparation script."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from scripts.prepare_spectrum import SOURCE_NPZ, build_payload

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def source() -> dict[str, np.ndarray]:
    data = np.load(SOURCE_NPZ)
    return {k: data[k] for k in data.files}


@pytest.fixture(scope="module")
def payload(source) -> dict:
    return build_payload(source)


def test_grid_is_uniform_and_described_exactly(source, payload):
    """The implicit wavelength grid must reproduce the source wavelengths."""
    wave = source["wave_angstrom"]
    rebuilt = payload["wave_start"] + np.arange(payload["n"]) * payload["wave_step"]
    assert payload["n"] == wave.size
    np.testing.assert_allclose(rebuilt, wave, rtol=0, atol=1e-9)


def test_flux_and_error_survive_rounding(source, payload):
    """Rounding must not shift any sample by more than one part in a thousand."""
    for key, name in (("flux", "flux"), ("err", "err")):
        original = source[key]
        stored = np.asarray(payload[name], dtype=float)
        assert stored.size == original.size
        scale = np.nanmax(np.abs(original))
        np.testing.assert_allclose(stored, original, rtol=0, atol=scale * 1e-3)


def test_n_stacked_is_carried_through(source, payload):
    assert payload["n_stacked"] == int(source["n_stacked"])


def test_no_nan_or_infinite_values_reach_the_browser(payload):
    """JSON has no NaN; any non-finite sample must be replaced by null."""
    for name in ("flux", "err"):
        for value in payload[name]:
            assert value is None or np.isfinite(value)


def test_serialised_payload_is_small_enough_to_ship(payload):
    """The asset must stay small; the browser downloads it on every visit."""
    size = len(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    assert size < 250_000, f"payload is {size / 1000:.0f} kB"
