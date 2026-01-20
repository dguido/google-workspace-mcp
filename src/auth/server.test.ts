import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { AuthServer } from './server.js';
import * as fs from 'fs/promises';
import http from 'http';

// Mock fs/promises
vi.mock('fs/promises');

// Mock the client module
vi.mock('./client.js', () => ({
  loadCredentials: vi.fn().mockResolvedValue({
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
  }),
}));

// Mock the utils module
vi.mock('./utils.js', async () => {
  const actual = await vi.importActual('./utils.js');
  return {
    ...actual,
    getSecureTokenPath: vi.fn(() => '/mock/path/.config/google-drive-mcp/tokens.json'),
    getLegacyTokenPath: vi.fn(() => '/mock/path/.gcp-saved-tokens.json'),
    getAdditionalLegacyPaths: vi.fn(() => []),
  };
});

// Mock the logging module
vi.mock('../utils/logging.js', () => ({
  log: vi.fn(),
}));

// Mock the open module
vi.mock('open', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

describe('auth/server', () => {
  let oauth2Client: OAuth2Client;
  let authServer: AuthServer;

  beforeEach(() => {
    vi.clearAllMocks();
    oauth2Client = new OAuth2Client('test-client-id', 'test-client-secret');
    authServer = new AuthServer(oauth2Client);
  });

  afterEach(async () => {
    // Ensure server is stopped after each test
    await authServer.stop();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('initializes with OAuth2Client', () => {
      expect(authServer).toBeDefined();
      expect(authServer.authCompletedSuccessfully).toBe(false);
    });
  });

  describe('getRunningPort', () => {
    it('returns null when server is not running', () => {
      expect(authServer.getRunningPort()).toBeNull();
    });
  });

  describe('start', () => {
    describe('with valid existing tokens', () => {
      beforeEach(() => {
        // Setup valid tokens
        const validTokens = {
          access_token: 'valid-access-token',
          refresh_token: 'valid-refresh-token',
          expiry_date: Date.now() + 3600 * 1000,
        };

        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockResolvedValue(undefined);
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validTokens));
      });

      it('returns true when valid tokens exist', async () => {
        const result = await authServer.start(false);

        expect(result).toBe(true);
        expect(authServer.authCompletedSuccessfully).toBe(true);
      });

      it('does not start server when valid tokens exist', async () => {
        await authServer.start(false);

        expect(authServer.getRunningPort()).toBeNull();
      });
    });

    describe('without valid tokens', () => {
      beforeEach(() => {
        const fileError = new Error('ENOENT') as NodeJS.ErrnoException;
        fileError.code = 'ENOENT';

        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(fileError);
      });

      it('starts server on available port', async () => {
        const result = await authServer.start(false);

        expect(result).toBe(true);
        expect(authServer.getRunningPort()).toBeGreaterThanOrEqual(3000);
        expect(authServer.getRunningPort()).toBeLessThanOrEqual(3004);
      });

      it('returns port within expected range', async () => {
        await authServer.start(false);

        const port = authServer.getRunningPort();
        expect(port).not.toBeNull();
        if (port !== null) {
          expect(port >= 3000 && port <= 3004).toBe(true);
        }
      });
    });
  });

  describe('stop', () => {
    it('stops a running server', async () => {
      const fileError = new Error('ENOENT') as NodeJS.ErrnoException;
      fileError.code = 'ENOENT';

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockRejectedValue(fileError);

      await authServer.start(false);
      expect(authServer.getRunningPort()).not.toBeNull();

      await authServer.stop();
      expect(authServer.getRunningPort()).toBeNull();
    });

    it('handles stop when server is not running', async () => {
      // Should not throw
      await expect(authServer.stop()).resolves.toBeUndefined();
    });
  });

  describe('HTTP server endpoints', () => {
    let serverPort: number;
    let localAuthServer: AuthServer;

    beforeEach(async () => {
      const fileError = new Error('ENOENT') as NodeJS.ErrnoException;
      fileError.code = 'ENOENT';

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockRejectedValue(fileError);

      localAuthServer = new AuthServer(
        new OAuth2Client('test-client-id', 'test-client-secret')
      );
      await localAuthServer.start(false);
      serverPort = localAuthServer.getRunningPort() as number;
    });

    afterEach(async () => {
      await localAuthServer.stop();
    });

    const makeRequest = (
      path: string
    ): Promise<{ statusCode: number; body: string; headers: http.IncomingHttpHeaders }> => {
      return new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: 'localhost',
            port: serverPort,
            path,
            method: 'GET',
          },
          (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
              resolve({
                statusCode: res.statusCode || 0,
                body,
                headers: res.headers,
              });
            });
          }
        );
        req.on('error', reject);
        req.end();
      });
    };

    it('serves auth link on root path', async () => {
      const response = await makeRequest('/');

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/html');
      expect(response.body).toContain('Google Drive Authentication');
      expect(response.body).toContain('Authenticate with Google');
    });

  });

  describe('port availability', () => {
    it('tries next port when current port is in use', async () => {
      const fileError = new Error('ENOENT') as NodeJS.ErrnoException;
      fileError.code = 'ENOENT';

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockRejectedValue(fileError);

      // Start first server
      const server1 = new AuthServer(
        new OAuth2Client('test-client-id', 'test-client-secret')
      );
      await server1.start(false);
      const port1 = server1.getRunningPort();

      // Start second server (should use different port)
      const server2 = new AuthServer(
        new OAuth2Client('test-client-id', 'test-client-secret')
      );
      await server2.start(false);
      const port2 = server2.getRunningPort();

      expect(port1).not.toBeNull();
      expect(port2).not.toBeNull();
      expect(port1).not.toBe(port2);

      // Cleanup
      await server1.stop();
      await server2.stop();
    });
  });

  describe('authCompletedSuccessfully flag', () => {
    it('is false initially', () => {
      expect(authServer.authCompletedSuccessfully).toBe(false);
    });

    it('is true after successful token validation', async () => {
      const validTokens = {
        access_token: 'valid-access-token',
        refresh_token: 'valid-refresh-token',
        expiry_date: Date.now() + 3600 * 1000,
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validTokens));

      await authServer.start(false);

      expect(authServer.authCompletedSuccessfully).toBe(true);
    });
  });
});
