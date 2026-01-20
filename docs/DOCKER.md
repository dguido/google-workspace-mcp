# Docker Usage

Run Google Drive MCP in a Docker container for isolated, reproducible deployments.

## Prerequisites

1. **Authenticate locally first** - Docker containers cannot open browsers for OAuth:
   ```bash
   # Using npx
   npx @dguido/google-drive-mcp auth

   # Or using local installation
   npm run auth
   ```

2. **Verify token location**:
   ```bash
   ls -la ~/.config/google-drive-mcp/tokens.json
   ```

## Building the Docker Image

1. **Build the project** (required before Docker build):
   ```bash
   npm install
   npm run build
   ```

2. **Build the Docker image**:
   ```bash
   docker build -t google-drive-mcp .
   ```

## Running the Container

Run with your credentials and tokens mounted:

```bash
docker run -it \
  -v /path/to/gcp-oauth.keys.json:/config/gcp-oauth.keys.json:ro \
  -v ~/.config/google-drive-mcp/tokens.json:/config/tokens.json \
  google-drive-mcp
```

**Notes:**
- Replace `/path/to/gcp-oauth.keys.json` with the actual path to your OAuth credentials
- The `:ro` flag mounts credentials as read-only for security
- Tokens are mounted read-write to allow automatic refresh
- The container runs as non-root user for security

## Claude Desktop Configuration

```json
{
  "mcpServers": {
    "google-drive": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v",
        "/path/to/gcp-oauth.keys.json:/config/gcp-oauth.keys.json:ro",
        "-v",
        "/Users/yourname/.config/google-drive-mcp/tokens.json:/config/tokens.json",
        "google-drive-mcp"
      ]
    }
  }
}
```

**Docker-specific notes:**
- Uses `-i` for interactive mode (required for MCP stdio communication)
- Uses `--rm` to automatically remove the container after exit
- No port mapping needed (MCP uses stdio, not HTTP)
- Environment variables are set in the Dockerfile

## Troubleshooting

### "Authentication required" in Docker
**Problem:** The MCP server shows authentication errors even with valid tokens.

**Cause:** OAuth flow requires browser access, which isn't available in containers.

**Solution:**
```bash
# 1. Authenticate outside Docker first
npx @dguido/google-drive-mcp auth

# 2. Verify tokens exist
ls -la ~/.config/google-drive-mcp/tokens.json

# 3. Run Docker with tokens mounted
docker run -it \
  -v $(pwd)/gcp-oauth.keys.json:/config/gcp-oauth.keys.json:ro \
  -v ~/.config/google-drive-mcp/tokens.json:/config/tokens.json \
  google-drive-mcp
```

### "npm ci failed" during Docker build
**Problem:** Docker build fails with `tsc: not found` or similar errors.

**Solution:**
```bash
# Build the project locally first
npm install
npm run build

# Then build Docker image
docker build -t google-drive-mcp .
```

The Dockerfile expects the `dist/` directory to exist from your local build.

### "Token refresh failed" in Docker
**Problem:** Tokens can't refresh inside the container.

**Solution:** Ensure the token file is mounted with write permissions:
```bash
# Correct: tokens can be updated
-v ~/.config/google-drive-mcp/tokens.json:/config/tokens.json

# Wrong: read-only mount prevents token refresh
-v ~/.config/google-drive-mcp/tokens.json:/config/tokens.json:ro
```
