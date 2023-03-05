const Users = require('../../../main/master/current/users');
const Logger = require('../../../../server/main/logger');
const configMain = require('../../../../configs/main/example.js');
const logger = new Logger(configMain);

////////////////////////////////////////////////////////////////////////////////

describe('Test database users functionality', () => {

  let configMainCopy;
  beforeEach(() => {
    configMainCopy = JSON.parse(JSON.stringify(configMain));
  });

  test('Test initialization of users commands', () => {
    const users = new Users(logger, configMainCopy);
    expect(typeof users.configMain).toBe('object');
    expect(typeof users.selectCurrentUsers).toBe('function');
    expect(typeof users.createCurrentUsers).toBe('function');
  });

  test('Test query handling [1]', () => {
    const users = new Users(logger, configMainCopy);
    expect(users.handleStrings({ test: 'test' }, 'test')).toBe(' = \'test\'');
    expect(users.handleStrings({ miner: 'miner1' }, 'miner')).toBe(' = \'miner1\'');
    
  });

  test('Test query handling [2]', () => {
    const users = new Users(logger, configMainCopy);
    expect(users.handleNumbers({ payout_limit: '100' }, 'payout_limit')).toBe(' = 100');
    expect(users.handleNumbers({ payout_limit: 'lt100' }, 'payout_limit')).toBe(' < 100');
    expect(users.handleNumbers({ payout_limit: 'le100' }, 'payout_limit')).toBe(' <= 100');
    expect(users.handleNumbers({ payout_limit: 'gt100' }, 'payout_limit')).toBe(' > 100');
    expect(users.handleNumbers({ payout_limit: 'ge100' }, 'payout_limit')).toBe(' >= 100');
    expect(users.handleNumbers({ payout_limit: 'ne100' }, 'payout_limit')).toBe(' != 100');
    expect(users.handleNumbers({ payout_limit: 'bwlt100|gt101' }, 'payout_limit')).toBe(' < 100 AND payout_limit > 101');
  });

  test('Test query handling [3]', () => {
    const users = new Users(logger, configMainCopy);
    expect(users.handleSpecial({ limit: '100' }, '')).toBe(' LIMIT 100');
    expect(users.handleSpecial({ offset: '1' }, '')).toBe(' OFFSET 1');
    expect(users.handleSpecial({ order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC');
    expect(users.handleSpecial({ direction: 'ascending' }, '')).toBe(' ORDER BY id ASC');
    expect(users.handleSpecial({ limit: '100', offset: '1' }, '')).toBe(' LIMIT 100 OFFSET 1');
    expect(users.handleSpecial({ limit: '100', offset: '1', order: 'parameter' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
    expect(users.handleSpecial({ limit: '100', offset: '1', order: 'parameter', direction: 'descending' }, '')).toBe(' ORDER BY parameter DESC LIMIT 100 OFFSET 1');
  });

  test('Test users command handling [1]', () => {
    const users = new Users(logger, configMainCopy);
    const parameters = { token: '123asd123' };
    const response = users.selectCurrentUsers('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".current_users WHERE token = \'123asd123\';';
    expect(response).toBe(expected);
  });

  test('Test users command handling [2]', () => {
    const users = new Users(logger, configMainCopy);
    const parameters = { payout_limit: 'ge1', token: '123asd123' };
    const response = users.selectCurrentUsers('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".current_users WHERE payout_limit >= 1 AND token = \'123asd123\';';
    expect(response).toBe(expected);
  });

  test('Test users command handling [3]', () => {
    const users = new Users(logger, configMainCopy);
    const parameters = { payout_limit: 'ge1', token: '123asd123', hmm: 'test' };
    const response = users.selectCurrentUsers('Pool-Main', parameters);
    const expected = 'SELECT * FROM "Pool-Main".current_users WHERE payout_limit >= 1 AND token = \'123asd123\';';
    expect(response).toBe(expected);
  });

  test('Test users command handling [4]', () => {
    const users = new Users(logger, configMainCopy);
    const addresses = ['miner1'];
    const response = users.selectCurrentUsersBatchAddresses('Pool-Main', addresses, 'primary');
    const expected = `
      SELECT DISTINCT ON (miner) * FROM "Pool-Main".current_users
      WHERE miner IN (miner1) AND type = 'primary'
      ORDER BY miner;`;
    expect(response).toBe(expected);
  });

  test('Test users command handling [5]', () => {
    const users = new Users(logger, configMainCopy);
    const addresses = [];
    const response = users.selectCurrentUsersBatchAddresses('Pool-Main', addresses, 'primary');
    const expected = `
      SELECT * FROM "Pool-Main".current_users LIMIT 0;`;
    expect(response).toBe(expected);
  });

  test('Test users command handling [6]', () => {
    const users = new Users(logger, configMainCopy);
    const parameters = { miner: 'miner1', joined: 1, payout_limit: 2, type: 'primary' };
    const response = users.createCurrentUsers('Pool-Main', [parameters]);
    const expected = `
      INSERT INTO "Pool-Main".current_users (
        miner, joined, payout_limit,
        type)
      VALUES (
        'miner1',
        1,
        2,
        'primary')
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`;
    expect(response).toBe(expected);
  });

  test('Test users command handling [7]', () => {
    const users = new Users(logger, configMainCopy);
    const parameters = { miner: 'miner1', joined: 1, payout_limit: 2, type: 'primary' };
    const response = users.createCurrentUsers('Pool-Main', [parameters, parameters]);
    const expected = `
      INSERT INTO "Pool-Main".current_users (
        miner, joined, payout_limit,
        type)
      VALUES (
        'miner1',
        1,
        2,
        'primary'), (
        'miner1',
        1,
        2,
        'primary')
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`;
    expect(response).toBe(expected);
  });
});
