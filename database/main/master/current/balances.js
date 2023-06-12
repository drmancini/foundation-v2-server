const Text = require('../../../../locales/index');

////////////////////////////////////////////////////////////////////////////////

// Main Schema Function
const CurrentBalances = function (logger, configMain) {

  const _this = this;
  this.logger = logger;
  this.configMain = configMain;
  this.text = Text[configMain.language];

  // Handle Current Parameters
  this.numbers = ['timestamp', 'balance', 'generate', 'immature', 'paid'];
  this.strings = ['miner', 'type'];
  this.parameters = ['timestamp', 'miner', 'balance', 'generate', 'immature', 'paid', 'type'];

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
  this.selectCurrentBalancesMain = function(pool, parameters) {
    let output = `SELECT * FROM "${ pool }".current_balances`;
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
  this.buildCurrentBalancesPayments = function(updates) {
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
  this.insertCurrentBalancesPayments = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_balances (
        timestamp, miner, balance,
        paid, type)
      VALUES ${ _this.buildCurrentBalancesPayments(updates) }
      ON CONFLICT ON CONSTRAINT current_balances_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        balance = EXCLUDED.balance,
        paid = "${ pool }".current_balances.paid + EXCLUDED.paid;`;
  };

  // Build Miners Values String
  this.buildCurrentBalancesUpdates = function(updates) {
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
  this.insertCurrentBalancesUpdates = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_balances (
        timestamp, miner, generate,
        immature, type)
      VALUES ${ _this.buildCurrentBalancesUpdates(updates) }
      ON CONFLICT ON CONSTRAINT current_balances_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        generate = "${ pool }".current_balances.generate + EXCLUDED.generate,
        immature = "${ pool }".current_balances.immature + EXCLUDED.immature;`;
  };

  // Insert Rows Using Reset
  this.insertCurrentBalancesReset = function(pool, type) {
    return `
      UPDATE "${ pool }".current_balances
      SET generate = 0 WHERE type = '${ type }';`;
  };

  // Delete Rows From Current Round
  this.deleteCurrentBalancesInactive = function(pool, timestamp) {
    return `
      DELETE FROM "${ pool }".current_balances
      WHERE timestamp < ${ timestamp } AND balance = 0
      AND generate = 0 AND immature = 0 AND paid = 0;`;
  };
};

module.exports = CurrentBalances;