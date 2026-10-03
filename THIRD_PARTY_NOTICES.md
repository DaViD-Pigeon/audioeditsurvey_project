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

The official examples are streamed from [AuK](https://auk-project.github.io/#demos), [Step-Audio-EditX](https://stepaudiollm.github.io/step-audio-editx/#Speaking%20Style%20Editing), and [Audio-Omni](https://zeyuet.github.io/Audio-Omni/#Editing), with source links retained in the example manifests. The selected files and transcript/instruction provenance are documented in `data/speech-examples.json` and `data/media-examples.json`. Music cases include AuK lyric editing and Audio-Omni instrument replacement; general-audio cases use Audio-Omni event addition and removal. The displayed preservation descriptions express editing goals, not measured guarantees. Official model outputs are not rehosted. The locally prepared volume, reverberation, and EQ derivatives are described below.

Public playback and a repository's code license do not, by themselves, establish a blanket license to redistribute all demo recordings. AuK's page identifies its audio as research demonstrations; Step-Audio-EditX's repository license statement addresses code; Audio-Omni's repository identifies CC BY-NC 4.0, while its demo page does not give a separate per-recording grant. The site's MIT / CC BY-SA licenses do not relicense those recordings or third-party transcripts.

The three local `assets/audio/volume-*.wav` files are controlled examples prepared for this survey with macOS Samantha speech synthesis and FFmpeg. The source utterance was created for this demonstration; the two gain changes are deterministic signal processing, not outputs attributed to a foundation model. Source voice and generation provenance remain recorded in `assets/audio/volume-generation.json`.

The four local `assets/audio/music-volume-*.wav` and `assets/audio/audio-volume-*.wav` files are FFmpeg derivatives of the AuK Vocal Edit English input and Audio-Omni Adding Example 1 input already used in other categories. They apply a 1.25 whole-clip gain or a 0.50 gain from 3.000 seconds onward. The original inputs continue to stream from their authors’ pages. Source URLs, checksums, filters, and verification results are recorded in `assets/audio/media-volume-generation.json`; source-recording rights and terms continue to apply to these derivatives.

The two local `assets/audio/seed-speech-*.wav` outputs were generated for this survey using SeedAudio 1.0. They reuse the controlled synthetic train-announcement text: the faster-speaking example uses the original synthetic audio as a reference, while the different-voice example uses text-only voice design. They are not taken from an official model demonstration page. Generation prompts, API settings, and subtitle checks are recorded in `assets/audio/seed-speech-generation.json`; the API provider's applicable terms continue to govern these outputs.

The local `assets/audio/speech-reverb-input.wav` and `assets/audio/speech-eq-bright.wav` recordings are FFmpeg derivatives of the same controlled synthetic speech. `assets/audio/speech-room-impulse.wav` is a generated room impulse response used for convolution. The reverberation illustration presents the processed wet recording as input and the unchanged original dry recording as output; no dereverberation-model result is claimed. Processing parameters and checksums are preserved in `assets/audio/speech-acoustic-generation.json`.

The four local `assets/audio/music-reverb-input.wav`, `assets/audio/music-eq-bright.wav`, `assets/audio/audio-reverb-input.wav`, and `assets/audio/audio-eq-bright.wav` recordings reuse those same AuK and Audio-Omni inputs for FFmpeg reverberation and equalization illustrations. `assets/audio/media-room-impulse-44100.wav` is a generated impulse response. The reverberation pairs present an artificially reverberant input and the unmodified original recording as output; existing ambience in the original is retained, and no dereverberation-model result is claimed. Source terms continue to apply. Processing parameters, source URLs, and checksums are recorded in `assets/audio/media-acoustic-generation.json`.

`assets/audio/musan-background-noise.wav` is a 10-second excerpt of `noise/free-sound/noise-free-sound-0232.wav` from [MUSAN](https://www.openslr.org/17/) by David Snyder, Guoguo Chen, and Daniel Povey ([paper](https://arxiv.org/abs/1510.08484)). The corpus's `noise/free-sound/LICENSE` states that all selected recordings in that directory were marked as Public Domain on Free Sound; that notice is preserved in `LICENSES/MUSAN-free-sound.txt`. The selected file is explicitly listed under background noises in the corpus annotations. Its checksum and excerpt details are in `assets/audio/musan-noise-source.json`.

The local `assets/audio/speech-noisy-input.wav`, `assets/audio/music-noisy-input.wav`, and `assets/audio/audio-noisy-input.wav` recordings add this excerpt to the existing synthetic speech, AuK music input, and Audio-Omni audio input. Each paired output remains the original recording, with no denoising-model result claimed. The source recordings retain their original terms. Mixing parameters, source checksums, and validation are recorded in `assets/audio/denoising-generation.json`.
