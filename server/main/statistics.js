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

  // Stratum Variables
  process.setMaxListeners(0);
  this.forkId = process.env.forkId;
  
  // Client Handlers
  this.master = {
    executor: _this.client.master.commands.executor,
    current: _this.client.master.commands.current,
    historical: _this.client.master.commands.historical };
  this.worker = {
    executor: _this.client.worker.commands.executor,
    local: _this.client.worker.commands.local };

  // Handle Efficiency Updates
  this.handleEfficiency = function(data) {
    const valid = (data.valid || 0);
    const total = (data.valid || 0) + (data.stale || 0) + (data.invalid || 0);
    return utils.roundTo(valid / total * 100, 2) || 0;
  };

  // Handle Current Metadata Updates
  this.handleCurrentMetadata = function(miners, workers, total, blockType, minerType) {

    const timestamp = Date.now();
    const algorithm = _this.config.primary.coin.algorithm || 'sha256d';
    const multiplier = Math.pow(2, 32) / _this.template.algorithms[algorithm].multiplier;
    const section = _this.config.settings.window.hashrate;

    // Return Metadata Updates
    return miners.map((miner) => {
      const identifier = miner.identifier;
      const minerCount = miner.count;
      const workerCount = workers.filter(el => el.identifier === identifier)[0].count || 0;

      // Calculate Region Hashrate
      const filtered = total.filter(el => el.identifier === identifier);
      const work = filtered[0] ? filtered[0].current_work : 0;
      const hashrate = utils.roundTo((multiplier * work * 1000) / section, 4);
      
      return {
        timestamp: timestamp,
        hashrate: hashrate,
        identifier: identifier,
        miners: minerCount,
        solo: minerType,
        type: blockType,
        workers: workerCount,
      };
    });
  };

  // Handle Current Miners Updates
  this.handleCurrentMiners = function(work, miners, soloWorkers, sharedWorkers, blockType) {
    const timestamp = Date.now();
    const algorithm = _this.config.primary.coin.algorithm || 'sha256d';
    const multiplier = Math.pow(2, 32) / _this.template.algorithms[algorithm].multiplier;
    const section = _this.config.settings.window.hashrate;

    // Return Miners Updates
    return miners.map((miner) => {
      const efficiency = _this.handleEfficiency(miner);
      const filtered = work.filter((share) => share.miner === miner.miner);
      const sharedCounts = sharedWorkers.filter(el => el.miner === miner.miner)[0] || {};
      const activeSharedWorkers = sharedCounts.active_workers || 0;
      const inactiveSharedWorkers = sharedCounts.inactive_workers || 0;
      const soloCounts = soloWorkers.filter(el => el.miner === miner.miner)[0] || {};
      const activeSoloWorkers = soloCounts.active_workers || 0;
      const inactiveSoloWorkers = soloCounts.inactive_workers || 0;
      const minerHash = filtered[0] || { current_work: 0 };
      const hashrate = utils.roundTo((multiplier * minerHash.current_work * 1000) / section, 4);

      return {
        timestamp: timestamp,
        miner: miner.miner,
        active_shared: activeSharedWorkers,
        active_solo: activeSoloWorkers,
        efficiency: efficiency,
        hashrate: hashrate,
        inactive_shared: inactiveSharedWorkers,
        inactive_solo: inactiveSoloWorkers,
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

  // Handle Share, Average Hashrate Updates for Current Workers 
  this.handleCurrentWorkerAggregates = function(workers, blockType) {

    // Calculate Features of Workers
    const timestamp = Date.now();

    // Return Workers Updates
    return workers
      .map(worker => {
        return {
          timestamp: timestamp, 
          miner: worker.miner,
          worker: worker.worker,
          average_hashrate: Math.round(worker.average_hashrate * 10000) / 10000,
          invalid: worker.invalid,
          solo: worker.solo,
          stale: worker.stale,
          type: blockType,
          valid: worker.valid,
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
    return updates.map(el => {
      return {
        timestamp: timestamp,
        recent: recent,
        hashrate: el.hashrate,
        identifier: el.identifier,
        miners: el.miners,
        solo: el.solo,
        type: el.type,
        workers: el.workers,
      };
    });
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

    // console.log(_this.config.settings.window.hashrate)
    // Return Workers Updates
    return workers.map((worker) => {
      const section = worker.recent == snapshot ? tenMinutes : timestamp - snapshot;
      const hashrate = section > _this.config.settings.window.hashrate ?
        utils.roundTo((multiplier * worker.work * 1000 / section), 4) : worker.hashrate;
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
    if (lookups[2].rows[0] && lookups[4].rows[0] && lookups[9].rows[0]) {
      const minersMetadata = lookups[2].rows || {};
      const workersMetadata = lookups[4].rows || {};
      const currentMetadata = lookups[9].rows || {};
      const metadataUpdates = _this.handleCurrentMetadata(
        minersMetadata, workersMetadata, currentMetadata, 'primary', true);
      const historicalMetadataUpdates = _this.handleHistoricalMetadata(metadataUpdates);
      transaction.push(_this.master.current.metadata.insertCurrentMetadataHashrate(
        _this.pool, metadataUpdates));
      transaction.push(_this.master.historical.metadata.insertHistoricalMetadataHashrate(
        _this.pool, historicalMetadataUpdates));
    }

    // Handle Shared Metadata Hashrate Updates
    if (lookups[3].rows[0] && lookups[5].rows[0] && lookups[10].rows[0]) {
      const minersMetadata = lookups[3].rows || {};
      const workersMetadata = lookups[5].rows || {};
      const currentMetadata = lookups[10].rows || {};
      const metadataUpdates = _this.handleCurrentMetadata(
        minersMetadata, workersMetadata, currentMetadata, 'primary', false);
      const historicalMetadataUpdates = _this.handleHistoricalMetadata(metadataUpdates);
      transaction.push(_this.master.current.metadata.insertCurrentMetadataHashrate(
        _this.pool, metadataUpdates));
      transaction.push(_this.master.historical.metadata.insertHistoricalMetadataHashrate(
        _this.pool, historicalMetadataUpdates));
    }

    // Handle Miners Hashrate Updates
    if (lookups[12].rows.length >= 1) {
      const hashrate = lookups[6].rows;
      const miners = lookups[12].rows;
      const soloWorkers = lookups[19].rows;
      const sharedWorkers = lookups[20].rows;
      const minersUpdates = _this.handleCurrentMiners(
        hashrate, miners, soloWorkers, sharedWorkers, 'primary');
      transaction.push(_this.master.current.miners.insertCurrentMinersHashrate(
        _this.pool, minersUpdates));
    }

    // Handle Workers Solo Hashrate Updates
    if (lookups[15].rows.length >= 1) {
      const hashrate = lookups[7].rows;
      const soloWorkers = lookups[15].rows;
      const soloWorkersUpdates = _this.handleCurrentWorkers(hashrate, soloWorkers, 'primary');
      transaction.push(_this.master.current.workers.insertCurrentWorkersHashrate(
        _this.pool, soloWorkersUpdates));
    }

    // Handle Workers Shared Hashrate Updates
    if (lookups[16].rows.length >= 1) {
      const hashrate = lookups[8].rows;
      const sharedWorkers = lookups[16].rows;
      // console.log(sharedWorkers)
      // const temp = lookups[21].rows;
      const sharedWorkersUpdates = _this.handleCurrentWorkers(hashrate, sharedWorkers, 'primary');
      transaction.push(_this.master.current.workers.insertCurrentWorkersHashrate(
        _this.pool, sharedWorkersUpdates));
    }

    if (lookups[17].rows.length >= 1) {
      const historicalMinersHashrateUpdate = _this.handleHistoricalMinersHashrate(lookups[17].rows);
      if (historicalMinersHashrateUpdate.length > 0)
        transaction.push(_this.master.historical.miners.insertHistoricalMinersHashrate(
            _this.pool, historicalMinersHashrateUpdate));
    }

    if (lookups[18].rows.length >= 1) {
      const historicalWorkerHashrateUpdate = _this.handleHistoricalWorkersHashrate(lookups[18].rows);
      if (historicalWorkerHashrateUpdate.length > 0)
        transaction.push(_this.master.historical.workers.insertHistoricalWorkersHashrate(
            _this.pool, historicalWorkerHashrateUpdate));
    }

    if (lookups[21].rows.length >= 1) {
      const currentWorkerSharesUpdate = _this.handleCurrentWorkerAggregates(lookups[21].rows, 'primary');
      if (currentWorkerSharesUpdate.length > 0)
        transaction.push(_this.master.current.workers.insertCurrentWorkersUpdates(
          _this.pool, currentWorkerSharesUpdate));
    } 
    
    // Insert Work into Database
    transaction.push('COMMIT;');
    _this.master.executor(transaction, () => callback());
  };

  // Handle Auxiliary Updates
  this.handleAuxiliary = function(lookups, callback) {

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Handle Solo Metadata Hashrate Updates
    if (lookups[2].rows[0] && lookups[4].rows[0] && lookups[9].rows[0]) {
      const minersMetadata = lookups[2].rows || {};
      const workersMetadata = lookups[4].rows || {};
      const currentMetadata = lookups[9].rows || {};
      const metadataUpdates = _this.handleCurrentMetadata(
        minersMetadata, workersMetadata, currentMetadata, 'auxiliary', true);
      const historicalMetadataUpdates = _this.handleHistoricalMetadata(metadataUpdates);
      transaction.push(_this.master.current.metadata.insertCurrentMetadataHashrate(
        _this.pool, metadataUpdates));
      transaction.push(_this.master.historical.metadata.insertHistoricalMetadataHashrate(
        _this.pool, historicalMetadataUpdates));
    }

    // Handle Shared Metadata Hashrate Updates
    if (lookups[3].rows[0] && lookups[5].rows[0] && lookups[10].rows[0]) {
      const minersMetadata = lookups[3].rows[0] || 0;
      const workersMetadata = lookups[5].rows[0] || 0;
      const currentMetadata = lookups[10].rows[0] || 0;
      const metadataUpdates = _this.handleCurrentMetadata(
        minersMetadata, workersMetadata, currentMetadata, 'auxiliary', false);
      const historicalMetadataUpdates = _this.handleHistoricalMetadata(metadataUpdates);
      transaction.push(_this.master.current.metadata.insertCurrentMetadataHashrate(
        _this.pool, metadataUpdates));
      transaction.push(_this.master.historical.metadata.insertHistoricalMetadataHashrate(
        _this.pool, historicalMetadataUpdates));
    }

    // Handle Miners Hashrate Updates
    if (lookups[12].rows.length >= 1) {
      const hashrate = lookups[6].rows;
      const miners = lookups[12].rows;
      const soloWorkers = lookups[19].rows;
      const sharedWorkers = lookups[20].rows;
      const minersUpdates = _this.handleCurrentMiners(
        hashrate, miners, soloWorkers, sharedWorkers, 'primary');
      transaction.push(_this.master.current.miners.insertCurrentMinersHashrate(
        _this.pool, minersUpdates));
    }
        
    // Handle Workers Solo Hashrate Updates
    if (lookups[15].rows.length >= 1) {
      const hashrate = lookups[7].rows;
      const soloWorkers = lookups[15].rows;
      const soloWorkersUpdates = _this.handleCurrentWorkers(hashrate, soloWorkers, 'auxiliary');
      transaction.push(_this.master.current.workers.insertCurrentWorkersHashrate(
        _this.pool, soloWorkersUpdates));
    }

    // Handle Workers Shared Hashrate Updates
    if (lookups[16].rows.length >= 1) {
      const hashrate = lookups[8].rows;
      const sharedWorkers = lookups[16].rows;
      const sharedWorkersUpdates = _this.handleCurrentWorkers(hashrate, sharedWorkers, 'auxiliary');
      transaction.push(_this.master.current.workers.insertCurrentWorkersHashrate(
        _this.pool, sharedWorkersUpdates));
    }

    // Insert Work into Database
    transaction.push('COMMIT;');
    _this.master.executor(transaction, () => callback());
  };

  // Handle Statistics Updates
  this.handleStatistics = function(blockType, callback) {

    // Handle Initial Logging
    const starting = [_this.text.databaseStartingText1(blockType)];
    _this.logger.debug('Statistics', _this.config.name, starting);

    // Calculate Statistics Features
    const timestamp = Date.now();
    const tenMinutes = 600000;
    const oneDay = 86400000;
    const recentSnapshot = 'ge' + (Math.floor(timestamp / tenMinutes) * tenMinutes);
    const hashrateWindow = timestamp - _this.config.settings.window.hashrate;
    const inactiveWindow = timestamp - _this.config.settings.window.inactive;
    const purgeWindow = timestamp - _this.config.settings.window.purge;
    const snapshotWindow = timestamp - _this.config.settings.window.snapshots;
    const updateWindow = timestamp - _this.config.settings.window.updates;
    const oneDayWindow = timestamp - oneDay;

    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.master.current.hashrate.deleteCurrentHashrateInactive(_this.pool, snapshotWindow), //ok
      _this.master.current.hashrate.countCurrentHashrateIdentifiedMiner(_this.pool, inactiveWindow, true, blockType), //ok
      _this.master.current.hashrate.countCurrentHashrateIdentifiedMiner(_this.pool, inactiveWindow, false, blockType), //ok
      _this.master.current.hashrate.countCurrentHashrateIdentifiedWorker(_this.pool, inactiveWindow, true, blockType), //ok
      _this.master.current.hashrate.countCurrentHashrateIdentifiedWorker(_this.pool, inactiveWindow, false, blockType), //ok
      _this.master.current.hashrate.sumCurrentHashrateMiner(_this.pool, hashrateWindow, blockType), //ok
      _this.master.current.hashrate.sumCurrentHashrateWorker(_this.pool, hashrateWindow, true, blockType), //ok
      _this.master.current.hashrate.sumCurrentHashrateWorker(_this.pool, hashrateWindow, false, blockType), //ok
      _this.master.current.hashrate.sumCurrentIdentifiedHashrate(_this.pool, hashrateWindow, true, blockType), //ok
      _this.master.current.hashrate.sumCurrentIdentifiedHashrate(_this.pool, hashrateWindow, false, blockType), //ok
      _this.master.current.miners.deleteCurrentMinersInactive(_this.pool, purgeWindow), //ok
      _this.master.current.miners.selectCurrentMinersMain(_this.pool, { type: blockType }), //ok
      _this.master.current.transactions.deleteCurrentTransactionsInactive(_this.pool, updateWindow), //ok
      _this.master.current.workers.deleteCurrentWorkersInactive(_this.pool, purgeWindow), // ok
      _this.master.current.workers.selectCurrentWorkersMain(_this.pool, { solo: true, type: blockType }), //ok
      _this.master.current.workers.selectCurrentWorkersMain(_this.pool, { solo: false, type: blockType }), //ok
      _this.master.historical.miners.selectHistoricalMinersMain(_this.pool, { recent: recentSnapshot, type: blockType }),
      _this.master.historical.workers.selectHistoricalWorkersMain(_this.pool, { recent: recentSnapshot, type: blockType }),
      _this.master.current.workers.selectCurrentWorkersLastShare(_this.pool, inactiveWindow, oneDayWindow, true, blockType), // ok
      _this.master.current.workers.selectCurrentWorkersLastShare(_this.pool, inactiveWindow, oneDayWindow, false, blockType), // ok
      _this.master.historical.workers.selectHistoricalWorkersAggregates(_this.pool, oneDayWindow, blockType),
      'COMMIT;'];

    // Establish Separate Behavior
    switch (blockType) {

    // Primary Behavior
    case 'primary':
      _this.master.executor(transaction, (lookups) => {
        _this.handlePrimary(lookups, () => {
          const updates = [_this.text.databaseUpdatesText1(blockType)];
          _this.logger.debug('Statistics', _this.config.name, updates);
          callback();
        });
      });
      break;

    // Auxiliary Behavior
    case 'auxiliary':
      _this.master.executor(transaction, (lookups) => {
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
