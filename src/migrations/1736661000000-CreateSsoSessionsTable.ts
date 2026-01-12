import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateSsoSessionsTable1736661000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sso_sessions',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '64',
            isPrimary: true,
          },
          {
            name: 'project_id',
            type: 'char',
            length: '36',
            isNullable: false,
          },
          {
            name: 'project_slug',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'project_name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'return_url',
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
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'is_consumed',
            type: 'tinyint',
            width: 1,
            default: 0,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'sso_sessions',
      new TableIndex({
        name: 'IDX_sso_sessions_expires_at',
        columnNames: ['expires_at'],
      }),
    );

    await queryRunner.createIndex(
      'sso_sessions',
      new TableIndex({
        name: 'IDX_sso_sessions_project_id',
        columnNames: ['project_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'sso_sessions',
      new TableForeignKey({
        columnNames: ['project_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'projects',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('sso_sessions');
    if (table) {
      const foreignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('project_id') !== -1,
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey('sso_sessions', foreignKey);
      }
    }
    
    await queryRunner.dropIndex('sso_sessions', 'IDX_sso_sessions_project_id');
    await queryRunner.dropIndex('sso_sessions', 'IDX_sso_sessions_expires_at');
    await queryRunner.dropTable('sso_sessions');
  }
}
