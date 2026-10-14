const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Lista de categorias genéricas e discretas para estratégia White Label.
 * Essas nomenclaturas evitam questionamentos na fatura ou identificação da oferta original no gateway.
 */
const GENERIC_PRODUCT_CATEGORIES = [
  'Serviço Digital',
  'Acesso a Plataforma Online',
  'Intermediação de Serviços',
  'Licença de Software',
  'Processamento de Conteúdo Web',
  'Consultoria Digital Especializada',
  'Pacote de Serviços Online',
  'Serviço Administrativo Digital',
  'Assinatura de Serviços Web',
  'Kit de Soluções Digitais',
  'Gestão de Serviços em Nuvem',
  'Acesso a Conteúdo Educacional'
];

/**
 * 1. MASCARAMENTO DE PRODUTO (RANDOMIZER)
 * Substitui o nome real da oferta por uma categoria genérica com variação discreta.
 *
 * @param {string} realProductName - O nome real do produto (ex: "Curso de Emagrecimento X")
 * @param {string[]} [customCategories] - Lista opcional customizada de categorias
 * @returns {string} - Nome genérico discreto (ex: "Serviço Digital 02" ou "Kit de Soluções Digitais")
 */
function maskProductName(realProductName, customCategories = null) {
  const pool = (Array.isArray(customCategories) && customCategories.length > 0)
    ? customCategories
    : GENERIC_PRODUCT_CATEGORIES;

  // Seleciona uma categoria aleatória
  const randomIndex = Math.floor(Math.random() * pool.length);
  const baseCategory = pool[randomIndex];

  // Adiciona um identificador ordinal discreto (01 a 09) para variar o nome
  const suffix = String(Math.floor(Math.random() * 9) + 1).padStart(2, '0');
  
  return `${baseCategory} ${suffix}`;
}

/**
 * 2. RANDOMIZAÇÃO DE REFERÊNCIA EXTERNA
 * Gera uma referência alfanumérica única e não-sequencial (ex: "REF-XJ92L-2026").
 * Não revela IDs incrementais de pedidos nem nomes de produtos.
 *
 * @param {string} [prefix='REF'] - Prefixo opcional
 * @returns {string} - Código de referência único e seguro
 */
function generateExternalRef(prefix = 'REF') {
  // Gera 5 caracteres alfanuméricos seguros e legíveis (sem caracteres ambíguos)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomCode = '';
  const randomBytes = crypto.randomBytes(5);
  for (let i = 0; i < 5; i++) {
    randomCode += chars[randomBytes[i] % chars.length];
  }
  
  const year = new Date().getFullYear();
  return `${prefix}-${randomCode}-${year}`;
}

/**
 * 3. MAPEAMENTO INTERNO NO BANCO DE DADOS / STORAGE
 * Salva a correlação confidencial:
 * ID da Transação do Gateway -> Nome Real do Produto -> Nome Mascarado -> Valor -> Cliente.
 */

// Define caminho para persistência local ou ambiente serverless (/tmp na Vercel)
const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');
const MAPPING_FILE = path.join(DATA_DIR, 'order_mappings.json');

// Cache em memória para acesso ultrarrápido
const memoryIndex = {
  byTransactionId: new Map(),
  byExternalRef: new Map(),
  byPhone: new Map()
};

function ensureStorageReady() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(MAPPING_FILE)) {
      fs.writeFileSync(MAPPING_FILE, JSON.stringify([]), 'utf8');
    }
  } catch (e) {
    // Em ambientes serverless estritos, mantém em memória se filesystem falhar
  }
}

function loadAllMappings() {
  try {
    ensureStorageReady();
    if (fs.existsSync(MAPPING_FILE)) {
      const raw = fs.readFileSync(MAPPING_FILE, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach(indexRecord);
        return list;
      }
    }
  } catch (e) {
    console.warn('[WhiteLabel] Erro ao ler mapeamento em disco, usando cache de memória:', e.message);
  }
  return Array.from(memoryIndex.byTransactionId.values());
}

function indexRecord(record) {
  if (!record) return;
  if (record.transactionId) memoryIndex.byTransactionId.set(record.transactionId, record);
  if (record.externalRef) memoryIndex.byExternalRef.set(record.externalRef, record);
  if (record.customerPhone) {
    const list = memoryIndex.byPhone.get(record.customerPhone) || [];
    if (!list.some(r => r.transactionId === record.transactionId)) {
      list.push(record);
      memoryIndex.byPhone.set(record.customerPhone, list);
    }
  }
}

