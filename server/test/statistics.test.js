const MasterCommands = require('../../database/main/master/commands');
const WorkerCommands = require('../../database/main/worker/commands');
const Logger = require('../main/logger');
const MockDate = require('mockdate');
const Statistics = require('../main/statistics');
const config = require('../../configs/pools/example.js');
const configMain = require('../../configs/main/example.js');
const events = require('events');

////////////////////////////////////////////////////////////////////////////////

function mockClient(configMain, result) {
  const client = new events.EventEmitter();
  client.master = {};
  client.master.commands = new MasterCommands(null, null, configMain);
  client.master.commands.executor = (commands, callback) => {
    client.emit('transaction', commands);
    callback(result);
  };
  client.worker = {};
  client.worker.commands = new WorkerCommands(null, null, configMain);
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
    expect(typeof statistics.handleCurrentMetadata).toBe('function');
    expect(typeof statistics.handleCurrentMiners).toBe('function');
  });

  test('Test statistics handleCurrentMetadata updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const miners = [{ identifier: 'master', count: 1 }];
    const workers = [{ identifier: 'master', count: 1 }];
    const total = [{ identifier: 'master', current_work: 10 }];
    const expected = [{
      timestamp: 1634742080841,
      hashrate: 143165576.5333,
      identifier: 'master',
      miners: 1,
      solo: true,
      type: 'primary',
      workers: 1,
    }];
    expect(statistics.handleCurrentMetadata(miners, workers, total, 'primary', true)).toStrictEqual(expected);
  });

  test('Test statistics handleCurrentMetadata updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    delete configCopy.primary.coin.algorithm;
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const miners = [{ identifier: 'master1', count: 1 }, { identifier: 'master2', count: 1 }];
    const workers = [{ identifier: 'master1', count: 1 }, { identifier: 'master2', count: 3 }];
    const total = [{ identifier: 'master1', current_work: 10 }, { identifier: 'master2', current_work: 10 }];
    const expected = [{
      timestamp: 1634742080841,
      hashrate: 143165576.5333,
      identifier: 'master1',
      miners: 1,
      solo: false,
      type: 'primary',
      workers: 1,
    },{
      timestamp: 1634742080841,
      hashrate: 143165576.5333,
      identifier: 'master2',
      miners: 1,
      solo: false,
      type: 'primary',
      workers: 3,
    }];
    expect(statistics.handleCurrentMetadata(miners, workers, total, 'primary', false)).toStrictEqual(expected);
  });

  test('Test statistics handleCurrentMiners updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const hashrate = [
      { miner: 'miner1', current_work: 100 },
      { miner: 'miner2', current_work: 10 },
      { miner: 'miner3', current_work: 140 },
      { miner: 'miner4', current_work: 140 }];
    const miners = [{ miner: 'miner1'}, { miner: 'miner2'}, { miner: 'miner3'}, { miner: 'miner4'}];
    const sharedWorkers = [
      { miner: 'miner1', active_workers: 1, inactive_workers: 0 },
      { miner: 'miner2', active_workers: 1, inactive_workers: 0 },
      { miner: 'miner3', active_workers: 1, inactive_workers: 0 }];
    const soloWorkers = [
      { miner: 'miner1', active_workers: 1, inactive_workers: 0 },
      { miner: 'miner4', active_workers: 1, inactive_workers: 0 }];
    const expected = [
      { timestamp: 1634742080841, miner: 'miner1', active_shared: 1, active_solo: 1, efficiency: 0, 
        hashrate: 1431655765.3333, inactive_shared: 0, inactive_solo: 0, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner2', active_shared: 1, active_solo: 0, efficiency: 0,
        hashrate: 143165576.5333, inactive_shared: 0, inactive_solo: 0, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner3', active_shared: 1, active_solo: 0, efficiency: 0,
        hashrate: 2004318071.4667, inactive_shared: 0, inactive_solo: 0, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner4', active_shared: 0, active_solo: 1, efficiency: 0,
        hashrate: 2004318071.4667, inactive_shared: 0, inactive_solo: 0, type: 'primary' }];
    expect(statistics.handleCurrentMiners(hashrate, miners, soloWorkers, sharedWorkers, 'primary')).toStrictEqual(expected);
  });

  test('Test statistics handleCurrentMiners updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    delete configCopy.primary.coin.algorithm;
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const hashrate = [
      { miner: 'miner1', current_work: 100 },
      { miner: 'miner4', current_work: 140 }];
    const miners = [{ miner: 'miner1'}, { miner: 'miner2'}, { miner: 'miner3'}, { miner: 'miner4'}];
    const sharedWorkers = [
      { miner: 'miner1', active_workers: 1, inactive_workers: 1 },
      { miner: 'miner2', active_workers: 1, inactive_workers: 0 },
      { miner: 'miner3', active_workers: 1, inactive_workers: 0 }];
    const soloWorkers = [
      { miner: 'miner1', active_workers: 1, inactive_workers: 0 },
      { miner: 'miner4', active_workers: 1, inactive_workers: 1 }];
    const expected = [
      { timestamp: 1634742080841, miner: 'miner1', active_shared: 1, active_solo: 1, efficiency: 0, 
        hashrate: 1431655765.3333, inactive_shared: 1, inactive_solo: 0, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner2', active_shared: 1, active_solo: 0, efficiency: 0,
        hashrate: 0, inactive_shared: 0, inactive_solo: 0, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner3', active_shared: 1, active_solo: 0, efficiency: 0,
        hashrate: 0, inactive_shared: 0, inactive_solo: 0, type: 'primary' },
      { timestamp: 1634742080841, miner: 'miner4', active_shared: 0, active_solo: 1, efficiency: 0,
        hashrate: 2004318071.4667, inactive_shared: 0, inactive_solo: 1, type: 'primary' }];
    expect(statistics.handleCurrentMiners(hashrate, miners, soloWorkers, sharedWorkers, 'primary')).toStrictEqual(expected);
  });

  test('Test statistics handleCurrentWorkers updates [1]', () => {
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
    const stats = [
      { worker: 'miner1', hashrate_12h: 1, hashrate_24h: 1, invalid: 0, stale: 0, solo: false, valid: 1, type: 'primary' },
      { worker: 'miner4', hashrate_12h: 1, hashrate_24h: 1, invalid: 0, stale: 0, solo: false, valid: 1, type: 'primary' }
    ];
    const expected = [
      { timestamp: 1634742080841, miner: 'miner1', worker: 'miner1', efficiency: 90, hashrate: 1431655765.3333, hashrate_12h: 1, hashrate_24h: 1, invalid: 0, solo: false, stale: 0, type: 'primary', valid: 1 },
      { timestamp: 1634742080841, miner: 'miner2', worker: 'miner2', efficiency: 90, hashrate: 143165576.5333, hashrate_12h: 0, hashrate_24h: 0, invalid: 0, solo: false, stale: 0, type: 'primary', valid: 0 },
      { timestamp: 1634742080841, miner: 'miner3', worker: 'miner3', efficiency: 90, hashrate: 2004318071.4667, hashrate_12h: 0, hashrate_24h: 0, invalid: 0, solo: false, stale: 0, type: 'primary', valid: 0 }];
    expect(statistics.handleCurrentWorkers(hashrate, workers, stats, 'primary')).toStrictEqual(expected);
  });

  test('Test statistics handleCurrentWorkers updates [2]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const hashrate = [];
    const workers = [];
    const stats = [];
    const expected = [];
    expect(statistics.handleCurrentWorkers(hashrate, workers, stats, 'primary')).toStrictEqual(expected);
  });

  test('Test statistics handleHistoricalMinersHashrate updates [1]', () => {
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
    expect(statistics.handleHistoricalMinersHashrate(miners, 'primary')).toStrictEqual(expected);
  });

  test('Test statistics handleHistoricalMetadata updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const metadata = [{
      hashrate: 100,
      identifier: 'master1',
      miners: 1,
      solo: false,
      type: 'primary',
      workers: 1,
    },{
      hashrate: 100,
      identifier: 'master2',
      miners: 1,
      solo: false,
      type: 'primary',
      workers: 1,
    }];
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634742600000,
      hashrate: 100,
      identifier: 'master1',
      miners: 1,
      solo: false,
      type: 'primary',
      workers: 1,
    },{
      timestamp: 1634742080841,
      recent: 1634742600000,
      hashrate: 100,
      identifier: 'master2',
      miners: 1,
      solo: false,
      type: 'primary',
      workers: 1,
    }];
    expect(statistics.handleHistoricalMetadata(metadata, 'primary')).toStrictEqual(expected);
  });

  test('Test statistics handleHistoricalNetwork updates [10]', () => {
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

  test('Test statistics handleHistoricalWorkersHashrate updates [1]', () => {
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
      hashrate: 100,
      solo: false,
      type: 'primary',
      work: 0.1,
    }];
    const expected = [{
      timestamp: 1634742080841,
      recent: 1,
      miner: 'miner1',
      worker: 'worker1',
      hashrate: 100,
      solo: false,
      type: 'primary',
    }];
    expect(statistics.handleHistoricalWorkersHashrate(workers, 'primary')).toStrictEqual(expected);
  });
  
  test('Test statistics handleHistoricalWorkersHashrate updates [1]', () => {
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    const workers = [{
      timestamp: 1,
      recent: 1634742000000,
      miner: 'miner1',
      worker: 'worker1',
      hashrate: 100,
      solo: false,
      type: 'primary',
      work: 0.1,
    }];
    const expected = [{
      timestamp: 1634742080841,
      recent: 1634742000000,
      miner: 'miner1',
      worker: 'worker1',
      hashrate: 715827.8827,
      solo: false,
      type: 'primary',
    }];
    expect(statistics.handleHistoricalWorkersHashrate(workers, 'primary')).toStrictEqual(expected);
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
      { rows: [{ identifier: 'master', count: 1 }] },
      { rows: [{ identifier: 'master', count: 2 }] },
      { rows: [{ identifier: 'master', count: 3 }] },
      { rows: [{ identifier: 'master', count: 4 }] },
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
      { rows: [{ identifier: 'master', current_work: 10 }] },
      { rows: [{ identifier: 'master', current_work: 10 }] },
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
        worker: 'miner1',
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
        worker: 'miner1',
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
        worker: 'miner1',
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
      { rows: [{
        miner: 'miner1',
        active_workers: 1,
        inactive_workers: 1,
      }]},
      { rows: [{
        miner: 'miner1',
        active_workers: 1,
        inactive_workers: 1,
      }]},
      { rows: [{
        recent: 1,
        miner: 'miner1',
        worker: 'miner1',
        solo: false,
        type: 'primary',
        work: 1,
      }]},
      { rows: [{
        recent: 1,
        miner: 'miner1',
        worker: 'miner1',
        hashrate: 1,
        solo: false,
        type: 'primary',
        work: 1,
      }]},
      { rows: [{
        worker: 'miner1',
        hashrate_12h: 1,
        hashrate_24h: 1,
        invalid: 1,
        stale: 1,
        solo: true,
        valid: 1,
        type: 'primary'
      }]},
      { rows: [{
        worker: 'miner1',
        hashrate_12h: 1,
        hashrate_24h: 1,
        invalid: 1,
        stale: 1,
        solo: false,
        valid: 1,
        type: 'primary'
      }]},
      null];
    const expectedSoloMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, hashrate, identifier,
        miners, solo, type, workers)
      VALUES (
        1634742080841,
        143165576.5333,
        'master',
        1,
        true,
        'primary',
        3)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedSoloHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, identifier,
        hashrate, miners, solo, type,
        workers)
      VALUES (
        1634742080841,
        1634742600000,
        'master',
        143165576.5333,
        1,
        true,
        'primary',
        3)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedSharedMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, hashrate, identifier,
        miners, solo, type, workers)
      VALUES (
        1634742080841,
        143165576.5333,
        'master',
        2,
        false,
        'primary',
        4)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedSharedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, identifier,
        hashrate, miners, solo, type,
        workers)
      VALUES (
        1634742080841,
        1634742600000,
        'master',
        143165576.5333,
        2,
        false,
        'primary',
        4)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedMiners = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, active_shared,
        active_solo, efficiency, hashrate,
        inactive_shared, inactive_solo,
        type)
      VALUES (
        1634742080841,
        'miner1',
        1,
        1,
        100,
        1431655765.3333,
        1,
        1,
        'primary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        active_shared = EXCLUDED.active_shared,
        active_solo = EXCLUDED.active_solo,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate,
        inactive_shared = EXCLUDED.inactive_shared,
        inactive_solo = EXCLUDED.inactive_solo;`;
    const expectedSoloWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate,
        hashrate_12h, hashrate_12h,
        invalid, solo, stale, type,
        valid)
      VALUES (
        1634742080841,
        'miner1',
        'miner1',
        100,
        1431655765.3333,
        1,
        1,
        1,
        true,
        1,
        'primary',
        1), (
        1634742080841,
        'miner1',
        'miner1',
        100,
        1431655765.3333,
        1,
        1,
        1,
        true,
        1,
        'primary',
        1)
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate,
        hashrate_12h = EXCLUDED.hashrate_12h,
        hashrate_24h = EXCLUDED.hashrate_24h,
        invalid = EXCLUDED.invalid,
        stale = EXCLUDED.stale,
        valid = EXCLUDED.valid;`;
    const expectedSharedWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate,
        hashrate_12h, hashrate_12h,
        invalid, solo, stale, type,
        valid)
      VALUES (
        1634742080841,
        'miner1',
        'miner1',
        100,
        1431655765.3333,
        1,
        1,
        1,
        false,
        1,
        'primary',
        1)
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate,
        hashrate_12h = EXCLUDED.hashrate_12h,
        hashrate_24h = EXCLUDED.hashrate_24h,
        invalid = EXCLUDED.invalid,
        stale = EXCLUDED.stale,
        valid = EXCLUDED.valid;`;
    const expectedHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        hashrate, type)
      VALUES (
        1634742080841,
        1,
        'miner1',
        53128577.0339,
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
        1,
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(11);
      expect(transaction[1]).toBe(expectedSoloMetadata);
      expect(transaction[2]).toBe(expectedSoloHistoricalMetadata);
      expect(transaction[3]).toBe(expectedSharedMetadata);
      expect(transaction[4]).toBe(expectedSharedHistoricalMetadata);
      expect(transaction[5]).toBe(expectedMiners);
      expect(transaction[6]).toBe(expectedSoloWorkers);
      expect(transaction[7]).toBe(expectedSharedWorkers);
      expect(transaction[8]).toBe(expectedHistoricalMiners);
      expect(transaction[9]).toBe(expectedHistoricalWorkers);
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
      { rows: []},
      { rows: []},
      { rows: []},
      { rows: []},
      { rows: []},
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
      { rows: [{ identifier: 'master', count: 1 }] },
      { rows: [{ identifier: 'master', count: 2 }] },
      { rows: [{ identifier: 'master', count: 3 }] },
      { rows: [{ identifier: 'master', count: 4 }] },
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
      { rows: [{ identifier: 'master', current_work: 10 }] },
      { rows: [{ identifier: 'master', current_work: 10 }] },
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        stale: 0,
        valid: 1,
      }]},
      null,
      null,
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'miner1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        last_share: 1,
        solo: true,
        stale: 0,
        valid: 1,
      },{
        timestamp: 1,
        miner: 'miner1',
        worker: 'miner1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        last_share: 1,
        solo: true,
        stale: 0,
        valid: 1,
      }]},
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'miner1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        last_share: 1,
        solo: false,
        stale: 0,
        valid: 1,
      }]},
      { rows: [{
        miner: 'miner1',
        active_workers: 1,
        inactive_workers: 1,
      }]},
      { rows: [{
        miner: 'miner1',
        active_workers: 1,
        inactive_workers: 1,
      }]},
      { rows: [{
        recent: 1,
        miner: 'miner1',
        worker: 'miner1',
        solo: false,
        work: 1,
      }]},
      { rows: [{
        recent: 1,
        miner: 'miner1',
        worker: 'miner1',
        hashrate: 1,
        solo: false,
        work: 1,
      }]},
      { rows: [{
        worker: 'miner1',
        hashrate_12h: 1,
        hashrate_24h: 1,
        invalid: 1,
        stale: 1,
        solo: true,
        valid: 1,
      }]},
      { rows: [{
        worker: 'miner1',
        hashrate_12h: 1,
        hashrate_24h: 1,
        invalid: 1,
        stale: 1,
        solo: false,
        valid: 1,
      }]},
      null];
      const expectedSoloMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, hashrate, identifier,
        miners, solo, type, workers)
      VALUES (
        1634742080841,
        143165576.5333,
        'master',
        1,
        true,
        'auxiliary',
        3)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedSoloHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, identifier,
        hashrate, miners, solo, type,
        workers)
      VALUES (
        1634742080841,
        1634742600000,
        'master',
        143165576.5333,
        1,
        true,
        'auxiliary',
        3)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedSharedMetadata = `
      INSERT INTO "Pool-Bitcoin".current_metadata (
        timestamp, hashrate, identifier,
        miners, solo, type, workers)
      VALUES (
        1634742080841,
        143165576.5333,
        'master',
        2,
        false,
        'auxiliary',
        4)
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedSharedHistoricalMetadata = `
      INSERT INTO "Pool-Bitcoin".historical_metadata (
        timestamp, recent, identifier,
        hashrate, miners, solo, type,
        workers)
      VALUES (
        1634742080841,
        1634742600000,
        'master',
        143165576.5333,
        2,
        false,
        'auxiliary',
        4)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
    const expectedMiners = `
      INSERT INTO "Pool-Bitcoin".current_miners (
        timestamp, miner, active_shared,
        active_solo, efficiency, hashrate,
        inactive_shared, inactive_solo,
        type)
      VALUES (
        1634742080841,
        'miner1',
        1,
        1,
        100,
        1431655765.3333,
        1,
        1,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        active_shared = EXCLUDED.active_shared,
        active_solo = EXCLUDED.active_solo,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate,
        inactive_shared = EXCLUDED.inactive_shared,
        inactive_solo = EXCLUDED.inactive_solo;`;
    const expectedSoloWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate,
        hashrate_12h, hashrate_12h,
        invalid, solo, stale, type,
        valid)
      VALUES (
        1634742080841,
        'miner1',
        'miner1',
        100,
        1431655765.3333,
        1,
        1,
        1,
        true,
        1,
        'auxiliary',
        1), (
        1634742080841,
        'miner1',
        'miner1',
        100,
        1431655765.3333,
        1,
        1,
        1,
        true,
        1,
        'auxiliary',
        1)
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate,
        hashrate_12h = EXCLUDED.hashrate_12h,
        hashrate_24h = EXCLUDED.hashrate_24h,
        invalid = EXCLUDED.invalid,
        stale = EXCLUDED.stale,
        valid = EXCLUDED.valid;`;
    const expectedSharedWorkers = `
      INSERT INTO "Pool-Bitcoin".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate,
        hashrate_12h, hashrate_12h,
        invalid, solo, stale, type,
        valid)
      VALUES (
        1634742080841,
        'miner1',
        'miner1',
        100,
        1431655765.3333,
        1,
        1,
        1,
        false,
        1,
        'auxiliary',
        1)
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate,
        hashrate_12h = EXCLUDED.hashrate_12h,
        hashrate_24h = EXCLUDED.hashrate_24h,
        invalid = EXCLUDED.invalid,
        stale = EXCLUDED.stale,
        valid = EXCLUDED.valid;`;
    const expectedHistoricalMiners = `
      INSERT INTO "Pool-Bitcoin".historical_miners (
        timestamp, recent, miner,
        hashrate, type)
      VALUES (
        1634742080841,
        1,
        'miner1',
        53128577.0339,
        'auxiliary')
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
        1,
        false,
        'auxiliary')
      ON CONFLICT ON CONSTRAINT historical_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate;`;
    client.on('transaction', (transaction) => {
      expect(transaction.length).toBe(11);
      expect(transaction[1]).toBe(expectedSoloMetadata);
      expect(transaction[2]).toBe(expectedSoloHistoricalMetadata);
      expect(transaction[3]).toBe(expectedSharedMetadata);
      expect(transaction[4]).toBe(expectedSharedHistoricalMetadata);
      expect(transaction[5]).toBe(expectedMiners);
      expect(transaction[6]).toBe(expectedSoloWorkers);
      expect(transaction[7]).toBe(expectedSharedWorkers);
      expect(transaction[8]).toBe(expectedHistoricalMiners);
      expect(transaction[9]).toBe(expectedHistoricalWorkers);
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
      { rows: []},
      { rows: []},
      { rows: []},
      { rows: []},
      { rows: []},
      { rows: []},
      { rows: []},
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
      { rows: [{ identifier: 'master', count: 1 }] },
      { rows: [{ identifier: 'master', count: 2 }] },
      { rows: [{ identifier: 'master', count: 3 }] },
      { rows: [{ identifier: 'master', count: 4 }] },
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
      { rows: [{ identifier: 'master', current_work: 10 }] },
      { rows: [{ identifier: 'master', current_work: 10 }] },
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
        worker: 'miner1',
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
        worker: 'miner1',
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
        worker: 'miner1',
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
      { rows: [{
        miner: 'miner1',
        active_workers: 1,
        inactive_workers: 1,
      }]},
      { rows: [{
        miner: 'miner1',
        active_workers: 1,
        inactive_workers: 1,
      }]},
      { rows: [{
        recent: 1,
        miner: 'miner1',
        worker: 'miner1',
        solo: false,
        type: 'primary',
        work: 1,
      }]},
      { rows: [{
        recent: 1,
        miner: 'miner1',
        worker: 'miner1',
        hashrate: 1,
        solo: false,
        type: 'primary',
        work: 1,
      }]},
      { rows: [{
        worker: 'miner1',
        hashrate_12h: 1,
        hashrate_24h: 1,
        invalid: 1,
        stale: 1,
        solo: true,
        valid: 1,
        type: 'primary'
      }]},
      { rows: [{
        worker: 'miner1',
        hashrate_12h: 1,
        hashrate_24h: 1,
        invalid: 1,
        stale: 1,
        solo: false,
        valid: 1,
        type: 'primary'
      }]},
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
      { rows: [{ identifier: 'master', count: 1 }] },
      { rows: [{ identifier: 'master', count: 2 }] },
      { rows: [{ identifier: 'master', count: 3 }] },
      { rows: [{ identifier: 'master', count: 4 }] },
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
      { rows: [{ identifier: 'master', current_work: 10 }] },
      { rows: [{ identifier: 'master', current_work: 10 }] },
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
        worker: 'miner1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        last_share: 1,
        solo: true,
        stale: 0,
        type: 'auxiliary',
        valid: 1,
      },{
        timestamp: 1,
        miner: 'miner1',
        worker: 'miner1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        last_share: 1,
        solo: true,
        stale: 0,
        type: 'auxiliary',
        valid: 1,
      }]},
      { rows: [{
        timestamp: 1,
        miner: 'miner1',
        worker: 'miner1',
        efficiency: 100,
        effort: 100,
        hashrate: 100,
        invalid: 0,
        last_share: 1,
        solo: false,
        stale: 0,
        type: 'auxiliary',
        valid: 1,
      }]},
      { rows: [{
        miner: 'miner1',
        active_workers: 1,
        inactive_workers: 1,
      }]},
      { rows: [{
        miner: 'miner1',
        active_workers: 1,
        inactive_workers: 1,
      }]},
      { rows: [{
        recent: 1,
        miner: 'miner1',
        worker: 'miner1',
        solo: false,
        type: 'auxiliary',
        work: 1,
      }]},
      { rows: [{
        recent: 1,
        miner: 'miner1',
        worker: 'miner1',
        hashrate: 1,
        solo: false,
        type: 'auxiliary',
        work: 1,
      }]},
      { rows: [{
        worker: 'miner1',
        hashrate_12h: 1,
        hashrate_24h: 1,
        invalid: 1,
        stale: 1,
        solo: true,
        valid: 1,
        type: 'auxiliary'
      }]},
      { rows: [{
        worker: 'miner1',
        hashrate_12h: 1,
        hashrate_24h: 1,
        invalid: 1,
        stale: 1,
        solo: false,
        valid: 1,
        type: 'auxiliary'
      }]},
      null];
    MockDate.set(1634742080841);
    const client = mockClient(configMainCopy, lookups);
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    statistics.handleStatistics('auxiliary', () => done());
  });

  // test('Test statistics submission handling [3]', (done) => {
  //   const lookups = [
  //     null,
  //     null,
  //     { rows: [{ count: 1 }] },
  //     { rows: [{ count: 1 }] },
  //     { rows: [{ count: 1 }] },
  //     { rows: [{ count: 2 }] },
  //     { rows: [
  //       { miner: 'miner1', current_work: 100 },
  //       { miner: 'miner2', current_work: 10 },
  //       { miner: 'miner3', current_work: 140 }]},
  //     { rows: [
  //       { worker: 'miner1', current_work: 100 },
  //       { worker: 'miner2', current_work: 10 },
  //       { worker: 'miner3', current_work: 140 }]},
  //     { rows: [
  //       { worker: 'miner1', current_work: 100 },
  //       { worker: 'miner2', current_work: 10 },
  //       { worker: 'miner3', current_work: 140 }]},
  //     { rows: [{ current_work: 100 }] },
  //     { rows: [{ current_work: 100 }] },
  //     null,
  //     { rows: [{
  //       timestamp: 1,
  //       miner: 'miner1',
  //       efficiency: 100,
  //       effort: 100,
  //       hashrate: 100,
  //       type: 'auxiliary',
  //     }]},
  //     null,
  //     null,
  //     { rows: [{
  //       timestamp: 1,
  //       miner: 'miner1',
  //       worker: 'worker1',
  //       efficiency: 100,
  //       effort: 100,
  //       hashrate: 100,
  //       solo: true,
  //       type: 'auxiliary',
  //     }]},
  //     { rows: [{
  //       timestamp: 1,
  //       miner: 'miner1',
  //       worker: 'worker1',
  //       efficiency: 100,
  //       effort: 100,
  //       hashrate: 100,
  //       solo: false,
  //       type: 'auxiliary',
  //     }]},
  //     null];
  //   MockDate.set(1634742080841);
  //   const client = mockClient(configMainCopy, lookups);
  //   const logger = new Logger(configMainCopy);
  //   const template = { algorithms: { sha256d: { multiplier: 1 }}};
  //   const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
  //   statistics.handleStatistics('auxiliary', () => done());
  // });

  // test('Test statistics submission handling [4]', (done) => {
  //   const lookups = [
  //     null,
  //     null,
  //     { rows: [{ count: 1 }] },
  //     { rows: [{ count: 1 }] },
  //     { rows: [{ count: 1 }] },
  //     { rows: [{ count: 2 }] },
  //     { rows: [
  //       { miner: 'miner1', current_work: 100 },
  //       { miner: 'miner2', current_work: 10 },
  //       { miner: 'miner3', current_work: 140 }]},
  //     { rows: [
  //       { worker: 'miner1', current_work: 100 },
  //       { worker: 'miner2', current_work: 10 },
  //       { worker: 'miner3', current_work: 140 }]},
  //     { rows: [
  //       { worker: 'miner1', current_work: 100 },
  //       { worker: 'miner2', current_work: 10 },
  //       { worker: 'miner3', current_work: 140 }]},
  //     { rows: [{ current_work: 100 }] },
  //     { rows: [{ current_work: 100 }] },
  //     null,
  //     { rows: [{
  //       timestamp: 1,
  //       miner: 'miner1',
  //       efficiency: 100,
  //       effort: 100,
  //       hashrate: 100,
  //       type: 'auxiliary',
  //     }]},
  //     null,
  //     null,
  //     { rows: [{
  //       timestamp: 1,
  //       miner: 'miner1',
  //       worker: 'worker1',
  //       efficiency: 100,
  //       effort: 100,
  //       hashrate: 100,
  //       solo: true,
  //       type: 'auxiliary',
  //     }]},
  //     { rows: [{
  //       timestamp: 1,
  //       miner: 'miner1',
  //       worker: 'worker1',
  //       efficiency: 100,
  //       effort: 100,
  //       hashrate: 100,
  //       solo: false,
  //       type: 'auxiliary',
  //     }]},
  //     null];
  //   MockDate.set(1634742080841);
  //   const client = mockClient(configMainCopy, lookups);
  //   const logger = new Logger(configMainCopy);
  //   const template = { algorithms: { sha256d: { multiplier: 1 }}};
  //   const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
  //   statistics.handleStatistics('auxiliary', () => done());
  // });

  test('Test statistics submission handling [5]', (done) => {
    const client = mockClient(configMainCopy, { rows: [] });
    const logger = new Logger(configMainCopy);
    const template = { algorithms: { sha256d: { multiplier: 1 }}};
    const statistics = new Statistics(logger, client, configCopy, configMainCopy, template);
    statistics.handleStatistics('unknown', () => done());
  });
});
