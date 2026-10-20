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

    const { amount, telefone, productName, customer, ...utmParams } = body;
    if (!amount) {
      return res.status(400).json({ success: false, error: 'Valor da recarga é obrigatório' });
    }

    const sale = await createPixSale(amount, telefone, utmParams, null, productName, customer);
    const pData = sale.data?.paymentData || {};
    const emvCode = pData.copyPaste || pData.qrCode || '';

    let qrImgUrl = null;
    if (pData.qrCodeUrl && (pData.qrCodeUrl.startsWith('http://') || pData.qrCodeUrl.startsWith('https://'))) {
      qrImgUrl = pData.qrCodeUrl;
    } else if (pData.qrCodeBase64 && pData.qrCodeBase64.startsWith('data:image')) {
      qrImgUrl = pData.qrCodeBase64;
    } else if (pData.qrCodeBase64 && pData.qrCodeBase64.startsWith('iVBORw0KGgo')) {
      qrImgUrl = `data:image/png;base64,${pData.qrCodeBase64}`;
    } else if (emvCode) {
      qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(emvCode)}`;
    }

    return res.status(200).json({
      success: true,
      data: {
        id: sale.data?.transactionId,
        externalRef: sale.data?.externalRef,
        amount: sale.data?.amount,
        pix: {
          qr_code: emvCode,
          qr_code_url: qrImgUrl,
          expires_at: pData.expiresAt || null
        }
      }
    });
  } catch (err) {
    console.error('Error creating Blackcat PIX sale:', err);
    return res.status(500).json({ success: false, error: err.message || 'Erro ao gerar Pix' });
  }
};
