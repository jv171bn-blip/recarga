const { consultarCPF } = require('../lib/apisegura');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    let cpf = null;
    if (req.method === 'GET') {
      cpf = req.query?.cpf || (new URL(req.url, 'http://localhost')).searchParams.get('cpf');
    } else {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }
      cpf = body?.cpf;
    }

    if (!cpf) {
      return res.status(400).json({ success: false, error: 'CPF é obrigatório' });
    }

    const cleanCpf = String(cpf).replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return res.status(400).json({ success: false, error: 'CPF deve conter 11 dígitos' });
    }

    const result = await consultarCPF(cleanCpf);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Erro na rota /api/cpf:', err.message);
    return res.status(500).json({ success: false, error: 'Erro interno ao consultar CPF' });
  }
};
