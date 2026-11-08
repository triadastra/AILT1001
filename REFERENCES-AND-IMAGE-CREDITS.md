# References and image credits — Synthesising Hollywood, 52-PG02

Updated 7 November 2026. Reference numbers are preserved to match the poster. Image credits identify the source of the visual; paragraph citations identify support for a claim. They are not interchangeable.

## Images used in the current poster

| Location | Visual and creator/source | Citation | Treatment |
|---|---|---|---|
| Workflow 1 | ComfyUI official Wan 2.2 positive-prompt node screenshot | [3] | Cropped from official workflow screenshot |
| Workflow 2; image-model example | Comfy-Org armoured-character input image for Wan 2.2 14B I2V | [3] | Published model input, not a photograph or output from the illustrated U-Net |
| Workflow 3 | ComfyUI KSampler and Save Video screenshot | [3] | Two crops from official workflow screenshot |
| Video-model example | Three frames from Comfy-Org Wan 2.2 14B I2V demo, at 0.5, 2.0 and 3.5 seconds | [3] | Extracted stills; arrows indicate playback order |
| Workflow 4 | Blackmagic Design DaVinci Resolve editing-interface image | [13] | Official promotional interface image |
| Workflow 5 | Native Foreign / Toys“R”Us AI-assisted brand-film train image | [17] | Published production-case image |
| Workflow 6 | Waymark / Latent Cinema, The Frost film-player webpage | [11] | Cropped webpage screenshot |

