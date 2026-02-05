# Troubleshooting

Complete troubleshooting guide for Google Workspace MCP.

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
2. **Test user not added**: Add your email in OAuth consent screen

**Solution:**

The authentication server uses an ephemeral port assigned by the OS, so no specific ports need to be available. Verify your credentials are the correct type and re-run:

```bash
npx @dguido/google-workspace-mcp auth
```

### "Tokens expired" or "Invalid grant"

**For Google OAuth apps in "Testing" status:**

- Google automatically expires refresh tokens after 7 days
- You'll need to re-authenticate weekly until you publish your app
- Use `get_status` with `diagnose: true` to check token age and get warnings before expiry

**Solution:**

```bash
# Clear old tokens and re-authenticate
rm ~/.config/google-workspace-mcp/tokens.json
npx @dguido/google-workspace-mcp auth
```

**To avoid weekly re-authentication:**

1. **Publish your OAuth app** (recommended for personal use):
   - Go to Google Cloud Console > APIs & Services > OAuth consent screen
   - Click "PUBLISH APP"
   - You don't need to complete Google's verification for personal use
   - Published apps keep tokens valid indefinitely

2. **Use Internal app type** (Google Workspace only):
   - Set User Type to "Internal" on OAuth consent screen
   - Internal apps never expire tokens

**For production/public apps:**

- Complete OAuth verification process to remove user limits
- See [Google's OAuth verification guide](https://support.google.com/cloud/answer/9110914)

### "Login Required" error even with valid tokens

**If you updated the OAuth scopes but still get errors:**

- Google caches app authorizations even after removing local tokens
- The app might be using old/limited scopes

**Solution:**

1. Go to [Google Account Permissions](https://myaccount.google.com/permissions)
2. Find and remove access for "Google Drive MCP"
3. Clear local tokens: `rm ~/.config/google-workspace-mcp/tokens.json`
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
- Need contacts scope for Contacts service

**Solution:**

- Re-create OAuth credentials with correct scopes
- Re-authenticate after updating credentials

### Rate Limiting (429 errors)

**Google API Quotas:**

- Drive API: 12,000 requests per minute
- Docs/Sheets/Slides: 300 requests per minute
- People API: 90 requests per minute (per user)

**Solution:**

- Implement exponential backoff
- Batch operations where possible
- Check quota usage in Google Cloud Console

## Getting Help

1. **Check logs**: Server logs errors to stderr
2. **Verify setup**: Run `npx @dguido/google-workspace-mcp help`
3. **Test auth**: Run `npx @dguido/google-workspace-mcp auth`
4. **Report issues**: [GitHub Issues](https://github.com/dguido/google-workspace-mcp/issues)
