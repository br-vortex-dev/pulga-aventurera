/* ============================================================
 *  Liz Chat Backend — config/database.js
 *  Configuração da conexão Sequelize.
 *
 *  Dialetos suportados (via env DB_DIALECT):
 *   - "postgres" (padrão, produção) — lê DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS
 *   - "sqlite"   (dev local sem Postgres) — lê DB_STORAGE
 *
 *  A troca é só de infraestrutura: models, services e routes
 *  permanecem idênticos nos dois dialetos.
 * ============================================================ */

const path = require('path');
const { Sequelize } = require('sequelize');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dialect = (process.env.DB_DIALECT || 'postgres').toLowerCase();

function createSequelize() {
  // Nuvem (Render, Supabase...) costuma entregar uma única string de conexão.
  if (process.env.DATABASE_URL) {
    const dialectOptions = {};
    if (process.env.DB_SSL !== 'false') {
      // Hosts gerenciados exigem TLS; só desliga com DB_SSL=false explícito.
      dialectOptions.ssl = { require: true, rejectUnauthorized: false };
    }
    return new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions,
      pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    });
  }

  if (dialect === 'sqlite') {
    const storage = process.env.DB_STORAGE === ':memory:'
      ? ':memory:'
      : path.resolve(__dirname, '..', process.env.DB_STORAGE || path.join('data', 'liz.sqlite'));

    return new Sequelize({
      dialect: 'sqlite',
      storage,
      logging: false,
    });
  }

  const dialectOptions = {};
  if (process.env.DB_SSL === 'true') {
    // Hosts gerenciados (Render, Supabase, Neon...) exigem TLS.
    dialectOptions.ssl = { require: true, rejectUnauthorized: false };
  }

  return new Sequelize(
    process.env.DB_NAME || 'liz_chat',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASS || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      dialect: 'postgres',
      logging: false,
      dialectOptions,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      define: {
        // Padrão consistente entre dialetos.
        underscored: false,
      },
    }
  );
}

const sequelize = createSequelize();

module.exports = sequelize;
