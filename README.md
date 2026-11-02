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

No celular o emulador desenha botões na tela. Gamepads USB/Bluetooth funcionam,
e todo o mapeamento pode ser alterado no menu do próprio emulador.

## Estrutura

| Arquivo | Papel |
| --- | --- |
| `index.html` | Título, tela do jogo e legenda de controles |
| `style.css` | Layout: a tela ocupa a maior área possível mantendo 3:2 |
| `app.js` | Baixa, verifica e entrega a ROM ao emulador |
| `favicon.svg` | Ícone |
| `rom.gba` | A ROM (ignorada pelo Git — veja *Publicação*) |

O emulador vem do CDN `cdn.emulatorjs.org` (GPL-3.0), então é preciso internet
para carregá-lo. O jogo em si roda local, no navegador.

### Layout

A tela do jogo é dimensionada pela largura (`aspect-ratio: 3/2`), com um
`max-width` derivado da altura livre da janela:

```css
max-width: calc((100dvh - var(--chrome)) * 1.5 + 26px);
```

`--chrome` é o espaço de título, barra de status e legenda. Assim a tela cresce
o quanto couber, nunca distorce e nunca exige rolagem. Os breakpoints apenas
reajustam `--chrome`.

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

O `.gitignore` exclui `*.gba`. Com isso o repositório **não** distribui o jogo, e
a página publicada cai no seletor de arquivo, onde cada pessoa usa a própria ROM.

Para que a página publicada carregue a ROM sozinha, o arquivo precisaria ir junto
no repositório — o que significa distribuir publicamente uma ROM comercial da
SNK, prática sujeita a remoção por DMCA.

GitHub Pages está ligado em `main` / raiz:
<https://leandrodukievicz.github.io/metal-slug-advance-web/>

## Problema conhecido: o jogo não passa do título

Com esta ROM e o core **mGBA** do EmulatorJS, o jogo carrega e roda a abertura
inteira, mas ao pressionar **Start** na tela de título ele escurece e volta para
o título, em laço.

O que foi apurado:

- A entrada chega ao jogo — a tela de título faz fade-out ao receber o Start.
- A ROM declara `EEPROM_V124` como tipo de save.
- O mGBA **nunca cria** o arquivo de save: `/data/saves/mGBA/` fica vazio.
- Semear um `.srm` de 8192 bytes (EEPROM 8K) e de 512 bytes não mudou nada.
- `EJS_forceLegacyCores = true` não mudou nada.
- Nenhum erro no console do navegador.

Essa é a assinatura típica da checagem de memória de save / antipirataria do
Metal Slug Advance falhando quando o emulador erra o tipo de EEPROM. O mGBA
avulso resolve isso com *save type override* por jogo, mas o core libretro usado
pelo EmulatorJS não expõe essa opção — não há como corrigir pela página.

Caminhos possíveis, em ordem de custo:

1. Testar a mesma ROM num mGBA local (`sudo apt install mgba-sdl`) para separar
   definitivamente "ROM" de "EmulatorJS".
2. Testar outro dump do jogo. O atual: CRC32 `3806F4AE`,
   SHA-1 `0719aee29b0da365e7ad52bb0ae9545bcd377152`.
3. Manter a página como está — ela funciona para outras ROMs de GBA pelo seletor.

## Licença e marcas

Esta página não inclui nem distribui o jogo. Metal Slug e demais marcas
pertencem a seus respectivos proprietários. O emulador é distribuído sob GPL-3.0.
