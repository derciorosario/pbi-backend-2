const { Op } = require("sequelize");
const {
  User,
  Connection,
  ConnectionRequest,
  Notification,
  UserBlock
} = require("../models");
const { sendTemplatedEmail } = require("../utils/email");
const { isEmailNotificationEnabled } = require("../utils/notificationSettings");
const { cache } = require("../utils/redis");

// normaliza par (userOneId < userTwoId) para conexão única
function normalizePair(a, b) {
  return String(a) < String(b)
    ? { userOneId: a, userTwoId: b }
    : { userOneId: b, userTwoId: a };
}



exports.removeConnection = async (req, res) => {
  try {
    const userId = req.user?.id;
    const otherUserId = req.params.otherUserId || req.body.otherUserId;
    const note = (req.body?.note || "").slice(0, 500);

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!otherUserId) return res.status(400).json({ message: "otherUserId is required" });
    if (userId === otherUserId) return res.status(400).json({ message: "Cannot remove yourself" });

    const pair = normalizePair(userId, otherUserId);

    // 1) Remove the connection if it exists
    const conn = await Connection.findOne({ where: pair });
    if (conn) await conn.destroy();

    // 2) Also remove any PENDING connection request between these users (any direction)
    await ConnectionRequest.destroy({
      where: {
        [Op.or]: [
          { fromUserId: userId,      toUserId: otherUserId },
          { fromUserId: otherUserId, toUserId: userId }
        ],
      },
    });

    // Optional: notify the other user
    /*await Notification.create({
      userId: otherUserId,
      type: "connection.removed",
      payload: { byUserId: userId, note }
    }).catch(() => {});*/

    await cache.deleteKeys([
      ["people", req.user.id] 
    ]);

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to remove connection" });
  }
};

