const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is required.');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(mongoUri);

  console.log('MongoDB connected');

  // One-time defensive cleanup: an older version of this app had a TTL index
  // on User.refreshTokens.expiresAt, which deletes the WHOLE document once
  // any array value expires — silently wiping entire accounts. Refresh
  // tokens now live in their own collection; drop the old index if present
  // on any database that predates that change. No-op once it's gone.
  try {
    await mongoose.connection.db.collection('users').dropIndex('refreshTokens.expiresAt_1');
    console.log('Dropped legacy refreshTokens.expiresAt_1 index on users');
  } catch (error) {
    if (error.codeName !== 'IndexNotFound' && error.code !== 27) {
      console.warn(`Could not check/drop legacy refresh-token index: ${error.message}`);
    }
  }
};

module.exports = connectDB;
