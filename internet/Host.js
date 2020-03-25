const { promises: fs } = require('fs');
const { join } = require('path');

class Host {
  constructor(config, mqtt) {
    this._config = config;
    this._mqtt = mqtt;
    this._file = join(this._config.folder, this._config.ip);
    this._prefix = `${this._config.prefix}/${this._config.ip.replace(/\./g, '-')}`;

    const payload = JSON.stringify({
      '~': this._prefix,
      name: this._config.name,
      cmd_t: '~/set',
      stat_t: '~/state',
      unique_id: `internet-${this._config.ip}`,
      device: {
        name: 'Internet toggler',
        manufacturer: 'Stanyslav Yadykin',
        model: 'v1.0',
        identifiers: [ 'internet-toggler' ],
      },
    });

    // ladies^Wstate first
    if (await this.test()) {
      this.enable();
    } else {
      this.disable();
    }

    this._mqtt.publish(`${this._prefix}/config`, payload, { retain: true });

    this._mqtt.on('message', async (topic, packet) => {
      if (topic === `${this._prefix}/set`) {
        if (packet.toString() === 'ON') {
          if (!await this.test()) {
            await (await fs.open(this._file, 'w')).close();
          }
        } else {
          if (await this.test()) {
            await fs.unlink(this._file);
          }
        }
      }
    });
  }

  test = async () => {
    try {
      await fs.access(this._file);
      return true;
    } catch (e) {
      return false;
    }
  }

  enable = () => this._mqtt.publish(`${this._prefix}/state`, 'ON', { retain: true });

  disable = () => this._mqtt.publish( `${this._prefix}/state`, 'OFF', { retain: true });
}

module.exports = Host;
