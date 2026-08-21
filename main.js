// ============================================
// CONFIGURAÇÃO INICIAL E CONSTANTES
// ============================================

const WORKER_URL = 'https://sistema-inspecoes.samuelvivi1996.workers.dev';

// GABARITO DA PROVA (4 QUESTÕES)
const GABARITO = {
  q1: 'Borracha',
  q2: 'Todos os dias',
  q3: 'Ir para um ponto mais próximo indicado pela brigada de emergência',
  q4: 'Bloqueada pelo responsável CSN CIMENTOS.'
};

let cpfAtual = '';
let dadosMotoristaAtual = {};
let ultimaInspecaoAtual = null;
let ehPrimeiraVez = false;
let tipoCarregamentoSelecionado = '';

// ============================================
// AUXILIARES DE DOM E ERRO INLINE (CAIXA VERMELHA)
// ============================================

function id(el) {
  return document.getElementById(el);
}

function mostrarErroInline(elementId, mensagem) {
  const elemento = id(elementId);
  if (!elemento) return;

  const container = elemento.closest('.input-group') || elemento.closest('.aceite-container') || elemento.closest('.tipo-carregamento-opcoes') || elemento.parentElement;
  removerErroInline(elementId);

  container.classList.add('has-error');

  const feedback = document.createElement('div');
  feedback.className = 'form-feedback error';
  feedback.innerHTML = `<span>✕</span><span>${mensagem}</span>`;
  container.appendChild(feedback);

  elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (typeof elemento.focus === 'function') {
    elemento.focus();
  }
}

function removerErroInline(elementId) {
  const elemento = id(elementId);
  if (!elemento) return;

  const container = elemento.closest('.input-group') || elemento.closest('.aceite-container') || elemento.closest('.tipo-carregamento-opcoes') || elemento.parentElement;
  container.classList.remove('has-error');

  const feedbackAntigo = container.querySelector('.form-feedback');
  if (feedbackAntigo) feedbackAntigo.remove();
}

function limparTodosErros() {
  document.querySelectorAll('.has-error').forEach(group => {
    group.classList.remove('has-error');
  });
  document.querySelectorAll('.form-feedback').forEach(feedback => {
    feedback.remove();
  });
}

// Remove o erro automaticamente ao digitar ou alterar
document.addEventListener('input', (e) => { if (e.target.id) removerErroInline(e.target.id); });
document.addEventListener('change', (e) => { if (e.target.id) removerErroInline(e.target.id); });

// ============================================
// VALIDAÇÕES
// ============================================

function validarPlaca(placa) {
  const regexPlaca = /^[A-Z]{3}[0-9]{1}[A-Z0-9]{1}[0-9]{2}$/;
  return regexPlaca.test(placa);
}

function validarPedido(pedido) {
  const regexPedido = /^[0-9]{6,9}$/;
  return regexPedido.test(pedido);
}

function validarTelefone(telefone) {
  const regexTelefone = /^[1-9]{2}(?:[2-8][0-9]{7}|9[0-9]{8})$/;
  return regexTelefone.test(telefone);
}

function validarEixos(eixos) {
  const regexEixos = /^[1-9]{1}$/;
  return regexEixos.test(eixos);
}

// ============================================
// ETAPA 1: VERIFICAR CPF E TIPO DE CARREGAMENTO
// ============================================

