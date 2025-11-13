# Incoming Vote Data

Raw CVR (Cast Vote Record) export data from election systems, organized by election date.

**Note:** The contents of this directory are not committed to git. Only this README is tracked. Place your CVR export data here locally before running import scripts.

## Structure

Organize by election date in `YYYY-MM/` subdirectories:

- `2024-11/` - November 2024 election data
- `2025-11/` - November 2025 election data

Each subdirectory should contain CVR Export folders (e.g., `CVR_Export_YYYYMMDDHHMMSS/` or `CVR Export - [Election Name]/`) with the raw JSON manifest files.

## Usage

Place CVR export data here before running import scripts:

- `scripts/results-import.ts` - Processes CVR data and generates `data/results/results-*.json`
- `scripts/load-cvr-to-sqlite.ts` - Loads CVR data into SQLite database

Scripts will read from these directories and output processed data to `data/results/` and `data/database/`.

