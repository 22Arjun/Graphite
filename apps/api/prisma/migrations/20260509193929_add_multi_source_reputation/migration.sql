-- CreateEnum
CREATE TYPE "education_level" AS ENUM ('HIGH_SCHOOL', 'ASSOCIATE', 'BACHELOR', 'MASTER', 'PHD', 'BOOTCAMP', 'SELF_TAUGHT', 'OTHER');

-- AlterEnum
ALTER TYPE "job_type" ADD VALUE 'RESUME_PARSE';

-- CreateTable
CREATE TABLE "linkedin_data" (
    "id" UUID NOT NULL,
    "builder_id" UUID NOT NULL,
    "headline" TEXT,
    "current_role" TEXT,
    "company" TEXT,
    "years_experience" INTEGER NOT NULL DEFAULT 0,
    "education_level" "education_level",
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linkedin_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twitter_data" (
    "id" UUID NOT NULL,
    "builder_id" UUID NOT NULL,
    "handle" TEXT NOT NULL,
    "follower_count" INTEGER NOT NULL DEFAULT 0,
    "following_count" INTEGER NOT NULL DEFAULT 0,
    "tweet_count" INTEGER NOT NULL DEFAULT 0,
    "account_age_years" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bio" TEXT,
    "fetched_at" TIMESTAMP(3),
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twitter_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hackathon_entries" (
    "id" UUID NOT NULL,
    "builder_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "placement" TEXT,
    "prize" TEXT,
    "project_name" TEXT,
    "project_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hackathon_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_data" (
    "id" UUID NOT NULL,
    "builder_id" UUID NOT NULL,
    "parsed_skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parsed_tech_stack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "years_experience" INTEGER NOT NULL DEFAULT 0,
    "education_level" "education_level",
    "current_role" TEXT,
    "summary" TEXT,
    "raw_text" TEXT,
    "parsed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "linkedin_data_builder_id_key" ON "linkedin_data"("builder_id");

-- CreateIndex
CREATE UNIQUE INDEX "twitter_data_builder_id_key" ON "twitter_data"("builder_id");

-- CreateIndex
CREATE INDEX "hackathon_entries_builder_id_idx" ON "hackathon_entries"("builder_id");

-- CreateIndex
CREATE UNIQUE INDEX "resume_data_builder_id_key" ON "resume_data"("builder_id");

-- AddForeignKey
ALTER TABLE "linkedin_data" ADD CONSTRAINT "linkedin_data_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twitter_data" ADD CONSTRAINT "twitter_data_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hackathon_entries" ADD CONSTRAINT "hackathon_entries_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_data" ADD CONSTRAINT "resume_data_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
