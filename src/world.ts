import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batcher, createMaterials, random } from './materials';
import { createArchitecture } from './architecture';

export function createWorld(scene: THREE.Scene, mobile: boolean) {
  const materials = createMaterials(), architecture = new THREE.Group(); architecture.name = 'Aburaya'; scene.add(architecture);
  const { instances } = createArchitecture(architecture, materials);
  // The roof contours are authored individually, then merged into three static draws.
  for (const material of [materials.roof, materials.roofEdge, materials.roofDark]) {
    const meshes = architecture.children.filter(o => o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && o.material === material) as THREE.Mesh[];
    if (meshes.length < 2) continue;
    const geometries = meshes.map(mesh => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
    const merged = mergeGeometries(geometries);
    if (merged) {
      const result = new THREE.Mesh(merged, material); result.castShadow = result.receiveShadow = true; architecture.add(result);
      meshes.forEach(mesh => { architecture.remove(mesh); mesh.geometry.dispose(); });
    }
    geometries.forEach(geometry => geometry.dispose());
  }
  const rng = random(42), vegetation = new THREE.Group(); vegetation.name = 'Gardens'; scene.add(vegetation);
  const batch = new Batcher(vegetation);
  batch.leaf(materials.grass, 0, -4.2, -108, 104, 6, 39);
  for (const side of [-1, 1]) {
    batch.leaf(materials.rock, side * 37, -2.1, -29, 17, 4.7, 31);
    batch.leaf(materials.grass, side * 36, -.6, -31, 16, 3.2, 29);
    batch.leaf(materials.grass, side * 30, -.8, -61, 24, 4, 24);
  }
  function tree(x: number, y: number, z: number, scale: number, pine = false) {
    batch.cylinder(materials.wood, x, y + scale * .5, z, scale * .07, scale);
    for (let i = 0; i < (pine ? 5 : 7); i++) {
      const angle = i * 2.4 + rng(), radius = scale * (pine ? .18 : .38) * Math.sqrt(rng());
      const xx = x + Math.cos(angle) * radius, zz = z + Math.sin(angle) * radius, yy = y + scale * (.65 + rng() * .45);
      const size = scale * (.25 + rng() * .15), material = [materials.leaves, materials.leavesLight, materials.leavesDark][i % 3];
      batch.leaf(material, xx, yy, zz, size * 1.2, size * .75, size, angle);
      if (i < 3) batch.beam(materials.wood, new THREE.Vector3(x, y + scale * .4, z), new THREE.Vector3(xx, yy, zz), scale * .04);
    }
  }
  for (let i = 0; i < 125; i++) {
    const x = (rng() - .5) * 180, z = -65 - rng() * 80;
    tree(x, -1, z, 9 + rng() * 14, i % 4 === 0);
  }
  for (let i = 0; i < 30; i++) {
    const x = (i % 2 ? 1 : -1) * (28 + rng() * 18), z = -43 + rng() * 43;
    tree(x, 1, z, 5 + rng() * 8);
  }
  for (const [x, z, scale] of [[-24, 34, 11], [-30, 29, 13], [50, 40, 10], [-27, 57, 15], [55, 42, 12]]) tree(x, 3, z, scale);
  // Small shrubs break the bridge landing and masonry outline.
  for (let i = 0; i < 80; i++) {
    const sign = i % 2 ? 1 : -1, x = sign * (6 + rng() * 18), z = 30 + rng() * 27;
    batch.leaf(i % 2 ? materials.leavesLight : materials.leaves, x, 4.3, z, 1 + rng(), 1 + rng(), 1.5, rng());
  }
  const foliageInstances = batch.finish();

  for (let layer = 0; layer < 4; layer++) {
    const geometry = new THREE.PlaneGeometry(850, 100, 100, 16); geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i);
      const peaks = 28 + layer * 12 + 15 * Math.sin(x * .019 + layer * 2) + 12 * Math.sin(x * .043 + layer);
      const height = Math.max(-2, peaks * Math.pow(Math.max(0, 1 - Math.abs(z) / 56), .7));
      position.setY(i, height);
    }
    geometry.computeVertexNormals();
    const hill = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: ['#426858', '#577769', '#71877a', '#8e9b8a'][layer], roughness: 1, flatShading: false }));
    hill.position.set((layer % 2) * 60, -3, -135 - layer * 65); scene.add(hill);
  }

  const skyUniforms = { topColor: { value: new THREE.Color('#829f9c') }, bottomColor: { value: new THREE.Color('#f0cba3') }, sunColor: { value: new THREE.Color('#ffe2b4') }, night: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(850, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: skyUniforms,
    vertexShader: `varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vDirection;uniform vec3 topColor;uniform vec3 bottomColor;uniform vec3 sunColor;uniform float night;
    void main(){vec3 dir=normalize(vDirection);float h=max(dir.y,0.);vec3 c=mix(bottomColor,topColor,pow(h,.55));
    vec3 sun=normalize(vec3(-.52,.31,-.78));float d=distance(dir,sun);c+=sunColor*exp(-d*8.)*.23*(1.-night*.7);c=mix(c,sunColor,smoothstep(.027,.024,d)*(1.-night*.85));
    float band=sin(dir.x*35.+sin(dir.z*21.)*2.+dir.y*32.);float cloud=smoothstep(.5,.85,band)*smoothstep(.08,.17,dir.y)*(1.-smoothstep(.24,.45,dir.y));c=mix(c,bottomColor,cloud*.12);gl_FragColor=vec4(c,1.);}`,
  })); sky.renderOrder = -10; scene.add(sky);

  const water = new Reflector(new THREE.PlaneGeometry(1200, 1200), {
    textureWidth: mobile ? 512 : 1024, textureHeight: mobile ? 512 : 1024, clipBias: .008,
    color: 0x6d9b88,
  });
  water.name = 'Reflecting water'; water.rotation.x = -Math.PI / 2; water.position.y = -.9;
  const waterMaterial = water.material as THREE.ShaderMaterial;
  waterMaterial.uniforms.time = { value: 0 }; waterMaterial.uniforms.night = { value: 0 };
  waterMaterial.uniforms.reflectionStrength = { value: .55 };
  waterMaterial.vertexShader = `uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 vWorld;void main(){vUv=textureMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  waterMaterial.fragmentShader = `uniform sampler2D tDiffuse;uniform float time;uniform float night;uniform float reflectionStrength;varying vec4 vUv;varying vec3 vWorld;
    void main(){vec4 uv=vUv;float wave=sin(vWorld.z*1.9+time*.6+sin(vWorld.x*.25))*sin(vWorld.x*.7+time*.3);uv.x+=wave*.0017*uv.w;uv.y+=sin(vWorld.z*3.2+time*.8)*.0011*uv.w;
    vec3 reflected=texture2DProj(tDiffuse,uv).rgb;vec3 base=mix(vec3(.20,.34,.30),vec3(.07,.14,.19),night);
    float streak=pow(max(0.,sin(vWorld.z*4.1+sin(vWorld.x*.32)+time*.55)),22.)*.035;float distanceFade=exp(-length(vWorld.xz)*.003);
    vec3 c=mix(base,reflected,reflectionStrength*distanceFade)+streak*(1.-night*.6);gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`;
  scene.add(water);

  const hemisphere = new THREE.HemisphereLight('#fce2ba', '#385a51', 2.0); scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#ffe0ad', 3.1); sun.position.set(-48, 65, 35); sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 1, far: 200 });
  sun.shadow.normalBias = .06; sun.shadow.bias = -.00015; sun.shadow.radius = 3; sun.target.position.set(0, 10, -15); scene.add(sun, sun.target);
  sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true;
  const fill = new THREE.DirectionalLight('#bed6d2', .7); fill.position.set(30, 25, -45); scene.add(fill);
  const entranceLight = new THREE.PointLight('#ffba68', 50, 17, 2); entranceLight.position.set(0, 9, -6); scene.add(entranceLight);
  const fog = new THREE.FogExp2('#b6b59a', .0039); scene.fog = fog;

  // Gentle rising steam above the chimney and bathhouse.
  const steamCanvas = document.createElement('canvas'); steamCanvas.width = steamCanvas.height = 64;
  const ctx = steamCanvas.getContext('2d')!, gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,245,220,.3)'); gradient.addColorStop(1, 'rgba(255,245,220,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  const steamMap = new THREE.CanvasTexture(steamCanvas), steam: THREE.Sprite[] = [];
  for (let i = 0; i < 12; i++) { const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamMap, transparent: true, depthWrite: false, opacity: .35 })); scene.add(sprite); steam.push(sprite); }
  const moteGeometry = new THREE.BufferGeometry(), motePositions = new Float32Array(70 * 3);
  for (let i = 0; i < 70; i++) { motePositions[i * 3] = (rng() - .5) * 80; motePositions[i * 3 + 1] = 3 + rng() * 18; motePositions[i * 3 + 2] = (rng() - .5) * 80; }
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(moteGeometry, new THREE.PointsMaterial({ color: '#fbe4a2', size: .1, transparent: true, opacity: .6, depthWrite: false })); scene.add(motes);

  const dayTop = new THREE.Color('#829f9c'), nightTop = new THREE.Color('#293e63');
  const dayBottom = new THREE.Color('#f0cba3'), nightBottom = new THREE.Color('#a18a99');
  const dayFog = new THREE.Color('#b6b59a'), nightFog = new THREE.Color('#69768b');
  let lowQuality = mobile;
  let reflectionFrame = 0;
  const renderReflection = water.onBeforeRender.bind(water);
  water.onBeforeRender = (...args) => {
    // The softened water conceals a lower reflection refresh rate on small GPUs.
    if (!lowQuality || reflectionFrame++ % 3 === 0) renderReflection(...args);
  };
  return {
    instances: instances + foliageInstances,
    setQuality(low: boolean) {
      lowQuality = low;
      water.getRenderTarget().setSize(low ? 384 : 1024, low ? 384 : 1024);
      waterMaterial.uniforms.reflectionStrength.value = low ? .42 : .55;
      sun.shadow.needsUpdate = true;
    },
    update(time: number, progress: number, reducedMotion: boolean) {
      const night = THREE.MathUtils.smoothstep(progress, .15, 1);
      skyUniforms.topColor.value.copy(dayTop).lerp(nightTop, night);
      skyUniforms.bottomColor.value.copy(dayBottom).lerp(nightBottom, night);
      skyUniforms.night.value = night;
      fog.color.copy(dayFog).lerp(nightFog, night);
      hemisphere.intensity = THREE.MathUtils.lerp(2, .85, night); sun.intensity = THREE.MathUtils.lerp(3.1, .5, night);
      fill.intensity = THREE.MathUtils.lerp(.7, 1.15, night);
      materials.windows.emissiveIntensity = THREE.MathUtils.lerp(.35, 1.65, night);
      materials.lantern.emissiveIntensity = THREE.MathUtils.lerp(1.15, 2.4, night);
      waterMaterial.uniforms.time.value = reducedMotion ? 0 : time; waterMaterial.uniforms.night.value = night;
      motes.rotation.y = reducedMotion ? 0 : Math.sin(time * .025) * .1;
      steam.forEach((sprite, i) => {
        const t = ((reducedMotion ? 0 : time * .035) + i / 12) % 1;
        sprite.position.set(17.4 + t * 12 + Math.sin(t * 9) * .7, 42 + t * 18, -36 - t * 3);
        sprite.scale.setScalar(3 + t * 9); sprite.material.opacity = Math.sin(t * Math.PI) * (lowQuality ? .17 : .24);
      });
    },
  };
}
