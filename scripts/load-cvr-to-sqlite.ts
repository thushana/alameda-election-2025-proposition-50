// ============================================================================
// LOAD CVR DATA INTO SQLITE
// ============================================================================
// Loads CVR export files into SQLite for efficient cross-contest analysis

import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream';
import streamJson from 'stream-json';
import pickPkg from 'stream-json/filters/Pick.js';
import streamArrayPkg from 'stream-json/streamers/StreamArray.js';
import Database from 'better-sqlite3';

const { parser } = streamJson as { parser: any };
const { pick } = pickPkg as { pick: any };
const { streamArray } = streamArrayPkg as { streamArray: any };

interface CvrMark {
  IsVote?: boolean;
  CandidateId?: number;
  Rank?: number;
}

interface CvrContest {
  Id?: number;
  Marks?: CvrMark[];
}

interface CvrCard {
  Contests?: CvrContest[];
}

interface CvrOriginal {
  PrecinctPortionId?: number;
  Cards?: CvrCard[];
}

interface CvrRecord {
  TabulatorId?: number;
  BatchId?: number;
  RecordId?: number;
  CountingGroupId?: number;
  Original?: CvrOriginal;
}

interface CvrStreamValue {
  value: CvrRecord;
}

function safeGetArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  return [];
}

function resolveCvrFiles(inputDir: string): string[] {
  const files = fs.readdirSync(inputDir);
  const cvrFiles = files
    .filter((f) => f.startsWith('CvrExport_') && f.endsWith('.json'))
    .map((f) => path.join(inputDir, f))
    .sort((a, b) => {
      // Sort by the number in the filename (CvrExport_0.json, CvrExport_1.json, etc.)
      const numA = parseInt(path.basename(a).match(/_(\d+)\.json$/)?.[1] || '0', 10);
      const numB = parseInt(path.basename(b).match(/_(\d+)\.json$/)?.[1] || '0', 10);
      return numA - numB;
    });

  if (cvrFiles.length === 0) {
    throw new Error(`No CvrExport_*.json files found in ${inputDir}`);
  }

  return cvrFiles;
}

