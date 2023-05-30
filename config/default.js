const dotenv = require("dotenv");
dotenv.config();

console.log(process.env.DB_USER);

const devConfig = {
  user: process.env.DB_USER_DEV,
  host: process.env.DB_HOST_DEV,
  database: process.env.DB_DATABASE_DEV,
  password: process.env.DB_PASSWORD_DEV,
  port: 8080,
  max: 20,
  idleTimeoutMillis: 30000,
  dbPort: process.env.DB_PORT,
};
const productionConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: 8080,
  max: 20,
  idleTimeoutMillis: 30000,
  dbPort: process.env.DB_PORT,
};

let config =
  process.env.NODE_ENV === "production" ? productionConfig : devConfig;

module.exports = config;
