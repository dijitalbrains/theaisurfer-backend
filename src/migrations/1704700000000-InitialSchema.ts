import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class InitialSchema1704700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            comment: 'UUID primary key',
          },
          {
            name: 'first_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'last_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'password',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'Hashed password',
          },
          {
            name: 'stripe_customer_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'stripe_source_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'credits',
            type: 'decimal',
            precision: 10,
            scale: 4,
            default: null,
            isNullable: true,
          },
          {
            name: 'purchased_credits',
            type: 'decimal',
            precision: 10,
            scale: 4,
            default: null,
            isNullable: true,
          },
          {
            name: 'has_unlimited_credits',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'auto_reload',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'reload_threshold',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'reload_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create unique index on email
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_users_email',
        columnNames: ['email'],
        isUnique: true,
      }),
    );

    // Create projects table
    await queryRunner.createTable(
      new Table({
        name: 'projects',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            comment: 'UUID primary key',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'Project display name',
          },
          {
            name: 'slug',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'URL-friendly identifier',
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'allowed_redirect_urls',
            type: 'json',
            isNullable: true,
            comment: 'Whitelisted redirect URLs for auth callbacks',
          },
          {
            name: 'api_key',
            type: 'varchar',
            length: '255',
            isNullable: true,
            isUnique: true,
            comment: 'API key for SSO authentication',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create unique index on slug
    await queryRunner.createIndex(
      'projects',
      new TableIndex({
        name: 'IDX_projects_slug',
        columnNames: ['slug'],
        isUnique: true,
      }),
    );

    // Create unique index on api_key
    await queryRunner.createIndex(
      'projects',
      new TableIndex({
        name: 'IDX_projects_api_key',
        columnNames: ['api_key'],
        isUnique: true,
      }),
    );

    // Create user_projects join table
    await queryRunner.createTable(
      new Table({
        name: 'user_projects',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            comment: 'UUID primary key',
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
          {
            name: 'project_id',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
          {
            name: 'has_access',
            type: 'boolean',
            default: true,
            comment: 'Whether user has active access to project',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create index on user_id for faster lookups
    await queryRunner.createIndex(
      'user_projects',
      new TableIndex({
        name: 'IDX_user_projects_user_id',
        columnNames: ['user_id'],
      }),
    );

    // Create index on project_id for faster lookups
    await queryRunner.createIndex(
      'user_projects',
      new TableIndex({
        name: 'IDX_user_projects_project_id',
        columnNames: ['project_id'],
      }),
    );

    // Create composite unique index to prevent duplicate user-project pairs
    await queryRunner.createIndex(
      'user_projects',
      new TableIndex({
        name: 'IDX_user_projects_user_id_project_id',
        columnNames: ['user_id', 'project_id'],
        isUnique: true,
      }),
    );

    // Create foreign key from user_projects to users
    await queryRunner.createForeignKey(
      'user_projects',
      new TableForeignKey({
        name: 'FK_user_projects_user_id_users',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Create foreign key from user_projects to projects
    await queryRunner.createForeignKey(
      'user_projects',
      new TableForeignKey({
        name: 'FK_user_projects_project_id_projects',
        columnNames: ['project_id'],
        referencedTableName: 'projects',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Create refresh_tokens table
    await queryRunner.createTable(
      new Table({
        name: 'refresh_tokens',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            comment: 'UUID primary key',
          },
          {
            name: 'token',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'Hashed refresh token',
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: false,
            comment: 'Token expiration timestamp',
          },
          {
            name: 'is_revoked',
            type: 'boolean',
            default: false,
            comment: 'Whether token has been revoked',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create index on user_id for faster user token lookups
    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({
        name: 'IDX_refresh_tokens_user_id',
        columnNames: ['user_id'],
      }),
    );

    // Create index on token for faster validation
    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({
        name: 'IDX_refresh_tokens_token',
        columnNames: ['token'],
      }),
    );

    // Create index on expires_at for cleanup queries
    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({
        name: 'IDX_refresh_tokens_expires_at',
        columnNames: ['expires_at'],
      }),
    );

    // Create foreign key from refresh_tokens to users
    await queryRunner.createForeignKey(
      'refresh_tokens',
      new TableForeignKey({
        name: 'FK_refresh_tokens_user_id_users',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first (in reverse order)
    await queryRunner.dropForeignKey(
      'refresh_tokens',
      'FK_refresh_tokens_user_id_users',
    );
    await queryRunner.dropForeignKey(
      'user_projects',
      'FK_user_projects_project_id_projects',
    );
    await queryRunner.dropForeignKey(
      'user_projects',
      'FK_user_projects_user_id_users',
    );

    // Drop indexes
    await queryRunner.dropIndex(
      'refresh_tokens',
      'IDX_refresh_tokens_expires_at',
    );
    await queryRunner.dropIndex('refresh_tokens', 'IDX_refresh_tokens_token');
    await queryRunner.dropIndex('refresh_tokens', 'IDX_refresh_tokens_user_id');
    await queryRunner.dropIndex(
      'user_projects',
      'IDX_user_projects_user_id_project_id',
    );
    await queryRunner.dropIndex(
      'user_projects',
      'IDX_user_projects_project_id',
    );
    await queryRunner.dropIndex('user_projects', 'IDX_user_projects_user_id');
    await queryRunner.dropIndex('projects', 'IDX_projects_api_key');
    await queryRunner.dropIndex('projects', 'IDX_projects_slug');
    await queryRunner.dropIndex('users', 'IDX_users_email');

    // Drop tables (in reverse order of creation)
    await queryRunner.dropTable('refresh_tokens');
    await queryRunner.dropTable('user_projects');
    await queryRunner.dropTable('projects');
    await queryRunner.dropTable('users');
  }
}
