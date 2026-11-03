(() => {
  const ROM_URL = 'rom.gba';
  const MAX_ATTEMPTS = 3;
  const MAX_SIZE = 32 * 1024 * 1024;
  const HEADER_SIZE = 0xC0;
  // Metal Slug Advance (Europe). O cabeçalho do GBA guarda isso em 0xAC-0xAF.
  const EXPECTED_GAME_CODE = 'BSMP';
  // SHA-1 do logotipo da Nintendo (0x04-0x9F), idêntico em toda ROM de GBA válida.
  const LOGO_SHA1 = '17daa0fec02fc33c0f6abb549a8b80b6613b48ee';
  // Falhas que um novo download pode resolver. As demais (arquivo que não é
  // GBA, jogo diferente, tamanho absurdo) seriam idênticas na segunda tentativa.
  const RETRYABLE = new Set(['CABEÇALHO CORROMPIDO', 'ROM CORROMPIDA', 'DOWNLOAD INCOMPLETO']);

  const launch = document.querySelector('#launch');
  const game = document.querySelector('#game');
  const status = document.querySelector('#status');
  const startButton = document.querySelector('#start-button');
  const fallback = document.querySelector('#fallback');
  const fallbackNote = document.querySelector('#fallback-note');
  const input = document.querySelector('#rom-input');
  const menuButton = document.querySelector('#menu-button');
  const fullscreenButton = document.querySelector('#fullscreen-button');
  const consoleBox = document.querySelector('.console');
  let started = false;

  const setStatus = (text) => { status.textContent = text; };

  // O CSS mantém a barra do EmulatorJS escondida; a classe abaixo é o que a
  // revela. As chamadas ao emulador só mantêm o estado interno dele alinhado
  // (cancelar o auto-ocultar, fechar submenus abertos).
  const setMenuOpen = (open) => {
    game.classList.toggle('menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    const menu = window.EJS_emulator?.menu;
    if (open) menu?.open(true);
    else menu?.close();
  };

  // Reserva (ou devolve) a faixa onde o gamepad virtual cabe fora da tela. O
  // tamanho da tela depende dela, então o emulador precisa remedir depois.
  const syncPad = (visible) => {
    if (consoleBox.classList.contains('has-pad') === visible) return;
    consoleBox.classList.toggle('has-pad', visible);
    window.EJS_emulator?.handleResize?.();
  };

  // O emulador mostra e esconde o gamepad por vários caminhos (configuração,
  // tipo de aparelho), então o que vale é o estado do próprio elemento.
  let watchedPad = null;
  const watchPad = () => {
    const pad = window.EJS_emulator?.virtualGamepad;
    if (!pad || pad === watchedPad) return;
    watchedPad = pad;
    // handleResize exibe o gamepad por 250ms só para medi-lo, e nesse intervalo
    // deixa a opacidade em 0: é o que separa a medição de uma exibição real.
    const visible = () => pad.style.display !== 'none' && pad.style.opacity !== '0';
    new MutationObserver(() => syncPad(visible()))
      .observe(pad, { attributes: true, attributeFilter: ['style'] });
    syncPad(visible());
  };

  const showPlayerButtons = (visible) => {
    menuButton.hidden = !visible;
    fullscreenButton.hidden = !visible;
    if (!visible) setMenuOpen(false);
  };

  menuButton.addEventListener('click', () => {
    setMenuOpen(!game.classList.contains('menu-open'));
  });

  // Clicar no jogo fecha o menu, como numa barra de verdade.
  document.addEventListener('pointerdown', (event) => {
    if (!game.classList.contains('menu-open')) return;
    const target = event.target;
    if (menuButton.contains(target)) return;
    if (target.closest?.('.ejs_menu_bar, .ejs_popup_container')) return;
    setMenuOpen(false);
  });

  // Em tela cheia o botão MENU fica fora de alcance, então a barra do emulador
  // volta a se comportar como de costume.
  document.addEventListener('fullscreenchange', () => {
    const full = document.fullscreenElement === game;
    game.classList.toggle('is-fullscreen', full);
    if (full) setMenuOpen(false);
  });

  fullscreenButton.addEventListener('click', () => {
    const emulator = window.EJS_emulator;
    const leaving = !!document.fullscreenElement;
    setMenuOpen(false);
    try {
      if (emulator?.toggleFullscreen) emulator.toggleFullscreen(!leaving);
      else if (leaving) document.exitFullscreen();
      else game.requestFullscreen();
    } catch {
      // Dentro de um iframe sem permissão de tela cheia não há o que fazer.
    }
  });

  const askForFile = (reason) => {
    setStatus(reason);
    fallbackNote.textContent = `${reason}. Selecione seu arquivo .gba.`;
    startButton.hidden = true;
    fallback.hidden = false;
  };

  const toHex = (buffer) =>
    [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

  // Só roda em contexto seguro (https/localhost); fora dele devolve null e a
  // verificação do logotipo é pulada em vez de reprovar a ROM por engano.
  const logoIsValid = async (bytes) => {
    if (!globalThis.crypto?.subtle) return null;
    try {
      const digest = await crypto.subtle.digest('SHA-1', bytes.subarray(0x04, 0xA0));
      return toHex(digest) === LOGO_SHA1;
    } catch {
      return null;
    }
  };

  // Devolve null quando a ROM está íntegra, ou o motivo da reprovação.
  const findProblem = async (bytes, { expectGameCode }) => {
    if (bytes.length < HEADER_SIZE || bytes.length > MAX_SIZE) return 'TAMANHO INVÁLIDO';
    if (bytes[0xB2] !== 0x96) return 'NÃO É UMA ROM DE GBA';

    let sum = 0;
    for (let i = 0xA0; i <= 0xBC; i += 1) sum += bytes[i];
    if (((-(0x19 + sum)) & 0xFF) !== bytes[0xBD]) return 'CABEÇALHO CORROMPIDO';

    if ((await logoIsValid(bytes)) === false) return 'ROM CORROMPIDA';

    if (expectGameCode) {
      const code = String.fromCharCode(...bytes.subarray(0xAC, 0xB0));
      if (code !== expectGameCode) return `ROM INESPERADA (${code})`;
    }
    return null;
  };

  const download = async (url, bypassCache) => {
    const res = await fetch(url, { cache: bypassCache ? 'reload' : 'default' });
    if (!res.ok) throw new Error(res.status === 404 ? 'ROM NÃO ENCONTRADA' : `HTTP ${res.status}`);

    // Com content-encoding o content-length é do corpo comprimido, então ele
    // não serve nem para progresso nem para conferir se o download completou.
    const encoded = !!res.headers.get('content-encoding');
    const total = encoded ? 0 : Number(res.headers.get('content-length')) || 0;
    const reader = res.body?.getReader();
    if (!reader) return new Uint8Array(await res.arrayBuffer());

    const chunks = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      if (total) setStatus(`BAIXANDO ${Math.floor((loaded / total) * 100)}%`);
    }
    if (total && loaded !== total) throw new Error('DOWNLOAD INCOMPLETO');

    const bytes = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  };

  const boot = (gameUrl) => {
    started = true;
    launch.hidden = true;
    game.hidden = false;
    setStatus('CARREGANDO EMULADOR');
    window.EJS_player = '#game';
    window.EJS_core = 'gba';
    window.EJS_gameUrl = gameUrl;
    window.EJS_gameName = 'Metal Slug Advance';
    window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
    window.EJS_color = '#d6f05b';
    window.EJS_startOnLoaded = true;
    window.EJS_ready = () => {
      showPlayerButtons(true);
      watchPad();
    };
    window.EJS_onGameStart = () => {
      setStatus('EM JOGO');
      watchPad();
    };
    const script = document.createElement('script');
    script.src = window.EJS_pathtodata + 'loader.js';
    script.onerror = () => {
      started = false;
      launch.hidden = false;
      game.hidden = true;
      showPlayerButtons(false);
      syncPad(false);
      setStatus('FALHA AO CARREGAR EMULADOR');
    };
    document.body.appendChild(script);
  };

  const bootVerified = async (bytes, expectGameCode) => {
    setStatus('VERIFICANDO ROM');
    const problem = await findProblem(bytes, { expectGameCode });
    if (problem) return problem;
    boot(URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' })));
    return null;
  };

  startButton.addEventListener('click', async () => {
    if (started) return;
    startButton.disabled = true;

    let lastError = 'FALHA NO DOWNLOAD';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      setStatus(attempt === 1 ? 'BAIXANDO ROM' : `TENTANDO NOVAMENTE (${attempt}/${MAX_ATTEMPTS})`);
      try {
        // Uma cópia corrompida pode estar em cache, então as retentativas
        // buscam a ROM de novo direto no servidor.
        const bytes = await download(ROM_URL, attempt > 1);
        const problem = await bootVerified(bytes, EXPECTED_GAME_CODE);
        if (!problem) return;
        lastError = problem;
        if (!RETRYABLE.has(problem)) break;
      } catch (error) {
        lastError = error.message;
        if (lastError === 'ROM NÃO ENCONTRADA') break;
      }
    }

    startButton.disabled = false;
    askForFile(lastError);
  });

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file || started) return;
    if (file.size > MAX_SIZE) {
      setStatus('ARQUIVO GRANDE DEMAIS');
      input.value = '';
      return;
    }
    setStatus('LENDO ARQUIVO');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const problem = await bootVerified(bytes, null);
    if (problem) {
      setStatus(problem);
      fallbackNote.textContent = `${problem}. Selecione outro arquivo .gba.`;
      input.value = '';
    }
  });
})();
