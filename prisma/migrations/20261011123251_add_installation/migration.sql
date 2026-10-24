-- CreateTable
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE "installation" (
    "id" TEXT NOT NULL,
    "githubInstallationId" INTEGER NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountAvatarUrl" TEXT,
    "repositorySelection" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "installation_userId_idx" ON "installation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "installation_userId_githubInstallationId_key" ON "installation"("userId", "githubInstallationId");

-- AddForeignKey
ALTER TABLE "installation" ADD CONSTRAINT "installation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
