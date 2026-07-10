# LCOJ/CPPro release evidence — 2026-07-11

This directory preserves the requested screenshots and a deployable source
bundle without embedding server credentials or host-specific configuration.

## Contents

- `screenshots/` — 16 retained PNG captures (1,719,170 bytes). The filenames
  are neutralized to avoid publishing host addresses from the original capture
  paths.
- `deploy/lcoj-cppro-deploy-2026-07-11.tar.gz` — sanitized source bundle,
  1,784 entries and 24,670,856 bytes. SHA-256:
  `637afaf755e7b028f86b0907320b2c7ce9f9be40b3e85ceb5307ded5bb409cb4`.

## Sanitization

The historical raw deploy archive is intentionally not copied because it
contains `dmoj/config/local_settings.py`. The replacement archive excludes
settings files, environment files, local data/log/media directories, editor
scratch, test/build outputs, and VCS metadata.

`dmoj/settings.py` now takes Django, global API, and event-daemon keys from
environment variables (or `local_settings.py`). It generates an ephemeral
development key and refuses to run with `DEBUG` disabled if no production
`DJANGO_SECRET_KEY` is supplied.
