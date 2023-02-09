const jwt = require("jsonwebtoken");

const decodeToken = (token) => jwt.verify(token, process.env.TOKEN_KEY);

const isValidToken = (token, walletAddress) => {
  const decoded = jwt.verify(token, process.env.TOKEN_KEY);
  return decoded?.WalletAddress !== walletAddress;
};

module.exports = { isValidToken, decodeToken };
