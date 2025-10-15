// src/models/conversation.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Conversation = sequelize.define(
    "Conversation",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      // The two users involved in the conversation
      user1Id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      user2Id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      // Last message in the conversation
      lastMessageContent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Timestamp of the last message
      lastMessageTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Unread count for each user
      user1UnreadCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      user2UnreadCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      tableName: "conversations",
      timestamps: true,
      indexes: [
        { fields: ["user1Id"] },
        { fields: ["user2Id"] },
        { fields: ["lastMessageTime"] },
      ],
    }
  );

  return Conversation;
};