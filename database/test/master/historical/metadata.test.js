const HistoricalMetadata = require('../../../main/master/historical/metadata');
const Logger = require('../../../../server/main/logger');
const configMain = require('../../../../configs/main/example.js');
const logger = new Logger(configMain);

////////////////////////////////////////////////////////////////////////////////

describe('Test database metadata functionality', () => {

  let configMainCopy;
  beforeEach(() => {
    configMainCopy = JSON.parse(JSON.stringify(configMain));
  });

  test('Test initialization of metadata commands', () => {
    const metadata = new HistoricalMetadata(logger, configMainCopy);
    expect(typeof metadata.configMain).toBe('object');
    expect(typeof metadata.selectHistoricalMetadataMain).toBe('function');
    expect(typeof metadata.insertHistoricalMetadataMain).toBe('function');
  });

  test('Test query handling [1]', () => {
    const metadata = new HistoricalMetadata(logger, configMainCopy);
    expect(metadata.handleStrings({ test: 'test' }, 'test')).toBe(' = \'test\'');
    expect(metadata.handleStrings({ miner: 'miner1' }, 'miner')).toBe(' = \'miner1\'');
  });

  test('Test query handling [2]', () => {
    const metadata = new HistoricalMetadata(logger, configMainCopy);
    expect(metadata.handleNumbers({ test: '100' }, 'test')).toBe(' = 100');
    expect(metadata.handleNumbers({ timestamp: 'lt100' }, 'timestamp')).toBe(' < 100');
    expect(metadata.handleNumbers({ timestamp: 'le100' }, 'timestamp')).toBe(' <= 100');
    expect(metadata.handleNumbers({ timestamp: 'gt100' }, 'timestamp')).toBe(' > 100');
    expect(metadata.handleNumbers({ timestamp: 'ge100' }, 'timestamp')).toBe(' >= 100');
    expect(metadata.handleNumbers({ timestamp: 'ne100' }, 'timestamp')).toBe(' != 100');
  });

  test('Test query handling [3]', () => {
    const metadata = new HistoricalMetadata(logger, configMainCopy);
    expect(metadata.handleSpecial({ limit: '100' }, '')).toBe(' LIMIT 100');
    expect(metadata.handleSpecial({ offset: '1' }, '')).toBe(' OFFSET 1');
    expect(metadata.handleSpecial({ order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC');
    expect(metadata.handleSpecial({ direction: 'ascending' }, '')).toBe(' ORDER BY id ASC');
    expect(metadata.handleSpecial({ limit: '100', offset: '1' }, '')).toBe(' LIMIT 100 OFFSET 1');
    expect(metadata.handleSpecial({ limit: '100', offset: '1', order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
    expect(metadata.handleSpecial({ limit: '100', offset: '1', order: 'parameter', direction: 'descending' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
  });

  test('Test metadata command handling [1]', () => {
    const metadata = new HistoricalMetadata(logger, configMainCopy);
    const parameters = { type: 'primary' };
    const response = metadata.selectHistoricalMetadataMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".historical_metadata WHERE type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test metadata command handling [2]', () => {
    const metadata = new HistoricalMetadata(logger, configMainCopy);
    const parameters = { timestamp: 'ge1', type: 'primary' };
    const response = metadata.selectHistoricalMetadataMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".historical_metadata WHERE timestamp >= 1 AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test metadata command handling [3]', () => {
    const metadata = new HistoricalMetadata(logger, configMainCopy);
    const parameters = { timestamp: 'ge1', type: 'primary', hmm: 'test' };
    const response = metadata.selectHistoricalMetadataMain('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".historical_metadata WHERE timestamp >= 1 AND type = \'primary\';';
    expect(response).toBe(expected);
  });

  test('Test metadata command handling [6]', () => {
    const metadata = new HistoricalMetadata(logger, configMainCopy);
    const updates = {
      timestamp: 1,
      recent: 1,
      blocks: 1,
      identifier: 'master',
      solo: false,
      type: 'primary',
    };
    const response = metadata.insertHistoricalMetadataBlocks('Pool-Main', [updates]);
    const expected = `
      INSERT INTO "Pool-Main".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1,
        1,
        1,
        'master',
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Main".historical_metadata.blocks + EXCLUDED.blocks;`;
    expect(response).toBe(expected);
  });

  test('Test metadata command handling [7]', () => {
    const metadata = new HistoricalMetadata(logger, configMainCopy);
    const updates = {
      timestamp: 1,
      recent: 1,
      blocks: 1,
      identifier: 'master',
      solo: false,
      type: 'primary',
    };
    const response = metadata.insertHistoricalMetadataBlocks('Pool-Main', [updates, updates]);
    const expected = `
      INSERT INTO "Pool-Main".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES (
        1,
        1,
        1,
        'master',
        false,
        'primary'), (
        1,
        1,
        1,
        'master',
        false,
        'primary')
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "Pool-Main".historical_metadata.blocks + EXCLUDED.blocks;`;
    expect(response).toBe(expected);
  });

  test('Test metadata command handling [4]', () => {
    const metadata = new HistoricalMetadata(logger, configMainCopy);
    const updates = {
      timestamp: 1,
      recent: 1,
      blocks: 1,
      efficiency: 100,
      effort: 100,
      hashrate: 1,
      invalid: 0,
      miners: 1,
      stale: 1,
      type: 'primary',
      valid: 1,
      work: 8,
      workers: 1,
    };
    const response = metadata.insertHistoricalMetadataMain('Pool-Main', [updates]);
    const expected = `
      INSERT INTO "Pool-Main".historical_metadata (
        timestamp, recent, blocks,
        efficiency, effort, hashrate,
        invalid, miners, stale,
        type, valid, work, workers)
      VALUES (
        1,
        1,
        1,
        100,
        100,
        1,
        0,
        1,
        1,
        'primary',
        1,
        8,
        1)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO NOTHING;`;
    expect(response).toBe(expected);
  });

  test('Test metadata command handling [5]', () => {
    const metadata = new HistoricalMetadata(logger, configMainCopy);
    const updates = {
      timestamp: 1,
      recent: 1,
      blocks: 1,
      efficiency: 100,
      effort: 100,
      hashrate: 1,
      invalid: 0,
      miners: 1,
      stale: 1,
      type: 'primary',
      valid: 1,
      work: 8,
      workers: 1,
    };
    const response = metadata.insertHistoricalMetadataMain('Pool-Main', [updates, updates]);
    const expected = `
      INSERT INTO "Pool-Main".historical_metadata (
        timestamp, recent, blocks,
        efficiency, effort, hashrate,
        invalid, miners, stale,
        type, valid, work, workers)
      VALUES (
        1,
        1,
        1,
        100,
        100,
        1,
        0,
        1,
        1,
        'primary',
        1,
        8,
        1), (
        1,
        1,
        1,
        100,
        100,
        1,
        0,
        1,
        1,
        'primary',
        1,
        8,
        1)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO NOTHING;`;
    expect(response).toBe(expected);
  });

  test('Test metadata command handling [8]', () => {
    const metadata = new HistoricalMetadata(logger, configMainCopy);
    const updates = {
      timestamp: 1,
      recent: 1,
      blocks: 1,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 1,
    };
    const response = metadata.insertHistoricalMetadataRounds('Pool-Main', [updates]);
    const expected = `
      INSERT INTO "Pool-Main".historical_metadata (
        timestamp, recent,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES (
        1,
        1,
        'master',
        0,
        false,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Main".historical_metadata.invalid + EXCLUDED.invalid,
        stale = "Pool-Main".historical_metadata.stale + EXCLUDED.stale,
        valid = "Pool-Main".historical_metadata.valid + EXCLUDED.valid,
        work = "Pool-Main".historical_metadata.work + EXCLUDED.work;`;
    expect(response).toBe(expected);
  });

  test('Test metadata command handling [9]', () => {
    const metadata = new HistoricalMetadata(logger, configMainCopy);
    const updates = {
      timestamp: 1,
      recent: 1,
      blocks: 1,
      identifier: 'master',
      invalid: 0,
      solo: false,
      stale: 0,
      type: 'primary',
      valid: 1,
      work: 1,
    };
    const response = metadata.insertHistoricalMetadataRounds('Pool-Main', [updates, updates]);
    const expected = `
      INSERT INTO "Pool-Main".historical_metadata (
        timestamp, recent,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES (
        1,
        1,
        'master',
        0,
        false,
        0,
        'primary',
        1,
        1), (
        1,
        1,
        'master',
        0,
        false,
        0,
        'primary',
        1,
        1)
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "Pool-Main".historical_metadata.invalid + EXCLUDED.invalid,
        stale = "Pool-Main".historical_metadata.stale + EXCLUDED.stale,
        valid = "Pool-Main".historical_metadata.valid + EXCLUDED.valid,
        work = "Pool-Main".historical_metadata.work + EXCLUDED.work;`;
    expect(response).toBe(expected);
  });
});