exports.createRequest = async (req, res) => {
  try {
    const fromUserId = req.user?.id;
    const { toUserId, reason, message } = req.body;

    if (!fromUserId) return res.status(401).json({ message: "Unauthorized" });
    if (!toUserId)   return res.status(400).json({ message: "toUserId is required" });
    if (fromUserId === toUserId) return res.status(400).json({ message: "Cannot connect to yourself" });


    const blocked = await UserBlock.findOne({
      where: {
        [Op.or]: [
          { blockerId: fromUserId, toUserId },      // I blocked them
          { blockerId: toUserId,   blockedId: fromUserId }, // they blocked me
        ].map(o => ({ blockerId: Object.values(o)[0], blockedId: Object.values(o)[1] }))
      }
    });
    
    if (blocked) return res.status(403).json({ message: "You cannot connect with this user." });

    // já conectados?
    const pair = normalizePair(fromUserId, toUserId);
    const existingConn = await Connection.findOne({ where: pair });
    if (existingConn) return res.status(409).json({ message: "You are already connected" });

    // pendente em qualquer direção?
    const pending = await ConnectionRequest.findOne({
      where: {
        status: "pending",
        [Op.or]: [
          { fromUserId, toUserId },
          { fromUserId: toUserId, toUserId: fromUserId },
        ],
      },
    });
    if (pending) return res.status(409).json({ message: "A pending request already exists" });

    // cria request
    const reqRow = await ConnectionRequest.create({ fromUserId, toUserId, reason, message });

    // notifica destinatário
    const fromUser = await User.findByPk(fromUserId, { attributes: ["id", "name", "email"] });
    const toUser = await User.findByPk(toUserId, { attributes: ["id", "name", "email"] });
    
    // Create notification
    await Notification.create({
      userId: toUserId,
      type: "connection.request",
      payload: {item_id: reqRow.id,reason: reason || null,requestId: reqRow.id, fromUserId, fromName: fromUser?.name || "Someone" },
    });
    
    // Send email notification if enabled
    try {
      // Check if recipient has enabled email notifications for connection invitations
      const isEnabled = await isEmailNotificationEnabled(toUserId, 'connectionInvitations');
      
      if (isEnabled) {
        const baseUrl = process.env.WEBSITE_URL || "https://54links.com";
        const link = `${baseUrl}/notifications?tab=Connections`;
        
        await sendTemplatedEmail({
          to: toUser.email,
          subject: `New Connection Request from ${fromUser?.name || "Someone"}`,
          template: "connection-request",
          context: {
            name: toUser.name,
            fromName: fromUser?.name || "Someone",
            message: message || null,
            reason: reason || null,
            link
          }
        });
      } else {
        console.log(`Email notification skipped for user ${toUserId} (connectionInvitations disabled)`);
      }
    } catch (emailErr) {
      console.error("Failed to send connection request email:", emailErr);
      // Continue even if email fails
    }

    return res.json({ ok: true, requestId: reqRow.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create request" });
  }
};

exports.getMyPending = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const incoming = await ConnectionRequest.findAll({
      where: { toUserId: userId, status: "pending" },
      order: [["createdAt", "DESC"]],
      include: [{ model: User, as: "from", attributes: ["id", "name", "email", "avatarUrl"] }],
    });

    const outgoing = await ConnectionRequest.findAll({
      where: { fromUserId: userId, status: "pending" },
      order: [["createdAt", "DESC"]],
      include: [{ model: User, as: "to", attributes: ["id", "name", "email", "avatarUrl"] }],
    });

    res.json({
      incoming: incoming.map((r) => ({
        id: r.id,
        fromUserId: r.fromUserId,
        fromName: r.from?.name,
        reason: r.reason,
        message: r.message,
        createdAt: r.createdAt,
      })),
      outgoing: outgoing.map((r) => ({
        id: r.id,
        toUserId: r.toUserId,
        toName: r.to?.name,
        reason: r.reason,
        message: r.message,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load pending requests" });
  }
};



exports.respond = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { action } = req.body; // "accept" | "reject"

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const row = await ConnectionRequest.findByPk(id);
    if (!row || row.toUserId !== userId) return res.status(404).json({ message: "Request not found" });
    if (row.status !== "pending") return res.status(400).json({ message: "Already handled" });

    if (action === "accept") {
      const pair = normalizePair(row.fromUserId, row.toUserId);

      // Ensure the Connection exists (idempotent)
      await Connection.findOrCreate({ where: pair, defaults: pair });

      // If another accepted already exists for this direction, dedupe and exit
      const alreadyAccepted = await ConnectionRequest.findOne({
        where: { fromUserId: row.fromUserId, toUserId: row.toUserId, status: "accepted" },
        attributes: ["id"],
      });
      if (alreadyAccepted && alreadyAccepted.id !== row.id) {
        await row.destroy();
        return res.json({ ok: true, status: "accepted", deduped: true });
      }

      // Try to flip this row to accepted
      row.status = "accepted";
      row.respondedAt = new Date();

      try {
        await row.save();
      } catch (e) {
        const isDup =
          e?.name === "SequelizeUniqueConstraintError" ||
          e?.parent?.code === "ER_DUP_ENTRY";
        if (isDup) {
          // Another accepted was created in the meantime; remove this pending
          await row.destroy();
          return res.json({ ok: true, status: "accepted", deduped: true });
        }
        throw e;
      }

      // Side-effects (best-effort)
      const responder = await User.findByPk(userId, { attributes: ["id", "name", "email"] });
      const requester = await User.findByPk(row.fromUserId, { attributes: ["id", "name", "email"] });

      Notification.create({
        userId: row.fromUserId,
        type: "connection.accepted",
        payload: { byUserId: userId,reason:row.reason,fromName: responder?.name,requestId: row.id, item_id:row.id,toUserId:row.fromUserId},
      }).catch((e) => {
        console.log(e)
      });
      

      (async () => {
        try {
          const isEnabled = await isEmailNotificationEnabled(row.fromUserId, "connectionUpdates");
          if (isEnabled) {
            const baseUrl = process.env.WEBSITE_URL || "https://54links.com";
            const profileLink = `${baseUrl}/profile/${userId}`;
            await sendTemplatedEmail({
              to: requester.email,
              subject: `${responder?.name || "Someone"} Accepted Your Connection Request`,
              template: "connection-response",
              context: {
                name: requester.name,
                responderName: responder?.name || "Someone",
                accepted: true,
                profileLink,
              },
            });
          }
        } catch {}
      })();

      return res.json({ ok: true, status: "accepted" });
    }

    if (action === "reject") {
      row.status = "rejected";
      row.respondedAt = new Date();
      await row.save();

      const responder = await User.findByPk(userId, { attributes: ["id", "name", "email"] });
      const requester = await User.findByPk(row.fromUserId, { attributes: ["id", "name", "email"] });

      Notification.create({
        userId: row.fromUserId,
        type: "connection.rejected",
        payload: { byUserId: userId,fromName: responder?.name,reason:row.reason, requestId: row.id, item_id:row.item_id, toUserId:userId},
      }).catch(() => {});

      (async () => {
        try {
          const isEnabled = await isEmailNotificationEnabled(row.fromUserId, "connectionUpdates");
          if (isEnabled) {
            await sendTemplatedEmail({
              to: requester.email,
              subject: `${responder?.name || "Someone"} Declined Your Connection Request`,
              template: "connection-response",
              context: {
                name: requester.name,
                responderName: responder?.name || "Someone",
                accepted: false,
              },
            });
          }
        } catch {}
      })();

      return res.json({ ok: true, status: "rejected" });
    }

    return res.status(400).json({ message: "Invalid action" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to respond" });
  }
};




exports.getMyConnections = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const cons = await Connection.findAll({
      where: { [Op.or]: [{ userOneId: userId }, { userTwoId: userId }] },
      order: [["createdAt", "DESC"]],
    });

    const otherIds = cons.map((c) => (c.userOneId === userId ? c.userTwoId : c.userOneId));
    const users = await User.findAll({ where: { id: { [Op.in]: otherIds } }, attributes: ["id", "name", "email", "avatarUrl", "country", "city"] });

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load connections" });
  }
};
