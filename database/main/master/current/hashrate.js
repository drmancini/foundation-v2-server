const Text = require('../../../../locales/index');

////////////////////////////////////////////////////////////////////////////////

// Main Schema Function
const CurrentHashrate = function (logger, configMain) {

  const _this = this;
  this.logger = logger;
  this.configMain = configMain;
  this.text = Text[configMain.language];

  // Handle Current Parameters
  this.numbers = ['timestamp', 'work'];
  this.strings = ['miner', 'worker', 'identifier', 'ip_hash', 'share', 'type'];
  this.parameters = ['timestamp', 'miner', 'worker', 'identifier', 'ip_hash', 'share',
    'solo', 'type', 'work'];

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

  // Select Current Hashrate Using Parameters
  this.selectCurrentHashrateMain = function(pool, parameters) {
    let output = `SELECT * FROM "${ pool }".current_hashrate`;
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

  // Select Count of Distinct Miners
  this.countCurrentHashrateMiner = function(pool, timestamp, type) {
    return `
      SELECT identifier, solo,
        CAST(COUNT(*) AS INT) AS miners
      FROM (
        SELECT DISTINCT miner, identifier,
          solo
        FROM "${ pool }".current_hashrate
        WHERE timestamp >= ${ timestamp }
        AND type = '${ type }'
      ) a
      GROUP BY identifier, solo;`;
  };

  // Select Sum of Rows Using Miners
  this.sumCurrentHashrateMiner = function(pool, timestamp, type) {
    return `
      SELECT miner, solo,
        SUM(work) as work
      FROM "${ pool }".current_hashrate
      WHERE timestamp >= ${ timestamp }
      AND type = '${ type }'
      GROUP BY miner, solo;`;
  };

  // Select Count of Distinct Workers
  this.countCurrentHashrateWorker = function(pool, timestamp, type) {
    return `
      SELECT identifier, solo,
        CAST(COUNT(*) AS INT) AS workers
      FROM (
        SELECT DISTINCT worker, identifier,
          ip_hash, solo
        FROM "${ pool }".current_hashrate
        WHERE timestamp >= ${ timestamp }
        AND type = '${ type }'
      ) a
      GROUP BY identifier, solo;`;
  };

  // Select Sum of Rows Using Workers
  this.sumCurrentHashrateWorker = function(pool, timestamp, type) {
    return `
      SELECT worker, ip_hash, solo,
        SUM(work) as work
      FROM "${ pool }".current_hashrate
      WHERE timestamp >= ${ timestamp }
      AND type = '${ type }'
      GROUP BY worker, ip_hash, solo;`;
  };

  // Select Sum of Rows Using Types
  this.sumCurrentHashrateType = function(pool, timestamp, type) {
    return `
      SELECT identifier, solo,
        SUM(work) as work
      FROM "${ pool }".current_hashrate
      WHERE timestamp >= ${ timestamp }
      AND type = '${ type }'
      GROUP BY identifier, solo;`;
  };

  // Build Hashrate Values String
  this.buildCurrentHashrateMain = function(updates) {
    let values = '';
    updates.forEach((hashrate, idx) => {
      values += `(
        ${ hashrate.timestamp },
        '${ hashrate.miner }',
        '${ hashrate.worker }',
        '${ hashrate.identifier }',
        '${ hashrate.ip_hash }',
        '${ hashrate.share }',
        ${ hashrate.solo },
        '${ hashrate.type }',
        ${ hashrate.work })`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Current Round
  this.insertCurrentHashrateMain = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_hashrate (
        timestamp, miner, worker,
        identifier, ip_hash, share,
        solo, type, work)
      VALUES ${ _this.buildCurrentHashrateMain(updates) };`;
  };

  // Delete Rows From Current Round
  this.deleteCurrentHashrateInactive = function(pool, timestamp) {
    return `
      DELETE FROM "${ pool }".current_hashrate
      WHERE timestamp < ${ timestamp };`;
  };
};

module.exports = CurrentHashrate;
