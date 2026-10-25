export const MAX_TURNS = 6;

/**
 * Append a turn and keep only the most recent `max`.
 * @param {{command:string,reply:string}[]} history
 * @param {{command:string,reply:string}} turn
 */
export function trimHistory(history, turn, max = MAX_TURNS) {
  const next = [...(Array.isArray(history) ? history : [])];
  if (turn && typeof turn.command === "string") {
    next.push({ command: turn.command, reply: String(turn.reply ?? "") });
  }
  return next.length > max ? next.slice(next.length - max) : next;
}
