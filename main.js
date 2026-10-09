import * as THREE from 'three';
import { CATALOG, SWATCHES, buildModel, recolor, dimsCm } from './furniture.js';

const $ = s => document.querySelector(s);
const stage = $('#stage'), overlay = $('#overlay'), startBtn = $('#startBtn'), exitBtn = $('#exitBtn');
const hintEl = $('#hint'), dimsEl = $('#dims'), nameEl = $('#itemName');
const catalogEl = $('#catalog'), swatchEl = $('#swatches');

/* ---------- Renderer / scene ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 50);
camera.position.set(0, 1.5, 3.4);
camera.lookAt(0, 0.45, 0);

const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.0);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
const sunOffset = new THREE.Vector3(2, 4, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.1, far: 12 });
sun.shadow.bias = -0.0005;
scene.add(hemi, sun, sun.target);

// Shadow catcher: invisible floor that only shows shadows (so shadows land on the real floor in AR)
const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2),
  new THREE.ShadowMaterial({ opacity: 0.35 })
);
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

// Preview-only floor grid
const grid = new THREE.GridHelper(6, 12, 0x38bdf8, 0x334155);
scene.add(grid);

// Reticle (surface anchoring indicator)
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.12, 0.15, 40).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

/* ---------- State ---------- */
let current = 0, colorIdx = 0;
let ghost = null, selected = null, ghostYawOffset = 0;
const items = [];
let inAR = false, hitTestSource = null, lightProbe = null;
const tmpV = new THREE.Vector3();

/* ---------- UI ---------- */
CATALOG.forEach((def, i) => {
  const b = document.createElement('button');
  b.innerHTML = `<span>${def.icon}</span>${def.name}`;
  b.onclick = () => { current = i; makeGhost(); refreshCatalog(); };
  catalogEl.appendChild(b);
});
SWATCHES.forEach((hex, i) => {
  const b = document.createElement('button');
  b.className = 'sw'; b.style.background = hex; b.setAttribute('aria-label', 'Colour ' + hex);
  b.onclick = () => {
    colorIdx = i; recolor(ghost, hex);
    if (selected) { recolor(selected, hex); selected.userData.colorIdx = i; }
    refreshSwatches();
  };
  swatchEl.appendChild(b);
});
function refreshCatalog() { [...catalogEl.children].forEach((b, i) => b.classList.toggle('active', i === current)); }
function refreshSwatches() { [...swatchEl.children].forEach((b, i) => b.classList.toggle('active', i === colorIdx)); }
function setHint(t) { if (hintEl.textContent !== t) hintEl.textContent = t; }

// Stop taps on UI from being treated as "place furniture" taps inside an AR session
['#top', '#panel', '#startBtn', '#hint'].forEach(sel =>
  $(sel).addEventListener('beforexrselect', e => e.preventDefault()));

$('#rotL').onclick = () => rotate(Math.PI / 12);
$('#rotR').onclick = () => rotate(-Math.PI / 12);
$('#del').onclick = () => { if (selected) removeItem(selected); };
$('#clear').onclick = () => { [...items].forEach(removeItem); };
function rotate(a) { if (selected) selected.rotation.y += a; else if (ghost) { ghostYawOffset += a; if (!inAR) ghost.rotation.y += a; } }

/* ---------- Ghost (preview of the catalog item) ---------- */
function makeGhost() {
  const pos = ghost ? ghost.position.clone() : new THREE.Vector3();
  const rot = ghost ? ghost.rotation.y : 0;
  if (ghost) scene.remove(ghost);
  ghost = buildModel(CATALOG[current], SWATCHES[colorIdx]);
  ghost.position.copy(pos); ghost.rotation.y = rot;
  if (inAR) ghost.traverse(o => {
    if (o.isMesh) { o.material.transparent = true; o.material.opacity = 0.6; o.castShadow = false; }
  });
  scene.add(ghost);
  nameEl.textContent = CATALOG[current].name;
  dimsEl.textContent = dimsCm(ghost) + '  ·  true 1:1 scale';
}

