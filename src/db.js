const Pool = require("pg").Pool;

const devConfig = {
  user: process.env.DB_USER_DEV,
  host: process.env.DB_HOST_DEV,
  database: process.env.DB_DATABASE_DEV,
  password: process.env.DB_PASSWORD_DEV,
  port: process.env.DB_PORT,
  ssl: true,
};
const productionConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: true,
};
let config =
  process.env.NODE_ENV === "production" ? productionConfig : devConfig;

const pool = new Pool(config);

module.exports = pool;
