const {
  decodeToken,
} = require("../../../../middlewares/missionControl/taskSubmission/auth");

module.exports = async (ctx, next) => {
  const { walletAddress } = ctx.params;

  const accessToken = ctx.request.header["x-lithium-token"];

  if (!accessToken) return ctx.throw(400, "No token provided");

  try {
    const { WalletAddress: addressFromToken } = decodeToken(accessToken);
    if (walletAddress.toLowerCase() !== addressFromToken.toLowerCase())
      return ctx.throw(400, "You do not have access to this resource");
    await next();
  } catch (err) {
    console.error(err);
    return ctx.throw(400, "error decoding token");
  }
};
