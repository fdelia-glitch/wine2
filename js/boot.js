// Module boot: loads three.js r186 + addons, exposes them to the classic game scripts, preloads the family models,
// then runs the game scripts in order.
import * as THREE_NS from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { growFur } from './fur.js';
import { HumanRig, DogRig } from './anim.js';

window.THREE = Object.assign({}, THREE_NS);
const G = (window.G = window.G || {});
G.X = { GLTFLoader, EffectComposer, RenderPass, GTAOPass, UnrealBloomPass, OutputPass, SMAAPass, ShaderPass, BokehPass, SkeletonUtils, BufferGeometryUtils, RoundedBoxGeometry, Sky, Water, RoomEnvironment, growFur, HumanRig, DogRig };

const setLoading = (t) => { const el = document.getElementById('loading'); if (el) el.textContent = t; };
const MODELS = ['frank', 'elba', 'luca', 'ludo', 'luigi'];

async function loadModels() {
  const loader = new GLTFLoader();
  G.models = {};
  let done = 0;
  await Promise.all(MODELS.map(async (id) => {
    const g = await loader.loadAsync('models/' + id + '.glb');
    G.models[id] = g;
    done++; setLoading(`Getting the family ready… ${done}/${MODELS.length}`);
  }));
}

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('failed ' + src)); document.body.appendChild(s); });
}

(async () => {
  try {
    setLoading('Getting the family ready…');
    await loadModels();
    setLoading('Warming up the grill…');
    for (const f of ['audio', 'engine', 'art', 'props', 'w1art', 'characters', 'hub', 'world1', 'main']) await loadScript('js/' + f + '.js');
  } catch (e) {
    console.error(e); setLoading('Could not load the game: ' + e.message);
  }
})();
