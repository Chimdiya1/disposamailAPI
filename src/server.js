// import config from 'config';
// import express from 'express';
// import * as loader from './loaders';

const config = require("config");
const express = require("express");
const loader = require("./loaders");



const PORT = config.get('port');

async function startServer(){
  const app = express()
  await loader.init( app )

  app.listen(PORT, () => {
    console.log('server is running at port', PORT);
  });

}

startServer()
