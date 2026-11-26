/* Fundo vivo da abertura (three.js). Trechos reais das visitas e do escritório se trocam por um campo de círculos que
   nasce de um ponto e cobre a tela (o círculo do brandbook, como os pivôs vistos de cima); cada trecho ganha um empurrão
   lento de câmera; um meio-tom marinho dá textura ao véu do texto. Cena sem vídeo usa foto. Para quando a abertura sai
   da tela, quando a aba fica oculta e no botão de pausa. */
import * as THREE from '../vendor/three.module.min.js';

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D uA;
uniform sampler2D uB;
uniform vec2 uView;
uniform float uAspA;
uniform float uAspB;
uniform vec2 uFocoA;
uniform vec2 uFocoB;
uniform float uZoomA;
uniform float uZoomB;
uniform float uProg;
uniform float uCel;
uniform vec2 uOrigem;
uniform vec3 uMarinho;
uniform float uPontos;

// o mesmo recorte do object-fit: cover + object-position da foto estática de baixo, para a troca não dar salto
vec2 cobrir(vec2 uv, float aspTex, vec2 foco, float zoom) {
  float aspTela = uView.x / uView.y;
  vec2 janela = aspTela > aspTex ? vec2(1.0, aspTex / aspTela) : vec2(aspTela / aspTex, 1.0);
  janela /= zoom;
  vec2 inicio = (1.0 - janela) * vec2(foco.x, 1.0 - foco.y);
  return inicio + uv * janela;
}

