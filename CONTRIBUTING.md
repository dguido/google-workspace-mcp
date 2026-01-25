# Contributing

Contributions are welcome! Please follow the guidelines below.

## Development Setup

1. Clone and install:

   ```bash
   git clone https://github.com/dguido/google-workspace-mcp.git
   cd google-workspace-mcp
   npm install
   ```

2. Set up credentials:

   ```bash
   cp gcp-oauth.keys.example.json gcp-oauth.keys.json
   # Edit gcp-oauth.keys.json with your OAuth client ID
   ```

3. Authenticate:
   ```bash
   npm run auth
   ```

## Project Structure

```
google-workspace-mcp/
├── src/                    # Source code
│   ├── index.ts           # Main server implementation
│   ├── auth.ts            # Main authentication module
│   ├── auth/              # Authentication components
│   │   ├── client.ts      # OAuth2 client setup
│   │   ├── server.ts      # Local auth server
│   │   ├── tokenManager.ts # Token storage and validation
│   │   └── utils.ts       # Auth utilities
│   ├── handlers/          # Tool implementations
│   ├── schemas/           # Zod validation schemas
│   ├── tools/             # Tool definitions
│   └── utils/             # Shared utilities (responses, toon encoding, logging)
├── dist/                  # Compiled JavaScript (generated)
├── docs/                  # Documentation
├── scripts/               # Build scripts
├── gcp-oauth.keys.json    # OAuth credentials (create from example)
├── gcp-oauth.keys.example.json # Example credentials file
├── package.json           # NPM package configuration
├── tsconfig.json          # TypeScript configuration
└── README.md
```

## Building

```bash
npm run build     # Compile TypeScript
npm run watch     # Compile and watch for changes
npm run typecheck # Type checking only
```

## Local Testing with Claude Code

To test the MCP server directly in Claude Code during development:

1. Build the project:

   ```bash
   npm run build
   ```

2. Create `.mcp.json` in the project root:

   ```json
   {
     "mcpServers": {
       "google-workspace": {
         "command": "node",
         "args": ["dist/index.js"]
       }
     }
   }
   ```

3. Start a new Claude Code session in this directory. The MCP server will auto-load.

Note: `.mcp.json` is gitignored to prevent accidental commits.

## Scripts

| Script               | Description                         |
| -------------------- | ----------------------------------- |
| `npm start`          | Start the compiled server           |
| `npm run auth`       | Run authentication flow             |
| `npm run build`      | Build the project                   |
| `npm run watch`      | Build and watch for changes         |
| `npm run typecheck`  | TypeScript type checking only       |
| `npm run lint`       | Run linter                          |
| `npm run format`     | Format code                         |
| `npm run check`      | Run typecheck + lint + format check |
| `npm test`           | Run tests                           |
| `npm run test:watch` | Run tests in watch mode             |

## Adding a New Tool

1. **Schema** (`src/schemas/<service>.ts`) - Define Zod schema with `.refine()` for mutual exclusion
2. **Handler** (`src/handlers/<service>.ts`) - Create `handleX(drive, args)` function
3. **Definition** (`src/tools/definitions.ts`) - Add to appropriate array
4. **Registration** (`src/index.ts`) - Import handler, add case to switch
5. **Tests** (`src/handlers/<service>.test.ts`) - Mock Google API services
6. **Exports** - Add to `src/schemas/index.ts` and `src/handlers/index.ts`

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Code Style

- Follow existing patterns in the codebase
- Run `npm run check` before committing
- Write tests for new functionality
- Keep functions under 100 lines
- Use meaningful variable names
