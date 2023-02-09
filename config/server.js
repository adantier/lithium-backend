module.exports = ({ env }) => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  admin: {
    auth: {
      secret: env("ADMIN_JWT_SECRET", "17078ea5b9354fa611d41bb4112830f9"),
    },
    watchIgnoreFiles: ["**/todo.txt"],
  },
  emitErrors: true,
});