/**
 * Salva o mapeamento sigiloso da transação.
 * 
 * @param {Object} data
 * @param {string} data.transactionId - ID retornado pelo gateway (ex: "TRX1791933169823IX1I6C")
 * @param {string} data.externalRef - Código de referência gerado (ex: "REF-XJ92L-2026")
 * @param {string} data.realProductName - O nome real do produto/oferta
 * @param {string} data.maskedProductName - O nome mascarado enviado ao gateway
 * @param {number} data.amount - Valor da transação em reais
 * @param {string} [data.customerPhone] - Telefone do cliente
 * @param {string} [data.customerEmail] - E-mail do cliente
 * @param {string} [data.customerName] - Nome do cliente
 * @param {string} [data.status='PENDING'] - Status da transação
 * @returns {Object} O registro salvo
 */
async function saveOrderMapping({
  transactionId,
  externalRef,
  realProductName,
  maskedProductName,
  amount,
  customerPhone,
  customerEmail,
  customerName,
  status = 'PENDING'
}) {
  const record = {
    transactionId: String(transactionId || ''),
    externalRef: String(externalRef || ''),
    realProductName: String(realProductName || ''),
    maskedProductName: String(maskedProductName || ''),
    amount: Number(amount || 0),
    customerPhone: customerPhone ? String(customerPhone).replace(/\D/g, '') : null,
    customerEmail: customerEmail || null,
    customerName: customerName || null,
    status: status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // 1. Atualiza índices em memória para busca O(1) imediata
  indexRecord(record);

  // 2. Persiste em disco de forma segura
  try {
    ensureStorageReady();
    let currentList = [];
    if (fs.existsSync(MAPPING_FILE)) {
      try {
        currentList = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8')) || [];
      } catch (err) {
        currentList = [];
      }
    }

    const existingIndex = currentList.findIndex(r => r.transactionId === record.transactionId);
    if (existingIndex >= 0) {
      currentList[existingIndex] = { ...currentList[existingIndex], ...record, updatedAt: new Date().toISOString() };
    } else {
      currentList.push(record);
    }

    fs.writeFileSync(MAPPING_FILE, JSON.stringify(currentList, null, 2), 'utf8');
  } catch (err) {
    console.warn('[WhiteLabel] Aviso: não foi possível persistir em arquivo (ambiente read-only). Mantido em memória:', err.message);
  }

  return record;
}

/**
 * Atualiza o status de um pedido no mapeamento interno (ex: chamado pelo Webhook de PAID)
 */
async function updateOrderStatus(transactionId, newStatus) {
  const record = memoryIndex.byTransactionId.get(transactionId);
  if (record) {
    record.status = newStatus;
    record.updatedAt = new Date().toISOString();
    return saveOrderMapping(record);
  }
  return null;
}

/**
 * Consulta eficiente de suporte: busca por ID da Transação do Gateway.
 * Ex: Quando o cliente envia o comprovante de pagamento com o código do gateway.
 *
 * @param {string} transactionId
 * @returns {Object|null}
 */
function getMappingByTransactionId(transactionId) {
  if (!transactionId) return null;
  if (memoryIndex.byTransactionId.size === 0) loadAllMappings();
  return memoryIndex.byTransactionId.get(transactionId) || null;
}

/**
 * Consulta eficiente de suporte: busca por Código de Referência Externa.
 * Ex: "REF-XJ92L-2026"
 *
 * @param {string} externalRef
 * @returns {Object|null}
 */
function getMappingByExternalRef(externalRef) {
  if (!externalRef) return null;
  if (memoryIndex.byExternalRef.size === 0) loadAllMappings();
  return memoryIndex.byExternalRef.get(externalRef) || null;
}

/**
 * Consulta de suporte: busca histórico de compras pelo telefone do cliente.
 *
 * @param {string} phone
 * @returns {Array}
 */
function getMappingsByPhone(phone) {
  if (!phone) return [];
  if (memoryIndex.byPhone.size === 0) loadAllMappings();
  const clean = String(phone).replace(/\D/g, '');
  return memoryIndex.byPhone.get(clean) || [];
}

// Inicializa cache na inicialização do módulo
loadAllMappings();

module.exports = {
  GENERIC_PRODUCT_CATEGORIES,
  maskProductName,
  generateExternalRef,
  saveOrderMapping,
  updateOrderStatus,
  getMappingByTransactionId,
  getMappingByExternalRef,
  getMappingsByPhone
};
