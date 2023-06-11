const Text = require('../../../../locales/index');

////////////////////////////////////////////////////////////////////////////////

// Main Schema Function
const CurrentMiners = function (logger, configMain) {

  const _this = this;
  this.logger = logger;
  this.configMain = configMain;
  this.text = Text[configMain.language];

  // Handle Current Parameters
  this.numbers = ['timestamp', 'efficiency', 'effort', 'hashrate', 'invalid', 'paid', 'stale',
    'valid'];
  this.strings = ['miner', 'type'];
  this.parameters = ['timestamp', 'miner', 'efficiency', 'effort', 'hashrate', 'invalid', 'solo',
    'stale', 'type', 'valid'];

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

  // Select Current Rounds for Batching
  this.selectCurrentMinersBatchAddresses = function(pool, addresses, type) {
    return addresses.length >= 1 ? `
      SELECT DISTINCT ON (miner, solo) * FROM "${ pool }".current_miners
      WHERE miner IN (${ addresses.join(', ') }) AND type = '${ type }'
      ORDER BY miner, solo, timestamp DESC;` : `
      SELECT * FROM "${ pool }".current_miners LIMIT 0;`;
  };

  // Build Miners Values String
  this.buildCurrentMinersHashrate = function(updates) {
    let values = '';
    updates.forEach((miner, idx) => {
      values += `(
        ${ miner.timestamp },
        '${ miner.miner }',
        ${ miner.hashrate },
        ${ miner.solo },
        '${ miner.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Hashrate Data
  this.insertCurrentMinersHashrate = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_miners (
        timestamp, miner, hashrate,
        solo, type)
      VALUES ${ _this.buildCurrentMinersHashrate(updates) }
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate;`;
  };

  // Build Miners Values String
  this.buildCurrentMinersRounds = function(updates) {
    let values = '';
    updates.forEach((miner, idx) => {
      values += `(
        ${ miner.timestamp },
        '${ miner.miner }',
        ${ miner.effort },
        ${ miner.solo },
        '${ miner.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Round Data
  this.insertCurrentMinersRounds = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_miners (
        timestamp, miner, effort,
        solo, type)
      VALUES ${ _this.buildCurrentMinersRounds(updates) }
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        effort = "${ pool }".current_miners.effort + EXCLUDED.effort;`;
  };

  // Build Miners Values String
  this.buildCurrentMinersShares = function(updates) {
    let values = '';
    updates.forEach((miner, idx) => {
      values += `(
        ${ miner.timestamp },
        '${ miner.miner }',
        ${ miner.efficiency },
        ${ miner.hashrate_12h },
        ${ miner.hashrate_24h },
        ${ miner.invalid },
        ${ miner.solo },
        ${ miner.stale },
        ${ miner.valid },
        '${ miner.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Shares Data
  this.insertCurrentMinersShares = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_miners (
        timestamp, miner, efficiency,
        hashrate_12h, hashrate_24h,
        invalid, solo, stale, valid,
        type)
      VALUES ${ _this.buildCurrentMinersShares(updates) }
      ON CONFLICT ON CONSTRAINT current_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate_12h = EXCLUDED.hashrate_12h,
        hashrate_24h = EXCLUDED.hashrate_24h,
        invalid = EXCLUDED.invalid,
        stale = EXCLUDED.stale,
        valid = EXCLUDED.valid;`;
  };

  // Reset Solo Miner Using Round Data
  this.updateCurrentSoloMinersReset = function(pool, timestamp, miner, blockType) {
    return `
      UPDATE "${ pool }".current_miners
      SET timestamp = ${ timestamp }, effort = 0
      WHERE miner = '${ miner }' AND solo = true
        AND type = '${ blockType }';`;
  };

  // Delete Rows From Current Miners
  this.deleteCurrentMinersInactive = function(pool, timestamp) {
    return `
      DELETE FROM "${ pool }".current_miners
      WHERE timestamp < ${ timestamp } AND effort = 0;`;
  };
};

module.exports = CurrentMiners;
