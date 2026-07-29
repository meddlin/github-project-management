ALTER TABLE "GitHubRepository" ADD COLUMN "favoriteOrder" INTEGER;

CREATE INDEX "GitHubRepository_favorite_favoriteOrder_fullName_idx" ON "GitHubRepository"("favorite", "favoriteOrder", "fullName");
