import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserMapping } from '../src/users/user-mapping.entity';
import { UsersService } from '../src/users/users.service';

describe('POST /users/resolve (MySQL)', () => {
  let app: INestApplication<App>;
  let source: DataSource;
  const prefix = `test-${randomUUID()}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.listen(0, '127.0.0.1');
    source = app.get(DataSource);
  });

  afterAll(async () => {
    if (source?.isInitialized) {
      await source
        .getRepository(UserMapping)
        .createQueryBuilder()
        .delete()
        .where('id1 = :prefix', { prefix })
        .execute();
    }
    if (app) await app.close();
  });

  it('creates a UUID v4 and returns it again for the same pair', async () => {
    const body = { id1: prefix, id2: 'repeat' };
    const first = await request(app.getHttpServer())
      .post('/users/resolve')
      .send(body)
      .expect(200);
    const result = first.body as { userID: string };
    expect(result.userID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    await request(app.getHttpServer())
      .post('/users/resolve')
      .send(body)
      .expect(200)
      .expect(result);
    const saved = await source.getRepository(UserMapping).findOneByOrFail(body);
    expect(saved.userID).toBe(result.userID);
  });

  it('resolves concurrent requests to one stored mapping', async () => {
    const body = { id1: prefix, id2: 'concurrent' };
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app.getHttpServer())
          .post('/users/resolve')
          .send(body)
          .expect(200),
      ),
    );
    const ids = responses.map(
      (response) => (response.body as { userID: string }).userID,
    );
    expect(new Set(ids).size).toBe(1);
    const repository = source.getRepository(UserMapping);
    expect(await repository.countBy(body)).toBe(1);
    expect((await repository.findOneByOrFail(body)).userID).toBe(ids[0]);
  });

  it('keeps different pairs separate', async () => {
    const ids: string[] = [];
    for (const id2 of ['ABC', 'abc', 'x'.repeat(128)]) {
      const response = await request(app.getHttpServer())
        .post('/users/resolve')
        .send({ id1: prefix, id2 })
        .expect(200);
      ids.push((response.body as { userID: string }).userID);
    }
    expect(new Set(ids).size).toBe(3);
  });

  it.each([
    {},
    { id1: 'A' },
    { id2: 'B' },
    { id1: null, id2: 'B' },
    { id1: 123, id2: 'B' },
    { id1: [], id2: 'B' },
    { id1: '', id2: 'B' },
    { id1: ' ', id2: 'B' },
    { id1: ' A', id2: 'B' },
    { id1: 'A', id2: 'B\n' },
    { id1: 'x'.repeat(129), id2: 'B' },
    { id1: 'A', id2: 'B', extra: true },
  ])('rejects invalid input: %j', async (body) => {
    await request(app.getHttpServer())
      .post('/users/resolve')
      .send(body)
      .expect(400);
  });

  it('returns a generic 500 on unexpected errors and remains available', async () => {
    const spy = jest
      .spyOn(app.get(UsersService), 'resolve')
      .mockRejectedValueOnce(new Error('private database details'));
    try {
      await request(app.getHttpServer())
        .post('/users/resolve')
        .send({ id1: prefix, id2: 'error' })
        .expect(500)
        .expect({ statusCode: 500, message: 'Internal server error' });
      await request(app.getHttpServer())
        .post('/users/resolve')
        .send({ id1: prefix, id2: 'after-error' })
        .expect(200);
    } finally {
      spy.mockRestore();
    }
  });
});
