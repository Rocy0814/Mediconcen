import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createClient } from 'redis';

export function userCacheKey(id1: string, id2: string): string {
  return `user-mapping:${JSON.stringify([id1, id2])}`;
}

@Injectable()
export class UserCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UserCacheService.name);
  private readonly ttl = Number(process.env.REDIS_TTL_SECONDS ?? 3600);
  private readonly client = createClient({
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    disableOfflineQueue: true,
    commandsQueueMaxLength: 100,
    socket: {
      connectTimeout: 500,
      reconnectStrategy: (retries) => Math.min(100 * 2 ** retries, 3000),
    },
  });
  private warned = false;

  constructor() {
    if (!Number.isSafeInteger(this.ttl) || this.ttl <= 0) {
      throw new Error('REDIS_TTL_SECONDS must be a positive integer');
    }
    this.client.on('error', () => this.warn());
    this.client.on('ready', () => {
      this.warned = false;
    });
  }

  onModuleInit(): void {
    // Redis reconnects in the background; it must not block application startup.
    void this.client.connect().catch(() => this.warn());
  }

  onModuleDestroy(): void {
    if (this.client.isOpen) this.client.destroy();
  }

  async get(id1: string, id2: string): Promise<string | null> {
    if (!this.client.isReady) return null;
    try {
      return await this.withTimeout(
        this.client
          .withCommandOptions({ timeout: 200 })
          .get(userCacheKey(id1, id2)),
      );
    } catch {
      this.warn();
      return null;
    }
  }

  async set(id1: string, id2: string, userID: string): Promise<void> {
    if (!this.client.isReady) return;
    try {
      await this.withTimeout(
        this.client
          .withCommandOptions({ timeout: 200 })
          .set(userCacheKey(id1, id2), userID, { EX: this.ttl }),
      );
    } catch {
      this.warn();
    }
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // The client's timeout alone does not bound commands already in flight.
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Redis command timed out')),
            200,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  private warn(): void {
    if (!this.warned) {
      this.logger.warn('Redis unavailable; using MySQL without cache');
      this.warned = true;
    }
  }
}
