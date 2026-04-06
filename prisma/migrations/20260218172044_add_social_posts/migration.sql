/*
  Warnings:

  - You are about to drop the column `scheduledDate` on the `SocialPost` table. All the data in the column will be lost.
  - Added the required column `scheduledFor` to the `SocialPost` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SocialPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "scheduledFor" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'novo',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SocialPost_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SocialPost_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SocialPost" ("clientId", "createdAt", "id", "status", "subscriptionId") SELECT "clientId", "createdAt", "id", "status", "subscriptionId" FROM "SocialPost";
DROP TABLE "SocialPost";
ALTER TABLE "new_SocialPost" RENAME TO "SocialPost";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
