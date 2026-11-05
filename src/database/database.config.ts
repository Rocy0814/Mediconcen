import 'dotenv/config';
import { DataSourceOptions } from 'typeorm';
import { UserMapping } from '../users/user-mapping.entity';
import { CreateUserMappings1793836800000 } from './migrations/1793836800000-CreateUserMappings';

export function databaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): DataSourceOptions {
  for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
    if (!env[key]?.trim()) {
      throw new Error(`Missing environment variable: ${key}`);
    }
  }

  const port = Number(env.DB_PORT ?? 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535');
  }

  return {
    type: 'mysql',
    host: env.DB_HOST,
    port,
    database: env.DB_NAME,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    charset: 'utf8mb4',
    entities: [UserMapping],
    migrations: [CreateUserMappings1793836800000],
    synchronize: false,
    migrationsRun: false,
  };
}
