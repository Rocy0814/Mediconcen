import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserMappings1793836800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_mappings (
        user_id CHAR(36) NOT NULL,
        id1 VARCHAR(128) COLLATE utf8mb4_0900_bin NOT NULL,
        id2 VARCHAR(128) COLLATE utf8mb4_0900_bin NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (user_id),
        CONSTRAINT uq_user_mappings_pair UNIQUE (id1, id2)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE user_mappings');
  }
}
