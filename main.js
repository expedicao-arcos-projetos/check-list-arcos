// ============================================
// CONFIGURAÇÃO INICIAL E CONSTANTES
// ============================================

const WORKER_URL = 'https://sistema-inspecoes.samuelvivi1996.workers.dev';

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

function id(el) {
  return document.getElementById(el);
}

function mostrarErroInline(elementId, mensagem) {
  const elemento = id(elementId);
  if (!elemento) return;

  const container = elemento.closest('.input-group') || elemento.closest('.aceite-container') || elemento.parentElement;
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

  const container = elemento.closest('.input-group') || elemento.closest('.aceite-container') || elemento.parentElement;
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

function resetarCamposReadOnly() {
  const inputPedidoFOB = id('pedido');
  const inputPedidoCIF = id('cif-pedido');

  if (inputPedidoFOB) {
    inputPedidoFOB.readOnly = false;
    inputPedidoFOB.value = '';
  }

  if (inputPedidoCIF) {
    inputPedidoCIF.readOnly = false;
    inputPedidoCIF.value = '';
  }
}

document.addEventListener('input', (e) => { if (e.target.id) removerErroInline(e.target.id); });
document.addEventListener('change', (e) => { if (e.target.id) removerErroInline(e.target.id); });

// VALIDAÇÕES
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
// VERIFICAR CPF
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
      body: JSON.stringify({ cpf: cpfAtual })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
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
    console.error('Erro:', erro);
    mostrarErroInline('input-cpf', 'Erro ao conectar. Verifique internet.');
  }
}

function irParaSelecaoCarregamento() {
  ocultarTodas();
  limparTodosErros();
  resetarCamposReadOnly();

  document.querySelectorAll('input[name="modelo_carregamento"]').forEach(radio => radio.checked = false);

  if (id('pedido-fob-input')) id('pedido-fob-input').value = '';
  if (id('pedido-cif-input')) id('pedido-cif-input').value = '';
  if (id('container-pedido-fob')) id('container-pedido-fob').style.display = 'none';
  if (id('container-pedido-cif')) id('container-pedido-cif').style.display = 'none';

  id('step-tipo-carregamento').classList.remove('hidden');
}

function alternarCamposPedido() {
  limparTodosErros();
  const opcao = document.querySelector('input[name="modelo_carregamento"]:checked')?.value;

  if (opcao === 'FOB') {
    const fobContainer = id('container-pedido-fob');
    const cifContainer = id('container-pedido-cif');
    if (fobContainer) fobContainer.style.display = 'block';
    if (cifContainer) cifContainer.style.display = 'none';
    if (id('pedido-cif-input')) id('pedido-cif-input').value = '';
  } else if (opcao === 'CIF') {
    const fobContainer = id('container-pedido-fob');
    const cifContainer = id('container-pedido-cif');
    if (cifContainer) cifContainer.style.display = 'block';
    if (fobContainer) fobContainer.style.display = 'none';
    if (id('pedido-fob-input')) id('pedido-fob-input').value = '';
  }
}

function confirmarTipoCarregamento() {
  limparTodosErros();
  const opcao = document.querySelector('input[name="modelo_carregamento"]:checked')?.value;

  if (!opcao) {
    mostrarErroInline('step-tipo-carregamento', 'Selecione FOB ou TRANSFERÊNCIA/CIF!');
    return;
  }

  tipoCarregamentoSelecionado = opcao;

  if (opcao === 'FOB') {
    const pedidoFob = id('pedido-fob-input')?.value.trim();
    if (!validarPedido(pedidoFob)) {
      mostrarErroInline('pedido-fob-input', 'Pedido FOB inválido (mín. 6 dígitos)!');
      return;
    }
    irParaInspecao(pedidoFob);
  } else if (opcao === 'CIF') {
    const pedidoCif = id('pedido-cif-input')?.value.trim();
    if (!validarPedido(pedidoCif)) {
      mostrarErroInline('pedido-cif-input', 'Pedido CIF inválido (mín. 6 dígitos)!');
      return;
    }
    irParaInspecaoCIF(pedidoCif);
  }
}

// ============================================
// PROVA & INTEGRAÇÃO
// ============================================

function alternarBloqueioProva() {
  const aceiteVideo = id('aceite-video')?.checked;
  const secaoProva = id('secao-prova');

  if (secaoProva) {
    if (aceiteVideo) {
      secaoProva.style.opacity = '1';
      secaoProva.style.pointerEvents = 'auto';
    } else {
      secaoProva.style.opacity = '0.5';
      secaoProva.style.pointerEvents = 'none';
      secaoProva.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
    }
  }
}

