'use strict';

const app = require('./app');
const store = require('./repositories/store');

const PORT = process.env.PORT || 3000;

store
  .init()
  .then(({ mode }) => {
    app.listen(PORT, () => {
      console.log(`CashRunway API listening on port ${PORT} (data store: ${mode})`);
    });
  })
  .catch((err) => {
    console.error('Failed to start CashRunway API:', err.message);
    process.exit(1);
  });
