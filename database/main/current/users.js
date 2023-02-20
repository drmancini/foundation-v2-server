// Main Schema Function
const CurrentUsers = function (logger, configMain) {

  const _this = this;
  this.logger = logger;
  this.configMain = configMain;

  // Handle Current Parameters
  this.numbers = ['joined', 'payout_limit', 'activity_limit'];
  this.strings = ['miner', 'email', 'token', 'locale'];
  this.parameters = ['payout_limit', 'payout_notifications',
    'activity_limit', 'activity_notifications', 'joined', 
    'miner', 'payment_notifications', 'subscribed', 'email',
    'locale', 'token'];

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
  
  this.buildCreateCurrentUser = function(updates) {
    let values = '';
    updates.forEach((user, idx) => {
      values += `(
        '${ user.miner }',
        ${ user.joined },
        '${ user.email }',
        '${ user.token }',
        ${ user.subscribed },
        '${ user.locale }',
        ${ user.payout_limit },
        ${ user.payment_notifications },
        ${ user.activity_limit },
        ${ user.activity_notifications })`;
      if (idx < updates.length - 1) values += ', ';
    });
    return values;
  };

  // Update User Data
  this.insertCurrentUsersMain = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_users (
        miner, joined, email, token, subscribed,
        locale, payout_limit, payment_notifications,
        activity_limit, activity_notifications)
      VALUES ${ _this.buildCreateCurrentUser(updates) }
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`; 
  };

  // Create New User
  this.createCurrentUser = function(pool, updates) {
    return `
      INSERT INTO "${ pool }".current_users (
        miner, joined, payout_limit)
      VALUES (
        '${ updates.miner }',
        ${ updates.joined },
        ${ updates.payout_limit })
      ON CONFLICT ON CONSTRAINT current_users_unique
      DO NOTHING;`; 
  };

  // Subscribe User
  this.updateCurrentUserSubscrbe = function(pool, updates) {
    return `
      UPDATE "${ pool }".current_users
      SET subscribed = true
      WHERE miner = '${ updates.miner }';`;
  };

  // Unubscribe User
  this.updateCurrentUserUnsubscrbe = function(pool, updates) {
    return `
      UPDATE "${ pool }".current_users
      SET activity_notifications = false,
        email = 'unknown',
        payment_notifications = false,
        subscribed = false,
        token = 'unknown'
      WHERE miner = '${ updates.miner }';`;
  };

  // Update User's Payout Limit
  this.updateCurrentUserPayoutSettings = function(pool, updates) {
    return `
      UPDATE "${ pool }".current_users
      SET payout_limit = ${ updates.payoutLimit }
      WHERE miner = '${ updates.miner }';`;
  };

  // Update User's Notifications
  this.updateCurrentUserNotificationSettings = function(pool, updates) {
    return `
      UPDATE "${ pool }".current_users
      SET activity_limit = ${ updates.activityLimit },
        activity_notifications = ${ updates.activityNotifications },
        payment_notifications = ${ updates.paymentNotifications }
      WHERE miner = '${ updates.miner }';`;
  };

  // Update User's Email Address
  this.updateCurrentUserEmailAddress = function(pool, updates) {
    return `
      UPDATE "${ pool }".current_users
      SET email = '${ updates.email }',
        token = '${ updates.token }'
      WHERE miner = '${ updates.miner }';`;
  };

  // Update User's Locale
  this.updateCurrentUserLocale = function(pool, miner, locale) {
    return `
      UPDATE "${ pool }".current_users
      SET locale = '${ locale }'
      WHERE miner = '${ miner }';`;
  };
};

module.exports = CurrentUsers;
