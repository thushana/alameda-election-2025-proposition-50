// ============================================================================
// CROSS-CONTEST VOTING ANALYSIS
// ============================================================================
// Analyzes how voters who voted for candidates in one contest voted in another contest.
// Default source contest 40 = Alameda City Council (ballots with that contest are city-only);
// target = President/Vice President (contest id resolved from ContestManifest.json).
//
// Parallelism: set CROSS_CONTEST_WORKERS (default 4) to process CvrExport shards in worker_threads.

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import os from 'node:os';
import type { CrossContestWorkerConfig, FileShardResult } from './cross-contest-process-file.ts';
import { emptyShard, mergeShards, processCvrFilePath } from './cross-contest-process-file.ts';

/** Last token, title-cased (e.g. MICHELE PRYOR -> Pryor; WRITE-IN -> Write-in) */
function ballotLineShortName(description: string): string {
  const parts = description.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return description;
  const last = parts[parts.length - 1];
  const lower = last.toLowerCase();
  if (lower.startsWith('write-in')) return 'Write-in';
  return last.charAt(0) + last.slice(1).toLowerCase();
}

function formatPct1(p: number): string {
  return `${p.toFixed(1)}%`;
}

function findPresidentialCandidateIdBySubstring(
  presidentialCandidates: Map<number, string>,
  needle: string
): number | null {
  const u = needle.toUpperCase();
  for (const [id, name] of presidentialCandidates) {
    if (name.toUpperCase().includes(u)) return id;
  }
  return null;
}

function parseWorkerCount(): number {
  const raw = process.env.CROSS_CONTEST_WORKERS;
  if (raw === undefined || raw === '') {
    return Math.min(4, Math.max(1, os.availableParallelism() - 1 || 1));
  }
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1) return 1;
  return Math.min(n, 32);
}

/** Round-robin split so chunks stay balanced when file sizes differ */
function chunkFiles<T>(files: T[], partCount: number): T[][] {
  const buckets: T[][] = Array.from({ length: partCount }, () => []);
  files.forEach((f, i) => {
    buckets[i % partCount].push(f);
  });
  return buckets.filter((b) => b.length > 0);
}

function buildMapsFromShard(
  shard: FileShardResult,
  cityCouncilCandidates: Map<number, string>,
  presidentialCandidates: Map<number, string>
): {
  crossVoteMap: Map<number, Map<number, number>>;
  totalVotesPerCandidate: Map<number, number>;
} {
  const crossVoteMap = new Map<number, Map<number, number>>();
  const totalVotesPerCandidate = new Map<number, number>();

  for (const councilId of cityCouncilCandidates.keys()) {
    const inner = new Map<number, number>();
    for (const presId of presidentialCandidates.keys()) {
      inner.set(presId, 0);
    }
    crossVoteMap.set(councilId, inner);
    totalVotesPerCandidate.set(councilId, shard.councilSelectionTotals[String(councilId)] ?? 0);
  }

  for (const [cStr, innerObj] of Object.entries(shard.crossVote)) {
    const c = Number(cStr);
    const inner = crossVoteMap.get(c);
    if (!inner) continue;
    for (const [pStr, n] of Object.entries(innerObj)) {
      inner.set(Number(pStr), n);
    }
  }

  return { crossVoteMap, totalVotesPerCandidate };
}

function workerExecArgv(): string[] {
  const argv = [...process.execArgv];
  if (!argv.some((a) => a === 'tsx' || a.endsWith('/tsx') || a.includes('tsx/esm'))) {
    argv.push('--import', 'tsx');
  }
  return argv;
}

function runWorkerChunk(
  files: string[],
  config: CrossContestWorkerConfig
): Promise<FileShardResult> {
  const workerPath = fileURLToPath(new URL('./analyze-cross-contest-worker.ts', import.meta.url));
  return new Promise((resolve, reject) => {
    const w = new Worker(workerPath, {
      workerData: { files, config },
      execArgv: workerExecArgv(),
    });
    w.on('message', (msg: { ok: true; result: FileShardResult } | { ok: false; error: string }) => {
      if (msg.ok) resolve(msg.result);
      else reject(new Error(msg.error));
    });
    w.on('error', reject);
  });
}

