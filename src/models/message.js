// src/models/message.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define(
    "Message",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      attachments: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
      senderId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      receiverId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      // For tracking conversation threads
      conversationId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: "messages",
      timestamps: true,
      indexes: [
        { fields: ["senderId"] },
        { fields: ["receiverId"] },
        { fields: ["conversationId"] },
        { fields: ["createdAt"] },
      ],
    }
  );

  return Message;
};