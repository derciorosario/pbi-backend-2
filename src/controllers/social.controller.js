const { Like, Comment, Repost, User, Profile, Notification } = require("../models");
const { Op } = require("sequelize");
const { cache } = require("../utils/redis");
const { sendTemplatedEmail } = require("../utils/email");
// ==================== LIKES ====================



/**
 * Get all likes for a specific target including user information
 */
exports.getLikes = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    
    if (!targetType || !targetId) {
      return res.status(400).json({ message: "targetType and targetId are required" });
    }

    const likes = await Like.findAll({
      where: { 
        targetType, 
        targetId 
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "avatarUrl", "accountType"],
          include: [{
            model: Profile,
            as: "profile",
            attributes: ["professionalTitle"]
          }]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    // Transform the response to include user info more cleanly
    const likesWithUsers = likes.map(like => ({
      id: like.id,
      createdAt: like.createdAt,
      user: {
        id: like.user.id,
        name: like.user.name,
        avatarUrl: like.user.avatarUrl,
        accountType: like.user.accountType,
        professionalTitle: like.user.profile?.professionalTitle,
      }
    }));

    res.json({
      count: likes.length,
      likes: likesWithUsers
    });

  } catch (err) {
    console.error("Error getting likes:", err);
    res.status(500).json({ message: "Failed to get likes" });
  }
};

/**
 * Get paginated likes for a specific target including user information
 */
exports.getLikesPaginated = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    if (!targetType || !targetId) {
      return res.status(400).json({ message: "targetType and targetId are required" });
    }

    const { count, rows: likes } = await Like.findAndCountAll({
      where: { 
        targetType, 
        targetId 
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "avatarUrl", "accountType"],
          include: [{
            model: Profile,
            as: "profile",
            attributes: ["professionalTitle"]
          }]
        }
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset
    });

    // Transform the response
    const likesWithUsers = likes.map(like => ({
      id: like.id,
      createdAt: like.createdAt,
      user: {
        id: like.user.id,
        name: like.user.name,
        avatarUrl: like.user.avatarUrl,
        accountType: like.user.accountType,
        professionalTitle: like.user.profile?.professionalTitle,
      }
    }));

    res.json({
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      likes: likesWithUsers
    });

  } catch (err) {
    console.error("Error getting paginated likes:", err);
    res.status(500).json({ message: "Failed to get likes" });
  }
};

/**
 * Check if current user has liked specific targets (batch check)
 */
exports.checkUserLikes = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { targets } = req.body; // Expected format: [{ targetType, targetId }, ...]
    
    if (!Array.isArray(targets)) {
      return res.status(400).json({ message: "targets array is required" });
    }

    const likeStatuses = await Promise.all(
      targets.map(async (target) => {
        const { targetType, targetId } = target;
        
        if (!targetType || !targetId) {
          return null;
        }

        const existingLike = await Like.findOne({
          where: { userId, targetType, targetId }
        });

        const count = await getLikeCount(targetType, targetId);

        return {
          targetType,
          targetId,
          liked: !!existingLike,
          count
        };
      })
    );

    // Filter out any null results from invalid targets
    const validResults = likeStatuses.filter(result => result !== null);

    res.json(validResults);

  } catch (err) {
    console.error("Error checking user likes:", err);
    res.status(500).json({ message: "Failed to check like status" });
  }
};



/**
 * Toggle a like (create if doesn't exist, delete if it does)
 */
exports.toggleLike = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { targetType, targetId } = req.body || {};
    if (!targetType) return res.status(400).json({ message: "targetType is required" });
    if (!targetId) return res.status(400).json({ message: "targetId is required" });

    // Check if the like already exists
    const existingLike = await Like.findOne({
      where: { userId, targetType, targetId }
    });


    await cache.deleteKeys([
        ["feed", req.user.id] 
    ]);

    if (existingLike) {
      // Unlike: delete the existing like
      await existingLike.destroy();
      return res.json({ liked: false, count: await getLikeCount(targetType, targetId) });
    } else {
      // Like: create a new like
      await Like.create({ userId, targetType, targetId });
      return res.json({ liked: true, count: await getLikeCount(targetType, targetId) });
    }
  } catch (err) {
    console.error("Error toggling like:", err);
    res.status(500).json({ message: "Failed to toggle like" });
  }
};

/**
 * Get like status for a specific target
 */
