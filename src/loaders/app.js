const express = require("express");
const apiRouter = require("../routes/api.routes");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const path = require("path");
const dotenv = require("dotenv");
const cors = require('cors')
dotenv.config();

const loadApp = (app) => {
  app.use(morgan("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, "public")));
  app.use(cors())
  app.use(cors({
    origin: '*'
  }))
  app.use("/api", apiRouter);

  app.use("*", (req, res) =>
    res.status(404).send({
      status: "failed",
      message: "Endpoint not found",
      data: {},
    })
  );

  app.use((err, req, res, next) => {
    if (err.type && err.type == "entity.parse.failed") {
      return res.status(400).send({ status: "failed", message: err.message }); // Bad request
    }
    return res.status(err.status || 500).send({
      status: "failed",
      message: "Something unexpected happened",
    });
  });

  return app;
};

module.exports = { loadApp };
