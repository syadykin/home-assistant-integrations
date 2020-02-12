class Thing {
  static get prefix() { return "modbus" };
  static get ON() { return "ON" };
  static get OFF() { return "OFF" };
  static get retain() { return true };

  core;
  id;
  initial = true;

  constructor(core, id) {
    this.core = core;
    this.id = id;
  }

  read = () => { };
}

module.exports = Thing;
