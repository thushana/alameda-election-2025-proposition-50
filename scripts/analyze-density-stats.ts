#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream';
import streamJson from 'stream-json';
import pickPkg from 'stream-json/filters/Pick.js';
import streamArrayPkg from 'stream-json/streamers/StreamArray.js';

// Type definitions for stream-json
type StreamJsonParser = (...args: unknown[]) => NodeJS.ReadWriteStream;
type StreamJsonPick = (args: { filter: string }) => NodeJS.ReadWriteStream;
type StreamJsonStreamArray = (...args: unknown[]) => NodeJS.ReadWriteStream;

const { parser } = streamJson as { parser: StreamJsonParser };
const { pick } = pickPkg as { pick: StreamJsonPick };
const { streamArray } = streamArrayPkg as { streamArray: StreamJsonStreamArray };

interface CvrMark {
  IsVote?: boolean;
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
}

interface CvrStreamValue {
  value: CvrRecord;
}

function safeGetArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// Calculate mean
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Calculate standard deviation
function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / values.length;
  return Math.sqrt(variance);
}

// Two-sample t-test (Welch's t-test for unequal variances)
function welchTTest(
  sample1: number[],
  sample2: number[]
): { t: number; pValue: number; df: number; significant: boolean } {
  const n1 = sample1.length;
  const n2 = sample2.length;

  if (n1 === 0 || n2 === 0) {
    return { t: 0, pValue: 1, df: 0, significant: false };
  }

  const mean1 = mean(sample1);
  const mean2 = mean(sample2);
  const std1 = stdDev(sample1);
  const std2 = stdDev(sample2);

  const se1 = std1 / Math.sqrt(n1);
  const se2 = std2 / Math.sqrt(n2);
  const seDiff = Math.sqrt(se1 * se1 + se2 * se2);

  const t = (mean1 - mean2) / seDiff;

  // Welch's degrees of freedom
  const df =
    Math.pow(se1 * se1 + se2 * se2, 2) /
    (Math.pow(se1 * se1, 2) / (n1 - 1) + Math.pow(se2 * se2, 2) / (n2 - 1));

  // Approximate p-value using normal distribution for large samples
  // For more accuracy, we'd use t-distribution, but this is close for large n
  const pValue = 2 * (1 - normalCDF(Math.abs(t)));

  return {
    t,
    pValue,
    df,
    significant: pValue < 0.05,
  };
}

// Normal CDF approximation
function normalCDF(x: number): number {
  // Abramowitz and Stegun approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

async function main(): Promise<void> {
  const inputDir = process.argv[2];
  if (!inputDir) {
    console.error('Usage: tsx scripts/analyze-density-stats.ts /path/to/CVR_Export');
    process.exit(1);
  }

  const absoluteInputDir = path.resolve(inputDir);
  const cvrFile = path.join(absoluteInputDir, 'CvrExport.json');

  if (!fs.existsSync(cvrFile)) {
    throw new Error(`CVR file not found: ${cvrFile}`);
  }

  const yesDensities: number[] = [];
  const noDensities: number[] = [];

  console.log('Collecting mark density data...');

  await new Promise<void>((resolve, reject) => {
    const source = fs.createReadStream(cvrFile);
    const p = parser();
    const sessionsPicker = pick({ filter: 'Sessions' });
    const sessionsArray = streamArray();

    let processed = 0;

    sessionsArray.on('data', ({ value }: CvrStreamValue) => {
      processed += 1;
      if (processed % 100000 === 0) {
        console.log(`  Processed ${processed.toLocaleString()} records...`);
      }

      const record: CvrRecord = value ?? {};
      const original: CvrOriginal = (record.Original ?? {}) as CvrOriginal;
      const cards = safeGetArray<CvrCard>(original.Cards);

      for (const card of cards) {
        const contests = safeGetArray<CvrContest>(card.Contests);
        for (const contest of contests) {
          const contestId = contest?.Id;
          if (contestId !== 1) continue;
          const marks = safeGetArray<CvrMark>(contest.Marks);

          for (const mark of marks) {
            if (!mark || typeof mark !== 'object') continue;
            if (!mark.IsVote) continue;

            const candidateId = mark.CandidateId as number | undefined;
            const markDensity = mark.MarkDensity as number | undefined;

            if (typeof markDensity === 'number') {
              if (candidateId === 2) {
                yesDensities.push(markDensity);
              } else if (candidateId === 1) {
                noDensities.push(markDensity);
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

  console.log(`\nCollected ${yesDensities.length.toLocaleString()} yes vote densities`);
  console.log(`Collected ${noDensities.toLocaleString()} no vote densities`);

  // Calculate descriptive statistics
  const yesMean = mean(yesDensities);
  const noMean = mean(noDensities);
  const yesStd = stdDev(yesDensities);
  const noStd = stdDev(noDensities);

  console.log('\n=== Descriptive Statistics ===');
  console.log(`Yes votes:`);
  console.log(`  Mean: ${yesMean.toFixed(2)}`);
  console.log(`  Std Dev: ${yesStd.toFixed(2)}`);
  console.log(`  Sample size: ${yesDensities.length.toLocaleString()}`);
  console.log(`\nNo votes:`);
  console.log(`  Mean: ${noMean.toFixed(2)}`);
  console.log(`  Std Dev: ${noStd.toFixed(2)}`);
  console.log(`  Sample size: ${noDensities.toLocaleString()}`);
  console.log(`\nDifference: ${(yesMean - noMean).toFixed(2)}`);

  // Perform statistical test
  const test = welchTTest(yesDensities, noDensities);

  console.log("\n=== Statistical Test (Welch's t-test) ===");
  console.log(`t-statistic: ${test.t.toFixed(4)}`);
  console.log(`Degrees of freedom: ${test.df.toFixed(2)}`);
  console.log(`p-value: ${test.pValue.toExponential(3)}`);
  console.log(`\nStatistically significant (p < 0.05): ${test.significant ? 'YES' : 'NO'}`);

  if (test.significant) {
    console.log(
      `\n✓ The difference in mark density between yes and no votes is statistically significant.`
    );
  } else {
    console.log(
      `\n✗ The difference in mark density between yes and no votes is NOT statistically significant.`
    );
  }

  // Effect size (Cohen's d)
  const pooledStd = Math.sqrt((yesStd * yesStd + noStd * noStd) / 2);
  const cohensD = (yesMean - noMean) / pooledStd;

  console.log(`\n=== Effect Size ===`);
  console.log(`Cohen's d: ${cohensD.toFixed(4)}`);
  if (Math.abs(cohensD) < 0.2) {
    console.log(`Interpretation: Negligible effect`);
  } else if (Math.abs(cohensD) < 0.5) {
    console.log(`Interpretation: Small effect`);
  } else if (Math.abs(cohensD) < 0.8) {
    console.log(`Interpretation: Medium effect`);
  } else {
    console.log(`Interpretation: Large effect`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
