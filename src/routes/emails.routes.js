const express = require("express");
const pool = require("../db");
const pgListener = require("../pgListener");

const emailsRouter = express.Router();

// @desc        SSE stream for real-time email notifications
// @route       GET /api/emails/stream?address=user@disposamail.xyz

emailsRouter.get("/stream", function (req, res) {
  const address = req.query.address;
  if (!address) {
    return res.status(400).json({ error: "address query parameter is required" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  res.write(":ok\n\n");

  // Heartbeat to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(":heartbeat\n\n");
  }, 30000);

  // Listen for new emails matching this address
  const onNewEmail = (payload) => {
    if (payload.address === address) {
      pool.query(
        "SELECT * FROM received_emails WHERE id = $1",
        [payload.id],
        (err, result) => {
          if (!err && result.rows.length > 0) {
            res.write(`data: ${JSON.stringify(result.rows[0])}\n\n`);
          }
        }
      );
    }
  };

  pgListener.on("new_email", onNewEmail);

  req.on("close", () => {
    clearInterval(heartbeat);
    pgListener.removeListener("new_email", onNewEmail);
  });
});

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
        let userEmails = allEmails.filter((email) => {
          let receiver = typeof email.receiver === 'string' ? JSON.parse(email.receiver) : email.receiver;
          return receiver.address === req.body.userAddress;
        });
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

emailsRouter.get("/:email/:cid/:fileName", function (req, res, next) {
  try {
    const email = req.params.email
    const cid = req.params.cid
    const fileName = req.params.fileName
    const filePath = `attachments/${email}/${cid}/${fileName}`; 
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
