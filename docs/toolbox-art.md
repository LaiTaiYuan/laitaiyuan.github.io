# Public toolbox illustration

- Method: built-in ImageGen, generated on 2026-09-18.
- Final asset: `public/tools/maker-street.png`, 2172 × 724, transparent PNG.
- Reference: https://taipeispeaksup.org/ — the user requested its bold comic style.
- Use: original creative-tool street scene for the public `/tools/` hero.
- The reference was used for visual direction; no website text, logos or character assets were copied.

## Animated layers (2026-09-18)

- `scripts/build-toolbox-scene.py --review` cuts `cat`, `beaver`, `bird`, `raccoon` (outline-bounded fill inside a
  hand-drawn polygon), the static `laptop` prop and the circular `reel` disc into `public/tools/scene/*.webp`
  (lossless) and writes `src/data/toolboxScene.json` with each box as a percentage of the 2172 × 724 frame.
- `--review` also drops mask overlays into `output/toolbox-scene/` for checking the cut-outs.
- Tune `CHARACTERS` polygons, `SEALS` (ink strokes that close outline gaps) and `FORCE` (thin props such as the
  bird's pointer) in the script when the illustration changes; requires Python 3 with Pillow and NumPy.

## Final generation prompt

Use case: illustration-story. Asset type: a wide illustrated hero scene for Leonard's public software tool-sharing website.
Create an ORIGINAL panoramic cartoon maker street illustration, inspired by the provided screenshot's overall visual language only: 1990s Taiwanese newspaper comic / lively hand-drawn community festival, confident slightly irregular thick black outlines, flat saturated colors and a few hand-inked textures, charming expressive animal characters. Do NOT copy its specific characters, signs, architecture or political messaging. This is a creative technology tool collection.
Composition: landscape panorama, about 3:1 aspect ratio, 1800x600 or larger. Three maker stations fill the bottom two-thirds with generous breathing room above their roofs. On the left, a friendly orange cat filmmaker in a blue jacket holds a video camera next to a small blue movie studio kiosk with a film reel and a screen showing a simple play triangle. Center, a cheerful beaver with round glasses at a yellow open-air workshop desk works on a laptop, a few cardboard toolboxes and leafy plants nearby. To the right, a mint-green bird presents a diagram of connected colorful nodes on a wheeled board, with a small raccoon holding illustrated slides. A few simple low-rise workshop buildings and green trees behind them. Friendly detailed narrative illustration; people can spot what each maker is doing.
Palette: saturated royal blue #405ADA, golden yellow #FFBE23, bright orange #FF7900, leaf green #409C42, off-white #FFF9EB, and black #111111 outlines. Flat colors, no glossy 3D, no soft pastel aesthetic, no photorealism.
Background: genuine TRANSPARENT background above the buildings and around the scene, with one continuous simple blue-gray pavement strip along the bottom. This PNG will sit on a royal-blue web background. No UI mockup, no page borders, NO letters or text, NO logos, NO watermark. Keep all characters and buildings fully inside the frame; illustrate the scene itself, not a screenshot of a website.
