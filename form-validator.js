// ============================================
// VALIDADOR AVANÇADO DE FORMULÁRIOS
// COM FEEDBACK VISUAL LIMPO E INTELIGENTE
// ============================================

/**
 * Sistema de validação que:
 * - Valida em tempo real (onchange/onblur)
 * - Mostra feedback inline limpo (sem alert)
 * - Mantém histórico de erros
 * - Integra com notificação ao submeter
 * - Suporta validação customizada
 */

class FormValidator {
  constructor(formId) {
    this.form = document.getElementById(formId);
    this.campos = {};
    this.erros = {};
    this.isSubmitting = false;
    this.inicializar();
  }

  /**
   * Inicializar validador
   */
  inicializar() {
    if (!this.form) {
      console.error('Formulário não encontrado');
      return;
    }

    // Obter todos os inputs/selects/textareas
    const elementos = this.form.querySelectorAll('input, select, textarea');

    elementos.forEach(el => {
      if (el.id) {
        this.campos[el.id] = {
          elemento: el,
          tipo: el.type || el.tagName.toLowerCase(),
          regras: [],
          valor: el.value
        };

        // Adicionar listeners para validação em tempo real
        el.addEventListener('blur', () => this.validarCampo(el.id));
        el.addEventListener('change', () => this.validarCampo(el.id));
        el.addEventListener('input', () => {
          // Debounce de validação durante digitação
          clearTimeout(this.timeoutInput);
          this.timeoutInput = setTimeout(() => {
            this.validarCampo(el.id);
          }, 500);
        });
      }
    });
  }

  /**
   * Adicionar regra de validação a um campo
   */
  adicionarRegra(idCampo, tipo, mensagem, opcoes = {}) {
    if (!this.campos[idCampo]) {
      console.warn(`Campo ${idCampo} não encontrado`);
      return;
    }

    this.campos[idCampo].regras.push({
      tipo,
      mensagem,
      opcoes
    });

    return this;
  }

  /**
   * Validar um campo individual
   */
  validarCampo(idCampo) {
    const campo = this.campos[idCampo];
    if (!campo) return true;

    const valor = campo.elemento.value.trim();
    const regras = campo.regras;

    // Limpar erro anterior
    this.limparErro(idCampo);

    // Validar cada regra
    for (let regra of regras) {
      const resultado = this.executarValidacao(valor, regra, campo);

      if (!resultado.valido) {
        this.mostrarErro(idCampo, resultado.mensagem);
        this.erros[idCampo] = resultado.mensagem;
        return false;
      }
    }

    // Se passou em todas as validações
    if (regras.length > 0) {
      this.mostrarSucesso(idCampo);
    }

    delete this.erros[idCampo];
    return true;
  }

  /**
   * Executar validação específica
   */
  executarValidacao(valor, regra, campo) {
    const { tipo, mensagem, opcoes } = regra;

    // Validações vazias
    if (!valor && tipo !== 'opcional') {
      return {
        valido: false,
        mensagem: mensagem || 'Este campo é obrigatório'
      };
    }

    if (!valor && tipo === 'opcional') {
      return { valido: true };
    }

    // Validações por tipo
    switch (tipo) {
      case 'obrigatorio':
        return { valido: valor !== '' };

      case 'cpf':
        const validacaoCPF = validador.validarCPF(valor);
        return {
          valido: validacaoCPF.valido,
          mensagem: mensagem || validacaoCPF.erro
        };

      case 'cnh':
        const validacaoCNH = validador.validarCNH(valor);
        return {
          valido: validacaoCNH.valido,
          mensagem: mensagem || validacaoCNH.erro
        };

      case 'rg':
        const validacaoRG = validador.validarRG(valor);
        return {
          valido: validacaoRG.valido,
          mensagem: mensagem || validacaoRG.erro
        };

      case 'placa':
        const validacaoPlaca = validador.validarPlaca(valor);
        return {
          valido: validacaoPlaca.valido,
          mensagem: mensagem || validacaoPlaca.erro
        };

      case 'telefone':
        const validacaoTel = validador.validarTelefone(valor);
        return {
          valido: validacaoTel.valido,
          mensagem: mensagem || validacaoTel.erro
        };

      case 'email':
        const validacaoEmail = validador.validarEmail(valor);
        return {
          valido: validacaoEmail.valido,
          mensagem: mensagem || validacaoEmail.erro
        };

      case 'pedido':
        const validacaoPedido = validador.validarPedido(valor);
        return {
          valido: validacaoPedido.valido,
          mensagem: mensagem || validacaoPedido.erro
        };

      case 'eixos':
        const validacaoEixos = validador.validarEixos(valor);
        return {
          valido: validacaoEixos.valido,
          mensagem: mensagem || validacaoEixos.erro
        };

      case 'minimo':
        return {
          valido: valor.length >= opcoes.min,
          mensagem: mensagem || `Mínimo de ${opcoes.min} caracteres`
        };

      case 'maximo':
        return {
          valido: valor.length <= opcoes.max,
          mensagem: mensagem || `Máximo de ${opcoes.max} caracteres`
        };

      case 'tamanho':
        return {
          valido: valor.length === opcoes.tamanho,
          mensagem: mensagem || `Deve ter exatamente ${opcoes.tamanho} caracteres`
        };

      case 'regex':
        return {
          valido: opcoes.pattern.test(valor),
          mensagem: mensagem || 'Formato inválido'
        };

      case 'customizado':
        const resultado = opcoes.funcao(valor);
        return {
          valido: resultado === true,
          mensagem: mensagem || (typeof resultado === 'string' ? resultado : 'Validação falhou')
        };

      case 'confirmacao':
        const campoComparacao = document.getElementById(opcoes.comparaCom);
        return {
          valido: valor === campoComparacao?.value,
          mensagem: mensagem || 'Os valores não correspondem'
        };

      default:
        return { valido: true };
    }
  }

