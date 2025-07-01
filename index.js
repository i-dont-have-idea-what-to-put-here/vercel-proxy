const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fetch = require('node-fetch');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Environment variables
const PORT = process.env.PORT || 3000;
const USER_AGENT = process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

// Custom proxy handler that preserves all HTTP methods and headers
app.use('/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
      return res.status(400).json({ error: 'Target URL is required as a query parameter (url)' });
    }

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid URL provided' });
    }

    // Prepare headers
    const headers = { ...req.headers };
    headers['host'] = parsedUrl.host;
    headers['origin'] = parsedUrl.origin;
    headers['referer'] = `${parsedUrl.origin}/`;
    headers['user-agent'] = USER_AGENT;
    
    // Remove Vercel-specific headers that might cause issues
    delete headers['x-vercel-id'];
    delete headers['x-vercel-ip-country'];
    delete headers['x-vercel-deployment-url'];
    delete headers['x-now-id'];
    delete headers['x-now-trace'];

    // Prepare fetch options
    const options = {
      method: req.method,
      headers: headers,
      redirect: 'follow'
    };

    // Include body for methods that have one
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      options.body = req.body;
    }

    const response = await fetch(targetUrl, options);

    // Forward status code
    res.status(response.status);

    // Forward headers
    response.headers.forEach((value, name) => {
      // Skip some headers that shouldn't be forwarded
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(name.toLowerCase())) {
        res.setHeader(name, value);
      }
    });

    // Stream the response back to the client
    response.body.pipe(res);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error', details: error.message });
  }
});

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Start server
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});

module.exports = app;
