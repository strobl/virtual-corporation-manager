/** Accept a dedicated test invocation, not an echo or a compound command containing its name. */
export function isQaTestCommand(command: string, python: string): boolean {
  if (/[;&|$`<>\r\n]/.test(command)) return false;
  const words = (value: string): string[] | null => {
    const out: string[] = [];
    let word = '';
    let quote = '';
    let started = false;
    for (const char of value.trim()) {
      if (quote) {
        if (char === quote) quote = '';
        else word += char;
        started = true;
      } else if (char === '"' || char === "'") {
        quote = char;
        started = true;
      } else if (/\s/.test(char)) {
        if (started) {
          out.push(word);
          word = '';
          started = false;
        }
      } else if (char === '\\') return null;
      else {
        word += char;
        started = true;
      }
    }
    if (quote) return null;
    if (started) out.push(word);
    return out;
  };
  let args = words(command);
  if (!args) return false;
  if (
    ['/bin/sh', '/bin/bash', '/bin/zsh', '/usr/bin/sh', '/usr/bin/bash', '/usr/bin/zsh'].includes(
      args[0],
    )
  ) {
    if (args.length !== 3 || !['-c', '-lc'].includes(args[1])) return false;
    args = words(args[2]);
  }
  return !!args && JSON.stringify(args) === JSON.stringify([python, '-B', '-m', 'unittest', '-v']);
}
