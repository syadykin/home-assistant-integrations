const { defaults } = require("lodash");
const Thing = require("./Thing");
const Switch = require("./Switch");

class LED extends Thing {
  static name = "led";

  options;
  state;
  current;
  preset;

  constructor(core, id, options) {
    super(core, id);
    this.options = defaults({ controls: 2 }, options);

    this.state = 0;
    this.current = new Array(this.options.controls).fill(0);
    this.preset = new Array(this.options.controls).fill(0);

    const switchTopic = [Thing.prefix, this.id, Switch.name, "+"].join("/");
    this.core.mqtt.subscribe(switchTopic);
    const ledTopic = [Thing.prefix, this.id, LED.name, "#",].join("/");
    this.core.mqtt.subscribe(ledTopic);

    const re = new RegExp(`^${Thing.prefix}/${this.id}/(${Switch.name}|${LED.name})/(\\d+)(?:/(current|preset)/set)?$`);

    const getState = (id) => this.state & (1 << id) && true || false;

    const setState = (id, state) => {
      if (getState(id) !== state) {
        const address = this.options.controls + 2;
        const mask = 1 << id;
        const value = state ? (this.state | mask) : (this.state & (0xffff ^ mask));
        this.core.schedule(async() => {
          this.core.modbus.setID(this.id);
          await this.core.modbus.writeRegister(address, value);
        }, 1);
      }
    }

    this.core.mqtt.on("message", (topic, packet) => {
      const match = topic.match(re);

      if (match) {
        const id = parseInt(match[2], 10);
        const command = match[3] || (match[1] === Switch.name && "state");
        const payload = packet.toString();

        switch (command) {
          case "state": {
            setState(id, payload === Thing.ON)
            break;
          }

          case "current": {
            const current = parseInt(payload, 10);
            if (this.current[id] !== current) {
              const address = id + 1;
              const value = (this.preset[id] << 8) + current;
              this.core.schedule(async() => {
                this.core.modbus.setID(this.id);
                await this.core.modbus.writeRegister(address, value);
              }, 1)
            }
            break;
          }

          case "preset": {
            const preset = parseInt(payload, 10);
            if (this.preset[id] !== preset) {
              const address = id + 1;
              const value = (preset << 8) + this.current[id];
              this.core.schedule(async() => {
                this.core.modbus.setID(this.id);
                await this.core.modbus.writeRegister(address, value);
              }, 1)
            }
            break;
          }
        }
      }
    });
  }

  read = () => this.core.schedule(async () => {
    this.core.modbus.setID(this.id);
    const registers = (await this.core.modbus.readHoldingRegisters(1, this.options.controls + 2)).data;
    const state = registers[this.options.controls + 1];

    for (let id = 0; id < this.options.controls; id ++) {
      const current = registers[id] & 0xff;
      const preset = (registers[id] & 0xff00) >> 8;
      const mask = 1 << id;

      const prevState = this.state & mask;
      const currState = state & mask;

      if (this.initial || prevState !== currState) {
        const topic = [Thing.prefix, this.id, Switch.name, id].join("/");
        this.core.mqtt.publish(topic, currState && Thing.ON || Thing.OFF, { retain: Thing.retain });
      }

      if (this.initial || this.current[id] !== current) {
        this.current[id] = current;
        const topic = [Thing.prefix, this.id, LED.name, id, "current", "get"].join("/");
        this.core.mqtt.publish(topic, current.toString(), { retain: Thing.retain });
      }

      if (this.initial || this.preset[id] !== preset) {
        this.preset[id] = preset;
        const topic = [Thing.prefix, this.id, LED.name, id, "preset", "get"].join("/");
        this.core.mqtt.publish(topic, preset.toString(), { retain: Thing.retain });
      }
    }

    if (this.initial) {
      this.initial = false;
    }

    this.state = state;
  }, 0);
}

module.exports = LED;
