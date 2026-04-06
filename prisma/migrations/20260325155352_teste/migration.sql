/*
  Warnings:

  - You are about to drop the column `basePrice` on the `MediaPlan` table. All the data in the column will be lost.
  - You are about to drop the column `billing` on the `Service` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `Service` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - You are about to drop the column `totalPrice` on the `Subscription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SubscriptionService" ADD COLUMN "yearlyPrice" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "activationExpires" DATETIME;
ALTER TABLE "User" ADD COLUMN "activationToken" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MediaPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "channels" TEXT NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "price" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_MediaPlan" ("channels", "createdAt", "description", "id", "isActive", "periodDays", "title") SELECT "channels", "createdAt", "description", "id", "isActive", "periodDays", "title" FROM "MediaPlan";
DROP TABLE "MediaPlan";
ALTER TABLE "new_MediaPlan" RENAME TO "MediaPlan";
CREATE TABLE "new_Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Service" ("createdAt", "id", "isActive", "name", "price") SELECT "createdAt", "id", "isActive", "name", "price" FROM "Service";
DROP TABLE "Service";
ALTER TABLE "new_Service" RENAME TO "Service";
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "mediaPlanId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ativa',
    "monthlyPrice" INTEGER,
    "cancelReason" TEXT,
    "cancelRequestedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Subscription_mediaPlanId_fkey" FOREIGN KEY ("mediaPlanId") REFERENCES "MediaPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Subscription" ("clientId", "createdAt", "id", "mediaPlanId", "status") SELECT "clientId", "createdAt", "id", "mediaPlanId", "status" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
CREATE TABLE "new_TicketUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT,
    "author" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketUpdate_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TicketUpdate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TicketUpdate" ("author", "content", "createdAt", "id", "ticketId") SELECT "author", "content", "createdAt", "id", "ticketId" FROM "TicketUpdate";
DROP TABLE "TicketUpdate";
ALTER TABLE "new_TicketUpdate" RENAME TO "TicketUpdate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