async function verificarAcesso() {
  limparTodosErros();
  const inputCPF = id('input-cpf');
  const cpf = inputCPF.value.trim().replace(/[^\d]/g, '');

  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) {
    mostrarErroInline('input-cpf', 'CPF inválido! Digite os 11 números corretamente.');
    return;
  }

  cpfAtual = cpf;

  try {
    const response = await fetch(`${WORKER_URL}/api/verificar-cpf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf })
    });

    const resultado = await response.json();

    if (resultado.existe) {
      ehPrimeiraVez = false;
      dadosMotoristaAtual = resultado.dados || {};
      ultimaInspecaoAtual = resultado.ultima_inspecao || null;
      irParaSelecaoCarregamento();
    } else {
      ehPrimeiraVez = true;
      dadosMotoristaAtual = {};
      ultimaInspecaoAtual = null;
      irParaIntegracao();
    }
  } catch (erro) {
    console.error('Erro ao verificar CPF:', erro);
    mostrarErroInline('input-cpf', 'Erro ao conectar com o servidor. Verifique a conexão.');
  }
}

function irParaSelecaoCarregamento() {
  ocultarTodas();
  limparTodosErros();

  // 1. Desmarca qualquer opção de carregamento (FOB / CIF) previamente marcada
  const radiosCarregamento = document.querySelectorAll('input[name="modelo_carregamento"]');
  radiosCarregamento.forEach(radio => radio.checked = false);

  // 2. Limpa o valor digitado nos campos de pedido
  if (id('pedido-fob-input')) id('pedido-fob-input').value = '';
  if (id('pedido-cif-input')) id('pedido-cif-input').value = '';

  // 3. Oculta os containers de pedido
  if (id('container-pedido-fob')) id('container-pedido-fob').style.display = 'none';
  if (id('container-pedido-cif')) id('container-pedido-cif').style.display = 'none';

  // 4. Exibe a tela de seleção limpa
  id('step-tipo-carregamento').classList.remove('hidden');
}

function alternarCamposPedido() {
  limparTodosErros();
  const opcao = document.querySelector('input[name="modelo_carregamento"]:checked')?.value;
  const containerFOB = id('container-pedido-fob');
  const containerCIF = id('container-pedido-cif');
  const inputFOB = id('pedido-fob-input');
  const inputCIF = id('pedido-cif-input');

  if (opcao === 'FOB') {
    containerFOB.style.display = 'block';
    containerCIF.style.display = 'none';
    if (inputCIF) inputCIF.value = '';
    if (inputFOB) inputFOB.focus();
  } else if (opcao === 'CIF') {
    containerCIF.style.display = 'block';
    containerFOB.style.display = 'none';
    if (inputFOB) inputFOB.value = '';
    if (inputCIF) inputCIF.focus();
  } else {
    containerFOB.style.display = 'none';
    containerCIF.style.display = 'none';
  }
}

function confirmarTipoCarregamento() {
  limparTodosErros();
  const opcao = document.querySelector('input[name="modelo_carregamento"]:checked')?.value;

  if (!opcao) {
    mostrarErroInline('step-tipo-carregamento', 'Selecione o Tipo de Carregamento (FOB ou TRANSFERÊNCIA/CIF)!');
    return;
  }

  tipoCarregamentoSelecionado = opcao;

  if (opcao === 'FOB') {
    const pedidoFob = id('pedido-fob-input')?.value.trim();
    if (!validarPedido(pedidoFob)) {
      mostrarErroInline('pedido-fob-input', 'Digite um número de pedido FOB válido (mínimo 6 dígitos)!');
      return;
    }
    irParaInspecao(pedidoFob);

  } else if (opcao === 'CIF') {
    const pedidoCif = id('pedido-cif-input')?.value.trim();
    if (!validarPedido(pedidoCif)) {
      mostrarErroInline('pedido-cif-input', 'Digite um número de pedido CIF/Transferência válido (mínimo 6 dígitos)!');
      return;
    }
    irParaInspecaoCIF(pedidoCif);
  }
}

// ============================================
// AUTO-PREENCHIMENTO DO ÚLTIMO CARREGAMENTO
// ============================================

function preencherUltimoCarregamento() {
  const telefoneMotorista = dadosMotoristaAtual?.telefone || ultimaInspecaoAtual?.telefone || '';

  if (id('telefone') && telefoneMotorista) {
    id('telefone').value = telefoneMotorista;
  }

  if (!ultimaInspecaoAtual) return;

  const dados = ultimaInspecaoAtual;

  if (id('nome') && dados.nome) id('nome').value = dados.nome;
  if (id('cnh') && dados.cnh) id('cnh').value = dados.cnh;
  if (id('placa') && dados.placa) id('placa').value = dados.placa;
  if (id('eixos') && dados.eixos) id('eixos').value = dados.eixos;
  if (id('pedido')) id('pedido').value = '';

  if (dados.tipo_veiculo) {
    const radioTipo = document.querySelector(`input[name="tipo_veiculo"][value="${dados.tipo_veiculo}"]`);
    if (radioTipo) {
      radioTipo.checked = true;
      atualizarCamposPorTipoVeiculo();
    }
  }

  if (id('sinalizacao') && dados.sinalizacao) id('sinalizacao').value = dados.sinalizacao;
  if (id('pneus') && dados.pneus) id('pneus').value = dados.pneus;
  if (id('carroceria') && dados.carroceria) id('carroceria').value = dados.carroceria;
  if (id('cinto') && dados.cinto) id('cinto').value = dados.cinto;
  if (id('farois') && dados.farois) id('farois').value = dados.farois;
  if (id('alarme_re') && dados.alarme_re) id('alarme_re').value = dados.alarme_re;
  if (id('vazamentos') && dados.vazamentos) id('vazamentos').value = dados.vazamentos;
  if (id('calcos') && dados.calcos) id('calcos').value = dados.calcos;
  if (id('tampa_silo') && dados.tampa_silo) id('tampa_silo').value = dados.tampa_silo;

  if (id('epi_capacete') && dados.epi_capacete) id('epi_capacete').value = dados.epi_capacete;
  if (id('epi_colete') && dados.epi_colete) id('epi_colete').value = dados.epi_colete;
  if (id('epi_oculos') && dados.epi_oculos) id('epi_oculos').value = dados.epi_oculos;
  if (id('epi_botina') && dados.epi_botina) id('epi_botina').value = dados.epi_botina;
  if (id('epi_luvas') && dados.epi_luvas) id('epi_luvas').value = dados.epi_luvas;

  if (dados.paletes_opcao) {
    const radioPalete = document.querySelector(`input[name="paletes_opcao"][value="${dados.paletes_opcao}"]`);
    if (radioPalete) {
      radioPalete.checked = true;
      if (dados.paletes_opcao === 'SIM') {
        mostrarQuantidadePaletes();
        if (id('quantidade-paletes') && dados.paletes_quantidade) {
          id('quantidade-paletes').value = dados.paletes_quantidade;
        }
      } else {
        ocultarQuantidadePaletes();
      }
    }
  }
}

// ============================================
// PROVA & INTEGRAÇÃO
// ============================================

function alternarBloqueioProva() {
  const aceiteVideo = id('aceite-video')?.checked;
  const secaoProva = id('secao-prova');

  if (!secaoProva) return;

  if (aceiteVideo) {
    secaoProva.style.opacity = '1';
    secaoProva.style.pointerEvents = 'auto';
  } else {
    secaoProva.style.opacity = '0.5';
    secaoProva.style.pointerEvents = 'none';

    const radios = secaoProva.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => radio.checked = false);
  }
}

async function concluirIntegracao() {
  limparTodosErros();

  const nome = id('reg-nome').value.trim();
  const rg = id('reg-rg').value.trim();
  const telefone = id('reg-telefone').value.trim();
  let placa = id('reg-placa').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  const aceiteVideo = id('aceite-video').checked;
  const aceitePPAE = id('aceite-ppae').checked;
  const aceiteFOB = id('aceite-fob').checked;
  const aceiteLGPD = id('aceite-lgpd')?.checked;

  if (!nome) return mostrarErroInline('reg-nome', 'Informe seu nome completo');
  if (!rg) return mostrarErroInline('reg-rg', 'Informe seu RG');
  if (!telefone || !validarTelefone(telefone)) return mostrarErroInline('reg-telefone', 'Telefone/WhatsApp inválido (com DDD)');
  if (!placa || !validarPlaca(placa)) return mostrarErroInline('reg-placa', 'Placa inválida');

  if (!aceiteVideo) return mostrarErroInline('aceite-video', 'Confirme que assistiu ao VÍDEO DE INTRODUÇÃO');

  const respostas = {
    q1: document.querySelector('input[name="q1"]:checked')?.value,
    q2: document.querySelector('input[name="q2"]:checked')?.value,
    q3: document.querySelector('input[name="q3"]:checked')?.value,
    q4: document.querySelector('input[name="q4"]:checked')?.value
  };

  if (!respostas.q1) return mostrarErroInline('q1-a', 'Responda à questão 1');
  if (!respostas.q2) return mostrarErroInline('q2-a', 'Responda à questão 2');
  if (!respostas.q3) return mostrarErroInline('q3-a', 'Responda à questão 3');
  if (!respostas.q4) return mostrarErroInline('q4-a', 'Responda à questão 4');

  if (!aceitePPAE) return mostrarErroInline('aceite-ppae', 'Aceite o Termo do PPAE');
  if (!aceiteFOB) return mostrarErroInline('aceite-fob', 'Aceite o Termo de Compromisso');
  if (!aceiteLGPD) return mostrarErroInline('aceite-lgpd', 'Aceite a Política de Privacidade (LGPD)');

  let acertos = 0;
  for (let questao in GABARITO) {
    if (respostas[questao] === GABARITO[questao]) acertos++;
  }

  if (acertos === 4) {
    await salvarMotoristaComProva(nome, rg, telefone, placa, respostas);
    dadosMotoristaAtual = { nome, rg, telefone, placa };

    if (id('nome')) id('nome').value = nome;
    if (id('placa')) id('placa').value = placa;
    if (id('telefone')) id('telefone').value = telefone;

    irParaSelecaoCarregamento();
  } else {
    mostrarErroInline('secao-prova', `Você acertou ${acertos}/4 questões. Precisa acertar TODAS as questões para avançar!`);
  }
}

async function salvarMotoristaComProva(nome, rg, telefone, placa, respostas) {
  const aceiteVideo = id('aceite-video').checked;

  try {
    await fetch(`${WORKER_URL}/api/salvar-motorista`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpf: cpfAtual,
        nome, rg, telefone, placa,
        aceite_video: aceiteVideo,
        aceite_ppae: true, aceite_fob: true, aceite_lgpd: true,
        data_aceite: new Date().toISOString(),
        prova_respondida: {
          data: new Date().toISOString(),
          respostas,
          resultado: 'aprovado'
        }
      })
    });
  } catch (erro) {
    console.error('Erro ao salvar motorista:', erro);
  }
}

// ============================================
// CONTROLE DE TIPO DE VEÍCULO E PALETES
// ============================================

function mostrarQuantidadePaletes() {
  const container = id('quantidade-paletes-container');
  if (container) container.style.display = 'block';
}

function ocultarQuantidadePaletes() {
  const container = id('quantidade-paletes-container');
  if (container) container.style.display = 'none';

  const inputQtd = id('quantidade-paletes');
  if (inputQtd) inputQtd.value = '';
}

function atualizarCamposPorTipoVeiculo() {
  const tipoVeiculo = document.querySelector('input[name="tipo_veiculo"]:checked')?.value;
  const containerTampaSilo = id('container-tampa-silo');
  const selectTampaSilo = id('tampa_silo');
  const secaoPaletes = id('secao-paletes');
  const radiosPaletes = document.querySelectorAll('input[name="paletes_opcao"]');

  if (tipoVeiculo === 'CARGA_SECA') {
    if (containerTampaSilo) containerTampaSilo.style.display = 'none';
    if (selectTampaSilo) {
      selectTampaSilo.value = 'NA';
      selectTampaSilo.removeAttribute('required');
    }
    if (secaoPaletes) secaoPaletes.style.display = 'block';
  } else if (tipoVeiculo === 'CARRETA_SILO') {
    if (containerTampaSilo) containerTampaSilo.style.display = 'flex';
    if (selectTampaSilo) {
      selectTampaSilo.value = '';
      selectTampaSilo.setAttribute('required', 'required');
    }
    if (secaoPaletes) secaoPaletes.style.display = 'none';
    radiosPaletes.forEach(radio => radio.checked = false);
    ocultarQuantidadePaletes();
  }
}

document.addEventListener('change', function(e) {
  if (e.target && e.target.name === 'tipo_veiculo') {
    atualizarCamposPorTipoVeiculo();
  }
});

// ============================================
// ETAPA 3A: INSPEÇÃO FOB
// ============================================

async function gerarJSONeToken() {
  limparTodosErros();

  let placaDigitada = id('placa').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let pedidoDigitado = id('pedido').value.trim();
  let eixosDigitados = id('eixos').value.trim();
  let telefoneDigitado = id('telefone').value.trim();
  const tipoVeiculo = document.querySelector('input[name="tipo_veiculo"]:checked')?.value;

  if (!id('nome').value.trim()) return mostrarErroInline('nome', 'Informe o seu nome completo');
  if (!id('cnh').value.trim()) return mostrarErroInline('cnh', 'Informe o número da CNH');
  if (!validarTelefone(telefoneDigitado)) return mostrarErroInline('telefone', 'Telefone/WhatsApp inválido (com DDD)');
  if (!validarPlaca(placaDigitada)) return mostrarErroInline('placa', 'Placa do veículo inválida');
  if (!validarPedido(pedidoDigitado)) return mostrarErroInline('pedido', 'Número de Pedido inválido');
  if (!validarEixos(eixosDigitados)) return mostrarErroInline('eixos', 'Quantidade de eixos inválida');
  if (!tipoVeiculo) return mostrarErroInline('step-inspecao', 'Selecione o tipo do veículo');

  const itensObrigatorios = ['sinalizacao', 'pneus', 'carroceria', 'cinto', 'farois', 'alarme_re', 'vazamentos', 'calcos', 'epi_capacete', 'epi_colete', 'epi_oculos', 'epi_botina', 'epi_luvas'];
  for (let campoId of itensObrigatorios) {
    if (!id(campoId)?.value) return mostrarErroInline(campoId, 'Selecione uma opção');
  }

  let valTampaSilo = id('tampa_silo').value;
  if (tipoVeiculo === 'CARGA_SECA') {
    valTampaSilo = 'NA';
  } else if (!valTampaSilo) {
    return mostrarErroInline('tampa_silo', 'Selecione a condição da tampa do silo');
  }

  let paletesOpcao = document.querySelector('input[name="paletes_opcao"]:checked')?.value;
  let quantidadePaletes = '';

  if (tipoVeiculo === 'CARRETA_SILO') {
    paletesOpcao = 'NA';
  } else if (paletesOpcao === 'SIM') {
    quantidadePaletes = id('quantidade-paletes').value.trim();
    if (!quantidadePaletes) return mostrarErroInline('quantidade-paletes', 'Informe a quantidade de paletes');
  }

  const inspecao = {
    nome: id('nome').value.trim(),
    cnh: id('cnh').value.trim(),
    telefone: telefoneDigitado,
    placa: placaDigitada,
    pedido: pedidoDigitado,
    eixos: eixosDigitados,
    tipo_veiculo: tipoVeiculo,
    sinalizacao: id('sinalizacao').value,
    pneus: id('pneus').value,
    carroceria: id('carroceria').value,
    cinto: id('cinto').value,
    farois: id('farois').value,
    alarme_re: id('alarme_re').value,
    vazamentos: id('vazamentos').value,
    calcos: id('calcos').value,
    tampa_silo: valTampaSilo,
    epi_capacete: id('epi_capacete').value,
    epi_colete: id('epi_colete').value,
    epi_oculos: id('epi_oculos').value,
    epi_botina: id('epi_botina').value,
    epi_luvas: id('epi_luvas').value,
    paletes_opcao: paletesOpcao || 'NA',
    paletes_quantidade: quantidadePaletes || ''
  };

  try {
    const response = await fetch(`${WORKER_URL}/api/salvar-inspecao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: cpfAtual, inspecao_dados: inspecao })
    });

    const resultado = await response.json();

    if (resultado.sucesso) {
      id('form-inspecao').reset();
      id('token-gerado').innerText = resultado.id_inspecao;
      irParaSucesso();
    } else {
      mostrarErroInline('form-inspecao', 'Erro ao salvar inspeção: ' + (resultado.erro || 'Falha no servidor.'));
    }
  } catch (erro) {
    console.error('Erro ao salvar inspeção:', erro);
    mostrarErroInline('form-inspecao', 'Erro de conexão ao salvar inspeção!');
  }
}

