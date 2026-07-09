-- Garantir no máximo um device_state por publicação "ativa" (relação 1:1 Prisma)
CREATE UNIQUE INDEX "device_state_current_publication_id_key" ON "device_state"("current_publication_id");
