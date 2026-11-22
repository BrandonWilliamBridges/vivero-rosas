---
name: ship-site
description: Publish any change to viveroderosas.com (menu, wording, photos, styling). Covers checking the page locally and pushing to main, which publishes through GitHub Pages and updates the website-samples copy.
---

# Ship a change to viveroderosas.com

1. Pull first: `git pull`. The menu editor saves `docs/menu.json` to the repository through the GitHub API, so `main` may have moved.
2. Make the change in `docs/`. Menu items go in `docs/menu.json`, not hard-coded in `index.html`.
3. Check: `python3 -m http.server --directory docs`, open the page, switch between English and Spanish, and check it on a phone-sized window.
4. Commit and push to `main`. GitHub Pages publishes within about a minute, and `sync-samples.yml` updates the website-samples copy.
5. Open https://viveroderosas.com to confirm the change is live.
