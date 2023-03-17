const HistoricalRounds = require('../../../main/master/historical/rounds');
const Logger = require('../../../../server/main/logger');
const configMain = require('../../../../configs/main/example.js');
const logger = new Logger(configMain);

////////////////////////////////////////////////////////////////////////////////

describe('Test database rounds functionality', () => {

  let configMainCopy;
  beforeEach(() => {
    configMainCopy = JSON.parse(JSON.stringify(configMain));
  });

  test('Test initialization of rounds commands', () => {
    const rounds = new HistoricalRounds(logger, configMainCopy);
    expect(typeof rounds.configMain).toBe('object');
    expect(typeof rounds.selectHistoricalRoundsMain).toBe('function');
    expect(typeof rounds.insertHistoricalRoundsMain).toBe('function');
  });

  test('Test query handling [1]', () => {
    const rounds = new HistoricalRounds(logger, configMainCopy);
    expect(rounds.handleStrings({ test: 'test' }, 'test')).toBe(' = \'test\'');
    expect(rounds.handleStrings({ miner: 'miner1' }, 'miner')).toBe(' = \'miner1\'');
  });

  test('Test query handling [2]', () => {
    const rounds = new HistoricalRounds(logger, configMainCopy);
    expect(rounds.handleNumbers({ test: '100' }, 'test')).toBe(' = 100');
    expect(rounds.handleNumbers({ timestamp: 'lt100' }, 'timestamp')).toBe(' < 100');
    expect(rounds.handleNumbers({ timestamp: 'le100' }, 'timestamp')).toBe(' <= 100');
    expect(rounds.handleNumbers({ timestamp: 'gt100' }, 'timestamp')).toBe(' > 100');
    expect(rounds.handleNumbers({ timestamp: 'ge100' }, 'timestamp')).toBe(' >= 100');
    expect(rounds.handleNumbers({ timestamp: 'ne100' }, 'timestamp')).toBe(' != 100');
  });

  test('Test query handling [3]', () => {
    const rounds = new HistoricalRounds(logger, configMainCopy);
    expect(rounds.handleSpecial({ limit: '100' }, '')).toBe(' LIMIT 100');
    expect(rounds.handleSpecial({ offset: '1' }, '')).toBe(' OFFSET 1');
    expect(rounds.handleSpecial({ order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC');
    expect(rounds.handleSpecial({ direction: 'ascending' }, '')).toBe(' ORDER BY id ASC');
    expect(rounds.handleSpecial({ limit: '100', offset: '1' }, '')).toBe(' LIMIT 100 OFFSET 1');
    expect(rounds.handleSpecial({ limit: '100', offset: '1', order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
    expect(rounds.handleSpecial({ limit: '100', offset: '1', order: 'parameter', direction: 'descending' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
  });

  test('Test rounds command handling [1]', () => {
    const rounds = new HistoricalRounds(logger, configMainCopy);
    const parameters = { miner: 'miner1', type: 'primary' };
    const response = rounds.selectHistoricalRoundsMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".historical_rounds WHERE miner = \'miner1\' AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test rounds command handling [2]', () => {
    const rounds = new HistoricalRounds(logger, configMainCopy);
    const parameters = { miner: 'miner1', type: 'primary' };
    const response = rounds.selectHistoricalRoundsMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".historical_rounds WHERE miner = \'miner1\' AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test rounds command handling [3]', () => {
    const rounds = new HistoricalRounds(logger, configMainCopy);
    const parameters = { round: 'round1', type: 'primary' };
    const response = rounds.selectHistoricalRoundsMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".historical_rounds WHERE round = \'round1\' AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test rounds command handling [4]', () => {
    const rounds = new HistoricalRounds(logger, configMainCopy);
    const parameters = { solo: true, round: 'round1', type: 'primary' };
    const response = rounds.selectHistoricalRoundsMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".historical_rounds WHERE solo = true AND round = \'round1\' AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test rounds command handling [5]', () => {
    const rounds = new HistoricalRounds(logger, configMainCopy);
    const parameters = { miner: 'miner1', solo: true, type: 'primary' };
    const response = rounds.selectHistoricalRoundsMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".historical_rounds WHERE miner = \'miner1\' AND solo = true AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test rounds command handling [6]', () => {
    const rounds = new HistoricalRounds(logger, configMainCopy);
    const parameters = { miner: 'miner1', solo: true, round: 'round1', type: 'primary' };
    const response = rounds.selectHistoricalRoundsMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".historical_rounds WHERE miner = \'miner1\' AND solo = true AND round = \'round1\' AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test rounds command handling [7]', () => {
    const rounds = new HistoricalRounds(logger, configMainCopy);
    const parameters = { timestamp: 'ge1', type: 'primary', hmm: 'test' };
    const response = rounds.selectHistoricalRoundsMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".historical_rounds WHERE timestamp >= 1 AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test rounds command handling [8]', () => {
    const rounds = new HistoricalRounds(logger, configMainCopy);
    const updates = {
      timestamp: 1,
      miner: 'miner1',
      reward: 2,
      round: 'round1',
      share: 3,
      solo: true,
      type: 'primary',
      work: 4,
    };
    const response = rounds.insertHistoricalRoundsMain('Pool-Main', [updates]);
    const expected = `
      INSERT INTO "Pool-Main".historical_rounds (
        timestamp, miner, reward,
        round, share, solo, type,
        work)
      VALUES (
        1,
        'miner1',
        2,
        'round1',
        3,
        true,
        'primary',
        4)
      ON CONFLICT ON CONSTRAINT historical_rounds_unique
      DO UPDATE SET
        reward = EXCLUDED.reward,
        share = EXCLUDED.share;`;
    expect(response).toBe(expected);
  });

  test('Test rounds command handling [9]', () => {
    const rounds = new HistoricalRounds(logger, configMainCopy);
    const updates = {
      timestamp: 1,
      miner: 'miner1',
      reward: 2,
      round: 'round1',
      share: 3,
      solo: true,
      type: 'primary',
      work: 4,
    };
    const response = rounds.insertHistoricalRoundsMain('Pool-Main', [updates, updates]);
    const expected = `
      INSERT INTO "Pool-Main".historical_rounds (
        timestamp, miner, reward,
        round, share, solo, type,
        work)
      VALUES (
        1,
        'miner1',
        2,
        'round1',
        3,
        true,
        'primary',
        4), (
        1,
        'miner1',
        2,
        'round1',
        3,
        true,
        'primary',
        4)
      ON CONFLICT ON CONSTRAINT historical_rounds_unique
      DO UPDATE SET
        reward = EXCLUDED.reward,
        share = EXCLUDED.share;`;
    expect(response).toBe(expected);
  });

  test('Test rounds command handling [10]', () => {
    const miners = new HistoricalRounds(logger, configMainCopy);
    const response = miners.deleteHistoricalRoundsCutoff('Pool-Main', 1);
    const expected = `
      DELETE FROM "Pool-Main".historical_rounds
      WHERE timestamp < 1;`;
    expect(response).toBe(expected);
  });
});
