import { MigrationInterface, QueryRunner } from "typeorm";

export class OrderConversion1789562766926 implements MigrationInterface {
    name = 'OrderConversion1789562766926'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ADD "converted_total" numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "exchange_rate" numeric(12,6)`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "rate_date" date`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "rate_date"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "exchange_rate"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "converted_total"`);
    }

}
