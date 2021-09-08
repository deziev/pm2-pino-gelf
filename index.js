const pm2 = require('pm2');
const pmx = require('pmx');
const TransformerFactory = require('pino-gelf/lib/transformer');
const Transport = require('pino-gelf/lib/transport');

const PM2_MODULE_NAME = 'pm2-pino-gelf';

const logger = function (...args) {
  console.log(`${PM2_MODULE_NAME}:`, ...args)
}

function toJSONSafe(data) {
  try {
    return JSON.parse(data)
  } catch (e) {
    return null
  }
}

function init(pmModule) {
  const conf = pmModule.module_conf;
  const transformer = TransformerFactory();

  const transport = new Transport({
    customKeys: conf.gelfCustomKeys,
    host: conf.grayLogHost,
    port: Number(conf.grayLogPort),
    maxChunkSize: Number(conf.gelfMaxChunkSize)
  });

  function logData(data) {
    if (data && (typeof data === 'string')) {
      const parsed = toJSONSafe(data);
      if (!parsed) {
        return;
      }
      const msg = transformer(parsed);
      transport.emit('log', msg);
    }
  }

  pm2.Client.launchBus((err, bus) => {
    if (err) {
      return logger(`Error: ${err.message}`, err);
    }
    logger(`Connected. Sending logs to ${conf.grayLogHost}:${conf.grayLogPort}.`);

    bus.on('log:out', (log) => {
      if (log.process.name === PM2_MODULE_NAME) return;
      logData(log.data)
    });

    bus.on('log:err', (log) => {
      if (log.process.name === PM2_MODULE_NAME) return;
      logData(log.data)
    });

    bus.on('reconnect attempt', () => {
      logger('Reconnecting...');
    });

    bus.on('close', () => {
      pm2.disconnectBus();
      logger('Closed')
    });
  });
}

const gelModule = pmx.initModule({
  widget : {
    logo : 'https://app.keymetrics.io/img/logo/keymetrics-300.png',
    theme            : ['#141A1F', '#222222', '#3ff', '#3ff'],
    el : {
      probes  : true,
      actions : true
    },
    block : {
      actions : false,
      issues  : true,
      meta    : true,
      main_probes : ['test-probe']
    }
  }
});

init(gelModule);