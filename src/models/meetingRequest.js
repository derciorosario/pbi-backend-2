const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const MeetingRequest = sequelize.define(
    "MeetingRequest",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },

      // Who requested the meeting
      fromUserId: { type: DataTypes.UUID, allowNull: false },
      
      // Who the meeting is requested with
      toUserId: { type: DataTypes.UUID, allowNull: false },

      // Meeting details
      title: { type: DataTypes.STRING(200), allowNull: false },
      agenda: { type: DataTypes.TEXT, allowNull: true },
      
      // Date and time
      scheduledAt: { type: DataTypes.DATE, allowNull: false },
      duration: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 }, // minutes
      timezone: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "UTC" },

      // Meeting mode
      mode: { 
        type: DataTypes.ENUM("video", "in_person"), 
        allowNull: false,
        defaultValue: "video"
      },
      
      // Location/Link based on mode
      location: { type: DataTypes.STRING(300), allowNull: true }, // for in_person
      link: { type: DataTypes.STRING(500), allowNull: true }, // for video

      // Status
      status: { 
        type: DataTypes.ENUM("pending", "accepted", "rejected", "cancelled"), 
        allowNull: false,
        defaultValue: "pending"
      },

      // Response details
      respondedAt: { type: DataTypes.DATE, allowNull: true },
      rejectionReason: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "meeting_requests",
      timestamps: true,
      indexes: [
        { fields: ["fromUserId"] },
        { fields: ["toUserId"] },
        { fields: ["status"] },
        { fields: ["scheduledAt"] },
      ],
    }
  );

  MeetingRequest.associate = (models) => {
    MeetingRequest.belongsTo(models.User, { foreignKey: "fromUserId", as: "requester" });
    MeetingRequest.belongsTo(models.User, { foreignKey: "toUserId", as: "recipient" });
  };

  return MeetingRequest;
};