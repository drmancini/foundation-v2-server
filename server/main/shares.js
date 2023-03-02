const Text = require('../../locales/index');
const utils = require('./utils');
const uuid = require('uuid');

////////////////////////////////////////////////////////////////////////////////

// Main Shares Function
const Shares = function (logger, client, config, configMain) {

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

  // Handle Efficiency Updates
  this.handleEfficiency = function(roundData, shareType) {
    const valid = shareType === 'valid' ? (roundData.valid || 0) + 1 : (roundData.valid || 0);
    const total = (roundData.valid || 0) + (roundData.stale || 0) + (roundData.invalid || 0) + 1;
    return utils.roundTo(valid / total * 100, 2) || 0;
  };

  // Handle Effort Updates
  this.handleEffort = function(work, shareDifficulty, shareType, difficulty) {
    const total = shareType === 'valid' ? (work || 0) + (shareDifficulty || 0) : (work || 0);
    return Number((total / difficulty * 100).toPrecision(4)) || 0;
  };

  // Handle Effort Incremental Updates
  this.handleEffortIncrement = function(shareDifficulty, shareType, difficulty) {
    const total = shareType === 'valid' ? (shareDifficulty || 0) : 0;
    return Number((total / difficulty * 100).toPrecision(4)) || 0;
  };

  // Handle Times Updates
  this.handleTimes = function(sharePrevious, timestamp) {
    let times = sharePrevious.times || 0;
    const lastTime = sharePrevious.timestamp || Date.now();
    const timeChange = Math.max(timestamp - lastTime, 0) / 1000;
    if (timeChange < 900) times += timeChange;
    return utils.roundTo(times, 4);
  };

  // Handle Times Incremental Updates
  this.handleTimesIncrement = function(sharePrevious, timestamp) {
    const lastTime = sharePrevious.timestamp || Date.now();
    const timeChange = utils.roundTo(Math.max(timestamp - lastTime, 0) / 1000, 4);
    const times = (timeChange < 900) ? timeChange : 0;
    return times;
  };

  // Handle Blocks Updates
  this.handleCurrentBlocks = function(work, worker, difficulty, round, shareData, shareType, minerType, blockType) {

    // Calculate Features of Blocks
    const identifier = shareData.identifier || 'master';
    const luck = _this.handleEffort(work, shareData.difficulty, shareType, difficulty);
    const timestamp = Date.now();

    // Return Blocks Updates
    return {
      timestamp: timestamp,
      submitted: shareData.submitTime || timestamp,
      miner: (worker || '').split('.')[0],
      worker: worker,
      category: 'pending',
      confirmations: -1,
      difficulty: difficulty,
      hash: shareData.hash,
      height: shareData.height,
      identifier: identifier,
      luck: luck,
      reward: 0,
      round: round,
      solo: minerType,
      transaction: shareData.transaction,
      type: blockType,
    };
  };

  // Handle Hashrate Updates
  this.handleCurrentHashrate = function(worker, difficulty, shareData, shareType, minerType, blockType) {

    // Calculate Features of Hashrate
    const current = shareType === 'valid' ? difficulty : 0;
    const identifier = shareData.identifier || 'master';

    // Return Hashrate Updates
    return {
      timestamp: Date.now(),
      miner: (worker || '').split('.')[0],
      worker: worker,
      identifier: identifier,
      share: shareType,
      solo: minerType,
      type: blockType,
      work: current,
    };
  };

  // Handle Metadata Updates
  this.handleCurrentMetadata = function(work, difficulty, roundData, shareData, shareType, minerType, blockType) {

    // Calculate Features of Metadata
    const identifier = shareData.identifier || 'master';
    const invalid = shareType === 'invalid' ? 1 : 0;
    const stale = shareType === 'stale' ? 1 : 0;
    const valid = shareType === 'valid' ? 1 : 0;
    const current = shareType === 'valid' ? shareData.difficulty : 0;

    // Calculate Effort/Efficiency Metadata
    const effort = _this.handleEffort(work, shareData.difficulty, shareType, difficulty);
    const efficiency = _this.handleEfficiency(roundData, shareType);

    // Return Metadata Updates
    return {
      timestamp: Date.now(),
      effort: minerType ? 0 : effort,
      efficiency: minerType ? 0 : efficiency,
      identifier: identifier,
      invalid: minerType ? 0 : invalid,
      solo: minerType,
      stale: minerType ? 0 : stale,
      type: blockType,
      valid: minerType ? 0 : valid,
      work: minerType ? 0 : current,
    };
  };

  // Handle Round Updates
  this.handleCurrentRounds = function(worker, workerData, shareData, shareType, minerType, blockType) {

    // Calculate Features of Rounds
    const timestamp = Date.now();
    const interval = _this.config.settings.interval.segments;
    const recent = Math.ceil(timestamp / interval) * interval;

    // Calculate Features of Round Share [1]
    const invalid = shareType === 'invalid' ? 1 : 0;
    const stale = shareType === 'stale' ? 1 : 0;
    const valid = shareType === 'valid' ? 1 : 0;

    // Calculate Features of Round Share [2]
    const identifier = shareData.identifier || 'master';
    const submitTime = shareData.submitTime || Date.now();
    const times = (Object.keys(workerData).length >= 1 && shareType === 'valid') ?
      _this.handleTimes(workerData, submitTime) : 0;
    const timesIncrement = (Object.keys(workerData).length >= 1 && shareType === 'valid') ?
      _this.handleTimesIncrement(workerData, submitTime) : 0;
    const current = shareType === 'valid' ? shareData.difficulty : 0;

    // Return Round Updates
    return {
      timestamp: timestamp,
      recent: recent,
      miner: (worker || '').split('.')[0],
      worker: worker,
      identifier: identifier,
      invalid: invalid,
      round: 'current',
      solo: minerType,
      stale: stale,
      times: times,
      times_increment: timesIncrement,
      type: blockType,
      valid: valid,
      work: current,
    };
  };

  // Handle Miner Updates
  this.handleCurrentMiners = function(worker, difficulty, shareData, shareType, minerType, blockType) {

    const output = {
      timestamp: Date.now(),
      miner: (worker || '').split('.')[0],
      type: blockType,
    };

    // Calculate Effort Metadata
    if (minerType) {
      const effort = _this.handleEffortIncrement(shareData.difficulty, shareType, difficulty);
      output.solo_effort = effort;
    }
    
    // Return Miner Updates
    return output;
  };

  // Handle Current Worker Updates
  this.handleCurrentWorkers = function(worker, difficulty, shareData, shareType, minerType, blockType) {

    const timestamp = Date.now();

    // Calculate Effort Metadata
    const effort = _this.handleEffortIncrement(shareData.difficulty, shareType, difficulty);

    const identifier = shareData.identifier || 'master';
    let ip = 'unknown';
    let ipHash = 'unknown';
    let ipOctet = -1;

    if (shareData.ip) {
      const ipIndex = shareData.ip.split(':').length - 1;
      ip = shareData.ip.split(':')[ipIndex];
      ipHash = utils.createHash(ip);
      ipOctet = Number(ip.split('.')[3]);
    };

    // Return Miner Updates
    return {
      timestamp: timestamp,
      miner: (worker || '').split('.')[0],
      worker: worker,
      effort: effort,
      identifier: identifier,
      ip_hash: ipHash,
      last_octet: ipOctet,
      last_share: timestamp,
      offline_tag: false,
      solo: minerType,
      type: blockType,
    };
  };

  // Handle Historical Metadata Updates
  this.handleHistoricalMetadata = function(shareData, shareType, minerType, blockType) {

    const identifier = shareData.identifier || 'master';
    const tenMinutes = 600000;
    const timestamp = shareData.submitTime || Date.now();
    const recent = Math.ceil(timestamp / tenMinutes) * tenMinutes;

    // Calculate Features of Pools
    const work = shareType === 'valid' ? shareData.difficulty : 0;

    // Return Metadata Updates
    return {
      timestamp: timestamp,
      recent: recent,
      identifier: identifier,
      solo: minerType,
      type: blockType,
      work: work,
    };
  };

  // Handle Historical Miner Updates
  this.handleHistoricalMiners = function(worker, shareData, shareType, minerType, blockType) {

    const tenMinutes = 600000;
    const timestamp = shareData.submitTime || Date.now();
    const recent = Math.ceil(timestamp / tenMinutes) * tenMinutes;

    // Calculate Features of Miners
    const invalid = shareType === 'invalid' ? 1 : 0;
    const stale = shareType === 'stale' ? 1 : 0;
    const valid = shareType === 'valid' ? 1 : 0;
    const current = shareType === 'valid' ? shareData.difficulty : 0;

    // Return Miner Updates
    return {
      timestamp: timestamp,
      recent: recent,
      miner: (worker || '').split('.')[0],
      invalid: invalid,
      solo: minerType,
      stale: stale,
      type: blockType,
      valid: valid,
      work: current,
    };
  };

  // Handle Historical Worker Updates
  this.handleHistoricalWorkers = function(worker, shareData, shareType, minerType, blockType) {

    const tenMinutes = 600000;
    const timestamp = shareData.submitTime || Date.now();
    const recent = Math.ceil(timestamp / tenMinutes) * tenMinutes;
    const identifier = shareData.identifier || 'master';

    // Calculate Features of Workers
    const invalid = shareType === 'invalid' ? 1 : 0;
    const stale = shareType === 'stale' ? 1 : 0;
    const valid = shareType === 'valid' ? 1 : 0;
    const current = shareType === 'valid' ? shareData.difficulty : 0;

    // Return Worker Updates
    return {
      timestamp: timestamp,
      recent: recent,
      miner: (worker || '').split('.')[0],
      worker: worker,
      identifier: identifier,
      invalid: invalid,
      solo: minerType,
      stale: stale,
      type: blockType,
      valid: valid,
      work: current,
    };
  };

  // Handle Current/Historical Metadata Block Updates
  this.handleMetadataBlocks = function(shareData, minerType, blockType) {

    const identifier = shareData.identifier || 'master';
    const timestamp = shareData.submitTime || Date.now();
    const tenMinutes = 600000;
    const recent = Math.ceil(timestamp / tenMinutes) * tenMinutes;

    // Return Worker Updates
    return {
      timestamp: timestamp,
      recent: recent,
      blocks: 1,
      identifier: identifier,
      solo: minerType,
      type: blockType,
    };
  };

  // Handle Primary Updates
  this.handlePrimary = function(lookups, shareData, shareType, minerType, callback) {

    // Build Round Update Data
    const blockIdentifier = uuid.v4();
    const miner = (shareData.addrPrimary || '').split('.')[0];

    // Establish Specific Lookups
    const metadataWork = lookups[1].rows.map(el => el.work).reduce((a, b) => a + b, 0) || 0;
    const round = lookups[3].rows[0] || {};
    const work = minerType ? (round.work || 0) : metadataWork;

    // Build Round Block to Submit
    const blocks = _this.handleCurrentBlocks(
      work, shareData.addrPrimary, shareData.blockDiffPrimary, blockIdentifier, shareData,
      shareType, minerType, 'primary');

    // Build Round Update Transactions
    const metadataBlocks = _this.handleMetadataBlocks(shareData, minerType, 'primary');
    const workersReset = (minerType) ? (
    _this.master.current.workers.updateCurrentSoloWorkersRoundsReset(_this.pool, Date.now(), miner, 'primary')) : (
    _this.master.current.workers.updateCurrentSharedWorkersRoundsReset(_this.pool, Date.now(), 'primary'));
    const primaryUpdate = (minerType) ? (
      _this.master.current.rounds.updateCurrentRoundsMainSolo(_this.pool, miner, blockIdentifier, 'primary')) : (
      _this.master.current.rounds.updateCurrentRoundsMainShared(_this.pool, blockIdentifier, 'primary'));
    
    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.master.current.blocks.insertCurrentBlocksMain(_this.pool, [blocks]),
      _this.master.current.metadata.insertCurrentMetadataBlocks(_this.pool, [metadataBlocks]),
      _this.master.historical.metadata.insertHistoricalMetadataBlocks(_this.pool, [metadataBlocks]),
      workersReset,
      primaryUpdate];
    if (minerType) {
      transaction.push(_this.master.current.miners.insertCurrentMinersRoundsReset(_this.pool, Date.now(), miner, 'primary')); // new
    } else {
      transaction.push(_this.master.current.metadata.insertCurrentMetadataRoundsReset(_this.pool, Date.now(), minerType, 'primary'));
    }

    transaction.push('COMMIT;');

    // Insert Work into Database
    _this.master.executor(transaction, () => callback());
  };

  // Handle Auxiliary Updates
  this.handleAuxiliary = function(lookups, shareData, shareType, minerType, callback) {

    // Build Round Update Data
    const blockIdentifier = uuid.v4();
    const miner = (shareData.addrAuxiliary || '').split('.')[0];

    // Establish Specific Lookups
    const metadataWork = lookups[2].rows.map(el => el.work).reduce((a, b) => a + b, 0) || 0;
    const round = lookups[4].rows[0] || {};
    const work = minerType ? (round.work || 0) : metadataWork;

    // Build Round Block to Submit
    const blocks = _this.handleCurrentBlocks(
      work, shareData.addrAuxiliary, shareData.blockDiffAuxiliary, blockIdentifier, shareData,
      shareType, minerType, 'auxiliary');

    // Build Round Update Transactions
    const metadataBlocks = _this.handleMetadataBlocks(shareData, minerType, 'auxiliary');
    const workersReset = (minerType) ? (
    _this.master.current.workers.updateCurrentSoloWorkersRoundsReset(_this.pool, Date.now(), miner, 'auxiliary')) : (
    _this.master.current.workers.updateCurrentSharedWorkersRoundsReset(_this.pool, Date.now(), 'auxiliary'));
    const auxiliaryUpdate = (minerType) ? (
      _this.master.current.rounds.updateCurrentRoundsMainSolo(_this.pool, miner, blockIdentifier, 'auxiliary')) : (
      _this.master.current.rounds.updateCurrentRoundsMainShared(_this.pool, blockIdentifier, 'auxiliary'));
      
    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.master.current.blocks.insertCurrentBlocksMain(_this.pool, [blocks]),
      _this.master.current.metadata.insertCurrentMetadataBlocks(_this.pool, [metadataBlocks]),
      _this.master.historical.metadata.insertHistoricalMetadataBlocks(_this.pool, [metadataBlocks]),
      workersReset,
      auxiliaryUpdate];
    if (minerType) {
      transaction.push(_this.master.current.miners.insertCurrentMinersRoundsReset(_this.pool, Date.now(), miner, 'auxiliary'));
    } else {
      transaction.push(_this.master.current.metadata.insertCurrentMetadataRoundsReset(_this.pool, Date.now(), minerType, 'auxiliary'));
    }

    transaction.push('COMMIT;');

    // Insert Work into Database
    _this.master.executor(transaction, () => callback());
  };

  // Handle Share Updates
  this.handleShares = function(lookups, shareData, shareType, minerType, callback) {
    const identifier = shareData.identifier || 'master';
    const miner = shareData.addrPrimary.split('.')[0];

    // Establish Specific Lookups
    const metadata = lookups[1].rows.filter(el => el.identifier === identifier)[0] || {};    
    const round = lookups[3].rows[0] || {};
    const user = lookups[5].rows[0] || {};
    const work = minerType ? (round.work || 0) : (metadata.work || 0);
    
    // Handle Updates
    const hashrateUpdates = _this.handleCurrentHashrate(
      shareData.addrPrimary, shareData.difficulty, shareData, shareType, minerType, 'primary');
    const metadataUpdates = _this.handleCurrentMetadata(
      work, shareData.blockDiffPrimary, metadata, shareData, shareType, minerType, 'primary');
    const roundUpdates = _this.handleCurrentRounds(
      shareData.addrPrimary, round, shareData, shareType, minerType, 'primary');
    const currentWorkerUpdates = _this.handleCurrentWorkers(
      shareData.addrPrimary, shareData.blockDiffPrimary, shareData, shareType, minerType, 'primary');
    const historicalWorkerUpdates = _this.handleHistoricalWorkers(
      shareData.addrPrimary, shareData, shareType, minerType, 'primary');
    const historicalMinerUpdates = _this.handleHistoricalMiners(
      shareData.addrPrimary, shareData, shareType, minerType, 'primary');
    const historicalMetadataUpdates = _this.handleHistoricalMetadata(
      shareData, shareType, minerType, 'primary');
    const currentMinerUpdates = _this.handleCurrentMiners(
      shareData.addrPrimary, shareData.blockDiffPrimary, shareData, shareType, minerType, 'primary');

    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.master.current.hashrate.insertCurrentHashrateMain(_this.pool, [hashrateUpdates]),
      _this.master.current.metadata.insertCurrentMetadataRounds(_this.pool, [metadataUpdates]),
      _this.master.current.rounds.insertCurrentRoundsMain(_this.pool, [roundUpdates]),
      _this.master.current.workers.insertCurrentWorkersRounds(_this.pool, [currentWorkerUpdates]),
      _this.master.historical.workers.insertHistoricalWorkersRounds(_this.pool, [historicalWorkerUpdates]),
      _this.master.historical.miners.insertHistoricalMinersMain(_this.pool, [historicalMinerUpdates]),
      _this.master.historical.metadata.insertHistoricalMetadataRounds(_this.pool, [historicalMetadataUpdates])];

    if (minerType) {
      transaction.push(_this.master.current.miners.insertCurrentMinersSoloRounds(_this.pool, [currentMinerUpdates]));
    } else {
      transaction.push(_this.master.current.miners.insertCurrentMinersSharedRounds(_this.pool, [currentMinerUpdates]));
    };

    // Create New User
    if (user.miner != miner) {
      const userData = {
        miner: miner,
        joined: shareData.submitTime || Date.now(),
        payout_limit: config.primary.payments.minPayment
      };
      transaction.push(_this.master.current.users.createCurrentUser(_this.pool, userData));
    };

    // Add Support for Auxiliary Handling
    if (_this.config.auxiliary && _this.config.auxiliary.enabled) {

      // Establish Specific Lookups
      const auxMetadata = lookups[2].rows[0] || {};
      const auxRound = lookups[4].rows[0] || {};

      const auxWork = minerType ? (auxRound.work || 0) : (auxMetadata.work || 0);

      // Handle Updates
      const auxHashrateUpdates = _this.handleCurrentHashrate(
        shareData.addrAuxiliary, shareData.difficulty, shareData, shareType, minerType, 'auxiliary');
      const auxMetadataUpdates = _this.handleCurrentMetadata(
        auxWork, shareData.blockDiffAuxiliary, auxMetadata, shareData, shareType, minerType, 'auxiliary');
      const auxRoundUpdates = _this.handleCurrentRounds(
        shareData.addrAuxiliary, auxRound, shareData, shareType, minerType, 'auxiliary');
      const auxCurrentWorkerUpdates = _this.handleCurrentWorkers(
        shareData.addrAuxiliary, shareData.blockDiffAuxiliary, shareData, shareType, minerType, 'auxiliary');
      const auxHistoricalWorkerUpdates = _this.handleHistoricalWorkers(
        shareData.addrAuxiliary, shareData, shareType, minerType, 'auxiliary');
      const auxHistoricalMinerUpdates = _this.handleHistoricalMiners(
        shareData.addrAuxiliary, shareData, shareType, minerType, 'auxiliary');
      const auxHistoricalMetadataUpdates = _this.handleHistoricalMetadata(
        shareData, shareType, minerType, 'auxiliary');
      const auxCurrentMinerUpdates = _this.handleCurrentMiners(
        shareData.addrAuxiliary, shareData.blockDiffAuxiliary, shareData, shareType, minerType, 'auxiliary');

      transaction.push(_this.master.current.hashrate.insertCurrentHashrateMain(_this.pool, [auxHashrateUpdates]));
      transaction.push(_this.master.current.metadata.insertCurrentMetadataRounds(_this.pool, [auxMetadataUpdates]));
      transaction.push(_this.master.current.rounds.insertCurrentRoundsMain(_this.pool, [auxRoundUpdates]));
      transaction.push(_this.master.current.workers.insertCurrentWorkersRounds(_this.pool, [auxCurrentWorkerUpdates]));
      transaction.push(_this.master.historical.workers.insertHistoricalWorkersRounds(_this.pool, [auxHistoricalWorkerUpdates]));
      transaction.push(_this.master.historical.miners.insertHistoricalMinersMain(_this.pool, [auxHistoricalMinerUpdates]));
      transaction.push(_this.master.historical.metadata.insertHistoricalMetadataRounds(_this.pool, [auxHistoricalMetadataUpdates]));

      if (minerType) {
        transaction.push(_this.master.current.miners.insertCurrentMinersSoloRounds(_this.pool, [auxCurrentMinerUpdates]));
      } else {
        transaction.push(_this.master.current.miners.insertCurrentMinersSharedRounds(_this.pool, [auxCurrentMinerUpdates]));
      };
    }

    // Insert Work into Database
    transaction.push('COMMIT;');
    _this.master.executor(transaction, () => callback());
  };

  // Handle Share/Block Submissions
  this.handleSubmissions = function(shareData, shareValid, blockValid, callback) {

    // Calculate Share Features
    const minerType = utils.checkSoloMining(_this.config, shareData);
    let shareType = 'valid';
    if (shareData.error && shareData.error === 'job not found') shareType = 'stale';
    else if (!shareValid || shareData.error) shareType = 'invalid';

    // Build Round Parameters
    const miner = shareData.addrPrimary.split('.')[0];
    const parameters = { worker: shareData.addrPrimary, solo: minerType, type: 'primary', order: 'timestamp', direction: 'descending', limit: 1 };
    const auxParameters = { worker: shareData.addrAuxiliary, solo: minerType, type: 'auxiliary', order: 'timestamp', direction: 'descending', limit: 1 };

    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.master.current.metadata.selectCurrentMetadataMain(_this.pool, { solo: minerType, type: 'primary' }),
      _this.master.current.metadata.selectCurrentMetadataMain(_this.pool, { solo: minerType, type: 'auxiliary' }),
      _this.master.current.rounds.selectCurrentRoundsMain(_this.pool, parameters),
      _this.master.current.rounds.selectCurrentRoundsMain(_this.pool, auxParameters),
      _this.master.current.users.selectCurrentUsers(_this.pool, { miner: miner }),
      'COMMIT;'];

    // Establish Separate Behavior
    switch (shareData.blockType) {

    // Primary Behavior
    case 'primary':
      _this.master.executor(transaction, (lookups) => {
        _this.handleShares(lookups, shareData, shareType, minerType, () => {
          if (blockValid) _this.handlePrimary(lookups, shareData, shareType, minerType, () => callback());
          else callback();
        });
      });
      break;

    // Auxiliary Behavior
    case 'auxiliary':
      _this.master.executor(transaction, (lookups) => {
        _this.handleShares(lookups, shareData, shareType, minerType, () => {
          if (blockValid) _this.handleAuxiliary(lookups, shareData, shareType, minerType, () => callback());
          else callback();
        });
      });
      break;

    // Share Behavior
    case 'share':
      _this.master.executor(transaction, (lookups) => {
        _this.handleShares(lookups, shareData, shareType, minerType, () => {
          const type = (shareType === 'valid') ? 'log' : 'error';
          const lines = [(shareType === 'valid') ?
            _this.text.sharesSubmissionsText1(
              shareData.difficulty, shareData.shareDiff, shareData.addrPrimary, shareData.ip) :
            _this.text.sharesSubmissionsText2(shareData.error, shareData.addrPrimary, shareData.ip)];
          _this.logger[type]('Shares', _this.config.name, lines);
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
};

module.exports = Shares;
