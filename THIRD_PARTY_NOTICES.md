# Attribution and third-party materials

## Page source and presentation

The page is adapted directly from [`project-page/index_template.html`](https://github.com/w-m/3dgs-compression-survey/blob/main/project-page/index_template.html) in [3DGS.zip](https://github.com/w-m/3dgs-compression-survey), copyright 2024 Wieland Morgenstern and contributors. This includes the centered publication header, author and affiliation structure, dark rounded publication links, section layout, table presentation, selection controls, and BibTeX/footer structure. The upstream page is based on [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template) by Eliahu Horwitz, originally based on [Nerfies](https://nerfies.github.io/).

`vendor/3dgs/` contains **unmodified** copies of the upstream CSS and JavaScript. `vendor/sources.json` records their upstream revision, paths, and SHA-256 digests. The 3DGS repository license is reproduced in `LICENSES/3DGS-MIT.txt`; its page retains the academic template's [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) attribution. Our adapted `index.html`, `assets/site.css`, and `assets/favicon.svg` retain CC BY-SA 4.0.

Adaptations replace the survey content and data fields, add audio-specific filters and taxonomy links, and replace the original whole-body CSS scaling with equivalent desktop dimensions and responsive mobile sizing. `assets/site.css` holds these additions; vendored stylesheets are not edited. The resource table uses the same DataTables bundle as 3DGS.zip. The Python data importer is specific to AudioEditSurvey; the upstream numerical ranking and plotting pipeline is not used.

## Bundled libraries

- Bulma 0.9.1 (including minireset), Jeremy Thomas: MIT; see `LICENSES/Bulma-MIT.txt` and the preserved file header.
- jQuery 3.7.0, OpenJS Foundation and contributors: MIT; see `LICENSES/jQuery-MIT.txt`.
- DataTables 2.1.3, ColReorder 2.0.3, and FixedColumns 5.0.1, SpryMedia Ltd: MIT; see `LICENSES/DataTables-MIT.txt` and the preserved bundle headers.
- Font Awesome Free 5.15.1: code under MIT, icons under CC BY 4.0; see `LICENSES/Font-Awesome.txt` and the preserved header. No icon fonts are redistributed separately.

## Survey content

The curated resource entries, citation, and paper metadata originate from [MM-Speech/AudioEditSurvey](https://github.com/MM-Speech/AudioEditSurvey), copyright 2026 AudioEditSurvey authors and contributors. Its original repository content is MIT-licensed; see `LICENSES/AudioEditSurvey-MIT.txt`.

The three figures `assets/taxonomy_overview.png`, `assets/train-based.png`, and `assets/train-free.png` are reproduced unchanged from [Audio Editing in the Era of Foundation Models: A Survey](https://arxiv.org/abs/2606.23139), Pan et al., 2026. These figures and paper-derived material remain under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), as identified by the source repository. Neither the website license nor the MIT license relicenses them.

Linked papers, models, weights, datasets, and tools retain their original terms.

## Audio demonstrations

The official examples are streamed from [AuK](https://auk-project.github.io/#demos), [Step-Audio-EditX](https://stepaudiollm.github.io/step-audio-editx/#Speaking%20Style%20Editing), and [Audio-Omni](https://zeyuet.github.io/Audio-Omni/#Editing), with source links beside each example. The selected files and transcript/instruction provenance are documented in `data/speech-examples.json` and `data/media-examples.json`. Music cases include AuK lyric editing and Audio-Omni instrument replacement; general-audio cases use Audio-Omni event addition and removal. The displayed preservation descriptions express editing goals, not measured guarantees. No official audio files are redistributed in this repository.

Public playback and a repository's code license do not, by themselves, establish a blanket license to redistribute all demo recordings. AuK's page identifies its audio as research demonstrations; Step-Audio-EditX's repository license statement addresses code; Audio-Omni's repository identifies CC BY-NC 4.0, while its demo page does not give a separate per-recording grant. The site's MIT / CC BY-SA licenses do not relicense those recordings or third-party transcripts.

The three local `assets/audio/volume-*.wav` files are controlled examples prepared for this survey with macOS Samantha speech synthesis and FFmpeg. The source utterance was created for this demonstration; the two gain changes are deterministic signal processing, not outputs attributed to a foundation model. Source voice and generation provenance remain recorded in `assets/audio/volume-generation.json`.
