import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789484364596 implements MigrationInterface {
    name = 'InitialSchema1789484364596'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "order_id" uuid NOT NULL, "sku" character varying NOT NULL, "qty" integer NOT NULL, "unit_price" numeric(12,2) NOT NULL, "product_name" character varying, "discount_percentage" numeric(5,2), "final_unit_price" numeric(12,2), CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('RECEIVED', 'ENRICHING', 'ENRICHED', 'FAILED_ENRICHMENT')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "external_order_id" character varying NOT NULL, "idempotency_key" character varying NOT NULL, "source" character varying NOT NULL, "customer_email" character varying NOT NULL, "customer_name" character varying NOT NULL, "currency" character varying(3) NOT NULL, "status" "public"."orders_status_enum" NOT NULL DEFAULT 'RECEIVED', "subtotal" numeric(12,2) NOT NULL, "discount_total" numeric(12,2) NOT NULL, "total" numeric(12,2) NOT NULL, "enriched_at" TIMESTAMP WITH TIME ZONE, "failure_reason" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_orders_idempotency_key" ON "orders" ("idempotency_key") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_status" ON "orders" ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_created_at" ON "orders" ("created_at") `);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_status"`);
        await queryRunner.query(`DROP INDEX "public"."uq_orders_idempotency_key"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
        await queryRunner.query(`DROP TABLE "order_items"`);
    }

}
