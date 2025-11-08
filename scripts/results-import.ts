#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream';
import streamJson from 'stream-json';
import pickPkg from 'stream-json/filters/Pick.js';
import streamArrayPkg from 'stream-json/streamers/StreamArray.js';
const { parser } = streamJson as { parser: (...args: unknown[]) => any };
const { pick } = pickPkg as { pick: (args: { filter: string }) => any };
const { streamArray } = streamArrayPkg as { streamArray: (...args: unknown[]) => any };

type VoteCounts = { yes: number; no: number; total: number };
type MethodVotes = Record<number, VoteCounts>;
type PrecinctTotals = Record<string, VoteCounts>;
type PrecinctMethods = Record<string, MethodVotes>;

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

function ensureDirExists(dirPath: string): void {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    throw new Error(`Input path is not a directory or does not exist: ${dirPath}`);
  }
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

function resolveCvrFile(inputDir: string): string {
  const direct = path.join(inputDir, 'CvrExport.json');
  if (fs.existsSync(direct)) return direct;
  const files = fs.readdirSync(inputDir);
  const alt = files.find((f: string) => /^CVR_Export.*\.json$/i.test(f));
  if (alt) return path.join(inputDir, alt);
  throw new Error(
    `Could not find CVR export file. Expected 'CvrExport.json' or 'CVR_Export*.json' in ${inputDir}`
  );
}

function safeGetArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function incrementCounts(target: VoteCounts, kind: 'yes' | 'no'): void {
  target[kind] += 1;
  target.total += 1;
}

