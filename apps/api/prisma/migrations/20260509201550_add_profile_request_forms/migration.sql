-- CreateEnum
CREATE TYPE "form_analysis_status" AS ENUM ('PENDING', 'ANALYZING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "profile_requests" (
    "id" UUID NOT NULL,
    "builder_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "required_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submissions" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "full_name" TEXT,
    "email" TEXT,
    "linkedin_url" TEXT,
    "twitter_handle" TEXT,
    "github_username" TEXT,
    "project_links" JSONB NOT NULL DEFAULT '[]',
    "hackathons" JSONB NOT NULL DEFAULT '[]',
    "extra_links" JSONB NOT NULL DEFAULT '[]',
    "resume_url" TEXT,
    "resume_text" TEXT,
    "analysis_status" "form_analysis_status" NOT NULL DEFAULT 'PENDING',
    "analysis_result" JSONB,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_requests_token_key" ON "profile_requests"("token");

-- CreateIndex
CREATE INDEX "profile_requests_builder_id_idx" ON "profile_requests"("builder_id");

-- CreateIndex
CREATE INDEX "form_submissions_request_id_idx" ON "form_submissions"("request_id");

-- AddForeignKey
ALTER TABLE "profile_requests" ADD CONSTRAINT "profile_requests_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "profile_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
