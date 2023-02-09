const parse = require('pg-connection-string').parse

const { IS_LOCAL, DATABASE_URL } = process.env

const config = parse(DATABASE_URL)

console.log('DB CONFIG', {
  settings: {
    client: 'postgres',
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.user,
    password: config.password,
    ssl: {
      rejectUnauthorized: false
    }
  }
})

module.exports = ({ env }) => ({
  defaultConnection: 'default',
  connections: {
    default: {
      connector: 'bookshelf',
      settings: {
        client: 'postgres',
        host: IS_LOCAL ? 'localhost' : config.host,
        port: IS_LOCAL ? 5432 : config.port,
        database: IS_LOCAL ? 'lithium_cms' : config.database,
        username: IS_LOCAL ? 'postgres' : config.user,
        password: IS_LOCAL ? '0000' : config.password,
        ssl: IS_LOCAL
          ? false
          : {
              rejectUnauthorized: false
            }
      },
      options: IS_LOCAL
        ? { autoMigration: true }
        : {
            ssl: true,
            autoMigration: true
          }
    }
  }
})
