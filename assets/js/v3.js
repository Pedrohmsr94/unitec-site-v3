/* Unitec, site v3. Faixa de indicadores, cabeçalho, pivô do método, formulário da conversa, filtros da Unitec News,
   o fio do manifesto e a carga sob demanda do three.js (fundo vivo da abertura e mapa).
   Sem JS, com "reduzir movimento" ou sem WebGL, a página fica parada e completa. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const aqui = document.currentScript ? document.currentScript.src : location.href;
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const estreito = () => matchMedia('(max-width: 760px)').matches;
  const br = (v, c) => v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });

  /* ---------------- Faixa de indicadores ---------------- */
  const faixa = $('[data-faixa]');
  const pausaF = $('[data-faixa-pausa]');
  if (faixa && pausaF) {
    pausaF.addEventListener('click', () => {
      const parada = faixa.classList.toggle('parada');
      pausaF.setAttribute('aria-pressed', String(parada));
      $('use', pausaF).setAttribute('href', parada ? '#i-play' : '#i-pausa');
      $('[data-faixa-pausa-rotulo]', pausaF).textContent = parada ? 'Continuar os indicadores' : 'Pausar os indicadores';
    });
  }
  // A faixa nasce com os números da geração do site; no navegador, o dólar e o tempo das praças se atualizam.
  async function faixaAoVivo() {
    if (!faixa) return;
    try {
      const hoje = new Date(), ini = new Date(hoje.getTime() - 12 * 864e5);
      const mdy = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='${mdy(ini)}'&@dataFinalCotacao='${mdy(hoje)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao`;
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) {
        const v = (await r.json()).value || [];
        if (v.length >= 2) {
          const a = v[v.length - 1], b = v[v.length - 2], dv = (a.cotacaoVenda / b.cotacaoVenda - 1) * 100;
          $$('[data-faixa-vivo="dolar"]').forEach((li) => {
            $('[data-faixa-valor]', li).textContent = `R$ ${br(a.cotacaoVenda, 4)}`;
            const fonte = $('.u-faixa__fonte', li);
            if (fonte) fonte.textContent = `Banco Central, ${a.dataHoraCotacao.slice(8, 10)}/${a.dataHoraCotacao.slice(5, 7)}`;
            const vr = $('[data-faixa-var]', li);
            if (vr && Math.abs(dv) >= 0.005) {
              vr.className = `u-faixa__var ${dv > 0 ? 'u-faixa__var--sobe' : 'u-faixa__var--desce'} tab`;
              vr.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#i-${dv > 0 ? 'sobe' : 'desce'}"></use></svg><span class="sr">${dv > 0 ? 'subiu' : 'caiu'}</span>${br(Math.abs(dv), 2)}%`;
            }
          });
        }
      }
    } catch (e) { /* fica o valor da geração */ }
    try {
      const itens = $$('[data-faixa-tempo]', $('.u-faixa__lista'));
      if (!itens.length) return;
      const lat = itens.map((li) => li.dataset.lat).join(','), lon = itens.map((li) => li.dataset.lon).join(',');
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&daily=precipitation_probability_max&forecast_days=1&timezone=America%2FSao_Paulo`);
      if (!r.ok) return;
      let d = await r.json(); if (!Array.isArray(d)) d = [d];
      itens.forEach((li, i) => {
        const p = d[i]; if (!p) return;
        $$(`[data-faixa-tempo="${li.dataset.faixaTempo}"]`).forEach((el) => {
          $('[data-faixa-temp]', el).textContent = `${Math.round(p.current.temperature_2m)}°`;
          const prob = p.daily && p.daily.precipitation_probability_max ? p.daily.precipitation_probability_max[0] : null;
          if (prob != null) $('[data-faixa-chuva]', el).textContent = `chuva ${prob}% hoje`;
        });
      });
    } catch (e) { /* fica o valor da geração */ }
  }
  if (document.readyState === 'complete') faixaAoVivo(); else addEventListener('load', () => setTimeout(faixaAoVivo, 600));

  /* ---------------- Cabeçalho: sai ao descer, volta ao subir; a faixa fica ---------------- */
  const topo = $('[data-topo]');
  let ultimoY = scrollY, pedido = false;
  function cabecalho() {
    pedido = false;
    if (!topo) return;
    const y = scrollY;
    if (y > 360 && y > ultimoY + 6) topo.classList.add('u-topo--oculto');
    else if (y < ultimoY - 6 || y <= 360) topo.classList.remove('u-topo--oculto');
    ultimoY = y;
  }
  addEventListener('scroll', () => { if (!pedido) { pedido = true; requestAnimationFrame(cabecalho); } }, { passive: true });
  topo && topo.addEventListener('focusin', () => topo.classList.remove('u-topo--oculto'));

  /* ---------------- Pivô do método: o braço gira sempre no mesmo sentido, como um pivô ---------------- */
  const pivo = $('[data-pivo]');
  if (pivo) {
    const abas = $$('[data-etapa]', pivo);
    const paineis = abas.map((a) => document.getElementById(a.getAttribute('aria-controls')));
    const braco = $('[data-pivo-braco]', pivo);
    const nos = $$('[data-no]', pivo);
    const frentes = $$('[data-frente]', pivo);
    // quais frentes cuidam de cada etapa: o próprio painel diz (links de "Quem cuida")
    const cuida = paineis.map((p) => $$('.u-etapa__frentes a', p).map((a) => a.getAttribute('href').split('/').filter(Boolean).pop()));
    const regado = $('[data-pivo-regado]', pivo);
    let atual = 0, angulo = 0, relogio = null, mexeu = false, molhado = 0;
    // a área por onde o braço passou fica tingida, como a água do pivô; depois da volta completa, recomeça do zero
    function rega(ate) {
      if (!regado) return;
      let v = ate % 360;
      if (v === 0 && ate > 0) v = 360;
      const recomeca = () => {
        regado.classList.add('sem-transicao');
        regado.style.strokeDasharray = '0 360';
        regado.getBoundingClientRect();
        regado.classList.remove('sem-transicao');
        regado.style.strokeDasharray = `${v} 360`;
      };
      if (v < molhado) {
        if (molhado < 360) { regado.style.strokeDasharray = '360 360'; setTimeout(recomeca, reduz ? 0 : 650); }
        else recomeca();
      } else {
        regado.style.strokeDasharray = `${v} 360`;
      }
      molhado = v;
    }
    function ir(i, foco) {
      const passos = ((i - atual) % 4 + 4) % 4;
      angulo += passos * 90; atual = i;
      braco && braco.style.setProperty('--ang', `${angulo}deg`);
      rega(angulo);
      abas.forEach((a, k) => { a.setAttribute('aria-selected', String(k === i)); a.tabIndex = k === i ? 0 : -1; });
      paineis.forEach((p, k) => { p.hidden = k !== i; });
      nos.forEach((n, k) => n.classList.toggle('ativo', k === i));
      frentes.forEach((f) => f.classList.toggle('ativa', cuida[i].includes(f.dataset.frente)));
      if (foco) abas[i].focus();
    }
    const parar = () => { mexeu = true; clearInterval(relogio); relogio = null; };
    abas.forEach((a, k) => {
      a.addEventListener('click', () => { parar(); ir(k); });
      a.addEventListener('keydown', (e) => {
        const n = abas.length;
        const alvo = { ArrowRight: (k + 1) % n, ArrowLeft: (k - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
        if (alvo === undefined) return;
        e.preventDefault(); parar(); ir(alvo, true);
      });
    });
    ir(0);
    if (!reduz && 'IntersectionObserver' in window) {
      new IntersectionObserver((es) => {
        const ve = es.some((e) => e.isIntersecting);
        if (ve && !relogio && !mexeu) relogio = setInterval(() => ir((atual + 1) % 4), 5600);
        if (!ve && relogio) { clearInterval(relogio); relogio = null; }
      }, { threshold: 0.45 }).observe($('.u-pivo', pivo) || pivo);
    }
  }

  /* ---------------- A conversa: o formulário vira mensagem pronta no WhatsApp ---------------- */
  $$('[data-conversa]').forEach((form) => {
    const assunto = $('[data-conversa-assunto]', form), msg = $('[data-conversa-msg]', form);
    let escreveu = false;
    msg.addEventListener('input', () => { escreveu = true; });
    assunto.addEventListener('change', () => { if (!escreveu) msg.value = assunto.selectedOptions[0].dataset.msg || ''; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = $('[data-conversa-nome]', form).value.trim();
      const tel = $('[data-conversa-tel]', form).value.trim();
      let texto = msg.value.trim() || 'Olá, Unitec. Vim pelo site e quero conversar com vocês.';
      if (nome) texto = /^Olá, Unitec\./.test(texto) ? texto.replace(/^Olá, Unitec\./, `Olá, Unitec. Aqui é ${nome}.`) : `${nome}: ${texto}`;
      if (tel) texto += `\nMeu telefone: ${tel}`;
      window.open(`https://wa.me/${form.dataset.numero}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    });
  });

  /* ---------------- Unitec News: filtro por editoria (o endereço guarda a escolha) ---------------- */
  const filtros = $$('[data-filtro]');
  if (filtros.length) {
    const materias = $$('[data-ed]');
    const vazio = $('[data-filtro-vazio]');
    function filtra(id, empurra) {
      filtros.forEach((f) => f.setAttribute('aria-pressed', String(f.dataset.filtro === id)));
      let n = 0;
      materias.forEach((m) => { const ve = id === 'todas' || m.dataset.ed === id; m.hidden = !ve; if (ve) n++; });
      if (vazio) vazio.hidden = n > 0;
      if (empurra) {
        const u = new URL(location.href);
        if (id === 'todas') u.searchParams.delete('editoria'); else u.searchParams.set('editoria', id);
        history.replaceState(null, '', u);
      }
    }
    filtros.forEach((f) => f.addEventListener('click', () => filtra(f.dataset.filtro, true)));
    const inicial = new URLSearchParams(location.search).get('editoria');
    filtra(inicial && filtros.some((f) => f.dataset.filtro === inicial) ? inicial : 'todas', false);
  }

  /* ---------------- Manifesto: o fio vermelho desce com a leitura ---------------- */
  const fio = $('[data-fio]');
  const trecho = $('[data-fio-trecho]');
  if (fio && trecho) {
    const caminho = $('path', fio);
    const frases = $$('[data-frase]');
    let total = 0;
    // o fio passa por dentro de cada círculo e faz uma curva entre um e outro, alternando o lado
    function monta() {
      const r = trecho.getBoundingClientRect();
      fio.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
      const nos = frases.map((f) => { const b = $('.u-frase__no', f).getBoundingClientRect(); return [b.left + b.width / 2 - r.left, b.top + b.height / 2 - r.top]; });
      if (!nos.length) return;
      const amp = Math.min(56, r.width * 0.06);
      let d = `M${nos[0][0]} 0 L${nos[0][0]} ${nos[0][1]}`;
      for (let i = 1; i < nos.length; i++) {
        const [x0, y0] = nos[i - 1], [x1, y1] = nos[i], h = y1 - y0, lado = i % 2 ? 1 : -1;
        d += ` C${x0 + amp * lado} ${y0 + h * 0.35}, ${x1 + amp * lado} ${y1 - h * 0.35}, ${x1} ${y1}`;
      }
      const ultimo = nos[nos.length - 1];
      d += ` C${ultimo[0]} ${ultimo[1] + 60}, ${ultimo[0] + amp} ${r.height - 40}, ${ultimo[0] + amp} ${r.height}`;
      caminho.setAttribute('d', d);
      total = caminho.getTotalLength();
      if (!reduz) caminho.style.strokeDasharray = `${total}`;
    }
    function desenha() {
      if (reduz || !total) return;
      const r = trecho.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.6 - r.top) / r.height));
      caminho.style.strokeDashoffset = `${total * (1 - p)}`;
      frases.forEach((f) => { const b = $('.u-frase__no', f).getBoundingClientRect(); f.classList.toggle('tocada', b.top < innerHeight * 0.6); });
    }
    monta(); desenha();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { monta(); desenha(); });
    addEventListener('resize', () => { monta(); desenha(); });
    addEventListener('scroll', () => requestAnimationFrame(desenha), { passive: true });
    if (reduz || !('IntersectionObserver' in window)) frases.forEach((f) => f.classList.add('vista', 'tocada'));
    else {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('vista'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
      frases.forEach((f) => io.observe(f));
    }
  }

  /* ---------------- O tempo: a tela fica e a rolagem troca os três atos ---------------- */
  const tempo = $('[data-travessia]');
  if (tempo && !reduz) {
    tempo.classList.add('vivo');
    const cenas = $$('[data-cena-t]', tempo);
    const vozes = $$('[data-voz]', tempo);
    const pares = $$('[data-par]', tempo);
    const virada = cenas[cenas.length - 1];
    const faixas = [[0, 0.27], [0.27, 0.6], [0.6, 1.01]];
    let pedidoT = false;
    function quadroTempo() {
      pedidoT = false;
      const r = tempo.getBoundingClientRect();
      const total = Math.max(1, r.height - innerHeight);
      const p = Math.min(1, Math.max(0, -r.top / total));
      tempo.style.setProperty('--p', p.toFixed(4));
      cenas.forEach((c, i) => {
        const [a, b] = faixas[i] || [0, 1];
        c.classList.toggle('ativa', p >= a && p < b);
        c.classList.toggle('passou', p >= b);
      });
      const lv = (p - faixas[1][0]) / (faixas[1][1] - faixas[1][0]);
      const iv = Math.min(vozes.length - 1, Math.max(0, Math.floor(lv * vozes.length)));
      vozes.forEach((v, k) => v.classList.toggle('ativa', k === iv));
      const lc = (p - faixas[2][0]) / (1 - faixas[2][0]);
      pares.forEach((q, k) => q.classList.toggle('ativo', lc > 0.06 + k * 0.15));
      if (virada) virada.classList.toggle('fim', lc > 0.58);
    }
    addEventListener('scroll', () => { if (!pedidoT) { pedidoT = true; requestAnimationFrame(quadroTempo); } }, { passive: true });
    addEventListener('resize', quadroTempo);
    quadroTempo();
  }

  /* ---------------- Números que contam ao aparecer (o valor final já está no HTML) ---------------- */
  const contadores = $$('[data-conta]');
  if (contadores.length && !reduz && 'IntersectionObserver' in window) {
    const fmt = (v) => Math.round(v).toLocaleString('pt-BR');
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const el = e.target, fim = Number(el.dataset.conta), dur = fim > 99 ? 2200 : 1500, ini = performance.now();
      const anda = (agora) => {
        const t = Math.min(1, (agora - ini) / dur);
        el.textContent = fmt(fim * (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)));
        if (t < 1) requestAnimationFrame(anda);
      };
      el.textContent = '0';
      requestAnimationFrame(anda);
    }), { threshold: 0.6 });
    contadores.forEach((c) => io.observe(c));
  }

  /* ---------------- Unitec News no WhatsApp: as mensagens chegam uma a uma ---------------- */
  $$('[data-vitrine]').forEach((vitrine) => {
    const msgs = $$('[data-wa-msg]', vitrine);
    const digitando = $('[data-wa-digitando]', vitrine);
    const palco = $('[data-palco]', vitrine);
    const cel = $('[data-cel]', vitrine);
    if (!palco || !msgs.length) return;
    if (reduz || !('IntersectionObserver' in window)) { vitrine.classList.add('vivo'); return; }
    vitrine.classList.add('anima');
    let rodando = false, relogio = null, k = 0;
    function passo() {
      if (!rodando) return;
      if (k < msgs.length) {
        digitando && digitando.classList.add('ativo');
        relogio = setTimeout(() => {
          digitando && digitando.classList.remove('ativo');
          msgs[k].classList.add('chegou');
          k += 1;
          relogio = setTimeout(passo, k === msgs.length ? 6500 : 1300);
        }, 1000);
      } else {
        msgs.forEach((m) => m.classList.add('sai'));
        relogio = setTimeout(() => { msgs.forEach((m) => m.classList.remove('chegou', 'sai')); k = 0; passo(); }, 520);
      }
    }
    new IntersectionObserver((es) => {
      const ve = es.some((e) => e.isIntersecting);
      if (ve) {
        vitrine.classList.add('vivo');
        if (!rodando) { rodando = true; relogio = setTimeout(passo, 600); }
      } else if (rodando) { rodando = false; clearTimeout(relogio); }
    }, { threshold: 0.3 }).observe(palco);
    // o aparelho acompanha o mouse, de leve
    if (cel && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      vitrine.addEventListener('pointermove', (e) => {
        const r = palco.getBoundingClientRect();
        cel.style.setProperty('--px', `${(((e.clientX - r.left) / r.width) - 0.5) * 16}deg`);
        cel.style.setProperty('--py', `${-(((e.clientY - r.top) / r.height) - 0.5) * 10}deg`);
      });
      vitrine.addEventListener('pointerleave', () => { cel.style.setProperty('--px', '0deg'); cel.style.setProperty('--py', '0deg'); });
    }
  });

  /* ---------------- three.js sob demanda ---------------- */
  const conexao = navigator.connection || {};
  const temWebGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  if (reduz || !temWebGL) return;
  const modulo = (nome) => import(new URL(`3d/${nome}.js`, aqui).href);

  const abertura = $('[data-abertura]');
  const dadosAbertura = $('#dados-abertura');
  if (abertura && dadosAbertura && !conexao.saveData && !/(^|-)2g$/.test(conexao.effectiveType || '')) {
    const iniciar = () => modulo('abertura').then((m) => {
      const ui = $('[data-cena]', abertura);
      const rotulo = $('[data-cena-rotulo]', abertura);
      const pontos = $$('[data-cena-ir]', abertura);
      const pausa = $('[data-cena-pausa]', abertura);
      const slides = JSON.parse(dadosAbertura.textContent);
      const ctl = m.iniciar(abertura, slides, {
        estreito: estreito(),
        aoTrocar(i) {
          pontos.forEach((p, k) => (k === i ? p.setAttribute('aria-current', 'true') : p.removeAttribute('aria-current')));
          if (!rotulo) return;
          rotulo.classList.add('troca');
          setTimeout(() => { rotulo.textContent = slides[i].rotulo; rotulo.classList.remove('troca'); }, 380);
        },
        aoComecar() { ui && (ui.hidden = false); },
      });
      if (!ctl) return;
      pontos.forEach((p, k) => p.addEventListener('click', () => ctl.irPara(k)));
      pausa && pausa.addEventListener('click', () => {
        const parado = ctl.alternar();
        pausa.setAttribute('aria-pressed', String(parado));
        $('use', pausa).setAttribute('href', parado ? '#i-play' : '#i-pausa');
        $('[data-cena-pausa-rotulo]', pausa).textContent = parado ? 'Continuar as fotos' : 'Pausar as fotos';
      });
    }).catch(() => {});
    if (document.readyState === 'complete') setTimeout(iniciar, 120); else addEventListener('load', () => setTimeout(iniciar, 120));
  }

  $$('[data-vitrine-fundo]').forEach((tela) => {
    const secao = tela.closest('[data-vitrine]');
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      modulo('circulos').then((m) => { if (m.iniciar(secao, tela)) secao.classList.add('fundo-vivo'); }).catch(() => {});
    }, { rootMargin: '400px 0px' });
    io.observe(secao);
  });

  const mapa = $('[data-mapa]');
  const dadosMapa = $('#dados-mapa');
  if (mapa && dadosMapa && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      modulo('territorio').then((m) => m.iniciar(mapa, JSON.parse(dadosMapa.textContent))).catch(() => {});
    }, { rootMargin: '500px 0px' });
    io.observe(mapa);
  }
})();
