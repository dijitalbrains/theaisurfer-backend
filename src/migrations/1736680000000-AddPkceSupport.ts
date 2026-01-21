import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class AddPkceSupport1736680000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'authorization_codes',
        columns: [
          {
            name: 'code',
            type: 'varchar',
            length: '128',
            isPrimary: true,
          },
          {
            name: 'session_id',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'user_id',
            type: 'char',
            length: '36',
            isNullable: false,
          },
          {
            name: 'project_id',
            type: 'char',
            length: '36',
            isNullable: false,
          },
          {
            name: 'code_challenge',
            type: 'varchar',
            length: '128',
            isNullable: false,
          },
          {
            name: 'code_challenge_method',
            type: 'varchar',
            length: '10',
            default: "'S256'",
          },
          {
            name: 'redirect_uri',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'state',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'is_used',
            type: 'tinyint',
            width: 1,
            default: 0,
          },
          {
            name: 'used_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'text',
            isNullable: true,
          },
        ],
        indices: [
          {
            name: 'IDX_AUTH_CODE_SESSION',
            columnNames: ['session_id'],
          },
          {
            name: 'IDX_AUTH_CODE_EXPIRES',
            columnNames: ['expires_at'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'authorization_codes',
      new TableForeignKey({
        columnNames: ['session_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'sso_sessions',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'authorization_codes',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'authorization_codes',
      new TableForeignKey({
        columnNames: ['project_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'projects',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'sso_audit_log',
        columns: [
          {
            name: 'id',
            type: 'char',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'event_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'user_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          {
            name: 'project_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          {
            name: 'session_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'authorization_code',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'success',
            type: 'tinyint',
            width: 1,
            default: 1,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          {
            name: 'IDX_AUDIT_EVENT_TYPE',
            columnNames: ['event_type', 'created_at'],
          },
          {
            name: 'IDX_AUDIT_USER',
            columnNames: ['user_id', 'created_at'],
          },
          {
            name: 'IDX_AUDIT_PROJECT',
            columnNames: ['project_id', 'created_at'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'sso_audit_log',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'sso_audit_log',
      new TableForeignKey({
        columnNames: ['project_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'projects',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.query(`
      ALTER TABLE sso_sessions
      ADD COLUMN code_challenge VARCHAR(128) NOT NULL DEFAULT '',
      ADD COLUMN code_challenge_method VARCHAR(10) NOT NULL DEFAULT 'S256',
      ADD COLUMN user_id CHAR(36) NULL,
      ADD COLUMN ip_address VARCHAR(45) NULL,
      ADD COLUMN user_agent TEXT NULL,
      ADD COLUMN consumed_at TIMESTAMP NULL,
      MODIFY COLUMN state VARCHAR(64) NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE sso_sessions
      ADD CONSTRAINT FK_SSO_SESSION_USER
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      ADD COLUMN project_id CHAR(36) NULL,
      ADD COLUMN project_slug VARCHAR(255) NULL,
      ADD COLUMN sso_session_id VARCHAR(64) NULL,
      ADD COLUMN revoked_at TIMESTAMP NULL
    `);

    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      ADD CONSTRAINT FK_REFRESH_TOKEN_PROJECT
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE refresh_tokens DROP FOREIGN KEY FK_REFRESH_TOKEN_PROJECT`,
    );
    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      DROP COLUMN project_id,
      DROP COLUMN project_slug,
      DROP COLUMN sso_session_id,
      DROP COLUMN revoked_at
    `);

    await queryRunner.query(
      `ALTER TABLE sso_sessions DROP FOREIGN KEY FK_SSO_SESSION_USER`,
    );
    await queryRunner.query(`
      ALTER TABLE sso_sessions
      DROP COLUMN code_challenge,
      DROP COLUMN code_challenge_method,
      DROP COLUMN user_id,
      DROP COLUMN ip_address,
      DROP COLUMN user_agent,
      DROP COLUMN consumed_at,
      MODIFY COLUMN state VARCHAR(64) NULL
    `);

    const auditLogTable = await queryRunner.getTable('sso_audit_log');
    if (auditLogTable) {
      const foreignKeys = auditLogTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('sso_audit_log', foreignKey);
      }
    }
    await queryRunner.dropTable('sso_audit_log');

    const authCodeTable = await queryRunner.getTable('authorization_codes');
    if (authCodeTable) {
      const foreignKeys = authCodeTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('authorization_codes', foreignKey);
      }
    }
    await queryRunner.dropTable('authorization_codes');
  }
}
