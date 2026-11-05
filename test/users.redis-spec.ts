import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { createClient } from 'redis';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  UserCacheService,
  userCacheKey,
} from '../src/users/user-cache.service';
import { UserMapping } from '../src/users/user-mapping.entity';

describe('User cache (Redis and MySQL)', () => {
  let app: INestApplication<App>;
  let source: DataSource;
  const prefix = `redis-test-${randomUUID()}`;
  const originalTTL = process.env.REDIS_TTL_SECONDS;
  const inspector = createClient({
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    socket: { reconnectStrategy: false, connectTimeout: 500 },
  });
  inspector.on('error', () => undefined);

  beforeAll(async () => {
    process.env.REDIS_TTL_SECONDS = '1';
    await inspector.connect();
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.listen(0, '127.0.0.1');
    source = app.get(DataSource);
    // Wait for the application's background Redis connection without caching a DB row.
    await inspector.set(userCacheKey(prefix, 'ready'), 'ready', { EX: 10 });
    for (let i = 0; i < 100; i++) {
      if ((await app.get(UserCacheService).get(prefix, 'ready')) === 'ready')
        return;
      await setTimeout(20);
    }
    throw new Error('Application did not connect to Redis');
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (source?.isInitialized) {
      await source.getRepository(UserMapping).delete({ id1: prefix });
    }
    if (app) await app.close();
    if (inspector.isReady) {
      await inspector.del(
        ['ready', 'cache', 'slow', 'offline'].map((id2) =>
          userCacheKey(prefix, id2),
        ),
      );
    }
    if (inspector.isOpen) inspector.destroy();
    if (originalTTL === undefined) delete process.env.REDIS_TTL_SECONDS;
    else process.env.REDIS_TTL_SECONDS = originalTTL;
  });

  it('caches a database result, bypasses MySQL on hits and reloads after expiry', async () => {
    const body = { id1: prefix, id2: 'cache' };
    const first = await request(app.getHttpServer())
      .post('/users/resolve')
      .send(body)
      .expect(200);
    const result = first.body as { userID: string };
    expect(await inspector.get(userCacheKey(prefix, 'cache'))).toBe(
      result.userID,
    );
    expect(await inspector.ttl(userCacheKey(prefix, 'cache'))).toBeGreaterThan(
      0,
    );

    const lookup = jest.spyOn(source.getRepository(UserMapping), 'findOneBy');
    try {
      await request(app.getHttpServer())
        .post('/users/resolve')
        .send(body)
        .expect(200)
        .expect(result);
      expect(lookup).not.toHaveBeenCalled();
      await setTimeout(1100);
      expect(await inspector.get(userCacheKey(prefix, 'cache'))).toBeNull();
      await request(app.getHttpServer())
        .post('/users/resolve')
        .send(body)
        .expect(200)
        .expect(result);
      expect(lookup).toHaveBeenCalledWith(body);
    } finally {
      lookup.mockRestore();
    }
  });

  it('falls back to MySQL when Redis commands time out', async () => {
    await inspector.sendCommand(['CLIENT', 'PAUSE', '1500', 'ALL']);
    const body = { id1: prefix, id2: 'slow' };
    const started = Date.now();
    const response = await request(app.getHttpServer())
      .post('/users/resolve')
      .send(body)
      .expect(200);
    expect(Date.now() - started).toBeLessThan(1200);
    const saved = await source.getRepository(UserMapping).findOneByOrFail(body);
    expect(saved.userID).toBe((response.body as { userID: string }).userID);
    // Wait for the pause to end before running the next test.
    await inspector.ping();
  });

  it('continues creating and resolving mappings after the cache connection closes', async () => {
    app.get(UserCacheService).onModuleDestroy();
    const body = { id1: prefix, id2: 'offline' };
    const first = await request(app.getHttpServer())
      .post('/users/resolve')
      .send(body)
      .expect(200);
    await request(app.getHttpServer())
      .post('/users/resolve')
      .send(body)
      .expect(200)
      .expect(first.body as object);
    const saved = await source.getRepository(UserMapping).findOneByOrFail(body);
    expect(saved.userID).toBe((first.body as { userID: string }).userID);
    expect(await inspector.get(userCacheKey(prefix, 'offline'))).toBeNull();
  });
});
