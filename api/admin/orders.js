const {
  getMappingByTransactionId,
  getMappingByExternalRef,
  getMappingsByPhone
} = require('../../lib/whiteLabel');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const transactionId = req.query?.transactionId || url.searchParams.get('transactionId');
    const externalRef = req.query?.externalRef || url.searchParams.get('externalRef');
    const phone = req.query?.phone || url.searchParams.get('phone');

    let result = null;
    if (transactionId) {
      result = getMappingByTransactionId(transactionId);
    } else if (externalRef) {
      result = getMappingByExternalRef(externalRef);
    } else if (phone) {
      result = getMappingsByPhone(phone);
    }

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Registro não encontrado no mapeamento interno'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Error fetching order mapping:', err);
    return res.status(500).json({ success: false, error: err.message || 'Erro interno' });
  }
};
