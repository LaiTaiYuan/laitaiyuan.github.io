import {
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PlaneGeometry,
  Shape,
  SphereGeometry,
  Sprite,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import type {
  BufferGeometry,
  Material,
  Object3D,
  SpriteMaterial,
  Texture,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// The models of 「LAI 群島」: landmarks for each of Leonard's stories and the
// animals that live on the islands (he asked for animals, not people). Built
// from rounded primitives in the site's toon style; islandWorld.ts places
// them, lights them and merges whatever does not move. Each model faces +z
// and stands on y = 0. Parts that animate are marked `live` so they stay
// separate when the rest is merged.

export type Tokens = {
  ink: Color;
  paper: Color;
  white: Color;
  green: Color;
  coral: Color;
  blue: Color;
  sky: Color;
  yellow: Color;
  yellowLight: Color;
  muted: Color;
  amber: Color;
};

const mix = (a: Color, b: Color, t: number) => a.clone().lerp(b, t);

// Every colour is a token or a blend of tokens.
export function tones(c: Tokens) {
  return {
    ...c,
    fur: mix(c.yellow, c.coral, 0.14),
    mane: mix(c.coral, c.ink, 0.26),
    maneDark: mix(c.coral, c.ink, 0.44),
    cream: mix(c.paper, c.yellow, 0.22),
    nose: mix(c.coral, c.ink, 0.6),
    blush: mix(c.coral, c.paper, 0.35),
    wood: mix(c.coral, c.yellow, 0.52),
    woodDark: mix(c.coral, c.ink, 0.42),
    metal: mix(c.white, c.muted, 0.32),
    steel: mix(c.muted, c.white, 0.15),
    leafDeep: mix(c.green, c.ink, 0.3),
    leaf: c.green.clone(),
    leafLight: mix(c.green, c.yellow, 0.3),
    rock: mix(c.paper, c.muted, 0.42),
    sand: mix(c.yellowLight, c.yellow, 0.24),
    earth: mix(c.coral, c.ink, 0.46),
    path: mix(c.yellowLight, c.paper, 0.4),
    bear: mix(c.ink, c.muted, 0.3),
    snout: mix(c.coral, c.paper, 0.48),
    dolphin: mix(c.coral, c.white, 0.6),
    dolphinBelly: mix(c.coral, c.white, 0.82),
    cat: mix(c.yellow, c.coral, 0.42),
    catSpot: mix(c.coral, c.ink, 0.62),
    gull: mix(c.white, c.muted, 0.28),
    shell: mix(c.green, c.ink, 0.22),
    skin: mix(c.green, c.paper, 0.5),
    glass: mix(c.sky, c.white, 0.35),
    magpieBelly: mix(c.blue, c.white, 0.55),
  };
}
export type Tones = ReturnType<typeof tones>;

export type Kit = {
  c: Tones;
  hex: Record<keyof Tokens, string>;
  // A toon material, shared by colour; `glow` adds a little self-light.
  paint(color: Color, glow?: number): MeshToonMaterial;
  textured(map: Texture, color?: Color): MeshToonMaterial;
  // A solid with an ink outline `line` pixels wide (null: no outline).
  solid(
    geometry: BufferGeometry,
    material: Material | Material[],
    line?: number | null,
  ): Mesh;
  // Unlit colour that fades from `day` to `night` (windows, screens).
  lamp(day: Color, night: Color): MeshBasicMaterial;
  halo(color: Color, size: number, day?: number, night?: number): Sprite;
  icon(name: "bubble" | "code" | "note" | "spark", size: number): Sprite;
  // A soft white puff, for smoke and steam.
  puff(size: number): Sprite;
  // A word painted on a sign; redrawn once the web font has loaded.
  words(
    text: string,
    width: number,
    height: number,
    ink: string,
    paper: string,
  ): Texture;
  scutes: Texture;
  screen: Texture;
  staff: Texture;
};

export type Model = {
  group: Group;
  // Height of the top of the model, for the pin above it.
  height: number;
  tick?(t: number, view: Vector3): void;
};

// --- Geometry helpers -------------------------------------------------------

export const put = <T extends Object3D>(
  parent: Object3D,
  object: T,
  x: number,
  y: number,
  z: number,
) => {
  object.position.set(x, y, z);
  parent.add(object);
  return object;
};
// Animated parts keep their own meshes when the model is merged.
export const live = <T extends Object3D>(object: T) => {
  object.userData.live = true;
  return object;
};
export const rounded = (w: number, h: number, d: number, r = 0.04) =>
  new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2));
export const ball = (r: number, w = 18, h = 14) => new SphereGeometry(r, w, h);
export const pill = (r: number, length: number) =>
  new CapsuleGeometry(r, length, 6, 14);
export const disc = (r: number, h: number, segments = 28) =>
  new CylinderGeometry(r, r, h, segments);
export const lathe = (
  profile: readonly (readonly [number, number])[],
  segments = 28,
) =>
  new LatheGeometry(
    profile.map(([x, y]) => new Vector2(x, y)),
    segments,
  );
const tube = (
  points: readonly (readonly [number, number, number])[],
  radius: number,
) =>
  new TubeGeometry(
    new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z))),
    20,
    radius,
    7,
  );
// A flat shape lying in the xz-plane, `depth` thick, from (x, z) points.
const slab = (
  points: readonly (readonly [number, number])[],
  depth: number,
) => {
  const shape = new Shape(points.map(([x, z]) => new Vector2(x, -z)));
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.3,
    bevelSize: depth * 0.3,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -depth / 2, 0);
  return geometry;
};
// A shape standing in the xy-plane, facing +z.
const plate = (shape: Shape, depth: number, bevel = depth * 0.35) => {
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
};
// The brand's four-pointed star (curves bow in towards the centre).
export const starShape = (radius: number) => {
  const shape = new Shape();
  shape.moveTo(0, radius);
  shape.quadraticCurveTo(0, 0, radius, 0);
  shape.quadraticCurveTo(0, 0, 0, -radius);
  shape.quadraticCurveTo(0, 0, -radius, 0);
  shape.quadraticCurveTo(0, 0, 0, radius);
  return shape;
};
const heartShape = (size: number) => {
  const s = size;
  const shape = new Shape();
  shape.moveTo(0, -s * 0.9);
  shape.bezierCurveTo(-s * 1.2, -s * 0.1, -s * 0.7, s * 0.9, 0, s * 0.35);
  shape.bezierCurveTo(s * 0.7, s * 0.9, s * 1.2, -s * 0.1, 0, -s * 0.9);
  return shape;
};
const bubbleShape = (w: number, h: number) => {
  const r = h * 0.42;
  const shape = new Shape();
  shape.moveTo(-w / 2 + r, h / 2);
  shape.lineTo(w / 2 - r, h / 2);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2, h / 2 - r);
  shape.lineTo(w / 2, -h / 2 + r);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2 - r, -h / 2);
  shape.lineTo(-w * 0.1, -h / 2);
  shape.lineTo(-w * 0.32, -h * 0.95);
  shape.lineTo(-w * 0.26, -h / 2);
  shape.lineTo(-w / 2 + r, -h / 2);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2, -h / 2 + r);
  shape.lineTo(-w / 2, h / 2 - r);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2 + r, h / 2);
  return shape;
};

const blink = (t: number, seed: number) => ((t + seed) % 3.9 < 0.13 ? 0.12 : 1);
const spring = (x: number) =>
  x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.cos(x * Math.PI * 2.5) * Math.exp(-x * 6);

// --- Lions ------------------------------------------------------------------

type LionHead = { group: Group; eyes: Group[] };

// A cartoon lion's head after the homepage lion: golden face, spiky mane,
// big eyes; Leonard's own wears round glasses and blue headphones.
function lionHead(kit: Kit, options: { glasses?: boolean; phones?: boolean }) {
  const { c } = kit;
  const group = new Group();
  const back = put(
    group,
    kit.solid(ball(0.29), kit.paint(c.mane), 1.3),
    0,
    0.01,
    -0.08,
  );
  back.scale.set(1, 1, 0.62);
  const spike = new ConeGeometry(0.09, 0.22, 10);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + 0.13;
    const cone = put(
      group,
      kit.solid(spike, kit.paint(k % 2 ? c.mane : c.maneDark), 1.2),
      Math.cos(a) * 0.29,
      Math.sin(a) * 0.29 + 0.01,
      -0.07,
    );
    cone.rotation.z = a - Math.PI / 2;
    cone.rotation.x = -0.18;
  }
  const fur = kit.paint(c.fur);
  put(group, kit.solid(ball(0.245), fur, 1.4), 0, 0, 0.03);
  for (const side of [-1, 1]) {
    put(group, kit.solid(ball(0.105), fur, null), side * 0.12, -0.08, 0.12);
    put(group, kit.solid(ball(0.07), fur, 1.2), side * 0.17, 0.18, -0.02);
    put(
      group,
      kit.solid(ball(0.04), kit.paint(c.blush), null),
      side * 0.17,
      0.18,
      0.02,
    );
    const brow = put(
      group,
      kit.solid(rounded(0.08, 0.022, 0.03, 0.01), kit.paint(c.maneDark), null),
      side * 0.09,
      0.155,
      0.245,
    );
    brow.rotation.z = side * -0.18;
  }
  const muzzle = put(
    group,
    kit.solid(ball(0.11), kit.paint(c.cream), 1.1),
    0,
    -0.075,
    0.19,
  );
  muzzle.scale.set(1.28, 0.82, 0.74);
  const nose = put(
    group,
    kit.solid(ball(0.045), kit.paint(c.nose), null),
    0,
    -0.025,
    0.282,
  );
  nose.scale.set(1.35, 0.82, 0.8);
  const mouth = new CylinderGeometry(
    0.056,
    0.056,
    0.02,
    16,
    1,
    false,
    0,
    Math.PI,
  );
  mouth.rotateX(Math.PI / 2);
  mouth.rotateZ(Math.PI);
  put(group, kit.solid(mouth, kit.paint(c.nose), null), 0, -0.098, 0.276);
  put(group, kit.solid(ball(0.026), kit.paint(c.coral), null), 0, -0.13, 0.282);
  const pair = live(put(group, new Group(), 0, 0.055, 0.236));
  pair.scale.z = 0.75;
  for (const side of [-1, 1]) {
    put(
      pair,
      kit.solid(ball(0.05), kit.paint(c.white), 1.1),
      side * 0.088,
      0,
      0,
    );
    put(
      pair,
      kit.solid(ball(0.03), kit.paint(c.ink), null),
      side * 0.088,
      -0.003,
      0.034,
    );
    put(
      pair,
      kit.solid(ball(0.011, 8, 6), kit.paint(c.white, 0.6), null),
      side * 0.088 - 0.012,
      0.014,
      0.058,
    );
  }
  const eyes = [pair];
  if (options.glasses) {
    const rim = new TorusGeometry(0.072, 0.012, 8, 28);
    for (const side of [-1, 1])
      put(
        group,
        kit.solid(rim, kit.paint(c.ink), null),
        side * 0.088,
        0.055,
        0.29,
      );
    const bridge = new CylinderGeometry(0.009, 0.009, 0.035, 6);
    bridge.rotateZ(Math.PI / 2);
    put(group, kit.solid(bridge, kit.paint(c.ink), null), 0, 0.06, 0.294);
  }
  if (options.phones) {
    const band = new TorusGeometry(0.3, 0.032, 10, 30, Math.PI);
    put(group, kit.solid(band, kit.paint(c.blue), 1.2), 0, 0.03, -0.03);
    const cup = disc(0.088, 0.075, 20);
    cup.rotateZ(Math.PI / 2);
    const cap = disc(0.06, 0.08, 18);
    cap.rotateZ(Math.PI / 2);
    for (const side of [-1, 1]) {
      put(
        group,
        kit.solid(cup, kit.paint(c.blue), 1.2),
        side * 0.29,
        0.02,
        -0.02,
      );
      put(
        group,
        kit.solid(cap, kit.paint(c.yellow), null),
        side * 0.302,
        0.02,
        -0.02,
      );
    }
  }
  return { group, eyes } satisfies LionHead;
}

