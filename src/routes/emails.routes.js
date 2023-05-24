const express = require("express");
const pool = require("../db");

const emailsRouter = express.Router();

// @desc        get all emails
// @route       GET /api/emails

emailsRouter.get("/", function (req, res, next) {
  pool.query("SELECT * FROM received_emails", (error, results) => {
    if (error) {
      throw error;
    }
    res.status(200).json(results.rows);
  });
});

// @desc        get all emails sent to an address
// @route       POST /api/emails

emailsRouter.post("/", function (req, res, next) {
  try {
    pool.query(
      "SELECT * FROM received_emails",
      (error, results) => {
        if (error) {
          throw error;
        }
        let allEmails = results.rows;
        let userEmails = allEmails.filter(
          (email) => email.receiver.address === req.body.userAddress
        );
        res.status(200).json(userEmails);
      }
    );
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
});


// @desc        delete an email
// @route       DELETE /api/emails/id

emailsRouter.delete("/:userId", function (req, res, next) {
  try {
    pool.query(
      `DELETE FROM received_emails
      WHERE id = $1`,[req.params.userId],
      (error, results) => {
        if (error) {
          throw error;
        }
        res.status(200).json();
      }
    );
    // res.status(200).json();
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
});


// @desc        delete an email
// @route       GET /api/emails/:cid/:fileName

emailsRouter.get("/:cid/:fileName", function (req, res, next) {
  try {
    const cid = req.params.cid
    const fileName = req.params.fileName
    const filePath = `attachments/${cid}/${fileName}`; 
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error while downloading file:', err);
        res.status(500).send('Server Error');
      }
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
});

module.exports = emailsRouter;
