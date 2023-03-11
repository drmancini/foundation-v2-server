const Commands = require('../../database/main/master/commands');
const Logger = require('../main/logger');
const MockDate = require('mockdate');
const Shares = require('../main/shares');
const config = require('../../configs/pools/example.js');
const configMain = require('../../configs/main/example.js');
const events = require('events');

// Mock UUID Events
jest.mock('uuid', () => ({ v4: () => '123456789' }));

////////////////////////////////////////////////////////////////////////////////

function mockClient(configMain, result) {
  const client = new events.EventEmitter();
  client.master = {};
  client.master.commands = new Commands(null, null, configMain);
  client.master.commands.executor = (commands, callback) => {
    client.emit('transaction', commands);
    callback(result);
  };
  return client;
}

////////////////////////////////////////////////////////////////////////////////

describe('Test shares functionality', () => {

  let configCopy, configMainCopy;
  beforeEach(() => {
    configCopy = JSON.parse(JSON.stringify(config));
    configMainCopy = JSON.parse(JSON.stringify(configMain));
  });

  test('Test initialization of shares', () => {
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    expect(typeof shares.handleEfficiency).toBe('function');
    expect(typeof shares.handleEffort).toBe('function');
    expect(typeof shares.handleEffortIncrement).toBe('function');
    expect(typeof shares.handleTimes).toBe('function');
    expect(typeof shares.handleTimesIncrement).toBe('function');
    expect(typeof shares.handleCurrentBlocks).toBe('function');
    expect(typeof shares.handleCurrentHashrate).toBe('function');
    expect(typeof shares.handleCurrentMetadata).toBe('function');
    expect(typeof shares.handleCurrentRounds).toBe('function');
  });

  test('Test shares database updates [1]', () => {
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    expect(shares.handleEfficiency({ valid: 0, invalid: 0, stale: 0 }, 'valid')).toBe(100);
    expect(shares.handleEfficiency({ valid: 1, invalid: 0, stale: 0 }, 'valid')).toBe(100);
    expect(shares.handleEfficiency({ valid: 0, invalid: 1, stale: 0 }, 'valid')).toBe(50);
    expect(shares.handleEfficiency({ valid: 1, invalid: 1, stale: 0 }, 'valid')).toBe(66.67);
    expect(shares.handleEfficiency({ valid: 1, invalid: 0, stale: 1 }, 'valid')).toBe(66.67);
    expect(shares.handleEfficiency({}, 'valid')).toBe(100);
    expect(shares.handleEfficiency({}, 'invalid')).toBe(0);
  });

  test('Test shares database updates [2]', () => {
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    expect(shares.handleEffort(100, 10 , 'valid', 100)).toBe(110);
    expect(shares.handleEffort(100, 10 , 'invalid', 100)).toBe(100);
    expect(shares.handleEffort(100, undefined, 'valid', 100)).toBe(100);
    expect(shares.handleEffort(0, undefined, 'invalid', 100)).toBe(0);
  });

  test('Test shares database updates [3]', () => {
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    expect(shares.handleEffortIncrement(10, 'valid', 100)).toBe(10);
    expect(shares.handleEffortIncrement(10, 'invalid', 100)).toBe(0);
    expect(shares.handleEffortIncrement(undefined, 'valid', 100)).toBe(0);
    expect(shares.handleEffortIncrement(undefined, 'invalid', 100)).toBe(0);
  });

  test('Test shares database updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    expect(shares.handleTimes({}, 1634742290841)).toBe(210);
    expect(shares.handleTimes({ timestamp: 1634742080841}, 1634742290841)).toBe(210);
    expect(shares.handleTimes({ times: 145 }, 1634742290841)).toBe(355);
    expect(shares.handleTimes({ timestamp: 1634742080841, times: 145 }, 1634742370841)).toBe(435);
    expect(shares.handleTimes({ timestamp: 1634742080841, times: 0 }, 1634742370841)).toBe(290);
    expect(shares.handleTimes({ timestamp: 1634742080841, times: 145 }, 1634842370841)).toBe(145);
  });

  test('Test shares database updates [5]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    expect(shares.handleTimesIncrement({}, 1634742290841)).toBe(210);
    expect(shares.handleTimesIncrement({ timestamp: 1634742080841 }, 1634742180841)).toBe(100);
    expect(shares.handleTimesIncrement({ timestamp: 1634742080841 }, 1634842370841)).toBe(0);
  });

  test('Test shares database updates [6]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = { difficulty: 10, hash: 'hash', height: 1, identifier: 'master', transaction: 'transaction1' };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      miner: 'miner1',
      worker: 'miner1.worker1',
      category: 'pending',
      confirmations: -1,
      difficulty: 200,
      hash: 'hash',
      height: 1,
      identifier: 'master',
      luck:  50,
      reward: 0,
      round: 'round',
      solo: false,
      transaction: 'transaction1',
      type: 'primary',
    };
    expect(shares.handleCurrentBlocks(90, 'miner1.worker1', 200, 'round', shareData, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [5]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = { hash: 'hash', height: 1, transaction: 'transaction1' };
    const expected = {
      timestamp: 1634742080841,
      submitted: 1634742080841,
      miner: '',
      worker: null,
      category: 'pending',
      confirmations: -1,
      difficulty: 150,
      hash: 'hash',
      height: 1,
      identifier: 'master',
      luck:  66.67,
      reward: 0,
      round: 'round',
      solo: false,
      transaction: 'transaction1',
      type: 'primary',
    };
    expect(shares.handleCurrentBlocks(100, null, 150, 'round', shareData, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [6]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = { identifier: 'master' };
    const expected = {
      timestamp: 1634742080841,
      miner: 'miner1',
      worker: 'miner1',
      identifier: 'master',
      share: 'valid',
      solo: false,
      type: 'primary',
      work: 1,
    };
    expect(shares.handleCurrentHashrate('miner1', 1, shareData, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [7]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const expected = {
      timestamp: 1634742080841,
      miner: 'miner1',
      worker: 'miner1',
      identifier: 'master',
      share: 'invalid',
      solo: false,
      type: 'primary',
      work: 0,
    };
    expect(shares.handleCurrentHashrate('miner1', 1, {}, 'invalid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [8]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = {};
    const expected = {
      timestamp: 1634742080841,
      miner: '',
      worker: null,
      identifier: 'master',
      share: 'valid',
      solo: false,
      type: 'primary',
      work: 1,
    };
    expect(shares.handleCurrentHashrate(null, 1, shareData, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [9]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const roundData = { valid: 1, invalid: 0, stale: 0 };
    const shareData = { difficulty: 1, solo: false };
    const expected = {
      timestamp: 1634742080841,
      efficiency: 100,
      effort: 151,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 1,
    };
    expect(shares.handleCurrentMetadata(150, 100, roundData, shareData, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [10]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const roundData = { valid: 1, invalid: 0, stale: 0 };
    const shareData = { difficulty: 1, solo: true };
    const expected = {
      timestamp: 1634742080841,
      efficiency: 0,
      effort: 0,
      identifier: 'master',
      invalid: 0,
      solo: true,
      stale: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    };
    expect(shares.handleCurrentMetadata(150, 100, roundData, shareData, 'valid', true, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [11]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const roundData = { valid: 1, invalid: 0, stale: 0 };
    const shareData = { difficulty: 1 };
    const expected = {
      timestamp: 1634742080841,
      efficiency: 50,
      effort: 150,
      identifier: 'master',
      invalid: 1,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    };
    expect(shares.handleCurrentMetadata(150, 100, roundData, shareData, 'invalid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [12]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const roundData = { valid: 1, invalid: 0, stale: 0 };
    const shareData = { difficulty: 1 };
    const expected = {
      timestamp: 1634742080841,
      efficiency: 50,
      effort: 150,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 1,
      type: 'primary',
      valid: 0,
      work: 0,
    };
    expect(shares.handleCurrentMetadata(150, 100, roundData, shareData, 'stale', false, 'primary')).toStrictEqual(expected);
  });

  // test('Test shares database updates [13]', () => {
  //   MockDate.set(1634742080841);
  //   const client = mockClient(configMainCopy, { rows: [] });
  //   const logger = new Logger(configMainCopy);
  //   const shares = new Shares(logger, client, configCopy, configMainCopy);
  //   const shareData = { difficulty: 1 };
  //   const expected = {
  //     timestamp: 1634742080841,
  //     miner: 'miner1',
  //     solo_effort: 0.6667,
  //     type: 'primary',
  //   };
  //   expect(shares.handleCurrentSoloMiners('miner1', 150, shareData, 'valid', 'primary')).toStrictEqual(expected);
  // });

  // test('Test shares database updates [14]', () => {
  //   MockDate.set(1634742080841);
  //   const client = mockClient(configMainCopy, { rows: [] });
  //   const logger = new Logger(configMainCopy);
  //   const shares = new Shares(logger, client, configCopy, configMainCopy);
  //   const shareData = { difficulty: 1 };
  //   const expected = {
  //     timestamp: 1634742080841,
  //     miner: '',
  //     solo_effort: 0.6667,
  //     type: 'primary',
  //   };
  //   expect(shares.handleCurrentSoloMiners(null, 150, shareData, 'valid', 'primary')).toStrictEqual(expected);
  // });

  test('Test shares database updates [15]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const workerData = { timestamp: 1634742080000, times: 0 };
    const shareData = { identifier: 'master', difficulty: 1 };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742120000,
      miner: 'miner1',
      worker: 'miner1',
      identifier: 'master',
      invalid: 0,
      round: 'current',
      solo: false,
      stale: 0,
      times: 0.841,
      type: 'primary',
      valid: 1,
      work: 1,
    };
    expect(shares.handleCurrentRounds('miner1', workerData, shareData, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [16]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const workerData = { timestamp: 1634742080000, times: 0 };
    const shareData = { difficulty: 1 };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742120000,
      miner: '',
      worker: null,
      identifier: 'master',
      invalid: 0,
      round: 'current',
      solo: false,
      stale: 0,
      times: 0.841,
      times_increment: 0.841,
      type: 'primary',
      valid: 1,
      work: 1,
    };
    expect(shares.handleCurrentRounds(null, workerData, shareData, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [17]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const workerData = { timestamp: 1634742080000, times: 0 };
    const shareData = { identifier: 'master', difficulty: 1 };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742120000,
      miner: '',
      worker: null,
      identifier: 'master',
      invalid: 1,
      round: 'current',
      solo: false,
      stale: 0,
      times: 0,
      times_increment: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    };
    expect(shares.handleCurrentRounds(null, workerData, shareData, 'invalid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [18]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const workerData = { timestamp: 1634742080000, times: 0 };
    const shareData = { identifier: 'master', difficulty: 1 };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742120000,
      miner: '',
      worker: null,
      identifier: 'master',
      invalid: 0,
      round: 'current',
      solo: false,
      stale: 1,
      times: 0,
      times_increment: 0,
      type: 'primary',
      valid: 0,
      work: 0,
    };
    expect(shares.handleCurrentRounds(null, workerData, shareData, 'stale', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [19]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = { difficulty: 1, ip: '1.1.1.1' };
    const expected = {
      timestamp: 1634742080841,
      miner: 'miner1',
      worker: 'miner1',
      effort: 0.6667,
      identifier: 'master',
      ip_hash: '409629a08b9b3f3be610b8832cc28822f964410f',
      last_octet: 1,
      last_share: 1634742080841,
      offline_tag: false,
      solo: false,
      type: 'primary',
    };
    expect(shares.handleCurrentWorkers('miner1', 150, shareData, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [20]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = { difficulty: 1, identifier: 'master', ip: '1.1.1.1' };
    const expected = {
      timestamp: 1634742080841,
      miner: '',
      worker: null,
      effort: 0.6667,
      identifier: 'master',
      ip_hash: '409629a08b9b3f3be610b8832cc28822f964410f',
      last_octet: 1,
      last_share: 1634742080841,
      offline_tag: false,
      solo: false,
      type: 'primary',
    };
    expect(shares.handleCurrentWorkers(null, 150, shareData, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [21]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = { difficulty: 1, identifier: 'master', ip: '1.1.1.1' };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'miner1',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 1,
    };
    expect(shares.handleHistoricalMiners('miner1', shareData, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [22]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = { difficulty: 1, identifier: 'master', ip: '1.1.1.1' };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: '',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 1,
    };
    expect(shares.handleHistoricalMiners(null, shareData, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [23]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = { difficulty: 1, identifier: 'master', ip: '1.1.1.1' };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'worker1',
      worker: 'worker1',
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 1,
    };
    expect(shares.handleHistoricalWorkers('worker1', shareData, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares database updates [23]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = { difficulty: 1, identifier: 'master', ip: '1.1.1.1' };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: '',
      worker: null,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 1,
    };
    expect(shares.handleHistoricalWorkers(null, shareData, 'valid', false, 'primary')).toStrictEqual(expected);
  });

  test('Test shares primary updates [1]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const lookups = [null, { rows: [{ work: 100 }] }, null, { rows: [{ work: 100 }] }, null, null];
    const shareData = { addrPrimary: 'miner1', blockDiffPrimary: 150, hash: 'hash', height: 1, identifier: 'master', transaction: 'transaction1' };
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
        'miner1',
        'miner1',
        'pending',
        -1,
        150,
        'hash',
        1,
        'master',
        66.67,
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
    const expectedCurrentMetadata = `
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
    const expectedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1634742080841,
        1634742600000,
        1,
        'master',
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    const expectedMetadata = `
      UPDATE "Pool-Bitcoin".current_metadata
      SET timestamp = 1634742080841, efficiency = 0,
        effort = 0, invalid = 0, stale = 0,
        valid = 0, work = 0
      WHERE solo = false AND type = 'primary';`;
    const expectedWorkers = `
      UPDATE "Pool-Bitcoin".current_workers
      SET timestamp = 1634742080841,
        effort = 0
      WHERE solo = false
      AND type = 'primary';`;
    const expectedPrimary = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND solo = false
      AND type = 'primary';`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(8);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedCurrentMetadata);
      expect(transaction[3]).toBe(expectedHistoricalMetadata);
      expect(transaction[4]).toBe(expectedWorkers);
      expect(transaction[5]).toBe(expectedPrimary);
      expect(transaction[6]).toBe(expectedMetadata);
      done();
    });
    shares.handlePrimary(lookups, shareData, 'valid', false, () => {});
  });

  test('Test shares primary updates [2]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const lookups = [null, { rows: [] }, null, { rows: [] }, null, null];
    const shareData = { addrPrimary: null, blockDiffPrimary: null, hash: 'hash', height: 1, transaction: 'transaction1' };
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
        null,
        'hash',
        1,
        'master',
        0,
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
    const expectedCurrentMetadata = `
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
    const expectedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1634742080841,
        1634742600000,
        1,
        'master',
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    const expectedReset = `
      UPDATE "Pool-Bitcoin".current_workers
      SET timestamp = 1634742080841,
        effort = 0
      WHERE solo = false
      AND type = 'primary';`;
    const expectedMetadata = `
      UPDATE "Pool-Bitcoin".current_metadata
      SET timestamp = 1634742080841, efficiency = 0,
        effort = 0, invalid = 0, stale = 0,
        valid = 0, work = 0
      WHERE solo = false AND type = 'primary';`;
    const expectedPrimary = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND solo = false
      AND type = 'primary';`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(8);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedCurrentMetadata);
      expect(transaction[3]).toBe(expectedHistoricalMetadata);
      expect(transaction[4]).toBe(expectedReset);
      expect(transaction[5]).toBe(expectedPrimary);
      expect(transaction[6]).toBe(expectedMetadata);
      done();
    });
    shares.handlePrimary(lookups, shareData, 'valid', false, () => {});
  });

  test('Test shares primary updates [3]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const lookups = [null, { rows: [{ work: 100 }] }, null, { rows: [{ work: 100 }] }, null, null];
    const shareData = { addrPrimary: 'miner1', blockDiffPrimary: 150, hash: 'hash', height: 1, identifier: 'master', solo: false, transaction: 'transaction1' };
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
        'miner1',
        'miner1',
        'pending',
        -1,
        150,
        'hash',
        1,
        'master',
        66.67,
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
    const expectedCurrentMetadata = `
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
    const expectedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1634742080841,
        1634742600000,
        1,
        'master',
        true,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    const expectedReset = `
      UPDATE "Pool-Bitcoin".current_workers
      SET timestamp = 1634742080841,
        effort = 0
      WHERE miner = 'miner1'
      AND solo = true
      AND type = 'primary';`;
    const expectedMiners = `
      UPDATE "Pool-Bitcoin".current_miners
      SET timestamp = 1634742080841,
        solo_effort = 0
      WHERE miner = 'miner1'
      AND type = 'primary';`;
    const expectedPrimary = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND miner = 'miner1'
      AND solo = true AND type = 'primary';`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(8);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedCurrentMetadata);
      expect(transaction[3]).toBe(expectedHistoricalMetadata);
      expect(transaction[4]).toBe(expectedReset);
      expect(transaction[5]).toBe(expectedPrimary);
      expect(transaction[6]).toBe(expectedMiners);
      done();
    });
    shares.handlePrimary(lookups, shareData, 'valid', true, () => {});
  });

  test('Test shares primary updates [4]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const lookups = [null, { rows: [] }, null, { rows: [] }, null, null];
    const shareData = { addrPrimary: null, blockDiffPrimary: null, hash: 'hash', height: 1, transaction: 'transaction1' };
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
        null,
        'hash',
        1,
        'master',
        0,
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
    const expectedCurrentMetadata = `
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
    const expectedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1634742080841,
        1634742600000,
        1,
        'master',
        true,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    const expectedWorkers = `
      UPDATE "Pool-Bitcoin".current_workers
      SET timestamp = 1634742080841,
        effort = 0
      WHERE miner = ''
      AND solo = true
      AND type = 'primary';`;
    const expectedMiners = `
      UPDATE "Pool-Bitcoin".current_miners
      SET timestamp = 1634742080841,
        solo_effort = 0
      WHERE miner = ''
      AND type = 'primary';`;
    const expectedPrimary = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND miner = ''
      AND solo = true AND type = 'primary';`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(8);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedCurrentMetadata);
      expect(transaction[3]).toBe(expectedHistoricalMetadata);
      expect(transaction[4]).toBe(expectedWorkers);
      expect(transaction[5]).toBe(expectedPrimary);
      expect(transaction[6]).toBe(expectedMiners);
      done();
    });
    shares.handlePrimary(lookups, shareData, 'valid', true, () => {});
  });

  test('Test shares auxiliary updates [1]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const lookups = [null, null, { rows: [{ work: 100 }] }, null, { rows: [{ work: 100 }] }, null];
    const shareData = { addrAuxiliary: 'miner1', blockDiffAuxiliary: 150, hash: 'hash', height: 1, identifier: 'master', transaction: 'transaction1' };
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
        'miner1',
        'miner1',
        'pending',
        -1,
        150,
        'hash',
        1,
        'master',
        66.67,
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
    const expectedCurrentMetadata = `
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
    const expectedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1634742080841,
        1634742600000,
        1,
        'master',
        false,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    const expectedMetadata = `
      UPDATE "Pool-Bitcoin".current_metadata
      SET timestamp = 1634742080841, efficiency = 0,
        effort = 0, invalid = 0, stale = 0,
        valid = 0, work = 0
      WHERE solo = false AND type = 'auxiliary';`;
    const expectedWorkers = `
      UPDATE "Pool-Bitcoin".current_workers
      SET timestamp = 1634742080841,
        effort = 0
      WHERE solo = false
      AND type = 'auxiliary';`;
    const expectedAuxiliary = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND solo = false
      AND type = 'auxiliary';`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(8);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedCurrentMetadata);
      expect(transaction[3]).toBe(expectedHistoricalMetadata);
      expect(transaction[4]).toBe(expectedWorkers);
      expect(transaction[5]).toBe(expectedAuxiliary);
      expect(transaction[6]).toBe(expectedMetadata);
      done();
    });
    shares.handleAuxiliary(lookups, shareData, 'valid', false, () => {});
  });

  test('Test shares auxiliary updates [2]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const lookups = [null, null, { rows: [] }, null, { rows: [] }, null];
    const shareData = { addrAuxiliary: null, blockDiffAuxiliary: null, hash: 'hash', height: 1, transaction: 'transaction1' };
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
        null,
        'hash',
        1,
        'master',
        0,
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
    const expectedCurrentMetadata = `
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
    const expectedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1634742080841,
        1634742600000,
        1,
        'master',
        false,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    const expectedReset = `
      UPDATE "Pool-Bitcoin".current_workers
      SET timestamp = 1634742080841,
        effort = 0
      WHERE solo = false
      AND type = 'auxiliary';`;
    const expectedMetadata = `
      UPDATE "Pool-Bitcoin".current_metadata
      SET timestamp = 1634742080841, efficiency = 0,
        effort = 0, invalid = 0, stale = 0,
        valid = 0, work = 0
      WHERE solo = false AND type = 'auxiliary';`;
    const expectedAuxiliary = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND solo = false
      AND type = 'auxiliary';`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(8);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedCurrentMetadata);
      expect(transaction[3]).toBe(expectedHistoricalMetadata);
      expect(transaction[4]).toBe(expectedReset);
      expect(transaction[5]).toBe(expectedAuxiliary);
      expect(transaction[6]).toBe(expectedMetadata);
      done();
    });
    shares.handleAuxiliary(lookups, shareData, 'valid', false, () => {});
  });

  test('Test shares auxiliary updates [3]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const lookups = [null, null, { rows: [{ work: 100 }] }, null, { rows: [{ work: 100 }] }, null];
    const shareData = { addrAuxiliary: 'miner1', blockDiffAuxiliary: 150, hash: 'hash', height: 1, identifier: 'master', transaction: 'transaction1' };
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
        'miner1',
        'miner1',
        'pending',
        -1,
        150,
        'hash',
        1,
        'master',
        66.67,
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
    const expectedCurrentMetadata = `
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
    const expectedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1634742080841,
        1634742600000,
        1,
        'master',
        true,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    const expectedReset = `
      UPDATE "Pool-Bitcoin".current_workers
      SET timestamp = 1634742080841,
        effort = 0
      WHERE miner = 'miner1'
      AND solo = true
      AND type = 'auxiliary';`;
    const expectedMiners = `
      UPDATE "Pool-Bitcoin".current_miners
      SET timestamp = 1634742080841,
        solo_effort = 0
      WHERE miner = 'miner1'
      AND type = 'auxiliary';`;
    const expectedAuxiliary = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND miner = 'miner1'
      AND solo = true AND type = 'auxiliary';`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(8);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedCurrentMetadata);
      expect(transaction[3]).toBe(expectedHistoricalMetadata);
      expect(transaction[4]).toBe(expectedReset);
      expect(transaction[5]).toBe(expectedAuxiliary);
      expect(transaction[6]).toBe(expectedMiners);
      done();
    });
    shares.handleAuxiliary(lookups, shareData, 'valid', true, () => {});
  });

  test('Test shares auxiliary updates [4]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const lookups = [null, null, { rows: [] }, null, { rows: [] }, null];
    const shareData = { addrAuxiliary: null, blockDiffAuxiliary: null, hash: 'hash', height: 1, transaction: 'transaction1' };
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
        null,
        'hash',
        1,
        'master',
        0,
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
    const expectedCurrentMetadata = `
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
    const expectedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1634742080841,
        1634742600000,
        1,
        'master',
        true,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Bitcoin".historical_metadata.blocks + EXCLUDED.blocks;`;
    const expectedReset = `
      UPDATE "Pool-Bitcoin".current_workers
      SET timestamp = 1634742080841,
        effort = 0
      WHERE miner = ''
      AND solo = true
      AND type = 'auxiliary';`;
    const expectedMiners = `
      UPDATE "Pool-Bitcoin".current_miners
      SET timestamp = 1634742080841,
        solo_effort = 0
      WHERE miner = ''
      AND type = 'auxiliary';`;
    const expectedWorkers = `
      UPDATE "Pool-Bitcoin".current_workers
      SET timestamp = 1634742080841,
        effort = 0
      WHERE miner = ''
      AND solo = true
      AND type = 'auxiliary';`;
    const expectedAuxiliary = `
      UPDATE "Pool-Bitcoin".current_rounds
      SET round = '123456789'
      WHERE round = 'current' AND miner = ''
      AND solo = true AND type = 'auxiliary';`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(8);
      expect(transaction[1]).toBe(expectedBlocks);
      expect(transaction[2]).toBe(expectedCurrentMetadata);
      expect(transaction[3]).toBe(expectedHistoricalMetadata);
      expect(transaction[4]).toBe(expectedReset);
      expect(transaction[5]).toBe(expectedAuxiliary);
      expect(transaction[6]).toBe(expectedMiners);
      done();
    });
    shares.handleAuxiliary(lookups, shareData, 'valid', true, () => {});
  });

  test('Test shares updates [1]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const lookups = [
      null,
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ }] },
      null];
    const shareData = {
      addrPrimary: 'primary1',
      addrAuxiliary: 'auxiliary1',
      blockDiffPrimary: 150,
      blockDiffAuxiliary: 150,
      difficulty: 1,
      identifier: 'master',
    };
    const expectedHashrate = `
      INSERT INTO "Pool-Bitcoin".current_hashrate (
        timestamp, miner, worker,
        identifier, share, solo,
        type, work)
      VALUES (
        1634742080841,
        'primary1',
        'primary1',
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
        0.6667,
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
    const expectedRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, recent, miner,
        worker, identifier, invalid,
        round, solo, stale, times,
        times_increment, type,
        valid, work)
      VALUES (
        1634742080841,
        1634742120000,
        'primary1',
        'primary1',
        'master',
        0,
        'current',
        false,
        0,
        0,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT current_rounds_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".current_rounds.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".current_rounds.stale + EXCLUDED.stale,
        times = GREATEST("Pool-Bitcoin".current_rounds.times, EXCLUDED.times),
        times_increment = "Pool-Bitcoin".current_rounds.times_increment + EXCLUDED.times_increment,
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
        'primary1',
        'primary1',
        0.6667,
        'master',
        'unknown',
        -1,
        1634742080841,
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
    const expectedHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        solo, stale, type, valid,
        work)
      VALUES (
        1634742080841,
        1634742600000,
        'primary1',
        'primary1',
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
    const expectedHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale, type,
        valid, work)
      VALUES (
        1634742080841,
        1634742600000,
        'primary1',
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
    const expectedMiners = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, type)
      VALUES (
        1634742080841,
        'primary1',
        'primary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO NOTHING;`;
    const expectedUsers = `
      INSERT INTO "Pool-Bitcoin".current_users (
        miner, joined, payout_limit)
      VALUES (
        'primary1',
        1634742080841,
        0.005)
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(11);
      expect(transaction[1]).toBe(expectedHashrate);
      expect(transaction[2]).toBe(expectedMetadata);
      expect(transaction[3]).toBe(expectedRounds);
      expect(transaction[4]).toBe(expectedWorkers);
      expect(transaction[5]).toBe(expectedHistoricalWorkers);
      expect(transaction[6]).toBe(expectedHistoricalMiners);
      expect(transaction[7]).toBe(expectedHistoricalMetadata);
      expect(transaction[8]).toBe(expectedMiners);
      expect(transaction[9]).toBe(expectedUsers);
      done();
    });
    shares.handleShares(lookups, shareData, 'valid', false, () => {});
  });

  test('Test shares updates [2]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const lookups = [null, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, null];
    const shareData = {
      addrPrimary: 'primary1',
      addrAuxiliary: 'auxiliary1',
      blockDiffPrimary: 150,
      blockDiffAuxiliary: 150,
      difficulty: 1,
      identifier: 'master',
    };
    const expectedHashrate = `
      INSERT INTO "Pool-Bitcoin".current_hashrate (
        timestamp, miner, worker,
        identifier, share, solo,
        type, work)
      VALUES (
        1634742080841,
        'primary1',
        'primary1',
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
        0.6667,
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
    const expectedRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, recent, miner,
        worker, identifier, invalid,
        round, solo, stale, times,
        times_increment, type,
        valid, work)
      VALUES (
        1634742080841,
        1634742120000,
        'primary1',
        'primary1',
        'master',
        0,
        'current',
        false,
        0,
        0,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT current_rounds_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".current_rounds.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".current_rounds.stale + EXCLUDED.stale,
        times = GREATEST("Pool-Bitcoin".current_rounds.times, EXCLUDED.times),
        times_increment = "Pool-Bitcoin".current_rounds.times_increment + EXCLUDED.times_increment,
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
        'primary1',
        'primary1',
        0.6667,
        'master',
        'unknown',
        -1,
        1634742080841,
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
    const expectedHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        solo, stale, type, valid,
        work)
      VALUES (
        1634742080841,
        1634742600000,
        'primary1',
        'primary1',
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
    const expectedHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale, type,
        valid, work)
      VALUES (
        1634742080841,
        1634742600000,
        'primary1',
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
    const expectedMiners = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, type)
      VALUES (
        1634742080841,
        'primary1',
        'primary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO NOTHING;`;
    const expectedUsers = `
      INSERT INTO "Pool-Bitcoin".current_users (
        miner, joined, payout_limit)
      VALUES (
        'primary1',
        1634742080841,
        0.005)
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(11);
      expect(transaction[1]).toBe(expectedHashrate);
      expect(transaction[2]).toBe(expectedMetadata);
      expect(transaction[3]).toBe(expectedRounds);
      expect(transaction[4]).toBe(expectedWorkers);
      expect(transaction[5]).toBe(expectedHistoricalWorkers);
      expect(transaction[6]).toBe(expectedHistoricalMiners);
      expect(transaction[7]).toBe(expectedHistoricalMetadata);
      expect(transaction[8]).toBe(expectedMiners);
      expect(transaction[9]).toBe(expectedUsers);
      done();
    });
    shares.handleShares(lookups, shareData, 'valid', false, () => {});
  });

  test('Test shares updates [3]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const lookups = [
      null,
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [] },
      null];
    const shareData = {
      addrPrimary: 'primary1',
      addrAuxiliary: 'auxiliary1',
      blockDiffPrimary: 150,
      blockDiffAuxiliary: 150,
      difficulty: 1,
      identifier: 'master',
    };
    const expectedHashrate = `
      INSERT INTO "Pool-Bitcoin".current_hashrate (
        timestamp, miner, worker,
        identifier, share, solo,
        type, work)
      VALUES (
        1634742080841,
        'primary1',
        'primary1',
        'master',
        'valid',
        true,
        'primary',
        1);`;
    const expectedMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, efficiency, effort,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES (
        1634742080841,
        0,
        0,
        'master',
        0,
        true,
        0,
        'primary',
        0,
        0)
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
        'primary1',
        0.6667,
        'primary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        solo_effort = "Pool-Bitcoin".current_miners.solo_effort + EXCLUDED.solo_effort;`;
    const expectedRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, recent, miner,
        worker, identifier, invalid,
        round, solo, stale, times,
        times_increment, type,
        valid, work)
      VALUES (
        1634742080841,
        1634742120000,
        'primary1',
        'primary1',
        'master',
        0,
        'current',
        true,
        0,
        0,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT current_rounds_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".current_rounds.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".current_rounds.stale + EXCLUDED.stale,
        times = GREATEST("Pool-Bitcoin".current_rounds.times, EXCLUDED.times),
        times_increment = "Pool-Bitcoin".current_rounds.times_increment + EXCLUDED.times_increment,
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
        'primary1',
        'primary1',
        0.6667,
        'master',
        'unknown',
        -1,
        1634742080841,
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
    const expectedHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        solo, stale, type, valid,
        work)
      VALUES (
        1634742080841,
        1634742600000,
        'primary1',
        'primary1',
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
    const expectedHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale, type,
        valid, work)
      VALUES (
        1634742080841,
        1634742600000,
        'primary1',
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
      const expectedUsers = `
      INSERT INTO "Pool-Bitcoin".current_users (
        miner, joined, payout_limit)
      VALUES (
        'primary1',
        1634742080841,
        0.005)
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(11);
      expect(transaction[1]).toBe(expectedHashrate);
      expect(transaction[2]).toBe(expectedMetadata);
      expect(transaction[3]).toBe(expectedRounds);
      expect(transaction[4]).toBe(expectedWorkers);
      expect(transaction[5]).toBe(expectedHistoricalWorkers);
      expect(transaction[6]).toBe(expectedHistoricalMiners);
      expect(transaction[7]).toBe(expectedHistoricalMetadata);
      expect(transaction[8]).toBe(expectedMiners);
      expect(transaction[9]).toBe(expectedUsers);
      done();
    });
    shares.handleShares(lookups, shareData, 'valid', true, () => {});
  });

  test('Test shares updates [4]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const lookups = [null, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, null];
    const shareData = {
      addrPrimary: 'primary1',
      addrAuxiliary: 'auxiliary1',
      blockDiffPrimary: 150,
      blockDiffAuxiliary: 150,
      difficulty: 1,
      identifier: 'master',
    };
    const expectedHashrate = `
      INSERT INTO "Pool-Bitcoin".current_hashrate (
        timestamp, miner, worker,
        identifier, share, solo,
        type, work)
      VALUES (
        1634742080841,
        'primary1',
        'primary1',
        'master',
        'valid',
        true,
        'primary',
        1);`;
    const expectedMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, efficiency, effort,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES (
        1634742080841,
        0,
        0,
        'master',
        0,
        true,
        0,
        'primary',
        0,
        0)
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
        'primary1',
        0.6667,
        'primary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        solo_effort = "Pool-Bitcoin".current_miners.solo_effort + EXCLUDED.solo_effort;`;
    const expectedRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, recent, miner,
        worker, identifier, invalid,
        round, solo, stale, times,
        times_increment, type,
        valid, work)
      VALUES (
        1634742080841,
        1634742120000,
        'primary1',
        'primary1',
        'master',
        0,
        'current',
        true,
        0,
        0,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT current_rounds_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".current_rounds.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".current_rounds.stale + EXCLUDED.stale,
        times = GREATEST("Pool-Bitcoin".current_rounds.times, EXCLUDED.times),
        times_increment = "Pool-Bitcoin".current_rounds.times_increment + EXCLUDED.times_increment,
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
        'primary1',
        'primary1',
        0.6667,
        'master',
        'unknown',
        -1,
        1634742080841,
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
    const expectedHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        solo, stale, type, valid,
        work)
      VALUES (
        1634742080841,
        1634742600000,
        'primary1',
        'primary1',
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
    const expectedHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale, type,
        valid, work)
      VALUES (
        1634742080841,
        1634742600000,
        'primary1',
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
    const expectedUsers = `
      INSERT INTO "Pool-Bitcoin".current_users (
        miner, joined, payout_limit)
      VALUES (
        'primary1',
        1634742080841,
        0.005)
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(11);
      expect(transaction[1]).toBe(expectedHashrate);
      expect(transaction[2]).toBe(expectedMetadata);
      expect(transaction[3]).toBe(expectedRounds);
      expect(transaction[4]).toBe(expectedWorkers);
      expect(transaction[5]).toBe(expectedHistoricalWorkers);
      expect(transaction[6]).toBe(expectedHistoricalMiners);
      expect(transaction[7]).toBe(expectedHistoricalMetadata);
      expect(transaction[8]).toBe(expectedMiners);
      expect(transaction[9]).toBe(expectedUsers);
      done();
    });
    shares.handleShares(lookups, shareData, 'valid', true, () => {});
  });

  test('Test shares updates [5]', (done) => {
    MockDate.set(1634742080841);
    configCopy.auxiliary = { enabled: true };
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const lookups = [
      null,
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [] },
      null];
    const shareData = {
      addrPrimary: 'primary1',
      addrAuxiliary: 'auxiliary1',
      blockDiffPrimary: 150,
      blockDiffAuxiliary: 150,
      difficulty: 1,
      identifier: 'master',
      solo: false,
    };
    const expectedHashrate = `
      INSERT INTO "Pool-Bitcoin".current_hashrate (
        timestamp, miner, worker,
        identifier, share, solo,
        type, work)
      VALUES (
        1634742080841,
        'primary1',
        'primary1',
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
        0.6667,
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
        timestamp, miner, type)
      VALUES (
        1634742080841,
        'primary1',
        'primary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO NOTHING;`;
    const expectedRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, recent, miner,
        worker, identifier, invalid,
        round, solo, stale, times,
        times_increment, type,
        valid, work)
      VALUES (
        1634742080841,
        1634742120000,
        'primary1',
        'primary1',
        'master',
        0,
        'current',
        false,
        0,
        0,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT current_rounds_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".current_rounds.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".current_rounds.stale + EXCLUDED.stale,
        times = GREATEST("Pool-Bitcoin".current_rounds.times, EXCLUDED.times),
        times_increment = "Pool-Bitcoin".current_rounds.times_increment + EXCLUDED.times_increment,
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
        'primary1',
        'primary1',
        0.6667,
        'master',
        'unknown',
        -1,
        1634742080841,
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
    const expectedHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        solo, stale, type, valid,
        work)
      VALUES (
        1634742080841,
        1634742600000,
        'primary1',
        'primary1',
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
    const expectedHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale, type,
        valid, work)
      VALUES (
        1634742080841,
        1634742600000,
        'primary1',
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
    const expectedUsers = `
      INSERT INTO "Pool-Bitcoin".current_users (
        miner, joined, payout_limit)
      VALUES (
        'primary1',
        1634742080841,
        0.005)
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`;
    const expectedAuxHashrate = `
      INSERT INTO "Pool-Bitcoin".current_hashrate (
        timestamp, miner, worker,
        identifier, share, solo,
        type, work)
      VALUES (
        1634742080841,
        'auxiliary1',
        'auxiliary1',
        'master',
        'valid',
        false,
        'auxiliary',
        1);`;
    const expectedAuxMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, efficiency, effort,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES (
        1634742080841,
        100,
        67.33,
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
    const expectedAuxRounds = `
      INSERT INTO "Pool-Bitcoin".current_rounds (
        timestamp, recent, miner,
        worker, identifier, invalid,
        round, solo, stale, times,
        type, valid, work)
      VALUES (
        1634742080841,
        1634742120000,
        'auxiliary1',
        'auxiliary1',
        'master',
        0,
        'current',
        false,
        0,
        0,
        0,
        'auxiliary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT current_rounds_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Bitcoin".current_rounds.invalid + EXCLUDED.invalid,
        stale = "Pool-Bitcoin".current_rounds.stale + EXCLUDED.stale,
        times = GREATEST("Pool-Bitcoin".current_rounds.times, EXCLUDED.times),
        valid = "Pool-Bitcoin".current_rounds.valid + EXCLUDED.valid,
        work = "Pool-Bitcoin".current_rounds.work + EXCLUDED.work;`;
    const expectedAuxWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        effort, identifier,
        ip_hash, last_octet, last_share,
        offline_tag, solo, type)
      VALUES (
        1634742080841,
        'auxiliary1',
        'auxiliary1',
        0.6667,
        'master',
        'unknown',
        -1,
        1634742080841,
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
    const expectedAuxHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        solo, stale, type, valid,
        work)
      VALUES (
        1634742080841,
        1634742600000,
        'auxiliary1',
        'auxiliary1',
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
    const expectedAuxHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale, type,
        valid, work)
      VALUES (
        1634742080841,
        1634742600000,
        'auxiliary1',
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
    const expectedAuxHistoricalMetadata = `
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
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(19);
      expect(transaction[1]).toBe(expectedHashrate);
      expect(transaction[2]).toBe(expectedMetadata);
      expect(transaction[3]).toBe(expectedRounds);
      expect(transaction[4]).toBe(expectedWorkers);
      expect(transaction[5]).toBe(expectedHistoricalWorkers);
      expect(transaction[6]).toBe(expectedHistoricalMiners);
      expect(transaction[7]).toBe(expectedHistoricalMetadata);
      expect(transaction[8]).toBe(expectedMiners);
      expect(transaction[9]).toBe(expectedUsers);
      expect(transaction[10]).toBe(expectedAuxHashrate);
      expect(transaction[11]).toBe(expectedAuxMetadata);
      expect(transaction[12]).toBe(expectedAuxRounds);
      expect(transaction[13]).toBe(expectedAuxWorkers);
      expect(transaction[14]).toBe(expectedAuxHistoricalWorkers);
      expect(transaction[15]).toBe(expectedAuxHistoricalMiners);
      expect(transaction[16]).toBe(expectedAuxHistoricalMetadata);
      done();
    });
    shares.handleShares(lookups, shareData, 'valid', false, () => {});
  });

  test('Test shares submission handling [1]', (done) => {
    const lookups = [
      null,
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ miner: 'miner1' }] },
      null];
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = {
      job: 1,
      id: 1,
      ip: null,
      port: 3002,
      addrPrimary: 'miner1',
      addrAuxiliary: 'miner1',
      blockDiffPrimary : 150,
      blockType: 'primary',
      coinbase: null,
      difficulty: 100,
      hash: 'hash',
      hex: 'hex',
      header: 'header',
      headerDiff: 100,
      height: 1,
      identifier: 'master',
      reward: 100,
      shareDiff: 1,
    };
    shares.handleSubmissions(shareData, true, true, () => done());
  });

  test('Test shares submission handling [2]', (done) => {
    const lookups = [
      null,
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ miner: 'miner1' }] },
      null];
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = {
      job: 1,
      id: 1,
      ip: null,
      port: 3002,
      addrPrimary: 'miner1',
      addrAuxiliary: 'miner1',
      blockDiffPrimary : 150,
      blockType: 'primary',
      coinbase: null,
      difficulty: 100,
      hash: 'hash',
      hex: 'hex',
      header: 'header',
      headerDiff: 100,
      height: 1,
      identifier: 'master',
      reward: 100,
      shareDiff: 1,
    };
    shares.handleSubmissions(shareData, true, false, () => done());
  });

  test('Test shares submission handling [3]', (done) => {
    const lookups = [
      null,
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ miner: 'miner1' }] },
      null];
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = {
      job: 1,
      id: 1,
      ip: null,
      port: 3002,
      addrPrimary: 'miner1',
      addrAuxiliary: 'miner1',
      blockDiffPrimary : 150,
      blockType: 'auxiliary',
      coinbase: null,
      difficulty: 100,
      hash: 'hash',
      hex: 'hex',
      header: 'header',
      headerDiff: 100,
      height: 1,
      identifier: 'master',
      reward: 100,
      shareDiff: 1,
    };
    shares.handleSubmissions(shareData, true, true, () => done());
  });

  test('Test shares submission handling [4]', (done) => {
    const lookups = [
      null,
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ miner: 'miner1' }] },
      null];
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = {
      job: 1,
      id: 1,
      ip: null,
      port: 3002,
      addrPrimary: 'miner1',
      addrAuxiliary: 'miner1',
      blockDiffPrimary : 150,
      blockType: 'auxiliary',
      coinbase: null,
      difficulty: 100,
      hash: 'hash',
      hex: 'hex',
      header: 'header',
      headerDiff: 100,
      height: 1,
      identifier: 'master',
      reward: 100,
      shareDiff: 1,
    };
    shares.handleSubmissions(shareData, true, false, () => done());
  });

  test('Test shares submission handling [5]', (done) => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const lookups = [
      null,
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ miner: 'miner1' }] },
      null];
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = {
      job: 1,
      id: 1,
      ip: null,
      port: 3002,
      addrPrimary: 'miner1',
      addrAuxiliary: 'miner1',
      blockDiffPrimary : 150,
      blockType: 'share',
      coinbase: null,
      difficulty: 100,
      hash: 'hash',
      hex: 'hex',
      header: 'header',
      headerDiff: 100,
      height: 1,
      identifier: 'master',
      reward: 100,
      shareDiff: 1,
    };
    shares.handleSubmissions(shareData, true, false, () => {
      expect(consoleSpy).toHaveBeenCalled();
      console.log.mockClear();
      done();
    });
  });

  test('Test shares submission handling [6]', (done) => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const lookups = [
      null,
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ miner: 'miner1' }] },
      null];
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = {
      job: 1,
      id: 1,
      ip: null,
      port: 3002,
      addrPrimary: 'miner1',
      addrAuxiliary: 'miner1',
      blockDiffPrimary : 150,
      blockType: 'share',
      coinbase: null,
      difficulty: 100,
      hash: 'hash',
      hex: 'hex',
      header: 'header',
      headerDiff: 100,
      height: 1,
      identifier: 'master',
      reward: 100,
      shareDiff: 1,
    };
    shares.handleSubmissions(shareData, false, false, () => {
      expect(consoleSpy).toHaveBeenCalled();
      console.log.mockClear();
      done();
    });
  });

  test('Test shares submission handling [7]', (done) => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const lookups = [
      null,
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ valid: 1, invalid: 0, stale: 0, work: 100 }] },
      { rows: [{ miner: 'miner1' }] },
      null];
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = {
      job: 1,
      id: 1,
      ip: null,
      port: 3002,
      addrPrimary: 'miner1',
      addrAuxiliary: 'miner1',
      blockType: 'share',
      difficulty: 100,
      identifier: 'master',
      error: 'job not found',
    };
    shares.handleSubmissions(shareData, false, false, () => {
      expect(consoleSpy).toHaveBeenCalled();
      console.log.mockClear();
      done();
    });
  });

  test('Test shares submission handling [8]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const shares = new Shares(logger, client, configCopy, configMainCopy);
    const shareData = {
      job: 1,
      id: 1,
      ip: null,
      port: 3002,
      addrPrimary: 'miner1',
      addrAuxiliary: 'miner1',
      blockDiffPrimary : 150,
      blockType: 'unknown',
      coinbase: null,
      difficulty: 100,
      hash: 'hash',
      hex: 'hex',
      header: 'header',
      headerDiff: 100,
      height: 1,
      identifier: 'master',
      reward: 100,
      shareDiff: 1,
    };
    shares.handleSubmissions(shareData, false, false, () => done());
  });
});
