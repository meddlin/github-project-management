"use server";

import { prisma } from "@gpm/db";
import { revalidatePath } from "next/cache";

export async function setRepositoryFavorite(repositoryId: string, favorite: boolean) {
  if (!repositoryId) {
    throw new Error("Repository id is required.");
  }

  if (typeof favorite !== "boolean") {
    throw new Error("Favorite must be a boolean.");
  }

  await prisma.gitHubRepository.update({
    data: {
      favorite
    },
    where: {
      id: repositoryId
    }
  });

  revalidatePath("/");
}
