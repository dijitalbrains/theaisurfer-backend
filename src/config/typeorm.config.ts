import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load environment variables
config();

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'theaisurfer',
  entities: ['src/**/*.entity{.ts,.js}'],
  migrations: ['src/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
