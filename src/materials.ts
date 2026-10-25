import * as THREE from 'three';

export function random(seed = 13) {
  let a = seed;
  return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function paperTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!, img = ctx.createImageData(128, 128), rng = random(81);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 230 + Math.floor(rng() * 25);
    img.data.set([v, v, v - 3, 255], i);
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 3); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function createMaterials() {
  const texture = paperTexture();
  const mat = (color: string, roughness = .85) => new THREE.MeshStandardMaterial({ color, map: texture, roughness });
  return {
    plaster: mat('#e7d5ad'), plasterLight: mat('#f3dfb1'), red: mat('#a1392e'), redLight: mat('#bf4936'),
    darkRed: mat('#602f29'), wood: mat('#634739'), darkWood: mat('#362f2a'), gold: mat('#c79955', .65),
    roof: mat('#254f4a', .75), roofEdge: mat('#528075', .7), roofDark: mat('#193a37'),
    stone: mat('#657064'), stoneLight: mat('#92917b'), rock: mat('#515f50'), grass: mat('#617650'),
    leaves: mat('#385d43'), leavesLight: mat('#648054'), leavesDark: mat('#234838'),
    windows: new THREE.MeshStandardMaterial({ color: '#f7c16d', emissive: '#ffae45', emissiveIntensity: .45, roughness: .7 }),
    lantern: new THREE.MeshStandardMaterial({ color: '#f9d39c', emissive: '#ffba60', emissiveIntensity: 1.5, roughness: .8 }),
    lanternRed: new THREE.MeshStandardMaterial({ color: '#ca5935', emissive: '#fd7d36', emissiveIntensity: .6, roughness: .8 }),
    black: mat('#272d29'), chimney: mat('#8c5946'),
  };
}
export type Materials = ReturnType<typeof createMaterials>;

export function makeSign(text: string, width: number, height: number, background: string, color: string, fontSize = 150) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512 * height / width;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  ctx.fillStyle = color; ctx.font = `bold ${fontSize}px "Noto Serif SC", "SimSun", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (text.length > 1) { [...text].forEach((letter, i) => ctx.fillText(letter, 256, canvas.height / (text.length + 1) * (i + 1))); }
  else ctx.fillText(text, 256, canvas.height / 2 + 7);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map, roughness: .9, emissive: '#ac6f2d', emissiveMap: map, emissiveIntensity: .18, side: THREE.DoubleSide }));
}

/** Batch repeated structural parts into a draw call per geometry and material. */
export class Batcher {
  private bins = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[] }>();
  private transform = new THREE.Object3D();
  private boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  private sphereGeometry = new THREE.SphereGeometry(1, 12, 8);
  private foliageGeometry = new THREE.IcosahedronGeometry(1, 1);
  constructor(private parent: THREE.Object3D) {}
  add(geometry: THREE.BufferGeometry, material: THREE.Material, position: number[], scale: number[], rotation = [0, 0, 0]) {
    const key = geometry.uuid + material.uuid;
    if (!this.bins.has(key)) this.bins.set(key, { geometry, material, matrices: [] });
    this.transform.position.set(position[0], position[1], position[2]);
    this.transform.scale.set(scale[0], scale[1], scale[2]);
    this.transform.rotation.set(rotation[0], rotation[1], rotation[2]); this.transform.updateMatrix();
    this.bins.get(key)!.matrices.push(this.transform.matrix.clone());
  }
  box(mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, rot = [0, 0, 0]) { this.add(this.boxGeometry, mat, [x, y, z], [w, h, d], rot); }
  cylinder(mat: THREE.Material, x: number, y: number, z: number, r: number, h: number) { this.add(this.cylinderGeometry, mat, [x, y, z], [r, h, r]); }
  sphere(mat: THREE.Material, x: number, y: number, z: number, rx: number, ry: number, rz: number) { this.add(this.sphereGeometry, mat, [x, y, z], [rx, ry, rz]); }
  leaf(mat: THREE.Material, x: number, y: number, z: number, rx: number, ry: number, rz: number, turn = 0) { this.add(this.foliageGeometry, mat, [x, y, z], [rx, ry, rz], [0, turn, .1]); }
  beam(mat: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, width: number, depth = width) {
    const key = this.boxGeometry.uuid + mat.uuid;
    if (!this.bins.has(key)) this.bins.set(key, { geometry: this.boxGeometry, material: mat, matrices: [] });
    this.transform.position.copy(from).add(to).multiplyScalar(.5);
    this.transform.scale.set(width, from.distanceTo(to), depth);
    this.transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    this.transform.updateMatrix(); this.bins.get(key)!.matrices.push(this.transform.matrix.clone());
  }
  finish() {
    let instances = 0;
    this.bins.forEach(({ geometry, material, matrices }) => {
      const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.computeBoundingSphere(); this.parent.add(mesh); instances += matrices.length;
    });
    return instances;
  }
}
