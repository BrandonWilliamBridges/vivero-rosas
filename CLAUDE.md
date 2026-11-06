# Vivero de Rosas (viveroderosas.com)

Taco truck site. GitHub Pages serves `docs/` from `main` at viveroderosas.com. This repo must stay public because the live site depends on it.

## Mirrored to website-samples
This site is mirrored to [BrandonWilliamBridges/website-samples](https://github.com/BrandonWilliamBridges/website-samples) (folder `vivero-de-rosas/`, live at https://brandonwilliambridges.github.io/website-samples/vivero-de-rosas/) by `.github/workflows/sync-samples.yml`, which runs on every push to `main`.

- **The sync workflow must keep working whenever the site changes.** It copies `docs/`, leaving out `docs/admin/` (the menu editor) and the search-engine verification file. If you move or rename the site's output, add a build step, or add files that must not be public, update the workflow in the same change.
- Only the public site is copied. Never let it copy `.env` files, secrets, keys, databases or real customer data. `.github/scripts/sync-to-samples.py` strips those, points links at the copy's folder, removes analytics, adds `noindex`, stops forms from sending, and halts the sync if anything still looks like a secret. The same script is in every repo that syncs, so change it everywhere at once.
- The workflow needs the repo secret `SAMPLES_TOKEN`: a fine-grained token limited to website-samples, with Contents read and write. When it expires, make a new one and update the secret in every source repo.
