const { Pool } = require('pg');

const pool = new Pool({
  host: 'teamreports-db.c3yg4w2imela.eu-north-1.rds.amazonaws.com',
  user: 'postgres',
  password: 'abirakash',
  database: 'abirakash',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;
