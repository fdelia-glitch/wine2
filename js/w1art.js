// World 1 hero props: backyard objects modelled at "shrunk family" scale (about 20x real size).
// Every builder returns a Group with its origin on the ground, sized to match the gameplay colliders in world1.js.
(function () {
  const G = window.G;
  const V3 = THREE.Vector3;
  const PI = Math.PI;
  const P = G.props;
  const A = (G.w1a = {});
  const M = (c, kind, o = {}) => G.mat(c, Object.assign({ kind }, o));
  const mesh = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; };
  const at = P.at;
  const merge = (geos) => G.X.BufferGeometryUtils.mergeGeometries(geos.map((g) => { const n = g.index ? g.toNonIndexed() : g; if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; }));

  // ---------- tennis ball: felt shell with the classic seam curve ----------
  A.tennisBall = function (r = 1.3) {
    const g = new THREE.Group();
    const felt = M(0xcfe03e, 'felt', { tile: 0.5 }); felt.sheen = 1; felt.sheenRoughness = 0.55; felt.sheenColor = new THREE.Color(0xf4ffb0);
    g.add(mesh(new THREE.SphereGeometry(r, 64, 48), felt));
    const b = 0.28, a = 1 - b, k = 2 * Math.sqrt(a * b);
    class Seam extends THREE.Curve { getPoint(t, o = new V3()) { const u = t * PI * 2; return o.set(a * Math.cos(u) + b * Math.cos(3 * u), a * Math.sin(u) - b * Math.sin(3 * u), k * Math.sin(2 * u)).multiplyScalar(r * 0.998); } }
    const seam = mesh(new THREE.TubeGeometry(new Seam(), 240, r * 0.028, 8, true), M(0xf3f1e6, 'rubber', { rough: 0.6 }), false);
    g.add(seam);
    return g;
  };

  // ---------- flower pot: terracotta lathe with a rolled rim and soil ----------
  A.flowerPot = function (r, h, o = {}) {
    const g = new THREE.Group();
    const prof = [[0.001, 0], [r * 0.8, 0], [r * 0.82, 0.04], [r * 0.95, h * 0.8], [r * 1.02, h * 0.805], [r * 1.1, h * 0.83], [r * 1.12, h * 0.97], [r * 1.09, h], [r * 0.95, h], [r * 0.93, h * 0.9]];
    const tint = new THREE.Color(o.color ?? 0xc0683f).offsetHSL((Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.05);
    g.add(mesh(P.lathe(prof, 64), M(tint.getHex(), 'terracotta', { tile: 1.6 })));
    const soil = mesh(new THREE.CircleGeometry(r * 0.94, 40), M(0x4a3322, 'soil', { tile: 2 }), false); soil.rotation.x = -PI / 2; soil.position.y = h - 0.06; g.add(soil);
    if (o.moss !== false) for (let i = 0; i < 5; i++) { const a = Math.random() * PI * 2; const s = P.shrub(0.35 + Math.random() * 0.2, { cards: 14, tint: 0x9fc070 }); s.position.set(Math.cos(a) * r * 0.8, h - 0.25, Math.sin(a) * r * 0.8); s.scale.y = 0.6; g.add(s); }
    return g;
  };

  // ---------- squeaky bone (pink rubber) lying along z ----------
  A.dogBone = function () {
    const shaft = new THREE.CylinderGeometry(0.72, 0.72, 5.2, 32, 8); shaft.rotateX(PI / 2);
    const p = shaft.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); const pinch = 1 - 0.12 * Math.cos((z / 2.6) * PI * 0.5) ** 2; p.setX(i, p.getX(i) * pinch); p.setY(i, p.getY(i) * pinch); }
    const parts = [shaft];
    [-2.9, 2.9].forEach((z) => [-0.75, 0.75].forEach((x) => { const s = new THREE.SphereGeometry(1.0, 32, 24); s.translate(x, 0, z); parts.push(s); }));
    const geo = merge(parts); geo.computeVertexNormals();
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xff9fb4, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.3, sheenColor: new THREE.Color(0xffd0e0) });
    const m = mesh(geo, mat); m.position.y = 0.95; const g = new THREE.Group(); g.add(m);
    return g;
  };

  // ---------- braided rope toy (three twisted strands, knotted ends with tassels) ----------
  A.ropeToy = function (len = 5.6) {
    const g = new THREE.Group(); const cols = [0x3a6fd8, 0xf2eee4, 0xd8412f]; const R = 0.2, w = 2.4;
    cols.forEach((c, k) => {
      class H extends THREE.Curve { getPoint(t, o = new V3()) { const x = (t - 0.5) * len; const a = x * w + (k * PI * 2) / 3; return o.set(x, 0.45 + Math.cos(a) * R, Math.sin(a) * R); } }
      g.add(mesh(new THREE.TubeGeometry(new H(), 160, 0.24, 10, false), M(c, 'fabric', { tile: 0.12 })));
    });
    const knotMat = M(0xe9e2d2, 'fabric', { tile: 0.12 });
    [-1, 1].forEach((s) => {
      const kn = mesh(new THREE.TorusKnotGeometry(0.38, 0.2, 96, 10, 2, 3), knotMat); kn.position.set(s * (len / 2 + 0.2), 0.55, 0); kn.rotation.y = PI / 2; g.add(kn);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * PI * 2; const dir = new V3(s, Math.cos(a) * 0.55, Math.sin(a) * 0.55).normalize(); const start = new V3(s * (len / 2 + 0.55), 0.55, 0);
        const end = start.clone().addScaledVector(dir, 0.9 + Math.random() * 0.4); end.y = Math.max(0.06, end.y - 0.35);
        const mid = start.clone().lerp(end, 0.5); mid.y += 0.1;
        g.add(mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(start, mid, end), 6, 0.05, 5, false), M(cols[i % 3], 'fabric', { tile: 0.1 }), false));
      }
    });
    return g;
  };

  // ---------- sneaker (toe towards -z), origin on the ground at the shoe centre ----------
  // widths/heights sized to the old sole (2.6 x 0.7 x 6) and upper (top at y 2.3) colliders
  A.sneaker = function (o = {}) {
    const g = new THREE.Group(); const L = 6, HL = L / 2;
    const hw = (z) => { const t = (z + HL) / L; const toe = Math.sqrt(Math.min(1, t / 0.16)); const heel = Math.sqrt(Math.min(1, (1 - t) / 0.08)); const body = 1.24 - 0.22 * Math.exp(-((t - 0.62) ** 2) / 0.02) - 0.08 * t; return Math.max(0.02, body * toe * heel); };
    // outsole + midsole: extruded outline
    const shape = new THREE.Shape(); const N = 60;
    for (let i = 0; i <= N; i++) { const z = -HL + (i / N) * L; const x = hw(z); if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z); }
    for (let i = N; i >= 0; i--) { const z = -HL + (i / N) * L; shape.lineTo(-hw(z), z); }
    const sole = (h, inset, y, mat) => { const e = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06 - inset, bevelSegments: 3, curveSegments: 4 }); e.rotateX(PI / 2); e.translate(0, y + h, 0); e.computeVertexNormals(); const m = mesh(e, mat); return m; };
    g.add(sole(0.14, 0, 0.0, M(0x4a3b30, 'rubber', { tile: 0.3 })));
    g.add(sole(0.46, 0.02, 0.16, M(0xf4f1ea, 'rubber', { tile: 0.5, rough: 0.55 })));
    // upper: lofted half-ellipse sections
    const top = (z) => { const t = (z + HL) / L; return 0.7 + (t < 0.35 ? 0.9 + 0.7 * (t / 0.35) : 1.6); };
    const upperGeo = (z0, z1, grow) => {
      const nu = 48, nv = 28; const pos = [], uv = [], idx = [];
      for (let i = 0; i <= nu; i++) {
        const z = z0 + (i / nu) * (z1 - z0); const w = hw(z) * 0.97 * grow; const t = (z + HL) / L;
        const endTaper = Math.min(Math.sqrt(Math.min(1, t / 0.07)), Math.sqrt(Math.min(1, (1 - t) / 0.05)));
        const hh = (top(z) - 0.62) * endTaper * grow;
        for (let j = 0; j <= nv; j++) { const th = (j / nv) * PI; let y = 0.62 + Math.sin(th) * hh; const x = Math.cos(th) * w; const collar = t > 0.55 ? 2.18 : 9; y = Math.min(y, collar); pos.push(x, y, z); uv.push(i / nu, j / nv); }
      }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ge.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); ge.setIndex(idx); ge.computeVertexNormals(); return ge;
    };
    const mesh1 = M(o.color ?? 0x2f64d8, 'fabric', { tile: 0.18, side: THREE.DoubleSide });
    g.add(mesh(upperGeo(-HL, HL, 1), mesh1));
    const leather = M(0xf1efe8, 'plastic', { tile: 0.6, rough: 0.45 });
    g.add(mesh(upperGeo(-HL, -HL + 1.5, 1.025), leather)); // toe cap
    g.add(mesh(upperGeo(HL - 1.6, HL, 1.03), leather)); // heel counter
    // collar opening + lining
    const lin = mesh(new THREE.CircleGeometry(1, 40), M(0x2a2622, 'fabric', { tile: 0.2 }), false); lin.rotation.x = -PI / 2; lin.scale.set(0.9, 1.35, 1); lin.position.set(0, 2.17, 1.7); g.add(lin);
    const rim = mesh(new THREE.TorusGeometry(1, 0.1, 10, 48), M(0x2a2622, 'fabric', { tile: 0.2 })); rim.rotation.x = PI / 2; rim.scale.set(0.92, 1.38, 1); rim.position.set(0, 2.19, 1.7); g.add(rim);
    // tongue
    const tg = new THREE.PlaneGeometry(1.2, 1.9, 6, 10); const tp = tg.attributes.position; for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), y = tp.getY(i); tp.setZ(i, -x * x * 0.35); } tg.computeVertexNormals();
    const tongue = mesh(tg, M(o.color ?? 0x2f64d8, 'fabric', { tile: 0.18, side: THREE.DoubleSide })); tongue.rotation.x = -PI / 2 + 0.35; tongue.position.set(0, 2.25, 0.3); g.add(tongue);
    // laces
    const laceM = M(0xfbfaf5, 'fabric', { tile: 0.08 });
    for (let i = 0; i < 5; i++) {
      const z = -1.0 + i * 0.42; const y = top(z) + 0.02; const w = hw(z) * 0.55;
      [[-1, 1], [1, -1]].forEach(([s0, s1], k) => { const c = new THREE.QuadraticBezierCurve3(new V3(s0 * w, y - 0.1, z - 0.1 + k * 0.2), new V3(0, y + 0.12, z), new V3(s1 * w, y - 0.1, z + 0.1 - k * 0.2)); g.add(mesh(new THREE.TubeGeometry(c, 10, 0.055, 6, false), laceM, false)); });
      [-1, 1].forEach((s) => { const e = mesh(new THREE.TorusGeometry(0.08, 0.03, 6, 12), M(0xb8b8b8, 'metal', { rough: 0.3 }), false); e.position.set(s * w * 1.08, y - 0.12, z); e.rotation.x = PI / 2; g.add(e); });
    }
    // side stripe
    const st = new THREE.Shape(); st.moveTo(0, 0); st.bezierCurveTo(0.6, 0.15, 1.6, 0.55, 2.6, 0.5); st.bezierCurveTo(1.6, 0.35, 0.8, 0.05, 0, 0);
    [-1, 1].forEach((s) => { const sm = mesh(new THREE.ShapeGeometry(st, 12), M(0xf4f1ea, 'plastic', { side: THREE.DoubleSide }), false); sm.rotation.y = s * PI / 2; sm.position.set(s * 1.235, 0.95, s > 0 ? 1.4 : -1.2); sm.scale.set(s > 0 ? 1 : -1, 1, 1); g.add(sm); });
    return g;
  };

  // ---------- plank fence built from instanced boards ----------
  // along x (axis 'x', z fixed) or along z; boards stand vertical, rails on the back side.
  A.fence = function (axis, fixed, a0, a1, h, o = {}) {
    const g = new THREE.Group(); const bw = o.boardW ?? 1.8, th = o.thick ?? 0.35, gap = 0.1;
    const n = Math.max(1, Math.round((a1 - a0) / bw));
    const geo = G.rbox(bw - gap, 1, th, 0.05);
    const mat = M(o.color ?? 0xb58a5e, 'wood', { tile: 3.5, swap: true });
    const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = true; im.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = a0 + (i + 0.5) * ((a1 - a0) / n); const hh = h * (1 + (Math.random() - 0.5) * 0.015);
      q.setFromEuler(new THREE.Euler(0, (axis === 'x' ? 0 : PI / 2) + (Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.012));
      m4.compose(axis === 'x' ? new V3(a, hh / 2, fixed) : new V3(fixed, hh / 2, a), q, new V3(1, hh, 1)); im.setMatrixAt(i, m4);
      c.setHSL(0.075 + (Math.random() - 0.5) * 0.02, 0.35 + Math.random() * 0.15, 0.62 + (Math.random() - 0.5) * 0.14); im.setColorAt(i, c);
    }
    g.add(im);
    const back = o.back ?? -1; const railM = M(0x9a7552, 'wood', { tile: 3, swap: false });
    [0.18, 0.78].forEach((f) => { const len = a1 - a0; const r = mesh(axis === 'x' ? G.rbox(len, 0.7, 0.45, 0.06) : G.rbox(0.45, 0.7, len, 0.06), railM); r.position.set(axis === 'x' ? (a0 + a1) / 2 : fixed + back * (th / 2 + 0.22), h * f, axis === 'x' ? fixed + back * (th / 2 + 0.22) : (a0 + a1) / 2); g.add(r); });
    return g;
  };

  // ---------- garden gate: boards + rails + Z brace + black hinges ----------
  A.gate = function (w, h) {
    const g = new THREE.Group(); const wood = M(0xd9b88c, 'wood', { tile: 3, swap: true });
    const n = Math.round(w / 1.5);
    for (let i = 0; i < n; i++) g.add(at(mesh(G.rbox(w / n - 0.08, h, 0.35, 0.05), wood), (i + 0.5) * (w / n), h / 2, 0));
    const railM = M(0xc9a57a, 'wood', { tile: 3 });
    [0.2, 0.8].forEach((f) => g.add(at(mesh(G.rbox(w - 0.2, 0.6, 0.3, 0.05), railM), w / 2, h * f, -0.3)));
    const dl = Math.hypot(w - 0.6, h * 0.6); const br = mesh(G.rbox(dl, 0.5, 0.28, 0.05), railM); br.position.set(w / 2, h / 2, -0.3); br.rotation.z = Math.atan2(h * 0.6, w - 0.6); g.add(br);
    const iron = M(0x26262a, 'metal', { rough: 0.55, metal: 0.8 });
    [0.2, 0.8].forEach((f) => { const hg = mesh(G.rbox(1.6, 0.25, 0.08, 0.02), iron); hg.position.set(0.8, h * f, 0.22); g.add(hg); });
    const latch = mesh(G.rbox(0.25, 0.9, 0.5, 0.05), iron); latch.position.set(w - 0.35, h * 0.5, 0.3); g.add(latch);
    const ring = mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 20), iron); ring.position.set(w - 0.35, h * 0.42, 0.55); g.add(ring);
    return g;
  };

  // ---------- dandelion seed head and clover ----------
  A.dandelion = function (hgt = 5) {
    const g = new THREE.Group(); const top = new V3(0.3, hgt, 0.2);
    const stem = new THREE.CatmullRomCurve3([new V3(0, 0, 0), new V3(0.05, hgt * 0.5, 0.1), top]);
    const sm = M(0x7aa24a, 'plastic', { rough: 0.6 }); g.add(mesh(new THREE.TubeGeometry(stem, 20, 0.07, 8, false), sm));
    const n = 220; const stalk = new THREE.CylinderGeometry(0.006, 0.006, 1, 3); stalk.translate(0, 0.5, 0);
    const tuft = new THREE.ConeGeometry(0.16, 0.16, 7, 1, true); tuft.rotateX(PI); tuft.translate(0, 1.05, 0);
    const imS = new THREE.InstancedMesh(stalk, new THREE.MeshStandardMaterial({ color: 0xf3f0e6, roughness: 0.8 }), n);
    const tm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
    const imT = new THREE.InstancedMesh(tuft, tm, n); imT.userData.noAO = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new V3(0, 1, 0);
    for (let i = 0; i < n; i++) { const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), phi = i * 2.39996; const d = new V3(Math.cos(phi) * r, y, Math.sin(phi) * r); q.setFromUnitVectors(up, d); m4.compose(top, q, new V3(1, 0.95 + Math.random() * 0.15, 1)); imS.setMatrixAt(i, m4); imT.setMatrixAt(i, m4); }
    g.add(imS, imT);
    const rec = mesh(new THREE.SphereGeometry(0.2, 16, 12), M(0x9a8a5a, 'plastic')); rec.position.copy(top); g.add(rec);
    return g;
  };
  A.clover = function (s = 1) {
    const g = new THREE.Group(); const lm = new THREE.MeshStandardMaterial({ color: 0x4d8f35, roughness: 0.55, side: THREE.DoubleSide });
    const heart = new THREE.Shape(); heart.moveTo(0, 0); heart.bezierCurveTo(0.35, 0.2, 0.75, 0.55, 0.62, 0.9); heart.bezierCurveTo(0.52, 1.1, 0.2, 1.08, 0, 0.85); heart.bezierCurveTo(-0.2, 1.08, -0.52, 1.1, -0.62, 0.9); heart.bezierCurveTo(-0.75, 0.55, -0.35, 0.2, 0, 0);
    const hg = new THREE.ShapeGeometry(heart, 10); hg.rotateX(-PI / 2); const hp = hg.attributes.position; for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), z = hp.getZ(i); hp.setY(i, -x * x * 0.3 + z * z * 0.08); } hg.computeVertexNormals();
    const stemH = 1.6 * s;
    g.add(mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new V3(0, 0, 0), new V3(0.1, stemH * 0.6, 0), new V3(0, stemH, 0)), 8, 0.05 * s, 6, false), lm));
    for (let j = 0; j < 3; j++) { const l = mesh(hg, lm); l.position.y = stemH; l.rotation.y = j * (PI * 2 / 3); l.rotation.x = -0.12; l.scale.setScalar(s); g.add(l); }
    return g;
  };

  // ---------- sunflower: stem, big leaves, Fibonacci seed disk, two petal rings ----------
  A.sunflowerHead = function (R = 2.1) {
    const g = new THREE.Group();
    const disk = mesh(new THREE.CylinderGeometry(R, R * 0.9, 0.45, 48), M(0x3a2414, 'soil', { tile: 0.4 })); g.add(disk);
    const n = 700; const seed = new THREE.SphereGeometry(0.075, 6, 4); seed.scale(1, 0.7, 1);
    const im = new THREE.InstancedMesh(seed, new THREE.MeshStandardMaterial({ roughness: 0.6 }), n);
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    for (let i = 0; i < n; i++) { const r = R * 0.95 * Math.sqrt(i / n), a = i * 2.39996; const y = 0.24 + 0.12 * (1 - (r / R) ** 2); m4.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r); im.setMatrixAt(i, m4); c.setHex(r < R * 0.35 ? 0x5a4a1a : 0x2a1a0e).multiplyScalar(0.8 + Math.random() * 0.4); im.setColorAt(i, c); }
    im.castShadow = false; g.add(im);
    const petal = new THREE.PlaneGeometry(0.9, 2.2, 4, 8); petal.translate(0, 1.1, 0); const pp = petal.attributes.position;
    for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i); const t = y / 2.2; pp.setX(i, x * Math.sin(Math.min(PI, t * PI * 1.05 + 0.15)) * 1.1); pp.setZ(i, -x * x * 0.5 + t * t * 0.4); }
    petal.computeVertexNormals();
    const pm = new THREE.MeshStandardMaterial({ color: 0xffbf1c, roughness: 0.55, side: THREE.DoubleSide, emissive: 0x3a2200, emissiveIntensity: 0.25 });
    [[0, 22, 1.0, 0.05], [0.14, 22, 0.9, 0.2]].forEach(([off, cnt, sc, tilt]) => {
      for (let i = 0; i < cnt; i++) { const a = ((i + off * cnt) / cnt) * PI * 2; const p = mesh(petal, pm, true); p.position.set(Math.cos(a) * R * 0.92, 0.12 - off, Math.sin(a) * R * 0.92); p.rotation.set(-PI / 2 + tilt + (Math.random() - 0.5) * 0.15, 0, 0); const holder = new THREE.Group(); holder.rotation.y = -a - PI / 2; holder.position.copy(p.position); p.position.set(0, 0, 0); holder.add(p); p.rotation.set(-PI / 2 + tilt, 0, (Math.random() - 0.5) * 0.12); p.scale.setScalar(sc * (0.9 + Math.random() * 0.2)); g.add(holder); }
    });
    const bract = mesh(new THREE.CylinderGeometry(R * 0.95, R * 0.4, 0.8, 32), M(0x4f7a2a, 'plastic', { rough: 0.7 })); bract.position.y = -0.55; g.add(bract);
    return g;
  };
  A.sunflowerStem = function (hgt) {
    const g = new THREE.Group(); const sm = M(0x5f8f35, 'plastic', { rough: 0.65 });
    const c = new THREE.CatmullRomCurve3([new V3(0, 0, 0), new V3(0.15, hgt * 0.4, 0.1), new V3(-0.1, hgt * 0.8, 0), new V3(0, hgt, 0)]);
    g.add(mesh(new THREE.TubeGeometry(c, 40, 0.34, 12, false), sm));
    const leaf = new THREE.Shape(); leaf.moveTo(0, 0); leaf.bezierCurveTo(1.2, 0.6, 1.4, 2.2, 0, 3.2); leaf.bezierCurveTo(-1.4, 2.2, -1.2, 0.6, 0, 0);
    const lg = new THREE.ShapeGeometry(leaf, 14); const lp = lg.attributes.position; for (let i = 0; i < lp.count; i++) { const x = lp.getX(i), y = lp.getY(i); lp.setZ(i, -x * x * 0.25 - y * y * 0.05); } lg.computeVertexNormals();
    const lm = new THREE.MeshStandardMaterial({ color: 0x4f8a2e, roughness: 0.6, side: THREE.DoubleSide }); P.windify(lm, 0.01, 'sfleaf');
    [[0.25, 0.3], [0.45, 2.4], [0.62, 4.4], [0.78, 1.2]].forEach(([f, a]) => { const l = mesh(lg, lm); const hold = new THREE.Group(); hold.position.set(0, hgt * f, 0); hold.rotation.y = a; l.rotation.x = -1.0; l.position.x = 0.25; hold.add(l); g.add(hold); });
    return g;
  };

  // ---------- water: layered scrolling normals, fresnel reflections from the sky ----------
  let waterNormal = null;
  function waterNormalTex() {
    if (waterNormal) return waterNormal;
    const S = 256; const h = new Float32Array(S * S);
    const waves = []; for (let i = 0; i < 18; i++) waves.push([1 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 7) - 3, Math.random() * 6, 1 / (1 + i * 0.3)]);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { let v = 0; for (const [fx, fy, ph, amp] of waves) v += Math.sin(((x * fx + y * fy) / S) * PI * 2 + ph) * amp; h[y * S + x] = v; }
    waterNormal = P.canvasTex(S, S, (c) => {
      const id = c.createImageData(S, S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const dx = h[y * S + ((x + 1) % S)] - h[y * S + ((x - 1 + S) % S)], dy = h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x]; const n = new V3(-dx * 0.6, -dy * 0.6, 1).normalize(); const i = (y * S + x) * 4; id.data[i] = (n.x * 0.5 + 0.5) * 255; id.data[i + 1] = (n.y * 0.5 + 0.5) * 255; id.data[i + 2] = (n.z * 0.5 + 0.5) * 255; id.data[i + 3] = 255; }
      c.putImageData(id, 0, 0);
    }, false);
    waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping; waterNormal.colorSpace = THREE.NoColorSpace;
    return waterNormal;
  }
  // planar-reflection water (three's Water addon) with our procedural normals; gives real reflections of fences and sky plus sun glints
  A.water = function (w, d, o = {}) {
    const nt = waterNormalTex(); nt.wrapS = nt.wrapT = THREE.RepeatWrapping;
    const wa = new G.X.Water(new THREE.PlaneGeometry(w, d), { textureWidth: o.res ?? 512, textureHeight: o.res ?? 512, waterNormals: nt, sunDirection: (G.sunDir || new V3(0.5, 0.6, 0.3)).clone().normalize(), sunColor: 0xfff1d6, waterColor: o.color ?? 0x1c4450, distortionScale: o.distortion ?? 2.2, alpha: 0.93, fog: !!G.scene.fog });
    // reflections cost a full scene render: skip when far away, and refresh every third frame on the fast setting
    const reflect = wa.onBeforeRender; const wp = new V3();
    wa.onBeforeRender = function (renderer, scene, camera, ...rest) { wa.getWorldPosition(wp); if (camera.position.distanceTo(wp) > 110) return; if (G.quality !== 'high' && (G.frameNo || 0) % 3) return; reflect.call(this, renderer, scene, camera, ...rest); };
    wa.material.uniforms.size.value = o.size ?? 0.35; wa.material.transparent = true; wa.userData.noAO = true; wa.rotation.x = -PI / 2;
    return wa;
  };
  A.waterMaterial = function (o = {}) {
    const nt = waterNormalTex().clone(); nt.needsUpdate = true; nt.repeat.set(o.repeat ?? 0.12, o.repeat ?? 0.12);
    const m = new THREE.MeshPhysicalMaterial({ color: o.color ?? 0x2f6b73, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.86, normalMap: nt, normalScale: new THREE.Vector2(0.55, 0.55), specularIntensity: 1, envMapIntensity: 1.6, ior: 1.33 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uT = P.wind;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT;')
        .replace('#include <normal_fragment_maps>', `
          vec3 mapN = (texture2D( normalMap, vNormalMapUv + uT * vec2(0.013, 0.007) ).xyz + texture2D( normalMap, vNormalMapUv * 1.9 + vec2(0.37, 0.11) - uT * vec2(0.009, 0.016) ).xyz) - 1.0;
          mapN.xy *= normalScale;
          normal = normalize( tbn * mapN );`);
    };
    m.customProgramCacheKey = () => 'water2';
    return m;
  };

  // ---------- small helpers for the level ----------
  A.mound = function () {
    const g = new THREE.Group(); const sm = M(0x6b4a2e, 'soil', { tile: 1.5 });
    const geo = new THREE.SphereGeometry(1, 32, 16, 0, PI * 2, 0, PI / 2); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 1 + 0.18 * Math.sin(x * 7 + z * 3) * Math.cos(z * 6 - x * 2) + 0.08 * Math.sin(x * 19 + z * 13); p.setXYZ(i, x * n, y * n * 0.45, z * n); }
    geo.computeVertexNormals();
    const m = mesh(geo, sm); m.scale.set(0.95, 1, 0.8); g.add(m);
    for (let i = 0; i < 9; i++) { const c = mesh(new THREE.DodecahedronGeometry(0.12 + Math.random() * 0.1, 0), sm); c.position.set((Math.random() - 0.5) * 2.2, 0.05, (Math.random() - 0.5) * 2); c.rotation.set(Math.random() * 3, Math.random() * 3, 0); g.add(c); }
    return g;
  };
  A.planter = function (w, h, d) {
    const g = new THREE.Group(); const wood = M(0x8a5a33, 'wood', { tile: 3, swap: true }); const dark = M(0x6a4428, 'wood', { tile: 3 });
    const rows = 4; for (let i = 0; i < rows; i++) { const y = (i + 0.5) * (h / rows);
      g.add(at(mesh(G.rbox(w, h / rows - 0.05, 0.2, 0.04), wood), 0, y, d / 2 - 0.1)); g.add(at(mesh(G.rbox(w, h / rows - 0.05, 0.2, 0.04), wood), 0, y, -d / 2 + 0.1));
      g.add(at(mesh(G.rbox(0.2, h / rows - 0.05, d - 0.4, 0.04), wood), w / 2 - 0.1, y, 0)); g.add(at(mesh(G.rbox(0.2, h / rows - 0.05, d - 0.4, 0.04), wood), -w / 2 + 0.1, y, 0)); }
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(at(mesh(G.rbox(0.35, h + 0.1, 0.35, 0.05), dark), a * (w / 2 - 0.05), (h + 0.1) / 2, b * (d / 2 - 0.05))));
    const soil = mesh(G.rbox(w - 0.4, 0.1, d - 0.4, 0.02), M(0x3f2a1b, 'soil', { tile: 1.2 })); soil.position.y = h - 0.15; g.add(soil);
    return g;
  };
  A.flower = function (color, s = 1) {
    const g = new THREE.Group(); const sm = M(0x4f8a2e, 'plastic', { rough: 0.6 });
    g.add(mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new V3(0, 0, 0), new V3(0.1, 0.4 * s, 0), new V3(0, 0.8 * s, 0)), 8, 0.04 * s, 5, false), sm));
    const pg = new THREE.SphereGeometry(0.22 * s, 12, 8); pg.scale(1, 0.35, 0.55); pg.translate(0.2 * s, 0, 0);
    const pm = new THREE.MeshStandardMaterial({ color, roughness: 0.5, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) { const p = mesh(pg, pm, false); p.position.y = 0.8 * s; p.rotation.set(0, (i / 6) * PI * 2, 0.25); g.add(p); }
    const c = mesh(new THREE.SphereGeometry(0.09 * s, 10, 8), M(0xffc21a, 'plastic')); c.position.y = 0.84 * s; g.add(c);
    return g;
  };
  A.hedge = function (r) { const s = P.shrub(r, { cards: 70, tint: 0xb8d89a }); return s; };
  ['tennisBall', 'flowerPot', 'ropeToy', 'sneaker', 'fence', 'gate', 'clover', 'sunflowerHead', 'mound', 'planter', 'flower'].forEach((k) => { const f = A[k]; A[k] = (...a) => P.compact(f(...a)); });
})();
