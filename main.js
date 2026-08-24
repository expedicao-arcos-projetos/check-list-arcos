// ============================================
// CONFIGURAÇÃO GLOBAL
// ============================================
 
const WORKER_URL = 'https://sistema-inspecoes.samuelvivi1996.workers.dev';
const DEBUG = false;
const TIMEOUT_REQUISICAO = 10000; // 10 segundos
 
const GABARITO = {
  q1: 'Borracha',
  q2: 'Todos os dias',
  q3: 'Ir para um ponto mais próximo indicado pela brigada de emergência',
  q4: 'Bloqueada pelo responsável CSN CIMENTOS.'
};
 
// Estado global
let estadoGlobal = {
  cpfAtual: '',
  motorista: {},
  ultimaInspecao: null,
  primeiraVez: false,
  tipoCarregamento: '',
  numeroPedido: '',
  dadosCadastro: {
    nome: '',
    placa: '',
    telefone: '',
    rg: '',
    eixos: ''
  }
};
 
// ============================================
// UTILITÁRIOS GERAIS
// ============================================
 
const utils = {
  id: (el) => document.getElementById(el),
  
  debug: (msg, dados = null) => {
    if (DEBUG) console.log(`[DEBUG] ${msg}`, dados || '');
  },
 
  limparCPF: (cpf) => cpf.replace(/[^\d]/g, '').trim(),
  
  formatarPlaca: (placa) => placa.replace(/[^A-Z0-9]/g, '').toUpperCase(),
  
  limparTelefone: (tel) => tel.replace(/[^\d]/g, ''),
 
  scrollParaElemento: (elementId) => {
    const el = utils.id(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof el.focus === 'function') el.focus();
    }
  }
};
 
// ============================================
// VALIDADORES CONSOLIDADOS
// ============================================
 
const validadores = {
  cpf: (cpf) => {
    const limpo = utils.limparCPF(cpf);
    if (limpo.length !== 11 || /^(\d)\1+$/.test(limpo)) return false;
    
    // Validar dígitos verificadores
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) {
      soma += parseInt(limpo.substring(i - 1, i)) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(limpo.substring(9, 10))) return false;
 
    soma = 0;
    for (let i = 1; i <= 10; i++) {
      soma += parseInt(limpo.substring(i - 1, i)) * (12 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(limpo.substring(10, 11))) return false;
    
    return true;
  },
 
  cnh: (cnh) => {
    const limpo = cnh.replace(/[^\d]/g, '');
    return limpo.length === 11 && /^\d{11}$/.test(limpo);
  },
 
  placa: (placa) => {
    const clean = utils.formatarPlaca(placa);
    const regexPlaca = /^[A-Z]{3}[0-9]{1}[A-Z0-9]{1}[0-9]{2}$/;
    return regexPlaca.test(clean);
  },
 
  telefone: (tel) => {
    const limpo = utils.limparTelefone(tel);
    return limpo.length >= 10 && limpo.length <= 11;
  },
 
  pedido: (pedido) => {
    const limpo = pedido.replace(/[^\d]/g, '');
    return limpo.length >= 6 && limpo.length <= 9;
  },
 
  eixos: (eixos) => {
    const num = parseInt(eixos, 10);
    return !isNaN(num) && num >= 1 && num <= 9;
  }
};
 
// ============================================
// GERENCIADOR DE LOADING
// ============================================
 
const loading = {
  show: (buttonId = null) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'loading-backdrop';
    backdrop.innerHTML = `
      <div class="loading-container">
        <div class="spinner"></div>
        <p>Processando...</p>
      </div>
    `;
    document.body.appendChild(backdrop);
    
    if (buttonId) {
      const btn = utils.id(buttonId);
      if (btn) btn.disabled = true;
    }
  },
 
  hide: (buttonId = null) => {
    const backdrop = document.getElementById('loading-backdrop');
    if (backdrop) backdrop.remove();
    
    if (buttonId) {
      const btn = utils.id(buttonId);
      if (btn) btn.disabled = false;
    }
  },
 
  isActive: () => document.getElementById('loading-backdrop') !== null
};
 
// ============================================
// GERENCIADOR DE ERROS INLINE
// ============================================
 
