const https = require('https');

const APISEGURA_URL = 'https://search.apisegura.cloud';

/**
 * Consulta dados cadastrais de pessoa física a partir do CPF usando APIsegura
 * @param {string} cpf - CPF com 11 dígitos numéricos
 * @param {string} [apiKey] - Chave opcional ou lida de process.env.APISEGURA_KEY
 * @returns {Promise<Object>} Dados do titular (nome, cpf, data de nascimento, etc.)
 */
async function consultarCPF(cpf, apiKey = null) {
  const cleanCpf = (cpf || '').replace(/\D/g, '');
  if (cleanCpf.length !== 11) {
    throw new Error('CPF deve conter exatamente 11 dígitos');
  }

  const key = apiKey || process.env.APISEGURA_KEY || 'sk_live_L72_HvdV4rvva1Z4TLQG_z3c3btXIWse';

  return new Promise((resolve, reject) => {
    const url = new URL(`${APISEGURA_URL}/cpf?cpf=${cleanCpf}`);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              data: {
                cpf: cleanCpf,
                nome: json.nome || '',
                nascimento: json.nascimento || '',
                nome_mae: json.nome_mae || '',
                nome_pai: json.nome_pai || null,
                sexo: json.sexo || '',
                situacao_receita: json.situacao_receita || '',
                raw: json
              }
            });
          } else {
            resolve({
              success: false,
              statusCode: res.statusCode,
              error: json.message || json.error || 'Erro na consulta do CPF',
              raw: json
            });
          }
        } catch (e) {
          resolve({
            success: false,
            statusCode: res.statusCode,
            error: 'Resposta inválida do serviço de CPF'
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message || 'Falha de conexão com serviço de CPF'
      });
    });

    req.setTimeout(8000, () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Timeout ao consultar serviço de CPF'
      });
    });

    req.end();
  });
}

module.exports = {
  consultarCPF
};
