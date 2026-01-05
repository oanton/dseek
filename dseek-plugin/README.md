# dseek-plugin

Claude Code plugin for DSEEK documentation search.

## Installation

### Via Claude Code
```
/plugin install dseek
```

### Manual
1. Install CLI: `npm install -g @dseek/cli`
2. Copy this plugin to your Claude Code plugins directory

## What's Included

- **skills/dseek/SKILL.md**: Instructs Claude when and how to use DSEEK for documentation queries

## Requirements

- `@dseek/cli` must be installed globally
- Project must have DSEEK initialized (`dseek add ./docs`)

## Usage

Once installed, Claude will automatically use DSEEK when:
- You ask questions about project documentation
- You need to find information in docs, specs, or guides
- You search for API references or configuration details

## Related

- [@dseek/cli](../README.md) - The standalone CLI tool
- [DSEEK Specification](../docs/spec.md) - Full technical specification
