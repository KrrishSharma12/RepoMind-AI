-- Run this ONCE in the Supabase SQL Editor (and again after adding new tables).
--
-- Supabase exposes tables in the "public" schema through a web API. Row Level
-- Security with no policies makes that API return nothing for these tables.
-- RepoMind AI talks to Postgres directly (as a role that bypasses RLS), so the
-- app keeps working. Never put the Supabase "anon" key into this project.

ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "installation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "repository" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "repository_file" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "code_chunk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "indexing_job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pull_request_review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;