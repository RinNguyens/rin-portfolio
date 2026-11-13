/* Mũi Điện, Phú Yên — the WebGL coast behind the hero.
   createCoastScene() builds the scene into `canvas`, wires pointer/scroll input on `host`,
   and returns a dispose function. It throws if WebGL is unavailable. */
import * as THREE from "three"
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js"

export type CoastSceneOptions = {
  host: HTMLElement
  canvas: HTMLCanvasElement
  onReady: () => void
  onInteract: () => void
}

export function createCoastScene({ host, canvas, onReady, onInteract }: CoastSceneOptions): () => void {
  const offs: Array<() => void> = []
  const on = (t: EventTarget, type: string, fn: (e: any) => void, o?: AddEventListenerOptions) => {
    t.addEventListener(type, fn, o); offs.push(() => t.removeEventListener(type, fn, o))
  }

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LOW = innerWidth < 700 || (navigator.hardwareConcurrency || 8) <= 4;   // lighter scene on phones / weak CPUs
  const Q = LOW ? .45 : 1;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });   // throws without WebGL → caller shows the photo
  renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.5 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 900);
  const nightU = { value: 0 }, timeU = { value: 0 };
  const sunDir = new THREE.Vector3(-.78, .1, -.62).normalize();      // visible sun, low over the East Sea
  const keyDir = new THREE.Vector3(-.75, .42, -.1).normalize();      // light that actually shades the cape

  /* ================= shared GLSL ================= */
  const NOISE = `
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
    return mix(mix(h21(i), h21(i + vec2(1., 0.)), u.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), u.x), u.y); }
  float fbm2(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return s; }
  float fbm3(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 3; i++){ s += a * vn(p); p = p * 2.07 + vec2(5.1, 3.3); a *= .5; } return s; }
  `;
  const SKY = `
  uniform float uNight, uTime; uniform vec3 uSun;
  vec3 skyCol(vec3 d, bool clouds){
    float h = clamp(d.y, 0., 1.);
    vec3 day = mix(vec3(1., .79, .60), vec3(.36, .60, .86), pow(h, .45));
    vec3 night = mix(vec3(.07, .10, .2), vec3(.01, .02, .06), pow(h, .35));
    vec3 col = mix(day, night, uNight);
    float s = max(dot(d, uSun), 0.);
    vec3 sc = mix(vec3(1., .70, .42), vec3(.75, .82, 1.), uNight);
    col += sc * (pow(s, 6.) * .4 + pow(s, 60.) * .35) * (1. - .65 * uNight);
    if (clouds && d.y > 0.) {
      vec2 uv = d.xz / (d.y + .1) * .8 + vec2(uTime * .008, uTime * .003);
      float c = fbm2(uv * 1.3);
      float cm = smoothstep(.5, .78, c) * smoothstep(0., .1, d.y) * (1. - smoothstep(.45, .85, d.y));
      float rim = pow(s, 5.) * .8;
      vec3 cday = mix(vec3(1., .84, .7), vec3(1., .96, .92), h) * (.82 + rim) - smoothstep(.62, .85, c) * .18;
      vec3 cnight = vec3(.10, .13, .22) + rim * vec3(.2, .22, .3);
      col = mix(col, mix(cday, cnight, uNight), cm * .9);
    }
    return col;
  }`;

  /* ================= landform (JS terrain + GLSL foam share this) ================= */
  // [x, z, rx, rz, height]
  const BLOBS = [
    [12, 4, 9, 7, 8], [3, 12, 5, 6, 4.5], [24, -6, 14, 12, 12], [42, 8, 20, 18, 14], [38, -28, 18, 16, 16],
    [16, -66, 12, 8, 9], [30, -74, 16, 12, 13], [48, -86, 22, 16, 17],
    [50, -140, 30, 14, 20], [80, -130, 34, 18, 28], [72, -100, 30, 30, 24], [70, -55, 20, 30, 18]
  ];
  const land = (x: number, z: number) => {
    let h = -2;
    for (const [bx, bz, rx, rz, bh] of BLOBS) { const dx = (x - bx) / rx, dz = (z - bz) / rz; h += bh * Math.exp(-(dx * dx + dz * dz)); }
    return h - Math.max(0, x - 90) * 1.6 - Math.max(0, -135 - z) * 1.6;
  };
  const GLSL_LAND = `
  float land(vec2 p){
    float h = -2.0;
    ${BLOBS.map(([x, z, rx, rz, h]) => `{ vec2 d = (p - vec2(${x.toFixed(1)}, ${z.toFixed(1)})) / vec2(${rx.toFixed(1)}, ${rz.toFixed(1)}); h += ${h.toFixed(1)} * exp(-dot(d, d)); }`).join("\n  ")}
    return h - max(0., p.x - 90.) * 1.6 - max(0., -135. - p.y) * 1.6;
  }`;

  function hash2(x: number, z: number) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x: number, z: number) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x: number, z: number, o = 5) => { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, z * f); n += a; a *= .5; f *= 2.03; } return s / n; };
  const ridged = (x: number, z: number) => { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < 5; i++) { s += a * (1 - Math.abs(2 * vnoise(x * f, z * f) - 1)) ** 2; n += a; a *= .5; f *= 2.1; } return s / n; };
  const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const terrainY = (x: number, z: number) => {
    const h = land(x, z);
    if (h < -.6) return h * 1.4 - .4;
    const cliff = 3.6 * smooth(-.1, 1, h);                                       // granite step at the shoreline
    const ridges = ridged(x * .045, z * .045) * 4.2 * smooth(1, 9, h);           // eroded ridgelines
    const lumps = (fbm(x * .22, z * .22) - .5) * 1.6 * smooth(.3, 3, h);         // canopy-scale undulation
    const rocks = (fbm(x * .7, z * .7, 3) - .5) * 2.2 * (1 - smooth(1, 4, h));   // jagged rock shelves near the sea
    return Math.max(h, h * 1.4 - .4) + cliff + ridges + lumps + rocks;
  };
  let heightAt: (x: number, z: number) => number = terrainY;   // swapped for the baked grid once the terrain exists
  const normalAt = (x: number, z: number) => new THREE.Vector3(heightAt(x - .5, z) - heightAt(x + .5, z), 1, heightAt(x, z - .5) - heightAt(x, z + .5)).normalize();

  /* ================= terrain ================= */
  const terrMat = new THREE.MeshStandardMaterial({ roughness: .96, metalness: 0 });
  terrMat.onBeforeCompile = sh => {
    sh.vertexShader = "varying vec3 vWP; varying vec3 vWN;\n" + sh.vertexShader.replace("#include <project_vertex>", `#include <project_vertex>
      vWP = (modelMatrix * vec4(transformed, 1.)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = "varying vec3 vWP; varying vec3 vWN;\n" + NOISE + sh.fragmentShader.replace("vec4 diffuseColor = vec4( diffuse, opacity );", `
      vec3 n = normalize(vWN); float slope = 1. - n.y;
      float n1 = fbm2(vWP.xz * .07), n2 = fbm2(vWP.xz * .55 + vWP.y * .2), n3 = vn(vWP.xz * 3.1 + vWP.y);
      vec3 floorDark = vec3(.020, .055, .014), floorMid = vec3(.050, .115, .025), scrub = vec3(.10, .16, .04);
      vec3 g = mix(floorDark, floorMid, smoothstep(.3, .7, n1));
      g = mix(g, scrub, smoothstep(.6, .78, n2) * .55);
      g *= .8 + .4 * n3;
      float strata = sin(vWP.y * 2.4 + n2 * 5. + vWP.x * .15) * .5 + .5;
      vec3 granite = mix(vec3(.17, .12, .08), vec3(.46, .35, .24), strata * .55 + n3 * .45);
      granite = mix(granite, vec3(.30, .30, .26), smoothstep(.62, .8, n2) * .35);           // grey lichen
      granite *= .75 + .5 * vn(vWP.xz * 9. + vWP.y * 4.);                                  // grain
      float rockMask = smoothstep(.50, .72, slope + (n2 - .5) * .3);
      rockMask = max(rockMask, 1. - smoothstep(3.0, 4.8, vWP.y + (n2 - .5) * 1.8));
      vec3 col = mix(g, granite, rockMask);
      col *= mix(.35, 1., smoothstep(-.3, 1.1, vWP.y + (n3 - .5) * .4));                   // wet splash zone
      col = mix(col, vec3(.06, .09, .07), 1. - smoothstep(-1.4, -.4, vWP.y));              // seabed
      vec4 diffuseColor = vec4(col, opacity);`);
  };
  {
    const g = new THREE.PlaneGeometry(170, 210, Math.round(340 * Q), Math.round(420 * Q));
    g.rotateX(-Math.PI / 2); g.translate(28, 0, -55);
    const p = g.attributes.position;
    const W = Math.round(340 * Q) + 1, H = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) { H[i] = terrainY(p.getX(i), p.getZ(i)); p.setY(i, H[i]) }
    g.computeVertexNormals();
    const x0 = p.getX(0), z0 = p.getZ(0), dx = p.getX(1) - x0, dz = p.getZ(W) - z0, rows = p.count / W;
    heightAt = (x, z) => {
      const fx = (x - x0) / dx, fz = (z - z0) / dz
      if (fx < 0 || fz < 0 || fx >= W - 1 || fz >= rows - 1) return terrainY(x, z)
      const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, i = iz * W + ix
      return (H[i] * (1 - tx) + H[i + 1] * tx) * (1 - tz) + (H[i + W] * (1 - tx) + H[i + W + 1] * tx) * tz
    }
    const m = new THREE.Mesh(g, terrMat); m.castShadow = m.receiveShadow = true; scene.add(m);
  }

  /* ================= vegetation ================= */
  function canopyGeo(blobs: number, seed: number, squash: number) {
    let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const parts = [];
    for (let i = 0; i < blobs; i++) {
      const g = new THREE.IcosahedronGeometry(.42 + r() * .3, 1);
      const a = r() * 6.28, d = i === 0 ? 0 : .3 + r() * .32;
      g.translate(Math.cos(a) * d, (.5 + r() * .45) * squash + (i === 0 ? .2 : 0), Math.sin(a) * d);
      g.deleteAttribute("uv"); g.deleteAttribute("normal"); parts.push(g);
    }
    const g = mergeVertices(mergeGeometries(parts), 1e-3), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = vnoise(x * 3.3 + seed, z * 3.3 + y * 2.1) - .5;
      p.setXYZ(i, x * (1 + n * .4), Math.max(y * (1 + n * .3), .05), z * (1 + n * .4));
    }
    g.computeVertexNormals(); return g;
  }
  const treeMat = new THREE.MeshStandardMaterial({ roughness: .88 });
  treeMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = "uniform float uTime; varying float vY; varying vec3 vLP;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vY = position.y; vLP = position;
      vec3 ip = instanceMatrix[3].xyz;
      float sw = (sin(uTime * 1.3 + ip.x * .35 + ip.z * .27) + .4 * sin(uTime * 3.1 + ip.x)) * .045 * max(position.y, 0.);
      transformed.x += sw; transformed.z += sw * .5;`);
    sh.fragmentShader = "varying float vY; varying vec3 vLP;\n" + NOISE + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      float clump = vn(vLP.xz * 5. + vLP.y * 3.7) * .6 + vn(vLP.xz * 11. - vLP.y * 6.) * .4;
      diffuseColor.rgb *= (.45 + .55 * smoothstep(.0, 1.1, vY)) * (.65 + .7 * clump);`);
  };
  const rockGeo = (() => {
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, 3).deleteAttribute("uv").deleteAttribute("normal")), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i), n = fbm(v.x * 1.4 + 3, v.z * 1.4 + v.y * 1.7, 3);
      v.multiplyScalar(.75 + n * .55); v.y *= .72; p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); return g;
  })();
  const blockGeo = (() => {                       // angular granite blocks (flat-shaded facets)
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i), n = fbm(v.x * 1.1 + 7, v.z * 1.1 + v.y * 1.3, 3);
      v.multiplyScalar(.7 + n * .7); v.y *= .8; p.setXYZ(i, v.x, v.y, v.z);
    }
    g.deleteAttribute("normal"); g.computeVertexNormals(); return g;
  })();
  const rockMat = new THREE.MeshStandardMaterial({ roughness: .78 });
  rockMat.onBeforeCompile = sh => {
    sh.vertexShader = "varying vec3 vRP; varying vec3 vRN;\n" + sh.vertexShader.replace("#include <project_vertex>", `#include <project_vertex>
      vec4 rp = vec4(transformed, 1.); vec3 rn = objectNormal;
      #ifdef USE_INSTANCING
      rp = instanceMatrix * rp; rn = mat3(instanceMatrix) * rn;
      #endif
      vRP = (modelMatrix * rp).xyz; vRN = normalize(mat3(modelMatrix) * rn);`);
    sh.fragmentShader = "varying vec3 vRP; varying vec3 vRN;\n" + NOISE + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      float gr = vn(vRP.xz * 6. + vRP.y * 5.) * .5 + vn(vRP.xy * 14.) * .3 + vn(vRP.zy * 14.) * .2;
      diffuseColor.rgb *= .7 + .6 * gr;                                                          // granite grain
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.8, .9, .78), smoothstep(.6, .8, vn(vRP.xz * 2.)) * .45); // lichen
      diffuseColor.rgb *= mix(.3, 1., smoothstep(-.1, 1.4, vRP.y + (gr - .5) * .6));             // wet below the splash line
      diffuseColor.rgb *= .8 + .35 * smoothstep(.2, .9, normalize(vRN).y);                       // sun-bleached tops`);
  };
  const granite = (c: THREE.Color, wet: boolean) => c.setHSL(.07 + Math.random() * .035, .14 + Math.random() * .12, (wet ? .22 : .32) + Math.random() * .16);

  const LH = new THREE.Vector3(12, 0, 4); LH.y = heightAt(LH.x, LH.z);
  const nearLH = (x: number, z: number) => Math.hypot(x - LH.x, z - LH.z) < 4.2;
  function scatter(geo: THREE.BufferGeometry, mat: THREE.Material, n: number, test: (x: number, z: number) => boolean, scale: (x: number, z: number) => number, color: (c: THREE.Color, x: number, z: number) => THREE.Color, sink = .25) {
    const m = new THREE.InstancedMesh(geo, mat, n), o = new THREE.Object3D(), c = new THREE.Color(); let k = 0, tries = 0;
    while (k < n && tries++ < n * 30) {
      const x = -26 + Math.random() * 116, z = -100 + Math.random() * 132;
      if (!test(x, z)) continue;
      const s = scale(x, z), nrm = normalAt(x, z);
      o.position.set(x, heightAt(x, z) - s * sink, z);
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm.lerp(new THREE.Vector3(0, 1, 0), .7).normalize());
      o.rotateY(Math.random() * 6.28);
      o.scale.set(s * (.85 + Math.random() * .3), s * (.8 + Math.random() * .5), s * (.85 + Math.random() * .3));
      o.updateMatrix(); m.setMatrixAt(k, o.matrix); m.setColorAt(k, color(c, x, z)); k++;
    }
    m.count = k; m.castShadow = m.receiveShadow = true; return m;
  }
  const forestOK = (x: number, z: number, minH = 1.3) => {
    const h = land(x, z); if (h < minH || nearLH(x, z)) return false;
    return normalAt(x, z).y > .5 && fbm(x * .09, z * .09, 3) > .2;          // leave rocky clearings
  };
  const leaf = (c: THREE.Color, x: number, z: number) => c.setHSL(.24 + Math.random() * .08 + (fbm(x * .05, z * .05, 2) - .5) * .06, .42 + Math.random() * .2, .15 + Math.random() * .1);
  ([[canopyGeo(5, 11, 1), 5200], [canopyGeo(3, 37, 1.5), 2200], [canopyGeo(4, 71, .6), 2600]] as const).forEach(([geo, n], i) =>
    scene.add(scatter(geo, treeMat, Math.round(n * Q), (x: number, z: number) => forestOK(x, z, i === 2 ? .9 : 1.4),
      () => i === 2 ? .7 + Math.random() * .6 : 1.2 + Math.random() * 1.1, leaf)));
  // boulders poking out of the forest on the slopes
  scene.add(scatter(rockGeo, rockMat, Math.round(110 * Q), (x: number, z: number) => {
    const h = land(x, z); return h > 1 && h < 6 && x < 34 && z > -20 && !nearLH(x, z) && normalAt(x, z).y < .82;
  }, () => .4 + Math.random() * .8, (c: THREE.Color) => granite(c, false), .35));

  /* ---------- granite boulder fields at the foot of the cliffs ---------- */
  function shoreRocks(geo: THREE.BufferGeometry, n: number, scaleFn: (h: number) => number, test: (x: number, z: number, h: number) => boolean) {
    const m = new THREE.InstancedMesh(geo, rockMat, n), o = new THREE.Object3D(), c = new THREE.Color(); let k = 0, tries = 0;
    while (k < n && tries++ < n * 80) {
      const x = -22 + Math.random() * 92, z = -52 + Math.random() * 84, h = land(x, z);
      if (!test(x, z, h)) continue;
      const s = scaleFn(h);
      o.position.set(x, Math.max(heightAt(x, z), -1.1) - s * .35, z);
      o.rotation.set((Math.random() - .5) * .6, Math.random() * 6.28, (Math.random() - .5) * .6);
      o.scale.set(s * (.8 + Math.random() * .5), s * (.6 + Math.random() * .6), s * (.8 + Math.random() * .5));
      o.updateMatrix(); m.setMatrixAt(k, o.matrix); m.setColorAt(k, granite(c, h < 0)); k++;
    }
    m.count = k; m.castShadow = m.receiveShadow = true; return m;
  }
  const cluster = (x: number, z: number) => fbm(x * .12 + 20, z * .12, 3);
  scene.add(shoreRocks(rockGeo, Math.round(560 * Q), (h: number) => .7 + Math.random() * Math.random() * 2.8 + (h > 0 ? .5 : 0), (x: number, z: number, h: number) => h > -1.5 && h < .9 && cluster(x, z) > .36));
  scene.add(shoreRocks(blockGeo, Math.round(420 * Q), () => .6 + Math.random() * 1.9, (x: number, z: number, h: number) => h > -1.2 && h < 1.4 && cluster(x, z) > .42));
  scene.add(shoreRocks(blockGeo, Math.round(800 * Q), () => .18 + Math.random() * .4, (_x: number, _z: number, h: number) => h > -.7 && h < .9));   // rubble

  /* ---------- sea stacks standing off the cape (the ocean draws foam around these) ---------- */
  const STONES: THREE.Vector3[] = [];
  for (let t = 0; t < 4000 && STONES.length < 8; t++) {
    const x = -14 + Math.random() * 44, z = -14 + Math.random() * 40, h = land(x, z);
    if (h < -1.3 && h > -2.1 && STONES.every(s => Math.hypot(s.x - x, s.y - z) > 4.5)) STONES.push(new THREE.Vector3(x, z, 1.1 + Math.random() * 1.7));
  }
  {
    const m = new THREE.InstancedMesh(blockGeo, rockMat, STONES.length), o = new THREE.Object3D(), c = new THREE.Color();
    STONES.forEach((s, i) => {
      o.position.set(s.x, -1, s.y); o.rotation.set((Math.random() - .5) * .3, Math.random() * 6.28, (Math.random() - .5) * .3);
      o.scale.set(s.z, s.z * (1.1 + Math.random() * 1.1), s.z * (.8 + Math.random() * .4));
      o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, granite(c, true));
    });
    m.castShadow = m.receiveShadow = true; scene.add(m);
  }
  const stoneU = Array.from({ length: 8 }, (_, i) => STONES[i] ? STONES[i].clone() : new THREE.Vector3(9999, 9999, 0));

  /* ================= lighthouse + keeper houses ================= */
  const lantern = new THREE.MeshStandardMaterial({ color: "#fff6d8", emissive: "#ffd27a", emissiveIntensity: .2 });
  const beamGroup = new THREE.Group();
  {
    const g = new THREE.Group(); g.position.copy(LH);
    const white = new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: .7 });
    const dark = new THREE.MeshStandardMaterial({ color: "#2f3034", roughness: .5, metalness: .3 });
    const roof = new THREE.MeshStandardMaterial({ color: "#a8402c", roughness: .8 });
    const add = (mesh: THREE.Mesh, y: number) => { mesh.position.y = y; mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh; };
    add(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, .5, 8), white), .25);
    add(new THREE.Mesh(new THREE.CylinderGeometry(.55, .82, 4.6, 8), white), 2.55);
    add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .14, 16), dark), 4.9);
    add(new THREE.Mesh(new THREE.TorusGeometry(.95, .025, 4, 24).rotateX(Math.PI / 2), dark), 5.2);
    add(new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .7, 12), lantern), 5.3);
    add(new THREE.Mesh(new THREE.ConeGeometry(.62, .6, 12), dark), 5.95);
    [[-2.3, .7, 0, 2.4], [2.2, -.5, 1.2, 1.8], [-1, -2.3, .4, 1.5]].forEach(([dx, dz, ry, w]) => {
      const house = new THREE.Group(); house.position.set(dx, 0, dz); house.rotation.y = ry;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, 1, 1.3), white); body.position.y = .5;
      const r = new THREE.Mesh(new THREE.ConeGeometry(w * .78, .7, 4), roof); r.position.y = 1.35; r.rotation.y = Math.PI / 4; r.scale.z = .7;
      [body, r].forEach(m => { m.castShadow = m.receiveShadow = true; house.add(m); });
      g.add(house);
    });
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uNight: nightU },
      vertexShader: `varying float vL; void main(){ vL = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform float uNight; varying float vL; void main(){ gl_FragColor = vec4(vec3(1.,.9,.65) * pow(vL, 2.4) * .5 * uNight, 1.); }`
    });
    const cone = new THREE.ConeGeometry(4.5, 80, 24, 1, true); cone.translate(0, -40, 0); cone.rotateZ(Math.PI / 2);
    beamGroup.add(new THREE.Mesh(cone, beamMat));
    const back = new THREE.Mesh(cone, beamMat); back.rotation.y = Math.PI; beamGroup.add(back);
    beamGroup.position.y = 5.3; g.add(beamGroup);
    scene.add(g);
  }
  const lampLight = new THREE.PointLight("#ffd27a", 0, 34, 1.6); lampLight.position.copy(LH).add(new THREE.Vector3(0, 5.3, 0)); scene.add(lampLight);

  /* ================= sky dome (gradient, sun/moon, clouds, stars) ================= */
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uNight: nightU, uTime: timeU, uSun: { value: sunDir } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: NOISE + SKY + `
      varying vec3 vP;
      float hash3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main(){
        vec3 d = normalize(vP); vec3 col = skyCol(d, true);
        float s = max(dot(d, uSun), 0.);
        col += mix(vec3(1., .85, .6), vec3(.9, .93, 1.), uNight) * smoothstep(.9986, .9993, s) * 1.5;
        vec3 q = floor(d * 260.);
        col += step(.9965, hash3(q)) * uNight * smoothstep(.04, .3, d.y) * (.55 + .45 * sin(uTime * 2. + hash3(q + 3.) * 40.));
        gl_FragColor = vec4(col, 1.);
      }`
  })));

  /* ================= ocean: Gerstner swell, ripples, foam, SSS, sky reflection ================= */
  const boatU = [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)];
  const ripples = Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -99, 0)); let ripI = 0;
  const fogU = { value: new THREE.Vector3() };
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(520, 520, Math.round(420 * Q), Math.round(420 * Q)).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { uNight: nightU, uTime: timeU, uSun: { value: sunDir }, uKey: { value: keyDir }, uRip: { value: ripples }, uFog: fogU, uStones: { value: stoneU }, uBoats: { value: boatU } },
    vertexShader: NOISE + GLSL_LAND + `
      uniform float uTime; uniform vec4 uRip[6];
      varying vec3 vW; varying vec3 vN; varying float vH; varying float vL;
      vec3 G(vec2 p, vec2 d, float L, float A, float steep, inout vec3 N){
        d = normalize(d); float k = 6.2831 / L, w = sqrt(9.8 * k) * .55, q = steep / (k * A * 5.);
        float f = k * dot(d, p) - w * uTime, c = cos(f), s = sin(f);
        N.x -= d.x * k * A * c; N.z -= d.y * k * A * c; N.y -= q * k * A * s;
        return vec3(q * A * d.x * c, A * s, q * A * d.y * c);
      }
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.); vec2 p = wp.xz;
        float L = land(p); vL = L;
        float shoal = 1. + smoothstep(-2.5, -.3, L) * .6;          // swell steepens as it reaches the rocks
        vec3 N = vec3(0., 1., 0.), D = vec3(0.);
        D += G(p, vec2(1., .55), 36., .55 * shoal, .55, N);
        D += G(p, vec2(.8, -.9), 22., .30, .5, N);
        D += G(p, vec2(-.3, 1.), 13.5, .17, .5, N);
        D += G(p, vec2(1., .15), 8.6, .09, .45, N);
        D += G(p, vec2(.35, .95), 6.2, .055, .4, N);
        for (int i = 0; i < 6; i++) {
          vec4 r = uRip[i]; float age = uTime - r.z;
          if (age > 0. && age < 7.) { float dd = distance(p, r.xy) - age * 7.; D.y += r.w * .9 * exp(-dd * dd * .08) * exp(-age * .55) * sin(dd * 1.4); }
        }
        wp.xyz += D; vH = D.y; vN = normalize(N); vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: NOISE + SKY + `
      uniform vec3 uFog, uKey; uniform vec3 uStones[8]; uniform vec4 uBoats[2];
      varying vec3 vW; varying vec3 vN; varying float vH; varying float vL;
      float ripple(vec2 q){ return fbm3(q * .45 + uTime * vec2(.06, .035)) + fbm3(q * .9 - uTime * vec2(.05, -.07)) * .5; }
      void main(){
        vec3 V = normalize(cameraPosition - vW); float dist = length(cameraPosition - vW);
        vec2 q = vW.xz; float e = .12, r0 = ripple(q);
        float detail = (1. - smoothstep(30., 160., dist)) * .9;
        vec3 N = normalize(vN + vec3(r0 - ripple(q + vec2(e, 0.)), 0., r0 - ripple(q + vec2(0., e))) / e * .22 * detail);
        float F = .02 + .98 * pow(1. - max(dot(N, V), 0.), 5.);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 refl = skyCol(R, false);
        float depth = smoothstep(-3., 0., vL);
        vec3 deep = mix(vec3(.015, .16, .26), vec3(.005, .03, .07), uNight);
        vec3 shallow = mix(vec3(.08, .50, .52), vec3(.02, .10, .15), uNight);
        vec3 body = mix(deep, shallow, depth * .9);
        body *= .75 + .4 * max(dot(N, uKey), 0.);
        float sss = pow(max(dot(V, -uSun) * .5 + .5, 0.), 3.) * smoothstep(0., .7, vH) * (1. - uNight);
        body += vec3(.05, .38, .34) * sss * .9;
        vec3 col = mix(body, refl, F);
        float glit = pow(max(dot(R, uSun), 0.), 380.) * 7. + pow(max(dot(R, uSun), 0.), 40.) * .35;
        col += glit * mix(vec3(1., .82, .55), vec3(.7, .8, 1.), uNight) * (1. - .5 * uNight);
        // foam: wash on the rocks, bands rolling in, broken crests
        float tex = fbm3(q * 1.5 + vec2(uTime * .15, 0.)) * .6 + fbm3(q * 4. - uTime * .2) * .4;
        float band = sin(vL * 4.2 - uTime * 1.5 + fbm3(q * .25) * 4.) * .5 + .5;
        float wash = smoothstep(-.5, -.05, vL + (tex - .5) * .5);
        float rolling = smoothstep(-1.6, -.4, vL) * smoothstep(.72, .95, band) * smoothstep(.35, .6, tex);
        float crest = smoothstep(.55, .85, vH + (tex - .5) * .4) * smoothstep(.45, .7, tex) * .7;
        float ring = 0.;
        for (int i = 0; i < 8; i++) {
          float dd = distance(vW.xz, uStones[i].xy) - uStones[i].z * .85;
          ring += smoothstep(1.8, -.2, dd) * (.55 + .45 * sin(dd * 3.2 - uTime * 2.4)) * smoothstep(.3, .55, tex + .15);
        }
        // boat wakes: a Kelvin-ish V behind each hull plus a churn at the stern
        float wake = 0.;
        for (int i = 0; i < 2; i++) {
          vec4 b = uBoats[i]; vec2 fw = vec2(sin(b.z), cos(b.z)), sd = vec2(fw.y, -fw.x);
          vec2 d = vW.xz - b.xy; float along = dot(d, fw), side = dot(d, sd);
          float behind = step(along, 1.5) * exp(along * .07) * b.w;
          float v = smoothstep(.9, 0., abs(abs(side) + along * .33)) * behind;
          float churn = smoothstep(1.6, 0., length(vec2(side * 1.3, along + 3.2))) * b.w;
          float hull = smoothstep(1.2, .2, length(vec2(side * .9, (along - .2) * .38)) - .9) * .8;
          wake += (v * .8 + churn + hull) * smoothstep(.3, .6, tex + .1);
        }
        float foam = clamp(wash + rolling + crest + ring + wake, 0., 1.);
        col = mix(col, vec3(.93, .96, .98) * (1. - uNight * .6), foam * .9);
        col = mix(col, uFog, smoothstep(70., 420., dist));
        gl_FragColor = vec4(col, 1.);
      }`
  }));
  ocean.receiveShadow = false;
  scene.add(ocean);

  /* ================= sea spray bursting on the cliffs ================= */
  {
    const spots: number[][] = STONES.map(s => [s.x, s.y, Math.random()]);
    for (let t = 0; t < 4000 && spots.length < 40; t++) {
      const x = -14 + Math.random() * 60, z = -30 + Math.random() * 50, h = land(x, z);
      if (h > -.6 && h < -.08 && x - z * .4 < 30 && cluster(x, z) > .36) spots.push([x, z, Math.random()]);
    }
    const N = Math.round(1400 * Q), aO = new Float32Array(N * 3), aV = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const [x, z, ph] = spots[i % spots.length];
      aO.set([x + (Math.random() - .5) * 1.6, .2, z + (Math.random() - .5) * 1.6], i * 3);
      aV.set([(Math.random() - .5) * 2.4, 3 + Math.random() * 4, (Math.random() - .5) * 2.4, ph + Math.random() * .04], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(aO, 3)); g.setAttribute("aV", new THREE.BufferAttribute(aV, 4));
    const spray = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: timeU, uNight: nightU, uPx: { value: renderer.getPixelRatio() } },
      vertexShader: `
        uniform float uTime, uPx; attribute vec4 aV; varying float vA;
        void main(){
          float cyc = 3.6, t = mod(uTime + aV.w * cyc, cyc), b = t / 1.4;
          vec3 p = position;
          if (b < 1.) { p += aV.xyz * t; p.y -= 4.4 * t * t; vA = (1. - b) * smoothstep(0., .08, b); } else { vA = 0.; }
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_PointSize = uPx * (9. + 26. * min(b, 1.)) / -mv.z * 6.;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uNight; varying float vA;
        void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard;
          gl_FragColor = vec4(vec3(.96, .98, 1.) * (1. - .6 * uNight), vA * smoothstep(.5, .05, d) * .55); }`
    }));
    spray.frustumCulled = false; scene.add(spray);
  }

  /* ================= seagulls circling the cape ================= */
  type Bird = { l: THREE.Mesh; r: THREE.Mesh; rad: number; y: number; sp: number; ph: number; f: number }
  const birds: THREE.Group[] = [];
  {
    const mat = new THREE.MeshBasicMaterial({ color: "#2a2b30", side: THREE.DoubleSide });
    const wing = new THREE.BufferGeometry();
    wing.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -.12, 0, 0, .14, .75, .06, 0], 3));
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Group(), l = new THREE.Mesh(wing, mat), r = new THREE.Mesh(wing, mat);
      r.scale.x = -1; b.add(l, r);
      b.userData = { l, r, rad: 10 + Math.random() * 14, y: 9 + Math.random() * 7, sp: .12 + Math.random() * .1, ph: Math.random() * 6.28, f: 7 + Math.random() * 3 };
      birds.push(b); scene.add(b);
    }
  }


  /* ================= fishing boats offshore (central-Vietnam style: blue hull, red trim, white cabin) ================= */
  const WAVES: Array<[number, number, number, number]> = [[1, .55, 36, .55], [.8, -.9, 22, .30], [-.3, 1, 13.5, .17], [1, .15, 8.6, .09], [.35, .95, 6.2, .055]];
  const waveH = (x: number, z: number, t: number) => {
    let h = 0
    for (const [dx, dz, L, A] of WAVES) {
      const l = Math.hypot(dx, dz), k = 6.2831 / L, w = Math.sqrt(9.8 * k) * .55
      h += A * Math.sin(k * (dx / l * x + dz / l * z) - w * t)
    }
    return h
  }
  function hullGeo() {
    // lofted cross-sections from stern (t=0) to a raised, pointed bow (t=1)
    const S = 14, pos: number[] = [], col: number[] = [], idx: number[] = []
    const blue = new THREE.Color("#1f5aa6"), red = new THREE.Color("#b8322a"), dark = new THREE.Color("#1b2430"), wood = new THREE.Color("#7a5a3a")
    const ring = (t: number) => {
      const z = (t - .5) * 6
      const w = 1.05 * Math.pow(Math.sin(Math.PI * (.22 + .78 * t)), .55) * (t > .9 ? (1 - t) / .1 * .6 + .4 : 1)
      const top = .55 + 1.1 * Math.pow(t, 4), keel = -.55 * Math.sin(Math.PI * Math.min(1, .15 + t))
      return [[-w, top, z], [-w * .92, .25, z], [-w * .55, -.2 + keel * .4, z], [0, keel, z], [w * .55, -.2 + keel * .4, z], [w * .92, .25, z], [w, top, z]]
    }
    const colorFor = (y: number, top: number) => (y > top - .18 ? red : y > -.15 ? blue : dark)
    for (let i = 0; i <= S; i++) {
      const t = i / S, r = ring(t)
      r.forEach(([x, y, z]) => { pos.push(x, y, z); colorFor(y, r[0][1]).toArray(col, col.length) })
    }
    for (let i = 0; i < S; i++) for (let j = 0; j < 6; j++) {
      const a = i * 7 + j, b = a + 1, c = a + 7, d = c + 1
      idx.push(a, c, b, b, c, d)
    }
    // deck (wood) as a fan over each section's gunwales
    const base = pos.length / 3
    for (let i = 0; i <= S; i++) {
      const r = ring(i / S)
      ;[r[0], r[6]].forEach(([x, y, z]) => { pos.push(x * .96, y - .12, z); wood.toArray(col, col.length) })
    }
    for (let i = 0; i < S; i++) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    // transom
    const r0 = ring(0), tb = pos.length / 3
    r0.forEach(([x, y, z]) => { pos.push(x, y, z); blue.toArray(col, col.length) })
    for (let j = 1; j < 6; j++) idx.push(tb, tb + j + 1, tb + j)
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx); g.computeVertexNormals(); return g
  }
  const boatHull = hullGeo()
  const hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, side: THREE.DoubleSide })
  const cabinMat = new THREE.MeshStandardMaterial({ color: "#eef0ee", roughness: .6 })
  const roofMat = new THREE.MeshStandardMaterial({ color: "#2c6fb7", roughness: .5 })
  const poleMat = new THREE.MeshStandardMaterial({ color: "#3a3a3a", roughness: .7 })
  const flagMat = new THREE.MeshStandardMaterial({ color: "#da251d", side: THREE.DoubleSide, emissive: "#3a0000" })
  const bulbMat = new THREE.MeshBasicMaterial({ color: "#6b6b66" })
  const glowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64
    const g = c.getContext("2d")!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, "rgba(255,248,220,1)"); gr.addColorStop(.25, "rgba(255,236,190,.55)"); gr.addColorStop(1, "rgba(255,230,180,0)")
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  })()
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false })

  function makeBoat() {
    const g = new THREE.Group(), add = <T extends THREE.Object3D>(o: T) => { o.castShadow = true; g.add(o); return o }
    add(new THREE.Mesh(boatHull, hullMat))
    const cabin = add(new THREE.Mesh(new THREE.BoxGeometry(1.3, .9, 1.4), cabinMat)); cabin.position.set(0, 1.05, -1.6)
    const roof = add(new THREE.Mesh(new THREE.BoxGeometry(1.5, .12, 1.65), roofMat)); roof.position.set(0, 1.56, -1.6)
    const win = add(new THREE.Mesh(new THREE.BoxGeometry(1.0, .22, .02), poleMat)); win.position.set(0, 1.2, -.89)
    const mast = add(new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 2.6), poleMat)); mast.position.set(0, 2.2, .6)
    const flag = add(new THREE.Mesh(new THREE.PlaneGeometry(.55, .36), flagMat)); flag.position.set(.28, 3.3, .6); flag.rotation.y = Math.PI / 2
    // squid-fishing light booms
    const boom = add(new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 5.2), poleMat)); boom.rotation.x = Math.PI / 2; boom.position.set(0, 2.05, .3)
    const glows: THREE.Sprite[] = []
    for (let i = 0; i < 7; i++) {
      const z = -2.2 + i * .75
      const b = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), bulbMat); b.position.set(0, 1.92, z); g.add(b)
      const s = new THREE.Sprite(glowMat); s.position.copy(b.position); s.scale.setScalar(1.6); g.add(s); glows.push(s)
    }
    const lamp = new THREE.PointLight("#ffeec8", 0, 14, 1.8); lamp.position.set(0, 1.8, 0); g.add(lamp)
    g.userData.lamp = lamp
    return g
  }
  // each boat drifts slowly along a long ellipse well offshore, always in view of the hero camera
  const BOATS = [
    { cx: -22, cz: 20, rx: 7, rz: 3, speed: .02, ph: 0, scale: 1.6, i: 0 },
    { cx: -58, cz: -40, rx: 10, rz: 5, speed: .012, ph: 2.4, scale: 1.8, i: 1 },
  ].map(b => { const g = makeBoat(); g.scale.setScalar(b.scale); scene.add(g); return { ...b, g } })
  const bulbDay = new THREE.Color("#6b6b66"), bulbNight = new THREE.Color("#fff6dc")
  const updateBoats = (t: number, n: number) => {
    bulbMat.color.copy(bulbDay).lerp(bulbNight, n); glowMat.opacity = n * .9
    for (const b of BOATS) {
      const a = t * b.speed + b.ph, x = b.cx + Math.cos(a) * b.rx, z = b.cz + Math.sin(a) * b.rz
      const heading = Math.atan2(-Math.sin(a) * b.rx, Math.cos(a) * b.rz)          // tangent of the path
      const fx = Math.sin(heading), fz = Math.cos(heading)
      const hc = waveH(x, z, t), hf = waveH(x + fx * 2.5, z + fz * 2.5, t), hs = waveH(x + fz * 1, z - fx * 1, t)
      b.g.position.set(x, hc - .25, z)
      b.g.rotation.set(0, heading, 0)
      b.g.rotateX(-Math.atan2(hf - hc, 2.5) * .8)                                     // pitch with the swell
      b.g.rotateZ(Math.atan2(hs - hc, 1) * .7 + Math.sin(t * 1.3 + b.ph) * .03)      // roll
      ;(b.g.userData.lamp as THREE.PointLight).intensity = n * 25
      boatU[b.i].set(x, z, heading, 1)
    }
  }

  /* ================= lights + fog ================= */
  const C = (h: string) => new THREE.Color(h);
  const fog = new THREE.Fog(0xffffff, 80, 420);
  const fogDay = new THREE.Color().setRGB(.97, .83, .68, THREE.SRGBColorSpace), fogNight = new THREE.Color().setRGB(.06, .09, .18, THREE.SRGBColorSpace);
  fog.color.copy(fogDay); scene.fog = fog;
  const hemi = new THREE.HemisphereLight("#ffe6c8", "#1e3a2c", 1.0); scene.add(hemi);
  const key = new THREE.DirectionalLight("#ffd6a0", 2.6);
  const keyTarget = new THREE.Vector3(18, 0, -18);
  key.position.copy(keyTarget).addScaledVector(keyDir, 150); key.target.position.copy(keyTarget);
  key.castShadow = true;
  key.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 10, far: 320 });
  key.shadow.bias = -.0004; key.shadow.normalBias = .06;
  scene.add(key, key.target);
  const PAL = { hemiSky: [C("#ffe6c8"), C("#5466a8")], hemiGnd: [C("#1e3a2c"), C("#04070a")], key: [C("#ffd6a0"), C("#9fb4ff")], keyI: [2.6, .35], hemiI: [1.0, .25] };

  /* ================= camera rig: fly-in, drag/parallax, scroll ================= */
  const base = { pos: new THREE.Vector3(-58, 16, 58), target: new THREE.Vector3(4, 6.5, -22) };
  // user orbit (kept after release, full 360°) + a small mouse-parallax layered on top
  type Drag = { x: number; y: number; lx: number; ly: number; t: number; moved: boolean }
  let intro = 1, scrollP = 0, drag: Drag | null = null;
  let yawU = 0, pitchU = 0, yawV = 0, pitchV = 0;        // user angles + release inertia
  let yaw = 0, pitch = 0, parX = 0, parY = 0, parXT = 0, parYT = 0;
  const PITCH_MIN = -.06, PITCH_MAX = .75, YAW_MIN = -1.45, YAW_MAX = 1.5;   // sea-facing arc around the cape
  on(host, "pointermove", e => {
    const r = host.getBoundingClientRect();
    if (drag) {
      const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly, now = performance.now(), dtm = Math.max(1, now - drag.t);
      const out = (yawU < YAW_MIN && dx > 0) || (yawU > YAW_MAX && dx < 0);
      yawU -= dx * .005 * (out ? .25 : 1); pitchU = Math.min(PITCH_MAX, Math.max(PITCH_MIN, pitchU + dy * .004));
      const cl = (v: number, m: number) => Math.max(-m, Math.min(m, v));
      yawV = cl(-dx * .005 / dtm * 16, .045); pitchV = cl(dy * .004 / dtm * 16, .02);
      drag.lx = e.clientX; drag.ly = e.clientY; drag.t = now;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
    } else if (e.pointerType === "mouse") {
      parXT = -((e.clientX - r.left) / r.width - .5) * .12; parYT = ((e.clientY - r.top) / r.height - .5) * .06;
    }
  });
  on(host, "pointerdown", e => {
    drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false };
    yawV = pitchV = 0; host.classList.add("grabbing");
  });
  on(window, "pointerup", e => {
    if (!drag) return;
    if (!drag.moved) { splash(e); yawV = pitchV = 0; }
    else onInteract();
    drag = null; host.classList.remove("grabbing");
  });
  on(host, "pointercancel", () => { drag = null; host.classList.remove("grabbing"); });
  on(host, "pointerleave", () => { parXT = parYT = 0; });
  on(host, "dblclick", () => { yawU = yawU % (Math.PI * 2); yawV = pitchV = 0; resetting = true; });   // back to the hero view
  let resetting = false, lift = 0;
  on(window, "scroll", () => { scrollP = Math.min(1, scrollY / host.offsetHeight); }, { passive: true });

  const ray = new THREE.Raycaster(), sea = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function splash(e: PointerEvent) {
    const r = host.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    if (!ray.ray.intersectPlane(sea, hit) || land(hit.x, hit.z) > -.2) return;
    ripples[ripI++ % 6].set(hit.x, hit.z, timeU.value, 1);
    onInteract();
  }

  /* ================= loop ================= */
  function size() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w < 640 ? 55 : 40; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(size); ro.observe(host); size();

  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(host);
  let last = performance.now();
  const tmp = new THREE.Vector3(), look = new THREE.Vector3();
  const ease = (t: number) => 1 - Math.pow(1 - t, 3), lerp = THREE.MathUtils.lerp;

  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now(), dt = Math.min((now - last) / 1000, .05); last = now;
    if (!visible) return;
    if (!reduce) timeU.value += dt;
    const t = timeU.value;
    nightU.value += ((document.documentElement.classList.contains("dark") ? 1 : 0) - nightU.value) * Math.min(1, dt * 2.2);
    const n = nightU.value;

    hemi.color.copy(PAL.hemiSky[0]).lerp(PAL.hemiSky[1], n);
    hemi.groundColor.copy(PAL.hemiGnd[0]).lerp(PAL.hemiGnd[1], n);
    hemi.intensity = lerp(PAL.hemiI[0], PAL.hemiI[1], n);
    key.color.copy(PAL.key[0]).lerp(PAL.key[1], n);
    key.intensity = lerp(PAL.keyI[0], PAL.keyI[1], n);
    fog.color.copy(fogDay).lerp(fogNight, n);
    fogU.value.set(lerp(.97, .06, n), lerp(.83, .09, n), lerp(.68, .18, n));
    lantern.emissiveIntensity = .2 + n * 3.5; lampLight.intensity = n * 70;
    beamGroup.rotation.y = t * .9;

    updateBoats(t, n)

    for (const b of birds) {
      const u = b.userData as Bird, a = t * u.sp + u.ph;
      b.position.set(LH.x + Math.cos(a) * u.rad, LH.y + u.y + Math.sin(t * .7 + u.ph) * .8, LH.z + Math.sin(a) * u.rad);
      b.rotation.y = -a; b.rotation.z = Math.sin(t * .5 + u.ph) * .15;
      const flap = Math.sin(t * u.f + u.ph) * .55 * (Math.sin(t * .9 + u.ph) > -.3 ? 1 : .1);   // flap, then glide
      u.l.rotation.z = flap; u.r.rotation.z = -flap;
    }

    intro = Math.min(1, intro + dt / 3.2);
    const k = ease(intro);
    if (!drag) {                                               // glide after release
      yawU += yawV; pitchU = Math.min(PITCH_MAX, Math.max(PITCH_MIN, pitchU + pitchV));
      yawV *= .92; pitchV *= .92;
      if (yawU < YAW_MIN) { yawU += (YAW_MIN - yawU) * .12; yawV = Math.max(yawV, 0); }      // soft bounce at the ends
      if (yawU > YAW_MAX) { yawU += (YAW_MAX - yawU) * .12; yawV = Math.min(yawV, 0); }
    }
    if (resetting) { yawU *= .9; pitchU *= .9; if (Math.abs(yawU) + Math.abs(pitchU) < .002) { yawU = pitchU = 0; resetting = false; } }
    parX += (parXT - parX) * .05; parY += (parYT - parY) * .05;
    yaw += (yawU + parX - yaw) * .12; pitch += (pitchU + parY - pitch) * .12;
    tmp.copy(base.pos).sub(base.target);
    const rad = tmp.length() * (1.35 - .35 * k) - scrollP * 14;
    const az = Math.atan2(tmp.x, tmp.z) + yaw - (1 - k) * .5;
    const el = Math.asin(tmp.y / tmp.length()) * (.25 + .75 * k) + pitch + scrollP * .25;
    camera.position.set(base.target.x + Math.sin(az) * Math.cos(el) * rad, base.target.y + Math.sin(el) * rad + .8, base.target.z + Math.cos(az) * Math.cos(el) * rad);
    look.copy(base.target); look.y += scrollP * 4;
    // never clip into the hills while orbiting behind the cape
    let minY = Math.max(1.6, heightAt(camera.position.x, camera.position.z) + 5);
    for (let f = .1; f < .75; f += .1) {                       // rise over any ridge between camera and the cape
      const sx = camera.position.x + (look.x - camera.position.x) * f, sz = camera.position.z + (look.z - camera.position.z) * f;
      minY = Math.max(minY, (heightAt(sx, sz) + 2.5 - look.y * f) / (1 - f));
    }
    const need = Math.min(minY, 75) - camera.position.y;
    lift += (Math.max(0, need) - lift) * .12; camera.position.y += lift;
    camera.lookAt(look);

    renderer.render(scene, camera);
  }
  let raf = 0, disposed = false
  renderer.compileAsync(scene, camera).catch(() => undefined).finally(() => {
    if (disposed) return
    raf = requestAnimationFrame(frame)
    requestAnimationFrame(() => requestAnimationFrame(onReady))
  })

  // dev-only: grab the current frame to regenerate the loading posters (public/assets/coast-*.webp)
  if (import.meta.env.DEV) {
    (window as unknown as { __coastPoster?: (w: number, h: number, fov?: number) => string }).__coastPoster = (w, h, fov = 40) => {
      const pr = renderer.getPixelRatio(), cw = host.clientWidth, ch = host.clientHeight
      renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = fov; camera.updateProjectionMatrix()
      renderer.render(scene, camera)
      const url = canvas.toDataURL("image/webp", .8)
      renderer.setPixelRatio(pr); renderer.setSize(cw, ch, false); size()
      return url
    }
  }

  return () => {
    disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); offs.forEach(f => f())
    scene.traverse(o => {
      const m = o as Partial<THREE.Mesh>
      m.geometry?.dispose()
      const mat = m.material
      ;(Array.isArray(mat) ? mat : mat ? [mat] : []).forEach(x => x.dispose())
    })
    renderer.dispose()
  }
}
