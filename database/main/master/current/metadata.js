// Main Schema Function
const CurrentMetadata = function (logger, configMain) {

  const _this = this;
  this.logger = logger;
  this.configMain = configMain;

  // Handle Current Parameters
  this.numbers = ['timestamp', 'blocks', 'efficiency', 'effort', 'hashrate',
    'invalid', 'miners', 'stale', 'valid',
    'work', 'workers'];
  this.strings = ['identifier', 'type'];
  this.parameters = ['timestamp', 'blocks', 'efficiency', 'effort', 'hashrate',
    'identifier', 'invalid', 'miners', 'solo',
    'stale', 'type', 'valid', 'work', 'workers'];

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

  // Select Current Metadata Using Parameters
  this.selectCurrentMetadataMain = function(pool, parameters) {
    let output = `SELECT * FROM "${ pool }".current_metadata`;
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

  // Build Metadata Values String
  this.buildCurrentMetadataBlocks = function(updates) {
    let values = '';
    updates.forEach((metadata, idx) => {
      values += `(
        ${ metadata.timestamp },
        ${ metadata.blocks },
        '${ metadata.identifier }',
        ${ metadata.solo },
        '${ metadata.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Blocks Data
  this.insertCurrentMetadataBlocks = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_metadata (
        timestamp, blocks, identifier,
        solo, type)
      VALUES ${ _this.buildCurrentMetadataBlocks(updates) }
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "${ pool }".current_metadata.blocks + EXCLUDED.blocks;`;
  };

  // Build Metadata Values String
  this.buildCurrentMetadataHashrate = function(updates) {
    let values = '';
    updates.forEach((metadata, idx) => {
      values += `(
        ${ metadata.timestamp },
        ${ metadata.hashrate },
        '${ metadata.identifier }',
        ${ metadata.miners },
        ${ metadata.solo },
        '${ metadata.type }',
        ${ metadata.workers })`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Hashrate Data
  this.insertCurrentMetadataHashrate = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_metadata (
        timestamp, hashrate, identifier,
        miners, solo, type, workers)
      VALUES ${ _this.buildCurrentMetadataHashrate(updates) }
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
  };

  // Insert Rows Using Reset
  this.insertCurrentMetadataRoundsReset = function(pool, timestamp, solo, blockType) {
    return `
      UPDATE "${ pool }".current_metadata
      SET timestamp = ${ timestamp }, efficiency = 0,
        effort = 0, invalid = 0, stale = 0,
        valid = 0, work = 0
      WHERE solo = ${ solo } AND type = '${ blockType }';`;
  };

  // Build Metadata Values String
  this.buildCurrentMetadataRoundsReset = function(updates) {
    let values = '';
    updates.forEach((metadata, idx) => {
      values += `(
        ${ metadata.timestamp },
        0, 0, '${ metadata.identifier }', 0, ${ metadata.solo }, 0, '${ metadata.type }', 0, 0)`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Reset
  this.insertCurrentMetadataRoundsReset2 = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_metadata (
        timestamp, efficiency, effort,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES ${ _this.buildCurrentMetadataRoundsReset(updates) }
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        identifier = EXCLUDED.identifier,
        solo = EXCLUDED.solo,
        efficiency = 0, effort = 0, invalid = 0,
        stale = 0, valid = 0, work = 0;`;
  };

  // Build Metadata Values String
  this.buildCurrentMetadataRounds = function(updates) {
    let values = '';
    updates.forEach((metadata, idx) => {
      values += `(
        ${ metadata.timestamp },
        ${ metadata.efficiency },
        ${ metadata.effort },
        '${ metadata.identifier }',
        ${ metadata.invalid },
        ${ metadata.solo },
        ${ metadata.stale },
        '${ metadata.type }',
        ${ metadata.valid },
        ${ metadata.work })`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Round Data
  this.insertCurrentMetadataRounds = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_metadata (
        timestamp, efficiency, effort,
        identifier, invalid, solo,
        stale, type, valid, work)
      VALUES ${ _this.buildCurrentMetadataRounds(updates) }
      ON CONFLICT ON CONSTRAINT current_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        efficiency = EXCLUDED.efficiency,
        effort = "${ pool }".current_metadata.effort + EXCLUDED.effort,
        invalid = "${ pool }".current_metadata.invalid + EXCLUDED.invalid,
        stale = "${ pool }".current_metadata.stale + EXCLUDED.stale,
        valid = "${ pool }".current_metadata.valid + EXCLUDED.valid,
        work = "${ pool }".current_metadata.work + EXCLUDED.work;`;
  };
};

module.exports = CurrentMetadata;
