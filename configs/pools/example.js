/*
 *
 * Example (Bitcoin)
 *
 */

// Main Configuration
////////////////////////////////////////////////////////////////////////////////

// Miscellaneous Configuration
const config = {};
config.enabled = false;
config.name = 'Pool-Bitcoin';
config.template = 'bitcoin';

// Primary Configuration
////////////////////////////////////////////////////////////////////////////////

// CryptoNight Rotations
config.rotations = {};
config.rotations.enabled = false;
config.rotations.DarkDarkliteFast = 1; // Rotation 1
config.rotations.DarkDarkliteLite = 1; // Rotation 2
config.rotations.DarkDarkliteTurtle = 1; // Rotation 3
config.rotations.DarkDarkliteTurtlelite = 1; // Rotation 4
config.rotations.DarkFastLite = 1; // Rotation 5
config.rotations.DarkFastTurtle = 1; // Rotation 6
config.rotations.DarkFastTurtlelite = 1; // Rotation 7
config.rotations.DarkLiteTurtle = 1; // Rotation 8
config.rotations.DarkLiteTurtlelite = 1; // Rotation 9
config.rotations.DarkTurtleTurtlelite = 1; // Rotation 10
config.rotations.DarkliteFastLite = 1; // Rotation 11
config.rotations.DarkliteFastTurtle = 1; // Rotation 12
config.rotations.DarkliteFastTurtlelite = 1; // Rotation 13
config.rotations.DarkliteLiteTurtle = 1; // Rotation 14
config.rotations.DarkliteLiteTurtlelite = 1; // Rotation 15
config.rotations.DarkliteTurtleTurtlelite = 1; // Rotation 16
config.rotations.FastLiteTurtle = 1; // Rotation 17
config.rotations.FastLiteTurtlelite = 1; // Rotation 18
config.rotations.FastTurtleTurtlelite = 1; // Rotation 19
config.rotations.LiteTurtleTurtlelite = 1; // Rotation 20

// Alternative GR Hashing Library
config.hashLib = {};
config.hashLib.enabled = false;
config.hashLib.name = '';

// Miscellaneous Configuration
config.primary = {};
config.primary.address = '[address]';

// Coin Configuration
config.primary.coin = {};
config.primary.coin.name = 'Bitcoin';
config.primary.coin.symbol = 'BTC';
config.primary.coin.algorithm = 'sha256d';

// Checks Configuration
config.primary.checks = {};
config.primary.checks.enabled = true;

// Daemon Configuration
config.primary.daemons = [];

const daemons1 = {};
daemons1.host = '127.0.0.1';
daemons1.port = 8332;
daemons1.username = '';
daemons1.password = '';
config.primary.daemons.push(daemons1);

// Payment Configuration
config.primary.payments = {};
config.primary.payments.enabled = true;
config.primary.payments.minConfirmations = 10;
config.primary.payments.minPayment = 0.005;
config.primary.payments.transactionFee = 0.004;
config.primary.payments.daemon = {};
config.primary.payments.daemon.host = '127.0.0.1';
config.primary.payments.daemon.port = 8332;
config.primary.payments.daemon.username = '';
config.primary.payments.daemon.password = '';

// Recipients Configuration
config.primary.recipients = [];

const recipient1 = {};
recipient1.address = '[address]';
recipient1.percentage = 0.05;
config.primary.recipients.push(recipient1);

// Statistics Configuration
config.primary.statistics = {};
config.primary.statistics.enabled = true;

// ZMQ Configuration
config.primary.zmq = {};
config.primary.zmq.enabled = false;
config.primary.zmq.host = '127.0.0.1';
config.primary.zmq.port = 29000;

// Shared Configuration
////////////////////////////////////////////////////////////////////////////////

// Port Configuration
config.ports = [];

const ports1 = {};
ports1.port = 3002;
ports1.enabled = true;
ports1.type = 'shared';
ports1.tls = false;
ports1.difficulty = {};
ports1.difficulty.initial = 32;
ports1.difficulty.minimum = 8;
ports1.difficulty.maximum = 512;
ports1.difficulty.targetTime = 15; // s
ports1.difficulty.retargetTime = 90; // s
ports1.difficulty.variance = 0.3;
config.ports.push(ports1);

// Settings Configuration
config.settings = {};

// Banning Configuration
config.settings.banning = {};
config.settings.banning.banLength = 600000; // ms
config.settings.banning.checkThreshold = 500;
config.settings.banning.invalidPercent = 50;
config.settings.banning.purgeInterval = 300000; // ms

// Timeout Configuration
config.settings.timeout = {};
config.settings.timeout.connection = 600000; // ms
config.settings.timeout.rebroadcast = 60000; // ms

// Interval Configuration
config.settings.interval = {};
config.settings.interval.blocks = 1000; // ms
config.settings.interval.checks = 90000; // ms
config.settings.interval.historical = 600000; // ms
config.settings.interval.payments = 7200000; // ms
config.settings.interval.rounds = 60000; // ms
config.settings.interval.statistics = 90000; // ms

// Window Configuration
config.settings.window = {};
config.settings.window.hashrate = 300000; // ms
config.settings.window.inactive = 600000; // ms
config.settings.window.purge = 604800000; // ms
config.settings.window.snapshots = 720000; // ms
config.settings.window.rounds = 21600000; // ms
config.settings.window.updates = 300000; // ms

// Export Configuration
module.exports = config;
