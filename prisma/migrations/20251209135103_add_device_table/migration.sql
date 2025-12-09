-- CreateTable
CREATE TABLE "devices" (
    "uuid" TEXT NOT NULL,
    "lastSeenOnlineAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "firmwareVersion" TEXT NOT NULL,
    "boardName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("uuid")
);
