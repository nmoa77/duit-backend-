/*
  Warnings:

  - You are about to drop the column `active` on the `MediaPlan` table. All the data in the column will be lost.
  - You are about to drop the column `days` on the `MediaPlan` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `MediaPlan` table. All the data in the column will be lost.
  - You are about to drop the column `durationDays` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `planId` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `totalMonthly` on the `Subscription` table. All the data in the column will be lost.
  - Added the required column `basePrice` to the `MediaPlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `channels` to the `MediaPlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periodDays` to the `MediaPlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `postsPerMonth` to the `MediaPlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mediaPlanId` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalPrice` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MediaPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "postsPerMonth" INTEGER NOT NULL,
    "channels" TEXT NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_MediaPlan" ("createdAt", "description", "id", "title") SELECT "createdAt", "description", "id", "title" FROM "MediaPlan";
DROP TABLE "MediaPlan";
ALTER TABLE "new_MediaPlan" RENAME TO "MediaPlan";
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'novo',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("clientId", "createdAt", "description", "id", "name", "status") SELECT "clientId", "createdAt", "description", "id", "name", "status" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "mediaPlanId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "totalPrice" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Subscription_mediaPlanId_fkey" FOREIGN KEY ("mediaPlanId") REFERENCES "MediaPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Subscription" ("clientId", "createdAt", "id", "status") SELECT "clientId", "createdAt", "id", "status" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
