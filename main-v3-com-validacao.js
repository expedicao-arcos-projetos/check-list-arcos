// ============================================
// MAIN.JS V3 - COM VALIDAÇÃO AVANÇADA
// FEEDBACK VISUAL LIMPO (SEM ALERTS)
// ============================================

/**
 * Versão melhorada com:
 * - Validação avançada com feedback inline
 * - Sem alerts (popup)
 * - Mensagens de erro limpas e profissionais
 * - Validação em tempo real
 * - Indicadores visuais (cores, ícones)
 */

const WORKER_URL = 'https://sistema-inspecoes.samuelvivi1996.workers.dev';

const GABARITO = {
  q1: 'Borracha',
  q2: 'Todos os dias',
  q3: 'Ir para um ponto mais próximo indicado pela brigada de emergência',
  q4: 'Bloqueada pelo responsável CSN CIMENTOS.'
};

let validadorCPF = null;
let validadorIntegracao = null;
let validadorInspecaoFOB = null;
let validadorInspecaoCIF = null;

let dadosMotoristaAtual = {};
let ultimaInspecaoAtual = null;
let ehPrimeiraVez = false;
let tipoCarregamentoSelecionado = '';

const id = (el) => document.getElementById(el);

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  inicializarValidadores();
  
  if (!auth.estaAutenticado()) {
    irParaCPF();
  } else {
    irParaSelecaoCarregamento();
  }

  logger.registrarAcao('pagina_carregada', 'Sistema carregado');
});

/**
 * Inicializar todos os validadores de formulário
 */
function inicializarValidadores() {
  // Validador de CPF (Etapa 1)
  validadorCPF = new formValidator('form-cpf-busca');
  validadorCPF.adicionarRegra('input-cpf', 'cpf', 'CPF inválido');

  // Validador de Integração (Etapa 2)
  validadorIntegracao = new formValidator('form-prova');
  validadorIntegracao
    .adicionarRegra('reg-nome', 'obrigatorio', 'Nome completo é obrigatório')
    .adicionarRegra('reg-nome', 'minimo', 'Mínimo 3 caracteres', { min: 3 })
    .adicionarRegra('reg-rg', 'rg', 'RG inválido')
    .adicionarRegra('reg-telefone', 'telefone', 'Telefone com DDD inválido')
    .adicionarRegra('reg-placa', 'placa', 'Placa inválida');

  // Validador de Inspeção FOB (Etapa 3A)
  validadorInspecaoFOB = new formValidator('form-inspecao');
  validadorInspecaoFOB
    .adicionarRegra('nome', 'obrigatorio', 'Nome é obrigatório')
    .adicionarRegra('cnh', 'cnh', 'CNH inválida')
    .adicionarRegra('telefone', 'telefone', 'Telefone inválido')
    .adicionarRegra('placa', 'placa', 'Placa inválida')
    .adicionarRegra('pedido', 'pedido', 'Número de pedido inválido')
    .adicionarRegra('eixos', 'eixos', 'Quantidade de eixos inválida (1-9)');

  // Validador de Inspeção CIF (Etapa 3B)
  validadorInspecaoCIF = new formValidator('form-inspecao-cif');
  validadorInspecaoCIF
    .adicionarRegra('cif-nome', 'obrigatorio', 'Nome é obrigatório')
    .adicionarRegra('cif-cnh', 'cnh', 'CNH inválida')
    .adicionarRegra('cif-telefone', 'telefone', 'Telefone inválido')
    .adicionarRegra('cif-placa', 'placa', 'Placa inválida')
    .adicionarRegra('cif-pedido', 'pedido', 'Número de pedido inválido')
    .adicionarRegra('cif-eixos', 'eixos', 'Quantidade de eixos inválida (1-9)');
}

// ============================================
// ETAPA 1: VERIFICAR CPF E LOGIN
// ============================================

