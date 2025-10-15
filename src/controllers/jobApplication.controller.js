const { JobApplication, Job, User, Notification } = require("../models");
const { cache } = require("../utils/redis");
const { sendTemplatedEmail } = require("../utils/email");
const { isEmailNotificationEnabled } = require("../utils/notificationSettings");

exports.createApplication = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const { jobId, coverLetter, expectedSalary, availability, availabilityDate, employmentType, cvData } = req.body;

    if (!jobId || !coverLetter) {
      return res.status(400).json({ message: "jobId and coverLetter are required" });
    }

    // Check if job exists
    const job = await Job.findByPk(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    // Check if user already applied
    const existing = await JobApplication.findOne({
      where: { userId: req.user.id, jobId }
    });
    if (existing) {
      return res.status(400).json({ message: "You have already applied for this job" });
    }

    const application = await JobApplication.create({

      userId: req.user.id,
      jobId,
      coverLetter,
      expectedSalary: expectedSalary || null,
      availability: availability || null,
      availabilityDate: availability === 'specific' ? availabilityDate : null,
      employmentType: employmentType || null,
      cvBase64: cvData || null

    });

    // Get job poster and applicant details for notifications and emails
    const jobPoster = await User.findByPk(job.postedByUserId, { attributes: ["id", "name", "email"] });
    const applicant = await User.findByPk(req.user.id, { attributes: ["id", "name", "email"] });

    // Create notification for job poster
    await Notification.create({
      userId: job.postedByUserId,
      type: "job.application.received",
      payload: {
        fromName:applicant?.name || "Someone",
        item_id: application.id,
        applicationId: application.id,
        applicantId: req.user.id,
        applicantName: applicant?.name || "Someone",
        jobId: job.id,
        jobTitle: job.title
      },
    });

    // Send email notification if enabled
    try {
      const isEnabled = true//await isEmailNotificationEnabled(job.postedByUserId, 'jobApplications');

      if (isEnabled) {
        const baseUrl = process.env.WEBSITE_URL || "https://54links.com";
        const link = `${baseUrl}/profile`; //`${baseUrl}/job/${job.id}/applications`;

        await sendTemplatedEmail({
          to: jobPoster.email,
          subject: `New Application for "${job.title}"`,
          template: "job-application-received",
          context: {
            name: jobPoster.name,
            applicantName: applicant?.name || "Someone",
            jobTitle: job.title,
            coverLetter: coverLetter?.substring(0, 200) + (coverLetter?.length > 200 ? "..." : ""),
            expectedSalary: expectedSalary || "Not specified",
            employmentType: employmentType || "Not specified",
            link
          }
        });
      }
    } catch (emailErr) {
      console.error("Failed to send job application email:", emailErr);
      // Continue even if email fails
    }

    await cache.deleteKeys([
             ["feed", "jobs", req.user.id]
    ]);
    await cache.deleteKeys([
           ["feed","all",req.user.id]
    ]);

    res.status(201).json({ application });
  } catch (err) {
    console.error("createApplication error", err);
    res.status(400).json({ message: err.message });
  }
};

exports.getApplicationsForJob = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const { jobId } = req.params;

    const job = await Job.findByPk(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    // Only job poster can view applications
    if (String(job.postedByUserId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const applications = await JobApplication.findAll({
      where: { jobId },
      include: [
        { association: "applicant", attributes: ["id", "name", "email"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json({ applications });
  } catch (err) {
    console.error("getApplicationsForJob error", err);
    res.status(400).json({ message: err.message });
  }
};

exports.getMyApplications = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const applications = await JobApplication.findAll({
      where: { userId: req.user.id },
      include: [
        {
          association: "job",
          attributes: ["id", "title", "companyName"],
          include: [{ association: "postedBy", attributes: ["id", "name"] }]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json({ applications });
  } catch (err) {
    console.error("getMyApplications error", err);
    res.status(400).json({ message: err.message });
  }
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { status } = req.body;

    const application = await JobApplication.findByPk(id, {
      include: [{ association: "job" }]
    });
    if (!application) return res.status(404).json({ message: "Application not found" });

    // Only job poster can update status
    if (String(application.job.postedByUserId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const oldStatus = application.status;
    await application.update({ status });

    // Send notifications and emails if status changed
    if (oldStatus !== status) {

      const applicant = await User.findByPk(application.userId, { attributes: ["id", "name", "email"] });
      const jobPoster = await User.findByPk(req.user.id, { attributes: ["id", "name", "email"] });

      // Create notification for applicant
      await Notification.create({

        userId: application.userId,
        type: `job.application.${status}`,
        payload: {
          item_id: application.id,
          applicationId: application.id,
          jobId: application.jobId,
          jobTitle: application.job.title,
          status: status,
          updatedBy: req.user.id
        },
      });

      // Send email notification if enabled
      try {
        const isEnabled = await isEmailNotificationEnabled(application.userId, 'jobApplicationUpdates');

         if (isEnabled) {
          const baseUrl = process.env.WEBSITE_URL || "https://54links.com";
          const link = `${baseUrl}/my-applications`;

          await sendTemplatedEmail({
            to: applicant.email,
            subject: `Update on Your Application for "${application.job.title}"`,
            template: "job-application-update",
            context: {
              name: applicant.name,
              jobTitle: application.job.title,
              accepted: status === 'accepted',
              message: `Your application has been ${status}`,
              link
            }
          });
        }
      } catch (emailErr) {
        console.error("Failed to send job application update email:", emailErr);
        // Continue even if email fails
      }
      
    }

    res.json({ application });
  } catch (err) {
    console.error("updateApplicationStatus error", err);
    res.status(400).json({ message: err.message });
  }
};