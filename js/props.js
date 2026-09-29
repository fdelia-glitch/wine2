// Props and nature: modelled furniture, household objects, grass fields and trees with wind.
// Everything is procedural geometry with PBR materials from art.js, sized in metres.
(function () {
  const G = window.G;
  const V3 = THREE.Vector3;
  const PI = Math.PI;
  const P = (G.props = {});
  const M = (c, kind, o = {}) => G.mat(c, Object.assign({ kind }, o));
  P.M = M;

  // ---------- geometry helpers ----------
  const mesh = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; };
  P.mesh = mesh;
  P.rbox = (w, h, d, mat, r) => mesh(G.rbox(w, h, d, r ?? Math.min(0.02, w / 4, h / 4, d / 4)), mat);
  P.lathe = (pts, seg = 40) => { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), seg); g.computeVertexNormals(); return g; };
  P.cyl = (rt, rb, h, mat, seg = 32) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  P.tube = (pts, r, mat, seg = 48, rs = 10) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p))), seg, r, rs), mat);
  // cushion: a rounded box whose top bulges (fabric volume)
  P.cushion = function (w, h, d, mat, puff = 0.25) {
    const g = new G.X.RoundedBoxGeometry(w, h, d, 4, Math.min(h * 0.45, w * 0.2, d * 0.2)).clone();
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / (w / 2), y = p.getY(i), z = p.getZ(i) / (d / 2);
      const bulge = (1 - x * x) * (1 - z * z);
      p.setY(i, y + Math.sign(y) * bulge * h * puff * (y > 0 ? 1 : 0.3));
      p.setX(i, p.getX(i) * (1 + 0.04 * (1 - Math.abs(y) / (h / 2)))); p.setZ(i, p.getZ(i) * (1 + 0.04 * (1 - Math.abs(y) / (h / 2))));
    }
    g.computeVertexNormals(); return mesh(g, mat);
  };
  P.group = (...kids) => { const g = new THREE.Group(); kids.forEach((k) => k && g.add(k)); return g; };
  const at = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; return o; };
  P.at = at;

  // ---------- canvas textures ----------
  P.canvasTex = function (w, h, draw, srgb = true) { const t = G.canvasTex(w, h, draw); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  let leafTex = null;
  function leafAtlas() {
    if (leafTex) return leafTex;
    // 2x2 atlas: broad leaf clusters (tree), long blade leaves (houseplant), small round leaves, fern
    leafTex = P.canvasTex(512, 512, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const leaf = (x, y, len, wid, ang, col) => { c.save(); c.translate(x, y); c.rotate(ang); const g = c.createLinearGradient(0, -wid, 0, wid); g.addColorStop(0, col[0]); g.addColorStop(0.5, col[1]); g.addColorStop(1, col[0]); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.45, -wid, len, 0); c.quadraticCurveTo(len * 0.45, wid, 0, 0); c.fill(); c.strokeStyle = 'rgba(255,255,230,0.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(2, 0); c.lineTo(len * 0.95, 0); c.stroke(); c.restore(); };
      const greens = [['#2f5a1e', '#4f8a2e'], ['#3a6b24', '#5f9c38'], ['#2a4f1c', '#46802a'], ['#44752a', '#6aa640']];
      // tile 0: tree leaf cluster
      for (let i = 0; i < 90; i++) { const a = Math.random() * PI * 2, r = Math.random() * 100; leaf(128 + Math.cos(a) * r * 0.9, 128 + Math.sin(a) * r * 0.9, 26 + Math.random() * 16, 9 + Math.random() * 4, Math.random() * PI * 2, greens[i % 4]); }
      // tile 1: long blade leaves from the bottom
      for (let i = 0; i < 9; i++) { const ang = -PI / 2 + (i - 4) * 0.22; leaf(384 + (i - 4) * 4, 250, 200 + Math.random() * 40, 14, ang, greens[(i + 1) % 4]); }
      // tile 2: small round leaves (shrub)
      for (let i = 0; i < 160; i++) { const a = Math.random() * PI * 2, r = Math.random() * 105; leaf(128 + Math.cos(a) * r, 384 + Math.sin(a) * r, 14 + Math.random() * 8, 7, Math.random() * PI * 2, greens[(i + 2) % 4]); }
      // tile 3: fern frond
      c.strokeStyle = '#355f22'; c.lineWidth = 3; c.beginPath(); c.moveTo(384, 500); c.quadraticCurveTo(380, 400, 384, 270); c.stroke();
      for (let i = 0; i < 22; i++) { const y = 490 - i * 10; const l = 70 * (1 - i / 24); leaf(384, y, l, 6, -0.35 - i * 0.01, greens[i % 4]); leaf(384, y, l, 6, PI + 0.35 + i * 0.01, greens[(i + 1) % 4]); }
    });
    leafTex.generateMipmaps = true; leafTex.minFilter = THREE.LinearMipmapLinearFilter;
    return leafTex;
  }
  P.leafAtlas = leafAtlas;

  // wind: shared uniform, applied to foliage vertex shaders
  P.wind = { value: 0 };
  function windify(mat, amt = 1, key = 'wind') {
    mat.userData.wind = true;
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.uniforms.uWindT = P.wind;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWindT;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            vec4 wp0 = modelMatrix * vec4(position, 1.0);
            #ifdef USE_INSTANCING
              wp0 = modelMatrix * instanceMatrix * vec4(position, 1.0);
            #endif
            float h = max(position.y, 0.0);
            float sway = sin(uWindT * 1.7 + wp0.x * 0.35 + wp0.z * 0.2) * 0.6 + sin(uWindT * 3.1 + wp0.x * 1.3 + wp0.z * 1.1) * 0.25;
            transformed.x += sway * ${amt.toFixed(3)} * h * h;
            transformed.z += sin(uWindT * 2.3 + wp0.z * 0.4) * ${(amt * 0.5).toFixed(3)} * h * h;
          }`);
    };
    const pk = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
    mat.customProgramCacheKey = () => pk() + key + amt;
    return mat;
  }
  P.windify = windify;

  // ---------- grass ----------
  // Instanced curved blades with colour variation, root darkening and wind. area: {x0,x1,z0,z1}; keep(x,z)->bool
  P.grassField = function (area, o = {}) {
    const n = o.count || 40000;
    const h = o.height || 0.28, w = o.width || 0.012;
    const seg = 4; const pos = [], uv = [], idx = [];
    for (let i = 0; i <= seg; i++) { const t = i / seg; const ww = w * (1 - t * 0.85); const bend = t * t * 0.3 * h; pos.push(-ww, t * h, bend, ww, t * h, bend); uv.push(0, t, 1, t); }
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    // normals point up-ish so blades shade like a lawn, not like cards
    const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 0.8, 0.6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide, vertexColors: false });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vGH;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGH = uv.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGH;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.35, 1.15, vGH);');
    };
    windify(mat, o.wind ?? 0.9, 'grass');
    const im = new THREE.InstancedMesh(g, mat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), e = new THREE.Euler(), s = new V3(), p = new V3();
    const cols = o.colors || [0x4f7f2a, 0x5d8f33, 0x6c9a3a, 0x7ea344, 0x4a7527, 0x8aa04a];
    let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) {
      const x = area.x0 + Math.random() * (area.x1 - area.x0), z = area.z0 + Math.random() * (area.z1 - area.z0);
      if (o.keep && !o.keep(x, z)) continue;
      const hs = (o.hScale ? o.hScale(x, z) : 1) * (0.55 + Math.random() * 0.8);
      e.set((Math.random() - 0.5) * 0.5, Math.random() * PI * 2, (Math.random() - 0.5) * 0.5); q.setFromEuler(e);
      s.set(1 + Math.random() * 0.6, hs, 1); p.set(x, o.y || 0, z);
      m4.compose(p, q, s); im.setMatrixAt(k, m4);
      c.setHex(cols[(Math.random() * cols.length) | 0]).multiplyScalar(0.85 + Math.random() * 0.3); im.setColorAt(k, c); k++;
    }
    im.count = k; im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false; im.userData.noAO = true; im.layers.set(1); // not drawn into planar reflections
    return im;
  };

  // ---------- trees ----------
  function branchGeo(start, dir, len, rad, depth, out, rng) {
    const end = start.clone().addScaledVector(dir, len);
    const mid = start.clone().lerp(end, 0.5).add(new V3((rng() - 0.5) * len * 0.15, 0, (rng() - 0.5) * len * 0.15));
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const g = new THREE.TubeGeometry(curve, 6, rad, 8, false);
    // taper along the tube
    const p = g.attributes.position; const cp = new V3();
    for (let i = 0; i < p.count; i++) { const seg = Math.floor(i / 9) / 6; curve.getPoint(Math.min(1, seg), cp); const v = new V3(p.getX(i), p.getY(i), p.getZ(i)).sub(cp).multiplyScalar(1 - seg * 0.35); p.setXYZ(i, cp.x + v.x, cp.y + v.y, cp.z + v.z); }
    g.computeVertexNormals(); out.geos.push(g);
    if (depth === 0 || len < 0.4) { out.tips.push(end); return; }
    const kids = depth > 2 ? 3 : 2 + (rng() < 0.5 ? 1 : 0);
    for (let i = 0; i < kids; i++) {
      const a = rng() * PI * 2; const spread = 0.5 + rng() * 0.45;
      const nd = dir.clone().multiplyScalar(Math.cos(spread)).add(new V3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(Math.sin(spread))).normalize(); nd.y = Math.max(nd.y, 0.15); nd.normalize();
      branchGeo(end.clone().lerp(start, rng() * 0.25), nd, len * (0.62 + rng() * 0.15), rad * 0.62, depth - 1, out, rng);
    }
  }
  function mulberry(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const treeCache = {};
  // A deciduous tree: tapered branching trunk with bark, foliage from leaf-cluster cards around the branch tips.
  P.tree = function (o = {}) {
    const seed = o.seed ?? 1; const key = seed + '|' + (o.height || 7);
    let T = treeCache[key];
    if (!T) {
      const rng = mulberry(seed * 9973 + 17);
      const H = o.height || 7;
      const out = { geos: [], tips: [] };
      branchGeo(new V3(0, 0, 0), new V3((rng() - 0.5) * 0.15, 1, (rng() - 0.5) * 0.15).normalize(), H * 0.42, H * 0.035, 4, out, rng);
      const wood = G.X.BufferGeometryUtils.mergeGeometries(out.geos.map((g) => { const ng = g.index ? g.toNonIndexed() : g; ng.deleteAttribute('uv'); return ng; }));
      // leaf cards: 3 crossed quads per cluster around tips
      const pos = [], uv = [], nor = [];
      const quad = (c, size, rx, ry) => {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0));
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
        const n = new V3(c.x, c.y - H * 0.55, c.z).normalize(); // spherical normals: foliage shades like a volume
        corners.forEach(([a, b]) => { const v = new V3(a * size, b * size, 0).applyQuaternion(q).add(c); pos.push(v.x, v.y, v.z); uv.push((a * 0.5 + 0.5) * 0.5, 0.5 + (b * 0.5 + 0.5) * 0.5); nor.push(n.x, n.y, n.z); });
      };
      for (const tip of out.tips) for (let j = 0; j < 4; j++) {
        const c = tip.clone().add(new V3((rng() - 0.5) * 1.2, (rng() - 0.3) * 0.9, (rng() - 0.5) * 1.2).multiplyScalar(H * 0.1));
        quad(c, H * (0.07 + rng() * 0.04), (rng() - 0.5) * 1.2, rng() * PI);
      }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); lg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      T = treeCache[key] = { wood, leaves: lg };
    }
    const g = new THREE.Group();
    const bark = M(0x6b5040, 'bark', { tile: 1.2 });
    const tr = mesh(T.wood, bark); g.add(tr);
    const lm = new THREE.MeshStandardMaterial({ map: leafAtlas(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: o.tint ?? 0xffffff });
    windify(lm, 0.012, 'leaf');
    const lv = mesh(T.leaves, lm); lv.castShadow = true; lv.customDepthMaterial = new THREE.MeshDepthMaterial({ map: leafAtlas(), alphaTest: 0.45, depthPacking: THREE.RGBADepthPacking }); lv.userData.noAO = false;
    g.add(lv);
    if (o.scale) g.scale.setScalar(o.scale);
    return g;
  };

  // houseplant: terracotta pot + blade leaves (or fern)
  P.plant = function (o = {}) {
    const g = new THREE.Group();
    const r = o.r || 0.22, h = o.h || 0.35;
    const pot = mesh(P.lathe([[r * 0.7, 0], [r * 0.95, h * 0.85], [r * 1.05, h * 0.86], [r * 1.05, h], [r * 0.9, h], [r * 0.88, h * 0.9]]), M(o.potColor ?? 0xb8643c, 'terracotta'));
    g.add(pot);
    const soil = mesh(new THREE.CircleGeometry(r * 0.88, 24), M(0x3b2a1c, 'soil', { tile: 0.3 }), false); soil.rotation.x = -PI / 2; soil.position.y = h * 0.9; g.add(soil);
    const lm = new THREE.MeshStandardMaterial({ map: leafAtlas(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 }); windify(lm, 0.05, 'plant');
    const pos = [], uv = [], nor = []; const fern = o.fern;
    const cards = o.cards || 9; const L = o.leafLen || 0.6;
    for (let i = 0; i < cards; i++) {
      const a = (i / cards) * PI * 2 + Math.random() * 0.4; const tilt = 0.25 + Math.random() * 0.4;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-tilt, a, 0, 'YXZ'));
      const u0 = fern ? 0.5 : 0.5, v0 = fern ? 0 : 0.5;
      const corners = [[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]];
      corners.forEach(([x, y]) => { const v = new V3(x * L * 0.35, y * L, 0).applyQuaternion(q); v.y += h * 0.9; pos.push(v.x, v.y, v.z); uv.push(u0 + (x * 0.5 + 0.5) * 0.5, v0 + y * 0.5); const n = new V3(Math.cos(a), 0.8, Math.sin(a)).normalize(); nor.push(n.x, n.y, n.z); });
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); lg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const lv = mesh(lg, lm); lv.customDepthMaterial = new THREE.MeshDepthMaterial({ map: leafAtlas(), alphaTest: 0.4, depthPacking: THREE.RGBADepthPacking }); g.add(lv);
    return g;
  };
  // shrub: round leaf-card ball
  P.shrub = function (r = 0.8, o = {}) {
    const g = new THREE.Group(); const pos = [], uv = [], nor = [];
    const n = o.cards || 40;
    for (let i = 0; i < n; i++) {
      const d = new V3(Math.random() - 0.5, Math.random() * 0.8 - 0.1, Math.random() - 0.5).normalize(); const c = d.clone().multiplyScalar(r * (0.55 + Math.random() * 0.4)); c.y += r * 0.6;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * PI, Math.random() * PI, 0)); const s = r * 0.55;
      [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { const v = new V3(a * s, b * s, 0).applyQuaternion(q).add(c); pos.push(v.x, v.y, v.z); uv.push((a * 0.5 + 0.5) * 0.5, (b * 0.5 + 0.5) * 0.5); nor.push(d.x, d.y + 0.3, d.z); });
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); lg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const lm = new THREE.MeshStandardMaterial({ map: leafAtlas(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7, color: o.tint ?? 0xffffff }); windify(lm, 0.02, 'shrub');
    const core = mesh(new THREE.SphereGeometry(r * 0.75, 16, 12), new THREE.MeshStandardMaterial({ color: 0x1f3a14, roughness: 1 })); core.position.y = r * 0.6; g.add(core);
    const lv = mesh(lg, lm); lv.customDepthMaterial = new THREE.MeshDepthMaterial({ map: leafAtlas(), alphaTest: 0.45, depthPacking: THREE.RGBADepthPacking }); g.add(lv);
    return g;
  };
  // ---------- furniture ----------
  // sofa facing +z, origin at floor centre
  P.sofa = function (w = 3.0, color = 0x6e3f27, kind = 'fabric') {
    const g = new THREE.Group(); const fab = M(color, kind, kind === 'fabric' ? { tile: 0.12 } : {}); const dark = M(new THREE.Color(color).multiplyScalar(0.8).getHex(), kind, kind === 'fabric' ? { tile: 0.12 } : {});
    const d = 1.0, armW = 0.24;
    g.add(at(P.rbox(w, 0.28, d, dark, 0.06), 0, 0.26, 0));
    g.add(at(P.rbox(w, 0.62, 0.26, dark, 0.1), 0, 0.62, -d / 2 + 0.13));
    [-1, 1].forEach((sd) => g.add(at(P.cushion(armW, 0.62, d, dark, 0.1), sd * (w / 2 - armW / 2), 0.4, 0)));
    const n = Math.max(2, Math.round((w - 2 * armW) / 0.85)); const cw = (w - 2 * armW) / n;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + armW + cw * (i + 0.5);
      g.add(at(P.cushion(cw - 0.02, 0.2, d - 0.3, fab, 0.35), x, 0.5, 0.1));
      const back = P.cushion(cw - 0.04, 0.5, 0.2, fab, 0.4); back.rotation.x = -0.18; g.add(at(back, x, 0.86, -d / 2 + 0.33));
    }
    const leg = M(0x2b2018, 'grain', { tile: 0.3 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(at(P.cyl(0.03, 0.022, 0.12, leg, 12), a * (w / 2 - 0.1), 0.06, b * (d / 2 - 0.1))));
    return g;
  };
  P.table = function (w, d, h, o = {}) {
    const g = new THREE.Group(); const wood = M(o.color ?? 0x7a5230, 'grain', { tile: 0.8 });
    const top = o.topMat || wood; const th = o.th ?? 0.05;
    g.add(at(P.rbox(w, th, d, top, 0.012), 0, h - th / 2, 0));
    if (o.apron !== false) g.add(at(P.rbox(w - 0.12, 0.08, d - 0.12, wood, 0.01), 0, h - th - 0.04, 0));
    const lr = o.legR ?? 0.035;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(at(P.cyl(lr, lr * 0.7, h - th, wood, 16), a * (w / 2 - 0.08), (h - th) / 2, b * (d / 2 - 0.08))));
    return g;
  };
  P.chair = function (color = 0x6d4a2e) {
    const g = new THREE.Group(); const wood = M(color, 'grain', { tile: 0.6 });
    g.add(at(P.rbox(0.45, 0.04, 0.45, wood, 0.01), 0, 0.46, 0));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(at(P.cyl(0.018, 0.015, 0.46, wood, 10), a * 0.19, 0.23, b * 0.19)));
    [-1, 1].forEach((a) => g.add(at(P.cyl(0.016, 0.018, 0.5, wood, 10), a * 0.19, 0.72, -0.19)));
    for (let i = 0; i < 3; i++) g.add(at(P.rbox(0.36, 0.05, 0.02, wood, 0.008), 0, 0.6 + i * 0.13, -0.19));
    return g;
  };
  P.rug = function (w, d, colors, round = false) {
    const tex = P.canvasTex(512, 512, (c, W, H) => {
      c.fillStyle = colors[0]; c.fillRect(0, 0, W, H);
      c.strokeStyle = colors[1]; c.lineWidth = 18; c.strokeRect(30, 30, W - 60, H - 60); c.lineWidth = 6; c.strokeRect(62, 62, W - 124, H - 124);
      c.fillStyle = colors[2]; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { c.save(); c.translate(100 + i * 62, 100 + j * 62); c.rotate(PI / 4); c.fillRect(-12, -12, 24, 24); c.restore(); }
      const id = c.getImageData(0, 0, W, H); for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 22; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; } c.putImageData(id, 0, 0);
    });
    const geo = round ? new THREE.CylinderGeometry(w / 2, w / 2, 0.015, 64) : G.rbox(w, 0.015, d, 0.006);
    const m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 1, sheen: 0.8, sheenRoughness: 0.7, sheenColor: new THREE.Color(colors[1]) });
    const mat = M(0xffffff, 'fabric', { tile: 0.05, unique: true }); mat.map = tex; mat.sheen = 0.8; mat.sheenRoughness = 0.8; mat.sheenColor = new THREE.Color(colors[0]);
    const r = mesh(geo, mat, false); r.position.y = 0.008; return r;
  };
  P.frame = function (tex, w, h, o = {}) {
    const g = new THREE.Group(); const fm = o.frameMat || M(o.frame ?? 0x3a2616, 'grain', { tile: 0.3 });
    const b = 0.05, dep = 0.035;
    g.add(at(P.rbox(w + 2 * b, b, dep, fm, 0.008), 0, h / 2 + b / 2, 0)); g.add(at(P.rbox(w + 2 * b, b, dep, fm, 0.008), 0, -h / 2 - b / 2, 0));
    g.add(at(P.rbox(b, h, dep, fm, 0.008), -w / 2 - b / 2, 0, 0)); g.add(at(P.rbox(b, h, dep, fm, 0.008), w / 2 + b / 2, 0, 0));
    const mat = o.mat !== false ? mesh(new THREE.PlaneGeometry(w, h), M(0xf4efe4, 'paper'), false) : null; if (mat) { mat.position.z = -0.005; g.add(mat); }
    const pic = mesh(new THREE.PlaneGeometry(w * (o.mat !== false ? 0.8 : 1), h * (o.mat !== false ? 0.8 : 1)), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), false); pic.position.z = 0.0; g.add(pic);
    const glass = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0.02, specularIntensity: 1, depthWrite: false }), false); glass.position.z = 0.012; g.add(glass);
    return g;
  };
  // painted landscape / abstract canvases for the walls
  P.painting = function (seed = 1, w = 1.2, h = 0.9, o = {}) {
    let r = seed * 9301 + 49297; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    const pal = [['#f3c98b', '#e59a5c', '#6f8fb0', '#3d5a45', '#2c3e33'], ['#cfe3f0', '#9cc3d9', '#5c8c6a', '#a8b870', '#e8d7a8'], ['#f6e2c4', '#d98b6a', '#8a4a5e', '#3a3a5a', '#f2b35a'], ['#e9efe6', '#b8cfd6', '#4f7b8c', '#c9a15a', '#23343d']][seed % 4];
    const tex = P.canvasTex(512, Math.round(512 * h / w), (c, W, H) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, pal[0]); g.addColorStop(0.55, pal[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,245,220,0.85)'; c.beginPath(); c.arc(W * (0.2 + rnd() * 0.6), H * (0.2 + rnd() * 0.15), W * 0.06, 0, 7); c.fill();
      for (let k = 0; k < 3; k++) {
        c.fillStyle = pal[2 + k]; c.beginPath(); const base = H * (0.45 + k * 0.17); c.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) c.lineTo(x, base - Math.sin(x * 0.01 * (1 + rnd() * 0.02) + k * 2 + seed) * H * 0.08 - Math.sin(x * 0.031 + k) * H * 0.03);
        c.lineTo(W, H); c.fill();
      }
      for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.06})`; const x = rnd() * W, y = rnd() * H; c.fillRect(x, y, 2 + rnd() * 8, 1 + rnd() * 3); }
    });
    return P.frame(tex, w, h, { frame: o.frame ?? 0x2f2218, mat: o.mat });
  };
  // gathered curtain panel: folds baked into the geometry, soft sheen fabric
  P.curtain = function (w, h, color, o = {}) {
    const geo = new THREE.PlaneGeometry(w, h, Math.max(12, Math.round(w * 26)), 8); const pos = geo.attributes.position;
    const folds = Math.max(3, Math.round(w * 5));
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); const t = (y + h / 2) / h; pos.setZ(i, Math.sin((x / w + 0.5) * folds * PI * 2) * (0.035 + 0.025 * (1 - t))); pos.setX(i, x * (0.82 + 0.18 * t)); }
    geo.computeVertexNormals();
    const m = mesh(geo, M(color, 'fabric', { tile: 0.4, side: THREE.DoubleSide }), true); m.position.y = h / 2;
    const g = new THREE.Group(); g.add(m);
    if (o.rod !== false) { const rod = P.cyl(0.015, 0.015, w + 0.3, M(0x3a3028, 'metal', { metal: 0.8, rough: 0.35 }), 10); rod.rotation.z = PI / 2; rod.position.set(0, h + 0.04, 0.02); g.add(rod); }
    return g;
  };
  P.wallShelf = function (w, items = []) {
    const g = new THREE.Group(); const wood = M(0x7a5436, 'grain', { tile: 0.4 });
    g.add(at(P.rbox(w, 0.035, 0.24, wood, 0.008), 0, 0, 0.12));
    const cols = [0xb8562e, 0x2f4f7a, 0xe8dcc0, 0x3f6b45, 0xc9a24a];
    let x = -w / 2 + 0.12;
    while (x < w / 2 - 0.12) {
      const k = Math.floor(Math.random() * 3);
      if (k === 0) { for (let b = 0; b < 4; b++) { const bh = 0.18 + Math.random() * 0.06; const bk = P.rbox(0.035, bh, 0.16, M(cols[(b + Math.floor(x * 7)) % 5], 'paper', { rough: 0.7 }), 0.004); at(bk, x + b * 0.04, 0.018 + bh / 2, 0.12); g.add(bk); } x += 0.24; }
      else if (k === 1) { const v = mesh(P.lathe([[0, 0], [0.05, 0], [0.06, 0.06], [0.04, 0.14], [0.025, 0.2], [0.03, 0.22]]), M(cols[Math.floor(Math.random() * 5)], 'terracotta', { rough: 0.35 })); at(v, x + 0.06, 0.018, 0.12); g.add(v); x += 0.2; }
      else { const p = P.plant({ r: 0.06, h: 0.08, leafLen: 0.16, cards: 7 }); at(p, x + 0.07, 0.018, 0.12); g.add(p); x += 0.22; }
    }
    return g;
  };
  P.bookshelf = function (w, h, d = 0.32, color = 0xefe9df) {
    const g = new THREE.Group(); const m = M(color, 'paint'); const t = 0.03;
    g.add(at(P.rbox(t, h, d, m, 0.005), -w / 2 + t / 2, h / 2, 0)); g.add(at(P.rbox(t, h, d, m, 0.005), w / 2 - t / 2, h / 2, 0));
    g.add(at(P.rbox(w, 0.01, d, m, 0.003), 0, h / 2, -d / 2 + 0.005));
    const shelves = Math.max(2, Math.round(h / 0.38));
    const bookCols = [0x8a2f2a, 0x2f4f7a, 0xc9a24a, 0x3f6b45, 0xe8dcc0, 0x5a3a5e, 0x2a2a2e, 0xb8562e];
    for (let i = 0; i <= shelves; i++) {
      const y = (i / shelves) * (h - t) + t / 2; g.add(at(P.rbox(w - 2 * t, t, d, m, 0.004), 0, y, 0));
      if (i === shelves) break;
      let x = -w / 2 + t + 0.02; const top = ((i + 1) / shelves) * (h - t) - 0.02;
      while (x < w / 2 - t - 0.08) {
        if (Math.random() < 0.08) { x += 0.12; continue; }
        const bw = 0.025 + Math.random() * 0.03, bh = Math.min(top - y - 0.02, 0.2 + Math.random() * 0.1), bd = d * (0.7 + Math.random() * 0.2);
        const b = P.rbox(bw, bh, bd, M(bookCols[(Math.random() * bookCols.length) | 0], 'paper', { rough: 0.7 }), 0.004); b.position.set(x + bw / 2, y + t / 2 + bh / 2, d / 2 - bd / 2 - 0.01); b.rotation.z = Math.random() < 0.1 ? 0.15 : 0; g.add(b); x += bw + 0.003;
      }
    }
    return g;
  };
  P.floorLamp = function (o = {}) {
    const g = new THREE.Group(); const metal = M(0x2b2b2e, 'metal', { rough: 0.4 });
    g.add(at(P.cyl(0.16, 0.18, 0.03, metal), 0, 0.015, 0)); g.add(at(P.cyl(0.012, 0.012, 1.5, metal, 10), 0, 0.77, 0));
    const shade = mesh(P.lathe([[0.2, 0], [0.14, 0.26], [0.139, 0.26], [0.199, 0]], 36), new THREE.MeshStandardMaterial({ color: 0xf6ead2, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffc98a, emissiveIntensity: 0.5 })); shade.position.y = 1.42; g.add(shade);
    if (o.light !== false) { const l = new THREE.PointLight(0xffc27a, 6, 7, 2); l.position.y = 1.5; g.add(l); }
    return g;
  };
  P.box = function (s = 0.6) { // cardboard box with tape
    const g = new THREE.Group(); const cb = M(0xb8905c, 'paper', { rough: 0.9, tile: 0.4 });
    g.add(at(P.rbox(s, s, s, cb, 0.012), 0, s / 2, 0));
    g.add(at(P.rbox(s * 0.2, 0.004, s + 0.004, M(0xcdb98a, 'plastic', { rough: 0.4 }), 0.001), 0, s + 0.001, 0));
    return g;
  };
  P.chessPiece = function (white, kind) {
    const m = new THREE.MeshPhysicalMaterial({ color: white ? 0xf1e8d6 : 0x2a211c, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    const S = 0.6;
    const prof = { p: [[0.1, 0], [0.1, 0.02], [0.07, 0.035], [0.045, 0.06], [0.03, 0.14], [0.05, 0.15], [0.05, 0.16], [0.035, 0.17], [0.05, 0.2], [0.035, 0.235], [0.001, 0.24]],
      k: [[0.12, 0], [0.12, 0.025], [0.085, 0.045], [0.055, 0.08], [0.04, 0.26], [0.07, 0.28], [0.07, 0.295], [0.05, 0.31], [0.06, 0.37], [0.03, 0.39], [0.001, 0.395]],
      n: [[0.11, 0], [0.11, 0.025], [0.08, 0.045], [0.06, 0.07], [0.06, 0.1], [0.001, 0.105]] }[kind];
    const g = new THREE.Group(); const body = mesh(P.lathe(prof.map(([r, y]) => [r * S, y * S * 1.6]), 32), m); g.add(body);
    if (kind === 'k') { g.add(at(P.rbox(0.015, 0.07, 0.015, m, 0.004), 0, 0.69, 0)); g.add(at(P.rbox(0.045, 0.015, 0.015, m, 0.004), 0, 0.69, 0)); }
    if (kind === 'n') { const shape = new THREE.Shape(); shape.moveTo(-0.04, 0); shape.lineTo(0.05, 0); shape.quadraticCurveTo(0.06, 0.12, 0.02, 0.2); shape.quadraticCurveTo(-0.06, 0.22, -0.08, 0.14); shape.lineTo(-0.02, 0.12); shape.quadraticCurveTo(-0.05, 0.06, -0.04, 0); const ex = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 3 }); ex.translate(0, 0, -0.025); g.add(at(mesh(ex, m), 0, 0.16, 0)); }
    return g;
  };
  P.guitar = function () {
    const g = new THREE.Group();
    const body = new THREE.Shape(); // acoustic outline
    const pts = []; for (let i = 0; i <= 64; i++) { const t = (i / 64) * PI * 2; const y = Math.sin(t); const waist = 1 - 0.18 * Math.exp(-((y - 0.15) ** 2) / 0.05); const lower = y < 0 ? 1.12 : 0.9; pts.push(new THREE.Vector2(Math.cos(t) * 0.19 * waist * lower, y * 0.25)); }
    body.setFromPoints(pts);
    const ex = new THREE.ExtrudeGeometry(body, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 3, curveSegments: 48 }); ex.translate(0, 0, -0.045);
    g.add(at(mesh(ex, M(0xa85a2a, 'grain', { tile: 0.4, rough: 0.25 })), 0, 0.3, 0));
    const hole = mesh(new THREE.CircleGeometry(0.05, 32), new THREE.MeshBasicMaterial({ color: 0x120a05 }), false); hole.position.set(0, 0.36, 0.056); g.add(hole);
    const neck = P.rbox(0.05, 0.5, 0.03, M(0x3b2616, 'grain', { tile: 0.3 }), 0.01); neck.position.set(0, 0.8, 0.03); g.add(neck);
    const head = P.rbox(0.07, 0.14, 0.02, M(0x2a1a10, 'grain'), 0.01); head.position.set(0, 1.12, 0.02); head.rotation.x = -0.2; g.add(head);
    for (let i = 0; i < 6; i++) { const s = mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.72, 4), M(0xd0d0d0, 'metal'), false); s.position.set(-0.015 + i * 0.006, 0.66, 0.05); g.add(s); }
    return g;
  };
  P.amp = function () { const g = new THREE.Group(); g.add(at(P.rbox(0.7, 0.8, 0.4, M(0x1e1e20, 'rubber', { tile: 0.2 }), 0.03), 0, 0.4, 0)); const grill = P.rbox(0.62, 0.52, 0.01, M(0x2e2c2a, 'fabric', { tile: 0.02 }), 0.004); grill.position.set(0, 0.34, 0.2); g.add(grill); const panel = P.rbox(0.62, 0.12, 0.01, M(0xc8b27a, 'metal', { rough: 0.35 }), 0.003); panel.position.set(0, 0.7, 0.2); g.add(panel); for (let i = 0; i < 5; i++) { const k = at(P.cyl(0.015, 0.015, 0.02, M(0x111111, 'plastic'), 12), -0.22 + i * 0.1, 0.7, 0.215); k.rotation.x = PI / 2; g.add(k); } return g; };
  P.tv = function (w = 1.8) { const g = new THREE.Group(); const h = w * 9 / 16; g.add(at(P.rbox(w, h, 0.05, M(0x121214, 'plastic', { rough: 0.3 }), 0.01), 0, 0, 0)); const scr = mesh(new THREE.PlaneGeometry(w - 0.03, h - 0.03), new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0x0c1420, emissiveIntensity: 0.4 }), false); scr.position.z = 0.026; g.add(scr); return g; };
  P.dogBed = function (color = 0x7d8fb3) { const g = new THREE.Group(); const f = M(color, 'fabric', { tile: 0.06 }); const ring = mesh(new THREE.TorusGeometry(0.62, 0.2, 20, 48), f); ring.rotation.x = PI / 2; ring.scale.z = 0.85; ring.position.y = 0.17; g.add(ring); const c = P.cushion(1.25, 0.12, 1.25, M(0xd4d8e2, 'fabric', { tile: 0.05 }), 0.3); c.scale.set(1, 1, 1); c.position.y = 0.07; g.add(c); return g; };
  P.cabinets = function (w, d = 0.62, h = 0.9, color = 0x44506a, top = 0xf2efe9) {
    const g = new THREE.Group(); const body = M(color, 'paint', { rough: 0.45 });
    g.add(at(P.rbox(w, h - 0.1, d, body, 0.01), 0, 0.1 + (h - 0.1) / 2, 0)); g.add(at(P.rbox(w - 0.04, 0.1, d - 0.08, M(0x1d1f24, 'paint'), 0.005), 0, 0.05, -0.02));
    const n = Math.max(1, Math.round(w / 0.6)); const dw = w / n;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + dw * (i + 0.5);
      const door = P.rbox(dw - 0.02, h - 0.2, 0.02, body, 0.006); door.position.set(x, 0.1 + (h - 0.14) / 2, d / 2 + 0.005); g.add(door);
      const inset = P.rbox(dw - 0.14, h - 0.34, 0.012, body, 0.004); inset.position.set(x, 0.1 + (h - 0.14) / 2, d / 2 + 0.01); g.add(inset);
      const hd = P.rbox(0.12, 0.012, 0.02, M(0xc0c4c8, 'metal', { rough: 0.25 }), 0.005); hd.position.set(x, h - 0.2, d / 2 + 0.03); g.add(hd);
    }
    const tm = M(top, 'stone', { tile: 1.2, rough: 0.25 }); g.add(at(P.rbox(w + 0.04, 0.04, d + 0.04, tm, 0.008), 0, h + 0.02, 0.0));
    return g;
  };
  P.fridge = function () { const g = new THREE.Group(); const m = M(0xe9ecee, 'metal', { rough: 0.3, metal: 0.6 }); g.add(at(P.rbox(0.8, 1.9, 0.72, m, 0.04), 0, 0.95, 0)); g.add(at(P.rbox(0.78, 0.008, 0.02, M(0x2a2c30, 'plastic'), 0.002), 0, 1.25, 0.37)); [1.55, 0.7].forEach((y) => g.add(at(P.rbox(0.025, 0.4, 0.04, M(0xbfc3c7, 'metal', { rough: 0.2 }), 0.01), 0.32, y, 0.39))); return g; };
  P.pizzaOven = function () {
    const g = new THREE.Group(); const brick = M(0xffffff, 'brick', { tile: 0.9 });
    g.add(at(P.rbox(1.6, 0.95, 1.6, brick, 0.02), 0, 0.475, 0)); g.add(at(P.rbox(1.7, 0.08, 1.7, M(0xd8d2c8, 'concrete'), 0.02), 0, 0.99, 0));
    const dome = mesh(new THREE.SphereGeometry(0.75, 40, 20, 0, PI * 2, 0, PI / 2), M(0xc9b8a4, 'plaster', { tile: 0.8 })); dome.position.y = 1.03; g.add(dome);
    const arch = new THREE.Shape(); arch.moveTo(-0.3, 0); arch.lineTo(0.3, 0); arch.lineTo(0.3, 0.22); arch.absarc(0, 0.22, 0.3, 0, PI, false); arch.lineTo(-0.3, 0);
    const hole = new THREE.Path(); hole.moveTo(-0.22, 0); hole.lineTo(0.22, 0); hole.lineTo(0.22, 0.2); hole.absarc(0, 0.2, 0.22, 0, PI, false); hole.lineTo(-0.22, 0); arch.holes.push(hole);
    const ag = new THREE.ExtrudeGeometry(arch, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 }); const a = mesh(ag, brick); a.position.set(0, 1.03, 0.66); g.add(a);
    const fire = mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ color: 0xff7a1a }), false); fire.position.set(0, 1.2, 0.64); g.add(fire);
    const dark = mesh(new THREE.PlaneGeometry(0.44, 0.35), new THREE.MeshBasicMaterial({ color: 0x1a0c06 }), false); dark.position.set(0, 1.2, 0.63); g.add(dark);
    const glow = new THREE.PointLight(0xff8a3a, 3, 4, 2); glow.position.set(0, 1.25, 0.95); g.add(glow);
    g.add(at(P.cyl(0.08, 0.1, 0.6, M(0x303033, 'metal', { rough: 0.5 })), 0, 2.0, -0.2));
    g.userData.fire = fire; g.userData.glow = glow; return g;
  };
  P.bed = function (w, l, color = 0x2d4f8a) { const g = new THREE.Group(); const wood = M(0xd9c7a8, 'grain', { tile: 0.6 }); g.add(at(P.rbox(w + 0.08, 0.3, l + 0.08, wood, 0.02), 0, 0.2, 0)); g.add(at(P.rbox(w + 0.08, 0.9, 0.06, wood, 0.02), 0, 0.45, -l / 2 - 0.02)); g.add(at(P.cushion(w, 0.2, l, M(0xf4f2ee, 'fabric', { tile: 0.08 }), 0.15), 0, 0.45, 0)); const duvet = P.cushion(w + 0.06, 0.12, l * 0.62, M(color, 'fabric', { tile: 0.08 }), 0.5); duvet.position.set(0, 0.57, l * 0.19); g.add(duvet); const pil = P.cushion(w * 0.7, 0.14, 0.4, M(0xf8f6f2, 'fabric', { tile: 0.06 }), 0.6); pil.position.set(0, 0.6, -l / 2 + 0.3); g.add(pil); return g; };
  P.monitor = function (tex) { const g = new THREE.Group(); const k = M(0x1b1b1f, 'plastic', { rough: 0.35 }); g.add(at(P.rbox(0.9, 0.52, 0.03, k, 0.01), 0, 0.42, 0)); g.add(at(P.rbox(0.06, 0.18, 0.04, k, 0.01), 0, 0.12, -0.03)); g.add(at(P.rbox(0.28, 0.015, 0.2, k, 0.006), 0, 0.01, -0.02)); const s = mesh(new THREE.PlaneGeometry(0.86, 0.48), new THREE.MeshBasicMaterial({ map: tex, toneMapped: true }), false); s.position.set(0, 0.42, 0.017); g.add(s); return g; };
  P.trunk = function (tex) { const g = new THREE.Group(); const leather = M(0x6b3f22, 'rubber', { tile: 0.3, rough: 0.55 }); const brass = M(0xc9a35a, 'metal', { rough: 0.3 });
    const b = P.rbox(1.6, 0.7, 0.9, leather, 0.04); b.position.y = 0.35; g.add(b);
    if (tex) { const st = mesh(new THREE.PlaneGeometry(1.4, 0.5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, transparent: true }), false); st.position.set(0, 0.36, 0.452); g.add(st); }
    [-0.6, 0.6].forEach((x) => { g.add(at(P.rbox(0.08, 0.72, 0.92, brass, 0.01), x, 0.36, 0)); });
    const lid = new THREE.Group(); lid.position.set(0, 0.7, -0.45); const lm = P.rbox(1.62, 0.16, 0.92, leather, 0.05); lm.position.set(0, 0.08, 0.45); lid.add(lm); [-0.6, 0.6].forEach((x) => lid.add(at(P.rbox(0.08, 0.17, 0.93, brass, 0.01), x, 0.08, 0.45))); g.add(lid);
    const clasp = P.rbox(0.1, 0.12, 0.03, brass, 0.01); clasp.position.set(0, 0.64, 0.46); g.add(clasp); g.userData.lid = lid; return g; };
  P.kettleGrill = function () { const g = new THREE.Group(); const enamel = new THREE.MeshPhysicalMaterial({ color: 0x151517, roughness: 0.35, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
    const bowl = mesh(new THREE.SphereGeometry(0.34, 40, 20, 0, PI * 2, PI / 2, PI / 2), enamel); bowl.position.y = 0.72; g.add(bowl);
    const lid = mesh(new THREE.SphereGeometry(0.345, 40, 20, 0, PI * 2, 0, PI * 0.42), enamel); lid.position.y = 0.73; g.add(lid);
    g.add(at(P.rbox(0.12, 0.03, 0.03, M(0x3a2a1c, 'grain'), 0.01), 0, 1.07, 0));
    [0, 2.1, 4.2].forEach((a) => { const l = P.cyl(0.012, 0.012, 0.75, M(0x6a6c70, 'metal', { rough: 0.3 }), 8); l.position.set(Math.cos(a) * 0.22, 0.36, Math.sin(a) * 0.22); l.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2); g.add(l); });
    return g; };
  // ---------- draw-call reduction ----------
  // Merge a prop's static meshes into one mesh per material (in the group's local space). Anything referenced from
  // g.userData or passed in `keep` stays separate so it can still animate. Foliage cards and wind-driven parts are skipped.
  P.compact = function (g, keepList = []) {
    const keep = new Set();
    [...Object.values(g.userData || {}), ...keepList].forEach((v) => { if (v && v.isObject3D) v.traverse((o) => keep.add(o)); });
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    const buckets = new Map();
    g.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || keep.has(o) || o.children.length || !o.visible) return;
      if (o.customDepthMaterial || o.userData.noAO || o.layers.mask !== 1 || Array.isArray(o.material) || o.material.userData.wind) return;
      for (let p = o.parent; p && p !== g; p = p.parent) if (keep.has(p) || !p.visible) return;
      const key = o.material.uuid + '|' + o.castShadow + '|' + o.receiveShadow + '|' + o.renderOrder;
      if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(o);
    });
    const m4 = new THREE.Matrix4();
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const geos = list.map((o) => {
        const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        const ge = new THREE.BufferGeometry(); const n = src.attributes.position.count;
        ge.setAttribute('position', src.attributes.position.clone()); if (src.attributes.normal) ge.setAttribute('normal', src.attributes.normal.clone());
        ge.setAttribute('uv', src.attributes.uv ? src.attributes.uv.clone() : new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
        m4.multiplyMatrices(inv, o.matrixWorld); ge.applyMatrix4(m4);
        if (m4.determinant() < 0) for (const k of ['position', 'normal', 'uv']) { const a = ge.attributes[k]; if (!a) continue; const s = a.itemSize; for (let t = 0; t < n; t += 3) for (let c = 0; c < s; c++) { const i1 = (t + 1) * s + c, i2 = (t + 2) * s + c; const tmp = a.array[i1]; a.array[i1] = a.array[i2]; a.array[i2] = tmp; } }
        if (!ge.attributes.normal) ge.computeVertexNormals();
        return ge;
      });
      const merged = G.X.BufferGeometryUtils.mergeGeometries(geos); if (!merged) continue;
      const o0 = list[0]; const mm = new THREE.Mesh(merged, o0.material); mm.castShadow = o0.castShadow; mm.receiveShadow = o0.receiveShadow; mm.renderOrder = o0.renderOrder;
      list.forEach((o) => o.parent.remove(o)); g.add(mm);
    }
    return g;
  };
  ['sofa', 'table', 'chair', 'frame', 'painting', 'wallShelf', 'bookshelf', 'floorLamp', 'box', 'guitar', 'amp', 'tv', 'dogBed', 'cabinets', 'fridge', 'pizzaOven', 'bed', 'monitor', 'trunk', 'kettleGrill', 'chessPiece'].forEach((k) => { const f = P[k]; if (f) P[k] = (...a) => P.compact(f(...a)); });
})();
