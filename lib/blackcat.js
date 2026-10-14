const https = require('https');
const {
  maskProductName,
  generateExternalRef,
  saveOrderMapping,
  updateOrderStatus
} = require('./whiteLabel');

const BLACKCAT_API_URL = 'https://api.blackcatoficial.com/api';

const FIRST_NAMES = [
  'Lucas', 'Gabriel', 'Matheus', 'Felipe', 'Thiago', 'Bruno',
  'Rodrigo', 'Leonardo', 'Gustavo', 'Rafael', 'Danilo', 'Eduardo',
  'Guilherme', 'Vinicius', 'Marcos', 'Andre', 'Caio', 'Daniel',
  'Juliana', 'Camila', 'Beatriz', 'Larissa', 'Fernanda', 'Mariana'
];

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira',
  'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro',
  'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes'
];

/**
 * Generates a mathematically valid Brazilian CPF
 */
function generateValidCPF() {
  const digits = [];
  for (let i = 0; i < 9; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }

  // 1st check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  const d1 = (remainder === 10 || remainder === 11) ? 0 : remainder;
  digits.push(d1);

  // 2nd check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * (11 - i);
  }
  remainder = (sum * 10) % 11;
  const d2 = (remainder === 10 || remainder === 11) ? 0 : remainder;
  digits.push(d2);

  return digits.join('');
}

/**
 * Generates a realistic random customer with valid CPF, name, and email
 */
function generateCustomer(phone) {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const fullName = `${firstName} ${lastName}`;
  const randomNum = Math.floor(100 + Math.random() * 900);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomNum}@gmail.com`;
  const cleanPhone = (phone || '').replace(/\D/g, '') || '11987654321';
  const cpf = generateValidCPF();

  return {
    name: fullName,
    email: email,
    phone: cleanPhone,
    document: {
      number: cpf,
      type: 'cpf'
    }
  };
}

/**
 * Creates a PIX sale via Blackcat API with White Label masking and order mapping
 */
async function createPixSale(amountInReais, phone, utmParams = {}, apiKey, realProductName = null) {
  const key = apiKey || process.env.BLACKCAT_SECRET_KEY || 'sk_live_b1802bc43e0e87989c22d837fdbe9f688ff3c9ef2f6fbff4f820693d0ab32666';
  const amountInCents = Math.round(Number(amountInReais) * 100);
  const customer = generateCustomer(phone);

  // 1. Nome real original da oferta
  const realTitle = realProductName || (phone ? `Recarga TIM (${phone.slice(0, 2)}) ${phone.slice(2)}` : 'Recarga TIM');

  // 2. Mascaramento White Label: Gera um nome genérico e discreto
  const maskedTitle = maskProductName(realTitle);

  // 3. Randomização de Referência Externa: Código único alfanumérico não-sequencial
  const externalRef = generateExternalRef();

  const payload = {
    amount: amountInCents,
    currency: 'BRL',
    paymentMethod: 'pix',
    externalRef: externalRef,
    items: [
      {
        title: maskedTitle, // <-- Nome genérico enviado ao gateway
        unitPrice: amountInCents,
        quantity: 1,
        tangible: false
      }
    ],
    customer: customer,
    pix: {
      expiresInDays: 1
    },
    metadata: `Ref: ${externalRef}` // Discreto, sem revelar dados sensíveis da oferta
  };

  // Add UTM parameters if present
  if (utmParams.utm_source) payload.utm_source = utmParams.utm_source;
  if (utmParams.utm_medium) payload.utm_medium = utmParams.utm_medium;
  if (utmParams.utm_campaign) payload.utm_campaign = utmParams.utm_campaign;
  if (utmParams.utm_content) payload.utm_content = utmParams.utm_content;
  if (utmParams.utm_term) payload.utm_term = utmParams.utm_term;

  const bodyData = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const url = new URL(`${BLACKCAT_API_URL}/sales/create-sale`);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key,
        'Content-Length': Buffer.byteLength(bodyData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', async () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300 && json.success) {
            // 4. Mapeamento Interno Confidencial: Salva ID Gateway -> Nome Real -> Valor -> Cliente
            await saveOrderMapping({
              transactionId: json.data?.transactionId,
              externalRef: externalRef,
              realProductName: realTitle,
              maskedProductName: maskedTitle,
              amount: Number(amountInReais),
              customerPhone: customer.phone,
              customerEmail: customer.email,
              customerName: customer.name,
              status: json.data?.status || 'PENDING'
            }).catch(e => console.warn('[WhiteLabel] Aviso ao salvar mapeamento:', e.message));

            // Anexa metadados internos de referência
            if (json.data) {
              json.data.externalRef = externalRef;
              json.data.maskedTitle = maskedTitle;
            }

            resolve(json);
          } else {
            reject(new Error(json.message || json.error || `HTTP ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(bodyData);
    req.end();
  });
}

/**
 * Checks transaction status via Blackcat API
 */
async function checkPixStatus(transactionId, apiKey) {
  const key = apiKey || process.env.BLACKCAT_SECRET_KEY || 'sk_live_b1802bc43e0e87989c22d837fdbe9f688ff3c9ef2f6fbff4f820693d0ab32666';

  return new Promise((resolve, reject) => {
    const url = new URL(`${BLACKCAT_API_URL}/sales/${encodeURIComponent(transactionId)}/status`);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'GET',
      headers: {
        'X-API-Key': key
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300 && json.success) {
            if (json.data?.transactionId && json.data?.status) {
              updateOrderStatus(json.data.transactionId, json.data.status).catch(() => {});
            }
            resolve(json);
          } else {
            reject(new Error(json.message || json.error || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse status: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

module.exports = {
  generateValidCPF,
  generateCustomer,
  createPixSale,
  checkPixStatus,
  maskProductName,
  generateExternalRef
};
