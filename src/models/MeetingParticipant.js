const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const MeetingParticipant = sequelize.define(
    "MeetingParticipant",
    {
      id: { 
        type: DataTypes.UUID, 
        defaultValue: () => uuidv4(), 
        primaryKey: true 
      },
      
      meetingRequestId: { 
        type: DataTypes.UUID, 
        allowNull: false,
        references: {
          model: 'meeting_requests',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      
      userId: { 
        type: DataTypes.UUID, 
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      
      // Participant-specific status
      status: { 
        type: DataTypes.ENUM("pending", "accepted", "rejected", "tentative"), 
        allowNull: false,
        defaultValue: "pending"
      },
      
      respondedAt: { type: DataTypes.DATE, allowNull: true },
      rejectionReason: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "meeting_participants",
      timestamps: true,
      indexes: [
        { fields: ["meetingRequestId"] },
        { fields: ["userId"] },
        { fields: ["status"] },
        { 
          fields: ["meetingRequestId", "userId"],
          unique: true 
        },
      ],
    }
  );

  MeetingParticipant.associate = (models) => {
    MeetingParticipant.belongsTo(models.MeetingRequest, { 
      foreignKey: "meetingRequestId",
      as: "meetingRequest", // Make sure this matches what you use in queries
      onDelete: 'CASCADE'
    });
    MeetingParticipant.belongsTo(models.User, { 
      foreignKey: "userId",
      as: "user", // Add this alias
      onDelete: 'CASCADE'
    });
};

  return MeetingParticipant;
};