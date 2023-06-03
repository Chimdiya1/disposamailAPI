const randomNameGen = require("../../utils/randomNameGen");

async function createAddress(res, pool) {
  let addressName = randomNameGen();
  let hostName = process.env.NODE_ENV === "production" ? process.env.DOMAIN : process.env.DOMAIN_DEV;
  let newEmailAddress = addressName + "@" + hostName;
  // Check if the value exists in the database
  const query = "SELECT COUNT(*) FROM valid_emails WHERE email = $1";
  const result = await pool.query(query, [newEmailAddress]);
  const count = parseInt(result.rows[0].count);

  if (count === 0) {
    return newEmailAddress;
  } else {
    return createAddress(res, pool);
  }
}
module.exports = createAddress;
