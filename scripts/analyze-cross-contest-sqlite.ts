// ============================================================================
// CROSS-CONTEST VOTING ANALYSIS (SQLite Version)
// ============================================================================
// Analyzes how voters who voted for candidates in one contest voted in another contest
// Uses SQLite database created by load-cvr-to-sqlite.ts
//
// Defaults (Nov 2024 General): source contest 40 = "Members, City Council - Alameda",
// target contest 1 = President/Vice President. Only sessions with a vote in BOTH contests
// are cross-tabulated. For contest 40, ballots are Alameda city only, so this is effectively
// Alameda City Council voters (not all-county).
//
// Usage:
//   npm run load:sqlite -- 2024-11 data/database/cvr-2024-11.db
//   npm run analyze:sqlite -- data/database/cvr-2024-11.db 40 1
//   tsx scripts/analyze-cross-contest-sqlite.ts [dbPath] [sourceContestId] [targetContestId] [sourceCandidateId] [manifestDir]
//   sourceCandidateId: omit to print breakdown for every City Council candidate.
//   manifestDir: directory containing CandidateManifest.json (names in output). Optional:
//   set CVR_MANIFEST_DIR, or place manifests under data/incoming-vote-data/<election>/...

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

/** CVR export root contains CandidateManifest.json at top level; election folders may nest it one deep */
function resolveManifestRoot(dir: string | null | undefined): string | null {
  if (!dir || !fs.existsSync(dir)) return null;
  const direct = path.join(dir, 'CandidateManifest.json');
  if (fs.existsSync(direct)) return dir;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sub = path.join(dir, entry.name);
      if (fs.existsSync(path.join(sub, 'CandidateManifest.json'))) return sub;
    }
  } catch {
    return null;
  }
  return null;
}

async function main(): Promise<void> {
  const dbPath = process.argv[2] || 'data/database/cvr-data.db';
  const sourceContestId = parseInt(process.argv[3] || '40', 10); // City Council
  const targetContestId = parseInt(process.argv[4] || '1', 10); // Presidential
  const sourceCandidateId = process.argv[5] ? parseInt(process.argv[5], 10) : null;
  const manifestDir = process.argv[6]; // Optional: directory with manifest files

  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    console.error('Run: npm run load:sqlite /path/to/CVR_Export [output.db]');
    process.exit(1);
  }

  const db = new Database(dbPath);

  // Load candidate names from manifest - try multiple locations
  const candidateMap = new Map<number, string>();
  const envManifest = process.env.CVR_MANIFEST_DIR;
  const manifestRoots = [
    ...new Set(
      [
        resolveManifestRoot(manifestDir),
        resolveManifestRoot(envManifest),
        resolveManifestRoot(path.join(path.dirname(dbPath), '..')),
        resolveManifestRoot(path.join(process.cwd(), 'data', 'incoming-vote-data', '2024-11')),
        resolveManifestRoot(path.join(process.cwd(), 'data', 'incoming-vote-data', '2025-11')),
        resolveManifestRoot(path.join(process.cwd(), 'data', 'incoming-vote-data')),
        resolveManifestRoot('./CVR Export - November 5, 2024 General Election'),
      ].filter((d): d is string => Boolean(d))
    ),
  ];

  let manifestLoaded = false;
  for (const dir of manifestRoots) {
    if (!dir || !fs.existsSync(dir)) continue;

    try {
      const candidateManifestPath = path.join(dir, 'CandidateManifest.json');
      const contestManifestPath = path.join(dir, 'ContestManifest.json');

      if (fs.existsSync(candidateManifestPath)) {
        const candidateManifest = JSON.parse(fs.readFileSync(candidateManifestPath, 'utf-8'));
        for (const candidate of candidateManifest.List || []) {
          candidateMap.set(candidate.Id, candidate.Description);
        }
        manifestLoaded = true;
      }

      if (fs.existsSync(contestManifestPath)) {
        const contestManifest = JSON.parse(fs.readFileSync(contestManifestPath, 'utf-8'));
        for (const contest of contestManifest.List || []) {
          if (contest.Id === sourceContestId) {
            console.log(`Source Contest: ${contest.Id} - ${contest.Description}`);
          }
          if (contest.Id === targetContestId) {
            console.log(`Target Contest: ${contest.Id} - ${contest.Description}`);
          }
        }
      }

      if (manifestLoaded) break;
    } catch (_err) {
      // Continue to next location
      continue;
    }
  }

  if (!manifestLoaded) {
    console.warn('Warning: Could not load candidate manifest. Candidate names will show as IDs.');
    console.warn(
      '  Pass CVR export directory as 6th argv, set CVR_MANIFEST_DIR, or put manifests under data/incoming-vote-data/<election>/.'
    );
  }

  // Load candidate and contest manifests if available
  // For now, we'll query the database to get candidate info
  const candidateInfo = db
    .prepare(
      `
    SELECT DISTINCT v.candidate_id, COUNT(*) as vote_count
    FROM votes v
    WHERE v.contest_id = ? AND v.is_vote = 1
    GROUP BY v.candidate_id
    ORDER BY vote_count DESC
  `
    )
    .all(sourceContestId) as Array<{ candidate_id: number; vote_count: number }>;

  const targetCandidates = db
    .prepare(
      `
    SELECT DISTINCT v.candidate_id, COUNT(*) as vote_count
    FROM votes v
    WHERE v.contest_id = ? AND v.is_vote = 1
    GROUP BY v.candidate_id
    ORDER BY vote_count DESC
  `
    )
    .all(targetContestId) as Array<{ candidate_id: number; vote_count: number }>;

  console.log('\n=== CROSS-CONTEST VOTING ANALYSIS ===\n');

  if (sourceCandidateId) {
    // Analyze specific candidate
    analyzeCandidate(
      db,
      sourceContestId,
      sourceCandidateId,
      targetContestId,
      targetCandidates,
      candidateMap
    );
  } else {
    // Analyze all candidates in source contest
    for (const candidate of candidateInfo) {
      analyzeCandidate(
        db,
        sourceContestId,
        candidate.candidate_id,
        targetContestId,
        targetCandidates,
        candidateMap
      );
      console.log('');
    }
  }

  db.close();
}

