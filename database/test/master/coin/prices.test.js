const CoinPrices = require('../../../main/master/coin/prices');
const Logger = require('../../../../server/main/logger');
const configMain = require('../../../../configs/main/example.js');
const logger = new Logger(configMain);

////////////////////////////////////////////////////////////////////////////////

describe('Test database coin_prices functionality', () => {

  let configMainCopy;
  beforeEach(() => {
    configMainCopy = JSON.parse(JSON.stringify(configMain));
  });

  test('Test initialization of coin_prices commands', () => {
    const coinPrices = new CoinPrices(logger, configMainCopy);
    expect(typeof coinPrices.configMain).toBe('object');
    expect(typeof coinPrices.selectCoinPrices).toBe('function');
    expect(typeof coinPrices.insertCoinPrices).toBe('function');
  });

  test('Test query handling [1]', () => {
    const coinPrices = new CoinPrices(logger, configMainCopy);
    expect(coinPrices.handleStrings({ currency: 'usd' }, 'currency')).toBe(' = \'usd\'');
  });

  test('Test query handling [2]', () => {
    const coinPrices = new CoinPrices(logger, configMainCopy);
    expect(coinPrices.handleNumbers({ price: '100' }, 'price')).toBe(' = 100');
    expect(coinPrices.handleNumbers({ price: 'lt100' }, 'price')).toBe(' < 100');
    expect(coinPrices.handleNumbers({ price: 'le100' }, 'price')).toBe(' <= 100');
    expect(coinPrices.handleNumbers({ price: 'gt100' }, 'price')).toBe(' > 100');
    expect(coinPrices.handleNumbers({ price: 'ge100' }, 'price')).toBe(' >= 100');
    expect(coinPrices.handleNumbers({ price: 'ne100' }, 'price')).toBe(' != 100');
  });

  test('Test query handling [3]', () => {
    const coinPrices = new CoinPrices(logger, configMainCopy);
    expect(coinPrices.handleSpecial({ limit: '100' }, '')).toBe(' LIMIT 100');
    expect(coinPrices.handleSpecial({ offset: '1' }, '')).toBe(' OFFSET 1');
    expect(coinPrices.handleSpecial({ order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC');
    expect(coinPrices.handleSpecial({ direction: 'ascending' }, '')).toBe(' ORDER BY id ASC');
    expect(coinPrices.handleSpecial({ limit: '100', offset: '1' }, '')).toBe(' LIMIT 100 OFFSET 1');
    expect(coinPrices.handleSpecial({ limit: '100', offset: '1', order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
    expect(coinPrices.handleSpecial({ limit: '100', offset: '1', order: 'parameter', direction: 'descending' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
  });

  test('Test coin_prices command handling [1]', () => {
    const coinPrices = new CoinPrices(logger, configMainCopy);
    const parameters = { currency: 'usd', type: 'primary' };
    const response = coinPrices.selectCoinPrices('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".coin_prices WHERE currency = \'usd\' AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test coin_prices command handling [2]', () => {
    const coinPrices = new CoinPrices(logger, configMainCopy);
    const parameters = { price: 'ge1', currency: 'usd', type: 'primary' };
    const response = coinPrices.selectCoinPrices('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".coin_prices WHERE price >= 1 AND currency = \'usd\' AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test coin_prices command handling [3]', () => {
    const coinPrices = new CoinPrices(logger, configMainCopy);
    const parameters = { price: 'ge1', currency: 'usd', hmm: 'test', type: 'primary' };
    const response = coinPrices.selectCoinPrices('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".coin_prices WHERE price >= 1 AND currency = \'usd\' AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test coin_prices command handling [4]', () => {
    const coinPrices = new CoinPrices(logger, configMainCopy);
    const updates = {
      currency: 'usd',
      price: 12,
      type: 'primary',
    };
    const response = coinPrices.insertCoinPrices('Pool-Main', [updates]);
    const expected = `
      INSERT INTO "Pool-Main".coin_prices (
        currency, price)
      VALUES (
        'usd',
        12,
        'primary')
      ON CONFLICT ON CONSTRAINT coin_price_unique
      DO UPDATE SET
        price = EXCLUDED.price;`;
    expect(response).toBe(expected);
  });

  test('Test coin_prices command handling [5]', () => {
    const coinPrices = new CoinPrices(logger, configMainCopy);
    const updates = {
      currency: 'usd',
      price: 12,
      type: 'primary'
    };
    const response = coinPrices.insertCoinPrices('Pool-Main', [updates, updates]);
    const expected = `
      INSERT INTO "Pool-Main".coin_prices (
        currency, price)
      VALUES (
        'usd',
        12,
        'primary'), (
        'usd',
        12,
        'primary')
      ON CONFLICT ON CONSTRAINT coin_price_unique
      DO UPDATE SET
        price = EXCLUDED.price;`;
    expect(response).toBe(expected);
  });
});
