const CommandsMaster = require('../../database/main/master/commands');
const CommandsWorker = require('../../database/main/worker/commands');
const Logger = require('../main/logger');
const MockDate = require('mockdate');
const Statistics = require('../main/statistics');
const config = require('../../configs/pools/example.js');
const configMain = require('../../configs/main/example.js');
const events = require('events');

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
    expect(typeof statistics.handleMetadataHashrate).toBe('function');
    expect(typeof statistics.handleMetadataShares).toBe('function');
  });

  test('Test statistics database updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const miners = [{ identifier: 'master', solo: false, miners: 1 }];
    const work = [{ identifier: 'master', solo: false, work: 1 }];
    const workers = [{ identifier: 'master', solo: false, workers: 1 }];
    const expected = {
      timestamp: 1634742080841,
      recent: 1634742600000,
      hashrate:  14316557.653333334,
      identifier: 'master',
      miners: 1,
      solo: false,
      type: 'primary',
      workers: 1,
    };
    expect(statistics.handleMetadataHashrate(miners, workers, work, 'primary')).toStrictEqual([expected]);
  });

  test('Test statistics database updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const miners = [];
    const work = [];
    const workers = [];
    expect(statistics.handleMetadataHashrate(miners, workers, work, 'primary')).toStrictEqual([]);
  });

  test('Test statistics database updates [3]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const history = [{ identifier: 'master', solo: false, stale: 0, invalid: 0, valid: 1 }];
    const expected = {
      timestamp: 1634742080841,
      efficiency: 100,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
    };
    expect(statistics.handleMetadataShares(history, 'primary')).toStrictEqual([expected]);
  });

  test('Test statistics database updates [4]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const history = [{ identifier: 'master', solo: false, stale: 0, invalid: 0, valid: 0 }];
    const expected = {
      timestamp: 1634742080841,
      efficiency: 0,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 0,
    };
    expect(statistics.handleMetadataShares(history, 'primary')).toStrictEqual([expected]);
  });

  test('Test statistics database updates [5]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const history = [];
    expect(statistics.handleMetadataShares(history, 'primary')).toStrictEqual([]);
  });

  test('Test statistics database updates [6]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const history = [
      { identifier: 'master', solo: false, stale: 0, invalid: 0, valid: 1 },
      { identifier: 'master', solo: false, stale: 0, invalid: 0, valid: 1 }];
    const expected = {
      timestamp: 1634742080841,
      efficiency: 100,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 2,
    };
    expect(statistics.handleMetadataShares(history, 'primary')).toStrictEqual([expected]);
  });

  test('Test statistics database updates [7]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const currentMiners = [{ miner: 'primary1', solo: false, hashrate: 1 }];
    const minerWorkSums = [{ miner: 'primary2', solo: false, work: 1 }];
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary2',
      hashrate: 14316557.653333334,
      solo: false,
      type: 'primary',
    }, {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary1',
      hashrate: 0,
      solo: false,
      type: 'primary',
    }];
    expect(statistics.handleMinerHashrate(currentMiners, minerWorkSums, 'primary')).toStrictEqual(expected);
  });

  test('Test statistics database updates [8]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    expect(statistics.handleMinerHashrate([], [], 'primary')).toStrictEqual([]);
  });

  test('Test statistics database updates [9]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const minerWorkSums = [{
      miner: 'primary',
      invalid: 0,
      solo: false,
      stale: 0,
      sum_work_12h: 1,
      sum_work_24h: 1,
      valid: 1,
    }];
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      efficiency: 100,
      hashrate_12h: 99420.53925925925,
      hashrate_24h: 49710.26962962963,
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1
    };
    expect(statistics.handleMinersShares(minerWorkSums, 'primary')).toStrictEqual([expected]);
  });

  test('Test statistics database updates [10]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const minerWorkSums = [{
      miner: 'primary',
      invalid: 0,
      solo: false,
      stale: 0,
      sum_work_12h: 1,
      sum_work_24h: 1,
      valid: 0,
    }];
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      efficiency: 0,
      hashrate_12h: 99420.53925925925,
      hashrate_24h: 49710.26962962963,
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 0
    };
    expect(statistics.handleMinersShares(minerWorkSums, 'primary')).toStrictEqual([expected]);
  });

  test('Test statistics database updates [11]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const minerWorkSums = [];
    expect(statistics.handleMinersShares(minerWorkSums, 'primary')).toStrictEqual([]);
  });

  test('Test statistics database updates [12]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const currentWorkers = [{
      worker: 'primary1',
      miner: 'primary1',
      ip_hash: 'hash',
      solo: false,
      hashrate: 1,
    }, {
      worker: 'primary2',
      miner: 'primary2',
      ip_hash: 'hash',
      solo: false,
      hashrate: 1,
    }];
    const workerWorkSums = [{
      worker: 'primary2',
      ip_hash: 'hash',
      solo: false,
      work: 1,
    }];
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary2',
      worker: 'primary2',
      hashrate: 14316557.653333334,
      ip_hash: 'hash',
      solo: false,
      type: 'primary',
    }, {
      timestamp: 1634742080841,
      recent: 1634742600000,
      miner: 'primary1',
      worker: 'primary1',
      hashrate: 0,
      ip_hash: 'hash',
      solo: false,
      type: 'primary',
    }];
    expect(statistics.handleWorkerHashrate(currentWorkers, workerWorkSums, 'primary')).toStrictEqual(expected);
  });

  test('Test statistics database updates [13]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    expect(statistics.handleWorkerHashrate([], [], 'primary')).toStrictEqual([]);
  });

  test('Test statistics database updates [14]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const historicalWorkers = [{
      worker: 'primary',
      sum_work_12h: 1,
      sum_work_24h: 1,
      invalid: 0,
      ip_hash: 'hash',
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1
    }];
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      efficiency: 100,
      hashrate_12h: 99420.53925925925,
      hashrate_24h: 49710.26962962963,
      invalid: 0,
      ip_hash: 'hash',
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1
    };
    expect(statistics.handleWorkerShares(historicalWorkers, 'primary')).toStrictEqual([expected]);
  });

  test('Test statistics database updates [15]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const historicalWorkers = [{
      worker: 'primary',
      sum_work_12h: 1,
      sum_work_24h: 1,
      invalid: 0,
      ip_hash: 'hash',
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 0
    }];
    const expected = {
      timestamp: 1634742080841,
      miner: 'primary',
      worker: 'primary',
      efficiency: 0,
      hashrate_12h: 99420.53925925925,
      hashrate_24h: 49710.26962962963,
      invalid: 0,
      ip_hash: 'hash',
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 0
    };
    expect(statistics.handleWorkerShares(historicalWorkers, 'primary')).toStrictEqual([expected]);
  });

  test('Test statistics database updates [16]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const minerWorkSums = [];
    expect(statistics.handleWorkerShares(minerWorkSums, 'primary')).toStrictEqual([]);
  });

  test('Test statistics updates [1]', (done) => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const lookups = [
      null,
      null,
      { rows: [
        { identifier: 'master1', solo: false, miners: 1 },
        { identifier: 'master1', solo: true, miners: 1 },
        { identifier: 'master2', solo: false, miners: 1 }] },
      { rows: [
        { identifier: 'master1', solo: false, workers: 2 },
        { identifier: 'master1', solo: true, workers: 3 },
        { identifier: 'master2', solo: false, workers: 4 }] },
      { rows: [
        { miner: 'miner1', solo: false, work: 100 },
        { miner: 'miner2', solo: false, work: 10 },
        { miner: 'miner3', solo: true, work: 140 }]},
      { rows: [
        { worker: 'worker1', ip_hash: 'hash1', solo: false, work: 100 },
        { worker: 'worker1', ip_hash: 'hash2', solo: true, work: 10 },
        { worker: 'worker2', ip_hash: 'hash2', solo: false, work: 140 }] },
      { rows: [
        { identifier: 'master1', solo: false, work: 1 },
        { identifier: 'master1', solo: true, work: 1 },
        { identifier: 'master2', solo: false, work: 1 }] },
      { rows: [{ identifier: 'master1', invalid: 0, solo: false, stale: 0, valid: 1 }] },
      null,
      { rows: [{ miner: 'miner1', solo: false, hashrate: 1 }] },
      null,
      null,
      { rows: [{ miner: 'worker1', worker: 'worker1', ip_hash: 'hash1', solo: false, hashrate: 1 }] },
      { rows: [{
        miner: 'miner1',
        invalid: 0,
        solo: false,
        sum_work_12h: 100,
        sum_work_24h: 50,
        stale: 0,
        valid: 1 }, {
        miner: 'miner2',
        invalid: 0,
        solo: true,
        sum_work_12h: 100,
        sum_work_24h: 50,
        stale: 0,
        valid: 1 }
      ]},
      { rows: [{
        worker: 'worker1',
        invalid: 0,
        identifier: 'master1',
        ip_hash: 'hash1',
        solo: false,
        sum_work_12h: 100,
        sum_work_24h: 50,
        stale: 0,
        valid: 1 }, {
        worker: 'worker2',
        identifier: 'master1',
        invalid: 0,
        ip_hash: 'hash1',
        solo: true,
        sum_work_12h: 100,
        sum_work_24h: 50,
        stale: 0,
        valid: 1 }
      ]},
      null];
    const expectedMetadataHashrate = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, identifier, hashrate,
        solo, miners, type, workers)
      VALUES (
        1634742080841,
        'master1',
        14316557.653333334,
        false,
        1,
        'primary',
        2), (
        1634742080841,
        'master1',
        14316557.653333334,
        true,
        1,
        'primary',
        3), (
        1634742080841,
        'master2',
        14316557.653333334,
        false,
        1,
        'primary',
        4)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedHistoricalMetadataHashrate = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, identifier,
        hashrate, solo, miners, type,
        workers)
      VALUES (
        1634742080841,
        1634742600000,
        'master1',
        14316557.653333334,
        false,
        1,
        'primary',
        2), (
        1634742080841,
        1634742600000,
        'master1',
        14316557.653333334,
        true,
        1,
        'primary',
        3), (
        1634742080841,
        1634742600000,
        'master2',
        14316557.653333334,
        false,
        1,
        'primary',
        4)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedMetadataShares = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, efficiency, identifier,
        invalid, solo, stale, type, valid)
      VALUES (
        1634742080841,
        100,
        'master1',
        0,
        false,
        0,
        'primary',
        1)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        invalid = EXCLUDED.invalid,
        stale = EXCLUDED.stale,
        valid = EXCLUDED.valid;`;
    const expectedMinersHashrate = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, hashrate,
        solo, type)
      VALUES (
        1634742080841,
        'miner1',
        1431655765.3333333,
        false,
        'primary'), (
        1634742080841,
        'miner2',
        143165576.53333333,
        false,
        'primary'), (
        1634742080841,
        'miner3',
        2004318071.4666667,
        true,
        'primary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate;`;
    const expectedHistoricalMinersHashrate = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        hashrate, solo, type)
      VALUES (
        1634742080841,
        1634742600000,
        'miner1',
        1431655765.3333333,
        false,
        'primary'), (
        1634742080841,
        1634742600000,
        'miner2',
        143165576.53333333,
        false,
        'primary'), (
        1634742080841,
        1634742600000,
        'miner3',
        2004318071.4666667,
        true,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate;`;
    const expectedMinersShares = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, efficiency,
        hashrate_12h, hashrate_24h,
        invalid, solo, stale, valid,
        type)
      VALUES (
        1634742080841,
        'miner1',
        100,
        9942053.925925925,
        2485513.4814814813,
        0,
        false,
        0,
        1,
        'primary'), (
        1634742080841,
        'miner2',
        100,
        9942053.925925925,
        2485513.4814814813,
        0,
        true,
        0,
        1,
        'primary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate_12h = EXCLUDED.hashrate_12h,
        hashrate_24h = EXCLUDED.hashrate_24h,
        invalid = EXCLUDED.invalid,
        stale = EXCLUDED.stale,
        valid = EXCLUDED.valid;`;
    const expectedWorkersHashrate = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        hashrate, ip_hash, solo,
        type)
      VALUES (
        1634742080841,
        'worker1',
        'worker1',
        1431655765.3333333,
        'hash1',
        false,
        'primary'), (
        1634742080841,
        'worker1',
        'worker1',
        143165576.53333333,
        'hash2',
        true,
        'primary'), (
        1634742080841,
        'worker2',
        'worker2',
        2004318071.4666667,
        'hash2',
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate;`;
    const expectedHistoricalWorkersHashrate = `
      INSERT INTO "Pool-Bitcoin".historical_workers (
        timestamp, recent, miner,
        worker, hashrate, ip_hash,
        solo, type)
      VALUES (
        1634742080841,
        1634742600000,
        'worker1',
        'worker1',
        1431655765.3333333,
        'hash1',
        false,
        'primary'), (
        1634742080841,
        1634742600000,
        'worker1',
        'worker1',
        143165576.53333333,
        'hash2',
        true,
        'primary'), (
        1634742080841,
        1634742600000,
        'worker2',
        'worker2',
        2004318071.4666667,
        'hash2',
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate;`;
    const expectedWorkersShares = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate_12h,
        hashrate_24h, invalid,
        ip_hash, solo, stale,
        type, valid)
      VALUES (
        1634742080841,
        'worker1',
        'worker1',
        100,
        9942053.925925925,
        2485513.4814814813,
        0,
        'hash1',
        false,
        0,
        'primary',
        1), (
        1634742080841,
        'worker2',
        'worker2',
        100,
        9942053.925925925,
        2485513.4814814813,
        0,
        'hash1',
        true,
        0,
        'primary',
        1)
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate_12h = EXCLUDED.hashrate_12h,
        hashrate_24h = EXCLUDED.hashrate_24h,
        invalid = EXCLUDED.invalid,
        stale = EXCLUDED.stale,
        valid = EXCLUDED.valid;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(11);
      expect(transaction[1]).toBe(expectedMetadataHashrate);
      expect(transaction[2]).toBe(expectedHistoricalMetadataHashrate);
      expect(transaction[3]).toBe(expectedMetadataShares);
      expect(transaction[4]).toBe(expectedMinersHashrate);
      expect(transaction[5]).toBe(expectedHistoricalMinersHashrate);
      expect(transaction[6]).toBe(expectedMinersShares);
      expect(transaction[7]).toBe(expectedWorkersHashrate);
      expect(transaction[8]).toBe(expectedHistoricalWorkersHashrate);
      expect(transaction[9]).toBe(expectedWorkersShares);
      done();
    });
    statistics.handleUpdates(lookups, 'primary', () => {});
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
      { rows: [] },
      null];
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(2);
      done();
    });
    statistics.handleUpdates(lookups, 'primary', () => {});
  });

  test('Test statistics submission handling [1]', (done) => {
    const lookups = [
      null,
      null,
      { rows: [
        { identifier: 'master1', solo: false, miners: 1 },
        { identifier: 'master1', solo: true, miners: 1 },
        { identifier: 'master2', solo: false, miners: 1 }] },
      { rows: [
        { identifier: 'master1', solo: false, workers: 2 },
        { identifier: 'master1', solo: true, workers: 3 },
        { identifier: 'master2', solo: false, workers: 4 }] },
      { rows: [
        { miner: 'miner1', solo: false, work: 100 },
        { miner: 'miner2', solo: false, work: 10 },
        { miner: 'miner3', solo: true, work: 140 }]},
      { rows: [
        { worker: 'worker1', ip_hash: 'hash1', solo: false, work: 100 },
        { worker: 'worker1', ip_hash: 'hash2', solo: true, work: 10 },
        { worker: 'worker2', ip_hash: 'hash2', solo: false, work: 140 }] },
      { rows: [
        { identifier: 'master1', solo: false, work: 1 },
        { identifier: 'master1', solo: true, work: 1 },
        { identifier: 'master2', solo: false, work: 1 }] },
      { rows: [{ identifier: 'master1', invalid: 0, solo: false, stale: 0, valid: 1 }] },
      null,
      { rows: [{ miner: 'miner1', solo: false, hashrate: 1 }] },
      null,
      null,
      { rows: [{ miner: 'worker1', worker: 'worker1', ip_hash: 'hash1', solo: false, hashrate: 1 }] },
      { rows: [{
        miner: 'miner1',
        invalid: 0,
        solo: false,
        sum_work_12h: 100,
        sum_work_24h: 50,
        stale: 0,
        valid: 1 }, {
        miner: 'miner2',
        invalid: 0,
        solo: true,
        sum_work_12h: 100,
        sum_work_24h: 50,
        stale: 0,
        valid: 1 }
      ]},
      { rows: [{
        worker: 'worker1',
        invalid: 0,
        identifier: 'master1',
        ip_hash: 'hash1',
        solo: false,
        sum_work_12h: 100,
        sum_work_24h: 50,
        stale: 0,
        valid: 1 }, {
        worker: 'worker2',
        identifier: 'master1',
        invalid: 0,
        ip_hash: 'hash1',
        solo: true,
        sum_work_12h: 100,
        sum_work_24h: 50,
        stale: 0,
        valid: 1 }
      ]},
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
      { rows: [] },
      null];
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    statistics.handleStatistics('primary', () => done());
  });
});
