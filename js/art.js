// Art library: procedural PBR texture sets and an object-anchored triplanar material, so every surface in the game gets
// real micro-detail (grain, weave, pores, mortar) with correct scale, no UV stretching on scaled primitives, and PBR response.
(function () {
  const G = window.G;
  const A = (G.art = {});

  // ---------- tileable noise on the CPU ----------
  function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
  function vnoise(x, y, p, s) { // periodic value noise, period p
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const m = (a) => ((a % p) + p) % p;
    const a = hash2(m(xi), m(yi), s), b = hash2(m(xi + 1), m(yi), s), c = hash2(m(xi), m(yi + 1), s), d = hash2(m(xi + 1), m(yi + 1), s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, p, oct = 4, s = 1) { let t = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { t += a * vnoise(x * f, y * f, p * f, s + i * 17); n += a; a *= 0.5; f *= 2; } return t / n; }
  function cellular(x, y, p, s) { // distance to nearest feature point (periodic)
    const xi = Math.floor(x), yi = Math.floor(y); let best = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = xi + i, cy = yi + j; const mx = ((cx % p) + p) % p, my = ((cy % p) + p) % p;
      const fx = cx + hash2(mx, my, s), fy = cy + hash2(mx, my, s + 7); const d = (fx - x) ** 2 + (fy - y) ** 2;
      if (d < best) { best = d; id = hash2(mx, my, s + 3); }
    }
    return [Math.sqrt(best), id];
  }
  const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // Build albedo (rgb multiplier or absolute colour), height and roughness fields, then derive a normal map.
  function makeSet(N, fn, bump) {
    const alb = new Uint8Array(N * N * 4), nrm = new Uint8Array(N * N * 4), rgh = new Uint8Array(N * N * 4);
    const H = new Float32Array(N * N);
    const o = { r: 1, g: 1, b: 1, h: 0.5, ro: 1 };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      o.r = o.g = o.b = 1; o.h = 0.5; o.ro = 1;
      fn(x / N, y / N, o);
      const i = y * N + x; H[i] = o.h;
      alb[i * 4] = Math.min(255, Math.max(0, o.r * 200)); alb[i * 4 + 1] = Math.min(255, Math.max(0, o.g * 200)); alb[i * 4 + 2] = Math.min(255, Math.max(0, o.b * 200)); alb[i * 4 + 3] = 255;
      rgh[i * 4] = rgh[i * 4 + 1] = rgh[i * 4 + 2] = Math.min(255, Math.max(0, o.ro * 170)); rgh[i * 4 + 3] = 255;
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const dx = (H[y * N + ((x + 1) % N)] - H[y * N + ((x - 1 + N) % N)]) * bump;
      const dy = (H[((y + 1) % N) * N + x] - H[((y - 1 + N) % N) * N + x]) * bump;
      const l = Math.hypot(dx, dy, 1);
      nrm[i * 4] = (-dx / l * 0.5 + 0.5) * 255; nrm[i * 4 + 1] = (dy / l * 0.5 + 0.5) * 255; nrm[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[i * 4 + 3] = 255;
    }
    const mk = (d, srgb) => { const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
    return { alb: mk(alb, true), nrm: mk(nrm, false), rgh: mk(rgh, false) };
  }

  // Each kind: size (texture px), tile (metres per repeat), bump, abs (albedo is absolute colour), fn
  const KINDS = {
    paint: { size: 256, tile: 1.2, bump: 1.2, fn(u, v, o) { const n = fbm(u * 32, v * 32, 32, 3, 3); o.h = n; o.r = o.g = o.b = 0.97 + 0.05 * fbm(u * 6, v * 6, 6, 3, 5); o.ro = 0.95 + 0.1 * n; } },
    plaster: { size: 512, tile: 2.2, bump: 2.5, fn(u, v, o) { const n = fbm(u * 24, v * 24, 24, 4, 11) * 0.7 + fbm(u * 96, v * 96, 96, 2, 12) * 0.3; o.h = n; const m = fbm(u * 5, v * 5, 5, 3, 13); o.r = o.g = o.b = 0.94 + 0.08 * m; o.ro = 0.95 + 0.1 * n; } },
    wood: { size: 512, tile: 1.6, bump: 3, fn(u, v, o) { // planks running along u, 6 per tile
      const pl = v * 6, row = Math.floor(pl), f = pl - row;
      const off = hash2(row, 0, 21) * 5; const uu = u * 1 + off;
      const warp = fbm(uu * 4, row * 0.37 + f * 0.6, 4, 3, 22) * 3;
      const ring = Math.sin((f * 5 + warp) * 6.283) * 0.5 + 0.5;
      const fibre = fbm(uu * 60, f * 2 + row, 60, 2, 23);
      const gap = sst(0.0, 0.03, f) * sst(1.0, 0.97, f);
      const endJoint = Math.abs(((uu * 1.0) % 1 + 1) % 1 - 0.5) < 0.004 ? 0 : 1;
      const tone = 0.8 + 0.35 * hash2(row, 1, 24);
      const c = tone * (0.85 + 0.15 * ring) * (0.9 + 0.1 * fibre) * (0.35 + 0.65 * gap * endJoint);
      o.r = c * 1.02; o.g = c; o.b = c * 0.95; o.h = gap * endJoint * (0.6 + 0.2 * ring + 0.2 * fibre); o.ro = 0.9 + 0.15 * (1 - ring);
    } },
    grain: { size: 512, tile: 1.0, bump: 1.5, fn(u, v, o) { // continuous wood grain (furniture, handles)
      const warp = fbm(u * 3, v * 3, 3, 3, 31) * 4; const ring = Math.sin((v * 14 + warp) * 6.283) * 0.5 + 0.5; const fibre = fbm(u * 80, v * 4, 80, 2, 32);
      const c = (0.82 + 0.18 * ring) * (0.92 + 0.08 * fibre); o.r = c * 1.02; o.g = c; o.b = c * 0.95; o.h = 0.4 + 0.4 * ring * 0.3 + 0.3 * fibre; o.ro = 0.95 + 0.1 * ring;
    } },
    brick: { size: 512, tile: 1.3, abs: true, bump: 4, fn(u, v, o) { // 6 courses per tile, running bond; absolute colours
      const rows = 6, cols = 3; const r = Math.floor(v * rows), fv = v * rows - r; const uu = u * cols + (r % 2) * 0.5; const c = Math.floor(uu), fu = uu - c;
      const mort = Math.min(sst(0, 0.06, fv), sst(1, 0.94, fv), sst(0, 0.03, fu), sst(1, 0.97, fu));
      const id = hash2(((c % cols) + cols) % cols, r, 41); const n = fbm(u * 40, v * 40, 40, 3, 42); const chip = fbm(u * 12, v * 12, 12, 3, 43);
      const br = [0.66 + 0.18 * id, 0.29 + 0.1 * id + 0.04 * n, 0.2 + 0.06 * id];
      const mo = [0.75 + 0.1 * n, 0.72 + 0.1 * n, 0.66 + 0.1 * n];
      const k = mort * (0.85 + 0.15 * n) * (chip > 0.72 ? 0.85 : 1);
      o.r = (br[0] * k + mo[0] * (1 - mort)) * 1.1; o.g = (br[1] * k + mo[1] * (1 - mort)) * 1.1; o.b = (br[2] * k + mo[2] * (1 - mort)) * 1.1;
      o.h = mort * (0.7 + 0.2 * n - 0.2 * (chip > 0.72 ? 1 : 0)); o.ro = 0.9 + 0.1 * n;
    } },
    stone: { size: 512, tile: 2.0, bump: 3, fn(u, v, o) { const n = fbm(u * 10, v * 10, 10, 5, 51); const s = fbm(u * 64, v * 64, 64, 2, 52); const [d] = cellular(u * 6, v * 6, 6, 53); o.h = n * 0.6 + s * 0.3 + sst(0.0, 0.3, d) * 0.1; const c = 0.88 + 0.2 * n + (s > 0.7 ? 0.08 : 0); o.r = o.g = o.b = c; o.ro = 0.95 + 0.08 * s; } },
    concrete: { size: 512, tile: 2.5, bump: 1.6, fn(u, v, o) { const n = fbm(u * 8, v * 8, 8, 4, 61); const s = fbm(u * 100, v * 100, 100, 2, 62); const pore = s < 0.22 ? 0.4 : 1; o.h = 0.5 + 0.2 * n + 0.2 * s - (1 - pore) * 0.4; o.r = o.g = o.b = (0.9 + 0.15 * n) * (0.95 + 0.05 * pore); o.ro = 1.0; } },
    soil: { size: 512, tile: 1.6, abs: true, bump: 4, fn(u, v, o) { const n = fbm(u * 12, v * 12, 12, 5, 71); const [d, id] = cellular(u * 20, v * 20, 20, 72); const peb = d < 0.28 && id > 0.75; const c = 0.32 + 0.2 * n; o.r = peb ? 0.55 + 0.2 * id : c * 1.25; o.g = peb ? 0.5 + 0.2 * id : c * 0.95; o.b = peb ? 0.45 + 0.2 * id : c * 0.7; o.h = n * 0.7 + (peb ? 0.4 * (1 - d / 0.28) : 0); o.ro = peb ? 0.8 : 1.1; } },
    lawn: { size: 512, tile: 2.2, abs: true, bump: 2.5, fn(u, v, o) { // ground under the grass: dense blades + clover + soil peeking through
      const n = fbm(u * 6, v * 6, 6, 4, 81); const streak = fbm(u * 90, v * 22, 90, 2, 82); const s2 = fbm(u * 150, v * 150, 150, 1, 83); const soilP = sst(0.62, 0.72, fbm(u * 10, v * 10, 10, 3, 84));
      const g = [0.22 + 0.1 * n + 0.1 * streak, 0.42 + 0.14 * n + 0.14 * streak, 0.12 + 0.06 * streak]; const sl = [0.36, 0.27, 0.18];
      const k = soilP * 0.55; o.r = g[0] * (1 - k) + sl[0] * k; o.g = g[1] * (1 - k) + sl[1] * k; o.b = g[2] * (1 - k) + sl[2] * k; o.r *= 0.9 + 0.2 * s2; o.g *= 0.9 + 0.2 * s2;
      o.h = streak * 0.7 + s2 * 0.3; o.ro = 1.05;
    } },
    fabric: { size: 256, tile: 0.25, bump: 2.5, fn(u, v, o) { const f = 64; const w = Math.sin(u * f * 6.283) * Math.sin(v * f * 6.283); const warp = (Math.floor(u * f) + Math.floor(v * f)) % 2 ? 1 : -1; const h = 0.5 + 0.4 * w * warp; const n = fbm(u * 16, v * 16, 16, 3, 91); o.h = h; o.r = o.g = o.b = 0.9 + 0.08 * h + 0.06 * n; o.ro = 1.0; } },
    felt: { size: 256, tile: 0.35, bump: 3, fn(u, v, o) { const n = fbm(u * 64, v * 64, 64, 3, 101); const m = fbm(u * 8, v * 8, 8, 3, 102); o.h = n; o.r = o.g = o.b = 0.88 + 0.16 * n + 0.06 * m; o.ro = 1.1; } },
    terracotta: { size: 256, tile: 0.8, bump: 1.5, fn(u, v, o) { const n = fbm(u * 20, v * 20, 20, 4, 111); const sp = fbm(u * 120, v * 120, 120, 1, 112) > 0.78 ? 0.85 : 1; const m = fbm(u * 3, v * 3, 3, 3, 113); o.h = n; o.r = (0.92 + 0.1 * n + 0.08 * m) * sp; o.g = (0.9 + 0.1 * n) * sp; o.b = (0.88 + 0.08 * n) * sp; o.ro = 1.0 + 0.1 * n; } },
    plastic: { size: 256, tile: 0.8, bump: 0.5, fn(u, v, o) { const n = fbm(u * 40, v * 40, 40, 2, 121); o.h = n; o.r = o.g = o.b = 0.98 + 0.03 * n; o.ro = 0.9 + 0.2 * fbm(u * 6, v * 6, 6, 3, 122); } },
    rubber: { size: 256, tile: 0.5, bump: 1.5, fn(u, v, o) { const n = fbm(u * 50, v * 50, 50, 3, 131); o.h = n; o.r = o.g = o.b = 0.95 + 0.06 * n; o.ro = 1.0; } },
    metal: { size: 256, tile: 0.6, bump: 0.6, fn(u, v, o) { const s = fbm(u * 200, v * 4, 200, 2, 141); const m = fbm(u * 5, v * 5, 5, 3, 142); o.h = s; o.r = o.g = o.b = 0.95 + 0.05 * s; o.ro = 0.7 + 0.5 * m + 0.2 * s; } },
    bark: { size: 512, tile: 1.4, abs: true, bump: 6, fn(u, v, o) { const w = fbm(u * 3, v * 3, 3, 3, 151) * 2; const r = Math.abs(Math.sin((u * 9 + w) * 3.1416)); const n = fbm(u * 18, v * 5, 18, 4, 152); const h = Math.pow(r, 0.6) * 0.7 + n * 0.3; const c = 0.22 + 0.18 * h + 0.06 * n; o.r = c * 1.1; o.g = c * 0.88; o.b = c * 0.7; o.h = h; o.ro = 1.1; } },
    paper: { size: 256, tile: 0.5, bump: 0.8, fn(u, v, o) { const n = fbm(u * 60, v * 60, 60, 3, 161); o.h = n; o.r = o.g = o.b = 0.97 + 0.04 * n; o.ro = 1.0; } },
    tile: { size: 512, tile: 1.2, bump: 3, fn(u, v, o) { const t = 4; const fu = (u * t) % 1, fv = (v * t) % 1; const g = Math.min(sst(0, 0.03, fu), sst(1, 0.97, fu), sst(0, 0.03, fv), sst(1, 0.97, fv)); const n = fbm(u * 30, v * 30, 30, 2, 171); o.h = g * (0.9 + 0.1 * n); o.r = o.g = o.b = g * (0.97 + 0.04 * n) + (1 - g) * 0.7; o.ro = g > 0.5 ? 0.35 : 1.2; } },
  };
  const sets = {};
  A.texSet = function (kind) { if (!sets[kind]) { const k = KINDS[kind]; sets[kind] = makeSet(k.size, k.fn, k.bump); } return sets[kind]; };
  A.kinds = KINDS;

  // default physical response per kind
  const RESP = {
    paint: { rough: 0.55 }, plaster: { rough: 0.85 }, wood: { rough: 0.7 }, grain: { rough: 0.55 }, brick: { rough: 0.9 }, stone: { rough: 0.85 }, concrete: { rough: 0.9 },
    soil: { rough: 0.95 }, lawn: { rough: 0.9 }, fabric: { rough: 0.95, sheen: true }, felt: { rough: 1.0, sheen: true }, terracotta: { rough: 0.85 }, plastic: { rough: 0.35 },
    rubber: { rough: 0.75 }, metal: { rough: 0.35, metal: 1 }, bark: { rough: 0.95 }, paper: { rough: 0.9 }, tile: { rough: 0.35 },
  };

  // ---------- object-anchored triplanar PBR material ----------
  const cache = {};
  A.material = function (color, o = {}) {
    let kind = o.kind || (o.metal > 0.3 ? 'metal' : 'paint');
    const r = RESP[kind] || RESP.paint;
    const key = [color, kind, o.tile, o.swap, o.rough, o.metal, o.side, o.opacity, o.transparent, o.emissive, o.ei, o.albAmt, o.nrmAmt, o.depthWrite].join('|');
    if (!o.unique && cache[key]) return cache[key];
    const ts = A.texSet(kind); const K = KINDS[kind];
    const Mat = r.sheen ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const m = new Mat({ color: K.abs && o.tint === undefined ? 0xffffff : color, roughness: o.rough ?? r.rough, metalness: o.metal ?? r.metal ?? 0 });
    if (K.abs && o.tint === undefined && color !== undefined) m.color.set(color).lerp(new THREE.Color(1, 1, 1), 0.65); // absolute kinds: colour only nudges
    if (r.sheen) { m.sheen = 0.6; m.sheenRoughness = 0.6; m.sheenColor = new THREE.Color(color).lerp(new THREE.Color(1, 1, 1), 0.3); }
    const U = {
      tpAlb: { value: ts.alb }, tpNrm: { value: ts.nrm }, tpRgh: { value: ts.rgh }, tpTile: { value: o.tile ?? K.tile },
      tpAlbAmt: { value: o.albAmt ?? 1 }, tpNrmAmt: { value: o.nrmAmt ?? 1 }, tpSwap: { value: o.swap ? 1 : 0 },
    };
    m.userData.tp = U; m.userData.kind = kind;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        varying vec3 vTpP; varying vec3 vTpN; varying vec3 vTpAx; varying vec3 vTpAy; varying vec3 vTpAz;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          mat4 tpM = modelMatrix;
          #ifdef USE_INSTANCING
            tpM = modelMatrix * instanceMatrix;
          #endif
          vec3 tpS = vec3(length(tpM[0].xyz), length(tpM[1].xyz), length(tpM[2].xyz));
          vTpP = position * tpS;
          vTpN = normalize(normal / tpS);
          mat3 mv3 = mat3(viewMatrix * tpM);
          vTpAx = normalize(mv3[0]); vTpAy = normalize(mv3[1]); vTpAz = normalize(mv3[2]);
        }`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform sampler2D tpAlb, tpNrm, tpRgh; uniform float tpTile, tpAlbAmt, tpNrmAmt, tpSwap;
        varying vec3 vTpP; varying vec3 vTpN; varying vec3 vTpAx; varying vec3 vTpAy; varying vec3 vTpAz;
        vec3 tpW; vec2 tpUx, tpUy, tpUz;
        vec4 tp3(sampler2D t) { return texture2D(t, tpUx) * tpW.x + texture2D(t, tpUy) * tpW.y + texture2D(t, tpUz) * tpW.z; }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 tpNo = normalize(vTpN) * (gl_FrontFacing ? 1.0 : -1.0);
        tpW = pow(abs(tpNo), vec3(4.0)); tpW /= (tpW.x + tpW.y + tpW.z);
        vec3 tpP = vTpP / tpTile;
        tpUx = vec2(tpP.z * sign(tpNo.x), tpP.y); tpUy = vec2(tpP.x, tpP.z * sign(tpNo.y)); tpUz = vec2(-tpP.x * sign(tpNo.z), tpP.y);
        if (tpSwap > 0.5) { tpUx = tpUx.yx; tpUy = tpUy.yx; tpUz = tpUz.yx; }
        vec3 tpA = tp3(tpAlb).rgb * 1.275; // 200/255 encodes 1.0
        diffuseColor.rgb *= mix(vec3(1.0), tpA, tpAlbAmt);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * tp3(tpRgh).r * 1.5, 0.04, 1.0);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 tx = texture2D(tpNrm, tpUx).xyz * 2.0 - 1.0, ty = texture2D(tpNrm, tpUy).xyz * 2.0 - 1.0, tz = texture2D(tpNrm, tpUz).xyz * 2.0 - 1.0;
          tx.xy *= tpNrmAmt; ty.xy *= tpNrmAmt; tz.xy *= tpNrmAmt;
          tx.x *= sign(tpNo.x); ty.y *= sign(tpNo.y); tz.x *= -sign(tpNo.z);
          vec3 nX = vec3(tx.xy + tpNo.zy, abs(tx.z) * tpNo.x);
          vec3 nY = vec3(ty.xy + tpNo.xz, abs(ty.z) * tpNo.y);
          vec3 nZ = vec3(tz.xy + tpNo.xy, abs(tz.z) * tpNo.z);
          vec3 no = normalize(nX.zyx * tpW.x + nY.xzy * tpW.y + nZ.xyz * tpW.z);
          normal = normalize(no.x * vTpAx + no.y * vTpAy + no.z * vTpAz);
        }`);
    };
    m.customProgramCacheKey = () => 'tp';
    // Material.clone() drops onBeforeCompile; keep the triplanar patch on clones (fading walls, per-mesh tints)
    const baseClone = m.clone.bind(m);
    m.clone = function () { const c = baseClone(); c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; c.clone = m.clone; return c; };
    if (o.emissive !== undefined) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
    if (o.opacity !== undefined) { m.transparent = true; m.opacity = o.opacity; }
    if (o.transparent) m.transparent = true;
    if (o.side) m.side = THREE.DoubleSide;
    if (o.depthWrite === false) m.depthWrite = false;
    if (o.map) m.map = o.map;
    if (!o.unique) cache[key] = m;
    return m;
  };
})();
