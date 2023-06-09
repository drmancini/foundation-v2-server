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
    historical: _this.client.master.commands.historical};
  this.worker = {
    executor: _this.client.worker.commands.executor,
    local: _this.client.worker.commands.local };

  // Handle Effort Updates
  this.handleEffort = function(share, difficulty, work, shareType) {
    const total = shareType === 'valid' ? (work + (share.clientdiff || 0)) : work;
    return parseFloat(((total / difficulty * 100) || 0).toPrecision(5));
  };

  // Handle IP Address Hash
  this.handleIpHash = function(share) {

    // IP Address Hash
    let ipHash = 'unknown';

    if (share.ip) {
      const ipIndex = share.ip.split(':').length - 1;
      ip = share.ip.split(':')[ipIndex];
      ipHash = utils.createHash(ip);
    };

    return ipHash;
  }

  // Handle Last IP Address Octet
  this.handleLastOctet = function(share) {

    let lastOctet = -1;

    if (share.ip) {
      const ipIndex = share.ip.split(':').length - 1;
      const ip = share.ip.split(':')[ipIndex];
      lastOctet = Number(ip.split('.')[3]);
    };

    return lastOctet;
  }

  // Handle Times Updates
  this.handleTimes = function(sharePrevious, timestamp) {
    let times = sharePrevious.times || 0;
    const lastTime = parseFloat(sharePrevious.submitted) || Date.now();
    const timeChange = utils.roundTo(Math.max(timestamp - lastTime, 0) / 1000, 4);
    if (timeChange < 900) times += timeChange;
    return Math.round(times * 10000) / 10000;
  };

  // Handle Times Updates
  this.handleTimesInitial = function(shareInitial, timestamp, interval) {
    const initialTime = shareInitial.times || 0;
    const lastTime = parseFloat(shareInitial.submitted) || Date.now();
    const previousRecent = Math.floor(timestamp / interval) * interval;
    let times = lastTime > previousRecent ? initialTime : 0;
    const timeChange = utils.roundTo(Math.max(timestamp - lastTime, 0) / 1000, 4);
    if (timeChange < 900) times += timeChange;
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
    round.forEach((snapshot) => {
      const unique = `${ snapshot.miner }_${ snapshot.solo }`;
      miners[unique] = snapshot
    });
    return miners;
  };

  // Handle Users Processing
  this.handleUsersLookups = function(users) {
    return users.map(user => user.miner);
  }

  // Handle Workers Processing
  this.handleWorkersLookups = function(round) {
    const workers = {};
    round.forEach((snapshot) => {
      const unique = `${ snapshot.worker }_${ snapshot.ip_hash }_${ snapshot.solo }`;
      workers[unique] = snapshot
    });
    return workers;
  };

  // Handle Blocks Updates
  this.handleCurrentBlocks = function(metadata, miner, share, shareType, minerType, blockType) {

    const timestamp = Date.now();

    // Calculate Features of Blocks
    const identifier = share.identifier || 'master';
    const difficulty = blockType === 'primary' ? share.blockdiffprimary : share.blockdiffauxiliary;
    const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary;
    const metadataWork = metadata.reduce((a, b) => a + b.work, 0) || 0;
    const work = minerType ? (miner.work || 0) : (metadataWork || 0);

    // Calculate Luck for Block
    const luck = _this.handleEffort(share, difficulty, work, shareType);

    // Return Blocks Updates
    return {
      timestamp: timestamp,
      submitted: share.submitted || timestamp,
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

  // Handle Metadata Block Update
  this.handleMetadataBlock = function(share, minerType, blockType) {

    // Set Time Values
    const submitTime = share.submitTime || Date.now();
    const interval = _this.config.settings.interval.historical;
    const recent = Math.ceil(submitTime / interval) * interval;

    // Return Blocks Updates
    return {
      timestamp: Date.now(),
      recent: recent,
      blocks: 1,
      identifier: share.identifier || 'master',
      solo: minerType,
      type: blockType
    };
  };

  // Handle Hashrate Updates
  this.handleCurrentHashrate = function(share, shareType, minerType, blockType) {

    // Calculate Features of Hashrate
    const current = shareType === 'valid' ? share.clientdiff : 0;
    const identifier = share.identifier || 'master';
    const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary;
    const ipHash = _this.handleIpHash(share);

    // Return Hashrate Updates
    return {
      timestamp: Date.now(),
      miner: (worker || '').split('.')[0],
      worker: worker,
      identifier: identifier,
      ip_hash: ipHash,
      share: shareType,
      solo: minerType,
      type: blockType,
      work: current,
    };
  };

  // Handle Metadata Updates
  this.handleCurrentMetadata = function(updates, share, shareType, blockType) {

    // Calculate Features of Metadata
    const invalid = (updates.invalid || 0) + (shareType === 'invalid' ? 1 : 0);
    const stale = (updates.stale || 0) + (shareType === 'stale' ? 1 : 0);
    const valid = (updates.valid || 0) + (shareType === 'valid' ? 1 : 0);
    const current = (updates.work || 0) + (shareType === 'valid' ? share.clientdiff : 0);
    
    // Calculate Effort Metadata
    const difficulty = blockType === 'primary' ? share.blockdiffprimary : share.blockdiffauxiliary;
    const effort = parseFloat((current / difficulty * 100).toPrecision(5)) || 0;

    // Return Metadata Updates
    return {
      timestamp: Date.now(),
      effort: effort,
      identifier: share.identifier,
      invalid: invalid,
      solo: false,
      stale: stale,
      type: blockType,
      valid: valid,
      work: current,
    };
  };

  // Handle Miner Updates
  this.handleCurrentMiners = function(updates, share, shareType, minerType, blockType) {

    // Calculate Features of Metadata
    const current = (updates.work || 0) + (shareType === 'valid' ? share.clientdiff : 0);
    const difficulty = blockType === 'primary' ? share.blockdiffprimary : share.blockdiffauxiliary;
    const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary;
    const work = updates.work || 0;

    // Calculate Effort Metadata
    const effort = _this.handleEffort(share, difficulty, work, shareType);

    // Return Metadata Updates
    return {
      timestamp: Date.now(),
      miner: (worker || '').split('.')[0],
      effort: effort,
      solo: minerType,
      type: blockType,
      work: current,
    };
  };

  // Handle Round Updates
  this.handleCurrentRounds = function(initial, updates, share, ipHash, shareType, minerType, blockType) {

    // Calculate Timing Features
    const timestamp = Date.now()
    const submitted = share.submitted || timestamp;
    const interval = _this.config.settings.interval.historical;
    const recent = minerType ? 0 : Math.ceil(submitted / interval) * interval;

    // Calculate Features of Rounds [1]
    const invalid = (updates.invalid || 0) + (shareType === 'invalid' ? 1 : 0);
    const stale = (updates.stale || 0) + (shareType === 'stale' ? 1 : 0);
    const valid = (updates.valid || 0) + (shareType === 'valid' ? 1 : 0);
    const current = (updates.work || 0) + (shareType === 'valid' ? share.clientdiff : 0);
    const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary;

    // Calculate Features of Rounds [2]
    const identifier = share.identifier || 'master';
    let times = 0;
    if (shareType === 'valid') {
      times = Object.keys(updates).length >= 1 ? _this.handleTimes(updates, submitted) : 
        _this.handleTimesInitial(initial, submitted, interval);
    }

    // Cap Times at Maximum Value
    times = Math.min(times, interval / 1000);

    // Return Round Updates
    return {
      timestamp: timestamp,
      submitted: parseFloat(submitted),
      recent: recent,
      miner: (worker || '').split('.')[0],
      worker: worker,
      identifier: identifier,
      invalid: invalid,
      ip_hash: ipHash,
      round: 'current',
      solo: minerType,
      stale: stale,
      times: times,
      type: blockType,
      valid: valid,
      work: current,
    };
  };

  // Handle Historical Metadata Updates
  this.handleHistoricalMetadata = function(updates, share, shareType, blockType) {

    // Set Time Values
    const submitTime = share.submitTime || Date.now();
    const interval = _this.config.settings.interval.historical;
    const recent = Math.ceil(submitTime / interval) * interval;

    // Calculate Features of Metadata
    const invalid = (updates.invalid || 0) + (shareType === 'invalid' ? 1 : 0);
    const stale = (updates.stale || 0) + (shareType === 'stale' ? 1 : 0);
    const valid = (updates.valid || 0) + (shareType === 'valid' ? 1 : 0);
    const current = (updates.work || 0) + (shareType === 'valid' ? share.clientdiff : 0);

    // Return Metadata Updates
    return {
      timestamp: Date.now(),
      recent: recent,
      identifier: share.identifier,
      invalid: invalid,
      solo: false,
      stale: stale,
      type: blockType,
      valid: valid,
      work: current,
    };
  };

  // Handle Historical Worker Updates
  this.handleHistoricalWorkers = function(updates, share, ipHash, shareType, minerType, blockType) {

    // Determine Current Round States
    const timestamp = Date.now();
    const submitTime = share.submitTime || timestamp;
    const interval = _this.config.settings.interval.historical;
    const recent = Math.ceil(submitTime / interval) * interval;

    // Calculate Features of Metadata
    const invalid = (updates.invalid || 0) + (shareType === 'invalid' ? 1 : 0);
    const stale = (updates.stale || 0) + (shareType === 'stale' ? 1 : 0);
    const valid = (updates.valid || 0) + (shareType === 'valid' ? 1 : 0);
    const current = (updates.work || 0) + (shareType === 'valid' ? share.clientdiff : 0);
    const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary;

    // Return Metadata Updates
    return {
      timestamp: timestamp,
      recent: recent,
      miner: (worker || '').split('.')[0],
      worker: worker,
      identifier: share.identifier || 'master',
      invalid: invalid,
      ip_hash: ipHash,
      solo: minerType,
      stale: stale,
      type: blockType,
      valid: valid,
      work: current,
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
  this.handleMetadata = function(shares, blockType) {

    // Handle Individual Shares
    const combined = [];
    let updates = {};
    shares.forEach((share) => {

      // Calculate Share Features
      let shareType = 'valid';
      if (share.error && share.error === 'job not found') shareType = 'stale';
      else if (!share.sharevalid || share.error) shareType = 'invalid';
      
      // Check If Metadata Should be Updated
      if (!utils.checkSoloMining(_this.config, share)) {
        const metadata = updates[share.identifier] || {};
        updates[share.identifier] = _this.handleCurrentMetadata(metadata, share, shareType, blockType);
      }
    });

    // Transform Result to Array
    for (const [key, value] of Object.entries(updates)) {
      combined.push(value);
    }

    // Return Metadata Updates
    return combined;
  };

  // Handle Metadata History Updates
  this.handleMetadataHistory = function(shares, blockType) {

    // Handle Individual Shares
    const combined = [];
    let updates = {};
    shares.forEach((share) => {
      
      // Calculate Share Features
      let shareType = 'valid';
      if (share.error && share.error === 'job not found') shareType = 'stale';
      else if (!share.sharevalid || share.error) shareType = 'invalid';
      
      // Check If Metadata Should be Updated
      if (!utils.checkSoloMining(_this.config, share)) {
        const metadata = updates[share.identifier] || {};
        updates[share.identifier] = _this.handleHistoricalMetadata(metadata, share, shareType, blockType);
      }
    });

    // Return Metadata Updates
    return Object.values(updates);
  };

  // Handle Miner Updates
  this.handleMiners = function(shares, blockType) {

    // Handle Individual Shares
    const updates = {};
    shares.forEach((share) => {

      // Calculate Share Features
      let shareType = 'valid';
      const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary;
      if (share.error && share.error === 'job not found') shareType = 'stale';
      else if (!share.sharevalid || share.error) shareType = 'invalid';

      // Determine Current Miner States
      const miner = (worker || '').split('.')[0];
      const minerType = utils.checkSoloMining(_this.config, share);
      const uniqueMiner = `${ miner }_${ minerType }`;
      const current = updates[uniqueMiner] || {};

      // Determine Updates for Solo Miner
      if (!minerType)
        updates[uniqueMiner] = _this.handleCurrentMiners(current, share, shareType, minerType, blockType);
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
      const ipHash = _this.handleIpHash(share);
      const minerType = utils.checkSoloMining(_this.config, share);
      const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary;
      if (share.error && share.error === 'job not found') shareType = 'stale';
      else if (!share.sharevalid || share.error) shareType = 'invalid';

      // Determine Current Round States
      const submitTime = share.submitTime || Date.now();
      const interval = _this.config.settings.interval.recent;
      const recent = minerType ? 0 : Math.ceil(submitTime / interval) * interval;
      const initial = rounds[`${ worker }_${ ipHash }_${ minerType }`] || {};
      const current = updates[`${ worker }_${ ipHash }_${ recent }_${ minerType }`] || {};

      const segment = _this.handleCurrentRounds(initial, current, share, ipHash, shareType, minerType, blockType);
      updates[`${ worker }_${ ipHash }_${ segment.recent }_${ segment.solo }`] = segment;
    });

    // Return Round Updates
    return Object.values(updates);
  };

  // Handle User Updates
  this.handleUsers = function(users, shares, blockType) {

    // Handle Individual Shares
    const updates = [];
    shares.forEach((share) => {

      const timestamp = Date.now();
      const payoutLimit = _this.config[blockType].payments.defaultPayment;
      const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary;
      const miner = (worker || '').split('.')[0];
      const usersFound = users.filter(user => user == miner).length;
      if (usersFound === 0) {
        updates.push({
          timestamp: timestamp,
          miner: miner,
          joined: share.submitTime || timestamp,
          payout_limit: payoutLimit,
          type: blockType,
        });
      }      
    });

    // Return Users Updates
    return updates;
  };

  // Handle Worker Updates
  this.handleWorkers = function(shares, blockType) {

    // Handle Individual Shares
    const updates = {};
    shares.forEach((share) => {

      // Get Share Properties
      const timestamp = Date.now();
      const identifier = share.identifier || 'master';
      const minerType = utils.checkSoloMining(_this.config, share);
      const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary;

      // Determine Share IP Address Properties
      const ipHash = _this.handleIpHash(share);
      const lastOctet = _this.handleLastOctet(share);
      
      // Determine Current Worker States
      const uniqueWorker = `${ worker }_${ ipHash }_${ minerType }`;
      const current = updates[uniqueWorker] || {};
      const lastShare = Math.max((Number(current.last_share) || 0), Number(share.submitted || timestamp));

      const currentWorker = {
        timestamp: timestamp,
        miner: (worker || '').split('.')[0],
        worker: worker,
        identifier: identifier,
        ip_hash: ipHash,
        last_octet: lastOctet,
        last_share: lastShare,
        offline_tag: false,
        solo: minerType,
        type: blockType,
      };

      updates[uniqueWorker] = currentWorker;
    });

    // Return Worker Updates
    return Object.values(updates);
  };

  // Handle Worker History Updates
  this.handleWorkersHistory = function(shares, blockType) {

    // Handle Individual Shares
    const updates = {};
    shares.forEach((share) => {

      // Calculate Share Features
      const ipHash = _this.handleIpHash(share);
      const minerType = utils.checkSoloMining(_this.config, share);
      const worker = blockType === 'primary' ? share.addrprimary : share.addrauxiliary;
      const uniqueWorker = `${ worker }_${ ipHash }_${ minerType }`;
      let shareType = 'valid';
      if (share.error && share.error === 'job not found') shareType = 'stale';
      else if (!share.sharevalid || share.error) shareType = 'invalid';

      // Determine Current Worker States
      const current = updates[uniqueWorker] || {};

      // Determine Updates for Worker
      updates[uniqueWorker] = _this.handleHistoricalWorkers(current, share, ipHash, shareType, minerType, blockType);
    });

    // Return Worker Updates
    return Object.values(updates);
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
    _this.worker.executor(transaction, () => callback());
  };

  // Handle Round Updates
  this.handleUpdates = function(lookups, shares, callback) {

    // Build Combined Transaction
    const transaction = ['BEGIN;'];

    // Handle Individual Lookups
    const rounds = _this.handleWorkersLookups(lookups[5].rows);
    const auxRounds = _this.handleWorkersLookups(lookups[6].rows);
    const users = _this.handleUsersLookups(lookups[7].rows);
    const auxUsers = _this.handleUsersLookups(lookups[8].rows);

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
    const metadataUpdates = _this.handleMetadata(shares, 'primary');
    if (metadataUpdates.length >= 1) {
      transaction.push(_this.master.current.metadata.insertCurrentMetadataRounds(_this.pool, metadataUpdates));
      if (_this.config.auxiliary && _this.config.auxiliary.enabled) {
        const auxMetadataUpdates = _this.handleMetadata(shares, 'auxiliary');
        transaction.push(_this.master.current.metadata.insertCurrentMetadataRounds(_this.pool, auxMetadataUpdates));
      }
    }

    // Handle Historical Metadata Updates
    const metadataHistoryUpdates = _this.handleMetadataHistory(shares, 'primary');
    if (Object.keys(metadataHistoryUpdates).length >= 1) {
      transaction.push(_this.master.historical.metadata.insertHistoricalMetadataRounds(_this.pool, metadataHistoryUpdates));
      if (_this.config.auxiliary && _this.config.auxiliary.enabled) {
        const auxMetadataHistoryUpdates = _this.handleMetadataHistory(shares, 'auxiliary');
        transaction.push(_this.master.historical.metadata.insertHistoricalMetadataRounds(_this.pool, auxMetadataHistoryUpdates));
      }
    }

    // Handle Miner Updates
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

    // Handle Worker Updates
    const workerUpdates = _this.handleWorkers(shares, 'primary');
    if (workerUpdates.length >= 1) {
      transaction.push(_this.master.current.workers.insertCurrentWorkersRounds(_this.pool, workerUpdates));
      if (_this.config.auxiliary && _this.config.auxiliary.enabled) {
        const auxWorkerUpdates = _this.handleWorkers(shares, 'auxiliary');
        transaction.push(_this.master.current.workers.insertCurrentWorkersRounds(_this.pool, auxWorkerUpdates));
      }
    }

    // Handle Worker History Updates
    const workerHistoryUpdates = _this.handleWorkersHistory(shares, 'primary');
    if (workerHistoryUpdates.length >= 1) {
      transaction.push(_this.master.historical.workers.insertHistoricalWorkersRounds(_this.pool, workerHistoryUpdates));
      if (_this.config.auxiliary && _this.config.auxiliary.enabled) {
        const auxWorkerHistoryUpdates = _this.handleWorkersHistory(shares, 'auxiliary');
        transaction.push(_this.master.historical.workers.insertHistoricalWorkersRounds(_this.pool, auxWorkerHistoryUpdates));
      }
    }

    // Insert Work into Database
    transaction.push('COMMIT;');
    _this.master.executor(transaction, () => callback());
  };

  // Handle Primary Blocks
  this.handlePrimary = function(lookups, shares, callback) {

    const timestamp = Date.now();

    // Calculate Block Features
    const block = shares[0];
    const minerType = utils.checkSoloMining(_this.config, block);
    const miner = (block.addrprimary || '').split('.')[0];

    // Handle Individual Lookups
    const metadata = lookups[1].rows;
    const filteredMetadata = metadata.filter((entry) => entry.solo === minerType);
    
    // Take solo miner data and grab work
    const miners = lookups[3].rows;
    const currentMiner = miners.filter((entry) => entry.miner === miner && entry.solo === minerType)[0];

    // Determine Updates for Block
    const blockUpdates = _this.handleCurrentBlocks(filteredMetadata, currentMiner, block, 'valid', minerType, 'primary');
    const metadataBlocks = _this.handleMetadataBlock(block, minerType, 'primary');
    const roundUpdates = (minerType) ? (
      _this.master.current.rounds.updateCurrentRoundsMainSolo(_this.pool, miner, blockUpdates.round, 'primary')) : (
      _this.master.current.rounds.updateCurrentRoundsMainShared(_this.pool, blockUpdates.round, 'primary'));
    const roundReset = (minerType) ? (
      _this.master.current.miners.updateCurrentSoloMinersReset(_this.pool, timestamp, miner, 'primary')) : (
      _this.master.current.metadata.updateCurrentMetadataSharedRoundsReset(_this.pool, timestamp, 'primary'));

    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.master.current.blocks.insertCurrentBlocksMain(_this.pool, [blockUpdates]),
      _this.master.current.metadata.insertCurrentMetadataBlocks(_this.pool, [metadataBlocks]),
      _this.master.historical.metadata.insertHistoricalMetadataBlocks(_this.pool, [metadataBlocks]),
      roundUpdates,
      roundReset,
      'COMMIT;'];

    // Insert Work into Database
    _this.master.executor(transaction, () => callback());
  };

  // UPDATE
  // Handle Auxiliary Blocks
  this.handleAuxiliary = function(lookups, shares, callback) {

    const timestamp = Date.now();

    // Calculate Block Features
    const block = shares[0];
    const minerType = utils.checkSoloMining(_this.config, block);
    const miner = (block.addrauxiliary || '').split('.')[0];

    // Handle Individual Lookups
    const metadata = lookups[1].rows;
    const filteredMetadata = metadata.filter((entry) => entry.solo === minerType) || {};
    
    // Take solo miner data and grab work
    const miners = lookups[3].rows;
    const currentMiner = miners.filter((entry) => entry.miner === miner && entry.solo === minerType)[0] || {};

    // Determine Updates for Block
    const blockUpdates = _this.handleCurrentBlocks(filteredMetadata, currentMiner, block, 'valid', minerType, 'auxiliary');
    const metadataBlocks = _this.handleMetadataBlock(block, minerType, 'auxiliary');
    const roundUpdates = (minerType) ? (
      _this.master.current.rounds.updateCurrentRoundsMainSolo(_this.pool, miner, blockUpdates.round, 'auxiliary')) : (
      _this.master.current.rounds.updateCurrentRoundsMainShared(_this.pool, blockUpdates.round, 'auxiliary'));
    const roundReset = (minerType) ? (
      _this.master.current.miners.updateCurrentSoloMinersReset(_this.pool, timestamp, miner, 'auxiliary')) : (
      _this.master.current.metadata.updateCurrentMetadataSharedRoundsReset(_this.pool, timestamp, 'auxiliary'));

    // Build Combined Transaction
    const transaction = [
      'BEGIN;',
      _this.master.current.blocks.insertCurrentBlocksMain(_this.pool, [blockUpdates]),
      _this.master.current.metadata.insertCurrentMetadataBlocks(_this.pool, [metadataBlocks]),
      _this.master.historical.metadata.insertHistoricalMetadataBlocks(_this.pool, [metadataBlocks]),
      roundUpdates,
      roundReset,
      'COMMIT;'];

    // Insert Work into Database
    _this.master.executor(transaction, () => callback());
  };

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
      _this.master.current.miners.selectCurrentMinersBatchAddresses(_this.pool, addrPrimaryMiners, 'primary'),
      _this.master.current.miners.selectCurrentMinersBatchAddresses(_this.pool, addrAuxiliaryMiners, 'auxiliary'),
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

      // Determine Number of Shares Being Processed
      const capacity = Math.round(shares.length / _this.config.settings.batch.limit * 1000) / 10;
      const lines = [_this.text.roundsHandlingText1(capacity)];
      _this.logger.debug('Rounds', _this.config.name, lines);

      // Segments Exist to Validate
      if (segments.length >= 1) {
        async.series(segments.map((segment) => {
          return (cb) => _this.handleSegments(segment, cb);
        }), (error) => {
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

    // Calculate Rounds Features
    const limit = _this.config.settings.batch.limit;
    const updateWindow = Date.now() - _this.config.settings.window.updates;

    // Build Combined Transaction
    const parameters = { order: 'submitted', direction: 'ascending', limit: limit };
    const transaction = [
      'BEGIN;',
      _this.worker.local.shares.selectLocalSharesMain(_this.pool, parameters),
      _this.worker.local.transactions.deleteLocalTransactionsInactive(_this.pool, updateWindow),
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
      if (_this.config.settings.batch.enabled) _this.handleRounds(() => {});
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
