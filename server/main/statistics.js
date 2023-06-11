const { identifier } = require('../../configs/main/example');
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

  // Handle Metadata Hashrate Updates
  this.handleMetadataHashrate = function(miners, workers, work, blockType) {

    const metadata = {};

    // Calculate Features of Metadata
    const timestamp = Date.now();
    const interval = _this.config.settings.interval.recent;
    const recent = Math.ceil(timestamp / interval) * interval;
    const algorithm = _this.config.primary.coin.algorithm;
    const multiplier = Math.pow(2, 32) / _this.template.algorithms[algorithm].multiplier;
    const section = _this.config.settings.window.hashrate;

    // Process Worker Counts
    workers.forEach(element => {
      const unique = `${element.identifier}_${element.solo}`;
      metadata[unique] = {
        timestamp: timestamp,
        recent: recent,
        identifier: element.identifier,
        solo: element.solo,
        type: blockType,
        workers: element.workers,
      }
    });

    // Process Miner Counts
    miners.forEach(element => {
      const unique = `${element.identifier}_${element.solo}`;
      metadata[unique].miners = element.miners;
    });

    // Process Hashrate
    work.forEach(element => {
      const unique = `${element.identifier}_${element.solo}`;
      const hashrate = multiplier * element.work * 1000 / section;
      metadata[unique].hashrate = hashrate;
    });

    // Return Metadata Updates
    return Object.values(metadata)
  };

  // Handle Metadata Share Updates
  this.handleMetadataShares = function(history, blockType) {

    const metadata = {};
    const timestamp = Date.now();
    
    // Count Share Types
    history.forEach(element => {
      const unique = `${element.identifier}_${element.solo}`;
      if (unique in metadata) {
        metadata[unique].stale += element.stale;
        metadata[unique].invalid += element.invalid;
        metadata[unique].valid += element.valid;
      } else {
        metadata[unique] = {
          timestamp: timestamp,
          identifier: element.identifier,
          invalid: element.invalid,
          solo: element.solo,
          stale: element.stale,
          type: blockType,
          valid: element.valid,
        };
      }
    });

    // Calculate Share Efficiency
    for (const [key, value] of Object.entries(metadata)) {
      const total = value.invalid + value.stale + value.valid;
      const efficiency = Math.round(((value.valid / total) || 0) * 10000) / 100;
      metadata[key].efficiency = efficiency;
    };

    // Return Metadata Updates
    return Object.values(metadata)
  };

  // Handle Miners Hashrate Updates
  this.handleMinerHashrate = function(minerWorkSums, blockType) {

    const miners = {};

    // Calculate Features of Miners
    const timestamp = Date.now();
    const interval = _this.config.settings.interval.recent;
    const recent = Math.ceil(timestamp / interval) * interval;
    const algorithm = _this.config.primary.coin.algorithm;
    const multiplier = Math.pow(2, 32) / _this.template.algorithms[algorithm].multiplier;
    const section = _this.config.settings.window.hashrate;

    // Process Individual Miners
    minerWorkSums.forEach(element => {
      const unique = `${element.miner}_${element.solo}`;
      const hashrate = multiplier * element.work * 1000 / section;
      miners[unique] = {
        timestamp: timestamp,
        recent: recent,
        miner: element.miner,
        hashrate: hashrate,
        solo: element.solo,
        type: blockType,
      }
    });

    // Return Miners Updates
    return Object.values(miners)
  };

  // Handle Miners Shares Updates
  this.handleMinersShares = function(historicalMiners, blockType) {

    const miners = {};

    // Calculate Features of Miners
    const timestamp = Date.now();
    const algorithm = _this.config.primary.coin.algorithm;
    const multiplier = Math.pow(2, 32) / _this.template.algorithms[algorithm].multiplier;    

    // Process Individual Miners
    historicalMiners.forEach(element => {
      const unique = `${element.miner}_${element.solo}`;
      const hashrate_12h = multiplier * element.sum_work_12h * 1000 / 43200000;
      const hashrate_24h = multiplier * element.sum_work_24h * 1000 / 86400000;
      const total = element.invalid + element.stale + element.valid;
      const efficiency = Math.round(((element.valid / total) || 0) * 10000) / 100;

      miners[unique] = {
        timestamp: timestamp,
        miner: element.miner,
        efficiency: efficiency,
        hashrate_12h: hashrate_12h,
        hashrate_24h: hashrate_24h,
        invalid: element.invalid,
        solo: element.solo,
        stale: element.stale,
        valid: element.valid,
        type: blockType,
      };
    });

    return Object.values(miners);
  };

  // Handle Workers Hashrate Updates
  this.handleWorkerHashrate = function(workerWorkSums, blockType) {

    const workers = {};

    // Calculate Features of Workers
    const timestamp = Date.now();
    const interval = _this.config.settings.interval.recent;
    const recent = Math.ceil(timestamp / interval) * interval;
    const algorithm = _this.config.primary.coin.algorithm;
    const multiplier = Math.pow(2, 32) / _this.template.algorithms[algorithm].multiplier;
    const section = _this.config.settings.window.hashrate;

    // Process Individual Workers
    workerWorkSums.forEach(element => {
      const unique = `${element.worker}_${element.ip_hash}_${element.solo}`;
      const hashrate = multiplier * element.work * 1000 / section;
      workers[unique] = {
        timestamp: timestamp,
        recent: recent,
        miner: element.worker.split('.')[0],
        worker: element.worker,
        hashrate: hashrate,
        ip_hash: element.ip_hash,
        solo: element.solo,
        type: blockType,
      }
    });

    // Return Workers Updates
    return Object.values(workers)
  };

  // Handle Workers Shares Updates
  this.handleWorkerShares = function(historicalWorkers, blockType) {

    const workers = {};

    // Calculate Features of Workers
    const timestamp = Date.now();
    const algorithm = _this.config.primary.coin.algorithm;
    const multiplier = Math.pow(2, 32) / _this.template.algorithms[algorithm].multiplier;

    // Process Individual Workers
    historicalWorkers.forEach(element => {
      const unique = `${element.worker}_${element.ip_hash}_${element.solo}`;
      const hashrate_12h = multiplier * element.sum_work_12h * 1000 / 43200000;
      const hashrate_24h = multiplier * element.sum_work_24h * 1000 / 86400000;
      const total = element.invalid + element.stale + element.valid;
      const efficiency = Math.round(((element.valid / total) || 0) * 10000) / 100;

      workers[unique] = {
        timestamp: timestamp,
        miner: element.worker.split('.')[0],
        worker: element.worker,
        efficiency: efficiency,
        hashrate_12h: hashrate_12h,
        hashrate_24h: hashrate_24h,
        invalid: element.invalid,
        ip_hash: element.ip_hash,
        solo: element.solo,
        stale: element.stale,
        valid: element.valid,
        type: blockType,
      };
    });

    return Object.values(workers);
  };

  // Handle Statistics Updates
  this.handleUpdates = function(lookups, blockType, callback) {

    // Define Individual Lookups
    const minersCounts = lookups[2].rows;
    const workersCounts = lookups[3].rows;
    const minerWorkSums = lookups[4].rows;
    const workerWorkSums = lookups[5].rows;
    const identifierWorkSums = lookups[6].rows;
    const historicalMetadata = lookups[7].rows;
    const historicalMinersShares = lookups[11].rows;
    const historicalWorkersShares = lookups[12].rows;

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Handle Current and Historical Metadata Hashrate Updates
    if (minersCounts.length > 0 && workersCounts.length > 0 && identifierWorkSums.length > 0) {
      const metadataHashrateUpdates = _this.handleMetadataHashrate(
        minersCounts, workersCounts, identifierWorkSums, blockType);
      transaction.push(_this.master.current.metadata.insertCurrentMetadataHashrate(
        _this.pool, metadataHashrateUpdates));
      transaction.push(_this.master.historical.metadata.insertHistoricalMetadataHashrate(
        _this.pool, metadataHashrateUpdates));
    }

    // Handle Current Metadata Share Updates
    if (historicalMetadata.length > 0) {
      const metadataShareUpdates = _this.handleMetadataShares(historicalMetadata, blockType);
      transaction.push(_this.master.current.metadata.insertCurrentMetadataShares(
        _this.pool, metadataShareUpdates));
    }

    // Handle Current and Historical Miner Hashrate Updates
    if (minerWorkSums.length > 0) {
      const minerHashrateUpdates = _this.handleMinerHashrate(minerWorkSums, blockType);
      transaction.push(_this.master.current.miners.insertCurrentMinersHashrate(
        _this.pool, minerHashrateUpdates));
      transaction.push(_this.master.historical.miners.insertHistoricalMinersHashrate(
        _this.pool, minerHashrateUpdates));
    }

    // Handle Current Miner Share Updates
    if (historicalMinersShares.length > 0) {
      const minerSharesUpdates = _this.handleMinersShares(historicalMinersShares, blockType);
      transaction.push(_this.master.current.miners.insertCurrentMinersShares(
        _this.pool, minerSharesUpdates));
    };
    
    // Handle Current and Historical Worker Hashrate Updates
    if (workerWorkSums.length > 0) {
      const workerHashrateUpdates = _this.handleWorkerHashrate(workerWorkSums, blockType);
      transaction.push(_this.master.current.workers.insertCurrentWorkersHashrate(
        _this.pool, workerHashrateUpdates));
      transaction.push(_this.master.historical.workers.insertHistoricalWorkersHashrate(
        _this.pool, workerHashrateUpdates));
    }

    // Handle Current Worker Share Updates
    if (historicalWorkersShares.length > 0) {
      const workerSharesUpdates = _this.handleWorkerShares(historicalWorkersShares, blockType);
      transaction.push(_this.master.current.workers.insertCurrentWorkersShares(
        _this.pool, workerSharesUpdates)); 
    };

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
    const hashrateWindow = timestamp - _this.config.settings.window.hashrate;
    const halfDayWindow = timestamp - 43200000;
    const inactiveWindow = timestamp - _this.config.settings.window.inactive;
    const interval = _this.config.settings.interval.historical;
    const oneDayWindow = timestamp - 86400000;
    const oneDayRecent = Math.ceil(oneDayWindow / interval) * interval;
    const updateWindow = timestamp - _this.config.settings.window.updates;

    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.master.current.hashrate.deleteCurrentHashrateInactive(_this.pool, hashrateWindow),
      _this.master.current.hashrate.countCurrentHashrateMiner(_this.pool, hashrateWindow, blockType),
      _this.master.current.hashrate.countCurrentHashrateWorker(_this.pool, hashrateWindow, blockType),
      _this.master.current.hashrate.sumCurrentHashrateMiner(_this.pool, hashrateWindow, blockType),
      _this.master.current.hashrate.sumCurrentHashrateWorker(_this.pool, hashrateWindow, blockType),
      _this.master.current.hashrate.sumCurrentHashrateType(_this.pool, hashrateWindow, blockType),
      _this.master.historical.metadata.selectHistoricalMetadataMain(_this.pool, { recent: 'ge' + oneDayRecent, type: blockType }),
      _this.master.current.miners.deleteCurrentMinersInactive(_this.pool, inactiveWindow),
      _this.master.current.transactions.deleteCurrentTransactionsInactive(_this.pool, updateWindow),
      _this.master.current.workers.deleteCurrentWorkersInactive(_this.pool, inactiveWindow),
      _this.master.historical.miners.selectHistoricalMinersAverages(_this.pool, halfDayWindow, oneDayWindow, blockType),
      _this.master.historical.workers.selectHistoricalWorkersAverages(_this.pool, halfDayWindow, oneDayWindow, blockType),
      'COMMIT;'];

    // Handle Statistics Updates
    _this.master.executor(transaction, (lookups) => {
      _this.handleUpdates(lookups, blockType, () => {
        const updates = [_this.text.databaseUpdatesText1(blockType)];
        _this.logger.debug('Statistics', _this.config.name, updates);
        callback();
      });
    });
  };

  // Start Statistics Interval Management
  /* istanbul ignore next */
  this.handleInterval = function() {
    const interval = _this.config.settings.interval.statistics;
    setTimeout(() => {
      _this.handleInterval();
      if (_this.config.primary.statistics.enabled) _this.handleStatistics('primary', () => {});
      if (_this.config.auxiliary && _this.config.auxiliary.enabled && _this.config.auxiliary.statistics.enabled) {
        _this.handleStatistics('auxiliary', () => {});
      }
    }, interval);
  };

  // Start Statistics Capabilities
  /* istanbul ignore next */
  this.setupStatistics = function(callback) {
    const interval = _this.config.settings.interval.statistics;
    const numForks = utils.countProcessForks(_this.configMain);
    const timing = parseFloat(_this.forkId) * interval / numForks;
    setTimeout(() => _this.handleInterval(), timing);
    callback();
  };
};

module.exports = Statistics;
