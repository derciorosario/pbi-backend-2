// src/utils/connectionStatus.js
const { Op } = require("sequelize");

/**
 * Returns a map: { [targetUserId]: "connected" | "pending_outgoing" | "pending_incoming" | "none" }
 * If currentUserId is falsy, return "unauthenticated" for every target.
 */
async function getConnectionStatusMap(currentUserId, targetIds, { Connection, ConnectionRequest }) {
  const out = {};
  const unique = Array.from(new Set((targetIds || []).filter(Boolean)));
  if (!unique.length) return out;

  if (!currentUserId) {
    unique.forEach((id) => (out[id] = "unauthenticated"));
    return out;
  }

  // Connected?
  const cons = await Connection.findAll({
    where: {
      [Op.or]: [
        { userOneId: currentUserId, userTwoId: { [Op.in]: unique } },
        { userTwoId: currentUserId, userOneId: { [Op.in]: unique } },
      ],
    },
    attributes: ["userOneId", "userTwoId"],
  });
  cons.forEach((c) => {
    const other = c.userOneId === currentUserId ? c.userTwoId : c.userOneId;
    out[other] = "connected";
  });

  // Pending (outgoing)
  const pendingOut = await ConnectionRequest.findAll({
    where: { fromUserId: currentUserId, toUserId: { [Op.in]: unique }, status: "pending" },
    attributes: ["toUserId"],
  });
  pendingOut.forEach(({ toUserId }) => {
    if (!out[toUserId]) out[toUserId] = "pending_outgoing";
  });

  // Pending (incoming)
  const pendingIn = await ConnectionRequest.findAll({
    where: { toUserId: currentUserId, fromUserId: { [Op.in]: unique }, status: "pending" },
    attributes: ["fromUserId"],
  });
  pendingIn.forEach(({ fromUserId }) => {
    if (!out[fromUserId]) out[fromUserId] = "pending_incoming";
  });

  // Default “none”
  unique.forEach((id) => {
    if (!out[id]) out[id] = "none";
  });

  return out;
}

module.exports = { getConnectionStatusMap };
