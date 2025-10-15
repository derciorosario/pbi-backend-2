"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("jobs", "companyId", {
      type: Sequelize.UUID,
      allowNull: true,
    });

    await queryInterface.addIndex("jobs", ["companyId"]);

    await queryInterface.addConstraint("jobs", {
      fields: ["companyId"],
      type: "foreign key",
      name: "fk_jobs_companyId_users_id",
      references: { table: "users", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint("jobs", "fk_jobs_companyId_users_id");
    await queryInterface.removeIndex("jobs", ["companyId"]);
    await queryInterface.removeColumn("jobs", "companyId");
  },
};
