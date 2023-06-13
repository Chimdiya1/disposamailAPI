const async = require("async");
const mime = require("mime");
const path = require('path');
const fs = require('fs-extra');
// Cleanup filename of attachment
function _cleanFileName(file_name, generated_file_name) {
  // Split filename by last dot
  var _fN = file_name.split(/\.(?=[^\.]+$)/);
  // Clean up filename that could potentially cause an issue
  var _fN_clean = _fN[0].replace(/[^A-Za-z0-9]/g, "_");

  // Split generated filename by last dot
  var _fNG = generated_file_name.split(/\.(?=[^\.]+$)/);
  // Clean up filename that could potentially cause an issue
  var _fNG_clean = _fNG[0].replace(/[^A-Za-z0-9]/g, "_");

  // Return
  return {
    file_name: `${_fN_clean}.${_fN[1]}`,
    generated_file_name: `${_fNG_clean}.${_fNG[1]}`,
  };
}

// Attachment code
function _storeAttachments(connection, plugin, attachments, mail_object, cb) {
  var _attachments = [];
  let receiver = mail_object.to.text
  // console.log("====>",mail_object.to.text)
  // loop through each attachment and attempt to store it locally
  var is_tnef_attachment = false;

  // Filter attachments starting with ~
  // attachments = attachments.filter(a => a.filename && a.filename.startsWith('~') ? false : true);

  // If no attachment anymore
  if (!attachments.length) return cb(null, mail_object);

  async.eachSeries(
    attachments,
    function (attachment, each_callback) {
      // if attachment type is inline we don't need to store it anymore as the inline images are replaced with base64 encoded data URIs in mp2
      // if ( attachment && attachment.related ) {
      // 	// Filter
      // 	_attachments = _attachments.filter(a => a.checksum !== attachment.checksum);
      // 	return each_callback();
      // }

      plugin.loginfo("--------------------------------------");
      plugin.loginfo("Begin storing attachment");
      // plugin.loginfo("filename : ", attachment.filename);
      // plugin.loginfo("Headers : ", attachment.headers);
      // plugin.loginfo("contentType : ", attachment.contentType);
      // plugin.loginfo("contentDisposition : ", attachment.contentDisposition);
      // plugin.loginfo("checksum : ", attachment.checksum);
      // plugin.loginfo("size : ", attachment.size);
      // plugin.loginfo("contentId : ", attachment.contentId);
      // plugin.loginfo("cid : ", attachment.cid);
      // plugin.loginfo("related : ", attachment.related);
      // plugin.loginfo("--------------------------------------");

      try {
        // Remove headers
        delete attachment.headers;

        // Check contentype and check blocked attachments
        if (attachment.contentType) {
          // Filter out if type is on the reject list
          if (
            plugin.cfg.attachments.reject &&
            plugin.cfg.attachments.reject.length &&
            plugin.cfg.attachments.reject.includes(attachment.contentType)
          ) {
            plugin.loginfo("--------------------------------------");
            plugin.loginfo("Following attachment is blocked:");
            plugin.loginfo("filename : ", attachment.filename);
            plugin.loginfo("contentType : ", attachment.contentType);
            plugin.loginfo("--------------------------------------");
            _attachments = _attachments.filter(
              (a) => a.checksum !== attachment.checksum
            );
            return each_callback();
          }
        }

        // Check names for blocked attachments
        if (
          plugin.cfg.attachments.reject_by_name &&
          plugin.cfg.attachments.reject_by_name.length &&
          plugin.cfg.attachments.reject_by_name.includes(attachment.filename)
        ) {
          plugin.loginfo("--------------------------------------");
          plugin.loginfo("Following attachment is blocked:");
          plugin.loginfo("filename : ", attachment.filename);
          plugin.loginfo("contentType : ", attachment.contentType);
          plugin.loginfo("--------------------------------------");
          _attachments = _attachments.filter(
            (a) => a.checksum !== attachment.checksum
          );
          return each_callback();
        }

        // Path to attachments dir
        var attachments_folder_path = plugin.cfg.attachments.path;
        // plugin.loginfo('attachments_folder_path : ', attachments_folder_path);

        // if there's no checksum for the attachment then generate our own uuid
        // attachment.checksum = attachment.checksum || uuid.v4();
        var attachment_checksum = attachment.checksum || uuidv4();
        // plugin.loginfo('Begin storing attachment : ', attachment.checksum, attachment_checksum);

        // Size is in another field in 2.x
        attachment.length = attachment.size || attachment.length;
        // No more generatedFilename in 2.x
        attachment.fileName =
          attachment.filename || attachment.fileName || "attachment.txt";
        attachment.generatedFileName =
          attachment.generatedFileName || attachment.fileName;

        // If not CID exists
        attachment.cid = attachment.cid ? attachment.cid : attachment_checksum;

        // if attachment.contentDisposition doesn't exits
        if (!attachment.contentDisposition) {
          attachment.contentDisposition = attachment.type || "attachment";
        }

        // For calendar events
        if (
          attachment.contentType &&
          attachment.contentType === "text/calendar"
        ) {
          attachment.fileName = "invite.ics";
          attachment.generatedFileName = "invite.ics";
        }

        // For delivery messages
        if (
          attachment.contentType &&
          attachment.contentType === "message/delivery-status"
        ) {
          attachment.fileName = "delivery_status.txt";
          attachment.generatedFileName = "delivery_status.txt";
        }

        // If filename starts with .
        if (attachment.fileName.startsWith(".")) {
          var _file_name = `${attachment_checksum}${attachment.fileName}`;
          attachment.fileName = _file_name;
          attachment.generatedFileName = _file_name;
        }

        // If filename starts with ~
        if (attachment.fileName.startsWith("~")) {
          var _clean_filename = attachment.fileName.replace(/\~/g, "");
          attachment.fileName = _clean_filename;
          attachment.generatedFileName = _clean_filename;
        }

        // If filename is attachment.txt
        if (
          attachment.fileName === "attachment.txt" &&
          attachment.contentType &&
          attachment.contentType.includes("/")
        ) {
          // Get ext from contenttype
          try {
            var _ext =
              attachment.contentType.indexOf("rfc822") === -1
                ? mime.getExtension(attachment.contentType)
                : "eml";
            if (_ext) {
              attachment.fileName = `attachment.${_ext}`;
              attachment.generatedFileName = attachment.fileName;
            }
          } catch (e) {
            plugin.loginfo("Not able to parse extension from contenttype");
          }
        }

        // Filename cleanup
        if (
          attachment.fileName !== "attachment.txt" &&
          attachment.fileName !== "invite.ics"
        ) {
          var _file_names = _cleanFileName(
            attachment.fileName,
            attachment.generatedFileName
          );
          attachment.fileName = _file_names.file_name;
          attachment.generatedFileName = _file_names.generated_file_name;
        }

        // Split up filename
        var _fn_split = attachment.fileName.split(".");
        var _is_invalid =
          (_fn_split && _fn_split[1] === "undefined") || _fn_split.length === 1
            ? true
            : false;

        // Set extension based on content type
        if (attachment.contentType && _is_invalid) {
          // Get extension
          var _fn_ext = mime.getExtension(attachment.contentType);
          // Add it together
          var _fn_final = _fn_split[0] + "." + _fn_ext;
          // Create attachment object
          attachment.fileName = _fn_final;
          attachment.generatedFileName = _fn_final;
        }

        // if generatedFileName is longer than 200
        if (
          attachment.generatedFileName &&
          attachment.generatedFileName.length > 200
        ) {
          // Split up filename
          var _filename_new = attachment.generatedFileName.split(".");
          // Get extension
          var _fileExt = _filename_new.pop();
          // Get filename
          var _filename_pop = _filename_new[0];
          // Just in case filename is longer than 200 chars we make sure to take from the left
          var _filename_200 = S(_filename_pop).left(200).s;
          // Add it together
          var _final = _filename_200 + "." + _fileExt;
          // Create attachment object
          attachment.fileName = _final;
          attachment.generatedFileName = _final;
        }

        var attachment_directory = path.join(
          attachments_folder_path,
          receiver,
          attachment_checksum
        );
        plugin.loginfo('attachment_directory ! : ', attachment_directory);
        
        fs.mkdirp(attachment_directory, function (error, result) {
          // if we have an error, and it's not a directory already exists error then record it
          if (error && error.errno != -17) {
            plugin.logerror(
              "Could not create a directory for storing the attachment !!!",
              JSON.stringify(error)
            );
            return each_callback();
          }

          // Complete local path with the filename
          var attachment_full_path = path.join(
            attachment_directory,
            attachment.generatedFileName
          );
          // Log
          plugin.loginfo(
            `Storing ${attachment.generatedFileName} at ${attachment_full_path}`
          );
          // Write attachment to disk
          fs.writeFile(
            attachment_full_path,
            attachment.content,
            function (error) {
              // Log
              if (error) {
                plugin.logerror(
                  `Error saving attachment locally to path ${attachment_full_path}, error :`,
                  error
                );
                return each_callback();
              }

              // If we can store
              plugin.lognotice(
                `Attachment ${attachment.generatedFileName} (${attachment.length} bytes) successfully stored`
              );

              // if we have an attachment in tnef, unzip it and store the results
              if (
                attachment.generatedFileName.toLowerCase() === "winmail.dat"
              ) {
                // set to true so later the emails[0].attachments gets updated
                is_tnef_attachment = true;

                // use tnef to extract the file into the same directory
                var exec_command = `tnef ${attachment_full_path} -C ${attachment_directory}`;

                plugin.lognotice("WINMAIL: Converting :", exec_command);

                // execute the tnef process to extract the real attachment
                var tnef_process = exec(
                  exec_command,
                  function (error, stdout, stderr) {
                    var general_error = stderr || error;

                    // get the contents of the directory as all for the attachments
                    fs.readdir(
                      attachment_directory,
                      function (error, contents) {
                        // loop over each file in the directory that is not winmail.dat and add it as an attachment
                        async.eachLimit(
                          contents.filter((fn) => fn !== "winmail.dat"),
                          3,
                          function (file_name, each_callback) {
                            // Path to original file
                            var _path_org = path.join(
                              attachment_directory,
                              file_name
                            );
                            // plugin.loginfo(`WINMAIL.DAT: PATH ORG: ${_path_org}`);

                            // Convert filename
                            var _file_names = _cleanFileName(
                              file_name,
                              file_name
                            );
                            var _file_name_new = _file_names.file_name;
                            // plugin.loginfo(`WINMAIL.DAT: NEW NAME: ${_file_name_new}`);

                            // Path to new file
                            var _path_new = path.join(
                              attachment_directory,
                              _file_name_new
                            );
                            // plugin.loginfo(`WINMAIL.DAT: NEW PATH: ${_file_name_new}`);

                            // Convert the name on disk
                            try {
                              fs.moveSync(_path_org, _path_new, {
                                overwrite: true,
                              });
                            } catch (e) {
                              plugin.logerror(
                                "error converting the name on disl, error :",
                                e
                              );
                              return each_callback();
                            }

                            // get the size of the file from the stats
                            fs.stat(_path_new, function (error, stats) {
                              if (error) {
                                plugin.logerror(
                                  "error getting stats, error :",
                                  error
                                );
                                return each_callback();
                              }

                              var attachment = {
                                length: stats ? +stats.size : 0,
                                fileName: _file_name_new,
                                generatedFileName: _file_name_new,
                                checksum: attachment_checksum,
                              };
                              // plugin.loginfo(`WINMAIL.DAT: ATTACHMENT OBJECT: ${_file_name_new}`);
                              // If we can store
                              plugin.loginfo(
                                `WINMAIL: Attachment ${_file_name_new} successfully stored locally`
                              );

                              _attachments.push(attachment);

                              return each_callback();
                            });
                          },
                          each_callback
                        );
                      }
                    );
                  }
                );

                // if the above can't capture large files, try working with this
                tnef_process.on("exit", (code) => {
                  plugin.logwarn("tnef_process exit called");
                });
              } else {
                delete attachment.content;
                _attachments.push(attachment);
                return each_callback(null);
              }
            }
          );
        });
      } catch (e) {
        plugin.logerror(
          "---------------------------- Error in attachments !!",
          e.message
        );
        return each_callback(null);
      }
    },
    function (error) {
      // If error
      if (error) {
        plugin.loginfo("Error in attachments", error, _attachments);
        return cb(null, mail_object);
      }
      // Add attachment back to mail object
      mail_object.attachments = _attachments;
      // Log
      if (_attachments.length) {
        plugin.loginfo("--------------------------------------");
        plugin.loginfo(
          `Finished processing of ${_attachments.length} attachments`
        );
        plugin.loginfo("--------------------------------------");
      }
      // Callback
      return cb(null, mail_object);
    }
  );
}
module.exports = _storeAttachments;