const erros = {
  mostrar: (elementId, mensagem) => {
    const el = utils.id(elementId);
    if (!el) return;
 
    erros.limpar(elementId);
    
    const container = el.closest('.input-group') || el.closest('.aceite-container') || el.parentElement;
    container.classList.add('has-error');
 
    const feedback = document.createElement('div');
    feedback.className = 'form-feedback error';
    feedback.innerHTML = `<span class="feedback-icon">✕</span><span class="feedback-message">${mensagem}</span>`;
    container.appendChild(feedback);
 
    utils.scrollParaElemento(elementId);
  },
 
  limpar: (elementId) => {
    const el = utils.id(elementId);
    if (!el) return;
 
    const container = el.closest('.input-group') || el.closest('.aceite-container') || el.parentElement;
    container.classList.remove('has-error');
 
    const feedback = container.querySelector('.form-feedback.error');
    if (feedback) feedback.remove();
  },
 
  limparTodos: () => {
    document.querySelectorAll('.has-error').forEach(el => {
      el.classList.remove('has-error');
    });
    document.querySelectorAll('.form-feedback.error').forEach(el => {
      el.remove();
    });
  }
};
 
// ============================================
// GERENCIADOR DE API COM TIMEOUT
// ============================================
 
const api = {
  chamar: async (endpoint, metodo = 'POST', dados = null) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_REQUISICAO);
 
    try {
      const opcoes = {
        method: metodo,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal
      };
 
      if (dados) opcoes.body = JSON.stringify(dados);
 
      const response = await fetch(`${WORKER_URL}${endpoint}`, opcoes);
      clearTimeout(timeout);
 
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
 
      const resultado = await response.json();
      return { sucesso: true, dados: resultado };
    } catch (erro) {
      clearTimeout(timeout);
      
      if (erro.name === 'AbortError') {
        return { sucesso: false, erro: 'Tempo limite excedido (10s). Verifique a conexão.' };
      }
 
      return { sucesso: false, erro: erro.message || 'Erro ao conectar' };
    }
  }
};
 
// ============================================
// GERENCIADOR DE SESSÃO
// ============================================
 
const sessao = {
  armazenarCPF: (cpf) => {
    sessionStorage.setItem('cpf_temp', cpf);
  },
 
  obterCPF: () => {
    return sessionStorage.getItem('cpf_temp') || '';
  },
 
  limpar: () => {
    sessionStorage.clear();
    estadoGlobal = {
      cpfAtual: '',
      motorista: {},
      ultimaInspecao: null,
      primeiraVez: false,
      tipoCarregamento: '',
      numeroPedido: '',
      dadosCadastro: {
        nome: '',
        placa: '',
        telefone: '',
        rg: '',
        eixos: ''
      }
    };
  }
};
 
// ============================================
// FLUXO: VERIFICAR CPF
// ============================================
 
async function verificarAcesso() {
  erros.limparTodos();
  const inputCPF = utils.id('input-cpf');
  const cpf = utils.limparCPF(inputCPF.value);
 
  if (!validadores.cpf(cpf)) {
    erros.mostrar('input-cpf', 'CPF inválido! Verifique os 11 dígitos.');
    return;
  }
 
  loading.show();
  sessao.armazenarCPF(cpf);
  estadoGlobal.cpfAtual = cpf;
 
  const resultado = await api.chamar('/api/verificar-cpf', 'POST', { cpf });
  loading.hide();
 
  if (!resultado.sucesso) {
    erros.mostrar('input-cpf', `Erro: ${resultado.erro}`);
    return;
  }
 
  const { existe, dados, ultima_inspecao } = resultado.dados;
 
  if (existe) {
    estadoGlobal.motorista = dados || {};
    estadoGlobal.ultimaInspecao = ultima_inspecao;
    estadoGlobal.primeiraVez = false;
    
    estadoGlobal.dadosCadastro = {
      nome: dados?.nome || '',
      placa: dados?.placa || '',
      telefone: dados?.telefone || '',
      rg: dados?.rg || '',
      eixos: ''
    };
 
    irParaSelecaoCarregamento();
  } else {
    estadoGlobal.primeiraVez = true;
    irParaIntegracao();
  }
 
  inputCPF.value = '';
}
 
// ============================================
// FLUXO: INTEGRAÇÃO (PROVA + CADASTRO)
// ============================================
 
function alternarBloqueioProva() {
  const aceiteVideo = utils.id('aceite-video')?.checked;
  const secaoProva = utils.id('secao-prova');
 
  if (secaoProva) {
    secaoProva.style.opacity = aceiteVideo ? '1' : '0.5';
    secaoProva.style.pointerEvents = aceiteVideo ? 'auto' : 'none';
 
    if (!aceiteVideo) {
      secaoProva.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
    }
  }
}
 
