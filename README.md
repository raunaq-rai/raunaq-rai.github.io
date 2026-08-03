# raunaq-rai.github.io

Personal website of Raunaq Rai, PhD student in the Department of Physics and
Astronomy at University College London.

Built with Jekyll and served by GitHub Pages at <https://raunaq-rai.github.io>.

## Adding content

- **A publication:** add an entry to `_data/publications.yml`.
- **A talk:** add an entry to `_data/talks.yml`.
- **A package:** add an entry to `_data/software.yml`.

Editing these files on github.com is enough; Pages rebuilds automatically.

## Local preview

```
bundle install
bundle exec jekyll serve
```

## Regenerating the spectrum data

```
conda activate jwst
python scripts/prepare_spectrum.py
```
