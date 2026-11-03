# Metal Slug Advance — Web Player

Página estática que roda uma ROM de Game Boy Advance no navegador, via
[EmulatorJS](https://github.com/EmulatorJS/EmulatorJS). A ROM que acompanha a
página é carregada automaticamente: basta clicar em **Iniciar jogo**.

## Como jogar

Clique em **Iniciar jogo** e aguarde o carregamento.

| Teclado | GBA |
| --- | --- |
| ← ↑ ↓ → | Direcional |
| `Z` | A |
| `X` | B |
| `Q` / `E` | L / R |
| `Enter` | Start |
| `V` | Select |

No celular o emulador desenha botões na tela. Gamepads USB/Bluetooth funcionam.
Save state, trapaças e remapeamento ficam no botão **MENU**, na barra abaixo da
tela; **TELA CHEIA** ao lado.

## Estrutura

| Arquivo | Papel |
| --- | --- |
| `index.html` | Título, tela do jogo, barra de botões e legenda de controles |
| `style.css` | Layout: a tela ocupa a maior área possível mantendo 3:2 |
| `app.js` | Baixa, verifica e entrega a ROM ao emulador; controla MENU e tela cheia |
| `favicon.svg` | Ícone |
| `rom.gba` | A ROM carregada automaticamente |

O emulador vem do CDN `cdn.emulatorjs.org` (GPL-3.0), então é preciso internet
para carregá-lo. O jogo em si roda local, no navegador.

### Layout

A `.stage` tem exatamente `100dvh` e distribui a altura entre título, gabinete e
legenda. O gabinete fica dentro de `.console-area`, que é um *container query*
de tamanho: ela recebe toda a sobra de altura e empresta essa medida para a
tela, sem nenhuma constante de página:

```css
--screen-w: max(160px, min(
  100cqw - var(--frame),
  (100cqh - var(--frame) - var(--bar)) * 1.5
));
```

A tela é o maior retângulo 3:2 que cabe na área livre — limitado pela largura ou
pela altura, o que apertar primeiro. `--frame` é o recheio e as bordas do
gabinete; `--bar`, a altura fixa da barra de status. Nunca distorce nem exige
rolagem, e os breakpoints só encolhem título e legenda.

### Menu do emulador

A barra de botões do EmulatorJS reaparece a cada movimento do mouse sobre o
jogo. Acima de 575px de largura ela é uma faixa no rodapé; abaixo disso vira um
painel de 300×260 (`.ejs_small_screen .ejs_menu_bar`) que tapa quase toda a
tela — e, como a tela aqui costuma ser estreita, ele ficava aparecendo o tempo
todo e atrapalhando o jogo.

O CSS esconde a barra e o botão **MENU** é o único jeito de abri-la. Como o
emulador continua marcando a barra como oculta por conta própria (temporizador
de 3s após cada `mousemove`), as regras de exibição precisam de `!important`.

Em tela cheia o `#game` vira o elemento de tela cheia e o botão **MENU** sai de
alcance, então lá a barra volta ao comportamento padrão — daí a classe
`is-fullscreen`, atualizada no evento `fullscreenchange`.

## Verificação da ROM

`app.js` não entrega o arquivo ao emulador sem antes conferi-lo. O cabeçalho do
GBA fica nos primeiros `0xC0` bytes e é o que permite essa checagem:

| Verificação | Critério |
| --- | --- |
| Tamanho | entre `0xC0` e 32 MiB |
| Byte fixo `0xB2` | precisa ser `0x96` |
| Checksum do cabeçalho | `(-(0x19 + Σ bytes 0xA0..0xBC)) & 0xFF` == byte `0xBD` |
| Logotipo da Nintendo | SHA-1 de `0x04..0x9F` igual ao de toda ROM válida |
| Jogo correto | game code em `0xAC..0xAF` == `BSMP` (só para a ROM embutida) |

O SHA-1 usa `crypto.subtle`, disponível apenas em contexto seguro (HTTPS ou
`localhost`). Fora dele a verificação do logotipo é **pulada**, não reprovada.

Download: até 3 tentativas, com `cache: 'reload'` a partir da segunda para
descartar uma cópia corrompida em cache. Só erros recuperáveis são repetidos —
cabeçalho corrompido, logotipo inválido e download incompleto. "Não é uma ROM de
GBA", "ROM inesperada" e "tamanho inválido" dariam o mesmo resultado na segunda
tentativa, então falham de imediato.

Se a ROM não estiver no servidor ou for reprovada, a página oferece um seletor
de arquivo como alternativa, com o motivo da falha na barra de status.

Cenários verificados (todos reprovando como esperado e caindo no seletor):
ROM ausente, byte fixo destruído, logotipo adulterado, checksum inconsistente,
game code de outro jogo e arquivo truncado.

## Rodando localmente

```bash
python3 -m http.server 8000
```

E abra `http://localhost:8000/`. Abrir o `index.html` direto pelo `file://` não
funciona: o `fetch` da ROM e o `crypto.subtle` exigem um servidor.

## Publicação

A ROM (`rom.gba`) acompanha o repositório, para que a página publicada carregue o
jogo sozinha. O `.gitignore` mantém `*.gba` fora do controle de versão e abre
exceção só para ela (`!rom.gba`), de modo que o dump original não entre junto.

GitHub Pages está ligado em `main` / raiz:
<https://leandrodukievicz.github.io/metal-slug-advance-web/>

> Distribuir publicamente uma ROM comercial da SNK sujeita o repositório a
> remoção por DMCA. Decisão consciente do dono do projeto.

## Verificação de funcionamento

Testado de ponta a ponta no navegador: clique em **Iniciar jogo** → abertura →
tela de título → **Start** → FILE SELECT → **A** → SOLDIER SELECT. Os três slots
de save aparecem como `NEW` e avançam normalmente.

A ROM foi conferida contra o dump de referência: CRC32 `3806F4AE`,
SHA-1 `0719aee29b0da365e7ad52bb0ae9545bcd377152`, 8.388.608 bytes — e o arquivo
entregue ao emulador tem o mesmo SHA-1, ou seja, chega íntegro ao core.

### Armadilha ao testar com automação

Testes automatizados de teclado (Playwright `keyboard.press`, por exemplo)
soltam a tecla cerca de 1 ms depois de pressioná-la. O core consulta a entrada
uma vez por frame (~16,7 ms), então um toque assim **não é registrado** e o jogo
parece travado na tela de título. Não é defeito do jogo nem da página.

Dois detalhes para automatizar corretamente:

- Segure a tecla por pelo menos uns 100 ms antes de soltar.
- O EmulatorJS escuta `keydown`/`keyup` no **div pai do emulador**
  (`EJS_emulator.elements.parent`), não em `document` nem em `window`. Eventos
  despachados fora dali são simplesmente ignorados.

## Licença e marcas

Esta página não inclui nem distribui o jogo. Metal Slug e demais marcas
pertencem a seus respectivos proprietários. O emulador é distribuído sob GPL-3.0.
