const Network = require('./network');
const Shares = require('./shares');
const Text = require('../../locales/index');

////////////////////////////////////////////////////////////////////////////////

// Main Stratum Function
const Stratum = function (logger, client, config, configMain, template) {

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

  // Stratum Variables
  process.setMaxListeners(0);
  this.forkId = process.env.forkId;
  
  // Geenerate Difficulty Cache From Rounds Data
  this.parseDifficultyCache = function(blockType, callback) {
    const timestamp = Date.now();
    const difficulties = {};
    const cutoff = timestamp - 6 * 60 * 60 * 1000;
    const parameters = {
      identifier: _this.configMain.identifier,
      type: blockType,
      timestamp: 'gt' + cutoff,
    };

    const transaction = [
      'BEGIN;',
      _this.current.rounds.selectCurrentRoundsMain(_this.pool, parameters),
      'COMMIT;'];
    
    _this.executor(transaction, (lookups) => {
      const workers = {};
      if (lookups[1].rowCount > 0) {
        lookups[1].rows.forEach(round => {
          if (round.worker in workers) {
            workers[round.worker].times += round.times;
            workers[round.worker].valid += round.valid;
            workers[round.worker].work += round.work;
          } else {
            workers[round.worker] = {
              times: round.times,
              valid: round.valid,
              work: round.work,
            };
          };
        });
      }

      Object.keys(workers).forEach(worker => {
        const diffPerSecond = workers[worker].work / workers[worker].times;
        delete workers[worker];
        workers[worker] = diffPerSecond;
      });
      callback(workers);
    });    
  };
  
  // Create Primary and Auxiliary Worker Difficulty Cache
  this.handleDifficultyCache = function(callback) {
    if (_this.configMain.difficultyCache) {
      _this.parseDifficultyCache('primary', (primaryDiff) => {
        // if (_this.config.auxiliary && _this.config.auxiliary.difficultyCache) {
        //   _this.parseDifficultyCache('auxiliary', (auxiliaryDiff) => {
        //     callback({
        //       primary: primaryDiff,
        //       auxiliary: auxiliaryDiff,
        //     })
        //   });
        // } else {
        callback(primaryDiff);
        // }
      })
    };
  };
  
  // Build Stratum from Configuration
  /* istanbul ignore next */
  this.handleStratum = function(difficulties) {
    // Build Stratum Server
    _this.stratum = _this.template.builder(_this.config, _this.configMain, difficulties, () => {});

    // Handle Stratum Main Events
    _this.stratum.on('pool.started', () => {});
    _this.stratum.on('pool.log', (severity, text) => {
      _this.logger[severity]('Pool', _this.config.name, [text]);
    });

    // Handle Stratum Network Events
    _this.stratum.on('pool.network', (networkData) => {
      _this.network.handleSubmissions(networkData, () => {});
    });

    // Handle Stratum Submission Events
    _this.stratum.on('pool.share', (shareData, shareValid, blockValid) => {
      _this.shares.handleSubmissions(shareData, shareValid, blockValid, () => {});
    });
  };

  // Output Stratum Data on Startup
  /* istanbul ignore next */
  this.outputStratum = function() {

    // Build Connected Coins
    const coins = [_this.config.primary.coin.name];
    if (_this.config.auxiliary && _this.config.auxiliary.enabled) {
      coins.push(_this.config.auxiliary.coin.name);
    }

    // Build Pool Starting Message
    const output = [
      _this.text.startingMessageText1(`${ _this.config.name }`),
      _this.text.startingMessageText2(`[${ coins.join(', ') }]`),
      _this.text.startingMessageText3(_this.config.settings.testnet ? 'Testnet' : 'Mainnet'),
      _this.text.startingMessageText4(_this.stratum.statistics.ports.join(', ')),
      _this.text.startingMessageText5(_this.stratum.statistics.feePercentage * 100),
      _this.text.startingMessageText6(_this.stratum.manager.currentJob.rpcData.height),
      _this.text.startingMessageText7(_this.stratum.statistics.difficulty),
      _this.text.startingMessageText8(_this.stratum.statistics.connections),
      _this.text.startingMessageText9()];

    // Send Starting Message to Logger
    if (_this.forkId === '0') {
      _this.logger['log']('Pool', _this.config.name, output, true);
    }
  };

  // Setup Pool Stratum Capabilities
  /* eslint-disable */
  /* istanbul ignore next */
  this.setupStratum = function(callback) {
    // Build out Initial Functionality
    _this.network = new Network(logger, _this.client, _this.config, _this.configMain);
    _this.shares = new Shares(logger, _this.client, _this.config, _this.configMain);

    // Build Daemon/Stratum Functionality
    _this.handleDifficultyCache((difficulties) => {
      _this.handleStratum(difficulties);
      _this.stratum.setupPrimaryDaemons(() => {
      _this.stratum.setupAuxiliaryDaemons(() => {
      _this.stratum.setupPorts();
      _this.stratum.setupSettings(() => {
      _this.stratum.setupRecipients();
      _this.stratum.setupManager();
      _this.stratum.setupPrimaryBlockchain(() => {
      _this.stratum.setupAuxiliaryBlockchain(() => {
      _this.stratum.setupFirstJob(() => {
      _this.stratum.setupBlockPolling(() => {
      _this.stratum.setupNetwork(() => {
        _this.outputStratum()
        callback()
      })
    });

    // Too Much Indentation
    })})})})})})});
  }
};

module.exports = Stratum;
