// Main Schema Function
const CurrentUsers = function (logger, configMain) {

  const _this = this;
  this.logger = logger;
  this.configMain = configMain;

  // Handle Current Parameters
  this.numbers = [ 'timestamp', 'activity_limit', 'joined', 'payout_limit' ];
  this.strings = [ 'miner', 'email', 'locale', 'token', 'type' ];
  this.parameters = [ 'timestamp', 'miner', 'activity_limit', 'activity_notifications', 'email',
    'joined', 'locale', 'payment_notifications', 'payout_limit', 'payout_notifications', 'subscribed', 
    'token', 'type' ];

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
    if (query.slice(0, 2) === 'bw') {
      const remainder = query.replace('bw', '');
      const firstString = _this.handleNumbers({first: remainder.split('|')[0]}, 'first');
      const secondString = parameter + _this.handleNumbers({second: remainder.split('|')[1]}, 'second');
       return `${ firstString } AND ${ secondString }`;
    }
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

  // Select User Using Parameters
  this.selectCurrentUsers = function(pool, parameters) {
    let output = `SELECT * FROM "${ pool }".current_users`;
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
  
  // Select Current Users Using Parameters
  this.selectCurrentUsersBatchAddresses = function(pool, addresses, type) {
    return addresses.length >= 1 ? `
      SELECT DISTINCT ON (miner) * FROM "${ pool }".current_users
      WHERE miner IN (${ addresses.join(', ') }) AND type = '${ type }'
      ORDER BY miner;` : `
      SELECT * FROM "${ pool }".current_users LIMIT 0;`;
  };

  this.buildcreateCurrentUsers = function(updates) {
    let values = '';
    updates.forEach((user, idx) => {
      values += `(
        ${ user.timestamp },
        '${ user.miner }',
        ${ user.joined },
        ${ user.payout_limit },
        '${ user.type }')`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Create New User
  this.createCurrentUsers = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_users (
        timestamp, miner, joined,
        payout_limit, type)
      VALUES ${ _this.buildcreateCurrentUsers(updates) }
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`; 
  };
};

module.exports = CurrentUsers;
