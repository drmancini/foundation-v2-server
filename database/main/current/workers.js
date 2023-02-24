const Text = require('../../../locales/index');

////////////////////////////////////////////////////////////////////////////////

// Main Schema Function
const CurrentWorkers = function (logger, configMain) {

  const _this = this;
  this.logger = logger;
  this.configMain = configMain;
  this.text = Text[configMain.language];

  // Handle Current Parameters
  this.numbers = ['timestamp', 'efficiency', 'effort', 'hashrate', 'invalid', 'stale', 'valid'];
  this.strings = ['miner', 'worker', 'type'];
  this.parameters = ['timestamp', 'miner', 'worker', 'efficiency', 'effort', 'hashrate', 'invalid',
    'solo', 'stale', 'type', 'valid'];

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

  // Select Current Workers Using Parameters
  this.selectCurrentWorkersMain = function(pool, parameters) {
    let output = `SELECT * FROM "${ pool }".current_workers`;
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

  // Select Last Share of Workers
  this.selectCurrentWorkersLastShare = function(pool, active_cutoff, inactive_cutoff, solo, type) {
    return `
      SELECT miner,
        COUNT(CASE WHEN last_share > ${ active_cutoff }
          THEN 1 ELSE null END) AS active_workers,
        COUNT(CASE WHEN last_share > ${ inactive_cutoff }
          AND last_share < ${ active_cutoff }
          THEN 1 ELSE null END) AS inactive_workers
      FROM "${ pool }".current_workers
      WHERE solo = ${ solo }
        AND type = '${ type }'
      GROUP BY miner;`;
  };
  
  // Build Workers Values String
  this.buildCurrentWorkersHashrate = function(updates) {
    let values = '';
    updates.forEach((worker, idx) => {
      values += `(
        ${ worker.timestamp },
        '${ worker.miner }',
        '${ worker.worker }',
        ${ worker.efficiency },
        ${ worker.hashrate },
        ${ worker.solo },
        '${ worker.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Hashrate Data
  this.insertCurrentWorkersHashrate = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_workers (
        timestamp, miner, worker,
        efficiency, hashrate, solo,
        type)
      VALUES ${ _this.buildCurrentWorkersHashrate(updates) }
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        hashrate = EXCLUDED.hashrate;`;
  };

  // Build Workers Reset Values String
  this.buildCurrentWorkersResetHashrate = function(updates) {
    let values = '';
    updates.forEach((worker, idx) => {
      values += `(
        ${ worker.timestamp },
        '${ worker.miner }',
        '${ worker.worker }',
        ${ worker.hashrate_12h },
        ${ worker.hashrate_24h },
        ${ worker.solo },
        '${ worker.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Hashrate Reset for Workers
  this.insertCurrentWorkersResetHashrate = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_workers (
        timestamp, miner, worker,
        hashrate_12h, hashrate_24h,
        solo, type)
      VALUES ${ _this.buildCurrentWorkersResetHashrate(updates) }
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate_12h = EXCLUDED.hashrate_12h,
        hashrate_24h = EXCLUDED.hashrate_24h;`;
  };

  // Build Workers Values String
  this.buildCurrentWorkersRounds = function(updates) {
    let values = '';
    updates.forEach((worker, idx) => {
      values += `(
        ${ worker.timestamp },
        '${ worker.miner }',
        '${ worker.worker }',
        ${ worker.effort },
        '${ worker.identifier }',
        '${ worker.ip_hash }',
        ${ worker.last_octet },
        ${ worker.last_share },
        ${ worker.offline_tag },
        ${ worker.solo },
        '${ worker.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Round Data
  this.insertCurrentWorkersRounds = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_workers (
        timestamp, miner, worker,
        effort, identifier,
        ip_hash, last_octet, last_share,
        offline_tag, solo, type)
      VALUES ${ _this.buildCurrentWorkersRounds(updates) }
      ON CONFLICT ON CONSTRAINT current_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        effort = "${ pool }".current_workers.effort + EXCLUDED.effort,
        identifier = EXCLUDED.identifier,
        ip_hash = EXCLUDED.ip_hash,
        last_octet = EXCLUDED.last_octet,
        last_share = EXCLUDED.last_share,
        offline_tag = EXCLUDED.offline_tag,
        solo = EXCLUDED.solo;`;
  }; 

  // Update Shared Workers Using Reset
  this.updateCurrentSharedWorkersRoundsReset = function(pool, timestamp, type) {
    return `
      UPDATE "${ pool }".current_workers
      SET timestamp = ${ timestamp },
        effort = 0
      WHERE solo = false
      AND type = '${ type }';`;
  };

  // Update Workers Using Reset
  this.updateCurrentSoloWorkersRoundsReset = function(pool, timestamp, miner, type) {
    return `
      UPDATE "${ pool }".current_workers
      SET timestamp = ${ timestamp },
        effort = 0
      WHERE miner = '${ miner }'
      AND solo = true
      AND type = '${ type }';`;
  };

  // Delete Rows From Current Round
  this.deleteCurrentWorkersInactive = function(pool, timestamp) {
    return `
      DELETE FROM "${ pool }".current_workers
      WHERE timestamp < ${ timestamp };`;
  };
};

module.exports = CurrentWorkers;
