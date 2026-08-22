// ============================================
// CONFIGURAÇÃO - DADOS DO CADASTRO
// ============================================
 
const WORKER_URL = 'https://sistema-inspecoes.samuelvivi1996.workers.dev';
const DEBUG = false;
 
const GABARITO = {
  q1: 'Borracha',
  q2: 'Todos os dias',
  q3: 'Ir para um ponto mais próximo indicado pela brigada de emergência',
  q4: 'Bloqueada pelo responsável CSN CIMENTOS.'
};
 
let dadosMotoristaAtual = {};
let ultimaInspecaoAtual = null;
let ehPrimeiraVez = false;
let tipoCarregamentoSelecionado = '';
 
// ✅ DADOS DO CADASTRO (para preencher em FOB e CIF)
let dadosCadastroMotorista = {
  nome: '',
  placa: '',
  telefone: '',
  rg: '',
  eixos: ''
};
 
function obterCPFTemporario() {
  return sessionStorage.getItem('cpf_temp') || '';
}
 
function armazenarCPFTemporario(cpf) {
  sessionStorage.setItem('cpf_temp', cpf);
}
 
function limparCPFTemporario() {
  sessionStorage.removeItem('cpf_temp');
}
 
function id(el) {
  return document.getElementById(el);
}
 
function debugLog(mensagem, dados = null) {
  if (!DEBUG) return;
  console.log(`[DEBUG] ${mensagem}`, dados || '');
}
 
function mostrarErroInline(elementId, mensagem) {
  const elemento = id(elementId);
  if (!elemento) return;
 
  const container = elemento.closest('.input-group') || elemento.closest('.aceite-container') || elemento.parentElement;
  removerErroInline(elementId);
  container.classList.add('has-error');
 
  const feedback = document.createElement('div');
  feedback.className = 'form-feedback error';
  feedback.textContent = `✕ ${mensagem}`;
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
 
// ============================================
// VALIDAÇÕES
// ============================================
 
function validarCPF(cpf) {
  const limpo = cpf.replace(/[^\d]/g, '');
  if (limpo.length !== 11) return false;
  if (/^(\d)\1+$/.test(limpo)) return false;
  return true;
}
 
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
  debugLog('verificarAcesso iniciada');
  limparTodosErros();
  const inputCPF = id('input-cpf');
  const cpf = inputCPF.value.trim().replace(/[^\d]/g, '');
 
  if (!validarCPF(cpf)) {
    mostrarErroInline('input-cpf', 'CPF inválido! Digite os 11 números corretamente.');
    return;
  }
 
  armazenarCPFTemporario(cpf);
 
  try {
    const response = await fetch(`${WORKER_URL}/api/verificar-cpf`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ cpf: cpf })
    });
 
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const resultado = await response.json();
    
    debugLog('✓ Acesso verificado');
 
    if (resultado.existe) {
      ehPrimeiraVez = false;
      dadosMotoristaAtual = resultado.dados || {};
      ultimaInspecaoAtual = resultado.ultima_inspecao || null;
      
      // ✅ ARMAZENAR DADOS DO CADASTRO DO MOTORISTA
      dadosCadastroMotorista = {
        nome: dadosMotoristaAtual.nome || '',
        placa: dadosMotoristaAtual.placa || '',
        telefone: dadosMotoristaAtual.telefone || '',
        rg: '',
        eixos: ''
      };
      
      irParaSelecaoCarregamento();
    } else {
      ehPrimeiraVez = true;
      dadosMotoristaAtual = {};
      ultimaInspecaoAtual = null;
      dadosCadastroMotorista = { nome: '', placa: '', telefone: '', rg: '', eixos: '' };
      irParaIntegracao();
    }
  } catch (erro) {
    debugLog('Erro de conexão');
    mostrarErroInline('input-cpf', 'Erro ao conectar. Verifique internet.');
  } finally {
    inputCPF.value = '';
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
 
async function confirmarTipoCarregamento() {
  limparTodosErros();
  const opcao = document.querySelector('input[name="modelo_carregamento"]:checked')?.value;
 
  if (!opcao) {
    mostrarErroInline('step-tipo-carregamento', 'Selecione FOB ou TRANSFERÊNCIA/CIF!');
    return;
  }
 
  tipoCarregamentoSelecionado = opcao;
 
  try {
    const cpf = obterCPFTemporario();
    const response = await fetch(`${WORKER_URL}/api/ultima-inspecao-por-tipo`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ cpf: cpf, tipo: opcao })
    });
 
    if (response.ok) {
      const resultado = await response.json();
      ultimaInspecaoAtual = resultado.ultima_inspecao || null;
      debugLog(`Última inspeção ${opcao} carregada`);
    }
  } catch (erro) {
    debugLog('Erro ao buscar inspeção');
  }
 
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
    const cpf = obterCPFTemporario();
    const sucesso = await salvarMotoristaComProva(cpf, nome, rg, telefone, placa, respostas);
    if (sucesso) {
      // ✅ ARMAZENAR DADOS DO CADASTRO APÓS INTEGRAÇÃO
      dadosCadastroMotorista = {
        nome: nome,
        placa: placa,
        telefone: telefone,
        rg: rg,
        eixos: ''
      };
      irParaSelecaoCarregamento();
    }
  } else {
    mostrarErroInline('secao-prova', `Acertou ${acertos}/4. Precisa acertar TODAS!`);
  }
}
 
