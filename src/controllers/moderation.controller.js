// src/controllers/moderation.controller.js
const { Op } = require("sequelize");
const {
  Job,
  User,
  Profile,
  Report,
  Like,
  Comment,
  Event,
  Repost,
  Product,
  Service,
  Tourism,
  Funding,
  Moment,
  Need
} = require("../models");

/**
 * Get content for moderation (with pagination and filtering)
 */
exports.getContentForModeration = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.accountType !== "admin") {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    const {
      page = 1,
      limit = 10,
      contentType = "job",
      moderationStatus = "all",
      sortBy = "createdAt",
      sortOrder = "DESC"
    } = req.query;

    const offset = (page - 1) * limit;

    // Build where clause based on filters
    const whereClause = {};

    if (moderationStatus && moderationStatus !== "all") {
      whereClause.moderation_status = moderationStatus;
    }

    // Get content based on content type
    let contentData = [];

    const contentTypes = ["job", "event", "service", "product", "tourism", "funding", "moment", "need"];
    const models = { job: Job, event: Event, service: Service, product: Product, tourism: Tourism, funding: Funding, moment: Moment, need: Need };
    const userAsMap = { job: "postedBy", event: "organizer", service: "provider", product: "seller", tourism: "author", funding: "creator", moment: "user", need: "user" };

    if (contentType === "all") {
      // Collect content from all types
      for (const type of contentTypes) {
        const model = models[type];
        const userAs = userAsMap[type];
        const items = await model.findAll({
          where: whereClause,
          include: [
            {
              model: User,
              as: userAs,
              attributes: ["id", "name", "avatarUrl"],
              include: [
                {
                  model: Profile,
                  as: "profile",
                  attributes: ["professionalTitle"],
                  required: false
                }
              ]
            }
          ],
          order: [["createdAt", "DESC"]],
          limit: 1000 // Get more to combine and paginate
        });

        // Add type to each item for identification
        items.forEach(item => {
          item.contentType = type;
          item.userAs = userAs;
        });

        contentData.push(...items);
      }

      // Sort combined results by createdAt DESC
      contentData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Apply pagination
      contentData = contentData.slice(offset, offset + parseInt(limit));
    } else if (contentTypes.includes(contentType)) {
      const model = models[contentType];
      const userAs = userAsMap[contentType];
      contentData = await model.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: userAs,
            attributes: ["id", "name", "avatarUrl"],
            include: [
              {
                model: Profile,
                as: "profile",
                attributes: ["professionalTitle"],
                required: false
              }
            ]
          }
        ],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Add type to each item
      contentData.forEach(item => {
        item.contentType = contentType;
        item.userAs = userAs;
      });
    } else {
      return res.status(400).json({ message: "Invalid content type" });
    }

    // Get additional data for each item
    const contentWithStats = await Promise.all(
      contentData.map(async (item) => {
        const [reportCount, likeCount, commentCount] = await Promise.all([
          Report.count({ where: { targetType: item.contentType, targetId: item.id } }),
          Like.count({ where: { targetType: item.contentType, targetId: item.id } }),
          Comment.count({ where: { targetType: item.contentType, targetId: item.id } })
        ]);

        // Get the most recent reports
        const reports = await Report.findAll({
          where: { targetType: item.contentType, targetId: item.id },
          include: [
            {
              model: User,
              as: "reporter",
              attributes: ["id", "name", "avatarUrl"]
            }
          ],
          order: [["createdAt", "DESC"]],
          limit: 5
        });

        // Get recent comments
        const comments = await Comment.findAll({
          where: { targetType: item.contentType, targetId: item.id },
          include: [
            {
              model: User,
              as: "user",
            }
          ],
          order: [["createdAt", "DESC"]],
          limit: 10
        });

        // Get recent likes
        const likes = await Like.findAll({
          where: { targetType: item.contentType, targetId: item.id },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "name", "avatarUrl"]
            }
          ],
          order: [["createdAt", "DESC"]],
          limit: 10
        });

        return {
          id: item.id,
          title: item.title || item.description?.substring(0, 100) || "Untitled",
          description: item.description,
          contentType: item.contentType,
          moderation_status: item.moderation_status,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          postedBy: {
            id: item[item.userAs]?.id,
            name: item[item.userAs]?.name,
            avatarUrl: item[item.userAs]?.avatarUrl,
            professionalTitle: item[item.userAs]?.profile?.professionalTitle
          },
          stats: {
            reports: reportCount,
            likes: likeCount,
            comments: commentCount
          },
          reports: reports.map(report => ({
            id: report.id,
            category: report.category,
            description: report.description,
            createdAt: report.createdAt,
            reporter: {
              id: report.reporter?.id,
              name: report.reporter?.name,
              avatarUrl: report.reporter?.avatarUrl
            }
          })),
          comments: comments.map(comment => ({
            id: comment.id,
            content: comment.text,
            createdAt: comment.createdAt,
            user: {
              id: comment.user?.id,
              name: comment.user?.name,
              avatarUrl: comment.user?.avatarUrl
            }
          })),
          likes: likes.map(like => ({
            id: like.id,
            createdAt: like.createdAt,
            user: {
              id: like.user?.id,
              name: like.user?.name,
              avatarUrl: like.user?.avatarUrl
            }
          }))
        };
      })
    );

    // Calculate total for pagination
    let totalCount = 0;
    if (contentType === "all") {
      for (const type of contentTypes) {
        totalCount += await models[type].count({ where: whereClause });
      }
    } else {
      totalCount = await models[contentType].count({ where: whereClause });
    }

    res.json({
      content: contentWithStats,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error("Error getting content for moderation:", error);
    res.status(500).json({ message: "Failed to get content for moderation",error });
  }
};

