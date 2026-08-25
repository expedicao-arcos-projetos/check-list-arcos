// ============================================
// OBJETO DE REGRAS AUXILIARES
// ============================================
const validador = {
  validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return { valido: false, erro: 'CPF inválido (11 dígitos)' };
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return { valido: false, erro: 'CPF inválido' };
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return { valido: false, erro: 'CPF inválido' };
    return { valido: true };
  },
 
  validarCNH(cnh) {
    cnh = cnh.replace(/[^\d]+/g, '');
    if (cnh.length !== 11) return { valido: false, erro: 'CNH deve ter 11 dígitos' };
    return { valido: true };
  },
 
  validarRG(rg) {
    rg = rg.replace(/[^\d]+/g, '');
    if (rg.length < 5) return { valido: false, erro: 'RG inválido' };
    return { valido: true };
  },
 
  validarPlaca(placa) {
    placa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const regexPlaca = /^[A-Z]{3}[0-9]{4}$|^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
    return {
      valido: regexPlaca.test(placa),
      erro: 'Placa inválida (Use ABC1234 ou ABC1A34)'
    };
  },
 
  validarTelefone(tel) {
    tel = tel.replace(/[^\d]+/g, '');
    return {
      valido: tel.length >= 10 && tel.length <= 11,
      erro: 'Telefone inválido (Informe DDD + número)'
    };
  },
 
  validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return { valido: regex.test(email), erro: 'E-mail inválido' };
  },
 
  validarPedido(pedido) {
    pedido = pedido.replace(/[^\d]+/g, '');
    return { valido: pedido.length >= 6, erro: 'Número de pedido inválido' };
  },
 
  validarPedidoFOB(pedido) {
    pedido = pedido.replace(/[^\d]+/g, '');
    return {
      valido: pedido.length === 7,
      erro: 'Pedido FOB deve ter exatamente 7 dígitos'
    };
  },
 
  validarPedidoCIF(pedido) {
    pedido = pedido.replace(/[^\d]+/g, '');
    return {
      valido: pedido.length === 9,
      erro: 'Pedido CIF/Transferência deve ter exatamente 9 dígitos'
    };
  },
 
  validarMultiplosPedidos(pedidos, tipo = 'fob') {
    if (!pedidos || typeof pedidos !== 'string') {
      return { valido: false, erro: 'Pedidos inválidos' };
    }
 
    // Se contém "/", são múltiplos
    if (pedidos.includes('/')) {
      const pedidosArray = pedidos.split('/');
      for (let p of pedidosArray) {
        const limpo = p.trim().replace(/[^\d]/g, '');
        if (!limpo) continue;
 
        const tamanhoEsperado = tipo === 'fob' ? 7 : 9;
        if (limpo.length !== tamanhoEsperado) {
          const mensagem = tipo === 'fob'
            ? 'Pedido FOB deve ter exatamente 7 dígitos'
            : 'Pedido CIF deve ter exatamente 9 dígitos';
          return { valido: false, erro: mensagem };
        }
      }
      return { valido: true };
    }
 
    // Pedido único
    const resultado = tipo === 'fob'
      ? this.validarPedidoFOB(pedidos)
      : this.validarPedidoCIF(pedidos);
    return resultado;
  },
 
  validarEixos(eixos) {
    const num = parseInt(eixos, 10);
    return { valido: !isNaN(num) && num >= 1 && num <= 9, erro: 'Informe eixos entre 1 e 9' };
  }
};
 
// ============================================
// VALIDADOR AVANÇADO DE FORMULÁRIOS
// ============================================
 
class FormValidator {
  constructor(formId) {
    this.form = document.getElementById(formId);
    this.campos = {};
    this.erros = {};
    this.isSubmitting = false;
    this.inicializar();
  }
 
