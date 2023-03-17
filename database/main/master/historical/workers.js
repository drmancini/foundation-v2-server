// Main Schema Function
const HistoricalWorkers = function (logger, configMain) {

  const _this = this;
  this.logger = logger;
  this.configMain = configMain;

  // Handle Historical Parameters
  this.numbers = ['timestamp', 'recent', 'efficiency', 'effort', 'hashrate', 'invalid', 'stale', 'valid'];
  this.strings = ['miner', 'worker', 'identifier', 'type'];
  this.parameters = ['timestamp', 'recent', 'miner', 'worker', 'efficiency', 'effort', 'hashrate', 'identifier',
    'invalid', 'solo', 'stale', 'type', 'valid'];

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

  // Select Historical Workers Using Parameters
  this.selectHistoricalWorkersMain = function(pool, parameters) {
    let output = `SELECT * FROM "${ pool }".historical_workers`;
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

  // Select Share Counts and Average Hashrate of Historical Workers
  this.selectHistoricalWorkersAverages = function(pool, halfDay, oneDay, solo, type) {
    return `
      SELECT miner, worker, solo,
        AVG(CASE WHEN recent > ${ halfDay }
          THEN hashrate ELSE null END) AS hashrate_12h,
        AVG(CASE WHEN recent > ${ oneDay }
          THEN hashrate ELSE null END) AS hashrate_24h,
        SUM(CASE WHEN recent > 1679045905245
          THEN hashrate ELSE null END) AS sum_hashrate_12h,
        SUM(CASE WHEN recent > 1679002705245
          THEN hashrate ELSE null END) AS sum_hashrate_24h,
        SUM(invalid) AS invalid, 
        SUM(stale) AS stale,
        SUM(valid) AS valid
      FROM "${ pool }".historical_workers
      WHERE recent > ${ oneDay }
      AND solo = ${ solo }
      AND type = '${ type }'
      GROUP BY miner, worker, solo;`;
  };

  // Build Workers Values String
  this.buildHistoricalWorkersHashrate = function(updates) {
    let values = '';
    updates.forEach((miner, idx) => {
      values += `(
        ${ miner.timestamp },
        ${ miner.recent },
        '${ miner.miner }',
        '${ miner.worker }',
        ${ miner.hashrate },
        ${ miner.solo },
        '${ miner.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Hashrate Data
  this.insertHistoricalWorkersHashrate = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".historical_workers (
        timestamp, recent, miner,
        worker, hashrate, solo,
        type)
      VALUES ${ _this.buildHistoricalWorkersHashrate(updates) }
      ON CONFLICT ON CONSTRAINT historical_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate;`;
  };

  // Build Workers Values String
  this.buildHistoricalWorkersMain = function(updates) {
    let values = '';
    updates.forEach((worker, idx) => {
      values += `(
        ${ worker.timestamp },
        ${ worker.recent },
        '${ worker.miner }',
        '${ worker.worker }',
        '${ worker.identifier }',
        ${ worker.invalid },
        ${ worker.solo },
        ${ worker.stale },
        '${ worker.type }',
        ${ worker.valid },
        ${ worker.work })`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Historical Data
  this.insertHistoricalWorkersRounds = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".historical_workers (
        timestamp, recent, miner,
        worker, identifier, invalid,
        solo, stale, type, valid,
        work)
      VALUES ${ _this.buildHistoricalWorkersMain(updates) }
      ON CONFLICT ON CONSTRAINT historical_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        identifier = EXCLUDED.identifier,
        invalid = "${ pool }".historical_workers.invalid + EXCLUDED.invalid,
        stale = "${ pool }".historical_workers.stale + EXCLUDED.stale,
        valid = "${ pool }".historical_workers.valid + EXCLUDED.valid,
        work = "${ pool }".historical_workers.work + EXCLUDED.work;`;
  };

  // Delete Rows From Historical Workers
  this.deleteHistoricalWorkersCutoff = function(pool, timestamp) {
    return `
      DELETE FROM "${ pool }".historical_workers
      WHERE recent < ${ timestamp };`;
  };
};

module.exports = HistoricalWorkers;