// ============================================
// ETAPA 3B: INSPEÇÃO CIF / FCA (32 ITENS)
// ============================================

function alternarCampoTransportadora() {
  const segmento = id('cif-segmento')?.value;
  const containerTransp = id('container-cif-transportadora');
  const selectTransp = id('cif-transportadora');

  if (segmento === 'Transportador') {
    if (containerTransp) containerTransp.style.display = 'block';
    if (selectTransp) selectTransp.setAttribute('required', 'required');
  } else {
    if (containerTransp) containerTransp.style.display = 'none';
    if (selectTransp) {
      selectTransp.value = '';
      selectTransp.removeAttribute('required');
    }
  }
}

async function salvarInspecaoCIF() {
  limparTodosErros();

  const getVal = (idCif, idPadrao) => {
    const elCif = id(idCif);
    if (elCif && elCif.value.trim() !== '') return elCif.value.trim();
    const elPadrao = id(idPadrao);
    if (elPadrao && elPadrao.value.trim() !== '') return elPadrao.value.trim();
    return '';
  };

  const nome = getVal('cif-nome', 'nome') || dadosMotoristaAtual?.nome || '';
  const cnh = getVal('cif-cnh', 'cnh') || dadosMotoristaAtual?.cnh || '';
  const telefone = getVal('cif-telefone', 'telefone') || dadosMotoristaAtual?.telefone || '';
  const placa = (getVal('cif-placa', 'placa') || dadosMotoristaAtual?.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const pedido = getVal('cif-pedido', 'pedido');
  const eixos = getVal('cif-eixos', 'eixos') || ultimaInspecaoAtual?.eixos || '';
  
  const tipoChecklist = id('cif-tipo-checklist')?.value || '';
  const segmento = id('cif-segmento')?.value || '';
  const transportadora = id('cif-transportadora')?.value || '';

  if (!nome) return mostrarErroInline('cif-nome', 'Informe seu nome completo');
  if (!cnh) return mostrarErroInline('cif-cnh', 'Informe a CNH');
  if (!validarTelefone(telefone)) return mostrarErroInline('cif-telefone', 'Telefone/WhatsApp inválido');
  if (!validarPlaca(placa)) return mostrarErroInline('cif-placa', 'Placa inválida');
  if (!validarPedido(pedido)) return mostrarErroInline('cif-pedido', 'Número do pedido inválido');
  if (!validarEixos(eixos)) return mostrarErroInline('cif-eixos', 'Quantidade de eixos inválida');

  if (!tipoChecklist) return mostrarErroInline('cif-tipo-checklist', 'Selecione o Tipo de Checklist CIP');
  if (!segmento) return mostrarErroInline('cif-segmento', 'Selecione o Segmento');
  if (segmento === 'Transportador' && !transportadora) {
    return mostrarErroInline('cif-transportadora', 'Selecione a Transportadora');
  }

  const inspecaoDados = {
    nome, cnh, telefone, placa, pedido, eixos,
    data: new Date().toLocaleDateString('pt-BR'),
    tipo_checklist: tipoChecklist,
    segmento: segmento,
    transportadora: segmento === 'Transportador' ? transportadora : 'N/A'
  };

  for (let i = 1; i <= 32; i++) {
    const elItem = id(`cif-item-${i}`);
    const valorItem = elItem ? elItem.value : '';

    if (!valorItem) {
      return mostrarErroInline(`cif-item-${i}`, `Selecione uma opção para o Item ${i}`);
    }
    inspecaoDados[`item_${i}`] = valorItem;
  }

  try {
    const response = await fetch(`${WORKER_URL}/api/salvar-inspecao-cif`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: cpfAtual, inspecao_dados: inspecaoDados })
    });

    const resultado = await response.json();

    if (resultado.sucesso) {
      const formCIF = id('form-inspecao-cif');
      if (formCIF) formCIF.reset();

      id('token-gerado').innerText = resultado.id_inspecao;
      irParaSucesso();
    } else {
      mostrarErroInline('form-inspecao-cif', 'Erro ao salvar CIF: ' + (resultado.erro || 'Erro no servidor'));
    }
  } catch (erro) {
    console.error('Erro ao salvar CIF:', erro);
    mostrarErroInline('form-inspecao-cif', 'Erro de conexão ao salvar inspeção CIF!');
  }
}

