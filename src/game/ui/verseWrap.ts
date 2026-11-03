/** Wrap the original verse only at punctuation, keeping each clause intact. */
export function wrapVerse(text: string, maxChars: number): string {
  const clauses = text.match(/[^，。！？；：、,.!?;:]*[，。！？；：、,.!?;:]+|[^，。！？；：、,.!?;:]+$/gu) ?? []
  if (clauses.length === 0) return `「${text}」`
  const lines: string[] = []
  let line = '「'
  for (const clause of clauses) {
    if (line !== '「' && Array.from(line + clause).length > maxChars) {
      lines.push(line)
      line = ''
    }
    line += clause
  }
  lines.push(`${line}」`)
  return lines.join('\n')
}
