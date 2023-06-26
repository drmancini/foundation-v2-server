const CommandsMaster = require('../../database/main/master/commands');
const CommandsWorker = require('../../database/main/worker/commands');
const Logger = require('../main/logger');
const MockDate = require('mockdate');
const Rounds = require('../main/rounds');
const config = require('../../configs/pools/example.js');
const configMain = require('../../configs/main/example.js');
const events = require('events');

// Mock UUID Events
jest.mock('uuid', () => ({ v4: () => '123456789' }));

////////////////////////////////////////////////////////////////////////////////

function mockClient(configMain, result) {
  const client = new events.EventEmitter();
  client.master = { commands: new CommandsMaster(null, null, configMain) };
  client.worker = { commands: new CommandsWorker(null, null, configMain) };
  client.master.commands.executor = (commands, callback) => {
    client.emit('transaction', commands);
    callback(result);
  };
  client.worker.commands.executor = (commands, callback) => {
    client.emit('transaction', commands);
    callback(result);
  };
  return client;
}

////////////////////////////////////////////////////////////////////////////////

describe('Test rounds functionality', () => {

  let configCopy, configMainCopy;
  beforeEach(() => {
    configCopy = JSON.parse(JSON.stringify(config));
    configMainCopy = JSON.parse(JSON.stringify(configMain));
  });

  test('Test initialization of rounds', () => {
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    expect(typeof rounds.handleEffort).toBe('function');
    expect(typeof rounds.handleIpHash).toBe('function');
    expect(typeof rounds.handleLastOctet).toBe('function');
    expect(typeof rounds.handleTimes).toBe('function');
    expect(typeof rounds.handleTimesInitial).toBe('function');
  });

  test('Test rounds database updates [1]', () => {
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    expect(rounds.handleEffort({ clientdiff: 10 }, 100, 100, 'valid')).toBe(110);
    expect(rounds.handleEffort({ clientdiff: 10 }, 100, 100, 'invalid')).toBe(100);
    expect(rounds.handleEffort({}, 100, 100, 'valid')).toBe(100);
    expect(rounds.handleEffort({}, 100, 0, 'invalid')).toBe(0);
  });

  test('Test rounds database updates [2]', () => {
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    expect(rounds.handleIpHash({ ip: '0.0.0.0' })).toBe('e562f69ec36e625116376f376d991e41613e9bf3');
    expect(rounds.handleIpHash({ ip: '' })).toBe('unknown');
  });

  test('Test rounds database updates [3]', () => {
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    expect(rounds.handleLastOctet({ ip: ':::0.0.0.0' })).toBe(0);
    expect(rounds.handleLastOctet({ ip: '' })).toBe(-1);
  });

  test('Test rounds database updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    expect(rounds.handleTimes({ submitted: '1634742080841', times: 0 }, 1634742290841)).toBe(210);
    expect(rounds.handleTimes({ submitted: '1634742080841', times: 145 }, 1634743180841)).toBe(145);
    expect(rounds.handleTimes({ submitted: '1634742080841', times: 145 }, 1634742830841)).toBe(895);
    expect(rounds.handleTimes({ submitted: '1634742080841', times: 145 }, 1634742370841)).toBe(435);
    expect(rounds.handleTimes({ times: 145 }, 1634742530841)).toBe(595);
  });

  test('Test rounds database updates [5]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    expect(rounds.handleTimesInitial({ submitted: '1634742080841', times: 0 }, 1634742290841, 60000)).toBe(210);
    expect(rounds.handleTimesInitial({ times: 145 }, 1634743180841, 60000)).toBe(0);
  });

  test('Test rounds database updates [6]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const shares = [{ blocktype: 'share' }, { blocktype: 'share' }, { blocktype: 'share' }];
    const expected = [[{ blocktype: 'share' }, { blocktype: 'share' }, { blocktype: 'share' }]];
    expect(rounds.processSegments(shares)).toStrictEqual(expected);
  });

  test('Test rounds database updates [7]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const shares = [{ blocktype: 'primary' }, { blocktype: 'share' }, { blocktype: 'share' }];
    const expected = [[{ blocktype: 'primary' }], [{ blocktype: 'share' }, { blocktype: 'share' }]];
    expect(rounds.processSegments(shares)).toStrictEqual(expected);
  });

  test('Test rounds database updates [8]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const shares = [{ blocktype: 'share' }, { blocktype: 'primary' }, { blocktype: 'share' }];
    const expected = [[{ blocktype: 'share' }], [{ blocktype: 'primary' }], [{ blocktype: 'share' }]];
    expect(rounds.processSegments(shares)).toStrictEqual(expected);
  });

  test('Test rounds database updates [9]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const shares = [{ blocktype: 'share' }, { blocktype: 'share' }, { blocktype: 'primary' }];
    const expected = [[{ blocktype: 'share' }, { blocktype: 'share' }], [{ blocktype: 'primary' }]];
    expect(rounds.processSegments(shares)).toStrictEqual(expected);
  });

  test('Test rounds database updates [10]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const round = [{ miner: 'address1', solo: false }, { miner: 'address2', solo: false }];
    const expected = { 'address1_false': { miner: 'address1', solo: false }, 'address2_false': { miner: 'address2', solo: false }};
    expect(rounds.handleMinersLookups(round)).toStrictEqual(expected);
  });

  test('Test rounds database updates [11]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const users = [{ miner: 'address1' }, { miner: 'address2' }];
    const expected = [ 'address1', 'address2' ];
    expect(rounds.handleUsersLookups(users)).toStrictEqual(expected);
  });

  test('Test rounds database updates [12]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const round = [{ worker: 'address1', ip_hash: 'hash', solo: false }, { worker: 'address2', ip_hash: 'hash',solo: false }];
    const expected = { 'address1_hash_false': { worker: 'address1', ip_hash: 'hash', solo: false }, 'address2_hash_false': { worker: 'address2', ip_hash: 'hash', solo: false }};
    expect(rounds.handleWorkersLookups(round)).toStrictEqual(expected);
  });

  test('Test rounds database updates [13]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ work: 0 }];
    const round = { work: 0 };
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      submitted: 1,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: 'auxiliary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: true,
      blocktype: 'share',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: '',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1,
      miner: 'primary',
      worker: 'primary',
      category: 'pending',
      confirmations: -1,
      difficulty: 1,
      hash: 'hash1',
      height: 1,
      identifier: 'master',
      luck: 100,
      reward: 0,
      round: '123456789',
      solo: false,
      transaction: 'transaction1',
      type: 'primary',
    };
    expect(rounds.handleCurrentBlocks(metadata, round, share, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [14]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ work: 0 }];
    const round = { work: 0 };
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: null,
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: true,
      blocktype: 'share',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: '',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      miner: '',
      worker: null,
      category: 'pending',
      confirmations: -1,
      difficulty: 1,
      hash: 'hash1',
      height: 1,
      identifier: 'master',
      luck: 100,
      reward: 0,
      round: '123456789',
      solo: true,
      transaction: 'transaction1',
      type: 'auxiliary',
    };
    expect(rounds.handleCurrentBlocks(metadata, round, share, 'valid', true, 'auxiliary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [15]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { identifier: 'master' };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      blocks: 1,
      identifier: 'master',
      solo: false,
      type: 'primary',
    };
    expect(rounds.handleMetadataBlock(share, false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [16]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, addrprimary: 'primary', addrauxiliary: 'primary', identifier: '', ip: '1.1.1.1' };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      ip_hash: '409629a08b9b3f3be610b8832cc28822f964410f',
      share: 'valid',
      solo: false,
      type: 'primary',
      work: 1,
    };
    expect(rounds.handleCurrentHashrate(share, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [17]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, addrprimary: 'primary', addrauxiliary: null, identifier: '', ip: '1.1.1.1' };
    const expected = {
      timestamp: 1634742080841,
      miner: '',
      worker: null,
      identifier: 'master',
      ip_hash: '409629a08b9b3f3be610b8832cc28822f964410f',
      share: 'invalid',
      solo: false,
      type: 'auxiliary',
      work: 0,
    };
    expect(rounds.handleCurrentHashrate(share, 'invalid', false, 'auxiliary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [18]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ identifier: 'master', solo: false, work: 0 }];
    const updates = { effort: 100, work: 1 };
    const share = { clientdiff: 1, identifier: 'master', blockdiffprimary: 1, blockdiffauxiliary: 1 };
    const expected = {
      timestamp: 1634742080841,
      effort: 200,
      identifier: 'master',
      solo: false,
      type: 'primary',
      work: 2,
    };
    expect(rounds.handleCurrentMetadata(metadata, updates, share, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [19]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ identifier: 'master', solo: false, work: 1 }];
    const updates = { effort: 100, work: 1 };
    const share = { clientdiff: 1, identifier: 'master', blockdiffprimary: 1, blockdiffauxiliary: 1 };
    const expected = {
      timestamp: 1634742080841,
      effort: 200,
      identifier: 'master',
      solo: false,
      type: 'primary',
      work: 1,
    };
    expect(rounds.handleCurrentMetadata(metadata, updates, share, 'invalid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [20]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'primary' };
    const updates = {};
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      effort: 100,
      solo: true,
      type: 'primary',
    };
    expect(rounds.handleCurrentMiners(updates, share, 'valid', true, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [21]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'primary' };
    const updates = { effort: 100 };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      effort: 100,
      solo: true,
      type: 'primary',
    };
    expect(rounds.handleCurrentMiners(updates, share, 'invalid', true, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [22]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'primary' };
    const updates = { effort: 100 };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      effort: 200,
      solo: true,
      type: 'primary',
    };
    expect(rounds.handleCurrentMiners(updates, share, 'valid', true, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [23]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const initial = { work: 1 };
    const updates = { work: 1 };
    const share = {
      timestamp: 1634742080841,
      submitted: 1,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1,
      recent: 600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 0,
      ip_hash: 'hash',
      round: 'current',
      solo: false,
      stale: 0,
      times: 0,
      type: 'primary',
      valid: 1,
      work: 2,
    };
    expect(rounds.handleCurrentRounds(initial, updates, share, 'hash', 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [24]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const initial = { work: 1 };
    const updates = { work: 1 };
    const share = {
      timestamp: 1634742080841,
      submitted: 1,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1,
      recent: 600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 1,
      ip_hash: 'hash',
      round: 'current',
      solo: false,
      stale: 0,
      times: 0,
      type: 'primary',
      valid: 0,
      work: 1,
    };
    expect(rounds.handleCurrentRounds(initial, updates, share, 'hash', 'invalid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [25]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const initial = { work: 1 };
    const updates = { work: 1 };
    const share = {
      timestamp: 1634742080841,
      submitted: 1,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1,
      recent: 600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 0,
      ip_hash: 'hash',
      round: 'current',
      solo: false,
      stale: 1,
      times: 0,
      type: 'primary',
      valid: 0,
      work: 1,
    };
    expect(rounds.handleCurrentRounds(initial, updates, share, 'hash', 'stale', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [26]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      timestamp: 1634742080841,
      addrprimary: '',
      addrauxiliary: null,
      clientdiff: 1,
      identifier: '',
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      recent: 0,
      miner: '',
      worker: null,
      identifier: 'master',
      invalid: 0,
      ip_hash: 'hash',
      round: 'current',
      solo: true,
      stale: 0,
      times: 0,
      type: 'auxiliary',
      valid: 1,
      work: 1,
    };
    expect(rounds.handleCurrentRounds({}, {}, share, 'hash', 'valid', true, 'auxiliary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [27]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const updates = { work: 1 };
    const share = { clientdiff: 1, identifier: 'master', blockdiffprimary: 1, blockdiffauxiliary: 1 };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 2,
    };
    expect(rounds.handleHistoricalMetadata(updates, share, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [28]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const updates = { work: 1 };
    const share = { clientdiff: 1, identifier: 'master', blockdiffprimary: 1, blockdiffauxiliary: 1 };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 1,
      type: 'primary',
      valid: 0,
      work: 1,
    };
    expect(rounds.handleHistoricalMetadata(updates, share, 'stale', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [29]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const updates = { invalid: 1, valid: 1, stale: 1, work: 1 };
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'primary', ip: '0.0.0.0' };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      invalid: 1,
      solo: false,
      stale: 1,
      type: 'primary',
      valid: 2,
      work: 2,
    };
    expect(rounds.handleHistoricalMiners(updates, share, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [29]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const updates = { invalid: 1, valid: 1, stale: 1, work: 1 };
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'primary', ip: '0.0.0.0' };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      invalid: 1,
      solo: false,
      stale: 2,
      type: 'primary',
      valid: 1,
      work: 1,
    };
    expect(rounds.handleHistoricalMiners(updates, share, 'stale', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [29]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const updates = { invalid: 1, valid: 1, stale: 1, work: 1 };
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'primary', ip: '0.0.0.0' };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      invalid: 2,
      solo: false,
      stale: 1,
      type: 'primary',
      valid: 1,
      work: 1,
    };
    expect(rounds.handleHistoricalMiners(updates, share, 'invalid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [29]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const updates = { invalid: 1, valid: 1, stale: 1, work: 1 };
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'primary', ip: '0.0.0.0' };
    const ipHash = 'e562f69ec36e625116376f376d991e41613e9bf3';
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 1,
      ip_hash: 'e562f69ec36e625116376f376d991e41613e9bf3',
      solo: false,
      stale: 1,
      type: 'primary',
      valid: 2,
      work: 2,
    };
    expect(rounds.handleHistoricalWorkers(updates, share, ipHash, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds database updates [30]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const updates = { invalid: 1, valid: 1, stale: 1, work: 1 };
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'primary', identifier: 'master', ip: '0.0.0.0' };
    const ipHash = 'e562f69ec36e625116376f376d991e41613e9bf3';
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 1,
      ip_hash: 'e562f69ec36e625116376f376d991e41613e9bf3',
      solo: false,
      stale: 2,
      type: 'primary',
      valid: 1,
      work: 1,
    };
    expect(rounds.handleHistoricalWorkers(updates, share, ipHash, 'stale', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds hashrate updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      timestamp: 1634742080841,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
      ip: '0.0.0.0',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      ip_hash: 'e562f69ec36e625116376f376d991e41613e9bf3',
      share: 'valid',
      solo: false,
      type: 'primary',
      work: 1,
    };
    expect(rounds.handleHashrate([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds hashrate updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      timestamp: 1634742080841,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
      ip: '',
      sharevalid: false,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      ip_hash: 'unknown',
      share: 'invalid',
      solo: false,
      type: 'primary',
      work: 0,
    };
    expect(rounds.handleHashrate([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds hashrate updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: 'error1',
      timestamp: 1634742080841,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
      ip: '',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      ip_hash: 'unknown',
      share: 'invalid',
      solo: false,
      type: 'primary',
      work: 0,
    };
    expect(rounds.handleHashrate([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds hashrate updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: 'job not found',
      timestamp: 1634742080841,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
      ip: '',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      ip_hash: 'unknown',
      share: 'stale',
      solo: false,
      type: 'primary',
      work: 0,
    };
    expect(rounds.handleHashrate([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds shares history updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const counts = {
      shares: 1,
      transactions: 1,
    };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      identifier: '',
      share_count: 1,
      transaction_count: 1,
    };
    expect(rounds.handleHistoryShares(counts)).toStrictEqual(expected);
  });

  test('Test rounds metadata updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ identifier: 'master', solo: false, work: 0 }];
    const share = {
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      identifier: 'master',
      sharevalid: true,
    };
    const expected = [{
      timestamp: 1634742080841,
      effort: 100,
      identifier: 'master',
      solo: false,
      type: 'primary',
      work: 1,
    }];
    expect(rounds.handleMetadata(metadata, [share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds metadata updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ identifier: 'master', solo: false, work: 0 }];
    const share = {
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      identifier: 'master',
      sharevalid: false,
    };
    const expected = [{
      timestamp: 1634742080841,
      effort: 0,
      identifier: 'master',
      solo: false,
      type: 'primary',
      work: 0,
    }];
    expect(rounds.handleMetadata(metadata, [share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds metadata updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ identifier: 'master', solo: false, work: 1 }];
    const share = {
      error: 'error1',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      identifier: 'master',
      sharevalid: true,
    };
    const expected = [{
      timestamp: 1634742080841,
      effort: 100,
      identifier: 'master',
      solo: false,
      type: 'primary',
      work: 0,
    }];
    expect(rounds.handleMetadata(metadata, [share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds metadata updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ identifier: 'master', solo: false, work: 1 }];
    const share = {
      error: 'job not found',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      identifier: 'master',
      sharevalid: true,
    };
    const expected = [{
      timestamp: 1634742080841,
      effort: 100,
      identifier: 'master',
      solo: false,
      type: 'primary',
      work: 0,
    }];
    expect(rounds.handleMetadata(metadata, [share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds metadata history updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      identifier: 'master',
      sharevalid: true,
    };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634742600000,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 1,
    }];
    expect(rounds.handleMetadataHistory([share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds metadata history updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      identifier: 'master',
      sharevalid: false,
    };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634742600000,
      identifier: 'master',
      invalid: 1,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    }];
    expect(rounds.handleMetadataHistory([share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds metadata history updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: 'error1',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      identifier: 'master',
      sharevalid: true,
    };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634742600000,
      identifier: 'master',
      invalid: 1,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    }];
    expect(rounds.handleMetadataHistory([share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds metadata history updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: 'job not found',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      identifier: 'master',
      sharevalid: true,
    };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634742600000,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 1,
      type: 'primary',
      valid: 0,
      work: 0,
    }];
    expect(rounds.handleMetadataHistory([share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds miners updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      sharevalid: true,
    };
    expect(rounds.handleMiners([share], 'primary')).toStrictEqual([]);
  });

  test('Test rounds miners updates [2]', () => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      port: 3002,
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      sharevalid: false,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: '',
      effort: 0,
      solo: true,
      type: 'primary',
    };
    expect(rounds.handleMiners([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds miners updates [3]', () => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: 'job not found',
      port: 3002,
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      sharevalid: false,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: '',
      effort: 0,
      solo: true,
      type: 'primary',
    };
    expect(rounds.handleMiners([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds miners updates [4]', () => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: 'error1',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      effort: 0,
      solo: true,
      type: 'primary',
    };
    expect(rounds.handleMiners([share, share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds miners history updates [1]', () => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      invalid: 0,
      solo: true,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 1,
    };
    expect(rounds.handleMinersHistory([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds miners history updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      port: 3002,
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      sharevalid: false,
    };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: '',
      invalid: 1,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    };
    expect(rounds.handleMinersHistory([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds miners history updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: 'error1',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      invalid: 2,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    };
    expect(rounds.handleMinersHistory([share, share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds miners history updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: 'job not found',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      invalid: 0,
      solo: false,
      stale: 2,
      type: 'primary',
      valid: 0,
      work: 0,
    };
    expect(rounds.handleMinersHistory([share, share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds shares updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const round = { 'primary': { work: 1 }};
    const share = {
      error: 'job not found',
      timestamp: 1634742080841,
      submitted: 1,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
      ip: '0.0.0.0',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1,
      recent: 600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 0,
      ip_hash: 'e562f69ec36e625116376f376d991e41613e9bf3',
      round: 'current',
      solo: false,
      stale: 1,
      times: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    };
    expect(rounds.handleShares(round, [share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds shares updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const round = { 'primary': { work: 1 }};
    const share = {
      timestamp: 1634742080841,
      submitted: 1,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
      ip: '0.0.0.0',
      sharevalid: false,
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1,
      recent: 600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 1,
      ip_hash: 'e562f69ec36e625116376f376d991e41613e9bf3',
      round: 'current',
      solo: false,
      stale: 0,
      times: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    };
    expect(rounds.handleShares(round, [share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds shares updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const round = { 'primary': { work: 1 }};
    const share = {
      error: 'error1',
      timestamp: 1634742080841,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
      ip: '0.0.0.0',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 1,
      ip_hash: 'e562f69ec36e625116376f376d991e41613e9bf3',
      round: 'current',
      solo: false,
      stale: 0,
      times: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    };
    expect(rounds.handleShares(round, [share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds shares updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const round = { 'primary': { work: 1 }};
    const share = {
      error: 'job not found',
      timestamp: 1634742080841,
      submitted: 1,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
      ip: '0.0.0.0',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1,
      recent: 600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 0,
      ip_hash: 'e562f69ec36e625116376f376d991e41613e9bf3',
      round: 'current',
      solo: false,
      stale: 1,
      times: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    };
    expect(rounds.handleShares(round, [share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds shares updates [5]', () => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const round = { 'primary': { work: 1 }};
    const share = {
      port: 3002,
      timestamp: 1634742080841,
      submitted: 1,
      addrprimary: '',
      addrauxiliary: null,
      clientdiff: 1,
      identifier: '',
      ip: '0.0.0.0',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1,
      recent: 0,
      miner: '',
      worker: null,
      identifier: 'master',
      invalid: 0,
      ip_hash: 'e562f69ec36e625116376f376d991e41613e9bf3',
      round: 'current',
      solo: true,
      stale: 0,
      times: 0,
      type: 'auxiliary',
      valid: 1,
      work: 1,
    };
    expect(rounds.handleShares(round, [share], 'auxiliary')).toStrictEqual([expected]);
  });

  test('Test rounds users updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const users = [];
    const share = {
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      joined: 1634742080841,
      payout_limit: 0.01,
      type: 'primary',
    };
    expect(rounds.handleUsers(users, [share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds users updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const users = [];
    const share = {
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: '',
      joined: 1634742080841,
      payout_limit: 0.01,
      type: 'primary',
    };
    expect(rounds.handleUsers(users, [share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds users updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const users = [ 'primary' ];
    const share = {
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      sharevalid: true,
    };
    expect(rounds.handleUsers(users, [share], 'primary')).toStrictEqual([]);
  });

  test('Test rounds workers updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      identifier: 'master',
      ip: '0.0.0.0',
      submitted: 1,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      ip_hash: 'e562f69ec36e625116376f376d991e41613e9bf3',
      last_octet: 0,
      last_share: 1,
      offline_tag: false,
      solo: false,
      type: 'primary',
    };
    expect(rounds.handleWorkers([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds workers updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      identifier: 'master',
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      ip_hash: 'unknown',
      last_octet: -1,
      last_share: 1634742080841,
      offline_tag: false,
      solo: false,
      type: 'auxiliary',
    };
    expect(rounds.handleWorkers([share], 'auxiliary')).toStrictEqual([expected]);
  });

  test('Test rounds workers updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    expect(rounds.handleWorkers([], 'primary')).toStrictEqual([]);
  });

  test('Test rounds historical workers updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      identifier: 'master',
      ip: '0.0.0.0',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 0,
      ip_hash: 'e562f69ec36e625116376f376d991e41613e9bf3',
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 1,
    };
    expect(rounds.handleWorkersHistory([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds historical workers updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: 'error1',
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      identifier: 'master',
      ip: '0.0.0.0',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 1,
      ip_hash: 'e562f69ec36e625116376f376d991e41613e9bf3',
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    };
    expect(rounds.handleWorkersHistory([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds historical workers updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: 'job not found',
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      identifier: 'master',
      ip: '0.0.0.0',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 0,
      ip_hash: 'e562f69ec36e625116376f376d991e41613e9bf3',
      solo: false,
      stale: 1,
      type: 'primary',
      valid: 0,
      work: 0,
    };
    expect(rounds.handleWorkersHistory([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds historical workers updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: 'job not found',
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      identifier: 'master',
      ip: '0.0.0.0',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 0,
      ip_hash: 'e562f69ec36e625116376f376d991e41613e9bf3',
      solo: false,
      stale: 1,
      type: 'auxiliary',
      valid: 0,
      work: 0,
    };
    expect(rounds.handleWorkersHistory([share], 'auxiliary')).toStrictEqual([expected]);
  });

  test('Test rounds cleanup updates [1]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const segment = [{ uuid: 'uuid1' }, { uuid: 'uuid2' }, { uuid: 'uuid3' }];
    const expectedShares = `
      DELETE FROM "Pool-Bitcoin".local_shares
      WHERE uuid IN ('uuid1', 'uuid2', 'uuid3');`;
    const expectedTransactions = `
      DELETE FROM "Pool-Bitcoin".local_transactions
      WHERE uuid IN ('uuid1', 'uuid2', 'uuid3');`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(4);
      expect(transaction[1]).toBe(expectedShares);
      expect(transaction[2]).toBe(expectedTransactions);
      done();
    });
    rounds.handleCleanup(segment, () => {});
  });

  test('Test rounds main updates [1]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const lookups = [
      null,
      { rows: [{ identifier: 'master', solo: false, work: 1 }]},
      { rows: [{ identifier: 'master', solo: false, work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: []},
      { rows: []},
      null,
    ];
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      submitted: 1,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: null,
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: true,
      blocktype: 'share',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: '',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    const expectedHashrate = `
      INSERT INTO "Pool-Bitcoin".current_hashrate (
        timestamp, miner, worker,
        identifier, ip_hash, share,
        solo, type, work)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        'master',
        'e562f69ec36e625116376f376d991e41613e9bf3',
        'valid',
        false,
        'primary',
        1);`;
    const expectedMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, effort, identifier,
        solo, type, work)
      VALUES (
        1634742080841,
        200,
        'master',
        false,
        'primary',
        1)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        effort = EXCLUDED.effort,
        work = "Pool-Bitcoin".current_metadata.work + EXCLUDED.work;`;
    const expectedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES (
        1634742080841,
        600000,
        'master',
        0,
        false,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".historical_metadata.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_metadata.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_metadata.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_metadata.work + EXCLUDED.work;`;
    const expectedHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale,
        type, valid, work)
      VALUES (
        1634742080841,
        600000,
        'primary',
        0,
        false,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".historical_miners.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_miners.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_miners.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_miners.work + EXCLUDED.work;`;
    const expectedRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, submitted, recent,
        miner, worker, identifier, invalid,
        ip_hash, round, solo, stale, times,
        type, valid, work)
      VALUES (
        1634742080841,
        1,
        600000,
        'primary',
        'primary',
        'master',
        0,
        'e562f69ec36e625116376f376d991e41613e9bf3',
        'current',
        false,
        0,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT current_rounds_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        submitted = EXCLUDED.submitted,
        invalid = "Pool-Bitcoin".current_rounds.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".current_rounds.stale + EXCLUDED.stale,
        times = GREATEST("Pool-Bitcoin".current_rounds.times, EXCLUDED.times),
        valid = "Pool-Bitcoin".current_rounds.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".current_rounds.work + EXCLUDED.work;`;
    const expectedUsers = `
      INSERT INTO "Pool-Bitcoin".current_users (
        timestamp, miner, joined,
        payout_limit, type)
      VALUES (
        1634742080841,
        'primary',
        1,
        0.01,
        'primary')
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`;
    const expectedWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        identifier, ip_hash,
        last_octet, last_share,
        offline_tag, solo, type)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        'master',
        'e562f69ec36e625116376f376d991e41613e9bf3',
        0,
        1,
        false,
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        identifier = EXCLUDED.identifier,
        last_share = EXCLUDED.last_share,
        offline_tag = EXCLUDED.offline_tag;`;
    const expectedHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        ip_hash, solo, stale, type,
        valid, work)
      VALUES (
        1634742080841,
        600000,
        'primary',
        'primary',
        'master',
        0,
        'e562f69ec36e625116376f376d991e41613e9bf3',
        false,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        identifier = EXCLUDED.identifier,
        invalid = "Pool-Bitcoin".historical_workers.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_workers.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_workers.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_workers.work + EXCLUDED.work;`;
    const expectedHistory = `
      INSERT INTO "Pool-Bitcoin".local_history (
        timestamp, recent,
        share_writes)
      VALUES (1634742080841, 1634742600000, 1)
      ON CONFLICT ON CONSTRAINT local_history_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        share_writes = "Pool-Bitcoin".local_history.share_writes + EXCLUDED.share_writes;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(11);
      expect(transaction[1]).toBe(expectedHashrate);
      expect(transaction[2]).toBe(expectedMetadata);
      expect(transaction[3]).toBe(expectedHistoricalMetadata);
      expect(transaction[4]).toBe(expectedHistoricalMiners);
      expect(transaction[5]).toBe(expectedRounds);
      expect(transaction[6]).toBe(expectedUsers);
      expect(transaction[7]).toBe(expectedWorkers);
      expect(transaction[8]).toBe(expectedHistoricalWorkers);
      expect(transaction[9]).toBe(expectedHistory);
      done();
    });
    rounds.handleUpdates(lookups, [share], () => {});
  });

  test('Test rounds main updates [2]', (done) => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const lookups = [
      null,
      { rows: [{ identifier: 'master', solo: true, work: 1 }]},
      { rows: [{ identifier: 'master', solo: true, work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: []},
      { rows: []},
      null,
    ];
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      submitted: 1,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: null,
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: true,
      blocktype: 'share',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: '',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    const expectedHashrate = `
      INSERT INTO "Pool-Bitcoin".current_hashrate (
        timestamp, miner, worker,
        identifier, ip_hash, share,
        solo, type, work)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        'master',
        'e562f69ec36e625116376f376d991e41613e9bf3',
        'valid',
        true,
        'primary',
        1);`;
    const expectedMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, effort, identifier,
        solo, type, work)
      VALUES (
        1634742080841,
        0,
        'master',
        true,
        'primary',
        0)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        effort = EXCLUDED.effort,
        work = "Pool-Bitcoin".current_metadata.work + EXCLUDED.work;`;
    const expectedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES (
        1634742080841,
        600000,
        'master',
        0,
        true,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".historical_metadata.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_metadata.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_metadata.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_metadata.work + EXCLUDED.work;`;
    const expectedMiners = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, effort,
        solo, type)
      VALUES (
        1634742080841,
        'primary',
        100,
        true,
        'primary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        effort = "Pool-Bitcoin".current_miners.effort + EXCLUDED.effort;`;
    const expectedHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale,
        type, valid, work)
      VALUES (
        1634742080841,
        600000,
        'primary',
        0,
        true,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".historical_miners.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_miners.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_miners.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_miners.work + EXCLUDED.work;`;
    const expectedRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, submitted, recent,
        miner, worker, identifier, invalid,
        ip_hash, round, solo, stale, times,
        type, valid, work)
      VALUES (
        1634742080841,
        1,
        0,
        'primary',
        'primary',
        'master',
        0,
        'e562f69ec36e625116376f376d991e41613e9bf3',
        'current',
        true,
        0,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT current_rounds_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        submitted = EXCLUDED.submitted,
        invalid = "Pool-Bitcoin".current_rounds.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".current_rounds.stale + EXCLUDED.stale,
        times = GREATEST("Pool-Bitcoin".current_rounds.times, EXCLUDED.times),
        valid = "Pool-Bitcoin".current_rounds.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".current_rounds.work + EXCLUDED.work;`;
      const expectedUsers = `
      INSERT INTO "Pool-Bitcoin".current_users (
        timestamp, miner, joined,
        payout_limit, type)
      VALUES (
        1634742080841,
        'primary',
        1,
        0.01,
        'primary')
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`;
      const expectedWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        identifier, ip_hash,
        last_octet, last_share,
        offline_tag, solo, type)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        'master',
        'e562f69ec36e625116376f376d991e41613e9bf3',
        0,
        1,
        false,
        true,
        'primary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        identifier = EXCLUDED.identifier,
        last_share = EXCLUDED.last_share,
        offline_tag = EXCLUDED.offline_tag;`;
    const expectedHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        ip_hash, solo, stale, type,
        valid, work)
      VALUES (
        1634742080841,
        600000,
        'primary',
        'primary',
        'master',
        0,
        'e562f69ec36e625116376f376d991e41613e9bf3',
        true,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        identifier = EXCLUDED.identifier,
        invalid = "Pool-Bitcoin".historical_workers.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_workers.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_workers.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_workers.work + EXCLUDED.work;`;
    const expectedHistory = `
      INSERT INTO "Pool-Bitcoin".local_history (
        timestamp, recent,
        share_writes)
      VALUES (1634742080841, 1634742600000, 1)
      ON CONFLICT ON CONSTRAINT local_history_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        share_writes = "Pool-Bitcoin".local_history.share_writes + EXCLUDED.share_writes;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(12);
      expect(transaction[1]).toBe(expectedHashrate);
      expect(transaction[2]).toBe(expectedMetadata);
      expect(transaction[3]).toBe(expectedHistoricalMetadata);
      expect(transaction[4]).toBe(expectedMiners);
      expect(transaction[5]).toBe(expectedHistoricalMiners);
      expect(transaction[6]).toBe(expectedRounds);
      expect(transaction[7]).toBe(expectedUsers);
      expect(transaction[8]).toBe(expectedWorkers);
      expect(transaction[9]).toBe(expectedHistoricalWorkers);
      expect(transaction[10]).toBe(expectedHistory);
      done();
    });
    rounds.handleUpdates(lookups, [share], () => {});
  });

  test('Test rounds main updates [3]', (done) => {
    MockDate.set(1634742080841);
    configCopy.auxiliary = { enabled: true, payments: { defaultPayment: 0.01 } };
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const lookups = [
      null,
      { rows: [{ identifier: 'master', solo: false, work: 1 }]},
      { rows: [{ identifier: 'master', solo: false, work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: []},
      { rows: []},
      null,
    ];
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      submitted: 1,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: null,
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: true,
      blocktype: 'share',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: '',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    const expectedHashrate = `
      INSERT INTO "Pool-Bitcoin".current_hashrate (
        timestamp, miner, worker,
        identifier, ip_hash, share,
        solo, type, work)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        'master',
        'e562f69ec36e625116376f376d991e41613e9bf3',
        'valid',
        false,
        'primary',
        1);`;
    const expectedAuxHashrate = `
      INSERT INTO "Pool-Bitcoin".current_hashrate (
        timestamp, miner, worker,
        identifier, ip_hash, share,
        solo, type, work)
      VALUES (
        1634742080841,
        '',
        'null',
        'master',
        'e562f69ec36e625116376f376d991e41613e9bf3',
        'valid',
        false,
        'auxiliary',
        1);`;
    const expectedMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, effort, identifier,
        solo, type, work)
      VALUES (
        1634742080841,
        200,
        'master',
        false,
        'primary',
        1)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        effort = EXCLUDED.effort,
        work = "Pool-Bitcoin".current_metadata.work + EXCLUDED.work;`;
    const expectedAuxMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, effort, identifier,
        solo, type, work)
      VALUES (
        1634742080841,
        200,
        'master',
        false,
        'auxiliary',
        1)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        effort = EXCLUDED.effort,
        work = "Pool-Bitcoin".current_metadata.work + EXCLUDED.work;`;
    const expectedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES (
        1634742080841,
        600000,
        'master',
        0,
        false,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".historical_metadata.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_metadata.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_metadata.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_metadata.work + EXCLUDED.work;`;
    const expectedAuxHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES (
        1634742080841,
        600000,
        'master',
        0,
        false,
        0,
        'auxiliary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".historical_metadata.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_metadata.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_metadata.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_metadata.work + EXCLUDED.work;`;
    const expectedHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale,
        type, valid, work)
      VALUES (
        1634742080841,
        600000,
        'primary',
        0,
        false,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".historical_miners.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_miners.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_miners.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_miners.work + EXCLUDED.work;`;
    const expectedAuxHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale,
        type, valid, work)
      VALUES (
        1634742080841,
        600000,
        '',
        0,
        false,
        0,
        'auxiliary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".historical_miners.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_miners.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_miners.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_miners.work + EXCLUDED.work;`;
    const expectedRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, submitted, recent,
        miner, worker, identifier, invalid,
        ip_hash, round, solo, stale, times,
        type, valid, work)
      VALUES (
        1634742080841,
        1,
        600000,
        'primary',
        'primary',
        'master',
        0,
        'e562f69ec36e625116376f376d991e41613e9bf3',
        'current',
        false,
        0,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT current_rounds_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        submitted = EXCLUDED.submitted,
        invalid = "Pool-Bitcoin".current_rounds.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".current_rounds.stale + EXCLUDED.stale,
        times = GREATEST("Pool-Bitcoin".current_rounds.times, EXCLUDED.times),
        valid = "Pool-Bitcoin".current_rounds.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".current_rounds.work + EXCLUDED.work;`;
    const expectedAuxRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, submitted, recent,
        miner, worker, identifier, invalid,
        ip_hash, round, solo, stale, times,
        type, valid, work)
      VALUES (
        1634742080841,
        1,
        600000,
        '',
        'null',
        'master',
        0,
        'e562f69ec36e625116376f376d991e41613e9bf3',
        'current',
        false,
        0,
        0,
        'auxiliary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT current_rounds_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        submitted = EXCLUDED.submitted,
        invalid = "Pool-Bitcoin".current_rounds.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".current_rounds.stale + EXCLUDED.stale,
        times = GREATEST("Pool-Bitcoin".current_rounds.times, EXCLUDED.times),
        valid = "Pool-Bitcoin".current_rounds.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".current_rounds.work + EXCLUDED.work;`;
    const expectedUsers = `
      INSERT INTO "Pool-Bitcoin".current_users (
        timestamp, miner, joined,
        payout_limit, type)
      VALUES (
        1634742080841,
        'primary',
        1,
        0.01,
        'primary')
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`;
    const expectedAuxUsers = `
      INSERT INTO "Pool-Bitcoin".current_users (
        timestamp, miner, joined,
        payout_limit, type)
      VALUES (
        1634742080841,
        '',
        1,
        0.01,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`;
    const expectedWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        identifier, ip_hash,
        last_octet, last_share,
        offline_tag, solo, type)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        'master',
        'e562f69ec36e625116376f376d991e41613e9bf3',
        0,
        1,
        false,
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        identifier = EXCLUDED.identifier,
        last_share = EXCLUDED.last_share,
        offline_tag = EXCLUDED.offline_tag;`;
    const expectedAuxWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        identifier, ip_hash,
        last_octet, last_share,
        offline_tag, solo, type)
      VALUES (
        1634742080841,
        '',
        'null',
        'master',
        'e562f69ec36e625116376f376d991e41613e9bf3',
        0,
        1,
        false,
        false,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        identifier = EXCLUDED.identifier,
        last_share = EXCLUDED.last_share,
        offline_tag = EXCLUDED.offline_tag;`;
    const expectedHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        ip_hash, solo, stale, type,
        valid, work)
      VALUES (
        1634742080841,
        600000,
        'primary',
        'primary',
        'master',
        0,
        'e562f69ec36e625116376f376d991e41613e9bf3',
        false,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        identifier = EXCLUDED.identifier,
        invalid = "Pool-Bitcoin".historical_workers.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_workers.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_workers.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_workers.work + EXCLUDED.work;`;
    const expectedAuxHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        ip_hash, solo, stale, type,
        valid, work)
      VALUES (
        1634742080841,
        600000,
        '',
        'null',
        'master',
        0,
        'e562f69ec36e625116376f376d991e41613e9bf3',
        false,
        0,
        'auxiliary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        identifier = EXCLUDED.identifier,
        invalid = "Pool-Bitcoin".historical_workers.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_workers.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_workers.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_workers.work + EXCLUDED.work;`;
    const expectedHistory = `
      INSERT INTO "Pool-Bitcoin".local_history (
        timestamp, recent,
        share_writes)
      VALUES (1634742080841, 1634742600000, 1)
      ON CONFLICT ON CONSTRAINT local_history_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        share_writes = "Pool-Bitcoin".local_history.share_writes + EXCLUDED.share_writes;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(19);
      expect(transaction[1]).toBe(expectedHashrate);
      expect(transaction[2]).toBe(expectedAuxHashrate);
      expect(transaction[3]).toBe(expectedMetadata);
      expect(transaction[4]).toBe(expectedAuxMetadata);
      expect(transaction[5]).toBe(expectedHistoricalMetadata);
      expect(transaction[6]).toBe(expectedAuxHistoricalMetadata);
      expect(transaction[7]).toBe(expectedHistoricalMiners);
      expect(transaction[8]).toBe(expectedAuxHistoricalMiners);
      expect(transaction[9]).toBe(expectedRounds);
      expect(transaction[10]).toBe(expectedAuxRounds);
      expect(transaction[11]).toBe(expectedUsers);
      expect(transaction[12]).toBe(expectedAuxUsers);
      expect(transaction[13]).toBe(expectedWorkers);
      expect(transaction[14]).toBe(expectedAuxWorkers);
      expect(transaction[15]).toBe(expectedHistoricalWorkers);
      expect(transaction[16]).toBe(expectedAuxHistoricalWorkers);
      expect(transaction[17]).toBe(expectedHistory);
      done();
    });
    rounds.handleUpdates(lookups, [share], () => {});
  });
  
  test('Test rounds main updates [4]', (done) => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    configCopy.auxiliary = { enabled: true, payments: { defaultPayment: 0.01 } };
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const lookups = [
      null,
      { rows: [{ work: 1 }]},
      { rows: [{ work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: []},
      { rows: []},
      null,
    ];
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      submitted: 1,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: null,
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: true,
      blocktype: 'share',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: '',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    const expectedHashrate = `
      INSERT INTO "Pool-Bitcoin".current_hashrate (
        timestamp, miner, worker,
        identifier, ip_hash, share,
        solo, type, work)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        'master',
        'e562f69ec36e625116376f376d991e41613e9bf3',
        'valid',
        true,
        'primary',
        1);`;
    const expectedAuxHashrate = `
      INSERT INTO "Pool-Bitcoin".current_hashrate (
        timestamp, miner, worker,
        identifier, ip_hash, share,
        solo, type, work)
      VALUES (
        1634742080841,
        '',
        'null',
        'master',
        'e562f69ec36e625116376f376d991e41613e9bf3',
        'valid',
        true,
        'auxiliary',
        1);`;
    const expectedMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, effort, identifier,
        solo, type, work)
      VALUES (
        1634742080841,
        0,
        'master',
        true,
        'primary',
        0)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        effort = EXCLUDED.effort,
        work = "Pool-Bitcoin".current_metadata.work + EXCLUDED.work;`;
    const expectedAuxMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, effort, identifier,
        solo, type, work)
      VALUES (
        1634742080841,
        0,
        'master',
        true,
        'auxiliary',
        0)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        effort = EXCLUDED.effort,
        work = "Pool-Bitcoin".current_metadata.work + EXCLUDED.work;`;
    const expectedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES (
        1634742080841,
        600000,
        'master',
        0,
        true,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".historical_metadata.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_metadata.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_metadata.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_metadata.work + EXCLUDED.work;`;
    const expectedAuxHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES (
        1634742080841,
        600000,
        'master',
        0,
        true,
        0,
        'auxiliary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".historical_metadata.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_metadata.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_metadata.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_metadata.work + EXCLUDED.work;`;
    const expectedMiners = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, effort,
        solo, type)
      VALUES (
        1634742080841,
        'primary',
        100,
        true,
        'primary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        effort = "Pool-Bitcoin".current_miners.effort + EXCLUDED.effort;`;
    const expectedAuxMiners = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, effort,
        solo, type)
      VALUES (
        1634742080841,
        '',
        100,
        true,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        effort = "Pool-Bitcoin".current_miners.effort + EXCLUDED.effort;`;
    const expectedHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale,
        type, valid, work)
      VALUES (
        1634742080841,
        600000,
        'primary',
        0,
        true,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".historical_miners.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_miners.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_miners.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_miners.work + EXCLUDED.work;`;
    const expectedAuxHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale,
        type, valid, work)
      VALUES (
        1634742080841,
        600000,
        '',
        0,
        true,
        0,
        'auxiliary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".historical_miners.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_miners.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_miners.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_miners.work + EXCLUDED.work;`;
    const expectedRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, submitted, recent,
        miner, worker, identifier, invalid,
        ip_hash, round, solo, stale, times,
        type, valid, work)
      VALUES (
        1634742080841,
        1,
        0,
        'primary',
        'primary',
        'master',
        0,
        'e562f69ec36e625116376f376d991e41613e9bf3',
        'current',
        true,
        0,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT current_rounds_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        submitted = EXCLUDED.submitted,
        invalid = "Pool-Bitcoin".current_rounds.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".current_rounds.stale + EXCLUDED.stale,
        times = GREATEST("Pool-Bitcoin".current_rounds.times, EXCLUDED.times),
        valid = "Pool-Bitcoin".current_rounds.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".current_rounds.work + EXCLUDED.work;`;
    const expectedAuxRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, submitted, recent,
        miner, worker, identifier, invalid,
        ip_hash, round, solo, stale, times,
        type, valid, work)
      VALUES (
        1634742080841,
        1,
        0,
        '',
        'null',
        'master',
        0,
        'e562f69ec36e625116376f376d991e41613e9bf3',
        'current',
        true,
        0,
        0,
        'auxiliary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT current_rounds_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        submitted = EXCLUDED.submitted,
        invalid = "Pool-Bitcoin".current_rounds.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".current_rounds.stale + EXCLUDED.stale,
        times = GREATEST("Pool-Bitcoin".current_rounds.times, EXCLUDED.times),
        valid = "Pool-Bitcoin".current_rounds.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".current_rounds.work + EXCLUDED.work;`;
    const expectedUsers = `
      INSERT INTO "Pool-Bitcoin".current_users (
        timestamp, miner, joined,
        payout_limit, type)
      VALUES (
        1634742080841,
        'primary',
        1,
        0.01,
        'primary')
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`;
    const expectedAuxUsers = `
      INSERT INTO "Pool-Bitcoin".current_users (
        timestamp, miner, joined,
        payout_limit, type)
      VALUES (
        1634742080841,
        '',
        1,
        0.01,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`;
    const expectedWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        identifier, ip_hash,
        last_octet, last_share,
        offline_tag, solo, type)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        'master',
        'e562f69ec36e625116376f376d991e41613e9bf3',
        0,
        1,
        false,
        true,
        'primary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        identifier = EXCLUDED.identifier,
        last_share = EXCLUDED.last_share,
        offline_tag = EXCLUDED.offline_tag;`;
    const expectedAuxWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        identifier, ip_hash,
        last_octet, last_share,
        offline_tag, solo, type)
      VALUES (
        1634742080841,
        '',
        'null',
        'master',
        'e562f69ec36e625116376f376d991e41613e9bf3',
        0,
        1,
        false,
        true,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        identifier = EXCLUDED.identifier,
        last_share = EXCLUDED.last_share,
        offline_tag = EXCLUDED.offline_tag;`;
    const expectedHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        ip_hash, solo, stale, type,
        valid, work)
      VALUES (
        1634742080841,
        600000,
        'primary',
        'primary',
        'master',
        0,
        'e562f69ec36e625116376f376d991e41613e9bf3',
        true,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        identifier = EXCLUDED.identifier,
        invalid = "Pool-Bitcoin".historical_workers.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_workers.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_workers.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_workers.work + EXCLUDED.work;`;
    const expectedAuxHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        ip_hash, solo, stale, type,
        valid, work)
      VALUES (
        1634742080841,
        600000,
        '',
        'null',
        'master',
        0,
        'e562f69ec36e625116376f376d991e41613e9bf3',
        true,
        0,
        'auxiliary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        identifier = EXCLUDED.identifier,
        invalid = "Pool-Bitcoin".historical_workers.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".historical_workers.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".historical_workers.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".historical_workers.work + EXCLUDED.work;`;
    const expectedHistory = `
      INSERT INTO "Pool-Bitcoin".local_history (
        timestamp, recent,
        share_writes)
      VALUES (1634742080841, 1634742600000, 1)
      ON CONFLICT ON CONSTRAINT local_history_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        share_writes = "Pool-Bitcoin".local_history.share_writes + EXCLUDED.share_writes;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(21);
      expect(transaction[1]).toBe(expectedHashrate);
      expect(transaction[2]).toBe(expectedAuxHashrate);
      expect(transaction[3]).toBe(expectedMetadata);
      expect(transaction[4]).toBe(expectedAuxMetadata);
      expect(transaction[5]).toBe(expectedHistoricalMetadata);
      expect(transaction[6]).toBe(expectedAuxHistoricalMetadata);
      expect(transaction[7]).toBe(expectedMiners);
      expect(transaction[8]).toBe(expectedAuxMiners);
      expect(transaction[9]).toBe(expectedHistoricalMiners);
      expect(transaction[10]).toBe(expectedAuxHistoricalMiners);
      expect(transaction[11]).toBe(expectedRounds);
      expect(transaction[12]).toBe(expectedAuxRounds);
      expect(transaction[13]).toBe(expectedUsers);
      expect(transaction[14]).toBe(expectedAuxUsers);
      expect(transaction[15]).toBe(expectedWorkers);
      expect(transaction[16]).toBe(expectedAuxWorkers);
      expect(transaction[17]).toBe(expectedHistoricalWorkers);
      expect(transaction[18]).toBe(expectedAuxHistoricalWorkers);
      expect(transaction[19]).toBe(expectedHistory);
      done();
    });
    rounds.handleUpdates(lookups, [share], () => {});
  });

  test('Test rounds main updates [5]', (done) => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const lookups = [
      null,
      { rows: []},
      { rows: []},
      { rows: []},
      { rows: []},
      { rows: []},
      { rows: []},
      { rows: []},
      { rows: []},
      null,
    ];
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(2);
      done();
    });
    rounds.handleUpdates(lookups, [], () => {});
  });

  test('Test rounds main updates [1]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      submitted: 1,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: null,
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: true,
      blocktype: 'share',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: '',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    const expectedHashrate = `
      INSERT INTO "Pool-Bitcoin".local_shares (
        error, uuid, timestamp,
        submitted, ip, port, addrprimary,
        addrauxiliary, blockdiffprimary,
        blockdiffauxiliary, blockvalid,
        blocktype, clientdiff, hash, height,
        identifier, reward, sharediff,
        sharevalid, transaction)
      VALUES (
        '',
        '123456789',
        1634742080841,
        1,
        '0.0.0.0',
        '3002',
        'primary',
        'null',
        1,
        1,
        true,
        'share',
        1,
        'hash1',
        1,
        '',
        1,
        1,
        true,
        'transaction1')
      ON CONFLICT ON CONSTRAINT local_shares_unique
      DO NOTHING;`;
    const expectedHistory = `
      INSERT INTO "Pool-Bitcoin".local_history (
        timestamp, recent,
        share_writes)
      VALUES (1634742080841, 1634742600000, 1)
      ON CONFLICT ON CONSTRAINT local_history_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        share_writes = "Pool-Bitcoin".local_history.share_writes + EXCLUDED.share_writes;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(4);
      expect(transaction[1]).toBe(expectedHashrate);
      expect(transaction[2]).toBe(expectedHistory);
      done();
    });
    rounds.handleShareUpdates([share], () => {});
  });

  test('Test rounds new block updates [1]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const miners = { rows: [{ miner: 'primary', work: 1 }]};
    const lookups = [null, { rows: [{ solo: false, work: 1 }]}, null, miners, null, null, null, null, null, null];
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      submitted: 1,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: true,
      blocktype: 'share',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: '',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    const expectedBlocks = `
      INSERT INTO "Pool-Bitcoin".current_blocks (
        timestamp, submitted, miner,
        worker, category, confirmations,
        difficulty, hash, height,
        identifier, luck, reward,
        round, solo, transaction,
        type)
      VALUES (
        1634742080841,
        1,
        'primary',
        'primary',
        'pending',
        -1,
        1,
        'hash1',
        1,
        'master',
        200,
        0,
        '123456789',
        false,
        'transaction1',
        'primary')
      ON CONFLICT ON CONSTRAINT current_blocks_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        submitted = EXCLUDED.submitted,
        miner = EXCLUDED.miner,
        worker = EXCLUDED.worker,
        category = EXCLUDED.category,
        confirmations = EXCLUDED.confirmations,
        difficulty = EXCLUDED.difficulty,
        hash = EXCLUDED.hash,
        height = EXCLUDED.height,
        identifier = EXCLUDED.identifier,
        luck = EXCLUDED.luck,
        reward = EXCLUDED.reward,
        solo = EXCLUDED.solo,
        transaction = EXCLUDED.transaction,
        type = EXCLUDED.type;`;
    const expectedMetadataBlocks = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, blocks, identifier,
        solo, type)
      VALUES (
        1634742080841,
        1,
        'master',
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".current_metadata.blocks + EXCLUDED.blocks;`;
    const expectedHistoricalMetadataBlocks = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1634742080841,
        600000,
        1,
        'master',
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    const expectedRoundUpdates = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND solo = false
      AND type = 'primary';`;
    const expectedRoundReset = `
      UPDATE "Pool-Bitcoin".current_metadata
      SET timestamp = 1634742080841, efficiency = 0,
        effort = 0, invalid = 0, stale = 0, valid = 0,
        work = 0
      WHERE type = 'primary' AND solo = false;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(7);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedMetadataBlocks);
      expect(transaction[3]).toBe(expectedHistoricalMetadataBlocks);
      expect(transaction[4]).toBe(expectedRoundUpdates);
      expect(transaction[5]).toBe(expectedRoundReset);
      done();
    });
    rounds.handleBlock(lookups, [share], 'primary', () => {});
  });

  test('Test rounds new block updates [2]', (done) => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const miners = { rows: [{ miner: 'primary', solo: true, work: 1 }]};
    const lookups = [null, { rows: [{ solo: true, work: 1 }]}, null, miners, null, null, null, null, null, null];
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      submitted: 1,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: true,
      blocktype: 'share',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: 'master',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    const expectedBlocks = `
      INSERT INTO "Pool-Bitcoin".current_blocks (
        timestamp, submitted, miner,
        worker, category, confirmations,
        difficulty, hash, height,
        identifier, luck, reward,
        round, solo, transaction,
        type)
      VALUES (
        1634742080841,
        1,
        'primary',
        'primary',
        'pending',
        -1,
        1,
        'hash1',
        1,
        'master',
        200,
        0,
        '123456789',
        true,
        'transaction1',
        'primary')
      ON CONFLICT ON CONSTRAINT current_blocks_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        submitted = EXCLUDED.submitted,
        miner = EXCLUDED.miner,
        worker = EXCLUDED.worker,
        category = EXCLUDED.category,
        confirmations = EXCLUDED.confirmations,
        difficulty = EXCLUDED.difficulty,
        hash = EXCLUDED.hash,
        height = EXCLUDED.height,
        identifier = EXCLUDED.identifier,
        luck = EXCLUDED.luck,
        reward = EXCLUDED.reward,
        solo = EXCLUDED.solo,
        transaction = EXCLUDED.transaction,
        type = EXCLUDED.type;`;
    const expectedMetadataBlocks = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, blocks, identifier,
        solo, type)
      VALUES (
        1634742080841,
        1,
        'master',
        true,
        'primary')
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".current_metadata.blocks + EXCLUDED.blocks;`;
    const expectedHistoricalMetadataBlocks = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1634742080841,
        600000,
        1,
        'master',
        true,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    const expectedRounds = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND miner = 'primary'
      AND solo = true AND type = 'primary';`;
    const expectedMiners = `
      UPDATE "Pool-Bitcoin".current_miners
      SET timestamp = 1634742080841, effort = 0
      WHERE miner = 'primary' AND solo = true
        AND type = 'primary';`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(7);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedMetadataBlocks);
      expect(transaction[3]).toBe(expectedHistoricalMetadataBlocks);
      expect(transaction[4]).toBe(expectedRounds);
      expect(transaction[5]).toBe(expectedMiners);
      done();
    });
    rounds.handleBlock(lookups, [share], 'primary', () => {});
  });

  test('Test rounds new block updates [3]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const lookups = [null, { rows: []}, null, { rows: []}, null, null, null, null, null, null];
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      submitted: 1,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: true,
      blocktype: 'share',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: '',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    const expectedBlocks = `
      INSERT INTO "Pool-Bitcoin".current_blocks (
        timestamp, submitted, miner,
        worker, category, confirmations,
        difficulty, hash, height,
        identifier, luck, reward,
        round, solo, transaction,
        type)
      VALUES (
        1634742080841,
        1,
        'primary',
        'primary',
        'pending',
        -1,
        1,
        'hash1',
        1,
        'master',
        100,
        0,
        '123456789',
        false,
        'transaction1',
        'primary')
      ON CONFLICT ON CONSTRAINT current_blocks_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        submitted = EXCLUDED.submitted,
        miner = EXCLUDED.miner,
        worker = EXCLUDED.worker,
        category = EXCLUDED.category,
        confirmations = EXCLUDED.confirmations,
        difficulty = EXCLUDED.difficulty,
        hash = EXCLUDED.hash,
        height = EXCLUDED.height,
        identifier = EXCLUDED.identifier,
        luck = EXCLUDED.luck,
        reward = EXCLUDED.reward,
        solo = EXCLUDED.solo,
        transaction = EXCLUDED.transaction,
        type = EXCLUDED.type;`;
    const expectedMetadataBlocks = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, blocks, identifier,
        solo, type)
      VALUES (
        1634742080841,
        1,
        'master',
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".current_metadata.blocks + EXCLUDED.blocks;`;
    const expectedHistoricalMetadataBlocks = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1634742080841,
        600000,
        1,
        'master',
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    const expectedRoundUpdates = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND solo = false
      AND type = 'primary';`;
    const expectedRoundReset = `
      UPDATE "Pool-Bitcoin".current_metadata
      SET timestamp = 1634742080841, efficiency = 0,
        effort = 0, invalid = 0, stale = 0, valid = 0,
        work = 0
      WHERE type = 'primary' AND solo = false;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(7);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedMetadataBlocks);
      expect(transaction[3]).toBe(expectedHistoricalMetadataBlocks);
      expect(transaction[4]).toBe(expectedRoundUpdates);
      expect(transaction[5]).toBe(expectedRoundReset);
      done();
    });
    rounds.handleBlock(lookups, [share], 'primary', () => {});
  });

  test('Test rounds segment handling [1]', (done) => {
    MockDate.set(1634742080841);
    const lookups = [
      null,
      { rows: [{ work: 1 }]},
      { rows: [{ work: 1 }]},
      { rows: [{ miner: 'primary', solo: true, work: 1 }]},
      { rows: [{ miner: 'primary', solo: true, work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: ['primary']},
      { rows: ['primary']},
      null,
    ];
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      submitted: 1,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: false,
      blocktype: 'share',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: '',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    rounds.handleSegments([share, share, share], {}, () => done());
  });

  test('Test rounds segment handling [2]', (done) => {
    MockDate.set(1634742080841);
    const lookups = [
      null,
      { rows: [{ work: 1 }]},
      { rows: [{ work: 1 }]},
      { rows: [{ miner: 'primary', solo: true, work: 1 }]},
      { rows: [{ miner: 'primary', solo: true, work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: ['primary']},
      { rows: ['primary']},
      null,
    ];
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      submitted: 1,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: true,
      blocktype: 'primary',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: '',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    rounds.handleSegments([share], {}, () => done());
  });

  test('Test rounds segment handling [3]', (done) => {
    MockDate.set(1634742080841);
    const lookups = [
      null,
      { rows: [{ work: 1 }]},
      { rows: [{ work: 1 }]},
      { rows: [{ miner: 'primary', solo: true, work: 1 }]},
      { rows: [{ miner: 'primary', solo: true, work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: ['primary']},
      { rows: ['primary']},
      null,
    ];
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      submitted: 1,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: false,
      blocktype: 'primary',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: '',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    rounds.handleSegments([share], {}, () => done());
  });

  test('Test rounds segment handling [4]', (done) => {
    MockDate.set(1634742080841);
    const lookups = [
      null,
      { rows: [{ work: 1 }]},
      { rows: [{ work: 1 }]},
      { rows: [{ miner: 'primary', solo: true, work: 1 }]},
      { rows: [{ miner: 'primary', solo: true, work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: []},
      { rows: []},
      null,
    ];
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      submitted: 1,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: true,
      blocktype: 'auxiliary',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: '',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    rounds.handleSegments([share], {}, () => done());
  });

  test('Test rounds segment handling [5]', (done) => {
    MockDate.set(1634742080841);
    const lookups = [
      null,
      { rows: [{ work: 1 }]},
      { rows: [{ work: 1 }]},
      { rows: [{ miner: 'primary', solo: true, work: 1 }]},
      { rows: [{ miner: 'primary', solo: true, work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: ['primary']},
      { rows: ['primary']},
      null,
    ];
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      submitted: 1,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: false,
      blocktype: 'auxiliary',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: '',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    rounds.handleSegments([share], {}, () => done());
  });

  test('Test rounds segment handling [6]', (done) => {
    MockDate.set(1634742080841);
    const lookups = [
      null,
      { rows: [{ work: 1 }]},
      { rows: [{ work: 1 }]},
      { rows: [{ miner: 'primary', solo: true, work: 1 }]},
      { rows: [{ miner: 'primary', solo: true, work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: ['primary']},
      { rows: ['primary']},
      null,
    ];
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742080841,
      submitted: 1,
      ip: '0.0.0.0',
      port: 3002,
      addrprimary: null,
      addrauxiliary: null,
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      blockvalid: false,
      blocktype: 'unknown',
      clientdiff: 1,
      hash: 'hash1',
      height: 1,
      identifier: '',
      reward: 1,
      sharediff: 1,
      sharevalid: true,
      transaction: 'transaction1'
    };
    rounds.handleSegments([share], {}, () => done());
  });

  test('Test rounds segment handling [7]', (done) => {
    MockDate.set(1634742080841);
    const lookups = [
      null,
      { rows: [{ work: 1 }]},
      { rows: [{ work: 1 }]},
      { rows: [{ miner: 'primary', solo: false, work: 1 }]},
      { rows: [{ miner: 'primary', solo: false, work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: ['primary']},
      { rows: ['primary']},
      
      null,
    ];
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    rounds.handleSegments([], {}, () => done());
  });
});
