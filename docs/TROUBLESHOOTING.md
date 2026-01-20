# Troubleshooting

Complete troubleshooting guide for Google Drive MCP.

## Authentication Issues

### "OAuth credentials not found"

```
OAuth credentials not found. Please provide credentials using one of these methods:
1. Environment variable:
   export GOOGLE_DRIVE_OAUTH_CREDENTIALS="/path/to/gcp-oauth.keys.json"
2. Default file path:
   Place your gcp-oauth.keys.json file in the package root directory.
```

**Solution:**
- Download credentials from Google Cloud Console
- Either set the environment variable or place the file in the project root
- Ensure the file has proper read permissions

### "Authentication failed" or Browser doesn't open

**Possible causes:**
1. **Wrong credential type**: Must be "Desktop app", not "Web application"
2. **Port blocked**: Ports 3000-3004 must be available
3. **Test user not added**: Add your email in OAuth consent screen

**Solution:**
```bash
# Check if ports are in use
lsof -i :3000-3004

# Kill processes if needed
kill -9 <PID>

# Re-run authentication
npx @dguido/google-drive-mcp auth
```

### "Tokens expired" or "Invalid grant"

**For Google OAuth apps in "Testing" status:**
- Google automatically expires refresh tokens after 7 days
- You'll need to re-authenticate weekly until you publish your app

**Solution:**
```bash
# Clear old tokens and re-authenticate
rm ~/.config/google-drive-mcp/tokens.json
npx @dguido/google-drive-mcp auth
```

**For production:**
- Move app to "Published" status in Google Cloud Console
- Complete OAuth verification process

### "Login Required" error even with valid tokens

**If you updated the OAuth scopes but still get errors:**
- Google caches app authorizations even after removing local tokens
- The app might be using old/limited scopes

**Solution:**
1. Go to [Google Account Permissions](https://myaccount.google.com/permissions)
2. Find and remove access for "Google Drive MCP"
3. Clear local tokens: `rm ~/.config/google-drive-mcp/tokens.json`
4. Re-authenticate to grant all required scopes
5. Verify the consent screen shows ALL scopes including full Drive access

## API Issues

### "API not enabled" errors

```
Error: Google Sheets API has not been used in project...
```

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Navigate to "APIs & Services" > "Library"
4. Search and enable the missing API
5. Wait 1-2 minutes for propagation

### "Insufficient permissions"

**Check scopes in your credentials:**
- Need drive.file or drive scope
- Need docs, sheets, slides scopes for respective services

**Solution:**
- Re-create OAuth credentials with correct scopes
- Re-authenticate after updating credentials

### Rate Limiting (429 errors)

**Google API Quotas:**
- Drive API: 12,000 requests per minute
- Docs/Sheets/Slides: 300 requests per minute

**Solution:**
- Implement exponential backoff
- Batch operations where possible
- Check quota usage in Google Cloud Console

## Docker Issues

See [Docker Usage](DOCKER.md) for Docker-specific troubleshooting.

## Debug Mode

Enable detailed logging:
```bash
# Set debug environment variable
export DEBUG=google-drive-mcp:*
npx @dguido/google-drive-mcp
```

## Getting Help

1. **Check logs**: Server logs errors to stderr
2. **Verify setup**: Run `npx @dguido/google-drive-mcp help`
3. **Test auth**: Run `npx @dguido/google-drive-mcp auth`
4. **Report issues**: [GitHub Issues](https://github.com/dguido/google-drive-mcp/issues)