async function concluirIntegracao() {
  limparTodosErros();

  const nome = id('reg-nome').value.trim();
  const rg = id('reg-rg').value.trim();
  const telefone = id('reg-telefone').value.trim();
  let placa = id('reg-placa').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!nome) return mostrarErroInline('reg-nome', 'Informe seu nome completo');
  if (!rg) return mostrarErroInline('reg-rg', 'Informe seu RG');
  if (!validarTelefone(telefone)) return mostrarErroInline('reg-telefone', 'Telefone inválido');
  if (!validarPlaca(placa)) return mostrarErroInline('reg-placa', 'Placa inválida');
  if (!id('aceite-video').checked) return mostrarErroInline('aceite-video', 'Confirme vídeo');

  const respostas = {
    q1: document.querySelector('input[name="q1"]:checked')?.value,
    q2: document.querySelector('input[name="q2"]:checked')?.value,
    q3: document.querySelector('input[name="q3"]:checked')?.value,
    q4: document.querySelector('input[name="q4"]:checked')?.value
  };

  if (!respostas.q1) return mostrarErroInline('q1-a', 'Responda questão 1');
  if (!respostas.q2) return mostrarErroInline('q2-a', 'Responda questão 2');
  if (!respostas.q3) return mostrarErroInline('q3-a', 'Responda questão 3');
  if (!respostas.q4) return mostrarErroInline('q4-a', 'Responda questão 4');

  if (!id('aceite-ppae').checked) return mostrarErroInline('aceite-ppae', 'Aceite PPAE');
  if (!id('aceite-fob').checked) return mostrarErroInline('aceite-fob', 'Aceite Segurança');
  if (!id('aceite-lgpd').checked) return mostrarErroInline('aceite-lgpd', 'Aceite LGPD');

  let acertos = 0;
  for (let questao in GABARITO) {
    if (respostas[questao] === GABARITO[questao]) acertos++;
  }

  if (acertos === 4) {
    await salvarMotoristaComProva(nome, rg, telefone, placa, respostas);
    irParaSelecaoCarregamento();
  } else {
    mostrarErroInline('secao-prova', `Acertou ${acertos}/4. Precisa acertar TODAS!`);
  }
}

async function salvarMotoristaComProva(nome, rg, telefone, placa, respostas) {
  try {
    await fetch(`${WORKER_URL}/api/salvar-motorista`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpf: cpfAtual, nome, rg, telefone, placa,
        aceite_video: true, aceite_ppae: true, aceite_fob: true, aceite_lgpd: true,
        data_aceite: new Date().toISOString(),
        prova_respondida: { data: new Date().toISOString(), respostas, resultado: 'aprovado' }
      })
    });
  } catch (erro) {
    console.error('Erro ao salvar:', erro);
  }
}

// ============================================
// PALETES E TIPO VEÍCULO (FOB)
// ============================================

function mostrarQuantidadePaletes() {
  const container = id('quantidade-paletes-container');
  if (container) container.style.display = 'block';
}

function ocultarQuantidadePaletes() {
  const container = id('quantidade-paletes-container');
  const input = id('quantidade-paletes');
  if (container) container.style.display = 'none';
  if (input) input.value = '';
}

function atualizarCamposPorTipoVeiculo() {
  const tipoVeiculo = document.querySelector('input[name="tipo_veiculo"]:checked')?.value;
  const containerTampaSilo = id('container-tampa-silo');
  const selectTampaSilo = id('tampa_silo');
  const secaoPaletes = id('secao-paletes');

  if (tipoVeiculo === 'CARGA_SECA') {
    if (containerTampaSilo) containerTampaSilo.style.display = 'none';
    if (selectTampaSilo) { selectTampaSilo.value = 'NA'; selectTampaSilo.removeAttribute('required'); }
    if (secaoPaletes) secaoPaletes.style.display = 'block';
  } else if (tipoVeiculo === 'CARRETA_SILO') {
    if (containerTampaSilo) containerTampaSilo.style.display = 'flex';
    if (selectTampaSilo) { selectTampaSilo.value = ''; selectTampaSilo.setAttribute('required', 'required'); }
    if (secaoPaletes) secaoPaletes.style.display = 'none';
    document.querySelectorAll('input[name="paletes_opcao"]').forEach(radio => radio.checked = false);
    ocultarQuantidadePaletes();
  }
}

document.addEventListener('change', function(e) {
  if (e.target.name === 'tipo_veiculo') atualizarCamposPorTipoVeiculo();
});

// ============================================
// INSPEÇÃO FOB
// ============================================

