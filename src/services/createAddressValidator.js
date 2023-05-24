const { body } = require("express-validator");

function validateCreateAddressBody() {
  return [
    body("userId")
      .trim()
      .isLength({ min: 1 })
      .withMessage("userId must not be empty"),
  ];
}

module.exports = validateCreateAddressBody;
