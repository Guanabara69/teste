# Libras Cam — versão web (rodando no navegador do celular)

App de página única que roda 100% no navegador: detecta a mão pela câmera
(MediaPipe), deixa você coletar amostras de cada letra, e reconhece em tempo
real usando um classificador KNN simples (tudo em JavaScript, sem servidor).

## Arquivos
- `index.html` — estrutura e estilo da página
- `app.js` — toda a lógica (câmera, detecção de mão, coleta, reconhecimento)

## Por que precisa de HTTPS
Navegadores de celular só liberam acesso à câmera (`getUserMedia`) em
páginas servidas via **HTTPS** (ou em `localhost`). Abrir o `index.html`
direto como arquivo (`file://`) não funciona. O GitHub Pages resolve isso
de graça, com HTTPS automático.

## Passo a passo — GitHub Pages

1. **Crie um repositório novo no GitHub**
   - Acesse github.com → "New repository"
   - Dê um nome, ex: `libras-cam`
   - Pode deixar público

2. **Suba os dois arquivos** (`index.html` e `app.js`) para o repositório
   - Pelo navegador: na página do repositório, clique em "Add file" →
     "Upload files", arraste os dois arquivos, e clique em "Commit changes"
   - Ou via terminal, se preferir:
     ```bash
     git init
     git add index.html app.js
     git commit -m "primeira versão do Libras Cam"
     git branch -M main
     git remote add origin https://github.com/SEU_USUARIO/libras-cam.git
     git push -u origin main
     ```

3. **Ative o GitHub Pages**
   - No repositório, vá em **Settings** → **Pages** (menu lateral esquerdo)
   - Em "Source", escolha **Deploy from a branch**
   - Em "Branch", escolha **main** e a pasta **/ (root)**
   - Clique em **Save**

4. **Espere ~1 minuto e acesse o link**
   - O GitHub mostra a URL no topo da mesma página de Settings → Pages,
     algo como: `https://SEU_USUARIO.github.io/libras-cam/`
   - Abra esse link no navegador do celular (Chrome ou Safari)

5. **Permita o acesso à câmera** quando o navegador perguntar

## Como usar o app

1. **Aba "Coletar"**: escolha uma letra, posicione a mão fazendo o sinal,
   aperte "Capturar amostra" várias vezes (40-60x por letra), variando
   um pouco o ângulo/distância
2. **Aba "Reconhecer"**: aperte "Iniciar reconhecimento" e teste fazendo
   os sinais — a letra prevista aparece em destaque
3. **Aba "Dados"**: veja quantas amostras você tem de cada letra, exporte
   um backup em `.json`, ou limpe tudo para recomeçar

Os dados ficam salvos no `localStorage` do navegador — ou seja, só nesse
celular/navegador específico. Se limpar os dados do navegador ou trocar
de celular, exporte o backup antes.

## Atualizando o app depois

Sempre que eu (ou você) mudar `index.html` ou `app.js`, é só subir os
arquivos atualizados de novo pro mesmo repositório (substituindo os
antigos) — o GitHub Pages atualiza automaticamente em ~1 minuto.

## Limitações desse protótipo
- Só reconhece **poses estáticas** da mão (não sinais com movimento)
- O classificador é "KNN" simples: ele compara sua mão atual com todas as
  amostras que você coletou e vê quais são mais parecidas. Funciona bem
  com dados suficientes (40+ amostras por letra), mas quanto mais dados,
  melhor a precisão
- Tudo roda no seu celular — nada é enviado para servidores, então o
  desempenho depende do processamento do próprio aparelho
