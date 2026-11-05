import { Logger } from '@nestjs/common';
import { createClient } from 'redis';
import { UserCacheService, userCacheKey } from './user-cache.service';

jest.mock('redis', () => ({ createClient: jest.fn() }));

describe('UserCacheService', () => {
  const client = {
    isReady: true,
    isOpen: true,
    on: jest.fn(),
    connect: jest.fn(),
    destroy: jest.fn(),
    withCommandOptions: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  };
  let cache: UserCacheService;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    client.isReady = true;
    client.withCommandOptions.mockReturnValue(client);
    jest
      .mocked(createClient)
      .mockReturnValue(client as unknown as ReturnType<typeof createClient>);
    cache = new UserCacheService();
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses unambiguous keys for ordered pairs', () => {
    expect(userCacheKey('a:b', 'c')).not.toBe(userCacheKey('a', 'b:c'));
    expect(userCacheKey('a', 'b')).not.toBe(userCacheKey('b', 'a'));
  });

  it('reads a hit and applies a command timeout', async () => {
    client.get.mockResolvedValue('cached-id');
    await expect(cache.get('A', 'B')).resolves.toBe('cached-id');
    expect(client.withCommandOptions).toHaveBeenCalledWith({ timeout: 200 });
  });

  it('returns null on a miss', async () => {
    client.get.mockResolvedValue(null);
    await expect(cache.get('A', 'B')).resolves.toBeNull();
  });

  it('writes the result with an expiry', async () => {
    await cache.set('A', 'B', 'user-id');
    expect(client.set).toHaveBeenCalledWith(userCacheKey('A', 'B'), 'user-id', {
      EX: Number(process.env.REDIS_TTL_SECONDS ?? 3600),
    });
  });

  it('skips Redis while disconnected', async () => {
    client.isReady = false;
    await expect(cache.get('A', 'B')).resolves.toBeNull();
    await expect(cache.set('A', 'B', 'id')).resolves.toBeUndefined();
    expect(client.get).not.toHaveBeenCalled();
    expect(client.set).not.toHaveBeenCalled();
  });

  it('treats read errors and timeouts as misses', async () => {
    client.get.mockRejectedValue(new Error('timeout'));
    await expect(cache.get('A', 'B')).resolves.toBeNull();
  });

  it('stops waiting for an in-flight command after 200 ms', async () => {
    jest.useFakeTimers();
    try {
      client.get.mockReturnValue(new Promise(() => undefined));
      const result = cache.get('A', 'B');
      await jest.advanceTimersByTimeAsync(200);
      await expect(result).resolves.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not fail the request if a cache write fails', async () => {
    client.set.mockRejectedValue(new Error('connection lost'));
    await expect(cache.set('A', 'B', 'id')).resolves.toBeUndefined();
  });

  it('connects in the background and destroys the connection on shutdown', async () => {
    client.connect.mockRejectedValue(new Error('offline'));
    cache.onModuleInit();
    await Promise.resolve();
    cache.onModuleDestroy();
    expect(client.destroy).toHaveBeenCalled();
  });
});
