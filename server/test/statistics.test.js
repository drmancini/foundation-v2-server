const Commands = require('../../database/main/commands');
const Logger = require('../main/logger');
const MockDate = require('mockdate');
const Statistics = require('../main/statistics');
const config = require('../../configs/pools/example.js');
const configMain = require('../../configs/main/example.js');
const events = require('events');

////////////////////////////////////////////////////////////////////////////////

function mockClient(configMain, result) {
  const client = new events.EventEmitter();
  client.commands = new Commands(null, null, configMain);
  client.commands.executor = (commands, callback) => {
    client.emit('transaction', commands);
    callback(result);
  };
  return client;
}

////////////////////////////////////////////////////////////////////////////////

describe('Test statistics functionality', () => {

  let configCopy, configMainCopy;
  beforeEach(() => {
    configCopy = JSON.parse(JSON.stringify(config));
    configMainCopy = JSON.parse(JSON.stringify(configMain));
  });

  test('Test initialization of statistics', () => {
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    expect(typeof statistics.handleCurrentMetadata).toBe('function');
    expect(typeof statistics.handleCurrentMiners).toBe('function');
  });

  test('Test statistics database updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const expected = {
      timestamp: 1634742080841,
      hashrate: 1431655765.3333,
      miners: 1,
      solo: true,
      type: 'primary',
      workers: 1,
    };
    expect(statistics.handleCurrentMetadata(1, 1, 100, 'primary', true)).toStrictEqual(expected);
  });

  test('Test statistics database updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    delete configCopy.primary.coin.algorithm;
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const expected = {
      timestamp: 1634742080841,
      hashrate: 1431655765.3333,
      miners: 1,
      solo: false,
      type: 'primary',
      workers: 1,
    };
    expect(statistics.handleCurrentMetadata(1, 1, 100, 'primary', false)).toStrictEqual(expected);
  });

  test('Test statistics database updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const hashrate = [
      { miner: 'miner1', current_work: 100 },
      { miner: 'miner2', current_work: 10 },
      { miner: 'miner3', current_work: 140 }];
    const miners = [{ miner: 'miner1'}, { miner: 'miner2'}, { miner: 'miner3'}];
    const expected = [
      { timestamp: 1634742080841, miner: 'miner1', efficiency: 0, hashrate: 1431655765.3333, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner2', efficiency: 0, hashrate: 143165576.5333, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner3', efficiency: 0, hashrate: 2004318071.4667, type: 'primary' }];
    expect(statistics.handleCurrentMiners(hashrate, miners, 'primary')).toStrictEqual(expected);
  });

  test('Test statistics database updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    delete configCopy.primary.coin.algorithm;
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const hashrate = [
      { miner: 'miner1', current_work: 100 },
      { miner: 'miner3', current_work: 140 }];
    const miners = [{ miner: 'miner1'}, { miner: 'miner2'}, { miner: 'miner3'}];
    const expected = [
      { timestamp: 1634742080841, miner: 'miner1', efficiency: 0, hashrate: 1431655765.3333, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner2', efficiency: 0, hashrate: 0, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner3', efficiency: 0, hashrate: 2004318071.4667, type: 'primary' }];
    expect(statistics.handleCurrentMiners(hashrate, miners, 'primary')).toStrictEqual(expected);
  });

  test('Test statistics database updates [5]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const hashrate = [
      { worker: 'miner1', current_work: 100 },
      { worker: 'miner2', current_work: 10 },
      { worker: 'miner3', current_work: 140 }];
    const workers = [
      { worker: 'miner1', invalid: 5, solo: false, stale: 5, valid: 90 },
      { worker: 'miner2', invalid: 5, solo: false, stale: 5, valid: 90 },
      { worker: 'miner3', invalid: 5, solo: false, stale: 5, valid: 90 }];
    const expected = [
      { timestamp: 1634742080841, miner: 'miner1', worker: 'miner1', efficiency: 90, hashrate: 1431655765.3333, solo: false, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner2', worker: 'miner2', efficiency: 90, hashrate: 143165576.5333, solo: false, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner3', worker: 'miner3', efficiency: 90, hashrate: 2004318071.4667, solo: false, type: 'primary' }];
    expect(statistics.handleCurrentWorkers(hashrate, workers, 'primary')).toStrictEqual(expected);
  });

  test('Test statistics database updates [6]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    delete configCopy.primary.coin.algorithm;
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const hashrate = [
      { worker: 'miner1', current_work: 100 },
      { worker: 'miner3', current_work: 140 }];
    const workers = [
      { worker: 'miner1', solo: false },
      { worker: 'miner2', solo: false },
      { worker: 'miner3', solo: false }];
    const expected = [
      { timestamp: 1634742080841, miner: 'miner1', worker: 'miner1', efficiency: 0, hashrate: 1431655765.3333, solo: false, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner2', worker: 'miner2', efficiency: 0, hashrate: 0, solo: false, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner3', worker: 'miner3', efficiency: 0, hashrate: 2004318071.4667, solo: false, type: 'primary' }];
    expect(statistics.handleCurrentWorkers(hashrate, workers, 'primary')).toStrictEqual(expected);
  });

  test('Test statistics database updates [7]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const hashrate = [
      { worker: null, current_work: 100 },
      { worker: 'miner2', current_work: 10 },
      { worker: 'miner3', current_work: 140 }];
    const workers = [
      { worker: null, solo: false },
      { worker: 'miner2', solo: false },
      { worker: 'miner3', solo: false }];
    const expected = [
      { timestamp: 1634742080841, miner: '', worker: null, efficiency: 0, hashrate: 1431655765.3333, solo: false, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner2', worker: 'miner2', efficiency: 0, hashrate: 143165576.5333, solo: false, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner3', worker: 'miner3', efficiency: 0, hashrate: 2004318071.4667, solo: false, type: 'primary' }];
    expect(statistics.handleCurrentWorkers(hashrate, workers, 'primary')).toStrictEqual(expected);
  });

  test('Test statistics database updates [8]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const metadata = {
      timestamp: 1,
      blocks: 1,
      efficiency: 100,
      effort: 100,
      hashrate: 100,
      invalid: 0,
      miners: 1,
      stale: 0,
      type: 'primary',
      valid: 100,
      work: 100,
      workers: 1,
    };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742000000,
      blocks: 1,
      efficiency: 100,
      effort: 100,
      hashrate: 100,
      invalid: 0,
      miners: 1,
      stale: 0,
      type: 'primary',
      valid: 100,
      work: 100,
      workers: 1,
    };
    expect(statistics.handleHistoricalMetadata(metadata)).toStrictEqual(expected);
  });

  test('Test statistics database updates [9]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const miners = [{
      timestamp: 1,
      recent: 1,
      miner: 'miner1',
      solo: false,
      type: 'primary',
      work: 0.1,
    }];
    const expected = [{
      timestamp: 1634742080841,
      recent: 1,
      miner: 'miner1',
      hashrate: 5312857.7034,
      solo: false,
      type: 'primary',
    }];
    expect(statistics.handleHistoricalMinersHashrate(miners)).toStrictEqual(expected);
  });

  test('Test statistics database updates [10]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const network = {
      timestamp: 1,
      difficulty: 1,
      hashrate: 100,
      height: 1,
      type: 'primary',
    };
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742000000,
      difficulty: 1,
      hashrate: 100,
      height: 1,
      type: 'primary',
    };
    expect(statistics.handleHistoricalNetwork(network)).toStrictEqual(expected);
  });

  test('Test statistics database updates [11]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const workers = [{
      timestamp: 1,
      recent: 1,
      miner: 'miner1',
      worker: 'worker1',
      solo: false,
      type: 'primary',
      work: 0.1,
    }];
    const expected = [{
      timestamp: 1634742080841,
      recent: 1,
      miner: 'miner1',
      worker: 'worker1',
      hashrate: 5312857.7034,
      solo: false,
      type: 'primary',
    }];
    expect(statistics.handleHistoricalWorkersHashrate(workers)).toStrictEqual(expected);
  });

  test('Test statistics primary updates [1]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const lookups = [
      null,
      null,
      { rows: [{ count: 1 }] },
      { rows: [{ count: 2 }] },
      { rows: [{ count: 1 }] },
      { rows: [{ count: 2 }] },
      { rows: [
        { miner: 'miner1', current_work: 100 },
        { miner: 'miner2', current_work: 10 },
        { miner: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [{ current_work: 100 }] },
      { rows: [{ current_work: 100 }] },
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        stale: 0,
        type: 'primary',
        valid: 1,
      }]},
      null,
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'solo_worker1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        last_share: 1,
        solo: true,
        stale: 0,
        type: 'primary',
        valid: 1,
      },{
        timestamp: 1,
        miner: 'miner1',
        worker: 'solo_worker2',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        last_share: 1,
        solo: true,
        stale: 0,
        type: 'primary',
        valid: 1,
      }]},
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'shared_worker',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        last_share: 1,
        solo: false,
        stale: 0,
        type: 'primary',
        valid: 1,
      }]},
      { rows: []},
      { rows: []},
      null];
    const expectedSoloMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, hashrate, miners,
        solo, type, workers)
      VALUES (
        1634742080841,
        1431655765.3333,
        1,
        true,
        'primary',
        1)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedSharedMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, hashrate, miners,
        solo, type, workers)
      VALUES (
        1634742080841,
        1431655765.3333,
        2,
        false,
        'primary',
        2)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedMiners = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, efficiency,
        hashrate, type)
      VALUES (
        1634742080841,
        'miner1',
        100,
        1431655765.3333,
        'primary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate;`;
    const expectedSoloWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate, solo,
        type)
      VALUES (
        1634742080841,
        'solo_worker1',
        'solo_worker1',
        100,
        0,
        true,
        'primary'), (
        1634742080841,
        'solo_worker2',
        'solo_worker2',
        100,
        0,
        true,
        'primary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate;`;
    const expectedSoloWorkersReset = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        hashrate_12h, hashrate_24h,
        solo, type)
      VALUES (
        1634742080841,
        'miner1',
        'solo_worker1',
        0,
        0,
        true,
        'primary'), (
        1634742080841,
        'miner1',
        'solo_worker2',
        0,
        0,
        true,
        'primary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate_12h = EXCLUDED.hashrate_12h,
        hashrate_24h = EXCLUDED.hashrate_24h;`;
    const expectedSharedWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate, solo,
        type)
      VALUES (
        1634742080841,
        'shared_worker',
        'shared_worker',
        100,
        0,
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate;`;
    const expectedSharedWorkersReset = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        hashrate_12h, hashrate_24h,
        solo, type)
      VALUES (
        1634742080841,
        'miner1',
        'shared_worker',
        0,
        0,
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate_12h = EXCLUDED.hashrate_12h,
        hashrate_24h = EXCLUDED.hashrate_24h;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(9);
      expect(transaction[1]).toBe(expectedSoloMetadata);
      expect(transaction[2]).toBe(expectedSharedMetadata);
      expect(transaction[3]).toBe(expectedMiners);
      expect(transaction[4]).toBe(expectedSoloWorkers);
      expect(transaction[5]).toBe(expectedSoloWorkersReset);
      expect(transaction[6]).toBe(expectedSharedWorkers);
      expect(transaction[7]).toBe(expectedSharedWorkersReset);
      done();
    });
    statistics.handlePrimary(lookups, () => {});
  });

  test('Test statistics primary updates [2]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const lookups = [
      null,
      null,
      { rows: [{}] },
      { rows: [{}] },
      { rows: [{}] },
      { rows: [{}] },
      { rows: [
        { miner: 'miner1', current_work: 100 },
        { miner: 'miner2', current_work: 10 },
        { miner: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [{}] },
      { rows: [{}] },
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        stale: 0,
        type: 'primary',
        valid: 1,
      }]},
      null,
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'worker1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        solo: true,
        stale: 0,
        type: 'primary',
        valid: 1,
      }]},
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'worker1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        solo: false,
        stale: 0,
        type: 'primary',
        valid: 1,
      }]},
      { rows: [{
        timestamp: 1,
        recent: 1,
        miner: 'miner1',
        hashrate: 100,
        solo: false,
        type: 'primary',
        work: 1,
      }]},
      { rows: [{
        timestamp: 1,
        recent: 1,
        miner: 'miner1',
        worker: 'miner1',
        hashrate: 100,
        solo: false,
        type: 'primary',
        work: 1,
      }]},
      null];
    const expectedSoloMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, hashrate, miners,
        solo, type, workers)
      VALUES (
        1634742080841,
        0,
        0,
        true,
        'primary',
        0)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedSharedMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, hashrate, miners,
        solo, type, workers)
      VALUES (
        1634742080841,
        0,
        0,
        false,
        'primary',
        0)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedMiners = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, efficiency,
        hashrate, type)
      VALUES (
        1634742080841,
        'miner1',
        100,
        1431655765.3333,
        'primary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate;`;
    const expectedSoloWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate, solo,
        type)
      VALUES (
        1634742080841,
        'worker1',
        'worker1',
        100,
        0,
        true,
        'primary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate;`;
    const expectedSharedWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate, solo,
        type)
      VALUES (
        1634742080841,
        'worker1',
        'worker1',
        100,
        0,
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate;`;
    const expectedHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        hashrate, solo, type)
      VALUES (
        1634742080841,
        1,
        'miner1',
        53128577.0339,
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate;`;
    const expectedHistoricalWorkers = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, hashrate, solo,
        type)
      VALUES (
        1634742080841,
        1,
        'miner1',
        'miner1',
        53128577.0339,
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(9);
      expect(transaction[1]).toBe(expectedSoloMetadata);
      expect(transaction[2]).toBe(expectedSharedMetadata);
      expect(transaction[3]).toBe(expectedMiners);
      expect(transaction[4]).toBe(expectedSoloWorkers);
      expect(transaction[5]).toBe(expectedSharedWorkers);
      expect(transaction[6]).toBe(expectedHistoricalMiners);
      expect(transaction[7]).toBe(expectedHistoricalWorkers);
      done();
    });
    statistics.handlePrimary(lookups, () => {});
  });

  test('Test statistics primary updates [3]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const lookups = [
      null,
      null,
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      null,
      { rows: [] },
      null,
      null,
      { rows: [] },
      { rows: [] },
      { rows: []},
      { rows: []},
      null];
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(2);
      done();
    });
    statistics.handlePrimary(lookups, () => {});
  });

  test('Test statistics auxiliary updates [1]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const lookups = [
      null,
      null,
      { rows: [{ count: 1 }] },
      { rows: [{ count: 2 }] },
      { rows: [{ count: 1 }] },
      { rows: [{ count: 2 }] },
      { rows: [
        { miner: 'miner1', current_work: 100 },
        { miner: 'miner2', current_work: 10 },
        { miner: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [{ current_work: 100 }] },
      { rows: [{ current_work: 100 }] },
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        stale: 0,
        type: 'auxiliary',
        valid: 1,
      }]},
      null,
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'worker1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        solo: true,
        stale: 0,
        type: 'auxiliary',
        valid: 1,
      }]},
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'worker1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        solo: false,
        stale: 0,
        type: 'auxiliary',
        valid: 1,
      }]},
      { rows: []},
      { rows: []},
      null];
    const expectedSoloMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, hashrate, miners,
        solo, type, workers)
      VALUES (
        1634742080841,
        1431655765.3333,
        1,
        true,
        'auxiliary',
        1)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedSharedMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, hashrate, miners,
        solo, type, workers)
      VALUES (
        1634742080841,
        1431655765.3333,
        2,
        false,
        'auxiliary',
        2)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedMiners = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, efficiency,
        hashrate, type)
      VALUES (
        1634742080841,
        'miner1',
        100,
        1431655765.3333,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate;`;
    const expectedSoloWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate, solo,
        type)
      VALUES (
        1634742080841,
        'worker1',
        'worker1',
        100,
        0,
        true,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate;`;
    const expectedSharedWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate, solo,
        type)
      VALUES (
        1634742080841,
        'worker1',
        'worker1',
        100,
        0,
        false,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(7);
      expect(transaction[1]).toBe(expectedSoloMetadata);
      expect(transaction[2]).toBe(expectedSharedMetadata);
      expect(transaction[3]).toBe(expectedMiners);
      expect(transaction[4]).toBe(expectedSoloWorkers);
      expect(transaction[5]).toBe(expectedSharedWorkers);
      done();
    });
    statistics.handleAuxiliary(lookups, () => {});
  });

  test('Test statistics auxiliary updates [2]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const lookups = [
      null,
      null,
      { rows: [{}] },
      { rows: [{}] },
      { rows: [{}] },
      { rows: [{}] },
      { rows: [
        { miner: 'miner1', current_work: 100 },
        { miner: 'miner2', current_work: 10 },
        { miner: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [{}] },
      { rows: [{}] },
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        stale: 0,
        type: 'auxiliary',
        valid: 1,
      }]},
      null,
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'worker1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        solo: true,
        stale: 0,
        type: 'auxiliary',
        valid: 1,
      }]},
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'worker1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        solo: false,
        stale: 0,
        type: 'auxiliary',
        valid: 1,
      }]},
      null];
    const expectedSoloMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, hashrate, miners,
        solo, type, workers)
      VALUES (
        1634742080841,
        0,
        0,
        true,
        'auxiliary',
        0)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedSharedMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, hashrate, miners,
        solo, type, workers)
      VALUES (
        1634742080841,
        0,
        0,
        false,
        'auxiliary',
        0)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedMiners = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, efficiency,
        hashrate, type)
      VALUES (
        1634742080841,
        'miner1',
        100,
        1431655765.3333,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate;`;
    const expectedSoloWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate, solo,
        type)
      VALUES (
        1634742080841,
        'worker1',
        'worker1',
        100,
        0,
        true,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate;`;
    const expectedSharedWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate, solo,
        type)
      VALUES (
        1634742080841,
        'worker1',
        'worker1',
        100,
        0,
        false,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(7);
      expect(transaction[1]).toBe(expectedSoloMetadata);
      expect(transaction[2]).toBe(expectedSharedMetadata);
      expect(transaction[3]).toBe(expectedMiners);
      expect(transaction[4]).toBe(expectedSoloWorkers);
      expect(transaction[5]).toBe(expectedSharedWorkers);
      done();
    });
    statistics.handleAuxiliary(lookups, () => {});
  });

  test('Test statistics auxiliary updates [3]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const lookups = [
      null,
      null,
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      null,
      { rows: [] },
      null,
      null,
      { rows: [] },
      { rows: [] },
      null];
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(2);
      done();
    });
    statistics.handleAuxiliary(lookups, () => {});
  });

  test('Test statistics submission handling [1]', (done) => {
    const lookups = [
      null,
      null,
      { rows: [{ count: 1 }] },
      { rows: [{ count: 1 }] },
      { rows: [{ count: 1 }] },
      { rows: [{ count: 2 }] },
      { rows: [
        { miner: 'miner1', current_work: 100 },
        { miner: 'miner2', current_work: 10 },
        { miner: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [{ current_work: 100 }] },
      { rows: [{ current_work: 100 }] },
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        type: 'primary',
      }]},
      null,
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'worker1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        solo: true,
        type: 'primary',
      }]},
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'worker1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        solo: false,
        type: 'primary',
      }]},
      { rows: []},
      { rows: []},
      null];
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    statistics.handleStatistics('primary', () => done());
  });

  test('Test statistics submission handling [2]', (done) => {
    const lookups = [
      null,
      null,
      { rows: [{ count: 1 }] },
      { rows: [{ count: 1 }] },
      { rows: [{ count: 1 }] },
      { rows: [{ count: 2 }] },
      { rows: [
        { miner: 'miner1', current_work: 100 },
        { miner: 'miner2', current_work: 10 },
        { miner: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [{ current_work: 100 }] },
      { rows: [{ current_work: 100 }] },
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        type: 'primary',
      }]},
      null,
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'worker1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        solo: true,
        type: 'primary',
      }]},
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'worker1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        solo: false,
        type: 'primary',
      }]},
      { rows: []},
      { rows: []},
      null];
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    statistics.handleStatistics('primary', () => done());
  });

  test('Test statistics submission handling [3]', (done) => {
    const lookups = [
      null,
      null,
      { rows: [{ count: 1 }] },
      { rows: [{ count: 1 }] },
      { rows: [{ count: 1 }] },
      { rows: [{ count: 2 }] },
      { rows: [
        { miner: 'miner1', current_work: 100 },
        { miner: 'miner2', current_work: 10 },
        { miner: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [{ current_work: 100 }] },
      { rows: [{ current_work: 100 }] },
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        type: 'auxiliary',
      }]},
      null,
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'worker1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        solo: true,
        type: 'auxiliary',
      }]},
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'worker1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        solo: false,
        type: 'auxiliary',
      }]},
      null];
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    statistics.handleStatistics('auxiliary', () => done());
  });

  test('Test statistics submission handling [4]', (done) => {
    const lookups = [
      null,
      null,
      { rows: [{ count: 1 }] },
      { rows: [{ count: 1 }] },
      { rows: [{ count: 1 }] },
      { rows: [{ count: 2 }] },
      { rows: [
        { miner: 'miner1', current_work: 100 },
        { miner: 'miner2', current_work: 10 },
        { miner: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [
        { worker: 'miner1', current_work: 100 },
        { worker: 'miner2', current_work: 10 },
        { worker: 'miner3', current_work: 140 }]},
      { rows: [{ current_work: 100 }] },
      { rows: [{ current_work: 100 }] },
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        type: 'auxiliary',
      }]},
      null,
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'worker1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        solo: true,
        type: 'auxiliary',
      }]},
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'worker1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        solo: false,
        type: 'auxiliary',
      }]},
      null];
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    statistics.handleStatistics('auxiliary', () => done());
  });

  test('Test statistics submission handling [5]', (done) => {
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    statistics.handleStatistics('unknown', () => done());
  });
});