  inicializar() {
    if (!this.form) return;
 
    const elementos = this.form.querySelectorAll('input, select, textarea');
    elementos.forEach(el => {
      if (el.id) {
        this.campos[el.id] = {
          elemento: el,
          tipo: el.type || el.tagName.toLowerCase(),
          regras: [],
          valor: el.value
        };
 
        el.addEventListener('blur', () => this.validarCampo(el.id));
        el.addEventListener('change', () => this.validarCampo(el.id));
        el.addEventListener('input', () => {
          clearTimeout(this.timeoutInput);
          this.timeoutInput = setTimeout(() => {
            this.validarCampo(el.id);
          }, 500);
        });
      }
    });
  }
 
  adicionarRegra(idCampo, tipo, mensagem, opcoes = {}) {
    if (!this.campos[idCampo]) return this;
 
    this.campos[idCampo].regras.push({
      tipo,
      mensagem,
      opcoes
    });
 
    return this;
  }
 
  validarCampo(idCampo) {
    const campo = this.campos[idCampo];
    if (!campo) return true;
 
    const valor = campo.elemento.value.trim();
    const regras = campo.regras;
 
    this.limparErro(idCampo);
 
    for (let regra of regras) {
      const resultado = this.executarValidacao(valor, regra, campo);
 
      if (!resultado.valido) {
        this.mostrarErro(idCampo, resultado.mensagem);
        this.erros[idCampo] = resultado.mensagem;
        return false;
      }
    }
 
    if (regras.length > 0) {
      this.mostrarSucesso(idCampo);
    }
 
    delete this.erros[idCampo];
    return true;
  }
 
  executarValidacao(valor, regra, campo) {
    const { tipo, mensagem, opcoes } = regra;
 
    if (!valor && tipo !== 'opcional') {
      return { valido: false, mensagem: mensagem || 'Este campo é obrigatório' };
    }
 
    if (!valor && tipo === 'opcional') {
      return { valido: true };
    }
 
    switch (tipo) {
      case 'obrigatorio':
        return { valido: valor !== '' };
 
      case 'cpf':
        const validacaoCPF = validador.validarCPF(valor);
        return { valido: validacaoCPF.valido, mensagem: mensagem || validacaoCPF.erro };
 
      case 'cnh':
        const validacaoCNH = validador.validarCNH(valor);
        return { valido: validacaoCNH.valido, mensagem: mensagem || validacaoCNH.erro };
 
      case 'rg':
        const validacaoRG = validador.validarRG(valor);
        return { valido: validacaoRG.valido, mensagem: mensagem || validacaoRG.erro };
 
      case 'placa':
        const validacaoPlaca = validador.validarPlaca(valor);
        return { valido: validacaoPlaca.valido, mensagem: mensagem || validacaoPlaca.erro };
 
      case 'telefone':
        const validacaoTel = validador.validarTelefone(valor);
        return { valido: validacaoTel.valido, mensagem: mensagem || validacaoTel.erro };
 
      case 'email':
        const validacaoEmail = validador.validarEmail(valor);
        return { valido: validacaoEmail.valido, mensagem: mensagem || validacaoEmail.erro };
 
      case 'pedido':
        const validacaoPedido = validador.validarPedido(valor);
        return { valido: validacaoPedido.valido, mensagem: mensagem || validacaoPedido.erro };
 
      case 'pedidoFOB':
        const validacaoFOB = validador.validarPedidoFOB(valor);
        return { valido: validacaoFOB.valido, mensagem: mensagem || validacaoFOB.erro };
 
      case 'pedidoCIF':
        const validacaoCIF = validador.validarPedidoCIF(valor);
        return { valido: validacaoCIF.valido, mensagem: mensagem || validacaoCIF.erro };
 
      case 'multiplosPedidos':
        const validacaoMultiplos = validador.validarMultiplosPedidos(valor, opcoes.tipo || 'fob');
        return { valido: validacaoMultiplos.valido, mensagem: mensagem || validacaoMultiplos.erro };
 
      case 'eixos':
        const validacaoEixos = validador.validarEixos(valor);
        return { valido: validacaoEixos.valido, mensagem: mensagem || validacaoEixos.erro };
 
      case 'minimo':
        return { valido: valor.length >= opcoes.min, mensagem: mensagem || `Mínimo de ${opcoes.min} caracteres` };
 
      case 'maximo':
        return { valido: valor.length <= opcoes.max, mensagem: mensagem || `Máximo de ${opcoes.max} caracteres` };
 
      case 'customizado':
        const resultado = opcoes.funcao(valor);
        return { valido: resultado === true, mensagem: mensagem || 'Validação falhou' };
 
      default:
        return { valido: true };
    }
  }
 
