interface Player {
  user_id: string;
  name: string;
  positions: string[];
  rating: number;
}

interface TeamAssignment {
  user_id: string;
  team: "A" | "B";
}

/**
 * Fisher-Yates shuffle + alternate assignment for a single match
 */
export function randomizeTeams(playerIds: string[]): TeamAssignment[] {
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.map((id, i) => ({
    user_id: id,
    team: i % 2 === 0 ? "A" : "B",
  }));
}

/**
 * Informed builder: balances teams by player rating and position diversity.
 *
 * Rating = (total_goals * 1.0 + total_assists * 0.7) / games_played
 * Players with no stats get a neutral rating of 0.5
 */
export function informedTeamBuilder(players: Player[]): TeamAssignment[] {
  // Sort by rating descending
  const sorted = [...players].sort((a, b) => b.rating - a.rating);

  const teamA: Player[] = [];
  const teamB: Player[] = [];
  let ratingA = 0;
  let ratingB = 0;

  // Greedy assignment: highest rated unassigned player goes to the weaker team
  for (const player of sorted) {
    if (ratingA <= ratingB) {
      teamA.push(player);
      ratingA += player.rating;
    } else {
      teamB.push(player);
      ratingB += player.rating;
    }
  }

  // Position balancing pass: check for position imbalances
  // Count primary positions (first position in each player's list)
  const posCountA = countPositions(teamA);
  const posCountB = countPositions(teamB);

  // Try to fix major imbalances (3+ players at same position on one team, 0 on other)
  for (const pos of Object.keys(posCountA)) {
    const countA = posCountA[pos] || 0;
    const countB = posCountB[pos] || 0;

    if (countA >= 3 && countB === 0) {
      // Find the lowest-rated player of this position on team A
      const swapFrom = teamA
        .filter((p) => p.positions[0] === pos)
        .sort((a, b) => a.rating - b.rating)[0];

      if (swapFrom) {
        // Find a similar-rated player on team B with a different primary position
        const swapTo = teamB
          .filter((p) => p.positions[0] !== pos)
          .sort(
            (a, b) =>
              Math.abs(a.rating - swapFrom.rating) -
              Math.abs(b.rating - swapFrom.rating)
          )[0];

        if (swapTo && Math.abs(swapTo.rating - swapFrom.rating) < 1.0) {
          // Perform swap
          const idxA = teamA.indexOf(swapFrom);
          const idxB = teamB.indexOf(swapTo);
          teamA[idxA] = swapTo;
          teamB[idxB] = swapFrom;
        }
      }
    }
  }

  return [
    ...teamA.map((p) => ({ user_id: p.user_id, team: "A" as const })),
    ...teamB.map((p) => ({ user_id: p.user_id, team: "B" as const })),
  ];
}

/**
 * Split players across multiple matches, then balance teams within each match.
 * Uses informed builder per match for best balance.
 */
export function smartSplit(
  players: Player[],
  matchCount: number
): Map<number, TeamAssignment[]> {
  // Sort by rating descending for balanced distribution
  const sorted = [...players].sort((a, b) => b.rating - a.rating);

  // Distribute players across matches using snake draft
  const matchPlayers: Player[][] = Array.from({ length: matchCount }, () => []);
  for (let i = 0; i < sorted.length; i++) {
    const round = Math.floor(i / matchCount);
    const pick = round % 2 === 0 ? i % matchCount : matchCount - 1 - (i % matchCount);
    matchPlayers[pick].push(sorted[i]);
  }

  // Balance teams within each match
  const result = new Map<number, TeamAssignment[]>();
  for (let m = 0; m < matchCount; m++) {
    result.set(m, informedTeamBuilder(matchPlayers[m]));
  }
  return result;
}

function countPositions(team: Player[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of team) {
    const pos = p.positions[0] || "unknown";
    counts[pos] = (counts[pos] || 0) + 1;
  }
  return counts;
}
