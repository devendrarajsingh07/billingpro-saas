try {
  console.log('1. Loading dotenv...');
  require('dotenv').config();

  console.log('2. Loading express...');
  const express = require('express');

  console.log('3. Loading helmet...');
  const helmet = require('helmet');

  console.log('4. Loading cors...');
  const cors = require('cors');

  console.log('5. Loading path...');
  const path = require('path');

  console.log('6. Loading config...');
  const config = require('./config/env');

  console.log('7. Loading db...');
  const db = require('./config/database');

  console.log('8. Loading logger...');
  const { logger, httpLogger } = require('./utils/logger');

  console.log('9. Loading migrations...');
  const runMigrations = require('./migrations/001_initial_schema');

  console.log('10. Loading auth events...');
  const registerAuthEvents = require('./events/handlers/auth.events');

  console.log('11. Loading validators / middleware...');
  const { generalLimiter } = require('./middleware/rateLimiter');
  const errorHandler = require('./middleware/errorHandler');

  console.log('12. Loading v1Routes...');
  const v1Routes = require('./routes/v1');

  console.log('All imports succeeded!');
} catch (err) {
  console.error('Import failed with error:', err);
}
