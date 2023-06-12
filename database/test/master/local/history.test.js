const LocalHistory = require('../../../main/master/local/history');
const Logger = require('../../../../server/main/logger');
const configMain = require('../../../../configs/main/example.js');
const logger = new Logger(configMain);

////////////////////////////////////////////////////////////////////////////////

describe('Test database transactions functionality', () => {

  let configMainCopy;
  beforeEach(() => {
    configMainCopy = JSON.parse(JSON.stringify(configMain));
  });

  test('Test initialization of transactions commands', () => {
    const history = new LocalHistory(logger, configMainCopy);
    expect(typeof history.configMain).toBe('object');
    expect(typeof history.selectLocalHistoryMain).toBe('function');
    expect(typeof history.insertLocalHistoryCounts).toBe('function');
  });

  test('Test query handling [1]', () => {
    const history = new LocalHistory(logger, configMainCopy);
    expect(history.handleStrings({ test: 'test' }, 'test')).toBe(' = \'test\'');
    expect(history.handleStrings({ miner: 'miner1' }, 'miner')).toBe(' = \'miner1\'');
  });

  test('Test query handling [2]', () => {
    const history = new LocalHistory(logger, configMainCopy);
    expect(history.handleNumbers({ test: '100' }, 'test')).toBe(' = 100');
    expect(history.handleNumbers({ timestamp: 'lt100' }, 'timestamp')).toBe(' < 100');
    expect(history.handleNumbers({ timestamp: 'le100' }, 'timestamp')).toBe(' <= 100');
    expect(history.handleNumbers({ timestamp: 'gt100' }, 'timestamp')).toBe(' > 100');
    expect(history.handleNumbers({ timestamp: 'ge100' }, 'timestamp')).toBe(' >= 100');
    expect(history.handleNumbers({ timestamp: 'ne100' }, 'timestamp')).toBe(' != 100');
  });

  test('Test query handling [3]', () => {
    const history = new LocalHistory(logger, configMainCopy);
    expect(history.handleSpecial({ limit: '100' }, '')).toBe(' LIMIT 100');
    expect(history.handleSpecial({ offset: '1' }, '')).toBe(' OFFSET 1');
    expect(history.handleSpecial({ order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC');
    expect(history.handleSpecial({ direction: 'ascending' }, '')).toBe(' ORDER BY id ASC');
    expect(history.handleSpecial({ limit: '100', offset: '1' }, '')).toBe(' LIMIT 100 OFFSET 1');
    expect(history.handleSpecial({ limit: '100', offset: '1', order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
    expect(history.handleSpecial({ limit: '100', offset: '1', order: 'parameter', direction: 'descending' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
  });

  test('Test history command handling [1]', () => {
    const history = new LocalHistory(logger, configMainCopy);
    const parameters = { timestamp: 'ge1' };
    const response = history.selectLocalHistoryMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".local_history WHERE timestamp >= 1;';
    expect(response).toBe(expected);
  });

  test('Test history command handling [2]', () => {
    const history = new LocalHistory(logger, configMainCopy);
    const parameters = { timestamp: 'ge1', recent: 'lt1' };
    const response = history.selectLocalHistoryMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".local_history WHERE timestamp >= 1 AND recent < 1;';
    expect(response).toBe(expected);
  });

  test('Test history command handling [4]', () => {
    const history = new LocalHistory(logger, configMainCopy);
    const updates = {
      timestamp: 1,
      recent: 1,
      share_count: 1,
      transaction_count: 1,
    };
    const response = history.insertLocalHistoryCounts('Pool-Main', [updates]);
    const expected = `
      INSERT INTO "Pool-Main".local_history (
        timestamp, recent,
        share_count, transaction_count)
      VALUES (
        1,
        1,
        1,
        1)
      ON CONFLICT ON CONSTRAINT local_history_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        share_count = EXCLUDED.share_count,
        transaction_count = EXCLUDED.transaction_count;`;
    expect(response).toBe(expected);
  });

  test('Test history command handling [4]', () => {
    const history = new LocalHistory(logger, configMainCopy);
    const updates = {
      timestamp: 1,
      recent: 1,
      share_count: 1,
      transaction_count: 1,
    };
    const response = history.insertLocalHistoryCounts('Pool-Main', [updates, updates]);
    const expected = `
      INSERT INTO "Pool-Main".local_history (
        timestamp, recent,
        share_count, transaction_count)
      VALUES (
        1,
        1,
        1,
        1), (
        1,
        1,
        1,
        1)
      ON CONFLICT ON CONSTRAINT local_history_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        share_count = EXCLUDED.share_count,
        transaction_count = EXCLUDED.transaction_count;`;
    expect(response).toBe(expected);
  });

  test('Test history command handling [5]', () => {
    const history = new LocalHistory(logger, configMainCopy);
    const response = history.insertLocalHistoryWrites('Pool-Main', 1, 1, 1);
    const expected = `
      INSERT INTO "Pool-Main".local_history (
        timestamp, recent,
        share_writes)
      VALUES (1, 1, 1)
      ON CONFLICT ON CONSTRAINT local_history_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        share_writes = "Pool-Main".local_history.share_writes + EXCLUDED.share_writes;`;
    expect(response).toBe(expected);
  });

  test('Test history command handling [6]', () => {
    const history = new LocalHistory(logger, configMainCopy);
    const response = history.deleteLocalHistoryInactive('Pool-Main', 1);
    const expected = `
      DELETE FROM "Pool-Main".local_history
      WHERE timestamp < 1;`;
    expect(response).toBe(expected);
  });
});
