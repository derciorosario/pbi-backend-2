// src/controllers/dashboard.controller.js
const { Op } = require("sequelize");
const {
  User, Profile, Connection, ConnectionRequest, Message, Conversation,
  Notification, Like, Comment, Report,
  Job, Event, Service, Product, Tourism, Funding, Moment, Need,
  Identity, UserIdentity, Goal, UserGoal,
  CompanyRepresentative, CompanyStaff, OrganizationJoinRequest,
  MeetingRequest
} = require("../models");

/**
 * Get comprehensive dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.accountType !== "admin") {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    // Get date ranges for growth calculations
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Parallel data fetching for better performance
    const [
      // User statistics
      totalUsers,
      activeUsers,
      suspendedUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,

      // Connection statistics
      totalConnections,
      pendingRequests,

      // Content statistics
      totalJobs,
      totalEvents,
      totalServices,
      totalProducts,
      totalTourism,
      totalFunding,
      totalMoments,
      totalNeeds,

      // Social engagement
      totalLikes,
      totalComments,
      totalReports,

      // Communication
      totalMessages,
      totalConversations,
      totalMeetingRequests,

      // Notifications
      totalNotifications,

      // Company/Organization
      totalCompanies,
      totalOrganizationRequests,

      // Identity distribution
      identityStats,

      // Goal completion
      goalStats
    ] = await Promise.all([
      // User stats
      User.count({ where: { accountType: { [Op.ne]: "admin" } } }),
      User.count({ where: { accountType: { [Op.ne]: "admin" }, isVerified: true } }),
      User.count({ where: { accountType: { [Op.ne]: "admin" }, isVerified: false } }),
      User.count({ where: { accountType: { [Op.ne]: "admin" }, createdAt: { [Op.gte]: today } } }),
      User.count({ where: { accountType: { [Op.ne]: "admin" }, createdAt: { [Op.gte]: lastWeek } } }),
      User.count({ where: { accountType: { [Op.ne]: "admin" }, createdAt: { [Op.gte]: lastMonth } } }),

      // Connection stats
      Connection.count(),
      ConnectionRequest.count({ where: { status: "pending" } }),

      // Content stats
      Job.count(),
      Event.count(),
      Service.count(),
      Product.count(),
      Tourism.count(),
      Funding.count(),
      Moment.count(),
      Need.count(),

      // Social engagement
      Like.count(),
      Comment.count(),
      Report.count(),

      // Communication
      Message.count(),
      Conversation.count(),
      MeetingRequest.count(),

      // Notifications
      Notification.count(),

      // Company/Organization
      User.count({ where: { accountType: "company" } }),
      OrganizationJoinRequest.count({ where: { status: "pending" } }),

      // Identity distribution (top 10)
      UserIdentity.findAll({
        include: [{ model: Identity, as: "identity" }],
        attributes: [
          [UserIdentity.sequelize.fn('COUNT', UserIdentity.sequelize.col('identityId')), 'count']
        ],
        include: [{ model: Identity, as: "identity", attributes: ["name"] }],
        group: ["identityId", "identity.id", "identity.name"],
        order: [[UserIdentity.sequelize.fn('COUNT', UserIdentity.sequelize.col('identityId')), 'DESC']],
        limit: 10,
        raw: true
      }),

      // Goal completion stats
      UserGoal.findAll({
        include: [{ model: Goal, as: "goal" }],
        attributes: [
          [UserGoal.sequelize.fn('COUNT', UserGoal.sequelize.col('goalId')), 'count']
        ],
        include: [{ model: Goal, as: "goal", attributes: ["name"] }],
        group: ["goalId", "goal.id", "goal.name"],
        order: [[UserGoal.sequelize.fn('COUNT', UserGoal.sequelize.col('goalId')), 'DESC']],
        limit: 10,
        raw: true
      })
    ]);

    // Calculate growth rates
    const userGrowth = {
      daily: newUsersThisWeek > 0 ? ((newUsersToday / newUsersThisWeek) * 100).toFixed(1) : 0,
      weekly: newUsersThisMonth > 0 ? ((newUsersThisWeek / newUsersThisMonth) * 100).toFixed(1) : 0,
      monthly: totalUsers > 0 ? ((newUsersThisMonth / totalUsers) * 100).toFixed(1) : 0
    };

    // Content distribution
    const contentDistribution = {
      jobs: totalJobs,
      events: totalEvents,
      services: totalServices,
      products: totalProducts,
      tourism: totalTourism,
      funding: totalFunding,
      moments: totalMoments,
      needs: totalNeeds
    };

    // Calculate total content
    const totalContent = Object.values(contentDistribution).reduce((sum, count) => sum + count, 0);

    // Moderation stats (reuse from moderation controller logic)
    const contentTypes = ["job", "event", "service", "product", "tourism", "funding", "moment", "need"];
    const models = { job: Job, event: Event, service: Service, product: Product, tourism: Tourism, funding: Funding, moment: Moment, need: Need };

    const moderationStats = { reported: 0, under_review: 0, approved: 0, removed: 0, suspended: 0 };

    for (const type of contentTypes) {
      const model = models[type];
      moderationStats.reported += await model.count({ where: { moderation_status: "reported" } });
      moderationStats.under_review += await model.count({ where: { moderation_status: "under_review" } });
      moderationStats.approved += await model.count({ where: { moderation_status: "approved" } });
      moderationStats.removed += await model.count({ where: { moderation_status: "removed" } });
      moderationStats.suspended += await model.count({ where: { moderation_status: "suspended" } });
    }

    // Get today's moderation actions
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
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersThisWeek,
        newThisMonth: newUsersThisMonth,
        growth: userGrowth
      },
      connections: {
        total: totalConnections,
        pendingRequests: pendingRequests
      },
      content: {
        total: totalContent,
        distribution: contentDistribution
      },
      moderation: {
        ...moderationStats,
        today: {
          approved: approvedToday,
          removed: removedToday
        }
      },
      engagement: {
        likes: totalLikes,
        comments: totalComments,
        reports: totalReports
      },
      communication: {
        messages: totalMessages,
        conversations: totalConversations,
        meetingRequests: totalMeetingRequests
      },
      notifications: {
        total: totalNotifications
      },
      organizations: {
        companies: totalCompanies,
        pendingJoinRequests: totalOrganizationRequests
      },
      demographics: {
        identities: identityStats.map(stat => ({
          name: stat['identity.name'],
          count: parseInt(stat.count)
        })),
        goals: goalStats.map(stat => ({
          name: stat['goal.name'],
          count: parseInt(stat.count)
        }))
      }
    });

  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    res.status(500).json({ message: "Failed to get dashboard statistics" });
  }
};

/**
 * Get user growth data for charts (last 30 days)
 */
