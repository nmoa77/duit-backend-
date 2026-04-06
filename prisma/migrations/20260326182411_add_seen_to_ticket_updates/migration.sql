-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TicketUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT,
    "author" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TicketUpdate_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TicketUpdate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TicketUpdate" ("author", "content", "createdAt", "id", "ticketId", "userId") SELECT "author", "content", "createdAt", "id", "ticketId", "userId" FROM "TicketUpdate";
DROP TABLE "TicketUpdate";
ALTER TABLE "new_TicketUpdate" RENAME TO "TicketUpdate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