// ============================================
// NAVEGAÇÃO E RESET
// ============================================

function copiarToken() {
  const token = id('token-gerado').innerText;
  navigator.clipboard.writeText(token).then(() => {
    alert('📋 Código copiado com sucesso!');
  });
}

function voltarPaginaAnterior() {
  limparTodosErros();
  const etapaCarregamentoVisivel = !id('step-tipo-carregamento').classList.contains('hidden');
  const etapaInspecaoVisivel = !id('step-inspecao').classList.contains('hidden');
  const etapaInspecaoCIFVisivel = !id('step-inspecao-cif').classList.contains('hidden');

  if (etapaInspecaoVisivel || etapaInspecaoCIFVisivel) {
    irParaSelecaoCarregamento();
  } else if (etapaCarregamentoVisivel && ehPrimeiraVez) {
    irParaIntegracao();
  } else {
    irParaCPF();
  }
}

function irParaCPF() {
  ocultarTodas();
  limparTodosErros();

  if (id('input-cpf')) id('input-cpf').value = '';
  if (id('form-prova')) id('form-prova').reset();
  if (id('form-inspecao')) id('form-inspecao').reset();
  if (id('form-inspecao-cif')) id('form-inspecao-cif').reset();

  // Limpa campos da tela de tipo de carregamento
  const radiosCarregamento = document.querySelectorAll('input[name="modelo_carregamento"]');
  radiosCarregamento.forEach(radio => radio.checked = false);
  if (id('pedido-fob-input')) id('pedido-fob-input').value = '';
  if (id('pedido-cif-input')) id('pedido-cif-input').value = '';
  if (id('container-pedido-fob')) id('container-pedido-fob').style.display = 'none';
  if (id('container-pedido-cif')) id('container-pedido-cif').style.display = 'none';

  // Oculta caixa da transportadora ao resetar
  if (id('container-cif-transportadora')) id('container-cif-transportadora').style.display = 'none';

  ocultarQuantidadePaletes();
  alternarBloqueioProva();

  cpfAtual = '';
  dadosMotoristaAtual = {};
  ultimaInspecaoAtual = null;
  ehPrimeiraVez = false;
  tipoCarregamentoSelecionado = '';

  id('step-cpf').classList.remove('hidden');
}