/* ---------- Placed items ---------- */
function makeRing(g) {
  const s = g.userData.size, r = Math.max(s.x, s.z) / 2 + 0.08;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r, r + 0.025, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 })
  );
  ring.position.y = 0.004; ring.userData.isRing = true; return ring;
}
function select(g) {
  if (selected) { const r = selected.children.find(c => c.userData.isRing); if (r) selected.remove(r); }
  selected = g;
  if (g) g.add(makeRing(g));
}
function placeItem() {
  const g = buildModel(CATALOG[current], SWATCHES[colorIdx]);
  g.userData.colorIdx = colorIdx;
  g.position.copy(ghost.position); g.rotation.y = ghost.rotation.y;
  scene.add(g); items.push(g); select(g); ghostYawOffset = 0;
}
function removeItem(g) {
  scene.remove(g); items.splice(items.indexOf(g), 1);
  if (selected === g) select(items[items.length - 1] || null);
}

/* ---------- Touch gestures (AR): drag = move, two-finger twist = rotate ---------- */
const raycaster = new THREE.Raycaster();
const g = { mode: null, consumed: false, angle: 0, sx: 0, sy: 0 };
function ndc(t) { return new THREE.Vector2((t.clientX / window.innerWidth) * 2 - 1, -(t.clientY / window.innerHeight) * 2 + 1); }
function pickItem(t) {
  raycaster.setFromCamera(ndc(t), renderer.xr.getCamera());
  const hit = raycaster.intersectObjects(items, true)[0];
  if (!hit) return null;
  let o = hit.object; while (o && !items.includes(o)) o = o.parent; return o;
}
const twist = ts => Math.atan2(ts[1].clientY - ts[0].clientY, ts[1].clientX - ts[0].clientX);

stage.addEventListener('touchstart', e => {
  if (!renderer.xr.isPresenting) return;
  g.consumed = false; g.mode = null; g.sx = e.touches[0].clientX; g.sy = e.touches[0].clientY;
  if (e.touches.length === 1) {
    const hit = pickItem(e.touches[0]);
    if (hit) { select(hit); g.mode = 'drag'; g.consumed = true; }
  } else if (e.touches.length === 2 && selected) {
    g.mode = 'twist'; g.consumed = true; g.angle = twist(e.touches);
  }
}, { passive: true });

stage.addEventListener('touchmove', e => {
  if (!renderer.xr.isPresenting) return;
  const t = e.touches[0];
  if (Math.hypot(t.clientX - g.sx, t.clientY - g.sy) > 12) g.consumed = true; // a swipe is never a placement tap
  if (g.mode === 'drag' && selected && e.touches.length === 1) {
    raycaster.setFromCamera(ndc(t), renderer.xr.getCamera());
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -selected.position.y);
    if (raycaster.ray.intersectPlane(plane, tmpV)) { selected.position.x = tmpV.x; selected.position.z = tmpV.z; }
  } else if (g.mode === 'twist' && selected && e.touches.length === 2) {
    const a = twist(e.touches); selected.rotation.y -= a - g.angle; g.angle = a;
  }
}, { passive: true });

/* ---------- Preview mode (no AR): drag to spin the model ---------- */
let dragging = false, lastX = 0;
stage.addEventListener('pointerdown', e => { if (!renderer.xr.isPresenting) { dragging = true; lastX = e.clientX; } });
window.addEventListener('pointerup', () => dragging = false);
stage.addEventListener('pointermove', e => {
  if (dragging && !renderer.xr.isPresenting) { ghost.rotation.y += (e.clientX - lastX) * 0.012; lastX = e.clientX; }
});

/* ---------- WebXR session ---------- */
const controller = renderer.xr.getController(0);
controller.addEventListener('select', () => {
  if (!inAR || g.consumed || !reticle.visible) return;
  placeItem();
});
scene.add(controller);