// Leonard's lion at his desk: typing, nodding along to his headphones,
// looking up at whoever is watching, and now and then struck by an idea.
export function lionDesk(kit: Kit): Model {
  const { c } = kit;
  const group = new Group();
  const wood = kit.paint(c.wood);
  const dark = kit.paint(c.woodDark);
  put(group, kit.solid(rounded(1.12, 0.07, 0.56, 0.03), wood), 0, 0.56, 0.28);
  for (const [x, z] of [
    [-0.49, 0.06],
    [0.49, 0.06],
    [-0.49, 0.5],
    [0.49, 0.5],
  ] as const)
    put(
      group,
      kit.solid(rounded(0.06, 0.53, 0.06, 0.02), dark, 1),
      x,
      0.265,
      z,
    );
  // Laptop: keyboard towards the lion, lid towards the viewer with the star.
  put(
    group,
    kit.solid(rounded(0.46, 0.03, 0.3, 0.012), kit.paint(c.metal), 1),
    0,
    0.61,
    0.3,
  );
  const lid = put(group, new Group(), 0, 0.62, 0.45);
  lid.rotation.x = 0.26;
  put(
    lid,
    kit.solid(rounded(0.46, 0.31, 0.022, 0.012), kit.paint(c.metal), 1),
    0,
    0.155,
    0,
  );
  const screen = new Mesh(
    new PlaneGeometry(0.4, 0.25),
    kit.lamp(c.white, c.white),
  );
  (screen.material as MeshBasicMaterial).map = kit.screen;
  screen.rotation.y = Math.PI;
  put(lid, screen, 0, 0.155, -0.013);
  const badge = plate(starShape(0.05), 0.01, 0.003);
  put(lid, kit.solid(badge, kit.paint(c.amber, 0.3), null), 0, 0.17, 0.016);
  put(group, kit.halo(c.sky, 0.9, 0, 0.55), 0, 0.82, 0.3);
  // Mug, plant and lamp.
  const mug = lathe([
    [0, 0],
    [0.05, 0],
    [0.055, 0.1],
    [0.045, 0.1],
    [0.04, 0.02],
    [0, 0.02],
  ]);
  put(group, kit.solid(mug, kit.paint(c.coral), 1), 0.4, 0.595, 0.32);
  put(
    group,
    kit.solid(new TorusGeometry(0.03, 0.01, 6, 12), kit.paint(c.coral), null),
    0.455,
    0.645,
    0.32,
  );
  put(
    group,
    kit.solid(
      lathe([
        [0, 0],
        [0.06, 0],
        [0.07, 0.09],
        [0, 0.09],
      ]),
      kit.paint(c.woodDark),
      1,
    ),
    -0.44,
    0.595,
    0.38,
  );
  for (const [x, y, z, r] of [
    [-0.44, 0.73, 0.38, 0.07],
    [-0.48, 0.79, 0.36, 0.05],
    [-0.4, 0.8, 0.4, 0.045],
  ] as const)
    put(group, kit.solid(ball(r, 12, 10), kit.paint(c.leaf), 1), x, y, z);
  put(
    group,
    kit.solid(disc(0.07, 0.025), kit.paint(c.ink), null),
    0.44,
    0.605,
    0.1,
  );
  const arm = put(
    group,
    kit.solid(disc(0.012, 0.36, 8), kit.paint(c.ink), null),
    0.44,
    0.78,
    0.1,
  );
  arm.rotation.z = 0.22;
  put(
    group,
    kit.solid(
      new ConeGeometry(0.11, 0.12, 18, 1, true),
      kit.paint(c.yellow),
      1,
    ),
    0.38,
    0.97,
    0.14,
  );
  put(
    group,
    kit.solid(ball(0.035, 10, 8), kit.lamp(c.yellowLight, c.yellow), null),
    0.38,
    0.92,
    0.14,
  );
  put(group, kit.halo(c.yellow, 1.3, 0.05, 0.95), 0.38, 0.86, 0.16);
  // Stool.
  put(group, kit.solid(rounded(0.38, 0.06, 0.32, 0.025), wood), 0, 0.34, -0.14);
  for (const x of [-0.14, 0.14])
    for (const z of [-0.26, -0.02])
      put(group, kit.solid(disc(0.022, 0.31, 8), dark, null), x, 0.155, z);

  // The lion.
  const body = put(group, new Group(), 0, 0.37, -0.14);
  const fur = kit.paint(c.fur);
  const torso = put(body, kit.solid(pill(0.19, 0.14), fur, 1.4), 0, 0.27, 0);
  torso.rotation.x = 0.12;
  const belly = put(
    body,
    kit.solid(ball(0.14), kit.paint(c.cream), null),
    0,
    0.23,
    0.11,
  );
  belly.scale.set(1, 1.1, 0.55);
  const thigh = pill(0.07, 0.12);
  thigh.rotateX(Math.PI / 2);
  for (const side of [-1, 1])
    put(body, kit.solid(thigh, fur, 1.2), side * 0.1, 0.07, 0.12);
  const arms = [-1, 1].map((side) => {
    const pivot = live(put(body, new Group(), side * 0.18, 0.38, 0.04));
    const limb = pill(0.058, 0.18);
    limb.translate(0, -0.12, 0);
    put(pivot, kit.solid(limb, fur, 1.2), 0, 0, 0);
    put(
      pivot,
      kit.solid(ball(0.065, 12, 10), kit.paint(c.cream), 1.1),
      0,
      -0.25,
      0,
    );
    pivot.rotation.x = -1.2;
    pivot.rotation.z = side * 0.32;
    return pivot;
  });
  const tail = live(put(body, new Group(), 0, 0.08, -0.17));
  put(
    tail,
    kit.solid(
      tube(
        [
          [0, 0, 0],
          [0.04, -0.03, -0.14],
          [0.1, 0.1, -0.26],
          [0.08, 0.28, -0.3],
        ],
        0.022,
      ),
      fur,
      1,
    ),
    0,
    0,
    0,
  );
  put(
    tail,
    kit.solid(ball(0.06, 12, 10), kit.paint(c.mane), 1.1),
    0.08,
    0.3,
    -0.3,
  );
  const head = lionHead(kit, { glasses: true, phones: true });
  live(put(body, head.group, 0, 0.68, 0.03));
  // The idea bulb.
  const idea = live(put(group, new Group(), 0.34, 1.46, -0.1));
  put(
    idea,
    kit.solid(ball(0.085, 16, 12), kit.lamp(c.yellowLight, c.yellow), 1.2),
    0,
    0,
    0,
  );
  put(idea, kit.solid(disc(0.04, 0.06, 12), kit.paint(c.metal), 1), 0, -0.1, 0);
  const ideaGlow = put(idea, kit.halo(c.yellow, 1.1, 0.7, 1), 0, 0, 0);
  const notes = [0, 1].map(() =>
    live(put(group, kit.icon("note", 0.22), 0, 0, 0)),
  );
  const here = new Vector3();

  return {
    group,
    height: 1.55,
    tick(t, view) {
      const cycle = t % 11;
      const typing = cycle < 4.2 || cycle > 8.6;
      arms.forEach((pivot, k) => {
        pivot.rotation.x = typing
          ? -1.2 + Math.sin(t * 15 + k * Math.PI) * 0.12
          : -1.05 + Math.sin(t * 2 + k) * 0.03;
      });
      // Looks up at the viewer between bursts of typing.
      group.getWorldPosition(here);
      const toward = Math.max(
        -0.7,
        Math.min(0.7, Math.atan2(view.x - here.x, view.z - here.z)),
      );
      const look =
        cycle > 4.4 && cycle < 8.4
          ? Math.min(1, (cycle - 4.4) * 2, (8.4 - cycle) * 2)
          : 0;
      head.group.rotation.y = toward * look;
      head.group.rotation.x = typing
        ? 0.22 + Math.sin(t * 7.6) * 0.035
        : -0.08 + Math.sin(t * 3.8) * 0.06;
      head.group.rotation.z = Math.sin(t * 1.9) * 0.05;
      for (const [k, eye] of head.eyes.entries())
        eye.scale.y = blink(t, k * 0.05);
      body.scale.y = 1 + Math.sin(t * 2.4) * 0.012;
      tail.rotation.y = Math.sin(t * 2.2) * 0.45;
      tail.rotation.z = Math.sin(t * 1.4) * 0.15;
      const spark =
        cycle > 6 && cycle < 9
          ? spring((cycle - 6) / 0.8) * Math.min(1, (9 - cycle) * 3)
          : 0;
      idea.scale.setScalar(Math.max(0.001, spark));
      idea.position.y = 1.46 + Math.sin(t * 3) * 0.03;
      (ideaGlow.material as SpriteMaterial).rotation = t;
      notes.forEach((note, k) => {
        const life = (t * 0.42 + k * 0.5) % 1;
        const side = k ? 1 : -1;
        note.position.set(
          side * (0.36 + life * 0.25),
          1.05 + life * 0.6,
          -0.15,
        );
        (note.material as SpriteMaterial).opacity =
          Math.sin(life * Math.PI) * (typing ? 1 : 0.4);
      });
    },
  };
}

