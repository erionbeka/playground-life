import pg from "pg";
import { pool } from "./db.ts";
import { activeGames } from "../src/data/games.ts";

const activeBuiltInGameIds = new Set(activeGames.map((game) => game.id));
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export async function isEligibleAssignmentGame(
  gameId: string,
  clinicId: string,
  executor: Pick<pg.PoolClient, "query"> = pool
): Promise<boolean> {
  if (activeBuiltInGameIds.has(gameId)) return true;
  if (!UUID_PATTERN.test(gameId)) return false;

  const customGame = await executor.query<{ id: string }>(
    `SELECT id
     FROM game_drafts
     WHERE id = $1
       AND clinic_id = $2
       AND status = 'approved'
     LIMIT 1`,
    [gameId, clinicId]
  );

  return customGame.rows.length > 0;
}
