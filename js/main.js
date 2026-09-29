// Game flow: title, story scenes, character switching, abilities, collectibles, saving, HUD, and the main loop.
(function () {
  const G = window.G;
  const V3 = THREE.Vector3;
  const PI = Math.PI;
  const $ = G.$;
  const SAVE_KEY = 'shattered-compass-v1';

  // ---------- save ----------
  const DEFAULT_SAVE = () => ({ intro: false, frags: 0, got: {}, sparks: 0, unlocked: { frank: [0], elba: [0], luca: [0], ludo: [0], luigi: [0] }, costume: {}, ach: {}, active: 'frank', w1Visited: false, muted: false });
  function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && typeof s === 'object') return Object.assign(DEFAULT_SAVE(), s); } catch (e) {} return null; }
  G.save = loadSave() || DEFAULT_SAVE();
  const hadSave = !!loadSave() && G.save.intro;

  const game = (G.game = {
    mode: 'title', activeId: G.save.active || 'frank', level: null, doughs: [], doodle: null, hearts: 3, fails: 0, transitioning: false,
    persist() { G.save.active = this.activeId; try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) {} },
  });
  const MEMORIES = [
    ['w1_photo1', 'The Great Pizza Oven Test. The smoke alarm gave it five stars.'],
    ['w1_photo2', 'The canoe trip. Frank insists the lake moved first.'],
    ['w1_photo3', "Luigi's first day home. He ate a sock within the hour. It was the first of many."],
  ];

  // ---------- boot ----------
  function boot() {
    G.initRenderer();
    G.initTouch();
    G.chars = {};
    for (const id of G.ORDER) { const ch = G.buildCharacter(id); G.chars[id] = ch; G.scene.add(ch.root); const idx = G.save.costume[id] || 0; if ((G.save.unlocked[id] || [0]).includes(idx)) G.setCostume(ch, idx); }
    G.portraits = G.makePortraits();
    G.glitch = G.buildGlitch();
    buildRoster(); buildTitle();
    $('loading').hidden = true;
    loadLevel('hub');
    placeHubStart();
    G.cam.override = { pos: new V3(-2, 4, 13), look: new V3(-9, 1.3, 7), speed: 1 }; G.cam.override.snap = true;
    G.allowPointerLock = () => game.mode === 'play';
    requestAnimationFrame(frame);
  }
  function buildTitle() {
    const fam = $('titleFamily');
    fam.innerHTML = G.ORDER.map((id) => `<div class="p" style="--c:${G.CHAR_INFO[id].color}"><i style="background-image:url(${G.portraits[id] || ''})"></i><span>${G.CHAR_INFO[id].name}</span></div>`).join('');
    if (hadSave) { $('btnContinue').hidden = false; $('btnStart').textContent = 'Replay the opening'; $('btnContinue').classList.remove('ghost'); $('btnStart').classList.add('ghost'); }
    $('btnStart').onclick = () => startGame(true);
    $('btnContinue').onclick = () => startGame(false);
    G.audio.muted = !!G.save.muted;
  }
  function startGame(withIntro) {
    G.audio.init(); G.audio.setMuted(!!G.save.muted); updateMuteBtn();
    $('title').hidden = true; $('hud').hidden = false;
    G.cam.override = null;
    if (withIntro) playIntro();
    else { placeHubStart(); setActive(G.save.active || 'frank', true); game.mode = 'play'; setObjective(game.level.objective()); G.audio.playSong('hub'); }
  }
  function placeHubStart() {
    const hub = G.levels.hub; const a = game.activeId;
    const ch = G.chars[a]; ch.pos.set(-4, 0, 9); ch.facing = PI; ch.root.rotation.y = PI;
    hub.placeFamily(a);
    G.cam.yaw = 0; G.cam.pitch = 0.34; G.cam.snapNext = true;
  }

  // ---------- levels ----------
  function loadLevel(id) {
    if (G.levelGroup) G.scene.remove(G.levelGroup);
    G.cols.length = 0; G.triggers.length = 0; G.interactables.length = 0; G.fadeables.length = 0;
    G.levelGroup = new THREE.Group(); G.scene.add(G.levelGroup);
    game.doughs = []; game.doodle = null; G.imaginationOn = false; G.worldScale = 1; game.planT = 0;
    const L = (game.level = G.levels[id]);
    G.groundAt = () => 0;
    G.levelAO = L.ao !== false;
    L.build();
    if (L.registerBossInteract) L.registerBossInteract();
    if (id === 'world1') G.groundAt = G.groundAtW1;
    Object.assign(G.cam, id === 'hub' ? { dist: 5.4, pitch: 0.4, maxDist: 9, minPitch: 0.05 } : { dist: 8.5, pitch: 0.32, maxDist: 16, minPitch: -0.15 });
    G.cam.ceiling = undefined;
    G.audio.playSong(L.song);
    setObjective(L.objective ? L.objective() : '');
    $('objWhere').textContent = L.name;
    hideGlitch(true);
  }
  game.enterWorld1 = async function () {
    if (game.transitioning || game.mode !== 'play') return;
    game.transitioning = true; game.mode = 'transition';
    G.audio.play('whoosh'); await G.fade(true);
    loadLevel('world1');
    const L = game.level; const sp = L.spawn.pos;
    G.ORDER.forEach((id, i) => { const c = G.chars[id]; const off = id === game.activeId ? new V3(0, 0, 0) : new V3((i - 2) * 1.4, 0, 1.5); c.pos.copy(sp).add(off); c.vel.set(0, 0, 0); c.facing = PI; c.root.rotation.y = PI; c.action = null; c.zoom = 0; });
    G.cam.yaw = 0; G.cam.snapNext = true; game.hearts = 3;
    game.mode = 'play';
    await G.fade(false); game.transitioning = false;
    L.enter();
  };
  game.goHome = async function (after) {
    if (game.transitioning) return;
    game.transitioning = true; const prev = game.mode; game.mode = 'transition';
    await G.fade(true);
    loadLevel('hub');
    const ch = G.chars[game.activeId]; ch.pos.set(-3.75, 0, 9); ch.vel.set(0, 0, 0); ch.facing = PI; ch.zoom = 0;
    G.levels.hub.placeFamily(game.activeId);
    G.cam.yaw = 0; G.cam.snapNext = true; game.hearts = 3;
    game.mode = 'play';
    await G.fade(false); game.transitioning = false;
    if (after) after();
  };

  // ---------- characters ----------
  function setActive(id, silent) {
    const prev = game.activeId; game.activeId = id; G.save.active = id;
    G.audio.setMotif(id);
    if (!silent) { G.audio.play('switch', { who: id }); G.ring(G.chars[id].pos.clone().add(new V3(0, 0.1, 0)), parseInt(G.CHAR_INFO[id].color.slice(1), 16), { size: 2, dur: 0.5 }); }
    const ch = G.chars[id]; ch.action = ch.action === 'sleep' || ch.action === 'sit' || ch.action === 'beg' || ch.action === 'hold' || ch.action === 'draw' || ch.action === 'think' ? null : ch.action;
    if (prev && prev !== id) { endVision(G.chars[prev]); }
    updateRosterUI(); updateAbilitiesUI();
  }
  game.setActive = setActive;
  function cycleActive(dir = 1) { const i = G.ORDER.indexOf(game.activeId); setActive(G.ORDER[(i + dir + G.ORDER.length) % G.ORDER.length]); }
  function buildRoster() {
    const r = $('roster'); r.innerHTML = '';
    G.ORDER.forEach((id) => {
      const b = document.createElement('button'); b.className = 'member'; b.style.setProperty('--c', G.CHAR_INFO[id].color); b.style.backgroundImage = `url(${G.portraits[id] || ''})`;
      b.setAttribute('aria-label', 'Switch to ' + G.CHAR_INFO[id].name);
      b.innerHTML = `<span class="nm">${G.CHAR_INFO[id].name}</span><span class="k">${G.CHAR_INFO[id].key}</span>`;
      b.onclick = (e) => { e.stopPropagation(); if (game.mode === 'play') setActive(id); };
      b.dataset.id = id; r.appendChild(b);
    });
  }
  function updateRosterUI() { document.querySelectorAll('.member').forEach((b) => b.classList.toggle('active', b.dataset.id === game.activeId)); }
  function updateAbilitiesUI() {
    const a = G.ABILITIES[game.activeId] || [];
    $('abilities').innerHTML = a.map(([k, n]) => `<span class="chip" data-k="${k}"><kbd>${k}</kbd>${n}</span>`).join('') + `<span class="chip"><kbd>C</kbd>Costume</span>`;
  }

  // ---------- HUD ----------
  function setObjective(text) { $('objWhat').textContent = text || ''; }
  game.setObjective = setObjective;
  game.setModeLabel = (t) => { $('modeLabel').textContent = t; };
  function updateHUD() {
    $('hearts').innerHTML = [0, 1, 2].map((i) => `<div class="heart${i < game.hearts ? '' : ' off'}"></div>`).join('');
    $('fragCount').textContent = `${G.save.frags}/9`;
    $('sparkCount').textContent = G.save.sparks;
  }
  game.addSpark = function (n = 1) { G.save.sparks += n; game.sparkCombo = (game.sparkCombo || 0) + 1; game.sparkComboT = 1.2; G.audio.play('spark', { pitch: Math.min(12, game.sparkCombo) }); updateHUD(); };

  // ---------- collectibles ----------
  const KIND_SOUND = { photo: 'collect', treasure: 'collect', chess: 'collect', stamp: 'collect', topping: 'collect', challenge: 'fanfare' };
  game.collect = function (id, kind, title, sub) {
    if (kind === 'fragment') return collectFragment();
    const isNew = !G.save.got[id]; G.save.got[id] = true; game.persist();
    G.audio.play(KIND_SOUND[kind] || 'collect');
    const a = G.chars[game.activeId]; G.burst(a.pos.clone().add(new V3(0, 1.4, 0)), 0xffd36b, 22, { speed: 6, size: 0.14 });
    G.toast(title, sub + (isNew ? '' : ' (already found)'));
    if (kind === 'treasure' && game.activeId === 'luigi') { a.action = 'hold'; setTimeout(() => { if (a.action === 'hold') a.action = null; }, 2500); }
    checkUnlocks();
    const reactions = { photo: { frank: 'Oh no. Not this one.', elba: "I love this photo. Nobody's allowed to be embarrassed.", luca: 'Why am I blinking in every single one?', ludo: 'I remember this! Sort of!', luigi: '*licks the photo*' }, chess: { luca: 'A golden knight. Moves in an L. Obviously.' }, topping: { frank: 'Now THAT is a topping.' } };
    const r = reactions[kind] && (reactions[kind][game.activeId] || reactions[kind].luca || reactions[kind].frank);
    if (r) setTimeout(() => G.bubble(reactions[kind][game.activeId] ? game.activeId : kind === 'chess' ? 'luca' : 'frank', r, 3), 700);
  };
  function count(prefixes) { return prefixes.filter((p) => G.save.got[p]).length; }
  function checkUnlocks() {
    if (count(['w1_photo1', 'w1_photo2', 'w1_photo3']) === 3) game.unlockCostume('elba', 1);
    if (count(['w1_treasure1', 'w1_treasure2', 'w1_treasure3']) === 3) game.unlockCostume('luigi', 1);
    if (G.save.got.w1_knight) game.unlockCostume('luca', 1);
    if (G.save.got.w1_zoomies) game.unlockCostume('luigi', 2);
    if (G.save.got.w1_stamp) game.unlockCostume('luigi', 3);
    if (count(['w1_pepperoni', 'w1_basil']) === 2) game.unlockCostume('luigi', 4);
  }
  game.unlockCostume = function (id, idx) {
    const u = G.save.unlocked[id] || (G.save.unlocked[id] = [0]);
    if (u.includes(idx)) return; u.push(idx); game.persist();
    const c = G.chars[id].costumes[idx];
    setTimeout(() => G.toast('Costume unlocked', `${G.CHAR_INFO[id].name}: ${c.name} · press C to wear it`), 2600);
  };
  game.achieve = function (id, title, sub) { if (G.save.ach[id]) return; G.save.ach[id] = true; game.persist(); G.audio.play('fanfare'); G.toast(title, sub, 3.5); };
  function collectFragment() {
    G.save.frags = Math.max(G.save.frags, 1); G.save.got.fragment1 = true; game.persist(); updateHUD();
    G.audio.play('fanfare'); G.flash(); G.cam.shake = 0.4;
    G.toast('Compass Fragment #1', '1 of 9 recovered', 3.5);
    game.cutscene(async (S) => {
      const a = G.chars[game.activeId]; const p = a.pos.clone();
      regroup(p, true);
      G.ORDER.forEach((id) => { if (!G.chars[id].dog) { G.chars[id].action = 'cheer'; G.chars[id].actionT = 0; } });
      S.cam(p.clone().add(new V3(5, 3, 7)), p.clone().add(new V3(0, 1.2, 0)), 2);
      await S.wait(1.2);
      showGlitch(p.clone().add(new V3(0, 4, -5)));
      S.cam(p.clone().add(new V3(0, 3.5, 7)), p.clone().add(new V3(0, 2.8, -4)), 2);
      await S.say('glitch', "Oooh, you're GOOD at this. Okay okay okay. Next piece is somewhere with trees. And bikes. And SO much mud.");
      await S.say('glitch', 'Catch me if you can!');
      G.audio.play('glitch'); hideGlitch();
      await S.say('elba', 'One down.');
      await S.say('frank', 'Eight to go. Easy.');
      await S.say('luca', 'Dad.');
      await S.say('frank', '...Relatively easy.');
      await S.say('luigi', '*carries a mower battery around like a trophy*');
    }, () => {
      game.goHome(() => {
        G.audio.playSong('victory');
        setTimeout(() => G.audio.playSong('hub'), 9000);
        G.toast('Chapter 1 complete', 'World 2 · Cunningham Trail Chaos is next', 5);
        setObjective(G.levels.hub.objective());
        setTimeout(() => G.bubble('ludo', 'The compass is glowing! One piece is back!', 3.5), 2500);
      });
    });
  }

  // ---------- cutscenes ----------
  let lineResolve = null, typing = null;
  game.cutscene = function (fn, after) {
    game.mode = 'cutscene'; G.clearBubbles(); $('prompt').hidden = true; endVision(G.chars[game.activeId]);
    $('letterbox').classList.add('on'); $('skip').hidden = false; document.body.classList.add('cine');
    if (document.exitPointerLock && G.input.locked) document.exitPointerLock();
    const S = {
      skipping: false,
      say(who, text) {
        if (S.skipping) return Promise.resolve();
        const info = G.CHAR_INFO[who]; const d = $('dialogue'); d.hidden = false; d.style.setProperty('--c', info.color);
        $('dName').textContent = info.name; const face = $('dFace');
        face.style.backgroundImage = G.portraits[who] ? `url(${G.portraits[who]})` : who === 'glitch' ? 'conic-gradient(#ff3fa4,#36e0ff,#ffe14a,#9dff5c,#ff3fa4)' : 'linear-gradient(#ff7043,#b8332a)';
        const ch = G.chars[who]; if (ch && ch.talkT !== undefined) ch.talkT = Math.min(3, text.length / 30);
        typing = { text, i: 0, acc: 0, who };
        $('dText').textContent = '';
        return new Promise((res) => { lineResolve = res; });
      },
      cam(pos, look, speed = 2, snap = false) { G.cam.override = { pos: pos.clone(), look: look.clone(), speed, snap }; },
      wait(s) { return S.skipping ? Promise.resolve() : G.wait(s); },
      async caption(small, big) {
        if (S.skipping) return;
        $('caption').innerHTML = `<small>${small}</small>${big}`; $('caption').style.opacity = 1; await G.wait(2.4); $('caption').style.opacity = 0; await G.wait(0.5);
      },
      walk(ch, pos) { ch.scriptTarget = pos.clone(); },
    };
    game.scene = S;
    const done = () => {
      $('dialogue').hidden = true; $('letterbox').classList.remove('on'); document.body.classList.remove('cine'); $('skip').hidden = true; $('caption').style.opacity = 0;
      G.cam.override = null; G.cam.snapNext = false; game.scene = null; typing = null; lineResolve = null;
      G.ORDER.forEach((id) => { G.chars[id].scriptTarget = null; });
      // resume camera behind active character
      const a = G.chars[game.activeId]; G.cam.target.set(a.pos.x, a.pos.y + 1.3, a.pos.z);
      game.mode = 'play';
      if (after) after();
    };
    fn(S).then(done, (e) => { console.error(e); done(); });
  };
  function advance() {
    if (!typing) return;
    if (typing.i < typing.text.length) { typing.i = typing.text.length; $('dText').textContent = typing.text; return; }
    typing = null; $('dialogue').hidden = true; const r = lineResolve; lineResolve = null; if (r) r();
  }
  function skipScene() { const S = game.scene; if (!S) return; S.skipping = true; typing = null; const r = lineResolve; lineResolve = null; $('dialogue').hidden = true; if (r) r(); }
  $('dialogue').addEventListener('click', advance);
  $('skip').addEventListener('click', skipScene);
  function updateTyping(dt) {
    if (!typing || typing.i >= typing.text.length) return;
    typing.acc += dt * 48; const n = Math.floor(typing.acc);
    if (n > 0) { typing.acc -= n; const prev = typing.i; typing.i = Math.min(typing.text.length, typing.i + n); $('dText').textContent = typing.text.slice(0, typing.i); if (Math.floor(prev / 3) !== Math.floor(typing.i / 3) && typing.text[typing.i - 1] !== ' ') G.audio.play('voice', { who: typing.who }); }
  }

  // ---------- the Glitch ----------
  function showGlitch(pos) {
    const g = G.glitch; g.root.position.copy(pos); g.root.scale.setScalar(0.01); G.scene.add(g.root); G.chars.glitch = g; g.visible = true; g.appearT = 0;
    G.audio.play('glitch'); G.burst(pos, 0xff3fa4, 16, { speed: 5 }); G.burst(pos, 0x36e0ff, 16, { speed: 5 });
    return g;
  }
  function hideGlitch(instant) {
    const g = G.glitch; if (!g || !g.visible) return; g.visible = false;
    if (!instant) { G.burst(g.root.position.clone(), 0xff3fa4, 20, { speed: 7 }); G.ring(g.root.position.clone(), 0x36e0ff, { size: 4, vertical: true }); }
    G.scene.remove(g.root); delete G.chars.glitch;
  }
  game.showGlitch = showGlitch; game.hideGlitch = hideGlitch;

  // ---------- opening story ----------
  function playIntro() {
    const hub = G.levels.hub; const c = G.chars;
    if (game.level.id !== 'hub') loadLevel('hub');
    setActive('frank', true);
    const place = (id, x, z, f, act) => { const ch = c[id]; ch.pos.set(x, 0, z); ch.vel.set(0, 0, 0); ch.facing = f; ch.root.rotation.y = f; ch.action = act || null; ch.actionT = 0; };
    place('frank', -7.2, 7.4, -2.2); place('elba', -6.2, 5.2, -1.4); place('luca', -10, 7.4, 0.1, 'think'); place('ludo', -11.8, 10.6, 2.6); place('luigi', -11, -1.6, 0);
    hub.sock.visible = false;
    const compass = new THREE.Group(); const disc = G.mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 28), 0xc9953a, { std: true, metal: 0.8, rough: 0.3 }); compass.add(disc);
    const face = G.mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.13, 28), 0xfff6e4); compass.add(face);
    const needle = G.mesh(new THREE.ConeGeometry(0.06, 0.6, 4), 0xd62828); needle.rotation.x = PI / 2; needle.position.y = 0.09; compass.add(needle);
    const glow = new THREE.PointLight(0xffd36b, 0, 6); compass.add(glow);
    compass.position.set(13, 0.8, -12); compass.visible = false; G.levelGroup.add(compass);
    game.cutscene(async (S) => {
      G.audio.playSong('title');
      S.cam(new V3(-1.5, 5.5, 15), new V3(-9, 1.2, 7), 1, true);
      await S.caption('Saturday morning', "The D'Elia house");
      G.audio.playSong('hub');
      S.cam(new V3(-4, 3, 12.5), new V3(-8.5, 1.4, 7), 2);
      await S.say('frank', "Okay. It's the weekend. I'm thinking... adventure.");
      S.cam(new V3(-8.5, 2.2, 10.5), new V3(-10, 1.3, 7.4), 2.5);
      await S.say('luca', 'Chess tournament. Or coding. Or karate. Or the Cunningham trails. Actually, all of them.');
      S.cam(new V3(-9, 2, 13.5), new V3(-11.8, 1.0, 10.6), 2.5);
      await S.say('ludo', 'I drew an entire world. It has a volcano. Made of pizza.');
      S.cam(new V3(-4, 2.4, 7.5), new V3(-6.2, 1.4, 5.2), 2.5);
      await S.say('elba', 'Before anyone goes anywhere: shoes, breakfast, and where is the dog?');
      // Luigi dashes through with a sock
      const L = c.luigi; L.action = 'hold'; L.zoom = 6; hub.luigiSock = true;
      S.walk(L, new V3(-9.5, 0, 3.5));
      S.cam(new V3(-4, 3.5, 11), new V3(-9.5, 0.6, 3), 3);
      await S.wait(0.7);
      S.walk(L, new V3(-3, 0, 4)); S.walk(L, new V3(-3, 0, 4));
      await S.say('frank', 'Is that... my sock?');
      await S.say('luigi', '*it is absolutely his sock*');
      S.walk(L, new V3(-10.5, 0, -2));
      c.frank.action = 'point'; c.frank.actionT = 0;
      await S.say('elba', 'LUIGI. Drop it.');
      await S.wait(0.3);
      if (!S.skipping) await G.fade(true);
      L.zoom = 0; hub.luigiSock = false; L.scriptTarget = null;
      place('frank', 11.4, -9.2, 2.6); place('elba', 13.2, -8.6, PI); place('luca', 15, -9.6, -2.4); place('ludo', 12.1, -10.1, PI * 0.95); place('luigi', 13, -10.5, PI, 'beg');
      hub.trunkLid.rotation.x = -1.2; compass.visible = true; glow.intensity = 0.8;
      S.cam(new V3(13, 3.6, -5.8), new V3(13, 1.0, -11.5), 2, true);
      if (!S.skipping) await G.fade(false);
      await S.say('ludo', 'Whoa. He knocked open the old travel box.');
      await S.say('elba', 'I packed that box on our very first trip. But what is THAT?');
      compass.userData.rise = true;
      S.cam(new V3(13, 2.6, -8.2), new V3(13, 1.6, -12), 2);
      await S.say('frank', "'The Adventure Compass.' It's... pointing at all of us?");
      await S.say('luca', "Every trip we've ever taken is in there. And some we haven't taken yet.");
      L.action = 'beg'; L.actionT = 0;
      await S.say('luigi', '*boop*');
      // CRACK
      G.audio.play('crack'); G.flash(); G.cam.shake = 1.2; compass.visible = false;
      for (let i = 0; i < 9; i++) G.burst(compass.position.clone(), 0xffd36b, 3, { speed: 9, size: 0.25, life: 1.4 });
      G.ORDER.forEach((id) => { if (!c[id].dog) { c[id].action = 'surprised'; c[id].actionT = 0; } }); L.action = null;
      await S.wait(0.8);
      showGlitch(new V3(13, 2.6, -12));
      S.cam(new V3(13, 2.8, -7.5), new V3(13, 2.5, -12), 3);
      await S.say('glitch', 'Hiii! Oooh. Memories! Pizza! Chess! Mountains! Tiny karate belts!');
      await S.say('glitch', "I'm the Glitch. I mix things up. It's kind of my whole deal.");
      await S.say('glitch', 'These shiny pieces are MINE now. Wanna play? Come find them!');
      G.audio.play('glitch'); hideGlitch();
      for (let i = 0; i < 9; i++) G.burst(new V3(13, 2, -12), [0xffd36b, 0xff3fa4, 0x36e0ff][i % 3], 4, { speed: 14, size: 0.2, life: 1.2, gravity: -2 });
      await S.say('frank', 'So... that happened.');
      await S.say('luca', 'Luigi. This is technically your fault.');
      await S.say('luigi', '*sits. Offers a paw. As an apology.*');
      await S.say('elba', 'Okay. New plan. We get every piece back. Together.');
      await S.say('ludo', 'Um. Guys? The back door is glowing.');
      hub.trunkLid.rotation.x = 0;
      if (!S.skipping) await G.fade(true);
      placeHubStart(); c.frank.pos.set(-4.5, 0, 11); c.frank.facing = 0;
      S.cam(new V3(-6, 2.8, 9), new V3(-3.75, 1.6, 16), 2, true);
      if (!S.skipping) await G.fade(false);
      await S.say('frank', "Everyone grab your shoes. We're going into the backyard.");
      await S.say('elba', 'Just the backyard. How hard can it be?');
      compass.visible = false;
    }, () => {
      G.save.intro = true; game.persist(); hub.sock.visible = true;
      placeHubStart(); setActive('frank', true); G.chars.frank.pos.set(-4.5, 0, 11); G.chars.frank.facing = PI;
      G.cam.yaw = 0; G.cam.pitch = 0.5; G.cam.snapNext = true;
      setObjective(G.levels.hub.objective());
      G.toast('Explore the house', 'The glowing back door leads to World 1', 4);
      setTimeout(() => G.bubble('frank', 'Tip: switch between us with 1 to 5. Everyone has a power on F.', 4.5), 1500);
    });
    game.introCompass = compass;
  }

  // ---------- abilities ----------
  function abilityPressed(ch) {
    const L = game.level;
    if (ch.id === 'frank') pizzaToss(ch);
    else if (ch.id === 'elba') planMode(ch);
    else if (ch.id === 'luca') {
      const t = L.karateTarget && L.karateTarget(ch);
      if (t) startKarate(ch);
      else {
        ch.action = 'chop'; ch.actionT = 0; G.audio.play('kiai');
        const fp = ch.pos.clone().add(new V3(Math.sin(ch.facing) * 1.2, 1.1, Math.cos(ch.facing) * 1.2));
        G.ring(fp, 0x4a74ff, { size: 1.4, dur: 0.3, vertical: true, yaw: ch.facing });
        if (L.onChop) L.onChop(fp);
        if (L.mower && L.state.boss === 'fight' && L.mower.state === 'tangled' && L.panelPos().distanceTo(ch.pos) < 3) L.hitMower(ch);
      }
    } else if (ch.id === 'ludo') {
      const t = L.drawTarget && L.drawTarget(ch);
      if (t) L.doDraw(ch);
      else doodle(ch);
    } else if (ch.id === 'luigi') bark(ch);
  }
  function bark(ch) {
    if (ch.barkCd > 0) return; ch.barkCd = 0.45;
    ch.action = 'bark'; ch.actionT = 0; G.audio.play('bark', { count: 2 });
    const p = ch.pos.clone().add(new V3(Math.sin(ch.facing) * 0.6, 0.8, Math.cos(ch.facing) * 0.6));
    G.ring(p, 0xffe14a, { size: 5, dur: 0.55, vertical: true, yaw: ch.facing }); G.ring(p, 0xffffff, { size: 3, dur: 0.4 });
    if (game.level.onBark) game.level.onBark(ch.pos.clone(), ch);
    if (Math.random() < 0.08) G.bubble(['frank', 'elba', 'luca', 'ludo'][(Math.random() * 4) | 0], ['Inside voice, Luigi.', 'Good bark. Great bark.', 'That one was aggressive.', 'WOOF!'][(Math.random() * 4) | 0], 2);
  }
  function pizzaToss(ch) {
    if (ch.tossCd > 0) return; ch.tossCd = 0.6;
    ch.action = 'throw'; ch.actionT = 0; G.audio.play('whoosh');
    if (game.doughs.length >= 2) removeDough(game.doughs[0]);
    const m = new THREE.Group(); const d = G.mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.22, 24), 0xf3e3c0); m.add(d);
    const crust = G.mesh(new THREE.TorusGeometry(1.15, 0.14, 8, 24), 0xe8c48a); crust.rotation.x = PI / 2; m.add(crust);
    const sauce = G.mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.24, 20), 0xd8402c); m.add(sauce); sauce.visible = false;
    const start = ch.pos.clone().add(new V3(Math.sin(ch.facing) * 0.6, 1.5, Math.cos(ch.facing) * 0.6));
    m.position.copy(start); m.scale.setScalar(0.4); G.levelGroup.add(m);
    const dough = { m, pos: m.position, vel: new V3(Math.sin(ch.facing) * 8 + ch.vel.x * 0.4, 5.5, Math.cos(ch.facing) * 8 + ch.vel.z * 0.4), landed: false, life: 14, col: null, wob: 0 };
    game.doughs.push(dough);
    if (!game.saidDough) { game.saidDough = true; setTimeout(() => G.bubble('frank', 'Pizza dough trampoline. Bounce on it!', 3), 600); }
  }
  function removeDough(d) { G.levelGroup.remove(d.m); if (d.col) G.removeCol(d.col); game.doughs.splice(game.doughs.indexOf(d), 1); }
  function updateDoughs(dt) {
    for (const d of game.doughs.slice()) {
      d.life -= dt; if (d.life <= 0) { G.burst(d.pos.clone(), 0xf3e3c0, 8, { speed: 3 }); removeDough(d); continue; }
      if (!d.landed) {
        const prevY = d.pos.y; d.vel.y -= 20 * dt; d.pos.addScaledVector(d.vel, dt); d.m.rotation.y += dt * 14; d.m.scale.setScalar(Math.min(1, d.m.scale.x + dt * 2.5));
        let top = G.groundAt(d.pos.x, d.pos.z); top = top === null ? -Infinity : top;
        for (const c of G.cols) { if (!c.active || c.bouncy || (c.imaginary && !G.imaginationOn)) continue; if (d.pos.x > c.min.x && d.pos.x < c.max.x && d.pos.z > c.min.z && d.pos.z < c.max.z && c.max.y <= prevY + 0.05 && c.max.y > top) top = c.max.y; }
        if (d.pos.y <= top) {
          d.landed = true; d.pos.y = top + 0.12; d.m.scale.setScalar(1);
          d.col = G.addCol(d.pos.x - 1.25, top, d.pos.z - 1.25, d.pos.x + 1.25, top + 0.25, d.pos.z + 1.25, { bouncy: 16.5 });
          d.col.onBounceFx = () => { d.wob = 1; G.burst(d.pos.clone(), 0xf3e3c0, 6, { speed: 3, size: 0.1 }); };
          G.audio.play('land'); G.burst(d.pos.clone(), 0xf3e3c0, 10, { speed: 3, size: 0.12 });
        } else if (d.pos.y < -3) { G.audio.play('splash'); removeDough(d); if (Math.random() < 0.5) G.bubble('frank', 'That was a good dough. Rest in pizza.', 2.5); }
      } else { d.wob = G.damp(d.wob, 0, 5, dt); d.m.scale.set(1 + d.wob * 0.25, 1 - d.wob * 0.6, 1 + d.wob * 0.25); if (d.life < 2) d.m.visible = Math.sin(d.life * 20) > 0; }
    }
  }
  game.doughsList = () => game.doughs;
  function planMode(ch) {
    if ((ch.planCd || 0) > 0) { G.bubble('elba', 'Still planning. One second.', 1.5); return; }
    ch.planCd = 10; game.planT = 6; G.worldScale = 0.25; G.audio.play('plan'); ch.action = 'plan'; ch.actionT = 0;
    $('overlay-tint').className = 'plan'; game.setModeLabel('PLAN MODE');
    if (!game.saidPlan) { game.saidPlan = true; G.bubble('elba', 'Everyone stop. Everything slows down. Now we move.', 3); }
  }
  function doodle(ch) {
    if ((ch.drawCd || 0) > 0) return; ch.drawCd = 3; ch.action = 'draw'; ch.actionT = 0; G.audio.play('draw');
    const tex = G.canvasTex(128, 128, (c) => { c.strokeStyle = '#222'; c.lineWidth = 5; c.lineCap = 'round'; c.fillStyle = '#fff'; c.beginPath(); c.ellipse(64, 76, 34, 22, 0, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.arc(96, 48, 18, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.moveTo(40, 96); c.lineTo(36, 118); c.moveTo(84, 96); c.lineTo(88, 118); c.moveTo(30, 70); c.lineTo(10, 58); c.stroke(); c.fillStyle = '#222'; c.beginPath(); c.arc(100, 44, 3, 0, 7); c.fill(); c.fillStyle = '#ff5d73'; c.fillRect(104, 56, 8, 10); });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true })); sp.scale.set(1.3, 1.3, 1);
    const pos = ch.pos.clone().add(new V3(Math.sin(ch.facing) * 1.5, 0.7, Math.cos(ch.facing) * 1.5)); sp.position.copy(pos); G.levelGroup.add(sp);
    game.doodle = { sp, pos: sp.position, dir: ch.facing, t: 4, alive: true };
    G.burst(pos, 0xfff4dc, 10, { speed: 3 });
    if (Math.random() < 0.6) G.bubble('ludo', ['I drew a distraction!', 'Meet Sketch-Luigi.', 'He is fast. He is paper.'][(Math.random() * 3) | 0], 2);
  }
  function updateDoodle(dt) {
    const d = game.doodle; if (!d || !d.alive) return;
    d.t -= dt; d.pos.x += Math.sin(d.dir) * dt * 4; d.pos.z += Math.cos(d.dir) * dt * 4; d.pos.y = 0.7 + Math.abs(Math.sin(G.time * 10)) * 0.3; d.dir += Math.sin(G.time * 2) * dt;
    if (d.t <= 0) { d.alive = false; G.burst(d.pos.clone(), 0xfff4dc, 12, { speed: 3 }); G.levelGroup.remove(d.sp); }
  }

  // ---------- karate mini-game ----------
  let karate = null;
  function startKarate(ch) {
    game.mode = 'karate'; karate = { ch, s: 1, speed: 0.85, misses: 0, cool: 0 };
    ch.facing = PI; ch.vel.set(0, 0, 0); $('karate').hidden = false; ch.action = 'kata'; ch.actionT = 0;
    G.cam.override = { pos: ch.pos.clone().add(new V3(3.2, 2.2, 3.5)), look: new V3(0, 2, -80), speed: 4 };
    $('kBoards').textContent = `Boards left: ${game.level.state.boards}`;
    if (!game.saidKarate) { game.saidKarate = true; G.bubble('luca', 'Breathe. Focus. Strike when the ring hits the circle.', 3.5); }
  }
  function updateKarate(dt) {
    const k = karate; if (!k) return;
    k.cool -= dt; k.s -= dt * k.speed * (k.misses >= 2 ? 0.6 : 1);
    if (k.s < 0.25) k.s = 1;
    $('kRing').style.width = $('kRing').style.height = (220 * k.s) + 'px';
    const strike = G.btnDown('ability') || G.btnDown('jump') || G.btnDown('interact') || game.clickStrike;
    game.clickStrike = false;
    if (strike && k.cool <= 0) {
      k.cool = 0.25;
      if (k.s > 0.34 && k.s < 0.52) {
        G.audio.play('kiai'); G.audio.play('break'); G.cam.shake = 0.5; k.ch.action = 'chop'; k.ch.actionT = 0; G.flash();
        game.level.onKarateSuccess(); k.s = 1; k.speed += 0.15;
        $('kBoards').textContent = `Boards left: ${game.level.state.boards}`;
        if (game.level.state.boards <= 0) endKarate();
      } else { G.audio.play('miss'); k.misses++; k.s = 1; G.bubble('luca', ['Focus.', 'Breathe first.', 'Again. Slower.'][k.misses % 3], 1.5); if (k.misses === 2) G.toast('Hint', 'The ring is slower now. Press F when it touches the blue circle.'); }
    }
    if (G.btnDown('pause')) endKarate();
  }
  function endKarate() { $('karate').hidden = true; karate = null; game.mode = 'play'; G.cam.override = null; }
  $('karate').addEventListener('click', () => (game.clickStrike = true));

  // ---------- vision (hold Q) ----------
  function startVision(ch) {
    ch.vision = true; const L = game.level;
    if (ch.id === 'luigi') { $('overlay-tint').className = 'scent'; ch.action = 'sniff'; ch.actionT = 0; G.audio.play('sniff'); game.setModeLabel('SCENT TRAIL'); }
    if (ch.id === 'luca') { $('overlay-tint').className = 'chess'; L.chessVision && L.chessVision(true); game.setModeLabel('CHESS VISION'); }
    if (ch.id === 'ludo') { $('overlay-tint').className = 'imagine'; G.imaginationOn = true; game.setModeLabel('IMAGINATION'); }
    if (ch.id === 'elba') { $('overlay-tint').className = ''; game.setModeLabel('FAMILY RADAR'); }
    if (ch.id === 'frank') {
      $('overlay-tint').className = 'dad'; game.setModeLabel('DAD INSTINCT'); G.ring(ch.pos.clone().add(new V3(0, 0.2, 0)), 0xf0b429, { size: 18, dur: 1.1 });
      const spots = (L.dadSpots && L.dadSpots()) || []; let found = false;
      spots.forEach((s) => { if (s.pos.distanceTo(ch.pos) < 20) { found = true; G.burst(s.pos.clone().add(new V3(0, 1.5, 0)), 0xf0b429, 30, { speed: 5, life: 1.4 }); G.ring(s.pos.clone().add(new V3(0, 0.2, 0)), 0xf0b429, { size: 3, dur: 1 }); if (!ch.dadCd || ch.dadCd <= 0) { G.bubble('frank', s.line, 3.5); ch.dadCd = 6; } } });
      if (!found && (!ch.dadCd || ch.dadCd <= 0)) { G.bubble('frank', ['Nothing. My instincts are resting.', 'Hm. Not here. But close. Probably.', 'I sense... a snack. Somewhere.'][(Math.random() * 3) | 0], 2.5); ch.dadCd = 4; }
    }
  }
  function endVision(ch) {
    if (!ch || !ch.vision) return; ch.vision = false; const L = game.level;
    if (game.planT <= 0) $('overlay-tint').className = '';
    if (ch.id === 'luca' && L.chessVision) L.chessVision(false);
    if (ch.id === 'ludo') G.imaginationOn = false;
    if (ch.id === 'luigi' && ch.action === 'sniff') ch.action = null;
    game.setModeLabel(game.planT > 0 ? 'PLAN MODE' : ''); $('radar').innerHTML = '';
  }
  function updateVision(ch, dt) {
    const L = game.level;
    if (ch.id === 'luigi') {
      ch.action = 'sniff'; ch.actionT = 0.2;
      const targets = (L.scentTargets && L.scentTargets()) || [];
      let best = null, bd = 70; targets.forEach((t) => { const d = t.distanceTo(ch.pos); if (d < bd) { bd = d; best = t; } });
      if (best) {
        for (let i = 0; i < 3; i++) {
          const u = Math.random(); const p = ch.pos.clone().lerp(best, u); p.y += 0.5 + Math.sin(u * 20 + G.time * 4) * 0.3; p.x += Math.sin(u * 12 + G.time * 3) * 0.4;
          G.burst(p, u > 0.9 ? 0xfff0a0 : 0xffb347, 1, { speed: 0.4, size: 0.1, life: 1.1, gravity: -0.6, shrink: true });
        }
        game.scentPulse = (game.scentPulse || 0) - dt; if (game.scentPulse < 0) { game.scentPulse = 0.7; G.ring(best.clone().add(new V3(0, 0.1, 0)), 0xffb347, { size: 1.8, dur: 0.7 }); }
      }
    }
    if (ch.id === 'elba') {
      const pins = [];
      G.ORDER.forEach((id) => { if (id !== ch.id) pins.push({ p: G.chars[id].pos.clone().add(new V3(0, 2, 0)), label: G.CHAR_INFO[id].name, c: G.CHAR_INFO[id].color }); });
      const op = L.objectivePos && L.objectivePos(); if (op) pins.push({ p: op.clone().add(new V3(0, 1.5, 0)), label: 'Objective', c: '#e2ac3f' });
      const w = innerWidth, h = innerHeight;
      $('radar').innerHTML = pins.map((pin) => {
        const v = pin.p.clone().project(G.camera); let x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
        if (v.z > 1) { x = w - x; y = h - 60; }
        x = G.clamp(x, 60, w - 60); y = G.clamp(y, 90, h - 120);
        const d = Math.round(pin.p.distanceTo(ch.pos));
        return `<div class="radar-pin" style="left:${x}px;top:${y}px;--c:${pin.c}">${pin.label} · ${d}m</div>`;
      }).join('');
    }
  }

  // ---------- damage, falling, regroup ----------
  game.hurt = function (ch, from, type) {
    if (ch.invuln > 0 || game.mode !== 'play') return;
    ch.invuln = 1.5; game.hearts--; G.audio.play(type === 'splash' ? 'splash' : 'hurt'); G.cam.shake = 0.4;
    const away = ch.pos.clone().sub(from); away.y = 0; away.normalize();
    ch.vel.set(away.x * 10, 7, away.z * 10); ch.onGround = false;
    if (type === 'splash') { G.burst(ch.pos.clone().add(new V3(0, 1, 0)), 0x9fdcff, 16, { speed: 5 }); G.bubble(ch.id, { frank: 'Cold! Cold cold cold.', elba: 'Absolutely not.', luca: 'That was a timing error.', ludo: "I'm a fish now.", luigi: '*this is the best day of his life*' }[ch.id], 2); }
    else G.bubble(ch.id, { frank: 'Ow! My ankles!', elba: 'Hey!', luca: 'Not in the rulebook!', ludo: 'Aaah!', luigi: '*yelp*' }[ch.id], 1.6);
    if (game.hearts <= 0) setTimeout(() => respawn(ch, true), 500);
    game.fails++; maybeHint();
  };
  function respawn(ch, fromHearts) {
    const L = game.level; const p = L.respawnPoint ? L.respawnPoint(ch.pos) : L.spawn.pos.clone();
    ch.pos.copy(p); ch.vel.set(0, 0, 0); ch.invuln = 1.2; game.hearts = 3; G.cam.snapNext = true;
    G.burst(p.clone().add(new V3(0, 1, 0)), 0x9dff5c, 16, { speed: 4 });
    if (fromHearts) G.toast('Back on your feet', 'Hearts refilled. Progress kept.');
  }
  function maybeHint() {
    const L = game.level; if (!L || L.id !== 'world1') return; const s = L.state; const a = G.chars[game.activeId];
    if (game.fails % 3 !== 0) return;
    let h = null;
    if (!s.bridge && a.pos.z < -40 && a.pos.z > -60) h = 'Switch to Ludo (4) and press F at the pencil outline to draw a bridge.';
    else if (a.pos.x > 8 && a.pos.z < -58 && a.pos.z > -76) h = "Switch to Luca (3) and hold Q. Chess Vision shows the knight's path in gold.";
    else if (s.boss === 'fight') h = 'Run in circles near a green hose coil. When the mower jams, press E at the glowing panel on its back. Elba\'s Plan Mode (F) slows it.';
    else if (a.pos.z < -84 && a.pos.z > -106 && !s.sprinklerOff) h = "Elba's Plan Mode (F) slows the sprinkler. Or switch to Luigi and shake the tangled hose (E).";
    if (h) G.toast('Hint', h, 5);
  }
  function regroup(pos, instant) {
    const slots = [new V3(-1.6, 0, 1.4), new V3(1.6, 0, 1.4), new V3(-2.8, 0, 2.6), new V3(2.8, 0, 2.6)]; let k = 0;
    G.ORDER.forEach((id) => { if (id === game.activeId) return; const c = G.chars[id]; c.pos.copy(pos).add(slots[k++ % 4]); c.vel.set(0, 0, 0); if (!instant) G.burst(c.pos.clone().add(new V3(0, 1, 0)), 0xffffff, 8, { speed: 3 }); });
  }
  game.regroup = regroup;

  // ---------- followers in worlds ----------
  const SLOTS = [new V3(-1.5, 0, -1.8), new V3(1.5, 0, -1.8), new V3(-2.6, 0, -3.4), new V3(2.6, 0, -3.4)];
  function updateFollowers(dt) {
    const L = game.level; const lead = G.chars[game.activeId]; let k = 0;
    const gate = L.followTarget ? L.followTarget(lead) : null;
    for (const id of G.ORDER) {
      if (id === game.activeId) continue;
      const c = G.chars[id]; const slot = SLOTS[k++ % 4];
      // boss fight: cheer from the side
      if (L.state && L.state.boss === 'fight') {
        const spot = L.arenaC.clone().add(new V3((k - 2.5) * 3, 0, 19));
        const d = G.aiFollow(c, dt, spot, 0.5);
        if (d > 20) { c.pos.copy(spot); c.vel.set(0, 0, 0); }
        if (d < 1 && !c.dog && Math.random() < 0.004) { c.action = 'cheer'; c.actionT = 0; }
        if (d < 1) c.facing = G.angleLerp(c.facing, Math.atan2(L.mower.g.position.x - c.pos.x, L.mower.g.position.z - c.pos.z), dt * 3);
        continue;
      }
      let target;
      const ov = L.aiOverride && L.aiOverride(c);
      const sq = c.dog && L.squirrelChase ? L.squirrelChase.g.position : null;
      if (ov) target = ov; else if (sq) target = sq;
      else if (gate) target = gate.wait.clone().add(new V3(slot.x, 0, -slot.z * 0.6));
      else { const rot = lead.facing; target = lead.pos.clone().add(new V3(slot.x * Math.cos(rot) + slot.z * Math.sin(rot), 0, -slot.x * Math.sin(rot) + slot.z * Math.cos(rot))); }
      const d = G.aiFollow(c, dt, target, ov ? 0.4 : 1.2);
      if (c.dog && ov && d < 0.8) { c.action = 'sit'; } else if (c.dog && c.action === 'sit' && !ov) c.action = null;
      if (d > 18 || c.pos.y < (L.killY || -3) + 0.5) {
        c.pos.copy(target); if (G.groundAt(c.pos.x, c.pos.z) === null) c.pos.copy(gate ? gate.wait : lead.pos); c.vel.set(0, 0, 0);
        G.burst(c.pos.clone().add(new V3(0, 1, 0)), 0xffffff, 6, { speed: 2 });
      }
    }
  }

  // ---------- pause ----------
  function openPause() {
    if (game.mode !== 'play') return;
    game.mode = 'paused'; if (document.exitPointerLock && G.input.locked) document.exitPointerLock();
    $('pause').hidden = false; $('resetConfirm').hidden = true;
    $('pauseWhere').textContent = game.level.name + ' · ' + (G.save.frags ? 'Chapter 1 complete' : 'Chapter 1');
    const got = G.save.got;
    const cells = [['Compass fragments', `${G.save.frags} / 9`], ['Family photos', `${count(['w1_photo1', 'w1_photo2', 'w1_photo3'])} / 3`], ['Luigi treasures', `${count(['w1_treasure1', 'w1_treasure2', 'w1_treasure3'])} / 3`], ['Chess pieces', `${got.w1_knight ? 1 : 0} / 1`], ['Travel stamps', `${got.w1_stamp ? 1 : 0} / 1`], ['Pizza toppings', `${count(['w1_pepperoni', 'w1_basil'])} / 2`], ['Sparks', `${G.save.sparks}`], ['Achievements', `${Object.keys(G.save.ach).length + (got.w1_zoomies ? 1 : 0)}`]];
    $('collGrid').innerHTML = cells.map(([a, b]) => `<div class="cell"><div class="n">${b}</div>${a}</div>`).join('');
    $('memories').innerHTML = MEMORIES.map(([id, t]) => `<div class="m${got[id] ? '' : ' locked'}">${got[id] ? t : 'A family photo is hiding somewhere in the backyard.'}</div>`).join('');
    renderCostumes();
  }
  function renderCostumes() {
    $('costumes').innerHTML = G.ORDER.map((id) => {
      const ch = G.chars[id]; const u = G.save.unlocked[id] || [0];
      return `<div class="costume" style="--c:${G.CHAR_INFO[id].color}"><b>${G.CHAR_INFO[id].name}</b><div class="opts">${ch.costumes.map((c, i) => `<button data-id="${id}" data-i="${i}" class="${ch.costume === i ? 'on' : ''}" ${u.includes(i) ? '' : 'disabled'} title="${u.includes(i) ? c.name : 'Locked: ' + (c.unlock || '')}">${u.includes(i) ? c.name : '🔒 ' + (c.unlock || c.name)}</button>`).join('')}</div></div>`;
    }).join('');
    $('costumes').querySelectorAll('button').forEach((b) => (b.onclick = () => { const id = b.dataset.id, i = +b.dataset.i; G.setCostume(G.chars[id], i); G.save.costume[id] = i; game.persist(); G.audio.play('ui'); renderCostumes(); }));
  }
  function closePause() { $('pause').hidden = true; game.mode = 'play'; }
  $('btnResume').onclick = closePause;
  $('btnHome').onclick = () => { closePause(); if (game.level.id !== 'hub') game.goHome(() => setObjective(G.levels.hub.objective())); };
  $('btnMute').onclick = () => { G.save.muted = !G.save.muted; G.audio.setMuted(G.save.muted); updateMuteBtn(); game.persist(); };
  const updateQualityBtn = () => { $('btnQuality').textContent = 'Graphics: ' + (G.quality === 'high' ? 'high' : 'fast'); };
  $('btnQuality').onclick = () => { G.setQuality(G.quality === 'high' ? 'fast' : 'high'); G.perfLocked = true; updateQualityBtn(); };
  setInterval(updateQualityBtn, 1000);
  function updateMuteBtn() { $('btnMute').textContent = G.save.muted ? 'Sound: off' : 'Sound: on'; }
  $('btnReset').onclick = () => { $('resetConfirm').hidden = false; };
  $('btnResetYes').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.reload(); };
  document.addEventListener('pointerlockchange', () => { if (!G.input.locked && game.mode === 'play' && game.wantPauseOnUnlock) openPause(); });

  // ---------- main loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!G.manual) tick(dt, true);
    requestAnimationFrame(frame);
  }
  G.tick = (dt, render) => tick(dt, render);
  function tick(dt, render) {
    G.pollInput();
    const mode = game.mode;
    if (mode !== 'paused') G.time += dt;
    if (G.props && G.props.wind) G.props.wind.value = G.time;
    // global keys
    if (G.btnDown('mute')) { G.save.muted = !G.save.muted; G.audio.setMuted(G.save.muted); updateMuteBtn(); }
    if (mode === 'paused' && G.btnDown('pause')) closePause();
    else if (mode === 'play' && G.btnDown('pause')) openPause();
    if (mode === 'cutscene') { if (G.btnDown('advance')) advance(); updateTyping(dt); }
    const act = G.chars[game.activeId];
    if (mode !== 'paused' && mode !== 'title') {
      for (const c of G.cols) c.delta.set(0, 0, 0);
      if (game.level) game.level.update(dt, mode);
      if (mode === 'play') controlActive(act, dt);
      else if (mode === 'karate') { updateKarate(dt); G.moveChar(act, dt, { x: 0, z: 0 }, false, false, false); }
      // other characters
      for (const id of G.ORDER) {
        const c = G.chars[id]; if (id === game.activeId && mode !== 'cutscene') continue;
        if (mode === 'cutscene' || mode === 'transition') {
          if (c.scriptTarget) { const d = G.aiFollow(c, dt, c.scriptTarget, 0.3); if (d < 0.5) c.scriptTarget = null; }
          else if (id !== game.activeId || mode === 'cutscene') G.moveChar(c, dt, { x: 0, z: 0 }, false, false, false);
        } else if (game.level.followers && (mode === 'play' || mode === 'karate')) { /* handled below */ }
        if (c.zoom > 0 && id !== game.activeId) c.zoom -= dt;
      }
      if (game.level.followers && (mode === 'play' || mode === 'karate')) updateFollowers(dt);
      // sock in Luigi's mouth during the intro
      if (G.levels.hub.luigiSock && game.level.id === 'hub') { const hp = new V3(); G.chars.luigi.muzzle.getWorldPosition(hp); G.levels.hub.sock.visible = true; G.levels.hub.sock.position.set(hp.x, hp.y - 0.12, hp.z); }
      if (game.introCompass && game.introCompass.userData.rise && game.introCompass.visible) { game.introCompass.position.y = G.damp(game.introCompass.position.y, 2.0, 2, dt); game.introCompass.rotation.y += dt * 2; game.introCompass.rotation.x = 0.8; }
      updateDoughs(dt); updateDoodle(dt);
      for (const id of G.ORDER) { const c = G.chars[id]; G.animateChar(c, dt); if (c.invuln > 0) { c.invuln -= dt; c.root.visible = id !== game.activeId || Math.sin(G.time * 30) > -0.3; } else c.root.visible = true; }
      if (G.chars.glitch && G.glitch.visible) { G.glitch.update(dt); G.glitch.appearT += dt; G.glitch.root.scale.setScalar(Math.min(1, G.glitch.appearT * 3)); G.glitch.root.position.y += Math.sin(G.time * 2) * 0.004; }
      // plan mode timer
      if (game.planT > 0) { game.planT -= dt; if (game.planT <= 0) { G.worldScale = 1; if (!act.vision) $('overlay-tint').className = ''; game.setModeLabel(''); } }
      G.ORDER.forEach((id) => { const c = G.chars[id]; ['planCd', 'drawCd', 'tossCd', 'barkCd', 'dadCd', 'zoomCd'].forEach((k) => { if (c[k] > 0) c[k] -= dt; }); });
      if (game.sparkComboT > 0) { game.sparkComboT -= dt; if (game.sparkComboT <= 0) game.sparkCombo = 0; }
    }
    G.updateParticles(dt); G.updateRings(dt); G.updateBubbles(dt); G.updateToast(dt);
    G.cam.fov = act && act.zoom > 0 ? 62 : 50;
    // dynamic FOV: widen a little with speed, pull in when standing still
    G.cam.fovKick = act ? G.damp(G.cam.fovKick || 0, Math.min(1, Math.hypot(act.vel.x, act.vel.z) / 8) * 6 + (act.onGround ? 0 : 1.5), 3, dt) : 0;
    G.updateCamera(dt, act);
    if (game.level && act) G.updateFades(dt, act.pos);
    if (act) { const sd = G.sunDir || new V3(-0.45, 0.62, 0.5); const fx = Math.round(act.pos.x / 2) * 2, fz = Math.round(act.pos.z / 2) * 2; G.sun.target.position.set(fx, act.pos.y, fz); G.sun.position.set(fx + sd.x * 80, act.pos.y + sd.y * 80, fz + sd.z * 80); }
    if (render) G.trackPerf(dt);
    if (render) G.renderFrame();
    if (mode === 'play' || mode === 'karate') updateHUD();
    G.endInput();
  }

  function controlActive(ch, dt) {
    // switching
    for (let i = 1; i <= 5; i++) if (G.btnDown('c' + i) && G.ORDER[i - 1] !== game.activeId) { setActive(G.ORDER[i - 1]); return; }
    if (G.btnDown('switch')) { cycleActive(1); return; }
    if (G.btnDown('prev')) { cycleActive(-1); return; }
    if (G.btnDown('costume')) {
      const u = (G.save.unlocked[ch.id] || [0]).slice().sort((a, b) => a - b); const i = u.indexOf(ch.costume); const n = u[(i + 1) % u.length];
      G.setCostume(ch, n); G.save.costume[ch.id] = n; game.persist(); G.toast(ch.costumes[n].name, u.length > 1 ? 'Costume' : 'Find collectibles to unlock more costumes', 1.6); G.audio.play('ui');
      G.burst(ch.pos.clone().add(new V3(0, 1, 0)), 0xffffff, 10, { speed: 3 });
    }
    // movement relative to camera
    const mv = G.moveVec(); const yaw = G.cam.yaw;
    const inp = { x: -Math.sin(yaw) * mv.y + Math.cos(yaw) * mv.x, z: -Math.cos(yaw) * mv.y - Math.sin(yaw) * mv.x };
    // zoomies
    if (ch.id === 'luigi' && G.btnDown('dash') && !(ch.zoomCd > 0)) {
      ch.zoom = 4; ch.zoomCd = 8.5; G.audio.play('bark', { count: 3, small: true }); G.audio.play('whoosh');
      const who = ['frank', 'elba', 'luca', 'ludo'][(Math.random() * 4) | 0];
      G.bubble(who, ["He's got the zoomies!", 'LUIGI!', 'Here we go again.', 'ZOOMIES!'][(Math.random() * 4) | 0], 2);
      if (game.level.id === 'world1' && !game.level.state.zoom) G.game.achieve('zoom1', 'First zoomies', 'Luigi has entered the chat');
    }
    if (ch.zoom > 0) { ch.zoom -= dt; if (Math.random() < 0.03) G.audio.play('bark', { count: 1, small: true }); }
    G.moveChar(ch, dt, inp, G.btnDown('jump'), G.btn('jump'), G.btn('dash'));
    // abilities
    if (G.btnDown('ability')) abilityPressed(ch);
    if (G.btn('vision')) { if (!ch.vision) startVision(ch); updateVision(ch, dt); } else if (ch.vision) endVision(ch);
    // interact
    const near = G.nearestInteract(ch);
    const pr = $('prompt');
    if (near) { pr.hidden = false; pr.innerHTML = `<kbd>${G.input.lastDevice === 'pad' ? 'X' : 'E'}</kbd>${near.label}`; if (G.btnDown('interact')) near.it.onUse(ch); }
    else pr.hidden = true;
    G.updateTriggers(ch);
    // falling out of the world
    const L = game.level;
    if (ch.pos.y < (L.killY ?? -5)) {
      G.audio.play('splash'); G.burst(ch.pos.clone().setY(-0.5), 0x9fdcff, 20, { speed: 6, upBias: 4 });
      respawn(ch, false); game.fails++; maybeHint();
      G.bubble(ch.id, { frank: 'Nobody saw that.', elba: 'I meant to do that.', luca: 'Recalculating.', ludo: 'Splash!', luigi: '*shakes off. Directly onto everyone.*' }[ch.id], 2);
      if (ch.dog) { ch.action = 'shake'; ch.actionT = 0; }
    }
  }

  // stop page scroll on space etc
  window.addEventListener('keydown', (e) => { if (e.code === 'Tab') e.preventDefault(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
