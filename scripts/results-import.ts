#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream';
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

// Old types removed - now using new multi-contest structures

// CVR data structure types
interface CvrMark {
  IsVote?: boolean;
  IsAmbiguous?: boolean;
  CandidateId?: number;
  MarkDensity?: number;
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
  Original?: CvrOriginal;
  CountingGroupId?: number;
}

interface CvrStreamValue {
  value: CvrRecord;
}

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

function ensureDirExists(dirPath: string): void {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    throw new Error(`Input path is not a directory or does not exist: ${dirPath}`);
  }
}

// Extract election date from folder path for file naming (e.g., "2024-11" or "2025-11")
function extractElectionDate(folderPath: string): string | null {
  const folderName = path.basename(folderPath);
  // Try to extract from folder name patterns like "CVR Export - November 5, 2024 General Election"
  const yearMatch = folderName.match(/(\d{4})/);
  const monthMatch = folderName.match(
    /November|Nov|November|December|Dec|January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sep|October|Oct/i
  );

  if (yearMatch) {
    const year = yearMatch[1];
    let month = '11'; // Default to November
    if (monthMatch) {
      const monthName = monthMatch[0].toLowerCase();
      const monthMap: Record<string, string> = {
        january: '01',
        jan: '01',
        february: '02',
        feb: '02',
        march: '03',
        mar: '03',
        april: '04',
        apr: '04',
        may: '05',
        june: '06',
        jun: '06',
        july: '07',
        jul: '07',
        august: '08',
        aug: '08',
        september: '09',
        sep: '09',
        october: '10',
        oct: '10',
        november: '11',
        nov: '11',
        december: '12',
        dec: '12',
      };
      month = monthMap[monthName] || '11';
    }
    return `${year}-${month}`;
  }

  // Fallback: try CVR_Export_YYYYMMDDHHMMSS pattern
  const match = folderName.match(/CVR_Export_(\d{4})(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  return null;
}

// Extract date from folder path (e.g., CVR_Export_20251107150911 -> Nov 7, 2025)
function extractDateFromPath(folderPath: string): {
  dateStr: string;
  dateStrWithSuffix: string;
  timeStr: string;
} | null {
  const folderName = path.basename(folderPath);
  // Match pattern: CVR_Export_YYYYMMDDHHMMSS
  const match = folderName.match(/CVR_Export_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!match) {
    return null;
  }

  const [, year, month, dayStr, hour, minute] = match;
  const date = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(dayStr, 10),
    parseInt(hour, 10),
    parseInt(minute, 10)
  );

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const day = date.getDate();
  // Add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  const getOrdinalSuffix = (n: number): string => {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  };
  const dateStrWithSuffix = `${monthNames[date.getMonth()]} ${day}${getOrdinalSuffix(day)}, ${year}`;
  const dateStr = `${monthNames[date.getMonth()]} ${day}, ${year}`;
  const hour12 = date.getHours() % 12 || 12;
  const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
  const timeStr = `${hour12}:${minute} ${ampm}`;

  return { dateStr, dateStrWithSuffix, timeStr };
}

// Update README with date
function updateReadme(dateStrWithSuffix: string, timeStr: string): void {
  const readmePath = path.resolve(process.cwd(), 'README.md');
  if (!fs.existsSync(readmePath)) {
    console.log('README.md not found, skipping update');
    return;
  }

  let content = fs.readFileSync(readmePath, 'utf-8');
  // Update the date line: "The data in it comes from a ACVote's Nov 7th, 2025 @ 3:09 PM data release."
  content = content.replace(
    /The data in it comes from a ACVote's (?:Nov|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Dec) \d+(?:st|nd|rd|th)?, \d{4} @ \d+:\d+ (?:AM|PM) data release\./,
    `The data in it comes from a ACVote's ${dateStrWithSuffix} @ ${timeStr} data release.`
  );

  fs.writeFileSync(readmePath, content, 'utf-8');
  console.log(`Updated README.md with date: ${dateStrWithSuffix} @ ${timeStr}`);
}

// Update index.html with date
function updateIndexHtml(dateStr: string): void {
  const indexPath = path.resolve(process.cwd(), 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.log('index.html not found, skipping update');
    return;
  }

  let content = fs.readFileSync(indexPath, 'utf-8');
  // Update the date line: "Data updated Nov 7, 2025 •"
  content = content.replace(
    /Data updated (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d+, \d{4} •/,
    `Data updated ${dateStr} •`
  );

  fs.writeFileSync(indexPath, content, 'utf-8');
  console.log(`Updated index.html with date: ${dateStr}`);
}

// Format number to always show at least one decimal place (matches Python's round behavior)
function formatPercentage(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  // Ensure it's a float that will serialize with at least one decimal
  return parseFloat(rounded.toFixed(2));
}

// Custom JSON stringifier that ensures numbers show at least one decimal place
function stringifyWithDecimals(obj: unknown, indent = 2): string {
  const json = JSON.stringify(obj, null, indent);
  // Replace whole numbers in percentage fields with .0 format
  // Match patterns like "yes": 100 or "no": 0 in percentage objects, or "percentage_of_total": 100
  // But NOT in votes objects (vote counts should remain integers)
  // Use line-by-line approach to check context
  const lines = json.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if we're in a percentage block by looking back at recent lines
    // We're in a percentage block if we've seen "percentage": recently and haven't seen "votes": since then
    let inPercentageBlock = false;
    let lastPercentageIndex = -1;
    let lastVotesIndex = -1;

    // Look back to find the most recent "percentage": or "votes":
    for (let j = i; j >= 0 && j >= i - 20; j--) {
      if (lines[j].includes('"percentage":')) {
        if (lastPercentageIndex === -1) {
          lastPercentageIndex = j;
        }
      }
      if (lines[j].includes('"votes":')) {
        if (lastVotesIndex === -1) {
          lastVotesIndex = j;
        }
      }
    }

    // We're in a percentage block if we found "percentage": and either:
    // - we didn't find "votes":, or
    // - "percentage": is more recent than "votes":
    if (lastPercentageIndex !== -1) {
      if (lastVotesIndex === -1 || lastPercentageIndex > lastVotesIndex) {
        inPercentageBlock = true;
      }
    }

    // Only format percentage fields, not vote counts
    // percentage_of_total is always a percentage field (sibling of percentage object)
    if (line.match(/^\s*"percentage_of_total":\s*(\d+)(\s*[,}])/)) {
      result.push(
        line.replace(
          /("percentage_of_total":\s*)(\d+)(\s*[,}])/,
          (_match, prefix, num, suffix) => `${prefix}${num}.0${suffix}`
        )
      );
    } else if (inPercentageBlock && line.match(/^\s*"(?:yes|no)":\s*(\d+)(\s*[,}])/)) {
      result.push(
        line.replace(
          /("(?:yes|no)":\s*)(\d+)(\s*[,}])/,
          (_match, prefix, num, suffix) => `${prefix}${num}.0${suffix}`
        )
      );
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

