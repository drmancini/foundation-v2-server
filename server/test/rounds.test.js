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
    expect(typeof rounds.handleEfficiency).toBe('function');
    expect(typeof rounds.handleEffort).toBe('function');
  });

  test('Test rounds database updates [1]', () => {
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    expect(rounds.handleEfficiency({ valid: 1, invalid: 0, stale: 0 }, 'valid')).toBe(100);
    expect(rounds.handleEfficiency({ valid: 0, invalid: 1, stale: 0 }, 'valid')).toBe(50);
    expect(rounds.handleEfficiency({ valid: 1, invalid: 1, stale: 0 }, 'valid')).toBe(66.67);
    expect(rounds.handleEfficiency({ valid: 1, invalid: 0, stale: 1 }, 'valid')).toBe(66.67);
    expect(rounds.handleEfficiency({}, 'valid')).toBe(100);
    expect(rounds.handleEfficiency({}, 'invalid')).toBe(0);
  });

  test('Test rounds database updates [2]', () => {
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    expect(rounds.handleEffort({ clientdiff: 10 }, 100, 100, 'valid')).toBe(110);
    expect(rounds.handleEffort({ clientdiff: 10 }, 100, 100, 'invalid')).toBe(100);
    expect(rounds.handleEffort({}, 100, 100, 'valid')).toBe(100);
    expect(rounds.handleEffort({}, 100, 0, 'invalid')).toBe(0);
  });

  test('Test rounds database updates [3]', () => {
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    expect(rounds.handleEffortIncrement({ clientdiff: 10 }, 100, 'valid')).toBe(10);
    expect(rounds.handleEffortIncrement({ clientdiff: 10 }, 100, 'invalid')).toBe(0);
    expect(rounds.handleEffortIncrement({}, 100, 'valid')).toBe(0);
    expect(rounds.handleEffortIncrement({}, 100, 'invalid')).toBe(0);
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
    expect(rounds.handleTimes({}, 1634742090841)).toBe(10);
  });

  test('Test rounds database updates [5]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    expect(rounds.handleTimesInitial({ submitted: '1634742080841', times: 0, }, 1634742290841, 60000)).toBe(210);
    expect(rounds.handleTimesInitial({ submitted: '1634742080841', times: 145 }, 1634743180841, 60000)).toBe(0);
    expect(rounds.handleTimesInitial({ submitted: '1634742080841', times: 145 }, 1634742830841, 60000)).toBe(750);
    expect(rounds.handleTimesInitial({ submitted: '1634742080841', times: 145 }, 1634742370841, 60000)).toBe(290);
    expect(rounds.handleTimesInitial({ times: 145 }, 1634742530841, 60000)).toBe(450);
    expect(rounds.handleTimesInitial({}, 1634742080841, 60000)).toBe(0);
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
    const round = [{ miner: 'address1' }, { miner: 'address2' }];
    const expected = { 'address1': { miner: 'address1' }, 'address2': { miner: 'address2' }};
    expect(rounds.handleMinersLookups(round)).toStrictEqual(expected);
  })

  test('Test rounds database updates [11]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const round = [{ worker: 'address1' }, { worker: 'address2' }];
    const expected = { 'address1': { worker: 'address1' }, 'address2': { worker: 'address2' }};
    expect(rounds.handleWorkersLookups(round)).toStrictEqual(expected);
  });

  test('Test rounds database updates [11]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const round = [{ miner: 'address1' }, { miner: 'address2' }];
    const expected = [ 'address1', 'address2' ];
    expect(rounds.handleUsersLookups(round)).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentBlocks updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ work: 1 }, { work: 1 }];
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
      submitted: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      category: 'pending',
      confirmations: -1,
      difficulty: 1,
      hash: 'hash1',
      height: 1,
      identifier: 'master',
      luck: 300,
      reward: 0,
      round: '123456789',
      solo: false,
      transaction: 'transaction1',
      type: 'primary',
    };
    expect(rounds.handleCurrentBlocks(metadata, round, share, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentBlocks updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ work: 0 }, { work: 0 }];
    const round = { work: 0 };
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

  test('Test rounds handleCurrentHashrate updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, addrprimary: 'primary', addrauxiliary: 'primary', identifier: '' };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      share: 'valid',
      solo: false,
      type: 'primary',
      work: 1,
    };
    expect(rounds.handleCurrentHashrate(share, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentHashrate updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, addrprimary: 'primary', addrauxiliary: null, identifier: '' };
    const expected = {
      timestamp: 1634742080841,
      miner: '',
      worker: null,
      identifier: 'master',
      share: 'invalid',
      solo: false,
      type: 'auxiliary',
      work: 0,
    };
    expect(rounds.handleCurrentHashrate(share, 'invalid', false, 'auxiliary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentMetadata updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const initial = { work: 1 };
    const updates = { work: 1 };
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1 };
    const expected = {
      timestamp: 1634742080841,
      efficiency: 100,
      effort: 300,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 2,
    };
    expect(rounds.handleCurrentMetadata(initial, updates, share, 'valid', 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentMetadata updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const initial = { work: 1 };
    const updates = { work: 1 };
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1 };
    const expected = {
      timestamp: 1634742080841,
      efficiency: 0,
      effort: 200,
      identifier: 'master',
      invalid: 1,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 0,
      work: 1,
    };
    expect(rounds.handleCurrentMetadata(initial, updates, share, 'invalid', 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentMetadata updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const initial = { work: 1 };
    const updates = { work: 1 };
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1 };
    const expected = {
      timestamp: 1634742080841,
      efficiency: 0,
      effort: 200,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 1,
      type: 'primary',
      valid: 0,
      work: 1,
    };
    expect(rounds.handleCurrentMetadata(initial, updates, share, 'stale', 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentMetadata updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1 };
    const expected = {
      timestamp: 1634742080841,
      efficiency: 100,
      effort: 100,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'auxiliary',
      valid: 1,
      work: 1,
    };
    expect(rounds.handleCurrentMetadata({}, {}, share, 'valid', 'auxiliary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentMiners updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'auxiliary' };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      solo_effort: 0,
      type: 'primary',
    };
    expect(rounds.handleCurrentMiners(share, 'valid', 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentMiners updates [2]', () => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, port: 3002, addrprimary: 'primary', addrauxiliary: 'primary' };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      solo_effort: 100,
      type: 'primary',
    };
    expect(rounds.handleCurrentMiners(share, 'valid', 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentMiners updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, port: 3002, addrprimary: 'primary', addrauxiliary: 'primary' };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      solo_effort: 0,
      type: 'primary',
    };
    expect(rounds.handleCurrentMiners(share, 'stale', 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentMiners updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, port: 3002, addrprimary: 'primary', addrauxiliary: 'primary' };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      solo_effort: 0,
      type: 'primary',
    };
    expect(rounds.handleCurrentMiners(share, 'ivalid', 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentMiners updates [5]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: '', addrauxiliary: null };
    const expected = {
      timestamp: 1634742080841,
      miner: '',
      solo_effort: 0,
      type: 'auxiliary',
    };
    expect(rounds.handleCurrentMiners(share, 'valid', 'auxiliary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentRounds updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const initial = { submitted: 1634742080841, times: 10, work: 1 };
    const updates = { work: 1 };
    const share = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 0,
      round: 'current',
      solo: false,
      stale: 0,
      times: 0,
      type: 'primary',
      valid: 1,
      work: 2,
    };
    expect(rounds.handleCurrentRounds(initial, updates, share, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentRounds updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const initial = { work: 1 };
    const updates = { work: 1 };
    const share = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 1,
      round: 'current',
      solo: false,
      stale: 0,
      times: 0,
      type: 'primary',
      valid: 0,
      work: 1,
    };
    expect(rounds.handleCurrentRounds(initial, updates, share, 'invalid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentRounds updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const initial = { work: 1 };
    const updates = { work: 1 };
    const share = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 0,
      round: 'current',
      solo: false,
      stale: 1,
      times: 0,
      type: 'primary',
      valid: 0,
      work: 1,
    };
    expect(rounds.handleCurrentRounds(initial, updates, share, 'stale', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentRounds updates [4]', () => {
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
      round: 'current',
      solo: true,
      stale: 0,
      times: 0,
      type: 'auxiliary',
      valid: 1,
      work: 1,
    };
    expect(rounds.handleCurrentRounds({}, {}, share, 'valid', true, 'auxiliary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentWorkers updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'primary', identifier: 'eu', ip: '1.1.1.1' };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      effort: 100,
      identifier: 'eu',
      ip_hash: '409629a08b9b3f3be610b8832cc28822f964410f',
      last_octet: 1,
      last_share: 1634742080841,
      offline_tag: false,
      solo: false,
      type: 'primary',
    };
    expect(rounds.handleCurrentWorkers(share, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentWorkers updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'primary' };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      effort: 0,
      identifier: 'master',
      ip_hash: 'unknown',
      last_octet: -1,
      last_share: 1634742080841,
      offline_tag: false,
      solo: false,
      type: 'primary',
    };
    expect(rounds.handleCurrentWorkers(share, 'invalid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentWorkers updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'primary' };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      effort: 0,
      identifier: 'master',
      ip_hash: 'unknown',
      last_octet: -1,
      last_share: 1634742080841,
      offline_tag: false,
      solo: false,
      type: 'primary',
    };
    expect(rounds.handleCurrentWorkers(share, 'stale', false, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleCurrentWorkers updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: '', addrauxiliary: null };
    const expected = {
      timestamp: 1634742080841,
      miner: '',
      worker: null,
      effort: 100,
      identifier: 'master',
      ip_hash: 'unknown',
      last_octet: -1,
      last_share: 1634742080841,
      offline_tag: false,
      solo: true,
      type: 'auxiliary',
    };
    expect(rounds.handleCurrentWorkers(share, 'valid', true, 'auxiliary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalMetadataBlocks updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: '', addrauxiliary: null };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      blocks: 1,
      identifier: 'master',
      solo: true,
      type: 'primary',
    };
    expect(rounds.handleHistoricalMetadataBlocks(share, true, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalMetadataBlocks updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: '', addrauxiliary: null, identifier: 'eu' };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      blocks: 1,
      identifier: 'eu',
      solo: true,
      type: 'primary',
    };
    expect(rounds.handleHistoricalMetadataBlocks(share, true, 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalMetadataBlocks updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: '', addrauxiliary: null, identifier: 'eu' };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      blocks: 1,
      identifier: 'master',
      solo: true,
      type: 'auxiliary',
    };
    expect(rounds.handleHistoricalMetadataBlocks({}, true, 'auxiliary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalMetadataBlocks updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: '', addrauxiliary: null, identifier: 'eu' };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      blocks: 1,
      identifier: 'eu',
      solo: true,
      type: 'auxiliary',
    };
    expect(rounds.handleHistoricalMetadataBlocks(share, true, 'auxiliary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalMetadata updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: '', addrauxiliary: null, identifier: 'eu' };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634742600000,
      identifier: 'eu',
      solo: false,
      type: 'primary',
      work: 0,
    }];
    expect(rounds.handleHistoricalMetadata([share, share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalMetadata updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: '', addrauxiliary: null, error: null, sharevalid: true };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634742600000,
      identifier: 'master',
      solo: false,
      type: 'primary',
      work: 1,
    }];
    expect(rounds.handleHistoricalMetadata([share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalMetadata updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: '', addrauxiliary: null, error: 'job not found', sharevalid: true };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634742600000,
      identifier: 'master',
      solo: false,
      type: 'primary',
      work: 0,
    }];
    expect(rounds.handleHistoricalMetadata([share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalMetadata updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: '', addrauxiliary: 'auxiliary', sharevalid: true };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634742600000,
      identifier: 'master',
      solo: false,
      type: 'auxiliary',
      work: 1,
    }];
    expect(rounds.handleHistoricalMetadata([share], 'auxiliary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalMiners updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { timestamp: 1634741000841, clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'auxiliary', sharevalid: true };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634741400000,
      miner: 'primary',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 1,
    }];
    expect(rounds.handleHistoricalMiners([share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalMiners updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { timestamp: 1634741000841, clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'auxiliary', error: 'error', sharevalid: false };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634741400000,
      miner: 'primary',
      invalid: 1,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    }];
    expect(rounds.handleHistoricalMiners([share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalMiners updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { timestamp: 1634741000841, clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'auxiliary', error: 'job not found', sharevalid: true };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634741400000,
      miner: 'primary',
      invalid: 0,
      solo: false,
      stale: 1,
      type: 'primary',
      valid: 0,
      work: 0,
    }];
    expect(rounds.handleHistoricalMiners([share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalMiners updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { timestamp: 1634741000841, clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'auxiliary', sharevalid: true };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634741400000,
      miner: 'primary',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 1,
    }];
    expect(rounds.handleHistoricalMiners([share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalMiners updates [5]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { timestamp: 1634741000841, clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'auxiliary', sharevalid: true };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634741400000,
      miner: 'primary',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 2,
      work: 2,
    }];
    expect(rounds.handleHistoricalMiners([share, share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalMiners updates [6]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { timestamp: 1634741000841, clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, sharevalid: true };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634741400000,
      miner: '',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'auxiliary',
      valid: 1,
      work: 1,
    }];
    expect(rounds.handleHistoricalMiners([share], 'auxiliary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalWorkers updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { timestamp: 1634741000841, clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'auxiliary', sharevalid: true };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634741400000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 1,
    }];
    expect(rounds.handleHistoricalWorkers([share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalWorkers updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { timestamp: 1634741000841, clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'auxiliary', identifier: 'eu', error: 'error', sharevalid: false };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634741400000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'eu',
      invalid: 1,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    }];
    expect(rounds.handleHistoricalWorkers([share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalWorkers updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { timestamp: 1634741000841, clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'auxiliary', error: 'job not found', sharevalid: true };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634741400000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 1,
      type: 'primary',
      valid: 0,
      work: 0,
    }];
    expect(rounds.handleHistoricalWorkers([share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalWorkers updates [4]', () => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { timestamp: 1634741000841, clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'auxiliary', port: 3002, sharevalid: true };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634741400000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 0,
      solo: true,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 1,
    }];
    expect(rounds.handleHistoricalWorkers([share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalWorkers updates [5]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { timestamp: 1634741000841, clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'auxiliary', sharevalid: true };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634741400000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 2,
      work: 2,
    }];
    expect(rounds.handleHistoricalWorkers([share, share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleHistoricalWorkers updates [6]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { timestamp: 1634741000841, clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, sharevalid: true };
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634741400000,
      miner: '',
      worker: '',
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'auxiliary',
      valid: 1,
      work: 1,
    }];
    expect(rounds.handleHistoricalWorkers([share], 'auxiliary')).toStrictEqual(expected);
  });

  test('Test rounds handleUsers updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'auxiliary', sharevalid: true };
    const users = [ 'primary' ];
    const expected = [];
    expect(rounds.handleUsers(users, [share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleUsers updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, addrprimary: 'primary', addrauxiliary: 'auxiliary', sharevalid: true };
    const users = [ 'primary1' ];
    const expected = [{
      joined: 1634742080841,
      miner: 'primary',
      payout_limit: 0.005,
      type: 'primary',
    }];
    expect(rounds.handleUsers(users, [share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds handleUsers updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = { clientdiff: 1, blockdiffprimary: 1, blockdiffauxiliary: 1, sharevalid: true };
    const users = [ 'primary1' ];
    const expected = [{
      joined: 1634742080841,
      miner: '',
      payout_limit: 0.005,
      type: 'primary',
    }];
    expect(rounds.handleUsers(users, [share], 'primary')).toStrictEqual(expected);
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
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
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
      sharevalid: false,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
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
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
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
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      share: 'stale',
      solo: false,
      type: 'primary',
      work: 0,
    };
    expect(rounds.handleHashrate([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds hashrate updates [5]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      timestamp: 0,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
      sharevalid: true,
    };
    expect(rounds.handleHashrate([share], 'primary')).toStrictEqual([]);
  });

  test('Test rounds metadata updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ identifier: 'eu', work: 1 }];
    const share = {
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      identifier: 'eu',
      sharevalid: true,
    };
    const expected = [{
      timestamp: 1634742080841,
      efficiency: 100,
      effort: 200,
      identifier: 'eu',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 1,
    }];
    expect(rounds.handleMetadata(metadata, [share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds metadata updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ identifier: 'eu', work: 1 }];
    const share = {
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      identifier: 'eu',
      sharevalid: true,
    };
    const expected = [{
      timestamp: 1634742080841,
      efficiency: 100,
      effort: 300,
      identifier: 'eu',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 2,
      work: 2,
    }];
    expect(rounds.handleMetadata(metadata, [share, share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds metadata updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ identifier: 'eu', work: 1 }];
    const share = {
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      sharevalid: false,
    };
    const expected = [{
      timestamp: 1634742080841,
      efficiency: 0,
      effort: 0,
      identifier: 'master',
      invalid: 1,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    }];
    expect(rounds.handleMetadata(metadata, [share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds metadata updates [4]', () => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ work: 1 }];
    const share = {
      error: 'error1',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      port: 3002,
      sharevalid: true,
    };
    const expected = [];
    expect(rounds.handleMetadata(metadata, [share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds metadata updates [5]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ work: 1 }];
    const share = {
      error: 'job not found',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      sharevalid: true,
    };
    const expected = [{
      timestamp: 1634742080841,
      efficiency: 0,
      effort: 100,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 1,
      type: 'primary',
      valid: 0,
      work: 0,
    }];
    expect(rounds.handleMetadata(metadata, [share], 'primary')).toStrictEqual(expected);
  });

  test('Test rounds metadata updates [6]', () => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const metadata = [{ work: 1 }];
    const share = {
      port: 3002,
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      sharevalid: true,
    };
    expect(rounds.handleMetadata(metadata, [share], 'primary')).toStrictEqual([]);
  });

  test('Test rounds miners updates [1]', () => {
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
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      solo_effort: 0,
      type: 'primary',
    };
    expect(rounds.handleMiners([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds miners updates [2]', () => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
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
      solo_effort: 0,
      type: 'primary',
    };
    expect(rounds.handleMiners([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds miners updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const miners = { 'primary': { work: 1 }};
    const share = {
      error: 'error1',
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
      solo_effort: 0,
      type: 'primary',
    };
    expect(rounds.handleMiners([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds miners updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const miners = { 'primary': { work: 1 }};
    const share = {
      error: 'job not found',
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
      solo_effort: 0,
      type: 'primary',
    };
    expect(rounds.handleMiners([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds miners updates [5]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: 'job not found',
      addrprimary: '',
      addrauxiliary: null,
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: '',
      solo_effort: 0,
      type: 'auxiliary',
    };
    expect(rounds.handleMiners([share], 'auxiliary')).toStrictEqual([expected]);
  });

  test('Test rounds shares updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const round = { 'primary': { work: 1 }};
    const share = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 0,
      round: 'current',
      solo: false,
      stale: 0,
      times: 0,
      type: 'primary',
      valid: 1,
      work: 1,
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
      submitted: 1634742080841,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
      sharevalid: false,
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 1,
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
      submitted: 1634742080841,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
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
      submitted: 1634742080841,
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      clientdiff: 1,
      identifier: '',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      recent: 1634742600000,
      miner: 'primary',
      worker: 'primary',
      identifier: 'master',
      invalid: 0,
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
      submitted: 1634742080841,
      addrprimary: '',
      addrauxiliary: null,
      clientdiff: 1,
      identifier: '',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      recent: 0,
      miner: '',
      worker: null,
      identifier: 'master',
      invalid: 0,
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

  test('Test rounds workers updates [1]', () => {
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
      ip: '1.1.1.1',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      effort: 100,
      identifier: 'master',
      ip_hash: '409629a08b9b3f3be610b8832cc28822f964410f',
      last_octet: 1,
      last_share: 1634742080841,
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
    const workers = { 'primary': { work: 1 }};
    const share = {
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      ip: '1.1.1.1',
      sharevalid: false,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      effort: 0,
      identifier: 'master',
      ip_hash: '409629a08b9b3f3be610b8832cc28822f964410f',
      last_octet: 1,
      last_share: 1634742080841,
      offline_tag: false,
      solo: false,
      type: 'primary',
    };
    expect(rounds.handleWorkers([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds workers updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const workers = { 'primary': { work: 1 }};
    const share = {
      error: 'error1',
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      ip: '1.1.1.1',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      effort: 0,
      identifier: 'master',
      ip_hash: '409629a08b9b3f3be610b8832cc28822f964410f',
      last_octet: 1,
      last_share: 1634742080841,
      offline_tag: false,
      solo: false,
      type: 'primary',
    };
    expect(rounds.handleWorkers([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds workers updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const workers = { 'primary': { work: 1 }};
    const share = {
      error: 'job not found',
      addrprimary: 'primary',
      addrauxiliary: 'primary',
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      ip: '1.1.1.1',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      effort: 0,
      identifier: 'master',
      ip_hash: '409629a08b9b3f3be610b8832cc28822f964410f',
      last_octet: 1,
      last_share: 1634742080841,
      offline_tag: false,
      solo: false,
      type: 'primary',
    };
    expect(rounds.handleWorkers([share], 'primary')).toStrictEqual([expected]);
  });

  test('Test rounds workers updates [5]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const share = {
      error: 'job not found',
      addrprimary: '',
      addrauxiliary: null,
      blockdiffprimary: 1,
      blockdiffauxiliary: 1,
      clientdiff: 1,
      ip: '1.1.1.1',
      sharevalid: true,
    };
    const expected = {
      timestamp: 1634742080841,
      miner: '',
      worker: null,
      effort: 0,
      identifier: 'master',
      ip_hash: '409629a08b9b3f3be610b8832cc28822f964410f',
      last_octet: 1,
      last_share: 1634742080841,
      offline_tag: false,
      solo: false,
      type: 'auxiliary',
    };
    expect(rounds.handleWorkers([share], 'auxiliary')).toStrictEqual([expected]);
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
      { rows: [{ identifier: 'master', work: 1 }]},
      { rows: [{ identifier: 'master', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary' }]},
      { rows: [{ miner: 'primary' }]},
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
        identifier, share, solo,
        type, work)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        'master',
        'valid',
        false,
        'primary',
        1);`;
    const expectedMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, efficiency, effort,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES (
        1634742080841,
        100,
        100,
        'master',
        0,
        false,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        effort = EXCLUDED.effort,
        invalid = "Pool-Bitcoin".current_metadata.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".current_metadata.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".current_metadata.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".current_metadata.work + EXCLUDED.work;`;
    const expectedMiners = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, solo_effort,
        type)
      VALUES (
        1634742080841,
        'primary',
        0,
        'primary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        solo_effort = "Pool-Bitcoin".current_miners.solo_effort + EXCLUDED.solo_effort;`;
    const expectedRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, submitted, recent,
        miner, worker, identifier, invalid,
        round, solo, stale, times, type,
        valid, work)
      VALUES (
        1634742080841,
        1,
        1634742600000,
        'primary',
        'primary',
        'master',
        0,
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
    const expectedWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        effort, identifier,
        ip_hash, last_octet, last_share,
        offline_tag, solo, type)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        100,
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
        effort = "Pool-Bitcoin".current_workers.effort + EXCLUDED.effort,
        identifier = EXCLUDED.identifier,
        ip_hash = EXCLUDED.ip_hash,
        last_octet = EXCLUDED.last_octet,
        last_share = EXCLUDED.last_share,
        offline_tag = EXCLUDED.offline_tag,
        solo = EXCLUDED.solo;`;
    const expectedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, identifier,
        solo, type, work)
      VALUES (
        1634742080841,
        1634742600000,
        'master',
        false,
        'primary',
        1)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        work = "Pool-Bitcoin".historical_metadata.work + EXCLUDED.work;`;
    const expectedHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale,
        type, valid, work)
      VALUES (
        1634742080841,
        1634742600000,
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
    const expectedHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        solo, stale, type, valid,
        work)
      VALUES (
        1634742080841,
        1634742600000,
        'primary',
        'primary',
        'master',
        0,
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
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(10);
      expect(transaction[1]).toBe(expectedHashrate);
      expect(transaction[2]).toBe(expectedMetadata);
      expect(transaction[3]).toBe(expectedMiners);
      expect(transaction[4]).toBe(expectedRounds);
      expect(transaction[5]).toBe(expectedWorkers);
      expect(transaction[6]).toBe(expectedHistoricalMetadata);
      expect(transaction[7]).toBe(expectedHistoricalMiners);
      expect(transaction[8]).toBe(expectedHistoricalWorkers);
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
      { rows: [{ identifier: 'master', work: 1 }]},
      { rows: [{ identifier: 'master', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      null,
    ];
    const share = {
      error: '',
      uuid: '123456789',
      timestamp: 1634742180841,
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
        identifier, share, solo,
        type, work)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        'master',
        'valid',
        true,
        'primary',
        1);`;
    const expectedMiners = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, solo_effort,
        type)
      VALUES (
        1634742080841,
        'primary',
        100,
        'primary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        solo_effort = "Pool-Bitcoin".current_miners.solo_effort + EXCLUDED.solo_effort;`;
    const expectedRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, submitted, recent,
        miner, worker, identifier, invalid,
        round, solo, stale, times, type,
        valid, work)
      VALUES (
        1634742080841,
        1,
        0,
        'primary',
        'primary',
        'master',
        0,
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
    const expectedWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        effort, identifier,
        ip_hash, last_octet, last_share,
        offline_tag, solo, type)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        100,
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
        effort = "Pool-Bitcoin".current_workers.effort + EXCLUDED.effort,
        identifier = EXCLUDED.identifier,
        ip_hash = EXCLUDED.ip_hash,
        last_octet = EXCLUDED.last_octet,
        last_share = EXCLUDED.last_share,
        offline_tag = EXCLUDED.offline_tag,
        solo = EXCLUDED.solo;`;
    const expectedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, identifier,
        solo, type, work)
      VALUES (
        1634742080841,
        1634742600000,
        'master',
        true,
        'primary',
        1)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        work = "Pool-Bitcoin".historical_metadata.work + EXCLUDED.work;`;
    const expectedHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale,
        type, valid, work)
      VALUES (
        1634742080841,
        1634742600000,
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
    const expectedHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        solo, stale, type, valid,
        work)
      VALUES (
        1634742080841,
        1634742600000,
        'primary',
        'primary',
        'master',
        0,
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
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(9);
      expect(transaction[1]).toBe(expectedHashrate);
      expect(transaction[2]).toBe(expectedMiners);
      expect(transaction[3]).toBe(expectedRounds);
      expect(transaction[4]).toBe(expectedWorkers);
      expect(transaction[5]).toBe(expectedHistoricalMetadata);
      expect(transaction[6]).toBe(expectedHistoricalMiners);
      expect(transaction[7]).toBe(expectedHistoricalWorkers);
      done();
    });
    rounds.handleUpdates(lookups, [share], () => {});
  });

  test('Test rounds main updates [3]', (done) => {
    MockDate.set(1634742080841);
    configCopy.auxiliary = { enabled: true };
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const lookups = [
      null,
      { rows: [{ identifier: 'master', work: 1 }]},
      { rows: [{ identifier: 'master', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary2'}]},
      { rows: [{ miner: 'primary2'}]},
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
    const expectedPrimaryHashrate = `
      INSERT INTO "Pool-Bitcoin".current_hashrate (
        timestamp, miner, worker,
        identifier, share, solo,
        type, work)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        'master',
        'valid',
        false,
        'primary',
        1);`;
    const expectedAuxiliaryHashrate = `
      INSERT INTO "Pool-Bitcoin".current_hashrate (
        timestamp, miner, worker,
        identifier, share, solo,
        type, work)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        'master',
        'valid',
        false,
        'auxiliary',
        1);`;
    const expectedPrimaryMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, efficiency, effort,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES (
        1634742080841,
        100,
        100,
        'master',
        0,
        false,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        effort = EXCLUDED.effort,
        invalid = "Pool-Bitcoin".current_metadata.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".current_metadata.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".current_metadata.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".current_metadata.work + EXCLUDED.work;`;
    const expectedAuxiliaryMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, efficiency, effort,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES (
        1634742080841,
        100,
        100,
        'master',
        0,
        false,
        0,
        'auxiliary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        effort = EXCLUDED.effort,
        invalid = "Pool-Bitcoin".current_metadata.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".current_metadata.stale + EXCLUDED.stale,
        valid = "Pool-Bitcoin".current_metadata.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".current_metadata.work + EXCLUDED.work;`;
    const expectedPrimaryMiners = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, solo_effort,
        type)
      VALUES (
        1634742080841,
        'primary',
        0,
        'primary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        solo_effort = "Pool-Bitcoin".current_miners.solo_effort + EXCLUDED.solo_effort;`;
    const expectedAuxiliaryMiners = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, solo_effort,
        type)
      VALUES (
        1634742080841,
        'primary',
        0,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        solo_effort = "Pool-Bitcoin".current_miners.solo_effort + EXCLUDED.solo_effort;`;
    const expectedPrimaryRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, submitted, recent,
        miner, worker, identifier, invalid,
        round, solo, stale, times, type,
        valid, work)
      VALUES (
        1634742080841,
        1,
        1634742600000,
        'primary',
        'primary',
        'master',
        0,
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
    const expectedAuxiliaryRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, submitted, recent,
        miner, worker, identifier, invalid,
        round, solo, stale, times, type,
        valid, work)
      VALUES (
        1634742080841,
        1,
        1634742600000,
        'primary',
        'primary',
        'master',
        0,
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
    const expectedPrimaryWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        effort, identifier,
        ip_hash, last_octet, last_share,
        offline_tag, solo, type)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        100,
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
        effort = "Pool-Bitcoin".current_workers.effort + EXCLUDED.effort,
        identifier = EXCLUDED.identifier,
        ip_hash = EXCLUDED.ip_hash,
        last_octet = EXCLUDED.last_octet,
        last_share = EXCLUDED.last_share,
        offline_tag = EXCLUDED.offline_tag,
        solo = EXCLUDED.solo;`;
    const expectedAuxiliaryWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        effort, identifier,
        ip_hash, last_octet, last_share,
        offline_tag, solo, type)
      VALUES (
        1634742080841,
        'primary',
        'primary',
        100,
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
        effort = "Pool-Bitcoin".current_workers.effort + EXCLUDED.effort,
        identifier = EXCLUDED.identifier,
        ip_hash = EXCLUDED.ip_hash,
        last_octet = EXCLUDED.last_octet,
        last_share = EXCLUDED.last_share,
        offline_tag = EXCLUDED.offline_tag,
        solo = EXCLUDED.solo;`;
    const expectedPrimaryHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, identifier,
        solo, type, work)
      VALUES (
        1634742080841,
        1634742600000,
        'master',
        false,
        'primary',
        1)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        work = "Pool-Bitcoin".historical_metadata.work + EXCLUDED.work;`;
    const expectedAuxiliaryHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, identifier,
        solo, type, work)
      VALUES (
        1634742080841,
        1634742600000,
        'master',
        false,
        'auxiliary',
        1)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        work = "Pool-Bitcoin".historical_metadata.work + EXCLUDED.work;`;
    const expectedPrimaryHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale,
        type, valid, work)
      VALUES (
        1634742080841,
        1634742600000,
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
    const expectedAuxiliaryHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale,
        type, valid, work)
      VALUES (
        1634742080841,
        1634742600000,
        'primary',
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
    const expectedPrimaryHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        solo, stale, type, valid,
        work)
      VALUES (
        1634742080841,
        1634742600000,
        'primary',
        'primary',
        'master',
        0,
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
    const expectedAuxiliaryHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        solo, stale, type, valid,
        work)
      VALUES (
        1634742080841,
        1634742600000,
        'primary',
        'primary',
        'master',
        0,
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
    const expectedPrimaryUsers = `
      INSERT INTO "Pool-Bitcoin".current_users (
        miner, joined, payout_limit,
        type)
      VALUES (
        'primary',
        1634742080841,
        0.005,
        'primary')
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`;
    const expectedAuxiliaryUsers = `
      INSERT INTO "Pool-Bitcoin".current_users (
        miner, joined, payout_limit,
        type)
      VALUES (
        'primary',
        1634742080841,
        0.005,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(20);
      expect(transaction[1]).toBe(expectedPrimaryHashrate);
      expect(transaction[2]).toBe(expectedAuxiliaryHashrate);
      expect(transaction[3]).toBe(expectedPrimaryMetadata);
      expect(transaction[4]).toBe(expectedAuxiliaryMetadata);
      expect(transaction[5]).toBe(expectedPrimaryMiners);
      expect(transaction[6]).toBe(expectedAuxiliaryMiners);
      expect(transaction[7]).toBe(expectedPrimaryRounds);
      expect(transaction[8]).toBe(expectedAuxiliaryRounds);
      expect(transaction[9]).toBe(expectedPrimaryWorkers);
      expect(transaction[10]).toBe(expectedAuxiliaryWorkers);
      expect(transaction[11]).toBe(expectedPrimaryHistoricalMetadata);
      expect(transaction[12]).toBe(expectedAuxiliaryHistoricalMetadata);
      expect(transaction[13]).toBe(expectedPrimaryHistoricalMiners);
      expect(transaction[14]).toBe(expectedAuxiliaryHistoricalMiners);
      expect(transaction[15]).toBe(expectedPrimaryHistoricalWorkers);
      expect(transaction[16]).toBe(expectedAuxiliaryHistoricalWorkers);
      expect(transaction[17]).toBe(expectedPrimaryUsers);
      expect(transaction[18]).toBe(expectedAuxiliaryUsers);
      done();
    });
    rounds.handleUpdates(lookups, [share], () => {});
  });

  test('Test rounds main updates [4]', (done) => {
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
      null,
    ];
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(2);
      done();
    });
    rounds.handleUpdates(lookups, [], () => {});
  });

  test('Test rounds main updates [5]', (done) => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const lookups = [
      null,
      { rows: null },
      { rows: null },
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

  test('Test rounds primary updates [1]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const workers = { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]};
    const lookups = [null, { rows: [{ identifier: 'master', work: 1 }]}, null, workers, null, null, null, null];
    const shares = [{
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
    }];
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
        1634742080841,
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
    const expectedRoundsUpdate = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND solo = false
      AND type = 'primary';`;
    const expectedRoundReset = `
      UPDATE "Pool-Bitcoin".current_metadata
      SET timestamp = 1634742080841, efficiency = 0,
        effort = 0, invalid = 0, stale = 0,
        valid = 0, work = 0
      WHERE solo = false AND type = 'primary';`;
    const expectedWorkersReset = `
      UPDATE "Pool-Bitcoin".current_workers
      SET timestamp = 1634742080841,
        effort = 0
      WHERE solo = false
      AND type = 'primary';`;
    const expecteHistoricalMetadataBlocks = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1,
        600000,
        1,
        'master',
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(8);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedMetadataBlocks);
      expect(transaction[3]).toBe(expectedRoundsUpdate);
      expect(transaction[4]).toBe(expectedRoundReset);
      expect(transaction[5]).toBe(expectedWorkersReset);
      expect(transaction[6]).toBe(expecteHistoricalMetadataBlocks);
      done();
    });
    rounds.handlePrimary(lookups, shares, () => {});
  });

  test('Test rounds primary updates [2]', (done) => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const workers = { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]};
    const lookups = [null, { rows: [{ identifier: 'master', work: 1 }]}, null, workers, null, null, null, null];
    const shares = [{
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
    }];
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
        1634742080841,
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
    const expectedRoundsUpdate = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND miner = 'primary'
      AND solo = true AND type = 'primary';`;
    const expectedRoundReset = `
      UPDATE "Pool-Bitcoin".current_miners
      SET timestamp = 1634742080841,
        solo_effort = 0
      WHERE miner = 'primary'
      AND type = 'primary';`;
    const expectedWorkersReset = `
      UPDATE "Pool-Bitcoin".current_workers
      SET timestamp = 1634742080841,
        effort = 0
      WHERE miner = 'primary'
      AND solo = true
      AND type = 'primary';`;
    const expecteHistoricalMetadataBlocks = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1,
        600000,
        1,
        'master',
        true,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(8);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedMetadataBlocks);
      expect(transaction[3]).toBe(expectedRoundsUpdate);
      expect(transaction[4]).toBe(expectedRoundReset);
      expect(transaction[5]).toBe(expectedWorkersReset);
      expect(transaction[6]).toBe(expecteHistoricalMetadataBlocks);
      done();
    });
    rounds.handlePrimary(lookups, shares, () => {});
  });

  test('Test rounds primary updates [3]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const lookups = [null, { rows: []}, null, { rows: []}, null, null, null, null];
    const shares = [{
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
    }];
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
        1634742080841,
        '',
        'null',
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
    const expectedRoundsUpdate = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND solo = false
      AND type = 'primary';`;
    const expectedRoundReset = `
      UPDATE "Pool-Bitcoin".current_metadata
      SET timestamp = 1634742080841, efficiency = 0,
        effort = 0, invalid = 0, stale = 0,
        valid = 0, work = 0
      WHERE solo = false AND type = 'primary';`;
    const expectedWorkersReset = `
      UPDATE "Pool-Bitcoin".current_workers
      SET timestamp = 1634742080841,
        effort = 0
      WHERE solo = false
      AND type = 'primary';`;
    const expecteHistoricalMetadataBlocks = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1,
        600000,
        1,
        'master',
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(8);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedMetadataBlocks);
      expect(transaction[3]).toBe(expectedRoundsUpdate);
      expect(transaction[4]).toBe(expectedRoundReset);
      expect(transaction[5]).toBe(expectedWorkersReset);
      expect(transaction[6]).toBe(expecteHistoricalMetadataBlocks);
      done();
    });
    rounds.handlePrimary(lookups, shares, () => {});
  });

  test('Test rounds auxiliary updates [1]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const workers = { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]};
    const lookups = [null, null, { rows: [{ identifier: 'master', work: 1 }]}, null, workers, null, null, null];
    const shares = [{
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
    }];
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
        1634742080841,
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
        'auxiliary')
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
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".current_metadata.blocks + EXCLUDED.blocks;`;
    const expectedRoundsUpdate = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND solo = false
      AND type = 'auxiliary';`;
    const expectedRoundReset = `
      UPDATE "Pool-Bitcoin".current_metadata
      SET timestamp = 1634742080841, efficiency = 0,
        effort = 0, invalid = 0, stale = 0,
        valid = 0, work = 0
      WHERE solo = false AND type = 'auxiliary';`;
    const expectedWorkersReset = `
      UPDATE "Pool-Bitcoin".current_workers
      SET timestamp = 1634742080841,
        effort = 0
      WHERE solo = false
      AND type = 'auxiliary';`;
    const expecteHistoricalMetadataBlocks = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1,
        600000,
        1,
        'master',
        false,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(8);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedMetadataBlocks);
      expect(transaction[3]).toBe(expectedRoundsUpdate);
      expect(transaction[4]).toBe(expectedRoundReset);
      expect(transaction[5]).toBe(expectedWorkersReset);
      expect(transaction[6]).toBe(expecteHistoricalMetadataBlocks);
      done();
    });
    rounds.handleAuxiliary(lookups, shares, () => {});
  });

  test('Test rounds auxiliary updates [2]', (done) => {
    MockDate.set(1634742080841);
    configCopy.ports[0].type = 'solo';
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const workers = { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]};
    const lookups = [null, null, { rows: [{ identifier: 'master', work: 1 }]}, null, workers, null, null, null];
    const shares = [{
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
    }];
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
        1634742080841,
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
        'auxiliary')
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
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".current_metadata.blocks + EXCLUDED.blocks;`;
    const expectedRoundsUpdate = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND miner = 'primary'
      AND solo = true AND type = 'auxiliary';`;
    const expectedRoundReset = `
      UPDATE "Pool-Bitcoin".current_miners
      SET timestamp = 1634742080841,
        solo_effort = 0
      WHERE miner = 'primary'
      AND type = 'auxiliary';`;
    const expectedWorkersReset = `
      UPDATE "Pool-Bitcoin".current_workers
      SET timestamp = 1634742080841,
        effort = 0
      WHERE miner = 'primary'
      AND solo = true
      AND type = 'auxiliary';`;
    const expecteHistoricalMetadataBlocks = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1,
        600000,
        1,
        'master',
        true,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(8);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedMetadataBlocks);
      expect(transaction[3]).toBe(expectedRoundsUpdate);
      expect(transaction[4]).toBe(expectedRoundReset);
      expect(transaction[5]).toBe(expectedWorkersReset);
      expect(transaction[6]).toBe(expecteHistoricalMetadataBlocks);
      done();
    });
    rounds.handleAuxiliary(lookups, shares, () => {});
  });

  test('Test rounds auxiliary updates [3]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    const lookups = [null, null, { rows: []}, null, { rows: []}, null, null, null];
    const shares = [{
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
    }];
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
        1634742080841,
        '',
        'null',
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
        'auxiliary')
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
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".current_metadata.blocks + EXCLUDED.blocks;`;
    const expectedRoundsUpdate = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND solo = false
      AND type = 'auxiliary';`;
    const expectedRoundReset = `
      UPDATE "Pool-Bitcoin".current_metadata
      SET timestamp = 1634742080841, efficiency = 0,
        effort = 0, invalid = 0, stale = 0,
        valid = 0, work = 0
      WHERE solo = false AND type = 'auxiliary';`;
    const expectedWorkersReset = `
      UPDATE "Pool-Bitcoin".current_workers
      SET timestamp = 1634742080841,
        effort = 0
      WHERE solo = false
      AND type = 'auxiliary';`;
    const expecteHistoricalMetadataBlocks = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1,
        600000,
        1,
        'master',
        false,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(8);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedMetadataBlocks);
      expect(transaction[3]).toBe(expectedRoundsUpdate);
      expect(transaction[4]).toBe(expectedRoundReset);
      expect(transaction[5]).toBe(expectedWorkersReset);
      expect(transaction[6]).toBe(expecteHistoricalMetadataBlocks);
      done();
    });
    rounds.handleAuxiliary(lookups, shares, () => {});
  });

  test('Test rounds segment handling [1]', (done) => {
    MockDate.set(1634742080841);
    const lookups = [
      null,
      { rows: [{ work: 1 }]},
      { rows: [{ work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
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
    rounds.handleSegments([share, share, share], () => done());
  });

  test('Test rounds segment handling [2]', (done) => {
    MockDate.set(1634742080841);
    const lookups = [
      null,
      { rows: [{ work: 1 }]},
      { rows: [{ work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
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
    rounds.handleSegments([share], () => done());
  });

  test('Test rounds segment handling [3]', (done) => {
    MockDate.set(1634742080841);
    const lookups = [
      null,
      { rows: [{ work: 1 }]},
      { rows: [{ work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
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
    rounds.handleSegments([share], () => done());
  });

  test('Test rounds segment handling [4]', (done) => {
    MockDate.set(1634742080841);
    const lookups = [
      null,
      { rows: [{ work: 1 }]},
      { rows: [{ work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
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
    rounds.handleSegments([share], () => done());
  });

  test('Test rounds segment handling [5]', (done) => {
    MockDate.set(1634742080841);
    const lookups = [
      null,
      { rows: [{ work: 1 }]},
      { rows: [{ work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
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
    rounds.handleSegments([share], () => done());
  });

  test('Test rounds segment handling [6]', (done) => {
    MockDate.set(1634742080841);
    const lookups = [
      null,
      { rows: [{ work: 1 }]},
      { rows: [{ work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
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
    rounds.handleSegments([share], () => done());
  });

  test('Test rounds segment handling [7]', (done) => {
    MockDate.set(1634742080841);
    const lookups = [
      null,
      { rows: [{ work: 1 }]},
      { rows: [{ work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      { rows: [{ miner: 'primary', worker: 'primary', work: 1 }]},
      null,
    ];
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const rounds = new Rounds(logger, client, configCopy, configMainCopy);
    rounds.handleSegments([], () => done());
  });
});