  /**
   * Mostrar erro no campo
   */
  mostrarErro(idCampo, mensagem) {
    const campo = this.campos[idCampo];
    const elemento = campo.elemento;
    const container = elemento.closest('.input-group') || elemento.parentElement;

    // Remover feedback anterior
    this.removerFeedback(container);

    // Adicionar classe de erro
    container.classList.remove('has-success', 'has-warning');
    container.classList.add('has-error');

    // Criar elemento de feedback
    const feedback = document.createElement('div');
    feedback.className = 'form-feedback error';
    feedback.innerHTML = `
      <span class="feedback-icon">✕</span>
      <span class="feedback-message">${mensagem}</span>
    `;

    container.appendChild(feedback);

    // Animar entrada
    feedback.style.animation = 'slideIn 0.3s ease-out';
  }

  /**
   * Mostrar sucesso no campo
   */
  mostrarSucesso(idCampo) {
    const campo = this.campos[idCampo];
    const elemento = campo.elemento;
    const container = elemento.closest('.input-group') || elemento.parentElement;

    // Remover feedback anterior
    this.removerFeedback(container);

    // Adicionar classe de sucesso
    container.classList.remove('has-error', 'has-warning');
    container.classList.add('has-success');

    // Criar elemento de feedback (opcional)
    const feedback = document.createElement('div');
    feedback.className = 'form-feedback success';
    feedback.innerHTML = `
      <span class="feedback-icon">✓</span>
    `;

    container.appendChild(feedback);

    // Remover após 2 segundos
    setTimeout(() => {
      feedback.remove();
    }, 2000);
  }

  /**
   * Limpar erro de um campo
   */
  limparErro(idCampo) {
    const campo = this.campos[idCampo];
    const elemento = campo.elemento;
    const container = elemento.closest('.input-group') || elemento.parentElement;

    this.removerFeedback(container);
    container.classList.remove('has-error', 'has-success', 'has-warning');

    delete this.erros[idCampo];
  }

  /**
   * Remover elemento de feedback
   */
  removerFeedback(container) {
    const feedback = container?.querySelector('.form-feedback');
    if (feedback) feedback.remove();
  }

  /**
   * Validar formulário inteiro
   */
  validarFormulario() {
    let temErros = false;

    for (let idCampo in this.campos) {
      const campo = this.campos[idCampo];

      // Pular campos com validação vazia
      if (campo.regras.length === 0) continue;

      if (!this.validarCampo(idCampo)) {
        temErros = true;
      }
    }

    return !temErros;
  }

  /**
   * Obter todos os erros
   */
  obterErros() {
    return { ...this.erros };
  }

  /**
   * Obter valores do formulário
   */
  obterValores() {
    const valores = {};

    for (let idCampo in this.campos) {
      valores[idCampo] = this.campos[idCampo].elemento.value;
    }

    return valores;
  }

  /**
   * Resetar formulário e validações
   */
  resetar() {
    this.form.reset();
    this.erros = {};

    for (let idCampo in this.campos) {
      this.limparErro(idCampo);
    }
  }

  /**
   * Desabilitar/Habilitar formulário durante submissão
   */
  desabilitarDurante(durante = true) {
    const inputs = this.form.querySelectorAll('input, select, textarea, button');
    inputs.forEach(el => {
      el.disabled = durante;
    });
    this.isSubmitting = durante;
  }

