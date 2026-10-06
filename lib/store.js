/**
 * WasteLoop — lightweight JSON file store (no database)
 *
 * Uses only Node.js core modules: fs, path, crypto, util.
 * Every collection (users, requests, rewards, grievances, certificates) lives in
 * a single JSON file inside data/. Writes are atomic (temp file + rename) and
 * reads are cached in memory so the API stays fast.
 */

'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');

const COLLECTIONS = {
  users: 'users.json',
  requests: 'requests.json',
  rewards: 'rewards.json',
  grievances: 'grievances.json',
  certificates: 'certificates.json'
};

// in-memory cache: fileName -> parsed array
const cache = new Map();

function filePathFor(collection) {
  const fileName = COLLECTIONS[collection];
  if (!fileName) throw new Error('Unknown collection: ' + collection);
  return path.join(DATA_DIR, fileName);
}

async function ensureDataDir() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

/**
 * Read a whole collection. Returns [] when the file does not exist yet.
 * @param {string} collection
 * @returns {Promise<Array>}
 */
async function readCollection(collection) {
  const file = filePathFor(collection);
  try {
    const raw = await fsp.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : parsed[collection] || [];
    cache.set(file, rows);
    return rows;
  } catch (error) {
    if (error.code === 'ENOENT') {
      cache.set(file, []);
      return [];
    }
    throw error;
  }
}

/** Synchronous cache read (used for read-only handlers after the first read). */
function cached(collection) {
  const file = filePathFor(collection);
  return cache.get(file) || [];
}

/**
 * Replace the whole content of a collection and persist it.
 * @param {string} collection
 * @param {Array} rows
 */
async function writeCollection(collection, rows) {
  const file = filePathFor(collection);
  await ensureDataDir();
  const tempFile = file + '.' + process.pid + '.tmp';
  await fsp.writeFile(tempFile, JSON.stringify(rows, null, 2), 'utf8');
  await fsp.rename(tempFile, file);
  cache.set(file, rows);
  return rows;
}

/**
 * Append one record (callback style) and persist the file.
 * @param {string} collection
 * @param {object} record
 * @returns {Promise<object>} the stored record
 */
async function insertRecord(collection, record) {
  const rows = await readCollection(collection);
  rows.push(record);
  await writeCollection(collection, rows);
  return record;
}

/**
 * Update one record by id using a mutator function.
 * @returns {Promise<object|null>}
 */
async function updateRecord(collection, id, mutate) {
  const rows = await readCollection(collection);
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) return null;
  rows[index] = mutate({ ...rows[index] }) || rows[index];
  await writeCollection(collection, rows);
  return rows[index];
}

async function findRecord(collection, id) {
  const rows = await readCollection(collection);
  return rows.find((row) => row.id === id) || null;
}

/**
 * Sequential, human friendly id such as WL20491, GRV-2026-10482 or WL-CERT-92841.
 * The numeric part is five digits: the last four digits of the current
 * millisecond timestamp plus one random digit, which keeps ids unique even
 * when two requests land in the same millisecond.
 */
function buildId(prefix, options = {}) {
  const now = options.now || new Date();
  const year = now.getFullYear();
  // A prefix that already contains a dash gets one more before the number,
  // so "WL-CERT" produces WL-CERT-92841 rather than WL-CERT92841.
  const separator = prefix.indexOf('-') === -1 ? '' : '-';
  const stamp = String(now.getTime()).slice(-4) + String(crypto.randomInt(0, 10));

  if (options.numberStyle === 'short') {
    return `${prefix}${separator}${stamp}`;
  }
  if (options.numberStyle === 'year') {
    return `${prefix}-${year}-${stamp}`;
  }
  return `${prefix}-${String(now.getTime()).slice(-4)}-${crypto.randomInt(100, 999)}`;
}

/** Stable 8 character reference / verification number. */
function referenceNumber(prefix) {
  const token = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${token.slice(0, 4)}-${token.slice(4)}`;
}

module.exports = {
  DATA_DIR,
  COLLECTIONS,
  readCollection,
  writeCollection,
  cached,
  insertRecord,
  updateRecord,
  findRecord,
  buildId,
  referenceNumber,
  ensureDataDir
};