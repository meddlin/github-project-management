ALTER TABLE "GitHubRepository" ADD COLUMN "favorite" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "GitHubRepository_favorite_fullName_idx" ON "GitHubRepository"("favorite", "fullName");