async function verificarAcesso() {
  const inputCPF = id('input-cpf');
  
  // Validar CPF
  if (!validadorCPF.validarCampo('input-cpf')) {
    return;
  }

  const cpf = inputCPF.value.trim();

  try {
    validadorCPF.desabilitarDurante(true);
    const toastCarregando = notificacao.carregando('Verificando acesso...');

    // Fazer login
    const resultadoLogin = await auth.login(cpf);
    
    toastCarregando.remove();
    logger.registrarLogin(cpf);
    notificacao.sucesso('Bem-vindo!', `Olá, ${resultadoLogin.nome || 'Motorista'}!`);

    // Verificar se é primeira vez
    const response = await auth.fazerRequisicaoSegura(`${WORKER_URL}/api/verificar-cpf`, {
      method: 'POST',
      body: JSON.stringify({ cpf })
    });

    const resultado = await response.json();

    ehPrimeiraVez = !resultado.existe;
    dadosMotoristaAtual = resultado.dados || {};
    ultimaInspecaoAtual = resultado.ultima_inspecao || null;

    if (ehPrimeiraVez) {
      logger.registrarAcao('primeiro_acesso', `Primeiro acesso do CPF ${cpf}`);
      irParaIntegracao();
    } else {
      logger.registrarAcao('acesso_repetido', `Acesso repetido do CPF ${cpf}`);
      irParaSelecaoCarregamento();
    }

  } catch (erro) {
    notificacao.erro('Erro de Autenticação', erro.message || 'Falha ao fazer login');
    logger.registrarErro('verificarAcesso', erro.stack);
  } finally {
    validadorCPF.desabilitarDurante(false);
  }
}

function irParaSelecaoCarregamento() {
  ocultarTodas();
  id('step-tipo-carregamento').classList.remove('hidden');
}

function confirmarTipoCarregamento() {
  const opcao = document.querySelector('input[name="modelo_carregamento"]:checked')?.value;

  if (!opcao) {
    notificacao.aviso('Seleção Obrigatória', 'Por favor, selecione o Tipo de Carregamento (FOB ou TRANSFERÊNCIA/CIF)!');
    logger.registrarValidacaoFalhada('tipo_carregamento', '', 'Não selecionado');
    return;
  }

  tipoCarregamentoSelecionado = opcao;

  if (opcao === 'FOB') {
    irParaInspecao();
  } else if (opcao === 'CIF') {
    irParaInspecaoCIF();
  }
}

