const express = require("express");
const userRouter = require("./user.routes");
const addressesRouter = require("./addresses.routes");
const emailsRouter = require("./emails.routes");


const apiRouter = express.Router()
apiRouter.use('/users', userRouter)
apiRouter.use('/emails', emailsRouter)
apiRouter.use('/addresses', addressesRouter)


module.exports = apiRouter
