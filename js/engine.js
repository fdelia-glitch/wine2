// Engine: renderer, toon materials, AABB physics, input, camera, particles, UI helpers.
(function () {
  const G = (window.G = window.G || {});
  const V3 = THREE.Vector3;
  G.V3 = V3;
  G.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.angleLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
  G.time = 0; G.worldScale = 1; G.paused = false;

  // ---------- Renderer ----------
  // Physically based pipeline: PBR materials, sky-driven image-based lighting, a player-following soft sun shadow,
  // then HDR post: ground-truth AO, subtle bloom, AgX tone mapping, MSAA.
  G.quality = (() => { try { return localStorage.getItem('sc-quality') || 'high'; } catch (e) { return 'high'; } })();
  G.initRenderer = function () {
    const canvas = document.getElementById('game');
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, G.quality === 'high' ? 1.5 : 1));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.NeutralToneMapping; // applied by the OutputPass (render targets stay linear HDR)
    G.renderer = r;
    G.scene = new THREE.Scene();
    G.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 1500); G.camera.layers.enable(1);
    // lights: the sky environment does the fill, the sun does key + shadows
    G.hemi = new THREE.HemisphereLight(0xdff1ff, 0x6a5a3a, 0.0); G.scene.add(G.hemi);
    G.sun = new THREE.DirectionalLight(0xfff1dd, 3.2);
    G.sun.castShadow = true; G.sun.shadow.mapSize.set(4096, 4096); G.sun.shadow.radius = 3;
    const sc = G.sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
    G.sun.shadow.bias = -0.0004; G.sun.shadow.normalBias = 0.03;
    G.scene.add(G.sun); G.scene.add(G.sun.target);
    G.amb = new THREE.AmbientLight(0xffffff, 0.0); G.scene.add(G.amb);
    G.pmrem = new THREE.PMREMGenerator(r);
    // post
    const X = G.X;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const comp = new X.EffectComposer(r, rt);
    comp.addPass(new X.RenderPass(G.scene, G.camera));
    const ao = new X.GTAOPass(G.scene, G.camera, 1, 1);
    ao.blendIntensity = 0.85;
    ao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    // fur shells, particles and glow effects stay out of the AO normal pass
    const ov = ao._overrideVisibility.bind(ao);
    ao._overrideVisibility = function () { ov(); const cache = this._visibilityCache; this.scene.traverse((o) => { if (o.visible && (o.userData.noAO || (o.material && (o.material.transparent || o.material.isMeshBasicMaterial)))) { o.visible = false; cache.push(o); } }); };
    comp.addPass(ao);
    const bloom = new X.UnrealBloomPass(new THREE.Vector2(256, 256), 0.18, 0.5, 0.92);
    comp.addPass(bloom);
    const out = new X.OutputPass();
    comp.addPass(out);
    G.post = { comp, ao, bloom, out };
    G.setQuality = function (q) {
      G.quality = q; try { localStorage.setItem('sc-quality', q); } catch (e) {}
      ao.enabled = q === 'high';
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'high' ? 1.5 : 1));
      G.sun.shadow.mapSize.set(q === 'high' ? 4096 : 2048, q === 'high' ? 4096 : 2048);
      if (G.sun.shadow.map) { G.sun.shadow.map.dispose(); G.sun.shadow.map = null; }
      resize();
    };
    G.renderFrame = function () {
      r.toneMappingExposure = G.exposure ?? 1.0;
      ao.enabled = G.quality === 'high' && G.levelAO !== false; // outdoor levels rely on shadows instead of GTAO
      G.frameNo = (G.frameNo || 0) + 1;
      comp.render();
    };
    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      r.setSize(w, h, false); G.camera.aspect = w / h; G.camera.updateProjectionMatrix();
      const pr = r.getPixelRatio();
      comp.setPixelRatio(pr); comp.setSize(w, h);
      ao.setSize(Math.round(w * pr * 0.5), Math.round(h * pr * 0.5));
      bloom.setSize(Math.round(w * pr * 0.5), Math.round(h * pr * 0.5));
    };
    resize(); window.addEventListener('resize', resize);
    ao.enabled = G.quality === 'high';
    // adaptive quality: drop to the fast path if the first seconds of play run slow
    G.perf = { t: 0, n: 0, checked: false };
  };
  G.trackPerf = function (dt) {
    const p = G.perf; if (!p || p.checked || G.perfLocked || G.quality !== 'high') return;
    p.t += dt; p.n++;
    if (p.t > 4) { p.checked = true; if (p.t / p.n > 0.028) { console.info('switching to fast graphics'); G.setQuality('fast'); } }
  };

  // sky: physically based atmosphere, also baked into the environment map for image-based lighting
  G.setSky = function (o = {}) {
    const X = G.X;
    if (G.sky) { G.sky.parent && G.sky.parent.remove(G.sky); }
    const sky = new X.Sky(); sky.scale.setScalar(1200);
    // keep the visible sky in a sane HDR range so bloom doesn't smear it across the frame
    sky.material.fragmentShader = sky.material.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );', 'vec3 skc = texColor * SKY_GAIN; float skm = max( max( skc.r, skc.g ), skc.b ); if ( skm > 0.95 ) skc *= 0.95 / skm; gl_FragColor = vec4( skc, 1.0 );');
    sky.material.defines = Object.assign({}, sky.material.defines, { SKY_GAIN: (o.skyGain ?? 0.6).toFixed(3) });
    const u = sky.material.uniforms;
    u.cloudCoverage.value = o.clouds ?? 0.35; u.cloudDensity.value = 0.5; u.cloudElevation.value = 0.6;
    u.turbidity.value = o.turbidity ?? 3.2; u.rayleigh.value = o.rayleigh ?? 1.4; u.mieCoefficient.value = o.mie ?? 0.004; u.mieDirectionalG.value = 0.82;
    const sunDir = (o.sun || new THREE.Vector3(-0.45, 0.62, 0.5)).clone().normalize();
    u.sunPosition.value.copy(sunDir);
    G.sunDir = sunDir;
    G.sky = sky; sky.renderOrder = -10;
    // environment map from the sky (plus a soft ground bounce)
    const envScene = new THREE.Scene(); const s2 = new X.Sky(); s2.scale.setScalar(100); Object.assign(s2.material.uniforms.sunPosition.value, sunDir);
    ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG'].forEach((k) => (s2.material.uniforms[k].value = u[k].value));
    s2.material.uniforms.showSunDisc.value = 0; s2.material.uniforms.cloudCoverage.value = 0;
    envScene.add(s2);
    const gnd = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshBasicMaterial({ color: o.ground ?? 0x4d5a36 })); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -2; envScene.add(gnd);
    if (G.envRT) G.envRT.dispose();
    G.envRT = G.pmrem.fromScene(envScene, 0.02);
    G.scene.environment = G.envRT.texture;
    G.scene.environmentIntensity = o.envIntensity ?? 0.55;
    G.sun.color.set(o.sunColor ?? 0xfff0dc); G.sun.intensity = o.sunIntensity ?? 3.0;
    G.exposure = o.exposure ?? 1.0;
    return sky;
  };

  const matCache = {};
  G.mat = function (color, o = {}) {
    const key = color + '|' + JSON.stringify(o);
    if (!o.unique && matCache[key]) return matCache[key];
    let m;
    if (o.basic) m = new THREE.MeshBasicMaterial({ color });
    else m = G.art.material(color, o);
    if (o.emissive !== undefined && m.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
    if (o.opacity !== undefined) { m.transparent = true; m.opacity = o.opacity; }
    if (o.transparent) m.transparent = true;
    if (o.side) m.side = THREE.DoubleSide;
    if (o.depthWrite === false) m.depthWrite = false;
    if (o.map) m.map = o.map;
    if (!o.unique) matCache[key] = m;
    return m;
  };
  G.mesh = function (geo, color, o = {}) {
    const m = new THREE.Mesh(geo, o.material || G.mat(color, o));
    m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false;
    return m;
  };
  // shared geometries
  G.geo = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(1, 20, 14),
    sphereLo: new THREE.SphereGeometry(1, 10, 8),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 18),
    cone: new THREE.ConeGeometry(1, 1, 14),
    ico: new THREE.IcosahedronGeometry(1, 0),
  };
  G.canvasTex = function (w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  };

  // ---------- Physics (AABB world, capsule-ish bodies) ----------
  G.cols = [];
  G.addCol = function (minx, miny, minz, maxx, maxy, maxz, o = {}) {
    const c = Object.assign({ min: new V3(minx, miny, minz), max: new V3(maxx, maxy, maxz), active: true, delta: new V3() }, o);
    G.cols.push(c); return c;
  };
  G.removeCol = (c) => { const i = G.cols.indexOf(c); if (i >= 0) G.cols.splice(i, 1); };
  // Adds a box mesh centered at (cx, cz) with its bottom at y0.
  // bevelled boxes: real edges catch light (a sharp 90-degree box is the biggest tell of a prototype)
  const rbCache = {};
  G.rbox = function (w, h, d, r) {
    r = Math.min(r ?? 0.03, w * 0.3, h * 0.3, d * 0.3);
    const k = [w, h, d, r].map((v) => v.toFixed(3)).join(',');
    if (!rbCache[k]) rbCache[k] = new G.X.RoundedBoxGeometry(w, h, d, 3, r);
    return rbCache[k];
  };
  G.box = function (parent, cx, y0, cz, w, h, d, color, o = {}) {
    const mesh = G.mesh(G.rbox(w, h, d, o.bevel ?? (Math.min(w, h, d) > 3 ? 0.08 : 0.025)), color, o); mesh.position.set(cx, y0 + h / 2, cz);
    if (o.rotY) mesh.rotation.y = o.rotY;
    parent.add(mesh);
    let col = null;
    if (o.col !== false) col = G.addCol(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2, o.colOpts || {});
    if (col) col.mesh = mesh;
    return { mesh, col };
  };
  G.setColBox = function (c, cx, y0, cz, w, h, d) {
    const nx = cx - w / 2, ny = y0, nz = cz - d / 2;
    c.delta.set(nx - c.min.x, ny - c.min.y, nz - c.min.z);
    c.min.set(nx, ny, nz); c.max.set(cx + w / 2, y0 + h, cz + d / 2);
  };
  function blocks(c, b) {
    if (!c.active) return false;
    if (c.imaginary && !G.imaginationOn) return false;
    if (c.bigOnly && b.small) return false;
    if (c.ghost) return false;
    return true;
  }
  function overlap(b, c) {
    return b.pos.x + b.r > c.min.x && b.pos.x - b.r < c.max.x && b.pos.z + b.r > c.min.z && b.pos.z - b.r < c.max.z &&
      b.pos.y + b.h > c.min.y + 0.001 && b.pos.y < c.max.y - 0.001;
  }
  const STEP = 0.42;
  function resolveAxis(b, ax) {
    for (const c of G.cols) {
      if (!blocks(c, b) || !overlap(b, c)) continue;
      const rise = c.max.y - b.pos.y;
      if (rise > 0 && rise <= STEP && (b.onGround || b.coyote > 0) && !c.noStep) {
        // check headroom
        b.pos.y = c.max.y; if (!anyOverlap(b)) { continue; } b.pos.y -= rise;
      }
      if (c.climb && b.canClimb) { b.climbing = c; }
      const bc = b.pos[ax], cc = (c.min[ax] + c.max[ax]) / 2;
      b.pos[ax] = bc < cc ? c.min[ax] - b.r - 0.001 : c.max[ax] + b.r + 0.001;
      b.vel[ax] = 0; b.hitWall = c;
      if (c.onBump) c.onBump(b);
    }
  }
  function anyOverlap(b) { for (const c of G.cols) if (blocks(c, b) && overlap(b, c)) return true; return false; }
  G.groundAt = () => 0;
  G.stepBody = function (b, dt) {
    if (b.onGround && b.groundCol && b.groundCol.delta) { b.pos.x += b.groundCol.delta.x; b.pos.z += b.groundCol.delta.z; b.pos.y += Math.max(0, b.groundCol.delta.y); }
    const sp = Math.hypot(b.vel.x, b.vel.z) * dt;
    const n = Math.max(1, Math.ceil(Math.max(sp, Math.abs(b.vel.y * dt)) / 0.12));
    const sdt = dt / n; b.hitWall = null; b.climbing = null;
    const wasGround = b.onGround;
    for (let i = 0; i < n; i++) {
      b.pos.x += b.vel.x * sdt; resolveAxis(b, 'x');
      b.pos.z += b.vel.z * sdt; resolveAxis(b, 'z');
      const prevY = b.pos.y;
      b.pos.y += b.vel.y * sdt;
      b.onGround = false; b.groundCol = null;
      for (const c of G.cols) {
        if (!blocks(c, b) || !overlap(b, c)) continue;
        if (b.vel.y <= 0.01 && prevY >= c.max.y - 0.06 - Math.max(0, c.delta.y)) {
          b.pos.y = c.max.y; b.vel.y = 0; b.onGround = true; b.groundCol = c;
          if (c.bouncy) { b.vel.y = c.bouncy; b.onGround = false; b.bounced = c; if (c.onBounce) c.onBounce(b); }
        } else if (b.vel.y > 0 && prevY + b.h <= c.min.y + 0.08) { b.pos.y = c.min.y - b.h; b.vel.y = 0; }
        else { // embedded: pop up on top if close, else push out horizontally
          if (c.max.y - b.pos.y < 0.5) { b.pos.y = c.max.y; b.vel.y = Math.max(0, b.vel.y); b.onGround = true; b.groundCol = c; }
        }
      }
      const gy = G.groundAt(b.pos.x, b.pos.z);
      if (gy !== null && b.pos.y <= gy && prevY >= gy - 0.6) { b.pos.y = gy; if (b.vel.y < 0) b.vel.y = 0; b.onGround = true; b.groundCol = null; }
    }
    if (!wasGround && b.onGround) b.justLanded = true;
  };

  // ---------- Triggers & interactables ----------
  G.triggers = []; G.interactables = [];
  G.addTrigger = (t) => { t.inside = false; G.triggers.push(t); return t; };
  G.updateTriggers = function (ch) {
    for (const t of G.triggers) {
      if (t.done) continue;
      const p = ch.pos;
      const inside = t.radius ? (Math.hypot(p.x - t.pos.x, p.z - t.pos.z) < t.radius && Math.abs(p.y - t.pos.y) < (t.hy || 6))
        : p.x > t.min.x && p.x < t.max.x && p.z > t.min.z && p.z < t.max.z && p.y > t.min.y && p.y < t.max.y;
      if (inside && !t.inside) { t.inside = true; if (!t.who || t.who.includes(ch.id)) { t.onEnter && t.onEnter(ch); if (t.once) t.done = true; } }
      else if (!inside && t.inside) { t.inside = false; t.onExit && t.onExit(ch); }
    }
  };
  G.addInteract = (it) => { G.interactables.push(it); return it; };
  G.nearestInteract = function (ch) {
    let best = null, bd = 1e9;
    for (const it of G.interactables) {
      if (it.done || (it.enabled && !it.enabled(ch))) continue;
      const p = typeof it.pos === 'function' ? it.pos() : it.pos;
      const d = Math.hypot(ch.pos.x - p.x, ch.pos.z - p.z);
      if (d < (it.radius || 2.2) && Math.abs(ch.pos.y - p.y) < (it.hy || 2.5) && d < bd) {
        const label = it.label(ch); if (label) { best = { it, label }; bd = d; }
      }
    }
    return best;
  };

  // ---------- Input ----------
  const I = (G.input = { keys: {}, pressed: {}, mdx: 0, mdy: 0, wheel: 0, locked: false, touch: { x: 0, y: 0, btn: {}, pressed: {} }, padPrev: [], lastDevice: 'kb' });
  const KEYMAP = {
    jump: ['Space'], interact: ['KeyE', 'Enter'], ability: ['KeyF'], vision: ['KeyQ'], dash: ['ShiftLeft', 'ShiftRight'],
    switch: ['Tab'], pause: ['Escape', 'KeyP'], costume: ['KeyC'], mute: ['KeyM'],
    c1: ['Digit1'], c2: ['Digit2'], c3: ['Digit3'], c4: ['Digit4'], c5: ['Digit5'], advance: ['Space', 'Enter', 'KeyE'],
  };
  const PADMAP = { jump: [0], interact: [2], ability: [1], vision: [3], dash: [7, 6], switch: [5], prev: [4], pause: [9], advance: [0, 2], costume: [8] };
  window.addEventListener('keydown', (e) => {
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!I.keys[e.code]) I.pressed[e.code] = true; I.keys[e.code] = true; I.lastDevice = 'kb';
  });
  window.addEventListener('keyup', (e) => { I.keys[e.code] = false; });
  window.addEventListener('blur', () => { I.keys = {}; });
  let pad = null;
  function padBtn(i) { return pad && pad.buttons[i] && pad.buttons[i].pressed; }
  G.btn = function (name) {
    if ((KEYMAP[name] || []).some((k) => I.keys[k])) return true;
    if ((PADMAP[name] || []).some(padBtn)) return true;
    if (I.touch.btn[name]) return true;
    return false;
  };
  G.btnDown = function (name) {
    if ((KEYMAP[name] || []).some((k) => I.pressed[k])) return true;
    if ((PADMAP[name] || []).some((i) => padBtn(i) && !I.padPrev[i])) return true;
    if (I.touch.pressed[name]) return true;
    return false;
  };
  G.moveVec = function () {
    let x = 0, y = 0;
    if (I.keys.KeyW || I.keys.ArrowUp) y += 1; if (I.keys.KeyS || I.keys.ArrowDown) y -= 1;
    if (I.keys.KeyA || I.keys.ArrowLeft) x -= 1; if (I.keys.KeyD || I.keys.ArrowRight) x += 1;
    if (pad) { const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0; if (Math.hypot(ax, ay) > 0.18) { x += ax; y -= ay; } }
    x += I.touch.x; y += I.touch.y;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y };
  };
  G.pollInput = function () {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    pad = null; for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (pad) {
      const rx = pad.axes[2] || 0, ry = pad.axes[3] || 0;
      if (Math.abs(rx) > 0.15) I.mdx += rx * 14; if (Math.abs(ry) > 0.15) I.mdy += ry * 10;
      if (pad.buttons.some((b) => b.pressed)) I.lastDevice = 'pad';
    }
  };
  G.endInput = function () {
    I.pressed = {}; I.mdx = 0; I.mdy = 0; I.wheel = 0; I.touch.pressed = {};
    I.padPrev = pad ? pad.buttons.map((b) => b.pressed) : [];
  };
  // mouse look
  const canvas = () => document.getElementById('game');
  let dragging = false;
  window.addEventListener('mousedown', (e) => {
    if (e.target !== canvas()) return;
    dragging = true;
    if (G.allowPointerLock && G.allowPointerLock() && !I.locked && canvas().requestPointerLock) {
      try { const p = canvas().requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) {}
    }
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (I.locked || dragging) { I.mdx += e.movementX || 0; I.mdy += e.movementY || 0; }
  });
  document.addEventListener('pointerlockchange', () => { I.locked = document.pointerLockElement === canvas(); });
  window.addEventListener('wheel', (e) => { I.wheel += Math.sign(e.deltaY); }, { passive: true });

  // touch controls
  G.initTouch = function () {
    const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (!isTouch) return;
    document.getElementById('touch').hidden = false;
    const stick = document.getElementById('stick'), nub = document.getElementById('nub');
    let sid = null, sx = 0, sy = 0;
    stick.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; sid = t.identifier; const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; e.preventDefault(); }, { passive: false });
    const moveStick = (e) => {
      for (const t of e.changedTouches) if (t.identifier === sid) {
        let dx = t.clientX - sx, dy = t.clientY - sy; const l = Math.hypot(dx, dy), m = 50;
        if (l > m) { dx *= m / l; dy *= m / l; }
        nub.style.transform = `translate(${dx}px,${dy}px)`; I.touch.x = dx / m; I.touch.y = -dy / m;
      }
    };
    const endStick = (e) => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; I.touch.x = I.touch.y = 0; nub.style.transform = ''; } };
    stick.addEventListener('touchmove', moveStick, { passive: false }); stick.addEventListener('touchend', endStick); stick.addEventListener('touchcancel', endStick);
    document.querySelectorAll('#touch .tb').forEach((b) => {
      const name = b.dataset.b;
      b.addEventListener('touchstart', (e) => { e.preventDefault(); I.touch.btn[name] = true; I.touch.pressed[name] = true; if (name === 'jump') I.touch.pressed.advance = true; }, { passive: false });
      const up = (e) => { e.preventDefault(); I.touch.btn[name] = false; };
      b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
    });
    // camera drag on free canvas
    let cid = null, cx = 0, cy = 0;
    canvas().addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; cid = t.identifier; cx = t.clientX; cy = t.clientY; I.touch.pressed.advance = true; }, { passive: true });
    canvas().addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === cid) { I.mdx += (t.clientX - cx) * 1.6; I.mdy += (t.clientY - cy) * 1.2; cx = t.clientX; cy = t.clientY; } }, { passive: true });
    canvas().addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (t.identifier === cid) cid = null; });
  };

  // ---------- Camera ----------
  const C = (G.cam = { yaw: 0, pitch: 0.38, dist: 8, target: new V3(), pos: new V3(0, 5, 10), shake: 0, override: null, minPitch: -0.15, maxPitch: 1.25, minDist: 3.0, maxDist: 16, fov: 50, fovKick: 0 });
  G.updateCamera = function (dt, focus) {
    const cam = G.camera;
    if (C.override) {
      const o = C.override;
      C.pos.lerp(o.pos, 1 - Math.exp(-(o.speed || 3) * dt));
      C.target.lerp(o.look, 1 - Math.exp(-(o.speed || 3) * dt));
      if (o.snap) { C.pos.copy(o.pos); C.target.copy(o.look); o.snap = false; }
    } else {
      C.yaw -= I.mdx * 0.0028; C.pitch += I.mdy * 0.0022;
      C.pitch = G.clamp(C.pitch, C.minPitch, C.maxPitch);
      C.dist = G.clamp(C.dist + I.wheel * 0.8, C.minDist, C.maxDist);
      if (focus) {
        const want = new V3(focus.pos.x, focus.pos.y + (focus.small ? 0.9 : 1.35), focus.pos.z);
        C.target.x = G.damp(C.target.x, want.x, 12, dt); C.target.z = G.damp(C.target.z, want.z, 12, dt);
        C.target.y = G.damp(C.target.y, want.y, focus.onGround ? 8 : 3.5, dt);
        if (C.snapNext) { C.target.copy(want); }
      }
      const d = C.dist;
      const want = new V3(C.target.x + Math.sin(C.yaw) * Math.cos(C.pitch) * d, C.target.y + Math.sin(C.pitch) * d, C.target.z + Math.cos(C.yaw) * Math.cos(C.pitch) * d);
      if (C.ceiling !== undefined) want.y = Math.min(want.y, C.ceiling);
      want.y = Math.max(want.y, (G.groundAt(want.x, want.z) ?? -5) + 0.4);
      if (C.snapNext) { C.pos.copy(want); C.snapNext = false; } else C.pos.lerp(want, 1 - Math.exp(-18 * dt));
    }
    cam.position.copy(C.pos);
    if (C.shake > 0) { C.shake = Math.max(0, C.shake - dt * 2.5); const s = C.shake * 0.35; cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; }
    cam.lookAt(C.target);
    const wantFov = C.fov + (C.override ? 0 : C.fovKick || 0); if (Math.abs(cam.fov - wantFov) > 0.05) { cam.fov = G.damp(cam.fov, wantFov, 4, dt); cam.updateProjectionMatrix(); }
  };
  // fade walls between camera and focus
  G.fadeables = [];
  const ray = new THREE.Raycaster();
  G.updateFades = function (dt, focusPos) {
    if (!G.fadeables.length) return;
    const from = G.camera.position; const to = new V3(focusPos.x, focusPos.y + 1, focusPos.z);
    const dir = to.clone().sub(from); const len = dir.length(); dir.normalize();
    ray.set(from, dir); ray.far = len;
    const hits = new Set(ray.intersectObjects(G.fadeables, false).map((h) => h.object));
    for (const m of G.fadeables) {
      const t = hits.has(m) ? 0.15 : 1;
      m.material.opacity = G.damp(m.material.opacity, t, 10, dt);
      m.material.transparent = m.material.opacity < 0.99; m.material.depthWrite = m.material.opacity > 0.5;
    }
  };

  // ---------- Particles ----------
  const parts = []; const pool = [];
  G.burst = function (pos, color, count = 12, o = {}) {
    for (let i = 0; i < count; i++) {
      let m = pool.pop();
      if (!m) { m = new THREE.Mesh(o.geo || G.geo.ico, G.mat(color, { basic: !o.lit })); m.castShadow = false; }
      m.material = G.mat(color, { basic: !o.lit }); m.geometry = o.geo || G.geo.ico;
      const s = (o.size || 0.12) * G.rand(0.6, 1.3); m.scale.setScalar(s);
      m.position.copy(pos).add(new V3(G.rand(-1, 1) * (o.spread || 0.2), G.rand(0, 1) * (o.spreadY || 0.2), G.rand(-1, 1) * (o.spread || 0.2)));
      const sp = o.speed || 4; const a = Math.random() * Math.PI * 2;
      const up = o.up ?? 0.8;
      const v = new V3(Math.cos(a) * sp * G.rand(0.3, 1), sp * G.rand(0.3, 1) * up + (o.upBias || 0), Math.sin(a) * sp * G.rand(0.3, 1));
      if (o.dir) v.add(o.dir.clone().multiplyScalar(G.rand(0.5, 1.2)));
      G.scene.add(m);
      parts.push({ m, v, life: (o.life || 0.8) * G.rand(0.7, 1.2), max: o.life || 0.8, g: o.gravity ?? 9, s, spin: G.rand(-8, 8), drag: o.drag || 0, shrink: o.shrink !== false });
    }
  };
  G.updateParticles = function (dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      if (p.life <= 0) { G.scene.remove(p.m); pool.push(p.m); parts.splice(i, 1); continue; }
      p.v.y -= p.g * dt; if (p.drag) p.v.multiplyScalar(1 - p.drag * dt);
      p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += p.spin * dt; p.m.rotation.y += p.spin * dt;
      if (p.shrink) p.m.scale.setScalar(p.s * Math.min(1, p.life / p.max * 1.5));
    }
  };
  // expanding rings (bark, kiai, pulses)
  const rings = [];
  G.ring = function (pos, color, o = {}) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, o.tube || 0.06, 6, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.copy(pos); if (o.vertical) { m.rotation.y = o.yaw || 0; } else m.rotation.x = Math.PI / 2;
    G.scene.add(m); rings.push({ m, t: 0, dur: o.dur || 0.6, size: o.size || 5 });
  };
  G.updateRings = function (dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.t += dt; const k = r.t / r.dur;
      if (k >= 1) { G.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(i, 1); continue; }
      const e = 1 - Math.pow(1 - k, 3); r.m.scale.setScalar(0.3 + e * r.size); r.m.material.opacity = 0.9 * (1 - k);
    }
  };

  // ---------- UI helpers ----------
  const $ = (id) => document.getElementById(id);
  G.$ = $;
  const bubbles = [];
  G.bubble = function (who, text, dur = 3.2, anchor) {
    const ch = G.chars && G.chars[who];
    const el = document.createElement('div'); el.className = 'bubble';
    const info = G.CHAR_INFO[who] || { name: who, color: '#fff' };
    el.style.setProperty('--c', info.color);
    el.innerHTML = `<b>${info.name}</b>`; el.appendChild(document.createTextNode(text));
    $('bubbles').appendChild(el);
    // one bubble per speaker
    for (const b of bubbles) if (b.who === who) b.t = Math.max(b.t, b.dur - 0.01);
    bubbles.push({ el, who, t: 0, dur, anchor: anchor || (ch && ch.root) });
    G.audio && G.audio.play('voice', { who });
  };
  G.updateBubbles = function (dt) {
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]; b.t += dt;
      if (b.t > b.dur) { b.el.remove(); bubbles.splice(i, 1); continue; }
      const p = new V3(); if (b.anchor) b.anchor.getWorldPosition(p);
      p.y += b.who === 'luigi' ? 1.3 : b.who === 'glitch' ? 1.6 : 2.4;
      p.project(G.camera);
      const behind = p.z > 1;
      const x = G.clamp((p.x * 0.5 + 0.5) * w, 120, w - 120), y = G.clamp((-p.y * 0.5 + 0.5) * h, 80, h - 80);
      b.el.style.left = x + 'px'; b.el.style.top = y + 'px';
      b.el.style.opacity = behind ? 0 : Math.min(1, (b.dur - b.t) * 3, b.t * 8);
    }
  };
  G.clearBubbles = () => { bubbles.forEach((b) => b.el.remove()); bubbles.length = 0; };
  let toastT = 0;
  G.toast = function (big, small = '', dur = 2.6) {
    $('toastBig').textContent = big; $('toastSmall').textContent = small; $('toast').classList.add('show'); toastT = dur;
  };
  G.updateToast = (dt) => { if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show'); } };
  G.flash = function () { const f = $('flash'); f.style.opacity = 1; setTimeout(() => (f.style.opacity = 0), 90); };
  G.fade = (on) => new Promise((res) => { $('fade').style.opacity = on ? 1 : 0; setTimeout(res, 520); });
  G.wait = (s) => new Promise((res) => setTimeout(res, s * 1000));

  // ---------- Sky ----------
  G.makeSky = function (top, bottom, sunDir, o = {}) {
    return G.setSky(Object.assign({ sun: sunDir ? new V3(sunDir.x, Math.max(0.35, sunDir.y), sunDir.z) : undefined }, o));
  };
  // soft volumetric-looking clouds: clusters of lit billboard puffs
  let cloudTex = null;
  function puffTexture() {
    if (cloudTex) return cloudTex;
    const N = 128; const c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
    const img = x.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = i / N - 0.5, v = j / N - 0.5; const r = Math.hypot(u, v) * 2;
      let n = 0, a = 0.5, f = 4; for (let k = 0; k < 4; k++) { n += a * (Math.sin(u * f * 7.1 + k) * Math.sin(v * f * 6.3 + k * 2) * 0.5 + 0.5); a *= 0.5; f *= 2; }
      const al = Math.max(0, 1 - r) ** 1.5 * (0.6 + 0.6 * n);
      const shade = 0.78 + 0.22 * (0.5 - v); // lighter on top
      const p = (j * N + i) * 4; img.data[p] = 255 * shade; img.data[p + 1] = 255 * shade; img.data[p + 2] = 255 * Math.min(1, shade * 1.04); img.data[p + 3] = Math.min(255, al * 255);
    }
    x.putImageData(img, 0, 0); cloudTex = new THREE.CanvasTexture(c); cloudTex.colorSpace = THREE.SRGBColorSpace; return cloudTex;
  }
  G.makeCloud = function (s = 1) {
    const g = new THREE.Group();
    const mat = new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false, fog: true, color: 0xffffff });
    const n = 7 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(mat); const r = G.rand(2.6, 4.4) * s; sp.scale.set(r * 1.6, r, 1);
      sp.position.set(G.rand(-3.5, 3.5) * s, G.rand(-0.4, 0.9) * s, G.rand(-1.5, 1.5) * s); sp.material.rotation = Math.random() * 6; g.add(sp);
    }
    g.userData.noAO = true;
    return g;
  };
})();