export type Cub = Model & {
  // Pose for walking (step phase) or waving hello.
  walk(t: number, moving: boolean): void;
};

// A lion cub on four legs, for carrying stories and for greeting visitors.
export function lionCub(kit: Kit, carry?: "code"): Cub {
  const { c } = kit;
  const group = new Group();
  const body = live(put(group, new Group(), 0, 0, 0));
  const fur = kit.paint(c.fur);
  const torso = pill(0.115, 0.17);
  torso.rotateX(Math.PI / 2);
  put(body, kit.solid(torso, fur, 1.3), 0, 0.21, -0.02);
  const belly = put(
    body,
    kit.solid(ball(0.09), kit.paint(c.cream), null),
    0,
    0.17,
    0.04,
  );
  belly.scale.set(0.95, 0.7, 1.2);
  const head = lionHead(kit, {});
  head.group.scale.setScalar(0.6);
  live(put(body, head.group, 0, 0.38, 0.17));
  const legs = [
    [-0.07, 0.09],
    [0.07, 0.09],
    [-0.07, -0.11],
    [0.07, -0.11],
  ].map(([x, z]) => {
    const pivot = live(put(body, new Group(), x, 0.16, z));
    const limb = pill(0.04, 0.08);
    limb.translate(0, -0.07, 0);
    put(pivot, kit.solid(limb, fur, 1.1), 0, 0, 0);
    put(
      pivot,
      kit.solid(ball(0.045, 10, 8), kit.paint(c.cream), null),
      0,
      -0.13,
      0.01,
    );
    return pivot;
  });
  const tail = live(put(body, new Group(), 0, 0.24, -0.15));
  put(
    tail,
    kit.solid(
      tube(
        [
          [0, 0, 0],
          [0, 0.05, -0.1],
          [0.03, 0.17, -0.16],
        ],
        0.018,
      ),
      fur,
      1,
    ),
    0,
    0,
    0,
  );
  put(
    tail,
    kit.solid(ball(0.045, 10, 8), kit.paint(c.mane), 1),
    0.03,
    0.18,
    -0.16,
  );
  let sign: Sprite | null = null;
  if (carry) {
    put(
      body,
      kit.solid(rounded(0.17, 0.11, 0.14, 0.03), kit.paint(c.coral), 1.1),
      0,
      0.35,
      -0.06,
    );
    put(
      body,
      kit.solid(disc(0.012, 0.28, 6), kit.paint(c.woodDark), null),
      0.06,
      0.5,
      -0.1,
    );
    sign = live(put(body, kit.icon(carry, 0.32), 0.06, 0.7, -0.1));
  }
  const seed = Math.random() * 10;
  return {
    group,
    height: 0.75,
    walk(t, moving) {
      const step = t * 11 + seed;
      body.position.y = moving ? Math.abs(Math.sin(step)) * 0.03 : 0;
      legs.forEach((leg, k) => {
        leg.rotation.x = moving
          ? Math.sin(step + (k === 0 || k === 3 ? 0 : Math.PI)) * 0.6
          : 0;
      });
      tail.rotation.y = Math.sin(t * 4 + seed) * 0.45;
      head.group.rotation.y = Math.sin(t * 0.9 + seed) * 0.35;
      head.group.rotation.x = moving ? Math.sin(step * 2) * 0.04 : 0;
      for (const [k, eye] of head.eyes.entries())
        eye.scale.y = blink(t, seed + k * 0.05);
      if (sign) sign.position.y = 0.7 + Math.abs(Math.sin(step)) * 0.02;
    },
    tick(t) {
      // Sitting up and waving a big front paw, for the visitor's island.
      body.rotation.x = -0.5;
      body.position.set(0, 0.06 + Math.abs(Math.sin(t * 3.5)) * 0.012, -0.04);
      legs[0].rotation.x = 0.35;
      legs[1].scale.setScalar(1.6);
      legs[1].rotation.x = -0.35;
      legs[1].rotation.z = 2.3 + Math.sin(t * 7) * 0.32;
      legs[2].rotation.x = legs[3].rotation.x = -1.1;
      tail.rotation.y = Math.sin(t * 5) * 0.55;
      head.group.rotation.x = 0.35;
      head.group.rotation.z = Math.sin(t * 2.2) * 0.12;
      for (const [k, eye] of head.eyes.entries())
        eye.scale.y = blink(t, seed + k * 0.05);
    },
  };
}

// --- Birds ------------------------------------------------------------------

const birdBody = (length: number, girth: number) => {
  const geometry = lathe(
    [
      [0, -length * 0.55],
      [girth * 0.45, -length * 0.42],
      [girth * 0.9, -length * 0.15],
      [girth, length * 0.08],
      [girth * 0.8, length * 0.28],
      [girth * 0.4, length * 0.42],
      [0, length * 0.46],
    ],
    20,
  );
  geometry.rotateX(Math.PI / 2);
  return geometry;
};
// A wing in the xz-plane growing towards +x, with fingered tips.
const wingShape = (span: number, chord: number, fingers: number) => {
  const points: [number, number][] = [
    [0, chord * 0.55],
    [span * 0.5, chord * 0.62],
    [span * 0.86, chord * 0.42],
  ];
  for (let k = 0; k < fingers; k++) {
    const z = chord * 0.3 - (k * chord * 0.5) / Math.max(1, fingers - 1);
    points.push([span, z], [span * 0.84, z - chord * 0.12]);
  }
  points.push([span * 0.55, -chord * 0.3], [0, -chord * 0.4]);
  return points;
};

export type Flyer = Model & { fly(t: number, gliding: boolean): void };

// The Taiwan blue magpie: black hood, red beak, blue body and a long blue
// tail tipped in white. This one carries a story in its beak.
export function magpie(kit: Kit): Flyer {
  const { c } = kit;
  const group = new Group();
  const body = live(put(group, new Group(), 0, 0, 0));
  const blue = kit.paint(c.blue);
  put(body, kit.solid(birdBody(0.36, 0.085), blue, 1.2), 0, 0, 0);
  const hood = put(
    body,
    kit.solid(ball(0.074), kit.paint(c.ink), 1.1),
    0,
    0.03,
    0.15,
  );
  hood.scale.set(1, 1, 1.1);
  const belly = put(
    body,
    kit.solid(ball(0.07), kit.paint(c.magpieBelly), null),
    0,
    -0.035,
    0.0,
  );
  belly.scale.set(0.9, 0.7, 1.6);
  const beak = new ConeGeometry(0.024, 0.085, 10);
  beak.rotateX(Math.PI / 2);
  put(body, kit.solid(beak, kit.paint(c.coral), 1), 0, 0.02, 0.255);
  for (const side of [-1, 1]) {
    put(
      body,
      kit.solid(ball(0.016, 8, 6), kit.paint(c.yellow), null),
      side * 0.05,
      0.055,
      0.19,
    );
    put(
      body,
      kit.solid(ball(0.009, 6, 5), kit.paint(c.ink), null),
      side * 0.058,
      0.057,
      0.197,
    );
  }
  const wings = [-1, 1].map((side) => {
    const pivot = live(put(body, new Group(), side * 0.06, 0.03, 0.02));
    const points = wingShape(0.36, 0.2, 3).map(
      ([x, z]) => [side * x, z] as const,
    );
    put(
      pivot,
      kit.solid(
        slab(side > 0 ? points : [...points].reverse(), 0.012),
        blue,
        1.1,
      ),
      0,
      0,
      0,
    );
    const tip = wingShape(0.36, 0.2, 3)
      .filter(([x]) => x > 0.3)
      .map(([x, z]) => [side * x, z] as const);
    if (tip.length > 2)
      put(
        pivot,
        kit.solid(
          slab(side > 0 ? tip : [...tip].reverse(), 0.014),
          kit.paint(c.white),
          null,
        ),
        0,
        0.004,
        0,
      );
    return { pivot, side };
  });
  const tail = live(put(body, new Group(), 0, 0.01, -0.17));
  for (const side of [-1, 1]) {
    const feather = put(tail, new Group(), side * 0.02, 0, 0);
    feather.rotation.y = side * 0.07;
    put(
      feather,
      kit.solid(
        slab(
          [
            [-0.032, 0],
            [0.032, 0],
            [0.026, -0.36],
            [-0.026, -0.36],
          ],
          0.01,
        ),
        blue,
        1,
      ),
      0,
      0,
      0,
    );
    put(
      feather,
      kit.solid(
        slab(
          [
            [-0.026, -0.36],
            [0.026, -0.36],
            [0.024, -0.42],
            [-0.024, -0.42],
          ],
          0.011,
        ),
        kit.paint(c.ink),
        null,
      ),
      0,
      0,
      0,
    );
    put(
      feather,
      kit.solid(
        slab(
          [
            [-0.024, -0.42],
            [0.024, -0.42],
            [0, -0.5],
          ],
          0.011,
        ),
        kit.paint(c.white),
        null,
      ),
      0,
      0,
      0,
    );
  }
  // The story it carries: a yellow speech bubble with three dots.
  const story = put(body, new Group(), 0, -0.05, 0.31);
  story.rotation.x = -1.15;
  put(
    story,
    kit.solid(
      plate(bubbleShape(0.24, 0.15), 0.03),
      kit.paint(c.yellow, 0.15),
      1.2,
    ),
    0,
    0,
    0,
  );
  for (const x of [-0.06, 0, 0.06])
    put(
      story,
      kit.solid(ball(0.017, 8, 6), kit.paint(c.ink), null),
      x,
      0.01,
      0.03,
    );
  const seed = Math.random() * 10;
  return {
    group,
    height: 0.4,
    fly(t, gliding) {
      const beat = t * 13 + seed;
      for (const { pivot, side } of wings)
        pivot.rotation.z = gliding
          ? side * -0.08
          : side * (Math.sin(beat) * 0.85 - 0.1);
      body.position.y = gliding ? 0 : -Math.sin(beat) * 0.03;
      tail.rotation.x = Math.sin(t * 3 + seed) * 0.08;
    },
  };
}

