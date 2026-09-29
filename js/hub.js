// The D'Elia house: hub world with rooms, family stations, sealed world portals, and Luigi's daily nonsense.
(function () {
  const G = window.G;
  const V3 = THREE.Vector3;
  const PI = Math.PI;
  const H = 3.2, T = 0.3;

  // ---------- textures ----------
  function checkerTex(a, b, n, size = 256) {
    const t = G.canvasTex(size, size, (c, w, h) => { const s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { c.fillStyle = (i + j) % 2 ? a : b; c.fillRect(i * s, j * s, s, s); } });
    t.magFilter = THREE.NearestFilter; return t;
  }
  function woodTex() {
    return G.canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#9b6a43'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#94633d' : '#a2714a'; c.fillRect(0, i * 32, w, 31); c.fillStyle = 'rgba(60,30,10,.35)'; c.fillRect(0, i * 32 + 31, w, 1); c.fillRect(((i * 97) % 200) + 20, i * 32, 1, 32); }
    });
  }
  function drawingTex(kind) {
    return G.canvasTex(256, 200, (c, w, h) => {
      c.fillStyle = '#fffdf6'; c.fillRect(0, 0, w, h); c.strokeStyle = '#bcd3ef'; c.lineWidth = 1; for (let y = 20; y < h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round';
      if (kind === 'volcano') {
        c.fillStyle = '#e8a95b'; c.beginPath(); c.moveTo(30, 185); c.lineTo(128, 60); c.lineTo(226, 185); c.fill(); c.strokeStyle = '#8a4b1b'; c.stroke();
        c.fillStyle = '#e03a2a'; [[110, 110], [150, 140], [95, 160], [165, 170], [130, 90]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill(); });
        c.fillStyle = '#f4d23c'; c.beginPath(); c.moveTo(128, 60); c.quadraticCurveTo(90, 10, 60, 30); c.quadraticCurveTo(128, 40, 128, 60); c.fill();
        c.fillStyle = '#222'; c.font = 'bold 22px Comic Sans MS, cursive'; c.fillText('PIZZA VOLCANO', 40, 30);
      } else if (kind === 'dragon') {
        c.strokeStyle = '#2a8a3a'; c.fillStyle = '#7ad36b'; c.beginPath(); c.ellipse(120, 120, 60, 38, 0, 0, 7); c.fill(); c.stroke();
        c.beginPath(); c.arc(185, 90, 26, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(192, 84, 7, 0, 7); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(194, 84, 3, 0, 7); c.fill();
        c.strokeStyle = '#ff6a00'; c.beginPath(); c.moveTo(210, 100); c.lineTo(245, 95); c.moveTo(210, 104); c.lineTo(240, 118); c.stroke();
        c.strokeStyle = '#2a8a3a'; c.beginPath(); c.moveTo(60, 120); c.quadraticCurveTo(20, 160, 30, 90); c.stroke();
        c.fillStyle = '#9be38d'; c.beginPath(); c.moveTo(100, 90); c.lineTo(80, 40); c.lineTo(140, 88); c.fill();
      } else if (kind === 'luigi') {
        c.fillStyle = '#d8743a'; c.strokeStyle = '#7a3a12'; for (let i = 0; i < 16; i++) { c.beginPath(); c.arc(80 + (i % 8) * 16, 120 + Math.floor(i / 8) * 20, 14, 0, 7); c.fill(); }
        c.beginPath(); c.arc(190, 95, 34, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#000'; c.beginPath(); c.arc(180, 88, 4, 0, 7); c.arc(200, 88, 4, 0, 7); c.fill(); c.beginPath(); c.arc(190, 104, 6, 0, 7); c.fill();
        c.fillStyle = '#f4d23c'; c.beginPath(); c.moveTo(160, 62); c.lineTo(168, 40); c.lineTo(180, 58); c.lineTo(190, 36); c.lineTo(200, 58); c.lineTo(212, 40); c.lineTo(220, 62); c.fill();
        c.fillStyle = '#222'; c.font = 'bold 20px Comic Sans MS, cursive'; c.fillText('KING LUIGI', 20, 40);
      } else if (kind === 'family') {
        const cols = ['#f0b429', '#19b3a6', '#4a74ff', '#ff5d73']; [40, 90, 140, 180].forEach((x, i) => { c.fillStyle = cols[i]; c.fillRect(x, 110 - (i < 2 ? 20 : 0), 26, 60 + (i < 2 ? 20 : 0)); c.fillStyle = '#e8b890'; c.beginPath(); c.arc(x + 13, 95 - (i < 2 ? 20 : 0), 14, 0, 7); c.fill(); });
        c.fillStyle = '#d8743a'; c.beginPath(); c.ellipse(222, 160, 22, 14, 0, 0, 7); c.fill(); c.fillStyle = '#fbd84a'; c.beginPath(); c.arc(220, 30, 18, 0, 7); c.fill();
      } else if (kind === 'map') {
        c.strokeStyle = '#3b3b3b'; c.lineWidth = 3; c.setLineDash([8, 8]); c.beginPath(); c.moveTo(20, 170); c.bezierCurveTo(80, 40, 160, 190, 235, 40); c.stroke(); c.setLineDash([]);
        c.fillStyle = '#e03a2a'; c.font = 'bold 36px sans-serif'; c.fillText('X', 220, 50); c.fillStyle = '#222'; c.font = 'bold 18px Comic Sans MS, cursive'; c.fillText('ADVENTURE MAP', 60, 30);
        [[60, 120, '#7ad36b'], [130, 150, '#4aa3ff'], [180, 90, '#bbb']].forEach(([x, y, col]) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, 16, 0, 7); c.fill(); });
      }
    });
  }
  function photoTex(kind) {
    return G.canvasTex(200, 150, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      if (kind === 'alps') { g.addColorStop(0, '#8fc4ff'); g.addColorStop(1, '#e6f3ff'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#6b7c94'; c.beginPath(); c.moveTo(0, 130); c.lineTo(70, 40); c.lineTo(110, 90); c.lineTo(150, 30); c.lineTo(200, 120); c.lineTo(200, 150); c.lineTo(0, 150); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(150, 30); c.lineTo(135, 55); c.lineTo(165, 55); c.fill(); c.fillStyle = '#4c9a4c'; c.fillRect(0, 128, w, 22); }
      else if (kind === 'lake') { g.addColorStop(0, '#ffd7a8'); g.addColorStop(1, '#9ec9e8'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#2f5f4a'; for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(i * 18, 90); c.lineTo(i * 18 + 9, 55 - (i % 3) * 8); c.lineTo(i * 18 + 18, 90); c.fill(); } c.fillStyle = '#4f86b8'; c.fillRect(0, 90, w, 60); c.fillStyle = '#b5552b'; c.fillRect(80, 110, 50, 8); }
      else if (kind === 'pizza') { c.fillStyle = '#3a2a22'; c.fillRect(0, 0, w, h); c.fillStyle = '#e9b86a'; c.beginPath(); c.arc(100, 78, 58, 0, 7); c.fill(); c.fillStyle = '#d8402c'; c.beginPath(); c.arc(100, 78, 48, 0, 7); c.fill(); c.fillStyle = '#fff2c8'; [[80, 60], [115, 70], [95, 100], [125, 95], [70, 90]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 10, 0, 7); c.fill(); }); c.fillStyle = '#2f8a3a'; [[100, 80], [85, 75]].forEach(([x, y]) => { c.beginPath(); c.ellipse(x, y, 7, 4, 0.5, 0, 7); c.fill(); }); }
      else if (kind === 'bike') { g.addColorStop(0, '#bfe3a8'); g.addColorStop(1, '#5d8f47'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.strokeStyle = '#222'; c.lineWidth = 5; c.beginPath(); c.arc(60, 105, 25, 0, 7); c.stroke(); c.beginPath(); c.arc(140, 105, 25, 0, 7); c.stroke(); c.beginPath(); c.moveTo(60, 105); c.lineTo(95, 70); c.lineTo(140, 105); c.moveTo(95, 70); c.lineTo(125, 68); c.stroke(); }
      else if (kind === 'beach') { g.addColorStop(0, '#6fc3ff'); g.addColorStop(1, '#bfe8ff'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#2d8bd1'; c.fillRect(0, 80, w, 30); c.fillStyle = '#f1d9a2'; c.fillRect(0, 110, w, 40); c.fillStyle = '#e04b4b'; c.beginPath(); c.moveTo(60, 115); c.lineTo(100, 90); c.lineTo(140, 115); c.fill(); }
      else { g.addColorStop(0, '#f7c35e'); g.addColorStop(1, '#f07b3f'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#d8743a'; c.beginPath(); c.arc(100, 90, 40, 0, 7); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(88, 82, 5, 0, 7); c.arc(112, 82, 5, 0, 7); c.fill(); c.fillStyle = '#e0707a'; c.fillRect(94, 104, 12, 16); }
    });
  }
  function codeTex() {
    return G.canvasTex(256, 160, (c, w, h) => {
      c.fillStyle = '#0f1a2b'; c.fillRect(0, 0, w, h); c.font = 'bold 16px monospace';
      const lines = [['#7dd3fc', 'repeat 4 {'], ['#a7f3d0', '  MOVE 2'], ['#a7f3d0', '  TURN left'], ['#fcd34d', '  if (luigi) JUMP'], ['#7dd3fc', '}'], ['#f9a8d4', '// TODO: beat dad at chess']];
      lines.forEach(([col, s], i) => { c.fillStyle = col; c.fillText(s, 12, 24 + i * 22); });
    });
  }
  function stickerTex() {
    return G.canvasTex(256, 128, (c, w, h) => {
      c.fillStyle = '#6b4a2e'; c.fillRect(0, 0, w, h);
      const s = [['#e04b4b', 'ROMA', 10, 10], ['#2d8bd1', 'ZERMATT', 120, 18], ['#f0b429', 'BARCELONA', 30, 70], ['#3fbf5a', 'LAKE', 170, 80], ['#ff5d73', '?!', 140, 55]];
      s.forEach(([col, t, x, y]) => { c.fillStyle = col; c.fillRect(x, y, t.length * 12 + 16, 30); c.fillStyle = '#fff'; c.font = 'bold 16px sans-serif'; c.fillText(t, x + 8, y + 21); });
    });
  }

  // ---------- builders ----------
  const Pp = () => G.props;
  function wallRun(grp, axis, fixed, a0, a1, gaps, color) {
    let cur = a0;
    const plaster = { kind: 'plaster', unique: true, tile: 2.4 };
    const seg = (a, b, y0, y1) => {
      const len = b - a; if (len <= 0.01) return;
      const mid = (a + b) / 2;
      const r = axis === 'x' ? G.box(grp, mid, y0, fixed, len, y1 - y0, T, color, Object.assign({ bevel: 0.015 }, plaster)) : G.box(grp, fixed, y0, mid, T, y1 - y0, len, color, Object.assign({ bevel: 0.015 }, plaster));
      G.fadeables.push(r.mesh);
      if (y0 === 0) { const bb = axis === 'x' ? G.box(grp, mid, 0, fixed, len, 0.14, T + 0.04, 0xf7f3ea, { col: false, kind: 'paint', bevel: 0.01 }) : G.box(grp, fixed, 0, mid, T + 0.04, 0.14, len, 0xf7f3ea, { col: false, kind: 'paint', bevel: 0.01 }); bb.mesh.castShadow = false; }
    };
    const trim = (x, y, z, w, h, d) => { const m = G.props.rbox(w, h, d, G.mat(0xf7f5f0, { kind: 'paint', rough: 0.4 }), 0.01); m.position.set(x, y, z); grp.add(m); };
    (gaps || []).slice().sort((p, q) => p[0] - q[0]).forEach(([a, b, type]) => {
      seg(cur, a, 0, H);
      const m = (a + b) / 2, w = b - a;
      if (type === 'window') {
        seg(a, b, 0, 1.0); seg(a, b, 2.4, H);
        const glassM = new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.08, roughness: 0.02, metalness: 0, specularIntensity: 1, envMapIntensity: 1.5, depthWrite: false });
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.4), glassM); gl.userData.noAO = true;
        if (axis === 'x') { gl.position.set(m, 1.7, fixed); trim(m, 1.0, fixed, w + 0.1, 0.06, T + 0.14); trim(m, 2.4, fixed, w + 0.1, 0.06, T + 0.06); trim(a + 0.03, 1.7, fixed, 0.06, 1.4, T + 0.06); trim(b - 0.03, 1.7, fixed, 0.06, 1.4, T + 0.06); trim(m, 1.7, fixed, 0.05, 1.4, 0.05); trim(m, 1.7, fixed, w, 0.04, 0.05); }
        else { gl.rotation.y = PI / 2; gl.position.set(fixed, 1.7, m); trim(fixed, 1.0, m, T + 0.14, 0.06, w + 0.1); trim(fixed, 2.4, m, T + 0.06, 0.06, w + 0.1); trim(fixed, 1.7, a + 0.03, T + 0.06, 1.4, 0.06); trim(fixed, 1.7, b - 0.03, T + 0.06, 1.4, 0.06); trim(fixed, 1.7, m, 0.05, 1.4, 0.05); trim(fixed, 1.7, m, 0.05, 0.04, w); }
        grp.add(gl);
      } else {
        seg(a, b, 2.6, H);
        // door casing
        if (axis === 'x') { trim(a - 0.05, 1.3, fixed, 0.1, 2.6, T + 0.08); trim(b + 0.05, 1.3, fixed, 0.1, 2.6, T + 0.08); trim(m, 2.63, fixed, w + 0.2, 0.1, T + 0.08); }
        else { trim(fixed, 1.3, a - 0.05, T + 0.08, 2.6, 0.1); trim(fixed, 1.3, b + 0.05, T + 0.08, 2.6, 0.1); trim(fixed, 2.63, m, T + 0.08, 0.1, w + 0.2); }
      }
      cur = b;
    });
    seg(cur, a1, 0, H);
  }
  function floor(grp, x0, z0, x1, z1, color, kind = 'wood', tile) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.02, z1 - z0), G.mat(color, { kind, tile, swap: false }));
    m.position.set((x0 + x1) / 2, 0.0, (z0 + z1) / 2); m.receiveShadow = true; grp.add(m); return m;
  }
  function picture(grp, tex, x, y, z, w, h, rotY, frame = 0x5a3b24) {
    const g = G.props.frame(tex, w, h, { frame, mat: frame !== 0xffffff }); g.position.set(x, y, z); g.rotation.y = rotY; grp.add(g); return g;
  }
  function chessPiece(color, kind) { return G.props.chessPiece(color > 0x888888, kind); }
  function bike(grp, x, z, rot, color) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    const tire = G.mat(0x1c1c1c, { kind: 'rubber' }); const frame = G.mat(color, { kind: 'paint', rough: 0.25 });
    [-0.55, 0.55].forEach((dz) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 24), tire); w.position.set(0, 0.42, dz); w.rotation.y = PI / 2; w.castShadow = true; g.add(w); });
    const tube = (x1, y1, z1, x2, y2, z2) => { const a = new V3(x1, y1, z1), b = new V3(x2, y2, z2); const l = a.distanceTo(b); const m = new THREE.Mesh(G.geo.cyl, frame); m.scale.set(0.035, l, 0.035); m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b); m.rotateX(PI / 2); m.castShadow = true; g.add(m); };
    tube(0, 0.42, -0.55, 0, 0.8, -0.1); tube(0, 0.8, -0.1, 0, 0.42, 0.05); tube(0, 0.42, 0.05, 0, 0.42, -0.55); tube(0, 0.8, -0.1, 0, 0.88, 0.4); tube(0, 0.88, 0.4, 0, 0.42, 0.55); tube(0, 0.42, 0.05, 0, 0.88, 0.4);
    const bar = new THREE.Mesh(G.geo.cyl, tire); bar.scale.set(0.025, 0.6, 0.025); bar.rotation.z = PI / 2; bar.position.set(0, 1.0, 0.42); g.add(bar);
    const seat = new THREE.Mesh(G.geo.sphere, tire); seat.scale.set(0.07, 0.04, 0.16); seat.position.set(0, 0.92, -0.14); g.add(seat);
    grp.add(g); return g;
  }
  function portalSeal(grp, pos, color = 0xff3fa4, r = 0.7) {
    const g = new THREE.Group(); g.position.copy(pos);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.7, 0.03, 6, 24), new THREE.MeshBasicMaterial({ color: 0x36e0ff, transparent: true, opacity: 0.7 }));
    const lock = new THREE.Mesh(G.geo.box, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); lock.scale.set(0.16, 0.16, 0.16); lock.rotation.z = PI / 4;
    g.add(ring, ring2, lock); grp.add(g);
    return { g, ring, ring2, lock };
  }

  const LINES = {
    chess: { frank: "I'm going to move one piece and see what happens.", elba: "Luca set this up. I am not touching it.", luca: "Mate in three. Nobody breathe on it.", ludo: "The horse is my favorite. It jumps over people.", luigi: "*sniffs the white king suspiciously*" },
    guitar: { frank: "Three chords and the truth. Mostly the three chords.", elba: "Frank, it's 8 AM.", luca: "Technically it's out of tune. By a lot.", ludo: "I can play the Luigi song! It's one note.", luigi: "*tail thumps the amp. Feedback.*" },
    oven: { frank: "Eight hundred degrees. Ninety seconds. Perfection.", elba: "Last time you said ninety seconds, the smoke alarm joined in.", luca: "The dough hydration is 70 percent. Dad told me. Twice.", ludo: "What if pizza, but pancakes?", luigi: "*stares at the oven with his whole soul*" },
    belts: { frank: "I only understand the black one.", elba: "Every one of those took real work. I was at every test.", luca: "White, yellow, orange, green, blue, purple, brown. Black is next.", ludo: "I'd be the rainbow belt.", luigi: "*tries to steal the yellow belt*" },
    sketch: { frank: "Is that a volcano made of pizza?", elba: "Ludo, this is honestly amazing. Is that me riding a dragon?", luca: "The dragon's proportions are off. It's still cool.", ludo: "That's the whole world I'm building. It's not finished. It's never finished.", luigi: "*licks the page*" },
    globe: { frank: "Zermatt. Best hot chocolate of my life.", elba: "We need to go back to the mountains.", luca: "The train went through the mountain. Through it.", ludo: "Shake it! It snows!", luigi: "*nose print on the glass*" },
    paddle: { frank: "The canoe incident. We don't talk about the canoe incident.", elba: "Frank tipped us. Twice.", luca: "It was three times.", ludo: "I caught a fish. It was a stick. But a good stick.", luigi: "*remembers the lake. Wags extremely hard.*" },
    bikes: { frank: "Cunningham trails this weekend. If the Glitch lets us.", elba: "Helmets. Both of you. I'm not asking.", luca: "I took the blue line last time. Didn't even brake.", ludo: "Can I have training wheels that are rockets?", luigi: "*sniffs the tires. Approves of the mud.*" },
    attic: { frank: "The attic hatch is... humming. That's new.", elba: "Nobody goes up there until we have all the pieces.", luca: "Whatever's up there is the source. I can feel it.", ludo: "I think the Glitch lives up there.", luigi: "*growls at the ceiling. Very small growl.*" },
    photos: { frank: "Every one of these trips started with 'how hard could it be?'", elba: "I planned every one of these. You're welcome.", luca: "I look twelve in all of these. Because I was twelve.", ludo: "I'm the one making the face in all of them.", luigi: "*sits in front of the one photo he's in*" },
    fridge: { frank: "Ludo, is that me with a pizza for a head?", elba: "The fridge gallery is full. We need a second fridge.", luca: "The dragon one is actually really good.", ludo: "That's a map of everywhere we're going. It's accurate. Mostly.", luigi: "*opens the fridge with his nose. Almost.*" },
    computer: { frank: "Luca, why does your code have a comment about beating me at chess?", elba: "Screen time is almost up, whoever is on this.", luca: "MOVE. TURN. REPEAT. It's basically karate for robots.", ludo: "Can I make it say a bad word?", luigi: "*steps on the keyboard: ;;;;;;;;;;;;*" },
    manchego: { frank: "Who left the manchego out?", elba: "Nobody touches the manchego. It's for Spanish night.", luca: "It was Dad.", ludo: "It was Luigi. Probably. Maybe me.", luigi: "*pretends he has never seen cheese in his life*" },
    box: { frank: "The old travel box. That's where it all started.", elba: "I packed that box on our very first trip.", luca: "Stickers from everywhere. Plus one I don't recognize.", ludo: "There's a sticker that just says '?!'", luigi: "*sits in the box. It is his box now.*" },
    dogbed: { frank: "He has a bed. He sleeps on the couch.", elba: "That's his bed. That's also my sweater in his bed.", luca: "It smells like a wet tennis ball.", ludo: "It's so squishy. I get why he loves it.", luigi: "*circles three times. Lies down. Gets back up. Circles again.*" },
  };
  const WORLD_PORTALS = {
    bikes: 'World 2 · Cunningham Trail Chaos', chess: 'World 3 · Checkmate Kingdom', belts: 'World 4 · The Sky Dojo', sketch: "World 5 · Ludo's Sketchbook",
    guitar: 'World 6 · School of Rock City', oven: 'World 7 · The Great Family Kitchen', globe: 'World 8 · Alpine Adventure', paddle: 'World 9 · Lake Adventure', attic: 'Final World · The Glitched Family Universe',
  };
  G.WORLD_PORTALS = WORLD_PORTALS;

  const hub = {
    id: 'hub', name: "The D'Elia House", song: 'hub', followers: false,
    spawn: { pos: new V3(-4, 0, 10), facing: PI },
    stations: {
      frank: { pos: new V3(11.5, 0, 6.8), facing: 0, action: null },
      elba: { pos: new V3(-7.5, 0, 3.6), facing: 0.6, action: null },
      luca: { pos: new V3(-10, 0, 7.4), facing: PI * 0.02, action: 'think' },
      ludo: { pos: new V3(-3.6, 0, -12.6), facing: PI, action: 'draw' },
      luigi: { pos: new V3(-3, 0, 13), facing: PI, action: null },
    },
    build() {
      const grp = G.levelGroup;
      const PR = G.props;
      G.scene.fog = new THREE.Fog(0xcfdde8, 70, 260);
      grp.add(G.setSky({ sun: new V3(-0.55, 0.62, 0.56), envIntensity: 0.32, sunIntensity: 2.4, exposure: 0.9, sunColor: 0xffe7c4, ground: 0x6a6048, clouds: 0.3 }));
      G.hemi.color.set(0xfff1dc); G.hemi.groundColor.set(0x6b5238); G.hemi.intensity = 0.55;
      // garden: lawn, dense grass, trees, hedges
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), G.mat(0x6fb04e, { kind: 'lawn', tile: 2.4 })); ground.rotation.x = -PI / 2; ground.position.y = -0.005; ground.receiveShadow = true; grp.add(ground);
      const inHouse = (x, z, m = 0.8) => x > -20 - m && x < 32 + m && z > -16 - m && z < 26 + m;
      grp.add(PR.grassField({ x0: -48, x1: 60, z0: -44, z1: 58 }, { count: 90000, height: 0.3, keep: (x, z) => !inHouse(x, z) && !(z > 26 && z < 36 && x > -6 && x < -1.5) }));
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * PI * 2 + Math.random() * 0.1, r = G.rand(46, 78); const t = PR.tree({ seed: (i % 7) + 1, height: G.rand(8, 13) });
        t.position.set(6 + Math.cos(a) * r, 0, 5 + Math.sin(a) * r); t.rotation.y = Math.random() * 6; grp.add(t);
      }
      for (let x = -19; x <= 31; x += 1.6) { [-17.4, 27.4].forEach((z) => { if (z > 0 && x > -6.5 && x < -1) return; const sh = PR.shrub(G.rand(0.6, 0.85)); sh.position.set(x + G.rand(-0.2, 0.2), 0, z); sh.scale.y = G.rand(0.8, 1.1); grp.add(sh); }); }
      // floors: oak planks, porcelain tile, carpet, concrete, stone pavers
      floor(grp, -20, 0, 0, 16, 0xa06a40, 'wood', 1.0);
      floor(grp, 0, 0, 20, 16, 0xc98a62, 'tile', 0.9);
      floor(grp, -20, -4, 20, 0, 0x9c6842, 'wood', 1.0);
      floor(grp, -20, -16, -7, -4, 0x7f98bb, 'fabric', 0.2);
      floor(grp, -7, -16, 7, -4, 0xd9b77c, 'wood', 1.2);
      floor(grp, 7, -16, 20, -4, 0xa89b87, 'wood', 1.8);
      floor(grp, 20, 0, 32, 16, 0x9c9c98, 'concrete', 3);
      floor(grp, -20, 16, 0, 26, 0xc9bfae, 'stone', 1.2); // patio
      grp.add(PR.at(PR.rug(6.4, 4.6, ['#3e5578', '#d8cbb0', '#9b4b3b']), -10, 0.012, 9.8));
      // walls
      const W = 0xe3d5bf, WX = 0xd6c6ab;
      wallRun(grp, 'x', 16, -20, 20, [[-16, -12, 'window'], [-5.5, -2, 'door'], [6, 11, 'window']], WX);
      wallRun(grp, 'x', -16, -20, 32, [], WX);
      wallRun(grp, 'z', -20, -16, 16, [[5, 10, 'window']], WX);
      wallRun(grp, 'z', 20, -16, 16, [[3, 6, 'door']], W);
      wallRun(grp, 'z', 0, 0, 16, [[5.5, 11.5, 'door']], W);
      wallRun(grp, 'x', 0, -20, 20, [[-13, -8, 'door'], [7.5, 12.5, 'door']], W);
      wallRun(grp, 'x', -4, -20, 20, [[-14.5, -12, 'door'], [-1.2, 1.2, 'door'], [11.8, 14.2, 'door']], W);
      wallRun(grp, 'z', -7, -16, -4, [], W);
      wallRun(grp, 'z', 7, -16, -4, [], W);
      wallRun(grp, 'x', 16, 20, 32, [], WX);
      wallRun(grp, 'x', 0, 20, 32, [], WX);
      wallRun(grp, 'z', 32, 0, 16, [[5, 11, 'door']], WX);
      // garage-door panel (sealed)
      const gd = G.box(grp, 32, 0, 8, 0.2, 2.6, 6, 0xcfd6dc, { unique: true, kind: 'metal', metal: 0.3, rough: 0.45 }); G.fadeables.push(gd.mesh);
      // back wall between storage and garage (z -16..0 at x=20 already), close garage north
      this.buildLiving(grp); this.buildKitchen(grp); this.buildBackRooms(grp); this.buildGarage(grp); this.dressRooms(grp);
      this.seals = [];
      const seal = (key, pos, r) => { const s = portalSeal(grp, pos, 0xff3fa4, r); s.key = key; this.seals.push(s); };
      seal('chess', new V3(-10, 1.3, 9.5), 0.5); seal('guitar', new V3(-18.4, 1.6, 2.2), 0.6); seal('oven', new V3(18.2, 1.6, 12), 0.6);
      seal('belts', new V3(-19.6, 1.8, -10), 0.8); seal('sketch', new V3(-3.6, 1.4, -14.4), 0.45); seal('globe', new V3(18.6, 1.9, -14.4), 0.35);
      seal('paddle', new V3(9, 1.6, -15.4), 0.6); seal('bikes', new V3(31.7, 1.4, 8), 1.2); seal('attic', new V3(0, 3.0, -2), 0.8);
      this.seals.forEach((s) => { if (s.key === 'belts' || s.key === 'bikes') s.g.rotation.y = PI / 2; if (s.key === 'attic') s.g.rotation.x = PI / 2; });
      // World 1 portal (back door)
      const pg = new THREE.Group(); pg.position.set(-3.75, 1.3, 16); grp.add(pg);
      const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.25, 40), new THREE.MeshBasicMaterial({ color: 0x9dff5c, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
      swirl.scale.y = 1.05; pg.add(swirl);
      const pr1 = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.07, 8, 40), new THREE.MeshBasicMaterial({ color: 0x9dff5c })); pg.add(pr1);
      const pr2 = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 8, 30), new THREE.MeshBasicMaterial({ color: 0xffffff })); pg.add(pr2);
      const pl = new THREE.PointLight(0x9dff5c, 1.4, 9); pl.position.set(0, 0.5, -1); pg.add(pl);
      this.portal = { g: pg, swirl, pr1, pr2 };
      G.addCol(-5.5, 0, 16.1, -2, 2.6, 16.4, { ghost: false, isPortal: true });
      G.addTrigger({ min: new V3(-5.5, -1, 15.2), max: new V3(-2, 3, 16.6), onEnter: (ch) => G.game.enterWorld1(ch) });
      G.addInteract({ pos: new V3(-3.75, 0, 15.2), radius: 2.4, label: () => 'Enter: The Great Backyard Escape', onUse: (ch) => G.game.enterWorld1(ch) });
      // compass pedestal
      const ped = new THREE.Group(); ped.position.set(-4.8, 0, 5.2); grp.add(ped);
      const col = G.mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.0, 12), 0x8a6a4a); col.position.y = 0.5; ped.add(col);
      const topd = G.mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 20), 0x6b4a2e); topd.position.y = 1.05; ped.add(topd);
      G.addCol(-5.3, 0, 4.7, -4.3, 1.1, 5.7);
      const holo = new THREE.Group(); holo.position.y = 1.9; ped.add(holo);
      const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: 0xe2ac3f })); holo.add(ringB);
      this.fragSlots = [];
      for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; const f = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshBasicMaterial({ color: 0x555566 })); f.position.set(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0); holo.add(f); this.fragSlots.push(f); }
      const needle = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.8, 4), new THREE.MeshBasicMaterial({ color: 0xff3fa4 })); holo.add(needle); this.needle = needle;
      this.holo = holo;
      G.addInteract({ pos: new V3(-4.8, 0, 5.2), radius: 2.2, label: () => 'Check the Adventure Compass', onUse: (ch) => {
        const n = G.save.frags; G.toast(`${n} of 9 fragments`, n ? 'The needle spins toward the garage. Something is waking up out there.' : 'The needle points at the back door. Obviously.');
        G.bubble(ch.id, { frank: 'One down. Eight to go. Easy.', elba: "We do this one piece at a time. Together.", luca: 'Nine fragments. 11.1 percent each.', ludo: "It's kind of pretty broken. Like a disco ball.", luigi: '*boops the compass with his nose*' }[ch.id]);
      } });
      // talkable/inspectable spots
      const spot = (key, x, z, radius = 2.2, y = 0) => G.addInteract({ pos: new V3(x, y, z), radius, label: () => WORLD_PORTALS[key] ? 'Inspect the glowing seal' : 'Look', onUse: (ch) => {
        G.bubble(ch.id, LINES[key][ch.id], 4);
        if (WORLD_PORTALS[key]) setTimeout(() => G.toast('Sealed by the Glitch', WORLD_PORTALS[key] + ' · opens in a future chapter'), 400);
        if (key === 'manchego') G.game.achieve('manchego', 'WHO LEFT THE MANCHEGO OUT?', 'Secret achievement');
      } });
      spot('chess', -10, 9.5, 2.6); spot('guitar', -18, 2.2); spot('oven', 18, 12); spot('belts', -18.8, -10); spot('sketch', -3.6, -14); spot('globe', 18.2, -14.2); spot('paddle', 9, -14.8);
      spot('bikes', 29.5, 8, 3); spot('attic', 0, -2); spot('photos', -19, 9.5); spot('fridge', 1.4, 1.8); spot('computer', -10, -14.5); spot('manchego', 8.9, 9.3, 1.6); spot('box', 13, -11.5, 2.4); spot('dogbed', -2.5, 12.8, 1.8);
      // family NPC talk
      G.addInteract({ pos: () => this.npcPos(), radius: 2.0, enabled: (ch) => !!this.nearNpc(ch), label: (ch) => { const n = this.nearNpc(ch); return n ? 'Talk to ' + G.CHAR_INFO[n.id].name : null; }, onUse: (ch) => this.talk(ch) });
      // Luigi's hub props
      this.sock = new THREE.Group(); { const sm = G.mat(0xd9443b, { kind: 'fabric', tile: 0.03 }); const leg = PR.cushion(0.1, 0.06, 0.3, sm, 0.3); leg.position.z = 0.02; this.sock.add(leg); const foot = PR.cushion(0.1, 0.06, 0.16, sm, 0.3); foot.position.set(0, 0, -0.18); foot.rotation.y = 0.6; this.sock.add(foot); const cuff = PR.cushion(0.105, 0.065, 0.06, G.mat(0xf2f2f0, { kind: 'fabric', tile: 0.03 }), 0.3); cuff.position.z = 0.16; this.sock.add(cuff); }
      this.sock.position.set(-16, 0.04, -2.2); grp.add(this.sock);
      const basket = PR.mesh(PR.lathe([[0.4, 0], [0.5, 0.6], [0.52, 0.62], [0.49, 0.62], [0.38, 0.03]], 40), G.mat(0xb8925a, { kind: 'fabric', tile: 0.04, side: true })); basket.position.set(-17, 0, -2.6); grp.add(basket);
      G.addCol(-17.5, 0, -3.1, -16.5, 0.7, -2.1);
      // warm practical lights
      [[-15.5, 12.8], [-4.4, 15], [17.5, 2.5], [-18.5, -5], [5.5, -14.8]].forEach(([x, z]) => { const l = PR.floorLamp({ light: true }); l.position.set(x, 0, z); grp.add(l); });
      this.luigiAI = { state: 'idle', t: 0, target: null };
    },
    // soft furnishings and wall dressing so every room reads as lived-in
    dressRooms(root) {
      const PR = G.props, at = PR.at; const grp = (this.dress = new THREE.Group()); root.add(grp);
      const curtains = (x, z, ry, w, color) => { [-1, 1].forEach((s) => { const c = PR.curtain(0.9, 2.5, color); const off = new V3(s * (w / 2 + 0.35), 0, 0).applyAxisAngle(new V3(0, 1, 0), ry); at(c, x + off.x, 0.05, z + off.z, ry); grp.add(c); }); };
      curtains(-14, 15.8, PI, 4, 0xc9b38f); curtains(-19.8, 7.5, PI / 2, 5, 0xc9b38f); curtains(8.5, 15.8, PI, 5, 0x8fa39a);
      const art = (seed, x, y, z, ry, w = 1.2, h = 0.85) => { const p = PR.painting(seed, w, h); at(p, x, y, z, ry); grp.add(p); };
      art(1, -17, 1.75, 0.2, 0, 1.6, 1.0); art(2, -4, 1.7, 0.2, 0); art(3, 15.5, 1.75, 0.2, 0, 1.8, 1.1);
      art(4, -17.5, 1.7, -3.8, 0, 1.0, 0.7); art(5, 5, 1.7, -3.8, 0, 1.4, 0.8); art(6, 17, 1.7, -3.8, 0, 1.0, 0.7);
      art(7, -9, 1.7, -0.2, PI, 1.2, 0.8); art(8, 4, 1.7, -0.2, PI, 1.0, 0.7);
      art(9, -14, 1.85, -15.8, 0, 0.9, 1.2); art(10, 6.8, 1.6, -8, -PI / 2, 1.1, 0.8);
      const shelf = (x, y, z, ry, w) => { const s = PR.wallShelf(w); at(s, x, y, z, ry); grp.add(s); };
      shelf(-0.18, 1.5, 11.5, -PI / 2, 2.2); shelf(1, 1.55, -15.84, 0, 2.0); shelf(-11, 1.7, -15.84, 0, 1.6); shelf(19.82, 1.5, -9, -PI / 2, 2.4); shelf(-7.18, 1.5, -8, -PI / 2, 1.8);
      grp.add(at(PR.rug(3.4, 2.2, ['#b9a07a', '#f1e6cf', '#7a4b35']), 5, 0.012, 12.5));
      grp.add(at(PR.rug(22, 1.3, ['#6b3a2e', '#d9c3a0', '#2f4a5e']), -4, 0.012, -2));
      grp.add(at(PR.rug(3.2, 3.2, ['#f0c05a', '#fff4dc', '#e2603a'], true), 0, 0.012, -9.5));
      grp.add(at(PR.rug(3.6, 2.4, ['#5a6b4e', '#cdbd97', '#8a3d2e']), 14.5, 0.012, -8.5));
      [[-1.2, 15.1, 1.1], [1.2, 15.2, 1.0], [19.1, 1.0, 0.9], [-8.1, -4.9, 0.9], [6.1, -4.9, 1.0], [-19, -4.9, 0.8], [8, -15, 0.9], [-19.1, 5.2, 1.0]].forEach(([x, z, s], i) => {
        const p = PR.plant({ fern: i % 3 === 1, leafLen: 0.7 * s, r: 0.2 * s + 0.05, h: 0.32 * s + 0.08, cards: 11 }); p.position.set(x, 0, z); p.scale.setScalar(1.25); p.rotation.y = i; grp.add(p);
        G.addCol(x - 0.3 * s, 0, z - 0.3 * s, x + 0.3 * s, 1.0, z + 0.3 * s);
      });
    },
    buildLiving(grp) {
      const PR = G.props, at = PR.at;
      // sectional sofa facing the chess table, armchairs, shelves, plants
      const sofa = PR.sofa(3.4, 0x8a5a3c, 'fabric'); at(sofa, -10, 0, 13.6, PI); grp.add(sofa); G.addCol(-11.8, 0, 13.0, -8.2, 0.9, 14.3);
      const sofa2 = PR.sofa(2.4, 0x8a5a3c, 'fabric'); at(sofa2, -14.2, 0, 10.4, PI / 2); grp.add(sofa2); G.addCol(-14.8, 0, 9.1, -13.7, 0.9, 11.7);
      [[-6.4, 12.4, -2.4]].forEach(([x, z, r]) => { const ch = PR.sofa(1.1, 0x3e5a52, 'fabric'); at(ch, x, 0, z, r); grp.add(ch); G.addCol(x - 0.55, 0, z - 0.55, x + 0.55, 0.9, z + 0.55); });
      // coffee table + chess board
      const ct = PR.table(1.6, 1.0, 0.45, { color: 0x6a4428, legR: 0.03 }); at(ct, -10, 0, 9.5); grp.add(ct); G.addCol(-10.8, 0, 9.0, -9.2, 0.45, 10.0);
      const board = PR.mesh(G.rbox(0.62, 0.03, 0.62, 0.006), G.mat(0xffffff, { kind: 'paint', map: checkerTex('#efe3c8', '#5a3a24', 8), rough: 0.3 }));
      board.position.set(-10, 0.465, 9.5); grp.add(board);
      [['k', 0xf7f1e3, -10.13, 9.37], ['n', 0xf7f1e3, -9.87, 9.63], ['p', 0xf7f1e3, -10.21, 9.67], ['k', 0x2a2522, -9.83, 9.29], ['p', 0x2a2522, -9.71, 9.45], ['n', 0x2a2522, -10.25, 9.3]].forEach(([k, c, x, z]) => { const p = chessPiece(c, k); p.scale.setScalar(0.28); p.position.set(x, 0.48, z); grp.add(p); });
      // guitar on a stand + amp
      const gt = PR.guitar(); gt.position.set(-19.2, 0, 2.2); gt.rotation.set(-0.18, PI / 2, 0); grp.add(gt);
      const amp = PR.amp(); at(amp, -18.2, 0, 3.6, PI / 2 - 0.3); grp.add(amp);
      G.addCol(-19.8, 0, 1.6, -18.2, 2, 2.8); G.addCol(-18.6, 0, 3.2, -17.8, 0.8, 4.0);
      // photo wall + shelves
      ['alps', 'lake', 'pizza', 'bike', 'beach', 'luigi'].forEach((k, i) => picture(grp, photoTex(k), -19.8, 1.5 + (i % 2) * 0.72, 7.4 + Math.floor(i / 2) * 1.05, 0.72, 0.5, PI / 2));
      const bs = PR.bookshelf(2.2, 2.2); at(bs, -19.62, 0, 12.2, PI / 2); grp.add(bs); G.addCol(-19.85, 0, 11.1, -19.4, 2.2, 13.3);
      // TV console on the kitchen divider
      const con = PR.cabinets(2.4, 0.45, 0.55, 0x3e3029, 0x3e3029); at(con, -0.45, 0, 3, -PI / 2); grp.add(con); G.addCol(-0.7, 0, 1.8, -0.2, 0.6, 4.2);
      const tv = PR.tv(1.9); at(tv, -0.35, 1.35, 3, -PI / 2); grp.add(tv);
      // Luigi's dog bed
      const bed = PR.dogBed(0x6f86b0); at(bed, -2.5, 0, 12.8); grp.add(bed);
      // plants
      [[-18.8, 15, 1.2], [-6.2, 15.2, 0.9], [-19.2, 0.8, 1.0]].forEach(([x, z, s], i) => { const p = PR.plant({ fern: i === 1, leafLen: 0.7 * s, r: 0.2 * s + 0.05, h: 0.32 * s + 0.08, cards: 11 }); p.position.set(x, 0, z); p.scale.setScalar(1.3); grp.add(p); });
      G.addCol(-19.3, 0, 14.5, -18.3, 1.8, 15.5);
    },
    buildKitchen(grp) {
      const PR = G.props, at = PR.at;
      // island with stools
      const isl = PR.cabinets(3.2, 1.1, 0.92, 0x3f4b63, 0xf2efe9); at(isl, 10, 0, 9); grp.add(isl); G.addCol(8.4, 0, 8.4, 11.6, 0.95, 9.6);
      [[8.9, 10.2], [10, 10.2], [11.1, 10.2]].forEach(([x, z]) => { const st = new THREE.Group(); st.add(at(PR.cyl(0.19, 0.19, 0.05, G.mat(0x3a2a1c, { kind: 'grain' })), 0, 0.72, 0)); st.add(at(PR.cyl(0.02, 0.02, 0.7, G.mat(0x2a2a2e, { kind: 'metal' }), 10), 0, 0.36, 0)); st.add(at(PR.cyl(0.16, 0.18, 0.02, G.mat(0x2a2a2e, { kind: 'metal' })), 0, 0.01, 0)); at(st, x, 0, z); grp.add(st); });
      // dough, rolling pin, peel, the famous manchego
      const dough = G.mat(0xf1e2c2, { kind: 'plaster', tile: 0.2, rough: 0.8 });
      [[9.2, 9.1], [9.7, 8.8]].forEach(([x, z]) => { const d = PR.mesh(new THREE.SphereGeometry(0.13, 24, 12), dough); d.scale.y = 0.45; d.position.set(x, 0.99, z); grp.add(d); });
      const pin = PR.cyl(0.03, 0.03, 0.42, G.mat(0xc89a64, { kind: 'grain', tile: 0.3 }), 20); pin.rotation.z = PI / 2; pin.position.set(10.5, 0.98, 8.8); grp.add(pin);
      const peel = PR.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 32), G.mat(0xc89a64, { kind: 'grain', tile: 0.3 })); peel.position.set(11.1, 0.97, 9.2); grp.add(peel);
      const cheese = PR.mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 32, 1, false, 0, PI * 1.6), G.mat(0xf2d27a, { kind: 'plaster', tile: 0.15, rough: 0.6 })); cheese.position.set(8.9, 1.0, 9.3); grp.add(cheese);
      const rind = PR.mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.102, 32, 1, true, 0, PI * 1.6), G.mat(0x8a5a2a, { kind: 'fabric', tile: 0.02, side: true })); rind.position.copy(cheese.position); grp.add(rind);
      // wall run of counters + pizza oven
      const run = PR.cabinets(8.6, 0.65, 0.92, 0x3f4b63, 0xf2efe9); at(run, 19.5, 0, 6.6, -PI / 2); grp.add(run); G.addCol(19.1, 0, 2.3, 19.9, 0.95, 10.9);
      const hob = PR.rbox(0.8, 0.01, 0.55, G.mat(0x0c0c0e, { kind: 'plastic', rough: 0.1 }), 0.004); hob.position.set(19.5, 0.955, 5); grp.add(hob);
      const oven = PR.pizzaOven(); oven.position.set(18.6, 0, 12.8); oven.rotation.y = -PI / 2; oven.scale.setScalar(1.1); grp.add(oven); this.ovenFire = oven.userData;
      G.addCol(17.7, 0, 11.9, 19.5, 2.2, 13.7);
      // fridge with Ludo's drawings
      const fr = PR.fridge(); at(fr, 1.4, 0, 0.95); grp.add(fr); G.addCol(0.95, 0, 0.55, 1.85, 1.9, 1.35);
      picture(grp, drawingTex('volcano'), 1.2, 1.5, 1.33, 0.36, 0.28, 0, 0xffffff); picture(grp, drawingTex('luigi'), 1.6, 1.1, 1.33, 0.36, 0.28, 0, 0xffffff);
      // dining table + chairs
      const dt = PR.table(2.2, 1.1, 0.76, { color: 0x8b5d38 }); at(dt, 5, 0, 12.5); grp.add(dt); G.addCol(3.9, 0, 11.95, 6.1, 0.8, 13.05);
      [[4.3, 11.6, 0], [5.7, 11.6, 0], [4.3, 13.4, PI], [5.7, 13.4, PI]].forEach(([x, z, r]) => { const c = PR.chair(); at(c, x, 0, z, r); grp.add(c); });
      const bowl = PR.mesh(PR.lathe([[0.001, 0], [0.12, 0.01], [0.2, 0.08], [0.21, 0.09], [0.19, 0.09], [0.11, 0.02], [0.001, 0.02]], 32), new THREE.MeshPhysicalMaterial({ color: 0xf4f1ea, roughness: 0.2, clearcoat: 0.8 })); bowl.position.set(5, 0.77, 12.5); grp.add(bowl);
      [0xd43a2a, 0xffa321, 0x7ab84f].forEach((c, i) => { const f = PR.mesh(new THREE.SphereGeometry(0.045, 20, 12), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, clearcoat: 0.5 })); f.position.set(4.95 + i * 0.06, 0.84, 12.5 + (i % 2) * 0.05); grp.add(f); });
    },
    buildBackRooms(grp) {
      const PR = G.props, at = PR.at;
      // Luca's room: bed, desk with code on screen, belts, trophies
      const lb = PR.bed(1.1, 2.1, 0x2d4f8a); at(lb, -17.4, 0, -13.6); grp.add(lb); G.addCol(-18.0, 0, -14.8, -16.8, 0.7, -12.5);
      const desk = PR.table(1.6, 0.7, 0.75, { color: 0x5b4636 }); at(desk, -10, 0, -15.2); grp.add(desk); G.addCol(-10.8, 0, -15.6, -9.2, 0.8, -14.8);
      const mon = PR.monitor(codeTex()); at(mon, -10, 0.75, -15.35); grp.add(mon);
      const kb = PR.rbox(0.44, 0.02, 0.14, G.mat(0x1d1d20, { kind: 'plastic' }), 0.005); kb.position.set(-10, 0.77, -15.0); grp.add(kb);
      const chair = PR.chair(0x303036); at(chair, -10, 0, -14.3, PI); grp.add(chair);
      const trophy = PR.mesh(PR.lathe([[0.05, 0], [0.05, 0.03], [0.015, 0.05], [0.015, 0.1], [0.06, 0.13], [0.07, 0.22], [0.065, 0.22], [0.02, 0.14]], 32), G.mat(0xe2ac3f, { kind: 'metal', rough: 0.2 })); trophy.position.set(-10.6, 0.77, -15.3); grp.add(trophy);
      const tk = PR.chessPiece(true, 'n'); tk.scale.setScalar(0.5); tk.traverse((o) => { if (o.isMesh) o.material = G.mat(0xe2ac3f, { kind: 'metal', rough: 0.2 }); }); tk.position.set(-9.4, 0.77, -15.3); grp.add(tk);
      const beltCols = [0xffffff, 0xffe14a, 0xff9a2a, 0x3fbf5a, 0x3a7bff, 0x8a4cff, 0x7a4a26, 0x111111];
      const rack = PR.rbox(0.05, 0.05, 1.8, G.mat(0x8a6a4a, { kind: 'grain' }), 0.01); rack.position.set(-19.8, 2.1, -10); grp.add(rack);
      beltCols.forEach((c, i) => { const b = PR.rbox(0.015, 0.9 - i * 0.02, 0.05, G.mat(c, { kind: 'fabric', tile: 0.03 }), 0.004); b.position.set(-19.78, 1.66, -10.8 + i * 0.22); grp.add(b); });
      const hel = PR.mesh(new THREE.SphereGeometry(0.15, 32, 16, 0, PI * 2, 0, PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x2d6cdf, roughness: 0.25, clearcoat: 1 })); hel.position.set(-11.2, 0.77, -15.1); grp.add(hel);
      const shelfL = PR.bookshelf(1.2, 1.6); at(shelfL, -13.5, 0, -15.62); grp.add(shelfL);
      // Ludo's room: bed, drawing table, crayons, keyboard
      const db = PR.bed(1.0, 1.9, 0xe86a3a); at(db, 4.4, 0, -13.8); grp.add(db); G.addCol(3.8, 0, -14.9, 5.0, 0.7, -12.8);
      const dtab = PR.table(1.4, 0.8, 0.62, { color: 0xe9d8b4 }); at(dtab, -3.6, 0, -14.8); grp.add(dtab); G.addCol(-4.3, 0, -15.2, -2.9, 0.65, -14.4);
      const book = PR.mesh(new THREE.PlaneGeometry(0.6, 0.42), new THREE.MeshStandardMaterial({ map: drawingTex('map'), roughness: 0.9 }), false); book.rotation.x = -PI / 2; book.position.set(-3.6, 0.625, -14.7); grp.add(book);
      [0xff4040, 0x3a7bff, 0xffd23a, 0x3fbf5a, 0x9b59b6].forEach((c, i) => { const cr = PR.cyl(0.006, 0.006, 0.1, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }), 8); cr.rotation.z = PI / 2; cr.rotation.y = i * 0.3; cr.position.set(-3.0, 0.63, -14.6 + i * 0.03); grp.add(cr); });
      picture(grp, drawingTex('dragon'), -6.82, 1.6, -8, 0.8, 0.6, PI / 2, 0xffffff); picture(grp, drawingTex('family'), -2, 1.6, -15.82, 0.8, 0.6, 0, 0xffffff); picture(grp, drawingTex('volcano'), 6.82, 1.6, -9, 0.8, 0.6, -PI / 2, 0xffffff);
      const kbd = new THREE.Group(); kbd.add(at(PR.rbox(1.3, 0.1, 0.35, G.mat(0x1b1b1d, { kind: 'plastic' }), 0.02), 0, 0.72, 0)); for (let i = 0; i < 22; i++) { const k = PR.rbox(0.05, 0.015, 0.2, G.mat(i % 7 === 2 || i % 7 === 5 ? 0x111111 : 0xf6f6f2, { kind: 'plastic', rough: 0.3 }), 0.004); k.position.set(-0.58 + i * 0.055, 0.78, 0.04); kbd.add(k); } [-0.55, 0.55].forEach((x) => kbd.add(at(PR.cyl(0.015, 0.015, 0.68, G.mat(0x222222, { kind: 'metal' }), 8), x, 0.34, 0))); at(kbd, 1.2, 0, -15.3); grp.add(kbd);
      // storage: boxes, the travel trunk, globe, paddle
      [[9, -6, 0.7], [9, -7.2, 0.55], [18.5, -6.5, 0.8], [18.5, -8.1, 0.6], [16, -15, 0.65], [9.7, -6.4, 0.45]].forEach(([x, z, s]) => { const b = PR.box(s); b.position.set(x, 0, z); b.rotation.y = Math.random() * 0.4; grp.add(b); G.addCol(x - s / 2, 0, z - s / 2, x + s / 2, s, z + s / 2); });
      const b2 = PR.box(0.5); b2.position.set(18.5, 0.8, -6.5); b2.rotation.y = 0.3; grp.add(b2);
      const trunk = PR.trunk(stickerTex()); trunk.position.set(13, 0, -12); grp.add(trunk); this.trunkLid = trunk.userData.lid;
      G.addCol(12.2, 0, -12.45, 13.8, 0.85, -11.55);
      const side = PR.table(1.4, 0.6, 0.8, { color: 0x6b4a2e }); at(side, 18.4, 0, -14.9); grp.add(side); G.addCol(17.7, 0, -15.2, 19.1, 0.8, -14.6);
      const globe = new THREE.Group(); const gb = PR.mesh(PR.lathe([[0.1, 0], [0.1, 0.03], [0.04, 0.05], [0.03, 0.08]], 24), G.mat(0x5a3c24, { kind: 'grain' })); globe.add(gb);
      const gs = PR.mesh(new THREE.SphereGeometry(0.15, 32, 16), new THREE.MeshPhysicalMaterial({ color: 0xf2f8ff, transparent: true, opacity: 0.2, roughness: 0.02, transmission: 0.0, clearcoat: 1, depthWrite: false })); gs.position.y = 0.23; globe.add(gs);
      const mtn = PR.mesh(new THREE.ConeGeometry(0.08, 0.12, 6), G.mat(0xffffff, { kind: 'stone', tile: 0.1 })); mtn.position.y = 0.16; globe.add(mtn);
      globe.position.set(18.6, 0.8, -14.9); grp.add(globe);
      const paddle = new THREE.Group(); paddle.position.set(9, 0, -15.6); paddle.rotation.z = 0.15; grp.add(paddle);
      const pw = G.mat(0xc89a64, { kind: 'grain', tile: 0.3 });
      paddle.add(at(PR.cyl(0.025, 0.025, 1.3, pw, 12), 0, 1.0, 0)); const bl = PR.mesh(new THREE.SphereGeometry(0.2, 24, 16), G.mat(0xb5552b, { kind: 'grain', tile: 0.3 })); bl.scale.set(0.55, 1.2, 0.08); bl.position.y = 0.3; paddle.add(bl);
      picture(grp, photoTex('lake'), 10.5, 1.7, -15.82, 0.9, 0.6, 0);
      // attic ladder in the hallway
      const lad = new THREE.Group(); lad.position.set(0, 0, -2); grp.add(lad); const lw = G.mat(0xc89a64, { kind: 'grain', tile: 0.4 });
      [-0.3, 0.3].forEach((x) => { const r = PR.rbox(0.06, 3.3, 0.08, lw, 0.01); r.position.set(x, 1.6, 0); r.rotation.x = 0.2; lad.add(r); });
      for (let i = 0; i < 8; i++) { const r = PR.cyl(0.02, 0.02, 0.6, lw, 10); r.rotation.z = PI / 2; r.position.set(0, 0.3 + i * 0.38, -0.06 - i * 0.077); lad.add(r); }
      const hatch = PR.rbox(1.2, 0.05, 1.2, G.mat(0xefe6d6, { kind: 'paint' }), 0.01); hatch.position.set(0, 3.18, -2.6); grp.add(hatch);
    },
    buildGarage(grp) {
      const PR = G.props, at = PR.at;
      bike(grp, 28, 6, 0, 0x2d6cdf); bike(grp, 29.6, 6.4, 0.1, 0xe03a2a);
      G.addCol(27.5, 0, 5.2, 30.2, 1.1, 7.2);
      const gr = PR.kettleGrill(); gr.position.set(23, 0, 13.5); gr.scale.setScalar(1.25); grp.add(gr);
      G.addCol(22.4, 0, 12.9, 23.6, 1.6, 14.1);
      const wb = PR.table(3.0, 0.9, 0.92, { color: 0x7a5a3a, th: 0.07 }); at(wb, 26, 0, 1.0); grp.add(wb); G.addCol(24.5, 0, 0.5, 27.5, 1.0, 1.5);
      [[24.9, 0x2d6cdf], [25.8, 0xd23a2a], [26.8, 0x3fa85a]].forEach(([x, c]) => { const t = PR.rbox(0.5, 0.22, 0.26, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 0.8 }), 0.03); t.position.set(x, 1.03, 1.0); grp.add(t); });
      const peg = PR.rbox(3.0, 1.2, 0.03, G.mat(0xb89a74, { kind: 'grain', tile: 0.6 }), 0.005); peg.position.set(26, 1.9, 0.18); grp.add(peg);
      [[25, 1.9], [25.6, 2.1], [26.4, 1.8], [27.1, 2.0]].forEach(([x, y]) => { const tl = PR.rbox(0.05, 0.35, 0.03, G.mat(0x9a9ea3, { kind: 'metal', rough: 0.3 }), 0.01); tl.position.set(x, y, 0.22); tl.rotation.z = Math.random() - 0.5; grp.add(tl); });
    },
    // ---------- NPC management ----------
    npcList() { return G.ORDER.filter((id) => id !== G.game.activeId).map((id) => G.chars[id]); },
    nearNpc(ch) { let best = null, bd = 2.0; for (const n of this.npcList()) { const d = n.pos.distanceTo(ch.pos); if (d < bd) { bd = d; best = n; } } return best; },
    npcPos() { const a = G.chars[G.game.activeId]; const n = this.nearNpc(a); return n ? n.pos : new V3(9999, 0, 9999); },
    talk(ch) {
      const n = this.nearNpc(ch); if (!n) return;
      n.facing = Math.atan2(ch.pos.x - n.pos.x, ch.pos.z - n.pos.z);
      const L = {
        frank: ["Dough needs 48 hours. I started it Thursday. I'm a planner too.", "Everyone keeps saying the backyard is huge now. I think we shrank.", "Somebody should really take the Adventure Compass away from the dog.", "Grill's hot, dough's resting, compass is shattered. Normal Saturday."],
        elba: ["Stay together out there. I mean it. Luigi, especially you.", "I made a list. Step one: get the pieces back. Step two: nobody tells Grandma.", "The compass pedestal shows how many pieces we have. Right now: one small victory at a time.", "If Frank says 'I have a plan', come get me."],
        luca: ["I've been analyzing the Glitch's moves. It opens with chaos. Every time.", "If there's a puzzle, I've got it. If there's a board to break, I've got that too.", "Chess Vision works on real stuff now. Hold Q and I see the lines.", "Dad asked me to explain the plan without math. There is no plan without math."],
        ludo: ["I'm drawing the next world right now. Don't look. Okay you can look.", "If something's missing, I can just draw it. Bridges are my specialty.", "I think the Glitch just wants to play. It keeps doodling on my pages.", "My imagination sees stuff you can't. Like clouds you can stand on."],
        luigi: ['*wags so hard he falls over*', '*drops a slobbery sock at your feet*', '*sneezes, then looks very proud*', '*leans his entire weight on your leg*'],
      }[n.id];
      n.lineIdx = ((n.lineIdx ?? -1) + 1) % L.length; G.bubble(n.id, L[n.lineIdx], 4.2); n.talkT = 2;
      if (n.dog) { n.action = 'sit'; n.actionT = 0; G.audio.play('bark', { count: 1, small: true }); }
    },
    placeFamily(activeId) {
      for (const id of G.ORDER) {
        const ch = G.chars[id]; if (id === activeId) continue;
        const st = this.stations[id]; ch.pos.copy(st.pos); ch.facing = st.facing; ch.root.rotation.y = st.facing; ch.vel.set(0, 0, 0); ch.action = st.action; ch.actionT = 0;
      }
    },
    update(dt) {
      const t = G.time; const P = this.portal;
      P.pr1.rotation.z += dt * 1.5; P.pr2.rotation.z -= dt * 2.2; P.swirl.material.opacity = 0.4 + Math.sin(t * 3) * 0.12;
      this.seals.forEach((s, i) => { s.ring.rotation.z += dt * (1 + i * 0.1); s.ring2.rotation.z -= dt * 1.7; s.lock.rotation.y += dt; s.g.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.04); });
      this.holo.rotation.y += dt * 0.6; this.needle.rotation.z = Math.sin(t * 0.7) * 0.4 + (G.save.frags ? t * 0.8 : 0);
      this.fragSlots.forEach((f, i) => { f.material.color.setHex(i < G.save.frags ? 0xe2ac3f : 0x444455); f.rotation.y += dt * 2; });
      if (arguments[1] !== 'play') return;
      // NPC families idle, facing the player when near
      const act = G.chars[G.game.activeId];
      for (const n of this.npcList()) {
        if (n.dog) continue;
        const d = n.pos.distanceTo(act.pos);
        n.vel.x = n.vel.z = 0; G.moveChar(n, dt, { x: 0, z: 0 }, false, false, false);
        if (d < 3.5) { const want = Math.atan2(act.pos.x - n.pos.x, act.pos.z - n.pos.z); n.facing = G.angleLerp(n.facing, want, dt * 3); if (n.action === 'draw' || n.action === 'think') n.action = null; }
        n.ambT = (n.ambT ?? G.rand(8, 16)) - dt;
        if (n.ambT < 0 && d < 9) { n.ambT = G.rand(14, 26); this.ambient(n); }
      }
      if (G.game.activeId !== 'luigi') this.updateLuigiAI(dt);
    },
    ambient(n) {
      const L = { frank: ['Has anyone seen my other sock?', 'Pizza tonight. Non-negotiable.', 'I have a plan.'], elba: ['Frank, what plan?', 'Shoes. Everyone. Now.', 'Has anyone fed the dog? Luigi, stop lying.'], luca: ['Hm. Knight to f7.', 'Two more belts. Then black.', 'I could code a robot to fold laundry.'], ludo: ['*humming a song he made up*', 'Needs more dragons.', 'Do I draw a pizza or a volcano? Both.'] };
      const arr = L[n.id]; if (arr) G.bubble(n.id, arr[(Math.random() * arr.length) | 0], 3);
    },
    updateLuigiAI(dt) {
      const L = G.chars.luigi; const A = this.luigiAI; A.t -= dt;
      const act = G.chars[G.game.activeId];
      const go = (x, z, near = 0.6) => { const d = G.aiFollow(L, dt, new V3(x, 0, z), near); return d <= near + 0.2; };
      if (A.t <= 0 && !A.busy) {
        const opts = ['sock', 'window', 'sleep', 'bark', 'beg', 'follow', 'zoom', 'bed'];
        A.state = opts[(Math.random() * opts.length) | 0]; A.t = G.rand(9, 15); A.phase = 0; L.action = null;
        if (A.state === 'zoom') { L.zoom = 3; G.bubble('luigi', '*ZOOMIES*', 2); }
      }
      const idle = () => { L.vel.x = L.vel.z = 0; G.moveChar(L, dt, { x: 0, z: 0 }, false, false, false); };
      switch (A.state) {
        case 'sock':
          if (A.phase === 0) { if (go(this.sock.position.x, this.sock.position.z + 0.5)) { A.phase = 1; L.action = 'hold'; G.bubble('luigi', '*acquires sock*', 2.5); } }
          else { const a = G.time * 0.4; go(-8 + Math.cos(a) * 5, 8 + Math.sin(a) * 4, 0.3); const hp = new V3(); L.muzzle.getWorldPosition(hp); this.sock.position.set(hp.x, hp.y - 0.12, hp.z); this.sock.rotation.y = L.root.rotation.y + PI / 2; if (A.t < 1) { this.sock.position.set(-16, 0.06, -2.2); L.action = null; } }
          break;
        case 'window': if (go(-14, 15.1)) { L.facing = 0; L.action = 'sit'; if (Math.random() < 0.004) G.bubble('luigi', '*stares suspiciously outside*', 2.5); } break;
        case 'sleep': case 'bed': if (go(-2.5, 12.8, 0.3)) { L.action = A.state === 'sleep' ? 'sleep' : 'sit'; if (Math.random() < 0.003) G.bubble('luigi', 'z z z', 2); } break;
        case 'bark': if (go(5, -1.2)) { L.facing = PI; if (Math.random() < 0.02) { L.action = 'bark'; L.actionT = 0; G.audio.play('bark', { count: 2 }); G.ring(L.pos.clone().add(new V3(0, 0.8, -0.4)), 0xffe14a, { size: 1.5, dur: 0.4, vertical: true }); if (Math.random() < 0.3) G.bubble('luigi', '*barks at absolutely nothing*', 2.2); } } break;
        case 'beg': if (go(11.5, 8.0)) { L.facing = PI; L.action = 'beg'; } break;
        case 'follow': go(act.pos.x + 1, act.pos.z + 1, 1.6); break;
        case 'zoom': { const a = G.time * 1.2; go(-10 + Math.cos(a) * 6, 7 + Math.sin(a) * 5, 0.2); if (L.zoom <= 0) A.t = 0; break; }
      }
      function idleIfNear() { if (L.speed01 < 0.05) idle(); }
      if (L.zoom > 0) L.zoom -= dt;
    },
    objective() { return G.save.frags ? 'World 1 complete. The next worlds open in future chapters. Explore the house or replay the backyard.' : 'Head through the glowing back door into the backyard.'; },
  };
  G.levels = G.levels || {}; G.levels.hub = hub;
})();
