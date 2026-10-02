'use strict';

const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequests = new client.Counter({
  name: 'cashrunway_http_requests_total',
  help: 'Total HTTP requests handled, by method, route and status code',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpDuration = new client.Histogram({
  name: 'cashrunway_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.025, 0.1, 0.3, 1, 3],
  registers: [register],
});

const forecastsBuilt = new client.Counter({
  name: 'cashrunway_forecasts_built_total',
  help: 'Number of cash-flow forecasts generated',
  registers: [register],
});

const shortfallsDetected = new client.Counter({
  name: 'cashrunway_shortfalls_detected_total',
  help: 'Number of forecasts where a shortfall was projected inside the horizon',
  registers: [register],
});

function metricsMiddleware(req, res, next) {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? req.baseUrl + req.route.path : req.path;
    const labels = { method: req.method, route, status: String(res.statusCode) };
    httpRequests.inc(labels);
    end(labels);
  });
  next();
}

module.exports = { register, metricsMiddleware, forecastsBuilt, shortfallsDetected };
