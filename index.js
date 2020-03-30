const config = require('config');
const Mqtt = require('mqtt');

const Modbus = require('./modbus/Core');
const Internet = require('./internet/Core');

const run = async () => {
  const options = config.get('mqtt');
  const mqtt = Mqtt.connect(options.url);

  const services = [];

  const modbusConfig = config.get('modbus');
  if (modbusConfig.enabled !== false) {
    services.push(new Modbus(
      {
        ...modbusConfig,
        prefix: options.prefix,
      },
      mqtt,
    ));
  }

  const internetConfig = config.get('internet');
  if (internetConfig.enabled !== false) {
    services.push(new Internet(
      {
        ...internetConfig,
        prefix: options.prefix,
      },
      mqtt,
    ));
  }

  if (services.length !== 0) {
    try {
      await Promise.all(
        services.map((service) => service.run()),
      );
    } catch (e) {
      console.log('RUN error:', e);
      process.exit(1);
    }
  }
};

run();
