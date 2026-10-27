/**
 * WasteLoop — MongoDB Connection & Storage Adapter
 *
 * Connects to MongoDB (MongoDB Atlas cloud or local instance) via the official mongodb driver.
 * When connected, queries operate on real MongoDB collections:
 *   - requests
 *   - users
 *   - rewards
 *   - grievances
 *   - certificates
 *
 * Automatic fallback: if MongoDB URI is not set or server is unreachable,
 * WasteLoop continues operating gracefully using the local data/*.json store.
 */

'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { MongoClient } = require('mongodb');

let client = null;
let db = null;
let isConnected = false;

/** Load environment variables from .env file if present. */
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      });
    } catch (e) {
      console.warn('Error reading .env file:', e.message);
    }
  }
}

loadEnv();

const DB_NAME = process.env.MONGODB_DB || 'wasteloop';

/**
 * Connect to MongoDB using connection string.
 * @param {string} [uri] Optional override URI
 * @returns {Promise<object|null>} The MongoDB Database object or null if failed
 */
async function connect(uri) {
  loadEnv();
  const connectionUri = uri || process.env.MONGODB_URI;

  if (!connectionUri) {
    console.log('  MongoDB       : Not configured (MONGODB_URI is not set in .env). Using local JSON storage.');
    return null;
  }

  try {
    client = new MongoClient(connectionUri, {
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 5000
    });
    await client.connect();
    db = client.db(DB_NAME);
    isConnected = true;

    // Mask credentials for terminal output
    const safeUri = connectionUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
    console.log('  MongoDB       : Connected successfully (' + safeUri + ')');
    console.log('  Database      : ' + DB_NAME);

    await ensureIndexes();
    await seedMongoIfEmpty();
    return db;
  } catch (error) {
    isConnected = false;
    db = null;
    console.warn('  MongoDB       : Connection failed (' + error.message + '). Operating on local JSON storage.');
    return null;
  }
}

/** Ensure unique index on the primary 'id' field for all collections. */
async function ensureIndexes() {
  if (!db) return;
  try {
    await db.collection('requests').createIndex({ id: 1 }, { unique: true });
    await db.collection('users').createIndex({ id: 1 }, { unique: true });
    await db.collection('grievances').createIndex({ id: 1 }, { unique: true });
    await db.collection('certificates').createIndex({ id: 1 }, { unique: true });
    await db.collection('rewards').createIndex({ id: 1 }, { unique: true });
  } catch (e) {
    // Indexes may already exist
  }
}

/** If collections are brand new/empty, seed them from data/*.json so the portal has data immediately. */
async function seedMongoIfEmpty() {
  if (!db) return;
  const DATA_DIR = path.join(__dirname, '..', 'data');
  const collections = ['users', 'requests', 'rewards', 'grievances', 'certificates'];

  for (const name of collections) {
    try {
      const count = await db.collection(name).countDocuments();
      if (count === 0) {
        const filePath = path.join(DATA_DIR, name + '.json');
        if (fs.existsSync(filePath)) {
          const raw = await fsp.readFile(filePath, 'utf8');
          const data = JSON.parse(raw);
          const rows = Array.isArray(data) ? data : data[name] || [];
          if (rows.length > 0) {
            const sanitized = rows.map((r) => {
              const copy = { ...r };
              delete copy._id;
              return copy;
            });
            await db.collection(name).insertMany(sanitized);
            console.log('  MongoDB seed  : Migrated ' + sanitized.length + ' records into collection "' + name + '"');
          }
        }
      }
    } catch (e) {
      console.warn('  MongoDB seed error for ' + name + ':', e.message);
    }
  }
}

function getDb() {
  return isConnected ? db : null;
}

function isMongoConnected() {
  return isConnected && !!db;
}

async function close() {
  if (client) {
    try {
      await client.close();
    } catch (e) {}
    isConnected = false;
    db = null;
    client = null;
  }
}

module.exports = {
  connect,
  getDb,
  isMongoConnected,
  close,
  loadEnv
};
