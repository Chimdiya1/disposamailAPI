const Pool = require("pg").Pool;

const databaseConfig = {
  user: process.env.DB_USER_DEV,
  host: process.env.DB_HOST_DEV,
  database: process.env.DB_DATABASE_DEV,
  password: process.env.DB_PASSWORD_DEV,
  port: process.env.DB_PORT,
};

const pool = new Pool(databaseConfig);

module.exports = pool;