async function main(): Promise<void> {
  const inputDir = process.argv[2];
  const outputDb = process.argv[3] || 'cvr-data.db';

  if (!inputDir) {
    console.error('Usage: tsx scripts/load-cvr-to-sqlite.ts /path/to/CVR_Export [output.db]');
    process.exit(1);
  }

  const absoluteInputDir = path.resolve(inputDir);
  const dbPath = path.resolve(outputDb);

  console.log('Creating SQLite database...');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better performance
  db.pragma('synchronous = NORMAL'); // Balance between safety and speed

  // Create tables
  console.log('Creating tables...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id INTEGER PRIMARY KEY AUTOINCREMENT,
      tabulator_id INTEGER,
      batch_id INTEGER,
      record_id INTEGER,
      counting_group_id INTEGER,
      precinct_portion_id INTEGER,
      UNIQUE(tabulator_id, batch_id, record_id)
    );

    CREATE TABLE IF NOT EXISTS votes (
      vote_id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      contest_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL,
      rank INTEGER,
      is_vote INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id),
      UNIQUE(session_id, contest_id, candidate_id, rank)
    );

    CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(session_id);
    CREATE INDEX IF NOT EXISTS idx_votes_contest ON votes(contest_id);
    CREATE INDEX IF NOT EXISTS idx_votes_candidate ON votes(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_votes_contest_candidate ON votes(contest_id, candidate_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_tabulator_batch_record ON sessions(tabulator_id, batch_id, record_id);
  `);

  // Prepare statements for batch inserts
  const insertSession = db.prepare(`
    INSERT OR IGNORE INTO sessions (tabulator_id, batch_id, record_id, counting_group_id, precinct_portion_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  const getSessionId = db.prepare(`
    SELECT session_id FROM sessions
    WHERE tabulator_id = ? AND batch_id = ? AND record_id = ?
  `);

  // Use transactions for better performance on votes
  const insertVoteMany = db.transaction(
    (votes: Array<[number, number, number, number | null, boolean]>) => {
      const stmt = db.prepare(`
      INSERT OR IGNORE INTO votes (session_id, contest_id, candidate_id, rank, is_vote)
      VALUES (?, ?, ?, ?, ?)
    `);
      for (const vote of votes) {
        // Convert boolean to integer (0 or 1) for SQLite
        const [sessionId, contestId, candidateId, rank, isVote] = vote;
        stmt.run(sessionId, contestId, candidateId, rank, isVote ? 1 : 0);
      }
    }
  );

  const cvrFiles = resolveCvrFiles(absoluteInputDir);
  console.log(`Found ${cvrFiles.length} CVR file(s) to process`);

  let totalProcessed = 0;
  let totalSessions = 0;
  let totalVotes = 0;

  // Batch size for vote inserts
  const VOTE_BATCH_SIZE = 10000;
  let voteBatch: Array<[number, number, number, number | null, boolean]> = [];

  // Cache for session IDs to avoid repeated queries
  const sessionIdCache = new Map<string, number>();

  const startTime = Date.now();

  // Process files one at a time
  for (let i = 0; i < cvrFiles.length; i++) {
    const cvrFile = cvrFiles[i];
    const fileNum = i + 1;

    console.log(`Processing file ${fileNum}/${cvrFiles.length}: ${path.basename(cvrFile)}...`);

    await new Promise<void>((resolve, reject) => {
      const source = fs.createReadStream(cvrFile);
      const p = parser();
      const sessionsPicker = pick({ filter: 'Sessions' });
      const sessionsArray = streamArray();

      let fileProcessed = 0;

      sessionsArray.on('data', ({ value }: CvrStreamValue) => {
        fileProcessed += 1;
        totalProcessed += 1;

        if (fileProcessed % 100000 === 0) {
          console.log(`  Processed ${fileProcessed.toLocaleString()} records from this file...`);
        }

        const record: CvrRecord = value ?? {};
        const tabulatorId = record.TabulatorId;
        const batchId = record.BatchId;
        const recordId = record.RecordId;
        const countingGroupId = record.CountingGroupId ?? null;
        const original: CvrOriginal = (record.Original ?? {}) as CvrOriginal;
        const precinctPortionId = original.PrecinctPortionId ?? null;
        const cards = safeGetArray<CvrCard>(original.Cards);

        // Skip if we don't have the required identifiers
        if (
          typeof tabulatorId !== 'number' ||
          typeof batchId !== 'number' ||
          typeof recordId !== 'number'
        ) {
          return;
        }

        // Get or create session_id
        const sessionKey = `${tabulatorId}_${batchId}_${recordId}`;
        let sessionId = sessionIdCache.get(sessionKey);

        if (!sessionId) {
          // Insert session if it doesn't exist
          insertSession.run(tabulatorId, batchId, recordId, countingGroupId, precinctPortionId);
          const sessionRow = getSessionId.get(tabulatorId, batchId, recordId) as
            | { session_id: number }
            | undefined;
          if (!sessionRow) {
            // This shouldn't happen, but handle it
            return;
          }
          sessionId = sessionRow.session_id;
          sessionIdCache.set(sessionKey, sessionId);
          totalSessions += 1;
        }

        // Process all cards and contests
        for (const card of cards) {
          const contests = safeGetArray<CvrContest>(card.Contests);

          for (const contest of contests) {
            const contestId = contest?.Id;
            if (!contestId || typeof contestId !== 'number') continue;

            const marks = safeGetArray<CvrMark>(contest.Marks);
            for (const mark of marks) {
              if (!mark || typeof mark !== 'object') continue;

              const candidateId = mark.CandidateId;
              const isVote = mark.IsVote === true;
              const rank = mark.Rank ?? null;

              if (typeof candidateId === 'number') {
                // Add vote to batch
                voteBatch.push([sessionId, contestId, candidateId, rank, isVote]);
              }
            }
          }
        }

        // Flush vote batch when it gets large
        if (voteBatch.length >= VOTE_BATCH_SIZE) {
          insertVoteMany(voteBatch);
          totalVotes += voteBatch.length;
          voteBatch = [];
        }
      });

      sessionsArray.on('error', (err) => {
        console.error(
          `Error processing ${path.basename(cvrFile)}: ${err instanceof Error ? err.message : String(err)}`
        );
        reject(err);
      });

      sessionsArray.on('end', () => {
        // Flush remaining vote batch
        if (voteBatch.length > 0) {
          insertVoteMany(voteBatch);
          totalVotes += voteBatch.length;
          voteBatch = [];
        }

        console.log(
          `  Completed: ${fileProcessed.toLocaleString()} records (Total: ${totalProcessed.toLocaleString()})`
        );
        resolve();
      });

      p.on('error', reject);
      sessionsPicker.on('error', reject);
      source.on('error', reject);

      pipeline(source, p, sessionsPicker, sessionsArray, (err: unknown) => {
        if (err) reject(err);
      });
    });
  }

  // Final flush
  if (voteBatch.length > 0) {
    insertVoteMany(voteBatch);
    totalVotes += voteBatch.length;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nAll files processed in ${elapsed} seconds`);
  console.log(`Total sessions: ${totalSessions.toLocaleString()}`);
  console.log(`Total votes: ${totalVotes.toLocaleString()}`);

  // Print some stats
  const stats = db
    .prepare(
      `
    SELECT 
      (SELECT COUNT(*) FROM sessions) as session_count,
      (SELECT COUNT(*) FROM votes) as vote_count,
      (SELECT COUNT(DISTINCT contest_id) FROM votes) as contest_count,
      (SELECT COUNT(DISTINCT candidate_id) FROM votes) as candidate_count
  `
    )
    .get() as {
    session_count: number;
    vote_count: number;
    contest_count: number;
    candidate_count: number;
  };

  console.log('\n=== DATABASE STATISTICS ===');
  console.log(`Sessions: ${stats.session_count.toLocaleString()}`);
  console.log(`Votes: ${stats.vote_count.toLocaleString()}`);
  console.log(`Unique contests: ${stats.contest_count}`);
  console.log(`Unique candidates: ${stats.candidate_count}`);
  console.log(`\nDatabase saved to: ${dbPath}`);

  db.close();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
