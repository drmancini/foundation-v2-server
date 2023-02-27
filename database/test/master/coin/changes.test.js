const CoinChanges = require('../../../main/master/coin/changes');
const Logger = require('../../../../server/main/logger');
const configMain = require('../../../../configs/main/example.js');
const logger = new Logger(configMain);

////////////////////////////////////////////////////////////////////////////////

describe('Test database coin_changes functionality', () => {

  let configMainCopy;
  beforeEach(() => {
    configMainCopy = JSON.parse(JSON.stringify(configMain));
  });

  test('Test initialization of coin_changes commands', () => {
    const coinChanges = new CoinChanges(logger, configMainCopy);
    expect(typeof coinChanges.configMain).toBe('object');
    expect(typeof coinChanges.selectCoinChanges).toBe('function');
    expect(typeof coinChanges.insertCoinChanges).toBe('function');
    // expect(typeof coinChanges.updateCoinChange).toBe('function');
  });

  test('Test query handling [1]', () => {
    const coinChanges = new CoinChanges(logger, configMainCopy);
    expect(coinChanges.handleStrings({ currency: 'usd' }, 'currency')).toBe(' = \'usd\'');
    expect(coinChanges.handleStrings({ coin: 'rtm' }, 'coin')).toBe(' = \'rtm\'');
    
  });

  test('Test query handling [2]', () => {
    const coinChanges = new CoinChanges(logger, configMainCopy);
    expect(coinChanges.handleNumbers({ price: '100' }, 'price')).toBe(' = 100');
    expect(coinChanges.handleNumbers({ price: 'lt100' }, 'price')).toBe(' < 100');
    expect(coinChanges.handleNumbers({ price: 'le100' }, 'price')).toBe(' <= 100');
    expect(coinChanges.handleNumbers({ price: 'gt100' }, 'price')).toBe(' > 100');
    expect(coinChanges.handleNumbers({ price: 'ge100' }, 'price')).toBe(' >= 100');
    expect(coinChanges.handleNumbers({ price: 'ne100' }, 'price')).toBe(' != 100');
  });

  test('Test query handling [3]', () => {
    const coinChanges = new CoinChanges(logger, configMainCopy);
    expect(coinChanges.handleSpecial({ limit: '100' }, '')).toBe(' LIMIT 100');
    expect(coinChanges.handleSpecial({ offset: '1' }, '')).toBe(' OFFSET 1');
    expect(coinChanges.handleSpecial({ order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC');
    expect(coinChanges.handleSpecial({ direction: 'ascending' }, '')).toBe(' ORDER BY id ASC');
    expect(coinChanges.handleSpecial({ limit: '100', offset: '1' }, '')).toBe(' LIMIT 100 OFFSET 1');
    expect(coinChanges.handleSpecial({ limit: '100', offset: '1', order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
    expect(coinChanges.handleSpecial({ limit: '100', offset: '1', order: 'parameter', direction: 'descending' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
  });

  test('Test coin_changes command handling [1]', () => {
    const coinChanges = new CoinChanges(logger, configMainCopy);
    const parameters = { interval: '7d', type: 'primary' };
    const response = coinChanges.selectCoinChanges('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".coin_changes WHERE interval = \'7d\' AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test coin_changes command handling [2]', () => {
    const coinChanges = new CoinChanges(logger, configMainCopy);
    const parameters = { change: 'ge1', interval: '7d', type: 'primary' };
    const response = coinChanges.selectCoinChanges('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".coin_changes WHERE change >= 1 AND interval = \'7d\' AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test coin_changes command handling [3]', () => {
    const coinChanges = new CoinChanges(logger, configMainCopy);
    const parameters = { change: 'ge1', interval: '7d', hmm: 'test', type: 'primary' };
    const response = coinChanges.selectCoinChanges('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".coin_changes WHERE change >= 1 AND interval = \'7d\' AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test coin_changes command handling [4]', () => {
    const coinChanges = new CoinChanges(logger, configMainCopy);
    const updates = {
      change: -0.3,
      interval: '12h',
      type: 'primary',
    };
    const response = coinChanges.insertCoinChanges('Pool-Main', [updates]);
    const expected = `
      INSERT INTO "Pool-Main".coin_changes (
        change, interval)
      VALUES (
        -0.3,
        '12h',
        'primary')
      ON CONFLICT ON CONSTRAINT coin_change_unique
      DO UPDATE SET
        change = EXCLUDED.change;`;
    expect(response).toBe(expected);
  });

  test('Test coin_changes command handling [5]', () => {
    const coinChanges = new CoinChanges(logger, configMainCopy);
    const updates = {
      change: -0.3,
      interval: '12h',
      type: 'primary',
    };
    const response = coinChanges.insertCoinChanges('Pool-Main', [updates, updates]);
    const expected = `
      INSERT INTO "Pool-Main".coin_changes (
        change, interval)
      VALUES (
        -0.3,
        '12h',
        'primary'), (
        -0.3,
        '12h',
        'primary')
      ON CONFLICT ON CONSTRAINT coin_change_unique
      DO UPDATE SET
        change = EXCLUDED.change;`;
    expect(response).toBe(expected);
  });
});
