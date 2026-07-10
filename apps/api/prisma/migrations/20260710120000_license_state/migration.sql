-- Licenciamento da instalação (server box)
CREATE TABLE "license_state" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "hardware_id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "max_players" INTEGER NOT NULL,
    "license_key" TEXT,
    "customer" TEXT,
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "last_validated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_state_pkey" PRIMARY KEY ("id")
);
