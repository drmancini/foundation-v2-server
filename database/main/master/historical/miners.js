const Text = require('../../../../locales/index');

////////////////////////////////////////////////////////////////////////////////

// Main Schema Function
const HistoricalMiners = function (logger, configMain) {

  const _this = this;
  this.logger = logger;
  this.configMain = configMain;
  this.text = Text[configMain.language];

  // Handle Historical Parameters
  this.numbers = ['timestamp', 'hashrate', 'invalid', 'stale', 'valid', 'work'];
  this.strings = ['miner', 'type'];
  this.parameters = ['timestamp', 'miner', 'hashrate', 'invalid', 'stale', 'type', 'valid', 'work'];

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

  // Select Share Counts and Average Hashrate of Historical Miners
  this.selectHistoricalMinersAverages = function(pool, halfDay, oneDay, type) {
    return `
      SELECT miner, solo,
        SUM (CASE WHEN recent > ${ halfDay }
          THEN work ELSE 0 END) AS sum_work_12h,
        SUM (CASE WHEN recent > ${ oneDay }
          THEN work ELSE 0 END) AS sum_work_24h,
        CAST (SUM (invalid) AS INT) AS invalid, 
        CAST (SUM (stale) AS INT) AS stale,
        CAST (SUM (valid) AS INT) AS valid
      FROM "${ pool }".historical_miners
      WHERE recent > ${ oneDay }
        AND type = '${ type }'
      GROUP BY miner, solo;`;
  };

  // Build Miners Values String
  this.buildHistoricalMinersHashrate = function(updates) {
    let values = '';
    updates.forEach((miner, idx) => {
      values += `(
        ${ miner.timestamp },
        ${ miner.recent },
        '${ miner.miner }',
        ${ miner.hashrate },
        ${ miner.solo },
        '${ miner.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Historical Data
  this.insertHistoricalMinersHashrate = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".historical_miners (
        timestamp, recent, miner,
        hashrate, solo, type)
      VALUES ${ _this.buildHistoricalMinersHashrate(updates) }
      ON CONFLICT ON CONSTRAINT historical_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate;`;
  };

  // Build Miners Values String
  this.buildHistoricalMinersRounds = function(updates) {
    let values = '';
    updates.forEach((miner, idx) => {
      values += `(
        ${ miner.timestamp },
        ${ miner.recent },
        '${ miner.miner }',
        ${ miner.invalid },
        ${ miner.solo },
        ${ miner.stale },
        '${ miner.type }',
        ${ miner.valid },
        ${ miner.work })`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Historical Data
  this.insertHistoricalMinersRounds = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".historical_miners (
        timestamp, recent, miner,
        invalid, solo, stale,
        type, valid, work)
      VALUES ${ _this.buildHistoricalMinersRounds(updates) }
      ON CONFLICT ON CONSTRAINT historical_miners_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        invalid = "${ pool }".historical_miners.invalid + EXCLUDED.invalid,
        stale = "${ pool }".historical_miners.stale + EXCLUDED.stale,
        valid = "${ pool }".historical_miners.valid + EXCLUDED.valid,
        work = "${ pool }".historical_miners.work + EXCLUDED.work;`;
  };
};

module.exports = HistoricalMiners;
