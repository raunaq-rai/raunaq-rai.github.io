"""Tests for the spectrum data preparation script."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from scripts.prepare_spectrum import (
    ERR_DECIMALS,
    FLUX_DECIMALS,
    SOURCE_NPZ,
    _round_column,
    build_payload,
)

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
    """No sample may shift by more than the half-step of its declared precision."""
    for key, name, decimals in (
        ("flux", "flux", FLUX_DECIMALS),
        ("err", "err", ERR_DECIMALS),
    ):
        original = np.asarray(source[key], dtype=float)
        stored = np.asarray(payload[name], dtype=float)
        assert stored.size == original.size

        # Rounding to N decimals can move a value by at most half of the last
        # place. A looser bound would let a genuine precision regression pass:
        # rounding to 1 decimal instead of 4 shifts flux by up to 0.05, which a
        # tolerance scaled to the data range would not catch.
        half_step = 0.5 * 10.0 ** (-decimals)
        finite = np.isfinite(original)
        assert np.all(np.abs(stored[finite] - original[finite]) <= half_step * 1.000001)


def test_n_stacked_is_carried_through(source, payload):
    assert payload["n_stacked"] == int(source["n_stacked"])


def test_nulls_correspond_exactly_to_non_finite_samples(source, payload):
    """JSON has no NaN, so every non-finite sample, and only those, becomes null."""
    for key, name in (("flux", "flux"), ("err", "err")):
        original = np.asarray(source[key], dtype=float)
        nulls = np.array([value is None for value in payload[name]])

        # Guard against this test quietly becoming vacuous. If the stack is ever
        # regenerated without gaps, the assertion below would hold trivially and
        # stop testing anything, so fail loudly instead.
        assert nulls.any(), "source has no non-finite samples; this test proves nothing"

        np.testing.assert_array_equal(nulls, ~np.isfinite(original))


def test_round_column_maps_every_non_finite_form_to_none():
    """Unit test of the conversion itself, independent of the current dataset."""
    result = _round_column(
        np.array([1.234567, np.nan, np.inf, -np.inf, 0.0]), 4
    )
    assert result == [1.2346, None, None, None, 0.0]


def test_non_uniform_grid_is_rejected():
    """An implicit grid would misrepresent non-uniform wavelengths, so it must raise."""
    uneven = {
        "wave_angstrom": np.array([1000.0, 1000.5, 1002.0]),
        "flux": np.zeros(3),
        "err": np.ones(3),
        "n_stacked": np.array(1),
    }
    with pytest.raises(ValueError, match="not uniform"):
        build_payload(uneven)


def test_serialised_payload_is_small_enough_to_ship(payload):
    """The asset must stay small; the browser downloads it on every visit."""
    size = len(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    assert size < 250_000, f"payload is {size / 1000:.0f} kB"
