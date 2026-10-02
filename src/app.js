'use strict';

const express = require('express');
const routes = require('./routes');
const { register, metricsMiddleware } = require('./middleware/metrics');

const app = express();
app.use(express.json());
app.use(metricsMiddleware);

// Liveness / readiness probe, used by Docker healthchecks and by Prometheus.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()), version: process.env.APP_VERSION || 'dev' });
});

// Prometheus scrape endpoint.
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: 'CashRunway API',
    description: '13-week cash-flow early warning for sole traders and micro-businesses',
    endpoints: ['/health', '/metrics', '/api/invoices', '/api/expenses', '/api/forecast', '/api/recommendations'],
  });
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err instanceof TypeError || err instanceof RangeError ? 400 : 500;
  res.status(status).json({ error: err.message });
});

module.exports = app;