async function salvarMotoristaComProva(cpf, nome, rg, telefone, placa, respostas) {
  try {
    const response = await fetch(`${WORKER_URL}/api/salvar-motorista`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpf, nome, rg, telefone, placa,
        aceite_video: true, aceite_ppae: true, aceite_fob: true, aceite_lgpd: true,
        data_aceite: new Date().toISOString(),
        prova_respondida: { data: new Date().toISOString(), respostas, resultado: 'aprovado' }
      })
    });
 
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
 
    const resultado = await response.json();
    
    if (resultado.sucesso) {
      debugLog('✓ Motorista cadastrado');
      return true;
    } else {
      mostrarErroInline('reg-nome', resultado.erro || 'Erro ao cadastrar. Tente novamente.');
      return false;
    }
  } catch (erro) {
    debugLog('Erro ao salvar motorista');
    mostrarErroInline('reg-nome', 'Erro ao cadastrar. Tente novamente.');
    return false;
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
  // ✅ PRIORIDADE 1: Preencher com dados do cadastro
  if (id('nome')) id('nome').value = dadosCadastroMotorista.nome || '';
  if (id('placa')) id('placa').value = dadosCadastroMotorista.placa || '';
  if (id('telefone')) id('telefone').value = dadosCadastroMotorista.telefone || '';
 
  // ✅ PRIORIDADE 2: Se tiver última inspeção, preenche EIXOS e ITENS
  if (ultimaInspecaoAtual) {
    const dados = ultimaInspecaoAtual;
    
    // Eixos vem da última inspeção
    if (id('eixos') && dados.eixos) id('eixos').value = dados.eixos;
    
    // CNH pode vir da última inspeção
    if (id('cnh') && dados.cnh) id('cnh').value = dados.cnh;
    
    // ✅ Tipo de veículo vem da última inspeção
    if (dados.tipo_veiculo) {
      const radioTipo = document.querySelector(`input[name="tipo_veiculo"][value="${dados.tipo_veiculo}"]`);
      if (radioTipo) {
        radioTipo.checked = true;
        atualizarCamposPorTipoVeiculo();
      }
    }
    
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
    
    // Paletes
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
  debugLog('Preenchendo último CIF');
  
  // ✅ PRIORIDADE 1: Preencher com dados do cadastro
  if (id('cif-nome')) id('cif-nome').value = dadosCadastroMotorista.nome || '';
  if (id('cif-placa')) id('cif-placa').value = dadosCadastroMotorista.placa || '';
  if (id('cif-telefone')) id('cif-telefone').value = dadosCadastroMotorista.telefone || '';
 
  // ✅ PRIORIDADE 2: Se tiver última inspeção, preenche EIXOS e ITENS
  if (ultimaInspecaoAtual) {
    const dados = ultimaInspecaoAtual;
    
    // Eixos vem da última inspeção
    if (id('cif-eixos') && dados.eixos) id('cif-eixos').value = dados.eixos;
    
    // CNH pode vir da última inspeção
    if (id('cif-cnh') && dados.cnh) id('cif-cnh').value = dados.cnh;
    
    // Preenche campos específicos CIF
    if (id('cif-tipo-checklist')) id('cif-tipo-checklist').value = dados.tipo_checklist || '';
    if (id('cif-segmento')) id('cif-segmento').value = dados.segmento || '';
    if (id('cif-transportadora')) id('cif-transportadora').value = dados.transportadora || '';
    
    // Tipo de veículo
    if (dados.tipo_veiculo_cif) {
      const radioTipo = document.querySelector(`input[name="cif_tipo_veiculo"][value="${dados.tipo_veiculo_cif}"]`);
      if (radioTipo) radioTipo.checked = true;
    }
    
    // Paletes
    if (dados.trouxe_palete && dados.trouxe_palete !== 'N/A') {
      const radioPalete = document.querySelector(`input[name="cif_paletes_opcao"][value="${dados.trouxe_palete}"]`);
      if (radioPalete) {
        radioPalete.checked = true;
        if (dados.trouxe_palete === 'SIM') {
          alternarQtdPaletesCIF(true);
          if (id('cif-qtd-paletes')) id('cif-qtd-paletes').value = dados.quantidade_palete || '';
        }
      }
    }
    
    // 32 itens CIF
    for (let i = 1; i <= 32; i++) {
      const itemId = `cif-item-${i}`;
      const itemEl = id(itemId);
      const valor = dados[`item_${i}`];
      
      if (itemEl && valor) {
        itemEl.value = valor;
      }
    }
    
    debugLog('✓ Último CIF preenchido');
  } else {
    debugLog('Nenhum CIF anterior');
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
  const tipoVeiculo = document.querySelector('input[name="tipo_veiculo"]:checked')?.value;
 
  if (!nome) return mostrarErroInline('nome', 'Informe nome');
  if (!cnh) return mostrarErroInline('cnh', 'Informe CNH');
  if (!validarTelefone(telefone)) return mostrarErroInline('telefone', 'Telefone inválido');
  if (!validarPlaca(placa)) return mostrarErroInline('placa', 'Placa inválida');
  if (!validarPedido(pedido)) return mostrarErroInline('pedido', 'Pedido inválido');
  if (!validarEixos(eixos)) return mostrarErroInline('eixos', 'Eixos inválido');
  if (!tipoVeiculo) return mostrarErroInline('form-inspecao', 'Selecione tipo de veículo');
 
  const itensObrigatorios = ['sinalizacao', 'pneus', 'carroceria', 'cinto', 'farois', 'alarme_re', 'vazamentos', 'calcos', 'epi_capacete', 'epi_colete', 'epi_oculos', 'epi_botina', 'epi_luvas'];
  for (let campo of itensObrigatorios) {
    if (!id(campo).value) return mostrarErroInline(campo, 'Selecione opção');
  }
 
  const inspecao = {
    nome, cnh, placa, pedido, eixos, telefone,
    tipo_veiculo: tipoVeiculo,
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
    const cpf = obterCPFTemporario();
    const response = await fetch(`${WORKER_URL}/api/salvar-inspecao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: cpf, inspecao_dados: inspecao })
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
    debugLog('Erro ao salvar FOB');
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
 
  const nome = id('cif-nome')?.value.trim() || dadosCadastroMotorista.nome || '';
  const cnh = id('cif-cnh')?.value.trim() || (ultimaInspecaoAtual?.cnh || '');
  const telefone = id('cif-telefone')?.value.trim() || dadosCadastroMotorista.telefone || '';
  let placa = (id('cif-placa')?.value.trim() || dadosCadastroMotorista.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const pedido = id('cif-pedido')?.value.trim();
  const eixos = id('cif-eixos')?.value.trim() || dadosCadastroMotorista.eixos || '';
  const tipoChecklist = id('cif-tipo-checklist')?.value;
  const segmento = id('cif-segmento')?.value;
  const transportadora = segmento === 'Transportador' ? id('cif-transportadora')?.value : 'N/A';
  const tipoVeiculoCIF = document.querySelector('input[name="cif_tipo_veiculo"]:checked')?.value;
 
  if (!nome) return mostrarErroInline('cif-nome', 'Informe nome');
  if (!cnh) return mostrarErroInline('cif-cnh', 'Informe CNH');
  if (!validarTelefone(telefone)) return mostrarErroInline('cif-telefone', 'Telefone inválido');
  if (!validarPlaca(placa)) return mostrarErroInline('cif-placa', 'Placa inválida');
  if (!validarPedido(pedido)) return mostrarErroInline('cif-pedido', 'Pedido inválido');
  if (!validarEixos(eixos)) return mostrarErroInline('cif-eixos', 'Eixos inválido');
  if (!tipoChecklist) return mostrarErroInline('cif-tipo-checklist', 'Selecione checklist');
  if (!segmento) return mostrarErroInline('cif-segmento', 'Selecione segmento');
  if (!tipoVeiculoCIF) return mostrarErroInline('step-inspecao-cif', 'Selecione tipo veículo');
  if (segmento === 'Transportador' && !transportadora) return mostrarErroInline('cif-transportadora', 'Selecione transportadora');
 
  let trouxePalete = 'N/A';
  let qtdPalete = 'N/A';
 
  if (tipoVeiculoCIF === 'CARGA_SECA') {
    let paleteSelecionado = document.querySelector('input[name="cif_paletes_opcao"]:checked')?.value;
    if (!paleteSelecionado) return mostrarErroInline('secao-paletes-cif', 'Selecione paletes');
    
    if (paleteSelecionado === 'SIM') {
      trouxePalete = 'SIM';
      qtdPalete = id('cif-qtd-paletes')?.value.trim();
      if (!qtdPalete) return mostrarErroInline('cif-qtd-paletes', 'Informe quantidade');
    } else if (paleteSelecionado === 'NAO' || paleteSelecionado === 'NÃO') {
      trouxePalete = 'NAO';
      qtdPalete = 'N/A';
    }
  }
 
  const inspecaoDados = {
    nome, cnh, placa, pedido, eixos, telefone,
    tipo_checklist: tipoChecklist, segmento, transportadora,
    tipo_veiculo_cif: tipoVeiculoCIF,
    trouxe_palete: trouxePalete,
    quantidade_palete: qtdPalete
  };
 
  for (let i = 1; i <= 32; i++) {
    const val = id(`cif-item-${i}`)?.value;
    if (!val) return mostrarErroInline(`cif-item-${i}`, `Selecione item ${i}`);
    
    let valorNormalizado = val;
    if (val === 'NAO' || val === 'NÃO') valorNormalizado = 'NAO';
    if (val === 'SIM') valorNormalizado = 'SIM';
    if (val === 'N/A' || val === 'NA') valorNormalizado = 'N/A';
    
    inspecaoDados[`item_${i}`] = valorNormalizado;
  }
 
  try {
    const cpf = obterCPFTemporario();
    const response = await fetch(`${WORKER_URL}/api/salvar-inspecao-cif`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: cpf, inspecao_dados: inspecaoDados })
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
    debugLog('Erro ao salvar CIF');
    mostrarErroInline('form-inspecao-cif', 'Erro conexão!');
  }
}
 
// ============================================
// NAVEGAÇÃO
// ============================================
 
function copiarToken() {
  const token = id('token-gerado').innerText;
  const tokenContainer = id('token-gerado')?.parentElement;
  
  navigator.clipboard.writeText(token).then(() => {
    // ✅ Mostrar mensagem embaixo do token
    mostrarMensagemCopia(tokenContainer, '✅ Código copiado!', 'sucesso');
  }).catch(() => {
    // ❌ Mostrar erro
    mostrarMensagemCopia(tokenContainer, '❌ Erro ao copiar. Use manualmente: ' + token, 'erro');
  });
}
 
// ✅ Função auxiliar para mostrar mensagem embaixo do token
function mostrarMensagemCopia(container, mensagem, tipo) {
  // Remover mensagem anterior se existir
  const mensagemAnterior = container?.querySelector('.msg-copia');
  if (mensagemAnterior) mensagemAnterior.remove();
  
  // Criar novo elemento de mensagem
  const msgElement = document.createElement('div');
  msgElement.className = `msg-copia msg-${tipo}`;
  msgElement.textContent = mensagem;
  msgElement.style.cssText = `
    margin-top: 10px;
    padding: 10px 15px;
    border-radius: 4px;
    font-size: 14px;
    text-align: center;
    animation: fadeInOut 0.3s ease-in;
    ${tipo === 'sucesso' ? 'background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : 'background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;'}
  `;
  
  container?.appendChild(msgElement);
  
  // Remover após 3 segundos
  setTimeout(() => {
    msgElement.style.animation = 'fadeOutUp 0.3s ease-out';
    setTimeout(() => msgElement.remove(), 300);
  }, 3000);
}
 
// ✅ Adicionar CSS para animações
if (!document.querySelector('style[data-msg-copia]')) {
  const style = document.createElement('style');
  style.setAttribute('data-msg-copia', 'true');
  style.textContent = `
    @keyframes fadeInOut {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeOutUp {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-5px); }
    }
  `;
  document.head.appendChild(style);
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
 
  dadosMotoristaAtual = {};
  ultimaInspecaoAtual = null;
  ehPrimeiraVez = false;
  dadosCadastroMotorista = { nome: '', placa: '', telefone: '', rg: '', eixos: '' };
  limparCPFTemporario();
 
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
  
  id('step-inspecao-cif').classList.remove('hidden');
 
  if (numeroPedido && id('cif-pedido')) {
    id('cif-pedido').value = numeroPedido;
    id('cif-pedido').readOnly = true;
  }
 
  setTimeout(() => {
    preencherUltimoCIF();
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
 
// ============================================
// INICIALIZAÇÃO
// ============================================
 
document.addEventListener('DOMContentLoaded', () => {
  debugLog('Aplicação iniciada');
  irParaCPF();
});
