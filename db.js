import { MongoClient } from 'mongodb';

// MongoDB connection URL - you can override with environment variable
const url = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const dbName = 'revision-scheduler';

let db = null;

export async function connectDB() {
  if (db) return db;

  try {
    const client = new MongoClient(url);
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db(dbName);

    // Create indexes for better query performance
    await db.collection('cards').createIndex({ nextReview: 1 });
    await db.collection('cards').createIndex({ createdAt: -1 });

    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  return db;
}
