# Development

This is a static GitHub Pages site. No framework, package install, backend, or build service is required.

## Preview

```sh
python3 scripts/serve.py --port 8000
```

Open http://127.0.0.1:8000/audioeditsurvey_project/ . The preview uses the same subdirectory as the intended GitHub Pages URL. It serves only this project and binds to loopback.

## Maintain the resource catalog

The English survey README is the upstream editorial source. Refresh the structured catalog after reviewing its changes:

```sh
python3 scripts/import_readme.py ../AudioEditSurvey/README.md
node --test tests/catalog.test.mjs
```

`data/resources.json` records the exact source commit and README digest. The site renders its counts, links, tables, and downloads from this file. The importer does not modify the survey repository. Do not hand-edit generated resource entries: correct the upstream source and import again.

`assets/catalog.js` contains resource filtering logic and the taxonomy operations. Explore Audio Editing links now open Audio Examples through `assets/sample-routing.js`. Each sample manifest records matching `operationIds`; missing operations show an empty sample state rather than unrelated recordings. The legacy operation-to-model mappings remain available for older resource URLs. The six methods in the source training-free table determine the training-free tag; other catalog methods are training-based. Multi-domain architecture tags can overlap.

`assets/app.js` controls tabs, taxonomy navigation, figures, citation copying, column visibility, export, and URL filter state. The unmodified 3DGS / Academic template assets are in `vendor/3dgs/`; source hashes are in `vendor/sources.json`. `assets/site.css` contains only project-specific additions and responsive overrides. DataTables handles sorting of all filtered rows. Narrative content and paper metadata are in `index.html`.

## Browser validation

`tests/browser.mjs` uses Playwright from an existing environment. Start the preview server first, then:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/browser.mjs
```

The script checks the actual resource filters, taxonomy routing, browser-history state, benchmark details, full-table sorting, column visibility, JSON export, citation copy, figure dialog, and a 390 px mobile viewport. Screenshots go to the temporary directory printed by the script.

## Publish after review

All asset paths are relative and `.nojekyll` is included. Once the site is approved and pushed, enable GitHub Pages for the root of the published branch in repository settings. The canonical URL is https://david-pigeon.github.io/audioeditsurvey_project/ . No deployment or publishing workflow is enabled by the initial local setup.

## Audio examples

`data/speech-examples.json` maintains the five-field speech demonstrations; `data/media-examples.json` maintains Music and Audio cases with input, instruction, output, editing category, and preservation goal. `assets/examples.js` renders domain tabs and category filters and ensures only one clip plays at a time, including when changing domains. The music instrument replacement is Instance editing under our taxonomy, although its source page calls the task Style Transfer.

Official samples stream from their project pages with `preload="none"`; they are not rehosted. Their source captions, transcript/instruction provenance, and checked durations are recorded in the manifests. HTTP range / WAV header checks are saved in `data/speech-media-check.json`; the Music / Audio checks, including FFprobe metadata for MP3 inputs, are in `data/media-check.json`. Recheck these URLs when updating a case, and use the model output rather than a ground-truth comparison file.

Rebuild the two controlled acoustic examples on macOS with FFmpeg installed:

```sh
python3 scripts/build_volume_examples.py
```

The script uses a known two-clause synthetic utterance, adds a 400 ms gap, reserves peak headroom, and makes a +6 dB whole-utterance version and a −10 dB second-clause version. The gain switch occurs within the silent gap. It checks duration equality, unchanged first-clause PCM, gain ratios and clipping, and records the exact filters and checksums in `assets/audio/volume-generation.json`.

Run `node --test tests/speech.test.mjs` to validate the stored WAV files, +6 dB / −10 dB gains, unchanged first-clause samples, and clipping headroom. For browser review, check Speech’s five fields, Music / Audio’s three fields, domain/category and keyboard switching, playback of each input/output, one-at-a-time playback, and the stacked layout at 390 px. Speech defaults to Acoustic; Music and Audio initially show all their cases. Filter choices are retained when returning to a domain. Taxonomy sample links use `?sample=<operation-id>#audio-examples`, restore on reload/back/forward, and keep resource filters independent. Domain/category controls clear the operation-specific sample filter.