async function concluirIntegracao() {
  erros.limparTodos();
 
  const nome = utils.id('reg-nome').value.trim();
  const rg = utils.id('reg-rg').value.trim();
  const telefone = utils.limparTelefone(utils.id('reg-telefone').value);
  const placa = utils.formatarPlaca(utils.id('reg-placa').value);
 
  // Validações
  if (!nome || nome.length < 3) {
    erros.mostrar('reg-nome', 'Informe seu nome completo (mín. 3 caracteres)');
    return;
  }
  if (!rg || rg.length < 5) {
    erros.mostrar('reg-rg', 'Informe um RG válido');
    return;
  }
  if (!validadores.telefone(telefone)) {
    erros.mostrar('reg-telefone', 'Telefone inválido (10-11 dígitos com DDD)');
    return;
  }
  if (!validadores.placa(placa)) {
    erros.mostrar('reg-placa', 'Placa inválida (Ex: ABC1234 ou ABC1A34)');
    return;
  }
  if (!utils.id('aceite-video').checked) {
    erros.mostrar('aceite-video', 'Confirme que assistiu ao vídeo');
    return;
  }
 
  // Coletar respostas
  const respostas = {
    q1: document.querySelector('input[name="q1"]:checked')?.value,
    q2: document.querySelector('input[name="q2"]:checked')?.value,
    q3: document.querySelector('input[name="q3"]:checked')?.value,
    q4: document.querySelector('input[name="q4"]:checked')?.value
  };
 
  if (!respostas.q1) {
    erros.mostrar('q1-a', 'Responda a questão 1');
    return;
  }
  if (!respostas.q2) {
    erros.mostrar('q2-a', 'Responda a questão 2');
    return;
  }
  if (!respostas.q3) {
    erros.mostrar('q3-a', 'Responda a questão 3');
    return;
  }
  if (!respostas.q4) {
    erros.mostrar('q4-a', 'Responda a questão 4');
    return;
  }
 
  // Validar aceites
  if (!utils.id('aceite-ppae').checked) {
    erros.mostrar('aceite-ppae', 'Aceite o PPAE para continuar');
    return;
  }
  if (!utils.id('aceite-fob').checked) {
    erros.mostrar('aceite-fob', 'Aceite os termos de segurança');
    return;
  }
  if (!utils.id('aceite-lgpd').checked) {
    erros.mostrar('aceite-lgpd', 'Aceite a política de privacidade');
    return;
  }
 
  // Verificar prova
  let acertos = 0;
  for (let q in GABARITO) {
    if (respostas[q] === GABARITO[q]) acertos++;
  }
 
  if (acertos < 4) {
    erros.mostrar('secao-prova', `❌ Acertou ${acertos}/4. Precisa acertar TODAS as questões!`);
    return;
  }
 
  // Salvar motorista
  loading.show();
  const cpf = sessao.obterCPF();
  
  const resultado = await api.chamar('/api/salvar-motorista', 'POST', {
    cpf,
    nome,
    rg,
    telefone,
    placa,
    aceite_video: true,
    aceite_ppae: true,
    aceite_fob: true,
    aceite_lgpd: true,
    data_aceite: new Date().toISOString(),
    prova_respondida: {
      data: new Date().toISOString(),
      respostas,
      resultado: 'aprovado'
    }
  });
 
  loading.hide();
 
  if (!resultado.sucesso) {
    erros.mostrar('reg-nome', `Erro: ${resultado.erro}`);
    return;
  }
 
  // Atualizar estado
  estadoGlobal.dadosCadastro = { nome, placa, telefone, rg, eixos: '' };
  irParaSelecaoCarregamento();
}
 
// ============================================
// FLUXO: SELEÇÃO DE CARREGAMENTO
// ============================================
 
function alternarCamposPedido() {
  erros.limparTodos();
  const opcao = document.querySelector('input[name="modelo_carregamento"]:checked')?.value;
 
  if (opcao === 'FOB') {
    utils.id('container-pedido-fob').style.display = 'block';
    utils.id('container-pedido-cif').style.display = 'none';
    utils.id('pedido-cif-input').value = '';
  } else if (opcao === 'CIF') {
    utils.id('container-pedido-cif').style.display = 'block';
    utils.id('container-pedido-fob').style.display = 'none';
    utils.id('pedido-fob-input').value = '';
  }
}
 
