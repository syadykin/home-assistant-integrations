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
        unique_id: 'internet-toggler',
      },
    });

    this._mqtt.publish(`${this._prefix}/config`, payload, { retain: true });

    this._mqtt.on('message', async (topic, packet) => {
      if (topic === `${this._prefix}/set`) {
        if (packet.toString() === 'ON') {
          try {
            await fs.access(this._file);
          } catch (e) {
            await (await fs.open(this._file, 'w')).close();
          }
        } else {
          try {
            await fs.access(this._file);
            await fs.unlink(this._file);
          } catch (e) {
            // nothing
          }
        }
      }
    });
  }

  enable = () => this._mqtt.publish(`${this._prefix}/state`, 'ON', { retain: true });

  disable = () => this._mqtt.publish( `${this._prefix}/state`, 'OFF', { retain: true });
}

module.exports = Host;