exports.getLikeStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { targetType, targetId } = req.params;
    if (!targetType || !targetId) {
      return res.status(400).json({ message: "targetType and targetId are required" });
    }

    const existingLike = await Like.findOne({
      where: { userId, targetType, targetId }
    });

    const count = await getLikeCount(targetType, targetId);

    res.json({
      liked: !!existingLike,
      count
    });

  } catch (err) {
    console.error("Error getting like status:", err);
    res.status(500).json({ message: "Failed to get like status" });
  }
};

/**
 * Helper function to get the like count for a target
 */
async function getLikeCount(targetType, targetId) {
  return await Like.count({
    where: { targetType, targetId }
  });
}

// ==================== COMMENTS ====================

/**
 * Create a new comment
 */
exports.createComment = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { targetType, targetId, text, parentCommentId } = req.body || {};
    if (!targetType) return res.status(400).json({ message: "targetType is required" });
    if (!targetId) return res.status(400).json({ message: "targetId is required" });
    if (!text || !text.trim()) return res.status(400).json({ message: "text is required" });

    const comment = await Comment.create({
      userId,
      targetType,
      targetId,
      parentCommentId: parentCommentId || null,
      text: text.trim(),
      status: "active"
    });

    // Fetch the created comment with user info
    const commentWithUser = await Comment.findByPk(comment.id, {
      include: [{
        model: User,
        as: "user",
        attributes: ["id", "name", "avatarUrl"],
        include: [{
          model: Profile,
          as: "profile",
          attributes: ["professionalTitle"]
        }]
      }]
    });

    await cache.deleteKeys([
        ["feed", req.user.id]
    ]);


    const user=await User.findByPk(req.user.id,{
      attributes: ['id', 'name']
    })

    // Send notifications to relevant users
    await sendCommentNotifications(comment, user);

    res.status(201).json(commentWithUser);
  } catch (err) {
    console.error("Error creating comment:", err);
    res.status(500).json({ message: "Failed to create comment" });
  }
};

/**
 * Get comments for a specific target
 */
exports.getComments = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (!targetType || !targetId) {
      return res.status(400).json({ message: "targetType and targetId are required" });
    }

    const comments = await Comment.findAll({
      where: {
        targetType,
        targetId,
        status: { [Op.ne]: "deleted" }, // Exclude deleted comments
        parentCommentId: null // Only get top-level comments
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "avatarUrl"],
          include: [{
            model: Profile,
            as: "profile",
            attributes: ["professionalTitle"]
          }]
        },
        {
          model: Comment,
          as: "replies",
          where: { status: { [Op.ne]: "deleted" } }, // Exclude deleted replies
          required: false,
          include: [{
            model: User,
            as: "user",
            attributes: ["id", "name", "avatarUrl"],
            include: [{
              model: Profile,
              as: "profile",
              attributes: ["professionalTitle"]
            }]
          }]
        }
      ],
      order: [
        ["createdAt", "DESC"],
        [{ model: Comment, as: "replies" }, "createdAt", "ASC"]
      ]
    });

    res.json(comments);
  } catch (err) {
    console.error("Error getting comments:", err);
    res.status(500).json({ message: "Failed to get comments" });
  }
};

/**
 * Update a comment
 */
exports.updateComment = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "text is required" });
    }

    const comment = await Comment.findByPk(id);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Only the comment owner can update it
    if (comment.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to update this comment" });
    }

     await cache.deleteKeys([
        ["feed", req.user.id] 
    ]);

    comment.text = text.trim();
    await comment.save();

    res.json(comment);
  } catch (err) {
    console.error("Error updating comment:", err);
    res.status(500).json({ message: "Failed to update comment" });
  }
};

/**
 * Delete a comment (soft delete)
 */
exports.deleteComment = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const comment = await Comment.findByPk(id);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Only the comment owner can delete it
    if (comment.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to delete this comment" });
    }

    // Soft delete
    comment.status = "deleted";
    await comment.save();

    await cache.deleteKeys([
        ["feed", req.user.id] 
    ]);

    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    console.error("Error deleting comment:", err);
    res.status(500).json({ message: "Failed to delete comment" });
  }
};

// ==================== REPOSTS ====================

/**
 * Create a repost
 */