function preencherUltimoCarregamento() {
  if (ultimaInspecaoAtual) {
    const dados = ultimaInspecaoAtual;
    
    // Dados básicos
    if (id('nome')) id('nome').value = dados.nome || '';
    if (id('cnh')) id('cnh').value = dados.cnh || '';
    if (id('placa')) id('placa').value = dados.placa || '';
    if (id('telefone')) id('telefone').value = dados.telefone || '';
    if (id('eixos')) id('eixos').value = dados.eixos || '';
    
    // NÃO preenche pedido - comentado propositalmente
    // if (id('pedido')) id('pedido').value = dados.pedido || '';
    
    // Itens de Inspeção (conformes, não conformes, N/A)
    const itensInspecao = [
      'sinalizacao', 'pneus', 'carroceria', 'cinto', 'farois', 
      'alarme_re', 'vazamentos', 'calcos', 'tampa_silo',
      'epi_capacete', 'epi_colete', 'epi_oculos', 'epi_botina', 'epi_luvas'
    ];
    
    itensInspecao.forEach(item => {
      if (dados[item] && id(item)) {
        id(item).value = dados[item];
      }
    });
    
    // Paletes (se tiver)
    if (dados.paletes_opcao) {
      const radioPalete = document.querySelector(`input[name="paletes_opcao"][value="${dados.paletes_opcao}"]`);
      if (radioPalete) {
        radioPalete.checked = true;
        if (dados.paletes_opcao === 'SIM') {
          mostrarQuantidadePaletes();
          if (id('quantidade-paletes')) id('quantidade-paletes').value = dados.paletes_quantidade || '';
        }
      }
    }
  }
}

function preencherUltimoCIF() {
  if (ultimaInspecaoAtual) {
    const dados = ultimaInspecaoAtual;
    
    // Dados básicos
    if (id('cif-nome')) id('cif-nome').value = dados.nome || '';
    if (id('cif-cnh')) id('cif-cnh').value = dados.cnh || '';
    if (id('cif-telefone')) id('cif-telefone').value = dados.telefone || '';
    if (id('cif-placa')) id('cif-placa').value = dados.placa || '';
    if (id('cif-eixos')) id('cif-eixos').value = dados.eixos || '';
    
    // NÃO preenche pedido
    // if (id('cif-pedido')) id('cif-pedido').value = dados.pedido || '';
    
    // Preenche os 32 itens CIF (SIM/NÃO/N/A)
    for (let i = 1; i <= 32; i++) {
      const itemId = `cif-item-${i}`;
      const itemEl = id(itemId);
      if (itemEl && dados[`item_${i}`]) {
        itemEl.value = dados[`item_${i}`];
      }
    }
    
    // Paletes CIF (se tiver)
    if (dados.paletes_opcao && dados.paletes_opcao !== 'N/A') {
      const radioPalete = document.querySelector(`input[name="cif_paletes_opcao"][value="${dados.paletes_opcao}"]`);
      if (radioPalete) {
        radioPalete.checked = true;
        if (dados.paletes_opcao === 'SIM') {
          alternarQtdPaletesCIF(true);
          if (id('cif-qtd-paletes')) id('cif-qtd-paletes').value = dados.paletes_quantidade || '';
        }
      }
    }
  }
}

