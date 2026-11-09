"use client";

// The home: a small moon you turn with the mouse, drawn live in 3D (sharp at any screen size). Memecoins want to go
// "to the moon", so the moon is where they launch: rockets rise from a pad after passing a scanner gate that lights
// green, amber or red; some make it, some blow up (the rugs). Each place on the moon is a page: the scanner gate (the
// extension), the radio telescope (radar), the mission board (record), the fuel station (the key), the crash crater
// (what a rug looks like). Models: Kenney Space Kit and Planets (CC0). Drag to turn the moon, click a place to go in.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BufferGeometry } from "three";

type Place = { id: string; n: string; t: string; v: string; href: string; tone?: "red" | "green" };
const PLACES: Place[] = [
  { id: "launch", n: "01", t: "Scanner gate", v: "every coin checked before launch ↗", href: "/extension" },
  { id: "radar", n: "02", t: "Radio telescope", v: "hears wallets moving together ↗", href: "/radar" },
  { id: "board", n: "03", t: "Mission board", v: "every call, kept ↗", href: "/record" },
  { id: "fuel", n: "04", t: "Fuel", v: "the key · 0.2 sol / 30 days ↗", href: "/pricing" },
  { id: "crash", n: "!!", t: "Rug", v: "it launched. it didn't land.", href: "/risk", tone: "red" },
];
const MODELS = [
  "rocket_finsA", "rocket_fuelA", "rocket_sidesA", "rocket_topA", "satelliteDish_large", "satelliteDish_detailed", "satelliteDish",
  "machine_wireless", "gate_complex", "platform_large", "supports_high", "hangar_largeA", "hangar_roundGlass", "machine_generatorLarge",
  "machine_barrelLarge", "barrels", "rover", "astronautA", "astronautB", "craterLarge", "crater", "rock_crystalsLargeA", "rock_crystals",
  "rocks_smallA", "rock_largeA", "meteor_detailed", "structure_detailed", "corridor_detailed",
];
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeIO = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export default function Moon() {
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const tagEls = useRef<(HTMLAnchorElement | null)[]>([]);
  const [load, setLoad] = useState(0);
  const [phase, setPhase] = useState<"load" | "live">("load");
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let alive = true;
    let stop = () => {};
    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js");
      const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js");
      const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");
      const { OutputPass } = await import("three/examples/jsm/postprocessing/OutputPass.js");
      if (!alive) return;
      type Obj = InstanceType<typeof THREE.Object3D>;
      type V3 = InstanceType<typeof THREE.Vector3>;
      // ---------- load the models ----------
      const loader = new GLTFLoader();
      const lib: Record<string, Obj> = {};
      let done = 0;
      await Promise.all(
        MODELS.map(
          (n) =>
            new Promise<void>((res) =>
              loader.load(
                `/moon/${n}.glb`,
                (g) => {
                  g.scene.traverse((o) => {
                    const m = o as InstanceType<typeof THREE.Mesh>;
                    if (m.isMesh) {
                      m.castShadow = m.receiveShadow = true;
                      const mat = m.material as InstanceType<typeof THREE.MeshStandardMaterial>;
                      if (mat && "roughness" in mat) {
                        mat.roughness = Math.max(0.45, mat.roughness ?? 0.6);
                        if (/crystal/i.test(mat.name)) {
                          mat.emissive = new THREE.Color(0x9a6bff);
                          mat.emissiveIntensity = 1.6;
                        }
                      }
                    }
                  });
                  lib[n] = g.scene;
                  setLoad(++done / MODELS.length);
                  res();
                },
                undefined,
                () => res(),
              ),
            ),
        ),
      );
      if (!alive) return;
      const small = innerWidth < 760;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.3, 2000);
      let seed = 5;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const glow = (hex: number, k = 2.4) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false });

      // ---------- the moon: a low-poly sphere with craters, flat where the bases stand ----------
      const R = 6;
      const ZONES: Record<string, V3> = {
        launch: new THREE.Vector3(0, 0.94, 0.34).normalize(),
        radar: new THREE.Vector3(-0.96, 0.12, 0.25).normalize(),
        board: new THREE.Vector3(0.96, 0.12, 0.25).normalize(),
        fuel: new THREE.Vector3(0.1, -0.42, 0.9).normalize(),
        crash: new THREE.Vector3(-0.05, -0.15, -0.99).normalize(),
      };
      // the real Moon (NASA LRO colour and elevation maps, public domain), tinted to the scene's violet
      const texL = new THREE.TextureLoader();
      const moonCol = texL.load("/moon/moon_color.jpg");
      moonCol.colorSpace = THREE.SRGBColorSpace;
      moonCol.anisotropy = 8;
      const moonH = texL.load("/moon/moon_height.jpg");
      const geo = new THREE.SphereGeometry(R, small ? 128 : 256, small ? 64 : 128);
      const moonMat = new THREE.MeshStandardMaterial({
        map: moonCol, color: 0xe6defc, bumpMap: moonH, bumpScale: 2.2,
        displacementMap: moonH, displacementScale: 0.16, displacementBias: -0.1, roughness: 0.95, metalness: 0,
      });
      const moon = new THREE.Mesh(geo, moonMat);
      moon.receiveShadow = moon.castShadow = true;
      const world = new THREE.Group();
      world.add(moon);
      scene.add(world);
      // a thin glow round the rim
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.1, 64, 32),
        new THREE.ShaderMaterial({
          uniforms: { c: { value: new THREE.Color(0x8a7dff) } },
          vertexShader: "varying vec3 n; varying vec3 p; void main(){ n = normalize(normalMatrix * normal); p = (modelViewMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * vec4(p,1.0); }",
          fragmentShader: "uniform vec3 c; varying vec3 n; varying vec3 p; void main(){ float f = pow(1.0 - abs(dot(n, normalize(-p))), 3.0); gl_FragColor = vec4(c * f * 1.0, f * 0.8); }",
          transparent: true,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          depthWrite: false,
        }),
      );
      world.add(halo);

      // ---------- placing things on the surface ----------
      const up = new THREE.Vector3(0, 1, 0);
      const frame = (dir: V3, yaw = 0) => {
        const g = new THREE.Group();
        g.position.copy(dir).multiplyScalar(R - 0.02);
        g.quaternion.setFromUnitVectors(up, dir);
        g.rotateY(yaw);
        g.scale.setScalar(0.5);
        world.add(g);
        return g;
      };
      const pad = (g: Obj, hex: number, radius = 3.4) => {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.03, 0.9, 40), new THREE.MeshStandardMaterial({ color: 0x3a3650, roughness: 0.7, metalness: 0.4, flatShading: true }));
        base.position.y = -0.34;
        base.receiveShadow = base.castShadow = true;
        g.add(base);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(radius - 0.25, radius - 0.25, 0.05, 48), new THREE.MeshStandardMaterial({ color: 0x4a4566, roughness: 0.55, metalness: 0.5 }));
        top.position.y = 0.11;
        top.receiveShadow = true;
        g.add(top);
        const rimL = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.08, 0.045, 8, 96), glow(hex, 1.5));
        rimL.rotation.x = Math.PI / 2;
        rimL.position.y = 0.12;
        g.add(rimL);
        return rimL;
      };
      const put = (g: Obj, name: string, x: number, z: number, s = 1, yaw = 0, y = 0) => {
        const src = lib[name];
        if (!src) return null;
        const o = src.clone(true);
        o.position.set(x, y, z);
        o.scale.setScalar(s);
        o.rotation.y = yaw;
        g.add(o);
        return o;
      };
      const groups: Record<string, InstanceType<typeof THREE.Group>> = {};
      const anchors: Record<string, V3> = {};
      const signTex = (lines: string[], css: string, w = 512, h = 256, size = 54) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d")!;
        g.fillStyle = "#0b0918";
        g.fillRect(0, 0, w, h);
        g.font = `700 ${size}px monospace`;
        g.textAlign = "center";
        g.shadowColor = css;
        g.shadowBlur = 18;
        g.fillStyle = css;
        lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.2 + size * 0.35));
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        return t;
      };
      const panel = (g: Obj, tex: InstanceType<typeof THREE.Texture>, w: number, h: number, x: number, y: number, z: number, yaw = 0) => {
        const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0xffffff).multiplyScalar(1.6), toneMapped: false });
        const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
        p.position.set(x, y, z);
        p.rotation.y = yaw;
        g.add(p);
        return m;
      };

      // ---------- the hero objects, built by hand so each one reads at a glance ----------
      const matCache = new Map<string, InstanceType<typeof THREE.MeshStandardMaterial>>();
      const M = (hex: number, rough = 0.55, metal = 0.25) => {
        const k = `${hex}-${rough}-${metal}`;
        if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, flatShading: true }));
        return matCache.get(k)!;
      };
      const mk = (geo: BufferGeometry, mat: InstanceType<typeof THREE.Material>, parent: Obj, x = 0, y = 0, z = 0) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.castShadow = m.receiveShadow = true;
        parent.add(m);
        return m;
      };
      const WHITE = 0xe9e6f5, RED = 0xff4d5e, STEEL = 0x5b5f86, DARKS = 0x2c2a44;
      // a proper rocket: engine bell, white body with a purple band and a lit window, red nose and three fins
      const buildRocket = () => {
        const r = new THREE.Group();
        mk(new THREE.CylinderGeometry(0.3, 0.46, 0.45, 16), M(DARKS, 0.4, 0.7), r, 0, 0.25, 0);
        mk(new THREE.CylinderGeometry(0.56, 0.6, 3.0, 20), M(WHITE, 0.45, 0.1), r, 0, 1.95, 0);
        mk(new THREE.CylinderGeometry(0.62, 0.62, 0.28, 20), M(0x7b5cff, 0.4, 0.3), r, 0, 1.15, 0);
        mk(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 20), M(0x7b5cff, 0.4, 0.3), r, 0, 3.3, 0);
        mk(new THREE.ConeGeometry(0.56, 1.35, 20), M(RED, 0.45, 0.15), r, 0, 4.12, 0);
        const win = mk(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16), glow(0x8ff7ff, 2), r, 0, 2.6, 0.55);
        win.rotation.x = Math.PI / 2;
        const fin = new THREE.Shape();
        fin.moveTo(0, 0);
        fin.lineTo(0.75, -0.2);
        fin.lineTo(0.7, 0.5);
        fin.lineTo(0, 1.25);
        fin.closePath();
        const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.1, bevelEnabled: false });
        finGeo.translate(0, 0, -0.05);
        for (let k = 0; k < 3; k++) {
          const f = mk(finGeo, M(RED, 0.45, 0.15), r, 0, 0.45, 0);
          f.rotation.y = (k * Math.PI * 2) / 3;
          f.translateX(0.5);
        }
        return r;
      };

      // 01 · the launch pad: the rocket, its service tower, and the scanner ring it rises through
      const L = (groups.launch = frame(ZONES.launch, 0.2));
      pad(L, 0x8f86ff, 3.4);
      mk(new THREE.CylinderGeometry(1.35, 1.45, 0.3, 24), M(STEEL, 0.6, 0.5), L, 0, 0.25, 0);
      // service tower: two beams, rungs, an arm reaching the rocket, a red light on top
      for (const x of [-2.15, -1.65]) mk(new THREE.BoxGeometry(0.16, 6, 0.16), M(STEEL, 0.5, 0.6), L, x, 3.1, -0.25);
      for (let k = 0; k < 9; k++) mk(new THREE.BoxGeometry(0.62, 0.08, 0.1), M(STEEL, 0.5, 0.6), L, -1.9, 0.6 + k * 0.65, -0.25);
      mk(new THREE.BoxGeometry(1.4, 0.14, 0.3), M(STEEL, 0.5, 0.6), L, -1.15, 4.2, -0.25);
      const towerTip = mk(new THREE.SphereGeometry(0.14, 10, 8), glow(0xff3b4f, 3), L, -1.9, 6.2, -0.25);
      // the scanner: two posts and a ring of light that sweeps up and down the rocket and takes the verdict colour
      for (const x of [-1.45, 1.45]) mk(new THREE.BoxGeometry(0.2, 5.6, 0.2), M(DARKS, 0.4, 0.7), L, x, 2.9, 0.9);
      mk(new THREE.BoxGeometry(3.1, 0.22, 0.22), M(DARKS, 0.4, 0.7), L, 0, 5.75, 0.9);
      const gateLight = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 10, 64), glow(0x5dffae, 3));
      gateLight.rotation.x = Math.PI / 2;
      L.add(gateLight);
      const gatePl = new THREE.PointLight(0x5dffae, 14, 9, 2);
      gatePl.position.set(0, 2.5, 1.6);
      L.add(gatePl);
      anchors.launch = new THREE.Vector3(0, 6.4, 0);
      const scanSheet = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), glow(0x9df7ff, 1));
      scanSheet.visible = false;
      L.add(scanSheet);
      const shock = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc48a).multiplyScalar(2.4), transparent: true, opacity: 0, toneMapped: false, side: THREE.DoubleSide }));
      shock.rotation.x = -Math.PI / 2;
      shock.position.y = 0.45;
      L.add(shock);
      const rocket = buildRocket();
      rocket.position.set(0, 0.4, 0);
      L.add(rocket);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.7, 16, 1, true), glow(0xffa94d, 3));
      flame.rotation.x = Math.PI;
      flame.position.y = -0.85;
      rocket.add(flame);
      const flameLight = new THREE.PointLight(0xff9a3d, 0, 12, 2);
      flameLight.position.y = -0.6;
      rocket.add(flameLight);
      const puffTex = (() => {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const g = c.getContext("2d")!;
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, "rgba(255,255,255,0.9)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
      })();
      const smoke = Array.from({ length: 40 }, () => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: 0xcfc8e6, transparent: true, opacity: 0, depthWrite: false }));
        L.add(s);
        return { s, age: 99, vel: new THREE.Vector3() };
      });
      const blast = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: new THREE.Color(0xff4d3d).multiplyScalar(3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      L.add(blast);
      const debris = Array.from({ length: 14 }, () => {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x8a8aa0, emissive: 0xff5533, emissiveIntensity: 1.5 }));
        d.visible = false;
        L.add(d);
        return { d, vel: new THREE.Vector3() };
      });
      let launchT = 0, launchN = 0, verdict: 0 | 1 | 2 = 0;

      // 02 · the radio telescope: one huge dish on a yoke, two smaller ones beside it
      const RD = (groups.radar = frame(ZONES.radar, 0.4));
      pad(RD, 0x5dffae, 3.4);
      const dishUnit = (s: number) => {
        const root = new THREE.Group();
        mk(new THREE.CylinderGeometry(0.7, 0.95, 0.9, 12), M(STEEL, 0.5, 0.6), root, 0, 0.45, 0);
        const yoke = new THREE.Group();
        yoke.position.y = 1.0;
        root.add(yoke);
        for (const x of [-0.55, 0.55]) mk(new THREE.BoxGeometry(0.16, 1.4, 0.3), M(STEEL, 0.5, 0.6), yoke, x, 0.7, 0);
        const head = new THREE.Group();
        head.position.y = 1.3;
        head.rotation.x = -0.75;
        yoke.add(head);
        const bowl = mk(new THREE.SphereGeometry(2.2, 28, 10, 0, Math.PI * 2, 0, Math.PI / 3.4), new THREE.MeshStandardMaterial({ color: 0xe6e4f4, roughness: 0.35, metalness: 0.4, flatShading: true, side: THREE.DoubleSide }), head, 0, 2.0, 0);
        bowl.rotation.x = Math.PI;
        for (let k = 0; k < 3; k++) {
          const a = (k * Math.PI * 2) / 3;
          const st = mk(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 6), M(STEEL, 0.5, 0.6), head, Math.cos(a) * 0.7, 1.05, Math.sin(a) * 0.7);
          st.lookAt(new THREE.Vector3(0, 2.4, 0).add(head.position));
        }
        mk(new THREE.SphereGeometry(0.2, 12, 8), glow(0x5dffae, 3), head, 0, 0.9, 0);
        root.scale.setScalar(s);
        return { root, yoke };
      };
      const big = dishUnit(1);
      RD.add(big.root);
      const bigDish = big.yoke;
      for (const [x, z, sc] of [[2.3, 1.2, 0.42], [-2.3, 1.2, 0.42]]) {
        const u = dishUnit(sc);
        u.root.position.set(x, 0.15, z);
        u.yoke.rotation.y = x > 0 ? -0.5 : 0.5;
        RD.add(u.root);
      }
      const pulses = Array.from({ length: 3 }, (_, i) => {
        const p = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5dffae).multiplyScalar(2.4), transparent: true, opacity: 0, toneMapped: false }));
        p.rotation.x = Math.PI / 2;
        RD.add(p);
        return { p, ph: i / 3 };
      });
      anchors.radar = new THREE.Vector3(0, 5.4, 0);

      // 03 · the mission board: a big lit screen on two legs, launches scrolling: ▲ made it, ✕ rug
      const BD = (groups.board = frame(ZONES.board, -0.4));
      pad(BD, 0x7dffc0, 3.4);
      for (const x of [-1.7, 1.7]) mk(new THREE.BoxGeometry(0.22, 3.4, 0.22), M(STEEL, 0.5, 0.6), BD, x, 1.7, 0);
      mk(new THREE.BoxGeometry(4.0, 2.6, 0.22), M(DARKS, 0.4, 0.6), BD, 0, 3.6, 0);
      const boardCanvas = document.createElement("canvas");
      boardCanvas.width = 512;
      boardCanvas.height = 1024;
      const bg = boardCanvas.getContext("2d")!;
      bg.fillStyle = "#07060f";
      bg.fillRect(0, 0, 512, 1024);
      bg.font = "700 38px monospace";
      for (let k = 0; k < 26; k++) {
        const ok = rnd() > 0.35;
        bg.fillStyle = ok ? "#5dffae" : "#ff4d5e";
        bg.fillText(`${ok ? "▲" : "✕"} $${["PEPE", "WIF", "MOON", "CAT", "FROG", "SEAL", "BONK", "GIGA"][k % 8]}  ${ok ? `${(1 + rnd() * 9).toFixed(1)}x` : "RUG"}`, 24, 52 + k * 39);
      }
      const boardTex = new THREE.CanvasTexture(boardCanvas);
      boardTex.colorSpace = THREE.SRGBColorSpace;
      boardTex.wrapT = THREE.RepeatWrapping;
      boardTex.repeat.set(1, 0.42);
      const boardMat = panel(BD, boardTex, 3.7, 2.3, 0, 3.6, 0.12);
      const bl = new THREE.PointLight(0x7dffc0, 16, 9, 2);
      bl.position.set(0, 3.4, 2.2);
      BD.add(bl);
      mk(new THREE.BoxGeometry(1.6, 0.9, 0.8), M(STEEL, 0.5, 0.5), BD, 0, 0.6, 1.6);
      mk(new THREE.PlaneGeometry(1.3, 0.5), glow(0x7dffc0, 1.2), BD, 0, 1.06, 1.6).rotation.x = -Math.PI / 2.6;
      anchors.board = new THREE.Vector3(0, 5.3, 0);

      // 04 · the fuel station: a canopy with a pink neon edge, two pumps, a tank, the price
      const FU = (groups.fuel = frame(ZONES.fuel, 0));
      pad(FU, 0xff4fc4, 3.4);
      for (const [x, z] of [[-1.6, -0.9], [1.6, -0.9], [-1.6, 0.9], [1.6, 0.9]]) mk(new THREE.BoxGeometry(0.16, 2.6, 0.16), M(STEEL, 0.5, 0.6), FU, x, 1.3, z);
      mk(new THREE.BoxGeometry(3.8, 0.24, 2.4), M(WHITE, 0.5, 0.2), FU, 0, 2.7, 0);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.82, 0.26, 2.42)), new THREE.LineBasicMaterial({ color: new THREE.Color(0xff4fc4).multiplyScalar(2.4), toneMapped: false }));
      edge.position.set(0, 2.7, 0);
      FU.add(edge);
      for (const x of [-0.7, 0.7]) {
        mk(new THREE.BoxGeometry(0.55, 1.3, 0.45), M(WHITE, 0.5, 0.2), FU, x, 0.8, 0);
        mk(new THREE.PlaneGeometry(0.36, 0.3), glow(0xff4fc4, 1.6), FU, x, 1.15, 0.23);
        mk(new THREE.BoxGeometry(0.1, 0.5, 0.1), M(DARKS), FU, x + 0.32, 0.9, 0.1);
      }
      const tank = mk(new THREE.CylinderGeometry(0.65, 0.65, 2.6, 16), M(0xd4d1e6, 0.45, 0.4), FU, 0, 0.8, -1.9);
      tank.rotation.z = Math.PI / 2;
      const fuelSign = panel(FU, signTex(["KEY", "0.2 SOL"], "#ff4fc4"), 1.9, 0.95, 0, 3.45, 0.05);
      const fl = new THREE.PointLight(0xff4fc4, 14, 9, 2);
      fl.position.set(0, 2.2, 1.6);
      FU.add(fl);
      anchors.fuel = new THREE.Vector3(0, 4.3, 0);

      // !! · the crash crater: a rocket nose-down in the dust, a fin torn off, smoking red
      const CR = (groups.crash = frame(ZONES.crash, 0.6));
      pad(CR, 0xff3b4f, 3.0);
      put(CR, "craterLarge", 0, 0, 3.2, 0, 0.1);
      const wreck = buildRocket();
      wreck.rotation.set(Math.PI - 0.55, 0.4, 0.2);
      wreck.position.set(0.2, 3.1, -0.9);
      CR.add(wreck);
      const redPl = new THREE.PointLight(0xff3b2f, 16, 9, 2);
      redPl.position.set(0, 1.2, 0);
      CR.add(redPl);
      const crashSmoke = Array.from({ length: 16 }, (_, i) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: 0x6b4a5a, transparent: true, opacity: 0, depthWrite: false }));
        CR.add(s);
        return { s, t: i / 16 };
      });
      anchors.crash = new THREE.Vector3(0, 4, 0);
      void towerTip;
      // ---------- life between the places ----------
      // lit paths from place to place, each with a rover driving along it
      const ring = ["launch", "board", "fuel", "crash", "radar"];
      const pathMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9b8cff).multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.8 });
      const routes: InstanceType<typeof THREE.CatmullRomCurve3>[] = [];
      for (let k = 0; k < ring.length; k++) {
        const a = ZONES[ring[k]], b = ZONES[ring[(k + 1) % ring.length]];
        const pts: V3[] = [];
        for (let j = 0; j <= 48; j++) {
          const t2 = j / 48;
          const v2 = new THREE.Vector3().copy(a).lerp(b, t2);
          if (v2.lengthSq() < 1e-4) v2.set(0, 0, 1);
          pts.push(v2.normalize().multiplyScalar(R + 0.06));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        routes.push(curve);
        world.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.028, 6, false), pathMat));
      }
      const rovers = routes.map((curve, i) => {
        const g = new THREE.Group();
        const body = mk(new THREE.BoxGeometry(0.42, 0.2, 0.28), M(WHITE, 0.5, 0.2), g, 0, 0.2, 0);
        void body;
        for (const [x, z] of [[-0.15, 0.16], [0.15, 0.16], [-0.15, -0.16], [0.15, -0.16]]) mk(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), M(DARKS), g, x, 0.08, z).rotation.x = Math.PI / 2;
        mk(new THREE.BoxGeometry(0.06, 0.06, 0.2), glow(0xffe8a8, 3), g, 0.24, 0.22, 0);
        world.add(g);
        return { g, curve, t: i * 0.2, sp: 0.05 + (i % 2) * 0.02 };
      });
      // habitat domes, solar arrays and beacons, set between the places (never on them)
      const between = (a: string, b: string, f: number, side: number) => {
        const d = new THREE.Vector3().copy(ZONES[a]).lerp(ZONES[b], f).normalize();
        const n = new THREE.Vector3().crossVectors(ZONES[a], ZONES[b]).normalize();
        return d.addScaledVector(n, side).normalize();
      };
      const beacons: InstanceType<typeof THREE.Mesh>[] = [];
      ring.forEach((id, k) => {
        const nx = ring[(k + 1) % ring.length];
        // a glass dome with a warm light inside
        const g1 = frame(between(id, nx, 0.35, 0.16), k);
        mk(new THREE.CylinderGeometry(1.25, 1.35, 0.3, 24), M(STEEL, 0.6, 0.5), g1, 0, 0.1, 0);
        const dome = mk(new THREE.SphereGeometry(1.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xbfd8ff, roughness: 0.1, metalness: 0, transmission: 0.6, transparent: true, opacity: 0.55, thickness: 0.3 }), g1, 0, 0.25, 0);
        void dome;
        const warm = new THREE.PointLight(0xffc98a, 6, 4, 2);
        warm.position.set(0, 0.8, 0);
        g1.add(warm);
        mk(new THREE.BoxGeometry(0.5, 0.5, 0.5), M(0x8f86ff, 0.5, 0.3), g1, 0, 0.5, 0);
        // a row of solar panels
        const g2 = frame(between(id, nx, 0.62, -0.17), k * 1.3);
        for (let j = -1; j <= 1; j++) {
          mk(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), M(STEEL), g2, j * 1.1, 0.35, 0);
          const pnl = mk(new THREE.BoxGeometry(1.0, 0.05, 0.7), new THREE.MeshStandardMaterial({ color: 0x2b3f9e, roughness: 0.25, metalness: 0.7, emissive: 0x101a55, emissiveIntensity: 0.6 }), g2, j * 1.1, 0.72, 0);
          pnl.rotation.x = -0.5;
        }
        // a thin mast with a blinking light
        const g3 = frame(between(id, nx, 0.5, 0.02), 0);
        mk(new THREE.CylinderGeometry(0.035, 0.05, 2.2, 6), M(STEEL), g3, 0, 1.1, 0);
        beacons.push(mk(new THREE.SphereGeometry(0.1, 10, 8), glow(k % 2 ? 0xff4d5e : 0x5dffae, 3.5), g3, 0, 2.25, 0));
      });

      // satellites on tilted orbits, each with a blinking light
      const sats = [0, 1, 2].map((i) => {
        const pivot = new THREE.Group();
        pivot.rotation.set(0.4 + i * 0.5, i * 1.9, 0.2 * i);
        scene.add(pivot);
        const sat = new THREE.Group();
        put(sat, i === 1 ? "satelliteDish_detailed" : "satelliteDish", 0, 0, 0.9);
        const blink = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), glow(i === 2 ? 0xff4d5e : 0x5dffae, 4));
        blink.position.y = 0.7;
        sat.add(blink);
        pivot.add(sat);
        const orbit = new THREE.Mesh(new THREE.TorusGeometry(R * (1.55 + i * 0.22), 0.012, 4, 180), new THREE.MeshBasicMaterial({ color: 0x6f64c8, transparent: true, opacity: 0.12 }));
        orbit.rotation.x = Math.PI / 2;
        pivot.add(orbit);
        return { sat, blink, r: R * (1.55 + i * 0.22), sp: 0.12 + i * 0.05, ph: i * 2.1 };
      });
      // a ring of glowing dust round the moon
      const DN = 900;
      const dp = new Float32Array(DN * 3);
      const dA = new Float32Array(DN);
      for (let i = 0; i < DN; i++) {
        dA[i] = rnd() * Math.PI * 2;
        const rr = R * (1.3 + rnd() * 0.7);
        dp.set([Math.cos(dA[i]) * rr, (rnd() - 0.5) * 0.6, Math.sin(dA[i]) * rr], i * 3);
      }
      const dustGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(dp, 3));
      const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: new THREE.Color(0xb9aaff).multiplyScalar(1.4), size: 0.06, transparent: true, opacity: 0.7, toneMapped: false }));
      dust.rotation.set(0.35, 0, 0.25);
      scene.add(dust);
      // shooting stars
      const meteors = Array.from({ length: 3 }, () => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.35, 26, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(2), transparent: true, opacity: 0, toneMapped: false }));
        scene.add(m);
        return { m, t: rnd() * 8, from: new THREE.Vector3(), dir: new THREE.Vector3() };
      });

      // ---------- sky: stars, two far planets, the sun ----------
      const SN = 2600;
      const sp = new Float32Array(SN * 3);
      for (let i = 0; i < SN; i++) {
        const d = new THREE.Vector3().randomDirection().multiplyScalar(600 + rnd() * 300);
        sp.set([d.x, d.y, d.z], i * 3);
      }
      const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: 0xdcd6ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85 }));
      scene.add(stars);
      const tl = new THREE.TextureLoader();
      const planet = (file: string, size: number, p: [number, number, number]) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tl.load(`/moon/${file}`), transparent: true, depthWrite: false }));
        (s.material.map as InstanceType<typeof THREE.Texture>).colorSpace = THREE.SRGBColorSpace;
        s.scale.setScalar(size);
        s.position.set(...p);
        scene.add(s);
        return s;
      };
      planet("planet09.png", 44, [-150, 50, -340]);
      planet("planet05.png", 14, [190, -70, -300]);
      planet("planet07.png", 10, [90, 110, -300]);
      scene.add(new THREE.HemisphereLight(0x8f86ff, 0x1a1530, 0.35));
      const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
      sun.position.set(40, 18, 8);
      sun.castShadow = true;
      sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
      Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 100 });
      sun.shadow.bias = -0.0004;
      sun.shadow.radius = 3;
      scene.add(sun);
      const rim = new THREE.DirectionalLight(0x7b6cff, 1.1);
      rim.position.set(-30, -8, -20);
      scene.add(rim);

      // ---------- post ----------
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.55, 0.78));
      composer.addPass(new OutputPass());
      const fit = () => {
        const w = el.clientWidth, h = el.clientHeight;
        renderer.setSize(w, h, false);
        composer.setSize(w, h);
        camera.aspect = w / h;
        camera.fov = w / h < 0.8 ? 48 : 32;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(fit);
      ro.observe(el);
      fit();

      // ---------- turning the moon ----------
      const spin = { x: 0.35, y: -0.2, tx: 0.35, ty: -0.2 };
      let dist = small ? 44 : 34, tdist = dist;
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
        spin.ty += dx * 0.006;
        spin.tx = clamp(spin.tx + dy * 0.006, -1.2, 1.2);
        drag = { x: e.clientX, y: e.clientY };
        idle = 0;
      };
      const onUp = () => void (drag = null);
      const onWheel = (e: WheelEvent) => {
        tdist = clamp(tdist + e.deltaY * 0.02, 18, 60);
        idle = 0;
      };
      let hovered: string | null = null, flying: { id: string; t0: number; from: { x: number; y: number; d: number } } | null = null;
      // the turn that brings a place to face the camera
      const faceSpin = (dir: V3) => ({ y: -Math.atan2(dir.x, dir.z), x: Math.asin(clamp(dir.y, -1, 1)) * 0.85 });
      const onClick = () => {
        if (moved > 6 || !hovered || flying) return;
        flying = { id: hovered, t0: performance.now(), from: { x: spin.x, y: spin.y, d: dist } };
      };
      el.addEventListener("pointerdown", onDown);
      addEventListener("pointermove", onMove);
      addEventListener("pointerup", onUp);
      el.addEventListener("wheel", onWheel, { passive: true });
      el.addEventListener("click", onClick);

      // ---------- the loop ----------
      const t0 = performance.now();
      const INTRO = 3200;
      setPhase("live");
      const scr = new THREE.Vector3(), tmp = new THREE.Vector3();
      const verdictCol = [0x5dffae, 0xffc44d, 0xff4d5e];
      let raf = 0, last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const t = now / 1000, since = now - t0;
        idle += dt;
        if (!drag && !flying && idle > 3) spin.ty += dt * 0.08;
        if (flying) {
          const k = easeIO(clamp((now - flying.t0) / 1300));
          const f = faceSpin(ZONES[flying.id]);
          let ty = f.y;
          while (ty - flying.from.y > Math.PI) ty -= Math.PI * 2;
          while (ty - flying.from.y < -Math.PI) ty += Math.PI * 2;
          spin.y = spin.ty = flying.from.y + (ty - flying.from.y) * k;
          spin.x = spin.tx = flying.from.x + (f.x - flying.from.x) * k;
          dist = tdist = flying.from.d + (13 - flying.from.d) * k;
          if (k >= 1) {
            const href = PLACES.find((p) => p.id === flying!.id)!.href;
            flying = null;
            router.push(href);
          }
        } else {
          spin.x += (spin.tx - spin.x) * Math.min(1, dt * 5);
          spin.y += (spin.ty - spin.y) * Math.min(1, dt * 5);
          dist += (tdist - dist) * Math.min(1, dt * 4);
        }
        world.rotation.set(spin.x, spin.y, 0, "XYZ");
        // the intro: from far away, the moon swings in out of the dark as the sun comes round
        const ik = easeIO(clamp(since / INTRO));
        camera.position.set(0, 4 * (1 - ik), dist + (1 - ik) * 140);
        camera.lookAt(0, 0, 0);
        sun.intensity = 0.3 + 2.3 * ik;
        world.rotation.y += (1 - ik) * -1.4;

        // launches: the scanner reads the rocket, it lifts off, then it either flies away or blows up
        launchT += dt;
        const CYCLE = 7.5;
        if (launchT > CYCLE) {
          launchT = 0;
          launchN++;
          verdict = (launchN % 3 === 2 ? 2 : launchN % 4 === 1 ? 1 : 0) as 0 | 1 | 2;
        }
        const lt = launchT;
        const vc = lt < 1.6 ? 0x8f86ff : verdictCol[verdict];
        (gateLight.material as InstanceType<typeof THREE.MeshBasicMaterial>).color.setHex(vc).multiplyScalar(lt < 1.6 ? 1.5 + Math.sin(t * 20) : 3);
        gatePl.color.setHex(vc);
        const lift = lt < 2.4 ? 0 : Math.pow(lt - 2.4, 2) * 1.6;
        const boom = verdict === 2 && lt > 4.2;
        rocket.visible = !boom && lt < 6.6;
        rocket.position.y = 0.4 + lift;
        rocket.rotation.z = lt > 2.4 ? Math.sin(t * 30) * 0.01 : 0;
        if (lt < 0.8) rocket.scale.setScalar(Math.max(0.001, easeIO(lt / 0.8)));
        const burning = lt > 2.0 && rocket.visible;
        flame.visible = burning;
        flame.scale.set(1, 0.8 + Math.random() * 0.5, 1);
        flameLight.intensity = burning ? 30 + Math.random() * 10 : 0;
        smoke.forEach((s, i) => {
          if (burning && s.age > 1.8 && Math.random() < 0.25) {
            s.age = 0;
            s.s.position.set(rocket.position.x, Math.max(0.3, rocket.position.y - 0.6), rocket.position.z);
            s.vel.set((Math.random() - 0.5) * 1.6, lift < 1 ? 0.3 : -0.4, (Math.random() - 0.5) * 1.6);
          }
          s.age += dt;
          s.s.position.addScaledVector(s.vel, dt);
          const a = s.age / 1.8;
          s.s.scale.setScalar(0.6 + a * 2.4);
          (s.s.material as InstanceType<typeof THREE.SpriteMaterial>).opacity = a < 1 ? (1 - a) * 0.45 : 0;
          void i;
        });
        const bk = boom ? clamp((lt - 4.2) / 1.2) : 0;
        blast.visible = boom && bk < 1;
        blast.position.set(0, 0.4 + Math.pow(4.2 - 2.4, 2) * 1.6 + 2.5, 0);
        blast.scale.setScalar(1 + bk * 7);
        (blast.material as InstanceType<typeof THREE.SpriteMaterial>).opacity = boom ? (1 - bk) * 0.9 : 0;
        debris.forEach((d, i) => {
          if (boom && lt - dt <= 4.2 + 1e-3) {
            d.d.position.copy(blast.position);
            d.vel.set(Math.cos(i) * 3, 2 + (i % 3), Math.sin(i * 1.7) * 3);
          }
          d.d.visible = boom && bk < 1;
          d.vel.y -= dt * 4;
          d.d.position.addScaledVector(d.vel, dt);
          d.d.rotation.x += dt * 6;
        });

        bigDish.rotation.y = Math.sin(t * 0.25) * 0.8;
        pulses.forEach((p) => {
          const k = (t * 0.45 + p.ph) % 1;
          p.p.position.y = 2.6 + k * 2.4;
          p.p.scale.setScalar(0.5 + k * 1.3);
          (p.p.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = (1 - k) * 0.9;
        });
        boardTex.offset.y = (t * 0.05) % 1;
        fuelSign.color.setScalar(1.6 * (Math.sin(t * 2.2) > -0.85 ? 1 : 0.3));
        redPl.intensity = 10 + Math.sin(t * 9) * 5 + (Math.random() < 0.05 ? 10 : 0);
        crashSmoke.forEach((s) => {
          const k = (t * 0.18 + s.t) % 1;
          s.s.position.set(Math.sin(s.t * 20) * 0.4, 1.2 + k * 4, Math.cos(s.t * 13) * 0.4);
          s.s.scale.setScalar(0.8 + k * 2.5);
          (s.s.material as InstanceType<typeof THREE.SpriteMaterial>).opacity = Math.sin(k * Math.PI) * 0.5;
        });
        stars.rotation.y = t * 0.003;
        rovers.forEach((rv) => {
          rv.t = Number.isFinite(rv.t) ? (rv.t + dt * rv.sp) % 1 : 0;
          const u = clamp(rv.t, 0, 0.985);
          const p0 = rv.curve.getPoint(u), p1 = rv.curve.getPoint(u + 0.01);
          rv.g.position.copy(p0);
          // lookAt works in world space: carry the direction and the up through the moon's turn
          rv.g.up.copy(p0).normalize().applyQuaternion(world.quaternion);
          rv.g.lookAt(world.localToWorld(p1.clone()));
          rv.g.rotateY(-Math.PI / 2);
        });
        beacons.forEach((b, i) => void (b.visible = Math.floor(t * 1.6 + i * 0.7) % 2 === 0));
        sats.forEach((s) => {
          const a = t * s.sp + s.ph;
          s.sat.position.set(Math.cos(a) * s.r, 0, Math.sin(a) * s.r);
          s.sat.rotation.y = -a;
          s.blink.visible = Math.floor(t * 2 + s.ph) % 2 === 0;
        });
        dust.rotation.y = t * 0.03;
        meteors.forEach((m) => {
          m.t += dt;
          if (m.t > 9) {
            m.t = 0;
            m.from.set((Math.random() - 0.5) * 300, 80 + Math.random() * 60, -220 - Math.random() * 80);
            m.dir.set(-0.8 - Math.random() * 0.4, -0.5, 0).normalize();
            m.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), m.dir.clone().negate());
          }
          const k = m.t / 1.1;
          m.m.position.copy(m.from).addScaledVector(m.dir, k * 160);
          (m.m.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = k < 1 ? Math.sin(k * Math.PI) * 0.9 : 0;
        });
        // the scan sheet sweeps the rocket, the shockwave spreads at lift-off
        gateLight.position.set(0, lt < 1.8 ? 0.8 + (Math.sin(lt * 4) * 0.5 + 0.5) * 3.6 : 2.4, 0);
        const sk = clamp((lt - 2.4) / 0.9);
        shock.scale.setScalar(0.5 + sk * 3.5);
        (shock.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = lt > 2.4 && sk < 1 ? (1 - sk) * 0.9 : 0;

        // hover: the place under the pointer lifts a little and its tag opens
        const live = since > INTRO;
        if (live && !flying) {
          ray.setFromCamera(ndc, camera);
          let hit: string | null = null;
          for (const [id, g] of Object.entries(groups))
            if (ray.intersectObject(g, true).length) {
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
          const want = (hovered === id ? 1.08 : 1) * 0.5;
          g.scale.setScalar(g.scale.x + (want - g.scale.x) * Math.min(1, dt * 8));
        }
        // tags follow their places, hidden when the place is round the back of the moon
        PLACES.forEach((p, i) => {
          const node = tagEls.current[i];
          if (!node) return;
          const g = groups[p.id];
          tmp.copy(anchors[p.id]);
          g.localToWorld(tmp);
          const facing = tmp.clone().normalize().dot(camera.position.clone().normalize());
          scr.copy(tmp).project(camera);
          const x = (scr.x * 0.5 + 0.5) * el.clientWidth, y = (-scr.y * 0.5 + 0.5) * el.clientHeight;
          const vis = live && facing > 0.25 ? clamp((facing - 0.25) / 0.2) : 0;
          node.style.opacity = vis.toFixed(2);
          node.style.visibility = vis > 0.02 ? "visible" : "hidden";
          node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
          node.dataset.side = x > el.clientWidth * 0.55 ? "l" : "r";
        });
        composer.render();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      void boardMat;
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
    <section className="mn">
      <h1 className="w3-sr">yeppo: rug checks for pump.fun coins, in the browser</h1>
      <div ref={host} className="mn-canvas" />
      {phase === "load" && (
        <div className="mn-load" aria-hidden>
          {/* a crescent that fills into a full moon as the models arrive */}
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="30" className="mn-ring" />
            <circle cx="50" cy="50" r="30" className="mn-fill" style={{ strokeDashoffset: 188.5 * (1 - load) }} />
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
      <div className={`mn-hud ${phase === "live" ? "on" : ""}`} aria-hidden>
        <span className="mn-mark">yeppo</span>
        <span className="mn-k">every coin wants the moon · we check it first</span>
        <span className="mn-hint">drag to turn the moon · click a place</span>
      </div>
    </section>
  );
}
