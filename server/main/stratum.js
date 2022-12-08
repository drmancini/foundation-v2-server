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

  this.difficulties = {};

  // Database Variables
  this.executor = _this.client.commands.executor;
  this.current = _this.client.commands.current;

  // Stratum Variables
  process.setMaxListeners(0);
  this.forkId = process.env.forkId;
  
  // Geenerate Difficulty Cache From Rounds Data
  this.parseDifficultyCache = function(blockType, callback) {
    const timestamp = Date.now();
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
            if (round.round in workers[round.worker]) {
              workers[round.worker][round.round].times = Math.max(workers[round.worker][round.round].times, round.times);
              workers[round.worker][round.round].valid += round.valid;
              workers[round.worker][round.round].work += round.work;
            } else {
              workers[round.worker][round.round] = {
                times: round.times,
                valid: round.valid,
                work: round.work,
              }
            }
          } else {
            workers[round.worker] = {
              times: 0,
              valid: 0,
              work: 0,
            };
            workers[round.worker][round.round] = {
              times: round.times,
              valid: round.valid,
              work: round.work,
            };
          };
        });
      }

      for (const [worker, rounds] of Object.entries(workers)) {
        for (const [round, data] of Object.entries(rounds)) {
          if(round != 'valid' && round != 'times' && round != 'work') {
            workers[worker].times += data.times;
            workers[worker].valid += data.valid;
            workers[worker].work += data.work;
            delete workers[worker][round];
          }
        } 
      };

      Object.keys(workers).forEach(worker => {
        const diffPerSecond = workers[worker].work / workers[worker].times;
        delete workers[worker];
        workers[worker] = diffPerSecond;
      });

      callback(workers);
    });    
  };
  
  // Create Worker Difficulty Cache
  this.handleDifficultyCache = function(callback) {
    if (_this.configMain.difficultyCache) {
      _this.parseDifficultyCache('primary', (primaryDiff) => {
        callback(primaryDiff);
      })
    } else {
      console.log('cache disabled')
        callback({});
    }
  };
  
  // Build Stratum from Configuration
  /* istanbul ignore next */
  // this.handleStratum = function() {
  this.handleStratum = function(difficulties) {
    // Build Stratum Server
    _this.stratum = _this.template.builder(_this.config, _this.configMain, difficulties, () => {});
    // _this.stratum = _this.template.builder(_this.config, _this.configMain, () => {});

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
    _this.handleStratum();
    _this.stratum.setupPrimaryDaemons(() => {
    _this.stratum.setupPorts();
    _this.stratum.setupSettings(() => {
    _this.stratum.setupRecipients();
    _this.stratum.setupManager();
    _this.stratum.setupPrimaryBlockchain(() => {
    _this.stratum.setupFirstJob(() => {
    _this.stratum.setupBlockPolling(() => {
    _this.stratum.setupNetwork(() => {
      _this.outputStratum()
      callback()
    })

    // Too Much Indentation
    })})})})});
  }
};

module.exports = Stratum;
