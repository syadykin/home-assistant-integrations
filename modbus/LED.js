const { defaults } = require('lodash');

class LED {
  constructor(core, id, options) {
    this._core = core;
    this._id = id;
    this._options = defaults({}, options, { controls: [] });

    this._prefix = `${this._options.prefix}/light/modbus-${this._id}`;

    this._state = 0;
    this._current = new Array(this._options.controls.length).fill(0);
    this._preset = new Array(this._options.controls.length).fill(0);


    this._options.controls.forEach((name, idx) => {
      this._core.mqtt.publish(
        `${this._prefix}/${idx}/config`,
        JSON.stringify({
          '~': `${this._prefix}/${idx}`,
          name: name,
          cmd_t: '~/onoff/set',
          stat_t: '~/onoff/state',
          bri_cmd_t: '~/brightness/set',
          bri_stat_t: '~/brightness/state',
          unique_id: `modbus-${this._id}-${idx}`,
          device: {
            name: `VRC-L2 (id: ${this._id})`,
            manufacturer: 'VKmodule',
            model: 'VRC-L2',
            identifiers: [ 'vkmodule', 'modbus', this._id ],
          },
        }),
        { retain: true },
      );
    });

    this._core.mqtt.subscribe(`${this._prefix}/+/+/set`);

    const re = new RegExp(`^${this._prefix}/(\\d+)/(onoff|brightness)/set$`);

    const getState = (id) => this._state & (1 << id) && true || false;

    const setState = (id, state) => {
      if (getState(id) !== state) {
        const address = this._options.controls.length + 2;
        const mask = 1 << id;
        const value = state ? (this._state | mask) : (this._state & (0xffff ^ mask));
        this._core.schedule(async() => {
          this._core.modbus.setID(this._id);
          await this._core.modbus.writeRegister(address, value);
        }, 1);
      }
    }

    this._core.mqtt.on('message', (topic, packet) => {
      const match = topic.match(re);

      if (match) {
        const idx = parseInt(match[1], 10);
        const command = match[2];
        const payload = packet.toString();

        switch (command) {
          case 'onoff': {
            setState(idx, payload === 'ON')
            break;
          }

          case 'brightness': {
            const current = parseInt(payload, 10);
            if (this._current[idx] !== current) {
              const address = idx + 1;
              const value = (this._preset[idx] << 8) + current;
              this._core.schedule(async() => {
                this._core.modbus.setID(this._id);
                await this._core.modbus.writeRegister(address, value);
              }, 1)
            }
            break;
          }

          // TBC
          // case 'preset': {
          //   const preset = parseInt(payload, 10);
          //   if (this._preset[idx] !== preset) {
          //     const address = idx + 1;
          //     const value = (preset << 8) + this._current[idx];
          //     this._core.schedule(async() => {
          //       this._core.modbus.setID(this._id);
          //       await this._core.modbus.writeRegister(address, value);
          //     }, 1)
          //   }
          //   break;
          // }
        }
      }
    });
  }

  read = () => this._core.schedule(async () => {
    this._core.modbus.setID(this._id);
    const registers = (await this._core.modbus.readHoldingRegisters(1, this._options.controls.length + 2)).data;
    const state = registers[this._options.controls.length + 1];

    for (let idx = 0; idx < this._options.controls.length; idx ++) {
      const current = registers[idx] & 0xff;
      const mask = 1 << idx;

      const prevState = this._state & mask;
      const currState = state & mask;

      if (this.initial || prevState !== currState) {
        console.log('states', prevState, currState);

        this._core.mqtt.publish(
          `${this._prefix}/${idx}/onoff/state`,
          currState && 'ON' || 'OFF',
          { retain: true },
        );
      }

      if (this.initial || this._current[idx] !== current) {
        this._current[idx] = current;
        this._core.mqtt.publish(
          `${this._prefix}/${idx}/brightness/state`,
          current.toString(),
          { retain: true },
        );
      }

      // const preset = (registers[idx] & 0xff00) >> 8;
      // if (this.initial || this._preset[idx] !== preset) {
      //   this._preset[idx] = preset;
      //   const topic = [Thing.prefix, this._id, LED.name, idx, 'preset', 'get'].join('/');
      //   this._core.mqtt.publish(topic, preset.toString(), { retain: Thing.retain });
      // }
    }

    if (this.initial) {
      this.initial = false;
    }

    this._state = state;
  }, 0);
}

module.exports = LED;
