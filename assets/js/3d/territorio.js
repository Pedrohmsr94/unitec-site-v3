/* O mapa "Do sudoeste goiano para o Brasil" em three.js. Começa visto de cima, como o produtor vê a terra no mapa, e
   inclina devagar quando entra na tela: os estados atendidos sobem em relevo e as linhas curvas vermelhas (a linha do
   brandbook) saem de Jataí até cada um. Passar o dedo ou o mouse mostra o nome do estado. Malha de UFs do IBGE. */
import * as THREE from '../vendor/three.module.min.js';

const COR = {
  campo: 0x121a66, campoLado: 0x070b3b,
  atende: 0x232b86, atendeLado: 0x141b6c,
  sede: 0x2f3aa3, sedeLado: 0x1b2387,
  acende: 0x3a46b8,
  vermelho: 0xd41d22,
};
const ALTURA = { campo: 5, atende: 16, sede: 26 };

function lerCaminho(d) {
  const partes = [];
  let atual = null, x = 0, y = 0, cmd = 'M';
  const tk = d.match(/[MmLlZz]|-?\d*\.?\d+/g) || [];
  for (let i = 0; i < tk.length;) {
    const t = tk[i];
    if (/^[MmLlZz]$/.test(t)) {
      cmd = t; i++;
      if (cmd === 'z' || cmd === 'Z') { if (atual && atual.length > 2) partes.push(atual); atual = null; }
      continue;
    }
    const a = parseFloat(tk[i]), b = parseFloat(tk[i + 1]); i += 2;
    if (cmd === 'M') { if (atual && atual.length > 2) partes.push(atual); x = a; y = b; atual = [[x, y]]; cmd = 'L'; }
    else if (cmd === 'm') { if (atual && atual.length > 2) partes.push(atual); x += a; y += b; atual = [[x, y]]; cmd = 'l'; }
    else if (cmd === 'L') { x = a; y = b; atual && atual.push([x, y]); }
    else if (cmd === 'l') { x += a; y += b; atual && atual.push([x, y]); }
  }
  if (atual && atual.length > 2) partes.push(atual);
  return partes;
}

const suave = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

