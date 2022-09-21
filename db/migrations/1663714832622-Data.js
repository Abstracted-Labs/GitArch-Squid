module.exports = class Data1663714832622 {
  name = 'Data1663714832622'

  async up(db) {
    await db.query(`CREATE TABLE "account" ("id" character varying NOT NULL, "account_id" text, CONSTRAINT "PK_54115ee388cdb6d86bb4bf5b2ea" PRIMARY KEY ("id"))`)
    await db.query(`CREATE TABLE "ips" ("id" character varying NOT NULL, "account_id" text, CONSTRAINT "PK_9c7e0cec8d2feb53801f29ffacf" PRIMARY KEY ("id"))`)
    await db.query(`CREATE TABLE "ips_account" ("id" character varying NOT NULL, "token_balance" numeric, "account_id" character varying, "ips_id" character varying, CONSTRAINT "PK_5a587a25d655896b526a7da2e8a" PRIMARY KEY ("id"))`)
    await db.query(`CREATE INDEX "IDX_1046ca0d7d1d6d8c39d981bd16" ON "ips_account" ("account_id") `)
    await db.query(`CREATE INDEX "IDX_c80ee308f39f647d46f8cc7147" ON "ips_account" ("ips_id") `)
    await db.query(`ALTER TABLE "ips_account" ADD CONSTRAINT "FK_1046ca0d7d1d6d8c39d981bd160" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
    await db.query(`ALTER TABLE "ips_account" ADD CONSTRAINT "FK_c80ee308f39f647d46f8cc71470" FOREIGN KEY ("ips_id") REFERENCES "ips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
  }

  async down(db) {
    await db.query(`DROP TABLE "account"`)
    await db.query(`DROP TABLE "ips"`)
    await db.query(`DROP TABLE "ips_account"`)
    await db.query(`DROP INDEX "public"."IDX_1046ca0d7d1d6d8c39d981bd16"`)
    await db.query(`DROP INDEX "public"."IDX_c80ee308f39f647d46f8cc7147"`)
    await db.query(`ALTER TABLE "ips_account" DROP CONSTRAINT "FK_1046ca0d7d1d6d8c39d981bd160"`)
    await db.query(`ALTER TABLE "ips_account" DROP CONSTRAINT "FK_c80ee308f39f647d46f8cc71470"`)
  }
}
