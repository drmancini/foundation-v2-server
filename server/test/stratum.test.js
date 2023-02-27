const Logger = require('../main/logger');
const Stratum = require('../main/stratum');
const Commands = require('../../database/main/master/commands');
const config = require('../../configs/pools/example');
const configMain = require('../../configs/main/example.js');
const events = require('events');

config.primary.address = 'ltc1qya20xua0rgq9jdteffkt83xr4aq082gruc2gry';
config.primary.recipients[0].address = 'LRJeNFbLC28wA4hYfiV2Dyjb6hK9pLTD5y';
config.primary.daemons = [{
  'host': '127.0.0.1',
  'port': '9332',
  'username': 'foundation',
  'password': 'foundation'
}];

function mockClient(configMain, result) {
  const client = new events.EventEmitter();
  client.master = {};
  client.master.commands = new Commands(null, null, configMain);
  client.master.commands.executor = (commands, callback) => callback(result);
  return client;
}

////////////////////////////////////////////////////////////////////////////////

describe('Test stratum functionality', () => {
  let configCopy, configMainCopy;
  beforeEach(() => {
    configCopy = JSON.parse(JSON.stringify(config));
    configMainCopy = JSON.parse(JSON.stringify(configMain));
  });

  test('Test initialization of stratum', () => {
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const stratum = new Stratum(logger, client, configCopy, configMainCopy);
    expect(typeof stratum.config).toBe('object');
    expect(typeof stratum.setupStratum).toBe('function');
    expect(typeof stratum.handleDifficultyCache).toBe('function');
    expect(typeof stratum.parseDifficultyCache).toBe('function');
  });
});
