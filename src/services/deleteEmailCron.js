const CronJob = require("node-cron");
const pool = require("../db");
const moment = require("moment");
const path = require('path');
function deleteEmailCronInit() {
  //   const scheduledJobFunction = CronJob.schedule("3 */12 * * *", () => {
  // const scheduledJobFunction = CronJob.schedule("0 */1 * * *", () => {
  const scheduledJobFunction = CronJob.schedule("*/10 * * * * *", () => {
    console.log("I'm executed on a schedule!");
    pool.query(
      `WITH rows_to_delete AS (
        SELECT *
        FROM valid_emails
        WHERE expires < current_timestamp
      )
      DELETE FROM valid_emails
      WHERE (id) IN (
        SELECT id
        FROM rows_to_delete
      )`,
      (error, results) => {
        if (error) {
          throw error;
        }
        console.log(results);
      }
    );

    // let attachmentsDirectory = path.join("attachments");
    // console.log("===>",attachmentsDirectory)
    // fs.readdir(attachmentsDirectory, function (err, files) {
    //   if (err) {
    //     console.error("Could not list the directory.", err);
    //     process.exit(1);
    //   }
    //   console.log(files)
    //   files.forEach(function (file, index) {
    //     // Make one pass and make the file complete
    //     var fromPath = path.join(attachmentsDirectory, file);
    //     // var toPath = path.join(moveTo, file);
    //     console.log(file);
    //     fs.stat(fromPath, function (error, stat) {
    //       if (error) {
    //         console.error("Error stating file.", error);
    //         return;
    //       }

    //       if (stat.isFile()) console.log("'%s' is a file.", fromPath);
    //       else if (stat.isDirectory())
    //         console.log("'%s' is a directory.", fromPath);
    //     });
    //   });
    // });

    // pool.query("SELECT * FROM valid_emails WHERE expires < current_timestamp", (error, results) => {
    //   if (error) {
    //     throw error;
    //   }
    //   console.log(results.rows);
    // });
    // Add your custom logic here
  });

  scheduledJobFunction.start();
}

module.exports = deleteEmailCronInit;
