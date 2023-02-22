const Text = require('../../locales/index');
const utils = require('./utils');

////////////////////////////////////////////////////////////////////////////////

// Main API Function
const Endpoints = function (logger, client, configMain) {

  const _this = this;
  this.logger = logger;
  this.client = client;
  this.configMain = configMain;
  this.text = Text[configMain.language];

  // API Variables
  this.executor = _this.client.commands.executor;
  this.current = _this.client.commands.current;
  this.historical = _this.client.commands.historical;

   // Handle Blocks Queries
   this.handleMigrateBlocks = function(pool, queries, callback) {
    commands = [
      ['smembers', `zone:blocks:primary:confirmed`],
      ['smembers', `zone:blocks:primary:kicked`]];

    _this.executeCommands(commands, (results) => {
      if (results[0] != null) {
        const output = [];
        const transaction = ['BEGIN;'];

        results[0].forEach(entry => {
          const block = JSON.parse(entry);

          let identifier;
          if (block.identifier) {
            switch (block.identifier) {
              case 'US':
                identifier = 'usa-east-1';
                break;
              case 'USW':
                identifier = 'usa-west';
                break;
              case 'AS':
                identifier = 'asia';
                break;
              case 'EU':
              default:
                identifier = 'europe-1';
                break;
            }
          } else {
            identifier = 'europe-1';
          }

          const node = block.nodeReward || 0;
          const founder = block.founderReward || 0;
          const reward = (block.reward - node - founder) / 100000000;

          const tempBlock = {
            timestamp: block.time,
            submitted: block.submitTime || block.time,
            miner: block.worker.split('.')[0],
            worker: block.worker,
            category: 'generate',
            confirmations: 102,
            difficulty: block.difficulty,
            hash: block.hash,
            height: block.height,
            identifier: identifier,
            luck: block.luck,
            reward: reward,
            round: block.round,
            solo: block.solo,
            transaction: block.transaction,
            type: 'primary',
          };

          const queries = [ tempBlock ]

          output.push(tempBlock);
          transaction.push(_this.historical.blocks.insertHistoricalBlocksMain(pool, queries));
        })

        results[1].forEach(entry => {
          const block = JSON.parse(entry);

          let identifier;
          if (block.identifier) {
            switch (block.identifier) {
              case 'US':
                identifier = 'usa-east-1';
                break;
              case 'USW':
                identifier = 'usa-west';
                break;
              case 'AS':
                identifier = 'asia';
                break;
              case 'EU':
              default:
                identifier = 'europe-1';
                break;
            }
          } else {
            identifier = 'europe-1';
          }

          const node = block.nodeReward || 0;
          const founder = block.founderReward || 0;
          const reward = (block.reward - node - founder) / 100000000;

          const tempBlock = {
            timestamp: block.time,
            submitted: block.submitTime || block.time,
            miner: block.worker.split('.')[0],
            worker: block.worker,
            category: 'orphan',
            confirmations: 102,
            difficulty: block.difficulty,
            hash: block.hash,
            height: block.height,
            identifier: identifier,
            luck: block.luck,
            reward: reward,
            round: block.round,
            solo: block.solo,
            transaction: block.transaction,
            type: 'primary',
          };

          const queries = [ tempBlock ]

          output.push(tempBlock);
          transaction.push(_this.historical.blocks.insertHistoricalBlocksMain(pool, queries));
        })

        transaction.push('COMMIT;');

        _this.executor(transaction, (lookups) => {
          callback(200, output);
        });

      } else {
        callback(400, 'Values were not retreived from the database');
      }
    });
  };

  // Handle Miner Migration
  this.handleMigrateMiners = function(pool, queries, callback) {
    commands = [
      ['hgetall', `zone:payments:primary:balances`],
      ['hgetall', `zone:payments:primary:paid`],
      ['hgetall', `zone:payments:primary:generate`],
      ['hgetall', `zone:payments:primary:immature`]
    ];

    _this.executeCommands(commands, (results) => {
      const output = {};
      const payments = [];
      const updates = [];
      let sourceBalances = 0;
      let sourcePaid = 0;
      let sourceGenerate = 0;
      let sourceImmature = 0;
      let targetBalances = 0;
      let targetPaid = 0;
      let targetGenerate = 0;
      let targetImmature = 0;
      const transaction = ['BEGIN;'];

      for (const [key, value] of Object.entries(results[0])) {
        sourceBalances += Number(value);
        const tempPayments = {
          timestamp: Date.now(),
          miner: key,
          balance: Number(value),
          paid: 0,
          type: 'primary'
        };
        payments.push(tempPayments);
      };
      output.sourceBalances = sourceBalances;

      for (const [key, value] of Object.entries(results[1])) {
        sourcePaid += Number(value);
        const miner = payments.find(el => el.miner == key);
        const idx = payments.indexOf(miner);

        if (idx > -1) {
          payments[idx].paid = Number(value);
        } else {
          const tempPayments = {
            timestamp: Date.now(),
            miner: key,
            balance: 0,
            paid: Number(value),
            type: 'primary'
          };
          payments.push(tempPayments);
        }
      };
      output.sourcePaid = sourcePaid;

      payments.forEach(miner => {
        targetBalances += miner.balance || 0;
        targetPaid += miner.paid || 0;
      });

      for (const [key, value] of Object.entries(results[2])) {
        sourceGenerate += Number(value);
        const tempUpdates = {
          timestamp: Date.now(),
          miner: key,
          generate: Number(value),
          immature: 0,
          type: 'primary'
        };
        updates.push(tempUpdates);
      };
      output.sourceGenerate = sourceGenerate;

      for (const [key, value] of Object.entries(results[3])) {
        sourceImmature += Number(value);
        const miner = updates.find(el => el.miner == key);
        const idx = updates.indexOf(miner);

        if (idx > -1) {
          updates[idx].immature = Number(value);
        } else {
          const tempUpdates = {
            timestamp: Date.now(),
            miner: key,
            generate: 0,
            immature: Number(value),
            type: 'primary'
          };
          updates.push(tempUpdates);
        }
      };
      output.sourcePaid = sourcePaid;

      updates.forEach(miner => {
        targetGenerate += miner.generate || 0;
        targetImmature += miner.immature || 0;
      });

      transaction.push(_this.current.miners.insertCurrentMinersPayments(pool, payments));
      transaction.push(_this.current.miners.insertCurrentMinersUpdates(pool, updates));        

      transaction.push('COMMIT;');

      output.balances = targetBalances - sourceBalances == 0 ? 'ok' : 'aaaaaa';
      output.paid = targetPaid - sourcePaid == 0 ? 'ok' : 'aaaaaa';
      output.immature = targetImmature - sourceImmature == 0 ? 'ok' : 'aaaaaa';
      output.generate = targetGenerate - sourceGenerate == 0 ? 'ok' : 'aaaaaa';

      _this.executor(transaction, (lookups) => {
        callback(200, output);
      });
    });
  };

  // Handle Transaction Migration
  this.handleMigrateTransactions = function(pool, queries, callback) {
    commands = [
      ['zrangebyscore', `zone:payments:primary:records`, `-inf`, `+inf`]
    ];

    _this.executeCommands(commands, (results) => {
      const output = {};
      const transactions = [];
      let sourcePaid = 0;
      let targetPaid = 0;
      const transaction = ['BEGIN;'];
      results[0].forEach(el => {
        const tx = JSON.parse(el);

        sourcePaid += tx.paid;
        const tempTransaction = {
          timestamp: tx.time,
          amount: tx.paid,
          transaction: tx.transaction,
          type: 'primary',
        };
        transactions.push(tempTransaction);
      });

      transactions.forEach(el => {
        targetPaid += el.amount;
      });

      output.sourcePaid = sourcePaid;
      output.targetPaid = targetPaid;

      transaction.push(_this.historical.transactions.insertHistoricalTransactionsMain(pool, transactions))
      transaction.push('COMMIT;');
      _this.executor(transaction, (lookups) => {
        callback(200, output);
      });
    });
  };

  // Handle Blocks Queries
  this.handleCurrentBlocks = function(pool, queries, callback) {

    // Validated Query Types
    const parameters = { limit: 'special', offset: 'special', order: 'special',
      direction: 'special', timestamp: 'number', submitted: 'number', miner: 'string',
      worker: 'string', category: 'string', confirmations: 'number', difficulty: 'number',
      hash: 'string', height: 'number', identifier: 'string', luck: 'number',
      reward: 'number', round: 'string', solo: 'boolean', transaction: 'string',
      type: 'string' };

    // Accepted Values for Parameters
    const validCategories = ['pending', 'immature', 'generate', 'orphan', 'confirmed'];
    const validDirection = ['ascending', 'descending'];
    const validOrder = ['timestamp', 'miner', 'worker', 'category', 'confirmations', 'difficulty',
      'hash', 'height', 'identifier', 'luck', 'reward', 'round', 'solo', 'transaction', 'type'];
    const validRound = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
    const validType = ['primary', 'auxiliary'];

    // General Parameter Validation
    for (let i = 0; i < Object.keys(queries).length; i++) {
      const query = Object.keys(queries)[i];
      if (!utils.handleValidation(queries[query], parameters[query])) {
        const expected = parameters[query] || 'unknown';
        callback(400, _this.text.websiteValidationText1(query, `<${ expected }>`));
        return;
      }
    }

    // Specific Parameter Validation
    if (queries.category && !validCategories.includes(queries.category)) {
      callback(400, _this.text.websiteValidationText1('category', validCategories.join(', ')));
      return;
    } else if (queries.direction && !validDirection.includes(queries.direction)) {
      callback(400, _this.text.websiteValidationText1('direction', validDirection.join(', ')));
      return;
    } else if (queries.limit && !Number(queries.limit)) {
      callback(400, _this.text.websiteValidationText1('limit', '<number>'));
      return;
    } else if (queries.offset && !Number(queries.offset)) {
      callback(400, _this.text.websiteValidationText1('offset', '<number>'));
      return;
    } else if (queries.order && !validOrder.includes(queries.order)) {
      callback(400, _this.text.websiteValidationText1('order', validOrder.join(', ')));
      return;
    } else if (queries.round && !validRound.test(queries.round)) {
      callback(400, _this.text.websiteValidationText1('round', '<uuid>'));
      return;
    } else if (queries.type && !validType.includes(queries.type)) {
      callback(400, _this.text.websiteValidationText1('type', validType.join(', ')));
      return;
    }

    // Make Request and Return Blocks Data
    const transaction = [_this.current.blocks.selectCurrentBlocksMain(pool, queries)];
    _this.executor(transaction, (lookups) => callback(200, lookups.rows));
  };

  // Handle Hashrate Queries
  this.handleCurrentHashrate = function(pool, queries, callback) {

    // Validated Query Types
    const parameters = { limit: 'special', offset: 'special', order: 'special',
      direction: 'special', timestamp: 'number', miner: 'string', worker: 'string',
      identifier: 'string', share: 'string', solo: 'boolean', type: 'string' };

    // Accepted Values for Parameters
    const validDirection = ['ascending', 'descending'];
    const validOrder = ['timestamp', 'miner', 'worker', 'solo', 'type', 'work'];
    const validShare = ['valid', 'invalid', 'stale'];
    const validType = ['primary', 'auxiliary'];

    // General Parameter Validation
    for (let i = 0; i < Object.keys(queries).length; i++) {
      const query = Object.keys(queries)[i];
      if (!utils.handleValidation(queries[query], parameters[query])) {
        const expected = parameters[query] || 'unknown';
        callback(400, _this.text.websiteValidationText1(query, `<${ expected }>`));
        return;
      }
    }

    // Specific Parameter Validation
    if (queries.direction && !validDirection.includes(queries.direction)) {
      callback(400, _this.text.websiteValidationText1('direction', validDirection.join(', ')));
      return;
    } else if (queries.limit && !Number(queries.limit)) {
      callback(400, _this.text.websiteValidationText1('limit', '<number>'));
      return;
    } else if (queries.offset && !Number(queries.offset)) {
      callback(400, _this.text.websiteValidationText1('offset', '<number>'));
      return;
    } else if (queries.order && !validOrder.includes(queries.order)) {
      callback(400, _this.text.websiteValidationText1('order', validOrder.join(', ')));
      return;
    } else if (queries.share && !validShare.includes(queries.share)) {
      callback(400, _this.text.websiteValidationText1('share', validShare.join(', ')));
      return;
    } else if (queries.type && !validType.includes(queries.type)) {
      callback(400, _this.text.websiteValidationText1('type', validType.join(', ')));
      return;
    }

    // Make Request and Return Hashrate Data
    const transaction = [_this.current.hashrate.selectCurrentHashrateMain(pool, queries)];
    _this.executor(transaction, (lookups) => callback(200, lookups.rows));
  };

  // Handle Metadata Queries
  this.handleCurrentMetadata = function(pool, queries, callback) {

    // Validated Query Types
    const parameters = { limit: 'special', offset: 'special', order: 'special',
      direction: 'special', timestamp: 'number', blocks: 'number', efficiency: 'number',
      effort: 'number', hashrate: 'number', invalid: 'number', miners: 'number',
      stale: 'number', type: 'string', valid: 'number', work: 'number',
      workers: 'number' };

    // Accepted Values for Parameters
    const validDirection = ['ascending', 'descending'];
    const validOrder = ['timestamp', 'blocks', 'efficiency', 'effort', 'hashrate', 'invalid', 'miners',
      'stale', 'type', 'valid', 'work', 'workers'];
    const validType = ['primary', 'auxiliary'];

    // General Parameter Validation
    for (let i = 0; i < Object.keys(queries).length; i++) {
      const query = Object.keys(queries)[i];
      if (!utils.handleValidation(queries[query], parameters[query])) {
        const expected = parameters[query] || 'unknown';
        callback(400, _this.text.websiteValidationText1(query, `<${ expected }>`));
        return;
      }
    }

    // Specific Parameter Validation
    if (queries.direction && !validDirection.includes(queries.direction)) {
      callback(400, _this.text.websiteValidationText1('direction', validDirection.join(', ')));
      return;
    } else if (queries.limit && !Number(queries.limit)) {
      callback(400, _this.text.websiteValidationText1('limit', '<number>'));
      return;
    } else if (queries.offset && !Number(queries.offset)) {
      callback(400, _this.text.websiteValidationText1('offset', '<number>'));
      return;
    } else if (queries.order && !validOrder.includes(queries.order)) {
      callback(400, _this.text.websiteValidationText1('order', validOrder.join(', ')));
      return;
    } else if (queries.type && !validType.includes(queries.type)) {
      callback(400, _this.text.websiteValidationText1('type', validType.join(', ')));
      return;
    }

    // Make Request and Return Metadata Data
    const transaction = [_this.current.metadata.selectCurrentMetadataMain(pool, queries)];
    _this.executor(transaction, (lookups) => callback(200, lookups.rows));
  };

  // Handle Miners Queries
  this.handleCurrentMiners = function(pool, queries, callback) {

    // Validated Query Types
    const parameters = { limit: 'special', offset: 'special', order: 'special',
      direction: 'special', timestamp: 'number', miner: 'string', balance: 'number',
      efficiency: 'number', effort: 'number', generate: 'number', hashrate: 'number',
      immature: 'number', invalid: 'number', paid: 'number', stale: 'number',
      type: 'string', valid: 'number' };

    // Accepted Values for Parameters
    const validDirection = ['ascending', 'descending'];
    const validOrder = ['timestamp', 'miner', 'balance', 'efficiency', 'effort', 'generate', 'hashrate',
      'immature', 'paid', 'type'];
    const validType = ['primary', 'auxiliary'];

    // General Parameter Validation
    for (let i = 0; i < Object.keys(queries).length; i++) {
      const query = Object.keys(queries)[i];
      if (!utils.handleValidation(queries[query], parameters[query])) {
        const expected = parameters[query] || 'unknown';
        callback(400, _this.text.websiteValidationText1(query, `<${ expected }>`));
        return;
      }
    }

    // Specific Parameter Validation
    if (queries.direction && !validDirection.includes(queries.direction)) {
      callback(400, _this.text.websiteValidationText1('direction', validDirection.join(', ')));
      return;
    } else if (queries.limit && !Number(queries.limit)) {
      callback(400, _this.text.websiteValidationText1('limit', '<number>'));
      return;
    } else if (queries.offset && !Number(queries.offset)) {
      callback(400, _this.text.websiteValidationText1('offset', '<number>'));
      return;
    } else if (queries.order && !validOrder.includes(queries.order)) {
      callback(400, _this.text.websiteValidationText1('order', validOrder.join(', ')));
      return;
    } else if (queries.type && !validType.includes(queries.type)) {
      callback(400, _this.text.websiteValidationText1('type', validType.join(', ')));
      return;
    }

    // Make Request and Return Miners Data
    const transaction = [_this.current.miners.selectCurrentMinersMain(pool, queries)];
    _this.executor(transaction, (lookups) => callback(200, lookups.rows));
  };

  // Handle Network Queries
  this.handleCurrentNetwork = function(pool, queries, callback) {

    // Validated Query Types
    const parameters = { limit: 'special', offset: 'special', order: 'special',
      direction: 'special', timestamp: 'number', difficulty: 'number', hashrate: 'number',
      height: 'number', type: 'string' };

    // Accepted Values for Parameters
    const validDirection = ['ascending', 'descending'];
    const validOrder = ['timestamp', 'difficulty', 'hashrate', 'height', 'type'];
    const validType = ['primary', 'auxiliary'];

    // General Parameter Validation
    for (let i = 0; i < Object.keys(queries).length; i++) {
      const query = Object.keys(queries)[i];
      if (!utils.handleValidation(queries[query], parameters[query])) {
        const expected = parameters[query] || 'unknown';
        callback(400, _this.text.websiteValidationText1(query, `<${ expected }>`));
        return;
      }
    }

    // Specific Parameter Validation
    if (queries.direction && !validDirection.includes(queries.direction)) {
      callback(400, _this.text.websiteValidationText1('direction', validDirection.join(', ')));
      return;
    } else if (queries.limit && !Number(queries.limit)) {
      callback(400, _this.text.websiteValidationText1('limit', '<number>'));
      return;
    } else if (queries.offset && !Number(queries.offset)) {
      callback(400, _this.text.websiteValidationText1('offset', '<number>'));
      return;
    } else if (queries.order && !validOrder.includes(queries.order)) {
      callback(400, _this.text.websiteValidationText1('order', validOrder.join(', ')));
      return;
    } else if (queries.type && !validType.includes(queries.type)) {
      callback(400, _this.text.websiteValidationText1('type', validType.join(', ')));
      return;
    }

    // Make Request and Return Network Data
    const transaction = [_this.current.network.selectCurrentNetworkMain(pool, queries)];
    _this.executor(transaction, (lookups) => callback(200, lookups.rows));
  };

  // Handle Payments Queries
  this.handleCurrentPayments = function(pool, queries, callback) {

    // Validated Query Types
    const parameters = { limit: 'special', offset: 'special', order: 'special',
      direction: 'special', timestamp: 'number', round: 'string', type: 'string' };

    // Accepted Values for Parameters
    const validDirection = ['ascending', 'descending'];
    const validOrder = ['timestamp', 'round', 'type'];
    const validRound = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
    const validType = ['primary', 'auxiliary'];

    // General Parameter Validation
    for (let i = 0; i < Object.keys(queries).length; i++) {
      const query = Object.keys(queries)[i];
      if (!utils.handleValidation(queries[query], parameters[query])) {
        const expected = parameters[query] || 'unknown';
        callback(400, _this.text.websiteValidationText1(query, `<${ expected }>`));
        return;
      }
    }

    // Specific Parameter Validation
    if (queries.direction && !validDirection.includes(queries.direction)) {
      callback(400, _this.text.websiteValidationText1('direction', validDirection.join(', ')));
      return;
    } else if (queries.limit && !Number(queries.limit)) {
      callback(400, _this.text.websiteValidationText1('limit', '<number>'));
      return;
    } else if (queries.offset && !Number(queries.offset)) {
      callback(400, _this.text.websiteValidationText1('offset', '<number>'));
      return;
    } else if (queries.order && !validOrder.includes(queries.order)) {
      callback(400, _this.text.websiteValidationText1('order', validOrder.join(', ')));
      return;
    } else if (queries.round && !validRound.test(queries.round)) {
      callback(400, _this.text.websiteValidationText1('round', '<uuid>'));
      return;
    } else if (queries.type && !validType.includes(queries.type)) {
      callback(400, _this.text.websiteValidationText1('type', validType.join(', ')));
      return;
    }

    // Make Request and Return Payments Data
    const transaction = [_this.current.payments.selectCurrentPaymentsMain(pool, queries)];
    _this.executor(transaction, (lookups) => callback(200, lookups.rows));
  };

  // Handle Rounds Queries
  this.handleCurrentRounds = function(pool, queries, callback) {

    // Validated Query Types
    const parameters = { limit: 'special', offset: 'special', order: 'special',
      direction: 'special', timestamp: 'number', miner: 'string', worker: 'string',
      identifier: 'string', invalid: 'number', round: 'string', solo: 'boolean',
      stale: 'number', times: 'number', type: 'string', valid: 'number',
      work: 'number' };

    // Accepted Values for Parameters
    const validDirection = ['ascending', 'descending'];
    const validOrder = ['timestamp', 'miner', 'worker', 'identifier', 'invalid', 'round', 'solo',
      'stale', 'times', 'type', 'valid', 'work'];
    const validRound = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
    const validType = ['primary', 'auxiliary'];

    // General Parameter Validation
    for (let i = 0; i < Object.keys(queries).length; i++) {
      const query = Object.keys(queries)[i];
      if (!utils.handleValidation(queries[query], parameters[query])) {
        const expected = parameters[query] || 'unknown';
        callback(400, _this.text.websiteValidationText1(query, `<${ expected }>`));
        return;
      }
    }

    // Specific Parameter Validation
    if (queries.direction && !validDirection.includes(queries.direction)) {
      callback(400, _this.text.websiteValidationText1('direction', validDirection.join(', ')));
      return;
    } else if (queries.limit && !Number(queries.limit)) {
      callback(400, _this.text.websiteValidationText1('limit', '<number>'));
      return;
    } else if (queries.offset && !Number(queries.offset)) {
      callback(400, _this.text.websiteValidationText1('offset', '<number>'));
      return;
    } else if (queries.order && !validOrder.includes(queries.order)) {
      callback(400, _this.text.websiteValidationText1('order', validOrder.join(', ')));
      return;
    } else if (queries.round && (queries.round !== 'current' && !validRound.test(queries.round))) {
      callback(400, _this.text.websiteValidationText1('round', 'current, <uuid>'));
      return;
    } else if (queries.type && !validType.includes(queries.type)) {
      callback(400, _this.text.websiteValidationText1('type', validType.join(', ')));
      return;
    }

    // Make Request and Return Rounds Data
    const transaction = [_this.current.rounds.selectCurrentRoundsMain(pool, queries)];
    _this.executor(transaction, (lookups) => callback(200, lookups.rows));
  };

  // Handle Transactions Queries
  this.handleCurrentTransactions = function(pool, queries, callback) {

    // Validated Query Types
    const parameters = { limit: 'special', offset: 'special', order: 'special',
      direction: 'special', timestamp: 'number', round: 'string', type: 'string' };

    // Accepted Values for Parameters
    const validDirection = ['ascending', 'descending'];
    const validOrder = ['timestamp', 'round', 'type'];
    const validRound = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
    const validType = ['primary', 'auxiliary'];

    // General Parameter Validation
    for (let i = 0; i < Object.keys(queries).length; i++) {
      const query = Object.keys(queries)[i];
      if (!utils.handleValidation(queries[query], parameters[query])) {
        const expected = parameters[query] || 'unknown';
        callback(400, _this.text.websiteValidationText1(query, `<${ expected }>`));
        return;
      }
    }

    // Specific Parameter Validation
    if (queries.direction && !validDirection.includes(queries.direction)) {
      callback(400, _this.text.websiteValidationText1('direction', validDirection.join(', ')));
      return;
    } else if (queries.limit && !Number(queries.limit)) {
      callback(400, _this.text.websiteValidationText1('limit', '<number>'));
      return;
    } else if (queries.offset && !Number(queries.offset)) {
      callback(400, _this.text.websiteValidationText1('offset', '<number>'));
      return;
    } else if (queries.order && !validOrder.includes(queries.order)) {
      callback(400, _this.text.websiteValidationText1('order', validOrder.join(', ')));
      return;
    } else if (queries.round && !validRound.test(queries.round)) {
      callback(400, _this.text.websiteValidationText1('round', '<uuid>'));
      return;
    } else if (queries.type && !validType.includes(queries.type)) {
      callback(400, _this.text.websiteValidationText1('type', validType.join(', ')));
      return;
    }

    // Make Request and Return Transactions Data
    const transaction = [_this.current.transactions.selectCurrentTransactionsMain(pool, queries)];
    _this.executor(transaction, (lookups) => callback(200, lookups.rows));
  };

  // Handle Workers Queries
  this.handleCurrentWorkers = function(pool, queries, callback) {

    // Validated Query Types
    const parameters = { limit: 'special', offset: 'special', order: 'special',
      direction: 'special', timestamp: 'number', miner: 'string', worker: 'string',
      efficiency: 'number', effort: 'number', hashrate: 'number', invalid: 'number',
      solo: 'boolean', stale: 'number', type: 'string', valid: 'number' };

    // Accepted Values for Parameters
    const validDirection = ['ascending', 'descending'];
    const validOrder = ['timestamp', 'miner', 'worker', 'efficiency', 'effort', 'hashrate', 'type'];
    const validType = ['primary', 'auxiliary'];

    // General Parameter Validation
    for (let i = 0; i < Object.keys(queries).length; i++) {
      const query = Object.keys(queries)[i];
      if (!utils.handleValidation(queries[query], parameters[query])) {
        const expected = parameters[query] || 'unknown';
        callback(400, _this.text.websiteValidationText1(query, `<${ expected }>`));
        return;
      }
    }

    // Specific Parameter Validation
    if (queries.direction && !validDirection.includes(queries.direction)) {
      callback(400, _this.text.websiteValidationText1('direction', validDirection.join(', ')));
      return;
    } else if (queries.limit && !Number(queries.limit)) {
      callback(400, _this.text.websiteValidationText1('limit', '<number>'));
      return;
    } else if (queries.offset && !Number(queries.offset)) {
      callback(400, _this.text.websiteValidationText1('offset', '<number>'));
      return;
    } else if (queries.order && !validOrder.includes(queries.order)) {
      callback(400, _this.text.websiteValidationText1('order', validOrder.join(', ')));
      return;
    } else if (queries.type && !validType.includes(queries.type)) {
      callback(400, _this.text.websiteValidationText1('type', validType.join(', ')));
      return;
    }

    // Make Request and Return Workers Data
    const transaction = [_this.current.workers.selectCurrentWorkersMain(pool, queries)];
    _this.executor(transaction, (lookups) => callback(200, lookups.rows));
  };

  // Handle Blocks Queries
  this.handleHistoricalBlocks = function(pool, queries, callback) {

    // Validated Query Types
    const parameters = { limit: 'special', offset: 'special', order: 'special',
      direction: 'special', submitted: 'number', timestamp: 'number', miner: 'string',
      worker: 'string', category: 'string', confirmations: 'number', difficulty: 'number',
      hash: 'string', height: 'number', identifier: 'string', luck: 'number',
      reward: 'number', round: 'string', solo: 'boolean', transaction: 'string',
      type: 'string' };

    // Accepted Values for Parameters
    const validCategories = ['pending', 'immature', 'generate', 'orphan', 'confirmed'];
    const validDirection = ['ascending', 'descending'];
    const validOrder = ['timestamp', 'miner', 'worker', 'category', 'confirmations', 'difficulty',
      'hash', 'height', 'identifier', 'luck', 'reward', 'round', 'solo', 'transaction', 'type'];
    const validRound = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
    const validType = ['primary', 'auxiliary'];

    // General Parameter Validation
    for (let i = 0; i < Object.keys(queries).length; i++) {
      const query = Object.keys(queries)[i];
      if (!utils.handleValidation(queries[query], parameters[query])) {
        const expected = parameters[query] || 'unknown';
        callback(400, _this.text.websiteValidationText1(query, `<${ expected }>`));
        return;
      }
    }

    // Specific Parameter Validation
    if (queries.category && !validCategories.includes(queries.category)) {
      callback(400, _this.text.websiteValidationText1('category', validCategories.join(', ')));
      return;
    } else if (queries.direction && !validDirection.includes(queries.direction)) {
      callback(400, _this.text.websiteValidationText1('direction', validDirection.join(', ')));
      return;
    } else if (queries.limit && !Number(queries.limit)) {
      callback(400, _this.text.websiteValidationText1('limit', '<number>'));
      return;
    } else if (queries.offset && !Number(queries.offset)) {
      callback(400, _this.text.websiteValidationText1('offset', '<number>'));
      return;
    } else if (queries.order && !validOrder.includes(queries.order)) {
      callback(400, _this.text.websiteValidationText1('order', validOrder.join(', ')));
      return;
    } else if (queries.round && !validRound.test(queries.round)) {
      callback(400, _this.text.websiteValidationText1('round', '<uuid>'));
      return;
    } else if (queries.type && !validType.includes(queries.type)) {
      callback(400, _this.text.websiteValidationText1('type', validType.join(', ')));
      return;
    }

    // Make Request and Return Blocks Data
    const transaction = [_this.historical.blocks.selectHistoricalBlocksMain(pool, queries)];
    _this.executor(transaction, (lookups) => callback(200, lookups.rows));
  };

  // Handle Payments Queries
  this.handleHistoricalPayments = function(pool, queries, callback) {

    // Validated Query Types
    const parameters = { limit: 'special', offset: 'special', order: 'special',
      direction: 'special', timestamp: 'number', miner: 'string', amount: 'number',
      transaction: 'string', type: 'string' };

    // Accepted Values for Parameters
    const validDirection = ['ascending', 'descending'];
    const validOrder = ['timestamp', 'miner', 'amount', 'transaction', 'type'];
    const validType = ['primary', 'auxiliary'];

    // General Parameter Validation
    for (let i = 0; i < Object.keys(queries).length; i++) {
      const query = Object.keys(queries)[i];
      if (!utils.handleValidation(queries[query], parameters[query])) {
        const expected = parameters[query] || 'unknown';
        callback(400, _this.text.websiteValidationText1(query, `<${ expected }>`));
        return;
      }
    }

    // Specific Parameter Validation
    if (queries.direction && !validDirection.includes(queries.direction)) {
      callback(400, _this.text.websiteValidationText1('direction', validDirection.join(', ')));
      return;
    } else if (queries.limit && !Number(queries.limit)) {
      callback(400, _this.text.websiteValidationText1('limit', '<number>'));
      return;
    } else if (queries.offset && !Number(queries.offset)) {
      callback(400, _this.text.websiteValidationText1('offset', '<number>'));
      return;
    } else if (queries.order && !validOrder.includes(queries.order)) {
      callback(400, _this.text.websiteValidationText1('order', validOrder.join(', ')));
      return;
    } else if (queries.type && !validType.includes(queries.type)) {
      callback(400, _this.text.websiteValidationText1('type', validType.join(', ')));
      return;
    }

    // Make Request and Return Payments Data
    const transaction = [_this.historical.payments.selectHistoricalPaymentsMain(pool, queries)];
    _this.executor(transaction, (lookups) => callback(200, lookups.rows));
  };

  // Handle Rounds Queries
  this.handleHistoricalRounds = function(pool, queries, callback) {

    // Validated Query Types
    const parameters = { limit: 'special', offset: 'special', order: 'special',
      direction: 'special', timestamp: 'number', miner: 'string', worker: 'string',
      identifier: 'string', invalid: 'number', round: 'string', solo: 'boolean',
      stale: 'number', times: 'number', type: 'string', valid: 'number', work: 'number' };

    // Accepted Values for Parameters
    const validDirection = ['ascending', 'descending'];
    const validOrder = ['timestamp', 'miner', 'worker', 'identifier', 'invalid', 'round', 'solo',
      'stale', 'times', 'type', 'valid', 'work'];
    const validRound = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
    const validType = ['primary', 'auxiliary'];

    // General Parameter Validation
    for (let i = 0; i < Object.keys(queries).length; i++) {
      const query = Object.keys(queries)[i];
      if (!utils.handleValidation(queries[query], parameters[query])) {
        const expected = parameters[query] || 'unknown';
        callback(400, _this.text.websiteValidationText1(query, `<${ expected }>`));
        return;
      }
    }

    // Specific Parameter Validation
    if (queries.direction && !validDirection.includes(queries.direction)) {
      callback(400, _this.text.websiteValidationText1('direction', validDirection.join(', ')));
      return;
    } else if (queries.limit && !Number(queries.limit)) {
      callback(400, _this.text.websiteValidationText1('limit', '<number>'));
      return;
    } else if (queries.offset && !Number(queries.offset)) {
      callback(400, _this.text.websiteValidationText1('offset', '<number>'));
      return;
    } else if (queries.order && !validOrder.includes(queries.order)) {
      callback(400, _this.text.websiteValidationText1('order', validOrder.join(', ')));
      return;
    } else if (queries.round && (!validRound.test(queries.round))) {
      callback(400, _this.text.websiteValidationText1('round', '<uuid>'));
      return;
    } else if (queries.type && !validType.includes(queries.type)) {
      callback(400, _this.text.websiteValidationText1('type', validType.join(', ')));
      return;
    }

    // Make Request and Return Rounds Data
    const transaction = [_this.historical.rounds.selectHistoricalRoundsMain(pool, queries)];
    _this.executor(transaction, (lookups) => callback(200, lookups.rows));
  };

  // Handle Transactions Queries
  this.handleHistoricalTransactions = function(pool, queries, callback) {

    // Validated Query Types
    const parameters = { limit: 'special', offset: 'special', order: 'special',
      direction: 'special', timestamp: 'number', amount: 'number', transaction: 'string',
      type: 'string' };

    // Accepted Values for Parameters
    const validDirection = ['ascending', 'descending'];
    const validOrder = ['timestamp', 'amount', 'transaction', 'type'];
    const validType = ['primary', 'auxiliary'];

    // General Parameter Validation
    for (let i = 0; i < Object.keys(queries).length; i++) {
      const query = Object.keys(queries)[i];
      if (!utils.handleValidation(queries[query], parameters[query])) {
        const expected = parameters[query] || 'unknown';
        callback(400, _this.text.websiteValidationText1(query, `<${ expected }>`));
        return;
      }
    }

    // Specific Parameter Validation
    if (queries.direction && !validDirection.includes(queries.direction)) {
      callback(400, _this.text.websiteValidationText1('direction', validDirection.join(', ')));
      return;
    } else if (queries.limit && !Number(queries.limit)) {
      callback(400, _this.text.websiteValidationText1('limit', '<number>'));
      return;
    } else if (queries.offset && !Number(queries.offset)) {
      callback(400, _this.text.websiteValidationText1('offset', '<number>'));
      return;
    } else if (queries.order && !validOrder.includes(queries.order)) {
      callback(400, _this.text.websiteValidationText1('order', validOrder.join(', ')));
      return;
    } else if (queries.type && !validType.includes(queries.type)) {
      callback(400, _this.text.websiteValidationText1('type', validType.join(', ')));
      return;
    }

    // Make Request and Return Transactions Data
    const transaction = [_this.historical.transactions.selectHistoricalTransactionsMain(pool, queries)];
    _this.executor(transaction, (lookups) => callback(200, lookups.rows));
  };

  // Handle Blocks Queries
  this.handleCombinedBlocks = function(pool, queries, callback) {

    // Validated Query Types
    const parameters = { limit: 'special', offset: 'special', order: 'special',
      direction: 'special', timestamp: 'number', submitted: 'number', miner: 'string',
      worker: 'string', category: 'string', confirmations: 'number', difficulty: 'number',
      hash: 'string', height: 'number', identifier: 'string', luck: 'number',
      reward: 'number', round: 'string', solo: 'boolean', transaction: 'string',
      type: 'string' };

    // Accepted Values for Parameters
    const validCategories = ['pending', 'immature', 'generate', 'orphan', 'confirmed'];
    const validDirection = ['ascending', 'descending'];
    const validOrder = ['timestamp', 'miner', 'worker', 'category', 'confirmations', 'difficulty',
      'hash', 'height', 'identifier', 'luck', 'reward', 'round', 'solo', 'transaction', 'type'];
    const validRound = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
    const validType = ['primary', 'auxiliary'];

    // General Parameter Validation
    for (let i = 0; i < Object.keys(queries).length; i++) {
      const query = Object.keys(queries)[i];
      if (!utils.handleValidation(queries[query], parameters[query])) {
        const expected = parameters[query] || 'unknown';
        callback(400, _this.text.websiteValidationText1(query, `<${ expected }>`));
        return;
      }
    }

    // Specific Parameter Validation
    if (queries.category && !validCategories.includes(queries.category)) {
      callback(400, _this.text.websiteValidationText1('category', validCategories.join(', ')));
      return;
    } else if (queries.direction && !validDirection.includes(queries.direction)) {
      callback(400, _this.text.websiteValidationText1('direction', validDirection.join(', ')));
      return;
    } else if (queries.limit && !Number(queries.limit)) {
      callback(400, _this.text.websiteValidationText1('limit', '<number>'));
      return;
    } else if (queries.offset && !Number(queries.offset)) {
      callback(400, _this.text.websiteValidationText1('offset', '<number>'));
      return;
    } else if (queries.order && !validOrder.includes(queries.order)) {
      callback(400, _this.text.websiteValidationText1('order', validOrder.join(', ')));
      return;
    } else if (queries.round && !validRound.test(queries.round)) {
      callback(400, _this.text.websiteValidationText1('round', '<uuid>'));
      return;
    } else if (queries.type && !validType.includes(queries.type)) {
      callback(400, _this.text.websiteValidationText1('type', validType.join(', ')));
      return;
    }

    // Make Request and Return Blocks Data
    const transaction = [
      _this.current.blocks.selectCurrentBlocksMain(pool, queries),
      _this.historical.blocks.selectHistoricalBlocksMain(pool, queries)];
    _this.executor(transaction, (lookups) => {
      callback(200, lookups.map((data, idx) => {
        const partition = idx === 0 ? 'current' : 'historical';
        return data.rows.map((obj) => ({ ...obj, partition: partition }));
      }).flat(1));
    });
  };

  // Handle Rounds Queries
  this.handleCombinedRounds = function(pool, queries, callback) {

    // Validated Query Types
    const parameters = { limit: 'special', offset: 'special', order: 'special',
      direction: 'special', timestamp: 'number', miner: 'string', worker: 'string',
      identifier: 'string', invalid: 'number', round: 'string', solo: 'boolean',
      stale: 'number', times: 'number', type: 'string', valid: 'number',
      work: 'number' };

    // Accepted Values for Parameters
    const validDirection = ['ascending', 'descending'];
    const validOrder = ['timestamp', 'miner', 'worker', 'identifier', 'invalid', 'round', 'solo',
      'stale', 'times', 'type', 'valid', 'work'];
    const validRound = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
    const validType = ['primary', 'auxiliary'];

    // General Parameter Validation
    for (let i = 0; i < Object.keys(queries).length; i++) {
      const query = Object.keys(queries)[i];
      if (!utils.handleValidation(queries[query], parameters[query])) {
        const expected = parameters[query] || 'unknown';
        callback(400, _this.text.websiteValidationText1(query, `<${ expected }>`));
        return;
      }
    }

    // Specific Parameter Validation
    if (queries.direction && !validDirection.includes(queries.direction)) {
      callback(400, _this.text.websiteValidationText1('direction', validDirection.join(', ')));
      return;
    } else if (queries.limit && !Number(queries.limit)) {
      callback(400, _this.text.websiteValidationText1('limit', '<number>'));
      return;
    } else if (queries.offset && !Number(queries.offset)) {
      callback(400, _this.text.websiteValidationText1('offset', '<number>'));
      return;
    } else if (queries.order && !validOrder.includes(queries.order)) {
      callback(400, _this.text.websiteValidationText1('order', validOrder.join(', ')));
      return;
    } else if (queries.round && (queries.round !== 'current' && !validRound.test(queries.round))) {
      callback(400, _this.text.websiteValidationText1('round', 'current, <uuid>'));
      return;
    } else if (queries.type && !validType.includes(queries.type)) {
      callback(400, _this.text.websiteValidationText1('type', validType.join(', ')));
      return;
    }

    // Make Request and Return Rounds Data
    const transaction = [
      _this.current.rounds.selectCurrentRoundsMain(pool, queries),
      _this.historical.rounds.selectHistoricalRoundsMain(pool, queries)];
    _this.executor(transaction, (lookups) => {
      callback(200, lookups.map((data, idx) => {
        const partition = idx === 0 ? 'current' : 'historical';
        return data.rows.map((obj) => ({ ...obj, partition: partition }));
      }).flat(1));
    });
  };
};

module.exports = Endpoints;
