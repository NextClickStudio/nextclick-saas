"use client";

// The home is one 3D world travelled by scroll, with no headlines: the objects tell the story and small technical tags
// pinned to them say what each one is. A chrome yeppo coin floats alone; a river of coins (the week's launches) rises
// and our coin dives in; the river runs through a scanner ring where the rugs turn red and fall away; our coin splits
// into its 24 checks; a constellation of wallets lights up; the coin closes again with its word; then four objects
// you can click lead further (the extension, the radar, the record, the price). The ring, the wallets and the coin are
// clickable too. Scroll sets a target and the camera eases toward it.
// Without WebGL (or with reduced motion) the tags read as a plain list with plain links.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHECKS } from "@/lib/checks";

/** a tag pinned to an object: index, name, value, the stretch of the scroll it shows in, where it leads */
type Tag = { n?: string; t: string; v?: string; a: number; b: number; href?: string; tone?: "red" | "green"; side?: "l" | "r" };
const TAGS: Tag[] = [
  { n: "00", t: "yeppo", v: "rug checks · pump.fun", a: -1, b: 0.09, side: "l" },
  { t: "Add to Chrome", v: "read a coin ↗", a: -1, b: 0.09, href: "/extension", side: "r" },
  { n: "01", t: "Launches · 7d", v: "164,673", a: 0.13, b: 0.29 },
  { n: "02", t: "Scanner", v: "open record ↗", a: 0.3, b: 0.47, href: "/record" },
  { t: "Rug", v: "991 · 7d", a: 0.32, b: 0.47, tone: "red" },
  { n: "03", t: "24 checks", v: "one coin", a: 0.56, b: 0.66 },
  { n: "04", t: "Your wallets", v: "open radar ↗", a: 0.69, b: 0.81, href: "/radar" },
  { t: "Buy", v: "wallet a", a: 0.72, b: 0.81, tone: "green" },
  { t: "Buy", v: "wallet b", a: 0.73, b: 0.81, tone: "green" },
  { n: "05", t: "Safe", v: "≈ 1 s", a: 0.82, b: 0.89, tone: "green" },
  { n: "06", t: "Extension", v: "read a coin ↗", a: 0.9, b: 2, href: "/extension" },
  { n: "07", t: "Radar", v: "wallets, live ↗", a: 0.9, b: 2, href: "/radar" },
  { n: "08", t: "Record", v: "every call ↗", a: 0.9, b: 2, href: "/record" },
  { n: "09", t: "Pricing", v: "0.2 sol · 30d ↗", a: 0.9, b: 2, href: "/pricing" },
];
const T_DOOR = 10; // first door tag
const SHARD_TAGS = [0, 3, 8, 11, 13, 17]; // checks named beside their shards
const DOOR_HREF = ["/extension", "/radar", "/record", "/pricing"];
const CHAPTERS = [0, 0.13, 0.3, 0.56, 0.69, 0.82, 0.9];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const seg = (p: number, a: number, b: number) => ease(clamp((p - a) / (b - a)));

