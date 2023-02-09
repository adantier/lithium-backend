module.exports = {
  load: {
    before: ['responseTime', 'logger', 'cors', 'responses', 'gzip'],
    after: [
      'parser',
      'competitionWinners',
      'createPool',
      'createVestingContract',
      'createProjectReward',
      'saleLog',
      'validateWalletHolder',
      'whitelist',
      'missionControl',
      'router'
    ]
  },
  settings: {
    cors: {
      enabled: true,
      expose: ['x-lithium-token'],
      headers: ['x-lithium-token', 'content-type'],
      origin: [
        'http://localhost:1337',
        'http://192.168.1.178:3000',
        'http://localhost:3000',
        'https://staging-launchpad.lithium.ventures',
        'https://staging-admin.lithium.ventures',
        'https://admin.lithium.ventures',
        'https://www.qa-staging-mainnet.lithium.ventures',
        'https://lithium.ventures'
      ]
    },
    parser: {
      enabled: true,
      multipart: true,
      formLimit: '10mb',
      formidable: {
        maxFileSize: 200 * 1024 * 1024 // Defaults to 200mb
      }
    },
    competitionWinners: {
      enabled: true
    },
    createPool: {
      enabled: true
    },
    saleLog: {
      enabled: true
    },
    validateWalletHolder: {
      enabled: true
    },
    missionControl: {
      enabled: true
    },
    whitelist: {
      enabled: true
    },
    createVestingContract: { enabled: true },
    createProjectReward: { enabled: true }
  }
}
