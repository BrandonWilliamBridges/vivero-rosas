# Vivero de Rosas (viveroderosas.com)

Website for Vivero de Rosas, Ms. Rosas's taco truck in Cypress, TX. GitHub Pages serves `docs/` from `main` at viveroderosas.com, so pushing to `main` publishes the site. This repository must stay public because the live site depends on it. The live design is Sobremesa, chosen from the five designs kept in the vivero-rosas-designs repository.

## Stack
Plain HTML, CSS and JavaScript in `docs/`. No build step.

## Layout
- `docs/index.html`: the whole public site
- `docs/menu.json`: the menu. The site reads it, and the menu editor writes it.
- `docs/admin/`: the menu editor, which saves `menu.json` through the GitHub API. Not public-facing, and never copied to website-samples.
- `docs/img/`: photos
- `docs/CNAME`, `docs/robots.txt`, `docs/sitemap.xml`, and the search-engine verification file (`docs/08b690d7975b6da3743d359e5bb2b66a.txt`): leave these alone unless asked.

## Commands
- Preview locally: `python3 -m http.server --directory docs`

## Rules
- Keep the English and Spanish text in step.
- Never commit `photos/`, `notes.md` or `.secrets/` (all ignored).
- Use the `ship-site` skill to publish a change.

## Mirrored to website-samples
This site is mirrored to [BrandonWilliamBridges/website-samples](https://github.com/BrandonWilliamBridges/website-samples) (folder `vivero-de-rosas/`, live at https://brandonwilliambridges.github.io/website-samples/vivero-de-rosas/) by `.github/workflows/sync-samples.yml`, which runs on every push to `main`.

- **The sync workflow must keep working whenever the site changes.** It copies `docs/`, leaving out `docs/admin/` (the menu editor) and the search-engine verification file. If you move or rename the site's output, add a build step, or add files that must not be public, update the workflow in the same change.
- Only the public site is copied. Never let it copy `.env` files, secrets, keys, databases or real customer data. `.github/scripts/sync-to-samples.py` strips those, points links at the copy's folder, removes analytics, adds `noindex`, stops forms from sending, and halts the sync if anything still looks like a secret. The same script is in every repo that syncs, so change it everywhere at once.
- The workflow needs the repo secret `SAMPLES_TOKEN`: a fine-grained token limited to website-samples, with Contents read and write. When it expires, make a new one and update the secret in every source repo.
