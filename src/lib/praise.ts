const POOLS: Record<string, string[]> = {
  hit: ["Nice!", "Awesome!", "You got it!", "Way to go!", "Boom!", "Super!"],
  match: ["Perfect pair!", "Twins found!", "They match!", "Spot on!"],
  kind: ["That was kind!", "Wonderful choice!", "Your friend is smiling!", "So thoughtful!"],
  finish: ["You finished it all!", "What a champion!", "All done — amazing!", "You did the whole thing!"],
};

export function praise(kind: keyof typeof POOLS, seed = 0): string {
  const pool = POOLS[kind];
  return pool[Math.abs(Math.floor(seed)) % pool.length];
}
