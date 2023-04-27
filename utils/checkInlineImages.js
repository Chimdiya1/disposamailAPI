function _checkInlineImages(plugin, email, callback) {
  // No need if there are no attachments
  if (email.attachments && !email.attachments.length)
    return callback(null, email);

  // Clean up any text inline image tags
  // email.text = email.text.replace(/(\[data:image(.*?)\]|\[cid:(.*?)\])/g, '');
  // email.html = email.html.replace(/(\[data:image(.*?)\]|\[cid:(.*?)\])/g, '');

  // Get cid settings
  var _cid = plugin.cfg.attachments.cid || "cid";

  // if we should leave inline images as cid values
  if (_cid === "cid") {
    // Return
    return callback(null, email);
  }

  // Path to attachments dir
  var _attachments_folder_path = plugin.cfg.attachments.path;

  // plugin.loginfo('--------------------------------------');
  // plugin.loginfo('checkInlineImages');
  // plugin.loginfo('--------------------------------------');

  // Loop over attachments
  email.attachments.forEach(function (attachment) {
    // Set attachment path
    var _attachment_directory = path.join(
      _attachments_folder_path,
      attachment.checksum
    );
    // Complete local path with the filename
    var _attachment_full_path = path.join(
      _attachment_directory,
      attachment.generatedFileName
    );
    var _contentid = attachment.cid
      ? attachment.cid
      : attachment.contentId
      ? attachment.contentId.replace(/<|>/g, "")
      : "";
    // Look for the cid in the html
    var _match = email.html.match(`cid:${_contentid}`);
    if (_match) {
      var _data_string;
      // Read file as base64
      if (_cid === "base64") {
        var _imageAsBase64 = fs.readFileSync(_attachment_full_path, "base64");
        // Replace
        _data_string = `data:${attachment.contentType};base64,${_imageAsBase64}`;
      } else if (_cid === "path") {
        _data_string = `${_cid}/${attachment.generatedFileName}`;
      }
      // Loop over matches
      _match.forEach(function (cid) {
        // Replace images
        email.html = S(email.html).replaceAll(
          "cid:" + _contentid,
          _data_string
        ).s;
        email.html = S(email.html).replaceAll(
          _attachment_full_path,
          _data_string
        ).s;
        // Remove attachment from attachment array
        if (_cid === "base64") {
          email.attachments = email.attachments.filter(
            (a) => a.checksum !== attachment.checksum
          );
        }
      });
    }
  });
  // Return
  return callback(null, email);
}
module.exports = _checkInlineImages;
