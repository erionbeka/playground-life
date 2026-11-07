import { activeGames } from "../src/data/games.ts";
import { query } from "./db.ts";

const activeBuiltInGameIds = new Set(activeGames.map((game) => game.id));

export async function isEligibleAssignmentGame(
  gameId: string,
  clinicId: string
): Promise<boolean> {
  if (activeBuiltInGameIds.has(gameId)) return true;

  const customGame = await query<{ id: string }>(
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
