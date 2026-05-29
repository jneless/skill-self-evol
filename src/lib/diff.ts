export function unifiedDiff(before: string, after: string) {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  const table = buildLcsTable(oldLines, newLines);
  const lines: string[] = [];
  walkDiff(oldLines, newLines, table, oldLines.length, newLines.length, lines);
  return lines.join("\n");
}

function buildLcsTable(oldLines: string[], newLines: string[]) {
  const table = Array.from({ length: oldLines.length + 1 }, () =>
    Array<number>(newLines.length + 1).fill(0),
  );

  for (let i = oldLines.length - 1; i >= 0; i -= 1) {
    for (let j = newLines.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        oldLines[i] === newLines[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  return table;
}

function walkDiff(
  oldLines: string[],
  newLines: string[],
  table: number[][],
  i: number,
  j: number,
  output: string[],
) {
  if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
    walkDiff(oldLines, newLines, table, i - 1, j - 1, output);
    output.push(`  ${oldLines[i - 1]}`);
  } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
    walkDiff(oldLines, newLines, table, i, j - 1, output);
    output.push(`+ ${newLines[j - 1]}`);
  } else if (i > 0 && (j === 0 || table[i][j - 1] < table[i - 1][j])) {
    walkDiff(oldLines, newLines, table, i - 1, j, output);
    output.push(`- ${oldLines[i - 1]}`);
  }
}
