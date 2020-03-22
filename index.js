const config = require('config');
const Mqtt = require('mqtt');

const Modbus = require('./modbus/Core');
const Internet = require('./internet/Core');

const run = async () => {
  process.setMaxListeners(0);

  const options = config.get('mqtt');
  const mqtt = Mqtt.connect(options.url);

  const modbus = new Modbus(
    {
      ...config.get('modbus'),
      prefix: options.prefix,
    },
    mqtt,
  );
  const internet = new Internet(
    {
      ...config.get('internet'),
      prefix: options.prefix,
    },
    mqtt,
  );

  try {
    await Promise.all([
      modbus.run(),
      internet.run(),
    ]);
  } catch (e) {
    console.log('RUN error:', e);
    process.exit(1);
  }
};

run();
