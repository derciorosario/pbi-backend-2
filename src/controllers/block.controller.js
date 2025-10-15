const { Op } = require("sequelize");
const { UserBlock, Connection, ConnectionRequest } = require("../models");

function normalizePair(a, b) {
  return String(a) < String(b)
    ? { userOneId: a, userTwoId: b }
    : { userOneId: b, userTwoId: a };
}

exports.blockUser = async (req, res) => {
  try {
    const blockerId = req.user?.id;
    const blockedId = req.params.otherUserId;
    const note = (req.body?.note || "").slice(0, 500);

    if (!blockerId) return res.status(401).json({ message: "Unauthorized" });
    if (!blockedId) return res.status(400).json({ message: "otherUserId is required" });
    if (blockerId === blockedId) return res.status(400).json({ message: "Cannot block yourself" });

    // create (idempotent)
    await UserBlock.findOrCreate({
      where: { blockerId, blockedId },
      defaults: { note },
    });

    // remove any existing connection
    const pair = normalizePair(blockerId, blockedId);
    const conn = await Connection.findOne({ where: pair });
    if (conn) await conn.destroy();

    // remove any pending requests in either direction
    await ConnectionRequest.destroy({
      where: {
        status: "pending",
        [Op.or]: [
          { fromUserId: blockerId, toUserId: blockedId },
          { fromUserId: blockedId, toUserId: blockerId },
        ],
      },
    });

    // (privacy) do NOT notify the blocked user
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to block user" });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const blockerId = req.user?.id;
    const blockedId = req.params.otherUserId;
    if (!blockerId) return res.status(401).json({ message: "Unauthorized" });
    if (!blockedId) return res.status(400).json({ message: "otherUserId is required" });

    const deleted = await UserBlock.destroy({ where: { blockerId, blockedId } });
    if (!deleted) return res.status(404).json({ message: "Not blocked" });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to unblock user" });
  }
};

exports.getMyBlocks = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const rows = await UserBlock.findAll({ where: { blockerId: userId }, order: [["createdAt", "DESC"]] });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load blocks" });
  }
};