async function main(): Promise<void> {
  const inputDir = process.argv[2];
  if (!inputDir) {
    console.error('Usage: node js/results-import.js /absolute/path/to/CVR_Export_YYYYMMDDHHMMSS');
    process.exit(1);
  }

  const absoluteInputDir = path.resolve(inputDir);
  ensureDirExists(absoluteInputDir);

  // Resolve files
  const cvrFile = resolveCvrFile(absoluteInputDir);
  const portionManifestPath = path.join(absoluteInputDir, 'PrecinctPortionManifest.json');
  const precinctManifestPath = path.join(absoluteInputDir, 'PrecinctManifest.json');
  const candidateManifestPath = path.join(absoluteInputDir, 'CandidateManifest.json');
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

  const portionToPrecinctId = new Map<number, number>(
    portionManifest.List.map((p) => [p.Id, p.PrecinctId])
  );
  const precinctIdToName = new Map<number, string>(
    precinctManifest.List.map((p) => [p.Id, p.Description])
  );
  const contest1Candidates = candidateManifest.List.filter((c) => c.ContestId === 1).reduce<
    Record<number, string>
  >((acc, c) => {
    acc[c.Id] = c.Description;
    return acc;
  }, {});
  console.log('Contest 1 candidates:', contest1Candidates);

  const countingGroups = countingGroupManifest.List.reduce<Record<number, string>>((acc, cg) => {
    acc[cg.Id] = cg.Description;
    return acc;
  }, {});
  console.log('Counting groups:', countingGroups);

  const precinctTotals: PrecinctTotals = {};
  const precinctMethods: PrecinctMethods = {};

  // Helpers to initialize structures on-demand
  function ensurePrecinct(precinctName: string): void {
    if (!precinctTotals[precinctName]) {
      precinctTotals[precinctName] = { yes: 0, no: 0, total: 0 };
    }
    if (!precinctMethods[precinctName]) {
      precinctMethods[precinctName] = {};
    }
  }
  function ensureMethod(precinctName: string, methodId: number): void {
    const methods = precinctMethods[precinctName];
    if (!methods[methodId]) {
      methods[methodId] = { yes: 0, no: 0, total: 0 };
    }
  }

  console.log('Processing CVR export (streaming)...');
  let processed = 0;

  await new Promise<void>((resolve, reject) => {
    const source = fs.createReadStream(cvrFile);
    const p = parser();
    const sessionsPicker = pick({ filter: 'Sessions' });
    const sessionsArray = streamArray();

    sessionsArray.on('data', ({ value }: { value: any }) => {
      processed += 1;
      if (processed % 100000 === 0) {
        console.log(`  Processed ${processed.toLocaleString()} records...`);
      }

      const record = value ?? {};
      const original = (record.Original ?? {}) as any;
      const cards = safeGetArray<any>(original.Cards);
      const precinctPortionId = original.PrecinctPortionId as number | undefined;
      const countingGroupId = record.CountingGroupId as number | undefined;

      if (!precinctPortionId) return;
      const precinctId = portionToPrecinctId.get(precinctPortionId);
      if (!precinctId) return;
      const precinctName = precinctIdToName.get(precinctId);
      if (!precinctName) return;

      for (const card of cards) {
        const contests = safeGetArray<any>(card.Contests);
        for (const contest of contests) {
          const contestId = contest?.Id as number | undefined;
          if (contestId !== 1) continue;
          const marks = safeGetArray<any>(contest.Marks);
          if (marks.length === 0) continue;

          ensurePrecinct(precinctName);
          if (typeof countingGroupId === 'number') {
            ensureMethod(precinctName, countingGroupId);
          }

          for (const mark of marks) {
            if (!mark || typeof mark !== 'object') continue;
            if (!mark.IsVote) continue;
            const candidateId = mark.CandidateId as number | undefined;
            if (candidateId === 2) {
              incrementCounts(precinctTotals[precinctName], 'yes');
              if (typeof countingGroupId === 'number') {
                incrementCounts(precinctMethods[precinctName][countingGroupId], 'yes');
              }
            } else if (candidateId === 1) {
              incrementCounts(precinctTotals[precinctName], 'no');
              if (typeof countingGroupId === 'number') {
                incrementCounts(precinctMethods[precinctName][countingGroupId], 'no');
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

  console.log(`\nFound votes in ${Object.keys(precinctTotals).length} precincts`);

  // Include any precincts appearing in data with zero totals and also all from manifest
  const allManifestPrecincts = new Set<string>(Array.from(precinctIdToName.values()));
  for (const precinctName of allManifestPrecincts) {
    if (!precinctTotals[precinctName]) {
      precinctTotals[precinctName] = { yes: 0, no: 0, total: 0 };
    }
    if (!precinctMethods[precinctName]) {
      precinctMethods[precinctName] = {};
    }
  }

  console.log(`Total precincts in manifest: ${allManifestPrecincts.size}`);
  console.log(`Total precincts in results: ${Object.keys(precinctTotals).length}`);

  type OutputItem = {
    precinct: string;
    votes: VoteCounts;
    percentage: { yes: number; no: number };
    vote_method: {
      mail_in: {
        votes: VoteCounts;
        percentage: { yes: number; no: number };
        percentage_of_total: number;
      };
      in_person: {
        votes: VoteCounts;
        percentage: { yes: number; no: number };
        percentage_of_total: number;
      };
    };
  };

  const results: OutputItem[] = [];
  const precinctNames = Object.keys(precinctTotals).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const precinctName of precinctNames) {
    const totals = precinctTotals[precinctName];
    const total = totals.total;
    const yesCount = totals.yes;
    const noCount = totals.no;

    const yesPct = total > 0 ? (yesCount / total) * 100 : 0;
    const noPct = total > 0 ? (noCount / total) * 100 : 0;

    const methodVotes = precinctMethods[precinctName] || {};
    const mailIn = methodVotes[2] ?? { yes: 0, no: 0, total: 0 };
    const inPerson = methodVotes[1] ?? { yes: 0, no: 0, total: 0 };

    const mailInTotal = mailIn.total;
    const mailInYesPct = mailInTotal > 0 ? (mailIn.yes / mailInTotal) * 100 : 0;
    const mailInNoPct = mailInTotal > 0 ? (mailIn.no / mailInTotal) * 100 : 0;

    const inPersonTotal = inPerson.total;
    const inPersonYesPct = inPersonTotal > 0 ? (inPerson.yes / inPersonTotal) * 100 : 0;
    const inPersonNoPct = inPersonTotal > 0 ? (inPerson.no / inPersonTotal) * 100 : 0;

    const mailInPctOfTotal = total > 0 ? (mailInTotal / total) * 100 : 0;
    const inPersonPctOfTotal = total > 0 ? (inPersonTotal / total) * 100 : 0;

    results.push({
      precinct: precinctName,
      votes: { yes: yesCount, no: noCount, total },
      percentage: { yes: formatPercentage(yesPct), no: formatPercentage(noPct) },
      vote_method: {
        mail_in: {
          votes: { yes: mailIn.yes, no: mailIn.no, total: mailInTotal },
          percentage: {
            yes: formatPercentage(mailInYesPct),
            no: formatPercentage(mailInNoPct),
          },
          percentage_of_total: formatPercentage(mailInPctOfTotal),
        },
        in_person: {
          votes: { yes: inPerson.yes, no: inPerson.no, total: inPersonTotal },
          percentage: {
            yes: formatPercentage(inPersonYesPct),
            no: formatPercentage(inPersonNoPct),
          },
          percentage_of_total: formatPercentage(inPersonPctOfTotal),
        },
      },
    });
  }

  const outputPath = path.resolve(process.cwd(), 'results.json');
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
