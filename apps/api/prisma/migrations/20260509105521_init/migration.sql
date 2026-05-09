-- CreateEnum
CREATE TYPE "analysis_status" AS ENUM ('PENDING', 'INGESTING', 'ANALYZING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "job_type" AS ENUM ('GITHUB_INGEST', 'REPO_ANALYSIS', 'REPUTATION_COMPUTE', 'GRAPH_BUILD');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "reputation_dimension" AS ENUM ('TECHNICAL_DEPTH', 'EXECUTION_ABILITY', 'COLLABORATION_QUALITY', 'CONSISTENCY', 'INNOVATION');

-- CreateEnum
CREATE TYPE "trend_direction" AS ENUM ('RISING', 'STABLE', 'DECLINING');

-- CreateEnum
CREATE TYPE "skill_category" AS ENUM ('LANGUAGE', 'FRAMEWORK', 'DOMAIN', 'PATTERN', 'TOOL');

-- CreateTable
CREATE TABLE "builders" (
    "id" UUID NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "display_name" TEXT,
    "bio" TEXT,
    "ai_summary" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "builders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_profiles" (
    "id" UUID NOT NULL,
    "builder_id" UUID NOT NULL,
    "github_id" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "avatar_url" TEXT,
    "name" TEXT,
    "bio" TEXT,
    "company" TEXT,
    "location" TEXT,
    "public_repos" INTEGER NOT NULL DEFAULT 0,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "following" INTEGER NOT NULL DEFAULT 0,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" UUID NOT NULL,
    "builder_id" UUID NOT NULL,
    "github_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "homepage" TEXT,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "is_fork" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "watchers" INTEGER NOT NULL DEFAULT 0,
    "open_issues" INTEGER NOT NULL DEFAULT 0,
    "size" INTEGER NOT NULL DEFAULT 0,
    "default_branch" TEXT NOT NULL DEFAULT 'main',
    "primary_language" TEXT,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "license_name" TEXT,
    "has_deployment" BOOLEAN NOT NULL DEFAULT false,
    "commit_count" INTEGER NOT NULL DEFAULT 0,
    "pushed_at" TIMESTAMP(3),
    "repo_created_at" TIMESTAMP(3),
    "repo_updated_at" TIMESTAMP(3),
    "analysis_status" "analysis_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_languages" (
    "id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "language" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6e7681',

    CONSTRAINT "repository_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commits" (
    "id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "sha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "author_login" TEXT,
    "author_email" TEXT,
    "additions" INTEGER NOT NULL DEFAULT 0,
    "deletions" INTEGER NOT NULL DEFAULT 0,
    "committed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributors" (
    "id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "github_login" TEXT NOT NULL,
    "github_id" INTEGER NOT NULL,
    "avatar_url" TEXT,
    "contributions" INTEGER NOT NULL DEFAULT 0,
    "is_owner" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "contributors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_analyses" (
    "id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "architecture_complexity" INTEGER NOT NULL,
    "code_quality_signals" INTEGER NOT NULL,
    "execution_maturity" INTEGER NOT NULL,
    "originality_score" INTEGER NOT NULL,
    "inferred_skills" TEXT[],
    "probable_domains" TEXT[],
    "builder_summary" TEXT NOT NULL,
    "key_patterns" TEXT[],
    "deployment_detected" BOOLEAN NOT NULL DEFAULT false,
    "test_coverage_signals" TEXT NOT NULL DEFAULT 'none',
    "raw_ai_response" JSONB,
    "model_version" TEXT NOT NULL DEFAULT 'v1',
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reputation_scores" (
    "id" UUID NOT NULL,
    "builder_id" UUID NOT NULL,
    "dimension" "reputation_dimension" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "signals" TEXT[],
    "trend" "trend_direction" NOT NULL DEFAULT 'STABLE',
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reputation_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_tags" (
    "id" UUID NOT NULL,
    "builder_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "skill_category" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "inferred_from" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_edges" (
    "id" UUID NOT NULL,
    "source_builder_id" UUID NOT NULL,
    "target_builder_id" UUID NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "edge_type" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_jobs" (
    "id" UUID NOT NULL,
    "builder_id" UUID NOT NULL,
    "job_type" "job_type" NOT NULL,
    "status" "job_status" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "builders_wallet_address_key" ON "builders"("wallet_address");

-- CreateIndex
CREATE INDEX "builders_wallet_address_idx" ON "builders"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "github_profiles_builder_id_key" ON "github_profiles"("builder_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_profiles_github_id_key" ON "github_profiles"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_profiles_username_key" ON "github_profiles"("username");

-- CreateIndex
CREATE INDEX "github_profiles_username_idx" ON "github_profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_github_id_key" ON "repositories"("github_id");

-- CreateIndex
CREATE INDEX "repositories_builder_id_idx" ON "repositories"("builder_id");

-- CreateIndex
CREATE INDEX "repositories_analysis_status_idx" ON "repositories"("analysis_status");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_builder_id_github_id_key" ON "repositories"("builder_id", "github_id");

-- CreateIndex
CREATE UNIQUE INDEX "repository_languages_repository_id_language_key" ON "repository_languages"("repository_id", "language");

-- CreateIndex
CREATE INDEX "commits_repository_id_committed_at_idx" ON "commits"("repository_id", "committed_at");

-- CreateIndex
CREATE INDEX "commits_author_login_idx" ON "commits"("author_login");

-- CreateIndex
CREATE UNIQUE INDEX "commits_repository_id_sha_key" ON "commits"("repository_id", "sha");

-- CreateIndex
CREATE INDEX "contributors_github_login_idx" ON "contributors"("github_login");

-- CreateIndex
CREATE UNIQUE INDEX "contributors_repository_id_github_id_key" ON "contributors"("repository_id", "github_id");

-- CreateIndex
CREATE UNIQUE INDEX "repository_analyses_repository_id_key" ON "repository_analyses"("repository_id");

-- CreateIndex
CREATE INDEX "reputation_scores_builder_id_idx" ON "reputation_scores"("builder_id");

-- CreateIndex
CREATE UNIQUE INDEX "reputation_scores_builder_id_dimension_key" ON "reputation_scores"("builder_id", "dimension");

-- CreateIndex
CREATE INDEX "skill_tags_builder_id_idx" ON "skill_tags"("builder_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_tags_builder_id_name_key" ON "skill_tags"("builder_id", "name");

-- CreateIndex
CREATE INDEX "collaboration_edges_source_builder_id_idx" ON "collaboration_edges"("source_builder_id");

-- CreateIndex
CREATE INDEX "collaboration_edges_target_builder_id_idx" ON "collaboration_edges"("target_builder_id");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_edges_source_builder_id_target_builder_id_edg_key" ON "collaboration_edges"("source_builder_id", "target_builder_id", "edge_type");

-- CreateIndex
CREATE INDEX "ingestion_jobs_builder_id_idx" ON "ingestion_jobs"("builder_id");

-- CreateIndex
CREATE INDEX "ingestion_jobs_status_job_type_idx" ON "ingestion_jobs"("status", "job_type");

-- CreateIndex
CREATE INDEX "ingestion_jobs_created_at_idx" ON "ingestion_jobs"("created_at");

-- AddForeignKey
ALTER TABLE "github_profiles" ADD CONSTRAINT "github_profiles_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_languages" ADD CONSTRAINT "repository_languages_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributors" ADD CONSTRAINT "contributors_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_analyses" ADD CONSTRAINT "repository_analyses_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputation_scores" ADD CONSTRAINT "reputation_scores_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_tags" ADD CONSTRAINT "skill_tags_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_edges" ADD CONSTRAINT "collaboration_edges_source_builder_id_fkey" FOREIGN KEY ("source_builder_id") REFERENCES "builders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_edges" ADD CONSTRAINT "collaboration_edges_target_builder_id_fkey" FOREIGN KEY ("target_builder_id") REFERENCES "builders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