// ============================================
// ETAPA 2: INTEGRAÇÃO & PROVA
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
  const nome = id('reg-nome').value.trim();
  const rg = id('reg-rg').value.trim();
  const telefone = id('reg-telefone').value.trim();
  const placa = id('reg-placa').value.trim().toUpperCase();

  // Validar campos
  if (!validadorIntegracao.validarFormulario()) {
    validadorIntegracao.mostrarResumoErros();
    return;
  }

  // Verificar aceites
  const aceiteVideo = id('aceite-video').checked;
  const aceitePPAE = id('aceite-ppae').checked;
  const aceiteFOB = id('aceite-fob').checked;
  const aceiteLGPD = id('aceite-lgpd')?.checked;

  if (!aceiteVideo) {
    notificacao.aviso('Aceite Obrigatório', 'Confirme que assistiu ao VÍDEO DE INTRODUÇÃO!');
    logger.registrarValidacaoFalhada('aceite_video', '', 'Não confirmado');
    return;
  }

  if (!aceitePPAE || !aceiteFOB || !aceiteLGPD) {
    notificacao.aviso('Aceites Obrigatórios', 'Marque o aceite em TODOS os termos de compromisso!');
    logger.registrarValidacaoFalhada('aceites', '', 'Não marcados');
    return;
  }

  // Verificar prova
  const respostas = {
    q1: document.querySelector('input[name="q1"]:checked')?.value,
    q2: document.querySelector('input[name="q2"]:checked')?.value,
    q3: document.querySelector('input[name="q3"]:checked')?.value,
    q4: document.querySelector('input[name="q4"]:checked')?.value
  };

  if (!respostas.q1 || !respostas.q2 || !respostas.q3 || !respostas.q4) {
    notificacao.aviso('Prova Incompleta', 'Responda todas as 4 questões!');
    logger.registrarValidacaoFalhada('prova', '', 'Questões não respondidas');
    return;
  }

  // Avaliar prova
  let acertos = 0;
  let detalhes = [];

  for (let questao in GABARITO) {
    if (respostas[questao] === GABARITO[questao]) {
      acertos++;
      detalhes.push(`✅ Q${questao.replace('q', '')}`);
    } else {
      detalhes.push(`❌ Q${questao.replace('q', '')}`);
    }
  }

  if (acertos < 4) {
    notificacao.erro(
      'Prova Reprovada',
      `Você acertou ${acertos}/4 questões.<br/>Precisa acertar TODAS as questões!<br/><br/>${detalhes.join('<br/>')}`
    );
    logger.registrarAcao('prova_reprovada', `Motorista errou ${4 - acertos} questões`, { detalhes });
    return;
  }

  // Prova aprovada - mostrar modal
  const confirmado = await notificacao.modal(
    'Parabéns! 🎉',
    `Você foi aprovado!<br/><br/>${detalhes.join('<br/>')}`,
    [{ label: 'Continuar', tipo: 'primary', valor: true }],
    'success'
  );

  if (!confirmado) return;

  try {
    validadorIntegracao.desabilitarDurante(true);
    const toastCarregando = notificacao.carregando('Salvando dados...');

    // Salvar motorista
    await salvarMotoristaComProva(nome, rg, telefone, placa, respostas);

    toastCarregando.remove();

    logger.registrarAcao('integracao_completa', 'Motorista integrado com sucesso', { nome });
    notificacao.sucesso('Integração Concluída!', 'Dados salvos com sucesso!');

    irParaSelecaoCarregamento();

  } catch (erro) {
    notificacao.erro('Erro ao Salvar', 'Falha ao salvar dados de integração');
    logger.registrarErro('concluirIntegracao', erro.stack);
  } finally {
    validadorIntegracao.desabilitarDurante(false);
  }
}

async function salvarMotoristaComProva(nome, rg, telefone, placa, respostas) {
  const cpf = auth.obterCPFAtual();

  const response = await auth.fazerRequisicaoSegura(`${WORKER_URL}/api/salvar-motorista`, {
    method: 'POST',
    body: JSON.stringify({
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
    })
  });

  if (!response.ok) {
    throw new Error('Falha ao salvar motorista');
  }
}

// ============================================
// CONTROLE DE PALETES
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

// ============================================
// ETAPA 3A: INSPEÇÃO FOB
// ============================================

