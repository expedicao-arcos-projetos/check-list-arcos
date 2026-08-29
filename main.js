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
  
  formatarPlaca: (placa) => placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
  
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
    const regexPlaca = /^[A-Z]{3}[0-9]{4}$|^[A-Z]{3}[0-9][A-Z][0-9]{2}$/; // Antiga ou Mercosul
    return regexPlaca.test(clean);
  },
 
  telefone: (tel) => {
    const limpo = utils.limparTelefone(tel);
    return limpo.length >= 10 && limpo.length <= 11;
  },
 
  pedidoFOB: (pedido) => {
    const limpo = pedido.replace(/[^\d]/g, '');
    return limpo.length === 7; // FOB: exatamente 7 dígitos
  },

  pedidoCIF: (pedido) => {
    const limpo = pedido.replace(/[^\d]/g, '');
    return limpo.length === 9; // CIF/Transferência: exatamente 9 dígitos
  },

  pedido: (pedido, tipo = 'FOB') => {
    const limpo = pedido.replace(/[^\d]/g, '');
    if (tipo === 'FOB') return limpo.length === 7;
    if (tipo === 'CIF') return limpo.length === 9;
    return false;
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
    estadoGlobal.motorista = {
      cpf: cpf,  // ✅ Adicionar CPF
      ...dados
    };
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
 
// ✅ Alternar visibilidade dos campos de múltiplos pedidos na seleção
function alternarMultiplosPedidosSeleção(tipo) {
  const checkboxId = `multiplos-pedidos-${tipo}-check`;
  const containerId = `container-outros-pedidos-${tipo}`;
  const checkbox = utils.id(checkboxId);
  const container = utils.id(containerId);
 
  if (!checkbox || !container) return;
 
  if (checkbox.checked) {
    container.style.display = 'block';
    // Adicionar primeiro campo se não tiver nenhum
    const lista = utils.id(`lista-pedidos-${tipo}`);
    if (lista && lista.children.length === 0) {
      adicionarCampoPedido(tipo);
    }
  } else {
    container.style.display = 'none';
    // Remover todos os campos dinâmicos
    const lista = utils.id(`lista-pedidos-${tipo}`);
    if (lista) lista.innerHTML = '';
  }
}

// ✅ Adicionar campo de pedido dinâmico
function adicionarCampoPedido(tipo) {
  const lista = utils.id(`lista-pedidos-${tipo}`);
  if (!lista) return;
 
  const index = lista.children.length;
  const digitos = tipo === 'fob' ? '7' : '9';
  const maxLength = tipo === 'fob' ? '7' : '9';
 
  const fieldId = `pedido-${tipo}-${index}`;
  const fieldHTML = `
    <div style="display: flex; gap: 8px; align-items: flex-start;">
      <div style="flex: 1;">
        <input 
          type="text" 
          id="${fieldId}" 
          class="pedido-input-dinamico"
          data-tipo="${tipo}"
          data-index="${index}"
          placeholder="Ex: ${tipo === 'fob' ? '1234567' : '104999999'}"
          maxlength="${maxLength}"
          inputmode="numeric"
          style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;"
        >
        <small style="display: none; color: #e74c3c; margin-top: 4px;" class="error-msg-pedido">Pedido ${tipo.toUpperCase()} deve ter ${digitos} dígitos</small>
      </div>
      <button 
        type="button" 
        class="btn-remover-pedido" 
        onclick="removerCampoPedido('${tipo}', ${index})"
        style="padding: 10px 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; min-width: 45px;"
      >
        ✕ Remover
      </button>
    </div>
  `;
 
  lista.insertAdjacentHTML('beforeend', fieldHTML);
}

// ✅ Remover campo de pedido dinâmico
function removerCampoPedido(tipo, index) {
  const fieldId = `pedido-${tipo}-${index}`;
  const field = utils.id(fieldId);
  if (field) {
    field.parentElement.parentElement.remove();
  }
}

// ✅ Validar um pedido específico
function validarPedidoDinamico(tipo, valor) {
  const limpo = valor.replace(/[^\d]/g, '');
  if (tipo === 'fob') return limpo.length === 7;
  if (tipo === 'cif') return limpo.length === 9;
  return false;
}
 
// ✅ Capturar todos os pedidos da tela de seleção (campos dinâmicos)
function capturarTodosPedidosSeleção(tipo) {
  const inputId = tipo === 'fob' ? 'pedido-fob-input' : 'pedido-cif-input';
  const checkboxId = `multiplos-pedidos-${tipo}-check`;
  const listaId = `lista-pedidos-${tipo}`;
 
  const pedidoPrincipal = utils.id(inputId)?.value?.trim();
  if (!pedidoPrincipal) {
    return null; // Vazio
  }
 
  let todosPedidos = [];
 
  // OPÇÃO 1: Se contém "/", significa múltiplos pedidos no campo principal
  if (pedidoPrincipal.includes('/')) {
    const pedidosArray = pedidoPrincipal.split('/');
    for (let p of pedidosArray) {
      const limpo = p.trim().replace(/[^\d]/g, '');
      if (!limpo) continue;
      
      const ehValido = tipo === 'fob' ? limpo.length === 7 : limpo.length === 9;
      if (!ehValido) {
        const campo = tipo === 'fob' ? 'pedido-fob-input' : 'pedido-cif-input';
        const msg = tipo === 'fob' ? 'Pedido FOB deve ter exatamente 7 dígitos' : 'Pedido CIF deve ter exatamente 9 dígitos';
        erros.mostrar(campo, msg);
        return false;
      }
      todosPedidos.push(limpo);
    }
  } else {
    // OPÇÃO 2: Pedido único no campo principal
    const limpo = pedidoPrincipal.replace(/[^\d]/g, '');
    const ehValido = tipo === 'fob' ? limpo.length === 7 : limpo.length === 9;
    
    if (!ehValido) {
      const campo = tipo === 'fob' ? 'pedido-fob-input' : 'pedido-cif-input';
      const msg = tipo === 'fob' ? 'Pedido FOB deve ter exatamente 7 dígitos' : 'Pedido CIF deve ter exatamente 9 dígitos';
      erros.mostrar(campo, msg);
      return false;
    }
    todosPedidos.push(limpo);
  }
 
  // OPÇÃO 3: Capturar outros pedidos dos campos dinâmicos (se checkbox marcado)
  const checkbox = utils.id(checkboxId);
  if (checkbox?.checked) {
    const campos = document.querySelectorAll(`#${listaId} .pedido-input-dinamico`);
    
    for (let campo of campos) {
      const valor = campo.value?.trim();
      if (valor) {
        const valorLimpo = valor.replace(/[^\d]/g, '');
        const ehValidoExtra = tipo === 'fob' ? valorLimpo.length === 7 : valorLimpo.length === 9;
        
        if (!ehValidoExtra) {
          const msg = tipo === 'fob' ? 'Pedido FOB deve ter exatamente 7 dígitos' : 'Pedido CIF deve ter exatamente 9 dígitos';
          erros.mostrar(campo.id, msg);
          return false;
        }
        todosPedidos.push(valorLimpo);
      }
    }
  }
 
  // Retornar todos os pedidos separados por "/"
  return todosPedidos.length > 0 ? todosPedidos.join('/') : null;
}
 
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
 
  // ✅ Capturar MÚLTIPLOS pedidos
  const tipo = opcao === 'FOB' ? 'fob' : 'cif';
  const todosPedidos = capturarTodosPedidosSeleção(tipo);
 
  if (todosPedidos === null) {
    const fieldId = opcao === 'FOB' ? 'pedido-fob-input' : 'pedido-cif-input';
    erros.mostrar(fieldId, '❌ Pedido obrigatório');
    return;
  }
 
  if (todosPedidos === false) {
    const fieldId = opcao === 'FOB' ? 'pedido-fob-input' : 'pedido-cif-input';
    const msg = opcao === 'FOB' 
      ? '❌ Um ou mais pedidos inválidos (7 dígitos cada)' 
      : '❌ Um ou mais pedidos inválidos (9 dígitos cada)';
    erros.mostrar(fieldId, msg);
    return;
  }
 
  estadoGlobal.tipoCarregamento = opcao;
  estadoGlobal.numeroPedido = todosPedidos;  // ✅ Múltiplos pedidos
 
  loading.show();
  
  // ✅ CORRIGIDO: Limpar CPF (remover formatação)
  const cpfRaw = sessao.obterCPF();
  const cpfLimpo = cpfRaw.replace(/[^\d]/g, '');
  
  console.log('🔍 CPF enviado:', cpfLimpo);
  console.log('📊 Tipo:', opcao);
  
  const resultado = await api.chamar('/api/ultima-inspecao-por-tipo', 'POST', {
    cpf: cpfLimpo,
    tipo: opcao
  });
 
  loading.hide();
 
  if (resultado.sucesso) {
    if (resultado.dados.ultima_inspecao) {
      estadoGlobal.ultimaInspecao = resultado.dados.ultima_inspecao;
      console.log('✅ Última inspeção carregada:', estadoGlobal.ultimaInspecao);
    } else {
      console.log('⚠️ Nenhuma inspeção anterior encontrada para este CPF');
      estadoGlobal.ultimaInspecao = null;
    }
  } else {
    console.error('❌ Erro ao carregar última inspeção:', resultado.erro);
    erros.mostrar('step-tipo-carregamento', resultado.erro);
    return;
  }
 
  if (opcao === 'FOB') {
    irParaInspecao(todosPedidos);  // ✅ Passar múltiplos pedidos
  } else {
    irParaInspecaoCIF(todosPedidos);  // ✅ Passar múltiplos pedidos
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
  const pedido = utils.id('pedido').value.trim();  // ✅ Já vem com múltiplos da tela anterior
  const eixos = utils.id('eixos').value.trim();
  const telefone = utils.limparTelefone(utils.id('telefone').value);
  const tipoVeiculo = document.querySelector('input[name="tipo_veiculo"]:checked')?.value;
 
  // Validações
  if (!nome || nome.length < 3) return erros.mostrar('nome', 'Informe nome completo');
  if (!validadores.cnh(cnh)) return erros.mostrar('cnh', 'CNH inválida (11 dígitos)');
  if (!validadores.telefone(telefone)) return erros.mostrar('telefone', 'Telefone inválido');
  if (!validadores.placa(placa)) return erros.mostrar('placa', 'Placa inválida');
  if (!pedido) return erros.mostrar('pedido', 'Pedido obrigatório');
  
  // ✅ Validar pedidos (pode ser múltiplos com "/")
  const resultadoValidacao = validador.validarMultiplosPedidos(pedido, 'fob');
  if (!resultadoValidacao.valido) {
    return erros.mostrar('pedido', resultadoValidacao.erro);
  }
  
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
    pedido,  // ✅ Já tem múltiplos se digitou na tela anterior
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
 
  // ✅ Atualizar dados do motorista (se já existe cadastro)
  if (estadoGlobal.motorista && estadoGlobal.motorista.cpf) {
    try {
      await api.chamar('/api/atualizar-dados-motorista', 'POST', {
        cpf,
        nome: inspecao.nome,
        telefone: inspecao.telefone,
        placa: inspecao.placa,
        rg: estadoGlobal.dadosCadastro.rg || '',
        eixos: inspecao.eixos
      });
      utils.debug('✅ Dados do motorista atualizados');
    } catch (err) {
      utils.debug('⚠️ Erro ao atualizar dados (continuando):', err);
    }
  }
 
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
  const pedido = utils.id('cif-pedido')?.value.trim() || '';  // ✅ Já vem com múltiplos da tela anterior
  const eixos = utils.id('cif-eixos')?.value.trim() || '';
  const tipoChecklist = utils.id('cif-tipo-checklist')?.value || '';
  const segmento = utils.id('cif-segmento')?.value || '';
  const tipoVeiculoCIF = document.querySelector('input[name="cif_tipo_veiculo"]:checked')?.value;
 
  // Validações
  if (!nome || nome.length < 3) return erros.mostrar('cif-nome', 'Informe nome completo');
  if (!validadores.cnh(cnh)) return erros.mostrar('cif-cnh', 'CNH inválida');
  if (!validadores.telefone(telefone)) return erros.mostrar('cif-telefone', 'Telefone inválido');
  if (!validadores.placa(placa)) return erros.mostrar('cif-placa', 'Placa inválida');
  if (!pedido) return erros.mostrar('cif-pedido', 'Pedido obrigatório');
  
  // ✅ Validar pedidos (pode ser múltiplos com "/")
  const resultadoValidacaoCIF = validador.validarMultiplosPedidos(pedido, 'cif');
  if (!resultadoValidacaoCIF.valido) {
    return erros.mostrar('cif-pedido', resultadoValidacaoCIF.erro);
  }
  
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
    pedido,  // ✅ Já tem múltiplos se digitou na tela anterior
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
 
  // ✅ Atualizar dados do motorista (se já existe cadastro)
  if (estadoGlobal.motorista && estadoGlobal.motorista.cpf) {
    try {
      await api.chamar('/api/atualizar-dados-motorista', 'POST', {
        cpf,
        nome: inspecaoDados.nome,
        telefone: inspecaoDados.telefone,
        placa: inspecaoDados.placa,
        rg: estadoGlobal.dadosCadastro.rg || '',
        eixos: inspecaoDados.eixos
      });
      utils.debug('✅ Dados do motorista atualizados');
    } catch (err) {
      utils.debug('⚠️ Erro ao atualizar dados (continuando):', err);
    }
  }
 
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
  resetarCamposDinamicos(); // ✅ Limpar campos dinâmicos anteriores
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
  resetarCamposDinamicos(); // ✅ Limpar campos dinâmicos anteriores
  alternarBloqueioProva();
  utils.id('step-integracao').classList.remove('hidden');
}
 
function irParaSelecaoCarregamento() {
  ocultarTodas();
  erros.limparTodos();
  resetarCamposDinamicos(); // ✅ Limpar campos dinâmicos anteriores
 
  document.querySelectorAll('input[name="modelo_carregamento"]').forEach(r => r.checked = false);
  utils.id('container-pedido-fob').style.display = 'none';
  utils.id('container-pedido-cif').style.display = 'none';
  utils.id('pedido-fob-input').value = '';
  utils.id('pedido-cif-input').value = '';
 
  utils.id('step-tipo-carregamento').classList.remove('hidden');
}
 
// ✅ Resetar campos dinâmicos (limpar inspeção anterior)
function resetarCamposDinamicos() {
  // Limpar FOB
  const checkboxFOB = utils.id('multiplos-pedidos-fob-check');
  if (checkboxFOB) {
    checkboxFOB.checked = false;
    utils.id('container-outros-pedidos-fob').style.display = 'none';
    const listaFOB = utils.id('lista-pedidos-fob');
    if (listaFOB) listaFOB.innerHTML = '';
  }
 
  // Limpar CIF
  const checkboxCIF = utils.id('multiplos-pedidos-cif-check');
  if (checkboxCIF) {
    checkboxCIF.checked = false;
    utils.id('container-outros-pedidos-cif').style.display = 'none';
    const listaCIF = utils.id('lista-pedidos-cif');
    if (listaCIF) listaCIF.innerHTML = '';
  }
}
 
function irParaInspecao(numeroPedido) {
  ocultarTodas();
  erros.limparTodos();
  resetarCamposDinamicos(); // ✅ Limpar campos dinâmicos anteriores
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
  resetarCamposDinamicos(); // ✅ Limpar campos dinâmicos anteriores
 
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
 
  // ✅ Handler global para evitar erro de listener não respondido
  // Isso previne o erro "message channel closed before response" de extensões/service workers
  window.addEventListener('message', (event) => {
    // Ignorar mensagens de origens não confiáveis
    if (event.origin !== window.location.origin) return;
    
    // Se houver message ports, responder para evitar timeout
    if (event.ports && event.ports.length > 0) {
      try {
        event.ports[0].postMessage({ received: true });
        event.ports[0].close();
      } catch (e) {
        // Ignorar se falhar
      }
    }
  });
 
  // ✅ Handler para unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    // Suprimir aviso de messaging que não afeta a funcionalidade
    if (event.reason && typeof event.reason === 'object') {
      const msg = event.reason.message || '';
      if (msg.includes('listener') || msg.includes('channel') || msg.includes('closed')) {
        event.preventDefault();
      }
    }
  });
 
  // Event listeners
  document.addEventListener('change', (e) => {
    if (e.target.name === 'tipo_veiculo') atualizarCamposPorTipoVeiculo();
    if (e.target.name === 'paletes_opcao' && e.target.value === 'SIM') mostrarPaletes();
    if (e.target.name === 'paletes_opcao' && e.target.value === 'NAO') ocultarPaletes();
  });
 
  irParaCPF();
});
