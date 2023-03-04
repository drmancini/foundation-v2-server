const Text = require('../../locales/index');
const async = require('async');
const utils = require('./utils');
const uuid = require('uuid');

////////////////////////////////////////////////////////////////////////////////

// Main Rounds Function
const Rounds = function (logger, client, config, configMain) {

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
  this.worker = {
    executor: _this.client.worker.commands.executor,
    local: _this.client.worker.commands.local };

  // Handle Efficiency Updates
  this.handleEfficiency = function(round, shareType) {
    const valid = shareType === 'valid' ? (round.valid || 0) + 1 : (round.valid || 0);
    const total = (round.valid || 0) + (round.stale || 0) + (round.invalid || 0) + 1;
    return Math.round(((valid / total) || 0) * 10000) / 100;
  };

  // Handle Effort Updates
  this.handleEffort = function(share, difficulty, work, shareType) {
    const total = shareType === 'valid' ? (work + (share.clientdiff || 0)) : work;
    return Math.round(((total / difficulty) || 0) * 10000) / 100;
  };

  // Handle Effort Incremental Updates
  this.handleEffortIncrement = function(share, difficulty, shareType) {
    const total = shareType === 'valid' ? (share.clientdiff || 0) : 0;
    return Number((total / difficulty * 100).toPrecision(4)) || 0;
  };

  // Handle Times Updates
  this.handleTimes = function(sharePrevious, timestamp) {
    let times = sharePrevious.times || 0;
    const lastTime = parseFloat(sharePrevious.submitted) || Date.now();
    const timeChange = utils.roundTo(Math.max(timestamp - lastTime, 0) / 1000, 4);
    if (timeChange < 900) times += timeChange;
    return Math.round(times * 10000) / 10000;
  };

  // Handle Times Incremental Updates
  this.handleTimesIncrement = function(sharePrevious, timestamp) {
    const lastTime = parseFloat(sharePrevious.submitted) || Date.now();
    const timeChange = utils.roundTo(Math.max(timestamp - lastTime, 0) / 1000, 4);
    const times = timeChange < 900 ? timeChange : 0;
    return Math.round(times * 10000) / 10000;
  };

  // Process Segment Breakdown
  this.processSegments = function(shares) {
    let current = [];
    const segments = [];
    shares.forEach((share) => {
      if (share.blocktype !== 'share') {
        if (current.length >= 1) segments.push(current);
        segments.push([share]);
        current = [];
      } else current.push(share);
    });
    if (current.length >= 1) segments.push(current);
    return segments;
  };

  // Handle Miners Processing
  this.handleMinersLookups = function(round) {
    const miners = {};
    round.forEach((snapshot) => miners[snapshot.miner] = snapshot);
    return miners;
  }

  // Handle Workers Processing
  this.handleWorkersLookups = function(round) {
    const workers = {};
    round.forEach((snapshot) => workers[snapshot.worker] = snapshot);
    return workers;
  }

  // Handle Users Processing
  this.handleUsersLookups = function(users) {
    return users.map(user => user.miner);
  }

  // Handle Blocks Updates
  this.handleCurrentBlocks = function(metadata, round, share, shareType, minerType, blockType) {

    // Calculate Features of Blocks
    const identifier = share.identifier || 'master';
    const difficulty = blockType === 'primary' ? share.blockdiffprimary : share.blockdiffauxiliary;
    const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary
    const work = minerType ? (round.work || 0) : (metadata.work || 0);

    // Calculate Luck for Block
    const luck = _this.handleEffort(share, difficulty, work, shareType);

    // Return Blocks Updates
    return {
      timestamp: Date.now(),
      submitted: Date.now(),
      miner: (worker || '').split('.')[0],
      worker: worker,
      category: 'pending',
      confirmations: -1,
      difficulty: difficulty,
      hash: share.hash,
      height: share.height,
      identifier: identifier,
      luck: luck,
      reward: 0,
      round: uuid.v4(),
      solo: minerType,
      transaction: share.transaction,
      type: blockType,
    };
  };

  // Handle Hashrate Updates
  this.handleCurrentHashrate = function(share, shareType, minerType, blockType) {

    // Calculate Features of Hashrate
    const current = shareType === 'valid' ? share.clientdiff : 0;
    const identifier = share.identifier || 'master';
    const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary

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
  this.handleCurrentMetadata = function(initial, updates, share, shareType, blockType) {

    // Calculate Features of Metadata
    const minerType = utils.checkSoloMining(_this.config, share);
    const identifier = share.identifier || 'master';
    const invalid = (updates.invalid || 0) + (shareType === 'invalid' ? 1 : 0);
    const stale = (updates.stale || 0) + (shareType === 'stale' ? 1 : 0);
    const valid = (updates.valid || 0) + (shareType === 'valid' ? 1 : 0);
    const current = (updates.work || 0) + (shareType === 'valid' ? share.clientdiff : 0);
    const difficulty = blockType === 'primary' ? share.blockdiffprimary : share.blockdiffauxiliary;
    const work = (initial.work || 0) + (updates.work || 0)

    // Calculate Efficiency/Effort Metadata
    const efficiency = _this.handleEfficiency(initial, shareType);
    const effort = _this.handleEffort(share, difficulty, work, shareType);

    // Return Metadata Updates
    return {
      timestamp: Date.now(),
      efficiency: efficiency,
      effort: effort,
      identifier: identifier,
      invalid: invalid,
      solo: minerType,
      stale: stale,
      type: blockType,
      valid: valid,
      work: current,
    };
  };

  // Handle Miner Updates
  this.handleCurrentMiners = function(share, shareType, blockType) {

    // Calculate Miner Features
    const minerType = utils.checkSoloMining(_this.config, share);
    const difficulty = blockType === 'primary' ? share.blockdiffprimary : share.blockdiffauxiliary;
    const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary

    // Calculate Effort Increment for Solo Miners
    const effortIncrement = minerType ? _this.handleEffortIncrement(share, difficulty, shareType) : 0;

    // Return Miner Updates
    return {
      timestamp: Date.now(),
      miner: (worker || '').split('.')[0],
      solo_effort: effortIncrement,
      type: blockType, 
    };
  };

  // Handle Round Updates
  this.handleCurrentRounds = function(initial, updates, share, shareType, minerType, blockType) {

    // Calculate Timing Features
    const interval = _this.config.settings.interval.recent;
    const recent = minerType ? 0 : Math.ceil(share.timestamp / interval) * interval;

    // Calculate Features of Rounds [1]
    const invalid = (updates.invalid || 0) + (shareType === 'invalid' ? 1 : 0);
    const stale = (updates.stale || 0) + (shareType === 'stale' ? 1 : 0);
    const valid = (updates.valid || 0) + (shareType === 'valid' ? 1 : 0);
    const current = (updates.work || 0) + (shareType === 'valid' ? share.clientdiff : 0);
    const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary

    // Calculate Features of Rounds [2]
    const submitted = share.submitted || Date.now();
    const identifier = share.identifier || 'master';
    const times = (Object.keys(updates).length >= 1 && shareType === 'valid') ?
      _this.handleTimes(updates, submitted) : handleTimesIncrement(initial, submitted);

    // Return Round Updates
    return {
      timestamp: Date.now(),
      submitted: parseFloat(submitted),
      recent: recent,
      miner: (worker || '').split('.')[0],
      worker: worker,
      identifier: identifier,
      invalid: invalid,
      round: 'current',
      solo: minerType,
      stale: stale,
      times: times,
      times_increment: times,
      type: blockType,
      valid: valid,
      work: current,
    };
  };

  // Handle Worker Updates
  this.handleCurrentWorkers = function(share, shareType, minerType, blockType) {

    // Calculate Features of Worker
    const difficulty = blockType === 'primary' ? share.blockdiffprimary : share.blockdiffauxiliary;
    const identifier = share.identifier || 'master';
    const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary

    // Calculate Worker Effort
    const effortIncrement = _this.handleEffortIncrement(share, difficulty, shareType);

    // Process Worker IP Address
    let ip = 'unknown';
    let ipHash = 'unknown';
    let ipOctet = -1;

    if (share.ip) {
      const ipIndex = share.ip.split(':').length - 1;
      ip = share.ip.split(':')[ipIndex];
      ipHash = utils.createHash(ip);
      ipOctet = Number(ip.split('.')[3]);
    };
    
    // Return Worker Updates
    return {
      timestamp: Date.now(),
      miner: (worker || '').split('.')[0],
      worker: worker,
      effort: effortIncrement,
      identifier: identifier,
      ip_hash: ipHash,
      last_octet: ipOctet,
      last_share: share.submitted || Date.now(),
      offline_tag: false,
      solo: minerType,
      type: blockType,
    };
  }

  // Handle Metadata Blocks Updates
  this.handleHistoricalMetadataBlocks = function(share, minerType, blockType) {

    // Set Time Values
    const timestamp = share.submitTime || Date.now();
    const tenMinutes = 600000;
    const recent = Math.ceil(timestamp / tenMinutes) * tenMinutes;

    // Calculate Features of Blocks
    const identifier = share.identifier || 'master';
    
    // Return Metadata Updates
    return {
      timestamp: timestamp,
      recent: recent,
      blocks: 1,
      identifier: identifier,
      solo: minerType,
      type: blockType,
    };
  };

  // Handle Hashrate Updates
  this.handleHashrate = function(shares, blockType) {

    // Handle Individual Shares
    const updates = [];
    shares.forEach((share) => {

      // Calculate Share Features
      let shareType = 'valid';
      const minerType = utils.checkSoloMining(_this.config, share);
      if (share.error && share.error === 'job not found') shareType = 'stale';
      else if (!share.sharevalid || share.error) shareType = 'invalid';

      // Check If Share is Still Valid
      if (Date.now() - _this.config.settings.window.hashrate <= share.timestamp) {
        updates.push(_this.handleCurrentHashrate(share, shareType, minerType, blockType));
      }
    });

    // Return Hashrate Updates
    return updates;
  };

  // Handle Metadata Updates
  this.handleMetadata = function(metadata, shares, blockType) {

    // Handle Individual Shares
    let updates = [];
    shares.forEach((share) => {

      // Select Relevant Metadata Region
      const filtered = metadata.filter(region => region.identifier === share.identifier)[0] || [];

      // Calculate Share Features
      let shareType = 'valid';
      if (share.error && share.error === 'job not found') shareType = 'stale';
      else if (!share.sharevalid || share.error) shareType = 'invalid';

      // Check If Metadata Should be Updated
      if (!utils.checkSoloMining(_this.config, share)) {
        const identifierIndex = updates.findIndex(el => (el.identifier === share.identifier));
        if (identifierIndex > -1) {
          updates[identifierIndex] = _this.handleCurrentMetadata(
            filtered, updates[identifierIndex], share, shareType, blockType);
        } else {
          updates.push(_this.handleCurrentMetadata(filtered, {}, share, shareType, blockType));
        }
      }
    });

    // Return Metadata Updates
    return updates;
  };

  // Handle Miner Updates
  this.handleMiners = function(shares, blockType) {

    // Handle Individual Shares
    const updates = {};
    shares.forEach((share) => {

      // Calculate Share Features
      let shareType = 'valid';
      const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary
      if (share.error && share.error === 'job not found') shareType = 'stale';
      else if (!share.sharevalid || share.error) shareType = 'invalid';

      // Determine Current Miner States
      const miner = (worker || '').split('.')[0];

      // Determine Updates for Miner
      updates[miner] = _this.handleCurrentMiners(share, shareType, blockType)
    });

    // Return Miner Updates
    return Object.values(updates);
  };

  // Handle Share Updates
  this.handleShares = function(rounds, shares, blockType) {

    // Handle Individual Shares
    const updates = {};
    shares.forEach((share) => {

      // Calculate Share Features
      let shareType = 'valid';
      const minerType = utils.checkSoloMining(_this.config, share);
      const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary
      if (share.error && share.error === 'job not found') shareType = 'stale';
      else if (!share.sharevalid || share.error) shareType = 'invalid';

      // Determine Current Round States
      const interval = _this.config.settings.interval.recent;
      const recent = minerType ? 0 : Math.ceil(share.timestamp / interval) * interval; // why 0?
      const initial = rounds[worker] || {};
      const current = updates[`${ worker }_${ recent }_${ minerType }`] || {};

      const segment = _this.handleCurrentRounds(initial, current, share, shareType, minerType, blockType);
      updates[`${ worker }_${ segment.recent }_${ segment.solo }`] = segment;
    });

    // Return Round Updates
    return Object.values(updates);
  }

  // Handle Worker Updates
  this.handleWorkers = function(shares, blockType) {

    // Handle Individual Shares
    const updates = {};
    shares.forEach((share) => {

      // Calculate Share Features
      const minerType = utils.checkSoloMining(_this.config, share);
      let shareType = 'valid';
      const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary
      if (share.error && share.error === 'job not found') shareType = 'stale';
      else if (!share.sharevalid || share.error) shareType = 'invalid';

      // Determine Updates for Worker
      updates[worker] = _this.handleCurrentWorkers(share, shareType, minerType, blockType)
    });

    // Return Worker Updates
    return Object.values(updates);
  };

  // Handle Historical Metadata Updates
  this.handleHistoricalMetadata = function(shares, blockType) {

    // Handle Individual Shares
    let updates = [];
    shares.forEach((share) => {

      // Set Time Values
      const tenMinutes = 600000;
      const timestamp = share.submitTime || Date.now();
      const recent = Math.ceil(timestamp / tenMinutes) * tenMinutes;

      // Set Types
      const minerType = utils.checkSoloMining(_this.config, share);
      let shareType = 'valid';
      if (share.error && share.error === 'job not found') shareType = 'stale';
      else if (!share.sharevalid || share.error) shareType = 'invalid';

      // Calculate Share Features
      const identifier = share.identifier || 'master';
      const work = shareType === 'valid' ? share.clientdiff : 0;
      
      // Create Metadata Update
      const identifierIndex = updates.findIndex(el => 
        (el.identifier === share.identifier && el.recent === recent && el.solo === minerType));
      if (identifierIndex > -1) {
        updates[identifierIndex].work += work;
      } else {
        updates.push({
          timestamp: Date.now(),
          recent: recent,
          identifier: identifier,
          solo: minerType,
          type: blockType,
          work: work,
        });
      }
    });

    // Return Metadata Updates
    return updates;
  };

  // Handle Historical Miner Updates
  this.handleHistoricalMiners = function(shares, blockType) {

    // Handle Individual Shares
    const updates = [];
    shares.forEach((share) => {

      // Set Time Values
      const tenMinutes = 600000;
      const timestamp = share.submitTime || Date.now();
      const recent = Math.ceil(timestamp / tenMinutes) * tenMinutes;

      // Set Types
      let shareType = 'valid';
      if (share.error && share.error === 'job not found') shareType = 'stale';
      else if (!share.sharevalid || share.error) shareType = 'invalid';

      // Calculate Share Features
      const invalid = shareType === 'invalid' ? 1 : 0;
      const stale = shareType === 'stale' ? 1 : 0;
      const valid = shareType === 'valid' ? 1 : 0;
      const work = shareType === 'valid' ? share.clientdiff : 0;
      const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary;
      const miner = (worker || '').split('.')[0];
      
      // Create Miner Updates
      const identifierIndex = updates.findIndex(el => (
        el.recent === recent && el.miner == miner));
      if (identifierIndex > -1) {
        updates[identifierIndex].invalid += invalid;
        updates[identifierIndex].stale += stale;
        updates[identifierIndex].valid += valid;
        updates[identifierIndex].work += work;
      } else {
        updates.push({
          timestamp: Date.now(),
          recent: recent,
          miner: miner,
          invalid: invalid,
          stale: stale,
          type: blockType,
          valid: valid,
          work: work,
        });
      }
    });

    // Return Miner Updates
    return updates;
  };

  // Handle Historical Worker Updates
  this.handleHistoricalWorkers = function(shares, blockType) {

    // Handle Individual Shares
    const updates = [];
    shares.forEach((share) => {

      // Set Time Values
      const tenMinutes = 600000;
      const timestamp = share.submitTime || Date.now();
      const recent = Math.ceil(timestamp / tenMinutes) * tenMinutes;

      // Set Types
      const minerType = utils.checkSoloMining(_this.config, share);
      let shareType = 'valid';
      if (share.error && share.error === 'job not found') shareType = 'stale';
      else if (!share.sharevalid || share.error) shareType = 'invalid';

      // Calculate Share Features
      const identifier = share.identifier || 'master';
      const invalid = shareType === 'invalid' ? 1 : 0;
      const stale = shareType === 'stale' ? 1 : 0;
      const valid = shareType === 'valid' ? 1 : 0;
      const work = shareType === 'valid' ? share.clientdiff : 0;
      const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary;
      
      // Create Miner Updates
      const identifierIndex = updates.findIndex(el => (
        el.recent === recent && el.worker == worker && el.solo === minerType));
      if (identifierIndex > -1) {
        updates[identifierIndex].invalid += invalid;
        updates[identifierIndex].stale += stale;
        updates[identifierIndex].valid += valid;
        updates[identifierIndex].work += work;
      } else {
        updates.push({
          timestamp: Date.now(),
          recent: recent,
          miner: (worker || '').split('.')[0],
          worker: worker,
          identifier: identifier,
          invalid: invalid,
          solo: minerType,
          stale: stale,
          type: blockType,
          valid: valid,
          work: work,
        });
      }
    });

    // Return Miner Updates
    return updates;
  };

  // Handle User Updates
  this.handleUsers = function(users, shares, blockType) {

    // Handle Individual Shares
    const updates = [];
    shares.forEach((share) => {

      const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary;
      const miner = (worker || '').split('.')[0];
      const usersFound = users.filter(user => user == miner).length;
      if (usersFound === 0) {
        updates.push({
          miner: miner,
          joined: share.submitTime || Date.now(),
          payout_limit: config.primary.payments.minPayment,
          type: blockType,
        });
      }      
    });

    // Return Users Updates
    return updates;
  };


  // Handle Local Share/Transactions Cleanup
  this.handleCleanup = function(segment, callback) {

    // Build Combined Transaction
    const segmentDelete = segment.map((share) => `'${ share.uuid }'`);
    const transaction = [
      'BEGIN;',
      _this.worker.local.shares.deleteLocalSharesMain(_this.pool, segmentDelete),
      _this.worker.local.transactions.deleteLocalTransactionsMain(_this.pool, segmentDelete),
      'COMMIT;'];

    // Insert Work into Database
    _this.master.executor(transaction, () => callback());
  }

  // Handle Round Updates
  this.handleUpdates = function(lookups, shares, callback) {

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Handle Metadata Lookups
    const metadata = lookups[1].rows || [];
    const auxMetadata = lookups[2].rows[0] || {};

    // Handle Individual Lookups
    const rounds = _this.handleWorkersLookups(lookups[3].rows);
    const auxRounds = _this.handleWorkersLookups(lookups[4].rows);
    const users = _this.handleUsersLookups(lookups[5].rows);
    const auxUsers = _this.handleUsersLookups(lookups[6].rows);

    // Handle Hashrate Updates
    const hashrateUpdates = _this.handleHashrate(shares, 'primary');
    if (hashrateUpdates.length >= 1) {
      transaction.push(_this.master.current.hashrate.insertCurrentHashrateMain(_this.pool, hashrateUpdates));
      if (_this.config.auxiliary && _this.config.auxiliary.enabled) {
        const auxHashrateUpdates = _this.handleHashrate(shares, 'auxiliary');
        transaction.push(_this.master.current.hashrate.insertCurrentHashrateMain(_this.pool, auxHashrateUpdates));
      }
    }

    // Handle Current Metadata Updates
    const metadataUpdates = _this.handleMetadata(metadata, shares, 'primary');
    if (metadataUpdates.length >= 1) {
      transaction.push(_this.master.current.metadata.insertCurrentMetadataRounds(_this.pool, metadataUpdates));
      if (_this.config.auxiliary && _this.config.auxiliary.enabled) {
        const auxMetadataUpdates = _this.handleMetadata(auxMetadata, shares, 'auxiliary');
        transaction.push(_this.master.current.metadata.insertCurrentMetadataRounds(_this.pool, auxMetadataUpdates));
      }
    }

    // Handle Current Miner Updates
    const minerUpdates = _this.handleMiners(shares, 'primary');
    if (minerUpdates.length >= 1) {
      transaction.push(_this.master.current.miners.insertCurrentMinersRounds(_this.pool, minerUpdates));
      if (_this.config.auxiliary && _this.config.auxiliary.enabled) {
        const auxMinerUpdates = _this.handleMiners(shares, 'auxiliary');
        transaction.push(_this.master.current.miners.insertCurrentMinersRounds(_this.pool, auxMinerUpdates));
      }
    }

    // Handle Round Updates
    const roundUpdates = _this.handleShares(rounds, shares, 'primary');
    if (roundUpdates.length >= 1) {
      transaction.push(_this.master.current.rounds.insertCurrentRoundsMain(_this.pool, roundUpdates));
      if (_this.config.auxiliary && _this.config.auxiliary.enabled) {
        const auxRoundUpdates = _this.handleShares(auxRounds, shares, 'auxiliary');
        transaction.push(_this.master.current.rounds.insertCurrentRoundsMain(_this.pool, auxRoundUpdates));
      }
    }

    // Handle Current Worker Updates
    const workerUpdates = _this.handleWorkers(shares, 'primary');
    if (workerUpdates.length >= 1) {
      transaction.push(_this.master.current.workers.insertCurrentWorkersRounds(_this.pool, workerUpdates));
      if (_this.config.auxiliary && _this.config.auxiliary.enabled) {
        const auxWorkerUpdates = _this.handleWorkers(shares, 'auxiliary');
        transaction.push(_this.master.current.workers.insertCurrentWorkersRounds(_this.pool, auxWorkerUpdates));
      }
    }

    // Handle Historical Metadata Updates
    const historicalMetadataUpdates = _this.handleHistoricalMetadata(shares, 'primary');
    if (historicalMetadataUpdates.length >= 1) {
      transaction.push(_this.master.historical.metadata.insertHistoricalMetadataRounds(
        _this.pool, historicalMetadataUpdates));
      if (_this.config.auxiliary && _this.config.auxiliary.enabled) {
        const auxHistoricalMetadataUpdates = _this.handleHistoricalMetadata(auxMetadata, shares, 'auxiliary');
        transaction.push(_this.master.historical.metadata.insertHistoricalMetadataRounds(
          _this.pool, auxHistoricalMetadataUpdates));
      }
    }

    // Handle Historical Miner Updates
    const historicalMinerUpdates = _this.handleHistoricalMiners(shares, 'primary');
    if (minerUpdates.length >= 1) {
      transaction.push(_this.master.historical.miners.insertHistoricalMinersMain(
        _this.pool, historicalMinerUpdates));
      if (_this.config.auxiliary && _this.config.auxiliary.enabled) {
        const auxHistoricalMinerUpdates = _this.handleHistoricalMiners(shares, 'auxiliary');
        transaction.push(_this.master.historical.miners.insertHistoricalMinersMain(
          _this.pool, auxHistoricalMinerUpdates));
      }
    }

    // Handle Historical Worker Updates
    const historicalWorkerUpdates = _this.handleHistoricalWorkers(shares, 'primary');
    if (minerUpdates.length >= 1) {
      transaction.push(_this.master.historical.workers.insertHistoricalWorkersRounds(
        _this.pool, historicalWorkerUpdates));
      if (_this.config.auxiliary && _this.config.auxiliary.enabled) {
        const auxHistoricalWorkerUpdates = _this.handleHistoricalWorkers(shares, 'auxiliary');
        transaction.push(_this.master.historical.workers.insertHistoricalWorkersRounds(
          _this.pool, auxHistoricalWorkerUpdates));
      }
    }

    // Handle User Updates
    const userUpdates = _this.handleUsers(users, shares, 'primary');
    if (userUpdates.length >= 1) {
      transaction.push(_this.master.current.users.createCurrentUsers(
        _this.pool, userUpdates));
      if (_this.config.auxiliary && _this.config.auxiliary.enabled) {
        const auxUserUpdates = _this.handleUsers(auxUsers, shares, 'auxiliary');
        transaction.push(_this.master.current.users.createCurrentUsers(
          _this.pool, auxUserUpdates));
      }
    }

    // Insert Work into Database
    transaction.push('COMMIT;');

    _this.master.executor(transaction, () => callback());
  };

  // Handle Primary Blocks
  this.handlePrimary = function(lookups, shares, callback) {

    // Calculate Block Features
    let shareType = 'valid';
    const block = shares[0] || {};
    const identifier = block.identifier || 'master';
    const minerType = utils.checkSoloMining(_this.config, block);
    const miner = (block.addrprimary || '').split('.')[0];
    if (block.error && block.error === 'job not found') shareType = 'stale';
    else if (!block.sharevalid || block.error) shareType = 'invalid';

    // Handle Individual Lookups
    const metadata = lookups[1].rows.filter(region => region.identifier === identifier)[0] || {};
    const rounds = _this.handleWorkersLookups(lookups[3].rows);
    const round = rounds[block.addrprimary] || {};

    // Determine Updates for Block
    const blockUpdates = _this.handleCurrentBlocks(metadata, round, block, 'valid', minerType, 'primary');
    const metadataBlocks = { timestamp: Date.now(), blocks: 1, identifier: identifier, solo: minerType,
      type: 'primary' };
    const roundUpdates = (minerType) ? (
      _this.master.current.rounds.updateCurrentRoundsMainSolo(_this.pool, miner, blockUpdates.round, 'primary')) : (
      _this.master.current.rounds.updateCurrentRoundsMainShared(_this.pool, blockUpdates.round, 'primary'));
    const roundReset = (minerType) ? (
      _this.master.current.miners.insertCurrentMinersRoundsReset(_this.pool, Date.now(), miner, 'primary')) : (
      _this.master.current.metadata.insertCurrentMetadataRoundsReset(_this.pool,
        Date.now(), minerType, 'primary'));
    const workersReset = (minerType) ? (
      _this.master.current.workers.updateCurrentSoloWorkersRoundsReset(_this.pool, Date.now(), miner, 'primary')) : (
      _this.master.current.workers.updateCurrentSharedWorkersRoundsReset(_this.pool, Date.now(), 'primary'));
    const historicalMetadataBlocks = _this.handleHistoricalMetadataBlocks = (block, minerType, 'primary');

    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.master.current.blocks.insertCurrentBlocksMain(_this.pool, [blockUpdates]),
      _this.master.current.metadata.insertCurrentMetadataBlocks(_this.pool, [metadataBlocks]),
      roundUpdates,
      roundReset,
      workersReset,
      _this.master.historical.metadata.insertHistoricalMetadataBlocks(_this.pool, [historicalMetadataBlocks]),
      'COMMIT;'];
      
    // Insert Work into Database
    _this.master.executor(transaction, () => callback());
  }

  // Handle Auxiliary Blocks
  this.handleAuxiliary = function(lookups, shares, callback) {

    // Calculate Block Features
    const block = shares[0];
    const identifier = block.identifier || 'master';
    const minerType = utils.checkSoloMining(_this.config, block);
    const miner = (block.addrauxiliary || '').split('.')[0];

    // Handle Individual Lookups
    const metadata = lookups[2].rows.filter(region => region.identifier === identifier)[0] || {};
    const rounds = _this.handleWorkersLookups(lookups[4].rows);
    const round = rounds[block.addrauxiliary] || {};

    // Determine Updates for Block
    const blockUpdates = _this.handleCurrentBlocks(metadata, block, round, shareType, minerType, 'auxiliary');
    const metadataBlocks = { timestamp: Date.now(), blocks: 1, identifier: identifier, solo: minerType, 
      type: 'auxiliary' };
    const roundUpdates = (minerType) ? (
      _this.master.current.rounds.updateCurrentRoundsMainSolo(_this.pool, miner, blockUpdates.round, 'auxiliary')) : (
      _this.master.current.rounds.updateCurrentRoundsMainShared(_this.pool, blockUpdates.round, 'auxiliary'));
    const roundReset = (minerType) ? (
      _this.master.current.miners.insertCurrentMinersRoundsReset(_this.pool, Date.now(), miner, 'auxiliary')) : (
      _this.master.current.metadata.insertCurrentMetadataRoundsReset(_this.pool,
        Date.now(), minerType, 'auxiliary'));
    const workersReset = (minerType) ? (
      _this.master.current.workers.updateCurrentSoloWorkersRoundsReset(_this.pool, Date.now(), miner, 'auxiliary')) : (
      _this.master.current.workers.updateCurrentSharedWorkersRoundsReset(_this.pool, Date.now(), 'auxiliary'));
    const historicalMetadataBlocks = _this.handleHistoricalMetadataBlocks = (block, minerType, 'auxiliary');

    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.master.current.blocks.insertCurrentBlocksMain(_this.pool, [blockUpdates]),
      _this.master.current.metadata.insertCurrentMetadataBlocks(_this.pool, [metadataBlocks]),
      roundUpdates,
      roundReset,
      workersReset,
      _this.master.historical.metadata.insertHistoricalMetadataBlocks(_this.pool, [historicalMetadataBlocks]),
      'COMMIT;'];

    // Insert Work into Database
    _this.master.executor(transaction, () => callback());
  }

  // Handle Segment Batches
  this.handleSegments = function(segment, callback) {

    // Initialize Designators
    const addrPrimaryMiners = [];
    const addrAuxiliaryMiners = [];
    const addrPrimaryWorkers = [];
    const addrAuxiliaryWorkers = [];

    // Handle Individual Shares
    segment.forEach((share) => {
      const primaryMiner = `'${ (share.addrprimary || '').split('.')[0] }'`;
      const auxiliaryMiner = `'${ (share.addrauxiliary || '').split('.')[0] }'`;
      const primaryWorker = `'${ share.addrprimary }'`;
      const auxiliaryWorker = `'${ share.addrauxiliary }'`;

      // Handle Share Designations
      if (!(addrPrimaryMiners.includes(primaryMiner))) addrPrimaryMiners.push(primaryMiner);
      if (!(addrAuxiliaryMiners.includes(auxiliaryMiner))) addrAuxiliaryMiners.push(auxiliaryMiner);
      if (!(addrPrimaryWorkers.includes(primaryWorker))) addrPrimaryWorkers.push(primaryWorker);
      if (!(addrAuxiliaryWorkers.includes(auxiliaryWorker))) addrAuxiliaryWorkers.push(auxiliaryWorker);
    });

    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.master.current.metadata.selectCurrentMetadataMain(_this.pool, { type: 'primary' }),
      _this.master.current.metadata.selectCurrentMetadataMain(_this.pool, { type: 'auxiliary' }),
      _this.master.current.rounds.selectCurrentRoundsBatchAddresses(_this.pool, addrPrimaryWorkers, 'primary'),
      _this.master.current.rounds.selectCurrentRoundsBatchAddresses(_this.pool, addrAuxiliaryWorkers, 'auxiliary'),
      _this.master.current.users.selectCurrentUsersBatchAddresses(_this.pool, addrPrimaryMiners, 'primary'),
      _this.master.current.users.selectCurrentUsersBatchAddresses(_this.pool, addrAuxiliaryMiners, 'auxiliary'),
      'COMMIT;'];

    // Establish Separate Behavior
    switch ((segment[0] || {}).blocktype) {

    // Primary Behavior
    case 'primary':
      _this.master.executor(transaction, (lookups) => {
        _this.handleUpdates(lookups, segment, () => {
          if (segment[0].blockvalid) _this.handlePrimary(lookups, segment, () => {
            _this.handleCleanup(segment, () => callback());
          });
          else _this.handleCleanup(segment, () => callback());
          _this.handleCleanup(segment, () => callback());
        });
      });
      break;

    // Auxiliary Behavior
    case 'auxiliary':
      _this.master.executor(transaction, (lookups) => {
        _this.handleUpdates(lookups, segment, () => {
          if (segment[0].blockvalid) _this.handleAuxiliary(lookups, segment, () => {
            _this.handleCleanup(segment, () => callback());
          });
          else _this.handleCleanup(segment, () => callback());
        });
      });
      break;

    // Share Behavior
    case 'share':
      _this.master.executor(transaction, (lookups) => {
        _this.handleUpdates(lookups, segment, () => {
          _this.handleCleanup(segment, () => callback());
        });
      });
      break;

    // Default Behavior
    default:
      callback();
      break;
    }
  };

  // Handle Share/Block Batches
  /* istanbul ignore next */
  this.handleBatches = function(lookups, callback) {

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Build Checks for Each Block
    const checks = [];
    if (lookups[1].rows[0]) {
      lookups[1].rows.forEach((share) => {
        checks.push({ timestamp: Date.now(), uuid: share.uuid, type: share.blocktype });
      });
    }

    // Add Checks to Transactions Table
    if (checks.length >= 1) {
      transaction.push(_this.worker.local.transactions.insertLocalTransactionsMain(_this.pool, checks));
    }

    // Determine Specific Shares for Each Thread
    transaction.push('COMMIT;');
    _this.worker.executor(transaction, (results) => {
      results = results[1].rows.map((share) => share.uuid);
      const shares = lookups[1].rows.filter((share) => results.includes((share || {}).uuid));
      const segments = _this.processSegments(shares);

      // Segments Exist to Validate
      if (segments.length >= 1) {
        async.series(segments.map((segment) => {
          return (cb) => _this.handleSegments(segment, cb)
        }), (error, results) => {
          const updates = [(error) ?
            _this.text.databaseCommandsText2(JSON.stringify(error)) :
            _this.text.databaseUpdatesText6(shares.length)];
          _this.logger.debug('Rounds', _this.config.name, updates);
          callback();
        });

      // No Blocks Exist to Validate
      } else {
        const updates = [_this.text.databaseUpdatesText7()];
        _this.logger.debug('Rounds', _this.config.name, updates);
        callback();
      }
    });
  };

  // Handle Rounds Updates
  /* istanbul ignore next */
  this.handleRounds = function(callback) {

    // Handle Initial Logging
    const starting = [_this.text.databaseStartingText4()];
    _this.logger.debug('Rounds', _this.config.name, starting);

    // Build Combined Transaction
    const parameters = { order: 'submitted', direction: 'ascending', limit: 100 };
    const transaction = [
      'BEGIN;',
      _this.worker.local.shares.selectLocalSharesMain(_this.pool, parameters),
      'COMMIT;'];

    // Establish Separate Behavior
    _this.worker.executor(transaction, (lookups) => {
      _this.handleBatches(lookups, callback);
    });
  };

  // Start Rounds Interval Management
  /* istanbul ignore next */
  this.handleInterval = function() {
    const interval = _this.config.settings.interval.rounds;
    setTimeout(() => {
      _this.handleInterval();
      _this.handleRounds(() => {});
    }, interval);
  };

  // Start Rounds Capabilities
  /* istanbul ignore next */
  this.setupRounds = function(callback) {
    const interval = _this.config.settings.interval.rounds;
    const numForks = utils.countProcessForks(_this.configMain);
    const timing = parseFloat(_this.forkId) * interval / numForks;
    setTimeout(() => _this.handleInterval(), timing);
    callback();
  };
};

module.exports = Rounds;