exports.createRepost = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { targetType, targetId, comment } = req.body || {};
    if (!targetType) return res.status(400).json({ message: "targetType is required" });
    if (!targetId) return res.status(400).json({ message: "targetId is required." });

    // Check if the repost already exists
    const existingRepost = await Repost.findOne({
      where: { userId, targetType, targetId }
    });

    if (existingRepost) {
      return res.status(400).json({ message: "You have already reposted this content" });
    }

    const repost = await Repost.create({
      userId,
      targetType,
      targetId,
      comment: comment || null
    });


    await cache.deleteKeys([
        ["feed", req.user.id] 
    ]);

    res.status(201).json(repost);
  } catch (err) {
    console.error("Error creating repost:", err);
    res.status(500).json({ message: "Failed to create repost" });
  }
};

/**
 * Delete a repost
 */
exports.deleteRepost = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const repost = await Repost.findByPk(id);

    if (!repost) {
      return res.status(404).json({ message: "Repost not found" });
    }

    // Only the repost owner can delete it
    if (repost.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to delete this repost" });
    }

     await cache.deleteKeys([
        ["feed", req.user.id] 
    ]);

    await repost.destroy();
    res.json({ message: "Repost deleted successfully" });
  } catch (err) {
    console.error("Error deleting repost:", err);
    res.status(500).json({ message: "Failed to delete repost" });
  }
};

/**
 * Get reposts for a specific target
 */
exports.getReposts = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (!targetType || !targetId) {
      return res.status(400).json({ message: "targetType and targetId are required" });
    }

    const reposts = await Repost.findAll({
      where: { targetType, targetId },
      include: [{
        model: User,
        as: "user",
        attributes: ["id", "name", "avatarUrl"],
        include: [{
          model: Profile,
          as: "profile",
          attributes: ["professionalTitle"]
        }]
      }],
      order: [["createdAt", "DESC"]]
    });

    res.json(reposts);
  } catch (err) {
    console.error("Error getting reposts:", err);
    res.status(500).json({ message: "Failed to get reposts" });
  }
};

