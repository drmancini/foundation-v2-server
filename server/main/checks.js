const Text = require('../../locales/index');

////////////////////////////////////////////////////////////////////////////////

// Main Checks Function
const Checks = function (logger, client, config, configMain) {

  const _this = this;
  this.logger = logger;
  this.client = client;
  this.config = config;
  this.configMain = configMain;
  this.pool = config.name;
  this.text = Text[configMain.language];

  // Database Variables
  this.executor = _this.client.commands.executor;
  this.current = _this.client.commands.current;
  this.historical = _this.client.commands.historical;

  // Handle Blocks Updates
  this.handleCurrentBlocks = function(blocks) {

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

  // Handle Miners Updates
  this.handleCurrentMiners = function(miners) {

    // Return Miners Updates
    return Object.keys(miners).map((address) => {
      return {
        timestamp: Date.now(),
        miner: address,
        generate: miners[address].generate,
        immature: miners[address].immature,
        type: 'primary',
      };
    });
  };

  // Handle Round Failure Updates
  this.handleFailures = function(blocks, callback) {

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Remove Finished Transactions from Table
    const transactionsDelete = blocks.map((block) => `'${ block.round }'`);
    transaction.push(_this.current.transactions.deleteCurrentTransactionsMain(
      _this.pool, transactionsDelete));

    // Insert Work into Database
    transaction.push('COMMIT;');
    _this.executor(transaction, () => callback());
  };

  // Handle Round Reset Updates
  this.handleReset = function(callback) {

    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.current.miners.insertCurrentMinersReset(_this.pool, 'primary'),
      'COMMIT;'];

    // Insert Work into Database
    _this.executor(transaction, () => callback());
  };

  // Handle Round Success Updates
  this.handleUpdates = function(blocks, payments, callback) {

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Handle Block Categories Individually
    const orphanBlocks = blocks.filter((block) => block.category === 'orphan');
    const immatureBlocks = blocks.filter((block) => block.category === 'immature');
    const generateBlocks = blocks.filter((block) => block.category === 'generate');

    // Handle Orphan Block Delete Updates
    const orphanBlocksDelete = orphanBlocks.map((block) => `'${ block.round }'`);
    if (orphanBlocksDelete.length >= 1) {
      transaction.push(_this.current.blocks.deleteCurrentBlocksMain(
        _this.pool, orphanBlocksDelete));
    }

    // Handle Immature Block Updates
    const immatureBlocksUpdates = _this.handleCurrentBlocks(immatureBlocks);
    if (immatureBlocksUpdates.length >= 1) {
      transaction.push(_this.current.blocks.insertCurrentBlocksMain(
        _this.pool, immatureBlocksUpdates));
    }

    // Handle Generate Block Updates
    const generateBlocksUpdates = _this.handleCurrentBlocks(generateBlocks);
    if (generateBlocksUpdates.length >= 1) {
      transaction.push(_this.current.blocks.insertCurrentBlocksMain(
        _this.pool, generateBlocksUpdates));
    }

    // Handle Miner Payment Updates
    const minersUpdates = _this.handleCurrentMiners(payments);
    if (minersUpdates.length >= 1) {
      transaction.push(_this.current.miners.insertCurrentMinersUpdates(
        _this.pool, minersUpdates));
    }

    // Handle Historical Orphan Block Updates
    const orphanBlocksUpdates = _this.handleCurrentBlocks(orphanBlocks);
    if (orphanBlocksUpdates.length >= 1) {
      transaction.push(_this.historical.blocks.insertHistoricalBlocksMain(
        _this.pool, orphanBlocksUpdates));
    }

    // Insert Work into Database
    transaction.push('COMMIT;');
    _this.executor(transaction, () => callback());
  };

  // Handle Primary Updates
  this.handlePrimary = function(blocks, callback) {

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Add Round Lookups to Transaction
    blocks.forEach((block) => {
      const parameters = { solo: block.solo, type: 'primary' };
      if (parameters.solo) {
        parameters.round = block.round;
      } else {
        const roundCutoff = block.submitted - _this.config.settings.window.pplnt;
        parameters.recent = 'bwgt' + roundCutoff + '|le' + block.submitted;
      }
      transaction.push(_this.current.rounds.selectCurrentRoundsMain(
        _this.pool, parameters));
    });

    // Determine Workers for Rounds
    transaction.push('COMMIT;');

    _this.executor(transaction, (results) => {
      const rounds = results.slice(1, -1).map((round) => round.rows);
      // Collect Round/Worker Data and Amounts
      _this.stratum.stratum.handlePrimaryRounds(blocks, (error, updates) => {
        if (error) _this.handleFailures(blocks, () => callback(error));
        else _this.stratum.stratum.handlePrimaryWorkers(blocks, rounds, (results) => {
          _this.handleUpdates(updates, results, () => callback(null));
        });
      });
    });
  };

  // Handle Payment Updates
  this.handleRounds = function(lookups, callback) {

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Build Checks for Each Block
    const checks = [];
    let firstBlock = Date.now();
    if (lookups[1].rows[0]) {
      lookups[1].rows.forEach((block) => {
        if (block.submitted < firstBlock) {
          firstBlock = block.submitted;
        }
        checks.push({ timestamp: Date.now(), round: block.round, type: 'primary' });
      });
    }

    // Add Checks to Transactions Table
    if (checks.length >= 1) {
      transaction.push(_this.current.transactions.insertCurrentTransactionsMain(_this.pool, checks));
    }

    // Delete Old Rounds
    const roundsWindow = firstBlock - _this.config.settings.window.pplnt; 
    transaction.push(_this.current.rounds.deleteCurrentRounds(_this.pool, roundsWindow)); 

    // Establish Separate Behavior
    transaction.push('COMMIT;');
    
    _this.executor(transaction, (results) => {
      results = results[1].rows.map((block) => block.round);
      const blocks = lookups[1].rows.filter((block) => results.includes((block || {}).round));

      // Blocks Exist to Validate
      if (blocks.length >= 1) {
        _this.handlePrimary(blocks, (error) => {
          const updates = [(error) ?
            _this.text.databaseCommandsText2(JSON.stringify(error)) :
            _this.text.databaseUpdatesText2(blocks.length)];
          _this.logger.debug('Checks', _this.config.name, updates);
          callback();
        });

      // No Blocks Exist to Validate
      } else {
        _this.handleReset(() => {
          const updates = [_this.text.databaseUpdatesText3()];
          _this.logger.debug('Checks', _this.config.name, updates);
          callback();
        });
      }
    });
  };

  // Handle Checks Updates
  this.handleChecks = function(callback) {

    // Handle Initial Logging
    const starting = [_this.text.databaseStartingText2()];
    _this.logger.debug('Checks', _this.config.name, starting);

    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.current.blocks.selectCurrentBlocksMain(_this.pool, { type: 'primary' }),
      'COMMIT;'];

    // Establish Separate Behavior
    _this.executor(transaction, (lookups) => {
      _this.handleRounds(lookups, callback);
    });
  };

  // Start Checks Interval Management
  /* istanbul ignore next */
  this.handleInterval = function() {
    const minInterval = _this.config.settings.interval.checks * 0.75;
    const maxInterval = _this.config.settings.interval.checks * 1.25;
    const random = Math.floor(Math.random() * (maxInterval - minInterval) + minInterval);
    setTimeout(() => {
      _this.handleInterval();
      if (_this.config.primary.checks.enabled) _this.handleChecks(() => {});
    }, random);
  };

  // Start Checks Capabilities
  /* istanbul ignore next */
  this.setupChecks = function(stratum, callback) {
    _this.stratum = stratum;
    _this.handleInterval();
    callback();
  };
};

module.exports = Checks;
