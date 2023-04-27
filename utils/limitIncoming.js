// Limits
function _limitIncoming(plugin, email_headers, cb) {
  // No limits check
  if (plugin.cfg.limits.incoming === "no") {
    return cb(null, null);
  }
  // Header not valid
  if (!email_headers) {
    return cb(null, null);
  }
  // FROM
  var _from =
    email_headers.headers_decoded["reply-to"] ||
    email_headers.headers_decoded.from ||
    (email_headers.headers.mail_from &&
      email_headers.headers.mail_from.original) ||
    null;
  // TO
  var _to =
    email_headers.headers_decoded.to || email_headers.headers.to || null;
  // if to or from are null abort
  if (!_from || !_to) {
    return cb(null, null);
  }
  // Make sure we got the email address
  _from = _from.map((t) => t.address || t)[0];
  // Clean from
  _from = _from.replace(/<|>/gm, "").toLowerCase();
  // Check excludes
  var _limit_exclude = plugin.cfg.limits.exclude || [];
  var _found_exlude_value = _limit_exclude.find((n) => _from.includes(n));
  if (_found_exlude_value) {
    return cb(null, null);
  }
  // Check include
  var _limit_include = plugin.cfg.limits.include || [];
  var _found_include_value = _limit_include.find((n) => _from.includes(n));
  if (!_found_include_value) {
    return cb(null, null);
  }
  // TO
  _to = _to.map((t) => t.address || t);
  // Which db
  var _is_mongodb = plugin.cfg.limits.db === "mongodb" ? true : false;
  // Loop
  async.eachSeries(
    _to,
    function (t, each_callback) {
      if (_is_mongodb) {
        // Object for query and insert
        var _obj = { from: _from, to: t };
        // Check
        async.waterfall(
          [
            // Check
            function (waterfall_callback) {
              server.notes.mongodb
                .collection(plugin.cfg.limits.incoming_collection)
                .findOne(_obj, function (err, record) {
                  // plugin.lognotice("record", record);
                  // If found
                  if (record && record.from) {
                    plugin.lognotice("--------------------------------------");
                    plugin.lognotice(
                      `Too many emails within ${plugin.cfg.limits.incoming_seconds} seconds`
                    );
                    plugin.lognotice(`from ${_from} !!!`);
                    plugin.lognotice("--------------------------------------");
                    return waterfall_callback(true);
                  }
                  return waterfall_callback(null);
                });
            },
            // Insert
            function (waterfall_callback) {
              waterfall_callback(null);
              _obj.timestamp = new Date();
              server.notes.mongodb
                .collection(plugin.cfg.limits.incoming_collection)
                .insertOne(_obj, { checkKeys: false }, function (err) {});
            },
          ],
          function (error) {
            return each_callback(error);
          }
        );
      } else {
        // Key
        var _key = `${_from}_${_to}`.replace(/[^A-Za-z0-9]/g, "");
        // Check for key
        server.notes.redis.get(_key, function (error, data) {
          // If here
          if (data) {
            plugin.lognotice("--------------------------------------");
            plugin.lognotice(
              `Too many emails within ${plugin.cfg.limits.incoming_seconds} seconds`
            );
            plugin.lognotice(`from ${_from} !!!`);
            plugin.lognotice("--------------------------------------");
            return each_callback(true);
          }
          // Else add key
          server.notes.redis.set(
            _key,
            true,
            "EX",
            parseInt(plugin.cfg.limits.incoming_seconds)
          );
          // Return
          each_callback(null);
        });
      }
    },
    function (error) {
      return cb(null, error || null);
    }
  );
}
module.exports = _limitIncoming;
