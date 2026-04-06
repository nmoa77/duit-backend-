/*
  Warnings:

  - You are about to drop the column `postsPerMonth` on the `MediaPlan` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MediaPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "channels" TEXT NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_MediaPlan" ("basePrice", "channels", "createdAt", "description", "id", "isActive", "periodDays", "title") SELECT "basePrice", "channels", "createdAt", "description", "id", "isActive", "periodDays", "title" FROM "MediaPlan";
DROP TABLE "MediaPlan";
ALTER TABLE "new_MediaPlan" RENAME TO "MediaPlan";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
