import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createWorld } from './world';
import { DURATION, ease, getShot, sampleCamera, Timeline } from './cinema';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const svg = (body: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const icons = {
  play: svg('<path d="m9 5 10 7-10 7Z" fill="currentColor" stroke="none"/>'),
  pause: svg('<path d="M8 5v14M16 5v14" stroke-width="3"/>'),
  restart: svg('<path d="M4 10a8 8 0 1 1 1.7 8M4 4v6h6"/>'),
  fullscreen: svg('<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/>'),
};
$('restart').innerHTML = icons.restart; $('fullscreen').innerHTML = icons.fullscreen;
$('retry').onclick = () => location.reload();
function showError(message: string) { $('error-message').textContent = message; $('error').hidden = false; $('loading').classList.add('done'); }
function loading(progress: number, detail: string) { $('loading-bar').style.width = `${progress}%`; $('loading-detail').textContent = detail; }
const nextPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

async function init() {
  loading(10, '准备画布与光线'); await nextPaint();
  const mobile = matchMedia('(max-width: 760px)').matches;
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.info.autoReset = false;
  renderer.domElement.setAttribute('aria-label', '实时三维汤屋，拖动可自由查看');
  renderer.domElement.setAttribute('role', 'img'); $('scene').append(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, .3, 1300);
  loading(25, '搭建木构、屋檐与红桥'); await nextPaint();
  const world = createWorld(scene, mobile);
  loading(75, '点亮窗格，铺开暮色'); await nextPaint();
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .19, .65, 1.16); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const orbit = new OrbitControls(camera, renderer.domElement); orbit.enabled = false; orbit.enableDamping = true; orbit.dampingFactor = .065;
  orbit.enablePan = false; orbit.rotateSpeed = .5; orbit.zoomSpeed = .65; orbit.minDistance = 29; orbit.maxDistance = 145;
  orbit.minPolarAngle = .55; orbit.maxPolarAngle = 1.9; orbit.minAzimuthAngle = -1.25; orbit.maxAzimuthAngle = 1.25;
  const timeline = new Timeline(reducedMotion); let elapsed = 0, previous = performance.now(), running = true;
  const returnPosition = new THREE.Vector3(), returnTarget = new THREE.Vector3(), lookTarget = new THREE.Vector3(); let returnFov = 43;
  let idleTimer: ReturnType<typeof setTimeout>, toastTimer: ReturnType<typeof setTimeout>;
  let lowQuality = mobile, quality: 'auto' | 'high' | 'low' = 'auto';
  let frameCount = 0, frameWindow = performance.now(), fps = 60, frameWindows = 0;
  const app = $('app'), progress = $<HTMLInputElement>('progress'), play = $<HTMLButtonElement>('play');
  const dialog = $<HTMLDialogElement>('help');
  let lastPlaying: boolean | null = null, lastEnded = false, lastMode = '', lastSecond = -1, lastShot = '';

  function toast(message: string) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200); }
  function wakeUI() {
    document.body.classList.remove('ui-idle'); clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (timeline.playing && !dialog.open && !document.querySelector('.experience-controls :focus-visible') && !document.querySelector('.experience-controls:hover')) document.body.classList.add('ui-idle');
    }, 6500);
  }
  function applyQuality() {
    lowQuality = quality === 'low' || (quality === 'auto' && (mobile || fps < 32));
    renderer.setPixelRatio(lowQuality ? Math.min(devicePixelRatio, 1) : Math.min(devicePixelRatio, 1.65));
    world.setQuality(lowQuality); bloom.enabled = !lowQuality;
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
    $('quality').querySelector('span')!.textContent = { auto: '自动', high: '精细', low: '流畅' }[quality];
    app.dataset.quality = lowQuality ? 'low' : 'high';
  }
  function returnToCinema() {
    returnPosition.copy(camera.position); returnTarget.copy(lookTarget); returnFov = camera.fov;
    orbit.enabled = false;
    // Flush residual damping before handing the camera back to the director.
    orbit.enableDamping = false; orbit.update(); orbit.enableDamping = true;
    camera.position.copy(returnPosition); timeline.returnToCinema(); wakeUI();
  }
  function enterExplore() {
    if (timeline.mode === 'explore') return;
    orbit.target.copy(lookTarget); orbit.enabled = true;
    orbit.maxPolarAngle = Math.acos(THREE.MathUtils.clamp((3.5 - orbit.target.y) / camera.position.distanceTo(orbit.target), -1, 1));
    timeline.explore(); orbit.update(); wakeUI();
  }
  function togglePlay() {
    if (timeline.mode !== 'cinema') { returnToCinema(); return; }
    if (timeline.playing) timeline.pause(); else timeline.play(); wakeUI();
  }
  function seek(value: number) {
    const wasPlaying = timeline.playing;
    timeline.seek(value);
    if (timeline.mode !== 'cinema') { orbit.enabled = false; timeline.mode = 'cinema'; timeline.playing = false; }
    else timeline.playing = wasPlaying && !timeline.ended;
    wakeUI();
  }
  function restart() { orbit.enabled = false; timeline.restart(); wakeUI(); }
  play.onclick = togglePlay; $('restart').onclick = restart;
  document.querySelector<HTMLAnchorElement>('.identity')!.onclick = event => { event.preventDefault(); restart(); };
  $('explore').onclick = () => { if (timeline.mode === 'cinema') { enterExplore(); toast('拖动环顾 · 滚轮缩放 · 随时返回电影'); } else returnToCinema(); };
  progress.addEventListener('input', () => seek(Number(progress.value)));
  $('quality').onclick = () => { quality = quality === 'auto' ? 'high' : quality === 'high' ? 'low' : 'auto'; applyQuality(); wakeUI(); toast(`画质已切换为${quality === 'auto' ? '自动适配' : quality === 'high' ? '精细' : '流畅'}`); };
  $('fullscreen').onclick = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { toast('当前浏览器暂不支持全屏'); }
  };
  document.addEventListener('fullscreenchange', () => $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? '退出全屏' : '进入全屏'));
  $('help-toggle').onclick = () => { timeline.pause(); dialog.showModal(); wakeUI(); };
  $('help-close').onclick = () => dialog.close();
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  dialog.addEventListener('close', wakeUI);
  renderer.domElement.addEventListener('pointerdown', () => { enterExplore(); }, { capture: true });
  renderer.domElement.addEventListener('wheel', () => enterExplore(), { capture: true, passive: true });
  window.addEventListener('pointermove', wakeUI, { passive: true }); window.addEventListener('pointerdown', wakeUI, { passive: true });
  window.addEventListener('keydown', event => {
    wakeUI();
    if (dialog.open || event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement) return;
    if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
    if (event.code === 'ArrowRight' || event.code === 'ArrowLeft') { event.preventDefault(); seek(timeline.time + (event.code === 'ArrowRight' ? 5 : -5)); }
  });
  motionQuery.addEventListener('change', event => { reducedMotion = event.matches; if (reducedMotion) timeline.pause(); wakeUI(); });
  document.addEventListener('visibilitychange', () => { previous = performance.now(); frameWindow = previous; frameCount = 0; });
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); wakeUI();
  });
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); running = false; showError('图形上下文已中断。请关闭占用显存较多的页面后重试。'); });
  renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());

  function updateUI() {
    if (timeline.playing !== lastPlaying || timeline.ended !== lastEnded) {
      if (timeline.ended && !lastEnded) wakeUI();
      play.innerHTML = timeline.playing ? icons.pause : icons.play;
      play.setAttribute('aria-label', timeline.playing ? '暂停' : timeline.ended ? '重新播放' : '播放'); lastPlaying = timeline.playing; lastEnded = timeline.ended;
    }
    if (lastMode !== timeline.mode) {
      const exploring = timeline.mode !== 'cinema';
      $('explore-label').textContent = exploring ? '返回电影' : '自由探索';
      $('mode-label').innerHTML = `<i></i>${timeline.mode === 'returning' ? '回到旅程' : exploring ? '自由查看' : '电影漫游'}`;
      lastMode = timeline.mode;
    }
    const seconds = Math.floor(timeline.time);
    if (seconds !== lastSecond) { $('elapsed').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; lastSecond = seconds; }
    progress.value = String(timeline.time);
    progress.style.setProperty('--progress', `${timeline.time / DURATION * 100}%`);
    progress.setAttribute('aria-valuetext', `${Math.floor(timeline.time)} 秒，共 72 秒`);
    const shot = getShot(timeline.time);
    if (lastShot !== shot.title) { $('chapter').textContent = shot.title; $('shot-caption').textContent = shot.caption; lastShot = shot.title; }
    document.body.classList.toggle('immersed', timeline.time > 11 || timeline.mode !== 'cinema');
    app.dataset.mode = timeline.mode; app.dataset.time = timeline.time.toFixed(2); app.dataset.playing = String(timeline.playing);
  }
  function render(now: number) {
    if (!running) return;
    requestAnimationFrame(render);
    if (document.hidden) { previous = now; return; }
    const dt = Math.min((now - previous) / 1000, .1); previous = now; elapsed += dt;
    timeline.tick(dt);
    const pose = sampleCamera(timeline.time, camera.aspect);
    if (timeline.mode === 'cinema') {
      camera.position.copy(pose.position); lookTarget.copy(pose.target); camera.lookAt(lookTarget); camera.fov = pose.fov;
    } else if (timeline.mode === 'returning') {
      const t = ease(timeline.returnElapsed / 1.2);
      camera.position.lerpVectors(returnPosition, pose.position, t);
      lookTarget.lerpVectors(returnTarget, pose.target, t); camera.lookAt(lookTarget); camera.fov = THREE.MathUtils.lerp(returnFov, pose.fov, t);
    } else {
      orbit.maxPolarAngle = Math.acos(THREE.MathUtils.clamp((3.5 - orbit.target.y) / camera.position.distanceTo(orbit.target), -.99, .99));
      orbit.update(); camera.position.y = Math.max(3.5, camera.position.y); lookTarget.copy(orbit.target);
    }
    camera.updateProjectionMatrix(); world.update(elapsed, timeline.time / DURATION, reducedMotion); updateUI();
    renderer.info.reset(); composer.render(); frameCount++;
    if (now - frameWindow >= 2000) {
      fps = frameCount * 1000 / (now - frameWindow); app.dataset.fps = fps.toFixed(1);
      app.dataset.drawCalls = String(renderer.info.render.calls); app.dataset.triangles = String(renderer.info.render.triangles);
      frameCount = 0; frameWindow = now; frameWindows++;
      if (quality === 'auto' && !lowQuality && fps < 32 && frameWindows >= 3) { applyQuality(); toast('已根据设备性能调整画质'); }
    }
  }
  applyQuality();
  const initial = sampleCamera(0, camera.aspect); camera.position.copy(initial.position); lookTarget.copy(initial.target); camera.lookAt(lookTarget); camera.fov = initial.fov; camera.updateProjectionMatrix();
  world.update(0, 0, reducedMotion); updateUI();
  loading(95, '旅程即将开始');
  await renderer.compileAsync(scene, camera); composer.render(); await nextPaint();
  loading(100, '准备就绪'); $('loading').classList.add('done');
  setTimeout(() => $('loading').remove(), 1600);
  app.dataset.ready = 'true'; app.dataset.instances = String(world.instances);
  previous = performance.now(); frameWindow = previous; requestAnimationFrame(render); wakeUI();
  if (reducedMotion) toast('已减少动态效果，点击播放开始旅程');
  window.addEventListener('pagehide', () => { running = false; clearTimeout(idleTimer); clearTimeout(toastTimer); orbit.dispose(); composer.dispose(); renderer.dispose(); });
}
init().catch(error => { console.error(error); showError('无法启动 WebGL 三维画面。请使用支持 WebGL 2 的新版 Chrome、Edge 或 Safari，并开启浏览器硬件加速。'); });
