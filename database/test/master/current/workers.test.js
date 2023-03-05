const CurrentWorkers = require('../../../main/master/current/workers');
const Logger = require('../../../../server/main/logger');
const configMain = require('../../../../configs/main/example.js');
const logger = new Logger(configMain);

////////////////////////////////////////////////////////////////////////////////

describe('Test database workers functionality', () => {

  let configMainCopy;
  beforeEach(() => {
    configMainCopy = JSON.parse(JSON.stringify(configMain));
  });

  test('Test initialization of workers commands', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    expect(typeof workers.configMain).toBe('object');
    expect(typeof workers.selectCurrentWorkersMain).toBe('function');
    expect(typeof workers.insertCurrentWorkersHashrate).toBe('function');
  });

  test('Test query handling [1]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    expect(workers.handleStrings({ test: 'test' }, 'test')).toBe(' = \'test\'');
    expect(workers.handleStrings({ miner: 'miner1' }, 'miner')).toBe(' = \'miner1\'');
  });

  test('Test query handling [2]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    expect(workers.handleNumbers({ test: '100' }, 'test')).toBe(' = 100');
    expect(workers.handleNumbers({ timestamp: 'lt100' }, 'timestamp')).toBe(' < 100');
    expect(workers.handleNumbers({ timestamp: 'le100' }, 'timestamp')).toBe(' <= 100');
    expect(workers.handleNumbers({ timestamp: 'gt100' }, 'timestamp')).toBe(' > 100');
    expect(workers.handleNumbers({ timestamp: 'ge100' }, 'timestamp')).toBe(' >= 100');
    expect(workers.handleNumbers({ timestamp: 'ne100' }, 'timestamp')).toBe(' != 100');
  });

  test('Test query handling [3]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    expect(workers.handleSpecial({ limit: '100' }, '')).toBe(' LIMIT 100');
    expect(workers.handleSpecial({ offset: '1' }, '')).toBe(' OFFSET 1');
    expect(workers.handleSpecial({ order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC');
    expect(workers.handleSpecial({ direction: 'ascending' }, '')).toBe(' ORDER BY id ASC');
    expect(workers.handleSpecial({ limit: '100', offset: '1' }, '')).toBe(' LIMIT 100 OFFSET 1');
    expect(workers.handleSpecial({ limit: '100', offset: '1', order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
    expect(workers.handleSpecial({ limit: '100', offset: '1', order: 'parameter', direction: 'descending' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
  });

  test('Test workers command handling [1]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const parameters = { miner: 'miner1', type: 'primary' };
    const response = workers.selectCurrentWorkersMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".current_workers WHERE miner = \'miner1\' AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test workers command handling [2]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const parameters = { worker: 'worker1', type: 'primary' };
    const response = workers.selectCurrentWorkersMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".current_workers WHERE worker = \'worker1\' AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test workers command handling [3]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const parameters = { type: 'primary' };
    const response = workers.selectCurrentWorkersMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".current_workers WHERE type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test workers command handling [4]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const parameters = { type: 'primary', hmm: 'test' };
    const response = workers.selectCurrentWorkersMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".current_workers WHERE type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test workers command handling [5]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const addresses = ['address1', 'address2', 'address3'];
    const response = workers.selectCurrentWorkersBatchAddresses('Pool-Main', addresses, 'primary');
    const expected = `
      SELECT DISTINCT ON (worker) * FROM "Pool-Main".current_workers
      WHERE worker IN (address1, address2, address3) AND type = 'primary'
      ORDER BY worker, timestamp DESC;`;
    expect(response).toBe(expected);
  });

  test('Test workers command handling [6]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const response = workers.selectCurrentWorkersBatchAddresses('Pool-Main', [], 'primary');
    const expected = `
      SELECT * FROM "Pool-Main".current_workers LIMIT 0;`
    expect(response).toBe(expected);
  });

  test('Test workers command handling [7]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const updates = {
      timestamp: 1,
      worker: 'worker1',
      miner: 'miner1',
      efficiency: 100,
      hashrate: 1,
      solo: false,
      type: 'primary',
    };
    const response = workers.insertCurrentWorkersHashrate('Pool-Main', [updates]);
    const expected = `
      INSERT INTO "Pool-Main".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate, solo,
        type)
      VALUES (
        1,
        'miner1',
        'worker1',
        100,
        1,
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate;`;
    expect(response).toBe(expected);
  });

  test('Test workers command handling [8]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const updates = {
      timestamp: 1,
      worker: 'worker1',
      miner: 'miner1',
      efficiency: 100,
      hashrate: 1,
      solo: false,
      type: 'primary',
    };
    const response = workers.insertCurrentWorkersHashrate('Pool-Main', [updates, updates]);
    const expected = `
      INSERT INTO "Pool-Main".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate, solo,
        type)
      VALUES (
        1,
        'miner1',
        'worker1',
        100,
        1,
        false,
        'primary'), (
        1,
        'miner1',
        'worker1',
        100,
        1,
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate;`;
    expect(response).toBe(expected);
  });

  test('Test workers command handling [9]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const updates = {
      worker: 'worker1',
      miner: 'miner1',
      timestamp: 1,
      effort: 100,
      identifier: 'master',
      ip_hash: 'hash1',
      last_octet: 1,
      last_share: 1,
      offline_tag: false,
      solo: false,
      type: 'primary',
    };
    const response = workers.insertCurrentWorkersRounds('Pool-Main', [updates]);
    const expected = `
      INSERT INTO "Pool-Main".current_workers (
        timestamp, miner, worker,
        effort, identifier,
        ip_hash, last_octet, last_share,
        offline_tag, solo, type)
      VALUES (
        1,
        'miner1',
        'worker1',
        100,
        'master',
        'hash1',
        1,
        1,
        false,
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        effort = "Pool-Main".current_workers.effort + EXCLUDED.effort,
        identifier = EXCLUDED.identifier,
        ip_hash = EXCLUDED.ip_hash,
        last_octet = EXCLUDED.last_octet,
        last_share = EXCLUDED.last_share,
        offline_tag = EXCLUDED.offline_tag,
        solo = EXCLUDED.solo;`;
    expect(response).toBe(expected);
  });

  test('Test workers command handling [10]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const updates = {
      worker: 'worker1',
      miner: 'miner1',
      timestamp: 1,
      effort: 100,
      identifier: 'master',
      ip_hash: 'hash1',
      last_octet: 1,
      last_share: 1,
      offline_tag: false,
      solo: false,
      type: 'primary',
    };
    const response = workers.insertCurrentWorkersRounds('Pool-Main', [updates, updates]);
    const expected = `
      INSERT INTO "Pool-Main".current_workers (
        timestamp, miner, worker,
        effort, identifier,
        ip_hash, last_octet, last_share,
        offline_tag, solo, type)
      VALUES (
        1,
        'miner1',
        'worker1',
        100,
        'master',
        'hash1',
        1,
        1,
        false,
        false,
        'primary'), (
        1,
        'miner1',
        'worker1',
        100,
        'master',
        'hash1',
        1,
        1,
        false,
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        effort = "Pool-Main".current_workers.effort + EXCLUDED.effort,
        identifier = EXCLUDED.identifier,
        ip_hash = EXCLUDED.ip_hash,
        last_octet = EXCLUDED.last_octet,
        last_share = EXCLUDED.last_share,
        offline_tag = EXCLUDED.offline_tag,
        solo = EXCLUDED.solo;`;
    expect(response).toBe(expected);
  });

  test('Test workers command handling [11]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const updates = {
      timestamp: 1,
      worker: 'worker1',
      miner: 'miner1',
      average_hashrate: 1,
      invalid: 1,
      solo: false,
      stale: 1,
      type: 'primary',
      valid: 1
    };
    const response = workers.insertCurrentWorkersUpdates('Pool-Main', [updates]);
    const expected = `
      INSERT INTO "Pool-Main".current_workers (
        timestamp, miner, worker,
        average_hashrate, invalid,
        solo, stale, type, valid)
      VALUES (
        1,
        'miner1',
        'worker1',
        1,
        1,
        false,
        1,
        'primary',
        1)
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        average_hashrate = EXCLUDED.average_hashrate,
        invalid = EXCLUDED.invalid,
        stale = EXCLUDED.stale,
        valid = EXCLUDED.valid;`;
    expect(response).toBe(expected);
  });

  test('Test workers command handling [12]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const updates = {
      timestamp: 1,
      worker: 'worker1',
      miner: 'miner1',
      average_hashrate: 1,
      invalid: 1,
      solo: false,
      stale: 1,
      type: 'primary',
      valid: 1
    };
    const response = workers.insertCurrentWorkersUpdates('Pool-Main', [updates, updates]);
    const expected = `
      INSERT INTO "Pool-Main".current_workers (
        timestamp, miner, worker,
        average_hashrate, invalid,
        solo, stale, type, valid)
      VALUES (
        1,
        'miner1',
        'worker1',
        1,
        1,
        false,
        1,
        'primary',
        1), (
        1,
        'miner1',
        'worker1',
        1,
        1,
        false,
        1,
        'primary',
        1)
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        average_hashrate = EXCLUDED.average_hashrate,
        invalid = EXCLUDED.invalid,
        stale = EXCLUDED.stale,
        valid = EXCLUDED.valid;`;
    expect(response).toBe(expected);
  });


  test('Test workers command handling [13]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const response = workers.updateCurrentSharedWorkersRoundsReset('Pool-Main', 1, 'primary');
    const expected = `
      UPDATE "Pool-Main".current_workers
      SET timestamp = 1,
        effort = 0
      WHERE solo = false
      AND type = 'primary';`;
    expect(response).toBe(expected);
  });

  test('Test workers command handling [14]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const response = workers.updateCurrentSoloWorkersRoundsReset('Pool-Main', 1, 'miner1', 'primary');
    const expected = `
      UPDATE "Pool-Main".current_workers
      SET timestamp = 1,
        effort = 0
      WHERE miner = 'miner1'
      AND solo = true
      AND type = 'primary';`;
    expect(response).toBe(expected);
  });

  test('Test workers command handling [15]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const response = workers.selectCurrentWorkersLastShare('Pool-Main', 100, 50, false, 'primary');
    const expected = `
      SELECT miner,
        COUNT(CASE WHEN last_share > 100
          THEN 1 ELSE null END) AS active_workers,
        COUNT(CASE WHEN last_share > 50
          AND last_share < 100
          THEN 1 ELSE null END) AS inactive_workers
      FROM "Pool-Main".current_workers
      WHERE solo = false
        AND type = 'primary'
      GROUP BY miner;`;
    expect(response).toBe(expected);
  });

  test('Test workers command handling [16]', () => {
    const workers = new CurrentWorkers(logger, configMainCopy);
    const response = workers.deleteCurrentWorkersInactive('Pool-Main', 1);
    const expected = `
      DELETE FROM "Pool-Main".current_workers
      WHERE last_share < 1;`;
    expect(response).toBe(expected);
  });
});
