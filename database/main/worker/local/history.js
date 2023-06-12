const Text = require('../../../../locales/index');

////////////////////////////////////////////////////////////////////////////////

// Main Schema Function
const LocalHistory = function (logger, configMain) {

  const _this = this;
  this.logger = logger;
  this.configMain = configMain;
  this.text = Text[configMain.language];

  // Handle Local Parameters
  this.numbers = ['timestamp', 'recent', 'share_count', 'share_write', 'transaction_count'];
  this.strings = [''];
  this.parameters = ['timestamp', 'recent', 'share_count', 'share_write', 'transaction_count'];

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

  // Select Local History Using Parameters
  this.selectLocalHistoryMain = function(pool, parameters) {
    let output = `SELECT * FROM "${ pool }".local_history`;
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


  // Build History Values String
  this.buildLocalHistoryCounts = function(updates) {
    let values = '';
    updates.forEach((transaction, idx) => {
      values += `(
        ${ transaction.timestamp },
        ${ transaction.recent },
        ${ transaction.share_count },
        ${ transaction.transaction_count })`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Counts Using History Data
  this.insertLocalHistoryCounts = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".local_history (
        timestamp, recent,
        share_count, transaction_count)
      VALUES ${ _this.buildLocalHistoryCounts(updates) }
      ON CONFLICT ON CONSTRAINT local_history_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        share_count = EXCLUDED.share_count,
        transaction_count = EXCLUDED.transaction_count;`;
  };

  // Insert Writes Using History Data
  this.insertLocalHistoryWrites = function(pool, timestamp, recent, shares) {
    return `
      INSERT INTO "${ pool }".local_history (
        timestamp, recent,
        share_writes)
      VALUES (${ timestamp }, ${ recent }, ${ shares})
      ON CONFLICT ON CONSTRAINT local_history_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        share_writes = "${ pool }".local_history.share_writes + EXCLUDED.share_writes;`;
  };

  // Delete Rows Beyond Cutoff
  this.deleteLocalHistoryInactive = function(pool, timestamp) {
    return `
      DELETE FROM "${ pool }".local_history
      WHERE timestamp < ${ timestamp };`;
  };
};

module.exports = LocalHistory;
