const priorityQueue = require("async/priorityQueue");
const ModbusRTU = require("modbus-serial");

const Switch = require("./Switch");
const LED = require("./LED");

module.exports = class Core {
  _current = 0;
  _timer;

  constructor(config, mqtt) {
    this._config = config;
    this._mqtt = mqtt;

    this._queue = priorityQueue(this.modbusWorker, 1);
    this._queue.drain(this.fulfillQueue);

    this._modbus = new ModbusRTU();
    this._modbus.setTimeout(2000);

    this._devices = config.devices.map((device) => {
      const options = {
        ...(device.options),
        prefix: this._config.prefix,
      }

      switch (device.type) {
        case "switch": {
          return new Switch(this, device.id, options);
        }
        case "led": {
          return new LED(this, device.id, options);
        }

        default: throw new Error(`Unknown device found: ${JSON.stringify(device)}`);
      }
    })
  }

  get mqtt() {
    return this._mqtt;
  }

  get modbus() {
    return this._modbus;
  }

  modbusWorker = async (func) => {
    try {
      if (!this.modbus.isOpen) {
        console.error('Lost connection, reconnect...');
        await new Promise((ok) => this.modbus.close(ok));
        await this.connect();
      }
      await func();
    } catch (e) {
      console.error('Worker error:', e.message);
    }
  }

  fulfillQueue = () => {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      const device = this._current;
      this._current = (this._current + 1) % this._devices.length;
      this._devices[device].read();
    }, this._config.delay);
  }

  schedule = (func, priority = 0) => this._queue.push(func, priority);

  connect = async () => {
    const host = this._config.host;
    const port = this._config.port;

    await this.modbus.connectTelnet(host, { port });
  }

  run = async() => {
    this.fulfillQueue();
  }
}