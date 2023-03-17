// Main Schema Function
const HistoricalMiners = function (logger, configMain) {

  const _this = this;
  this.logger = logger;
  this.configMain = configMain;

  // Handle Historical Parameters
  this.numbers = ['timestamp', 'recent', 'hashrate', 'invalid', 'stale', 'valid', 'work'];
  this.strings = ['miner', 'type'];
  this.parameters = ['timestamp', 'recent', 'miner', 'hashrate', 'invalid', 'stale',
    'type', 'valid', 'work'];

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

  // Select Historical Miners Using Parameters
  this.selectHistoricalMinersMain = function(pool, parameters) {
    let output = `SELECT * FROM "${ pool }".historical_miners`;
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
  this.buildHistoricalMinersHashrate = function(updates) {
    let values = '';
    updates.forEach((miner, idx) => {
      values += `(
        ${ miner.recent },
        '${ miner.miner }',
        ${ miner.hashrate },
        ${ miner.solo },
        '${ miner.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Hashrate Data
  this.insertHistoricalMinersHashrate = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".historical_miners (
        recent, miner, hashrate,
        solo, type)
      VALUES ${ _this.buildHistoricalMinersHashrate(updates) }
      ON CONFLICT ON CONSTRAINT historical_miners_unique
      DO UPDATE SET
        hashrate = EXCLUDED.hashrate;`;
  };

  // Build Miners Values String
  this.buildHistoricalMinersMain = function(updates) {
    let values = '';
    updates.forEach((miner, idx) => {
      values += `(
        ${ miner.timestamp },
        ${ miner.recent },
        '${ miner.miner }',
        ${ miner.invalid },
        ${ miner.stale },
        '${ miner.type }',
        ${ miner.valid },
        ${ miner.work })`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Historical Data
  this.insertHistoricalMinersMain = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".historical_miners (
        timestamp, recent, miner,
        invalid, stale, type,
        valid, work)
      VALUES ${ _this.buildHistoricalMinersMain(updates) }
      ON CONFLICT ON CONSTRAINT historical_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "${ pool }".historical_miners.invalid + EXCLUDED.invalid,
        stale = "${ pool }".historical_miners.stale + EXCLUDED.stale,
        valid = "${ pool }".historical_miners.valid + EXCLUDED.valid,
        work = "${ pool }".historical_miners.work + EXCLUDED.work;`;
  };

  // Delete Rows From Historical Miners
  this.deleteHistoricalMinersCutoff = function(pool, timestamp) {
    return `
      DELETE FROM "${ pool }".historical_miners
      WHERE recent < ${ timestamp };`;
  };
};

module.exports = HistoricalMiners;