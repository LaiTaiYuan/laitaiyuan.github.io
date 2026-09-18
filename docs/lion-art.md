# Homepage lion studio scene

- Source: `public/images/leonard-lion-studio.png`, 1536 × 1024, transparent PNG (see `content-sources.md`).
  It stays untouched as the source of truth; the page never loads it directly.
- `scripts/build-lion-scene.py --review` derives everything the homepage uses:
  - `public/images/lion/base.png` plus `base-{768,1536}.{webp,avif}`: the scene with the tail and both
    pupils punched out (transparent pixels painted `--tb-blue` so lossy alpha ringing stays invisible).
  - `public/images/lion/{head,bulb,plant-left,plant-right,tail,pupil-left,pupil-right}.webp`: cut-outs
    laid back over the base at the same spot. `head`, `plant-*` sit on the untouched base and only move a
    few pixels (bob, sway); `tail` and `bulb` are erased from the base so they can wag/pulse freely;
    the pupils sit on painted eye white so they can follow the pointer.
  - `src/data/lionScene.json`: each layer's box and pivot (`ox`/`oy` for `transform-origin`) as
    percentages of the scene.
  - `--review` writes mask/cut previews and the punched base to `output/lion-scene/`.
- Polygons (`CHARACTERS`), gap seals (`SEALS`), colour strips (`STRIP`) and pivots (`PIVOTS`) live at the top of
  the script; the outline-bounded fill itself is shared with the toolbox street in `scripts/scene_cutout.py`.
- The photo and street illustration get their responsive WebP/AVIF variants from `scripts/build-images.py`.
- Light effects (lamp cone, monitor glow, bulb glow, sparkles, floating notes) are CSS overlays positioned in
  scene percentages from `Home.tsx`; nothing else is drawn on top of the artwork.
