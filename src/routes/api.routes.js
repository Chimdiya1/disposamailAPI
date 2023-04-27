const express = require("express");
const userRouter = require("./user.routes");
const addressesRouter = require("./addresses.routes");


const apiRouter = express.Router()

apiRouter.use('/users', userRouter)
apiRouter.use('/addresses', addressesRouter)


module.exports = apiRouter
