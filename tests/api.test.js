'use strict';

const request = require('supertest');
const app = require('../src/app');
const store = require('../src/repositories/store');

beforeEach(() => store.reset());

describe('service endpoints', () => {
  test('GET /health reports ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /metrics exposes Prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('cashrunway_http_requests_total');
  });

  test('GET / lists the available endpoints', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.endpoints).toContain('/api/forecast');
  });

  test('unknown routes return 404', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
  });
});

describe('invoices', () => {
  test('GET /api/invoices returns the seeded invoices', async () => {
    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('POST /api/invoices creates an invoice', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .send({ id: 'INV-9001', client: 'Test Co', amount: 500, dueDate: '2026-02-02' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('unpaid');
  });

  test('POST /api/invoices rejects a missing amount', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .send({ id: 'INV-9002', client: 'Test Co', dueDate: '2026-02-02' });
    expect(res.status).toBe(400);
  });

  test('a created invoice appears in the list', async () => {
    await request(app)
      .post('/api/invoices')
      .send({ id: 'INV-9003', client: 'Test Co', amount: 750, dueDate: '2026-02-09' });
    const res = await request(app).get('/api/invoices');
    expect(res.body.some((i) => i.id === 'INV-9003')).toBe(true);
  });
});

describe('expenses', () => {
  test('GET /api/expenses returns the seeded expenses', async () => {
    const res = await request(app).get('/api/expenses');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('POST /api/expenses creates an expense', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .send({ id: 'EXP-9001', description: 'Van service', amount: 420, dueDate: '2026-02-16' });
    expect(res.status).toBe(201);
    expect(res.body.frequency).toBe('once');
  });

  test('POST /api/expenses rejects a missing due date', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .send({ id: 'EXP-9002', amount: 420 });
    expect(res.status).toBe(400);
  });
});

describe('forecast', () => {
  test('GET /api/forecast returns 13 weeks by default', async () => {
    const res = await request(app).get('/api/forecast');
    expect(res.status).toBe(200);
    expect(res.body.weeks).toHaveLength(13);
  });

  test('GET /api/forecast honours the weeks query parameter', async () => {
    const res = await request(app).get('/api/forecast?weeks=8');
    expect(res.body.weeks).toHaveLength(8);
  });

  test('GET /api/forecast rejects an out-of-range horizon', async () => {
    const res = await request(app).get('/api/forecast?weeks=99');
    expect(res.status).toBe(400);
  });

  test('every week row carries a closing balance', async () => {
    const res = await request(app).get('/api/forecast');
    for (const week of res.body.weeks) {
      expect(typeof week.closingBalance).toBe('number');
    }
  });
});

describe('recommendations', () => {
  test('GET /api/recommendations responds successfully', async () => {
    const res = await request(app).get('/api/recommendations');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.actions)).toBe(true);
  });

  test('never returns more than two actions', async () => {
    const res = await request(app).get('/api/recommendations');
    expect(res.body.actions.length).toBeLessThanOrEqual(2);
  });
});
