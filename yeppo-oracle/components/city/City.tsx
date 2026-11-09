"use client";

// The home: a small cartoon city block at night, floating in the dark, drawn live in 3D (sharp at any screen size).
// Low-poly, rounded, toon-shaded with dark outlines, neon signs, chunky windows, flying cars, sparkles in the air.
// Each building is a page: the scanner tower with the yeppo sign (the extension), the dish (radar), the vault (record),
// the kiosk (the key); the casino with the red 100X sign is the rug. Drag to turn round it, click a building to go in.
// The loader is the yeppo sign: a dead neon tube that lights as the city loads; then the camera pulls back from it.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BufferGeometry } from "three";
type G = BufferGeometry;

type Place = { id: string; n: string; t: string; v: string; href: string; tone?: "red" };
const PLACES: Place[] = [
  { id: "tower", n: "01", t: "Scanner", v: "the extension ↗", href: "/extension" },
  { id: "dish", n: "02", t: "Radar", v: "wallets moving together ↗", href: "/radar" },
  { id: "vault", n: "03", t: "Record", v: "every call, kept ↗", href: "/record" },
  { id: "kiosk", n: "04", t: "Key", v: "0.2 sol · 30 days ↗", href: "/pricing" },
  { id: "casino", n: "!!", t: "Rug", v: "looks great. it isn't.", href: "/risk", tone: "red" },
];
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeIO = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export default function City() {
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const tagEls = useRef<(HTMLAnchorElement | null)[]>([]);
  const [load, setLoad] = useState(0);
  const [phase, setPhase] = useState<"load" | "on" | "live">("load");
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let alive = true;
    let stop = () => {};
    (async () => {
      const THREE = await import("three");
      setLoad(0.3);
      const { RoundedBoxGeometry } = await import("three/examples/jsm/geometries/RoundedBoxGeometry.js");
      const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js");
      const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js");
      const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");
      const { OutputPass } = await import("three/examples/jsm/postprocessing/OutputPass.js");
      setLoad(0.6);
      if (!alive) return;
      type Obj = InstanceType<typeof THREE.Object3D>;
      type V3 = InstanceType<typeof THREE.Vector3>;
      const small = innerWidth < 760;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 600);
      let seed = 11;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

      // ---------- the cartoon look: three-step toon shading, dark outlines ----------
      const steps = new Uint8Array([90, 170, 255]);
      const ramp = new THREE.DataTexture(steps, 3, 1, THREE.RedFormat);
      ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
      ramp.needsUpdate = true;
      const toonCache = new Map<number, InstanceType<typeof THREE.MeshToonMaterial>>();
      const toon = (hex: number) => {
        if (!toonCache.has(hex)) toonCache.set(hex, new THREE.MeshToonMaterial({ color: hex, gradientMap: ramp }));
        return toonCache.get(hex)!;
      };
      const ink = new THREE.MeshBasicMaterial({ color: 0x120c26, side: THREE.BackSide });
      const glow = (hex: number, k = 2.2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false });
      const world = new THREE.Group();
      scene.add(world);
      // a mesh with its outline (an inverted shell, a hair larger)
      const solid = (geo: G, hex: number, parent: Obj = world, outline = 0.06) => {
        const m = new THREE.Mesh(geo, toon(hex));
        m.castShadow = m.receiveShadow = true;
        if (outline) {
          const o = new THREE.Mesh(geo, ink);
          o.scale.setScalar(1 + outline);
          m.add(o);
        }
        parent.add(m);
        return m;
      };
      const rbox = (w: number, h: number, d: number, r = 0.35) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
      const C = { lav: 0x6c5ce7, blue: 0x4a6cf7, teal: 0x2ec4c9, pink: 0xf064a8, coral: 0xff8a65, plum: 0x8e5cf0, navy: 0x2a2259, road: 0x221b46, walk: 0x41377a, soil1: 0x2f2557, soil2: 0x3b2d68, soil3: 0x4b3a7c };
      const NEON = { cyan: 0x45f5ff, pink: 0xff4fc4, yellow: 0xffd75a, green: 0x5dffae, red: 0xff3b4f, violet: 0xa98bff };

      // ---------- the block: a chunky slab with layers of soil and glowing pipes ----------
      const SIZE = 34, RW = 6;
      solid(rbox(SIZE, 1.2, SIZE, 0.5), C.walk).position.y = -0.6;
      solid(rbox(SIZE - 0.6, 2.2, SIZE - 0.6, 0.6), C.soil1).position.y = -2.2;
      solid(rbox(SIZE - 1.4, 2.0, SIZE - 1.4, 0.6), C.soil2).position.y = -4.1;
      const bottom = solid(rbox(SIZE - 3, 2.4, SIZE - 3, 0.8), C.soil3);
      bottom.position.y = -6.1;
      for (let k = 0; k < 6; k++) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, SIZE - 1.0 - (k % 3) * 0.9, 12), glow(k % 2 ? NEON.cyan : NEON.pink, 1.6));
        pipe.rotation.z = Math.PI / 2;
        if (k % 3 === 0) pipe.rotation.y = Math.PI / 2;
        pipe.position.set(0, -2.4 - (k % 3) * 1.2, (k - 2.5) * 5);
        world.add(pipe);
      }
      // streets
      for (const [w, d] of [[RW, SIZE - 0.4], [SIZE - 0.4, RW]]) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), toon(C.road));
        st.position.y = 0.03;
        st.receiveShadow = true;
        world.add(st);
      }
      const dash = glow(NEON.yellow, 1.3);
      for (let k = -7; k <= 7; k++) {
        if (Math.abs(k) < 1) continue;
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 1.2), dash);
        a.position.set(0, 0.08, k * 2.2);
        const b = a.clone();
        b.rotation.y = Math.PI / 2;
        b.position.set(k * 2.2, 0.08, 0);
        world.add(a, b);
      }

      // ---------- windows: one instanced mesh for every pane in the city ----------
      const MAXW = 2600;
      const winMesh = new THREE.InstancedMesh(rbox(0.55, 0.7, 0.12, 0.08), new THREE.MeshBasicMaterial({ toneMapped: false }), MAXW);
      let nWin = 0;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), wc = new THREE.Color();
      const winGroups: Record<string, number[]> = {};
      const addWindows = (x: number, z: number, w: number, d: number, y0: number, h: number, lit: number, cols: number[], id?: string) => {
        const faces: [number, number, number, number][] = [
          [0, 1, w, d], [0, -1, w, d], [1, 0, d, w], [-1, 0, d, w],
        ];
        for (const [fx, fz, span, depth] of faces) {
          const nx = Math.max(1, Math.floor((span - 0.6) / 1.1)), ny = Math.max(1, Math.floor((h - 1) / 1.4));
          for (let i = 0; i < nx; i++)
            for (let j = 0; j < ny; j++) {
              if (nWin >= MAXW) return;
              const u = (i - (nx - 1) / 2) * 1.1, v = y0 + 0.9 + j * 1.4;
              const px = fx ? x + (fx * depth) / 2 + fx * 0.02 : x + u, pz = fz ? z + (fz * depth) / 2 + fz * 0.02 : z + u;
              q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), fx ? Math.PI / 2 : 0);
              m4.compose(new THREE.Vector3(px, v, pz), q, one);
              winMesh.setMatrixAt(nWin, m4);
              const on = rnd() < lit;
              wc.setHex(on ? cols[Math.floor(rnd() * cols.length)] : 0x1b1538).multiplyScalar(on ? 1.6 : 1);
              winMesh.setColorAt(nWin, wc);
              if (id) (winGroups[id] ??= []).push(nWin);
              nWin++;
            }
        }
      };
      const WARM = [0xffd27a, 0xffe9a8], COOL = [0x8ff7ff, 0xbfe8ff], MIX = [0xffd27a, 0xff9fe0, 0x8ff7ff];

      // ---------- buildings ----------
      const groups: Record<string, InstanceType<typeof THREE.Group>> = {};
      const anchors: Record<string, V3> = {};
      const grp = (id: string) => (groups[id] ??= (() => {
        const g = new THREE.Group();
        world.add(g);
        return g;
      })());
      const building = (x: number, z: number, w: number, d: number, h: number, hex: number, lit: number, cols: number[], id?: string) => {
        const parent = id ? grp(id) : world;
        const b = solid(rbox(w, h, d, 0.45), hex, parent);
        b.position.set(x, h / 2, z);
        // a roof ledge and a little clutter
        const ledge = solid(rbox(w + 0.4, 0.4, d + 0.4, 0.15), C.navy, parent, 0.04);
        ledge.position.set(x, h + 0.1, z);
        for (let k = 0; k < 2; k++) {
          const tank = solid(new THREE.CylinderGeometry(0.45, 0.45, 0.9, 10), 0x9aa3d6, parent, 0.05);
          tank.position.set(x + (rnd() - 0.5) * (w - 1.4), h + 0.75, z + (rnd() - 0.5) * (d - 1.4));
        }
        addWindows(x, z, w, d, 0, h - 0.4, lit, cols, id);
        return b;
      };
      const signTex = (text: string, css: string, w: number, h: number) => {
        const c = document.createElement("canvas");
        c.width = 512;
        c.height = Math.max(64, Math.round((512 * h) / w));
        const g = c.getContext("2d")!;
        g.fillStyle = "#140d2c";
        g.fillRect(0, 0, c.width, c.height);
        g.font = `800 ${Math.round(c.height * 0.62)}px Arial`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.shadowColor = css;
        g.shadowBlur = 22;
        g.fillStyle = css;
        g.fillText(text, c.width / 2, c.height / 2 + 4);
        g.shadowBlur = 0;
        g.fillStyle = "rgba(255,255,255,0.75)";
        g.fillText(text, c.width / 2, c.height / 2 + 4);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        return t;
      };
      // a chunky sign: a dark frame with a lit face
      const sign = (text: string, hex: number, css: string, w: number, h: number, pos: [number, number, number], rotY: number, id?: string) => {
        const parent = id ? grp(id) : world;
        const s = new THREE.Group();
        const frame = solid(rbox(w + 0.3, h + 0.3, 0.3, 0.12), 0x1d1640, s, 0.05);
        frame.position.z = -0.12;
        const face = new THREE.MeshBasicMaterial({ map: signTex(text, css, w, h), color: new THREE.Color(0xffffff).multiplyScalar(1.7), toneMapped: false });
        const fm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), face);
        fm.position.z = 0.04;
        s.add(fm);
        s.position.set(...pos);
        s.rotation.y = rotY;
        parent.add(s);
        const light = new THREE.PointLight(hex, 14, 12, 2);
        light.position.set(pos[0] + Math.sin(rotY) * 1.4, pos[1], pos[2] + Math.cos(rotY) * 1.4);
        world.add(light);
        return { face, light };
      };
      const off = RW / 2 + 0.6;

      // the scanner tower (north-east): a fat round tower, a ring scanning up and down, the yeppo sign
      const TX = off + 5, TZ = -(off + 5);
      const tower = grp("tower");
      const tw = solid(new THREE.CylinderGeometry(2.6, 3.1, 20, 12), C.blue, tower);
      tw.position.set(TX, 10, TZ);
      for (let k = 0; k < 6; k++) {
        const band = solid(new THREE.CylinderGeometry(2.75 + 0.07 * (5 - k), 2.75 + 0.07 * (5 - k), 0.35, 12), C.navy, tower, 0.03);
        band.position.set(TX, 2.5 + k * 3.2, TZ);
      }
      const cap = solid(new THREE.ConeGeometry(2.8, 3, 12), C.plum, tower);
      cap.position.set(TX, 21.5, TZ);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), glow(NEON.red, 3));
      tip.position.set(TX, 23.4, TZ);
      tower.add(tip);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.16, 12, 64), glow(NEON.cyan, 2.6));
      ring.rotation.x = Math.PI / 2;
      tower.add(ring);
      const ySign = sign("yeppo", NEON.cyan, "#45f5ff", 6, 1.8, [TX - 2.2, 14, TZ + 2.4], -Math.PI / 4, "tower");
      anchors.tower = new THREE.Vector3(TX, 24, TZ);
      building(TX - 1, TZ + 8, 6, 4, 8, C.teal, 0.55, WARM);
      building(TX + 6, TZ + 6.5, 3.6, 7, 12, C.lav, 0.45, MIX);

      // the radar building (north-west): a turning dish on the roof
      const DX = -(off + 5), DZ = -(off + 5);
      building(DX, DZ, 7, 6, 10, C.coral, 0.5, WARM, "dish");
      const dish = new THREE.Group();
      const mast = solid(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 8), 0x9aa3d6, dish, 0.05);
      mast.position.y = 1.2;
      const tilt = new THREE.Group();
      const bowl = solid(new THREE.SphereGeometry(2.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3), 0xf1edff, tilt, 0.04);
      bowl.rotation.x = Math.PI;
      bowl.material = new THREE.MeshToonMaterial({ color: 0xf1edff, gradientMap: ramp, side: THREE.DoubleSide });
      const feed = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), glow(NEON.green, 3));
      feed.position.y = -0.6;
      tilt.add(feed);
      tilt.rotation.x = -0.6;
      tilt.position.y = 2.6;
      dish.add(tilt);
      dish.position.set(DX, 10.3, DZ);
      grp("dish").add(dish);
      sign("RADAR", NEON.green, "#5dffae", 4.4, 1.2, [DX, 7.8, DZ + 3.25], 0, "dish");
      anchors.dish = new THREE.Vector3(DX, 16, DZ);
      building(DX + 6, DZ - 3, 4, 5, 15, C.plum, 0.4, COOL);
      building(DX - 1, DZ + 7.5, 7, 3.6, 6, C.pink, 0.5, WARM);

      // the vault (south-west): low and heavy, a round door turning
      const VX = -(off + 5), VZ = off + 5;
      building(VX, VZ, 9, 7, 5, 0x5a5f8a, 0.1, WARM, "vault");
      const door = new THREE.Group();
      const disc = solid(new THREE.CylinderGeometry(1.7, 1.7, 0.4, 24), 0xc9cbe6, door, 0.04);
      disc.rotation.z = Math.PI / 2;
      const hub = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 8, 32), glow(NEON.yellow, 2.4));
      hub.rotation.y = Math.PI / 2;
      hub.position.x = 0.22;
      door.add(hub);
      for (let k = 0; k < 4; k++) {
        const spoke = solid(rbox(0.2, 2, 0.2, 0.08), 0x8f93c4, door, 0.03);
        spoke.position.x = 0.25;
        spoke.rotation.x = (k * Math.PI) / 4;
      }
      door.position.set(VX + 4.6, 2.4, VZ);
      grp("vault").add(door);
      sign("RECORD", NEON.yellow, "#ffd75a", 4.6, 1.1, [VX, 3.9, VZ - 3.7], Math.PI, "vault");
      anchors.vault = new THREE.Vector3(VX, 9, VZ);
      building(VX + 2, VZ - 7.5, 6, 3.6, 12, C.teal, 0.45, MIX);
      building(VX - 5, VZ - 6.5, 3.4, 5, 17, C.blue, 0.4, COOL);

      // the kiosk (south-east): small, a striped awning, the price
      const KX = off + 2.5, KZ = off + 2.4;
      building(KX, KZ, 3.4, 3.4, 3.2, C.pink, 0.6, WARM, "kiosk");
      for (let k = 0; k < 5; k++) {
        const stripe = solid(rbox(0.8, 0.25, 1.8, 0.1), k % 2 ? 0xffffff : NEON.pink, grp("kiosk"), 0.04);
        stripe.position.set(KX - 1.6 + k * 0.8, 3.2, KZ - 2.3);
        stripe.rotation.x = 0.35;
      }
      sign("KEY 0.2 SOL", NEON.pink, "#ff4fc4", 3.6, 0.8, [KX, 4.4, KZ - 1.85], Math.PI, "kiosk");
      anchors.kiosk = new THREE.Vector3(KX, 6.5, KZ);

      // the casino (south-east, behind): the 100X sign that flickers and breaks
      const CX = off + 8.5, CZ = off + 9;
      building(CX, CZ, 6, 6, 9, 0xb83a6b, 0.6, [0xff6b8a, 0xffd27a], "casino");
      const hundred = sign("100X", NEON.red, "#ff3b4f", 4.8, 1.8, [CX, 10.6, CZ - 3.2], Math.PI, "casino");
      anchors.casino = new THREE.Vector3(CX, 14, CZ);
      building(CX - 7, CZ + 1, 4, 6, 6, C.lav, 0.5, WARM);
      winMesh.count = nWin;
      winMesh.instanceMatrix.needsUpdate = true;
      if (winMesh.instanceColor) winMesh.instanceColor.needsUpdate = true;
      world.add(winMesh);

      // round little trees in planters, lamps
      for (const [x, z] of [[RW / 2 + 1, 3], [RW / 2 + 1, 12], [-RW / 2 - 1, -3], [-RW / 2 - 1, 13], [4, -RW / 2 - 1], [-13, RW / 2 + 1]]) {
        const pot = solid(new THREE.CylinderGeometry(0.6, 0.5, 0.6, 10), 0x2a2259, world, 0.05);
        pot.position.set(x, 0.3, z);
        const crown = solid(new THREE.IcosahedronGeometry(0.95, 1), rnd() < 0.5 ? 0x3fd6c2 : 0xf07fc7, world, 0.06);
        crown.position.set(x, 1.6, z);
      }
      for (const [x, z] of [[RW / 2 + 0.7, -7], [-RW / 2 - 0.7, 7], [9, RW / 2 + 0.7], [-9, -RW / 2 - 0.7]]) {
        const pole = solid(new THREE.CylinderGeometry(0.08, 0.1, 4, 8), 0x2a2259, world, 0.05);
        pole.position.set(x, 2, z);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), glow(0xffe0a8, 2.6));
        bulb.position.set(x, 4.1, z);
        world.add(bulb);
        const pl = new THREE.PointLight(0xffc98a, 8, 9, 2);
        pl.position.set(x, 3.9, z);
        world.add(pl);
      }

      // flying cars: rounded capsules with a glow underneath
      const cars = Array.from({ length: small ? 5 : 8 }, (_, i) => {
        const c = new THREE.Group();
        solid(rbox(1.8, 0.7, 0.9, 0.3), [C.pink, C.teal, 0xffd75a, C.coral][i % 4], c, 0.07);
        const wind = new THREE.Mesh(rbox(0.7, 0.4, 0.8, 0.15), glow(0x9fe9ff, 1.2));
        wind.position.set(0.2, 0.45, 0);
        c.add(wind);
        const under = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.6), glow(i % 2 ? NEON.cyan : NEON.pink, 3));
        under.position.y = -0.4;
        c.add(under);
        world.add(c);
        return { c, r: 10 + (i % 4) * 3.2, h: 6 + (i % 4) * 2, sp: (0.18 + (i % 3) * 0.05) * (i % 2 ? 1 : -1), ph: i * 1.7 };
      });

      // sparkles drifting in the air
      const SP = small ? 160 : 320;
      const spp = new Float32Array(SP * 3);
      for (let i = 0; i < SP; i++) spp.set([(rnd() - 0.5) * 44, rnd() * 26, (rnd() - 0.5) * 44], i * 3);
      const spGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(spp, 3));
      const sparkles = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: new THREE.Color(0xd9c9ff).multiplyScalar(1.6), size: 0.18, toneMapped: false, transparent: true, opacity: 0.8 }));
      world.add(sparkles);

      // light: a cool moon that casts soft shadows, a warm fill, a violet sky
      scene.add(new THREE.HemisphereLight(0x9c8cff, 0x241a4a, 1.1));
      const moon = new THREE.DirectionalLight(0xc6bcff, 1.6);
      moon.position.set(-22, 40, 18);
      moon.castShadow = true;
      moon.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
      Object.assign(moon.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
      moon.shadow.radius = 4;
      moon.shadow.bias = -0.0005;
      scene.add(moon);

      // ---------- post ----------
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.82));
      composer.addPass(new OutputPass());
      const fit = () => {
        const w = el.clientWidth, h = el.clientHeight;
        renderer.setSize(w, h, false);
        composer.setSize(w, h);
        camera.aspect = w / h;
        camera.fov = w / h < 0.8 ? 46 : 30;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(fit);
      ro.observe(el);
      fit();
      setLoad(1);

      // ---------- camera: orbit with drag; the intro pulls back from the sign ----------
      const orbit = { yaw: -0.75, pitch: 0.55, dist: small ? 112 : 88, tyaw: -0.75, tpitch: 0.55, tdist: small ? 112 : 88 };
      const look = new THREE.Vector3(0, 4.5, 0);
      let drag: { x: number; y: number } | null = null, moved = 0, idle = 0;
      const ray = new THREE.Raycaster();
      const ndc = new THREE.Vector2(9, 9);
      const onDown = (e: PointerEvent) => {
        drag = { x: e.clientX, y: e.clientY };
        moved = 0;
      };
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        moved += Math.abs(dx) + Math.abs(dy);
        orbit.tyaw -= dx * 0.005;
        orbit.tpitch = clamp(orbit.tpitch + dy * 0.003, 0.3, 1.2);
        drag = { x: e.clientX, y: e.clientY };
        idle = 0;
      };
      const onUp = () => void (drag = null);
      const onWheel = (e: WheelEvent) => {
        orbit.tdist = clamp(orbit.tdist + e.deltaY * 0.04, 48, 130);
        idle = 0;
      };
      let hovered: string | null = null, flying: { id: string; t0: number; from: V3; fromLook: V3 } | null = null;
      const onClick = () => {
        if (moved > 6 || !hovered || flying) return;
        flying = { id: hovered, t0: performance.now(), from: camera.position.clone(), fromLook: look.clone() };
      };
      el.addEventListener("pointerdown", onDown);
      addEventListener("pointermove", onMove);
      addEventListener("pointerup", onUp);
      el.addEventListener("wheel", onWheel, { passive: true });
      el.addEventListener("click", onClick);

      const t0 = performance.now();
      const INTRO_ON = 1200, INTRO_PULL = 3000;
      setPhase("on");
      const tmp = new THREE.Vector3(), scr = new THREE.Vector3();
      const signCam = new THREE.Vector3(TX - 12, 15, TZ + 12);
      const signAt = new THREE.Vector3(TX - 2.2, 14, TZ + 2.4);
      const baseWin = new Map<number, number>();
      let raf = 0, last = performance.now(), lastHover: string | null = null;
      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const t = now / 1000, since = now - t0;
        idle += dt;
        if (!drag && idle > 4 && !flying) orbit.tyaw += dt * 0.05;
        orbit.yaw += (orbit.tyaw - orbit.yaw) * Math.min(1, dt * 4);
        orbit.pitch += (orbit.tpitch - orbit.pitch) * Math.min(1, dt * 4);
        orbit.dist += (orbit.tdist - orbit.dist) * Math.min(1, dt * 4);
        const orbitPos = new THREE.Vector3(Math.sin(orbit.yaw) * Math.cos(orbit.pitch), Math.sin(orbit.pitch), Math.cos(orbit.yaw) * Math.cos(orbit.pitch)).multiplyScalar(orbit.dist).add(look);
        const intro = since < INTRO_ON + INTRO_PULL;
        if (intro) {
          const k = easeIO(clamp((since - INTRO_ON) / INTRO_PULL));
          camera.position.copy(signCam).lerp(orbitPos, k);
          camera.lookAt(tmp.copy(signAt).lerp(look, k));
        } else if (flying) {
          const k = easeIO(clamp((now - flying.t0) / 1000));
          const a = anchors[flying.id];
          const dest = a.clone().add(new THREE.Vector3(Math.sin(orbit.yaw), 0.4, Math.cos(orbit.yaw)).normalize().multiplyScalar(16));
          camera.position.copy(flying.from).lerp(dest, k);
          camera.lookAt(tmp.copy(flying.fromLook).lerp(a, k));
          if (k >= 1) {
            const href = PLACES.find((p) => p.id === flying!.id)!.href;
            flying = null;
            router.push(href);
          }
        } else {
          camera.position.copy(orbitPos);
          camera.lookAt(look);
        }
        if (!intro && phaseRef !== "live") {
          phaseRef = "live";
          setPhase("live");
        }

        // signs: the yeppo tube flickers on, then hums; the 100X glitches
        const on = since < INTRO_ON ? (Math.sin(since * 0.08) > 0.1 || since > INTRO_ON * 0.75 ? 1 : 0.1) : 0.94 + 0.06 * Math.sin(t * 40) * Math.sin(t * 2.7);
        ySign.face.color.setScalar(1.7 * on);
        ySign.light.intensity = 14 * on;
        const gl = Math.sin(t * 13) * Math.sin(t * 2.3) > 0.55 || (t % 5 > 4.6 && t % 5 < 4.78) ? 0.1 : 1;
        hundred.face.color.setScalar(1.9 * gl);
        hundred.light.intensity = 18 * gl;
        ring.position.set(TX, 1 + (Math.sin(t * 0.9) * 0.5 + 0.5) * 18, TZ);
        tip.visible = Math.floor(t * 1.5) % 2 === 0;
        dish.rotation.y = t * 0.6;
        door.rotation.x = t * 0.5;
        cars.forEach((c) => {
          const a = t * c.sp + c.ph;
          c.c.position.set(Math.cos(a) * c.r, c.h + Math.sin(a * 2) * 0.5, Math.sin(a) * c.r);
          c.c.rotation.y = -a + (c.sp > 0 ? -Math.PI / 2 : Math.PI / 2);
          c.c.rotation.z = Math.sin(a * 2) * 0.08;
        });
        for (let i = 0; i < SP; i++) spp[i * 3 + 1] = (spp[i * 3 + 1] + dt * 0.4) % 26;
        spGeo.attributes.position.needsUpdate = true;

        // hover: which building is under the pointer; it bobs up and its windows brighten
        if (!intro && !flying) {
          ray.setFromCamera(ndc, camera);
          let hit: string | null = null;
          for (const [id, g] of Object.entries(groups))
            if (ray.intersectObject(g as Obj, true).length) {
              hit = id;
              break;
            }
          if (hit !== hovered) {
            hovered = hit;
            setHover(hit);
            el.style.cursor = hit ? "pointer" : "grab";
          }
        }
        for (const [id, g] of Object.entries(groups)) {
          const want = hovered === id ? 0.6 : 0;
          g.position.y += (want - g.position.y) * Math.min(1, dt * 8);
        }
        if (hovered !== lastHover) {
          for (const id of [lastHover, hovered]) {
            if (!id) continue;
            for (const i of winGroups[id] ?? []) {
              winMesh.getColorAt(i, wc);
              if (!baseWin.has(i)) baseWin.set(i, wc.getHex());
              wc.setHex(baseWin.get(i)!).multiplyScalar(id === hovered ? 2.4 : 1);
              winMesh.setColorAt(i, wc);
            }
          }
          if (winMesh.instanceColor) winMesh.instanceColor.needsUpdate = true;
          lastHover = hovered;
        }
        PLACES.forEach((p, i) => {
          const node = tagEls.current[i];
          if (!node) return;
          scr.copy(anchors[p.id]).add(new THREE.Vector3(0, groups[p.id]?.position.y ?? 0, 0)).project(camera);
          const x = (scr.x * 0.5 + 0.5) * el.clientWidth, y = (-scr.y * 0.5 + 0.5) * el.clientHeight;
          const vis = !intro && scr.z < 1 ? 1 : 0;
          node.style.opacity = String(vis);
          node.style.visibility = vis ? "visible" : "hidden";
          node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
          node.dataset.side = x > el.clientWidth * 0.6 ? "l" : "r";
        });
        composer.render();
        raf = requestAnimationFrame(tick);
      };
      let phaseRef = "on";
      raf = requestAnimationFrame(tick);
      stop = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        el.removeEventListener("pointerdown", onDown);
        removeEventListener("pointermove", onMove);
        removeEventListener("pointerup", onUp);
        el.removeEventListener("wheel", onWheel);
        el.removeEventListener("click", onClick);
        composer.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();
    return () => {
      alive = false;
      stop();
    };
  }, [router]);

  return (
    <section className="cy">
      <h1 className="w3-sr">yeppo: rug checks for pump.fun coins, in the browser</h1>
      <div ref={host} className="cy-canvas" />
      {phase === "load" && (
        <div className="cy-load" aria-hidden>
          <svg viewBox="0 0 320 110">
            <text x="160" y="78" textAnchor="middle" className="cy-tube" style={{ strokeDashoffset: 900 - 900 * load }}>
              yeppo
            </text>
          </svg>
          <span>{String(Math.round(load * 100)).padStart(3, "0")}</span>
        </div>
      )}
      {PLACES.map((p, i) => (
        <a
          key={p.id}
          href={p.href}
          className={`w3-tag go ${p.tone ?? ""} ${hover === p.id ? "on" : ""}`}
          ref={(n) => void (tagEls.current[i] = n)}
          onClick={(e) => {
            e.preventDefault();
            router.push(p.href);
          }}
        >
          <i className="w3-dot" />
          <i className="w3-lead" />
          <span className="w3-box">
            <em>{p.n}</em>
            <b>{p.t}</b>
            <span>{p.v}</span>
          </span>
        </a>
      ))}
      <div className={`cy-hud ${phase === "live" ? "on" : ""}`} aria-hidden>
        <span className="cy-mark">yeppo</span>
        <span className="cy-k">rug checks · pump.fun</span>
        <span className="cy-hint">drag to look round · click a building</span>
      </div>
    </section>
  );
}
