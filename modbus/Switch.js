const { defaults } = require("lodash");
const Thing = require("./Thing");

class Switch extends Thing {
  static name = "switch";

  options;

  constructor(core, id, options) {
    super(core, id);
    this.options = defaults({ controls: 8 }, options);

    this.coils = new Array(this.options.controls).fill(false);

    const topic = [Thing.prefix, this.id, Switch.name, "+"].join("/");
    this.core.mqtt.subscribe(topic);
    const re = new RegExp(`^${Thing.prefix}/${this.id}/${Switch.name}/(\\d+)$`);
    this.core.mqtt.on("message", (topic, packet) => {
      const match = topic.match(re);

      if (match) {
        const state = packet.toString() === Thing.ON;
        const id = parseInt(match[1], 10);
        if (this.coils[id] !== state) {
          this.core.schedule(async () => {
            this.core.modbus.setID(this.id);
            await this.core.modbus.writeCoil(id, state && 1 || 0);
          }, 1);
        }
      }
    });
  }

  read = () => this.core.schedule(async () => {
    this.core.modbus.setID(this.id);
    const coils = (await this.core.modbus.readCoils(0, this.coils.length)).data;
    for (let id = 0; id < coils.length; id++) {
      if (this.coils[id] !== coils[id]) {
        const topic = [Thing.prefix, this.id, Switch.name, id].join("/");
        const state = coils[id] && Thing.ON || Thing.OFF;
        this.coils[id] = coils[id];
        this.core.mqtt.publish(topic, state, { retain: Thing.retain });
      }
    }
  }, 0);
}

module.exports = Switch;
