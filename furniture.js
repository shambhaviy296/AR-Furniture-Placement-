import * as THREE from 'three';

// All models are built in METRES at true 1:1 scale. Origin = floor centre, front = +Z.
export const SWATCHES = ['#8d6e63', '#546e7a', '#2e7d32', '#b23a48', '#d9d2c3', '#3b3b3b'];

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });
const dark = () => mat('#222222', { roughness: 0.45, metalness: 0.4 });

function tintFactory(hex) {
  return (shade = 1) => {
    const m = mat(hex);
    m.userData.shade = shade;
    m.color.set(hex).multiplyScalar(shade);
    return m;
  };
}
function box(g, w, h, d, x, y, z, m) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh;
}
function cyl(g, rt, rb, h, x, y, z, m, seg = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh;
}

export const CATALOG = [
  { id: 'sofa', name: 'Sofa', icon: '🛋️', build(g, t) {
    const body = t(1), cush = t(1.18), dk = dark();
    for (const x of [-0.9, 0.9]) for (const z of [-0.35, 0.35]) cyl(g, 0.03, 0.03, 0.1, x, 0.05, z, dk, 12);
    box(g, 2.0, 0.3, 0.9, 0, 0.25, 0, body);
    box(g, 2.0, 0.45, 0.2, 0, 0.625, -0.35, body);
    box(g, 0.2, 0.25, 0.7, -0.9, 0.525, 0.1, body);
    box(g, 0.2, 0.25, 0.7, 0.9, 0.525, 0.1, body);
    box(g, 0.78, 0.14, 0.62, -0.39, 0.47, 0.1, cush);
    box(g, 0.78, 0.14, 0.62, 0.39, 0.47, 0.1, cush);
  }},
  { id: 'chair', name: 'Armchair', icon: '💺', build(g, t) {
    const body = t(1), cush = t(1.18), dk = dark();
    for (const x of [-0.3, 0.3]) for (const z of [-0.28, 0.28]) cyl(g, 0.025, 0.025, 0.14, x, 0.07, z, dk, 12);
    box(g, 0.75, 0.2, 0.75, 0, 0.24, 0, body);
    box(g, 0.75, 0.5, 0.15, 0, 0.59, -0.3, body);
    box(g, 0.12, 0.2, 0.55, -0.315, 0.44, 0.1, body);
    box(g, 0.12, 0.2, 0.55, 0.315, 0.44, 0.1, body);
    box(g, 0.5, 0.1, 0.55, 0, 0.39, 0.1, cush);
  }},
  { id: 'table', name: 'Coffee Table', icon: '🪑', build(g, t) {
    const wood = t(1), dk = dark();
    box(g, 1.1, 0.04, 0.6, 0, 0.43, 0, wood);
    box(g, 1.0, 0.03, 0.5, 0, 0.14, 0, wood);
    for (const x of [-0.52, 0.52]) for (const z of [-0.27, 0.27]) box(g, 0.04, 0.41, 0.04, x, 0.205, z, dk);
  }},
  { id: 'lamp', name: 'Floor Lamp', icon: '💡', build(g, t) {
    const pole = t(0.7), dk = dark();
    cyl(g, 0.18, 0.2, 0.03, 0, 0.015, 0, dk, 32);
    cyl(g, 0.015, 0.015, 1.4, 0, 0.73, 0, pole, 12);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.3, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: '#f5e6c8', emissive: '#ffd89a', emissiveIntensity: 0.6, side: THREE.DoubleSide }));
    shade.position.y = 1.55; shade.castShadow = true; g.add(shade);
  }},
  { id: 'shelf', name: 'Bookshelf', icon: '📚', build(g, t) {
    const wood = t(1), back = dark();
    box(g, 0.03, 1.8, 0.3, -0.385, 0.9, 0, wood);
    box(g, 0.03, 1.8, 0.3, 0.385, 0.9, 0, wood);
    for (const y of [0.015, 0.4, 0.8, 1.2, 1.6, 1.785]) box(g, 0.74, 0.03, 0.3, 0, y, 0, wood);
    box(g, 0.8, 1.8, 0.01, 0, 0.9, -0.145, back);
    const bookCols = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad'];
    [0.03, 0.43, 0.83, 1.23].forEach((y, r) => {
      let x = -0.3;
      for (let i = 0; i < 5; i++) {
        const w = 0.04 + ((i + r) % 3) * 0.015, h = 0.22 + ((i * 2 + r) % 3) * 0.03;
        box(g, w, h, 0.2, x + w / 2, y + 0.015 + h / 2, 0, mat(bookCols[(i + r) % 5]));
        x += w + 0.03;
      }
    });
  }},
  { id: 'bed', name: 'Bed', icon: '🛏️', build(g, t) {
    const frame = t(1), blanket = t(0.85), white = mat('#f3f1ec'), dk = dark();
    for (const x of [-0.75, 0.75]) for (const z of [-0.95, 0.95]) cyl(g, 0.03, 0.03, 0.1, x, 0.05, z, dk, 12);
    box(g, 1.6, 0.3, 2.0, 0, 0.25, 0, frame);
    box(g, 1.6, 0.9, 0.1, 0, 0.55, -0.95, frame);
    box(g, 1.5, 0.2, 1.85, 0, 0.5, 0.05, white);
    box(g, 0.6, 0.12, 0.35, -0.4, 0.66, -0.68, white);
    box(g, 0.6, 0.12, 0.35, 0.4, 0.66, -0.68, white);
    box(g, 1.52, 0.06, 1.2, 0, 0.62, 0.35, blanket);
  }},
];

export function buildModel(def, colorHex) {
  const g = new THREE.Group();
  def.build(g, tintFactory(colorHex));
  g.userData.def = def;
  g.userData.size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
  return g;
}

export function recolor(g, hex) {
  g.traverse(o => {
    if (o.isMesh && o.material.userData && o.material.userData.shade !== undefined) {
      o.material.color.set(hex).multiplyScalar(o.material.userData.shade);
    }
  });
}

export function dimsCm(g) {
  const s = g.userData.size;
  return `W ${Math.round(s.x * 100)} × D ${Math.round(s.z * 100)} × H ${Math.round(s.y * 100)} cm`;
}