async function confirmarTipoCarregamento() {
  erros.limparTodos();
  const opcao = document.querySelector('input[name="modelo_carregamento"]:checked')?.value;
 
  if (!opcao) {
    erros.mostrar('step-tipo-carregamento', 'Selecione FOB ou TRANSFERÊNCIA/CIF');
    return;
  }
 
  let pedido = '';
  if (opcao === 'FOB') {
    pedido = utils.id('pedido-fob-input').value.trim();
  } else {
    pedido = utils.id('pedido-cif-input').value.trim();
  }
 
  if (!validadores.pedido(pedido)) {
    const fieldId = opcao === 'FOB' ? 'pedido-fob-input' : 'pedido-cif-input';
    erros.mostrar(fieldId, 'Pedido inválido (6-9 dígitos)');
    return;
  }
 
  estadoGlobal.tipoCarregamento = opcao;
  estadoGlobal.numeroPedido = pedido;
 
  loading.show();
  const cpf = sessao.obterCPF();
  
  const resultado = await api.chamar('/api/ultima-inspecao-por-tipo', 'POST', {
    cpf,
    tipo: opcao
  });
 
  loading.hide();
 
  if (resultado.sucesso) {
    estadoGlobal.ultimaInspecao = resultado.dados.ultima_inspecao;
    utils.debug(`Última inspeção ${opcao} carregada`);
  }
 
  if (opcao === 'FOB') {
    irParaInspecao(pedido);
  } else {
    irParaInspecaoCIF(pedido);
  }
}
 
// ============================================
// FLUXO: INSPEÇÃO FOB
// ============================================
 
function atualizarCamposPorTipoVeiculo() {
  const tipoVeiculo = document.querySelector('input[name="tipo_veiculo"]:checked')?.value;
  const containerTampaSilo = utils.id('container-tampa-silo');
  const selectTampaSilo = utils.id('tampa_silo');
  const secaoPaletes = utils.id('secao-paletes');
 
  if (tipoVeiculo === 'CARGA_SECA') {
    containerTampaSilo.style.display = 'none';
    selectTampaSilo.value = 'N/A';
    selectTampaSilo.removeAttribute('required');
    secaoPaletes.style.display = 'block';
  } else if (tipoVeiculo === 'CARRETA_SILO') {
    containerTampaSilo.style.display = 'flex';
    selectTampaSilo.value = '';
    selectTampaSilo.setAttribute('required', 'required');
    secaoPaletes.style.display = 'none';
    document.querySelectorAll('input[name="paletes_opcao"]').forEach(r => r.checked = false);
  }
}
 
function preencherUltimoCarregamento() {
  if (!estadoGlobal.ultimaInspecao) {
    // Preencher apenas com dados do cadastro
    utils.id('nome').value = estadoGlobal.dadosCadastro.nome;
    utils.id('placa').value = estadoGlobal.dadosCadastro.placa;
    utils.id('telefone').value = estadoGlobal.dadosCadastro.telefone;
    return;
  }
 
  const dados = estadoGlobal.ultimaInspecao;
 
  // Dados básicos
  utils.id('nome').value = estadoGlobal.dadosCadastro.nome || dados.nome || '';
  utils.id('placa').value = estadoGlobal.dadosCadastro.placa || dados.placa || '';
  utils.id('telefone').value = estadoGlobal.dadosCadastro.telefone || dados.telefone || '';
  utils.id('eixos').value = dados.eixos || '';
  utils.id('cnh').value = dados.cnh || '';
 
  // Tipo de veículo
  if (dados.tipo_veiculo) {
    const radio = document.querySelector(`input[name="tipo_veiculo"][value="${dados.tipo_veiculo}"]`);
    if (radio) {
      radio.checked = true;
      atualizarCamposPorTipoVeiculo();
    }
  }
 
  // Itens FOB
  const itens = ['sinalizacao', 'pneus', 'carroceria', 'cinto', 'farois', 'alarme_re', 'vazamentos', 'calcos', 'tampa_silo', 'epi_capacete', 'epi_colete', 'epi_oculos', 'epi_botina', 'epi_luvas'];
  
  itens.forEach(item => {
    const valor = dados[item];
    if (valor) preencherSelectComForca(item, valor);
  });
 
  // Paletes
  if (dados.paletes_opcao) {
    const radio = document.querySelector(`input[name="paletes_opcao"][value="${dados.paletes_opcao}"]`);
    if (radio) {
      radio.checked = true;
      if (dados.paletes_opcao === 'SIM') {
        utils.id('quantidade-paletes-container').style.display = 'block';
        utils.id('quantidade-paletes').value = dados.paletes_quantidade || '';
      }
    }
  }
}
 
