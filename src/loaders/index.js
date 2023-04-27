
const app = require("./app");

async function init(expressApp) {
  // await initDb()
  const { loadApp } = app;
  await loadApp(expressApp);
}

module.exports = { init };
