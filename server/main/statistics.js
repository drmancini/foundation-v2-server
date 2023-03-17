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
  this.handleCurrentMiners = function(workWorkers, miners, soloWorkers, sharedWorkers, blockType) {
    const timestamp = Date.now();
    const algorithm = _this.config.primary.coin.algorithm || 'sha256d';
    const multiplier = Math.pow(2, 32) / _this.template.algorithms[algorithm].multiplier;
    const section = _this.config.settings.window.hashrate;

    // Return Miners Updates
    return miners.map(miner => {
      const efficiency = _this.handleEfficiency(miner);
      const filteredWorkers = workWorkers.filter(el => el.worker.split('.')[0] === miner.miner)
        .reduce((a, b) => a + b.current_work, 0);
      const sharedCounts = sharedWorkers.filter(el => el.miner === miner.miner)[0] || {};
      const soloCounts = soloWorkers.filter(el => el.miner === miner.miner)[0] || {};
      const hashrate = utils.roundTo((multiplier * filteredWorkers * 1000) / section, 4);

      return {
        timestamp: timestamp,
        miner: miner.miner,
        active_shared: sharedCounts.active_workers || 0,
        active_solo: soloCounts.active_workers || 0,
        efficiency: efficiency,
        hashrate: hashrate,
        inactive_shared: sharedCounts.inactive_workers || 0,
        inactive_solo: soloCounts.inactive_workers || 0,
        type: blockType,
      };
    });
  };

  // Handle Workers Updates
  this.handleCurrentWorkers = function(work, workers, stats, blockType) {

    // Calculate Features of Workers
    const timestamp = Date.now();
    const algorithm = _this.config.primary.coin.algorithm || 'sha256d';
    const multiplier = Math.pow(2, 32) / _this.template.algorithms[algorithm].multiplier;
    const section = _this.config.settings.window.hashrate;

    // Return Workers Updates
    return workers.map(worker => {
      const filteredStats = stats.filter(el => el.worker === worker.worker)[0] || {};
      const efficiency = _this.handleEfficiency(worker);
      const filtered = work.filter((share) => share.worker === worker.worker);
      const workerHash = filtered[0] || { current_work: 0 };
      const hashrate = utils.roundTo((multiplier * workerHash.current_work * 1000) / section, 4);
      const hashrate_12h = Math.round(filteredStats.hashrate_12h * 10000) / 10000;
      const hashrate_24h = Math.round(filteredStats.hashrate_24h * 10000) / 10000;

      return {
        timestamp: timestamp,
        miner: (worker.worker || '').split('.')[0],
        worker: worker.worker,
        efficiency: efficiency,
        hashrate: hashrate,
        hashrate_12h: hashrate_12h || 0,
        hashrate_24h: hashrate_24h || 0,
        invalid: filteredStats.invalid || 0,
        solo: worker.solo,
        stale: filteredStats.stale || 0,
        valid: filteredStats.valid || 0,
        type: blockType,
      };
    });
  };

  // Handle Historical Miners Updates
  this.handleHistoricalMinersHashrate = function(miners, workers, blockType) {

    // Return Miners Updates
    return miners.map(miner => {
      const hashrate = workers.filter(el => 
          el.miner === miner.miner && el.recent === miner.recent )
        .reduce((a, b) => a + b.hashrate, 0);

      return {
        recent: miner.recent,
        miner: miner.miner,
        hashrate: hashrate,
        solo: miner.solo,
        type: blockType,
      };
    });
  };

  // Handle Historical Metadata Updates
  this.handleHistoricalMetadata = function(updates, blockType) {

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
        type: blockType,
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
  this.handleHistoricalWorkersHashrate = function(workers, blockType) {

    // Calculate Features of Workers
    const timestamp = Date.now();
    const tenMinutes = 600000;
    const snapshot = Math.floor(timestamp / tenMinutes) * tenMinutes;
    const algorithm = _this.config.primary.coin.algorithm || 'sha256d';
    const multiplier = Math.pow(2, 32) / _this.template.algorithms[algorithm].multiplier;

    // Return Workers Updates
    return workers.map(worker => {
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
        type: blockType,
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
      const historicalMetadataUpdates = _this.handleHistoricalMetadata(metadataUpdates, 'primary');
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
      const historicalMetadataUpdates = _this.handleHistoricalMetadata(metadataUpdates, 'primary');
      transaction.push(_this.master.current.metadata.insertCurrentMetadataHashrate(
        _this.pool, metadataUpdates));
      transaction.push(_this.master.historical.metadata.insertHistoricalMetadataHashrate(
        _this.pool, historicalMetadataUpdates));
    }

    // Handle Miners Hashrate Updates
    if (lookups[12].rows.length >= 1) {
      const hashrate = lookups[8].rows;
      const miners = lookups[12].rows;
      const soloWorkers = lookups[17].rows;
      const sharedWorkers = lookups[18].rows;
      const minersUpdates = _this.handleCurrentMiners(
        hashrate, miners, soloWorkers, sharedWorkers, 'primary');
      transaction.push(_this.master.current.miners.insertCurrentMinersHashrate(
        _this.pool, minersUpdates));
    }

    // Handle Workers Solo Hashrate Updates
    if (lookups[15].rows.length >= 1) {
      const hashrate = lookups[7].rows;
      const soloWorkers = lookups[15].rows;
      const soloStats = lookups[21].rows;
      const soloWorkersUpdates = _this.handleCurrentWorkers(hashrate, soloWorkers, soloStats, 'primary');
      transaction.push(_this.master.current.workers.insertCurrentWorkersHashrate(
        _this.pool, soloWorkersUpdates));
    }

    // Handle Workers Shared Hashrate Updates
    if (lookups[16].rows.length >= 1) {
      const hashrate = lookups[8].rows;
      const sharedWorkers = lookups[16].rows;
      const sharedStats = lookups[22].rows;
      const sharedWorkersUpdates = _this.handleCurrentWorkers(hashrate, sharedWorkers, sharedStats, 'primary');
      transaction.push(_this.master.current.workers.insertCurrentWorkersHashrate(
        _this.pool, sharedWorkersUpdates));
    }

    // Handle Historical Miners Update
    if (lookups[19].rows.length >= 1 && lookups[20].rows.length >= 1) {
      const historicalMinersHashrateUpdate = _this.handleHistoricalMinersHashrate(lookups[19].rows, lookups[20].rows, 'primary');
      if (historicalMinersHashrateUpdate.length > 0)
        transaction.push(_this.master.historical.miners.insertHistoricalMinersHashrate(
            _this.pool, historicalMinersHashrateUpdate));
    }

    // Handle Historical Workers Update
    if (lookups[20].rows.length >= 1) {
      const historicalWorkerHashrateUpdate = _this.handleHistoricalWorkersHashrate(lookups[20].rows, 'primary');
      if (historicalWorkerHashrateUpdate.length > 0)
        transaction.push(_this.master.historical.workers.insertHistoricalWorkersHashrate(
            _this.pool, historicalWorkerHashrateUpdate));
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
      const historicalMetadataUpdates = _this.handleHistoricalMetadata(metadataUpdates, 'auxiliary');
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
        minersMetadata, workersMetadata, currentMetadata, 'auxiliary', false);
      const historicalMetadataUpdates = _this.handleHistoricalMetadata(metadataUpdates, 'auxiliary');
      transaction.push(_this.master.current.metadata.insertCurrentMetadataHashrate(
        _this.pool, metadataUpdates));
      transaction.push(_this.master.historical.metadata.insertHistoricalMetadataHashrate(
        _this.pool, historicalMetadataUpdates));
    }

    // Handle Miners Hashrate Updates
    if (lookups[12].rows.length >= 1) {
      const hashrate = lookups[8].rows;
      const miners = lookups[12].rows;
      const soloWorkers = lookups[17].rows;
      const sharedWorkers = lookups[18].rows;
      const minersUpdates = _this.handleCurrentMiners(
        hashrate, miners, soloWorkers, sharedWorkers, 'auxiliary');
      transaction.push(_this.master.current.miners.insertCurrentMinersHashrate(
        _this.pool, minersUpdates));
    }
        
    // Handle Workers Solo Hashrate Updates
    if (lookups[15].rows.length >= 1) {
      const hashrate = lookups[7].rows;
      const soloWorkers = lookups[15].rows;
      const soloStats = lookups[21].rows;
      const soloWorkersUpdates = _this.handleCurrentWorkers(hashrate, soloWorkers, soloStats, 'auxiliary');
      transaction.push(_this.master.current.workers.insertCurrentWorkersHashrate(
        _this.pool, soloWorkersUpdates));
    }

    // Handle Workers Shared Hashrate Updates
    if (lookups[16].rows.length >= 1) {
      const hashrate = lookups[8].rows;
      const sharedWorkers = lookups[16].rows;
      const sharedStats = lookups[22].rows;
      const sharedWorkersUpdates = _this.handleCurrentWorkers(hashrate, sharedWorkers, sharedStats, 'auxiliary');
      transaction.push(_this.master.current.workers.insertCurrentWorkersHashrate(
        _this.pool, sharedWorkersUpdates));
    }

    // Handle Historical Miners Update
    if (lookups[19].rows.length >= 1 && lookups[20].rows.length >= 1) {
      const historicalMinersHashrateUpdate = _this.handleHistoricalMinersHashrate(lookups[19].rows, lookups[20].rows, 'auxiliary');
      if (historicalMinersHashrateUpdate.length > 0)
        transaction.push(_this.master.historical.miners.insertHistoricalMinersHashrate(
            _this.pool, historicalMinersHashrateUpdate));
    }

    // Handle Historical Workers Update
    if (lookups[20].rows.length >= 1) {
      const historicalWorkerHashrateUpdate = _this.handleHistoricalWorkersHashrate(lookups[20].rows, 'auxiliary');
      if (historicalWorkerHashrateUpdate.length > 0)
        transaction.push(_this.master.historical.workers.insertHistoricalWorkersHashrate(
            _this.pool, historicalWorkerHashrateUpdate));
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
    const halfDay = 86400000 / 2;
    const oneDay = 86400000;
    const recentSnapshot = 'ge' + (Math.floor(timestamp / tenMinutes) * tenMinutes);
    const hashrateWindow = timestamp - _this.config.settings.window.hashrate;
    const inactiveWindow = timestamp - _this.config.settings.window.inactive;
    const purgeWindow = timestamp - _this.config.settings.window.purge;
    const snapshotWindow = timestamp - _this.config.settings.window.snapshots;
    const updateWindow = timestamp - _this.config.settings.window.updates;
    const halfDayWindow = timestamp - halfDay;
    const oneDayWindow = timestamp - oneDay;
    const twoDayWindow = timestamp - 2 * oneDay;
    const monthWindow = timestamp - 31 * oneDay;

    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.master.current.hashrate.deleteCurrentHashrateInactive(_this.pool, snapshotWindow), 
      _this.master.current.hashrate.countCurrentHashrateIdentifiedMiner(_this.pool, inactiveWindow, true, blockType), 
      _this.master.current.hashrate.countCurrentHashrateIdentifiedMiner(_this.pool, inactiveWindow, false, blockType), 
      _this.master.current.hashrate.countCurrentHashrateIdentifiedWorker(_this.pool, inactiveWindow, true, blockType), 
      _this.master.current.hashrate.countCurrentHashrateIdentifiedWorker(_this.pool, inactiveWindow, false, blockType), 
      _this.master.current.hashrate.sumCurrentHashrateMiner(_this.pool, hashrateWindow, blockType), 
      _this.master.current.hashrate.sumCurrentHashrateWorker(_this.pool, hashrateWindow, true, blockType), 
      _this.master.current.hashrate.sumCurrentHashrateWorker(_this.pool, hashrateWindow, false, blockType), 
      _this.master.current.hashrate.sumCurrentIdentifiedHashrate(_this.pool, hashrateWindow, true, blockType), 
      _this.master.current.hashrate.sumCurrentIdentifiedHashrate(_this.pool, hashrateWindow, false, blockType), 
      _this.master.current.miners.deleteCurrentMinersInactive(_this.pool, purgeWindow), 
      _this.master.current.miners.selectCurrentMinersMain(_this.pool, { type: blockType }), 
      _this.master.current.transactions.deleteCurrentTransactionsInactive(_this.pool, updateWindow), 
      _this.master.current.workers.deleteCurrentWorkersInactive(_this.pool, purgeWindow), 
      _this.master.current.workers.selectCurrentWorkersMain(_this.pool, { solo: true, type: blockType }), 
      _this.master.current.workers.selectCurrentWorkersMain(_this.pool, { solo: false, type: blockType }), 
      _this.master.current.workers.selectCurrentWorkersLastShare(_this.pool, inactiveWindow, oneDayWindow, true, blockType), 
      _this.master.current.workers.selectCurrentWorkersLastShare(_this.pool, inactiveWindow, oneDayWindow, false, blockType), 
      _this.master.historical.miners.selectHistoricalMinersMain(_this.pool, { recent: recentSnapshot, type: blockType }),
      _this.master.historical.workers.selectHistoricalWorkersMain(_this.pool, { recent: recentSnapshot, type: blockType }),
      _this.master.historical.workers.selectHistoricalWorkersAverages(_this.pool, halfDayWindow, oneDayWindow, true, blockType),
      _this.master.historical.workers.selectHistoricalWorkersAverages(_this.pool, halfDayWindow, oneDayWindow, false, blockType),
      _this.master.historical.miners.deleteHistoricalMinersCutoff(_this.pool, twoDayWindow),
      _this.master.historical.workers.deleteHistoricalWorkersCutoff(_this.pool, twoDayWindow),
      _this.master.historical.metadata.deleteHistoricalMetadataCutoff(_this.pool, twoDayWindow),
      _this.master.historical.rounds.deleteHistoricalRoundsCutoff(_this.pool, monthWindow),
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
