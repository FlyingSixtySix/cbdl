# cbdl

## Setting Up
1. Install [Node.js](https:///nodejs.org/) current (>= 13.0.0).
2. Clone the repository.
3. Run `npm i`.
4. Copy `config.example.json` to `config.json` and configure (see below).

## Configuring

Key | Value
--- | ---
`input` |
`input.path` | The input filepath.
`input.usernameList` | The username list filename (not path). 
`output` |
`output.path` | The output filepath.

## Providing Input

Provide a username list in the configured `input.path` (e.g. `input`) titled
the same as the configured `input.usernameList` (e.g. `usernames.txt`).

The username list should be separated by linebreaks. They will be handled the same
regardless of platform.

## Output

The script will create the following folders in the configured `output.path`
(e.g. `output`) if they not exist already:

- `flac`
- `htmls`
- `rips`
