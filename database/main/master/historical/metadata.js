// Main Schema Function
const HistoricalMetadata = function (logger, configMain) {

  const _this = this;
  this.logger = logger;
  this.configMain = configMain;

  // Handle Historical Parameters
  this.numbers = ['timestamp', 'recent', 'blocks', 'hashrate', 'miners',
    'work', 'workers'];
  this.strings = ['identifier', 'type'];
  this.parameters = ['timestamp', 'recent', 'blocks', 'hashrate',
    'identifier', 'miners', 'solo', 'type', 'work', 'workers'];

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

  // Select Historical Metadata Using Parameters
  this.selectHistoricalMetadataMain = function(pool, parameters) {
    let output = `SELECT * FROM "${ pool }".historical_metadata`;
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
  this.buildHistoricalMetadataBlocks = function(updates) {
    let values = '';
    updates.forEach((metadata, idx) => {
      values += `(
        ${ metadata.timestamp },
        ${ metadata.recent },
        ${ metadata.blocks },
        '${ metadata.identifier }',
        ${ metadata.solo },
        '${ metadata.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Blocks Data
  this.insertHistoricalMetadataBlocks = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".historical_metadata (
        timestamp, recent, blocks,
        identifier, solo, type)
      VALUES ${ _this.buildHistoricalMetadataBlocks(updates) }
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        blocks = "${ pool }".historical_metadata.blocks + EXCLUDED.blocks;`;
  };

  // Build Metadata Values String
  this.buildHistoricalMetadataHashrate = function(updates) {
    let values = '';
    updates.forEach((metadata, idx) => {
      values += `(
        ${ metadata.timestamp },
        ${ metadata.recent },
        '${ metadata.identifier }',
        ${ metadata.hashrate },
        ${ metadata.miners },
        ${ metadata.solo },
        '${ metadata.type }',
        ${ metadata.workers })`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Hashrate Data
  this.insertHistoricalMetadataHashrate = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".historical_metadata (
        timestamp, recent, identifier,
        hashrate, miners, solo, type,
        workers)
      VALUES ${ _this.buildHistoricalMetadataHashrate(updates) }
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        hashrate = EXCLUDED.hashrate,
        miners = EXCLUDED.miners,
        workers = EXCLUDED.workers;`;
  };

  // Build Metadata Values String
  this.buildHistoricalMetadataRounds = function(updates) {
    let values = '';
    updates.forEach((metadata, idx) => {
      values += `(
        ${ metadata.timestamp },
        ${ metadata.recent },
        '${ metadata.identifier }',
        ${ metadata.solo },
        '${ metadata.type }',
        ${ metadata.work })`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Insert Rows Using Round Data
  this.insertHistoricalMetadataRounds = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".historical_metadata (
        timestamp, recent, identifier,
        solo, type, work)
      VALUES ${ _this.buildHistoricalMetadataRounds(updates) }
      ON CONFLICT ON CONSTRAINT historical_metadata_unique
      DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        work = "${ pool }".historical_metadata.work + EXCLUDED.work;`;
  };
};

module.exports = HistoricalMetadata;