  mostrarErro(idCampo, mensagem) {
    const campo = this.campos[idCampo];
    const elemento = campo.elemento;
    const container = elemento.closest('.input-group') || elemento.parentElement;
 
    this.removerFeedback(container);
    container.classList.remove('has-success', 'has-warning');
    container.classList.add('has-error');
 
    const feedback = document.createElement('div');
    feedback.className = 'form-feedback error';
    feedback.innerHTML = `<span class="feedback-icon">✕</span><span class="feedback-message">${mensagem}</span>`;
    container.appendChild(feedback);
  }
 
  mostrarSucesso(idCampo) {
    const campo = this.campos[idCampo];
    const elemento = campo.elemento;
    const container = elemento.closest('.input-group') || elemento.parentElement;
 
    this.removerFeedback(container);
    container.classList.remove('has-error', 'has-warning');
    container.classList.add('has-success');
 
    const feedback = document.createElement('div');
    feedback.className = 'form-feedback success';
    feedback.innerHTML = `<span class="feedback-icon">✓</span>`;
    container.appendChild(feedback);
 
    setTimeout(() => { feedback.remove(); }, 2000);
  }
 
  limparErro(idCampo) {
    const campo = this.campos[idCampo];
    if (!campo) return;
    const elemento = campo.elemento;
    const container = elemento.closest('.input-group') || elemento.parentElement;
 
    this.removerFeedback(container);
    container.classList.remove('has-error', 'has-success', 'has-warning');
    delete this.erros[idCampo];
  }
 
  removerFeedback(container) {
    const feedback = container?.querySelector('.form-feedback');
    if (feedback) feedback.remove();
  }
 
  validarFormulario() {
    let temErros = false;
    for (let idCampo in this.campos) {
      if (this.campos[idCampo].regras.length === 0) continue;
      if (!this.validarCampo(idCampo)) temErros = true;
    }
    return !temErros;
  }
 
  obterErros() {
    return { ...this.erros };
  }
 
  obterValores() {
    const valores = {};
    for (let idCampo in this.campos) {
      valores[idCampo] = this.campos[idCampo].elemento.value;
    }
    return valores;
  }
 
  resetar() {
    this.form.reset();
    this.erros = {};
    for (let idCampo in this.campos) this.limparErro(idCampo);
  }
 
  desabilitarDurante(durante = true) {
    const inputs = this.form.querySelectorAll('input, select, textarea, button');
    inputs.forEach(el => { el.disabled = durante; });
    this.isSubmitting = durante;
  }
 
  mostrarResumoErros() {
    const erros = this.obterErros();
    const camposComErro = Object.keys(erros);
    if (camposComErro.length === 0) return true;
 
    let mensagem = `<strong>Erros encontrados:</strong><br/>`;
    camposComErro.forEach(campo => {
      const elemento = this.campos[campo]?.elemento;
      const label = elemento?.previousElementSibling?.textContent || campo;
      mensagem += `• ${label}: ${erros[campo]}<br/>`;
    });
 
    if (typeof notificacao !== 'undefined') {
      notificacao.erro('Formulário Inválido', mensagem);
    } else {
      alert('Preencha os campos obrigatórios corretamente.');
    }
 
    const primeiroComErro = document.getElementById(camposComErro[0]);
    if (primeiroComErro) {
      primeiroComErro.scrollIntoView({ behavior: 'smooth', block: 'center' });
      primeiroComErro.focus();
    }
 
    return false;
  }
}
 
window.FormValidator = FormValidator;
