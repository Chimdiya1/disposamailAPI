const express = require("express");
const pool = require("../db");
const { validationResult } = require("express-validator");
const validateCreateAddressBody = require("../services/createAddressValidator");
const createAddress = require("../services/createAddress");
const addressesRouter = express.Router();
const moment = require("moment");
// @desc        get all valid emails
// @route       GET /api/addresses

addressesRouter.get("/", function (req, res, next) {
  pool.query("SELECT * FROM valid_emails", (error, results) => {
    if (error) {
      throw error;
    }
    res.status(200).json(results.rows);
  });
});

// @desc        create new email address
// @route       POST /api/addresses/new
addressesRouter.post(
  "/new",
  validateCreateAddressBody(),
  async function (req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw errors;
      } else {
        //create random address
        let newEmailAddress = await createAddress(res, pool);
        let userId = req.body.userId;
        console.log(req.body)
        //delete email if the user has created one before
        pool
          .query(
            `WITH rows_to_delete AS (
                SELECT *
                FROM valid_emails
                WHERE userId = $1
              )
              DELETE FROM valid_emails
              WHERE (id) IN (
                SELECT id
                FROM rows_to_delete
              )`,
            [userId]
          )
          .then((result) => {
            // console.log(result);
          })
          .catch((error) => {
            throw error;
          });

        var currentTime = new Date(); // Get the current time
        var futureTime = new Date(); // Create a new date object for the future time
        futureTime.setHours(currentTime.getHours() + 12);
        let expiryDate = moment(futureTime).format("YYYY-MM-DD HH:mm:ss");
        console.log(expiryDate)
        // Insert the value into the database
        const insertQuery =
          "INSERT INTO valid_emails (userid, email, expires) VALUES ($1, $2, $3)";
        pool
          .query(insertQuery, [userId, newEmailAddress, expiryDate])
          .then(() => {
            res.status(200).json({userId, email:newEmailAddress, expiryDate});
          })
          .catch((error) => {
            res.status(500).json({
              success: false,
              error: "Error inserting mail",
            });
          });

        }
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
      });
    }
  }
);

module.exports = addressesRouter;
