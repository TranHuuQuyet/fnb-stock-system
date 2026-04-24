import express = require('express');

import { readTrustProxyEnv } from './runtime-config';

describe('readTrustProxyEnv', () => {
  it('converts a hop count string so Express trusts the forwarded client IP', () => {
    const app = express();
    app.set('trust proxy', readTrustProxyEnv('1'));

    const request = {
      app,
      connection: { remoteAddress: '172.18.0.4' },
      socket: { remoteAddress: '172.18.0.4' },
      headers: { 'x-forwarded-for': '203.0.113.10' }
    } as any;

    Object.setPrototypeOf(request, express.request);

    expect(request.ip).toBe('203.0.113.10');
    expect(request.ips).toEqual(['203.0.113.10']);
  });

  it('keeps subnet and named proxy settings as strings', () => {
    expect(readTrustProxyEnv('loopback, 10.0.0.1')).toBe('loopback, 10.0.0.1');
  });

  it('falls back to a single trusted reverse proxy when env is blank', () => {
    expect(readTrustProxyEnv(undefined)).toBe(1);
    expect(readTrustProxyEnv('   ')).toBe(1);
  });
});