async function gerarJSONeToken() {
  erros.limparTodos();
 
  const nome = utils.id('nome').value.trim();
  const cnh = utils.id('cnh').value.trim();
  const placa = utils.formatarPlaca(utils.id('placa').value);
  const pedido = utils.id('pedido').value.trim();
  const eixos = utils.id('eixos').value.trim();
  const telefone = utils.limparTelefone(utils.id('telefone').value);
  const tipoVeiculo = document.querySelector('input[name="tipo_veiculo"]:checked')?.value;
 
  // Validações
  if (!nome || nome.length < 3) return erros.mostrar('nome', 'Informe nome completo');
  if (!validadores.cnh(cnh)) return erros.mostrar('cnh', 'CNH inválida (11 dígitos)');
  if (!validadores.telefone(telefone)) return erros.mostrar('telefone', 'Telefone inválido');
  if (!validadores.placa(placa)) return erros.mostrar('placa', 'Placa inválida');
  if (!validadores.pedido(pedido)) return erros.mostrar('pedido', 'Pedido inválido');
  if (!validadores.eixos(eixos)) return erros.mostrar('eixos', 'Eixos deve ser de 1 a 9');
  if (!tipoVeiculo) return erros.mostrar('form-inspecao', 'Selecione tipo de veículo');
 
  // Validar itens obrigatórios
  const itens = ['sinalizacao', 'pneus', 'carroceria', 'cinto', 'farois', 'alarme_re', 'vazamentos', 'calcos', 'epi_capacete', 'epi_colete', 'epi_oculos', 'epi_botina', 'epi_luvas'];
  
  for (let campo of itens) {
    if (!utils.id(campo).value) {
      return erros.mostrar(campo, 'Selecione uma opção');
    }
  }
 
  // Validar tampa silo se necessário
  if (tipoVeiculo === 'CARRETA_SILO' && !utils.id('tampa_silo').value) {
    return erros.mostrar('tampa_silo', 'Selecione uma opção');
  }
 
  const inspecao = {
    nome,
    cnh,
    placa,
    pedido,
    eixos,
    telefone,
    tipo_veiculo: tipoVeiculo,
    sinalizacao: utils.id('sinalizacao').value,
    pneus: utils.id('pneus').value,
    carroceria: utils.id('carroceria').value,
    cinto: utils.id('cinto').value,
    farois: utils.id('farois').value,
    alarme_re: utils.id('alarme_re').value,
    vazamentos: utils.id('vazamentos').value,
    calcos: utils.id('calcos').value,
    tampa_silo: utils.id('tampa_silo').value || 'N/A',
    epi_capacete: utils.id('epi_capacete').value,
    epi_colete: utils.id('epi_colete').value,
    epi_oculos: utils.id('epi_oculos').value,
    epi_botina: utils.id('epi_botina').value,
    epi_luvas: utils.id('epi_luvas').value,
    paletes_opcao: document.querySelector('input[name="paletes_opcao"]:checked')?.value || 'N/A',
    paletes_quantidade: utils.id('quantidade-paletes')?.value || ''
  };
 
  loading.show();
  const cpf = sessao.obterCPF();
 
  const resultado = await api.chamar('/api/salvar-inspecao', 'POST', {
    cpf,
    inspecao_dados: inspecao
  });
 
  loading.hide();
 
  if (!resultado.sucesso) {
    return erros.mostrar('form-inspecao', `Erro: ${resultado.erro}`);
  }
 
  utils.id('token-gerado').innerText = resultado.dados.id_inspecao;
  irParaSucesso();
}
 
// ============================================
// FLUXO: INSPEÇÃO CIF
// ============================================
 
function atualizarCamposCIF() {
  const tipoVeiculo = document.querySelector('input[name="cif_tipo_veiculo"]:checked')?.value;
  const secaoPaletes = utils.id('secao-paletes-cif');
 
  if (!secaoPaletes) return;
 
  if (tipoVeiculo === 'CARGA_SECA') {
    secaoPaletes.style.display = 'block';
  } else if (tipoVeiculo === 'CARRETA_SILO') {
    secaoPaletes.style.display = 'none';
    document.querySelectorAll('input[name="cif_paletes_opcao"]').forEach(r => r.checked = false);
    alternarQtdPaletesCIF(false);
  }
}
 
function alternarQtdPaletesCIF(mostrar) {
  const container = utils.id('container-qtd-paletes-cif');
  if (container) {
    container.style.display = mostrar ? 'block' : 'none';
    if (!mostrar && utils.id('cif-qtd-paletes')) {
      utils.id('cif-qtd-paletes').value = '';
    }
  }
}
 
