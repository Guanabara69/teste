import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const CHAVE_LOCALSTORAGE = "libras_dataset_v1";
const LETRAS = ["A","B","C","D","E","F","I","L","O","P","S","T","U","V","W","Y"];
// Deixamos de fora letras que em Libras envolvem movimento (H, J, K, M, N, Q, R, X, Z...)
// já que esse protótipo reconhece poses estáticas da mão.

const K_VIZINHOS = 5;
const CONFIANCA_MINIMA = 0.55;

let dataset = carregarDataset();
let letraSelecionada = LETRAS[0];
let handLandmarker = null;

function carregarDataset(){
  try{
    const bruto = localStorage.getItem(CHAVE_LOCALSTORAGE);
    return bruto ? JSON.parse(bruto) : [];
  }catch(e){ return []; }
}
function salvarDataset(){
  localStorage.setItem(CHAVE_LOCALSTORAGE, JSON.stringify(dataset));
}

function normalizarLandmarks(pontos){
  const origem = pontos[0];
  const relativos = pontos.map(p => ({ x: p.x - origem.x, y: p.y - origem.y, z: p.z - origem.z }));
  let maiorDist = 1e-6;
  for(const p of relativos){
    const d = Math.sqrt(p.x*p.x + p.y*p.y + p.z*p.z);
    if(d > maiorDist) maiorDist = d;
  }
  const vetor = [];
  for(const p of relativos){ vetor.push(p.x/maiorDist, p.y/maiorDist, p.z/maiorDist); }
  return vetor;
}

function distancia(a, b){
  let soma = 0;
  for(let i=0;i<a.length;i++){ const d = a[i]-b[i]; soma += d*d; }
  return Math.sqrt(soma);
}

function preverLetra(vetor){
  if(dataset.length === 0) return null;
  const distancias = dataset.map(amostra => ({ letra: amostra.letra, d: distancia(vetor, amostra.vetor) }));
  distancias.sort((a,b) => a.d - b.d);
  const vizinhos = distancias.slice(0, Math.min(K_VIZINHOS, distancias.length));
  const votos = {};
  for(const v of vizinhos){ votos[v.letra] = (votos[v.letra] || 0) + 1; }
  let melhorLetra = null, melhorQtd = 0;
  for(const letra in votos){ if(votos[letra] > melhorQtd){ melhorQtd = votos[letra]; melhorLetra = letra; } }
  const confianca = melhorQtd / vizinhos.length;
  return { letra: melhorLetra, confianca };
}

async function criarHandLandmarker(){
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  return await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 1
  });
}

async function iniciarCamera(videoEl){
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 640 } },
    audio: false
  });
  videoEl.srcObject = stream;
  await new Promise(resolve => { videoEl.onloadedmetadata = resolve; });
  return stream;
}

function desenharMao(ctx, largura, altura, pontos){
  ctx.clearRect(0,0,largura,altura);
  if(!pontos) return;
  const CONEXOES = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
    [5,9],[9,13],[13,17]
  ];
  ctx.strokeStyle = "#f2c14e";
  ctx.lineWidth = 3;
  for(const [a,b] of CONEXOES){
    ctx.beginPath();
    ctx.moveTo(pontos[a].x*largura, pontos[a].y*altura);
    ctx.lineTo(pontos[b].x*largura, pontos[b].y*altura);
    ctx.stroke();
  }
  ctx.fillStyle = "#e8633c";
  for(const p of pontos){
    ctx.beginPath();
    ctx.arc(p.x*largura, p.y*altura, 4, 0, Math.PI*2);
    ctx.fill();
  }
}

function ajustarCanvas(canvas, video){
  canvas.width = video.clientWidth;
  canvas.height = video.clientHeight;
}

// ===== COLETAR =====
const videoColetar = document.getElementById("video-coletar");
const canvasColetar = document.getElementById("canvas-coletar");
const ctxColetar = canvasColetar.getContext("2d");
const statusColetar = document.getElementById("status-coletar");
const btnCapturar = document.getElementById("btn-capturar");
const gradeLetras = document.getElementById("grade-letras");

let ultimosLandmarksColetar = null;

