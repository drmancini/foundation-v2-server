const Text = require('../../../../locales/index');

////////////////////////////////////////////////////////////////////////////////

// Main Schema Function
const HistoricalWorkers = function (logger, configMain) {

  const _this = this;
  this.logger = logger;
  this.configMain = configMain;
  this.text = Text[configMain.language];

  // Handle Historical Parameters
  this.numbers = ['timestamp', 'efficiency', 'effort', 'hashrate', 'invalid', 'stale', 'valid', 'work'];
  this.strings = ['miner', 'worker', 'type'];
  this.parameters = ['timestamp', 'miner', 'worker', 'efficiency', 'effort', 'hashrate', 'invalid',
    'solo', 'stale', 'type', 'valid', 'work'];

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

  // Build Workers Values String
  this.buildHistoricalWorkersMain = function(updates) {
    let values = '';
    updates.forEach((worker, idx) => {
      values += `(
        ${ worker.timestamp },
        ${ worker.recent },
        '${ worker.miner }',
        '${ worker.worker }',
        ${ worker.efficiency },
        ${ worker.effort },
        ${ worker.hashrate },
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
  this.insertHistoricalWorkersMain = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".historical_workers (
        timestamp, recent, miner,
        worker, efficiency, effort,
        hashrate, invalid, solo,
        stale, type, valid, work)
      VALUES ${ _this.buildHistoricalWorkersMain(updates) }
      ON CONFLICT ON CONSTRAINT historical_workers_recent
      DO NOTHING;`;
  };

  // Build Workers Values String
  this.buildHistoricalWorkersRounds = function(updates) {
    let values = '';
    updates.forEach((worker, idx) => {
      values += `(
        ${ worker.timestamp },
        ${ worker.recent },
        '${ worker.miner }',
        '${ worker.worker }',
        '${ worker.identifier }',
        ${ worker.invalid },
        '${ worker.ip_hash }',
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
        ip_hash, solo, stale, type,
        valid, work)
      VALUES ${ _this.buildHistoricalWorkersRounds(updates) }
      ON CONFLICT ON CONSTRAINT historical_workers_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        identifier = EXCLUDED.identifier,
        invalid = "${ pool }".historical_workers.invalid + EXCLUDED.invalid,
        stale = "${ pool }".historical_workers.stale + EXCLUDED.stale,
        valid = "${ pool }".historical_workers.valid + EXCLUDED.valid,
        work = "${ pool }".historical_workers.work + EXCLUDED.work;`;
  };
};

module.exports = HistoricalWorkers;
