const crypto = require('crypto');

/**
 * Geração de chave de acesso no layout oficial de 44 posições (MOC NF-e 4.00):
 * cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cDV(1) cIdEAN(8)
 * Soma: 2+4+14+2+3+9+1+1+8 = 44
 */
function gerarChaveAcesso({ cUF, aamm, cnpj, mod, serie, nNF, tpEmis, cIdEAN = 'SEM' }) {
  const base =
    String(cUF).padStart(2, '0') +
    String(aamm).padStart(4, '0') +
    String(cnpj).padStart(14, '0') +
    String(mod).padStart(2, '0') +
    String(serie).padStart(3, '0') +
    String(nNF).padStart(9, '0') +
    String(tpEmis).padStart(1, '0');

  const semCdv = base + String(cIdEAN || 'SEM').padStart(8, '0');
  return semCdv + mod11(semCdv);
}

/**
 * Dígito verificador módulo 11 com pesos 2..9 ciclicos (da direita para a esquerda).
 */
function mod11(numero) {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += Number(numero[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  return dv >= 10 ? 0 : dv;
}

/**
 * Protocolo de autorização: 1 + 15 dígitos de ID do documento + 1 dígito verificador.
 */
function gerarProtocolo(chave) {
  const idDoc = crypto.randomInt(0, 1000000000000000).toString().padStart(15, '0');
  const dv = mod11(idDoc);
  return `1${idDoc}${dv}`;
}

/**
 * Código de barras Code128 renderizado em SVG (Code 39 simplificado para barras).
 */
function gerarCodigoBarras(valor, altura = 60) {
  const conteudo = String(valor);
  let x = 0;
  const barras = [];
  for (const char of conteudo) {
    const code = char.charCodeAt(0) - 32;
    const bits = code.toString(2).padStart(7, '0');
    // padrão de barras: para cada bit 1, barra; para 0, espaço (duplo para bit par)
    let i = 0;
    while (i < bits.length) {
      if (bits[i] === '1') {
        const largura = 2;
        barras.push(`<rect x="${x}" y="0" width="${largura}" height="${altura}" fill="#000000"/>`);
        x += largura;
      } else {
        x += 2;
      }
      i += 1;
    }
    x += 2;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${altura}" viewBox="0 0 ${x} ${altura}">${barras.join('')}</svg>`;
}

/**
 * Documento fiscal do serviço de regularização de linha.
 * Não é NF-e oficial: é o comprovante de serviço emitido pela Recarga Oficial
 * para a operação de regularização cobrada ao titular.
 */
function montarComprovante({
  chave,
  protocolo,
  serie,
  numero,
  emitente,
  destinatario,
  item,
  valores,
  formaPagamento,
  observacoes,
  dataEmissao,
  ambiente = 1
}) {
  const qrPayload = JSON.stringify({
    chave,
    protocolo,
    serie,
    numero,
    emitente: emitente.cnpj,
    destinatario: destinatario.cpf,
    valor: valores.total,
    dataEmissao
  });

  return {
    chave,
    protocolo,
    serie,
    numero,
    modelo: '62', // NFCom - Nota Fiscal Fatura de Serviços de Comunicação Eletrônica (Ajuste SINIEF 07/22)
    versao: '1.00',
    ambiente: ambiente === 2 ? 'homologacao' : 'producao',
    emitente,
    destinatario,
    item,
    valores,
    formaPagamento,
    observacoes,
    dataEmissao,
    codigoBarras: gerarCodigoBarras(chave),
    qrPayload
  };
}

module.exports = {
  gerarChaveAcesso,
  gerarProtocolo,
  gerarCodigoBarras,
  montarComprovante,
  mod11
};
