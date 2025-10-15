// utils/blocking.js
const { UserBlock } = require("../models");

/**
 * Compute mutual block status between a viewer and a target user.
 * @param {string|null|undefined} viewerId - The user performing the action (or null if anonymous)
 * @param {string} targetUserId - The user being viewed/acted on
 * @returns {Promise<{ iBlockedThem: boolean, theyBlockedMe: boolean, status: "none"|"i_blocked"|"blocked_me"|"mutual" }>}
 */
async function getBlockStatus(viewerId, targetUserId) {
  if (!viewerId || String(viewerId) === String(targetUserId)) {
    return { iBlockedThem: false, theyBlockedMe: false, status: "none" };
  }

  const [iBlock, theyBlock] = await Promise.all([
    UserBlock.findOne({ where: { blockerId: viewerId,  blockedId: targetUserId } }),
    UserBlock.findOne({ where: { blockerId: targetUserId, blockedId: viewerId  } }),
  ]);

  const iBlockedThem   = !!iBlock;
  const theyBlockedMe  = !!theyBlock;

  let status = "none";
  if (iBlockedThem && theyBlockedMe) status = "mutual";
  else if (iBlockedThem)             status = "i_blocked";
  else if (theyBlockedMe)            status = "blocked_me";

  return { iBlockedThem, theyBlockedMe, status };
}

/**
 * Normalize connectionStatus given a block state.
 * - iBlockedThem     -> "blocked"
 * - theyBlockedMe    -> "blocked_by_them"
 * - mutual           -> "blocked" (by convention)
 */
function normalizeConnectionStatusForBlock(connectionStatus, block) {
  if (!block) return connectionStatus;
  if (block.iBlockedThem) return "blocked";
  if (block.theyBlockedMe) return "blocked_by_them";
  return connectionStatus;
}

/**
 * Guard helper for mutating actions (messages, requests, etc.).
 * Throws a 403 with a standard message if either side blocked the other.
 */
async function assertNotBlocked(viewerId, targetUserId, message = "Action not allowed due to user blocking") {
  const block = await getBlockStatus(viewerId, targetUserId);
  if (block.iBlockedThem || block.theyBlockedMe) {
    const err = new Error(message);
    err.status = 403;
    err.code = "BLOCKED";
    err.block = block;
    throw err;
  }
  return block;
}

module.exports = {
  getBlockStatus,
  normalizeConnectionStatusForBlock,
  assertNotBlocked,
};
