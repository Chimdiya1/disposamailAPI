const express = require("express");
const pool = require("../db");
const randomNameGen = require("../../utils/randomNameGen");

const addressesRouter = express.Router();
/* GET ALL VALID ADDRESSES */
addressesRouter.get("/", function (req, res, next) {
  pool.query("SELECT * FROM valid_emails", (error, results) => {
    if (error) {
      throw error;
    }
    res.status(200).json(results.rows);
  });
  //   res.send("respond with a resource");
});

/* create new address */
addressesRouter.get("/new", async function (req, res, next) {
  //create random address with our domain and save it to db and return it

  try {
    //create random address
    let addressName;
    addressName = req.body.addressName ? req.body.addressName : randomNameGen();
    let newEmailAddress = addressName + '@' + process.env.DOMAIN;
    // Check if the value exists in the database
    const query = "SELECT COUNT(*) FROM valid_emails WHERE email = $1";
    const result = await pool.query(query, [newEmailAddress]);
    const count = parseInt(result.rows[0].count);

    if (count === 0) {
      // Insert the value into the database
      const insertQuery =
        "INSERT INTO valid_emails (userid, email) VALUES ($1, $2)";
      pool
        .query(insertQuery, ["value", newEmailAddress])
        .then(() => {
          res.status(200).json({
            success: true,
            message: "Value inserted into the database.",
          });
        })
        .catch((error) => {
          res.status(500).json({
            success: false,
            error: "Error inserting mail",
          });
        });
    } else {
      res.status(200).json({
        success: true,
        message: "Value already exists in the database.",
      });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
});

module.exports = addressesRouter;
