const Iconv = require("iconv").Iconv;
const simpleParser = require("mailparser").simpleParser;
const async = require("async");
const mime = require("mime");
const EmailBodyUtility = require("../utils/email_body_utility");
const _checkInlineImages = require("../utils/checkInlineImages");
const _storeAttachments = require("../utils/storeAttachments");
const config = require("config");
var pg = require("pg");

exports.register = function () {
  var plugin = this;
  plugin.save_mail_ini();
  plugin.register_hook("init_master", "initialize_db");
  plugin.register_hook("init_child", "initialize_db");
  // Enable for queue
  if (plugin.cfg.enable.queue === "yes") {
    plugin.register_hook("data", "enable_transaction_body_parse");
    plugin.register_hook("queue", "queue_to_db");
    // Define mime type
    try {
      if (plugin.cfg.attachments.custom_content_type) {
        mime.define(plugin.cfc.attachments.custom_content_type);
        plugin.lognotice("------------------------------------------------- ");
        plugin.lognotice(" Successfully loaded the custom content types !!! ");
        plugin.lognotice("------------------------------------------------- ");
      }
    } catch (e) {}
  }
};

exports.initialize_db = function (next, server) {
  var plugin = this;
  this.logdebug("Initializing db");
  //   var config = this.config.get("rcpt_to.validity.json");

  var dbConfig = {
    user: config.get("user"),
    host: config.get("host"),
    database: config.get("database"),
    password: config.get("password"),
    port: config.get("dbPort"),
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
  if (!server.notes.pgdb) {
    this.pool.connect(function (err, client, done) {
      if (err) {
        plugin.logerror("Error fetching client from pool. " + err);
        throw err;
      }
      // plugin.loginfo(client)
      server.notes.pgdb = client;
      next();
    });
  } else {
    plugin.loginfo("There is already a db connection in the server.notes !!!");
    next();
  }
};
//loading configs
exports.save_mail_ini = function () {
  var plugin = this;

  plugin.cfg = plugin.config.get(
    "save_mail.ini",
    {
      booleans: [
        "+enable.queue.yes",
        "+enable.delivery.yes",
        "+limits.incoming.no",
      ],
    },
    function () {
      plugin.save_mail_ini();
    }
  );

  // plugin.cfg.limits.db = plugin.cfg.limits.db || "mongodb";
};

// Hook for data
exports.enable_transaction_body_parse = function (next, connection) {
  connection.transaction.parse_body = true;
  next();
};

//Queue to db
exports.queue_to_db = function (next, connection) {
  var plugin = this;
  plugin.loginfo("====STARTING QUEUE TO DB======= ");
  var _stream =
    connection &&
    connection.transaction &&
    connection.transaction.message_stream
      ? true
      : false;
  if (!_stream) return next();

  var body = connection.transaction.body;

  var _size =
    connection && connection.transaction
      ? connection.transaction.data_bytes
      : null;
  var _header =
    connection && connection.transaction && connection.transaction.header
      ? connection.transaction.header
      : null;

  var _body_html;
  var _body_text;
  async.waterfall(
    [
      //   function (waterfall_callback) {
      //     // Check limit
      //     _limitIncoming(plugin, _header, function (error, status) {
      //       // plugin.lognotice('limits cb: ', status)
      //       return waterfall_callback(status ? "limit" : null);
      //     });
      //   },
      function (waterfall_callback) {
        _mp(plugin, connection, function (error, email) {
          if (error) {
            plugin.logerror("--------------------------------------");
            plugin.logerror(" ============>Error from _mp !!! ", error.message);
            plugin.logerror("--------------------------------------");
            return waterfall_callback(error, email);
          } else {
            _body_html = email.html || null;
            _body_text = email.text || null;

            return waterfall_callback(null, email);
          }
        });
      },
      function (email, waterfall_callback) {
        plugin.loginfo(">>>>>>>",email);
        // console.log(">>>>>>>",email);
        // Get proper body
        EmailBodyUtility.getHtmlAndTextBody(
          email,
          body,
          function (error, html_and_text_body_info) {
            if (error || !html_and_text_body_info) {
              return waterfall_callback(
                error ||
                  `unable to extract any email body data from email id:'${email._id}'`
              );
            }

            return waterfall_callback(null, html_and_text_body_info, email);
          }
        );
      },
      function (body_info, email, waterfall_callback) {
        // plugin.lognotice(" body_info.meta !!! ", body_info.meta);
        // Add html into email
        email.html = body_info.html;
        email.text = body_info.text;
        // Check for inline images
        _checkInlineImages(plugin, email, function (error, email) {
          plugin.loginfo("==== BODY AND HTML =======> ", email.html);
          // Return
          return waterfall_callback(null, email);
        });
      },
    ],
    function (error, email_object) {
      // For limit
      if (error === "limit") {
        // plugin.lognotice('--------------------------------------');
        // plugin.lognotice(`Too many emails from this sender at the same time !!!`);
        // plugin.lognotice('--------------------------------------');
        return next(
          DENYSOFT,
          "Too many emails from this sender at the same time"
        );
      }

      if (error) {
        plugin.logerror("--------------------------------------");
        plugin.logerror(`Error parsing email: `, error.message);
        plugin.logerror("--------------------------------------");
        _sendMessageBack("parsing", plugin, _header, error);
        return next(DENYDISCONNECT, "storage error");
      }

      // By default we do not store the haraka body and the whole email object
      var _store_raw =
        plugin.cfg.message && plugin.cfg.message.store_raw === "yes"
          ? true
          : false;

      // If we have a size limit
      if (
        _size &&
        plugin.cfg.message &&
        plugin.cfg.message.limit &&
        plugin.cfg.enable.delivery === "yes"
      ) {
        // If message is bigger than limit
        if (_size > parseInt(plugin.cfg.message.limit)) {
          _store_raw = false;
        }
      }

      var _now = new Date();

      // Mail object
      var _email = {
        raw_html: _body_html,
        raw_text: _body_text,
        sender: email_object.headers.get("from")
          ? email_object.headers.get("from").value[0]
          : null,
        receiver: email_object.headers.get("to")
          ? email_object.headers.get("to").value[0]
          : null,
        // cc: email_object.headers.get("cc")
        //   ? email_object.headers.get("cc").value
        //   : null,
        // bcc: email_object.headers.get("bcc")
        //   ? email_object.headers.get("bcc").value
        //   : null,
        subject: email_object.subject,
        date: email_object.date || email_object.headers.get("date"),
        received_date: _now,
        message_id: email_object.messageId
          ? email_object.messageId.replace(/<|>/gm, "")
          : new ObjectID() + "@haraka-helpmonks.com",
        attachments: JSON.stringify(email_object.attachments) || [],
        headers: email_object.headers,
        html: email_object.html,
        text: email_object.text ? email_object.text : null,
        reply_to: email_object.headers.get("reply-to")
          ? email_object.headers.get("reply-to").value
          : null,
        // mail_from:
        //   connection && connection.transaction
        //     ? connection.transaction.mail_from[0]
        //     : null,
        // rcpt_to:
        //   connection && connection.transaction
        //     ? connection.transaction.rcpt_to[0]
        //     : null,
        size:
          connection && connection.transaction
            ? connection.transaction.data_bytes
            : null,
      };
      plugin.loginfo("==== Raw  =======> ", JSON.stringify(_email, null, 2));

      // If we have a size limit
      // if (plugin.cfg.message && plugin.cfg.message.limit && plugin.cfg.enable.delivery === 'yes') {
      // 	// Get size of email object
      // 	var _size_email_obj = JSON.stringify(_email).length;
      // 	// If message is bigger than limit
      // 	if ( _size_email_obj > parseInt(plugin.cfg.message.limit) ) {
      // 		plugin.logerror('--------------------------------------');
      // 		plugin.logerror(' Message size is too large. Sending back an error. Size is: ', _size);
      // 		plugin.logerror('--------------------------------------');
      // 		_sendMessageBack('limit', plugin, _header);
      // 		return next(DENYDISCONNECT, "storage error");
      // 	}
      // }

      // Add to db
      plugin.pool.query(
        "INSERT INTO received_emails (raw_html,raw_text,sender, receiver,subject,date,received_date,message_id,attachments,headers,html,text,reply_to,size) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *",
        Object.values(_email),
        (error, results) => {
          if (error) {
            plugin.logerror("--------------------------------------");
            plugin.logerror(
              `Error on insert of the email with the message_id: ${_email.message_id} Error: `,
              error.message
            );
            plugin.logerror("--------------------------------------");
            throw error;
          } else {
            plugin.lognotice("--------------------------------------");
            plugin.lognotice(
              ` Successfully stored the email with the message_id: ${_email.message_id} !!! `
            );
            plugin.lognotice("--------------------------------------");
            return next(OK);
          }
        }
      );

      // server.notes.mongodb.collection(plugin.cfg.collections.queue).insertOne(_email, { checkKeys : false }, function(err) {
      // 	if (err) {
      // 		// Remove the large fields and try again
      // 		delete _email.haraka_body;
      // 		delete _email.raw;
      // 		// Let's try again
      // 		server.notes.mongodb.collection(plugin.cfg.collections.queue).insertOne(_email, { checkKeys : false }, function(err) {
      // 			if (err) {
      // 				plugin.logerror('--------------------------------------');
      // 				plugin.logerror(`Error on insert of the email with the message_id: ${_email.message_id} Error: `, err.message);
      // 				plugin.logerror('--------------------------------------');
      // 				// Restart
      // 				if (plugin.cfg.mongodb && plugin.cfg.mongodb.restart === 'yes') {
      // 					_sendMessageBack('insert', plugin, _header, err);
      // 					throw 'MongoDB insert error';
      // 				}
      // 				// Send error
      // 				// _sendMessageBack('insert', plugin, _header, err);
      // 				// Return
      // 				return next(DENYSOFT, "storage error");
      // 			}
      // 			else {
      // 				plugin.lognotice('--------------------------------------');
      // 				plugin.lognotice(` Successfully stored the email with the message_id: ${_email.message_id} !!! `);
      // 				plugin.lognotice('--------------------------------------');
      // 				return next(OK);
      // 			}
      // 		})
      // 	}
      // 	else {
      // 		plugin.lognotice('--------------------------------------');
      // 		plugin.lognotice(` Successfully stored the email with the message_id: ${_email.message_id} !!! `);
      // 		plugin.lognotice('--------------------------------------');
      // 		return next(OK);
      // 	}
      // });
    }
  );
};

function _mp(plugin, connection, cb) {
  // Options
  var _options = { Iconv, skipImageLinks: true };
  //   if (
  //     plugin.cfg.message &&
  //     plugin.cfg.message.limit &&
  //     plugin.cfg.enable.delivery === "yes"
  //   )
  //     _options.maxHtmlLengthToParse = plugin.cfg.message.limit;
  // Parse
  simpleParser(
    connection.transaction.message_stream,
    _options,
    (error, mail) => {
      if (mail && mail.attachments) {
        //store email attachments here
        _storeAttachments(
          connection,
          plugin,
          mail.attachments,
          mail,
          function (error, mail_object) {
            return cb(error, mail_object);
          }
        );
        // plugin.loginfo("========= GOT HERE======= ");
        // return cb(error, mail);
      } else {
        // plugin.loginfo("========= GOT HERE======= ");
        return cb(error, mail);
      }
    }
  );
}
