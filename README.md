# Metal Slug Advance — Web Player

Uma página estática para jogar no navegador usando sua própria ROM de Game Boy Advance. O arquivo é lido localmente; ele não faz parte deste repositório.

## Como jogar

1. Abra a página publicada no GitHub Pages.
2. Clique em **Selecionar ROM** e escolha seu arquivo `.gba`.
3. Aguarde o carregamento e use as setas para movimentar, **Z/X** para A/B, **Enter** para Start e **V** para Select. **Q/E** correspondem a L/R. Os controles podem ser alterados no menu do emulador.
4. Para preservar o progresso, use o salvamento do jogo e exporte uma cópia pelo menu do emulador. Os dados armazenados no navegador podem ser apagados ao limpar seus dados ou mudar de dispositivo.

O emulador é carregado do CDN do [EmulatorJS](https://github.com/EmulatorJS/EmulatorJS), distribuído sob GPL-3.0. É necessária conexão com a internet para carregá-lo. Controles virtuais e gamepads são fornecidos pelo emulador.

## Desenvolvimento local

Execute `python3 -m http.server 8000` nesta pasta e acesse `http://localhost:8000/`. Arquivos `.gba` e saves são ignorados pelo Git.

Esta página não inclui nem distribui o jogo. Metal Slug e demais marcas pertencem a seus respectivos proprietários.