// A seagull circling the cloud tower.
export function seagull(kit: Kit): Flyer {
  const { c } = kit;
  const group = new Group();
  group.userData.flying = true;
  const body = live(put(group, new Group(), 0, 0, 0));
  put(body, kit.solid(birdBody(0.3, 0.07), kit.paint(c.white), 1), 0, 0, 0);
  put(
    body,
    kit.solid(ball(0.06, 12, 10), kit.paint(c.white), 1),
    0,
    0.03,
    0.13,
  );
  const beak = new ConeGeometry(0.018, 0.07, 8);
  beak.rotateX(Math.PI / 2);
  put(body, kit.solid(beak, kit.paint(c.yellow), null), 0, 0.02, 0.2);
  const wings = [-1, 1].map((side) => {
    const pivot = live(put(body, new Group(), side * 0.05, 0.03, 0));
    const points = wingShape(0.42, 0.13, 2).map(
      ([x, z]) => [side * x, z] as const,
    );
    put(
      pivot,
      kit.solid(
        slab(side > 0 ? points : [...points].reverse(), 0.01),
        kit.paint(c.gull),
        1,
      ),
      0,
      0,
      0,
    );
    return { pivot, side };
  });
  const seed = Math.random() * 10;
  return {
    group,
    height: 0.2,
    fly(t, gliding) {
      const beat = t * 9 + seed;
      for (const { pivot, side } of wings)
        pivot.rotation.z = gliding
          ? side * -0.18 + Math.sin(t * 2 + seed) * 0.05
          : side * Math.sin(beat) * 0.7;
    },
  };
}

// --- Sea animals --------------------------------------------------------------

export type Swimmer = Model & { swim(t: number): void };

