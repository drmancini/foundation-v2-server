// Main Schema Function
const CurrentRounds = function (logger, configMain) {

  const _this = this;
  this.logger = logger;
  this.configMain = configMain;

  // Handle Current Parameters
  this.numbers = ['timestamp', 'submitted', 'invalid', 'stale', 'times', 'valid', 'work'];
  this.strings = ['miner', 'worker', 'identifier', 'round', 'type'];
  this.parameters = ['timestamp', 'submitted', 'miner', 'worker', 'identifier', 'invalid', 'round',
    'solo', 'stale', 'times', 'type', 'valid', 'work'];

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

  // Select Current Rounds Using Parameters
  this.selectCurrentRoundsMain = function(pool, parameters) {
    let output = `SELECT * FROM "${ pool }".current_rounds`;
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
  this.selectCurrentRoundsBatchAddresses = function(pool, addresses, type) {
    return addresses.length >= 1 ? `
      SELECT DISTINCT ON (worker) * FROM "${ pool }".current_rounds
      WHERE worker IN (${ addresses.join(', ') }) AND type = '${ type }'
      ORDER BY worker, timestamp DESC;` : `
      SELECT * FROM "${ pool }".current_rounds LIMIT 0;`;
  };

  // Select Current Rounds for Solo Payments
  this.selectCurrentRoundsPayments = function(pool, round, solo, type) {
    return `
      SELECT DISTINCT ON (m.worker, m.round, m.solo, m.type)
        t.timestamp, t.submitted, t.recent, m.miner, m.worker,
        m.identifier, t.invalid, m.round, m.solo, t.stale, t.times, m.type,
        t.valid, t.work FROM (
      SELECT worker, round, solo, type, MAX(timestamp) as timestamp,
        MAX(submitted) as submitted, MAX(recent) as recent,
        SUM(invalid) as invalid, SUM(stale) as stale, SUM(times) as times,
        SUM(valid) as valid, SUM(work) as work
      FROM "${ pool }".current_rounds
      GROUP BY worker, round, solo, type
        ) t JOIN "${ pool }".current_rounds m ON m.worker = t.worker
        AND m.round = t.round AND m.solo = t.solo AND m.type = t.type
      WHERE m.round = '${ round }' AND m.solo = ${ solo }
      AND m.type = '${ type }';`;
  };
  
  // Select Current Rounds for Shared Payments
  this.selectCurrentRoundsSegment = function(pool, startTime, endTime, type) {
    return `
      SELECT miner, worker, solo, type,
        SUM(times) as times,
        SUM(work) as work
      FROM "${ pool }".current_rounds
      WHERE recent > ${ startTime }
      AND recent < ${ endTime }
      AND solo = false
      AND type = '${ type }'
      GROUP BY miner, worker, solo, type;`;
  };
  
  // Sum Work in Current Rounds Using Parameters
  this.selectCurrentRoundsSumWork = function(pool, parameters) {
    let output = `SELECT worker, SUM(work) AS work FROM "${ pool }".current_rounds`;
    const filtered = Object.keys(parameters).filter((key) => _this.parameters.includes(key));
    filtered.forEach((parameter, idx) => {
      if (idx === 0) output += ' WHERE ';
      else output += ' AND ';
      output += `${ parameter }`;
      output += _this.handleQueries(parameters, parameter);
    });
    output += `GROUP BY worker;`;
    return output;
  };

  // Build Rounds Values String
  this.buildCurrentRoundsMain = function(updates) {
    let values = '';
    updates.forEach((round, idx) => {
      values += `(
        ${ round.timestamp },
        ${ round.submitted },
        ${ round.recent },
        '${ round.miner }',
        '${ round.worker }',
        '${ round.identifier }',
        ${ round.invalid },
        '${ round.round }',
        ${ round.solo },
        ${ round.stale },
        ${ round.times },
        '${ round.type }',
        ${ round.valid },
        ${ round.work })`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Round Data
  this.insertCurrentRoundsMain = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_rounds (
        timestamp, submitted, recent,
        miner, worker, identifier, invalid,
        round, solo, stale, times, type,
        valid, work)
      VALUES ${ _this.buildCurrentRoundsMain(updates) }
      ON CONFLICT ON CONSTRAINT current_rounds_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        submitted = EXCLUDED.submitted,
        invalid = "${ pool }".current_rounds.invalid + EXCLUDED.invalid,
        stale = "${ pool }".current_rounds.stale + EXCLUDED.stale,
        times = GREATEST("${ pool }".current_rounds.times, EXCLUDED.times),
        valid = "${ pool }".current_rounds.valid + EXCLUDED.valid,
        work = "${ pool }".current_rounds.work + EXCLUDED.work;`;
  };

  // Update Rows Using Round
  this.updateCurrentRoundsMainSolo = function(pool, miner, round, type) {
    return `
      UPDATE "${ pool }".current_rounds
      SET round = '${ round }'
      WHERE round = 'current' AND miner = '${ miner }'
      AND solo = true AND type = '${ type }';`;
  };

  // Update Rows Using Round
  this.updateCurrentRoundsMainShared = function(pool, round, type) {
    return `
      UPDATE "${ pool }".current_rounds
      SET round = '${ round }'
      WHERE round = 'current' AND solo = false
      AND type = '${ type }';`;
  };

  // Delete Rows From Current Round
  this.deleteCurrentRoundsInactive = function(pool, submitted) {
    return `
      DELETE FROM "${ pool }".current_rounds
      WHERE round = 'current' AND submitted < ${ submitted };`;
  };

  // Delete Rows From Current Round
  this.deleteCurrentRoundsMain = function(pool, rounds) {
    return `
      DELETE FROM "${ pool }".current_rounds
      WHERE round IN (${ rounds.join(', ') });`;
  };
};

module.exports = CurrentRounds;