// Helper function to send comment notifications
async function sendCommentNotifications(comment, commenter) {
  try {
    // Get the post/item that was commented on
    let postData = null;
    let postOwnerId = null;
    let postTitle = null;
    let postType = null;
    let description=null

    // Determine post type and get post data
    switch (comment.targetType) {
      case 'job':
        const Job = require('../models').Job;
        postData = await Job.findByPk(comment.targetId, {
          attributes: ['id', 'title', 'postedByUserId','description'],
          include: [{ model: require('../models').User, as: 'postedBy', attributes: ['id', 'name', 'email'] }]
        });
        if (postData) {
          postOwnerId = postData.postedByUserId;
          postTitle = postData.title;
          postType = 'job';
          description= postData.description
        }
        break;
      case 'event':
        const Event = require('../models').Event;
        postData = await Event.findByPk(comment.targetId, {
          attributes: ['id', 'title', 'organizerUserId','description'],
          include: [{ model: require('../models').User, as: 'organizer', attributes: ['id', 'name', 'email'] }]
        });
        if (postData) {
          postOwnerId = postData.organizerUserId;
          postTitle = postData.title;
          postType = 'event';
          description= postData.description
        }
        break;
      case 'service':
        const Service = require('../models').Service;
        postData = await Service.findByPk(comment.targetId, {
          attributes: ['id', 'title', 'providerUserId','description'],
          include: [{ model: require('../models').User, as: 'provider', attributes: ['id', 'name', 'email'] }]
        });
        if (postData) {
          postOwnerId = postData.providerUserId;
          postTitle = postData.title;
          postType = 'service';
          description= postData.description
        }
        break;
      case 'product':
        const Product = require('../models').Product;
        postData = await Product.findByPk(comment.targetId, {
          attributes: ['id', 'title', 'sellerUserId','description'],
          include: [{ model: require('../models').User, as: 'seller', attributes: ['id', 'name', 'email'] }]
        });
        if (postData) {
          postOwnerId = postData.sellerUserId;
          postTitle = postData.title;
          postType = 'product';
          description= postData.description
        }
        break;
      case 'tourism':
      case 'experience':
        const Tourism = require('../models').Tourism;
        postData = await Tourism.findByPk(comment.targetId, {
          attributes: ['id', 'title', 'authorUserId','description'],
          include: [{ model: require('../models').User, as: 'author', attributes: ['id', 'name', 'email'] }]
        });
        if (postData) {
          postOwnerId = postData.authorUserId;
          postTitle = postData.title;
          postType = 'tourism activity';
          description= postData.description
        }
        break;
      case 'funding':
      case 'crowdfunding':
        const Funding = require('../models').Funding;
        postData = await Funding.findByPk(comment.targetId, {
          attributes: ['id', 'title', 'creatorUserId','pitch'],
          include: [{ model: require('../models').User, as: 'creator', attributes: ['id', 'name', 'email'] }]
        });
        if (postData) {
          postOwnerId = postData.creatorUserId;
          postTitle = postData.title;
          postType = 'funding investiment';
          description= postData.pitch
        }
        break;
      case 'moment':
        const Moment = require('../models').Moment;
        postData = await Moment.findByPk(comment.targetId, {
          attributes: ['id', 'title', 'userId','description'],
          include: [{ model: require('../models').User, as: 'user', attributes: ['id', 'name', 'email'] }]
        });
        if (postData) {
          postOwnerId = postData.userId;
          postTitle = postData.title;
          postType = 'experience';
          description= postData.description
        }
        break;
      case 'need':
        const Need = require('../models').Need;
        postData = await Need.findByPk(comment.targetId, {
          attributes: ['id', 'title', 'userId','description'],
          include: [{ model: require('../models').User, as: 'user', attributes: ['id', 'name', 'email'] }]
        });
        if (postData) {
          postOwnerId = postData.userId;
          postTitle = postData.title;
          postType = 'interest';
          description= postData.description
        }
        break;
    }

    if (!postData || !postOwnerId) {
      console.log('No post data found for comment notification');
      return;
    }

    // Don't notify if user commented on their own post
    if (postOwnerId === commenter.id) {
      return;
    }

    // Get post owner's user data
    const postOwner = await User.findByPk(postOwnerId, {
      attributes: ['id', 'name', 'email'],
      include: [{
        model: require('../models').UserSettings,
        as: 'settings',
        attributes: ['notifyOnComments']
      }]
    });

    if (!postOwner || !postOwner.email) {
      return;
    }

    // Check if user wants comment notifications
    if (!postOwner.settings?.notifyOnComments) {
      return;
    }


    // Create in-app notification
    await Notification.create({
      userId: postOwnerId,
      type: "comment.new",
      title: "New Comment",
      message:postTitle ?  `${commenter.name} commented on your ${postType} post: "${postTitle}"` :  `${commenter.name} commented on your ${postType} post`,
      payload: {
        commenterId: commenter.id,
        commenterName: commenter.name,
        commentId: comment.id,
        commentDescription:description,
        commentText: comment.text,
        postId: comment.targetId,
        postType: postType,
        postTitle: postTitle,
        link: `${process.env.BASE_URL || 'https://54links.com'}/${comment.targetType}/${comment.targetId}`
      }
    });

    // Send email notification
    try {
      const baseUrl = process.env.WEBSITE_URL || "https://54links.com";
      sendTemplatedEmail({
        to: postOwner.email,
        subject: `New Comment on Your ${postType.charAt(0).toUpperCase() + postType.slice(1)} post`,
        template: "comment-notification",
        context: {
          subject: `New Comment on Your ${postType.charAt(0).toUpperCase() + postType.slice(1)} post`,
          preheader: `${commenter.name} commented on your ${postType}`,
          comment: {
            commenterName: commenter.name,
            commenterId: commenter.id,
            commentText: comment.text,
            commentDescription:description,
            postTitle: postTitle || (description.length > 200 ? description.slice(0,200)+'...':description),
            postType: postType,
            postId: comment.targetId,
            message_link:`${baseUrl}/messages?userId=${commenter.id}`,
            link: `${baseUrl}/${comment.targetType}/${comment.targetId}`,
            commentedAt: comment.createdAt
          }
        },
      });
    } catch (emailError) {
      console.error("Failed to send comment notification email:", emailError);
    }

  } catch (error) {
    console.error("Error sending comment notifications:", error);
  }
}

module.exports = {
  getLikes: exports.getLikes,
  getLikesPaginated: exports.getLikesPaginated,
  checkUserLikes: exports.checkUserLikes,
  toggleLike: exports.toggleLike,
  getLikeStatus: exports.getLikeStatus,
  createComment: exports.createComment,
  getComments: exports.getComments,
  updateComment: exports.updateComment,
  deleteComment: exports.deleteComment,
  createRepost: exports.createRepost,
  deleteRepost: exports.deleteRepost,
  getReposts: exports.getReposts
};