export function iniciar(figura, dados) {
  const tela = figura.querySelector('[data-mapa-tela]');
  const etiqueta = figura.querySelector('[data-mapa-etiqueta]');
  const jataiRotulo = figura.querySelector('.u-mapa__jatai');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  const [, , vw, vh] = dados.viewBox.split(/\s+/).map(Number);
  const cx0 = vw / 2, cy0 = vh / 2;
  const pos = (x, y) => [x - cx0, -(y - cy0)];

  const cena = new THREE.Scene();
  const mapa = new THREE.Group();
  cena.add(mapa);
  const camera = new THREE.PerspectiveCamera(26, 1, 10, 8000);

  const atendidos = new Set(dados.atendidos);
  const estados = [];
  const tampas = [];
  dados.ufs.forEach((u) => {
    const tipo = u.uf === 'GO' ? 'sede' : atendidos.has(u.uf) ? 'atende' : 'campo';
    const altura = ALTURA[tipo];
    const tampa = new THREE.MeshBasicMaterial({ color: COR[tipo] });
    const lado = new THREE.MeshBasicMaterial({ color: COR[`${tipo}Lado`] });
    const grupo = new THREE.Group();
    lerCaminho(u.d).forEach((pts) => {
      const forma = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(...pos(x, y))));
      const geo = new THREE.ExtrudeGeometry(forma, { depth: altura, bevelEnabled: false, curveSegments: 1 });
      const malha = new THREE.Mesh(geo, [tampa, lado]);
      malha.userData.uf = u;
      grupo.add(malha);
      tampas.push(malha);
      const borda = new THREE.BufferGeometry().setFromPoints(pts.concat([pts[0]]).map(([x, y]) => new THREE.Vector3(...pos(x, y), altura + 0.4)));
      grupo.add(new THREE.Line(borda, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: tipo === 'campo' ? 0.16 : 0.5 })));
    });
    mapa.add(grupo);
    estados.push({ u, tipo, altura, tampa, base: COR[tipo] });
  });

  // Jataí e as linhas curvas até os estados atendidos
  const [jx, jy] = dados.jatai;
  const jatai = new THREE.Vector3(...pos(jx, jy), ALTURA.sede + 1);
  const sede = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshBasicMaterial({ color: COR.vermelho }));
  sede.position.copy(jatai).setZ(ALTURA.sede + 1.2);
  const aro = new THREE.Mesh(new THREE.RingGeometry(9, 12.5, 48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  aro.position.copy(sede.position).setZ(ALTURA.sede + 1.1);
  const onda = new THREE.Mesh(new THREE.RingGeometry(13, 15, 48), new THREE.MeshBasicMaterial({ color: COR.vermelho, transparent: true }));
  onda.position.copy(sede.position).setZ(ALTURA.sede + 1);
  mapa.add(sede, aro, onda);

  const linhas = [];
  estados.filter((e) => e.tipo === 'atende').forEach((e, k) => {
    const fim = new THREE.Vector3(...pos(e.u.cx, e.u.cy), e.altura + 1);
    const dist = jatai.distanceTo(fim);
    const meio = jatai.clone().lerp(fim, 0.5).setZ(Math.max(jatai.z, fim.z) + 40 + dist * 0.38);
    const curva = new THREE.QuadraticBezierCurve3(jatai.clone(), meio, fim);
    const geo = new THREE.TubeGeometry(curva, 90, 1.7, 8, false);
    const total = geo.index.count;
    geo.setDrawRange(0, 0);
    const tubo = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: COR.vermelho }));
    const ponto = new THREE.Mesh(new THREE.CircleGeometry(6.5, 32), new THREE.MeshBasicMaterial({ color: COR.vermelho }));
    ponto.position.copy(fim).setZ(e.altura + 1.3);
    ponto.scale.setScalar(0.001);
    mapa.add(tubo, ponto);
    linhas.push({ geo, total, ponto, atraso: 0.35 + k * 0.16 });
  });

  // câmera: começa de cima e inclina
  const centro = new THREE.Vector3(10, -20, 0);
  let inclina = 0, alvoInclina = 0.6, guinada = 0, alvoGuinada = 0, distancia = 2400;
  function enquadra() {
    const w = figura.clientWidth, h = figura.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const altura = 1060, largura = 1000;
    const porAltura = (altura / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const porLargura = (largura / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.aspect;
    distancia = Math.max(porAltura, porLargura) * 1.02;
    camera.updateProjectionMatrix();
  }
  function posicionaCamera() {
    const d = distancia * (1 - inclina * 0.1);
    camera.position.set(
      centro.x + Math.sin(guinada) * d * 0.25,
      centro.y - Math.sin(inclina) * d,
      Math.cos(inclina) * d,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(centro.x, centro.y + inclina * 60, 0);
  }

  const v = new THREE.Vector3();
  function projeta(p3, el) {
    if (!el) return;
    v.copy(p3).applyMatrix4(mapa.matrixWorld).project(camera);
    el.style.left = `${(v.x * 0.5 + 0.5) * figura.clientWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * figura.clientHeight}px`;
  }

  // passar o mouse ou o dedo: o nome do estado
  const raio = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();
  let sobre = null;
  function acende(u) {
    if (sobre === u) return;
    sobre = u;
    estados.forEach((e) => e.tampa.color.setHex(e.u === u ? COR.acende : e.base));
    if (!etiqueta) return;
    if (!u) { etiqueta.hidden = true; return; }
    etiqueta.textContent = atendidos.has(u.uf) ? `${u.nome} · atendido pela Unitec` : u.nome;
    etiqueta.hidden = false;
    const e = estados.find((x) => x.u === u);
    projeta(new THREE.Vector3(...pos(u.cx, u.cy), e.altura), etiqueta);
  }
  function aponta(ev) {
    const r = tela.getBoundingClientRect();
    ponteiro.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    alvoGuinada = ponteiro.x * 0.12;
    raio.setFromCamera(ponteiro, camera);
    const hit = raio.intersectObjects(tampas, false)[0];
    acende(hit ? hit.object.userData.uf : null);
    pede();
  }
  tela.addEventListener('pointermove', aponta);
  tela.addEventListener('pointerdown', aponta);
  tela.addEventListener('pointerleave', () => { alvoGuinada = 0; acende(null); pede(); });

  // laço: anima a entrada; depois só a onda de Jataí, enquanto o mapa está na tela
  let t0 = 0, raf = 0, visivel = false;
  function quadro(agora) {
    raf = 0;
    if (!t0) t0 = agora;
    const t = (agora - t0) / 1000;
    inclina = alvoInclina * suave(t / 2.2);
    guinada += (alvoGuinada - guinada) * 0.08;
    posicionaCamera();
    mapa.updateMatrixWorld();
    linhas.forEach((l) => {
      const p = suave((t - l.atraso) / 1.3);
      l.geo.setDrawRange(0, Math.floor(l.total * p) - (Math.floor(l.total * p) % 3));
      const s = suave((t - l.atraso - 1.1) / 0.4);
      l.ponto.scale.setScalar(Math.max(0.001, s));
    });
    const ciclo = (t % 2.6) / 2.6;
    onda.scale.setScalar(1 + ciclo * 2.4);
    onda.material.opacity = 0.9 * (1 - ciclo);
    projeta(jatai, jataiRotulo);
    if (sobre && etiqueta && !etiqueta.hidden) {
      const e = estados.find((x) => x.u === sobre);
      projeta(new THREE.Vector3(...pos(sobre.cx, sobre.cy), e.altura), etiqueta);
    }
    renderer.render(cena, camera);
    if (visivel) raf = requestAnimationFrame(quadro);
  }
  function pede() { if (!raf) raf = requestAnimationFrame(quadro); }

  enquadra();
  posicionaCamera();
  new ResizeObserver(() => { enquadra(); pede(); }).observe(figura);
  new IntersectionObserver((es) => {
    visivel = es.some((e) => e.isIntersecting);
    if (visivel) pede();
  }, { threshold: 0.15 }).observe(figura);

  renderer.render(cena, camera);
  figura.classList.add('vivo');
  if (jataiRotulo) jataiRotulo.style.transform = 'translate(16px, -135%)';
  tela.addEventListener('webglcontextlost', (e) => { e.preventDefault(); figura.classList.remove('vivo'); });
  return true;
}
