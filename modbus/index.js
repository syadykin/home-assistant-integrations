const Core = require('./Core');

const run = async () => {
  const core = new Core();

  try {
    await core.connect();
    await core.run();
  } catch (e) {
    console.log('RUN error:', e);
    process.exit(1);
  }
};

run();
