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

const planningStatuses = [
  "NO_STATUS",
  "BACKLOG",
  "READY",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE"
] as const;

export type PlanningStatusValue = (typeof planningStatuses)[number];

export async function updateIssuePlanningStatus({
  issueId,
  owner,
  repo,
  status
}: {
  issueId: string;
  owner: string;
  repo: string;
  status: PlanningStatusValue;
}) {
  if (!issueId) {
    throw new Error("Issue id is required.");
  }

  if (!planningStatuses.includes(status)) {
    throw new Error("Invalid planning status.");
  }

  await prisma.gitHubIssue.update({
    data: {
      planningStatus: status,
      planningStatusSource: "LOCAL",
      planningStatusUpdatedAt: new Date()
    },
    where: {
      id: issueId
    }
  });

  revalidatePath(`/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/planning`);
}