function montarGradeLetras(){
  gradeLetras.innerHTML = "";
  for(const letra of LETRAS){
    const div = document.createElement("div");
    div.className = "botao-letra" + (letra === letraSelecionada ? " selecionada" : "");
    div.dataset.letra = letra;
    const qtd = dataset.filter(a => a.letra === letra).length;
    div.innerHTML = `${letra}<span class="qtd">${qtd}</span>`;
    div.addEventListener("click", () => { letraSelecionada = letra; montarGradeLetras(); });
    gradeLetras.appendChild(div);
  }
}

function loopColetar(){
  if(canvasColetar.width !== videoColetar.clientWidth) ajustarCanvas(canvasColetar, videoColetar);
  const agora = performance.now();
  const resultado = handLandmarker.detectForVideo(videoColetar, agora);

  if(resultado.landmarks && resultado.landmarks.length > 0){
    ultimosLandmarksColetar = resultado.landmarks[0];
    desenharMao(ctxColetar, canvasColetar.width, canvasColetar.height, ultimosLandmarksColetar);
    statusColetar.textContent = "Mão detectada — pronto para capturar";
    statusColetar.className = "marcador-status ok";
    btnCapturar.disabled = false;
  } else {
    ultimosLandmarksColetar = null;
    ctxColetar.clearRect(0,0,canvasColetar.width, canvasColetar.height);
    statusColetar.textContent = "Nenhuma mão detectada";
    statusColetar.className = "marcador-status aviso";
    btnCapturar.disabled = true;
  }
  requestAnimationFrame(loopColetar);
}

btnCapturar.addEventListener("click", () => {
  if(!ultimosLandmarksColetar) return;
  const vetor = normalizarLandmarks(ultimosLandmarksColetar);
  dataset.push({ letra: letraSelecionada, vetor });
  salvarDataset();
  montarGradeLetras();
  montarListaClasses();
  btnCapturar.textContent = "Capturado ✓";
  setTimeout(() => btnCapturar.textContent = "Capturar amostra", 350);
});

// ===== RECONHECER =====
const videoReconhecer = document.getElementById("video-reconhecer");
const canvasReconhecer = document.getElementById("canvas-reconhecer");
const ctxReconhecer = canvasReconhecer.getContext("2d");
const statusReconhecer = document.getElementById("status-reconhecer");
const btnReconhecer = document.getElementById("btn-reconhecer");
const letraPrevista = document.getElementById("letra-prevista");
const confiancaPrevista = document.getElementById("confianca-prevista");

let reconhecendo = false;
let streamReconhecer = null;
let historicoVotos = [];

async function alternarReconhecimento(){
  if(!reconhecendo){
    if(dataset.length === 0){
      statusReconhecer.textContent = "Colete amostras na aba 1 antes de reconhecer";
      statusReconhecer.className = "marcador-status erro";
      return;
    }
    streamReconhecer = await iniciarCamera(videoReconhecer);
    reconhecendo = true;
    btnReconhecer.textContent = "Parar reconhecimento";
    statusReconhecer.textContent = "Reconhecendo…";
    statusReconhecer.className = "marcador-status ok";
    loopReconhecer();
  } else {
    reconhecendo = false;
    if(streamReconhecer) streamReconhecer.getTracks().forEach(t => t.stop());
    btnReconhecer.textContent = "Iniciar reconhecimento";
    statusReconhecer.textContent = "Parado";
    statusReconhecer.className = "marcador-status aviso";
    letraPrevista.textContent = "—";
    confiancaPrevista.textContent = "aguardando…";
  }
}

