import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { QueryFailedError, Repository } from 'typeorm';
import { UserCacheService } from './user-cache.service';
import { UserMapping } from './user-mapping.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserMapping)
    private readonly mappings: Repository<UserMapping>,
    private readonly cache: UserCacheService,
  ) {}

  async resolve(id1: string, id2: string): Promise<string> {
    const cached = await this.cache.get(id1, id2);
    if (cached) return cached;

    const userID = await this.resolveFromDatabase(id1, id2);
    await this.cache.set(id1, id2, userID);
    return userID;
  }

  private async resolveFromDatabase(id1: string, id2: string): Promise<string> {
    const existing = await this.mappings.findOneBy({ id1, id2 });
    if (existing) return existing.userID;

    const userID = randomUUID();
    try {
      await this.mappings.insert({ id1, id2, userID });
      return userID;
    } catch (error: unknown) {
      const driverError: unknown =
        error instanceof QueryFailedError ? error.driverError : null;
      if (
        driverError instanceof Error &&
        'code' in driverError &&
        driverError.code === 'ER_DUP_ENTRY'
      ) {
        // Another request may have inserted this pair after our first lookup.
        const winner = await this.mappings.findOneBy({ id1, id2 });
        if (winner) return winner.userID;
      }
      throw error;
    }
  }
}