Direct assets for [3]: [input image](https://github.com/Comfy-Org/workflow_templates/blob/main/input/video_wan2_2_14B_i2v_input_image.jpg); [example clip](https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/output/video_wan2_2_14B_i2v.mp4).

These visuals show separate published examples, not one film produced by the group. AI-generated film imagery is not documentary photography.

## Website citations page

The front page (`dist/index.html`) reuses only the poster images credited above. They were cropped from the poster preview into `dist/assets/cite/`: `comfy-prompt`, `armoured` and `ksampler` [3]; `frost` [11]; `davinci` [13]; `toysrus` [17]. Card [9] plays the Comfy-Org Wan 2.2 example clip [3]. Card [1] shows a strip of these same images. All other card animations are original CSS/SVG concept drawings. They are not figures from the sources. No strike, festival or deepfake imagery is reproduced. The summary lines are plain-English readings of each source and should be checked against the original.

## Original diagrams and decorative artwork

The four model diagrams are original explanatory SVG drawings prepared with AI assistance, based on: Text [7,8]; image [2]; video [9]; audio [4]. They are not reproduced figures or measured model activations. The film strip, clapperboard and paper texture are decorative HTML/SVG artwork.

The ten pros/cons icons were generated using OpenAI's image-generation tool for this poster. They illustrate concepts and are not source evidence, photographs or figures from the cited papers. Prompts and generation provenance are recorded in assets/icon-generation.json; the replacement redos icon is documented in IMAGE-SOURCES.md. No model version is asserted where the generation record does not name one.

## Numbered reference list

### [1] Generative AI for film creation: A survey of recent advances.

Zhang, R., Yu, B., Min, J., Xin, Y., Wei, Z., Shi, J. N., Huang, M., Kong, X., Xin, N. L., Jiang, S., Bahuguna, P., Chan, M., Hora, K., Yang, L., Liang, Y., Bian, R., Liu, Y., Valencia, I. C., Tredinick, P. M., … Rao, A. (2025). *Generative AI for film creation: A survey of recent advances.* arXiv. https://doi.org/10.48550/arXiv.2504.08296

[Open source](https://arxiv.org/abs/2504.08296)

Used for: Overview of AI film production, visual styles and practical limitations.

### [2] High-resolution image synthesis with latent diffusion models.

Rombach, R., Blattmann, A., Lorenz, D., Esser, P., & Ommer, B. (2022). *High-resolution image synthesis with latent diffusion models.* Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition, 10684–10695.

[Open source](https://openaccess.thecvf.com/content/CVPR2022/html/Rombach_High-Resolution_Image_Synthesis_With_Latent_Diffusion_Models_CVPR_2022_paper.html)

Used for: Image-model diagram: latent diffusion, conditioning and decoding.

### [3] Wan2.2 video generation: ComfyUI official native workflow example.

ComfyUI. (n.d.). *Wan2.2 video generation: ComfyUI official native workflow example.* ComfyUI documentation. Retrieved November 7, 2026.

[Open source](https://docs.comfy.org/tutorials/video/wan/wan2_2)

Used for: Official workflow, node screenshots and separate image-to-video reference input.

### [4] Simple and controllable music generation.

Copet, J., Kreuk, F., Gat, I., Remez, T., Kant, D., Synnaeve, G., Adi, Y., & Défossez, A. (2023). *Simple and controllable music generation.* Advances in Neural Information Processing Systems, 36. Paper and audio demonstrations.

[Open source](https://ai.honu.io/papers/musicgen/)

Used for: MusicGen audio-token architecture and text- or melody-conditioned music examples.

### [5] Generative AI enhances individual creativity but reduces the collective diversity of novel content.

Doshi, A. R., & Hauser, O. P. (2024). *Generative AI enhances individual creativity but reduces the collective diversity of novel content.* Science Advances, 10(28), eadn5290. https://doi.org/10.1126/sciadv.adn5290

[Open source](https://doi.org/10.1126/sciadv.adn5290)

Used for: Evidence about short-story ratings and similarity. The poster does not treat this as a measured result for films.

### [6] “AI is soulless”: Hollywood film workers’ strike and emerging perceptions of generative cinema.

Halperin, B. A., & Rosner, D. K. (2025). *“AI is soulless”: Hollywood film workers’ strike and emerging perceptions of generative cinema.* ACM Transactions on Computer-Human Interaction, 32(2), 1–27. https://doi.org/10.1145/3716135

[Open source](https://doi.org/10.1145/3716135)

Used for: Film workers’ perspectives on AI, creative labour and control.

### [7] Attention is all you need.

Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł., & Polosukhin, I. (2017). *Attention is all you need.* Advances in Neural Information Processing Systems, 30.

[Open source](https://arxiv.org/abs/1706.03762)

Used for: Transformer components: multi-head attention, residual paths and feed-forward layers.

### [8] Causal language modeling.

Hugging Face. (n.d.). *Causal language modeling.* Transformers documentation. Retrieved November 7, 2026.

[Open source](https://huggingface.co/docs/transformers/main/en/tasks/language_modeling)

Used for: Autoregressive language modelling and next-token prediction.

### [9] Wan: Open and advanced large-scale video generative models.

Team Wan. (2025). *Wan: Open and advanced large-scale video generative models.* arXiv. https://doi.org/10.48550/arXiv.2503.20314

[Open source](https://arxiv.org/abs/2503.20314)

Used for: Video diffusion Transformer, spatiotemporal modelling and video VAE. See the source for the full contributor list.

### [10] YouTube channel monetization policies.

Google. (n.d.). *YouTube channel monetization policies.* YouTube Help. Retrieved November 7, 2026.

[Open source](https://support.google.com/youtube/answer/1311392)

Used for: Platform revenue eligibility and restrictions on repetitive or mass-produced content.

### [11] The Frost.

Waymark & Latent Cinema. (n.d.). *The Frost.* Official film website. Retrieved November 7, 2026.

[Open source](https://www.thefrost.ai/)

Used for: Published AI-film example, synopsis, credits and online player.

### [12] AI Film Festival 2024.

Runway. (2024). *AI Film Festival 2024.* Festival programme: A Tree Once Grew Here, by John and Dara Semerad.

[Open source](https://aif.runwayml.com/2024)

Used for: Published film example for discussion of visual styles.

### [13] DaVinci Resolve: Edit.

Blackmagic Design. (n.d.). *DaVinci Resolve: Edit.* Official product documentation. Retrieved November 7, 2026.

[Open source](https://www.blackmagicdesign.com/products/davinciresolve/edit)

Used for: Real editing-interface image used in the sound and editing stage.

### [14] MusicGen model card.

Meta FAIR. (n.d.). *MusicGen model card.* AudioCraft documentation. Retrieved November 7, 2026.

[Open source](https://facebookresearch.github.io/audiocraft/model_cards/MUSICGEN_MODEL_CARD.html)

Used for: Model description and the CC BY-NC 4.0 licence for model weights.

### [15] L.A. takes to the picket lines.

SAG-AFTRA. (2023). *L.A. takes to the picket lines.* SAG-AFTRA.

[Open source](https://www.sagaftra.org/la-takes-picket-lines)

Used for: Primary industry source for the 2023 actors’ strike.

### [16] Disclosing use of altered or synthetic content.

Google. (n.d.). *Disclosing use of altered or synthetic content.* YouTube Help. Retrieved November 7, 2026.

[Open source](https://support.google.com/youtube/answer/14328491)

Used for: Disclosure requirements for realistic altered or synthetic content.

### [17] Toys“R”Us AI film.

Native Foreign. (2024). *Toys“R”Us AI film.* Official production case study.

[Open source](https://nativeforeign.co/work/toys-r-us-ai-film)

Used for: Real AI-assisted brand-film example for the commercial-production stage; no earnings are claimed.

### [18] Summary of the 2023 WGA MBA.

Writers Guild of America. (2023). *Summary of the 2023 WGA MBA.* 2023 contract campaign.

[Open source](https://www.wgacontract2023.org/the-campaign/summary-of-the-2023-wga-mba)

Used for: Primary industry source for the agreement’s AI provisions.

### [19] Image-based abuse.

eSafety Commissioner. (n.d.). *Image-based abuse.* Australian Government. Retrieved November 7, 2026.

[Open source](https://www.esafety.gov.au/key-topics/image-based-abuse)

Used for: Non-consensual intimate images, including AI deepfakes, and harm to the people depicted.

### [20] Copyright and artificial intelligence, Part 1: Digital replicas.

U.S. Copyright Office. (2024). *Copyright and artificial intelligence, Part 1: Digital replicas.* U.S. Copyright Office.

[Open source](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-1-Digital-Replicas-Report.pdf)

Used for: Risks involving unauthorised likenesses; distinct from low variety and not a claim that all similar outputs infringe rights.

### [21] Deepfakes and disinformation: Exploring the impact of synthetic political video on deception, uncertainty, and trust in news.

Vaccari, C., & Chadwick, A. (2020). *Deepfakes and disinformation: Exploring the impact of synthetic political video on deception, uncertainty, and trust in news.* Social Media + Society, 6(1). https://doi.org/10.1177/2056305120903408

[Open source](https://doi.org/10.1177/2056305120903408)

Used for: Experimental evidence about uncertainty and reduced trust in news after exposure to political deepfakes; not evidence that all AI films deceive viewers.

### [22] SAG-AFTRA statement on Seedance 2.0.

SAG-AFTRA. (2026, February 13). *SAG-AFTRA statement on Seedance 2.0.* SAG-AFTRA.

[Open source](https://www.sagaftra.org/sag-aftra-statement-seedance-20)

Used for: 2026 criticism of unauthorised voices and likenesses; separate from the 2023 strikes.

### [23] FinCEN alert on fraud schemes involving deepfake media targeting financial institutions.

Financial Crimes Enforcement Network. (2024, November 13). *FinCEN alert on fraud schemes involving deepfake media targeting financial institutions.* FIN-2024-Alert004. U.S. Department of the Treasury.

[Open source](https://www.fincen.gov/system/files/shared/FinCEN-Alert-DeepFakes-Alert508FINAL.pdf)

Used for: Deepfake voices or videos used to impersonate family members and friends in family-emergency scams.

### [24] Final Cut Pro.

Apple. (n.d.). *Final Cut Pro.* Apple. Retrieved November 7, 2026.

[Open source](https://www.apple.com/final-cut-pro/)

Used for: Official video-editing product information.

### [25] Logic Pro.

Apple. (n.d.). *Logic Pro.* Apple. Retrieved November 7, 2026.

[Open source](https://www.apple.com/logic-pro/)

Used for: Official audio production and editing product information.

### [26] New ways to customize and interact with your content in NotebookLM.

Google Workspace. (2026, March). *New ways to customize and interact with your content in NotebookLM.* Google Workspace Updates.

[Open source](https://workspaceupdates.googleblog.com/2026/03/new-ways-to-customize-and-interact-with-your-content-in-NotebookLM.html)

Used for: AI-generated video overviews and slide decks for teaching and demonstrations.

## Earlier-version material

References [12] and [15] were used for earlier examples; their associated artwork/strike photograph is not in the current poster. They are retained to keep established numbering stable. No current image should be credited to those entries.

Reference [16] is retained as background on synthetic-media disclosure; it is not cited in the current poster text. All 23 reference numbers printed on the poster have matching entries in this list.
