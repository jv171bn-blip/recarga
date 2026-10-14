const { createPixSale } = require('../../lib/blackcat');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Parse body if string
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    body = body || {};

    const { amount, telefone, productName, ...utmParams } = body;
    if (!amount) {
      return res.status(400).json({ success: false, error: 'Valor da recarga é obrigatório' });
    }

    const sale = await createPixSale(amount, telefone, utmParams, null, productName);
    const pData = sale.data?.paymentData || {};

    return res.status(200).json({
      success: true,
      data: {
        id: sale.data?.transactionId,
        externalRef: sale.data?.externalRef,
        amount: sale.data?.amount,
        pix: {
          qr_code: pData.copyPaste || pData.qrCode,
          qr_code_url: pData.qrCodeBase64 || null,
          expires_at: pData.expiresAt || null
        }
      }
    });
  } catch (err) {
    console.error('Error creating Blackcat PIX sale:', err);
    return res.status(500).json({ success: false, error: err.message || 'Erro ao gerar Pix' });
  }
};
