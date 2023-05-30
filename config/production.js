const dotenv = require("dotenv");

dotenv.config();

module.export = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: 8080,
  max: 20,
  idleTimeoutMillis: 30000,
  dbPort: process.env.DB_PORT,
};
