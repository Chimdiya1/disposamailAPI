const CronJob = require("node-cron");
const pool = require("../db");
const moment = require("moment");
function deleteEmailCronInit() {
  //   const scheduledJobFunction = CronJob.schedule("3 */12 * * *", () => {
  const scheduledJobFunction = CronJob.schedule("0 */1 * * *", () => {
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