/**
 * Update content moderation status
 */
exports.updateModerationStatus = async (req, res) => {
  try {
    
    // Check if user is admin
    if (req.user.accountType !== "admin") {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    const { id } = req.params;
    const { contentType = "job", moderationStatus } = req.body;

    if (!moderationStatus) {
      return res.status(400).json({ message: "Moderation status is required" });
    }

    // Update content based on content type
    let model, entityName;
    if (contentType === "job") {
      model = Job;
      entityName = "Job";
    } else if (contentType === "event") {
      model = Event;
      entityName = "Event";
    } else if (contentType === "service") {
      model = Service;
      entityName = "Service";
    } else if (contentType === "product") {
      model = Product;
      entityName = "Product";
    } else if (contentType === "tourism") {
      model = Tourism;
      entityName = "Tourism";
    } else if (contentType === "funding") {
      model = Funding;
      entityName = "Funding";
    } else if (contentType === "moment") {
      model = Moment;
      entityName = "Moment";
    } else if (contentType === "need") {
      model = Need;
      entityName = "Need";
    } else {
      return res.status(400).json({ message: "Unsupported content type" });
    }

    const entity = await model.findByPk(id);
    if (!entity) {
      return res.status(404).json({ message: `${entityName} not found` });
    }

    entity.moderation_status = moderationStatus;
    await entity.save();

    res.json({
      message: `${entityName} moderation status updated to ${moderationStatus}`,
      id: entity.id,
      moderation_status: entity.moderation_status
    });
  } catch (error) {
    console.error("Error updating moderation status:", error);
    res.status(500).json({ message: "Failed to update moderation status" });
  }
};

/**
 * Get moderation statistics
 */
exports.getModerationStats = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.accountType !== "admin") {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    // Get counts for different moderation statuses across all content types
    const contentTypes = ["job", "event", "service", "product", "tourism", "funding", "moment", "need"];
    const models = { job: Job, event: Event, service: Service, product: Product, tourism: Tourism, funding: Funding, moment: Moment, need: Need };

    const statusCounts = { reported: 0, under_review: 0, approved: 0, removed: 0, suspended: 0 };

    for (const type of contentTypes) {
      const model = models[type];
      statusCounts.reported += await model.count({ where: { moderation_status: "reported" } });
      statusCounts.under_review += await model.count({ where: { moderation_status: "under_review" } });
      statusCounts.approved += await model.count({ where: { moderation_status: "approved" } });
      statusCounts.removed += await model.count({ where: { moderation_status: "removed" } });
      statusCounts.suspended += await model.count({ where: { moderation_status: "suspended" } });
    }

    const totalReportsCount = await Report.count();

    // Get counts for today across all content types
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let approvedToday = 0;
    let removedToday = 0;

    for (const type of contentTypes) {
      const model = models[type];
      approvedToday += await model.count({
        where: {
          moderation_status: "approved",
          updatedAt: { [Op.gte]: today }
        }
      });
      removedToday += await model.count({
        where: {
          moderation_status: "removed",
          updatedAt: { [Op.gte]: today }
        }
      });
    }

    res.json({
      reported: statusCounts.reported,
      underReview: statusCounts.under_review,
      approved: statusCounts.approved,
      removed: statusCounts.removed,
      suspended: statusCounts.suspended,
      totalReports: totalReportsCount,
      today: {
        approved: approvedToday,
        removed: removedToday
      }
    });
  } catch (error) {
    console.error("Error getting moderation stats:", error);
    res.status(500).json({ message: "Failed to get moderation stats" });
  }
};

/**
 * Update report status when content is reported
 */
exports.handleContentReport = async (req, res, next) => {
  try {
    const { targetType, targetId } = req.body;

    // After creating the report, update the content's moderation status
    if (targetType === "job") {
      const job = await Job.findByPk(targetId);
      if (job && job.moderation_status === "approved") {
        job.moderation_status = "reported";
        await job.save();
      }
    }
    // Continue with the original report creation
    next();
  } catch (error) {
    console.error("Error handling content report:", error);
    next();
  }
};