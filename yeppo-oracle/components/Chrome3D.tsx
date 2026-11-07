"use client";

// The home's signature: the word "yeppo" as heavy chrome in 3D, lit by a studio environment, turning a little with the
// pointer and the scroll. three.js loads after the page (dynamic import), so the first paint is the flat wordmark
// underneath, which stays as the fallback where WebGL is missing or motion is reduced.
import { useEffect, useRef, useState } from "react";

export default function Chrome3D() {
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let stop = () => {};
    let alive = true;
    (async () => {
      const THREE = await import("three");
      const { FontLoader } = await import("three/examples/jsm/loaders/FontLoader.js");
      const { TextGeometry } = await import("three/examples/jsm/geometries/TextGeometry.js");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      const fontJson = (await import("three/examples/fonts/helvetiker_bold.typeface.json")).default;
      if (!alive) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        return; // no WebGL: the flat wordmark stays
      }
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      camera.position.set(0, 0, 9);

      const font = new FontLoader().parse(fontJson as never);
      const geo = new TextGeometry("yeppo", { font, size: 1.6, depth: 0.55, curveSegments: 10, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.045, bevelSegments: 6 });
      geo.center();
      const mat = new THREE.MeshPhysicalMaterial({ color: 0xf2f1ec, metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.12 });
      const word = new THREE.Mesh(geo, mat);
      scene.add(word);
      // a soft key light from the top left, so the bevels catch a line of light
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(-4, 5, 6);
      scene.add(key);

      const fit = () => {
        const w = el.clientWidth, h = el.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // keep the whole word in frame on narrow screens
        camera.position.z = Math.max(7, 14 / (w / h));
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(fit);
      ro.observe(el);
      fit();
      let px = 0, py = 0, tx = 0, ty = 0;
      const move = (e: PointerEvent) => {
        tx = (e.clientX / innerWidth - 0.5) * 0.5;
        ty = (e.clientY / innerHeight - 0.5) * 0.3;
      };
      addEventListener("pointermove", move, { passive: true });
      let raf = 0;
      const t0 = performance.now();
      const loop = (now: number) => {
        px += (tx - px) * 0.05;
        py += (ty - py) * 0.05;
        const t = (now - t0) / 1000;
        const sc = Math.min(1, scrollY / innerHeight);
        word.rotation.y = px + Math.sin(t * 0.35) * 0.12;
        word.rotation.x = py * 0.6 + sc * 0.5;
        word.position.y = sc * 1.2;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      setOn(true);
      stop = () => {
        cancelAnimationFrame(raf);
        removeEventListener("pointermove", move);
        ro.disconnect();
        geo.dispose();
        mat.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => undefined);
    return () => {
      alive = false;
      stop();
    };
  }, []);
  return (
    <div ref={box} className={`chrome3d ${on ? "on" : ""}`} aria-hidden>
      <span className="chrome3d-flat">yeppo</span>
    </div>
  );
}
