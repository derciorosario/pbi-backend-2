const { Report, Job } = require("../models");

exports.createReport = async (req, res) => {
  try {
    const reporterId = req.user?.id;
    if (!reporterId) return res.status(401).json({ message: "Unauthorized" });

    const { targetType = "user", targetId, category = "other", description } = req.body || {};
    if (!targetId)   return res.status(400).json({ message: "targetId is required" });
    if (!description || !description.trim()) return res.status(400).json({ message: "description is required" });

    const row = await Report.create({
      reporterId,
      targetType,
      targetId,
      category,
      description: String(description).slice(0, 5000),
    });

    // Update moderation status for reported content
    if (targetType === "job") {
      const job = await Job.findByPk(targetId);
      if (job && job.moderation_status === "approved") {
        job.moderation_status = "reported";
        await job.save();
      }
    }

    // Optionally notify admins/moderators here

    res.json({ ok: true, id: row.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit report" });
  }
};
