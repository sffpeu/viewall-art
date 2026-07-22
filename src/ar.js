// AR Viewer: reads experience.json and renders every element type with
// click / drag interactivity, anchored to a tracked image (MindAR + Three.js).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';
import { actionHref } from './elements.js';

const clock = new THREE.Clock();
const mixers = [];          // GLB animation mixers
const motionUpdaters = [];  // per-frame canvas/texture updaters
const interactives = [];    // { mesh, el, anchor, mixer? } for raycasting

// 1 unit == trigger-image WIDTH. Vertical uses the image's height/width ratio.
function place(obj, el, heightRatio) {
  obj.position.set((el.x - 0.5), (0.5 - el.y) * heightRatio + (el.z || 0), (el.z || 0));
  obj.scale.multiplyScalar(el.scale || 1);
  obj.rotation.z = -(el.rotation || 0) * Math.PI / 180;
}
function planeSize(el, heightRatio) {
  return [(el.w || 0.25), (el.h || 0.15) * heightRatio];
}

// --- Label/text/button textures -------------------------------------------
function textTexture(text, { color = '#ffffff', bg = null, pad = 24, font = 64 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (bg) { ctx.fillStyle = bg; roundRect(ctx, 0, 0, canvas.width, canvas.height, 40); ctx.fill(); }
  ctx.fillStyle = color;
  ctx.font = `600 ${font}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  wrapText(ctx, text, canvas.width / 2, canvas.height / 2, canvas.width - pad * 2, font * 1.15);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function wrapText(ctx, text, cx, cy, maxW, lh) {
  const words = String(text).split(' '); const lines = []; let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  lines.push(line);
  const start = cy - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, start + i * lh));
}

// --- Element builders -------------------------------------------------------
function buildText(anchor, el, heightRatio) {
  const [w, h] = planeSize(el, heightRatio);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: textTexture(el.value, { color: el.color }), transparent: true })
  );
  place(mesh, el, heightRatio); anchor.group.add(mesh); register(mesh, el, anchor);
}

function buildImage(anchor, el, heightRatio, loader) {
  if (!el.asset) return;
  new THREE.TextureLoader().load(el.asset, (tex) => {
    const [w, h] = planeSize(el, heightRatio);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    place(mesh, el, heightRatio); anchor.group.add(mesh); register(mesh, el, anchor);
  });
}

function build3D(anchor, el, heightRatio, loader) {
  if (!el.asset) return;
  loader.load(el.asset, (gltf) => {
    const model = gltf.scene;
    place(model, el, heightRatio);
    anchor.group.add(model);
    let mixer = null;
    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      const play = () => gltf.animations.forEach((c) => mixer.clipAction(c).play());
      if (el.autoplay) play();
      register(model, el, anchor, { mixer, play });
      if (el.autoplay) mixers.push(mixer);
    } else {
      register(model, el, anchor);
    }
  });
}

function buildSound(anchor, el, heightRatio, loader, listener) {
  const sound = new THREE.PositionalAudio(listener);
  new THREE.AudioLoader().load(el.asset, (buf) => {
    sound.setBuffer(buf); sound.setLoop(!!el.loop); sound.setVolume(el.volume ?? 1);
  });
  const [w, h] = planeSize(el, heightRatio);
  const disc = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: textTexture('🔊', { bg: 'rgba(20,26,38,0.7)' }), transparent: true })
  );
  place(disc, el, heightRatio); disc.add(sound); anchor.group.add(disc);
  const toggle = () => { if (sound.isPlaying) sound.stop(); else if (sound.buffer) sound.play(); };
  register(disc, el, anchor, { toggle });
  // If not click-interactive, auto-play while the image is visible.
  if (el.interaction !== 'click') {
    anchor._auto = anchor._auto || [];
    anchor._auto.push({ on: () => sound.buffer && !sound.isPlaying && sound.play(), off: () => sound.isPlaying && sound.stop() });
  }
}

function buildAction(anchor, el, heightRatio) {
  const [w, h] = planeSize(el, heightRatio);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: textTexture(el.label || 'Open', { bg: 'rgba(20,26,38,0.82)' }), transparent: true })
  );
  place(mesh, el, heightRatio); anchor.group.add(mesh); register(mesh, el, anchor);
}

function register(mesh, el, anchor, extra = {}) {
  mesh.userData.el = el;
  interactives.push({ mesh, el, anchor, ...extra });
}

// --- Interactivity: click + drag -------------------------------------------
function setupInteraction(renderer, camera) {
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  const dom = renderer.domElement;
  let dragging = null;
  const plane = new THREE.Plane();
  const hit = new THREE.Vector3();

  const setPtr = (e) => {
    const r = dom.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    ptr.x = ((p.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((p.clientY - r.top) / r.height) * 2 + 1;
  };
  const pick = () => {
    ray.setFromCamera(ptr, camera);
    const meshes = interactives.filter((i) => i.anchor.group.visible).map((i) => i.mesh);
    const hits = ray.intersectObjects(meshes, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.el) o = o.parent;
    return interactives.find((i) => i.mesh === o) || null;
  };

  const onDown = (e) => {
    setPtr(e);
    const target = pick();
    if (!target) return;
    const el = target.el;
    if (el.interaction === 'drag') {
      dragging = target;
      e.preventDefault();
    } else if (el.interaction === 'click') {
      const href = actionHref(el);
      if (href) { window.location.href = href; }
      else if (target.toggle) target.toggle();
      else if (target.play) { target.play(); if (target.mixer && !mixers.includes(target.mixer)) mixers.push(target.mixer); }
    }
  };
  const onMove = (e) => {
    if (!dragging) return;
    setPtr(e);
    ray.setFromCamera(ptr, camera);
    const g = dragging.anchor.group;
    // Drag across the image plane (local z=0 of the anchor).
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(g.getWorldQuaternion(new THREE.Quaternion()));
    plane.setFromNormalAndCoplanarPoint(normal, g.getWorldPosition(new THREE.Vector3()));
    if (ray.ray.intersectPlane(plane, hit)) {
      const local = g.worldToLocal(hit.clone());
      dragging.mesh.position.x = local.x;
      dragging.mesh.position.y = local.y;
    }
    e.preventDefault();
  };
  const onUp = () => { dragging = null; };

  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onUp);
}

// --- Bootstrap --------------------------------------------------------------
export async function startAR({ experienceUrl = 'experience.json', onReady, onError } = {}) {
  try {
    const exp = await (await fetch(experienceUrl)).json();
    const mindarThree = new MindARThree({
      container: document.querySelector('#ar-container'),
      imageTargetSrc: exp.targetsFile || 'targets.mind',
      filterMinCF: 0.0001, filterBeta: 10, warmupTolerance: 5, missTolerance: 5,
    });
    const { renderer, scene, camera } = mindarThree;
    const listener = new THREE.AudioListener();
    camera.add(listener);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.3));
    scene.add(new THREE.DirectionalLight(0xffffff, 0.6).translateZ(1));
    const loader = new GLTFLoader();

    (exp.targets || []).forEach((t) => {
      const anchor = mindarThree.addAnchor(t.index);
      const hr = t.heightRatio || 1;   // image height / width
      (t.elements || []).forEach((el) => {
        switch (el.type) {
          case 'text':  buildText(anchor, el, hr); break;
          case 'image': buildImage(anchor, el, hr, loader); break;
          case '3d':    build3D(anchor, el, hr, loader); break;
          case 'sound': buildSound(anchor, el, hr, loader, listener); break;
          case 'url': case 'phone': case 'email': buildAction(anchor, el, hr); break;
          default: console.warn('Unknown element type:', el.type);
        }
      });
      anchor.onTargetFound = () => (anchor._auto || []).forEach((a) => a.on());
      anchor.onTargetLost = () => (anchor._auto || []).forEach((a) => a.off());
    });

    setupInteraction(renderer, camera);
    await mindarThree.start();
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      mixers.forEach((m) => m.update(dt));
      motionUpdaters.forEach((u) => u());
      renderer.render(scene, camera);
    });
    onReady && onReady(mindarThree);
    return mindarThree;
  } catch (err) {
    console.error('AR start failed:', err);
    onError && onError(err);
    throw err;
  }
}
