# Replace bash-parser with unbash

## Problem

`bash-parser` (npm, last published 2017) cannot parse nested shell control flow. This forces warden to maintain ~500 lines of fallback code: compound command fallback, pipeline fallback, regex fallback, heredoc preprocessing, path parentheses preprocessing. Each workaround adds complexity and edge cases.

## Solution

Replace `bash-parser` with `unbash` (pure TypeScript, zero deps, 175 KB, 1.57M weekly downloads, actively maintained). unbash handles all constructs bash-parser can't: nested control flow, `$` in double quotes, heredocs, parentheses in paths.

## What gets deleted

All bash-parser workarounds in `parser.ts` (~500 lines):

- `preprocessCatHeredocs` - unbash handles heredocs natively
- `preprocessPathParentheses` - unbash handles parentheses in paths
- `HEREDOC_REGEX` and all heredoc detection/fallback logic
- `pipelineFallbackParse` and `splitOnUnquotedOperators`
- `regexFallbackParse`
- `compoundCommandFallback` and all supporting functions (`extractCommandGroups`, `walkTokens`, `walkWhileUntil`, `walkIf`, `walkFor`, `walkCase`, `shellTokenize`, `collectUntil`, `collectCompoundBody`, `collectCompoundBodyMultiEnd`, `isCommandPosition`)
- `astHasHeredoc` and `hasHeredocRedirect`
- Custom AST interface types (`AstNode`, `WordNode`, `AssignmentNode`, `ExpansionNode`, `CommandNode`, `PipelineNode`, `LogicalExpressionNode`, `SubshellNode`, `ScriptNode`, `CompoundListNode`, `WhileUntilNode`, `IfNode`, `ForNode`, `CaseItemNode`, `CaseNode`, `FunctionNode`)
- The entire try/catch fallback chain in `parseCommand`

## AST walker mapping

unbash types map to the same `ParsedCommand` output:

| unbash node | Handler |
|-------------|---------|
| `Statement` | Unwrap, walk inner `command` |
| `Command` | Convert to `ParsedCommand`: name, args from suffix, env prefixes from prefix. Handle `sh/bash/zsh -c` recursion. Handle standalone assignments for chain tracking. |
| `Pipeline` | Walk each command in `commands` |
| `AndOr` | Walk each command in `commands` |
| `While` | Walk `clause.commands` and `body.commands` |
| `If` | Walk `clause`, `then`, `else` (recursive `If` for elif) |
| `For` | Walk `body.commands` |
| `Case` | Walk each `items[].body.commands` |
| `Function` | Walk `body.body.commands` |
| `Subshell` | Set `hasSubshell = true`, walk `body.commands` |
| `BraceGroup` | Walk `body.commands` |
| `CompoundList` | Walk `commands` (each is a Statement) |

Command substitution in Word parts: unbash produces a full recursive `Script` AST in `CommandExpansionPart.script`. Walk it and add to `subshellCommands`.

Control flow nodes (`While`, `If`, `For`, `Case`, `Function`) do NOT set `hasSubshell` since we fully walk them.

## parseCommand function

```
export function parseCommand(input: string): ParseResult {
  if empty -> return empty result

  const ast = parse(input)
  if ast.errors?.length -> return parseError result

  const result = new WalkResult
  for each statement in ast.commands:
    walkNode(statement, result)

  return result
}
```

No try/catch, no fallback chain, no preprocessing.

## Interface types

Custom AST interfaces deleted. Import unbash's types directly.

Output types unchanged: `ParsedCommand`, `ParseResult`, `ChainAssignment`. The evaluator sees no difference.

## Error handling

unbash never throws. If `parse()` returns errors, set `parseError = true` and return empty result.

## Test changes

None expected. All 774 tests describe behavior (what commands get extracted, what decisions get made), not implementation (which parser/fallback handled it). Tests that exercise former fallback paths still pass because unbash handles those inputs natively.

## Dependencies

- Remove: `bash-parser`
- Add: `unbash` (^2.2.0)
