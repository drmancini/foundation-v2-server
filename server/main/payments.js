const Text = require('../../locales/index');
const utils = require('./utils');

////////////////////////////////////////////////////////////////////////////////

// Main Payments Function
const Payments = function (logger, client, config, configMain) {

  const _this = this;
  this.logger = logger;
  this.client = client;
  this.config = config;
  this.configMain = configMain;
  this.pool = config.name;
  this.text = Text[configMain.language];

  // Stratum Variables
  process.setMaxListeners(0);
  this.forkId = process.env.forkId;
  
  // Client Handlers
  this.master = {
    executor: _this.client.master.commands.executor,
    current: _this.client.master.commands.current,
    historical: _this.client.master.commands.historical };
  
  // Combine Balances and Payments
  this.handleCurrentCombined = function(balances, payments) {

    // Iterate Through Payments
    const combined = Object.assign(balances, {});
    Object.keys(payments).forEach((address) => {
      if (address in combined) combined[address] += payments[address].generate;
      else combined[address] = payments[address].generate;
    });

    // Return Combined Payments
    return combined;
  };

  // Handle Miners Updates
  this.handleCurrentMiners = function(amounts, balances, blockType) {

    // Iterate Through Amounts
    const combined = {};
    Object.keys(amounts).forEach((address) => {
      combined[address] = { balance: 0, paid: amounts[address] };
    });

    // Iterate Through Balances
    Object.keys(balances).forEach((address) => {
      if (address in combined) combined[address].balance += balances[address];
      else combined[address] = { balance: balances[address], paid: 0 };
    });

    // Return Miners Updates
    return Object.keys(combined).map((miner) => {
      return {
        timestamp: Date.now(),
        miner: miner,
        balance: combined[miner].balance,
        paid: combined[miner].paid,
        type: blockType,
      };
    });
  };

  // Handle Custom User Payout Limits
  this.handleCurrentUsers = function(data) {
    const users = {};

    if (data.length > 0) {
      data
        .filter(user => user.payout_limit > _this.config.primary.payments.minPayment)
        .forEach(user => {
          users[user.miner] = user.payout_limit;
        });
    }

    return users;
  };

  // Handle Historical Blocks Updates
  this.handleHistoricalBlocks = function(blocks) {

    // Return Blocks Updates
    return blocks.map((block) => {
      return {
        timestamp: Date.now(),
        submitted: block.submitted,
        miner: block.miner,
        worker: block.worker,
        category: block.category,
        confirmations: block.confirmations,
        difficulty: block.difficulty,
        hash: block.hash,
        height: block.height,
        identifier: block.identifier,
        luck: block.luck,
        reward: block.reward,
        round: block.round,
        solo: block.solo,
        transaction: block.transaction,
        type: block.type,
      };
    });
  };

  // Handle Historical Payments Updates
  this.handleHistoricalPayments = function(amounts, record, blockType) {

    // Return Payments Updates
    return Object.keys(amounts).map((miner) => {
      return {
        timestamp: Date.now(),
        miner: miner,
        amount: amounts[miner],
        transaction: record,
        type: blockType,
      };
    });
  };

  // Handle Historical Transactions Updates
  this.handleHistoricalTransactions = function(amounts, record, blockType) {

    // Calculate Total Amount
    let total = 0;
    Object.keys(amounts).forEach((address) => {
      total += amounts[address];
    });

    // Return Transactions Updates
    return {
      timestamp: Date.now(),
      amount: total,
      transaction: record,
      type: blockType,
    };
  };

  // Handle Round Failure Updates
  this.handleFailures = function(blocks, callback) {

    // Build Combined Transaction
    const transactionsDelete = blocks.map((block) => `'${ block.round }'`);
    
    const transaction = [
      'BEGIN;',
      _this.master.current.payments.deleteCurrentPaymentsMain(_this.pool, transactionsDelete),
      _this.master.current.transactions.deleteCurrentTransactionsMain(_this.pool, transactionsDelete),
      'COMMIT;'];

    // Insert Work into Database
    _this.master.executor(transaction, () => callback());
  };

  // Handle Round Success Updates
  this.handleUpdates = function(blocks, amounts, balances, record, blockType, callback) {

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Handle Generate Block Delete Updates
    const generateBlocksDelete = blocks.map((block) => `'${ block.round }'`);
    if (generateBlocksDelete.length >= 1) {
      transaction.push(_this.master.current.blocks.deleteCurrentBlocksMain(
        _this.pool, generateBlocksDelete));
    }

    // Handle Miners Updates
    const minersUpdates = _this.handleCurrentMiners(amounts, balances, blockType);
    transaction.push(_this.master.current.miners.insertCurrentMinersReset(_this.pool, blockType));
    if (minersUpdates.length >= 1) {
      transaction.push(_this.master.current.miners.insertCurrentMinersPayments(
        _this.pool, minersUpdates));
    }

    // Handle Historical Generate Block Updates
    const generateBlocksUpdates = _this.handleHistoricalBlocks(blocks);
    if (generateBlocksUpdates.length >= 1) {
      transaction.push(_this.master.historical.blocks.insertHistoricalBlocksMain(
        _this.pool, generateBlocksUpdates));
    }

    // Handle Historical Payments Updates
    const paymentsUpdates = _this.handleHistoricalPayments(amounts, record, blockType);
    if (paymentsUpdates.length >= 1) {
      transaction.push(_this.master.historical.payments.insertHistoricalPaymentsMain(
        _this.pool, paymentsUpdates));
    }

    // Handle Historical Transactions Updates
    const transactionsUpdates = _this.handleHistoricalTransactions(amounts, record, blockType);
    if (record !== null) {
      transaction.push(_this.master.historical.transactions.insertHistoricalTransactionsMain(
        _this.pool, [transactionsUpdates]));
    }

    // Handle Transaction Delete Updates
    const transactionsDelete = blocks.map((block) => `'${ block.round }'`);
    if (transactionsDelete.length >= 1) {
      transaction.push(_this.master.current.transactions.deleteCurrentTransactionsMain(
        _this.pool, transactionsDelete));
    }

    // Insert Work into Database
    transaction.push('COMMIT;');
    _this.master.executor(transaction, () => callback());
  };

  // Handle Primary Updates
  this.handlePrimary = function(blocks, balances, callback) {

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Add User Payment Limits to Transaction 
    const parameters = { payout_limit: 'gt' + _this.config.primary.payments.minPayment, type: 'primary' }
    transaction.push(_this.master.current.users.selectCurrentUsers(_this.pool, parameters));

    // Add Round Lookups to Transaction
    blocks.forEach((block, idx) => {
      if (block.solo) {
        transaction.push(_this.master.current.rounds.selectCurrentRoundsPayments(
          _this.pool, block.round, block.solo, 'primary'));
      } else {
        transaction.push(_this.master.current.rounds.selectCurrentRoundsPayments(
          _this.pool, block.round, block.solo, 'primary'));
      //   const startTime = block.submitted - _this.config.primary.payments.windowPPLNT;
      //   const endTime = Math.floor(block.submitted / 60000) * 60000;
      //   const rounds = blocks.slice(idx + 1).map(block => block.round);
      //   transaction.push(_this.master.current.rounds.selectCurrentRoundsSegment(
      //     _this.pool, startTime, endTime, rounds, 'primary'));
      }
    });

    // Determine Workers for Rounds
    transaction.push('COMMIT;');
    _this.master.executor(transaction, (results) => {
      const users = _this.handleCurrentUsers(results[1].rows) || {};
      const rounds = results.slice(2, -1).map((round) => round.rows);

      // Collect Round/Worker Data and Amounts
      const sending = true;
      _this.stratum.stratum.handlePrimaryRounds(blocks, (error, updates) => {
        if (error) _this.handleFailures(blocks, () => callback(error));
        else _this.stratum.stratum.handlePrimaryWorkers(blocks, rounds, sending, (results, rewards) => {
          const payments = _this.handleCurrentCombined(balances, results);

          // Validate and Send Out Primary Payments
          _this.stratum.stratum.handlePrimaryBalances(payments, (error) => {
            if (error) _this.handleFailures(updates, () => callback(error));
            else _this.stratum.stratum.handlePrimaryPayments(payments, users, (error, amounts, balances, transaction) => {
              if (error) _this.handleFailures(updates, () => callback(error));
              else _this.handleUpdates(updates, amounts, balances, transaction, 'primary', () => callback(null));
            });
          });
        });
      });
    });
  };

  // Handle Auxiliary Updates
  this.handleAuxiliary = function(blocks, balances, callback) {

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Add User Payment Limits to Transaction 
    const parameters = { payout_limit: 'gt' + _this.config.primary.payments.minPayment, type: 'auxiliary' }
    transaction.push(_this.master.current.users.selectCurrentUsers(_this.pool, parameters));

    // Add Round Lookups to Transaction
    blocks.forEach((block, idx) => {
      if (block.solo) {
        transaction.push(_this.master.current.rounds.selectCurrentRoundsPayments(
          _this.pool, block.round, block.solo, 'auxiliary'));
      } else {
        transaction.push(_this.master.current.rounds.selectCurrentRoundsPayments(
          _this.pool, block.round, block.solo, 'auxiliary'));
        // const startTime = block.submitted - _this.config.primary.payments.windowPPLNT;
        // const endTime = Math.floor(block.submitted / 60000) * 60000;
        // const rounds = blocks.slice(idx + 1).map(block => block.round);
        // transaction.push(_this.master.current.rounds.selectCurrentRoundsSegment(
        //   _this.pool, startTime, endTime, rounds, 'auxiliary'));
      }
    });

    // Determine Workers for Rounds
    transaction.push('COMMIT;');
    _this.master.executor(transaction, (results) => {
      const users = _this.handleCurrentUsers(results[1].rows) || {};
      const rounds = results.slice(2, -1).map((round) => round.rows);

      // Collect Round/Worker Data and Amounts
      const sending = true;
      _this.stratum.stratum.handleAuxiliaryRounds(blocks, (error, updates) => {
        if (error) _this.handleFailures(updates, () => callback(error));
        else _this.stratum.stratum.handleAuxiliaryWorkers(blocks, rounds, sending, (results) => {
          const payments = _this.handleCurrentCombined(balances, results);

          // Validate and Send Out Auxiliary Payments
          _this.stratum.stratum.handleAuxiliaryBalances(payments, (error) => {
            if (error) _this.handleFailures(updates, () => callback(error));
            else _this.stratum.stratum.handleAuxiliaryPayments(payments, users, (error, amounts, balances, transaction) => {
              if (error) _this.handleFailures(updates, () => callback(error));
              else _this.handleUpdates(updates, amounts, balances, transaction, 'auxiliary', () => callback(null));
            });
          });
        });
      });
    });
  };

  // Handle Payment Updates
  // this.handleRounds = function(lookups, blockType, callback) {
  this.handleRounds = function(blocks, balances, blockType, callback) {

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Build Checks for Each Block
    const checks = [];
    if (blocks.length >= 1) {
    // if (lookups[1].rows[0]) {
      blocks.forEach((block) => {
      // lookups[1].rows.forEach((block) => {
        checks.push({ timestamp: Date.now(), round: block.round, type: blockType });
      });
    }

    // // Build Existing Miner Balances
    // const balances = {};
    // if (lookups[2].rows[0]) {
    //   lookups[2].rows.forEach((miner) => {
    //     if (miner.miner in balances) balances[miner.miner] += miner.balance;
    //     else balances[miner.miner] = miner.balance;
    //   });
    // }

    // Add Checks to Payments Table
    if (checks.length >= 1) {
      transaction.push(_this.master.current.payments.insertCurrentPaymentsMain(_this.pool, checks));
    }

    // Establish Separate Behavior
    transaction.push('COMMIT;');
    switch (blockType) {

    // Primary Behavior
    case 'primary':
      _this.master.executor(transaction, (results) => {
        
        if (results.length > 2) {
          results = results[1].rows.map((block) => block.round);
          const validated = blocks.filter((block) => results.includes((block || {}).round));

          // Blocks Exist to Send Payments
          if (validated.length >= 1) {
            _this.handlePrimary(validated, balances, (error) => {
              const updates = [(error) ?
                _this.text.databaseCommandsText2(JSON.stringify(error)) :
                _this.text.databaseUpdatesText4(blockType, validated.length)];
              _this.logger.debug('Payments', _this.config.name, updates);
              callback();
            });

          // No Blocks Exist to Send Payments
          } else {
            const updates = [_this.text.databaseUpdatesText5(blockType)];
            _this.logger.debug('Payments', _this.config.name, updates);
            callback();
          }

        // No Blocks Exist to Send Payments
        } else {
          const updates = [_this.text.databaseUpdatesText5(blockType)];
          _this.logger.debug('Payments', _this.config.name, updates);
            callback();
        }
      });
      break;

    // Auxiliary Behavior
    case 'auxiliary':
      _this.master.executor(transaction, (results) => {

        if (results.length > 2) {
          results = results[1].rows.map((block) => block.round);
          const blocks = lookups[1].rows.filter((block) => results.includes((block || {}).round));

          // Blocks Exist to Send Payments
          if (blocks.length >= 1) {
            _this.handleAuxiliary(blocks, balances, (error) => {
              const updates = [(error) ?
                _this.text.databaseCommandsText2(JSON.stringify(error)) :
                _this.text.databaseUpdatesText4(blockType, blocks.length)];
              _this.logger.debug('Payments', _this.config.name, updates);
              callback();
            });

          // No Blocks Exist to Send Payments
          } else {
            const updates = [_this.text.databaseUpdatesText5(blockType)];
            _this.logger.debug('Payments', _this.config.name, updates);
            callback();
          }
        
        // No Blocks Exist to Send Payments
        } else {
          const updates = [_this.text.databaseUpdatesText5(blockType)];
          _this.logger.debug('Payments', _this.config.name, updates);
            callback();
        }
      });
      break;

    // Default Behavior
    default:
      callback();
      break;
    }
  };

  // Handle Checks Updates
  this.handleChecks = function(lookups, blockType, callback) {

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Build Checks for Each Block
    const checks = [];
    if (lookups[1].rows[0]) {
      lookups[1].rows.forEach((block) => {
        checks.push({ timestamp: Date.now(), round: block.round, type: blockType });
      });
    }

    // Build Existing Miner Balances
    const balances = {};
    if (lookups[2].rows[0]) {
      lookups[2].rows.forEach((miner) => {
        if (miner.miner in balances) balances[miner.miner] += miner.balance;
        else balances[miner.miner] = miner.balance;
      });
    }

    // Add Checks to Transactions Table
    if (checks.length >= 1) {
      transaction.push(_this.master.current.transactions.insertCurrentTransactionsMain(_this.pool, checks));
    }

    // Establish Separate Behavior
    transaction.push('COMMIT;');
    switch (blockType) {

    // Primary Behavior
    case 'primary':
      _this.master.executor(transaction, (results) => {
        results = results[1].rows.map((block) => block.round);
        const blocks = lookups[1].rows.filter((block) => results.includes((block || {}).round));
        _this.handleRounds(blocks, balances, blockType, callback);
      });
      break;

    // Auxiliary Behavior
    case 'auxiliary':
      _this.master.executor(transaction, (results) => {
        results = results[1].rows.map((block) => block.round);
        const blocks = lookups[1].rows.filter((block) => results.includes((block || {}).round));
        _this.handleRounds(blocks, balances, blockType, callback);
      });
      break;

    // Default Behavior
    default:
      callback();
      break;
    }
  };

  // Handle Payments Updates
  this.handlePayments = function(blockType, callback) {

    // Handle Initial Logging
    const starting = [_this.text.databaseStartingText3(blockType)];
    _this.logger.debug('Payments', _this.config.name, starting);

    // Calculate Checks Features
    const roundsWindow = Date.now() - 2 * _this.config.settings.interval.payments - 2 * _this.config.primary.payments.windowPPLNT - 720000000;

    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.master.current.blocks.selectCurrentBlocksMain(_this.pool, { category: 'generate', type: blockType }),
      _this.master.current.miners.selectCurrentMinersMain(_this.pool, { balance: 'gt0', type: blockType }),
      _this.master.current.rounds.deleteCurrentRoundsInactiveShared(_this.pool, roundsWindow),
      'COMMIT;'];

    // Establish Separate Behavior
    _this.master.executor(transaction, (lookups) => {
      // _this.handleRounds(lookups, blockType, callback); // replace this line with bottom line
      _this.handleChecks(lookups, blockType, callback);
    });
  };

  // Start Payments Interval Management
  /* istanbul ignore next */
  this.handleInterval = function() {
    const interval = _this.config.settings.interval.payments;
    setTimeout(() => {
      _this.handleInterval();
      if (_this.config.primary.payments.enabled) _this.handlePayments('primary', () => {});
      if (_this.config.auxiliary && _this.config.auxiliary.enabled && _this.config.auxiliary.payments.enabled) {
        _this.handlePayments('auxiliary', () => {});
      }
    }, interval);
  };

  // Start Payments Capabilities
  /* istanbul ignore next */
  this.setupPayments = function(stratum, callback) {
    _this.stratum = stratum;
    const interval = _this.config.settings.interval.payments;
    const numForks = utils.countProcessForks(_this.configMain);
    const timing = parseFloat(_this.forkId) * interval / numForks;
    setTimeout(() => _this.handleInterval(), timing);
    callback();
  };
};

module.exports = Payments;
