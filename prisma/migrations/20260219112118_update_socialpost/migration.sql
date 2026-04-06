/*
  Warnings:

  - A unique constraint covering the columns `[subscriptionId,scheduledFor]` on the table `SocialPost` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SocialPost_subscriptionId_scheduledFor_key" ON "SocialPost"("subscriptionId", "scheduledFor");