function alternarCampoTransportadoraCustomizada() {
  const transportadora = utils.id('cif-transportadora')?.value;
  const container = utils.id('container-transportadora-customizada');
  const input = utils.id('cif-transportadora-customizada');
 
  if (transportadora === 'OUTRA') {
    container.style.display = 'block';
    if (input) input.focus();
  } else {
    container.style.display = 'none';
    if (input) input.value = '';
  }
}
 
function preencherUltimoCIF() {
  if (!estadoGlobal.ultimaInspecao) {
    utils.id('cif-nome').value = estadoGlobal.dadosCadastro.nome;
    utils.id('cif-placa').value = estadoGlobal.dadosCadastro.placa;
    utils.id('cif-telefone').value = estadoGlobal.dadosCadastro.telefone;
    return;
  }
 
  const dados = estadoGlobal.ultimaInspecao;
 
  // Dados básicos
  utils.id('cif-nome').value = estadoGlobal.dadosCadastro.nome || dados.nome || '';
  utils.id('cif-placa').value = estadoGlobal.dadosCadastro.placa || dados.placa || '';
  utils.id('cif-telefone').value = estadoGlobal.dadosCadastro.telefone || dados.telefone || '';
  utils.id('cif-eixos').value = dados.eixos || '';
  utils.id('cif-cnh').value = dados.cnh || '';
 
  // Campos CIF
  if (utils.id('cif-tipo-checklist')) utils.id('cif-tipo-checklist').value = dados.tipo_checklist || '';
  if (utils.id('cif-segmento')) utils.id('cif-segmento').value = dados.segmento || '';
  // Preencher transportadora (se for customizada, marcar como OUTRO)
  if (utils.id('cif-transportadora')) {
    const transportadora = dados.transportadora || '';
    const opcoesPadrao = ['TORA', 'TRANSAGIL', 'TARGET', 'FROTA CSN', 'N/A', ''];
    
    if (opcoesPadrao.includes(transportadora)) {
      utils.id('cif-transportadora').value = transportadora;
    } else if (transportadora) {
      // É uma transportadora customizada
      utils.id('cif-transportadora').value = 'OUTRO';
      if (utils.id('cif-transportadora-customizada')) {
        utils.id('cif-transportadora-customizada').value = transportadora;
        utils.id('container-transportadora-customizada').style.display = 'block';
      }
    }
  }
 
  // Tipo veículo
  if (dados.tipo_veiculo_cif) {
    const radio = document.querySelector(`input[name="cif_tipo_veiculo"][value="${dados.tipo_veiculo_cif}"]`);
    if (radio) radio.checked = true;
  }
 
  // Paletes
  if (dados.trouxe_palete && dados.trouxe_palete !== 'N/A') {
    const radio = document.querySelector(`input[name="cif_paletes_opcao"][value="${dados.trouxe_palete}"]`);
    if (radio) {
      radio.checked = true;
      if (dados.trouxe_palete === 'SIM') {
        alternarQtdPaletesCIF(true);
        if (utils.id('cif-qtd-paletes')) utils.id('cif-qtd-paletes').value = dados.quantidade_palete || '';
      }
    }
  }
 
  // 32 itens
  for (let i = 1; i <= 32; i++) {
    const valor = dados[`item_${i}`];
    if (valor) preencherSelectComForca(`cif-item-${i}`, valor);
  }
}
 
