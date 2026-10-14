const { checkPixStatus } = require('../../lib/blackcat');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const id = req.query?.id || (new URL(req.url, 'http://localhost')).searchParams.get('id');
    if (!id) {
      return res.status(400).json({ success: false, error: 'Transaction ID is required' });
    }

    const result = await checkPixStatus(id);
    const rawStatus = (result.data?.status || '').toLowerCase();

    return res.status(200).json({
      success: true,
      data: {
        id: result.data?.transactionId,
        status: rawStatus === 'paid' ? 'paid' : (rawStatus === 'cancelled' ? 'cancelled' : 'pending'),
        rawStatus: result.data?.status
      }
    });
  } catch (err) {
    console.error('Error checking Blackcat PIX status:', err);
    return res.status(500).json({ success: false, error: err.message || 'Erro ao consultar status' });
  }
};