export default function World() {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const tagEls = useRef<(HTMLElement | null)[]>([]);
  const shardEls = useRef<(HTMLSpanElement | null)[]>([]);
  const [p, setP] = useState(0);
  const [gl, setGl] = useState<"wait" | "on" | "off">("wait");

  useEffect(() => {
    const el = host.current, box = wrap.current;
    if (!el || !box) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return void setGl("off");
    let alive = true;
    let stop = () => {};
    const progress = () => {
      const r = box.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - innerHeight));
    };
    (async () => {
      const THREE = await import("three");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js");
      const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js");
      const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");
      const { OutputPass } = await import("three/examples/jsm/postprocessing/OutputPass.js");
      if (!alive) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
      } catch {
        return void setGl("off");
      }
      const small = innerWidth < 760;
      renderer.setPixelRatio(Math.min(small ? 1.5 : 2, devicePixelRatio || 1));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.82;
      renderer.setClearColor(0x000000, 1);
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x000000, 0.032);
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.7;
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
      type V3 = InstanceType<typeof THREE.Vector3>;
      type Obj = InstanceType<typeof THREE.Object3D>;

      // ---- materials ----
      const chrome = new THREE.MeshPhysicalMaterial({ color: 0xd6d6d6, metalness: 1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
      const ink = new THREE.MeshPhysicalMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.25 });
      const glow = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

      // ---- the coin: a lathed rim, a raised lip, the y in relief ----
      const prof: [number, number][] = [
        [0, 0.07], [0.76, 0.07], [0.79, 0.098], [0.9, 0.098], [0.94, 0.085], [0.985, 0.055], [1, 0.02],
        [1, -0.02], [0.985, -0.055], [0.94, -0.085], [0.9, -0.098], [0.79, -0.098], [0.76, -0.07], [0, -0.07],
      ];
      const coinGeo = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), small ? 48 : 96);
      coinGeo.rotateX(Math.PI / 2);
      const stroke = (x1: number, y1: number, x2: number, y2: number, w: number) => {
        const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = (-dy / l) * w * 0.5, ny = (dx / l) * w * 0.5;
        const s = new THREE.Shape();
        s.moveTo(x1 + nx, y1 + ny);
        s.lineTo(x2 + nx, y2 + ny);
        s.lineTo(x2 - nx, y2 - ny);
        s.lineTo(x1 - nx, y1 - ny);
        s.closePath();
        return s;
      };
      const yGeo = new THREE.ExtrudeGeometry([stroke(-0.36, 0.42, 0.02, -0.12, 0.2), stroke(0.38, 0.42, -0.14, -0.6, 0.2)], {
        depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 3,
      });
      yGeo.rotateZ(-0.14);
      yGeo.translate(0, 0, 0.07);
      const makeCoin = () => {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(coinGeo, chrome));
        g.add(new THREE.Mesh(yGeo, ink));
        return g;
      };
      const hero = makeCoin();
      scene.add(hero);

      // ---- the 24 shards ----
      const S = new THREE.Vector3(14, 0.6, -4);
      const shardGroup = new THREE.Group();
      const warnMat = new THREE.MeshPhysicalMaterial({ color: 0xffbe55, metalness: 0.9, roughness: 0.25, emissive: 0x3a2200 });
      const shards = CHECKS.map((c, i) => {
        const a0 = (i / CHECKS.length) * Math.PI * 2;
        const g = new THREE.CylinderGeometry(1, 1, 0.14, 6, 1, false, a0, (Math.PI * 2) / CHECKS.length - 0.012);
        g.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(g, c[3] === "warn" ? warnMat : chrome);
        m.userData.a = a0 + Math.PI / CHECKS.length;
        shardGroup.add(m);
        return m;
      });
      scene.add(shardGroup);

      // ---- the river ----
      const RZ = -12;
      const N = small ? 480 : 1100;
      const river = new THREE.InstancedMesh(coinGeo, new THREE.MeshPhysicalMaterial({ color: 0x8f8f8f, metalness: 1, roughness: 0.34, clearcoat: 0.6 }), N);
      river.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const flow = Array.from({ length: N }, (_, i) => ({
        u: Math.random(), r: Math.sqrt(Math.random()) * 5.4, a: Math.random() * Math.PI * 2, sp: 0.01 + Math.random() * 0.018,
        spin: Math.random() * 6, s: 0.22 + Math.random() * 0.2, rug: Math.random() < 0.12, i, p: new THREE.Vector3(),
      }));
      const white = new THREE.Color(0xffffff), red = new THREE.Color(0xff3b22);
      flow.forEach((f) => river.setColorAt(f.i, white));
      scene.add(river);
      let rugPick = -1; // the falling rug the red tag follows

      // ---- the scanner ----
      const ring = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.05, 16, 220), glow);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(0, 0, RZ);
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(6.2, 96),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.03, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      disc.rotation.y = Math.PI / 2;
      disc.position.copy(ring.position);
      scene.add(ring, disc);

      // ---- the wallets ----
      const C = new THREE.Vector3(32, 0, -8);
      const NODES = small ? 34 : 54;
      const nodes = Array.from({ length: NODES }, () => {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(2 + Math.random() * 5.5);
        v.y *= 0.6;
        return v.add(C);
      });
      const lit = new Set([3, 7, 11, 18, 26]);
      const nodeGeo = new THREE.SphereGeometry(0.09, 16, 12);
      const dimMat = new THREE.MeshBasicMaterial({ color: 0x6a6a6a, toneMapped: false });
      const constellation = new THREE.Group();
      const nodeMeshes = nodes.map((v, i) => {
        const m = new THREE.Mesh(nodeGeo, lit.has(i) ? glow : dimMat);
        m.position.copy(v);
        constellation.add(m);
        return m;
      });
      const pairs: number[] = [];
      nodes.forEach((a, i) => nodes.forEach((b, j) => j > i && a.distanceTo(b) < 2.6 && pairs.push(a.x, a.y, a.z, b.x, b.y, b.z)));
      constellation.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pairs, 3)), new THREE.LineBasicMaterial({ color: 0x2f2f2f })));
      const litIdx = [...lit];
      const litPts: number[] = [];
      litIdx.forEach((i, k) => {
        const a = nodes[i], b = nodes[litIdx[(k + 1) % litIdx.length]];
        litPts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      });
      const litWeb = new THREE.LineSegments(
        new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(litPts, 3)),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false }),
      );
      constellation.add(litWeb);
      scene.add(constellation);
      // the two wallets that buy: the lit nodes closest to the camera's side
      const byZ = [...litIdx].sort((x, y) => nodes[y].z - nodes[x].z);
      const buyers = byZ.slice(0, 2), radarNode = byZ[byZ.length - 1];

      // the word: a small green light that comes on beside the closed coin
      const safeDot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshBasicMaterial({ color: 0x5fe3a1, toneMapped: false }));
      scene.add(safeDot);

      // ---- the four doors: objects you click to go further ----
      const M = new THREE.Vector3(54, 0, -10);
      const doors = [new THREE.Group(), new THREE.Group(), new THREE.Group(), new THREE.Group()];
      // 1 · a coin
      doors[0].add(makeCoin());
      // 2 · a small constellation
      {
        const pts = Array.from({ length: 16 }, () => new THREE.Vector3().randomDirection().multiplyScalar(0.5 + Math.random() * 0.6));
        pts.forEach((v, i) => {
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), i % 4 === 0 ? glow : dimMat);
          m.position.copy(v);
          doors[1].add(m);
        });
        const lp: number[] = [];
        pts.forEach((a, i) => pts.forEach((b, j) => j > i && a.distanceTo(b) < 0.8 && lp.push(a.x, a.y, a.z, b.x, b.y, b.z)));
        doors[1].add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(lp, 3)), new THREE.LineBasicMaterial({ color: 0x8a8a8a })));
        // an invisible ball so the whole cluster takes the pointer
        doors[1].add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshBasicMaterial({ visible: false })));
      }
      // 3 · a bar chart of the week
      [0.5, 0.8, 0.65, 1.2, 0.9, 1.45, 1.1].forEach((h, i) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, h, 0.18), i === 5 ? warnMat : chrome);
        b.position.set(-0.6 + i * 0.2, h / 2 - 0.7, 0);
        doors[2].add(b);
      });
      // 4 · a stack of coins
      for (let i = 0; i < 6; i++) {
        const c = makeCoin();
        c.rotation.x = Math.PI / 2;
        c.scale.setScalar(0.7);
        c.position.set(Math.sin(i * 1.7) * 0.05, -0.6 + i * 0.15, Math.cos(i) * 0.05);
        doors[3].add(c);
      }
      const doorBase = doors.map((d, i) => {
        // a row on a wide screen, two by two on a phone
        const v = small
          ? new THREE.Vector3(M.x + ((i % 2) - 0.5) * 3, M.y + (i < 2 ? 1.9 : -1.7), M.z)
          : new THREE.Vector3(M.x + (i - 1.5) * 3.4, M.y, M.z - Math.abs(i - 1.5) * 1.1);
        d.position.copy(v);
        scene.add(d);
        // a thin floor ring under each object
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: 0x5a5a5a, toneMapped: false }));
        r.rotation.x = Math.PI / 2;
        r.position.set(v.x, v.y - 1.2, v.z);
        scene.add(r);
        d.userData.ring = r;
        return v;
      });

      // ---- dust and light ----
      const DUST = small ? 1200 : 3000;
      const dp = new Float32Array(DUST * 3);
      for (let i = 0; i < DUST; i++) {
        dp[i * 3] = (Math.random() - 0.25) * 160;
        dp[i * 3 + 1] = (Math.random() - 0.5) * 50;
        dp[i * 3 + 2] = (Math.random() - 0.7) * 110;
      }
      const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(dp, 3)), new THREE.PointsMaterial({ color: 0x5a5a5a, size: 0.045 }));
      scene.add(dust);
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(-4, 6, 8);
      scene.add(key);

      // ---- post ----
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), small ? 0.38 : 0.5, 0.45, 0.9);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      const fit = () => {
        const w = el.clientWidth, h = el.clientHeight;
        renderer.setSize(w, h, false);
        composer.setSize(w, h);
        bloom.resolution.set(w / 2, h / 2);
        camera.aspect = w / h;
        camera.fov = w / h < 0.8 ? 54 : 38;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(fit);
      ro.observe(el);
      fit();

      // ---- the camera's path ----
      const KEYS: [number, [number, number, number], [number, number, number]][] = [
        [0.0, [0, 0, small ? 7.4 : 5.4], [0, 0, 0]],
        [0.14, [-2, 3, 14], [-8, 1.5, -10]],
        [0.28, [-9, 3, 4], [-3, 0, RZ]],
        [0.44, [6, -0.5, -1], [4, -3, RZ]],
        [0.56, [S.x, S.y + 0.8, S.z + 7.4], [S.x, S.y + 0.4, S.z]],
        [0.64, [S.x - 1.2, S.y + 0.5, S.z + 6.4], [S.x, S.y + 0.4, S.z]],
        [0.72, [C.x - 6, C.y + 5, C.z + 15], [C.x, C.y + 1, C.z]],
        [0.79, [C.x + 2, C.y + 1.5, C.z + 10], [C.x, C.y + 1.5, C.z]],
        [0.86, [S.x, S.y + 0.6, S.z + 5], [S.x, S.y + 0.5, S.z]],
        [0.93, [M.x, M.y + 4, M.z + 15], [M.x, M.y, M.z]],
        [1.0, [M.x, M.y + 1.6, M.z + (small ? 13 : 10.5)], [M.x, M.y - 0.2, M.z]],
      ];
      const V = (a: [number, number, number]) => new THREE.Vector3(...a);
      const camAt = (p: number) => {
        let i = 1;
        while (i < KEYS.length - 1 && p > KEYS[i][0]) i++;
        const [p0, a0, t0] = KEYS[i - 1], [p1, a1, t1] = KEYS[i];
        const e = ease(clamp((p - p0) / (p1 - p0)));
        return { pos: V(a0).lerp(V(a1), e), tgt: V(t0).lerp(V(t1), e) };
      };
      const heroAt = (p: number, t: number) => {
        const v = new THREE.Vector3(0, Math.sin(t * 0.8) * 0.06, 0);
        if (p > 0.1) v.lerp(new THREE.Vector3(-18, 0, RZ), seg(p, 0.1, 0.28));
        if (p > 0.28) v.set(-18 + 26 * seg(p, 0.28, 0.45), 0, RZ);
        if (p > 0.45) v.lerp(S, seg(p, 0.45, 0.55));
        return v;
      };

      // ---- pointer: hover lifts an object, a click opens its page ----
      const ray = new THREE.Raycaster();
      const ndc = new THREE.Vector2(9, 9);
      let hovered = -1;
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      };
      // what the pointer can open at this point of the story: [object, page, tag it lights]
      const targets = (p: number): [Obj, string, number][] => [
        ...(p < 0.09 ? [[hero, "/extension", 1] as [Obj, string, number]] : []),
        ...(p > 0.3 && p < 0.47 ? [[ring, "/record", 3] as [Obj, string, number]] : []),
        ...(p > 0.69 && p < 0.81 ? [[constellation, "/radar", 6] as [Obj, string, number]] : []),
        ...(p > 0.9 ? doors.map((d, i) => [d, DOOR_HREF[i], T_DOOR + i] as [Obj, string, number]) : []),
      ];
      let hrefNow: string | null = null;
      const onClick = (e: MouseEvent) => {
        if (!hrefNow) return;
        e.preventDefault();
        router.push(hrefNow);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("click", onClick);

      // ---- the tags: each follows a point of its object on screen ----
      const anchor = Array.from({ length: TAGS.length }, () => new THREE.Vector3());
      const scr = new THREE.Vector3();
      const place = (node: HTMLElement | null, at: V3, k: number, w: number, h: number, side?: "l" | "r", dir: "" | "d" | "u" = "") => {
        if (!node) return;
        scr.copy(at).project(camera);
        const x = (scr.x * 0.5 + 0.5) * w, y = (-scr.y * 0.5 + 0.5) * h;
        const vis = scr.z < 1 && x > -40 && x < w + 40 && y > -40 && y < h + 40 ? k : 0;
        node.style.opacity = vis.toFixed(3);
        node.style.visibility = vis > 0.01 ? "visible" : "hidden";
        node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        node.dataset.side = side ?? (x > w * (small ? 0.5 : 0.6) ? "l" : "r");
        node.dataset.dir = dir;
      };

      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
      const tmp = new THREE.Vector3();
      let cur = progress(), raf = 0, last = performance.now(), shown = -1;
      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const t = now / 1000;
        cur += (progress() - cur) * Math.min(1, dt * 4);
        const p = cur;
        if (Math.abs(p - shown) > 0.004) {
          shown = p;
          setP(p);
        }
        const { pos: cp, tgt } = camAt(p);
        camera.position.copy(cp).add(tmp.set(Math.sin(t * 0.3) * 0.12, Math.cos(t * 0.23) * 0.08, 0));
        camera.lookAt(tgt);

        // our coin
        hero.position.copy(heroAt(p, t));
        hero.scale.setScalar((p < 0.1 ? 1 : p < 0.45 ? 1 - 0.45 * seg(p, 0.1, 0.28) : 0.55 + 0.45 * seg(p, 0.45, 0.55)) * (hovered === 1 ? 1.06 : 1));
        hero.rotation.set(Math.sin(t * 0.5) * 0.12 + (p < 0.1 ? 0 : t * 0.9) * (p < 0.45 ? 1 : 0), (p < 0.45 ? p * 6 : 0) + Math.sin(t * 0.4) * 0.25 + (hovered === 1 ? t * 0.8 : 0), 0);
        const split = seg(p, 0.55, 0.63) * (1 - seg(p, 0.8, 0.86));
        hero.visible = split < 0.02;
        shardGroup.visible = split >= 0.02;
        shardGroup.position.copy(S);
        shards.forEach((m, i) => {
          const a = m.userData.a as number;
          const out = split * (1.2 + (i % 3) * 0.35);
          m.position.set(Math.cos(a) * out, Math.sin(a) * out, Math.sin(i * 1.7) * split * 0.8);
          m.rotation.set(split * Math.sin(i) * 0.9, split * Math.cos(i * 1.3) * 0.9, 0);
        });

        // the river rises around the coin as soon as the scroll starts
        const rk = seg(p, 0.04, 0.16) * (1 - seg(p, 0.6, 0.7) * 0.6);
        for (const f of flow) {
          f.u = (f.u + f.sp * dt) % 1;
          const x = -70 + f.u * 140;
          let y = Math.sin(f.a) * f.r, s = f.s * rk, col = white;
          const z = RZ + Math.cos(f.a) * f.r;
          if (f.rug && x > 0) {
            col = red;
            y -= x * x * 0.012;
            s *= Math.max(0.2, 1 - x / 60);
          }
          e3.set(t * 0.6 + f.spin, f.spin + t * 0.4 + (f.rug && x > 0 ? x * 0.3 : 0), 0);
          q.setFromEuler(e3);
          pos.set(x, y, z);
          f.p.copy(pos);
          sc.setScalar(Math.max(0.0001, s));
          m4.compose(pos, q, sc);
          river.setMatrixAt(f.i, m4);
          river.setColorAt(f.i, col);
        }
        river.instanceMatrix.needsUpdate = true;
        if (river.instanceColor) river.instanceColor.needsUpdate = true;
        // the scanner opens once the river is up (seen edge-on from the start it would be a line through the coin)
        const rg = seg(p, 0.1, 0.2);
        ring.visible = disc.visible = rg > 0.01;
        ring.scale.setScalar(Math.max(0.001, rg));
        disc.scale.setScalar(Math.max(0.001, rg));
        (disc.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = 0.025 + seg(p, 0.28, 0.38) * 0.04 + (hovered === 3 ? 0.05 : 0);
        // the red tag rides one rug from the ring down until it is gone
        const rp = rugPick >= 0 ? flow[rugPick].p.x : -1;
        if (rugPick < 0 || rp < 1 || rp > 16) rugPick = flow.findIndex((f) => f.rug && f.p.x > 1.5 && f.p.x < 4 && f.r < 4.5);

        // the wallets light as the radar step comes in
        const wl = seg(p, 0.7, 0.77);
        (litWeb.material as InstanceType<typeof THREE.LineBasicMaterial>).opacity = wl;
        nodeMeshes.forEach((m, i) => m.scale.setScalar(lit.has(i) ? 1 + wl * 1.6 + Math.sin(t * 3 + i) * 0.1 * wl : 1));
        if (hovered === 6) constellation.rotation.y += dt * 0.25;

        // the word
        const word = seg(p, 0.82, 0.85) * (1 - seg(p, 0.88, 0.9));
        safeDot.visible = word > 0.01;
        safeDot.scale.setScalar(Math.max(0.001, word * (1 + Math.sin(t * 4) * 0.12)));
        safeDot.position.set(S.x + 0.82, S.y + 0.62, S.z + 0.2);

        // pointer
        ray.setFromCamera(ndc, camera);
        let hit = -1;
        hrefNow = null;
        for (const [obj, href, id] of targets(p)) {
          if (ray.intersectObject(obj, true).length) {
            hit = id;
            hrefNow = href;
            break;
          }
        }
        if (hit !== hovered) {
          tagEls.current.forEach((n, i) => n?.classList.toggle("on", i === hit));
          hovered = hit;
          el.style.cursor = hit >= 0 ? "pointer" : "";
        }

        // the doors float and turn; the one under the pointer lifts and its floor ring lights
        const doorK = seg(p, 0.9, 0.97);
        doors.forEach((d, i) => {
          const on = hovered === T_DOOR + i;
          d.visible = doorK > 0.01;
          d.position.y = doorBase[i].y + (1 - doorK) * -3 + Math.sin(t * 1.2 + i) * 0.08 + (on ? 0.25 : 0);
          d.rotation.y += dt * (on ? 1.6 : 0.4);
          d.scale.setScalar(Math.max(0.001, doorK * (on ? 1.12 : 1)));
          const r = d.userData.ring as InstanceType<typeof THREE.Mesh>;
          r.visible = d.visible;
          (r.material as InstanceType<typeof THREE.MeshBasicMaterial>).color.setHex(on ? 0xffffff : 0x4a4a4a);
          r.scale.setScalar(on ? 1.15 : 1);
        });
        dust.rotation.y = t * 0.004;

        // where each tag is pinned this frame
        const hp = hero.position, hs = hero.scale.x;
        // beside the coin on a wide screen; above and below it on a phone
        if (small) {
          anchor[0].set(hp.x - 0.2 * hs, hp.y + 0.98 * hs, hp.z);
          anchor[1].set(hp.x - 0.5 * hs, hp.y - 0.86 * hs, hp.z);
        } else {
          anchor[0].set(hp.x - 0.96 * hs, hp.y + 0.3 * hs, hp.z);
          anchor[1].set(hp.x + 0.94 * hs, hp.y - 0.34 * hs, hp.z);
        }
        anchor[2].set(-9, 3.4, RZ + 2.2);
        anchor[3].set(0, 6.2, RZ);
        if (rugPick >= 0) anchor[4].copy(flow[rugPick].p);
        anchor[5].set(S.x + 1.3 * split, S.y + 1.4 * split, S.z);
        nodeMeshes[radarNode].getWorldPosition(anchor[6]);
        nodeMeshes[buyers[0]].getWorldPosition(anchor[7]);
        nodeMeshes[buyers[1]].getWorldPosition(anchor[8]);
        anchor[9].copy(safeDot.position);
        doors.forEach((d, i) => anchor[T_DOOR + i].set(d.position.x, d.position.y + 1.05, d.position.z));
        const w = el.clientWidth, h = el.clientHeight;
        TAGS.forEach((g, i) => {
          let k = (g.a < 0 ? 1 : seg(p, g.a, g.a + 0.02)) * (1 - seg(p, g.b - 0.02, g.b));
          if (i === 4 && rugPick < 0) k = 0;
          if (small && i < 2) place(tagEls.current[i], anchor[i], k, w, h, "l", i ? "d" : "");
          else place(tagEls.current[i], anchor[i], k, w, h, g.side, small && i >= T_DOOR ? "u" : "");
        });
        SHARD_TAGS.forEach((ci, k) => {
          const v = shards[ci].getWorldPosition(tmp);
          const a = shards[ci].userData.a as number;
          v.add(scr.set(Math.cos(a), Math.sin(a), 0).multiplyScalar(split * 0.9));
          place(shardEls.current[k], v, split > 0.6 ? clamp((split - 0.6) / 0.3) : 0, w, h);
        });

        composer.render();
        raf = requestAnimationFrame(tick);
      };
      const io = new IntersectionObserver(([e]) => {
        cancelAnimationFrame(raf);
        if (e.isIntersecting) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      });
      io.observe(box);
      setGl("on");
      stop = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("click", onClick);
        composer.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => setGl("off"));
    return () => {
      alive = false;
      stop();
    };
  }, [router]);

  let chap = 0;
  CHAPTERS.forEach((c, i) => p >= c && (chap = i));
  return (
    <section ref={wrap} className={`w3 ${gl}`}>
      <h1 className="w3-sr">yeppo: rug checks for pump.fun coins, in the browser</h1>
      <div className="w3-stage">
        <div ref={host} className="w3-canvas" />
        <div className="w3-vignette" aria-hidden />
        {TAGS.map((g, i) => {
          const body = (
            <>
              <i className="w3-dot" />
              <i className="w3-lead" />
              <span className="w3-box">
                {g.n && <em>{g.n}</em>}
                <b>{g.t}</b>
                {g.v && <span>{g.v}</span>}
              </span>
            </>
          );
          const cls = `w3-tag ${g.tone ?? ""} ${g.href ? "go" : ""}`;
          return g.href ? (
            <Link key={i} href={g.href} className={cls} ref={(n) => void (tagEls.current[i] = n)} tabIndex={gl === "on" && p < g.a ? -1 : undefined}>
              {body}
            </Link>
          ) : (
            <span key={i} className={cls} ref={(n) => void (tagEls.current[i] = n)} aria-hidden={gl !== "off"}>
              {body}
            </span>
          );
        })}
        {SHARD_TAGS.map((ci, k) => (
          <span key={ci} ref={(n) => void (shardEls.current[k] = n)} className={`w3-tag mini ${CHECKS[ci][3]}`} aria-hidden>
            <i className="w3-dot" />
            <i className="w3-lead" />
            <span className="w3-box">
              <b>{CHECKS[ci][0]}</b>
              <span>{CHECKS[ci][1]}</span>
            </span>
          </span>
        ))}
        <div className="w3-hud" aria-hidden>
          <span>{String(chap).padStart(2, "0")} / 06</span>
          <b className="w3-bar">
            <i style={{ transform: `scaleX(${p.toFixed(3)})` }} />
          </b>
          <span>{p < 0.04 ? "scroll" : p > 0.95 ? "pick an object" : "yeppo.it"}</span>
        </div>
      </div>
    </section>
  );
}
