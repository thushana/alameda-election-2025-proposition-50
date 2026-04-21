// ============================================================================
// Shared CVR shard processing for cross-contest analysis (main + worker_threads)
// ============================================================================

import * as fs from 'fs';
import { pipeline } from 'stream/promises';
import streamJson from 'stream-json';
import pickPkg from 'stream-json/filters/Pick.js';
import streamArrayPkg from 'stream-json/streamers/StreamArray.js';

type StreamJsonParser = (...args: unknown[]) => NodeJS.ReadWriteStream;
type StreamJsonPick = (args: { filter: string }) => NodeJS.ReadWriteStream;
type StreamJsonStreamArray = (...args: unknown[]) => NodeJS.ReadWriteStream;

const { parser } = streamJson as { parser: StreamJsonParser };
const { pick } = pickPkg as { pick: StreamJsonPick };
const { streamArray } = streamArrayPkg as { streamArray: StreamJsonStreamArray };

export interface CrossContestWorkerConfig {
  cityCouncilContestId: number;
  presidentialContestId: number;
  /** Known City Council candidate ids (contest 40) for filtering marks */
  cityCouncilCandidateIds: readonly number[];
}

export interface CvrMark {
  IsVote?: boolean;
  CandidateId?: number;
}

export interface CvrContest {
  Id?: number;
  Marks?: CvrMark[];
}

export interface CvrCard {
  Contests?: CvrContest[];
}

export interface CvrOriginal {
  Cards?: CvrCard[];
}

export interface CvrRecord {
  Original?: CvrOriginal;
}

export interface CvrStreamValue {
  value: CvrRecord;
}

export interface FileShardResult {
  totalProcessed: number;
  sessionsWithCouncilVote: number;
  sessionsWithPresidentialVote: number;
  sessionsWithBothContests: number;
  /** councilId -> presId -> count */
  crossVote: Record<string, Record<string, number>>;
  /** councilId -> total council selections counted with a same-session president vote */
  councilSelectionTotals: Record<string, number>;
}

function safeGetArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  return [];
}

export function emptyShard(): FileShardResult {
  return {
    totalProcessed: 0,
    sessionsWithCouncilVote: 0,
    sessionsWithPresidentialVote: 0,
    sessionsWithBothContests: 0,
    crossVote: {},
    councilSelectionTotals: {},
  };
}

export function mergeShards(target: FileShardResult, source: FileShardResult): void {
  target.totalProcessed += source.totalProcessed;
  target.sessionsWithCouncilVote += source.sessionsWithCouncilVote;
  target.sessionsWithPresidentialVote += source.sessionsWithPresidentialVote;
  target.sessionsWithBothContests += source.sessionsWithBothContests;

  for (const [cStr, inner] of Object.entries(source.crossVote)) {
    if (!target.crossVote[cStr]) target.crossVote[cStr] = {};
    const tInner = target.crossVote[cStr];
    for (const [pStr, n] of Object.entries(inner)) {
      tInner[pStr] = (tInner[pStr] ?? 0) + n;
    }
  }

  for (const [cStr, n] of Object.entries(source.councilSelectionTotals)) {
    target.councilSelectionTotals[cStr] = (target.councilSelectionTotals[cStr] ?? 0) + n;
  }
}

/**
 * Stream one CvrExport_*.json and accumulate cross-contest counts for that file.
 */
export async function processCvrFilePath(
  absoluteFilePath: string,
  config: CrossContestWorkerConfig
): Promise<FileShardResult> {
  const shard = emptyShard();
  const councilSet = new Set(config.cityCouncilCandidateIds);

  await new Promise<void>((resolve, reject) => {
    const source = fs.createReadStream(absoluteFilePath);
    const p = parser();
    const sessionsPicker = pick({ filter: 'Sessions' });
    const sessionsArray = streamArray();

    sessionsArray.on('data', ({ value }: CvrStreamValue) => {
      shard.totalProcessed += 1;

      const record: CvrRecord = value ?? {};
      const original: CvrOriginal = (record.Original ?? {}) as CvrOriginal;
      const cards = safeGetArray<CvrCard>(original.Cards);

      const cityCouncilVotesThisSession = new Set<number>();
      let presidentialVote: number | null = null;

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

            if (contestId === config.cityCouncilContestId && councilSet.has(candidateId)) {
              cityCouncilVotesThisSession.add(candidateId);
            } else if (contestId === config.presidentialContestId && presidentialVote === null) {
              presidentialVote = candidateId;
            }
          }
        }
      }

      if (cityCouncilVotesThisSession.size > 0) {
        shard.sessionsWithCouncilVote += 1;
      }
      if (presidentialVote !== null) {
        shard.sessionsWithPresidentialVote += 1;
      }
      if (presidentialVote !== null && cityCouncilVotesThisSession.size > 0) {
        shard.sessionsWithBothContests += 1;
        for (const cityCouncilVote of cityCouncilVotesThisSession) {
          const cStr = String(cityCouncilVote);
          const pStr = String(presidentialVote);
          if (!shard.crossVote[cStr]) shard.crossVote[cStr] = {};
          const inner = shard.crossVote[cStr];
          inner[pStr] = (inner[pStr] ?? 0) + 1;
          shard.councilSelectionTotals[cStr] = (shard.councilSelectionTotals[cStr] ?? 0) + 1;
        }
      }
    });

    sessionsArray.on('error', reject);
    p.on('error', reject);
    sessionsPicker.on('error', reject);
    source.on('error', reject);
    sessionsArray.on('end', () => resolve());

    pipeline(source, p, sessionsPicker, sessionsArray).catch(reject);
  });

  return shard;
}