// A green sea turtle bringing the finished work home on its back.
export function seaTurtle(kit: Kit): Swimmer {
  const { c } = kit;
  const group = new Group();
  const body = live(put(group, new Group(), 0, 0, 0));
  const dome = new SphereGeometry(0.27, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const shell = put(
    body,
    kit.solid(dome, kit.textured(kit.scutes, c.white), 1.3),
    0,
    0.01,
    0,
  );
  shell.scale.set(1, 0.5, 1.3);
  const rim = new TorusGeometry(0.265, 0.035, 8, 32);
  rim.rotateX(Math.PI / 2);
  const ring = put(body, kit.solid(rim, kit.paint(c.shell), 1), 0, 0.01, 0);
  ring.scale.set(1, 1, 1.3);
  const skin = kit.paint(c.skin);
  const head = live(put(body, new Group(), 0, 0.03, 0.38));
  const skull = put(head, kit.solid(ball(0.085, 16, 12), skin, 1.2), 0, 0, 0);
  skull.scale.set(0.95, 0.82, 1.15);
  for (const side of [-1, 1]) {
    put(
      head,
      kit.solid(ball(0.016, 8, 6), kit.paint(c.ink), null),
      side * 0.05,
      0.03,
      0.06,
    );
    put(
      head,
      kit.solid(ball(0.006, 6, 4), kit.paint(c.white, 0.5), null),
      side * 0.046,
      0.04,
      0.072,
    );
  }
  const paddle = (length: number, width: number) =>
    slab(
      [
        [0, width * 0.5],
        [length * 0.55, width * 0.6],
        [length, width * 0.1],
        [length * 0.7, -width * 0.45],
        [0, -width * 0.5],
      ],
      0.02,
    );
  const flippers = (
    [
      [-0.22, 0.16, 1, 0.3],
      [0.22, 0.16, 1, 0.3],
      [-0.17, -0.27, 0, 0.16],
      [0.17, -0.27, 0, 0.16],
    ] as const
  ).map(([x, z, front, length]) => {
    const side = x < 0 ? -1 : 1;
    const pivot = live(put(body, new Group(), x, 0, z));
    const fin = put(
      pivot,
      kit.solid(paddle(length, length * 0.42), skin, 1),
      0,
      0,
      0,
    );
    fin.scale.x = side;
    fin.rotation.y = side * (front ? 0.5 : -0.4);
    return { pivot, side, front };
  });
  // The work it brings back: a green gift with a yellow ribbon.
  const gift = put(body, new Group(), 0, 0.2, -0.02);
  put(
    gift,
    kit.solid(rounded(0.2, 0.16, 0.2, 0.025), kit.paint(c.green), 1.2),
    0,
    0,
    0,
  );
  put(
    gift,
    kit.solid(rounded(0.05, 0.166, 0.206, 0.01), kit.paint(c.yellow), null),
    0,
    0,
    0,
  );
  put(
    gift,
    kit.solid(rounded(0.206, 0.166, 0.05, 0.01), kit.paint(c.yellow), null),
    0,
    0,
    0,
  );
  const loop = new TorusGeometry(0.04, 0.016, 8, 14);
  for (const side of [-1, 1]) {
    const bow = put(
      gift,
      kit.solid(loop, kit.paint(c.yellow), 1),
      side * 0.035,
      0.11,
      0,
    );
    bow.rotation.y = side * 0.5;
  }
  const seed = Math.random() * 10;
  return {
    group,
    height: 0.4,
    swim(t) {
      const stroke = t * 2.6 + seed;
      body.position.y = Math.sin(stroke * 2) * 0.012;
      body.rotation.z = Math.sin(stroke) * 0.05;
      head.rotation.y = Math.sin(t * 0.8 + seed) * 0.25;
      head.position.z = 0.38 + Math.sin(stroke * 2) * 0.01;
      for (const { pivot, side, front } of flippers) {
        pivot.rotation.z = front
          ? side * Math.sin(stroke) * 0.45
          : side * Math.sin(stroke + 1) * 0.2;
        pivot.rotation.y = front ? side * (Math.cos(stroke) * 0.4) : 0;
      }
    },
  };
}

// Taiwan's pink humpback dolphin, for the jumps out at sea.
export function dolphin(kit: Kit): Model {
  const { c } = kit;
  const group = new Group();
  const pink = kit.paint(c.dolphin);
  const length = 0.95;
  const body = lathe(
    [
      [0, -length * 0.5],
      [0.04, -length * 0.44],
      [0.09, -length * 0.3],
      [0.135, -length * 0.06],
      [0.13, length * 0.12],
      [0.1, length * 0.26],
      [0.06, length * 0.36],
      [0.035, length * 0.44],
      [0, length * 0.5],
    ],
    22,
  );
  body.rotateX(Math.PI / 2);
  put(group, kit.solid(body, pink, 1.3), 0, 0, 0);
  const belly = put(
    group,
    kit.solid(ball(0.11), kit.paint(c.dolphinBelly), null),
    0,
    -0.05,
    0.05,
  );
  belly.scale.set(0.9, 0.55, 2.4);
  const fin = new Shape();
  fin.moveTo(-0.08, 0);
  fin.quadraticCurveTo(-0.02, 0.06, 0.06, 0.16);
  fin.quadraticCurveTo(0.04, 0.06, 0.1, 0);
  fin.lineTo(-0.08, 0);
  const dorsal = plate(fin, 0.02, 0.006);
  dorsal.rotateY(-Math.PI / 2);
  put(group, kit.solid(dorsal, pink, 1), 0, 0.11, -0.05);
  const fluke = slab(
    [
      [0, 0.02],
      [0.17, -0.06],
      [0.2, -0.12],
      [0.08, -0.08],
      [0, -0.12],
      [-0.08, -0.08],
      [-0.2, -0.12],
      [-0.17, -0.06],
    ],
    0.018,
  );
  put(group, kit.solid(fluke, pink, 1), 0, 0, -length * 0.5);
  for (const side of [-1, 1]) {
    const flipper = put(
      group,
      kit.solid(
        slab(
          [
            [0, 0.04],
            [side * 0.14, -0.04],
            [side * 0.05, -0.06],
          ],
          0.016,
        ),
        pink,
        1,
      ),
      side * 0.1,
      -0.05,
      0.12,
    );
    flipper.rotation.z = side * -0.3;
    put(
      group,
      kit.solid(ball(0.014, 8, 6), kit.paint(c.ink), null),
      side * 0.07,
      0.03,
      length * 0.3,
    );
  }
  return { group, height: 0.3 };
}

// --- Land animals ---------------------------------------------------------------

// A Formosan black bear running the Java café: black coat, the white V on
// its chest, a coral apron and a cup it keeps sipping from.
export function bearBarista(kit: Kit): Model {
  const { c } = kit;
  const group = new Group();
  const coat = kit.paint(c.bear);
  const body = live(put(group, new Group(), 0, 0, 0));
  put(body, kit.solid(pill(0.17, 0.2), coat, 1.3), 0, 0.33, 0);
  const apron = put(
    body,
    kit.solid(rounded(0.24, 0.2, 0.04, 0.02), kit.paint(c.coral), null),
    0,
    0.27,
    0.15,
  );
  apron.rotation.x = -0.12;
  const v = new Shape([
    new Vector2(-0.11, 0.05),
    new Vector2(-0.07, 0.06),
    new Vector2(0, -0.04),
    new Vector2(0.07, 0.06),
    new Vector2(0.11, 0.05),
    new Vector2(0, -0.08),
  ]);
  put(
    body,
    kit.solid(plate(v, 0.012, 0.004), kit.paint(c.cream), null),
    0,
    0.46,
    0.155,
  );
  for (const side of [-1, 1])
    put(body, kit.solid(pill(0.065, 0.08), coat, 1.1), side * 0.09, 0.08, 0.02);
  const head = live(put(body, new Group(), 0, 0.67, 0.02));
  put(head, kit.solid(ball(0.16, 18, 14), coat, 1.3), 0, 0, 0);
  for (const side of [-1, 1]) {
    put(
      head,
      kit.solid(ball(0.06, 12, 10), coat, 1.1),
      side * 0.12,
      0.12,
      -0.01,
    );
    put(
      head,
      kit.solid(ball(0.032, 8, 6), kit.paint(c.snout), null),
      side * 0.12,
      0.12,
      0.025,
    );
    put(
      head,
      kit.solid(ball(0.02, 8, 6), kit.paint(c.white, 0.4), null),
      side * 0.06,
      0.04,
      0.145,
    );
    put(
      head,
      kit.solid(ball(0.012, 6, 5), kit.paint(c.ink), null),
      side * 0.06,
      0.04,
      0.16,
    );
  }
  const snout = put(
    head,
    kit.solid(ball(0.075, 14, 10), kit.paint(c.snout), 1.1),
    0,
    -0.04,
    0.12,
  );
  snout.scale.set(1.1, 0.8, 0.9);
  put(
    head,
    kit.solid(ball(0.028, 8, 6), kit.paint(c.ink), null),
    0,
    -0.01,
    0.19,
  );
  const arm = live(put(body, new Group(), 0.16, 0.45, 0.02));
  const limb = pill(0.055, 0.16);
  limb.translate(0, -0.1, 0);
  put(arm, kit.solid(limb, coat, 1.1), 0, 0, 0);
  put(
    arm,
    kit.solid(
      lathe(
        [
          [0, 0],
          [0.035, 0],
          [0.04, 0.06],
          [0, 0.06],
        ],
        16,
      ),
      kit.paint(c.white),
      1,
    ),
    0,
    -0.22,
    0.03,
  );
  put(
    body,
    kit.solid(pill(0.055, 0.14), coat, 1.1),
    -0.17,
    0.36,
    0.03,
  ).rotation.z = -0.25;
  return {
    group,
    height: 0.9,
    tick(t) {
      const sip = (t % 5.2) / 5.2;
      const raise =
        sip > 0.62 && sip < 0.92 ? Math.sin(((sip - 0.62) / 0.3) * Math.PI) : 0;
      arm.rotation.x = -0.5 - raise * 1.5;
      arm.rotation.z = 0.15 + raise * 0.4;
      head.rotation.x = -raise * 0.18 + Math.sin(t * 1.3) * 0.03;
      head.rotation.y = Math.sin(t * 0.6) * 0.3 * (1 - raise);
      body.scale.y = 1 + Math.sin(t * 2.1) * 0.012;
    },
  };
}

// A Taiwan leopard cat (石虎) bobbing its head to the record.
export function leopardCat(kit: Kit): Model {
  const { c } = kit;
  const group = new Group();
  const coat = kit.paint(c.cat);
  const body = put(group, kit.solid(pill(0.085, 0.12), coat, 1.2), 0, 0.16, 0);
  body.rotation.x = -0.25;
  const spots = kit.paint(c.catSpot);
  for (const [x, y, z] of [
    [-0.07, 0.2, 0.03],
    [0.075, 0.17, 0.02],
    [-0.06, 0.11, -0.05],
    [0.065, 0.24, -0.03],
    [0, 0.26, -0.07],
  ] as const)
    put(group, kit.solid(ball(0.016, 6, 5), spots, null), x, y, z);
  const head = live(put(group, new Group(), 0, 0.33, 0.04));
  put(head, kit.solid(ball(0.09, 16, 12), coat, 1.2), 0, 0, 0);
  for (const side of [-1, 1]) {
    const ear = put(
      head,
      kit.solid(new ConeGeometry(0.035, 0.07, 8), coat, 1),
      side * 0.055,
      0.08,
      -0.01,
    );
    ear.rotation.z = side * -0.3;
    put(
      head,
      kit.solid(rounded(0.012, 0.06, 0.01, 0.004), kit.paint(c.white), null),
      side * 0.018,
      0.05,
      0.078,
    ).rotation.z = side * 0.15;
    put(
      head,
      kit.solid(ball(0.017, 8, 6), kit.paint(c.ink), null),
      side * 0.035,
      0.01,
      0.078,
    );
  }
  put(
    head,
    kit.solid(ball(0.03, 10, 8), kit.paint(c.cream), null),
    0,
    -0.035,
    0.07,
  );
  put(
    head,
    kit.solid(ball(0.01, 6, 5), kit.paint(c.nose), null),
    0,
    -0.02,
    0.098,
  );
  const tail = live(put(group, new Group(), 0, 0.07, -0.1));
  put(
    tail,
    kit.solid(
      tube(
        [
          [0, 0, 0],
          [0.06, 0.02, -0.12],
          [0.16, 0.06, -0.1],
          [0.2, 0.14, -0.02],
        ],
        0.02,
      ),
      coat,
      1,
    ),
    0,
    0,
    0,
  );
  put(tail, kit.solid(ball(0.022, 8, 6), spots, null), 0.2, 0.14, -0.02);
  return {
    group,
    height: 0.5,
    tick(t) {
      const beat = t * 4.2;
      head.rotation.z = Math.sin(beat) * 0.16;
      head.rotation.x = Math.abs(Math.sin(beat)) * -0.12;
      tail.rotation.y = Math.sin(t * 1.6) * 0.35;
    },
  };
}

// --- Landmarks -------------------------------------------------------------------

// L ①: the database, three rounded platters joined by glowing rings.
export function database(kit: Kit): Model {
  const { c } = kit;
  const group = new Group();
  put(
    group,
    kit.solid(disc(0.58, 0.05, 32), kit.paint(c.path), 1),
    0,
    0.025,
    0,
  );
  const platter = lathe(
    [
      [0, 0],
      [0.36, 0],
      [0.4, 0.03],
      [0.41, 0.09],
      [0.4, 0.15],
      [0.36, 0.18],
      [0, 0.18],
    ],
    32,
  );
  const colors = [c.paper, c.paper, c.yellow];
  colors.forEach((color, k) =>
    put(
      group,
      kit.solid(platter, kit.paint(color), 1.3),
      0,
      0.05 + k * 0.22,
      0,
    ),
  );
  const ring = new TorusGeometry(0.375, 0.02, 8, 36);
  ring.rotateX(Math.PI / 2);
  const leds = [0, 1].map((k) => {
    put(
      group,
      kit.solid(ring, kit.lamp(c.sky, c.sky), null),
      0,
      0.245 + k * 0.22,
      0,
    );
    return [-0.12, 0, 0.12].map((x) => {
      const material = new MeshBasicMaterial({ color: c.green.clone() });
      put(
        group,
        new Mesh(ball(0.022, 8, 6), material),
        x,
        0.14 + k * 0.22,
        0.405,
      );
      return material;
    });
  });
  put(group, kit.halo(c.sky, 1.4, 0.1, 0.7), 0, 0.4, 0);
  return {
    group,
    height: 0.75,
    tick(t) {
      leds.flat().forEach((material, k) => {
        material.color.copy(
          Math.sin(t * 6 + k * 2.1) > 0.2 ? c.green : c.leafDeep,
        );
      });
    },
  };
}

// L ②: the Java café, a giant cup with latte art, run by a black bear.
export function javaCafe(kit: Kit): Model {
  const { c } = kit;
  const group = new Group();
  put(
    group,
    kit.solid(disc(0.72, 0.05, 36), kit.paint(c.path), 1),
    0,
    0.025,
    0,
  );
  const cupAt = new Vector3(-0.12, 0.05, 0);
  put(
    group,
    kit.solid(
      lathe(
        [
          [0, 0],
          [0.52, 0],
          [0.56, 0.03],
          [0.5, 0.06],
          [0, 0.06],
        ],
        36,
      ),
      kit.paint(c.white),
      1.3,
    ),
    cupAt.x,
    cupAt.y,
    0,
  );
  const cup = lathe(
    [
      [0, 0],
      [0.26, 0],
      [0.3, 0.05],
      [0.37, 0.42],
      [0.4, 0.5],
      [0.37, 0.5],
      [0.34, 0.44],
      [0, 0.44],
    ],
    36,
  );
  put(group, kit.solid(cup, kit.paint(c.coral), 1.4), cupAt.x, 0.1, 0);
  put(
    group,
    kit.solid(disc(0.34, 0.03, 32), kit.paint(c.woodDark), null),
    cupAt.x,
    0.52,
    0,
  );
  const heart = plate(heartShape(0.09), 0.01, 0.004);
  heart.rotateX(-Math.PI / 2);
  put(group, kit.solid(heart, kit.paint(c.cream), null), cupAt.x, 0.54, 0.02);
  const handle = new TorusGeometry(0.13, 0.04, 10, 20, Math.PI * 1.25);
  handle.rotateZ(-Math.PI * 0.62);
  put(
    group,
    kit.solid(handle, kit.paint(c.coral), 1.2),
    cupAt.x + 0.39,
    0.33,
    0,
  );
  // Menu board.
  const board = put(group, new Group(), 0.4, 0.05, 0.42);
  board.rotation.y = -0.5;
  put(
    board,
    kit.solid(rounded(0.3, 0.36, 0.03, 0.02), kit.paint(c.woodDark), 1),
    0,
    0.2,
    0,
  );
  const menu = new Mesh(
    new PlaneGeometry(0.25, 0.3),
    new MeshBasicMaterial({
      map: kit.words("JAVA", 128, 160, kit.hex.paper, kit.hex.ink),
    }),
  );
  put(board, menu, 0, 0.21, 0.017);
  // Steam rising from the coffee.
  const steam = [0, 1, 2, 3].map(() =>
    live(put(group, kit.puff(0.22), 0, 0.7, 0)),
  );
  const bear = bearBarista(kit);
  put(group, bear.group, 0.5, 0.05, -0.15);
  bear.group.rotation.y = -0.45;
  return {
    group,
    height: 0.95,
    tick(t, view) {
      steam.forEach((cloud, k) => {
        const life = (t * 0.4 + k / 4) % 1;
        cloud.position.set(
          cupAt.x + Math.sin(life * 6 + k * 2) * 0.1,
          0.6 + life * 0.8,
          Math.cos(life * 5 + k) * 0.06,
        );
        cloud.scale.setScalar(0.12 + life * 0.3);
        (cloud.material as SpriteMaterial).opacity =
          Math.sin(life * Math.PI) * 0.85;
      });
      bear.tick?.(t, view);
    },
  };
}

// L ③: the AWS cloud tower, a striped lighthouse with a cloud for a lamp.
export function cloudTower(kit: Kit): Model {
  const { c } = kit;
  const group = new Group();
  put(group, kit.solid(disc(0.42, 0.06, 28), kit.paint(c.rock), 1), 0, 0.03, 0);
  const bands = [c.white, c.sky, c.white, c.sky, c.white];
  bands.forEach((color, k) => {
    const y0 = k * 0.24;
    const r0 = 0.24 - k * 0.022;
    const r1 = 0.24 - (k + 1) * 0.022;
    put(
      group,
      kit.solid(
        lathe(
          [
            [0, 0],
            [r0, 0],
            [r1, 0.24],
            [0, 0.24],
          ],
          24,
        ),
        kit.paint(color),
        1.3,
      ),
      0,
      0.06 + y0,
      0,
    );
  });
  const deck = 0.06 + bands.length * 0.24;
  put(
    group,
    kit.solid(disc(0.21, 0.04, 24), kit.paint(c.ink), 1),
    0,
    deck + 0.02,
    0,
  );
  const rail = new TorusGeometry(0.2, 0.012, 6, 28);
  rail.rotateX(Math.PI / 2);
  put(group, kit.solid(rail, kit.paint(c.ink), null), 0, deck + 0.1, 0);
  put(
    group,
    kit.solid(disc(0.13, 0.16, 20), kit.lamp(c.glass, c.yellow), 1.2),
    0,
    deck + 0.12,
    0,
  );
  put(group, kit.halo(c.yellow, 1.1, 0.1, 1), 0, deck + 0.13, 0);
  const cloud = live(put(group, new Group(), 0, deck + 0.42, 0));
  for (const [x, y, z, r] of [
    [0, 0, 0, 0.24],
    [-0.22, -0.05, 0.02, 0.17],
    [0.23, -0.04, 0.03, 0.18],
    [0.05, 0.1, -0.08, 0.17],
    [-0.08, -0.03, 0.15, 0.14],
    [0.1, -0.05, -0.16, 0.15],
  ] as const)
    put(cloud, kit.solid(ball(r, 16, 12), kit.paint(c.white), 1.2), x, y, z);
  const windows = kit.lamp(c.ink, c.yellow);
  for (const k of [1, 3])
    put(
      group,
      new Mesh(rounded(0.06, 0.09, 0.03, 0.01), windows),
      0,
      0.12 + k * 0.24,
      0.225 - k * 0.022,
    );
  const gulls = [0, 1, 2].map((k) => {
    const gull = seagull(kit);
    put(group, gull.group, 0, 0, 0);
    return {
      gull,
      radius: 0.9 + k * 0.32,
      height: deck + 0.35 + k * 0.28,
      speed: 0.55 - k * 0.1,
      phase: k * 2.1,
    };
  });
  return {
    group,
    height: deck + 0.75,
    tick(t) {
      cloud.rotation.y = t * 0.25;
      cloud.position.y = deck + 0.42 + Math.sin(t * 1.2) * 0.03;
      for (const { gull, radius, height, speed, phase } of gulls) {
        const a = t * speed + phase;
        gull.group.position.set(
          Math.cos(a) * radius,
          height + Math.sin(t * 1.3 + phase) * 0.08,
          Math.sin(a) * radius,
        );
        gull.group.rotation.set(0, -a, Math.sin(t + phase) * 0.18 - 0.25);
        gull.fly(t, Math.sin(t * 0.7 + phase) > -0.3);
      }
    },
  };
}

// L ④: Full Stack 疊疊樂, rounded blocks on the 「LEONARD LAI」 plinth.
export function stackTower(kit: Kit): Model {
  const { c } = kit;
  const group = new Group();
  put(
    group,
    kit.solid(rounded(0.96, 0.16, 0.96, 0.04), kit.paint(c.ink), 1.3),
    0,
    0.08,
    0,
  );
  const name = new Mesh(
    new PlaneGeometry(0.86, 0.1),
    new MeshBasicMaterial({
      map: kit.words("LEONARD LAI", 344, 40, kit.hex.yellow, kit.hex.ink),
    }),
  );
  put(group, name, 0, 0.08, 0.482);
  const tower = live(put(group, new Group(), 0, 0.16, 0));
  const colors = [
    c.yellow,
    c.coral,
    c.green,
    c.sky,
    c.white,
    c.yellow,
    c.coral,
  ];
  colors.forEach((color, k) => {
    const w = 0.78 - k * 0.04;
    put(
      tower,
      kit.solid(rounded(w, 0.15, w, 0.035), kit.paint(color), 1.2),
      (k % 2 ? 1 : -1) * 0.03,
      0.075 + k * 0.155,
      ((k % 3) - 1) * 0.02,
    );
  });
  return {
    group,
    height: 1.35,
    tick(t) {
      tower.rotation.z = Math.sin(t * 1.25) * 0.03;
      tower.rotation.x = Math.sin(t * 1.05 + 1) * 0.022;
    },
  };
}

// A ①: the AI core, the brand's star on a pedestal with sparks around it.
export function aiStar(
  kit: Kit,
  inlayRadius: number,
): Model & { kick(t: number): void } {
  const { c } = kit;
  const group = new Group();
  const amber = kit.paint(c.amber, 0.35);
  const inlay = new ExtrudeGeometry(starShape(inlayRadius), {
    depth: 0.04,
    bevelEnabled: false,
    curveSegments: 18,
  });
  inlay.rotateX(-Math.PI / 2);
  put(group, kit.solid(inlay, amber, 1.6), 0, 0.004, 0);
  put(
    group,
    kit.solid(
      lathe(
        [
          [0, 0],
          [0.24, 0],
          [0.18, 0.08],
          [0.12, 0.42],
          [0.18, 0.48],
          [0, 0.48],
        ],
        24,
      ),
      kit.paint(c.paper),
      1.3,
    ),
    0,
    0.04,
    0,
  );
  const glowRing = new TorusGeometry(0.2, 0.025, 8, 28);
  glowRing.rotateX(Math.PI / 2);
  put(group, kit.solid(glowRing, kit.lamp(c.amber, c.amber), null), 0, 0.52, 0);
  const charm = plate(starShape(0.42), 0.12, 0.035);
  const floating = live(put(group, kit.solid(charm, amber, 1.6), 0, 1.25, 0));
  const glow = put(group, kit.halo(c.amber, 2.4, 0.35, 1), 0, 1.25, 0);
  const sparks = [0, 1, 2].map(() =>
    live(put(group, kit.icon("spark", 0.2), 0, 1.2, 0)),
  );
  let kicked = -10;
  return {
    group,
    height: 1.7,
    kick(t) {
      kicked = t;
    },
    tick(t, view) {
      const kick = Math.max(0, 1 - (t - kicked) / 0.9);
      // Always faces the viewer, so the star reads from any angle; it turns
      // in its own plane instead.
      floating.lookAt(view);
      floating.rotateZ(Math.sin(t * 0.9) * 0.35 + kick * 6.28);
      floating.position.y = 1.25 + Math.sin(t * 1.6) * 0.08 + kick * 0.22;
      floating.scale.setScalar(1 + kick * 0.45);
      glow.scale.setScalar(2.4 + kick * 2.6);
      sparks.forEach((spark, k) => {
        const a = t * 1.4 + (k * Math.PI * 2) / 3;
        spark.position.set(
          Math.cos(a) * 0.55,
          1.25 + Math.sin(t * 2 + k) * 0.18,
          Math.sin(a) * 0.55,
        );
        (spark.material as SpriteMaterial).opacity =
          0.55 + Math.sin(t * 5 + k * 2) * 0.45;
      });
    },
  };
}

// A ②: 好理家在, a home with a garden, a fence and smoke from the chimney.
export function familyHome(kit: Kit): Model {
  const { c } = kit;
  const group = new Group();
  put(
    group,
    kit.solid(rounded(0.7, 0.46, 0.56, 0.04), kit.paint(c.paper), 1.3),
    0,
    0.23,
    0,
  );
  const roof = kit.paint(c.coral);
  for (const side of [-1, 1]) {
    const half = put(
      group,
      kit.solid(rounded(0.46, 0.05, 0.68, 0.02), roof, 1.2),
      side * 0.19,
      0.58,
      0,
    );
    half.rotation.z = side * -0.62;
  }
  put(
    group,
    kit.solid(rounded(0.08, 0.06, 0.7, 0.02), kit.paint(c.woodDark), null),
    0,
    0.73,
    0,
  );
  put(
    group,
    kit.solid(rounded(0.1, 0.22, 0.1, 0.02), roof, 1.1),
    0.2,
    0.74,
    -0.12,
  );
  put(
    group,
    kit.solid(rounded(0.15, 0.26, 0.03, 0.02), kit.paint(c.woodDark), 1),
    -0.14,
    0.13,
    0.285,
  );
  put(
    group,
    kit.solid(ball(0.015, 6, 5), kit.paint(c.yellow), null),
    -0.09,
    0.13,
    0.305,
  );
  const window = kit.lamp(c.sky, c.yellow);
  for (const x of [0.14]) {
    put(
      group,
      kit.solid(rounded(0.18, 0.15, 0.03, 0.015), kit.paint(c.white), 1),
      x,
      0.27,
      0.285,
    );
    put(
      group,
      new Mesh(rounded(0.13, 0.1, 0.03, 0.01), window),
      x,
      0.27,
      0.293,
    );
  }
  put(group, kit.halo(c.yellow, 0.9, 0, 0.85), 0.14, 0.27, 0.36);
  const heart = plate(heartShape(0.05), 0.02, 0.006);
  put(group, kit.solid(heart, kit.paint(c.coral, 0.2), null), 0, 0.5, 0.29);
  // Fence and garden.
  const fence = kit.paint(c.white);
  for (let k = 0; k < 7; k++)
    put(
      group,
      kit.solid(rounded(0.035, 0.16, 0.035, 0.01), fence, 0.9),
      -0.45 + k * 0.15,
      0.08,
      0.5,
    );
  put(
    group,
    kit.solid(rounded(0.95, 0.03, 0.025, 0.01), fence, null),
    0,
    0.12,
    0.5,
  );
  for (const [x, color] of [
    [-0.36, c.coral],
    [-0.27, c.yellow],
    [0.3, c.white],
    [0.38, c.coral],
  ] as const) {
    put(
      group,
      kit.solid(ball(0.035, 8, 6), kit.paint(color), null),
      x,
      0.08,
      0.4,
    );
    put(
      group,
      kit.solid(ball(0.05, 8, 6), kit.paint(c.leaf), null),
      x,
      0.03,
      0.4,
    );
  }
  put(
    group,
    kit.solid(disc(0.012, 0.22, 6), kit.paint(c.woodDark), null),
    0.48,
    0.11,
    0.32,
  );
  put(
    group,
    kit.solid(rounded(0.1, 0.08, 0.14, 0.02), kit.paint(c.coral), 1),
    0.48,
    0.25,
    0.32,
  );
  const smoke = [0, 1, 2, 3].map(() =>
    live(put(group, kit.puff(0.2), 0.2, 0.9, -0.12)),
  );
  const gable = new Shape([
    new Vector2(-0.34, 0),
    new Vector2(0.34, 0),
    new Vector2(0, 0.25),
  ]);
  for (const z of [-0.27, 0.27])
    put(
      group,
      kit.solid(plate(gable, 0.02, 0.006), kit.paint(c.paper), null),
      0,
      0.455,
      z,
    );
  return {
    group,
    height: 0.95,
    tick(t) {
      smoke.forEach((cloud, k) => {
        const life = (t * 0.28 + k / 4) % 1;
        cloud.position.set(
          0.2 + life * 0.3,
          0.9 + life * 0.7,
          -0.12 - life * 0.12,
        );
        cloud.scale.setScalar(0.1 + life * 0.32);
        (cloud.material as SpriteMaterial).opacity =
          Math.sin(life * Math.PI) * 0.8;
      });
    },
  };
}

// A ③: medical AI, a clinic with a friendly robot waving at the door.
export function careBot(kit: Kit): Model {
  const { c } = kit;
  const group = new Group();
  put(
    group,
    kit.solid(rounded(0.66, 0.4, 0.5, 0.04), kit.paint(c.white), 1.3),
    -0.12,
    0.2,
    -0.05,
  );
  put(
    group,
    kit.solid(rounded(0.72, 0.07, 0.56, 0.03), kit.paint(c.sky), 1.2),
    -0.12,
    0.43,
    -0.05,
  );
  put(
    group,
    kit.solid(rounded(0.16, 0.24, 0.03, 0.02), kit.paint(c.sky), 1),
    -0.24,
    0.12,
    0.21,
  );
  const heart = plate(heartShape(0.06), 0.02, 0.006);
  put(
    group,
    kit.solid(heart, kit.paint(c.coral, 0.25), null),
    -0.02,
    0.3,
    0.215,
  );
  const bot = live(put(group, new Group(), 0.32, 0, 0.12));
  put(
    bot,
    kit.solid(rounded(0.2, 0.22, 0.16, 0.06), kit.paint(c.white), 1.2),
    0,
    0.17,
    0,
  );
  for (const side of [-1, 1])
    put(
      bot,
      kit.solid(disc(0.04, 0.05, 12), kit.paint(c.muted), null),
      side * 0.06,
      0.03,
      0,
    ).rotation.z = Math.PI / 2;
  const head = live(put(bot, new Group(), 0, 0.38, 0));
  put(
    head,
    kit.solid(rounded(0.26, 0.19, 0.18, 0.06), kit.paint(c.sky), 1.2),
    0,
    0,
    0,
  );
  put(
    head,
    kit.solid(rounded(0.2, 0.12, 0.02, 0.03), kit.paint(c.ink), null),
    0,
    0,
    0.09,
  );
  const eyes = kit.lamp(c.green, c.green);
  for (const side of [-1, 1])
    put(head, new Mesh(pill(0.016, 0.03), eyes), side * 0.045, 0.012, 0.102);
  const smile = new TorusGeometry(0.03, 0.007, 4, 10, Math.PI);
  smile.rotateZ(Math.PI);
  put(head, new Mesh(smile, eyes), 0, -0.022, 0.102);
  put(head, kit.solid(disc(0.01, 0.12, 6), kit.paint(c.ink), null), 0, 0.15, 0);
  put(
    head,
    kit.solid(ball(0.032, 10, 8), kit.lamp(c.yellow, c.yellow), 1),
    0,
    0.22,
    0,
  );
  put(head, kit.halo(c.yellow, 0.45, 0.25, 0.8), 0, 0.22, 0);
  const wave = live(put(bot, new Group(), 0.12, 0.23, 0));
  const limb = pill(0.03, 0.12);
  limb.translate(0, -0.08, 0);
  put(wave, kit.solid(limb, kit.paint(c.white), 1), 0, 0, 0);
  put(
    bot,
    kit.solid(pill(0.03, 0.1), kit.paint(c.white), 1),
    -0.13,
    0.16,
    0,
  ).rotation.z = 0.2;
  return {
    group,
    height: 0.75,
    tick(t) {
      const greet = t % 6 < 2.4;
      wave.rotation.z = greet ? 2.4 + Math.sin(t * 9) * 0.35 : 0.3;
      head.rotation.y = Math.sin(t * 0.9) * 0.4;
      head.rotation.z = greet ? Math.sin(t * 4.5) * 0.08 : 0;
      bot.position.y = Math.abs(Math.sin(t * 2.2)) * 0.01;
    },
  };
}

// A ④: the AIEC evaluation lab: a domed lab, three lights for the three
// steps lit in turn, and a dish that keeps scanning.
export function testLab(kit: Kit): Model {
  const { c } = kit;
  const group = new Group();
  put(
    group,
    kit.solid(rounded(0.86, 0.32, 0.46, 0.04), kit.paint(c.paper), 1.3),
    0,
    0.16,
    0,
  );
  const dome = new SphereGeometry(0.22, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  put(group, kit.solid(dome, kit.paint(c.white), 1.2), -0.2, 0.32, 0);
  put(
    group,
    kit.solid(rounded(0.05, 0.16, 0.2, 0.02), kit.paint(c.ink), null),
    -0.2,
    0.42,
    0.08,
  ).rotation.x = -0.7;
  const panel = put(
    group,
    kit.solid(rounded(0.4, 0.14, 0.03, 0.02), kit.paint(c.ink), 1),
    0.18,
    0.2,
    0.24,
  );
  panel.rotation.x = -0.1;
  const steps = [c.yellow, c.coral, c.green].map((color, k) => {
    const material = new MeshBasicMaterial({ color: mix(color, c.ink, 0.6) });
    put(
      group,
      new Mesh(ball(0.035, 10, 8), material),
      0.06 + k * 0.12,
      0.2,
      0.26,
    );
    return { material, on: color.clone(), off: mix(color, c.ink, 0.6) };
  });
  put(
    group,
    kit.solid(disc(0.015, 0.2, 6), kit.paint(c.ink), null),
    0.26,
    0.42,
    -0.08,
  );
  const dish = live(put(group, new Group(), 0.26, 0.54, -0.08));
  const bowl = new SphereGeometry(
    0.13,
    18,
    8,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2.6,
  );
  bowl.rotateX(Math.PI);
  const tilt = put(dish, kit.solid(bowl, kit.paint(c.white), 1.1), 0, 0.06, 0);
  tilt.rotation.x = -0.9;
  return {
    group,
    height: 0.75,
    tick(t) {
      const step = t === 0 ? 3 : Math.floor(t / 0.8) % 4;
      steps.forEach((light, k) =>
        light.material.color.copy(k < step ? light.on : light.off),
      );
      dish.rotation.y = t * 0.9;
    },
  };
}

// I ②: the record player, with speakers and a leopard cat grooving to it.
export function recordPlayer(kit: Kit): Model {
  const { c } = kit;
  const group = new Group();
  put(
    group,
    kit.solid(rounded(0.84, 0.18, 0.64, 0.05), kit.paint(c.wood), 1.3),
    0,
    0.09,
    0,
  );
  const platter = live(put(group, new Group(), -0.08, 0.19, 0));
  put(
    platter,
    kit.solid(disc(0.27, 0.025, 36), kit.paint(c.metal), 1),
    0,
    0,
    0,
  );
  put(
    platter,
    kit.solid(disc(0.25, 0.012, 36), kit.paint(c.ink), null),
    0,
    0.018,
    0,
  );
  const groove = new TorusGeometry(0.17, 0.004, 4, 36);
  groove.rotateX(Math.PI / 2);
  put(platter, new Mesh(groove, kit.paint(c.steel)), 0, 0.026, 0);
  put(
    platter,
    kit.solid(disc(0.075, 0.016, 24), kit.paint(c.yellow), null),
    0,
    0.026,
    0,
  );
  put(
    platter,
    kit.solid(ball(0.016, 8, 6), kit.paint(c.coral), null),
    0.04,
    0.034,
    0.02,
  );
  put(
    group,
    kit.solid(disc(0.04, 0.05, 12), kit.paint(c.metal), 1),
    0.3,
    0.21,
    -0.2,
  );
  const arm = put(
    group,
    kit.solid(rounded(0.03, 0.025, 0.36, 0.01), kit.paint(c.metal), null),
    0.25,
    0.25,
    -0.05,
  );
  arm.rotation.y = 0.35;
  for (const side of [-1, 1]) {
    const speaker = put(group, new Group(), side * 0.58, 0, -0.05);
    put(
      speaker,
      kit.solid(rounded(0.26, 0.42, 0.24, 0.04), kit.paint(c.ink), 1.2),
      0,
      0.21,
      0,
    );
    for (const [y, r] of [
      [0.29, 0.07],
      [0.12, 0.05],
    ] as const) {
      const cone = disc(r, 0.02, 20);
      cone.rotateX(Math.PI / 2);
      put(speaker, new Mesh(cone, kit.paint(c.steel)), 0, y, 0.122);
    }
  }
  const cat = leopardCat(kit);
  put(group, cat.group, 0.12, 0.18, 0.2);
  cat.group.rotation.y = 0.35;
  const notes = [0, 1, 2].map(() =>
    live(put(group, kit.icon("note", 0.28), 0, 0.4, 0)),
  );
  return {
    group,
    height: 0.75,
    tick(t, view) {
      platter.rotation.y = -t * 2.4;
      notes.forEach((note, k) => {
        const life = (t * 0.34 + k / 3) % 1;
        note.position.set(
          -0.08 + Math.sin(life * 5 + k * 2) * 0.3,
          0.35 + life * 1.1,
          Math.cos(life * 4 + k) * 0.1,
        );
        (note.material as SpriteMaterial).opacity =
          t === 0 ? (k ? 0 : 1) : Math.sin(life * Math.PI);
      });
      cat.tick?.(t, view);
    },
  };
}

// I ③: the tool shop: striped awning, a sign, a lit window and a toolbox.
export function toolShop(kit: Kit): Model {
  const { c } = kit;
  const group = new Group();
  put(
    group,
    kit.solid(rounded(0.86, 0.5, 0.56, 0.04), kit.paint(c.paper), 1.3),
    0,
    0.25,
    -0.04,
  );
  put(
    group,
    kit.solid(rounded(0.92, 0.06, 0.62, 0.03), kit.paint(c.woodDark), 1.2),
    0,
    0.53,
    -0.04,
  );
  for (let k = 0; k < 6; k++) {
    const stripe = put(
      group,
      kit.solid(
        rounded(0.15, 0.03, 0.3, 0.012),
        kit.paint(k % 2 ? c.white : c.coral),
        null,
      ),
      -0.375 + k * 0.15,
      0.42,
      0.33,
    );
    stripe.rotation.x = 0.5;
    const scallop = new SphereGeometry(
      0.075,
      12,
      6,
      0,
      Math.PI * 2,
      Math.PI / 2,
      Math.PI / 2,
    );
    put(
      group,
      kit.solid(scallop, kit.paint(k % 2 ? c.white : c.coral), null),
      -0.375 + k * 0.15,
      0.36,
      0.46,
    );
  }
  put(
    group,
    kit.solid(rounded(0.56, 0.16, 0.04, 0.02), kit.paint(c.yellow), 1.1),
    0,
    0.68,
    0.22,
  );
  const sign = new Mesh(
    new PlaneGeometry(0.5, 0.12),
    new MeshBasicMaterial({
      map: kit.words("TOOLS", 250, 60, kit.hex.ink, kit.hex.yellow),
    }),
  );
  put(group, sign, 0, 0.68, 0.243);
  put(
    group,
    new Mesh(rounded(0.36, 0.2, 0.03, 0.015), kit.lamp(c.sky, c.yellow)),
    0.16,
    0.2,
    0.24,
  );
  put(group, kit.halo(c.yellow, 0.9, 0, 0.85), 0.16, 0.2, 0.32);
  put(
    group,
    kit.solid(rounded(0.16, 0.28, 0.03, 0.02), kit.paint(c.woodDark), 1),
    -0.22,
    0.14,
    0.24,
  );
  put(
    group,
    kit.solid(rounded(0.36, 0.04, 0.2, 0.015), kit.paint(c.wood), 1),
    -0.18,
    0.18,
    0.46,
  );
  put(
    group,
    kit.solid(rounded(0.18, 0.08, 0.1, 0.02), kit.paint(c.coral), 1),
    -0.18,
    0.24,
    0.46,
  );
  put(
    group,
    kit.solid(
      new TorusGeometry(0.04, 0.008, 4, 10, Math.PI),
      kit.paint(c.ink),
      null,
    ),
    -0.18,
    0.28,
    0.46,
  );
  return { group, height: 0.9 };
}

// I ④: the last mile, a five-line staff road leaving for the horizon with
// written songs drifting along it, behind a 「MILE 0」 arch.
export function staffRoad(kit: Kit, lift: number): Model {
  const { c } = kit;
  const group = new Group();
  const length = 36;
  kit.staff.repeat.set(1, length / 2.6);
  const strip = new Mesh(
    new PlaneGeometry(1.15, length),
    kit.textured(kit.staff, c.white),
  );
  strip.rotation.x = -Math.PI / 2;
  put(group, strip, 0, -lift + 0.035, -length / 2 - 0.3);
  const arch = put(group, new Group(), 0, 0, -0.1);
  for (const side of [-1, 1])
    put(
      arch,
      kit.solid(rounded(0.07, 0.62, 0.07, 0.02), kit.paint(c.ink), 1),
      side * 0.52,
      0.31,
      0,
    );
  put(
    arch,
    kit.solid(rounded(1.2, 0.18, 0.06, 0.03), kit.paint(c.yellow), 1.2),
    0,
    0.64,
    0,
  );
  const mile = new Mesh(
    new PlaneGeometry(1.1, 0.15),
    new MeshBasicMaterial({
      map: kit.words("MILE 0", 440, 60, kit.hex.ink, kit.hex.yellow),
    }),
  );
  put(arch, mile, 0, 0.64, 0.032);
  const lamps = kit.lamp(c.steel, c.yellow);
  for (let k = 0; k < 6; k++) {
    const z = -1.6 - k * 2.6;
    for (const side of [-1, 1]) {
      put(
        group,
        kit.solid(disc(0.02, 0.5, 6), kit.paint(c.ink), null),
        side * 0.68,
        -lift + 0.25,
        z,
      );
      put(
        group,
        new Mesh(ball(0.05, 10, 8), lamps),
        side * 0.68,
        -lift + 0.52,
        z,
      );
      put(group, kit.halo(c.yellow, 0.7, 0, 0.8), side * 0.68, -lift + 0.52, z);
    }
  }
  const songs = Array.from({ length: 8 }, () =>
    live(put(group, kit.icon("note", 0.42), 0, 0, 0)),
  );
  return {
    group,
    height: 0.75,
    tick(t) {
      songs.forEach((sprite, k) => {
        const along = ((t * 0.09 + k / songs.length) % 1) * length;
        sprite.position.set(
          Math.sin(along * 0.9 + k) * 0.22,
          -lift + 0.4 + Math.sin(t * 2 + k) * 0.06,
          -0.6 - along,
        );
        (sprite.material as SpriteMaterial).opacity =
          Math.min(1, along / 1.5) * (1 - along / length);
      });
    },
  };
}

// 你 ①: the visitor's island: a signpost for 「你的故事」 and a lion cub
// waving hello from the dock.
export function storySign(kit: Kit): Model {
  const { c } = kit;
  const group = new Group();
  put(
    group,
    kit.solid(rounded(0.07, 0.95, 0.07, 0.02), kit.paint(c.woodDark), 1.1),
    -0.1,
    0.47,
    -0.1,
  );
  const board = put(group, new Group(), -0.1, 0.86, -0.06);
  board.rotation.y = 0.12;
  put(
    board,
    kit.solid(rounded(0.92, 0.34, 0.05, 0.03), kit.paint(c.wood), 1.3),
    0,
    0,
    0,
  );
  const words = new Mesh(
    new PlaneGeometry(0.84, 0.27),
    new MeshBasicMaterial({
      map: kit.words("你的故事", 256, 84, kit.hex.ink, kit.hex.paper),
    }),
  );
  put(board, words, 0, 0, 0.027);
  for (const [x, z, color] of [
    [0.3, 0.2, c.coral],
    [0.4, 0.05, c.yellow],
    [-0.45, 0.25, c.white],
    [0.15, 0.35, c.yellow],
  ] as const) {
    put(
      group,
      kit.solid(ball(0.05, 8, 6), kit.paint(c.leaf), null),
      x,
      0.03,
      z,
    );
    put(
      group,
      kit.solid(ball(0.032, 8, 6), kit.paint(color), null),
      x,
      0.08,
      z,
    );
  }
  const host = lionCub(kit);
  put(group, host.group, 0.42, 0, 0.22);
  host.group.rotation.y = -0.35;
  return {
    group,
    height: 1.15,
    tick(t, view) {
      host.tick?.(t, view);
    },
  };
}

// --- Plants and stones ---------------------------------------------------------------

// Tree and rock geometry for instancing, all standing on y = 0.
export function flora() {
  const crown = [
    [0, 0.42, 0, 0.22],
    [-0.13, 0.36, 0.06, 0.15],
    [0.13, 0.37, -0.04, 0.16],
    [0.03, 0.55, -0.02, 0.14],
  ] as const;
  const round = crown.map(([x, y, z, r]) => ball(r, 14, 10).translate(x, y, z));
  const pine = [
    [0.26, 0.3, 0.28],
    [0.2, 0.26, 0.47],
    [0.13, 0.22, 0.63],
  ].map(([r, h, y]) => new ConeGeometry(r, h, 10).translate(0, y, 0));
  const trunk = new CylinderGeometry(0.035, 0.05, 0.3, 7).translate(0, 0.15, 0);
  const palmTrunk = tube(
    [
      [0, 0, 0],
      [0.04, 0.25, 0],
      [0.12, 0.5, 0],
      [0.22, 0.68, 0],
    ],
    0.03,
  );
  const fronds = Array.from({ length: 6 }, (_, k) => {
    const a = (k / 6) * Math.PI * 2;
    const leaf = slab(
      [
        [0, 0.04],
        [0.2, 0.05],
        [0.36, -0.02],
        [0.2, -0.04],
        [0, -0.04],
      ],
      0.012,
    );
    leaf.rotateZ(-0.45);
    leaf.rotateY(a);
    return leaf.translate(0.22, 0.7, 0);
  });
  const rock = (seed: number) => {
    const geometry = ball(0.1, 6, 5);
    const position = geometry.getAttribute("position");
    for (let k = 0; k < position.count; k++) {
      const n = Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453;
      const jitter = 0.78 + (n - Math.floor(n)) * 0.42;
      position.setXYZ(
        k,
        position.getX(k) * jitter,
        position.getY(k) * jitter * 0.7,
        position.getZ(k) * jitter,
      );
    }
    geometry.computeVertexNormals();
    return geometry;
  };
  return { round, pine, trunk, palmTrunk, fronds, rock: rock(3) };
}