async function salvarInspecaoCIF() {
  erros.limparTodos();
 
  const nome = utils.id('cif-nome')?.value.trim() || estadoGlobal.dadosCadastro.nome || '';
  const cnh = utils.id('cif-cnh')?.value.trim() || '';
  const telefone = utils.limparTelefone(utils.id('cif-telefone')?.value || '');
  const placa = utils.formatarPlaca(utils.id('cif-placa')?.value || '');
  const pedido = utils.id('cif-pedido')?.value.trim() || '';
  const eixos = utils.id('cif-eixos')?.value.trim() || '';
  const tipoChecklist = utils.id('cif-tipo-checklist')?.value || '';
  const segmento = utils.id('cif-segmento')?.value || '';
  const tipoVeiculoCIF = document.querySelector('input[name="cif_tipo_veiculo"]:checked')?.value;
 
  // Validações
  if (!nome || nome.length < 3) return erros.mostrar('cif-nome', 'Informe nome completo');
  if (!validadores.cnh(cnh)) return erros.mostrar('cif-cnh', 'CNH inválida');
  if (!validadores.telefone(telefone)) return erros.mostrar('cif-telefone', 'Telefone inválido');
  if (!validadores.placa(placa)) return erros.mostrar('cif-placa', 'Placa inválida');
  if (!validadores.pedido(pedido)) return erros.mostrar('cif-pedido', 'Pedido inválido');
  if (!validadores.eixos(eixos)) return erros.mostrar('cif-eixos', 'Eixos inválido');
  if (!tipoChecklist) return erros.mostrar('cif-tipo-checklist', 'Selecione checklist');
  if (!segmento) return erros.mostrar('cif-segmento', 'Selecione segmento');
  if (!tipoVeiculoCIF) return erros.mostrar('step-inspecao-cif', 'Selecione tipo veículo');
  // Validar transportadora se selecionou OUTRO
  if (utils.id('cif-transportadora')?.value === 'OUTRA') {
    const transportadoraCustomizada = utils.id('cif-transportadora-customizada')?.value.trim();
    if (!transportadoraCustomizada) {
      return erros.mostrar('cif-transportadora-customizada', 'Digite o nome da transportadora');
    }
  } else if (!utils.id('cif-transportadora')?.value) {
    return erros.mostrar('cif-transportadora', 'Selecione uma transportadora');
  }
 
  // Validar paletes para CARGA_SECA
  let trouxePalete = 'N/A';
  let qtdPalete = 'N/A';
 
  if (tipoVeiculoCIF === 'CARGA_SECA') {
    const paleteSelecionado = document.querySelector('input[name="cif_paletes_opcao"]:checked')?.value;
    if (!paleteSelecionado) {
      return erros.mostrar('secao-paletes-cif', 'Selecione se trouxe paletes');
    }
 
    trouxePalete = paleteSelecionado;
    if (paleteSelecionado === 'SIM') {
      qtdPalete = utils.id('cif-qtd-paletes')?.value.trim();
      if (!qtdPalete) return erros.mostrar('cif-qtd-paletes', 'Informe quantidade');
    }
  }
 
  const inspecaoDados = {
    nome,
    cnh,
    placa,
    pedido,
    eixos,
    telefone,
    tipo_checklist: tipoChecklist,
    segmento,
    transportadora: (function() {
      const transportadoraSelecionada = utils.id('cif-transportadora')?.value;
      if (transportadoraSelecionada === 'OUTRA') {
        return utils.id('cif-transportadora-customizada')?.value || 'N/A';
      }
      return transportadoraSelecionada || 'N/A';
    })(),
    tipo_veiculo_cif: tipoVeiculoCIF,
    trouxe_palete: trouxePalete,
    quantidade_palete: qtdPalete
  };
 
  // Validar 32 itens
  for (let i = 1; i <= 32; i++) {
    const valor = utils.id(`cif-item-${i}`)?.value;
    if (!valor) return erros.mostrar(`cif-item-${i}`, `Selecione item ${i}`);
    
    let normalizado = valor;
    if (valor === 'NAO' || valor === 'NÃO') normalizado = 'NAO';
    if (valor === 'N/A' || valor === 'NA') normalizado = 'N/A';
    
    inspecaoDados[`item_${i}`] = normalizado;
  }
 
  loading.show();
  const cpf = sessao.obterCPF();
 
  const resultado = await api.chamar('/api/salvar-inspecao-cif', 'POST', {
    cpf,
    inspecao_dados: inspecaoDados
  });
 
  loading.hide();
 
  if (!resultado.sucesso) {
    return erros.mostrar('form-inspecao-cif', `Erro: ${resultado.erro}`);
  }
 
  utils.id('token-gerado').innerText = resultado.dados.id_inspecao;
  irParaSucesso();
}
 
// ============================================
// AUXILIARES
// ============================================
 
function preencherSelectComForca(elementId, valor) {
  const el = utils.id(elementId);
  if (!el) return false;
 
  el.value = valor;
 
  if (!el.value && el.tagName === 'SELECT') {
    const opcoes = Array.from(el.options).map(opt => opt.value);
    if (!opcoes.includes(valor)) {
      const novaOpcao = document.createElement('option');
      novaOpcao.value = valor;
      novaOpcao.text = valor;
      el.appendChild(novaOpcao);
    }
    el.value = valor;
  }
 
  return el.value === valor;
}
 
function mostrarPaletes() {
  utils.id('quantidade-paletes-container').style.display = 'block';
}
 
function ocultarPaletes() {
  utils.id('quantidade-paletes-container').style.display = 'none';
  utils.id('quantidade-paletes').value = '';
}
 
