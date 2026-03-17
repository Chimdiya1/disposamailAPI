const { Client } = require("pg");
const EventEmitter = require("events");

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
const dbConfig =
  process.env.NODE_ENV === "production" ? productionConfig : devConfig;

class PgListener extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.connected = false;
  }

  async connect() {
    try {
      this.client = new Client(dbConfig);
      await this.client.connect();
      await this.client.query("LISTEN new_email");
      this.connected = true;
      console.log("pgListener: connected and listening for new_email");

      this.client.on("notification", (msg) => {
        try {
          const payload = JSON.parse(msg.payload);
          this.emit("new_email", payload);
        } catch (e) {
          console.error("pgListener: failed to parse notification payload", e);
        }
      });

      this.client.on("error", (err) => {
        console.error("pgListener: client error", err.message);
        this.connected = false;
        this._reconnect();
      });

      this.client.on("end", () => {
        this.connected = false;
        this._reconnect();
      });
    } catch (err) {
      console.error("pgListener: connection failed", err.message);
      this._reconnect();
    }
  }

  _reconnect() {
    console.log("pgListener: reconnecting in 5 seconds...");
    setTimeout(() => this.connect(), 5000);
  }
}

module.exports = new PgListener();
