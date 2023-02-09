module.exports = async (ctx, next) => {
  return await next();
  // if (ctx.state.user) {
  //   // Go to next policy or will reach the controller's action.
  // }

  // ctx.unauthorized(`You're not logged in!`);
};
