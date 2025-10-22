// scripts/create_meeting_participants_triggers.js
const { sequelize } = require("../src/models");

async function createMeetingParticipantsWithTriggers() {
  try {
    console.log("Creating meeting_participants table with triggers instead of foreign keys...");

    await sequelize.query(`DROP TABLE IF EXISTS meeting_participants`);

    // Create table without foreign keys
    const createQuery = `
      CREATE TABLE meeting_participants (
        id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        meetingRequestId CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        userId CHAR(36) NOT NULL,
        status ENUM('pending', 'accepted', 'rejected', 'tentative') NOT NULL DEFAULT 'pending',
        respondedAt DATETIME NULL,
        rejectionReason TEXT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_meeting_request (meetingRequestId),
        INDEX idx_user (userId),
        INDEX idx_status (status),
        UNIQUE INDEX idx_meeting_request_user (meetingRequestId, userId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await sequelize.query(createQuery);
    console.log("✅ meeting_participants table created successfully");

    // Create triggers to emulate foreign key behavior
    console.log("Creating triggers for data integrity...");

    // Trigger to prevent insertion of non-existent meeting requests
    await sequelize.query(`
      CREATE TRIGGER before_insert_meeting_participant_meeting
      BEFORE INSERT ON meeting_participants
      FOR EACH ROW
      BEGIN
        DECLARE meeting_exists INT DEFAULT 0;
        SELECT COUNT(*) INTO meeting_exists 
        FROM meeting_requests 
        WHERE id = NEW.meetingRequestId;
        
        IF meeting_exists = 0 THEN
          SIGNAL SQLSTATE '45000' 
          SET MESSAGE_TEXT = 'Meeting request does not exist';
        END IF;
      END
    `);

    // Trigger to prevent insertion of non-existent users
    await sequelize.query(`
      CREATE TRIGGER before_insert_meeting_participant_user
      BEFORE INSERT ON meeting_participants
      FOR EACH ROW
      BEGIN
        DECLARE user_exists INT DEFAULT 0;
        SELECT COUNT(*) INTO user_exists 
        FROM users 
        WHERE id = NEW.userId;
        
        IF user_exists = 0 THEN
          SIGNAL SQLSTATE '45000' 
          SET MESSAGE_TEXT = 'User does not exist';
        END IF;
      END
    `);

    // Trigger to cascade delete when meeting_requests are deleted
    await sequelize.query(`
      CREATE TRIGGER after_delete_meeting_request
      AFTER DELETE ON meeting_requests
      FOR EACH ROW
      BEGIN
        DELETE FROM meeting_participants 
        WHERE meetingRequestId = OLD.id;
      END
    `);

    console.log("✅ Triggers created successfully");
    console.log("🎉 meeting_participants table created with trigger-based integrity!");

    return true;
  } catch (error) {
    console.error("❌ Error:", error.message);
    return false;
  }
}

createMeetingParticipantsWithTriggers();