function analyzeCandidate(
  db: Database.Database,
  sourceContestId: number,
  sourceCandidateId: number,
  targetContestId: number,
  targetCandidates: Array<{ candidate_id: number; vote_count: number }>,
  candidateMap: Map<number, string>
): void {
  // Query: For voters who voted for sourceCandidateId in sourceContestId,
  // how did they vote in targetContestId?
  const query = db.prepare(`
    SELECT 
      v2.candidate_id,
      COUNT(*) as vote_count
    FROM votes v1
    INNER JOIN votes v2 ON v1.session_id = v2.session_id
    WHERE 
      v1.contest_id = ? 
      AND v1.candidate_id = ?
      AND v1.is_vote = 1
      AND v2.contest_id = ?
      AND v2.is_vote = 1
    GROUP BY v2.candidate_id
    ORDER BY vote_count DESC
  `);

  const results = query.all(sourceContestId, sourceCandidateId, targetContestId) as Array<{
    candidate_id: number;
    vote_count: number;
  }>;

  // Get total voters for this candidate
  const totalQuery = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as total
    FROM votes
    WHERE contest_id = ? AND candidate_id = ? AND is_vote = 1
  `);

  const totalResult = totalQuery.get(sourceContestId, sourceCandidateId) as { total: number };
  const totalVoters = totalResult.total;

  // Get total voters who voted in both contests
  const bothContestsQuery = db.prepare(`
    SELECT COUNT(DISTINCT v1.session_id) as total
    FROM votes v1
    INNER JOIN votes v2 ON v1.session_id = v2.session_id
    WHERE 
      v1.contest_id = ? 
      AND v1.candidate_id = ?
      AND v1.is_vote = 1
      AND v2.contest_id = ?
      AND v2.is_vote = 1
  `);

  const bothContestsResult = bothContestsQuery.get(
    sourceContestId,
    sourceCandidateId,
    targetContestId
  ) as {
    total: number;
  };
  const votersInBoth = bothContestsResult.total;

  const sourceCandidateName =
    candidateMap.get(sourceCandidateId) || `Candidate ${sourceCandidateId}`;
  console.log(`${sourceCandidateName.toUpperCase()}`);
  console.log(`Total voters: ${totalVoters.toLocaleString()}`);
  console.log(`Voters who also voted in target contest: ${votersInBoth.toLocaleString()}`);

  if (votersInBoth > 0) {
    console.log(`\nTarget contest vote breakdown:`);
    if (results.length > 0) {
      for (const result of results) {
        const percentage = (result.vote_count / votersInBoth) * 100;
        const candidateName =
          candidateMap.get(result.candidate_id) || `Candidate ${result.candidate_id}`;
        console.log(
          `  - ${candidateName}: ${result.vote_count.toLocaleString()} (${percentage.toFixed(1)}%)`
        );
      }
    } else {
      console.log('  (No votes found)');
    }
  } else {
    console.log(`\n(No voters found who voted in both contests)`);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
