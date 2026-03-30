-- schema.sql
-- Create necessary tables for GuardTrack V2
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS store_users;
DROP TABLE IF EXISTS locations;

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  radius REAL DEFAULT 150,
  vendor_name TEXT,
  area_manager_name TEXT,
  area_manager_phone TEXT,
  zippee_poc_name TEXT
);

CREATE TABLE store_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  location_id TEXT DEFAULT 'all',
  location_name TEXT DEFAULT 'All Stores',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guard_name TEXT NOT NULL,
  guard_mobile TEXT,
  location_id TEXT NOT NULL,
  location_name TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  guard_lat REAL,
  guard_lng REAL,
  distance REAL,
  accuracy REAL,
  in_geofence INTEGER DEFAULT 1,
  selfie_url TEXT,
  checkout_time DATETIME,
  checkout_type TEXT,
  working_hours REAL
);
