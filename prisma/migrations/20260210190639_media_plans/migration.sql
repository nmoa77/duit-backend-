/*
  Warnings:

  - You are about to drop the column `interval` on the `MediaPlan` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `MediaPlan` table. All the data in the column will be lost.
  - Added the required column `days` to the `MediaPlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `MediaPlan` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MediaPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_MediaPlan" ("active", "createdAt", "description", "id", "price") SELECT "active", "createdAt", "description", "id", "price" FROM "MediaPlan";
DROP TABLE "MediaPlan";
ALTER TABLE "new_MediaPlan" RENAME TO "MediaPlan";
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationDays" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'novo',
    "clientId" TEXT NOT NULL,
    "planId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MediaPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("clientId", "createdAt", "description", "durationDays", "id", "name", "planId", "status") SELECT "clientId", "createdAt", "description", "durationDays", "id", "name", "planId", "status" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
