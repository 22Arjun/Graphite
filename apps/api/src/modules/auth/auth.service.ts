import type { FastifyInstance } from 'fastify';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { env } from '../../config/env.js';
import { UnauthorizedError, ConflictError, AppError } from '../../lib/errors.js';
import type { GitHubOAuthTokenResponse, GitHubUserResponse } from '../../lib/types.js';
import type { WalletAuthInput, AuthResponse, GitHubConnectResponse } from './auth.schema.js';

// ============================================================
// Auth Service — Wallet verification, GitHub OAuth, JWT
// ============================================================

export class AuthService {
  constructor(private readonly app: FastifyInstance) {}

  /**
   * Authenticate via Solana wallet signature.
   * Creates builder record on first auth.
   */
  async authenticateWallet(input: WalletAuthInput): Promise<AuthResponse> {
    // Verify ed25519 signature
    const messageBytes = new TextEncoder().encode(input.message);
    const signatureBytes = bs58.decode(input.signature);
    const publicKeyBytes = bs58.decode(input.walletAddress);

    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    if (!isValid) {
      throw new UnauthorizedError('Invalid wallet signature');
    }

    // Upsert builder
    const builder = await this.app.prisma.builder.upsert({
      where: { walletAddress: input.walletAddress },
      create: { walletAddress: input.walletAddress },
      update: { updatedAt: new Date() },
      include: { githubProfile: { select: { username: true } } },
    });

    // Sign JWT
    const token = this.app.jwt.sign({
      sub: builder.id,
      wallet: builder.walletAddress,
    });

    return {
      token,
      builder: {
        id: builder.id,
        walletAddress: builder.walletAddress,
        displayName: builder.displayName,
        githubConnected: !!builder.githubProfile,
      },
    };
  }

  /**
   * Generate GitHub OAuth authorization URL.
   */
  getGitHubAuthUrl(builderId: string): string {
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: env.GITHUB_REDIRECT_URI,
      scope: 'read:user user:email repo',
      state: builderId, // pass builder ID as state for callback
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Handle GitHub OAuth callback — exchange code for token, fetch user, link profile.
   */
  async handleGitHubCallback(code: string, builderId: string): Promise<GitHubConnectResponse> {
    // Exchange code for access token
    const tokenData = await this.exchangeGitHubCode(code);

    // Fetch GitHub user profile
    const ghUser = await this.fetchGitHubUser(tokenData.access_token);

    // Check if this GitHub account is already linked to another builder
    const existing = await this.app.prisma.gitHubProfile.findUnique({
      where: { githubId: ghUser.id },
    });

    if (existing && existing.builderId !== builderId) {
      throw new ConflictError('This GitHub account is already linked to another wallet');
    }

    // Upsert GitHub profile
    await this.app.prisma.gitHubProfile.upsert({
      where: { builderId },
      create: {
        builderId,
        githubId: ghUser.id,
        username: ghUser.login,
        avatarUrl: ghUser.avatar_url,
        name: ghUser.name,
        bio: ghUser.bio,
        company: ghUser.company,
        location: ghUser.location,
        publicRepos: ghUser.public_repos,
        followers: ghUser.followers,
        following: ghUser.following,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        tokenExpiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
      },
      update: {
        username: ghUser.login,
        avatarUrl: ghUser.avatar_url,
        name: ghUser.name,
        bio: ghUser.bio,
        company: ghUser.company,
        location: ghUser.location,
        publicRepos: ghUser.public_repos,
        followers: ghUser.followers,
        following: ghUser.following,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        tokenExpiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
        lastSyncedAt: new Date(),
      },
    });

    // Update builder avatar
    await this.app.prisma.builder.update({
      where: { id: builderId },
      data: {
        avatarUrl: ghUser.avatar_url,
        displayName: ghUser.name || ghUser.login,
      },
    });

    return {
      connected: true,
      username: ghUser.login,
      avatarUrl: ghUser.avatar_url,
    };
  }

  // --- Private helpers ---

  private async exchangeGitHubCode(code: string): Promise<GitHubOAuthTokenResponse> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: env.GITHUB_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      throw new AppError('Failed to exchange GitHub authorization code', 502, 'GITHUB_TOKEN_ERROR');
    }

    const data = (await response.json()) as GitHubOAuthTokenResponse & { error?: string };

    if (data.error) {
      throw new AppError(`GitHub OAuth error: ${data.error}`, 400, 'GITHUB_OAUTH_ERROR');
    }

    return data;
  }

  private async fetchGitHubUser(accessToken: string): Promise<GitHubUserResponse> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      throw new AppError('Failed to fetch GitHub user profile', 502, 'GITHUB_USER_ERROR');
    }

    return (await response.json()) as GitHubUserResponse;
  }
}