  /**
   * Mostrar resumo de erros
   */
  mostrarResumoErros() {
    const erros = this.obterErros();
    const camposComErro = Object.keys(erros);

    if (camposComErro.length === 0) return true;

    // Criar mensagem de erro
    let mensagem = `<strong>Erros encontrados:</strong><br/>`;
    camposComErro.forEach(campo => {
      const elemento = this.campos[campo]?.elemento;
      const label = elemento?.previousElementSibling?.textContent || campo;
      mensagem += `• ${label}: ${erros[campo]}<br/>`;
    });

    // Mostrar notificação
    notificacao.erro('Formulário Inválido', mensagem);
    logger.registrarValidacaoFalhada('formulario', JSON.stringify(erros), 'Múltiplos campos inválidos');

    // Scroll para primeiro erro
    const primeiroComErro = document.getElementById(camposComErro[0]);
    if (primeiroComErro) {
      primeiroComErro.scrollIntoView({ behavior: 'smooth', block: 'center' });
      primeiroComErro.focus();
    }

    return false;
  }
}

// ============================================
// CSS PARA FEEDBACK DE VALIDAÇÃO
// ============================================

function adicionarCSSValidacao() {
  if (document.getElementById('form-validator-styles')) return;

  const style = document.createElement('style');
  style.id = 'form-validator-styles';
  style.textContent = `
    /* Container com validação */
    .input-group {
      position: relative;
      margin-bottom: 16px;
    }

    .input-group.has-error input,
    .input-group.has-error select,
    .input-group.has-error textarea {
      border-color: #dc3545 !important;
      background-color: #fff5f5;
    }

    .input-group.has-success input,
    .input-group.has-success select,
    .input-group.has-success textarea {
      border-color: #28a745 !important;
      background-color: #f0fdf4;
    }

    .input-group.has-warning input,
    .input-group.has-warning select,
    .input-group.has-warning textarea {
      border-color: #ff9800 !important;
      background-color: #fff8e1;
    }

    /* Feedback de validação */
    .form-feedback {
      margin-top: 6px;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
      animation: slideIn 0.3s ease-out;
    }

    .form-feedback.error {
      background: #fee2e2;
      color: #991b1b;
      border-left: 3px solid #dc3545;
    }

    .form-feedback.success {
      background: #dcfce7;
      color: #15803d;
      border-left: 3px solid #28a745;
    }

    .form-feedback.warning {
      background: #fef3c7;
      color: #92400e;
      border-left: 3px solid #ff9800;
    }

    .feedback-icon {
      font-weight: bold;
      font-size: 13px;
    }

    .feedback-message {
      flex: 1;
      line-height: 1.4;
    }

    /* Estado focado com erro */
    .input-group.has-error input:focus,
    .input-group.has-error select:focus,
    .input-group.has-error textarea:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1);
    }

    /* Estado focado com sucesso */
    .input-group.has-success input:focus,
    .input-group.has-success select:focus,
    .input-group.has-success textarea:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.1);
    }

    /* Animação de slide */
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Desabilitar durante submissão */
    .form-submitting input,
    .form-submitting select,
    .form-submitting textarea,
    .form-submitting button {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Destaque em erro */
    .input-group.has-error label {
      color: #dc3545;
    }

    /* Campo obrigatório */
    .required::after {
      content: ' *';
      color: #dc3545;
      font-weight: bold;
    }
  `;

  document.head.appendChild(style);
}

// Adicionar CSS ao carregar o módulo
adicionarCSSValidacao();

// Exportar classe
window.FormValidator = FormValidator;

// Exemplo de uso:
/*
// Criar validador
const validator = new FormValidator('meu-formulario');

// Adicionar regras
validator
  .adicionarRegra('cpf', 'cpf', 'CPF inválido')
  .adicionarRegra('nome', 'obrigatorio', 'Nome é obrigatório')
  .adicionarRegra('nome', 'minimo', 'Mínimo 3 caracteres', { min: 3 })
  .adicionarRegra('telefone', 'telefone', 'Telefone inválido')
  .adicionarRegra('placa', 'placa', 'Placa inválida')
  .adicionarRegra('senha', 'minimo', 'Mínimo 8 caracteres', { min: 8 })
  .adicionarRegra('confirma_senha', 'confirmacao', 'As senhas não correspondem', { comparaCom: 'senha' });

// Validar ao submeter
document.getElementById('meu-botao').addEventListener('click', (e) => {
  e.preventDefault();

  if (validator.validarFormulario()) {
    const valores = validator.obterValores();
    console.log('Formulário válido:', valores);
    // Enviar dados
  } else {
    validator.mostrarResumoErros();
  }
});

// Resetar
validator.resetar();
*/