function irParaIntegracao() {
  ocultarTodas();
  limparTodosErros();

  if (id('form-inspecao')) id('form-inspecao').reset();
  ocultarQuantidadePaletes();
  alternarBloqueioProva();

  id('step-integracao').classList.remove('hidden');
}

function irParaInspecao(numeroPedido) {
  ocultarTodas();
  limparTodosErros();

  id('step-inspecao').classList.remove('hidden');
  preencherUltimoCarregamento();

  // Preenche o pedido vindo da seleção com trava de edição
  if (numeroPedido && id('pedido')) {
    id('pedido').value = numeroPedido;
    id('pedido').readOnly = true;
  }
}

function irParaInspecaoCIF(numeroPedido) {
  ocultarTodas();
  limparTodosErros();

  const nome = dadosMotoristaAtual?.nome || ultimaInspecaoAtual?.nome || '';
  const cnh = dadosMotoristaAtual?.cnh || ultimaInspecaoAtual?.cnh || '';
  const telefone = dadosMotoristaAtual?.telefone || ultimaInspecaoAtual?.telefone || '';
  const placa = dadosMotoristaAtual?.placa || ultimaInspecaoAtual?.placa || '';
  const eixos = ultimaInspecaoAtual?.eixos || '';

  if (id('cif-nome')) id('cif-nome').value = nome;
  if (id('cif-cnh')) id('cif-cnh').value = cnh;
  if (id('cif-telefone')) id('cif-telefone').value = telefone;
  if (id('cif-placa')) id('cif-placa').value = placa;
  if (id('cif-eixos')) id('cif-eixos').value = eixos;

  // Preenche o pedido CIF vindo da seleção
  if (numeroPedido && id('cif-pedido')) {
    id('cif-pedido').value = numeroPedido;
    id('cif-pedido').readOnly = true;
  }

  // Oculta transportadora no inicio
  alternarCampoTransportadora();

  id('step-inspecao-cif').classList.remove('hidden');
}

function irParaSucesso() {
  ocultarTodas();
  id('step-sucesso').classList.remove('hidden');
}

function ocultarTodas() {
  id('step-cpf').classList.add('hidden');
  id('step-integracao').classList.add('hidden');
  if (id('step-tipo-carregamento')) id('step-tipo-carregamento').classList.add('hidden');
  id('step-inspecao').classList.add('hidden');
  if (id('step-inspecao-cif')) id('step-inspecao-cif').classList.add('hidden');
  id('step-sucesso').classList.add('hidden');

  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', irParaCPF);
