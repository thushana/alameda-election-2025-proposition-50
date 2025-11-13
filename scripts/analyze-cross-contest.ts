// ============================================================================
// CROSS-CONTEST VOTING ANALYSIS
// ============================================================================
// Analyzes how voters who voted for candidates in one contest voted in another contest

import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import streamJson from 'stream-json';
import pickPkg from 'stream-json/filters/Pick.js';
import streamArrayPkg from 'stream-json/streamers/StreamArray.js';

// Type definitions for stream-json (external library types)
type StreamJsonParser = (...args: unknown[]) => NodeJS.ReadWriteStream;
type StreamJsonPick = (args: { filter: string }) => NodeJS.ReadWriteStream;
type StreamJsonStreamArray = (...args: unknown[]) => NodeJS.ReadWriteStream;

const { parser } = streamJson as { parser: StreamJsonParser };
const { pick } = pickPkg as { pick: StreamJsonPick };
const { streamArray } = streamArrayPkg as { streamArray: StreamJsonStreamArray };

interface CvrMark {
  IsVote?: boolean;
  CandidateId?: number;
}

interface CvrContest {
  Id?: number;
  Marks?: CvrMark[];
}

interface CvrCard {
  Contests?: CvrContest[];
}

interface CvrOriginal {
  Cards?: CvrCard[];
}

interface CvrRecord {
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

async function main(): Promise<void> {
  const inputDir = process.argv[2];
  if (!inputDir) {
    console.error('Usage: tsx scripts/analyze-cross-contest.ts /path/to/CVR_Export');
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

  // Build candidate ID to name mapping
  const candidateMap = new Map<number, string>();
  for (const candidate of candidateManifest.List || []) {
    candidateMap.set(candidate.Id, candidate.Description);
  }

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

  // Track votes: cityCouncilCandidateId -> presidentialCandidateId -> count
  const crossVoteMap = new Map<number, Map<number, number>>();

  // Initialize maps
  for (const cityCouncilId of cityCouncilCandidates.keys()) {
    crossVoteMap.set(cityCouncilId, new Map<number, number>());
    for (const presId of presidentialCandidates.keys()) {
      crossVoteMap.get(cityCouncilId)!.set(presId, 0);
    }
  }

  // Track total votes per city council candidate
  const totalVotesPerCandidate = new Map<number, number>();
  for (const id of cityCouncilCandidates.keys()) {
    totalVotesPerCandidate.set(id, 0);
  }

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

  console.log(`Processing ${cvrFiles.length} CVR file(s) sequentially...`);

  const startTime = Date.now();
  let totalProcessed = 0;

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
        const original: CvrOriginal = (record.Original ?? {}) as CvrOriginal;
        const cards = safeGetArray<CvrCard>(original.Cards);

        // Get votes for both contests across ALL cards in this session (same voter)
        let cityCouncilVote: number | null = null;
        let presidentialVote: number | null = null;

        // First pass: find votes in both contests across all cards
        for (const card of cards) {
          const contests = safeGetArray<CvrContest>(card.Contests);

          for (const contest of contests) {
            const contestId = contest?.Id;
            if (!contestId) continue;

            const marks = safeGetArray<CvrMark>(contest.Marks);
            for (const mark of marks) {
              if (!mark || typeof mark !== 'object') continue;
              if (!mark.IsVote) continue;

              const candidateId = mark.CandidateId as number | undefined;
              if (!candidateId) continue;

              if (contestId === cityCouncilContestId && cityCouncilVote === null) {
                cityCouncilVote = candidateId;
              } else if (contestId === presidentialContestId && presidentialVote === null) {
                presidentialVote = candidateId;
              }
            }
          }
        }

        // If voter voted in both contests, record the cross-vote
        if (cityCouncilVote !== null && presidentialVote !== null) {
          const cityCouncilMap = crossVoteMap.get(cityCouncilVote);
          if (cityCouncilMap) {
            const current = cityCouncilMap.get(presidentialVote) || 0;
            cityCouncilMap.set(presidentialVote, current + 1);
            totalVotesPerCandidate.set(
              cityCouncilVote,
              (totalVotesPerCandidate.get(cityCouncilVote) || 0) + 1
            );
          }
        }
      });

      sessionsArray.on('error', (err) => {
        console.error(
          `Error processing ${path.basename(cvrFile)}: ${err instanceof Error ? err.message : String(err)}`
        );
        reject(err);
      });
      p.on('error', reject);
      sessionsPicker.on('error', reject);
      source.on('error', reject);

      sessionsArray.on('end', () => {
        console.log(
          `  Completed: ${fileProcessed.toLocaleString()} records (Total: ${totalProcessed.toLocaleString()})`
        );
        resolve();
      });

      pipeline(source, p, sessionsPicker, sessionsArray).catch(reject);
    });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nAll files processed in ${elapsed} seconds`);
  console.log('\n=== CROSS-CONTEST VOTING ANALYSIS ===\n');

  // Print results for each city council candidate
  for (const [cityCouncilId, cityCouncilName] of cityCouncilCandidates.entries()) {
    const totalVotes = totalVotesPerCandidate.get(cityCouncilId) || 0;
    if (totalVotes === 0) continue;

    console.log(`${cityCouncilName.toUpperCase()}`);
    console.log(`Total voters: ${totalVotes.toLocaleString()}`);

    const crossVotes = crossVoteMap.get(cityCouncilId);
    if (crossVotes) {
      // Sort by vote count descending
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
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