async function main(): Promise<void> {
  const inputDir = process.argv[2];
  if (!inputDir) {
    console.error('Usage: tsx scripts/analyze-cross-contest.ts /path/to/CVR_Export');
    console.error('Optional: CROSS_CONTEST_WORKERS=N (default ~4, min 1, max 32)');
    process.exit(1);
  }

  const absoluteInputDir = path.resolve(inputDir);

  // Load manifests to get candidate names
  const candidateManifestPath = path.join(absoluteInputDir, 'CandidateManifest.json');
  const contestManifestPath = path.join(absoluteInputDir, 'ContestManifest.json');

  if (!fs.existsSync(candidateManifestPath) || !fs.existsSync(contestManifestPath)) {
    throw new Error('Missing required manifest files');
  }

  const candidateManifest = JSON.parse(fs.readFileSync(candidateManifestPath, 'utf-8'));
  const contestManifest = JSON.parse(fs.readFileSync(contestManifestPath, 'utf-8'));

  // Build contest ID to name mapping
  const contestMap = new Map<number, string>();
  for (const contest of contestManifest.List || []) {
    contestMap.set(contest.Id, contest.Description);
  }

  // Find target contests
  const cityCouncilContestId = 40; // "Members, City Council - Alameda"
  let presidentialContestId: number | null = null;

  for (const contest of contestManifest.List || []) {
    const name = contest.Description.toUpperCase();
    if (
      name.includes('PRESIDENT') ||
      name.includes('BIDEN') ||
      name.includes('HARRIS') ||
      name.includes('TRUMP')
    ) {
      presidentialContestId = contest.Id;
      break;
    }
  }

  if (!presidentialContestId) {
    console.error('Could not find presidential contest');
    process.exit(1);
  }

  console.log(`Analyzing cross-contest voting:`);
  console.log(
    `  Source Contest: ${cityCouncilContestId} - ${contestMap.get(cityCouncilContestId)}`
  );
  console.log(
    `  Target Contest: ${presidentialContestId} - ${contestMap.get(presidentialContestId)}`
  );
  console.log('');

  // Get all candidates in city council race
  const cityCouncilCandidates = new Map<number, string>();
  for (const candidate of candidateManifest.List || []) {
    if (candidate.ContestId === cityCouncilContestId) {
      cityCouncilCandidates.set(candidate.Id, candidate.Description);
    }
  }

  console.log(`City Council Candidates (${cityCouncilCandidates.size}):`);
  for (const [id, name] of cityCouncilCandidates.entries()) {
    console.log(`  ${id}: ${name}`);
  }
  console.log('');

  // Get all candidates in presidential race
  const presidentialCandidates = new Map<number, string>();
  for (const candidate of candidateManifest.List || []) {
    if (candidate.ContestId === presidentialContestId) {
      presidentialCandidates.set(candidate.Id, candidate.Description);
    }
  }

  console.log(`Presidential Candidates (${presidentialCandidates.size}):`);
  for (const [id, name] of presidentialCandidates.entries()) {
    console.log(`  ${id}: ${name}`);
  }
  console.log('');

  // Find CVR files
  const cvrFiles: string[] = [];
  const direct = path.join(absoluteInputDir, 'CvrExport.json');
  if (fs.existsSync(direct)) {
    cvrFiles.push(direct);
  } else {
    const files = fs.readdirSync(absoluteInputDir);
    const multiFiles = files
      .filter((f) => /^CvrExport_\d+\.json$/i.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
      })
      .map((f) => path.join(absoluteInputDir, f));
    cvrFiles.push(...multiFiles);
  }

  const workerConfig: CrossContestWorkerConfig = {
    cityCouncilContestId,
    presidentialContestId,
    cityCouncilCandidateIds: [...cityCouncilCandidates.keys()],
  };

  const requested = parseWorkerCount();
  const workerCount = Math.min(requested, cvrFiles.length, 32);
  if (requested !== workerCount) {
    console.log(
      `Note: CROSS_CONTEST_WORKERS=${requested} capped to file count → using ${workerCount} worker(s)`
    );
  }

  const startTime = Date.now();
  let merged: FileShardResult;

  if (workerCount <= 1) {
    console.log(
      `Processing ${cvrFiles.length} CVR file(s) sequentially (CROSS_CONTEST_WORKERS=1)...`
    );
    merged = emptyShard();
    let i = 0;
    for (const cvrFile of cvrFiles) {
      i += 1;
      console.log(`Processing file ${i}/${cvrFiles.length}: ${path.basename(cvrFile)}...`);
      const part = await processCvrFilePath(cvrFile, workerConfig);
      mergeShards(merged, part);
      console.log(
        `  Completed shard: ${part.totalProcessed.toLocaleString()} sessions (cumulative ${merged.totalProcessed.toLocaleString()})`
      );
    }
  } else {
    const chunks = chunkFiles(cvrFiles, workerCount);
    console.log(
      `Processing ${cvrFiles.length} CVR file(s) across ${chunks.length} worker thread(s) (CROSS_CONTEST_WORKERS=${workerCount})...`
    );
    const shardResults = await Promise.all(
      chunks.map((chunk, idx) => {
        console.log(
          `  Worker ${idx + 1}/${chunks.length}: ${chunk.length} file(s) — ${path.basename(chunk[0])} …`
        );
        return runWorkerChunk(chunk, workerConfig);
      })
    );
    merged = emptyShard();
    for (const s of shardResults) {
      mergeShards(merged, s);
    }
    console.log(`  All workers finished: ${merged.totalProcessed.toLocaleString()} sessions total`);
  }

  const { crossVoteMap, totalVotesPerCandidate } = buildMapsFromShard(
    merged,
    cityCouncilCandidates,
    presidentialCandidates
  );

  const sessionsWithCouncilVote = merged.sessionsWithCouncilVote;
  const sessionsWithPresidentialVote = merged.sessionsWithPresidentialVote;
  const sessionsWithBothContests = merged.sessionsWithBothContests;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nAll files processed in ${elapsed} seconds`);
  console.log('\n=== CROSS-CONTEST VOTING ANALYSIS ===\n');
  console.log(
    `Sessions (CVR rows) with a City Council (contest ${cityCouncilContestId}) vote: ${sessionsWithCouncilVote.toLocaleString()}`
  );
  console.log(
    `Sessions with a Presidential (contest ${presidentialContestId}) vote: ${sessionsWithPresidentialVote.toLocaleString()}`
  );
  console.log(
    `Sessions with BOTH on the same row (used below): ${sessionsWithBothContests.toLocaleString()}`
  );
  if (sessionsWithBothContests < sessionsWithCouncilVote * 0.25) {
    console.log(
      '\nWARNING: In this export, most council ballots do not include President on the same CVR session\n' +
        '(different ballot types/cards). Percentages below are only among the slice that has BOTH contests.\n'
    );
  }
  console.log('');

  // Print results for each city council candidate
  for (const [cityCouncilId, cityCouncilName] of cityCouncilCandidates.entries()) {
    const totalVotes = totalVotesPerCandidate.get(cityCouncilId) || 0;
    if (totalVotes === 0) continue;

    console.log(`${cityCouncilName.toUpperCase()}`);
    console.log(
      `Total council selections (same CVR session as a president vote): ${totalVotes.toLocaleString()}`
    );

    const crossVotes = crossVoteMap.get(cityCouncilId);
    if (crossVotes) {
      const sorted = Array.from(crossVotes.entries())
        .map(([presId, count]) => ({
          name: presidentialCandidates.get(presId) || `Unknown (${presId})`,
          count,
          percentage: (count / totalVotes) * 100,
        }))
        .sort((a, b) => b.count - a.count);

      for (const { name, count, percentage } of sorted) {
        if (count > 0) {
          console.log(`  - ${name}: ${count.toLocaleString()} (${percentage.toFixed(1)}%)`);
        }
      }
    }
    console.log('');
  }

  // --- Markdown table: top 4 prez (by cross-tab weight), Other/write-in; rows by Harris % ---
  const presVoteTotals = new Map<number, number>();
  for (const councilId of cityCouncilCandidates.keys()) {
    const m = crossVoteMap.get(councilId);
    if (!m) continue;
    for (const [presId, count] of m) {
      presVoteTotals.set(presId, (presVoteTotals.get(presId) ?? 0) + count);
    }
  }

  const sortedPres = [...presVoteTotals.entries()].sort((a, b) => b[1] - a[1]);
  const top4PresIds = sortedPres.slice(0, 4).map(([id]) => id);
  const top4Set = new Set(top4PresIds);
  const harrisId = findPresidentialCandidateIdBySubstring(presidentialCandidates, 'HARRIS');

  const councilRows = [...cityCouncilCandidates.entries()]
    .map(([councilId, fullName]) => {
      const tot = totalVotesPerCandidate.get(councilId) || 0;
      const cross = crossVoteMap.get(councilId);
      const harrisVotes = harrisId != null && cross ? (cross.get(harrisId) ?? 0) : 0;
      const harrisPct = tot > 0 ? (harrisVotes / tot) * 100 : 0;
      return { councilId, fullName, tot, harrisPct };
    })
    .filter((r) => r.tot > 0)
    .sort((a, b) => b.harrisPct - a.harrisPct);

  const colHeaders = top4PresIds.map((id) =>
    ballotLineShortName(presidentialCandidates.get(id) || `Id${id}`)
  );

  console.log('### Cross-tab (markdown): top 4 presidential + Other/write-in');
  console.log('Rows sorted by Harris %. Same-session CVR slice only (see warning above).\n');
  const sep = '| :--- |' + top4PresIds.map(() => ' ---: |').join('') + ' ---: |';
  console.log('| Council | ' + colHeaders.join(' | ') + ' | Other / write-in |');
  console.log(sep);

  for (const { councilId, fullName, tot } of councilRows) {
    const cross = crossVoteMap.get(councilId);
    if (!cross) continue;

    let otherPct = 0;
    const mainCells: string[] = [];
    for (const presId of top4PresIds) {
      const c = cross.get(presId) ?? 0;
      mainCells.push(formatPct1((c / tot) * 100));
    }
    for (const [presId, count] of cross) {
      if (top4Set.has(presId)) continue;
      otherPct += (count / tot) * 100;
    }
    const row =
      '| ' +
      ballotLineShortName(fullName) +
      ' | ' +
      mainCells.join(' | ') +
      ' | ' +
      formatPct1(otherPct) +
      ' |';
    console.log(row);
  }
  console.log('');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
