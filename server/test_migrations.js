try {
  console.log('Loading database config...');
  const db = require('./config/database');
  console.log('Loading env...');
  require('dotenv').config();
  console.log('Loading migration runner...');
  const runMigrations = require('./migrations/001_initial_schema');
  console.log('Running migrations...');
  runMigrations();
  console.log('Migrations completed successfully!');
} catch (err) {
  console.error('Migration failed with error:', err);
}
