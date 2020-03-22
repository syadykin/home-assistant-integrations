const { promises: fs, watch } = require('fs');
const { join } = require('path');

const Host = require('./Host');

class Core {
  constructor(config, mqtt) {
    this._config = config;
    this._mqtt = mqtt;
    this._prefix = `${this._config.prefix}/switch/internet`;

    this.hosts = { };
  }

  run = async () => {
    if (this._config.enabled === false) {
      return;
    }

    for (const host of this._config.hosts) {
      this.hosts[host.ip] = new Host(
        {
          ...host,
          folder: this._config.status,
          prefix: this._prefix,
        },
        this._mqtt,
      );
    }

    watch(this._config.status).on('change', async (event, ip) => {
      if (event !== 'rename' || !this.hosts[ip]) {
        return;
      }

      try {
        await fs.access(join(this._config.status, ip));
        this.hosts[ip].enable();
      } catch (e) {
        this.hosts[ip].disable();
      }
    });

    this._mqtt.subscribe(`${this._prefix}/+/set`);
  }
}

module.exports = Core;
