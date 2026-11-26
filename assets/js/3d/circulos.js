/* Fundo da Unitec News (three.js): os círculos da marca subindo devagar no marinho, uns cheios e outros só no
   contorno, alguns em vermelho — a informação chegando. Fica atrás do texto e do celular, com pouca opacidade, e para
   quando o bloco sai da tela. */
import * as THREE from '../vendor/three.module.min.js';

const VERT = /* glsl */`
attribute float aTam;
attribute float aTipo;
attribute vec3 aCor;
attribute float aAlfa;
varying float vTipo;
varying vec3 vCor;
varying float vAlfa;
uniform float uDpr;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aTam * uDpr * (24.0 / -mv.z);
  vTipo = aTipo; vCor = aCor; vAlfa = aAlfa;
}`;

const FRAG = /* glsl */`
precision mediump float;
varying float vTipo;
varying vec3 vCor;
varying float vAlfa;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float cheio = 1.0 - smoothstep(0.42, 0.5, d);
  float aro = cheio * smoothstep(0.3, 0.37, d);
  float a = mix(cheio, aro, vTipo) * vAlfa;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCor, a);
}`;

export function iniciar(secao, tela) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) { return false; }
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 12;

  const N = 170;
  const pos = new Float32Array(N * 3), tam = new Float32Array(N), tipo = new Float32Array(N), cor = new Float32Array(N * 3), alfa = new Float32Array(N), vel = new Float32Array(N), fase = new Float32Array(N);
  const branco = [1, 1, 1], vermelho = [212 / 255, 29 / 255, 34 / 255];
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 30;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
    pos[i * 3 + 2] = -14 + Math.random() * 16;
    tam[i] = 0.35 + Math.random() * 1.4;
    tipo[i] = Math.random() < 0.45 ? 1 : 0;
    const c = Math.random() < 0.08 ? vermelho : branco;
    cor.set(c, i * 3);
    alfa[i] = c === vermelho ? 0.55 : 0.07 + Math.random() * 0.2;
    vel[i] = 0.25 + Math.random() * 0.55;
    fase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aTam', new THREE.BufferAttribute(tam, 1));
  geo.setAttribute('aTipo', new THREE.BufferAttribute(tipo, 1));
  geo.setAttribute('aCor', new THREE.BufferAttribute(cor, 3));
  geo.setAttribute('aAlfa', new THREE.BufferAttribute(alfa, 1));
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uDpr: { value: dpr } }, transparent: true, depthWrite: false });
  cena.add(new THREE.Points(geo, mat));

  function tamanho() {
    const w = secao.clientWidth, h = secao.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  tamanho();
  new ResizeObserver(tamanho).observe(secao);

  let alvoX = 0, alvoY = 0;
  secao.addEventListener('pointermove', (e) => {
    const r = secao.getBoundingClientRect();
    alvoX = ((e.clientX - r.left) / r.width - 0.5) * 1.6;
    alvoY = -((e.clientY - r.top) / r.height - 0.5) * 1.0;
  });

  let raf = 0, visivel = false, antes = performance.now(), t = 0;
  function quadro(agora) {
    raf = 0;
    const dt = Math.min(0.05, (agora - antes) / 1000);
    antes = agora; t += dt;
    for (let i = 0; i < N; i++) {
      let y = pos[i * 3 + 1] + vel[i] * dt;
      if (y > 9.5) { y = -9.5; pos[i * 3] = (Math.random() - 0.5) * 30; }
      pos[i * 3 + 1] = y;
      pos[i * 3] += Math.sin(t * 0.5 + fase[i]) * 0.0025;
    }
    geo.attributes.position.needsUpdate = true;
    camera.position.x += (alvoX - camera.position.x) * 0.04;
    camera.position.y += (alvoY - camera.position.y) * 0.04;
    camera.lookAt(0, 0, -4);
    renderer.render(cena, camera);
    if (visivel) raf = requestAnimationFrame(quadro);
  }
  new IntersectionObserver((es) => {
    visivel = es.some((e) => e.isIntersecting) && document.visibilityState === 'visible';
    if (visivel && !raf) { antes = performance.now(); raf = requestAnimationFrame(quadro); }
  }, { threshold: 0 }).observe(secao);
  document.addEventListener('visibilitychange', () => {
    visivel = document.visibilityState === 'visible' && secao.getBoundingClientRect().bottom > 0 && secao.getBoundingClientRect().top < innerHeight;
    if (visivel && !raf) { antes = performance.now(); raf = requestAnimationFrame(quadro); }
  });
  tela.addEventListener('webglcontextlost', (e) => { e.preventDefault(); secao.classList.remove('fundo-vivo'); });
  return true;
}
