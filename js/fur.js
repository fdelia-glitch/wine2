// Shell fur for skinned meshes: beards, short hair, brows and Luigi's coat.
// A fur primitive (extras.kind === 'fur') is drawn as N stacked shells that share its geometry and skeleton.
import * as THREE from 'three';

export function makeFurMaterial(o) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: o.roughness ?? 0.75, metalness: 0, side: THREE.FrontSide });
  m.userData.fur = o;
  const U = {
    uShell: { value: 0 }, uLen: { value: o.length ?? 0.01 }, uDensity: { value: o.density ?? 300 },
    uRoot: { value: new THREE.Color(...(o.root ?? [0.15, 0.12, 0.1])) }, uTip: { value: new THREE.Color(...(o.tip ?? [0.4, 0.35, 0.3])) },
    uAlt: { value: new THREE.Color(...(o.alt ?? o.tip ?? [0.6, 0.6, 0.6])) }, uAltMix: { value: o.altMix ?? 0 },
    uFlow: { value: new THREE.Vector3(...(o.flow ?? [0, -1, 0])) }, uFlowAmt: { value: o.flowAmt ?? 0.4 },
    uThick: { value: o.thick ?? 0.55 }, uCurl: { value: o.curl ?? 0 }, uGravity: { value: new THREE.Vector3(0, 0, 0) },
    uWind: { value: 0 }, uTime: { value: 0 }, uAO: { value: o.ao ?? 0.55 }, uClump: { value: o.clump ?? 0 },
    uCurlR: { value: o.curlR ?? 0 }, uStep: { value: 1 / (o.shells ?? 16) }, uCurlF: { value: o.curlF ?? 8 },
  };
  m.userData.uniforms = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uShell, uLen, uFlowAmt, uCurl, uTime, uWind; uniform vec3 uFlow, uGravity;
        attribute float furMask; attribute float furLen; varying float vFurMask; varying vec2 vFurUv; varying float vH;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vFurMask = furMask; vFurUv = uv; vH = uShell;
        float fl = uLen * furLen;
        vec3 dir = normalize(objectNormal) + uFlow * uFlowAmt * uShell;
        dir += sin(vec3(uv.x, uv.y, uv.x + uv.y) * 90.0 + uShell * 6.0) * uCurl * uShell;
        transformed += dir * fl * uShell;`)
      .replace('#include <project_vertex>', `
        #ifdef USE_SKINNING
        #endif
        #include <project_vertex>`);
    // gravity/wind in world space after skinning
    sh.vertexShader = sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        transformed += (uGravity + vec3(sin(uTime * 2.3 + position.y * 20.0), 0.0, cos(uTime * 1.7 + position.x * 20.0)) * uWind) * uShell * uShell * uLen * furMask;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uShell, uDensity, uThick, uAO, uAltMix, uClump, uCurlR, uCurlF, uStep; uniform vec3 uRoot, uTip, uAlt;
        varying float vFurMask; varying vec2 vFurUv; varying float vH;
        float fh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        vec2 fh2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 g = vFurUv * uDensity;
        if (uCurlR > 0.0) { float ph = fh(floor(g / 3.0)) * 6.2831; g += uCurlR * vec2(cos(vH * uCurlF + ph), sin(vH * uCurlF + ph)); }
        float px = length(fwidth(g));            // strand cells per pixel
        float far = smoothstep(0.6, 1.4, px);   // 0 = resolve strands, 1 = average them
        float avgH = 0.55;
        vec2 cell = floor(g); vec2 f = fract(g);
        float best = 9.0; float bid = 0.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 c = cell + vec2(i, j); vec2 o = fh2(c) * 0.8 + 0.1; vec2 d = vec2(i, j) + o - f;
          float dd = dot(d, d); if (dd < best) { best = dd; bid = fh(c + 7.1); }
        }
        float exist = fh(vec2(bid * 91.7, bid * 13.3));
        float len = mix(0.5, 1.0, bid) * mix(0.35, 1.0, smoothstep(0.0, 0.8, vFurMask));
        float hd = vH + (fh(gl_FragCoord.xy * 0.73) - 0.5) * uStep;
        float r = uThick * (1.0 - hd / len);
        bool miss = hd > len || sqrt(best) > r || exist > vFurMask * 1.15;
        // at a distance the first shell becomes an averaged coverage layer so beards and short hair do not vanish
        bool avgDraw = uShell > 0.001 && uShell < uStep * 1.5 && fh(gl_FragCoord.xy * 0.37 + 1.7) < far * smoothstep(0.15, 0.55, vFurMask);
        if (uShell > 0.001 && !avgDraw && (far > 0.99 || miss)) discard;
        if (uShell > 0.001 && !avgDraw && far > 0.0 && fh(gl_FragCoord.xy + uShell) < far) discard;
        vec3 tipc = mix(uTip, uAlt, step(1.0 - uAltMix, fh(cell + 3.3)));
        vec3 fc = mix(uRoot, tipc, smoothstep(0.0, 1.0, vH / len));
        float ao = mix(uAO, 1.0, vH);
        vec3 avgc = mix(uRoot, mix(uTip, uAlt, uAltMix), avgH) * mix(uAO, 1.0, 0.55);
        if (avgDraw) diffuseColor.rgb = avgc; else if (uShell > 0.001) diffuseColor.rgb = fc * ao;
        else diffuseColor.rgb = mix(diffuseColor.rgb, mix(uRoot * uAO, avgc, far), vFurMask * mix(0.6, 0.95, far));`);
  };
  m.customProgramCacheKey = () => 'fur';
  return m;
}

// Build shells for a skinned fur mesh. Returns the group of shells (first shell = base, drawn with skin under it).
export function growFur(mesh, o) {
  const shells = [];
  const n = o.shells ?? 16;
  const base = makeFurMaterial(o);
  if (!mesh.geometry.getAttribute('furMask')) {
    const c = mesh.geometry.getAttribute('color');
    const a = new Float32Array(mesh.geometry.getAttribute('position').count);
    const l = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) { a[i] = c ? c.getX(i) : 1; l[i] = (c && o.lenFromColor) ? c.getY(i) * 1.5 : 1; }
    mesh.geometry.setAttribute('furMask', new THREE.BufferAttribute(a, 1));
    mesh.geometry.setAttribute('furLen', new THREE.BufferAttribute(l, 1));
  }
  for (let i = 1; i <= n; i++) {
    const m = base.clone(); m.userData = base.userData;
    const U = { ...base.userData.uniforms, uShell: { value: i / n } };
    m.onBeforeCompile = (sh) => { base.onBeforeCompile(sh); Object.assign(sh.uniforms, U); };
    m.customProgramCacheKey = () => 'fur';
    const s = new THREE.SkinnedMesh(mesh.geometry, m);
    s.bind(mesh.skeleton, mesh.bindMatrix);
    s.frustumCulled = false; s.castShadow = false; s.receiveShadow = true;
    s.renderOrder = 1 + i;
    mesh.parent.add(s); shells.push(s);
    s.userData.furU = U;
  }
  mesh.visible = false;
  return shells;
}
