const Text = require('../../../locales/index');

////////////////////////////////////////////////////////////////////////////////

// Main Schema Function
const CurrentMiners = function (logger, configMain) {

  const _this = this;
  this.logger = logger;
  this.configMain = configMain;
  this.text = Text[configMain.language];

  // Handle Current Parameters
  this.numbers = ['timestamp', 'balance', 'efficiency', 'solo_effort', 'generate', 'hashrate', 'immature',
    'invalid', 'paid', 'stale', 'valid'];
  this.strings = ['miner', 'type'];
  this.parameters = ['timestamp', 'miner', 'balance', 'efficiency', 'solo_effort', 'generate', 'hashrate',
    'immature', 'invalid', 'paid', 'stale', 'type', 'valid'];

  // Handle String Parameters
  this.handleStrings = function(parameters, parameter) {
    return ` = '${ parameters[parameter] }'`;
  };

  // Handle Numerical Parameters
  this.handleNumbers = function(parameters, parameter) {
    const query = parameters[parameter];
    if (query.slice(0, 2) === 'lt') return ` < ${ query.replace('lt', '') }`;
    if (query.slice(0, 2) === 'le') return ` <= ${ query.replace('le', '') }`;
    if (query.slice(0, 2) === 'gt') return ` > ${ query.replace('gt', '') }`;
    if (query.slice(0, 2) === 'ge') return ` >= ${ query.replace('ge', '') }`;
    if (query.slice(0, 2) === 'ne') return ` != ${ query.replace('ne', '') }`;
    else return ` = ${ query }`;
  };

  // Handle Query Parameters
  /* istanbul ignore next */
  this.handleQueries = function(parameters, parameter) {
    if (_this.numbers.includes(parameter)) return _this.handleNumbers(parameters, parameter);
    if (_this.strings.includes(parameter)) return _this.handleStrings(parameters, parameter);
    else return ` = ${ parameters[parameter] }`;
  };

  // Handle Special Parameters
  this.handleSpecial = function(parameters, output) {
    if (parameters.order || parameters.direction) {
      output += ` ORDER BY ${ parameters.order || 'id' }`;
      output += ` ${ parameters.direction === 'ascending' ? 'ASC' : 'DESC' }`;
    }
    if (parameters.limit) output += ` LIMIT ${ parameters.limit }`;
    if (parameters.offset) output += ` OFFSET ${ parameters.offset }`;
    return output;
  };

  // Select Current Miners Using Parameters
  this.selectCurrentMinersMain = function(pool, parameters) {
    let output = `SELECT * FROM "${ pool }".current_miners`;
    const filtered = Object.keys(parameters).filter((key) => _this.parameters.includes(key));
    filtered.forEach((parameter, idx) => {
      if (idx === 0) output += ' WHERE ';
      else output += ' AND ';
      output += `${ parameter }`;
      output += _this.handleQueries(parameters, parameter);
    });
    output = _this.handleSpecial(parameters, output);
    return output + ';';
  };

  // Build Miners Values String
  this.buildCurrentMinersHashrate = function(updates) {
    let values = '';
    updates.forEach((miner, idx) => {
      values += `(
        ${ miner.timestamp },
        '${ miner.miner }',
        ${ miner.active_shared },
        ${ miner.efficiency },
        ${ miner.hashrate },
        ${ miner.inactive_shared },
        '${ miner.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Hashrate Data
  this.insertCurrentMinersHashrate = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_miners (
        timestamp, miner, active_shared,
        efficiency, hashrate, inactive_shared,
        type)
      VALUES ${ _this.buildCurrentMinersHashrate(updates) }
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        active_shared = EXCLUDED.active_shared,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate,
        inactive_shared = EXCLUDED.inactive_shared;`;
  };

  // Build Miners Values String
  this.buildCurrentMinersSoloRounds = function(updates) {
    let values = '';
    updates.forEach((miner, idx) => {
      values += `(
        ${ miner.timestamp },
        '${ miner.miner }',
        ${ miner.solo_effort },
        '${ miner.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Round Data
  this.insertCurrentMinersSoloRounds = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_miners (
        timestamp, miner, solo_effort,
        type)
      VALUES ${ _this.buildCurrentMinersSoloRounds(updates) }
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        solo_effort = "${ pool }".current_miners.solo_effort + EXCLUDED.solo_effort;`;
  };

  // Build Miners Values String
  this.buildCurrentMinersSharedRounds = function(updates) {
    let values = '';
    updates.forEach((miner, idx) => {
      values += `(
        ${ miner.timestamp },
        '${ miner.miner }',
        '${ miner.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Round Data
  this.insertCurrentMinersSharedRounds = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_miners (
        timestamp, miner, type)
      VALUES ${ _this.buildCurrentMinersSharedRounds(updates) }
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO NOTHING;`;
  };

  // Build Miners Values String
  this.buildCurrentMinersPayments = function(updates) {
    let values = '';
    updates.forEach((miner, idx) => {
      values += `(
        ${ miner.timestamp },
        '${ miner.miner }',
        ${ miner.balance },
        ${ miner.paid },
        '${ miner.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Payment Data
  this.insertCurrentMinersPayments = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_miners (
        timestamp, miner, balance,
        paid, type)
      VALUES ${ _this.buildCurrentMinersPayments(updates) }
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        balance = EXCLUDED.balance,
        paid = "${ pool }".current_miners.paid + EXCLUDED.paid;`;
  };

  // Build Miners Values String
  this.buildCurrentMinersUpdates = function(updates) {
    let values = '';
    updates.forEach((miner, idx) => {
      values += `(
        ${ miner.timestamp },
        '${ miner.miner }',
        ${ miner.generate },
        ${ miner.immature },
        '${ miner.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Payment Data
  this.insertCurrentMinersUpdates = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_miners (
        timestamp, miner, generate,
        immature, type)
      VALUES ${ _this.buildCurrentMinersUpdates(updates) }
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        generate = "${ pool }".current_miners.generate + EXCLUDED.generate,
        immature = "${ pool }".current_miners.immature + EXCLUDED.immature;`;
  };

  // Insert Rows Using Reset
  this.insertCurrentMinersReset = function(pool, type) {
    return `
      UPDATE "${ pool }".current_miners
      SET generate = 0 WHERE type = '${ type }';`;
  };

  // Reset Miner Effort
  this.insertCurrentMinersRoundsReset = function(pool, timestamp, miner, type) {
    return `
      UPDATE "${ pool }".current_miners
      SET timestamp = ${ timestamp },
        solo_effort = 0
      WHERE miner = '${ miner }'
      AND type = '${ type }';`;
  };

  // Delete Rows From Current Round
  this.deleteCurrentMinersInactive = function(pool, timestamp) {
    return `
      DELETE FROM "${ pool }".current_miners
      WHERE timestamp < ${ timestamp } AND balance = 0
      AND generate = 0 AND immature = 0 AND paid = 0;`;
  };
};

module.exports = CurrentMiners;
