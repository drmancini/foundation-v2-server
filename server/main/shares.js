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

  // Client Handlers
  this.worker = {
    executor: _this.client.worker.commands.executor,
    local: _this.client.worker.commands.local };

  // Handle Share Updates
  this.handleLocalShares = function(shareData, shareValid, blockValid) {

    // Calculate Features of Shares
    const identifier = uuid.v4();
    const error = shareData.error || '';
    const submitted = shareData.submitTime || Date.now();
    const transaction = shareData.transaction || '';

    // Return Share Updates
    return {
      error: error,
      uuid: identifier,
      timestamp: Date.now(),
      submitted: submitted,
      ip: shareData.ip || '0.0.0.0',
      port: parseFloat(shareData.port || '0'),
      addrprimary: shareData.addrPrimary || '',
      addrauxiliary: shareData.addrAuxiliary || '',
      blockdiffprimary: shareData.blockDiffPrimary || -1,
      blockdiffauxiliary: shareData.blockDiffAuxiliary || -1,
      blockvalid: blockValid || false,
      blocktype: shareData.blockType || 'share',
      clientdiff: shareData.difficulty || -1,
      hash: shareData.hash || '',
      height: shareData.height || -1,
      identifier: shareData.identifier || '',
      reward: shareData.reward || -1,
      sharediff: shareData.shareDiff || -1,
      sharevalid: shareValid || false,
      transaction: transaction || '',
    };
  };

  // Handle Share/Block Updates
  this.handleShares = function(shareData, shareValid, blockValid, callback) {

    // Build Combined Transaction
    const shares = _this.handleLocalShares(shareData, shareValid, blockValid);
    const transaction = [
      'BEGIN;',
      _this.worker.local.shares.insertLocalSharesMain(_this.pool, [shares]),
      'COMMIT;'];

    // Insert Work into Database
    _this.worker.executor(transaction, () => callback());
  };

  // Handle Share/Block Submissions
  this.handleSubmissions = function(shareData, shareValid, blockValid, callback) {

    // Calculate Share Features
    let shareType = 'valid';
    if (shareData.error && shareData.error === 'job not found') shareType = 'stale';
    else if (!shareValid || shareData.error) shareType = 'invalid';

    // Add Share/Block Data to Local Table
    _this.handleShares(shareData, shareValid, blockValid, () => {
      const type = (shareType === 'valid') ? 'log' : 'error';
      const address = shareData.addrPrimary || 'anonymous'
      const targetDiff = utils.roundTo(shareData.difficulty, 4);
      const actualDiff = utils.roundTo(shareData.shareDiff, 4) || 0;
      const lines = [(shareType === 'valid') ?
        _this.text.sharesSubmissionsText1(
          targetDiff, actualDiff, address, shareData.ip) :
        _this.text.sharesSubmissionsText2(shareData.error, address, shareData.ip)];
      _this.logger[type]('Shares', _this.config.name, lines);
      callback();
    });
  };
};

module.exports = Shares;