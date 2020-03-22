const { defaults } = require('lodash');

class Switch {
  constructor(core, id, options) {
    this._core = core;
    this._id = id;
    this._options = defaults({}, options, { controls: [] });
    this._prefix = `${this._options.prefix}/switch/modbus-${this._id}`;
    this._coils = new Array(this._options.controls.length).fill(false);

    this._options.controls.forEach((name, idx) => {
      this._core.mqtt.publish(
        `${this._prefix}/${idx}/config`,
        JSON.stringify({
          '~': `${this._prefix}/${idx}`,
          name: name,
          cmd_t: '~/set',
          stat_t: '~/state',
          unique_id: `modbus-${this._id}-${idx}`,
          device: {
            name: `VRC-R8 (id: ${this._id})`,
            manufacturer: 'VKmodule',
            model: 'VRC-R8',
            identifiers: [ 'vkmodule', 'modbus', this._id ],
          },
        }),
        { retain: true },
      );
    });

    this._core.mqtt.subscribe(`${this._prefix}/+/set`);

    const re = new RegExp(`^${this._prefix}/(\\d+)/set$`);

    this._core.mqtt.on('message', (topic, packet) => {
      const match = topic.match(re);

      if (match) {
        const state = packet.toString() === 'ON';
        const idx = parseInt(match[1], 10);
        if (this._coils[idx] !== state) {
          this._core.schedule(async () => {
            this._core.modbus.setID(this._id);
            await this._core.modbus.writeCoil(idx, state && 1 || 0);
          }, 1);
        }
      }
    });
  }

  read = () => this._core.schedule(async () => {
    this._core.modbus.setID(this._id);
    const coils = (await this._core.modbus.readCoils(0, this._coils.length)).data;

    for (let idx = 0; idx < coils.length; idx++) {
      if (this.initial || this._coils[idx] !== coils[idx]) {
        const state = coils[idx] && 'ON' || 'OFF';
        this._coils[idx] = coils[idx];
        this._core.mqtt.publish(
          `${this._prefix}/${idx}/state`,
          state,
          { retain: true },
        );
      }
    }
    if (this.initial) {
      this.initial = false;
    }
  }, 0);
}

module.exports = Switch;