function resolveCvrFiles(inputDir: string): string[] {
  const direct = path.join(inputDir, 'CvrExport.json');
  if (fs.existsSync(direct)) return [direct];

  // Check for single CVR_Export*.json file
  const files = fs.readdirSync(inputDir);
  const singleAlt = files.find(
    (f: string) => /^CVR_Export.*\.json$/i.test(f) && !/^CvrExport_\d+\.json$/i.test(f)
  );
  if (singleAlt) return [path.join(inputDir, singleAlt)];

  // Check for multiple CvrExport_*.json files
  const multiFiles = files
    .filter((f: string) => /^CvrExport_\d+\.json$/i.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    })
    .map((f: string) => path.join(inputDir, f));

  if (multiFiles.length > 0) return multiFiles;

  throw new Error(
    `Could not find CVR export file(s). Expected 'CvrExport.json', 'CVR_Export*.json', or 'CvrExport_*.json' files in ${inputDir}`
  );
}

function safeGetArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// Old incrementCounts function removed - using incrementCandidateVote instead

async function main(): Promise<void> {
  const inputDir = process.argv[2];
  if (!inputDir) {
    console.error('Usage: node js/results-import.js /absolute/path/to/CVR_Export_YYYYMMDDHHMMSS');
    process.exit(1);
  }

  const absoluteInputDir = path.resolve(inputDir);
  ensureDirExists(absoluteInputDir);

  // Resolve files
  const cvrFiles = resolveCvrFiles(absoluteInputDir);
  const portionManifestPath = path.join(absoluteInputDir, 'PrecinctPortionManifest.json');
  const precinctManifestPath = path.join(absoluteInputDir, 'PrecinctManifest.json');
  const candidateManifestPath = path.join(absoluteInputDir, 'CandidateManifest.json');
  const contestManifestPath = path.join(absoluteInputDir, 'ContestManifest.json');
  const countingGroupManifestPath = path.join(absoluteInputDir, 'CountingGroupManifest.json');

  const requiredFiles = [
    portionManifestPath,
    precinctManifestPath,
    candidateManifestPath,
    countingGroupManifestPath,
  ];
  for (const f of requiredFiles) {
    if (!fs.existsSync(f)) {
      throw new Error(`Missing required file: ${f}`);
    }
  }

  console.log('Loading manifest files...');
  const portionManifest = readJsonFile<{
    List: Array<{ Id: number; PrecinctId: number }>;
  }>(portionManifestPath);
  const precinctManifest = readJsonFile<{
    List: Array<{ Id: number; Description: string }>;
  }>(precinctManifestPath);
  const candidateManifest = readJsonFile<{
    List: Array<{ Id: number; ContestId: number; Description: string }>;
  }>(candidateManifestPath);
  const countingGroupManifest = readJsonFile<{
    List: Array<{ Id: number; Description: string }>;
  }>(countingGroupManifestPath);

  // Load contest manifest if available
  let contestManifest: {
    List: Array<{
      Id: number;
      Description: string;
      VoteFor?: number;
      NumOfRanks?: number;
      DistrictId?: number;
    }>;
  } | null = null;
  if (fs.existsSync(contestManifestPath)) {
    contestManifest = readJsonFile<{
      List: Array<{
        Id: number;
        Description: string;
        VoteFor?: number;
        NumOfRanks?: number;
        DistrictId?: number;
      }>;
    }>(contestManifestPath);
    console.log(`Loaded ${contestManifest.List.length} contests from manifest`);
  }

  const portionToPrecinctId = new Map<number, number>(
    portionManifest.List.map((p) => [p.Id, p.PrecinctId])
  );
  const precinctIdToName = new Map<number, string>(
    precinctManifest.List.map((p) => [p.Id, p.Description])
  );

  // Build candidate mappings for all contests
  const candidatesByContest = new Map<number, Map<number, string>>();
  for (const candidate of candidateManifest.List) {
    if (!candidatesByContest.has(candidate.ContestId)) {
      candidatesByContest.set(candidate.ContestId, new Map());
    }
    candidatesByContest.get(candidate.ContestId)!.set(candidate.Id, candidate.Description);
  }
  console.log(`Loaded candidates for ${candidatesByContest.size} contests`);

  const countingGroups = countingGroupManifest.List.reduce<Record<number, string>>((acc, cg) => {
    acc[cg.Id] = cg.Description;
    return acc;
  }, {});
  console.log('Counting groups:', countingGroups);

  // New data structures: precinct -> contest -> candidate -> votes
  type CandidateVoteCounts = Record<number, number>; // candidateId -> vote count
  type ContestVotes = Record<number, CandidateVoteCounts>; // contestId -> candidate votes
  type PrecinctContestVotes = Record<string, ContestVotes>; // precinct -> contest votes
  // For method-specific votes: precinct -> methodId -> contestId -> candidate votes
  type PrecinctMethodContestVotes = Record<string, Record<number, ContestVotes>>;

  const precinctContestVotes: PrecinctContestVotes = {};
  const precinctMethodContestVotes: PrecinctMethodContestVotes = {};

  // Helpers to initialize structures on-demand
  function ensurePrecinctContest(precinctName: string, contestId: number): void {
    if (!precinctContestVotes[precinctName]) {
      precinctContestVotes[precinctName] = {};
    }
    if (!precinctContestVotes[precinctName][contestId]) {
      precinctContestVotes[precinctName][contestId] = {};
    }
  }

  function ensurePrecinctMethodContest(
    precinctName: string,
    methodId: number,
    contestId: number
  ): void {
    if (!precinctMethodContestVotes[precinctName]) {
      precinctMethodContestVotes[precinctName] = {};
    }
    if (!precinctMethodContestVotes[precinctName][methodId]) {
      precinctMethodContestVotes[precinctName][methodId] = {};
    }
    if (!precinctMethodContestVotes[precinctName][methodId][contestId]) {
      precinctMethodContestVotes[precinctName][methodId][contestId] = {};
    }
  }

  function incrementCandidateVote(target: CandidateVoteCounts, candidateId: number): void {
    if (!target[candidateId]) {
      target[candidateId] = 0;
    }
    target[candidateId] += 1;
  }

  console.log(`Processing ${cvrFiles.length} CVR export file(s) (streaming)...`);
  let processed = 0;

  // Process each CVR file
  for (const cvrFile of cvrFiles) {
    console.log(`Processing ${path.basename(cvrFile)}...`);
    await new Promise<void>((resolve, reject) => {
      const source = fs.createReadStream(cvrFile);
      const p = parser();
      const sessionsPicker = pick({ filter: 'Sessions' });
      const sessionsArray = streamArray();

      sessionsArray.on('data', ({ value }: CvrStreamValue) => {
        processed += 1;
        if (processed % 100000 === 0) {
          console.log(`  Processed ${processed.toLocaleString()} records...`);
        }

        const record: CvrRecord = value ?? {};
        const original: CvrOriginal = (record.Original ?? {}) as CvrOriginal;
        const cards = safeGetArray<CvrCard>(original.Cards);
        const precinctPortionId = original.PrecinctPortionId;
        const countingGroupId = record.CountingGroupId;

        if (!precinctPortionId) return;
        const precinctId = portionToPrecinctId.get(precinctPortionId);
        if (!precinctId) return;
        const precinctName = precinctIdToName.get(precinctId);
        if (!precinctName) return;

        for (const card of cards) {
          const contests = safeGetArray<CvrContest>(card.Contests);
          for (const contest of contests) {
            const contestId = contest?.Id;
            if (!contestId) continue;

            // Skip if we don't have candidate mappings for this contest
            if (!candidatesByContest.has(contestId)) continue;

            const marks = safeGetArray<CvrMark>(contest.Marks);
            if (marks.length === 0) continue;

            ensurePrecinctContest(precinctName, contestId);
            if (typeof countingGroupId === 'number') {
              ensurePrecinctMethodContest(precinctName, countingGroupId, contestId);
            }

            for (const mark of marks) {
              if (!mark || typeof mark !== 'object') continue;
              const candidateId = mark.CandidateId as number | undefined;
              const isVote = mark.IsVote === true;

              if (candidateId && isVote) {
                // Only count actual votes
                incrementCandidateVote(precinctContestVotes[precinctName][contestId], candidateId);
                if (typeof countingGroupId === 'number') {
                  const methodContestVotes =
                    precinctMethodContestVotes[precinctName]?.[countingGroupId];
                  if (methodContestVotes) {
                    const contestVotes = methodContestVotes[contestId];
                    if (contestVotes) {
                      incrementCandidateVote(contestVotes, candidateId);
                    }
                  }
                }
              }
            }
          }
        }
      });

      sessionsArray.on('error', reject);
      p.on('error', reject);
      sessionsPicker.on('error', reject);
      source.on('error', reject);

      sessionsArray.on('end', resolve);

      pipeline(source, p, sessionsPicker, sessionsArray, (err: unknown) => {
        if (err) reject(err);
      });
    });
  }

  const precinctsWithVotes = new Set<string>(Object.keys(precinctContestVotes));
  console.log(`\nFound votes in ${precinctsWithVotes.size} precincts`);

  // Get all precincts from manifest
  const allManifestPrecincts = new Set<string>(Array.from(precinctIdToName.values()));
  console.log(`Total precincts in manifest: ${allManifestPrecincts.size}`);

  // Get all contest IDs that have votes
  const allContestIds = new Set<number>();
  for (const precinctName of Object.keys(precinctContestVotes)) {
    for (const contestId of Object.keys(precinctContestVotes[precinctName]).map(Number)) {
      allContestIds.add(contestId);
    }
  }
  console.log(`Found ${allContestIds.size} contests with votes`);

  // Build contest name map
  const contestNameMap = new Map<number, string>();
  if (contestManifest) {
    for (const contest of contestManifest.List) {
      contestNameMap.set(contest.Id, contest.Description);
    }
  }

  type OutputItem = {
    precinct: string;
    contests: Record<
      number,
      {
        contestId: number;
        contestName: string;
        candidates: Array<{
          candidateId: number;
          candidateName: string;
          votes: number;
          percentage: number;
        }>;
        totalVotes: number;
        vote_method?: {
          mail_in: {
            candidates: Array<{
              candidateId: number;
              candidateName: string;
              votes: number;
              percentage: number;
            }>;
            totalVotes: number;
            percentage_of_total: number;
          };
          in_person: {
            candidates: Array<{
              candidateId: number;
              candidateName: string;
              votes: number;
              percentage: number;
            }>;
            totalVotes: number;
            percentage_of_total: number;
          };
        };
      }
    >;
  };

  const results: OutputItem[] = [];
  const precinctNames = Array.from(allManifestPrecincts).sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0
  );

  for (const precinctName of precinctNames) {
    const precinctContests: Record<
      number,
      {
        contestId: number;
        contestName: string;
        candidates: Array<{
          candidateId: number;
          candidateName: string;
          votes: number;
          percentage: number;
        }>;
        totalVotes: number;
        vote_method?: {
          mail_in?: {
            candidates: Array<{
              candidateId: number;
              candidateName: string;
              votes: number;
              percentage: number;
            }>;
            totalVotes: number;
            percentage_of_total: number;
          };
          in_person?: {
            candidates: Array<{
              candidateId: number;
              candidateName: string;
              votes: number;
              percentage: number;
            }>;
            totalVotes: number;
            percentage_of_total: number;
          };
        };
      }
    > = {};
    const contestVotes = precinctContestVotes[precinctName] || {};

    // Process each contest for this precinct
    for (const contestId of allContestIds) {
      const candidateVotes = contestVotes[contestId] || {};
      const contestCandidates = candidatesByContest.get(contestId);
      if (!contestCandidates) continue;

      // Calculate total votes for this contest
      let totalVotes = 0;
      for (const voteCount of Object.values(candidateVotes)) {
        totalVotes += voteCount;
      }

      // Build candidate results
      const candidates: Array<{
        candidateId: number;
        candidateName: string;
        votes: number;
        percentage: number;
      }> = [];
      for (const [candidateId, candidateName] of contestCandidates.entries()) {
        const votes = candidateVotes[candidateId] || 0;
        const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
        candidates.push({
          candidateId,
          candidateName,
          votes,
          percentage: formatPercentage(percentage),
        });
      }
      // Sort by votes descending
      candidates.sort((a, b) => b.votes - a.votes);

      const contestName = contestNameMap.get(contestId) || `Contest ${contestId}`;

      // Process vote method data
      const methodVotes = precinctMethodContestVotes[precinctName] || {};
      const mailInMethod = methodVotes[2]; // CountingGroupId 2 = mail in
      const inPersonMethod = methodVotes[1]; // CountingGroupId 1 = in person

      let voteMethod:
        | {
            mail_in?: {
              candidates: Array<{
                candidateId: number;
                candidateName: string;
                votes: number;
                percentage: number;
              }>;
              totalVotes: number;
              percentage_of_total: number;
            };
            in_person?: {
              candidates: Array<{
                candidateId: number;
                candidateName: string;
                votes: number;
                percentage: number;
              }>;
              totalVotes: number;
              percentage_of_total: number;
            };
          }
        | undefined = undefined;
      if (mailInMethod || inPersonMethod) {
        voteMethod = {};

        // Mail in
        if (mailInMethod && mailInMethod[contestId]) {
          const mailInCandidateVotes = mailInMethod[contestId];
          let mailInTotal = 0;
          for (const candidateId of Object.keys(mailInCandidateVotes).map(Number)) {
            const voteCount = mailInCandidateVotes[candidateId];
            if (typeof voteCount === 'number') {
              mailInTotal += voteCount;
            }
          }

          const mailInCandidates = Array.from(contestCandidates.entries()).map(
            ([candidateId, candidateName]) => {
              const voteCount = mailInCandidateVotes[candidateId];
              const votes = typeof voteCount === 'number' ? voteCount : 0;
              const percentage = mailInTotal > 0 ? (votes / mailInTotal) * 100 : 0;
              return {
                candidateId,
                candidateName,
                votes,
                percentage: formatPercentage(percentage),
              };
            }
          );
          mailInCandidates.sort((a, b) => b.votes - a.votes);

          voteMethod.mail_in = {
            candidates: mailInCandidates,
            totalVotes: mailInTotal,
            percentage_of_total:
              totalVotes > 0 ? formatPercentage((mailInTotal / totalVotes) * 100) : 0,
          };
        }

        // In person
        if (inPersonMethod && inPersonMethod[contestId]) {
          const inPersonCandidateVotes = inPersonMethod[contestId];
          let inPersonTotal = 0;
          for (const candidateId of Object.keys(inPersonCandidateVotes).map(Number)) {
            const voteCount = inPersonCandidateVotes[candidateId];
            if (typeof voteCount === 'number') {
              inPersonTotal += voteCount;
            }
          }

          const inPersonCandidates = Array.from(contestCandidates.entries()).map(
            ([candidateId, candidateName]) => {
              const voteCount = inPersonCandidateVotes[candidateId];
              const votes = typeof voteCount === 'number' ? voteCount : 0;
              const percentage = inPersonTotal > 0 ? (votes / inPersonTotal) * 100 : 0;
              return {
                candidateId,
                candidateName,
                votes,
                percentage: formatPercentage(percentage),
              };
            }
          );
          inPersonCandidates.sort((a, b) => b.votes - a.votes);

          voteMethod.in_person = {
            candidates: inPersonCandidates,
            totalVotes: inPersonTotal,
            percentage_of_total:
              totalVotes > 0 ? formatPercentage((inPersonTotal / totalVotes) * 100) : 0,
          };
        }
      }

      precinctContests[contestId] = {
        contestId,
        contestName,
        candidates,
        totalVotes,
        vote_method: voteMethod,
      };
    }

    // Only include precinct if it has at least one contest with votes
    if (Object.keys(precinctContests).length > 0) {
      results.push({
        precinct: precinctName,
        contests: precinctContests,
      });
    }
  }

  // Determine output filename
  const electionDate = extractElectionDate(absoluteInputDir);
  const outputFilename = electionDate ? `results-${electionDate}.json` : 'results.json';
  const outputPath = path.resolve(process.cwd(), outputFilename);
  fs.writeFileSync(outputPath, stringifyWithDecimals(results), 'utf-8');
  console.log(`\nResults saved to ${outputPath}`);

  // Extract date from folder path and update README and index.html
  const dateInfo = extractDateFromPath(absoluteInputDir);
  if (dateInfo) {
    updateReadme(dateInfo.dateStrWithSuffix, dateInfo.timeStr);
    updateIndexHtml(dateInfo.dateStr);
  } else {
    console.log(
      'Could not extract date from folder path. Expected format: CVR_Export_YYYYMMDDHHMMSS'
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
