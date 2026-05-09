// ============================================================
// Custom Error Classes
// Structured error handling across the API
// ============================================================

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const msg = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(msg, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(message: string, details: Record<string, string[]> = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class GitHubApiError extends AppError {
  public readonly ghStatusCode: number;
  public readonly ghHeaders: Record<string, string>;

  constructor(message: string, ghStatusCode: number, ghHeaders: Record<string, string> = {}) {
    super(`GitHub API error: ${message}`, 502, 'GITHUB_API_ERROR');
    this.ghStatusCode = ghStatusCode;
    this.ghHeaders = ghHeaders;
  }
}

export class IngestionError extends AppError {
  public readonly jobId: string;
  public readonly phase: string;

  constructor(message: string, jobId: string, phase: string) {
    super(message, 500, 'INGESTION_ERROR');
    this.jobId = jobId;
    this.phase = phase;
  }
}
