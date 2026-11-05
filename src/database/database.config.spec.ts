import { databaseConfig } from './database.config';

const env = {
  DB_HOST: 'localhost',
  DB_NAME: 'mediconcen',
  DB_USER: 'test',
  DB_PASSWORD: 'test-only',
};

describe('databaseConfig', () => {
  it('keeps schema changes explicit', () => {
    expect(databaseConfig(env)).toMatchObject({
      type: 'mysql',
      port: 3306,
      synchronize: false,
      migrationsRun: false,
    });
  });

  it('rejects missing credentials without including their values', () => {
    expect(() => databaseConfig({ ...env, DB_PASSWORD: '' })).toThrow(
      'Missing environment variable: DB_PASSWORD',
    );
  });

  it.each(['abc', '0', '65536', '3306.5'])(
    'rejects invalid port %s',
    (port) => {
      expect(() => databaseConfig({ ...env, DB_PORT: port })).toThrow(
        'DB_PORT must be an integer between 1 and 65535',
      );
    },
  );
});
