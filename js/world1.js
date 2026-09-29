// World 1: The Great Backyard Escape. Tutorial world with one gate per family member, secrets, and the Runaway Robo-Mower.
(function () {
  const G = window.G;
  const V3 = THREE.Vector3;
  const PI = Math.PI;
  const DECK_Y = 5.5;

  const WATER = [{ x0: -28, x1: 28, z0: -56, z1: -46 }, { x0: 9, x1: 18.6, z0: -71.6, z1: -62 }];
  const GATES = [ // z of each gate, where followers wait while it is closed
    { z: -30, wait: new V3(0, 0, -25), check: new V3(0, 0, 4) },
    { z: -46, wait: new V3(-2, 0, -42), check: new V3(0, 0, -37) },
    { z: -80, wait: new V3(0, 0, -76), check: new V3(0, 0, -60) },
    { z: -106, wait: new V3(-4, 0, -101), check: new V3(0, 0, -86) },
    { z: -134, wait: new V3(-4, DECK_Y, -117), check: new V3(-6, DECK_Y, -112) },
    { z: -157, wait: new V3(0, 0, -152), check: new V3(0, 0, -148) },
  ];

  const w1 = {
    id: 'world1', name: 'The Great Backyard Escape', song: 'world1', followers: true, killY: -2.5, ao: false,
    spawn: { pos: new V3(0, 0, 6), facing: PI },
  };

  // ---------- helpers ----------
  // surfaces use the triplanar PBR library (see art.js); tiles are in metres at the shrunk-family scale
  const plankTex = () => 'plank', brickTex = () => 'brick';
  function texMat(kind, rx, ry, color = 0xffffff) {
    if (kind === 'brick') return G.mat(0xffffff, { kind: 'brick', tile: 7 });
    return G.mat(color === 0xffffff ? 0xc79b68 : color, { kind: 'wood', tile: 7, swap: true });
  }
  function frameTex(label, bg, fg) {
    return G.canvasTex(160, 120, (c, w, h) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText(label, w / 2, h / 2 + 8); c.strokeStyle = '#fff'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12); });
  }

  // ---------- build ----------
  w1.build = function () {
    const grp = G.levelGroup; const self = this;
    this.state = { gates: 0, dug: {}, boards: 5, bridge: false, sprinklerOff: false, stairs: false, iceMelt: 0, grillOn: false, boss: 'idle', planterMoved: false, zoom: null, talked: {} };
    this.movers = []; this.pickups = []; this.sparks = []; this.squirrels = []; this.digSpots = []; this.coils = []; this.doughs = [];
    G.scene.fog = new THREE.Fog(0xcfe0ee, 150, 460);
    grp.add(G.setSky({ sun: new V3(-0.8, 0.5, -0.05), envIntensity: 0.6, sunIntensity: 3.0, sunColor: 0xfff0d8, exposure: 0.95, clouds: 0.35, ground: 0x587a3a }));
    G.hemi.color.set(0xeaf3ff); G.hemi.groundColor.set(0x4f6a30); G.hemi.intensity = 0.35;
    for (let i = 0; i < 12; i++) { const c = G.makeCloud(G.rand(2.5, 5)); c.position.set(G.rand(-150, 150), G.rand(55, 90), G.rand(-250, 60)); grp.add(c); }
    // lawn
    // lawn slab with the river cut out; its side walls become the muddy banks
    const ls = new THREE.Shape([new THREE.Vector2(-40, -50), new THREE.Vector2(40, -50), new THREE.Vector2(40, 250), new THREE.Vector2(-40, 250)]);
    WATER.forEach((w) => ls.holes.push(new THREE.Path([new THREE.Vector2(w.x0, -w.z0), new THREE.Vector2(w.x0, -w.z1), new THREE.Vector2(w.x1, -w.z1), new THREE.Vector2(w.x1, -w.z0)])));
    const lg = new THREE.ExtrudeGeometry(ls, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 3, curveSegments: 2 }); lg.rotateX(-PI / 2); lg.translate(0, -1.55, 0);
    const lawn = new THREE.Mesh(lg, [G.mat(0x6fb04e, { kind: 'lawn', tile: 7 }), G.mat(0x4a3826, { kind: 'soil', tile: 3 })]);
    lawn.receiveShadow = true; grp.add(lawn);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), G.mat(0x5a8f40, { kind: 'lawn', tile: 9 })); far.rotation.x = -PI / 2; far.position.y = -1.5; grp.add(far);
    this.buildBounds(grp); this.buildGrass(grp);
    this.buildZone0(grp); this.buildZone1(grp); this.buildZone2(grp); this.buildDeck(grp); this.buildArena(grp);
    // water
    this.waters = WATER.map((w, i) => { const m = G.w1a.water(w.x1 - w.x0, w.z1 - w.z0, { res: i ? 256 : 512 }); m.position.set((w.x0 + w.x1) / 2, -0.7, (w.z0 + w.z1) / 2); grp.add(m); return m; });
    WATER.forEach((w) => { // muddy banks
      const bank = new THREE.Mesh(new THREE.BoxGeometry(w.x1 - w.x0, 3, w.z1 - w.z0), G.mat(0x3b2e22, { kind: 'soil', tile: 4 })); bank.position.set((w.x0 + w.x1) / 2, -2.3, (w.z0 + w.z1) / 2); grp.add(bank);
    });
    // pebbles along the banks
    WATER.forEach((w) => { for (let i = 0; i < (w.x1 - w.x0) * 1.2; i++) { const side = i % 2 ? w.z0 : w.z1; const r = G.rand(0.25, 0.8); const st = G.mesh(new THREE.DodecahedronGeometry(r, 1), [0x8d8a82, 0x9f978a, 0x7b776f][i % 3], { kind: 'stone', tile: 2 }); st.scale.y = 0.5; st.position.set(G.rand(w.x0, w.x1), 0.05, side + G.rand(-0.6, 0.6)); st.rotation.y = G.rand(0, 6); grp.add(st); } });
  };
  G.groundAtW1 = function (x, z) { for (const w of WATER) if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1) return null; return 0; };

  w1.buildBounds = function (grp) {
    // giant house wall behind spawn
    const brick = texMat(brickTex(), 12, 6);
    const house = new THREE.Mesh(new THREE.BoxGeometry(80, 40, 2), brick); house.position.set(0, 20, 15); house.receiveShadow = true; grp.add(house);
    G.addCol(-40, 0, 14, 40, 40, 16);
    const door = G.mesh(G.rbox(10, 20, 0.6, 0.1), 0xf1ece2, { kind: 'paint' }); door.position.set(0, 10, 13.8); grp.add(door);
    const dPanel = G.mat(0xe9e3d6, { kind: 'paint' });
    [[-2.5, 15, 3.6, 6.5], [2.5, 15, 3.6, 6.5], [-2.5, 5.5, 3.6, 8.5], [2.5, 5.5, 3.6, 8.5]].forEach(([x, y, w, h]) => { const pn = new THREE.Mesh(G.rbox(w, h, 0.3, 0.12), dPanel); pn.position.set(x, y, 13.45); pn.castShadow = true; grp.add(pn); });
    const trimM = G.mat(0xf6f2ea, { kind: 'paint' });
    [[-5.8, 10.6, 1.4, 21.2], [5.8, 10.6, 1.4, 21.2], [0, 21, 13, 1.4]].forEach(([x, y, w, h]) => { const t = new THREE.Mesh(G.rbox(w, h, 0.9, 0.12), trimM); t.position.set(x, y, 13.7); t.castShadow = true; grp.add(t); });
    const knobM = G.mat(0xc9a052, { kind: 'metal', rough: 0.25 });
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), knobM); knob.position.set(3.6, 9.5, 12.9); grp.add(knob);
    const plate = new THREE.Mesh(G.rbox(0.8, 2.6, 0.12, 0.05), knobM); plate.position.set(3.6, 9.2, 13.4); grp.add(plate);
    const step = G.mesh(G.rbox(16, 1.2, 4, 0.15), 0xb9b3a8, { kind: 'concrete', tile: 6 }); step.position.set(0, -0.45, 12.2); grp.add(step);
    [-22, 22].forEach((x) => {
      const win = new THREE.Group(); win.position.set(x, 18, 13.7); grp.add(win);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), new THREE.MeshPhysicalMaterial({ color: 0x9fb8c8, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.5 })); glass.position.z = -0.2; win.add(glass);
      [[0, 5.3, 13.4, 0.8], [0, -5.3, 13.4, 0.8], [-6.3, 0, 0.8, 11.4], [6.3, 0, 0.8, 11.4], [0, 0, 0.35, 10], [0, 0, 12, 0.35]].forEach(([wx, wy, w, h]) => { const f = new THREE.Mesh(G.rbox(w, h, 0.6, 0.08), trimM); f.position.set(wx, wy, 0); f.castShadow = true; win.add(f); });
      const sill = new THREE.Mesh(G.rbox(14.5, 0.6, 1.6, 0.1), trimM); sill.position.set(0, -5.9, -0.5); win.add(sill);
    });
    const pipeM = G.mat(0xdedad2, { kind: 'paint', rough: 0.4 });
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 38, 16), pipeM); pipe.position.set(-32, 19.5, 13.3); pipe.castShadow = true; grp.add(pipe);
    for (let i = 0; i < 4; i++) { const cl = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.1, 6, 16), pipeM); cl.rotation.x = PI / 2; cl.position.set(-32, 4 + i * 10, 13.3); grp.add(cl); }
    const dpg = new THREE.Group(); dpg.position.set(0, 2.2, 13.5); grp.add(dpg);
    const dp = new THREE.Mesh(new THREE.CircleGeometry(1.8, 36), new THREE.MeshBasicMaterial({ color: 0x9dff5c, transparent: true, opacity: 0.45, side: THREE.DoubleSide })); dpg.add(dp);
    const dpr = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.08, 6, 36), new THREE.MeshBasicMaterial({ color: 0x9dff5c })); dpg.add(dpr); this.homePortal = dpr;
    G.addInteract({ pos: new V3(0, 0, 12), radius: 2.6, label: () => 'Return to the house', onUse: () => G.game.goHome() });
    // side fences (giant planks)
    [-28, 28].forEach((x) => { grp.add(G.w1a.fence('z', x + Math.sign(x) * 0.5, -160, 14, 12, { back: Math.sign(x) })); G.addCol(x + (x < 0 ? -1 : 0), 0, -160, x + (x < 0 ? 0 : 1), 30, 14); });
  };

  w1.buildGrass = function (grp) {
    // giant lawn blades (real grass at the shrunk-family scale), kept low along the main path so it stays readable
    const keep = (x, z) => G.groundAtW1(x, z) !== null && !(z < -105 && z > -141 && Math.abs(x) < 21) && !(z > -95.8 && z < -94.2 && Math.abs(x) < 1.5);
    const hScale = (x, z) => { const ax = Math.abs(x); return ax < 4 ? 0.14 : ax < 8 ? 0.14 + (ax - 4) * 0.17 : 0.82; };
    grp.add(G.props.grassField({ x0: -27.5, x1: 27.5, z0: -200, z1: 12 }, { count: 70000, height: 1.9, width: 0.055, wind: 0.02, keep, hScale, colors: [0x4a7a28, 0x578a2e, 0x679838, 0x76a23f, 0x44702a, 0x86a848] }));
    for (let i = 0; i < 26; i++) {
      const x = G.rand(-25, 25), z = G.rand(-150, 5); if (Math.abs(x) < 6 || G.groundAtW1(x, z) === null || (z < -105 && z > -141)) continue;
      if (i % 3 === 0) { const d = G.w1a.dandelion(G.rand(4, 5.5)); d.position.set(x, 0, z); d.rotation.y = G.rand(0, 6); grp.add(d); }
      else for (let j = 0; j < 4; j++) { const c = G.w1a.clover(G.rand(0.9, 1.3)); c.position.set(x + G.rand(-1.2, 1.2), 0, z + G.rand(-1.2, 1.2)); c.rotation.y = G.rand(0, 6); grp.add(c); }
    }
  };

  // ---------- sparks & pickups ----------
  w1.spark = function (grp, x, y, z) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0x36e0ff }));
    m.position.set(x, y + 0.7, z); grp.add(m); this.sparks.push({ m, base: y + 0.7, alive: true });
  };
  w1.sparkLine = function (grp, a, b, n) { for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1); this.spark(grp, G.lerp(a[0], b[0], t), G.lerp(a[1], b[1], t), G.lerp(a[2], b[2], t)); } };
  w1.pickup = function (grp, id, kind, pos, title, sub, build) {
    if (G.save.got[id]) return null;
    const g = build(); g.position.copy(pos); grp.add(g);
    const p = { id, kind, g, pos: pos.clone(), title, sub, alive: true, t: Math.random() * 6 };
    this.pickups.push(p); return p;
  };
  function photoModel(tex) {
    const g = new THREE.Group(); const f = G.mesh(G.geo.box, 0xe2ac3f, { std: true, metal: 0.6, rough: 0.35 }); f.scale.set(1.3, 1.0, 0.1); g.add(f);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshBasicMaterial({ map: tex })); p.position.z = 0.06; g.add(p);
    const p2 = p.clone(); p2.rotation.y = PI; p2.position.z = -0.06; g.add(p2);
    const l = new THREE.PointLight(0xffe7a0, 0.8, 5); g.add(l); return g;
  }
  function moundModel() {
    const g = G.w1a.mound();
    const bone = G.mesh(new THREE.CapsuleGeometry(0.07, 0.5, 4, 10), 0xf4ecd8, { kind: 'plastic' }); bone.rotation.z = 1.2; bone.position.set(0.3, 0.4, 0); g.add(bone);
    return g;
  }
  w1.digSpot = function (grp, id, pos, item, onDug) {
    const done = G.save.got[id] && !onDug; if (done) return;
    const m = moundModel(); m.position.copy(pos); grp.add(m);
    const spot = { id, pos: pos.clone(), mesh: m, dug: false, item, onDug };
    this.digSpots.push(spot);
    G.addInteract({ pos: spot.pos, radius: 2.0, enabled: () => !spot.dug, label: (ch) => (ch.id === 'luigi' ? 'Dig' : 'Something is buried here'), onUse: (ch) => {
      if (ch.id !== 'luigi') { G.bubble(ch.id, { frank: "I'm not digging with my hands. Luigi?", elba: 'This is a Luigi job.', luca: 'Statistically, Luigi buried this.', ludo: 'Luigi! Your turn! Dig dig dig!' }[ch.id]); return; }
      spot.dug = true; ch.action = 'dig'; ch.actionT = 0; G.audio.play('dig');
      let n = 0; const iv = setInterval(() => { G.burst(spot.pos.clone().add(new V3(0, 0.3, 0)), 0x7a5533, 6, { speed: 4, size: 0.14, life: 0.7, upBias: 3 }); if (++n > 6) clearInterval(iv); }, 150);
      setTimeout(() => { grp.remove(m); if (onDug) onDug(); if (item) G.game.collect(item.id, 'treasure', item.title, item.sub); }, 1100);
    } });
  };

  // ---------- Zone 0: the patio ----------
  w1.buildZone0 = function (grp) {
    const self = this;
    // giant sneaker
    const shoe = G.w1a.sneaker(); shoe.position.set(-12, 0, 1); shoe.rotation.y = 0.04; grp.add(shoe);
    G.addCol(-13.3, 0, -2, -10.7, 0.7, 4); G.addCol(-13.15, 0.7, -0.3, -10.85, 2.3, 3.9);
    this.sparkLine(grp, [-12, 2.3, 3.3], [-12, 2.3, 0.3], 4);
    // tennis balls (bark or chop sends them rolling)
    this.balls = [[6, -3], [10, -8]].map(([x, z]) => {
      const g = new THREE.Group(); const b = G.w1a.tennisBall(1.3); b.rotation.set(G.rand(0, 3), G.rand(0, 3), 0); g.add(b);
      g.position.set(x, 1.3, z); grp.add(g);
      const col = G.addCol(x - 1, 0, z - 1, x + 1, 2.4, z + 1); return { g, col, vel: new V3() };
    });
    // flower pot stack with Family Photo #1
    [[15, -12, 1.6, 1.7], [18, -15.5, 3.0, 1.6], [15, -19, 4.4, 1.6]].forEach(([x, z, h, r]) => {
      const pot = G.w1a.flowerPot(r, h); pot.position.set(x, 0, z); pot.rotation.y = G.rand(0, 6); grp.add(pot);
      G.addCol(x - r * 0.85, 0, z - r * 0.85, x + r * 0.85, h, z + r * 0.85);
      this.spark(grp, x, h, z);
    });
    this.pickup(grp, 'w1_photo1', 'photo', new V3(15, 5.6, -19), 'Family photo', 'The Great Pizza Oven Test', () => photoModel(frameTex('PIZZA TEST', '#e9b86a', '#7a2b16')));
    // squeaky bone & rope toy
    const bone = new THREE.Group(); bone.position.set(-17, 0, -14); grp.add(bone);
    bone.add(G.w1a.dogBone()); bone.rotation.y = 0.05;
    G.addCol(-18.8, 0, -18, -15.2, 1.7, -10, { onBump: () => {} });
    const boneCol = G.cols[G.cols.length - 1]; boneCol.squeak = true;
    this.sparkLine(grp, [-17, 1.7, -17], [-17, 1.7, -11], 4);
    const rope = new THREE.Group(); rope.position.set(20, 0, -2); grp.add(rope);
    { const rt = G.w1a.ropeToy(5.4); rt.position.set(-0.2, 0, -1.2); rt.rotation.y = -0.27; rope.add(rt); }
    G.addCol(16.5, 0, -2.5, 23.5, 0.9, 0);
    // big tree with squirrels
    const oak = G.props.tree({ seed: 4, height: 44 }); oak.position.set(-22, 0, -24); grp.add(oak);
    G.addCol(-24, 0, -26, -20, 30, -22);
    this.tree = new V3(-22, 0, -24);
    for (let i = 0; i < 2; i++) this.squirrels.push(this.makeSquirrel(grp, new V3(-14 + i * 6, 0, -20 + i * 3)));
    // path sparks
    this.sparkLine(grp, [0, 0, 2], [0, 0, -8], 5); this.sparkLine(grp, [2, 0, -12], [6, 0, -22], 5);
    // Luigi treasure 1 (the sock)
    this.digSpot(grp, 'w1_treasure1', new V3(-15, 0, -5), { id: 'w1_treasure1', title: 'Luigi treasure', sub: "Frank's missing sock (slightly used)" });
    // zoomies challenge pad
    const pad = new THREE.Group(); pad.position.set(-4, 0.02, -8); grp.add(pad);
    const pd = new THREE.Mesh(new THREE.CircleGeometry(1.4, 30), new THREE.MeshBasicMaterial({ color: 0xffe14a })); pd.rotation.x = -PI / 2; pad.add(pd);
    const paw = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0xd8743a })); paw.rotation.x = -PI / 2; paw.position.set(0, 0.01, 0.15); pad.add(paw);
    [[-0.45, -0.45], [-0.15, -0.65], [0.15, -0.65], [0.45, -0.45]].forEach(([x, z]) => { const t = new THREE.Mesh(new THREE.CircleGeometry(0.17, 12), new THREE.MeshBasicMaterial({ color: 0xd8743a })); t.rotation.x = -PI / 2; t.position.set(x, 0.01, z); pad.add(t); });
    G.addInteract({ pos: new V3(-4, 0, -8), radius: 1.8, enabled: () => !this.state.zoom, label: (ch) => (ch.id === 'luigi' ? 'Start the Zoomies Challenge' : 'Zoomies Challenge (Luigi only)'), onUse: (ch) => {
      if (ch.id !== 'luigi') { G.bubble(ch.id, { frank: "I don't have zoomies. I have a bad knee.", elba: 'That paw print is clearly for Luigi.', luca: 'Only one of us is built for this.', ludo: "I tried. I'm dizzy." }[ch.id]); return; }
      this.startZoomChallenge(grp);
    } });
    // fence gate A
    const fm = texMat(plankTex(), 8, 1);
    const fenceSeg = (x0, x1, y0, y1) => { if (y0 === 0) grp.add(G.w1a.fence('x', -30, x0, x1, y1, { back: -1, boardW: 1.6 })); else { const m = new THREE.Mesh(G.rbox(x1 - x0, y1 - y0, 0.35, 0.05), fm); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, -30); m.castShadow = true; m.receiveShadow = true; grp.add(m); } G.addCol(x0, y0, -30.4, x1, y1, -29.6); };
    fenceSeg(-28, -3, 0, 5.2); fenceSeg(3, 7.2, 0, 5.2); fenceSeg(8.8, 28, 0, 5.2); fenceSeg(7.2, 8.8, 0.95, 5.2);
    G.addCol(7.2, 0, -30.4, 8.8, 0.95, -29.6, { bigOnly: true });
    this.fenceDirt = G.addCol(7.2, 0, -30.6, 8.8, 0.95, -29.4);
    const dirt = G.mesh(G.rbox(1.6, 0.95, 0.9, 0.2), 0x6b4a2e, { kind: 'soil', tile: 2 }); dirt.position.set(8, 0.47, -30); grp.add(dirt); this.fenceDirtMesh = dirt;
    const hole = G.mesh(new THREE.CircleGeometry(0.75, 20, 0, PI), 0x1a120b, { basic: true }); hole.position.set(8, 0.02, -29.55); hole.visible = false; grp.add(hole); this.fenceHole = hole;
    const gate = new THREE.Group(); gate.position.set(-3, 0, -30); grp.add(gate);
    gate.add(G.w1a.gate(6, 5.2));
    this.gateA = { g: gate, col: G.addCol(-3, 0, -30.3, 3, 5.2, -29.7), open: 0 };
    this.digSpot(grp, 'w1_fence', new V3(8, 0, -28.9), null, () => {
      this.fenceDirt.active = false; this.fenceDirtMesh.visible = false; this.fenceHole.visible = true;
      G.bubble('luigi', '*squeezes under the fence*', 2.6); G.game.setObjective('Go through the tunnel, then bark (F) at the wind chime to open the gate.');
    });
    // wind chime (sound switch)
    const chime = new THREE.Group(); chime.position.set(-1, 0, -35); grp.add(chime);
    const pole = G.mesh(G.geo.cyl, 0x6b4a2e, { kind: 'grain', tile: 1 }); pole.scale.set(0.12, 4, 0.12); pole.position.y = 2; chime.add(pole);
    const arm = G.mesh(G.geo.box, 0x6b4a2e, { kind: 'grain', tile: 1 }); arm.scale.set(2.2, 0.12, 0.12); arm.position.set(0.9, 4, 0); chime.add(arm);
    this.chimeTubes = [];
    for (let i = 0; i < 5; i++) { const t = G.mesh(G.geo.cyl, 0xc9d3dc, { std: true, metal: 0.8, rough: 0.25 }); t.scale.set(0.07, 0.8 + i * 0.2, 0.07); t.position.set(0.2 + i * 0.35, 3.5 - i * 0.1, 0); chime.add(t); this.chimeTubes.push(t); }
    G.addCol(-1.2, 0, -35.2, -0.8, 4, -34.8);
    this.chime = new V3(-0.1, 0, -35);
    this.sparkLine(grp, [8, 0, -32], [2, 0, -35], 3);
  };

  w1.makeSquirrel = function (grp, pos) {
    const g = new THREE.Group(); g.position.copy(pos); grp.add(g);
    const b = G.mesh(G.geo.sphere, 0x8a6a52); b.scale.set(0.35, 0.3, 0.45); b.position.y = 0.35; g.add(b);
    const h = G.mesh(G.geo.sphere, 0x8a6a52); h.scale.setScalar(0.22); h.position.set(0, 0.6, 0.35); g.add(h);
    [-1, 1].forEach((s) => { const e = G.mesh(G.geo.sphere, 0x111111); e.scale.setScalar(0.04); e.position.set(s * 0.1, 0.66, 0.53); g.add(e); const ear = G.mesh(G.geo.cone, 0x8a6a52); ear.scale.set(0.06, 0.14, 0.06); ear.position.set(s * 0.1, 0.83, 0.33); g.add(ear); });
    const tail = G.mesh(G.geo.sphere, 0xa3805f); tail.scale.set(0.2, 0.55, 0.25); tail.position.set(0, 0.7, -0.4); tail.rotation.x = -0.4; g.add(tail);
    return { g, tail, home: pos.clone(), state: 'idle', t: G.rand(1, 3), vel: new V3(), climbY: 0 };
  };

  w1.startZoomChallenge = function (grp) {
    const pts = []; const n = 22;
    for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2; pts.push(new V3(-4 + Math.sin(a) * 14, 0.8, -12 + Math.sin(a * 2) * 7)); }
    const tokens = pts.map((p) => { const m = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.1, 6, 18), new THREE.MeshBasicMaterial({ color: 0xffe14a })); m.position.copy(p); grp.add(m); return { m, alive: true }; });
    this.state.zoom = { tokens, t: 16, got: 0 };
    G.toast('Zoomies Challenge!', 'Grab all 22 rings in 16 seconds. Shift for zoomies.'); G.audio.play('fanfare');
    G.bubble('frank', "He's got that look in his eye.", 2.5);
  };

  // ---------- Zone 1: the hose river ----------
  w1.buildZone1 = function (grp) {
    // giant garden hose along the near bank, leaking
    const hoseMat = G.mat(0x2d8a45, { kind: 'rubber', tile: 1.2, rough: 0.38 });
    const curve = new THREE.CatmullRomCurve3([new V3(-30, 0.6, -40), new V3(-18, 0.6, -43), new V3(-8, 0.6, -41), new V3(-3, 0.6, -43.5), new V3(4, 0.6, -44.2), new V3(20, 0.6, -43.5), new V3(30, 0.6, -45)]);
    const hose = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.6, 18, false), hoseMat); hose.receiveShadow = true; hose.castShadow = true; grp.add(hose);
    const noz = new THREE.Group(); noz.position.set(24.5, 0.6, -44); grp.add(noz);
    { const brass = G.mat(0xc9a14a, { kind: 'metal', rough: 0.3 }); const fit = G.mesh(G.props.lathe([[0.001, -1.2], [0.62, -1.2], [0.7, -0.9], [0.7, -0.5], [0.55, -0.4], [0.55, 0.2], [0.42, 0.3], [0.42, 1.1], [0.32, 1.3], [0.001, 1.3]], 32), 0, { material: brass }); fit.rotation.z = -PI / 2; noz.add(fit);
      const grip = G.mesh(G.rbox(0.7, 1.9, 0.6, 0.2), 0xf2a41c, { kind: 'plastic' }); grip.position.set(1.0, -0.9, 0); grip.rotation.z = -0.3; noz.add(grip); }
    this.nozzle = new V3(23.5, 0.8, -44.5);
    G.addCol(-28, 0, -44.6, -4, 1.2, -41.6, { noStep: false }); // hose hump (hop over)
    G.addCol(5, 0, -44.8, 28, 1.2, -42.8);
    // sketch outline for Ludo's bridge
    const outline = new THREE.Group(); outline.position.set(0, 0.05, -51); grp.add(outline);
    const pts = [[-1.8, 5.8], [1.8, 5.8], [1.8, -5.8], [-1.8, -5.8], [-1.8, 5.8]].map(([x, z]) => new V3(x, 0.4, z));
    const lg = new THREE.BufferGeometry().setFromPoints(pts); const dl = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.5, gapSize: 0.35 })); dl.computeLineDistances(); outline.add(dl);
    const pencil = new THREE.Group(); const pb = G.mesh(G.geo.cyl, 0xffd23a); pb.scale.set(0.15, 1.4, 0.15); pencil.add(pb); const tip = G.mesh(G.geo.cone, 0xf1d3a6); tip.scale.set(0.15, 0.35, 0.15); tip.position.y = -0.87; tip.rotation.x = PI; pencil.add(tip); pencil.position.set(0, 2.2, 5.2); pencil.rotation.z = 0.5; outline.add(pencil);
    this.sketch = { g: outline, pencil, pos: new V3(0, 0, -45), done: false };
    this.sparkLine(grp, [0, 0, -34], [0, 0, -42], 4);
    // treasure 2
    this.digSpot(grp, 'w1_treasure2', new V3(-20, 0, -37), { id: 'w1_treasure2', title: 'Luigi treasure', sub: 'A mysterious sandwich. Nobody will claim it.' });
    // frisbees across the river (optional route to Photo #2 on the island)
    const fr = (x, z0, z1, speed, color) => {
      const g = new THREE.Group(); const d = G.mesh(G.props.lathe([[0.001, 0.12], [1.2, 0.1], [1.62, 0.02], [1.78, -0.1], [1.8, -0.22], [1.72, -0.26], [1.64, -0.12]], 48), color, { kind: 'plastic', rough: 0.3 }); g.add(d); grp.add(g);
      const col = G.addCol(0, 0, 0, 0, 0, 0); const mv = { g, col, x, z0, z1, speed, t: Math.random() * 6, y: -0.1 }; this.movers.push(mv); return mv;
    };
    fr(12.5, -44.5, -51, 0.8, 0xff5d73); fr(23, -49.5, -57.5, 0.65, 0x36a3ff);
    G.box(grp, 18, -1.5, -51, 4, 2.0, 4, 0x8a6a4a); const isl = G.mesh(new THREE.SphereGeometry(1, 32, 16, 0, PI * 2, 0, PI / 2), 0x6fb04e, { kind: 'lawn', tile: 7 }); isl.scale.set(2.3, 0.6, 2.3); isl.position.set(18, 0.5, -51); grp.add(isl);
    this.pickup(grp, 'w1_photo2', 'photo', new V3(18, 1.9, -51), 'Family photo', 'The canoe trip. Frank insists the lake moved first.', () => photoModel(frameTex('CANOE', '#4f86b8', '#fff')));
    // far bank: chess patio (optional), sunflower (imagination), planter (dad instinct)
    this.buildChessPatio(grp);
    const stem = G.w1a.sunflowerStem(DECK_Y + 2.6); stem.position.set(-16, 0, -70); grp.add(stem);
    const head = new THREE.Group(); head.position.set(-16, DECK_Y + 3, -70); grp.add(head); head.add(G.w1a.sunflowerHead(2.1));
    G.addCol(-18.1, 8.3, -72.1, -13.9, 8.7, -67.9);
    this.pickup(grp, 'w1_photo3', 'photo', new V3(-16, 9.9, -70), 'Family photo', "Luigi's first day home. He ate a sock within the hour.", () => photoModel(frameTex('DAY ONE', '#f7c35e', '#7a3a12')));
    this.clouds = [];
    [[-6, 1.8, -62], [-9, 3.6, -66], [-12.5, 5.4, -62.5], [-15, 7.0, -65.5]].forEach(([x, y, z]) => {
      const c = G.makeCloud(0.55); c.position.set(x, y + 0.2, z); c.traverse((o) => { if (o.isMesh || o.isSprite) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0; o.castShadow = false; } }); grp.add(c);
      const outlineC = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.03, 4, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 })); outlineC.rotation.x = PI / 2; outlineC.position.set(x, y + 0.05, z); grp.add(outlineC);
      G.addCol(x - 1.3, y - 0.3, z - 1.3, x + 1.3, y, z + 1.3, { imaginary: true });
      this.clouds.push({ c, o: outlineC });
    });
    this.sparkLine(grp, [-3, 0, -58], [-5, 0, -61], 2);
    // Dad's planter (hides the travel stamp)
    const plg = G.w1a.planter(3.2, 2.6, 6); plg.position.set(-24, 0, -76); grp.add(plg);
    const pl = { mesh: plg, col: G.addCol(-25.6, 0, -79, -22.4, 2.6, -73) }; this.planter = pl;
    this.planterFlowers = [];
    for (let i = 0; i < 9; i++) { const f = G.w1a.flower([0xff5d73, 0xffd23a, 0xb36bff, 0xffffff, 0xff9f3a][i % 5], G.rand(1.1, 1.6)); f.position.set(-24 + Math.sin(i * 3) * 0.6, 2.45, -78.4 + i * 0.6); f.rotation.y = G.rand(0, 6); grp.add(f); this.planterFlowers.push(f); }
    this.stampPos = new V3(-24, 1.2, -80.4);
    G.addInteract({ pos: new V3(-22, 0, -76), radius: 3, enabled: () => !this.state.planterMoved, label: (ch) => (ch.id === 'frank' ? 'Check behind the planter' : 'Look at the planter'), onUse: (ch) => {
      if (ch.id !== 'frank') { G.bubble(ch.id, { elba: "It's a planter.", luca: 'Rectangular prism. Full of dirt.', ludo: 'I like the flowers.', luigi: '*lifts leg. Thinks better of it.*' }[ch.id]); return; }
      this.state.planterMoved = true; ch.action = 'fix'; ch.actionT = 0; G.audio.play('gate');
      G.bubble('frank', 'Told you. There is ALWAYS something behind the planter.', 3.5);
      this.planterSlide = 0;
    } });
    this.pickup(grp, 'w1_stamp', 'stamp', this.stampPos, 'Travel stamp', 'Zermatt · best hot chocolate of all time', () => { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.2), new THREE.MeshBasicMaterial({ map: frameTex('ZERMATT', '#d62828', '#fff'), side: THREE.DoubleSide })); g.add(s); return g; });
  };

  w1.buildChessPatio = function (grp) {
    const x0 = 9, z0 = -62, s = 2.4; this.tiles = [];
    const path = [[0, 0], [2, 1], [1, 3]]; const isPath = (i, j) => path.some(([a, b]) => a === i && b === j);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const cx = x0 + s * i + s / 2, cz = z0 - s * j - s / 2;
      const m = G.mesh(G.geo.box, (i + j) % 2 ? 0x3b3330 : 0xf1e3c6, { unique: true }); m.scale.set(s - 0.08, 0.4, s - 0.08); m.position.set(cx, -0.2, cz); grp.add(m);
      const col = G.addCol(cx - s / 2 + 0.04, -0.4, cz - s / 2 + 0.04, cx + s / 2 - 0.04, 0, cz + s / 2 - 0.04);
      const hl = new THREE.Mesh(new THREE.PlaneGeometry(s - 0.3, s - 0.3), new THREE.MeshBasicMaterial({ color: isPath(i, j) ? 0xffd23a : 0xff3355, transparent: true, opacity: 0 })); hl.rotation.x = -PI / 2; hl.position.set(cx, 0.02, cz); grp.add(hl);
      this.tiles.push({ m, col, hl, safe: isPath(i, j), cx, cz, state: 'up', t: 0 });
    }
    // knight-move arrows (visible in chess vision)
    this.chessArrows = [];
    const at = (i, j) => new V3(x0 + s * i + s / 2, 0.15, z0 - s * j - s / 2);
    const seq = [new V3(x0 + s / 2, 0.15, z0 + 1.5), at(0, 0), at(2, 1), at(1, 3), new V3(x0 + s * 1.5, 0.15, z0 - s * 4 - 1.5)];
    for (let k = 0; k < seq.length - 1; k++) { const g = new THREE.BufferGeometry().setFromPoints([seq[k], seq[k + 1]]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0 })); grp.add(l); this.chessArrows.push(l); }
    G.box(grp, 13.8, 0, -73.8, 9.6, 0.3, 3.6, 0xe0d6c4, { col: false });
    const ped = G.mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.2, 12), 0xf1e3c6); ped.position.set(13.8, 0.6, -74.5); grp.add(ped); G.addCol(13.1, 0, -75.2, 14.5, 1.2, -73.8);
    this.pickup(grp, 'w1_knight', 'chess', new V3(13.8, 1.9, -74.5), 'Golden chess knight', 'Moves in an L. Obviously.', () => {
      const g = new THREE.Group(); const m = G.mat(0xe2ac3f, { std: true, metal: 0.7, rough: 0.3 });
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.2, 16), m); g.add(b); const bd = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.6, 12), m); bd.position.y = 0.4; g.add(bd);
      const hd = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.6), m); hd.position.set(0, 0.9, 0.1); hd.rotation.x = -0.3; g.add(hd); const l = new THREE.PointLight(0xffd23a, 0.8, 5); g.add(l); return g;
    });
  };

  // ---------- Zone 2: board wall and sprinkler ----------
  w1.buildZone2 = function (grp) {
    const bm = texMat(brickTex(), 10, 2);
    [[-28, -3], [3, 28]].forEach(([a, b]) => { const w = new THREE.Mesh(new THREE.BoxGeometry(b - a, 6, 1.2), bm); w.position.set((a + b) / 2, 3, -80); w.castShadow = true; w.receiveShadow = true; grp.add(w); G.addCol(a, 0, -80.6, b, 6, -79.4); });
    this.boards = [];
    for (let i = 0; i < 5; i++) { const b = G.box(grp, 0, i * 1.2, -80, 6, 1.15, 0.5, i % 2 ? 0xd9ad72 : 0xcfa062, { unique: true }); this.boards.push(b); }
    const tgt = G.mesh(new THREE.CircleGeometry(0.7, 24), 0xd62828, { basic: true }); tgt.position.set(0, 2.4, -79.72); grp.add(tgt); this.boardTarget = tgt;
    this.sparkLine(grp, [0, 0, -64], [0, 0, -76], 5);
    this.digSpot(grp, 'w1_treasure3x', new V3(-12, 0, -90), null);
    // sprinkler
    const sp = new THREE.Group(); sp.position.set(0, 0, -95); grp.add(sp);
    const base = G.mesh(G.props.lathe([[0.001, 0], [1.5, 0], [1.45, 0.25], [1.0, 0.5], [0.7, 0.9], [0.55, 1.2], [0.001, 1.25]], 40), 0x2f3338, { kind: 'plastic', rough: 0.4 }); sp.add(base);
    const rot = new THREE.Group(); rot.position.y = 1.0; sp.add(rot);
    const hub = G.mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.5, 24), 0xc9ccd0, { kind: 'metal', rough: 0.3 }); rot.add(hub);
    [0, PI].forEach((a) => { const c = new THREE.CatmullRomCurve3([new V3(0, 0, 0), new V3(3, 0.15, 0), new V3(6.5, 0.1, 0.4), new V3(8.8, 0.3, 1.2)]); const arm = G.mesh(new THREE.TubeGeometry(c, 40, 0.22, 10, false), 0xf2a41c, { kind: 'plastic', rough: 0.3 }); arm.rotation.y = a; rot.add(arm); const tip = G.mesh(new THREE.SphereGeometry(0.35, 16, 12), 0xc9ccd0, { kind: 'metal', rough: 0.3 }); tip.position.set(8.8, 0.3, 1.2); tip.position.applyAxisAngle(new V3(0, 1, 0), a); rot.add(tip); });
    G.addCol(-1.0, 0, -96, 1.0, 1.2, -94);
    this.sprinkler = { g: sp, rot, angle: 0, pos: new V3(0, 0, -95), len: 9 };
    // tangled hose valve: Luigi can shake it
    const knot = new THREE.Group(); knot.position.set(9, 0, -87); grp.add(knot);
    for (let i = 0; i < 4; i++) { const k = G.mesh(new THREE.TorusGeometry(0.7 + i * 0.1, 0.22, 12, 32), 0x2d8a45, { kind: 'rubber', rough: 0.38 }); k.rotation.set(G.rand(0, 3), G.rand(0, 3), 0); k.position.y = 0.7; knot.add(k); }
    const hc = new THREE.CatmullRomCurve3([new V3(9, 0.3, -87), new V3(6, 0.3, -90), new V3(3, 0.3, -93), new V3(0.8, 0.3, -95)]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(hc, 60, 0.28, 12, false), G.mat(0x2d8a45, { kind: 'rubber', rough: 0.38 })); tube.castShadow = true; grp.add(tube);
    this.knot = knot;
    G.addInteract({ pos: new V3(9, 0, -87), radius: 2.2, enabled: () => !this.state.sprinklerOff, label: (ch) => (ch.id === 'luigi' ? 'Shake the hose' : 'A tangled hose'), onUse: (ch) => {
      if (ch.id !== 'luigi') { G.bubble(ch.id, { frank: "If I pull this, I'll get soaked. I know it.", elba: "It's knotted solid. Maybe someone with more enthusiasm.", luca: 'Too tangled. Probably a Luigi problem.', ludo: "I'm not touching the snake hose." }[ch.id]); return; }
      ch.action = 'shake'; ch.actionT = 0; G.audio.play('whoosh'); this.knotShake = 1.2;
      setTimeout(() => { this.state.sprinklerOff = true; G.burst(new V3(0, 1.5, -95), 0x9fdcff, 20, { speed: 5, life: 0.8 }); G.bubble('luigi', '*shakes it violently. The sprinkler stops.*', 3); setTimeout(() => G.bubble('elba', "...Or that. Good boy.", 3), 1400); G.game.achieve('overthink', 'Luigi solved it', 'Shook the sprinkler into submission'); }, 1000);
    } });
    this.sparkLine(grp, [4, 0, -84], [8, 0, -86], 3);
  };

  // ---------- Deck + grill ----------
  w1.buildDeck = function (grp) {
    const deckMat = G.mat(0xc99a6a, { kind: 'wood', tile: 16, swap: true });
    const top = new THREE.Mesh(new THREE.BoxGeometry(40, 0.6, 34), deckMat); top.position.set(0, DECK_Y - 0.3, -123); top.castShadow = true; top.receiveShadow = true; grp.add(top);
    G.fadeables.push(top); top.material = top.material.clone();
    G.addCol(-20, DECK_Y - 0.6, -140, 20, DECK_Y, -106);
    const sk = texMat(plankTex(), 6, 1, 0xb88a5c);
    const skirt = (x0, x1, y0, y1, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.4), sk.clone()); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); m.castShadow = true; grp.add(m); G.fadeables.push(m); return G.addCol(x0, y0, z - 0.2, x1, y1 === DECK_Y - 0.6 ? DECK_Y : y1, z + 0.2); };
    skirt(-20, -12, 0, DECK_Y - 0.6, -106); skirt(-8, 10, 0, DECK_Y - 0.6, -106); skirt(12, 20, 0, DECK_Y - 0.6, -106); skirt(10, 12, 0.95, DECK_Y - 0.6, -106);
    G.addCol(10, 0, -106.2, 12, 0.95, -105.8, { bigOnly: true });
    // trellis section (climbable)
    const tr = new THREE.Group(); tr.position.set(-10, 0, -106); grp.add(tr);
    const back = new THREE.Mesh(new THREE.BoxGeometry(4, DECK_Y - 0.6, 0.3), sk.clone()); back.position.y = (DECK_Y - 0.6) / 2; tr.add(back); G.fadeables.push(back);
    for (let i = 0; i < 6; i++) { const a = G.mesh(G.geo.box, 0xf4efe6); a.scale.set(0.12, 7, 0.12); a.position.set(-1.7 + i * 0.7, 2.4, 0.3); a.rotation.z = 0.6; tr.add(a); const b = a.clone(); b.rotation.z = -0.6; tr.add(b); }
    for (let i = 0; i < 9; i++) { const v = G.props.shrub(G.rand(0.45, 0.7), { cards: 16 }); v.position.set(G.rand(-1.8, 1.8), G.rand(0.0, 4.2), 0.5); v.scale.z = 0.5; tr.add(v); }
    tr.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    G.addCol(-12, 0, -106.25, -8, DECK_Y, -105.75, { climb: true });
    [[-20, -140, -106, 'x'], [20, -140, -106, 'x']].forEach(([x, z0, z1]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, DECK_Y - 0.6, z1 - z0), sk.clone()); m.position.set(x, (DECK_Y - 0.6) / 2, (z0 + z1) / 2); grp.add(m); G.fadeables.push(m); G.addCol(x - 0.2, 0, z0, x + 0.2, DECK_Y, z1); });
    { const m = new THREE.Mesh(new THREE.BoxGeometry(40, DECK_Y - 0.6, 0.4), sk.clone()); m.position.set(0, (DECK_Y - 0.6) / 2, -140); grp.add(m); G.fadeables.push(m); G.addCol(-20, 0, -140.2, 20, DECK_Y, -139.8); }
    // under-deck treasure (only Luigi fits)
    this.digSpot(grp, 'w1_treasure3', new V3(11, 0, -114), { id: 'w1_treasure3', title: 'Luigi treasure', sub: "Someone's missing TV remote. Mystery solved." });
    this.underDeck = { x0: -20, x1: 20, z0: -140, z1: -106 };
    // lever on the deck (lowers the stairs)
    const lever = new THREE.Group(); lever.position.set(-10, DECK_Y, -109); grp.add(lever);
    const lb = G.mesh(G.rbox(1, 1, 1, 0.1), 0x4a4f55, { kind: 'metal', rough: 0.45 }); lb.scale.set(0.8, 0.5, 0.8); lb.position.y = 0.25; lever.add(lb);
    const lh = new THREE.Group(); lh.position.y = 0.5; lever.add(lh); const stick = G.mesh(G.geo.cyl, 0xb8bcc2, { kind: 'metal', rough: 0.3 }); stick.scale.set(0.08, 1.4, 0.08); stick.position.y = 0.7; lh.add(stick); const knob = G.mesh(G.geo.sphere, 0xd62828, { kind: 'plastic', rough: 0.25 }); knob.scale.setScalar(0.22); knob.position.y = 1.45; lh.add(knob); lh.rotation.x = -0.6;
    this.lever = lh;
    G.addInteract({ pos: new V3(-10, DECK_Y, -109), radius: 2.2, enabled: () => !this.state.stairs, label: () => 'Pull the lever', onUse: (ch) => this.lowerStairs(ch) });
    // stairs (appear when lever pulled)
    this.stairs = [];
    for (let i = 0; i < 13; i++) {
      const h = (i + 1) * (DECK_Y / 13.2); const z = -101.2 - i * 0.37 - 0.2;
      const m = G.mesh(G.geo.box, 0xc89a64, { kind: 'wood', tile: 16, swap: true }); m.scale.set(4, h, 0.9); m.position.set(4, h / 2, -100.4 - i * 0.43); m.visible = false; grp.add(m);
      const col = G.addCol(2, 0, -100.85 - i * 0.43, 6, h, -99.95 - i * 0.43); col.active = false; this.stairs.push({ m, col });
    }
    // grill
    const gr = new THREE.Group(); gr.position.set(0, DECK_Y, -128); grp.add(gr);
    const gh = 5.5;
    const enamel = G.mat(0x1d1f22, { kind: 'paint', rough: 0.32, metal: 0.35 }); const steel = G.mat(0xb9bdc2, { kind: 'metal', rough: 0.28 }); const iron = G.mat(0x2a2624, { kind: 'metal', rough: 0.6, metal: 0.7 });
    const body = new THREE.Mesh(G.rbox(10, 3, 5, 0.35), enamel); body.position.y = gh - 1.5; body.castShadow = true; gr.add(body);
    const front = new THREE.Mesh(G.rbox(9.2, 1.1, 0.25, 0.1), steel); front.position.set(0, gh - 1.9, 2.55); gr.add(front);
    [[-4.6, -2.1], [4.6, -2.1], [-4.6, 2.1], [4.6, 2.1]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, gh - 3, 16), steel); l.position.set(x, (gh - 3) / 2, z); l.castShadow = true; gr.add(l); });
    [[-4.6, 2.1], [-4.6, -2.1]].forEach(([x, z]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.35, 24), G.mat(0x1a1a1a, { kind: 'rubber' })); w.rotation.x = PI / 2; w.rotation.z = PI / 2; w.position.set(x - 0.3, 0.55, z); gr.add(w); });
    for (let i = 0; i < 7; i++) { const sl = new THREE.Mesh(G.rbox(9, 0.12, 0.45, 0.04), steel); sl.position.set(0, 1.2, -1.8 + i * 0.6); gr.add(sl); }
    [-1, 1].forEach((sd) => { const sh = new THREE.Mesh(G.rbox(3.2, 0.25, 4.2, 0.1), steel); sh.position.set(sd * 6.6, gh - 0.6, 0.2); sh.castShadow = true; gr.add(sh); const br = new THREE.Mesh(G.rbox(1.6, 0.18, 0.18, 0.04), steel); br.position.set(sd * 5.6, gh - 1.1, 1.8); br.rotation.z = sd * 0.6; gr.add(br); });
    const tank = new THREE.Mesh(G.props.lathe([[0.001, 0], [0.9, 0.05], [1.2, 0.35], [1.25, 1.6], [1.0, 2.0], [0.4, 2.15], [0.001, 2.15]], 32), G.mat(0xeeeeea, { kind: 'paint', rough: 0.4 })); tank.position.set(2.5, 1.35, 0); tank.castShadow = true; gr.add(tank);
    for (let i = 0; i < 12; i++) { const bar = new THREE.Mesh(G.rbox(0.18, 0.14, 4.8, 0.03), iron); bar.position.set(-4.4 + i * 0.8, gh + 0.06, 0); gr.add(bar); }
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 10, 40, 1, false, 0, PI), enamel); lid.material.side = THREE.DoubleSide; lid.rotation.z = PI / 2; lid.rotation.y = PI / 2; lid.position.set(0, gh + 0.1, -2.6); lid.scale.set(1, 1, 0.5); lid.castShadow = true; gr.add(lid);
    const lidH = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 7, 16), steel); lidH.rotation.z = PI / 2; lidH.position.set(0, gh + 2.2, -1.6); gr.add(lidH);
    const therm = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.15, 24), steel); therm.position.set(0, gh + 2.4, -2.6); gr.add(therm);
    [-2.2, 0].forEach((x) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.35, 24), steel); k.rotation.x = PI / 2; k.position.set(x, gh - 1.9, 2.8); gr.add(k); });
    G.addCol(-5, DECK_Y, -130.5, 5, DECK_Y + gh, -125.5);
    const knobG = G.mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 24), 0xd62828, { kind: 'plastic', rough: 0.25 }); knobG.position.set(3.5, gh + 0.4, 1.5); gr.add(knobG); this.grillKnob = knobG;
    this.flames = new THREE.Group(); this.flames.position.y = gh; this.flames.visible = false; gr.add(this.flames);
    for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(G.geo.cone, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff7a1a : 0xffc02a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); f.userData.noAO = true; f.scale.set(0.35, 1.2, 0.35); f.position.set(-4.2 + i * 0.65, 0.4, G.rand(-1.5, 1.5)); this.flames.add(f); }
    this.grillLight = new THREE.PointLight(0xff8a2a, 0, 25); this.grillLight.position.set(0, gh + 2, 0); gr.add(this.grillLight);
    G.props.compact(gr, [this.flames, knobG, this.grillLight]);
    G.addInteract({ pos: new V3(3.5, DECK_Y + gh, -126.5), radius: 2.3, hy: 1.5, enabled: () => !this.state.grillOn, label: (ch) => (ch.id === 'frank' ? 'Fire up the grill' : 'Grill knob'), onUse: (ch) => {
      if (ch.id !== 'frank') { G.bubble(ch.id, "Frank's grill. Frank's rules. Apparently.", 3); return; }
      this.state.grillOn = true; ch.action = 'fix'; ch.actionT = 0; G.audio.play('fire'); this.flames.visible = true;
      G.bubble('frank', 'Finally. My time.', 2.6); setTimeout(() => G.bubble('elba', 'Please do not melt the family.', 2.6), 1600);
      G.audio.play('melt'); G.game.setObjective('The ice is melting. Head down the far stairs to the lawn.');
    } });
    // pepper grinder (topping on top)
    const pg = G.mesh(G.props.lathe([[0.001, 0], [1.35, 0], [1.4, 0.3], [1.2, 0.6], [1.0, 2.2], [0.95, 3.0], [1.1, 3.8], [1.2, 4.6], [1.0, 5.4], [0.7, 5.8], [0.001, 5.9]], 48), 0x5a3520, { kind: 'grain', tile: 1.5, rough: 0.35 }); pg.position.set(-14, DECK_Y, -121); grp.add(pg);
    const pgt = G.mesh(G.props.lathe([[0.001, 0], [0.45, 0], [0.4, 0.3], [0.2, 0.45], [0.25, 0.6], [0.001, 0.62]], 32), 0xc9ccd0, { kind: 'metal', rough: 0.25 }); pgt.position.set(-14, DECK_Y + 5.85, -121); grp.add(pgt);
    G.addCol(-15, DECK_Y, -122, -13, DECK_Y + 6.4, -120);
    this.pickup(grp, 'w1_pepperoni', 'topping', new V3(-14, DECK_Y + 7.6, -121), 'Pizza topping', 'Pepperoni · unlocks a pizza design', () => { const g = new THREE.Group(); const d = G.mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.15, 20), 0xc0392b); d.rotation.x = PI / 2; g.add(d); for (let i = 0; i < 5; i++) { const s = G.mesh(G.geo.sphere, 0x8e2418); s.scale.setScalar(0.08); s.position.set(Math.cos(i * 1.3) * 0.3, Math.sin(i * 1.3) * 0.3, 0.09); g.add(s); } return g; });
    this.pickup(grp, 'w1_basil', 'topping', new V3(0, DECK_Y + 10.5, -128), 'Pizza topping', 'Fresh basil · unlocks a pizza design', () => { const g = new THREE.Group(); const l = G.mesh(G.geo.sphere, 0x2f9a3a); l.scale.set(0.35, 0.08, 0.6); g.add(l); const v = G.mesh(G.geo.box, 0x1f6a28); v.scale.set(0.03, 0.03, 1.0); v.position.y = 0.06; g.add(v); g.rotation.x = 0.8; return g; });
    this.sparkLine(grp, [-2, DECK_Y, -112], [-2, DECK_Y, -120], 4); this.sparkLine(grp, [-4, DECK_Y + gh, -128], [4, DECK_Y + gh, -128], 5);
    // ice wall
    this.ice = [];
    const im = new THREE.MeshPhysicalMaterial({ color: 0xcdefff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.72, clearcoat: 1, clearcoatRoughness: 0.15, ior: 1.31, specularIntensity: 1, envMapIntensity: 1.6 });
    for (let r = 0; r < 3; r++) for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(G.rbox(1, 1, 1, 0.12), im); m.scale.set(4, 4, 3); m.position.set(-18 + i * 4, DECK_Y + 2 + r * 4, -135.5 + (i % 2) * 0.4); m.rotation.y = G.rand(-0.05, 0.05); m.castShadow = true; grp.add(m);
      this.ice.push(m);
    }
    this.iceCol = G.addCol(-20, DECK_Y, -137.2, 20, DECK_Y + 12, -133.8);
    // stairs down to the lawn on the far side
    for (let i = 0; i < 14; i++) { const h = DECK_Y - (i + 1) * (DECK_Y / 14); if (h <= 0.05) continue; G.box(grp, 0, 0, -140.7 - i * 0.9, 6, h, 0.9, 0xc89a64, { kind: 'wood', tile: 16, swap: true }); }
    this.sparkLine(grp, [0, DECK_Y, -137], [0, 0.5, -150], 6);
  };
  w1.lowerStairs = function (ch) {
    this.state.stairs = true; G.audio.play('gate'); G.camera && (G.cam.shake = 0.3);
    this.lever.rotation.x = 0.6;
    this.stairs.forEach((s, i) => setTimeout(() => { s.m.visible = true; s.col.active = true; G.audio.play('clank'); G.burst(s.m.position.clone().add(new V3(0, s.m.scale.y / 2, 0)), 0xc89a64, 3, { speed: 2, size: 0.1 }); }, 80 * i));
    G.bubble(ch.id, ch.id === 'elba' ? "Stairs are down. You're welcome, everyone." : 'Stairs! We have stairs!', 3);
    this.openGate(3, true);
    G.game.setObjective("On the deck, Frank's grill is the key. Toss pizza dough (F) to bounce up and fire it up (E).");
  };

  // ---------- Arena + mower ----------
  w1.buildArena = function (grp) {
    const C = new V3(0, 0, -178); this.arenaC = C; const R = 21;
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * PI * 2; const x = C.x + Math.sin(a) * R, z = C.z + Math.cos(a) * R;
      const isGate = Math.abs(Math.sin(a) * R) < 4.5 && Math.cos(a) > 0;
      if (isGate) continue;
      const m = G.w1a.hedge(3.0); m.position.set(x, -0.4, z); m.rotation.y = G.rand(0, 6); grp.add(m);
      G.addCol(x - 2.4, 0, z - 2.4, x + 2.4, 6, z + 2.4);
    }
    this.arenaGate = G.addCol(-5, 0, -158, 5, 6, -155); this.arenaGate.active = false;
    const ag = G.mesh(new THREE.SphereGeometry(1, 24, 16), 0x2f5a26, { kind: 'lawn', tile: 3, unique: true }); ag.scale.set(5, 3, 2); ag.position.set(0, -3, -156.5); grp.add(ag); this.arenaGateMesh = ag; G.fadeables.push(ag);
    // side walls between deck and arena
    [-28, 28].forEach((x) => G.addCol(x - 1, 0, -200, x + 1, 30, -140));
    G.addCol(-28, 0, -202, 28, 30, -200);
    // mowed stripes
    for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 40), G.mat(i % 2 ? 0x7cae52 : 0x5f9a42, { kind: 'lawn', tile: 7 })); s.rotation.x = -PI / 2; s.position.set(-16.5 + i * 5.5, 0.015, C.z); s.receiveShadow = true; grp.add(s); }
    // hose coils (traps)
    [[-10, -174], [10, -171], [0, -188]].forEach(([x, z]) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); grp.add(g);
      for (let i = 0; i < 4; i++) { const t = G.mesh(new THREE.TorusGeometry(1.8 - i * 0.35, 0.25, 12, 40), 0x2d8a45, { kind: 'rubber', rough: 0.38 }); t.rotation.x = PI / 2; t.position.y = 0.25 + i * 0.12; g.add(t); }
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.5, 30), new THREE.MeshBasicMaterial({ color: 0x9dff5c, transparent: true, opacity: 0.6, side: THREE.DoubleSide })); ring.rotation.x = -PI / 2; ring.position.y = 0.05; g.add(ring);
      this.coils.push({ g, ring, pos: new V3(x, 0, z), armed: true });
    });
    // the mower
    const m = new THREE.Group(); m.position.set(0, 0, -186); grp.add(m);
    const shell = new THREE.MeshPhysicalMaterial({ color: 0xd8342c, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 });
    const dark = G.mat(0x1f2124, { kind: 'plastic', rough: 0.5 }); const steelM = G.mat(0xb9bdc2, { kind: 'metal', rough: 0.3 });
    const body = new THREE.Mesh(G.rbox(3.5, 1.3, 4.4, 0.5), shell); body.position.y = 1.15; body.castShadow = true; m.add(body);
    const hoodG = new THREE.SphereGeometry(1, 40, 20, 0, PI * 2, 0, PI / 2); const hood = new THREE.Mesh(hoodG, shell); hood.scale.set(1.65, 0.75, 2.05); hood.position.y = 1.75; hood.castShadow = true; m.add(hood);
    const bumper = new THREE.Mesh(G.rbox(3.8, 0.45, 4.8, 0.2), dark); bumper.position.y = 0.55; m.add(bumper);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.45, 40), dark); deck.position.y = 0.42; m.add(deck);
    const blades = new THREE.Group(); blades.position.y = 0.2; m.add(blades); [0, PI / 2].forEach((a) => { const b = new THREE.Mesh(G.rbox(4.2, 0.05, 0.35, 0.02), steelM); b.rotation.y = a; blades.add(b); });
    [[-1.85, 1.45], [1.85, 1.45], [-1.85, -1.45], [1.85, -1.45]].forEach(([x, z]) => { const w = new THREE.Group(); w.position.set(x, 0.62, z); m.add(w);
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.2, 12, 32), G.mat(0x181818, { kind: 'rubber' })); tire.rotation.y = PI / 2; w.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.36, 24), steelM); rim.rotation.z = PI / 2; w.add(rim);
      for (let k = 0; k < 14; k++) { const tr = new THREE.Mesh(G.rbox(0.36, 0.12, 0.1, 0.02), G.mat(0x181818, { kind: 'rubber' })); const a = (k / 14) * PI * 2; tr.position.set(0, Math.cos(a) * 0.64, Math.sin(a) * 0.64); tr.rotation.x = a; w.add(tr); } });
    const eyes = [];
    [-0.8, 0.8].forEach((x) => { const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 32), dark); sock.rotation.x = PI / 2; sock.position.set(x, 1.45, 2.16); m.add(sock);
      const e = G.mesh(G.geo.sphere, 0xfff6c8, { basic: true }); e.scale.set(0.42, 0.42, 0.2); e.position.set(x, 1.45, 2.22); m.add(e); const p = G.mesh(G.geo.sphere, 0x1a1a1a, { basic: true }); p.scale.set(0.18, 0.2, 0.1); p.position.set(x, 1.45, 2.36); m.add(p); eyes.push(p); });
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 8, 20, PI), dark); mouth.position.set(0, 0.85, 2.2); m.add(mouth);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.1, 10, 32, PI), steelM); handle.position.set(0, 2.2, -2.3); handle.rotation.x = -0.4; m.add(handle);
    const panel = G.mesh(G.rbox(1.2, 0.8, 0.1, 0.05), 0x36e0ff, { basic: true }); panel.position.set(0, 1.2, -2.2); m.add(panel);
    const batts = []; for (let i = 0; i < 3; i++) { const b = G.mesh(G.rbox(0.3, 0.5, 0.2, 0.04), 0xffe14a, { kind: 'plastic', rough: 0.3 }); b.position.set(-0.4 + i * 0.4, 1.2, -2.3); m.add(b); batts.push(b); }
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.8, 16), steelM); stack.position.set(1.1, 2.4, -1.2); m.add(stack);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffb13a })); lamp.position.set(0, 2.55, 0.2); m.add(lamp);
    G.props.compact(m, [body, blades, mouth, panel, ...eyes, ...batts]);
    this.mower = { g: m, body, blades, eyes, mouth, panel, batts, heading: PI, speed: 0, state: 'off', t: 0, hits: 0, distract: 0, target: null, stuck: 0, talkT: 3 };
  };

  // ---------- gates & progress ----------
  w1.openGate = function (idx, silent) {
    if (this.state.gates > idx) return;
    this.state.gates = idx + 1;
    if (!silent) G.audio.play('gate');
    G.game.regroup(GATES[Math.min(idx + 1, GATES.length - 1)].wait);
  };
  w1.sectionOf = function (p) { let s = 0; for (let i = 0; i < GATES.length; i++) if (p.z < GATES[i].z - 0.5 && !(i === 3 && p.y < 3 && this.inUnderDeck(p))) s = i + 1; return s; };
  w1.inUnderDeck = function (p) { const u = this.underDeck; return p.x > u.x0 && p.x < u.x1 && p.z > u.z0 && p.z < u.z1 && p.y < DECK_Y - 1; };
  w1.followTarget = function (leader) {
    // Where can followers go? Only as far as the gates that are open.
    const sec = this.sectionOf(leader.pos);
    if (this.inUnderDeck(leader.pos)) return { wait: GATES[3].wait };
    if (sec <= this.state.gates) return null; // free to follow
    return { wait: GATES[this.state.gates].wait };
  };
  w1.respawnPoint = function (p) {
    if (this.state.boss === 'fight') return new V3(0, 0, -162);
    const sec = Math.min(this.sectionOf(p), this.state.gates + (this.sectionOf(p) > this.state.gates ? 1 : 0));
    if (p.z < -45 && p.z > -58 && Math.abs(p.x) < 28) return p.z < -51 && this.state.bridge ? new V3(0, 0, -59) : new V3(0, 0, -41);
    if (p.x > 8 && p.z < -60 && p.z > -74) return new V3(13.8, 0, -59);
    const table = [GATES[0].check, new V3(0, 0, -36), new V3(0, 0, -60), new V3(0, 0, -86), new V3(-6, DECK_Y, -112), new V3(0, 0, -148), new V3(0, 0, -162)];
    return table[Math.min(sec, table.length - 1)].clone();
  };

  // ---------- abilities hooks ----------
  w1.karateTarget = function (ch) {
    if (this.state.boards > 0 && Math.hypot(ch.pos.x, ch.pos.z + 80) < 4.5 && ch.pos.z > -80) return { kind: 'boards' };
    return null;
  };
  w1.onKarateSuccess = function () {
    const n = this.state.boards; if (n <= 0) return;
    const drop = n >= 5 ? 2 : n >= 3 ? 2 : 1;
    for (let k = 0; k < drop && this.state.boards > 0; k++) {
      const b = this.boards[this.boards.length - this.state.boards]; this.state.boards--;
      b.col.active = false; const pos = b.mesh.position.clone();
      b.mesh.visible = false; G.burst(pos, 0xd9ad72, 18, { speed: 7, size: 0.25, life: 1.2, lit: true });
    }
    // remaining boards drop down
    const alive = this.boards.filter((b) => b.col.active);
    alive.forEach((b, i) => { b.mesh.position.y = 0.575 + i * 1.2; G.setColBox(b.col, 0, i * 1.2, -80, 6, 1.15, 0.5); });
    if (this.state.boards <= 0) {
      this.boardTarget.visible = false; this.openGate(2);
      G.bubble('luca', 'Osu.', 2); setTimeout(() => G.bubble('frank', 'That was... honestly incredible.', 3), 900);
      G.game.setObjective('Get past the sprinkler. Elba can slow it with Plan Mode (F). Or maybe somebody shakes something.');
    }
  };
  w1.drawTarget = function (ch) { const s = this.sketch; if (!s.done && Math.hypot(ch.pos.x - s.pos.x, ch.pos.z - s.pos.z) < 3.5) return s; return null; };
  w1.doDraw = function (ch) {
    const s = this.sketch; s.done = true; const grp = G.levelGroup;
    ch.action = 'draw'; ch.actionT = 0; G.audio.play('draw');
    // pencil lines appear, then become a real bridge
    const lines = []; const lm = new THREE.LineBasicMaterial({ color: 0x2b2b2b });
    const seg = (a, b) => { const g = new THREE.BufferGeometry().setFromPoints([a, b]); const l = new THREE.Line(g, lm); l.visible = false; grp.add(l); lines.push(l); };
    for (let i = 0; i <= 12; i++) { const z = -45 - i; seg(new V3(-1.7, 0.35, z), new V3(1.7, 0.35, z)); }
    [-1.7, 1.7].forEach((x) => { seg(new V3(x, 0.35, -45), new V3(x, 0.35, -57)); seg(new V3(x, 1.2, -45), new V3(x, 1.2, -57)); for (let i = 0; i <= 6; i++) seg(new V3(x, 0.35, -45 - i * 2), new V3(x, 1.2, -45 - i * 2)); });
    lines.forEach((l, i) => setTimeout(() => (l.visible = true), i * 32));
    setTimeout(() => {
      lines.forEach((l) => { grp.remove(l); l.geometry.dispose(); });
      grp.remove(s.g);
      const br = new THREE.Group(); br.position.set(0, 0, -51); grp.add(br);
      const deckM = G.mesh(G.geo.box, 0xfff4dc); deckM.scale.set(3.6, 0.35, 12.4); deckM.position.y = 0.175; br.add(deckM);
      for (let i = 0; i < 12; i++) { const p = G.mesh(G.geo.box, 0x2b2b2b); p.scale.set(3.62, 0.03, 0.05); p.position.set(0, 0.36, -6 + i + 0.5); br.add(p); }
      [-1.75, 1.75].forEach((x) => { const r = G.mesh(G.geo.box, 0xff5d73); r.scale.set(0.15, 0.15, 12.4); r.position.set(x, 1.2, 0); br.add(r); for (let i = 0; i <= 6; i++) { const post = G.mesh(G.geo.box, 0x2b2b2b); post.scale.set(0.12, 0.9, 0.12); post.position.set(x, 0.75, -6 + i * 2); br.add(post); } });
      br.scale.set(1, 0.01, 1); this.bridgeGrow = { g: br, t: 0 };
      G.addCol(-1.8, 0, -57.2, 1.8, 0.35, -44.8); G.addCol(-1.95, 0.35, -57.2, -1.65, 1.3, -44.8); G.addCol(1.65, 0.35, -57.2, 1.95, 1.3, -44.8);
      G.audio.play('poof'); G.burst(new V3(0, 0.8, -51), 0xfff4dc, 30, { speed: 6, size: 0.18, life: 1, spread: 5 });
      this.state.bridge = true; this.openGate(1);
      G.bubble('ludo', 'I added railings.', 2.6); setTimeout(() => G.bubble('frank', 'My son. The engineer.', 2.6), 1500);
      G.game.unlockCostume('ludo', 1);
      G.game.setObjective('Cross the bridge. Then find a way through the brick wall.');
    }, lines.length * 32 + 350);
  };
  w1.scentTargets = function () {
    const t = [];
    for (const d of this.digSpots) if (!d.dug) t.push(d.pos);
    if (this.state.gates === 0 && !this.fenceDirt.active) t.push(this.chime);
    if (!this.state.sprinklerOff && this.state.gates >= 3 && this.state.gates < 4) t.push(new V3(9, 0, -87));
    return t;
  };
  w1.dadSpots = function () { return this.state.planterMoved ? [] : [{ pos: new V3(-24, 0, -76), line: "There's definitely something behind that planter." }]; };
  w1.chessVision = function (on) { this.chessOn = on; };
  w1.onBark = function (pos, ch) {
    // wind chime: sound switch
    if (this.state.gates === 0 && pos.distanceTo(this.chime) < 7 && pos.z < -30.5) {
      G.audio.play('chime'); this.chimeRing = 2.5;
      setTimeout(() => { this.gateA.open = 0.001; this.gateA.col.active = false; this.openGate(0); G.bubble('elba', 'Good boy!', 2.5); setTimeout(() => G.bubble('luigi', '*extremely proud of himself*', 2.5), 1200); G.game.setObjective('The family is through. Head for the river.'); }, 700);
    }
    // tennis balls roll away
    this.balls.forEach((b) => { const d = b.g.position.clone().sub(pos); d.y = 0; const l = d.length(); if (l < 7) { b.vel.add(d.normalize().multiplyScalar(9 * (1 - l / 8))); } });
    // squirrels flee
    this.squirrels.forEach((s) => { if (s.g.position.distanceTo(pos) < 10 && s.state !== 'tree') { s.state = 'flee'; s.t = 0; } });
    // mower distraction
    const m = this.mower; if (this.state.boss === 'fight' && m.state === 'run' && pos.distanceTo(m.g.position) < 14) { m.distract = 2.5; m.target = pos.clone(); G.bubble('mower', 'A DOG?! I LOVE DOGS!', 2); }
  };
  w1.onChop = function (pos) { this.balls.forEach((b) => { const d = b.g.position.clone().sub(pos); d.y = 0; const l = d.length(); if (l < 3.2) b.vel.add(d.normalize().multiplyScalar(12)); }); };
  w1.objectivePos = function () {
    const g = this.state.gates;
    if (g === 0) return this.fenceDirt.active ? new V3(8, 0, -29) : this.chime;
    if (g === 1) return new V3(0, 0, -45);
    if (g === 2) return new V3(0, 0, -80);
    if (g === 3) return new V3(-10, 0, -106);
    if (g === 4) return this.state.grillOn ? new V3(0, DECK_Y, -138) : new V3(0, DECK_Y + 5.5, -128);
    return this.arenaC;
  };

  // ---------- enter ----------
  w1.enter = function () {
    G.groundAt = G.groundAtW1;
    G.cam.ceiling = undefined;
    const first = !G.save.w1Visited; G.save.w1Visited = true; G.game.persist();
    G.game.setObjective(first ? 'Explore the giant backyard. Stay together.' : 'Find a way under the fence. Luigi (5) can sniff it out with Q.');
    if (first) G.game.cutscene(async (S) => {
      const c = G.chars;
      S.cam(new V3(14, 10, 14), new V3(0, 2, -20), 1, true);
      await S.caption('World 1', 'The Great Backyard Escape');
      S.cam(new V3(6, 3.5, 12), new V3(0, 1.4, 4), 2);
      await S.say('ludo', 'Everything is HUGE.');
      await S.say('frank', 'Or... we got really small.');
      await S.say('luca', "Same thing. It's relative scale.");
      await S.say('frank', 'Great. Explain it without using math.');
      await S.say('elba', 'Okay team. We stay together. Luigi, that means you.');
      S.cam(new V3(-9, 2, -2), new V3(-15, 0.5, -5), 3);
      c.luigi.pos.set(-14, 0, -4); c.luigi.facing = -2; c.luigi.action = 'sniff'; c.luigi.actionT = 0;
      await S.say('luigi', '*already sniffing something he should not be sniffing*');
      const gl = G.game.showGlitch(new V3(0, 5, -12));
      S.cam(new V3(0, 3, 4), new V3(0, 4, -12), 2.5);
      await S.say('glitch', 'Welcome to the BACKYARD! I made it bigger. You are welcome!');
      await S.say('glitch', 'Your first compass piece is with my friend the lawnmower. He is VERY busy. Byeeee!');
      G.audio.play('glitch'); G.game.hideGlitch();
      await S.say('frank', 'The lawnmower. Of course it is the lawnmower.');
      c.luigi.action = null;
    }, () => { G.bubble('elba', 'Tip: switch family members with 1 to 5.', 4); });
  };

  // ---------- per-frame ----------
  w1.update = function (dt) {
    const t = G.time; const wdt = dt * G.worldScale; const st = this.state;
    const act = G.chars[G.game.activeId];
    this.homePortal.rotation.z += dt;
    this.waters.forEach((w, i) => { w.position.y = -0.7 + Math.sin(t * 1.5 + i) * 0.05; if (w.material.uniforms) w.material.uniforms.time.value = t * 0.5; });
    // sparks
    for (const s of this.sparks) {
      if (!s.alive) continue; s.m.rotation.y += dt * 2.5; s.m.position.y = s.base + Math.sin(t * 3 + s.m.position.x) * 0.12;
      const r = act.zoom > 0 ? 2.2 : 1.2;
      for (const id of G.ORDER) { const c = G.chars[id]; if (c.pos.distanceTo(s.m.position) < r + (id === G.game.activeId ? 0 : -0.4)) { s.alive = false; s.m.visible = false; G.game.addSpark(); break; } }
    }
    // pickups
    for (const p of this.pickups) {
      if (!p.alive) continue; p.t += dt; p.g.rotation.y += dt * 1.5; p.g.position.y = p.pos.y + Math.sin(p.t * 2) * 0.15;
      if (p.id === 'w1_stamp' && !st.planterMoved) { p.g.visible = false; continue; } p.g.visible = true;
      if (act.pos.distanceTo(p.g.position) < 1.6 || (act.pos.clone().setY(act.pos.y + 1).distanceTo(p.g.position) < 1.5)) {
        p.alive = false; G.levelGroup.remove(p.g); G.game.collect(p.id, p.kind, p.title, p.sub);
      }
    }
    // planter slide
    if (this.planterSlide !== undefined && this.planterSlide < 1) {
      this.planterSlide = Math.min(1, this.planterSlide + dt * 0.8); const x = -24 + this.planterSlide * 3.5;
      this.planter.mesh.position.x = x; G.setColBox(this.planter.col, x, 0, -76, 3.2, 2.6, 6);
      this.planterFlowers.forEach((f, i) => (f.position.x = x + Math.sin(i * 3) * 0.6));
    }
    // frisbees
    for (const m of this.movers) {
      m.t += wdt * m.speed; const k = (Math.sin(m.t) + 1) / 2; const z = G.lerp(m.z0, m.z1, k); const y = -0.1 + Math.sin(t * 2 + m.x) * 0.05;
      m.g.position.set(m.x, y, z); m.g.rotation.y += wdt * 0.6; G.setColBox(m.col, m.x, y - 0.3, z, 3.2, 0.45, 3.2);
    }
    // bridge grow
    if (this.bridgeGrow && this.bridgeGrow.t < 1) { this.bridgeGrow.t = Math.min(1, this.bridgeGrow.t + dt * 3); const e = this.bridgeGrow.t; this.bridgeGrow.g.scale.y = e < 1 ? e * 1.15 : 1; }
    if (this.sketch && !this.sketch.done) { this.sketch.pencil.position.y = 2.2 + Math.sin(t * 3) * 0.2; this.sketch.pencil.rotation.y = t; }
    // tennis balls roll
    this.balls.forEach((b) => {
      if (b.vel.lengthSq() < 0.01) return;
      const np = b.g.position.clone().addScaledVector(b.vel, dt);
      if (Math.abs(np.x) > 25) b.vel.x *= -0.6; if (np.z > 11 || np.z < -27) b.vel.z *= -0.6;
      b.g.position.x = G.clamp(np.x, -25, 25); b.g.position.z = G.clamp(np.z, -27, 11);
      b.g.rotation.x += b.vel.z * dt / 1.3; b.g.rotation.z -= b.vel.x * dt / 1.3; b.vel.multiplyScalar(1 - dt * 0.8);
      G.setColBox(b.col, b.g.position.x, 0, b.g.position.z, 2, 2.4, 2);
    });
    // chime ring
    if (this.chimeRing > 0) { this.chimeRing -= dt; this.chimeTubes.forEach((c, i) => (c.rotation.z = Math.sin(t * 12 + i) * 0.3 * this.chimeRing)); }
    // gate swing
    if (this.gateA.open > 0 && this.gateA.open < 1) { this.gateA.open = Math.min(1, this.gateA.open + dt * 0.8); this.gateA.g.rotation.y = -this.gateA.open * 1.7; }
    // fence dirt hint glow
    // squirrels
    this.squirrels.forEach((s) => this.updateSquirrel(s, dt));
    // chess tiles
    this.tiles.forEach((tl) => {
      tl.hl.material.opacity = G.damp(tl.hl.material.opacity, this.chessOn ? 0.75 : 0, 8, dt);
      if (tl.state === 'up' && !tl.safe) {
        for (const id of G.ORDER) { const c = G.chars[id]; if (c.onGround && c.groundCol === tl.col) { tl.state = 'wobble'; tl.t = 0; G.audio.play('clank'); } }
      }
      if (tl.state === 'wobble') { tl.t += dt; tl.m.rotation.z = Math.sin(tl.t * 40) * 0.05; if (tl.t > 0.35) { tl.state = 'down'; tl.t = 0; tl.col.active = false; } }
      if (tl.state === 'down') { tl.t += dt; tl.m.position.y = -0.2 - tl.t * 6; if (tl.t > 2.5) { tl.state = 'up'; tl.col.active = true; tl.m.position.y = -0.2; tl.m.rotation.z = 0; } }
    });
    this.chessArrows.forEach((l) => (l.material.opacity = G.damp(l.material.opacity, this.chessOn ? 1 : 0, 8, dt)));
    // imagination clouds
    const im = G.imaginationOn;
    this.clouds.forEach(({ c, o }) => { c.traverse((m) => { if (m.isMesh || m.isSprite) m.material.opacity = G.damp(m.material.opacity, im ? 0.92 : 0, 8, dt); }); c.position.y += Math.sin(t * 2 + c.position.x) * 0.002; o.material.opacity = im ? 0.5 : 0.12 + Math.sin(t * 3) * 0.06; });
    // sprinkler
    const sp = this.sprinkler;
    if (!st.sprinklerOff) {
      sp.angle += wdt * 1.3; sp.rot.rotation.y = sp.angle;
      if (Math.random() < 0.6) [0, PI].forEach((a) => { const aa = sp.angle + a; const p = new V3(sp.pos.x + Math.cos(aa) * 9, 1.4, sp.pos.z - Math.sin(aa) * 9); G.burst(p, 0x9fdcff, 1, { speed: 2, size: 0.12, life: 0.6, gravity: 6 }); });
      // hazard
      if (!act.invuln || act.invuln <= 0) {
        const rel = act.pos.clone().sub(sp.pos); const dist = Math.hypot(rel.x, rel.z);
        if (dist < 9.4 && dist > 1.2 && act.pos.y < 1.7) {
          const ang = Math.atan2(-rel.z, rel.x); let d = Math.abs(((ang - sp.angle) % PI + PI) % PI); d = Math.min(d, PI - d);
          if (d * dist < 0.6) G.game.hurt(act, sp.pos, 'splash');
        }
      }
    } else sp.rot.rotation.y = G.damp(sp.rot.rotation.y, sp.angle, 1, dt);
    if (this.knotShake > 0) { this.knotShake -= dt; this.knot.rotation.z = Math.sin(t * 40) * 0.3; this.knot.rotation.x = Math.cos(t * 33) * 0.2; }
    // sprinkler passed -> gate 3 counts as open for followers once past the sprinkler area
    if (st.gates === 3 && !st.stairs && act.pos.z < -100) { /* waiting on the deck climb */ }
    // grill melts ice
    if (st.grillOn && st.iceMelt < 1) {
      st.iceMelt = Math.min(1, st.iceMelt + dt * 0.3);
      this.flames.children.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 15 + i) * 0.4; });
      this.grillLight.intensity = 1.8;
      this.ice.forEach((m, i) => { const k = Math.max(0, 1 - st.iceMelt * (1 + (i % 5) * 0.08)); m.scale.set(4 * k, 4 * k, 3 * k); m.position.y = DECK_Y + 0.2 + (m.position.y - DECK_Y) * (0.98 + 0.02 * k); if (Math.random() < 0.05) G.burst(m.position, 0xbfefff, 1, { speed: 1.5, size: 0.15, life: 0.8 }); });
      if (st.iceMelt >= 1) { this.iceCol.active = false; this.ice.forEach((m) => (m.visible = false)); this.openGate(4); G.bubble('frank', 'Grillmaster. Thank you, thank you.', 3); G.game.setObjective('Down the far stairs. Something is mowing out there.'); }
    } else if (st.grillOn) { this.flames.children.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 15 + i) * 0.4; }); }
    // arena gate rising when fight starts
    if (this.arenaGateMesh.position.y < 2.2 && st.boss !== 'idle' && st.boss !== 'done') this.arenaGateMesh.position.y = Math.min(2.2, this.arenaGateMesh.position.y + dt * 4);
    if (st.boss === 'done' && this.arenaGateMesh.position.y > -3.5) this.arenaGateMesh.position.y -= dt * 3;
    // zoomies challenge
    if (st.zoom) {
      const z = st.zoom; z.t -= dt; G.game.setModeLabel(`ZOOMIES · ${z.got}/22 · ${Math.max(0, z.t).toFixed(1)}s`);
      z.tokens.forEach((k) => { if (!k.alive) return; k.m.rotation.y += dt * 4; if (act.id === 'luigi' && act.pos.distanceTo(k.m.position) < (act.zoom > 0 ? 2.0 : 1.3)) { k.alive = false; G.levelGroup.remove(k.m); z.got++; G.audio.play('spark', { pitch: z.got % 12 }); } });
      if (z.got >= 22) { st.zoom = null; G.game.setModeLabel(''); z.tokens.forEach((k) => G.levelGroup.remove(k.m)); G.game.collect('w1_zoomies', 'challenge', 'Zoomies Challenge!', 'Unlocked: ridiculous sunglasses for Luigi'); G.bubble('luca', 'That was 22 rings in under 16 seconds. He is a menace.', 3); }
      else if (z.t <= 0 || act.id !== 'luigi') { st.zoom = null; G.game.setModeLabel(''); z.tokens.forEach((k) => G.levelGroup.remove(k.m)); G.toast('So close!', 'Try again from the yellow paw pad. Zoomies (Shift) help.'); }
    }
    // Luigi AI: sometimes finds a secret on his own
    const L = G.chars.luigi;
    if (G.game.activeId !== 'luigi' && !this.luigiFound) {
      for (const d of this.digSpots) if (!d.dug && d.id !== 'w1_fence' && L.pos.distanceTo(d.pos) < 9 && act.pos.distanceTo(d.pos) < 12 && Math.random() < 0.004) { this.luigiFound = d; this.luigiFoundT = 6; G.bubble('luigi', '*sits directly on something suspicious*', 3); G.audio.play('bark', { count: 2 }); break; }
    }
    if (this.luigiFoundT > 0) { this.luigiFoundT -= dt; if (this.luigiFoundT <= 0 || this.luigiFound.dug) { this.luigiFound = null; this.luigiFoundT = 0; } }
    // proximity story beats
    this.storyBeats(act);
    // under-deck camera ceiling
    G.cam.ceiling = this.inUnderDeck(act.pos) ? DECK_Y - 1.0 : undefined;
    // boss
    this.updateBoss(dt, wdt, act);
    // doughs vs mower handled in boss
  };
  w1.aiOverride = function (ch) { if (ch.id === 'luigi' && this.luigiFound) return this.luigiFound.pos; return null; };

  w1.updateSquirrel = function (s, dt) {
    s.t -= dt; const p = s.g.position; const L = G.chars.luigi;
    if (s.state === 'idle') { s.tail.rotation.x = -0.4 + Math.sin(G.time * 6) * 0.2; if (L.pos.distanceTo(p) < 5 && G.game.activeId === 'luigi') { s.state = 'flee'; } if (s.t < 0) { s.state = 'hop'; s.t = 0.8; s.dir = G.rand(0, 6.28); } }
    else if (s.state === 'hop') { p.x += Math.sin(s.dir) * dt * 3; p.z += Math.cos(s.dir) * dt * 3; p.y = Math.abs(Math.sin(s.t * 12)) * 0.4; s.g.rotation.y = s.dir; if (s.t < 0) { s.state = 'idle'; s.t = G.rand(1, 4); p.y = 0; } if (p.distanceTo(s.home) > 8) s.dir = Math.atan2(s.home.x - p.x, s.home.z - p.z); }
    else if (s.state === 'flee') {
      const tr = this.tree.clone().add(new V3(2.6, 0, 0)); const d = tr.clone().sub(p); d.y = 0; const l = d.length();
      if (l < 0.5) { s.state = 'tree'; s.climb = 0; G.game.addSpark(3); G.burst(p.clone().add(new V3(0, 1, 0)), 0x36e0ff, 6, { speed: 3 }); if (!this.state.talked.squirrel) { this.state.talked.squirrel = 1; G.bubble('luca', 'Luigi, you have chased that squirrel four hundred times. Lifetime record: zero.', 4); } }
      else { d.normalize(); p.addScaledVector(d, dt * 9); s.g.rotation.y = Math.atan2(d.x, d.z); p.y = Math.abs(Math.sin(G.time * 20)) * 0.3; }
    } else if (s.state === 'tree') { s.climb += dt; p.y = Math.min(12, s.climb * 5); s.g.rotation.x = -PI / 2; if (s.climb > 12) { s.state = 'idle'; p.copy(s.home); s.g.rotation.x = 0; } }
    // AI Luigi chases squirrels
    if (G.game.activeId !== 'luigi' && s.state !== 'tree' && L.pos.distanceTo(p) < 6 && !this.squirrelChase) { this.squirrelChase = s; this.squirrelT = 3; s.state = 'flee'; G.bubble('luigi', '*SQUIRREL*', 1.8); }
    if (this.squirrelChase === s) { this.squirrelT -= dt; if (this.squirrelT < 0 || s.state === 'tree') this.squirrelChase = null; }
  };

  w1.storyBeats = function (act) {
    const st = this.state; const T = st.talked; const p = act.pos;
    const beat = (key, cond, fn) => { if (!T[key] && cond) { T[key] = 1; fn(); } };
    beat('fence', p.z < -21 && st.gates === 0, () => {
      G.bubble('frank', 'I have a plan.', 2.4); setTimeout(() => G.bubble('elba', 'That sentence has historically been a problem.', 3), 1800);
      setTimeout(() => G.bubble('frank', "We climb it. ...It's five meters tall. Where's Luigi?", 3.5), 4400);
      setTimeout(() => { G.bubble('luigi', '*sniffing intensely at the bottom of the fence*', 3); G.game.setObjective('Switch to Luigi (5). Hold Q to follow his nose, then dig (E) under the fence.'); }, 7600);
    });
    beat('river', p.z < -39 && !st.bridge, () => {
      G.bubble('ludo', 'I can draw us a bridge!', 2.6); setTimeout(() => G.bubble('frank', 'Can you draw one with railings?', 2.6), 1700);
      G.game.setObjective('Switch to Ludo (4) and press F at the pencil outline to draw a bridge.');
    });
    beat('chess', p.z < -58 && p.x > 5 && p.z > -64, () => { G.bubble('luca', 'Those tiles only look solid. Knight moves. I can see it.', 3.2); G.toast('Optional: Chess Patio', 'Luca\'s Chess Vision (hold Q) shows the safe path'); });
    beat('cloud', p.z < -58 && p.x < -3 && p.z > -72, () => { G.bubble('ludo', 'There are clouds here. You just can\'t see them. I can.', 3.2); G.toast('Optional: Imaginary Clouds', 'Hold Q as Ludo to see and stand on them'); });
    beat('planter', G.game.activeId === 'frank' && p.distanceTo(new V3(-22, 0, -76)) < 9 && !st.planterMoved, () => G.bubble('frank', "There's definitely something behind that planter.", 3.5));
    beat('boards', p.z < -68 && st.boards > 0 && st.bridge, () => { G.bubble('luca', 'Stand back. Boards are kind of my thing.', 3); G.game.setObjective('Switch to Luca (3) and break the boards with karate (F).'); });
    beat('sprinkler', p.z < -84 && st.gates >= 3, () => { G.bubble('elba', 'Everyone wait. I see the pattern.', 3); });
    beat('trellis', p.z < -97 && !st.stairs, () => { G.bubble('elba', 'The trellis. I can climb that.', 3); G.game.setObjective('Switch to Elba (2). Run into the trellis to climb it, then pull the lever.'); });
    beat('grill', p.y > DECK_Y - 0.5 && p.z < -112 && !st.grillOn, () => { G.bubble('frank', "Is that my grill? It's the size of a house.", 3); });
    beat('arena', p.z < -160 && st.boss === 'idle', () => this.startBoss());
  };

  // ---------- boss ----------
  w1.startBoss = function () {
    const st = this.state; st.boss = 'intro'; this.arenaGate.active = true;
    G.audio.playSong('boss'); const m = this.mower; m.state = 'run'; m.speed = 0;
    G.game.cutscene(async (S) => {
      const c = G.chars; const A = this.arenaC;
      S.cam(new V3(0, 7, -160), m.g.position.clone().add(new V3(0, 1, 0)), 2);
      m.frozen = true;
      await S.say('mower', 'SORRY! SORRY! I CANNOT STOP MOWING! I LOVE GRASS SO MUCH!');
      await S.say('luca', "It's not evil. It's just stuck on one instruction.");
      await S.say('elba', 'Everyone stop.');
      G.game.regroup(new V3(0, 0, -160), true);
      await S.say('elba', 'Luigi?');
      c.luigi.pos.set(-10, 0.4, -174); c.luigi.facing = 0.5; c.luigi.action = 'sit';
      S.cam(new V3(-7, 2.4, -169), new V3(-10, 0.8, -174), 4, true);
      await S.say('luigi', '*sitting directly on a coiled garden hose*');
      await S.say('frank', "He's sitting on the answer.");
      await S.say('luca', 'If it drives over a hose, it jams. Then we pull a battery from the panel on its back.');
      await S.say('elba', 'Three batteries. Three hoses. Lead it over one, then hit the panel with E.');
      c.luigi.action = null; c.luigi.pos.set(-2, 0, -161);
      m.frozen = false;
    }, () => {
      st.boss = 'fight'; G.game.setObjective('Lure the Robo-Mower over a hose coil, then press E at its glowing back panel. Batteries: 0/3');
      G.toast('Boss: the Runaway Robo-Mower', 'It is not evil. It just cannot stop.');
    });
  };
  w1.updateBoss = function (dt, wdt, act) {
    const st = this.state; const m = this.mower; if (st.boss !== 'fight' && st.boss !== 'intro') { if (st.boss !== 'done') G.audio.engine(false); return; }
    if (m.frozen || st.boss === 'intro') { G.audio.engine(true, 0.5); m.blades.rotation.y += dt * 20; return; }
    const g = m.g; const phase = m.hits; const maxSpeed = [5.2, 6.6, 8.0][Math.min(phase, 2)];
    m.blades.rotation.y += dt * 30;
    m.talkT -= dt; if (m.talkT < 0 && m.state === 'run') { m.talkT = G.rand(5, 8); G.bubble('mower', ['SORRY!', 'SO MUCH GRASS!', 'WATCH YOUR ANKLES!', 'I AM SO SORRY!', 'MOWING IS MY LOVE LANGUAGE!'][(Math.random() * 5) | 0], 2, m.g); }
    // family cheers from the side
    if (m.state === 'run') {
      m.speed = G.damp(m.speed, maxSpeed, 2, wdt);
      // targeting: distractions first
      let tgt = act.pos; if (m.distract > 0) { m.distract -= wdt; tgt = m.target; }
      for (const d of G.game.doughs) if (d.landed && d.pos.distanceTo(g.position) < 12) { tgt = d.pos; break; }
      if (G.game.doodle && G.game.doodle.alive) tgt = G.game.doodle.pos;
      const want = Math.atan2(tgt.x - g.position.x, tgt.z - g.position.z);
      const turn = (m.distract > 0 ? 2.8 : 1.15 + phase * 0.15) * wdt;
      let d = want - m.heading; d = ((d + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI; m.heading += G.clamp(d, -turn, turn);
      g.position.x += Math.sin(m.heading) * m.speed * wdt; g.position.z += Math.cos(m.heading) * m.speed * wdt;
      // arena boundary
      const rel = g.position.clone().sub(this.arenaC); rel.y = 0; if (rel.length() > 17) { rel.setLength(17); g.position.copy(this.arenaC).add(rel); m.heading += PI * 0.6; G.cam.shake = 0.15; }
      g.rotation.y = m.heading; g.position.y = Math.abs(Math.sin(G.time * 20)) * 0.05;
      if (Math.random() < 0.5) G.burst(g.position.clone().add(new V3(G.rand(-1.5, 1.5), 0.3, G.rand(-1.5, 1.5))), 0x6fb04e, 1, { speed: 4, size: 0.12, life: 0.6, upBias: 2 });
      // dough traps
      for (const dgh of G.game.doughs) if (dgh.landed && dgh.pos.distanceTo(g.position) < 2.4) { dgh.life = 0; m.state = 'stuck'; m.t = 1.8; G.bubble('mower', 'PIZZA?! IN MY WHEELS?!', 2); G.audio.play('squeak'); }
      // coils
      for (const c of this.coils) if (c.armed && c.pos.distanceTo(g.position) < 2.6) {
        c.armed = false; c.g.visible = false; m.state = 'tangled'; m.t = 6.5; G.audio.play('clank'); G.cam.shake = 0.5; G.burst(g.position.clone().add(new V3(0, 1, 0)), 0x2e9e4f, 20, { speed: 6, size: 0.2 });
        G.bubble('mower', 'HOSE! TANGLED! HELP! ALSO SORRY!', 2.5); G.bubble('elba', 'Now! The panel on its back!', 2.5);
      }
      if (this.coils.every((c) => !c.armed)) this.coils.forEach((c) => { c.armed = true; c.g.visible = true; G.burst(c.pos.clone().add(new V3(0, 0.5, 0)), 0x9dff5c, 8, { speed: 3 }); });
      // contact damage
      if (act.pos.distanceTo(g.position) < 2.6 && act.pos.y < 2.2) G.game.hurt(act, g.position, 'mower');
      G.audio.engine(true, m.speed / 8);
    } else if (m.state === 'stuck' || m.state === 'tangled') {
      m.t -= wdt; m.speed = 0; G.audio.engine(true, 0.25);
      g.rotation.z = Math.sin(G.time * 30) * 0.03;
      if (m.state === 'tangled') { m.panel.material.color.setHSL(0.5, 1, 0.5 + Math.sin(G.time * 10) * 0.2); if (Math.random() < 0.2) G.burst(g.position.clone().add(new V3(0, 2.4, -1.2)), 0x777777, 1, { speed: 1.5, size: 0.2, life: 1, gravity: -2 }); }
      if (m.t <= 0) { m.state = 'run'; g.rotation.z = 0; m.panel.material.color.setHex(0x36e0ff); }
    } else if (m.state === 'dead') {
      m.t += dt; g.rotation.z = G.damp(g.rotation.z, 0.12, 2, dt); G.audio.engine(false);
    }
  };
  w1.panelPos = function () { const g = this.mower.g; return new V3(g.position.x - Math.sin(this.mower.heading) * 2.6, 0, g.position.z - Math.cos(this.mower.heading) * 2.6); };
  w1.registerBossInteract = function () {
    G.addInteract({ pos: () => this.panelPos(), radius: 2.3, enabled: () => this.state.boss === 'fight' && this.mower.state === 'tangled', label: () => 'Pull a battery', onUse: (ch) => this.hitMower(ch) });
  };
  w1.hitMower = function (ch) {
    const m = this.mower; if (m.state !== 'tangled') return;
    m.batts[m.hits].visible = false; m.hits++;
    const pos = m.g.position.clone().add(new V3(0, 1.5, 0));
    G.burst(pos, 0xffe14a, 20, { speed: 8, size: 0.2, life: 1 }); G.flash(); G.audio.play('break'); G.cam.shake = 0.6;
    const lines = { frank: 'Tech support. Have you tried turning it off?', elba: 'Battery removed. Next.', luca: 'Osu!', ludo: 'I got it! I got a battery!', luigi: '*grabs the battery cable and shakes it violently*' };
    ch.action = ch.dog ? 'shake' : ch.id === 'luca' ? 'chop' : 'fix'; ch.actionT = 0; G.bubble(ch.id, lines[ch.id], 2.5);
    G.game.setObjective(`Lure the Robo-Mower over a hose coil, then press E at its glowing back panel. Batteries: ${m.hits}/3`);
    if (m.hits >= 3) { m.state = 'dead'; m.t = 0; this.defeatBoss(); return; }
    m.state = 'run'; m.speed = 0; m.heading += PI; G.bubble('mower', m.hits === 1 ? 'OW! I MEAN... THANK YOU? FASTER NOW!' : 'SO SLEEPY... BUT MUST... MOW!', 2.5);
  };
  w1.defeatBoss = function () {
    const st = this.state; st.boss = 'done'; this.arenaGate.active = false;
    G.audio.engine(false); G.audio.playSong('world1');
    const m = this.mower;
    G.game.cutscene(async (S) => {
      S.cam(m.g.position.clone().add(new V3(5, 3.5, 6)), m.g.position.clone().add(new V3(0, 1.2, 0)), 3);
      await S.say('mower', 'mowing... complete... ...thank you. I have wanted a nap for eleven years.');
      m.eyes.forEach((e) => (e.scale.y = 0.02));
      await S.say('ludo', 'Aww. It was just tired.');
      await S.say('frank', 'Honestly, relatable.');
      G.audio.play('crack');
    }, () => {
      const frag = new THREE.Group(); const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0xe2ac3f, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.2 })); shard.scale.y = 1.6; frag.add(shard);
      const l = new THREE.PointLight(0xffd36b, 2, 10); frag.add(l);
      const rays = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.04, 6, 30), new THREE.MeshBasicMaterial({ color: 0xffe9a8 })); frag.add(rays);
      frag.position.copy(m.g.position).add(new V3(0, 3.5, 0)); G.levelGroup.add(frag);
      this.pickups.push({ id: 'fragment1', kind: 'fragment', g: frag, pos: frag.position.clone(), title: 'Compass Fragment #1', sub: '', alive: true, t: 0 });
      G.game.setObjective('Grab Compass Fragment #1!');
      G.game.unlockCostume('frank', 1);
    });
  };

  G.levels = G.levels || {}; G.levels.world1 = w1;
})();