function copiarToken() {
  const token = utils.id('token-gerado').innerText;
  const container = utils.id('token-gerado')?.parentElement;
 
  navigator.clipboard.writeText(token).then(() => {
    mostrarMensagemCopia(container, '✅ Código copiado com sucesso!', 'sucesso');
  }).catch(() => {
    mostrarMensagemCopia(container, '❌ Erro ao copiar', 'erro');
  });
}
 
function mostrarMensagemCopia(container, mensagem, tipo) {
  const msgAnterior = container?.querySelector('.msg-copia');
  if (msgAnterior) msgAnterior.remove();
 
  const msg = document.createElement('div');
  msg.className = `msg-copia msg-${tipo}`;
  msg.textContent = mensagem;
  msg.style.cssText = `
    margin-top: 10px;
    padding: 10px 15px;
    border-radius: 4px;
    font-size: 14px;
    text-align: center;
    animation: fadeInOut 0.3s ease-in;
    ${tipo === 'sucesso' 
      ? 'background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;' 
      : 'background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;'
    }
  `;
 
  container?.appendChild(msg);
 
  setTimeout(() => {
    msg.style.animation = 'fadeOutUp 0.3s ease-out';
    setTimeout(() => msg.remove(), 300);
  }, 3000);
}
 
// ============================================
// NAVEGAÇÃO
// ============================================
 
function voltarPaginaAnterior() {
  erros.limparTodos();
 
  if (!utils.id('step-inspecao').classList.contains('hidden')) {
    irParaSelecaoCarregamento();
  } else if (!utils.id('step-inspecao-cif').classList.contains('hidden')) {
    irParaSelecaoCarregamento();
  } else if (!utils.id('step-tipo-carregamento').classList.contains('hidden')) {
    estadoGlobal.primeiraVez ? irParaIntegracao() : irParaCPF();
  } else {
    irParaCPF();
  }
}
 
function irParaCPF() {
  ocultarTodas();
  erros.limparTodos();
  sessao.limpar();
 
  utils.id('input-cpf').value = '';
  utils.id('form-prova').reset();
  utils.id('form-inspecao').reset();
  utils.id('form-inspecao-cif').reset();
 
  utils.id('step-cpf').classList.remove('hidden');
}
 
function irParaIntegracao() {
  ocultarTodas();
  erros.limparTodos();
  alternarBloqueioProva();
  utils.id('step-integracao').classList.remove('hidden');
}
 
function irParaSelecaoCarregamento() {
  ocultarTodas();
  erros.limparTodos();
 
  document.querySelectorAll('input[name="modelo_carregamento"]').forEach(r => r.checked = false);
  utils.id('container-pedido-fob').style.display = 'none';
  utils.id('container-pedido-cif').style.display = 'none';
  utils.id('pedido-fob-input').value = '';
  utils.id('pedido-cif-input').value = '';
 
  utils.id('step-tipo-carregamento').classList.remove('hidden');
}
 
function irParaInspecao(numeroPedido) {
  ocultarTodas();
  erros.limparTodos();
  preencherUltimoCarregamento();
 
  if (numeroPedido) {
    utils.id('pedido').value = numeroPedido;
    utils.id('pedido').readOnly = true;
  }
 
  utils.id('step-inspecao').classList.remove('hidden');
}
 
function irParaInspecaoCIF(numeroPedido) {
  ocultarTodas();
  erros.limparTodos();
 
  if (numeroPedido) {
    utils.id('cif-pedido').value = numeroPedido;
    utils.id('cif-pedido').readOnly = true;
  }
 
  utils.id('step-inspecao-cif').classList.remove('hidden');
 
  setTimeout(() => {
    preencherUltimoCIF();
    atualizarCamposCIF();
  }, 100);
}
 
function irParaSucesso() {
  ocultarTodas();
  utils.id('step-sucesso').classList.remove('hidden');
}
 
function ocultarTodas() {
  document.querySelectorAll('.card').forEach(card => {
    card.classList.add('hidden');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
 
// ============================================
// INICIALIZAÇÃO
// ============================================
 
document.addEventListener('DOMContentLoaded', () => {
  utils.debug('Aplicação iniciada');
 
  // Event listeners
  document.addEventListener('change', (e) => {
    if (e.target.name === 'tipo_veiculo') atualizarCamposPorTipoVeiculo();
    if (e.target.name === 'paletes_opcao' && e.target.value === 'SIM') mostrarPaletes();
    if (e.target.name === 'paletes_opcao' && e.target.value === 'NAO') ocultarPaletes();
  });
 
  irParaCPF();
});
