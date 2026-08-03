"""Download Google Fonts woff2 files and emit a self-hosted @font-face stylesheet.

Run once. Re-run only to change weights or families.

    conda activate jwst && python scripts/fetch_fonts.py
"""

from __future__ import annotations

import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "assets" / "fonts"
CSS_OUT = ROOT / "assets" / "css" / "fonts.css"

# A modern browser user agent is required, otherwise the API returns ttf.
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
API = (
    "https://fonts.googleapis.com/css2"
    "?family=Source+Serif+4:wght@300;400;600"
    "&family=Inter:wght@400;500;600"
    "&display=swap"
)

# Only these subsets are needed for British English prose.
KEEP_SUBSETS = {"latin", "latin-ext"}


def fetch(url: str) -> bytes:
    """Fetch a URL with a browser user agent."""
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request) as response:
        return response.read()


def main() -> None:
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    CSS_OUT.parent.mkdir(parents=True, exist_ok=True)

    css = fetch(API).decode("utf-8")

    # The API emits "/* subset */" immediately before each @font-face block.
    blocks = re.findall(r"/\*\s*([\w-]+)\s*\*/\s*(@font-face\s*\{[^}]*\})", css)
    if not blocks:
        raise SystemExit("No @font-face blocks found; the API response changed.")

    out: list[str] = [
        "/* Source Serif 4 and Inter, self-hosted. Licensed under the SIL Open",
        " Font License 1.1; see assets/fonts/OFL.txt. */",
        "",
    ]

    # Clear stale files so a re-run cannot leave orphans behind.
    for stale in FONT_DIR.glob("*.woff2"):
        stale.unlink()

    # Both families are variable fonts, so Google serves the SAME file for every
    # weight in a subset and merely varies the font-weight declaration. Keyed on
    # the remote URL, each file is fetched and stored once, and every @font-face
    # block that uses it points at that one copy. Naming by weight instead would
    # store three byte-identical files and make browsers download each of them.
    by_url: dict[str, str] = {}

    for subset, block in blocks:
        if subset not in KEEP_SUBSETS:
            continue

        url_match = re.search(r"url\((https://[^)]+\.woff2)\)", block)
        family_match = re.search(r"font-family:\s*'([^']+)'", block)
        weight_match = re.search(r"font-weight:\s*(\d+)", block)
        if not (url_match and family_match and weight_match):
            raise SystemExit(f"Could not parse a {subset} block.")

        remote = url_match.group(1)
        family = family_match.group(1).lower().replace(" ", "-")

        name = by_url.get(remote)
        if name is None:
            name = f"{family}-{subset}.woff2"
            (FONT_DIR / name).write_bytes(fetch(remote))
            by_url[remote] = name

        out.append(block.replace(remote, f"/assets/fonts/{name}"))
        out.append("")

    CSS_OUT.write_text("\n".join(out), encoding="utf-8")
    total_kb = sum(p.stat().st_size for p in FONT_DIR.glob("*.woff2")) / 1024
    print(f"Downloaded {len(by_url)} unique files, {total_kb:.0f} kB total")
    print(f"Declared {len(out) // 2} @font-face rules")
    print(f"Wrote {CSS_OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
