const CurrentBalances = require('../../../main/master/current/balances');
const Logger = require('../../../../server/main/logger');
const configMain = require('../../../../configs/main/example.js');
const logger = new Logger(configMain);

////////////////////////////////////////////////////////////////////////////////

describe('Test database miners functionality', () => {

  let configMainCopy;
  beforeEach(() => {
    configMainCopy = JSON.parse(JSON.stringify(configMain));
  });

  test('Test initialization of miners commands', () => {
    const balances = new CurrentBalances(logger, configMainCopy);
    expect(typeof balances.configMain).toBe('object');
    expect(typeof balances.selectCurrentBalancesMain).toBe('function');
    expect(typeof balances.insertCurrentBalancesPayments).toBe('function');
  });

  test('Test query handling [1]', () => {
    const balances = new CurrentBalances(logger, configMainCopy);
    expect(balances.handleStrings({ test: 'test' }, 'test')).toBe(' = \'test\'');
    expect(balances.handleStrings({ miner: 'miner1' }, 'miner')).toBe(' = \'miner1\'');
  });

  test('Test query handling [2]', () => {
    const balances = new CurrentBalances(logger, configMainCopy);
    expect(balances.handleNumbers({ test: '100' }, 'test')).toBe(' = 100');
    expect(balances.handleNumbers({ timestamp: 'lt100' }, 'timestamp')).toBe(' < 100');
    expect(balances.handleNumbers({ timestamp: 'le100' }, 'timestamp')).toBe(' <= 100');
    expect(balances.handleNumbers({ timestamp: 'gt100' }, 'timestamp')).toBe(' > 100');
    expect(balances.handleNumbers({ timestamp: 'ge100' }, 'timestamp')).toBe(' >= 100');
    expect(balances.handleNumbers({ timestamp: 'ne100' }, 'timestamp')).toBe(' != 100');
  });

  test('Test query handling [3]', () => {
    const balances = new CurrentBalances(logger, configMainCopy);
    expect(balances.handleSpecial({ limit: '100' }, '')).toBe(' LIMIT 100');
    expect(balances.handleSpecial({ offset: '1' }, '')).toBe(' OFFSET 1');
    expect(balances.handleSpecial({ order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC');
    expect(balances.handleSpecial({ direction: 'ascending' }, '')).toBe(' ORDER BY id ASC');
    expect(balances.handleSpecial({ limit: '100', offset: '1' }, '')).toBe(' LIMIT 100 OFFSET 1');
    expect(balances.handleSpecial({ limit: '100', offset: '1', order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
    expect(balances.handleSpecial({ limit: '100', offset: '1', order: 'parameter', direction: 'descending' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
  });

  test('Test miners command handling [1]', () => {
    const balances = new CurrentBalances(logger, configMainCopy);
    const parameters = { miner: 'miner1', type: 'primary' };
    const response = balances.selectCurrentBalancesMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".current_balances WHERE miner = \'miner1\' AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test miners command handling [2]', () => {
    const balances = new CurrentBalances(logger, configMainCopy);
    const parameters = { balance: 'gt0', type: 'primary' };
    const response = balances.selectCurrentBalancesMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".current_balances WHERE balance > 0 AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test miners command handling [3]', () => {
    const balances = new CurrentBalances(logger, configMainCopy);
    const parameters = { type: 'primary' };
    const response = balances.selectCurrentBalancesMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".current_balances WHERE type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test miners command handling [4]', () => {
    const balances = new CurrentBalances(logger, configMainCopy);
    const parameters = { type: 'primary', hmm: 'test' };
    const response = balances.selectCurrentBalancesMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".current_balances WHERE type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test miners command handling [5]', () => {
    const balances = new CurrentBalances(logger, configMainCopy);
    const updates = {
      miner: 'miner1',
      timestamp: 1,
      balance: 0,
      paid: 0,
      type: 'primary',
    };
    const response = balances.insertCurrentBalancesPayments('Pool-Main', [updates]);
    const expected = `
      INSERT INTO "Pool-Main".current_balances (
        timestamp, miner, balance,
        paid, type)
      VALUES (
        1,
        'miner1',
        0,
        0,
        'primary')
      ON CONFLICT ON CONSTRAINT current_balances_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        balance = EXCLUDED.balance,
        paid = "Pool-Main".current_balances.paid + EXCLUDED.paid;`;
    expect(response).toBe(expected);
  });

  test('Test miners command handling [6]', () => {
    const balances = new CurrentBalances(logger, configMainCopy);
    const updates = {
      miner: 'miner1',
      timestamp: 1,
      balance: 0,
      paid: 0,
      type: 'primary',
    };
    const response = balances.insertCurrentBalancesPayments('Pool-Main', [updates, updates]);
    const expected = `
      INSERT INTO "Pool-Main".current_balances (
        timestamp, miner, balance,
        paid, type)
      VALUES (
        1,
        'miner1',
        0,
        0,
        'primary'), (
        1,
        'miner1',
        0,
        0,
        'primary')
      ON CONFLICT ON CONSTRAINT current_balances_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        balance = EXCLUDED.balance,
        paid = "Pool-Main".current_balances.paid + EXCLUDED.paid;`;
    expect(response).toBe(expected);
  });

  test('Test miners command handling [7]', () => {
    const balances = new CurrentBalances(logger, configMainCopy);
    const updates = {
      miner: 'miner1',
      timestamp: 1,
      generate: 0,
      immature: 0,
      type: 'primary',
    };
    const response = balances.insertCurrentBalancesUpdates('Pool-Main', [updates]);
    const expected = `
      INSERT INTO "Pool-Main".current_balances (
        timestamp, miner, generate,
        immature, type)
      VALUES (
        1,
        'miner1',
        0,
        0,
        'primary')
      ON CONFLICT ON CONSTRAINT current_balances_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        generate = "Pool-Main".current_balances.generate + EXCLUDED.generate,
        immature = "Pool-Main".current_balances.immature + EXCLUDED.immature;`;
    expect(response).toBe(expected);
  });

  test('Test miners command handling [8]', () => {
    const balances = new CurrentBalances(logger, configMainCopy);
    const updates = {
      miner: 'miner1',
      timestamp: 1,
      generate: 0,
      immature: 0,
      type: 'primary',
    };
    const response = balances.insertCurrentBalancesUpdates('Pool-Main', [updates, updates]);
    const expected = `
      INSERT INTO "Pool-Main".current_balances (
        timestamp, miner, generate,
        immature, type)
      VALUES (
        1,
        'miner1',
        0,
        0,
        'primary'), (
        1,
        'miner1',
        0,
        0,
        'primary')
      ON CONFLICT ON CONSTRAINT current_balances_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        generate = "Pool-Main".current_balances.generate + EXCLUDED.generate,
        immature = "Pool-Main".current_balances.immature + EXCLUDED.immature;`;
    expect(response).toBe(expected);
  });

  test('Test miners command handling [9]', () => {
    const balances = new CurrentBalances(logger, configMainCopy);
    const response = balances.insertCurrentBalancesReset('Pool-Main', 'primary');
    const expected = `
      UPDATE "Pool-Main".current_balances
      SET generate = 0 WHERE type = 'primary';`;
    expect(response).toBe(expected);
  });

  test('Test miners command handling [10]', () => {
    const balances = new CurrentBalances(logger, configMainCopy);
    const response = balances.deleteCurrentBalancesInactive('Pool-Main', 1);
    const expected = `
      DELETE FROM "Pool-Main".current_balances
      WHERE timestamp < 1 AND balance = 0
      AND generate = 0 AND immature = 0 AND paid = 0;`;
    expect(response).toBe(expected);
  });
});