async function gerarJSONeToken() {
  limparTodosErros();

  const nome = id('nome').value.trim();
  const cnh = id('cnh').value.trim();
  let placa = id('placa').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const pedido = id('pedido').value.trim();
  const eixos = id('eixos').value.trim();
  const telefone = id('telefone').value.trim();

  if (!nome) return mostrarErroInline('nome', 'Informe nome');
  if (!cnh) return mostrarErroInline('cnh', 'Informe CNH');
  if (!validarTelefone(telefone)) return mostrarErroInline('telefone', 'Telefone inválido');
  if (!validarPlaca(placa)) return mostrarErroInline('placa', 'Placa inválida');
  if (!validarPedido(pedido)) return mostrarErroInline('pedido', 'Pedido inválido');
  if (!validarEixos(eixos)) return mostrarErroInline('eixos', 'Eixos inválido');

  const itensObrigatorios = ['sinalizacao', 'pneus', 'carroceria', 'cinto', 'farois', 'alarme_re', 'vazamentos', 'calcos', 'epi_capacete', 'epi_colete', 'epi_oculos', 'epi_botina', 'epi_luvas'];
  for (let campo of itensObrigatorios) {
    if (!id(campo).value) return mostrarErroInline(campo, 'Selecione opção');
  }

  const inspecao = {
    nome, cnh, placa, pedido, eixos, telefone,
    sinalizacao: id('sinalizacao').value,
    pneus: id('pneus').value,
    carroceria: id('carroceria').value,
    cinto: id('cinto').value,
    farois: id('farois').value,
    alarme_re: id('alarme_re').value,
    vazamentos: id('vazamentos').value,
    calcos: id('calcos').value,
    tampa_silo: id('tampa_silo').value || 'NA',
    epi_capacete: id('epi_capacete').value,
    epi_colete: id('epi_colete').value,
    epi_oculos: id('epi_oculos').value,
    epi_botina: id('epi_botina').value,
    epi_luvas: id('epi_luvas').value,
    paletes_opcao: document.querySelector('input[name="paletes_opcao"]:checked')?.value || 'NA',
    paletes_quantidade: id('quantidade-paletes')?.value || ''
  };

  try {
    const response = await fetch(`${WORKER_URL}/api/salvar-inspecao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: cpfAtual, inspecao_dados: inspecao })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const resultado = await response.json();

    if (resultado.sucesso) {
      id('token-gerado').innerText = resultado.id_inspecao;
      irParaSucesso();
    } else {
      mostrarErroInline('form-inspecao', 'Erro: ' + (resultado.erro || 'Servidor'));
    }
  } catch (erro) {
    console.error('Erro:', erro);
    mostrarErroInline('form-inspecao', 'Erro conexão!');
  }
}

// ============================================
// CIF / PALETES E TRANSPORTADORA
// ============================================

function alternarCampoTransportadora() {
  const segmento = id('cif-segmento')?.value;
  const containerTransp = id('container-cif-transportadora');

  if (!containerTransp) return;

  if (segmento === 'Transportador') {
    containerTransp.style.display = 'block';
  } else {
    containerTransp.style.display = 'none';
    if (id('cif-transportadora')) id('cif-transportadora').value = '';
  }
}

function atualizarCamposCIF() {
  const tipoVeiculo = document.querySelector('input[name="cif_tipo_veiculo"]:checked')?.value;
  const secaoPaletes = id('secao-paletes-cif');

  if (!secaoPaletes) return;

  if (tipoVeiculo === 'CARGA_SECA') {
    secaoPaletes.style.display = 'block';
  } else {
    secaoPaletes.style.display = 'none';
    document.querySelectorAll('input[name="cif_paletes_opcao"]').forEach(radio => radio.checked = false);
    alternarQtdPaletesCIF(false);
  }
}

function alternarQtdPaletesCIF(mostrar) {
  const container = id('container-qtd-paletes-cif');
  const inputQtd = id('cif-qtd-paletes');
  
  if (container) container.style.display = mostrar ? 'block' : 'none';
  if (!mostrar && inputQtd) inputQtd.value = '';
}

async function salvarInspecaoCIF() {
  limparTodosErros();

  const nome = id('cif-nome')?.value.trim() || (ultimaInspecaoAtual?.nome || '');
  const cnh = id('cif-cnh')?.value.trim() || (ultimaInspecaoAtual?.cnh || '');
  const telefone = id('cif-telefone')?.value.trim() || (ultimaInspecaoAtual?.telefone || '');
  let placa = (id('cif-placa')?.value.trim() || (ultimaInspecaoAtual?.placa || '')).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const pedido = id('cif-pedido')?.value.trim();
  const eixos = id('cif-eixos')?.value.trim() || (ultimaInspecaoAtual?.eixos || '');
  const tipoChecklist = id('cif-tipo-checklist')?.value;
  const segmento = id('cif-segmento')?.value;
  const transportadora = segmento === 'Transportador' ? id('cif-transportadora')?.value : 'N/A';

  if (!nome) return mostrarErroInline('cif-nome', 'Informe nome');
  if (!cnh) return mostrarErroInline('cif-cnh', 'Informe CNH');
  if (!validarTelefone(telefone)) return mostrarErroInline('cif-telefone', 'Telefone inválido');
  if (!validarPlaca(placa)) return mostrarErroInline('cif-placa', 'Placa inválida');
  if (!validarPedido(pedido)) return mostrarErroInline('cif-pedido', 'Pedido inválido');
  if (!validarEixos(eixos)) return mostrarErroInline('cif-eixos', 'Eixos inválido');
  if (!tipoChecklist) return mostrarErroInline('cif-tipo-checklist', 'Selecione checklist');
  if (!segmento) return mostrarErroInline('cif-segmento', 'Selecione segmento');
  if (segmento === 'Transportador' && !transportadora) return mostrarErroInline('cif-transportadora', 'Selecione transportadora');

  let paletesOpcao = 'N/A';
  let paletesQtd = 'N/A';
  const tipoVeiculo = document.querySelector('input[name="cif_tipo_veiculo"]:checked')?.value;

  if (!tipoVeiculo) return mostrarErroInline('step-inspecao-cif', 'Selecione tipo veículo');

  if (tipoVeiculo === 'CARGA_SECA') {
    paletesOpcao = document.querySelector('input[name="cif_paletes_opcao"]:checked')?.value;
    if (!paletesOpcao) return mostrarErroInline('secao-paletes-cif', 'Selecione paletes');
    if (paletesOpcao === 'SIM') {
      paletesQtd = id('cif-qtd-paletes')?.value.trim();
      if (!paletesQtd) return mostrarErroInline('cif-qtd-paletes', 'Informe quantidade');
    }
  }

  const inspecaoDados = {
    nome, cnh, placa, pedido, eixos, telefone,
    tipo_checklist: tipoChecklist, segmento, transportadora,
    paletes_opcao: paletesOpcao, paletes_quantidade: paletesQtd
  };

  for (let i = 1; i <= 32; i++) {
    const val = id(`cif-item-${i}`)?.value;
    if (!val) return mostrarErroInline(`cif-item-${i}`, `Selecione item ${i}`);
    inspecaoDados[`item_${i}`] = val;
  }

  try {
    const response = await fetch(`${WORKER_URL}/api/salvar-inspecao-cif`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: cpfAtual, inspecao_dados: inspecaoDados })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const resultado = await response.json();

    if (resultado.sucesso) {
      id('token-gerado').innerText = resultado.id_inspecao;
      irParaSucesso();
    } else {
      mostrarErroInline('form-inspecao-cif', 'Erro: ' + (resultado.erro || 'Servidor'));
    }
  } catch (erro) {
    console.error('Erro:', erro);
    mostrarErroInline('form-inspecao-cif', 'Erro conexão!');
  }
}

// ============================================
// NAVEGAÇÃO
// ============================================

function copiarToken() {
  const token = id('token-gerado').innerText;
  navigator.clipboard.writeText(token).then(() => {
    alert('📋 Código copiado!');
  });
}

function voltarPaginaAnterior() {
  limparTodosErros();
  const etapaCarregamento = !id('step-tipo-carregamento').classList.contains('hidden');
  const etapaInspecao = !id('step-inspecao').classList.contains('hidden');
  const etapaInspecaoCIF = !id('step-inspecao-cif').classList.contains('hidden');

  if (etapaInspecao || etapaInspecaoCIF) {
    irParaSelecaoCarregamento();
  } else if (etapaCarregamento && ehPrimeiraVez) {
    irParaIntegracao();
  } else {
    irParaCPF();
  }
}

function irParaCPF() {
  ocultarTodas();
  limparTodosErros();
  resetarCamposReadOnly();

  if (id('input-cpf')) id('input-cpf').value = '';
  if (id('form-prova')) id('form-prova').reset();
  if (id('form-inspecao')) id('form-inspecao').reset();
  if (id('form-inspecao-cif')) id('form-inspecao-cif').reset();

  cpfAtual = '';
  dadosMotoristaAtual = {};
  ultimaInspecaoAtual = null;
  ehPrimeiraVez = false;

  id('step-cpf').classList.remove('hidden');
}

function irParaIntegracao() {
  ocultarTodas();
  limparTodosErros();
  alternarBloqueioProva();
  id('step-integracao').classList.remove('hidden');
}

function irParaInspecao(numeroPedido) {
  ocultarTodas();
  limparTodosErros();
  preencherUltimoCarregamento();

  if (numeroPedido && id('pedido')) {
    id('pedido').value = numeroPedido;
    id('pedido').readOnly = true;
  }

  id('step-inspecao').classList.remove('hidden');
}

function irParaInspecaoCIF(numeroPedido) {
  ocultarTodas();
  limparTodosErros();
  preencherUltimoCIF(); // Preenche dados da última inspeção

  if (numeroPedido && id('cif-pedido')) {
    id('cif-pedido').value = numeroPedido;
    id('cif-pedido').readOnly = true;
  }

  id('step-inspecao-cif').classList.remove('hidden');

  setTimeout(() => {
    alternarCampoTransportadora();
    atualizarCamposCIF();
  }, 100);
}

function irParaSucesso() {
  ocultarTodas();
  id('step-sucesso').classList.remove('hidden');
}

function ocultarTodas() {
  document.querySelectorAll('.card').forEach(card => {
    card.classList.add('hidden');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', irParaCPF);
