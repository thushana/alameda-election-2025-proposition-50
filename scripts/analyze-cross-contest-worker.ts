// ============================================================================
// Worker entry: process a chunk of CVR JSON files (worker_threads)
// ============================================================================

import { parentPort, workerData } from 'node:worker_threads';
import type { CrossContestWorkerConfig, FileShardResult } from './cross-contest-process-file.ts';
import { emptyShard, mergeShards, processCvrFilePath } from './cross-contest-process-file.ts';

type WorkerPayload = {
  files: string[];
  config: CrossContestWorkerConfig;
};

const { files, config } = workerData as WorkerPayload;
const acc: FileShardResult = emptyShard();

(async () => {
  try {
    for (const filePath of files) {
      const part = await processCvrFilePath(filePath, config);
      mergeShards(acc, part);
    }
    parentPort!.postMessage({ ok: true as const, result: acc });
  } catch (err) {
    parentPort!.postMessage({
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
    });
  }
})();