void main() {
  vec2 px = vUv * uView;
  vec3 a = texture2D(uA, cobrir(vUv, uAspA, uFocoA, uZoomA)).rgb;
  vec3 b = texture2D(uB, cobrir(vUv, uAspB, uFocoB, uZoomB)).rgb;

  // a troca: círculos que crescem a partir da origem até a cena nova cobrir tudo
  vec2 cel = (floor(px / uCel) + 0.5) * uCel;
  float d = distance(cel, uOrigem * uView) / length(uView);
  float p = clamp(uProg * 1.85 - d * 0.85, 0.0, 1.0);
  p = p * p * (3.0 - 2.0 * p);
  float raio = p * uCel * 0.74;
  float dentro = 1.0 - smoothstep(raio - 1.0, raio + 1.0, distance(px, cel));
  vec3 cor = mix(a, b, dentro);

  // o véu em meio-tom: pontos marinho densos embaixo e à esquerda, que vão rareando
  float g = clamp((0.6 - vUv.y) * 1.45 + (0.36 - vUv.x) * 0.5, 0.0, 1.0);
  float c2 = uCel * 0.42;
  vec2 cel2 = (floor(px / c2) + 0.5) * c2;
  float r2 = g * c2 * 0.64;
  float ponto = 1.0 - smoothstep(r2 - 0.8, r2 + 0.8, distance(px, cel2));
  cor = mix(cor, uMarinho, ponto * uPontos);

  gl_FragColor = vec4(cor, 1.0);
}`;

const TROCA = 1500;          // ms da troca em círculos
const MOSTRA_FOTO = 5600;    // ms de cada foto parada
const EMPURRAO_FOTO = 0.065;
const EMPURRAO_VIDEO = 0.025;

export function iniciar(secao, slides, opcoes = {}) {
  const tela = secao.querySelector('[data-abertura-tela]');
  if (!tela || !slides.length) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: false, alpha: false, powerPreference: 'low-power' });
  } catch (e) { return null; }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // as texturas entram cruas: a cor sai igual à da fonte
  const dpr = Math.min(window.devicePixelRatio || 1, opcoes.estreito ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);

  const u = {
    uA: { value: null }, uB: { value: null },
    uView: { value: new THREE.Vector2(1, 1) },
    uAspA: { value: 1.5 }, uAspB: { value: 1.5 },
    uFocoA: { value: new THREE.Vector2(0.5, 0.5) }, uFocoB: { value: new THREE.Vector2(0.5, 0.5) },
    uZoomA: { value: 1 }, uZoomB: { value: 1 },
    uProg: { value: 0 },
    uCel: { value: 30 * dpr },
    uOrigem: { value: new THREE.Vector2(0.8, 0.66) },
    uMarinho: { value: new THREE.Vector3(10 / 255, 15 / 255, 81 / 255) },
    uPontos: { value: opcoes.estreito ? 0.7 : 0.92 },
  };
  const cena = new THREE.Scene();
  const camera = new THREE.Camera();
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, depthTest: false, depthWrite: false });
  cena.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  const endereco = (rel) => new URL(rel, document.baseURI).href;
  const prepara = (t) => { t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; return t; };
  const carregador = new THREE.TextureLoader();
  function foto(i) {
    const s = slides[i];
    return new Promise((ok, erro) => carregador.load(endereco(opcoes.estreito ? s.estreito : s.largo), (t) => {
      prepara(t);
      ok({ tex: t, asp: t.image.width / t.image.height, mostra: MOSTRA_FOTO, empurrao: EMPURRAO_FOTO });
    }, undefined, erro));
  }
  function video(i) {
    const s = slides[i];
    const v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.src = endereco(opcoes.estreito ? s.video.estreito : s.video.largo);
    return new Promise((ok, erro) => {
      const desiste = setTimeout(() => erro(new Error('o vídeo demorou')), 20000);
      v.addEventListener('error', () => { clearTimeout(desiste); erro(new Error('vídeo indisponível')); }, { once: true });
      v.addEventListener('loadeddata', () => {
        clearTimeout(desiste);
        const t = prepara(new THREE.VideoTexture(v));
        ok({ tex: t, video: v, asp: v.videoWidth / v.videoHeight, mostra: Math.max(2600, v.duration * 1000 - TROCA - 250), empurrao: EMPURRAO_VIDEO });
      }, { once: true });
      v.load();
      // o Safari do iPhone só carrega vídeo criado por script depois de um play(); toca e para logo em seguida
      const p = v.play();
      if (p) p.then(() => { if (!v.dataset.tocando) v.pause(); }).catch(() => {});
    });
  }
  const fontes = new Map();
  function fonte(i) {
    if (fontes.has(i)) return fontes.get(i);
    const pr = slides[i].video ? video(i).catch(() => foto(i)) : foto(i);
    fontes.set(i, pr);
    return pr;
  }
  function solta(f) {
    if (!f) return;
    if (f.video) { f.video.pause(); f.video.removeAttribute('src'); f.video.load(); }
    f.tex.dispose();
  }
  function liberaLonge(manter) {
    for (const [i, pr] of fontes) {
      if (manter.includes(i)) continue;
      pr.then(solta).catch(() => {});
      fontes.delete(i);
    }
  }
  const foco = (i) => slides[i].foco || [0.5, 0.5];

  const caixa = tela.parentElement || secao;   // o palco: a tela toda no computador, a parte de cima no celular
  function tamanho() {
    const w = caixa.clientWidth, h = caixa.clientHeight;
    renderer.setSize(w, h, false);
    const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
    u.uView.value.copy(buf);
    u.uCel.value = (w < 700 ? 22 : 30) * dpr;
  }
  tamanho();
  const ro = new ResizeObserver(() => { tamanho(); desenha(); });
  ro.observe(caixa);

  // relógio próprio: só anda quando a cena está rodando
  let atual = 0, proxima = 1, emTroca = false, inicioA = 0, inicioB = 0, inicioTroca = 0;
  let relogio = 0, ultimo = performance.now(), raf = 0, pausado = false, visivel = true, pronta = false, esperando = false;
  let fA = null, fB = null;

  function poe(slot, i, f) {
    u[`u${slot}`].value = f.tex;
    u[`uAsp${slot}`].value = f.asp || 1.5;
    const fo = foco(i);
    u[`uFoco${slot}`].value.set(fo[0], fo[1]);
  }
  const tocar = (f) => { if (f && f.video) { f.video.dataset.tocando = '1'; if (f.video.paused) { const p = f.video.play(); if (p) p.catch(() => {}); } } };
  const parar = (f) => { if (f && f.video) { delete f.video.dataset.tocando; if (!f.video.paused) f.video.pause(); } };
  function desenha() { if (pronta) renderer.render(cena, camera); }

  function passo(agora) {
    raf = 0;
    const dt = Math.min(100, agora - ultimo);
    ultimo = agora;
    if (!pausado && visivel) relogio += dt;
    if (fA) {
      const vidaA = (relogio - inicioA) / (fA.mostra + TROCA);
      u.uZoomA.value = 1 + fA.empurrao * Math.min(1.4, vidaA);
      if (!emTroca && relogio - inicioA >= fA.mostra && !esperando && slides.length > 1) comecaTroca(proxima);
    }
    if (emTroca && fB) {
      const p = Math.min(1, (relogio - inicioTroca) / TROCA);
      u.uProg.value = p;
      u.uZoomB.value = 1 + fB.empurrao * ((relogio - inicioB) / (fB.mostra + TROCA));
      if (p >= 1) terminaTroca();
    }
    desenha();
    if (!pausado && visivel) raf = requestAnimationFrame(passo);
  }
  function roda() {
    if (pausado || !visivel) { parar(fA); parar(fB); return; }
    tocar(fA);
    if (emTroca) tocar(fB);
    if (!raf && pronta) { ultimo = performance.now(); raf = requestAnimationFrame(passo); }
  }

  // a troca só começa quando o próximo vídeo já mostrou um quadro; se a rede demorar, a cena entra como foto (nunca preta)
  function pronto(i, f) {
    if (!f.video) return Promise.resolve(f);
    const v = f.video;
    v.currentTime = 0;
    tocar(f);
    return new Promise((ok) => {
      let feito = false;
      const vai = (r) => { if (!feito) { feito = true; ok(r); } };
      const quadro = () => { f.tex.needsUpdate = true; vai(f); };
      if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(quadro);
      else v.addEventListener('playing', quadro, { once: true });
      setTimeout(() => { if (!feito) { parar(f); foto(i).then(vai).catch(() => vai(f)); } }, 3500);
    });
  }

  function comecaTroca(i) {
    esperando = true;
    fonte(i).then((f) => pronto(i, f)).then((f) => {
      esperando = false;
      proxima = i;
      fB = f;
      poe('B', i, f);
      tocar(f);
      emTroca = true;
      inicioTroca = relogio;
      inicioB = relogio;
      u.uProg.value = 0;
      u.uOrigem.value.set(0.6 + Math.random() * 0.32, 0.42 + Math.random() * 0.4);
      if (opcoes.aoTrocar) opcoes.aoTrocar(i);
      roda();
    }).catch(() => { esperando = false; proxima = (i + 1) % slides.length; });
  }
  function terminaTroca() {
    emTroca = false;
    const velho = fA;
    atual = proxima;
    fA = fB; fB = null;
    poe('A', atual, fA);
    inicioA = inicioB;
    u.uZoomA.value = u.uZoomB.value;
    u.uProg.value = 0;
    parar(velho);
    proxima = (atual + 1) % slides.length;
    fonte(proxima).catch(() => {});
    liberaLonge([atual, proxima]);
  }

  // começa pela foto estática (o primeiro quadro do primeiro trecho) e vira vídeo quando ele tocar, sem emenda
  foto(0).then((capa) => {
    fA = capa;
    poe('A', 0, capa);
    pronta = true;
    desenha();
    secao.classList.add('viva');
    if (opcoes.aoComecar) opcoes.aoComecar();
    roda();
    if (slides[0].video) {
      fonte(0).then((f) => {
        if (!f.video) return;
        f.video.currentTime = 0;
        tocar(f);
        const vira = () => { fA = f; poe('A', 0, f); inicioA = relogio; capa.tex.dispose(); };
        if ('requestVideoFrameCallback' in f.video) f.video.requestVideoFrameCallback(vira);
        else f.video.addEventListener('playing', vira, { once: true });
      }).catch(() => {});
    }
    if (slides.length > 1) fonte(1).catch(() => {});
  }).catch(() => {});

  new IntersectionObserver((es) => {
    visivel = es.some((e) => e.isIntersecting) && document.visibilityState === 'visible';
    roda();
  }, { threshold: 0.05 }).observe(secao);
  document.addEventListener('visibilitychange', () => {
    visivel = document.visibilityState === 'visible' && secao.getBoundingClientRect().bottom > 0;
    roda();
  });
  tela.addEventListener('webglcontextlost', (e) => { e.preventDefault(); pronta = false; secao.classList.remove('viva'); parar(fA); parar(fB); });

  return {
    irPara(i) {
      if (!pronta || i === atual || emTroca || esperando) return;
      comecaTroca(i);
    },
    alternar() { pausado = !pausado; roda(); return pausado; },
  };
}