exports.getUserGrowthData = async (req, res) => {
  try {
    if (req.user.accountType !== "admin") {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    const days = parseInt(req.query.days) || 30;
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const count = await User.count({
        where: {
          accountType: { [Op.ne]: "admin" },
          createdAt: {
            [Op.gte]: startOfDay,
            [Op.lt]: endOfDay
          }
        }
      });

      data.push({
        date: startOfDay.toISOString().split('T')[0],
        users: count
      });
    }

    res.json({ growth: data });
  } catch (error) {
    console.error("Error getting user growth data:", error);
    res.status(500).json({ message: "Failed to get user growth data" });
  }
};

/**
 * Get recent activity for dashboard
 */
exports.getRecentActivity = async (req, res) => {
  try {
    if (req.user.accountType !== "admin") {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    const limit = parseInt(req.query.limit) || 20;
    const activities = [];

    // Get recent users
    const recentUsers = await User.findAll({
      where: { accountType: { [Op.ne]: "admin" } },
      attributes: ["id", "name", "accountType", "createdAt"],
      order: [["createdAt", "DESC"]],
      limit: 10
    });

    recentUsers.forEach(user => {
      activities.push({
        id: `user-${user.id}`,
        type: "user_registration",
        title: "New user registration",
        description: `${user.name} joined as ${user.accountType}`,
        timestamp: user.createdAt,
        icon: "👤",
        url: `/admin/users/${user.id}`,
        data: { userId: user.id, userName: user.name }
      });
    });

    // Get recent content reports
    const recentReports = await Report.findAll({
      include: [
        {
          model: User,
          as: "reporter",
          attributes: ["id", "name"]
        }
      ],
      order: [["createdAt", "DESC"]],
      limit: 10
    });

    recentReports.forEach(report => {
      activities.push({
        id: `report-${report.id}`,
        type: "content_reported",
        title: "Content reported",
        description: `${report.targetType} reported by ${report.reporter?.name || 'User'}`,
        timestamp: report.createdAt,
        icon: "🚩",
        url: `/admin/moderation`,
        data: { reportId: report.id, targetType: report.targetType }
      });
    });

    // Get recent connections
    const recentConnections = await Connection.findAll({
      include: [
        { model: User, as: "userOne", attributes: ["id", "name"] },
        { model: User, as: "userTwo", attributes: ["id", "name"] }
      ],
      order: [["createdAt", "DESC"]],
      limit: 5
    });

    recentConnections.forEach(connection => {
      activities.push({
        id: `connection-${connection.id}`,
        type: "connection_made",
        title: "New connection",
        description: `${connection.userOne?.name} connected with ${connection.userTwo?.name}`,
        timestamp: connection.createdAt,
        icon: "🤝",
        data: { connectionId: connection.id }
      });
    });

    // Sort by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      activities: activities.slice(0, limit)
    });

  } catch (error) {
    console.error("Error getting recent activity:", error);
    res.status(500).json({ message: "Failed to get recent activity" });
  }
};