function atualizarCamposPorTipoVeiculo() {
  const tipoVeiculo = document.querySelector('input[name="tipo_veiculo"]:checked')?.value;
  const containerTampaSilo = id('container-tampa-silo');
  const selectTampaSilo = id('tampa_silo');
  const secaoPaletes = id('secao-paletes');
  const radiosPaletes = document.querySelectorAll('input[name="paletes_opcao"]');

  if (tipoVeiculo === 'CARGA_SECA') {
    if (containerTampaSilo) containerTampaSilo.style.display = 'none';
    if (selectTampaSilo) selectTampaSilo.value = '';
    if (secaoPaletes) secaoPaletes.style.display = 'block';
  } else if (tipoVeiculo === 'CARRETA_SILO') {
    if (containerTampaSilo) containerTampaSilo.style.display = 'flex';
    if (selectTampaSilo) selectTampaSilo.value = '';
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

function preencherUltimoCarregamento() {
  if (!ultimaInspecaoAtual) return;

  const dados = ultimaInspecaoAtual;

  // Dados básicos
  if (id('nome') && dados.nome) id('nome').value = dados.nome;
  if (id('cnh') && dados.cnh) id('cnh').value = dados.cnh;
  if (id('telefone') && dados.telefone) id('telefone').value = dados.telefone;
  if (id('placa') && dados.placa) id('placa').value = dados.placa;
  if (id('eixos') && dados.eixos) id('eixos').value = dados.eixos;
  if (id('pedido')) id('pedido').value = '';

  // Tipo de veículo
  if (dados.tipo_veiculo) {
    const radioTipo = document.querySelector(`input[name="tipo_veiculo"][value="${dados.tipo_veiculo}"]`);
    if (radioTipo) {
      radioTipo.checked = true;
      atualizarCamposPorTipoVeiculo();
    }
  }

  // Itens de inspeção
  if (id('sinalizacao') && dados.sinalizacao) id('sinalizacao').value = dados.sinalizacao;
  if (id('pneus') && dados.pneus) id('pneus').value = dados.pneus;
  if (id('carroceria') && dados.carroceria) id('carroceria').value = dados.carroceria;
  if (id('cinto') && dados.cinto) id('cinto').value = dados.cinto;
  if (id('farois') && dados.farois) id('farois').value = dados.farois;
  if (id('alarme_re') && dados.alarme_re) id('alarme_re').value = dados.alarme_re;
  if (id('vazamentos') && dados.vazamentos) id('vazamentos').value = dados.vazamentos;
  if (id('calcos') && dados.calcos) id('calcos').value = dados.calcos;
  if (id('tampa_silo') && dados.tampa_silo) id('tampa_silo').value = dados.tampa_silo;

  // EPIs
  if (id('epi_capacete') && dados.epi_capacete) id('epi_capacete').value = dados.epi_capacete;
  if (id('epi_colete') && dados.epi_colete) id('epi_colete').value = dados.epi_colete;
  if (id('epi_oculos') && dados.epi_oculos) id('epi_oculos').value = dados.epi_oculos;
  if (id('epi_botina') && dados.epi_botina) id('epi_botina').value = dados.epi_botina;
  if (id('epi_luvas') && dados.epi_luvas) id('epi_luvas').value = dados.epi_luvas;

  // Paletes
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

async function gerarJSONeToken() {
  const cpf = auth.obterCPFAtual();
  
  let placaDigitada = id('placa').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let pedidoDigitado = id('pedido').value.trim();
  let eixosDigitados = id('eixos').value.trim();
  let telefoneDigitado = id('telefone').value.trim();

  const tipoVeiculo = document.querySelector('input[name="tipo_veiculo"]:checked')?.value;

  if (!tipoVeiculo) {
    notificacao.aviso('Tipo de Veículo', 'Por favor, selecione qual é o seu tipo de veículo!');
    logger.registrarValidacaoFalhada('tipo_veiculo', '', 'Não selecionado');
    return;
  }

  // Validar campos
  if (!validadorInspecaoFOB.validarFormulario()) {
    validadorInspecaoFOB.mostrarResumoErros();
    return;
  }

  // Verificar campos de inspeção
  const camposInspecao = [
    'sinalizacao', 'pneus', 'carroceria', 'cinto',
    'farois', 'alarme_re', 'vazamentos', 'calcos',
    'tampa_silo', 'epi_capacete', 'epi_colete',
    'epi_oculos', 'epi_botina', 'epi_luvas'
  ];

  let temErroInspecao = false;
  for (let campo of camposInspecao) {
    if (!id(campo)?.value) {
      notificacao.aviso('Campo Obrigatório', `Campo de inspeção vazio: ${campo}`);
      temErroInspecao = true;
      break;
    }
  }

  if (temErroInspecao) return;

  // Verificar paletes
  let paletesOpcao = document.querySelector('input[name="paletes_opcao"]:checked')?.value;
  let quantidadePaletes = '';

  if (tipoVeiculo === 'CARRETA_SILO') {
    paletesOpcao = 'NA';
  } else if (paletesOpcao === 'SIM') {
    quantidadePaletes = id('quantidade-paletes').value.trim();
    if (!quantidadePaletes) {
      notificacao.aviso('Quantidade de Paletes', 'Informe a quantidade de paletes!');
      return;
    }
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
    tampa_silo: tipoVeiculo === 'CARGA_SECA' ? 'NA' : id('tampa_silo').value,
    epi_capacete: id('epi_capacete').value,
    epi_colete: id('epi_colete').value,
    epi_oculos: id('epi_oculos').value,
    epi_botina: id('epi_botina').value,
    epi_luvas: id('epi_luvas').value,
    paletes_opcao: paletesOpcao || 'NA',
    paletes_quantidade: quantidadePaletes || ''
  };

  try {
    validadorInspecaoFOB.desabilitarDurante(true);
    const toastCarregando = notificacao.carregando('Salvando inspeção...');

    const response = await auth.fazerRequisicaoSegura(`${WORKER_URL}/api/salvar-inspecao`, {
      method: 'POST',
      body: JSON.stringify({
        cpf,
        inspecao_dados: inspecao
      })
    });

    const resultado = await response.json();

    toastCarregando.remove();

    if (resultado.sucesso) {
      await offlineSync.salvarRascunhoInspecao(`inspecao_${resultado.id_inspecao}`, inspecao);

      id('form-inspecao').reset();
      id('token-gerado').innerText = resultado.id_inspecao;

      logger.registrarInspecao(cpf, 'FOB', resultado.id_inspecao, {
        placa: inspecao.placa,
        pedido: inspecao.pedido
      });

      notificacao.sucesso('Inspeção Concluída! 🎉', `Código: ${resultado.id_inspecao}`);
      irParaSucesso();
    } else {
      throw new Error(resultado.erro || 'Falha ao salvar');
    }

  } catch (erro) {
    notificacao.erro('Erro ao Salvar', erro.message);
    logger.registrarErro('gerarJSONeToken', erro.stack);

    try {
      const idRascunho = await offlineSync.salvarRascunhoInspecao(null, inspecao);
      notificacao.aviso('Modo Offline', `Salvo localmente. ID: ${idRascunho}`);
    } catch (erroOffline) {
      logger.registrarErro('salvar_offline', erroOffline.stack);
    }
  } finally {
    validadorInspecaoFOB.desabilitarDurante(false);
  }
}

// ============================================
// ETAPA 3B: INSPEÇÃO CIF
// ============================================

async function salvarInspecaoCIF() {
  const cpf = auth.obterCPFAtual();

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

  // Validar campos
  if (!validadorInspecaoCIF.validarFormulario()) {
    validadorInspecaoCIF.mostrarResumoErros();
    return;
  }

  if (!nome || !cnh) {
    notificacao.aviso('Dados Incompletos', 'Preencha Nome e CNH!');
    return;
  }

  if (!tipoChecklist || !segmento) {
    notificacao.aviso('Informações Obrigatórias', 'Selecione Tipo de Checklist CIP e Segmento!');
    return;
  }

  const inspecaoDados = {
    nome,
    cnh,
    telefone,
    placa,
    pedido,
    eixos,
    data: new Date().toLocaleDateString('pt-BR'),
    tipo_checklist: tipoChecklist,
    segmento: segmento,
    observacoes: ''
  };

  // Verificar 32 itens
  for (let i = 1; i <= 32; i++) {
    const elItem = id(`cif-item-${i}`);
    const valorItem = elItem ? elItem.value : '';

    if (!valorItem) {
      notificacao.aviso('Item Faltando', `Selecione resposta para o Item ${i}!`);
      return;
    }

    inspecaoDados[`item_${i}`] = valorItem;
  }

  try {
    validadorInspecaoCIF.desabilitarDurante(true);
    const toastCarregando = notificacao.carregando('Salvando inspeção CIF...');

    const response = await auth.fazerRequisicaoSegura(`${WORKER_URL}/api/salvar-inspecao-cif`, {
      method: 'POST',
      body: JSON.stringify({
        cpf,
        inspecao_dados: inspecaoDados
      })
    });

    const resultado = await response.json();

    toastCarregando.remove();

    if (resultado.sucesso) {
      await offlineSync.salvarRascunhoInspecao(`inspecao_cif_${resultado.id_inspecao}`, inspecaoDados);

      id('form-inspecao-cif').reset();
      id('token-gerado').innerText = resultado.id_inspecao;

      logger.registrarInspecao(cpf, 'CIF', resultado.id_inspecao, {
        placa,
        pedido,
        tipo_checklist: tipoChecklist
      });

      notificacao.sucesso('Inspeção CIF Concluída! 🎉', `Código: ${resultado.id_inspecao}`);
      irParaSucesso();
    } else {
      throw new Error(resultado.erro || 'Falha ao salvar');
    }

  } catch (erro) {
    notificacao.erro('Erro ao Salvar CIF', erro.message);
    logger.registrarErro('salvarInspecaoCIF', erro.stack);

    try {
      const idRascunho = await offlineSync.salvarRascunhoInspecao(null, inspecaoDados);
      notificacao.aviso('Modo Offline', `Salvo localmente. ID: ${idRascunho}`);
    } catch (erroOffline) {
      logger.registrarErro('salvar_cif_offline', erroOffline.stack);
    }
  } finally {
    validadorInspecaoCIF.desabilitarDurante(false);
  }
}

// ============================================
// NAVEGAÇÃO
// ============================================

function copiarToken() {
  const token = id('token-gerado').innerText;
  navigator.clipboard.writeText(token).then(() => {
    notificacao.sucesso('Copiado!', 'Código copiado para a área de transferência');
    logger.registrarAcao('token_copiado', `Token ${token} copiado`);
  }).catch(() => {
    notificacao.erro('Erro', 'Não foi possível copiar o código');
  });
}

function voltarPaginaAnterior() {
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
  logger.registrarLogout();
  auth.logout();
  ocultarTodas();

  validadorCPF?.resetar();
  validadorIntegracao?.resetar();
  validadorInspecaoFOB?.resetar();
  validadorInspecaoCIF?.resetar();

  dadosMotoristaAtual = {};
  ultimaInspecaoAtual = null;
  ehPrimeiraVez = false;
  tipoCarregamentoSelecionado = '';

  id('step-cpf').classList.remove('hidden');
}

function irParaIntegracao() {
  ocultarTodas();

  validadorIntegracao?.resetar();
  ocultarQuantidadePaletes();
  alternarBloqueioProva();

  id('step-integracao').classList.remove('hidden');
}

function irParaInspecao() {
  ocultarTodas();
  validadorInspecaoFOB?.resetar();
  id('step-inspecao').classList.remove('hidden');
  
  preencherUltimoCarregamento();
}

function irParaInspecaoCIF() {
  ocultarTodas();
  validadorInspecaoCIF?.resetar();

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
  if (id('cif-pedido')) id('cif-pedido').value = '';

  id('step-inspecao-cif').classList.remove('hidden');
}

function irParaSucesso() {
  ocultarTodas();
  id('step-sucesso').classList.remove('hidden');
}

function ocultarTodas() {
  id('step-cpf').classList.add('hidden');
  id('step-integracao').classList.add('hidden');
  id('step-tipo-carregamento').classList.add('hidden');
  id('step-inspecao').classList.add('hidden');
  id('step-inspecao-cif').classList.add('hidden');
  id('step-sucesso').classList.add('hidden');

  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
}

// ============================================
// SINCRONIZAÇÃO PERIÓDICA
// ============================================

setInterval(() => {
  if (auth.estaAutenticado()) {
    offlineSync.sincronizarOperacoes();
  }
}, 60000);

window.addEventListener('beforeunload', () => {
  if (auth.estaAutenticado()) {
    logger.registrarLogout();
    auth.logout();
  }
});
