var util = require("util");
var pg = require("pg");
const config = require("config");
// const db = require("../queries/queries");

exports.register = function () {
  this.logdebug("Initializing rcpt_to validity plugin.");
  //   var config = this.config.get("rcpt_to.validity.json");

  var dbConfig = {
    user: config.get("user"),
    host: config.get("host"),
    database: config.get("database"),
    password: config.get("password"),
    port: config.get("dbPort"),
    sqlQuery: 'SELECT EXISTS(SELECT 1 FROM valid_emails WHERE email=$1) AS "exists"',
  };

  //Initialize the connection pool.
  this.pool = new pg.Pool(dbConfig);

  /**
   * If an error is encountered by a client while it sits idle in the pool the pool itself will emit an
   * error event with both the error and the client which emitted the original error.
   */
  this.pool.on("error", function (err, client) {
    this.logerror(
      "Idle client error. Probably a network issue or a database restart." +
        err.message +
        err.stack
    );
  });

  this.sqlQuery = dbConfig.sqlQuery;
};


exports.hook_rcpt = function (next, connection, params) {
  this.register();
  var rcpt = params[0];

  this.loginfo("body=======> " + connection.transaction);
  this.loginfo("Checking validity of " + util.inspect(params[0]));
  let receipientEmail = rcpt.user + "@" + rcpt.host;
  this.is_user_valid(receipientEmail, function (isValid) {
    if (isValid) {
      connection.loginfo("Valid email recipient. Continuing...", this);
      next();
    } else {
      connection.loginfo("Invalid email recipient. DENY email receipt.", this);
      next(DENY, "Invalid email address.");
    }
  });
};

exports.is_user_valid = function (userID, callback) {
  var plugin = this;

  plugin.pool.connect(function (err, client, done) {
    if (err) {
      plugin.logerror("Error fetching client from pool. " + err);
      return callback(false);
    }

    client.query(plugin.sqlQuery, [userID], function (err, result) {
      //Release the client back to the pool by calling the done() callback.
      done();

      if (err) {
        plugin.logerror("Error running query. " + err);
        return callback(false);
      }

      return callback(result.rows[0].exists);
    });
  });
};