async function startAR() {
  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'light-estimation'],
      domOverlay: { root: overlay },
    });
    renderer.xr.setReferenceSpaceType('local');
    await renderer.xr.setSession(session);
    inAR = true;
    document.body.classList.add('ar');
    grid.visible = false;
    startBtn.hidden = true; exitBtn.hidden = false;
    ghost.position.set(0, 0, 0); ghost.rotation.y = 0; ghostYawOffset = 0; ghost.visible = false;
    makeGhost();

    const viewer = await session.requestReferenceSpace('viewer');
    hitTestSource = await session.requestHitTestSource({ space: viewer });
    session.requestLightProbe?.().then(p => { lightProbe = p; }).catch(() => {});
    session.addEventListener('end', onAREnd);
  } catch (err) {
    console.error(err);
    setHint('Could not start AR: ' + (err.message || err));
  }
}
function onAREnd() {
  inAR = false; hitTestSource = null; lightProbe = null;
  document.body.classList.remove('ar');
  [...items].forEach(removeItem);
  grid.visible = true; reticle.visible = false;
  startBtn.hidden = false; exitBtn.hidden = true;
  ghost.position.set(0, 0, 0); ghost.visible = true; ghost.rotation.y = 0;
  makeGhost();
  sun.color.set(0xffffff); sun.intensity = 1.6; sunOffset.set(2, 4, 2);
  setHint('');
}
startBtn.onclick = startAR;
exitBtn.onclick = () => renderer.xr.getSession()?.end();

/* ---------- Render loop ---------- */
const clock = new THREE.Clock();
function arFrame(frame) {
  const ref = renderer.xr.getReferenceSpace();
  let found = false;
  if (hitTestSource) {
    for (const r of frame.getHitTestResults(hitTestSource)) {
      const pose = r.getPose(ref); if (!pose) continue;
      const m = new THREE.Matrix4().fromArray(pose.transform.matrix);
      if (m.elements[5] > 0.8) { reticle.matrix.copy(m); found = true; break; } // horizontal, upward-facing surfaces only
    }
  }
  reticle.visible = found; ghost.visible = found;
  if (found) {
    ghost.position.setFromMatrixPosition(reticle.matrix);
    const cp = renderer.xr.getCamera().getWorldPosition(tmpV);
    ghost.rotation.y = Math.atan2(cp.x - ghost.position.x, cp.z - ghost.position.z) + ghostYawOffset;
  }
  // Light estimation: match virtual sun to real room lighting
  if (lightProbe) {
    const est = frame.getLightEstimate(lightProbe);
    if (est) {
      const d = est.primaryLightDirection, i = est.primaryLightIntensity;
      sunOffset.set(d.x, Math.max(d.y, 0.4), d.z).normalize().multiplyScalar(4);
      const lum = (i.x + i.y + i.z) / 3;
      sun.intensity = THREE.MathUtils.clamp(lum * 0.8, 0.4, 3);
      const mx = Math.max(i.x, i.y, i.z) || 1; sun.color.setRGB(i.x / mx, i.y / mx, i.z / mx);
    }
  }
  if (found) setHint(`Tap the floor to place the ${CATALOG[current].name.toLowerCase()}` + (selected ? ' · or drag the highlighted item' : ''));
  else if (selected) setHint('Drag to move · twist two fingers to rotate');
  else setHint('Move your phone slowly to scan the floor…');
}
renderer.setAnimationLoop((t, frame) => {
  const dt = clock.getDelta();
  if (frame) arFrame(frame);
  else if (!dragging && ghost) ghost.rotation.y += dt * 0.5;

  const focus = (selected || (ghost && ghost.visible ? ghost : null));
  const fp = focus ? focus.position : tmpV.set(0, 0, 0);
  shadowPlane.position.copy(fp);
  sun.target.position.copy(fp);
  sun.position.copy(fp).add(sunOffset);
  sun.target.updateMatrixWorld();
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- Boot ---------- */
makeGhost(); refreshCatalog(); refreshSwatches();
(async () => {
  let ok = false;
  try { ok = !!navigator.xr && await navigator.xr.isSessionSupported('immersive-ar'); } catch (e) { ok = false; }
  if (ok) { startBtn.disabled = false; startBtn.textContent = 'Start AR'; setHint('Drag to rotate the preview, then start AR'); }
  else {
    startBtn.textContent = 'AR not supported here';
    setHint(location.protocol === 'https:' || location.hostname === 'localhost'
      ? 'Preview mode. Open on Android Chrome (ARCore) for AR.'
      : 'WebXR needs HTTPS. Deploy to GitHub Pages / Netlify.');
  }
})();
