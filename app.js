(() => {
  const input = document.querySelector('#rom-input');
  const launch = document.querySelector('#launch');
  const game = document.querySelector('#game');
  const status = document.querySelector('#status');
  let started = false;

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file || started) return;
    if (!file.name.toLowerCase().endsWith('.gba')) {
      status.textContent = 'SELECIONE UM ARQUIVO .GBA';
      input.value = '';
      return;
    }
    if (file.size < 192 || file.size > 32 * 1024 * 1024) {
      status.textContent = 'ARQUIVO GBA INVÁLIDO';
      input.value = '';
      return;
    }
    started = true;
    launch.hidden = true;
    game.hidden = false;
    status.textContent = 'CARREGANDO EMULADOR';
    window.EJS_player = '#game';
    window.EJS_core = 'gba';
    window.EJS_gameUrl = URL.createObjectURL(file);
    window.EJS_gameName = 'Metal Slug Advance';
    window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
    window.EJS_color = '#d6f05b';
    window.EJS_startOnLoaded = true;
    window.EJS_onGameStart = () => { status.textContent = 'EM JOGO'; };
    const script = document.createElement('script');
    script.src = window.EJS_pathtodata + 'loader.js';
    script.onerror = () => {
      status.textContent = 'FALHA AO CARREGAR EMULADOR';
      launch.hidden = false;
      game.hidden = true;
      started = false;
      input.value = '';
      URL.revokeObjectURL(window.EJS_gameUrl);
    };
    document.body.appendChild(script);
  });
})();
