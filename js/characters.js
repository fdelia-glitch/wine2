// The D'Elia family (plus one Glitch): rigged models from the character pipeline, procedural animation, costumes, movement.
(function () {
  const G = window.G;
  const V3 = THREE.Vector3;
  const PI = Math.PI;

  G.CHAR_INFO = {
    frank: { name: 'Frank', color: '#f0b429', key: 1 },
    elba: { name: 'Elba', color: '#19b3a6', key: 2 },
    luca: { name: 'Luca', color: '#4a74ff', key: 3 },
    ludo: { name: 'Ludo', color: '#ff5d73', key: 4 },
    luigi: { name: 'Luigi', color: '#d8743a', key: 5 },
    glitch: { name: 'The Glitch', color: '#ff3fa4' },
    mower: { name: 'Robo-Mower 3000', color: '#ff7043' },
  };
  G.ORDER = ['frank', 'elba', 'luca', 'ludo', 'luigi'];
  G.ABILITIES = {
    frank: [['F', 'Pizza Toss'], ['Q', 'Dad Instinct'], ['E', 'Grill / Fix']],
    elba: [['F', 'Plan Mode'], ['Q', 'Family Radar'], ['Space', 'Triple jump · climbs trellises']],
    luca: [['F', 'Karate'], ['Q', 'Chess Vision']],
    ludo: [['F', 'Draw'], ['Q', 'Imagination']],
    luigi: [['F', 'Bark'], ['Q', 'Scent Trail'], ['E', 'Dig / Shake'], ['Shift', 'ZOOMIES']],
  };
  const PARAMS = {
    frank: { speed: 6.3, jump: 8.8, jumps: 2, air: 28, r: 0.36, h: 1.9 },
    elba: { speed: 6.9, jump: 9.4, jumps: 3, air: 44, r: 0.32, h: 1.75, canClimb: true },
    luca: { speed: 6.7, jump: 9.0, jumps: 2, air: 32, r: 0.32, h: 1.72 },
    ludo: { speed: 6.2, jump: 8.7, jumps: 2, air: 30, r: 0.3, h: 1.42 },
    luigi: { speed: 7.8, jump: 8.4, jumps: 2, air: 32, r: 0.36, h: 0.85, small: true },
  };
  G.GRAV = 24;

  const X = G.X;
  function sph(color, sx, sy, sz, x = 0, y = 0, z = 0, o) { const m = G.mesh(G.geo.sphere, color, o); m.scale.set(sx, sy, sz); m.position.set(x, y, z); return m; }

  // ---------- materials for the family models ----------
  // Skin: wrapped diffuse with a warm red terminator (cheap subsurface look), plus a soft sheen for peach fuzz.
  const SKIN_CHUNK = THREE.ShaderChunk.lights_physical_pars_fragment
    .replace('vec3 irradiance = dotNL * directLight.color;', `vec3 irradiance = dotNL * directLight.color;
      #ifdef SKIN_WRAP
        float nlr = dot( geometryNormal, directLight.direction );
        vec3 wrapI = clamp( ( vec3( nlr ) + vec3( 0.55, 0.28, 0.2 ) ) / vec3( 1.55, 1.28, 1.2 ), 0.0, 1.0 );
        vec3 skinIrr = wrapI * wrapI * directLight.color;
      #else
        vec3 skinIrr = irradiance;
      #endif`)
    .replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution )', 'reflectedLight.directDiffuse += skinIrr * BRDF_Lambert( material.diffuseContribution )');
  if (!SKIN_CHUNK.includes('skinIrr * BRDF_Lambert')) console.warn('skin shader patch did not apply');
  function skinMaterial(src) {
    const m = new THREE.MeshPhysicalMaterial({ map: src.map, normalMap: src.normalMap, roughnessMap: src.roughnessMap, metalnessMap: src.metalnessMap, color: src.color, roughness: src.roughness, metalness: 0, normalScale: src.normalScale,
      sheen: 0.25, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.9, 0.6, 0.5), specularIntensity: 0.55, clearcoat: 0.04, clearcoatRoughness: 0.5 });
    m.defines = { SKIN_WRAP: '' };
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', SKIN_CHUNK); };
    m.customProgramCacheKey = () => 'skin';
    return m;
  }
  function prepModel(root, id) {
    const furs = [];
    root.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      const src = m.material; const k = src.userData.kind;
      if (k === 'skin') m.material = skinMaterial(src);
      else if (k === 'fur' || k === 'dogfur') furs.push(m);
      else if (k === 'hairmass') m.material = new THREE.MeshPhysicalMaterial({ color: src.color, normalMap: src.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: src.roughness, vertexColors: true, anisotropy: 0.75, anisotropyRotation: 0, specularIntensity: 0.6, sheen: 0.3, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.15, 0.12, 0.1), envMapIntensity: 0.6 });
      else if (k === 'cornea') { m.material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.02, metalness: 0, specularIntensity: 1, envMapIntensity: 1.4, depthWrite: false }); m.renderOrder = 5; m.castShadow = false; m.userData.noAO = true; }
      else if (k === 'lens') { m.material = new THREE.MeshPhysicalMaterial({ color: 0xf2f8ff, transparent: true, opacity: 0.1, roughness: 0.02, metalness: 0, specularIntensity: 1, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide }); m.renderOrder = 6; m.castShadow = false; m.userData.noAO = true; }
      else if (k === 'eye' || k === 'teeth' || k === 'dogeye') { m.castShadow = false; if (k === 'dogeye') { m.material = new THREE.MeshPhysicalMaterial({ map: src.map, color: src.color, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }); } }
      else if (src.name === 'nose') m.material = new THREE.MeshPhysicalMaterial({ color: src.color, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3, normalMap: src.normalMap });
      else if (src.name === 'tag') m.material = new THREE.MeshStandardMaterial({ color: 0xd8b24c, metalness: 1, roughness: 0.3 });
      if (src.name === 'lashes') { m.castShadow = false; }
    });
    for (const m of furs) {
      const k = m.material.userData.kind;
      const shells = X.growFur(m, m.material.userData.fur);
      shells.forEach((s) => { s.userData.noAO = true; s.layers.set(1); }); // layer 1: skipped by planar reflections
      (root.userData.shellLists = root.userData.shellLists || []).push(shells);
      if (shells.length) (root.userData.furU = root.userData.furU || []).push(shells[0].userData.furU);
      if (k === 'dogfur') { m.visible = true; m.material.roughness = 1; m.material.vertexColors = false; m.material.needsUpdate = true; }
    }
    root.userData.furShells = furs;
  }

  // ---------- family members ----------
  function landmarks(scene) { let l = null; scene.traverse((o) => { if (o.userData && o.userData.landmarks) l = o.userData.landmarks; }); return l; }
  function buildFromModel(id) {
    const src = G.models[id];
    const model = X.SkeletonUtils.clone(src.scene);
    prepModel(model, id);
    const root = new THREE.Group(); const rig = new THREE.Group(); root.add(rig);
    const box = new THREE.Box3().setFromObject(src.scene); const h = box.max.y - box.min.y;
    const flip = new THREE.Group(); flip.position.y = h * 0.5; rig.add(flip); model.position.y = -h * 0.5; flip.add(model);
    const ch = makeChar(id, root, rig);
    ch.model = model; ch.flipG = flip; ch.height = h; ch.furU = model.userData.furU; ch.shellLists = model.userData.shellLists || [];
    ch.lm = landmarks(src.scene);
    const bones = {}; model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    ch.bones = bones;
    return ch;
  }
  function restPos(ch, name) { const acc = new V3(); let p = ch.bones[name]; while (p && p !== ch.model) { acc.add(p.position); p = p.parent; } return acc; }
  function attachHead(ch, obj, worldLike) {
    // worldLike is a model-space position (metres); rest bones have identity rotation so offsets are plain subtraction
    const hb = ch.bones.head; const hp = new V3(); let p = hb; const acc = new V3();
    while (p && p !== ch.model) { acc.add(p.position); p = p.parent; }
    obj.position.copy(worldLike).sub(acc); hb.add(obj); return obj;
  }
  function attachBone(ch, bone, obj, modelPos) {
    const b = ch.bones[bone]; const acc = new V3(); let p = b; while (p && p !== ch.model) { acc.add(p.position); p = p.parent; }
    obj.position.copy(modelPos).sub(acc); b.add(obj); return obj;
  }
  const fab = (c, o = {}) => G.mat(c, Object.assign({ kind: 'fabric', tile: 0.08 }, o));
  function lathe(pts, seg = 48) { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg); g.computeVertexNormals(); return g; }
  function puffy(geo, amt, freq, seed = 1) { // gentle noise displacement for fabric volume
    const p = geo.attributes.position; const n = geo.attributes.normal; const v = new V3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const d = Math.sin(v.x * freq + seed) * Math.sin(v.y * freq * 1.3 + seed * 2) * Math.sin(v.z * freq * 0.9 + seed * 3); p.setXYZ(i, v.x + n.getX(i) * d * amt, v.y + n.getY(i) * d * amt, v.z + n.getZ(i) * d * amt); }
    geo.computeVertexNormals(); return geo;
  }
  function meshOf(geo, mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; }

  function humanCostumes(ch) {
    const L = ch.lm || {}; const top = new V3(...(L.headTop || [0, ch.height, 0])); const eye = new V3(...(L.eyeMid || [0, ch.height - 0.12, 0.08]));
    const hr = Math.max(0.085, (top.y - eye.y) * 0.95); // head radius estimate
    const cy = eye.y + (top.y - eye.y) * 0.45, cz = eye.z - hr * 0.75; // skull centre
    const add = (name, unlock, parts, onSet) => { parts.forEach((p) => (p.visible = false)); ch.costumes.push({ name, unlock, parts, onSet }); };
    if (ch.id === 'frank') {
      const hat = new THREE.Group();
      const band = meshOf(lathe([[hr * 1.02, 0], [hr * 1.04, hr * 0.5], [hr * 1.0, hr * 0.52]]), fab(0xfbfbf8)); hat.add(band);
      const puff = meshOf(puffy(new THREE.SphereGeometry(hr * 1.25, 40, 24), hr * 0.08, 30), fab(0xffffff)); puff.scale.set(1, 0.72, 1); puff.position.y = hr * 0.95; hat.add(puff);
      hat.position.set(0, top.y - hr * 0.35, cz + hr * 0.1); hat.rotation.x = -0.15; attachHead(ch, hat, hat.position.clone());
      const apron = meshOf(new THREE.CylinderGeometry(0.2, 0.25, 0.62, 24, 6, true, -0.9, 1.8), fab(0x2b2d33, { side: true }));
      attachBone(ch, 'spine1', apron, restPos(ch, 'spine1').add(new V3(0, 0.12, 0.0)));
      add('Grillmaster', 'Beat the Runaway Robo-Mower', [apron, hat]);
    }
    if (ch.id === 'elba') {
      const hat = new THREE.Group();
      const brim = meshOf(lathe([[hr * 0.95, 0.004], [hr * 1.9, -0.012], [hr * 2.05, -0.02], [hr * 2.05, -0.026], [hr * 1.9, -0.02], [hr * 0.95, -0.006]], 64), G.mat(0xc9a66e, { kind: 'fabric', tile: 0.05, side: true })); hat.add(brim);
      const crown = meshOf(lathe([[hr * 1.0, 0], [hr * 1.03, hr * 0.5], [hr * 0.9, hr * 0.78], [0.001, hr * 0.84]], 48), G.mat(0xc9a66e, { kind: 'fabric', tile: 0.05 })); hat.add(crown);
      const rib = meshOf(lathe([[hr * 1.035, hr * 0.04], [hr * 1.045, hr * 0.14], [hr * 1.035, hr * 0.2]]), fab(0x19b3a6)); hat.add(rib);
      hat.position.set(0, top.y - hr * 0.42, cz); hat.rotation.set(-0.08, 0, -0.08); attachHead(ch, hat, hat.position.clone());
      add('Adventurer', 'Find all 3 family photos in World 1', [hat]);
    }
    if (ch.id === 'luca') {
      const band = meshOf(new THREE.TorusGeometry(hr * 1.02, hr * 0.07, 10, 48), fab(0xd62828)); band.rotation.x = Math.PI / 2 - 0.2; band.scale.set(1, 1.12, 1);
      band.position.set(0, eye.y + hr * 0.42, cz); attachHead(ch, band, band.position.clone());
      const tails = meshOf(new THREE.BoxGeometry(0.03, 0.16, 0.004), fab(0xd62828, { side: true })); tails.position.set(0.02, eye.y + hr * 0.25, cz - hr * 1.05); tails.rotation.z = 0.4; attachHead(ch, tails, tails.position.clone());
      const belt = meshOf(new THREE.TorusGeometry(0.16, 0.018, 8, 40), fab(0x151515)); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.8, 1); attachBone(ch, 'hips', belt, new V3(0, ch.height * 0.56, 0.0));
      add('Karate Gi', 'Find the golden chess knight', [belt, band, tails]);
    }
    if (ch.id === 'ludo') {
      const beret = meshOf(puffy(lathe([[0.001, hr * 0.42], [hr * 0.8, hr * 0.36], [hr * 1.18, hr * 0.14], [hr * 1.12, 0], [hr * 0.95, -0.01]], 48), 0.003, 40), fab(0xc8263a)); 
      beret.position.set(hr * 0.12, top.y - hr * 0.35, cz); beret.rotation.set(-0.12, 0, -0.28); attachHead(ch, beret, beret.position.clone());
      const pal = new THREE.Group(); const board = meshOf(new THREE.CylinderGeometry(0.1, 0.1, 0.008, 32), G.mat(0xd9b27a, { kind: 'grain', tile: 0.2 })); board.scale.set(1, 1, 0.75); pal.add(board);
      [0xff4040, 0x3a7bff, 0xffd23a, 0x3fbf5a].forEach((c, i) => { const d = meshOf(new THREE.SphereGeometry(0.014, 16, 8), G.mat(c, { rough: 0.25 })); d.scale.y = 0.4; d.position.set(Math.cos(i * 1.3) * 0.06, 0.006, Math.sin(i * 1.3) * 0.045); pal.add(d); });
      pal.rotation.x = Math.PI / 2; attachBone(ch, 'hand_L', pal, restPos(ch, 'hand_L').add(new V3(0.01, -0.07, 0.03)));
      add('Artist', 'Draw your first bridge', [beret, pal]);
    }
  }

  function luigiCostumes(ch) {
    const b = ch.bones; const hp = new V3(); let p = b.head; while (p && p !== ch.model) { hp.add(p.position); p = p.parent; }
    const nose = ch.noseP || hp.clone().add(new V3(0, 0, 0.16));
    const add = (name, unlock, parts, o = {}) => { parts.forEach((q) => (q.visible = false)); ch.costumes.push(Object.assign({ name, unlock, parts }, o)); };
    // bandana around the neck
    const band = new THREE.Group();
    const tri = meshOf(new THREE.ConeGeometry(0.09, 0.14, 3, 1, true), fab(0xd62f3a, { side: true })); tri.rotation.x = Math.PI; tri.scale.z = 0.35; tri.position.set(0, -0.09, 0.07); band.add(tri);
    const ring = meshOf(new THREE.TorusGeometry(0.085, 0.018, 8, 32), fab(0xd62f3a)); ring.rotation.x = Math.PI / 2 - 0.5; band.add(ring);
    attachBone(ch, 'neck', band, hp.clone().add(new V3(0, -0.06, -0.05)));
    const shades = new THREE.Group();
    [-1, 1].forEach((sd) => { const l = meshOf(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 5), new THREE.MeshPhysicalMaterial({ color: 0x180a20, roughness: 0.05, metalness: 0.2, clearcoat: 1, iridescence: 0.8 })); l.rotation.x = Math.PI / 2; l.position.set(sd * 0.042, 0, 0); shades.add(l);
      const fr = meshOf(new THREE.TorusGeometry(0.031, 0.004, 6, 5), G.mat(0xff3fa4, { kind: 'plastic' })); fr.position.set(sd * 0.042, 0, 0.002); shades.add(fr); });
    const br = meshOf(new THREE.BoxGeometry(0.03, 0.006, 0.006), G.mat(0xff3fa4, { kind: 'plastic' })); shades.add(br);
    shades.position.copy(ch.eyeP || hp.clone().add(new V3(0, 0.03, 0.09))); shades.position.z += 0.028; attachBone(ch, 'head', shades, shades.position.clone());
    const kb = meshOf(new THREE.TorusGeometry(0.075, 0.009, 8, 32), fab(0xd62828)); kb.rotation.x = Math.PI / 2 + 0.25; attachBone(ch, 'head', kb, hp.clone().add(new V3(0, 0.07, 0.0)));
    const chef = new THREE.Group(); chef.add(meshOf(lathe([[0.05, 0], [0.052, 0.05]]), fab(0xffffff))); const pf = meshOf(puffy(new THREE.SphereGeometry(0.065, 32, 16), 0.005, 60), fab(0xffffff)); pf.scale.set(1, 0.7, 1); pf.position.y = 0.075; chef.add(pf);
    chef.rotation.z = 0.25; attachBone(ch, 'head', chef, hp.clone().add(new V3(0, 0.1, -0.01)));
    add('Bandana', 'Dig up all 3 Luigi treasures in World 1', [band], { hideHarness: true });
    add('Ridiculous sunglasses', 'Win the Zoomies Challenge', [shades]);
    add('Karate headband', 'Find the hidden travel stamp', [kb]);
    add('Chef hat', 'Find both pizza toppings', [chef]);
  }

  // ---------- Shared character object ----------
  function makeChar(id, root, rig) {
    const P = PARAMS[id];
    return {
      id, info: G.CHAR_INFO[id], p: P, root, rig, pos: root.position, vel: new V3(), r: P.r, h: P.h, small: !!P.small, canClimb: !!P.canClimb,
      onGround: false, coyote: 0, jumpBuf: 0, jumpsUsed: 0, facing: 0, walkPhase: Math.random() * 6, speed01: 0,
      action: null, actionT: 0, blinkT: G.rand(1, 4), talkT: 0, zoom: 0, zoomCd: 0, costume: 0, lookYaw: 0, mood: 'happy', airT: 0,
      eyes: [], legs: [], arms: [],
    };
  }

  G.buildCharacter = function (id) {
    const ch = buildFromModel(id);
    ch.costumes = [{ name: id === 'luigi' ? 'Green harness' : 'Classic', parts: [] }];
    if (id === 'luigi') {
      ch.dog = true;
      ch.anim = new X.DogRig(ch.model);
      // muzzle anchor (for carried items) and harness meshes
      let noseM = null, eyeM = null; ch.harnessParts = [];
      ch.model.traverse((o) => { if (o.isMesh && o.material && o.material.name === 'nose') noseM = o; if (o.isMesh && o.material && (o.material.name === 'harness' || o.material.name === 'tag')) ch.harnessParts.push(o); if (o.isMesh && o.userData && o.material.name === 'dogeye') eyeM = o; });
      const bb = new THREE.Box3();
      if (noseM) { bb.setFromObject(noseM); ch.noseP = bb.getCenter(new V3()).sub(ch.model.position).sub(ch.flipG.position); }
      if (eyeM) { bb.setFromObject(eyeM); ch.eyeP = bb.getCenter(new V3()).sub(ch.model.position).sub(ch.flipG.position); ch.eyeP.x = 0; }
      ch.muzzle = new THREE.Object3D(); attachBone(ch, 'jaw', ch.muzzle, ch.noseP ? ch.noseP.clone().add(new V3(0, -0.02, 0.0)) : new V3(0, 0.6, 0.4));
      ch.harness = { set visible(v) { ch.harnessParts.forEach((m) => (m.visible = v)); }, get visible() { return ch.harnessParts[0] ? ch.harnessParts[0].visible : true; } };
      luigiCostumes(ch);
    } else {
      ch.human = true;
      ch.anim = new X.HumanRig(ch.model);
      humanCostumes(ch);
    }
    ch.root.userData.charId = id;
    return ch;
  };

  G.setCostume = function (ch, idx) {
    ch.costumes.forEach((c, i) => { c.parts.forEach((p) => (p.visible = i === idx)); if (c.onSet && ch.costume === i && i !== idx) c.onSet(false); });
    const c = ch.costumes[idx]; if (c && c.onSet) c.onSet(true);
    if (ch.harness) ch.harness.visible = !(c && c.hideHarness);
    ch.costume = idx;
  };

  // ---------- Movement ----------
  function approach(v, t, d) { return v < t ? Math.min(v + d, t) : Math.max(v - d, t); }
  // input: {x,z} world-space desired direction (len 0..1)
  G.moveChar = function (ch, dt, inp, jumpPressed, jumpHeld, sprint) {
    const P = ch.p;
    if (ch.frozen) { inp = { x: 0, z: 0 }; jumpPressed = false; }
    let spd = P.speed * (sprint && !ch.small ? 1.35 : 1);
    if (ch.zoom > 0) {
      spd = P.speed * 2.5;
      // zoomies: always running, steering is twitchy
      const f = { x: Math.sin(ch.facing), z: Math.cos(ch.facing) };
      const wob = Math.sin(G.time * 9) * 0.35;
      const want = Math.hypot(inp.x, inp.z) > 0.2 ? Math.atan2(inp.x, inp.z) : ch.facing + wob * 0.2;
      ch.facing = G.angleLerp(ch.facing, want + wob * 0.3, Math.min(1, dt * 5));
      inp = { x: Math.sin(ch.facing), z: Math.cos(ch.facing) };
    }
    const tx = inp.x * spd, tz = inp.z * spd;
    const acc = (ch.onGround ? 60 : P.air) * (ch.zoom > 0 ? 0.55 : 1);
    ch.vel.x = approach(ch.vel.x, tx, acc * dt); ch.vel.z = approach(ch.vel.z, tz, acc * dt);
    const il = Math.hypot(inp.x, inp.z);
    if (il > 0.1 && ch.zoom <= 0) ch.facing = G.angleLerp(ch.facing, Math.atan2(inp.x, inp.z), Math.min(1, dt * 14));
    // jumping
    if (ch.onGround) { ch.coyote = 0.12; ch.jumpsUsed = 0; } else ch.coyote -= dt;
    if (jumpPressed) ch.jumpBuf = 0.13; else ch.jumpBuf -= dt;
    if (ch.jumpBuf > 0) {
      if (ch.onGround || ch.coyote > 0) {
        ch.vel.y = P.jump; ch.jumpsUsed = 1; ch.coyote = 0; ch.jumpBuf = 0; ch.onGround = false; ch.bounced = null;
        G.audio.play('jump'); ch.squash = 0.25;
      } else if (ch.jumpsUsed < P.jumps || (ch.climbing && ch.canClimb)) {
        ch.vel.y = P.jump * (ch.jumpsUsed >= 2 ? 0.8 : 0.9); ch.jumpsUsed = Math.max(ch.jumpsUsed, 1) + 1; ch.jumpBuf = 0; ch.flip = 1; ch.bounced = null;
        G.audio.play('jump2'); G.ring(ch.pos.clone().add(new V3(0, 0.1, 0)), 0xffffff, { size: 1.2, dur: 0.35, tube: 0.04 });
      }
    }
    if (!jumpHeld && ch.vel.y > 0 && !ch.bounceRise) ch.vel.y -= G.GRAV * 1.3 * dt;
    // climbing (Elba on trellis)
    if (ch.climbing && ch.canClimb && il > 0.1) {
      ch.vel.y = 4.6; ch.jumpsUsed = 0; ch.isClimbing = 0.15;
    } else ch.vel.y -= G.GRAV * dt;
    if (ch.isClimbing > 0) ch.isClimbing -= dt;
    ch.vel.y = Math.max(ch.vel.y, -30);
    ch.justLanded = false; ch.bounced = ch.vel.y > 0 ? ch.bounced : null;
    const vy0 = ch.vel.y;
    G.stepBody(ch, dt);
    if (ch.justLanded) { ch.squash = Math.min(0.35, -vy0 * 0.02); if (vy0 < -8) G.audio.play('land'); if (vy0 < -6) G.burst(ch.pos.clone(), 0xd9c9a3, 6, { speed: 2, size: 0.08, life: 0.4 }); }
    if (ch.bounced) { G.audio.play('boing'); ch.bounced.onBounceFx && ch.bounced.onBounceFx(); ch.bounced = null; ch.jumpsUsed = 1; ch.bounceRise = true; ch.flip = 1; }
    if (ch.vel.y <= 0 || ch.onGround) ch.bounceRise = false;
    ch.airT = ch.onGround ? 0 : ch.airT + dt;
    ch.speed01 = Math.min(1, Math.hypot(ch.vel.x, ch.vel.z) / P.speed);
  };

  // AI follower: walk toward a target point, hop over small stuff
  G.aiFollow = function (ch, dt, target, stopDist = 2.2) {
    const dx = target.x - ch.pos.x, dz = target.z - ch.pos.z; const d = Math.hypot(dx, dz);
    let inp = { x: 0, z: 0 }, jump = false;
    if (d > stopDist) {
      const k = Math.min(1, (d - stopDist) / 1.5 + 0.35); inp = { x: (dx / d) * k, z: (dz / d) * k };
      ch.stuckT = (ch.stuckT || 0) + (ch.speed01 < 0.2 ? dt : -dt); ch.stuckT = Math.max(0, ch.stuckT);
      if ((ch.hitWall && ch.onGround) || (target.y > ch.pos.y + 0.9 && d < 5 && ch.onGround) || ch.stuckT > 0.4) { jump = true; ch.stuckT = 0; }
    }
    G.moveChar(ch, dt, inp, jump, jump || ch.vel.y > 0, d > 8);
    return d;
  };

  // ---------- Animation ----------
  // Gameplay state -> procedural rig state. Poses: model-space upper-arm direction (x = outward), elbow bend.
  const DOWN = [0.16, -1, 0.02, 0.15];
  const HUMAN_ACTIONS = {
    throw: { dur: 0.5, f: (u) => ({ armPose: { R: u < 0.15 ? [0.35, 0.55, -0.7, 1.7] : [0.08, 0.45, 1, 0.15], L: [0.35, -0.5, 0.6, 0.5] }, expression: 'determined' }) },
    chop: { dur: 0.45, f: (u) => ({ armPose: { R: u < 0.12 ? [0.15, 1, 0.25, 0.4] : [0.06, -0.35, 1, 0.1], L: [0.3, -0.6, 0.5, 0.6] }, legPose: { L: [0, 0, 0.18], R: [0, 0, -0.14] }, hipDrop: 0.05, expression: 'determined', fist: true }) },
    kata: { dur: 1.2, f: (u) => { const s = Math.floor(u * 4) % 4; const P = [[0.05, 0.12, 1, 0], [0.25, -0.45, -0.2, 2.3]]; const a = s % 2 ? P[1] : P[0], b = s % 2 ? P[0] : P[1];
      return { armPose: { R: s === 2 ? [0.25, 1, 0.5, 1.2] : a, L: s === 3 ? [0.25, 1, 0.5, 1.2] : b }, legPose: { L: [0.1, 0, s % 2 ? 0.2 : -0.1], R: [0.1, 0, s % 2 ? -0.1 : 0.2] }, hipDrop: 0.08, expression: 'determined', fist: true }; } },
    draw: { dur: 1.6, f: (u) => ({ armPose: { R: [0.12 + Math.cos(u * 20) * 0.12, -0.05 + Math.sin(u * 20) * 0.15, 1, 0.35], L: [0.25, -0.35, 0.8, 1.3] }, expression: 'happy' }) },
    cheer: { dur: 2, f: (u) => ({ celebrate: true, expression: 'grin' }) },
    point: { dur: 1.5, f: (u) => ({ armPose: { R: [0.05, 0.18, 1, 0], L: DOWN }, expression: 'happy' }) },
    plan: { dur: 1, f: (u) => ({ armPose: { R: [0.28, -0.3, 0.9, 1.4], L: [0.28, -0.3, 0.9, 1.4] }, expression: 'determined' }) },
    think: { dur: 2, f: (u) => ({ armPose: { R: [0.1, -0.45, 0.6, 2.5], L: [-0.15, -0.7, 0.55, 1.9] }, expression: 'worried', lookUp: true }) },
    fix: { dur: 1.2, f: (u) => ({ armPose: { R: [0.12, -0.3 + Math.sin(u * 25) * 0.3, 1, 0.9], L: [0.25, -0.5, 0.9, 0.6] }, crouch: 0.6, expression: 'determined', fist: true }) },
    shrug: { dur: 1.2, f: (u) => ({ armPose: { R: [0.8, -0.55, 0.35, 1.7], L: [0.8, -0.55, 0.35, 1.7] }, expression: 'worried' }) },
    surprised: { dur: 1.4, f: (u) => ({ armPose: { R: [0.55, 0.1, 0.55, 2.0], L: [0.55, 0.1, 0.55, 2.0] }, expression: 'surprised' }) },
    sit: { dur: 1e9, f: (u) => ({ armPose: { R: [0.2, -0.75, 0.55, 0.9], L: [0.2, -0.75, 0.55, 0.9] }, hipDrop: 0.42, legPose: { L: [0.02, 0, 0.38], R: [0.02, 0, 0.38] } }) },
  };
  const DOG_ACTIONS = { bark: 0.5, dig: 1.2, shake: 1.2, sniff: 1.2, howl: 2.5, sit: 1e9, sleep: 1e9, beg: 1e9, hold: 1e9 };
  const _lp = new V3();
  G.animateChar = function (ch, dt) {
    const prevYaw = ch.root.rotation.y;
    ch.root.rotation.y = G.angleLerp(ch.root.rotation.y, ch.facing, Math.min(1, dt * 12));
    let dy = ch.root.rotation.y - prevYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    ch.turnRate = G.damp(ch.turnRate || 0, dy / Math.max(dt, 1e-3), 10, dt);
    const landed = ch.justLanded ? Math.min(14, (ch.squash || 0.1) * 40) : 0;
    ch.squash = G.damp(ch.squash || 0, 0, 10, dt);
    // double-jump somersault around the body centre
    if (!ch.onGround && ch.flip > 0) { ch.flip = Math.max(0, ch.flip - dt * (ch.dog ? 2.4 : 2.6)); ch.flipG.rotation.x = (ch.dog ? -1 : 1) * (1 - ch.flip) * Math.PI * 2; if (ch.flip === 0) ch.flipG.rotation.x = 0; }
    if (ch.onGround) { ch.flip = 0; ch.flipG.rotation.x = G.damp(ch.flipG.rotation.x, 0, 20, dt); }
    const speed = Math.hypot(ch.vel.x, ch.vel.z);
    const grounded = ch.onGround || (ch.airT || 0) < 0.08;
    // actions: advance the timer and expire exactly as the old rigs did
    let pose = {};
    if (ch.action) {
      ch.actionT += dt; const u = ch.actionT;
      if (ch.dog) { const d = DOG_ACTIONS[ch.action]; if (d !== undefined && u > d) ch.action = null; }
      else { const A = HUMAN_ACTIONS[ch.action]; if (A) { if (u > A.dur) ch.action = null; else pose = A.f(u); } else if (u > 2) ch.action = null; }
    }
    // fur LOD: fewer shells as the character gets smaller on screen
    if (ch.shellLists && ch.shellLists.length) {
      const d = G.camera.position.distanceTo(ch.root.position) * (G.camera.fov / 50);
      const stride = d < 3.5 ? 1 : d < 9 ? 3 : d < 20 ? 6 : 99;
      if (stride !== ch.furStride) { ch.furStride = stride; ch.shellLists.forEach((L) => L.forEach((s, i) => (s.visible = i === 0 || (stride < 99 && (i + 1) % stride === 0)))); }
    }
    ch.sleeping = ch.action === 'sleep';
    if (ch.dog) {
      const zoomT = ch.zoom > 0;
      const s = { speed: speed * (zoomT ? 1.3 : 1), grounded, action: ch.action, u: ch.actionT, lookYaw: ch.lookYaw || 0, tilt: ch.action ? 0 : Math.sin(G.time * 0.3 + ch.walkPhase) * 0.4 * (speed < 0.2 ? 1 : 0), bark: ch.action === 'bark' && ch.actionT < 0.3, happy: speed > 1 || zoomT || ch.action === 'dig', turn: ch.turnRate };
      ch.anim.update(dt, s);
      // coat reacts to motion: fur trails behind and settles with gravity
      if (ch.furU) { _lp.set(ch.vel.x, ch.vel.y, ch.vel.z).applyAxisAngle(new V3(0, 1, 0), -ch.root.rotation.y).multiplyScalar(-0.035); _lp.y -= 0.35; ch.furU.forEach((U) => { U.uGravity.value.lerp(_lp, 1 - Math.exp(-8 * dt)); U.uTime.value = G.time; U.uWind.value = 0.03; }); }
      if (ch.zoom > 0 && Math.random() < 0.4 && ch.onGround) G.burst(ch.pos.clone(), 0xa89272, 1, { speed: 1.5, size: 0.05, life: 0.4, gravity: 2, lit: true });
      return;
    }
    // humans
    let lookAt = null;
    if (ch.lookYaw) lookAt = new V3(Math.sin(ch.lookYaw) * 3, ch.height * 0.92, Math.cos(ch.lookYaw) * 3);
    else if (G.game && G.game.activeId && G.game.activeId !== ch.id && speed < 0.3 && !ch.action) {
      const a = G.chars[G.game.activeId]; if (a) { _lp.copy(a.pos); _lp.y += a.dog ? 0.4 : 1.5; lookAt = ch.root.worldToLocal(_lp.clone()); if (lookAt.z < 0.2) lookAt = null; }
    }
    if (pose.lookUp) lookAt = new V3(0.4, ch.height + 0.8, 1.5);
    const climbing = !ch.onGround && ch.isClimbing > 0;
    const s = Object.assign({ dt, speed, grounded, vy: ch.vel.y, landed, turn: ch.turnRate, lookAt, talking: ch.talkT > 0, expression: ch.talkT > 0 ? 'happy' : 'neutral', action: climbing ? 'climb' : null }, pose);
    if (ch.talkT > 0) ch.talkT -= dt;
    ch.anim.update(dt, s);
  };

  // ---------- The Glitch ----------
  G.buildGlitch = function () {
    const root = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshBasicMaterial({ color: 0xff3fa4 }));
    const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), new THREE.MeshBasicMaterial({ color: 0x36e0ff, wireframe: true }));
    root.add(core, wire);
    const eye = new THREE.Group(); eye.position.set(0, 0.08, 0.5); root.add(eye);
    eye.add(sph(0xffffff, 0.25, 0.28, 0.12, 0, 0, 0, { basic: true })); eye.add(sph(0x36e0ff, 0.13, 0.14, 0.06, 0, 0, 0.08, { basic: true })); eye.add(sph(0x0b0b12, 0.07, 0.08, 0.04, 0, 0, 0.12, { basic: true }));
    const grin = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 12, PI), new THREE.MeshBasicMaterial({ color: 0xffffff })); grin.rotation.z = PI; grin.position.set(0, -0.2, 0.5); root.add(grin);
    const bits = [];
    for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(G.geo.box, new THREE.MeshBasicMaterial({ color: [0xff3fa4, 0x36e0ff, 0xffe14a, 0x9dff5c][i % 4] })); b.scale.setScalar(G.rand(0.06, 0.14)); root.add(b); bits.push({ m: b, a: Math.random() * 6.28, r: G.rand(0.8, 1.3), s: G.rand(1, 3), y: G.rand(-0.5, 0.5) }); }
    const light = new THREE.PointLight(0xff3fa4, 1.2, 8); root.add(light);
    const gl = { id: 'glitch', root, core, wire, eye, bits, pos: root.position, update(dt) {
      const t = G.time; core.rotation.y += dt * 1.2; core.rotation.x += dt * 0.7; wire.rotation.y -= dt * 0.8;
      const h = (t * 0.2) % 1; core.material.color.setHSL(0.9 + Math.sin(t * 2) * 0.05, 1, 0.6);
      core.position.set(0, 0, 0); if (Math.random() < 0.06) { core.position.x = G.rand(-0.1, 0.1); wire.scale.setScalar(G.rand(0.9, 1.2)); } else wire.scale.setScalar(1);
      root.children[0].scale.setScalar(1 + Math.sin(t * 5) * 0.05);
      bits.forEach((b) => { b.a += dt * b.s; b.m.position.set(Math.cos(b.a) * b.r, b.y + Math.sin(b.a * 2) * 0.2, Math.sin(b.a) * b.r); b.m.rotation.x += dt * 3; });
      eye.scale.y = Math.random() < 0.01 ? 0.1 : G.damp(eye.scale.y, 1, 10, dt);
      light.intensity = 1 + Math.sin(t * 8) * 0.3;
    } };
    return gl;
  };

  // ---------- Portraits ----------
  G.makePortraits = function () {
    const out = {};
    try {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setSize(192, 192); r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = 1.1;
      const pm = new THREE.PMREMGenerator(r); const env = pm.fromScene(new X.RoomEnvironment(), 0.04).texture;
      for (const id of G.ORDER) {
        const sc = new THREE.Scene(); sc.environment = env; sc.environmentIntensity = 0.7;
        const dl = new THREE.DirectionalLight(0xfff0e0, 2.2); dl.position.set(1.5, 2, 3); sc.add(dl);
        const rim = new THREE.DirectionalLight(0xcfe0ff, 1.5); rim.position.set(-2, 1, -2); sc.add(rim);
        sc.background = new THREE.Color(G.CHAR_INFO[id].color).multiplyScalar(0.35);
        const ch = G.buildCharacter(id); sc.add(ch.root);
        for (let i = 0; i < 3; i++) ch.anim.update(1 / 30, ch.dog ? { speed: 0, grounded: true, happy: true } : { dt: 1 / 30, speed: 0, grounded: true, expression: 'happy' });
        ch.root.updateMatrixWorld(true);
        const cam = new THREE.PerspectiveCamera(24, 1, 0.02, 20); cam.layers.enable(1);
        const hp = new V3(); ch.bones.head.getWorldPosition(hp);
        if (id === 'luigi') { const n = ch.noseP ? ch.noseP.clone() : hp; cam.position.set(hp.x + 0.25, hp.y + 0.08, hp.z + 0.75); cam.lookAt(hp.x, hp.y + 0.02, (hp.z + n.z) / 2); }
        else { const e = ch.lm ? new V3(...ch.lm.eyeMid) : hp; cam.position.set(e.x + 0.12, e.y + 0.0, e.z + 0.62); cam.lookAt(e.x, e.y - 0.035, e.z); }
        r.render(sc, cam); out[id] = r.domElement.toDataURL();
      }
      pm.dispose(); r.dispose();
    } catch (e) { console.warn('portraits failed', e); }
    return out;
  };
})();
