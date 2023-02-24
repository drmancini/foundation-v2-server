const Text = require('../../locales/index');
const utils = require('./utils');

////////////////////////////////////////////////////////////////////////////////

// Main Statistics Function
const Statistics = function (logger, client, config, configMain, template) {

  const _this = this;
  this.logger = logger;
  this.client = client;
  this.config = config;
  this.configMain = configMain;
  this.pool = config.name;
  this.template = template;
  this.text = Text[configMain.language];

  // Database Variables
  this.executor = _this.client.commands.executor;
  this.current = _this.client.commands.current;
  this.historical = _this.client.commands.historical;

  // Handle Efficiency Updates
  this.handleEfficiency = function(data) {
    const valid = (data.valid || 0);
    const total = (data.valid || 0) + (data.stale || 0) + (data.invalid || 0);
    return utils.roundTo(valid / total * 100, 2) || 0;
  };

  // Handle Current Metadata Updates
  this.handleCurrentMetadata = function(miners, workers, total, blockType, minerType) {
// console.log(miners, workers, total)
    // Calculate Features of Metadata
    const algorithm = _this.config.primary.coin.algorithm || 'sha256d';
    const multiplier = Math.pow(2, 32) / _this.template.algorithms[algorithm].multiplier;
    const section = _this.config.settings.window.hashrate;
    const hashrate = utils.roundTo((multiplier * total * 1000) / section, 4);

    // Return Metadata Updates
    return {
      timestamp: Date.now(),
      hashrate: hashrate,
      identifier: 'a',
      miners: miners,
      solo: minerType,
      type: blockType,
      workers: workers,
    };
  };

  // Handle Current Miners Updates
  this.handleCurrentMiners = function(work, miners, blockType) {

    // Calculate Features of Miners
    const timestamp = Date.now();
    const algorithm = _this.config.primary.coin.algorithm || 'sha256d';
    const multiplier = Math.pow(2, 32) / _this.template.algorithms[algorithm].multiplier;
    const section = _this.config.settings.window.hashrate;

    // Return Miners Updates
    return miners.map((miner) => {
      const efficiency = _this.handleEfficiency(miner);
      const filtered = work.filter((share) => share.miner === miner.miner);
      const minerHash = filtered[0] || { current_work: 0 };
      const hashrate = utils.roundTo((multiplier * minerHash.current_work * 1000) / section, 4);

      return {
        timestamp: timestamp,
        miner: miner.miner,
        efficiency: efficiency,
        hashrate: hashrate,
        type: blockType,
      };
    });
  };

  // Handle Workers Updates
  this.handleCurrentWorkers = function(work, workers, blockType) {

    // Calculate Features of Workers
    const timestamp = Date.now();
    const algorithm = _this.config.primary.coin.algorithm || 'sha256d';
    const multiplier = Math.pow(2, 32) / _this.template.algorithms[algorithm].multiplier;
    const section = _this.config.settings.window.hashrate;

    // Return Workers Updates
    return workers.map((worker) => {
      const efficiency = _this.handleEfficiency(worker);
      const filtered = work.filter((share) => share.worker === worker.worker);
      const workerHash = filtered[0] || { current_work: 0 };
      const hashrate = utils.roundTo((multiplier * workerHash.current_work * 1000) / section, 4);
      return {
        timestamp: timestamp,
        miner: (worker.worker || '').split('.')[0],
        worker: worker.worker,
        efficiency: efficiency,
        hashrate: hashrate,
        solo: worker.solo,
        type: blockType,
      };
    });
  };

  // Handle Hashrate Reset for Inactive Workers 
  this.handleCurrentWorkersHashrateReset = function(workers, blockType) {

    // Calculate Features of Workers
    const timestamp = Date.now();
    const oneDay = 24 * 3600000;

    // Return Workers Updates
    return workers.filter(worker => (timestamp - worker.last_share) > oneDay)
      .map(worker => {
        return {
          timestamp: timestamp, 
          miner: worker.miner,
          worker: worker.worker,
          hashrate_12h: 0,
          hashrate_24h: 0,
          solo: worker.solo,
          type: blockType,
        };
      });
  };

  // Handle Historical Miners Updates
  this.handleHistoricalMinersHashrate = function(miners) {

    // Calculate Features of Miners
    const timestamp = Date.now();
    const tenMinutes = 600000;
    const snapshot = Math.floor(timestamp / tenMinutes) * tenMinutes;
    const algorithm = _this.config.primary.coin.algorithm || 'sha256d';
    const multiplier = Math.pow(2, 32) / _this.template.algorithms[algorithm].multiplier;

    // Return Miners Updates
    return miners.map((miner) => {
      const section = miner.recent == snapshot ? tenMinutes : timestamp - snapshot;
      const hashrate = utils.roundTo((multiplier * miner.work * 1000) / section, 4);
      return {
        timestamp: timestamp,
        recent: miner.recent,
        miner: miner.miner,
        hashrate: hashrate,
        solo: miner.solo,
        type: miner.type,
      };
    });
  };

  // Handle Historical Metadata Updates
  this.handleHistoricalMetadata = function(updates) {

    const timestamp = Date.now();
    const interval = _this.config.settings.interval.historical;
    const recent = Math.ceil(timestamp / interval) * interval;
    
    // Return Metadata Updates
    return {
      timestamp: timestamp,
      recent: recent,
      hashrate: updates.hashrate,
      miners: updates.miners,
      solo: updates.solo,
      type: updates.type,
      workers: updates.workers,
    };
  };

  // Handle Historical Network Updates
  this.handleHistoricalNetwork = function(network) {

    // Calculate Features of Network
    const timestamp = Date.now();
    const interval = _this.config.settings.interval.historical;
    const recent = Math.round(timestamp / interval) * interval;

    // Return Network Updates
    return {
      timestamp: timestamp,
      recent: recent,
      difficulty: network.difficulty,
      hashrate: network.hashrate,
      height: network.height,
      type: network.type,
    };
  };

  // Handle Historical Workerd Updates
  this.handleHistoricalWorkersHashrate = function(workers) {

    // Calculate Features of Workers
    const timestamp = Date.now();
    const tenMinutes = 600000;
    const snapshot = Math.floor(timestamp / tenMinutes) * tenMinutes;
    const algorithm = _this.config.primary.coin.algorithm || 'sha256d';
    const multiplier = Math.pow(2, 32) / _this.template.algorithms[algorithm].multiplier;

    // Return Workers Updates
    return workers.map((worker) => {
      // console.log(worker)
      const section = worker.recent == snapshot ? tenMinutes : timestamp - snapshot;
      const hashrate = utils.roundTo((multiplier * worker.work * 1000) / section, 4);
      return {
        timestamp: timestamp,
        recent: worker.recent,
        miner: worker.miner,
        worker: worker.worker,
        hashrate: hashrate,
        solo: worker.solo,
        type: worker.type,
      };
    });
  };

  // Handle Primary Updates
  this.handlePrimary = function(lookups, callback) {

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Handle Solo Metadata Hashrate Updates
    if (lookups[2].rows && lookups[4].rows && lookups[9].rows) {
      const minersMetadata = lookups[2].rows || 0;
      // console.log('here:')
      // console.log(lookups[2].rows)
      const workersMetadata = lookups[4].rows || 0;
      const currentMetadata = lookups[9].rows || 0;
      const metadataUpdates = _this.handleCurrentMetadata(
        minersMetadata, workersMetadata, currentMetadata, 'primary', true);
      const historicalMetadataUpdates = _this.handleHistoricalMetadata(metadataUpdates);
      // transaction.push(_this.current.metadata.insertCurrentMetadataHashrate(
      //   _this.pool, [metadataUpdates]));
      // transaction.push(_this.historical.metadata.insertHistoricalMetadataHashrate(
      //   _this.pool, [historicalMetadataUpdates]));
    }

    // Handle Shared Metadata Hashrate Updates
    if (lookups[3].rows[0] && lookups[5].rows[0] && lookups[10].rows[0]) {
      const minersMetadata = lookups[3].rows[0].count || 0;
      const workersMetadata = lookups[5].rows[0].count || 0;
      const currentMetadata = lookups[10].rows[0].current_work || 0;
      const metadataUpdates = _this.handleCurrentMetadata(
        minersMetadata, workersMetadata, currentMetadata, 'primary', false);
      const historicalMetadataUpdates = _this.handleHistoricalMetadata(metadataUpdates);
      // transaction.push(_this.current.metadata.insertCurrentMetadataHashrate(
      //   _this.pool, [metadataUpdates]));
      // transaction.push(_this.historical.metadata.insertHistoricalMetadataHashrate(
      //   _this.pool, [historicalMetadataUpdates]));
    }

    // Handle Miners Hashrate Updates
    if (lookups[12].rows.length >= 1) {
      const hashrate = lookups[6].rows;
      const miners = lookups[12].rows;
      const minersUpdates = _this.handleCurrentMiners(hashrate, miners, 'primary');
      transaction.push(_this.current.miners.insertCurrentMinersHashrate(
        _this.pool, minersUpdates));
    }

    // Handle Workers Solo Hashrate Updates
    if (lookups[15].rows.length >= 1) {
      const hashrate = lookups[7].rows;
      const soloWorkers = lookups[15].rows;
      const soloWorkersUpdates = _this.handleCurrentWorkers(hashrate, soloWorkers, 'primary');
      transaction.push(_this.current.workers.insertCurrentWorkersHashrate(
        _this.pool, soloWorkersUpdates));
      const soloWorkerHashrateResetUpdates = _this.handleCurrentWorkersHashrateReset(soloWorkers, 'primary');
      if (soloWorkerHashrateResetUpdates.length > 0)
        transaction.push(_this.current.workers.insertCurrentWorkersResetHashrate(
          _this.pool, soloWorkerHashrateResetUpdates));
    }

    // Handle Workers Shared Hashrate Updates
    if (lookups[16].rows.length >= 1) {
      const hashrate = lookups[8].rows;
      const sharedWorkers = lookups[16].rows;
      const sharedWorkersUpdates = _this.handleCurrentWorkers(hashrate, sharedWorkers, 'primary');
      transaction.push(_this.current.workers.insertCurrentWorkersHashrate(
        _this.pool, sharedWorkersUpdates));
      const sharedWorkerHashrateResetUpdates = _this.handleCurrentWorkersHashrateReset(sharedWorkers, 'primary');
      if (sharedWorkerHashrateResetUpdates.length > 0)
        transaction.push(_this.current.workers.insertCurrentWorkersResetHashrate(
            _this.pool, sharedWorkerHashrateResetUpdates));
    }

    if (lookups[17].rows.length >= 1) {
      const historicalMinersHashrateUpdate = _this.handleHistoricalMinersHashrate(lookups[17].rows);
      if (historicalMinersHashrateUpdate.length > 0)
        transaction.push(_this.historical.miners.insertHistoricalMinersHashrate(
            _this.pool, historicalMinersHashrateUpdate));
    }

    if (lookups[18].rows.length >= 1) {
      const historicalWorkerHashrateUpdate = _this.handleHistoricalWorkersHashrate(lookups[18].rows);
      if (historicalWorkerHashrateUpdate.length > 0)
        transaction.push(_this.historical.workers.insertHistoricalWorkersHashrate(
            _this.pool, historicalWorkerHashrateUpdate));
    }
    
    // Insert Work into Database
    transaction.push('COMMIT;');
    _this.executor(transaction, () => callback());
  };

  // Handle Auxiliary Updates
  this.handleAuxiliary = function(lookups, callback) {

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Handle Solo Metadata Hashrate Updates
    if (lookups[2].rows[0] && lookups[4].rows[0] && lookups[9].rows[0]) {
      const minersMetadata = lookups[2].rows[0].count || 0;
      const workersMetadata = lookups[4].rows[0].count || 0;
      const currentMetadata = lookups[9].rows[0].current_work || 0;
      const metadataUpdates = _this.handleCurrentMetadata(
        minersMetadata, workersMetadata, currentMetadata, 'auxiliary', true);
      // transaction.push(_this.current.metadata.insertCurrentMetadataHashrate(
      //   _this.pool, [metadataUpdates]));
    }

    // Handle Shared Metadata Hashrate Updates
    if (lookups[3].rows[0] && lookups[5].rows[0] && lookups[10].rows[0]) {
      const minersMetadata = lookups[3].rows[0].count || 0;
      const workersMetadata = lookups[5].rows[0].count || 0;
      const currentMetadata = lookups[10].rows[0].current_work || 0;
      const metadataUpdates = _this.handleCurrentMetadata(
        minersMetadata, workersMetadata, currentMetadata, 'auxiliary', false);
      // transaction.push(_this.current.metadata.insertCurrentMetadataHashrate(
      //   _this.pool, [metadataUpdates]));
    }

    // Handle Miners Hashrate Updates
    if (lookups[12].rows.length >= 1) {
      const hashrate = lookups[6].rows;
      const miners = lookups[12].rows;
      const minersUpdates = _this.handleCurrentMiners(hashrate, miners, 'auxiliary');
      transaction.push(_this.current.miners.insertCurrentMinersHashrate(
        _this.pool, minersUpdates));
    }

    // Handle Workers Solo Hashrate Updates
    if (lookups[15].rows.length >= 1) {
      const hashrate = lookups[7].rows;
      const soloWorkers = lookups[15].rows;
      const soloWorkersUpdates = _this.handleCurrentWorkers(hashrate, soloWorkers, 'auxiliary');
      transaction.push(_this.current.workers.insertCurrentWorkersHashrate(
        _this.pool, soloWorkersUpdates));
      const soloWorkerHashrateResetUpdates = _this.handleCurrentWorkersHashrateReset(soloWorkers, 'auxiliary');
      if (soloWorkerHashrateResetUpdates.length > 0)
        transaction.push(_this.current.workers.insertCurrentWorkersResetHashrate(
          _this.pool, soloWorkerHashrateResetUpdates));
    }

    // Handle Workers Shared Hashrate Updates
    if (lookups[16].rows.length >= 1) {
      const hashrate = lookups[8].rows;
      const sharedWorkers = lookups[16].rows;
      const sharedWorkersUpdates = _this.handleCurrentWorkers(hashrate, sharedWorkers, 'auxiliary');
      transaction.push(_this.current.workers.insertCurrentWorkersHashrate(
        _this.pool, sharedWorkersUpdates));
      const sharedWorkerHashrateResetUpdates = _this.handleCurrentWorkersHashrateReset(sharedWorkers, 'auxiliary');
      if (sharedWorkerHashrateResetUpdates.length > 0)
        transaction.push(_this.current.workers.insertCurrentWorkersResetHashrate(
            _this.pool, sharedWorkerHashrateResetUpdates));
    }

    // Insert Work into Database
    transaction.push('COMMIT;');
    _this.executor(transaction, () => callback());
  };

  // Handle Statistics Updates
  this.handleStatistics = function(blockType, callback) {

    // Handle Initial Logging
    const starting = [_this.text.databaseStartingText1(blockType)];
    _this.logger.debug('Statistics', _this.config.name, starting);

    // Calculate Statistics Features
    const timestamp = Date.now();
    const tenMinutes = 600000;
    const recentSnapshot = 'ge' + (Math.floor(timestamp / tenMinutes) * tenMinutes);
    const hashrateWindow = timestamp - _this.config.settings.window.hashrate;
    const inactiveWindow = timestamp - _this.config.settings.window.inactive;
    const purgeWindow = timestamp - _this.config.settings.window.purge;
    const snapshotWindow = timestamp - _this.config.settings.window.snapshots;
    const updateWindow = timestamp - _this.config.settings.window.updates;

    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.current.hashrate.deleteCurrentHashrateInactive(_this.pool, snapshotWindow),
      _this.current.hashrate.countCurrentHashrateIdentifiedMiner(_this.pool, inactiveWindow, true, blockType),
      _this.current.hashrate.countCurrentHashrateIdentifiedMiner(_this.pool, inactiveWindow, false, blockType),
      _this.current.hashrate.countCurrentHashrateIdentifiedWorker(_this.pool, inactiveWindow, true, blockType),
      _this.current.hashrate.countCurrentHashrateIdentifiedWorker(_this.pool, inactiveWindow, false, blockType),
      _this.current.hashrate.sumCurrentHashrateMiner(_this.pool, hashrateWindow, blockType),
      _this.current.hashrate.sumCurrentHashrateWorker(_this.pool, hashrateWindow, true, blockType),
      _this.current.hashrate.sumCurrentHashrateWorker(_this.pool, hashrateWindow, false, blockType),
      _this.current.hashrate.sumCurrentIdentifiedHashrate(_this.pool, hashrateWindow, true, blockType),
      _this.current.hashrate.sumCurrentIdentifiedHashrate(_this.pool, hashrateWindow, false, blockType),
      _this.current.miners.deleteCurrentMinersInactive(_this.pool, purgeWindow),
      _this.current.miners.selectCurrentMinersMain(_this.pool, { type: blockType }),
      _this.current.transactions.deleteCurrentTransactionsInactive(_this.pool, updateWindow),
      _this.current.workers.deleteCurrentWorkersInactive(_this.pool, purgeWindow),
      _this.current.workers.selectCurrentWorkersMain(_this.pool, { solo: true, type: blockType }),
      _this.current.workers.selectCurrentWorkersMain(_this.pool, { solo: false, type: blockType }),
      _this.historical.miners.selectHistoricalMinersMain(_this.pool, { recent: recentSnapshot, type: blockType }),
      _this.historical.workers.selectHistoricalWorkersMain(_this.pool, { recent: recentSnapshot, type: blockType }),
      'COMMIT;'];

      console.log(_this.current.hashrate.countCurrentHashrateIdentifiedMiner(_this.pool, inactiveWindow, true, blockType),)
    // Establish Separate Behavior
    switch (blockType) {

    // Primary Behavior
    case 'primary':
      _this.executor(transaction, (lookups) => {
        _this.handlePrimary(lookups, () => {
          const updates = [_this.text.databaseUpdatesText1(blockType)];
          _this.logger.debug('Statistics', _this.config.name, updates);
          callback();
        });
      });
      break;

    // Auxiliary Behavior
    case 'auxiliary':
      _this.executor(transaction, (lookups) => {
        _this.handleAuxiliary(lookups, () => {
          const updates = [_this.text.databaseUpdatesText1(blockType)];
          _this.logger.debug('Statistics', _this.config.name, updates);
          callback();
        });
      });
      break;

    // Default Behavior
    default:
      callback();
      break;
    }
  };

  // Start Statistics Interval Management
  /* istanbul ignore next */
  this.handleInterval = function() {
    const minInterval = _this.config.settings.interval.statistics * 0.75;
    const maxInterval = _this.config.settings.interval.statistics * 1.25;
    const random = Math.floor(Math.random() * (maxInterval - minInterval) + minInterval);
    setTimeout(() => {
      _this.handleInterval();
      if (_this.config.primary.checks.enabled) _this.handleStatistics('primary', () => {});
      if (_this.config.auxiliary && _this.config.auxiliary.enabled && _this.config.auxiliary.checks.enabled) {
        _this.handleStatistics('auxiliary', () => {});
      }
    }, random);
  };

  // Start Statistics Capabilities
  /* istanbul ignore next */
  this.setupStatistics = function(callback) {
    _this.handleInterval();
    callback();
  };
};

module.exports = Statistics;