function loopReconhecer(){
  if(!reconhecendo) return;
  if(canvasReconhecer.width !== videoReconhecer.clientWidth) ajustarCanvas(canvasReconhecer, videoReconhecer);

  const agora = performance.now();
  const resultado = handLandmarker.detectForVideo(videoReconhecer, agora);

  if(resultado.landmarks && resultado.landmarks.length > 0){
    const pontos = resultado.landmarks[0];
    desenharMao(ctxReconhecer, canvasReconhecer.width, canvasReconhecer.height, pontos);

    const vetor = normalizarLandmarks(pontos);
    const previsao = preverLetra(vetor);

    if(previsao && previsao.confianca >= CONFIANCA_MINIMA){
      historicoVotos.push(previsao.letra);
    } else {
      historicoVotos.push(null);
    }
    if(historicoVotos.length > 10) historicoVotos.shift();

    const validos = historicoVotos.filter(v => v !== null);
    if(validos.length > 0){
      const contagem = {};
      for(const v of validos) contagem[v] = (contagem[v]||0)+1;
      let melhor = validos[0];
      for(const k in contagem) if(contagem[k] > contagem[melhor]) melhor = k;
      letraPrevista.textContent = melhor;
      confiancaPrevista.textContent = `confiança ${(previsao.confianca*100).toFixed(0)}%`;
    } else {
      letraPrevista.textContent = "?";
      confiancaPrevista.textContent = "mão detectada, confiança baixa";
    }
  } else {
    ctxReconhecer.clearRect(0,0,canvasReconhecer.width, canvasReconhecer.height);
    letraPrevista.textContent = "—";
    confiancaPrevista.textContent = "nenhuma mão detectada";
  }

  requestAnimationFrame(loopReconhecer);
}

btnReconhecer.addEventListener("click", alternarReconhecimento);

// ===== DADOS =====
const listaClasses = document.getElementById("lista-classes");
const btnExportar = document.getElementById("btn-exportar");
const btnImportar = document.getElementById("btn-importar");
const btnLimpar = document.getElementById("btn-limpar");
const inputArquivo = document.getElementById("input-arquivo");

function montarListaClasses(){
  listaClasses.innerHTML = "";
  const contagem = {};
  for(const a of dataset) contagem[a.letra] = (contagem[a.letra]||0)+1;
  const letras = Object.keys(contagem).sort();
  if(letras.length === 0){
    listaClasses.innerHTML = `<span class="texto-fraco">Nenhuma amostra coletada ainda.</span>`;
    return;
  }
  for(const letra of letras){
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = `${letra}: ${contagem[letra]}`;
    listaClasses.appendChild(chip);
  }
}

btnExportar.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(dataset)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "libras_dataset.json";
  a.click();
  URL.revokeObjectURL(url);
});

btnImportar.addEventListener("click", () => inputArquivo.click());
inputArquivo.addEventListener("change", (e) => {
  const arquivo = e.target.files[0];
  if(!arquivo) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    try{
      const importado = JSON.parse(leitor.result);
      if(Array.isArray(importado)){
        dataset = dataset.concat(importado);
        salvarDataset();
        montarGradeLetras();
        montarListaClasses();
        alert("Dados importados com sucesso.");
      }
    }catch(err){
      alert("Arquivo inválido.");
    }
  };
  leitor.readAsText(arquivo);
});

btnLimpar.addEventListener("click", () => {
  if(confirm("Tem certeza? Isso apaga todas as amostras coletadas neste navegador.")){
    dataset = [];
    salvarDataset();
    montarGradeLetras();
    montarListaClasses();
  }
});

// ===== Navegação entre abas =====
const abas = document.querySelectorAll(".aba");
abas.forEach(aba => {
  aba.addEventListener("click", () => {
    abas.forEach(a => a.classList.remove("ativa"));
    aba.classList.add("ativa");
    document.querySelectorAll(".secao").forEach(s => s.classList.remove("ativa"));
    document.getElementById("secao-" + aba.dataset.aba).classList.add("ativa");
  });
});

// ===== Inicialização =====
async function iniciar(){
  montarGradeLetras();
  montarListaClasses();

  try{
    handLandmarker = await criarHandLandmarker();
  }catch(e){
    statusColetar.textContent = "Erro ao carregar o modelo de detecção. Verifique sua conexão.";
    statusColetar.className = "marcador-status erro";
    return;
  }

  try{
    await iniciarCamera(videoColetar);
    statusColetar.textContent = "Procurando mão…";
    loopColetar();
  }catch(e){
    statusColetar.textContent = "Não foi possível acessar a câmera. Verifique as permissões.";
    statusColetar.className = "marcador-status erro";
  }
}

iniciar();
