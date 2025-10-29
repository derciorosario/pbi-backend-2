const { DataTypes } = require("sequelize");
const { makeSequelize } = require("../config/db");

const sequelize = makeSequelize();

/* ============ Initialize models ============ */
const User = require("./user")(sequelize, DataTypes);
const Profile = require("./profile")(sequelize, DataTypes);
const VerificationToken = require("./verificationToken")(sequelize, DataTypes);

const Category = require("./category")(sequelize, DataTypes);
const Subcategory = require("./subcategory")(sequelize, DataTypes);

const Goal = require("./goal")(sequelize, DataTypes);
const UserGoal = require("./userGoal")(sequelize, DataTypes);

const UserCategory = require("./userCategory")(sequelize, DataTypes);
const UserSubcategory = require("./userSubcategory")(sequelize, DataTypes);

const Job = require("./job")(sequelize, DataTypes);
const JobApplication = require("./jobApplication")(sequelize, DataTypes);
const Event = require("./event")(sequelize, DataTypes);
const EventRegistration = require("./eventRegistration")(sequelize, DataTypes);
const Service = require("./service")(sequelize, DataTypes);
const Product = require("./product")(sequelize, DataTypes);
const Tourism = require("./tourism")(sequelize, DataTypes);
const Funding = require("./funding")(sequelize, DataTypes);
const Message = require("./message")(sequelize, DataTypes);
const Conversation = require("./conversation")(sequelize, DataTypes);
const MeetingRequest = require("./meetingRequest")(sequelize, DataTypes);
const UserSettings = require("./userSettings")(sequelize, DataTypes);
const AdminSettings = require("./adminSettings")(sequelize, DataTypes);

const Moment = require("./moment")(sequelize, DataTypes);
const Need = require("./need")(sequelize, DataTypes);

const UserBlock = require("./userBlock")(sequelize, DataTypes);
const Report = require("./report")(sequelize, DataTypes);
const Contact = require("./contact")(sequelize, DataTypes);
const Support = require("./support")(sequelize, DataTypes);

// Portfolio models
const WorkSample = require("./workSample")(sequelize, DataTypes);
const Gallery = require("./gallery")(sequelize, DataTypes);
const MeetingParticipant= require("./MeetingParticipant")(sequelize, DataTypes);

// Social interaction models
const Like = require("./like")(sequelize, DataTypes);
const Comment = require("./comment")(sequelize, DataTypes);
const Repost = require("./repost")(sequelize, DataTypes);
/* ============ Associations ============ */
// User ↔ Profile (1:1)
User.hasOne(Profile, { foreignKey: "userId", as: "profile", onDelete: "CASCADE" });
Profile.belongsTo(User, { foreignKey: "userId", as: "user" });

// Profile ↔ WorkSample (1:N)
Profile.hasMany(WorkSample, { foreignKey: "profileId", as: "workSamples", onDelete: "CASCADE" });
WorkSample.belongsTo(Profile, { foreignKey: "profileId", as: "profile" });

// Profile ↔ Gallery (1:N)
Profile.hasMany(Gallery, { foreignKey: "profileId", as: "gallery", onDelete: "CASCADE" });
Gallery.belongsTo(Profile, { foreignKey: "profileId", as: "profile" });

// User ↔ UserSettings (1:1)
User.hasOne(UserSettings, { foreignKey: "userId", as: "settings", onDelete: "CASCADE" });
UserSettings.belongsTo(User, { foreignKey: "userId", as: "user" });

// VerificationToken ↔ User (1:N)
VerificationToken.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(VerificationToken, { foreignKey: "userId", as: "verificationTokens" });

// Category ↔ Subcategory (1:N)
Category.hasMany(Subcategory, { foreignKey: "categoryId", as: "subcategories", onDelete: "CASCADE" });
Subcategory.belongsTo(Category, { foreignKey: "categoryId", as: "category" });

// User ↔ Goal (M:N via UserGoal)
User.belongsToMany(Goal, { through: UserGoal, foreignKey: "userId", as: "goals" });
Goal.belongsToMany(User, { through: UserGoal, foreignKey: "goalId", as: "users" });

// User ↔ Category (M:N via UserCategory)
User.belongsToMany(Category, { through: UserCategory, foreignKey: "userId", otherKey: "categoryId", as: "categories" });
Category.belongsToMany(User, { through: UserCategory, foreignKey: "categoryId", otherKey: "userId", as: "users" });

// User ↔ Subcategory (M:N via UserSubcategory)
User.belongsToMany(Subcategory, { through: UserSubcategory, foreignKey: "userId", otherKey: "subcategoryId", as: "subcategories" });
Subcategory.belongsToMany(User, { through: UserSubcategory, foreignKey: "subcategoryId", otherKey: "userId", as: "users" });

// User 1:N UserCategory (lista "interests" com cat/subcat resolvidos)
User.hasMany(UserCategory, { as: "interests", foreignKey: "userId" });
UserCategory.belongsTo(User, { as: "user", foreignKey: "userId" });
UserCategory.belongsTo(Category, { as: "category", foreignKey: "categoryId" });
UserCategory.belongsTo(Subcategory, { as: "subcategory", foreignKey: "subcategoryId" });

// User 1:N UserSubcategory (for direct access to user's subcategories)
User.hasMany(UserSubcategory, { as: "userSubcategories", foreignKey: "userId" });
UserSubcategory.belongsTo(User, { as: "user", foreignKey: "userId" });
UserSubcategory.belongsTo(Subcategory, { as: "subcategory", foreignKey: "subcategoryId" });


// Job posting
User.hasMany(Job, { foreignKey: "postedByUserId", as: "jobs" });
Job.belongsTo(User, { foreignKey: "postedByUserId", as: "postedBy" });

Job.belongsTo(Category,    { as: "category",    foreignKey: "categoryId" });
Job.belongsTo(Subcategory, { as: "subcategory", foreignKey: "subcategoryId" });

// Job applications
User.hasMany(JobApplication, { foreignKey: "userId", as: "jobApplications" });
JobApplication.belongsTo(User, { foreignKey: "userId", as: "applicant" });
Job.hasMany(JobApplication, { foreignKey: "jobId", as: "applications" });
JobApplication.belongsTo(Job, { foreignKey: "jobId", as: "job" });

// Event registrations
User.hasMany(EventRegistration, { foreignKey: "userId", as: "eventRegistrations" });
EventRegistration.belongsTo(User, { foreignKey: "userId", as: "registrant" });
Event.hasMany(EventRegistration, { foreignKey: "eventId", as: "registrations" });
EventRegistration.belongsTo(Event, { foreignKey: "eventId", as: "event" });

// Event
User.hasMany(Event, { foreignKey: "organizerUserId", as: "events" });
Event.belongsTo(User, { foreignKey: "organizerUserId", as: "organizer" });

Event.belongsTo(Category,    { foreignKey: "categoryId",    as: "category" });
Event.belongsTo(Subcategory, { foreignKey: "subcategoryId", as: "subcategory" });

// Service
User.hasMany(Service, { foreignKey: "providerUserId", as: "services" });
Service.belongsTo(User, { foreignKey: "providerUserId", as: "provider" });

Service.belongsTo(Category, { foreignKey: "categoryId", as: "category" });
Service.belongsTo(Subcategory, { foreignKey: "subcategoryId", as: "subcategory" });

// Product
User.hasMany(Product, { foreignKey: "sellerUserId", as: "products" });
Product.belongsTo(User, { foreignKey: "sellerUserId", as: "seller" });

// Tourism
User.hasMany(Tourism, { foreignKey: "authorUserId", as: "tourismPosts" });
Tourism.belongsTo(User, { foreignKey: "authorUserId", as: "author" });

// Funding
User.hasMany(Funding, { foreignKey: "creatorUserId", as: "fundingProjects" });
Funding.belongsTo(User, { foreignKey: "creatorUserId", as: "creator" });
Funding.belongsTo(Category, { foreignKey: "categoryId", as: "category" });

// Moment
User.hasMany(Moment, { foreignKey: "userId", as: "moments" });
// Note: Moment.belongsTo(User) is defined in Moment.associate


const Connection        = require("./connection")(sequelize, DataTypes);
const ConnectionRequest = require("./connectionRequest")(sequelize, DataTypes);
const Notification      = require("./notification")(sequelize, DataTypes);

// Message associations
Message.belongsTo(User, { as: "sender", foreignKey: "senderId" });
Message.belongsTo(User, { as: "receiver", foreignKey: "receiverId" });
User.hasMany(Message, { as: "sentMessages", foreignKey: "senderId" });
User.hasMany(Message, { as: "receivedMessages", foreignKey: "receiverId" });

// Conversation associations
Conversation.belongsTo(User, { as: "user1", foreignKey: "user1Id" });
Conversation.belongsTo(User, { as: "user2", foreignKey: "user2Id" });
User.hasMany(Conversation, { as: "conversationsAsUser1", foreignKey: "user1Id" });
User.hasMany(Conversation, { as: "conversationsAsUser2", foreignKey: "user2Id" });


User.hasMany(ConnectionRequest, { foreignKey: "fromUserId", as: "sentRequests" });
User.hasMany(ConnectionRequest, { foreignKey: "toUserId",   as: "receivedRequests" });

User.hasMany(Connection, { foreignKey: "userOneId", as: "connectionsAsOne" });
User.hasMany(Connection, { foreignKey: "userTwoId", as: "connectionsAsTwo" });

Notification.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(Notification,   { foreignKey: "userId", as: "notifications" });

// Meeting Request associations
MeetingRequest.belongsTo(User, { foreignKey: "fromUserId", as: "requester" });
MeetingRequest.belongsTo(User, { foreignKey: "toUserId", as: "recipient" });
User.hasMany(MeetingRequest, { foreignKey: "fromUserId", as: "sentMeetingRequests" });
User.hasMany(MeetingRequest, { foreignKey: "toUserId", as: "receivedMeetingRequests" });


// For requests preview includes
ConnectionRequest.belongsTo(User, { as: "from", foreignKey: "fromUserId" });
ConnectionRequest.belongsTo(User, { as: "to", foreignKey: "toUserId" });
User.hasMany(ConnectionRequest, { as: "incomingRequests", foreignKey: "toUserId" });
User.hasMany(ConnectionRequest, { as: "outgoingRequests", foreignKey: "fromUserId" });

// Social interaction associations
// Like associations
Like.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(Like, { foreignKey: "userId", as: "likes" });

// Comment associations
Comment.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(Comment, { foreignKey: "userId", as: "comments" });
Comment.hasMany(Comment, { foreignKey: "parentCommentId", as: "replies" });
Comment.belongsTo(Comment, { foreignKey: "parentCommentId", as: "parentComment" });

// Repost associations
Repost.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(Repost, { foreignKey: "userId", as: "reposts" });

// Report associations
if (Report.associate) {
  Report.associate({ User });
}

// For connections
// (no strict includes needed; we query by ids)
const Identity           = require("./identity")(sequelize, DataTypes);
const UserIdentity       = require("./userIdentity")(sequelize, DataTypes);
const SubsubCategory     = require("./subsubCategory")(sequelize, DataTypes);
const UserSubsubCategory = require("./userSubsubCategory")(sequelize, DataTypes);

// Identities (M:N)
User.belongsToMany(Identity, { through: UserIdentity, as: "identities", foreignKey: "userId", otherKey: "identityId" });
Identity.belongsToMany(User, { through: UserIdentity, as: "users", foreignKey: "identityId", otherKey: "userId" });

// Level-3 taxonomy
Subcategory.hasMany(SubsubCategory, { as: "subsubs", foreignKey: "subcategoryId", onDelete: "CASCADE" });
SubsubCategory.belongsTo(Subcategory, { as: "subcategory", foreignKey: "subcategoryId" });

//Category.hasMany(SubsubCategory, { as: "subsubs", foreignKey: "categoryId", onDelete: "CASCADE" });
//SubsubCategory.belongsTo(Category, { as: "category", foreignKey: "categoryId" });

// User ↔ SubsubCategory (M:N)
User.belongsToMany(SubsubCategory, { through: UserSubsubCategory, as: "subsubcategories", foreignKey: "userId", otherKey: "subsubCategoryId" });
SubsubCategory.belongsToMany(User, { through: UserSubsubCategory, as: "users", foreignKey: "subsubCategoryId", otherKey: "userId" });

// UserSubsubCategory associations
UserSubsubCategory.belongsTo(User, { foreignKey: "userId", as: "user" });
UserSubsubCategory.belongsTo(SubsubCategory, { foreignKey: "subsubCategoryId", as: "subsubCategory" });
User.hasMany(UserSubsubCategory, { foreignKey: "userId", as: "userSubsubCategories" });

// Jobs / Events / Services (optional level-3 link)
Job.belongsTo(SubsubCategory,   { as: "subsubCategory", foreignKey: "subsubCategoryId" });
Event.belongsTo(SubsubCategory, { as: "subsubCategory", foreignKey: "subsubCategoryId" });
Service.belongsTo(SubsubCategory, { as: "subsubCategory", foreignKey: "subsubCategoryId" });

Identity.hasMany(Category, { foreignKey: "identityId", as: "categories", onDelete: "RESTRICT" });
Category.belongsTo(Identity, { foreignKey: "identityId", as: "identity" });


const JobIdentity       = require("./JobIdentity")(sequelize, DataTypes);
const JobCategory       = require("./JobCategory")(sequelize, DataTypes);
const JobSubcategory    = require("./JobSubcategory")(sequelize, DataTypes);
const JobSubsubCategory = require("./jobSubsubCategory")(sequelize, DataTypes);


const GeneralCategory = require("./GeneralCategory")(sequelize, DataTypes);
const GeneralSubcategory = require("./GeneralSubcategory")(sequelize, DataTypes);
const GeneralSubsubCategory = require("./GeneralSubsubCategory")(sequelize, DataTypes);


// Event audience association models
const EventIdentity       = require("./EventIdentity")(sequelize, DataTypes);
const EventCategory       = require("./EventCategory")(sequelize, DataTypes);
const EventSubcategory    = require("./EventSubcategory")(sequelize, DataTypes);
const EventSubsubCategory = require("./EventSubsubCategory")(sequelize, DataTypes);

// Service audience association models
const ServiceIdentity       = require("./ServiceIdentity")(sequelize, DataTypes);
const ServiceCategory       = require("./ServiceCategory")(sequelize, DataTypes);
const ServiceSubcategory    = require("./ServiceSubcategory")(sequelize, DataTypes);
const ServiceSubsubCategory = require("./ServiceSubsubCategory")(sequelize, DataTypes);

// Product audience association models
const ProductIdentity       = require("./ProductIdentity")(sequelize, DataTypes);
const ProductCategory       = require("./ProductCategory")(sequelize, DataTypes);
const ProductSubcategory    = require("./ProductSubcategory")(sequelize, DataTypes);
const ProductSubsubCategory = require("./ProductSubsubCategory")(sequelize, DataTypes);

// Tourism audience association models
const TourismIdentity       = require("./TourismIdentity")(sequelize, DataTypes);
const TourismCategory       = require("./TourismCategory")(sequelize, DataTypes);
const TourismSubcategory    = require("./TourismSubcategory")(sequelize, DataTypes);
const TourismSubsubCategory = require("./TourismSubsubCategory")(sequelize, DataTypes);

// Funding audience association models
const FundingIdentity       = require("./FundingIdentity")(sequelize, DataTypes);
const FundingCategory       = require("./FundingCategory")(sequelize, DataTypes);
const FundingSubcategory    = require("./FundingSubcategory")(sequelize, DataTypes);
const FundingSubsubCategory = require("./FundingSubsubCategory")(sequelize, DataTypes);

// Moment audience association models
const MomentIdentity       = require("./MomentIdentity")(sequelize, DataTypes);
const MomentCategory       = require("./MomentCategory")(sequelize, DataTypes);
const MomentSubcategory    = require("./MomentSubcategory")(sequelize, DataTypes);
const MomentSubsubCategory = require("./MomentSubsubCategory")(sequelize, DataTypes);

// Need audience association models
const NeedIdentity       = require("./NeedIdentity")(sequelize, DataTypes);
const NeedCategory       = require("./NeedCategory")(sequelize, DataTypes);
const NeedSubcategory    = require("./NeedSubcategory")(sequelize, DataTypes);
const NeedSubsubCategory = require("./NeedSubsubCategory")(sequelize, DataTypes);


// Interest join-tables (what the user is looking for)
const UserIdentityInterest       = require("./userIdentityInterest")(sequelize, DataTypes);
const UserCategoryInterest       = require("./userCategoryInterest")(sequelize, DataTypes);
const UserSubcategoryInterest    = require("./userSubcategoryInterest")(sequelize, DataTypes);
const UserSubsubCategoryInterest = require("./userSubsubCategoryInterest")(sequelize, DataTypes);




Job.belongsToMany(Identity, {
  through: JobIdentity,
  foreignKey: "jobId",
  otherKey: "identityId",
  as: "audienceIdentities",
});
Identity.belongsToMany(Job, {
  through: JobIdentity,
  foreignKey: "identityId",
  otherKey: "jobId",
  as: "jobs",
});

Job.belongsToMany(Category, {
  through: JobCategory,
  foreignKey: "jobId",
  otherKey: "categoryId",
  as: "audienceCategories",
});
Category.belongsToMany(Job, {
  through: JobCategory,
  foreignKey: "categoryId",
  otherKey: "jobId",
  as: "jobs",
});

Job.belongsToMany(Subcategory, {
  through: JobSubcategory,
  foreignKey: "jobId",
  otherKey: "subcategoryId",
  as: "audienceSubcategories",
});
Subcategory.belongsToMany(Job, {
  through: JobSubcategory,
  foreignKey: "subcategoryId",
  otherKey: "jobId",
  as: "jobs",
});

Job.belongsToMany(SubsubCategory, {
  through: JobSubsubCategory,
  foreignKey: "jobId",
  otherKey: "subsubCategoryId",
  as: "audienceSubsubs",
});
SubsubCategory.belongsToMany(Job, {
  through: JobSubsubCategory,
  foreignKey: "subsubCategoryId",
  otherKey: "jobId",
  as: "jobs",
});

// Add belongsTo associations for through tables
JobIdentity.belongsTo(Job, { foreignKey: "jobId" });
JobIdentity.belongsTo(Identity, { foreignKey: "identityId" });

JobCategory.belongsTo(Job, { foreignKey: "jobId" });
JobCategory.belongsTo(Category, { foreignKey: "categoryId" });

JobSubcategory.belongsTo(Job, { foreignKey: "jobId" });
JobSubcategory.belongsTo(Subcategory, { foreignKey: "subcategoryId" });

JobSubsubCategory.belongsTo(Job, { foreignKey: "jobId" });
JobSubsubCategory.belongsTo(SubsubCategory, { foreignKey: "subsubCategoryId" });

// Event audience associations
Event.belongsToMany(Identity, {
  through: EventIdentity,
  foreignKey: "eventId",
  otherKey: "identityId",
  as: "audienceIdentities",
});
Identity.belongsToMany(Event, {
  through: EventIdentity,
  foreignKey: "identityId",
  otherKey: "eventId",
  as: "events",
});

// Add belongsTo associations for through tables
EventIdentity.belongsTo(Event, { foreignKey: "eventId" });
EventIdentity.belongsTo(Identity, { foreignKey: "identityId" });

Event.belongsToMany(Category, {
  through: EventCategory,
  foreignKey: "eventId",
  otherKey: "categoryId",
  as: "audienceCategories",
});
Category.belongsToMany(Event, {
  through: EventCategory,
  foreignKey: "categoryId",
  otherKey: "eventId",
  as: "events",
});

// Add belongsTo associations for through tables
EventCategory.belongsTo(Event, { foreignKey: "eventId" });
EventCategory.belongsTo(Category, { foreignKey: "categoryId" });

Event.belongsToMany(Subcategory, {
  through: EventSubcategory,
  foreignKey: "eventId",
  otherKey: "subcategoryId",
  as: "audienceSubcategories",
});
Subcategory.belongsToMany(Event, {
  through: EventSubcategory,
  foreignKey: "subcategoryId",
  otherKey: "eventId",
  as: "events",
});

// Add belongsTo associations for through tables
EventSubcategory.belongsTo(Event, { foreignKey: "eventId" });
EventSubcategory.belongsTo(Subcategory, { foreignKey: "subcategoryId" });

Event.belongsToMany(SubsubCategory, {
  through: EventSubsubCategory,
  foreignKey: "eventId",
  otherKey: "subsubCategoryId",
  as: "audienceSubsubs",
});
SubsubCategory.belongsToMany(Event, {
  through: EventSubsubCategory,
  foreignKey: "subsubCategoryId",
  otherKey: "eventId",
  as: "events",
});

// Add belongsTo associations for through tables
EventSubsubCategory.belongsTo(Event, { foreignKey: "eventId" });
EventSubsubCategory.belongsTo(SubsubCategory, { foreignKey: "subsubCategoryId" });

// Service audience associations
Service.belongsToMany(Identity, {
  through: "service_identities",
  foreignKey: "serviceId",
  otherKey: "identityId",
  as: "audienceIdentities",
});
Identity.belongsToMany(Service, {
  through: "service_identities",
  foreignKey: "identityId",
  otherKey: "serviceId",
  as: "services",
});

Service.belongsToMany(Category, {
  through: "service_categories",
  foreignKey: "serviceId",
  otherKey: "categoryId",
  as: "audienceCategories",
});
Category.belongsToMany(Service, {
  through: "service_categories",
  foreignKey: "categoryId",
  otherKey: "serviceId",
  as: "services",
});

Service.belongsToMany(Subcategory, {
  through: "service_subcategories",
  foreignKey: "serviceId",
  otherKey: "subcategoryId",
  as: "audienceSubcategories",
});
Subcategory.belongsToMany(Service, {
  through: "service_subcategories",
  foreignKey: "subcategoryId",
  otherKey: "serviceId",
  as: "services",
});

Service.belongsToMany(SubsubCategory, {
  through: "service_subsubcategories",
  foreignKey: "serviceId",
  otherKey: "subsubCategoryId",
  as: "audienceSubsubs",
});
SubsubCategory.belongsToMany(Service, {
  through: "service_subsubcategories",
  foreignKey: "subsubCategoryId",
  otherKey: "serviceId",
  as: "services",
});

// Product audience associations
Product.belongsToMany(Identity, {
  through: "product_identities",
  foreignKey: "productId",
  otherKey: "identityId",
  as: "audienceIdentities",
});
Identity.belongsToMany(Product, {
  through: "product_identities",
  foreignKey: "identityId",
  otherKey: "productId",
  as: "products",
});

Product.belongsToMany(Category, {
  through: "product_categories",
  foreignKey: "productId",
  otherKey: "categoryId",
  as: "audienceCategories",
});
Category.belongsToMany(Product, {
  through: "product_categories",
  foreignKey: "categoryId",
  otherKey: "productId",
  as: "products",
});

Product.belongsToMany(Subcategory, {
  through: "product_subcategories",
  foreignKey: "productId",
  otherKey: "subcategoryId",
  as: "audienceSubcategories",
});
Subcategory.belongsToMany(Product, {
  through: "product_subcategories",
  foreignKey: "subcategoryId",
  otherKey: "productId",
  as: "products",
});

Product.belongsToMany(SubsubCategory, {
  through: "product_subsubcategories",
  foreignKey: "productId",
  otherKey: "subsubCategoryId",
  as: "audienceSubsubs",
});
SubsubCategory.belongsToMany(Product, {
  through: "product_subsubcategories",
  foreignKey: "subsubCategoryId",
  otherKey: "productId",
  as: "products",
});

// Add belongsTo associations for through tables
ProductIdentity.belongsTo(Product, { foreignKey: "productId" });
ProductIdentity.belongsTo(Identity, { foreignKey: "identityId" });

ProductCategory.belongsTo(Product, { foreignKey: "productId" });
ProductCategory.belongsTo(Category, { foreignKey: "categoryId" });

ProductSubcategory.belongsTo(Product, { foreignKey: "productId" });
ProductSubcategory.belongsTo(Subcategory, { foreignKey: "subcategoryId" });

ProductSubsubCategory.belongsTo(Product, { foreignKey: "productId" });
ProductSubsubCategory.belongsTo(SubsubCategory, { foreignKey: "subsubCategoryId" });

// Add belongsTo associations for service through tables
ServiceIdentity.belongsTo(Service, { foreignKey: "serviceId" });
ServiceIdentity.belongsTo(Identity, { foreignKey: "identityId" });

ServiceCategory.belongsTo(Service, { foreignKey: "serviceId" });
ServiceCategory.belongsTo(Category, { foreignKey: "categoryId" });

ServiceSubcategory.belongsTo(Service, { foreignKey: "serviceId" });
ServiceSubcategory.belongsTo(Subcategory, { foreignKey: "subcategoryId" });

ServiceSubsubCategory.belongsTo(Service, { foreignKey: "serviceId" });
ServiceSubsubCategory.belongsTo(SubsubCategory, { foreignKey: "subsubCategoryId" });

// Add belongsTo associations for tourism through tables
TourismIdentity.belongsTo(Tourism, { foreignKey: "tourismId" });
TourismIdentity.belongsTo(Identity, { foreignKey: "identityId" });

TourismCategory.belongsTo(Tourism, { foreignKey: "tourismId" });
TourismCategory.belongsTo(Category, { foreignKey: "categoryId" });

TourismSubcategory.belongsTo(Tourism, { foreignKey: "tourismId" });
TourismSubcategory.belongsTo(Subcategory, { foreignKey: "subcategoryId" });

TourismSubsubCategory.belongsTo(Tourism, { foreignKey: "tourismId" });
TourismSubsubCategory.belongsTo(SubsubCategory, { foreignKey: "subsubCategoryId" });

// Add belongsTo associations for funding through tables
FundingIdentity.belongsTo(Funding, { foreignKey: "fundingId" });
FundingIdentity.belongsTo(Identity, { foreignKey: "identityId" });

FundingCategory.belongsTo(Funding, { foreignKey: "fundingId" });
FundingCategory.belongsTo(Category, { foreignKey: "categoryId" });

FundingSubcategory.belongsTo(Funding, { foreignKey: "fundingId" });
FundingSubcategory.belongsTo(Subcategory, { foreignKey: "subcategoryId" });

FundingSubsubCategory.belongsTo(Funding, { foreignKey: "fundingId" });
FundingSubsubCategory.belongsTo(SubsubCategory, { foreignKey: "subsubCategoryId" });

// Add belongsTo associations for moment through tables
MomentIdentity.belongsTo(Moment, { foreignKey: "momentId" });
MomentIdentity.belongsTo(Identity, { foreignKey: "identityId" });

MomentCategory.belongsTo(Moment, { foreignKey: "momentId" });
MomentCategory.belongsTo(Category, { foreignKey: "categoryId" });

MomentSubcategory.belongsTo(Moment, { foreignKey: "momentId" });
MomentSubcategory.belongsTo(Subcategory, { foreignKey: "subcategoryId" });

MomentSubsubCategory.belongsTo(Moment, { foreignKey: "momentId" });
MomentSubsubCategory.belongsTo(SubsubCategory, { foreignKey: "subsubCategoryId" });

// Add belongsTo associations for need through tables
NeedIdentity.belongsTo(Need, { foreignKey: "needId" });
NeedIdentity.belongsTo(Identity, { foreignKey: "identityId" });

NeedCategory.belongsTo(Need, { foreignKey: "needId" });
NeedCategory.belongsTo(Category, { foreignKey: "categoryId" });

NeedSubcategory.belongsTo(Need, { foreignKey: "needId" });
NeedSubcategory.belongsTo(Subcategory, { foreignKey: "subcategoryId" });

NeedSubsubCategory.belongsTo(Need, { foreignKey: "needId" });
NeedSubsubCategory.belongsTo(SubsubCategory, { foreignKey: "subsubCategoryId" });


// Tourism audience associations
Tourism.belongsToMany(Identity, {
  through: {
    model: "tourism_identities",
    timestamps: false
  },
  foreignKey: "tourismId",
  otherKey: "identityId",
  as: "audienceIdentities",
});
Identity.belongsToMany(Tourism, {
  through: {
    model: "tourism_identities",
    timestamps: false
  },
  foreignKey: "identityId",
  otherKey: "tourismId",
  as: "tourismPosts",
});

Tourism.belongsToMany(Category, {
  through: {
    model: "tourism_categories",
    timestamps: false
  },
  foreignKey: "tourismId",
  otherKey: "categoryId",
  as: "audienceCategories",
});
Category.belongsToMany(Tourism, {
  through: {
    model: "tourism_categories",
    timestamps: false
  },
  foreignKey: "categoryId",
  otherKey: "tourismId",
  as: "tourismPosts",
});

Tourism.belongsToMany(Subcategory, {
  through: {
    model: "tourism_subcategories",
    timestamps: false
  },
  foreignKey: "tourismId",
  otherKey: "subcategoryId",
  as: "audienceSubcategories",
});
Subcategory.belongsToMany(Tourism, {
  through: {
    model: "tourism_subcategories",
    timestamps: false
  },
  foreignKey: "subcategoryId",
  otherKey: "tourismId",
  as: "tourismPosts",
});

Tourism.belongsToMany(SubsubCategory, {
  through: {
    model: "tourism_subsubcategories",
    timestamps: false
  },
  foreignKey: "tourismId",
  otherKey: "subsubCategoryId",
  as: "audienceSubsubs",
});
SubsubCategory.belongsToMany(Tourism, {
  through: {
    model: "tourism_subsubcategories",
    timestamps: false
  },
  foreignKey: "subsubCategoryId",
  otherKey: "tourismId",
  as: "tourismPosts",
});

// Funding audience associations
Funding.belongsToMany(Identity, {
  through: {
    model: "funding_identities",
    timestamps: false
  },
  foreignKey: "fundingId",
  otherKey: "identityId",
  as: "audienceIdentities",
});
Identity.belongsToMany(Funding, {
  through: {
    model: "funding_identities",
    timestamps: false
  },
  foreignKey: "identityId",
  otherKey: "fundingId",
  as: "fundingProjects",
});

Funding.belongsToMany(Category, {
  through: {
    model: "funding_categories",
    timestamps: false
  },
  foreignKey: "fundingId",
  otherKey: "categoryId",
  as: "audienceCategories",
});
Category.belongsToMany(Funding, {
  through: {
    model: "funding_categories",
    timestamps: false
  },
  foreignKey: "categoryId",
  otherKey: "fundingId",
  as: "fundingProjects",
});

Funding.belongsToMany(Subcategory, {
  through: {
    model: "funding_subcategories",
    timestamps: false
  },
  foreignKey: "fundingId",
  otherKey: "subcategoryId",
  as: "audienceSubcategories",
});
Subcategory.belongsToMany(Funding, {
  through: {
    model: "funding_subcategories",
    timestamps: false
  },
  foreignKey: "subcategoryId",
  otherKey: "fundingId",
  as: "fundingProjects",
});

Funding.belongsToMany(SubsubCategory, {
  through: {
    model: "funding_subsubcategories",
    timestamps: false
  },
  foreignKey: "fundingId",
  otherKey: "subsubCategoryId",
  as: "audienceSubsubs",
});
SubsubCategory.belongsToMany(Funding, {
  through: {
    model: "funding_subsubcategories",
    timestamps: false
  },
  foreignKey: "subsubCategoryId",
  otherKey: "fundingId",
  as: "fundingProjects",
});

// Moment audience associations
Moment.belongsToMany(Identity, {
  through: {
    model: "moment_identities",
    timestamps: false
  },
  foreignKey: "momentId",
  otherKey: "identityId",
  as: "audienceIdentities",
});
Identity.belongsToMany(Moment, {
  through: {
    model: "moment_identities",
    timestamps: false
  },
  foreignKey: "identityId",
  otherKey: "momentId",
  as: "moments",
});

Moment.belongsToMany(Category, {
  through: {
    model: "moment_categories",
    timestamps: false
  },
  foreignKey: "momentId",
  otherKey: "categoryId",
  as: "audienceCategories",
});
Category.belongsToMany(Moment, {
  through: {
    model: "moment_categories",
    timestamps: false
  },
  foreignKey: "categoryId",
  otherKey: "momentId",
  as: "moments",
});

Moment.belongsToMany(Subcategory, {
  through: {
    model: "moment_subcategories",
    timestamps: false
  },
  foreignKey: "momentId",
  otherKey: "subcategoryId",
  as: "audienceSubcategories",
});
Subcategory.belongsToMany(Moment, {
  through: {
    model: "moment_subcategories",
    timestamps: false
  },
  foreignKey: "subcategoryId",
  otherKey: "momentId",
  as: "moments",
});

Moment.belongsToMany(SubsubCategory, {
  through: {
    model: "moment_subsubcategories",
    timestamps: false
  },
  foreignKey: "momentId",
  otherKey: "subsubCategoryId",
  as: "audienceSubsubs",
});
SubsubCategory.belongsToMany(Moment, {
  through: {
    model: "moment_subsubcategories",
    timestamps: false
  },
  foreignKey: "subsubCategoryId",
  otherKey: "momentId",
  as: "moments",
});

// Need audience associations
Need.belongsToMany(Identity, {
  through: {
    model: "need_identities",
    timestamps: false
  },
  foreignKey: "needId",
  otherKey: "identityId",
  as: "audienceIdentities",
});
Identity.belongsToMany(Need, {
  through: {
    model: "need_identities",
    timestamps: false
  },
  foreignKey: "identityId",
  otherKey: "needId",
  as: "needs",
});

Need.belongsToMany(Category, {
  through: {
    model: "need_categories",
    timestamps: false
  },
  foreignKey: "needId",
  otherKey: "categoryId",
  as: "audienceCategories",
});
Category.belongsToMany(Need, {
  through: {
    model: "need_categories",
    timestamps: false
  },
  foreignKey: "categoryId",
  otherKey: "needId",
  as: "needs",
});

Need.belongsToMany(Subcategory, {
  through: {
    model: "need_subcategories",
    timestamps: false
  },
  foreignKey: "needId",
  otherKey: "subcategoryId",
  as: "audienceSubcategories",
});
Subcategory.belongsToMany(Need, {
  through: {
    model: "need_subcategories",
    timestamps: false
  },
  foreignKey: "subcategoryId",
  otherKey: "needId",
  as: "needs",
});

Need.belongsToMany(SubsubCategory, {
  through: {
    model: "need_subsubcategories",
    timestamps: false
  },
  foreignKey: "needId",
  otherKey: "subsubCategoryId",
  as: "audienceSubsubs",
});
SubsubCategory.belongsToMany(Need, {
  through: {
    model: "need_subsubcategories",
    timestamps: false
  },
  foreignKey: "subsubCategoryId",
  otherKey: "needId",
  as: "needs",
});




// GeneralCategory ↔ GeneralSubcategory
GeneralCategory.hasMany(GeneralSubcategory, {
  foreignKey: "generalCategoryId",
  as: "subcategories",
  onDelete: "CASCADE",
});
GeneralSubcategory.belongsTo(GeneralCategory, {
  foreignKey: "generalCategoryId",
  as: "category",
});

// GeneralSubcategory ↔ GeneralSubsubCategory
GeneralSubcategory.hasMany(GeneralSubsubCategory, {
  foreignKey: "generalSubcategoryId",
  as: "subsubcategories",
  onDelete: "CASCADE",
});
GeneralSubsubCategory.belongsTo(GeneralSubcategory, {
  foreignKey: "generalSubcategoryId",
  as: "subcategory",
});




/***
 * // Jobs ↔ General taxonomy
Job.belongsTo(GeneralCategory, { as: "generalCategory", foreignKey: "generalCategoryId" });
Job.belongsTo(GeneralSubcategory, { as: "generalSubcategory", foreignKey: "generalSubcategoryId" });
Job.belongsTo(GeneralSubsubCategory, { as: "generalSubsubCategory", foreignKey: "generalSubsubCategoryId" });

// Events ↔ General taxonomy
Event.belongsTo(GeneralCategory, { as: "generalCategory", foreignKey: "generalCategoryId" });
Event.belongsTo(GeneralSubcategory, { as: "generalSubcategory", foreignKey: "generalSubcategoryId" });
Event.belongsTo(GeneralSubsubCategory, { as: "generalSubsubCategory", foreignKey: "generalSubsubCategoryId" });

// Services ↔ General taxonomy
Service.belongsTo(GeneralCategory, { as: "generalCategory", foreignKey: "generalCategoryId" });
Service.belongsTo(GeneralSubcategory, { as: "generalSubcategory", foreignKey: "generalSubcategoryId" });
Service.belongsTo(GeneralSubsubCategory, { as: "generalSubsubCategory", foreignKey: "generalSubsubCategoryId" });

// Products ↔ General taxonomy
Product.belongsTo(GeneralCategory, { as: "generalCategory", foreignKey: "generalCategoryId" });
Product.belongsTo(GeneralSubcategory, { as: "generalSubcategory", foreignKey: "generalSubcategoryId" });
Product.belongsTo(GeneralSubsubCategory, { as: "generalSubsubCategory", foreignKey: "generalSubsubCategoryId" });

// Tourism ↔ General taxonomy
Tourism.belongsTo(GeneralCategory, { as: "generalCategory", foreignKey: "generalCategoryId" });
Tourism.belongsTo(GeneralSubcategory, { as: "generalSubcategory", foreignKey: "generalSubcategoryId" });
Tourism.belongsTo(GeneralSubsubCategory, { as: "generalSubsubCategory", foreignKey: "generalSubsubCategoryId" });

// Funding ↔ General taxonomy
Funding.belongsTo(GeneralCategory, { as: "generalCategory", foreignKey: "generalCategoryId" });
Funding.belongsTo(GeneralSubcategory, { as: "generalSubcategory", foreignKey: "generalSubcategoryId" });
Funding.belongsTo(GeneralSubsubCategory, { as: "generalSubsubCategory", foreignKey: "generalSubsubCategoryId" });

 */




// General taxonomy ↔ All main content types
const attachGeneralTaxonomy = (Model) => {
  Model.belongsTo(GeneralCategory, {
    as: "generalCategory",
    foreignKey: { name: "generalCategoryId", allowNull: true },
    onDelete: "SET NULL",
  });
  Model.belongsTo(GeneralSubcategory, {
    as: "generalSubcategory",
    foreignKey: { name: "generalSubcategoryId", allowNull: true },
    onDelete: "SET NULL",
  });
  Model.belongsTo(GeneralSubsubCategory, {
    as: "generalSubsubCategory",
    foreignKey: { name: "generalSubsubCategoryId", allowNull: true },
    onDelete: "SET NULL",
  });
};

// Attach to all main models
attachGeneralTaxonomy(Job);
attachGeneralTaxonomy(Event);
attachGeneralTaxonomy(Service);
attachGeneralTaxonomy(Product);
attachGeneralTaxonomy(Tourism);
attachGeneralTaxonomy(Funding);
attachGeneralTaxonomy(Moment);
attachGeneralTaxonomy(Need);







// --- Interest associations (optional but nice to have) ---
User.hasMany(UserIdentityInterest, { as: "identityInterests", foreignKey: "userId", onDelete: "CASCADE" });
UserIdentityInterest.belongsTo(User, { as: "user", foreignKey: "userId" });
UserIdentityInterest.belongsTo(Identity, { as: "identity", foreignKey: "identityId" });

User.hasMany(UserCategoryInterest, { as: "categoryInterests", foreignKey: "userId", onDelete: "CASCADE" });
UserCategoryInterest.belongsTo(User, { as: "user", foreignKey: "userId" });
UserCategoryInterest.belongsTo(Category, { as: "category", foreignKey: "categoryId" });

User.hasMany(UserSubcategoryInterest, { as: "subcategoryInterests", foreignKey: "userId", onDelete: "CASCADE" });
UserSubcategoryInterest.belongsTo(User, { as: "user", foreignKey: "userId" });
UserSubcategoryInterest.belongsTo(Subcategory, { as: "subcategory", foreignKey: "subcategoryId" });

User.hasMany(UserSubsubCategoryInterest, { as: "subsubInterests", foreignKey: "userId", onDelete: "CASCADE" });
UserSubsubCategoryInterest.belongsTo(User, { as: "user", foreignKey: "userId" });
UserSubsubCategoryInterest.belongsTo(SubsubCategory, { as: "subsubCategory", foreignKey: "subsubCategoryId" });

// Company management models
const CompanyRepresentative = require("./companyRepresentative")(sequelize, DataTypes);
const CompanyStaff = require("./companyStaff")(sequelize, DataTypes);
const CompanyInvitation = require("./companyInvitation")(sequelize, DataTypes);

// Organization join request model
const OrganizationJoinRequest = require("./organizationJoinRequest")(sequelize, DataTypes);

// Company management associations
// CompanyInvitation associations
CompanyInvitation.belongsTo(User, { foreignKey: "companyId", as: "company" });
CompanyInvitation.belongsTo(User, { foreignKey: "invitedUserId", as: "invitedUser" });
CompanyInvitation.belongsTo(User, { foreignKey: "invitedBy", as: "inviter" });
User.hasMany(CompanyInvitation, { foreignKey: "companyId", as: "companyInvitations" });
User.hasMany(CompanyInvitation, { foreignKey: "invitedUserId", as: "receivedInvitations" });
User.hasMany(CompanyInvitation, { foreignKey: "invitedBy", as: "sentInvitations" });

// CompanyRepresentative associations
CompanyRepresentative.belongsTo(User, { foreignKey: "companyId", as: "company" });
CompanyRepresentative.belongsTo(User, { foreignKey: "representativeId", as: "representative" });
CompanyRepresentative.belongsTo(User, { foreignKey: "authorizedBy", as: "authorizer" });
CompanyRepresentative.belongsTo(User, { foreignKey: "revokedBy", as: "revoker" });
User.hasMany(CompanyRepresentative, { foreignKey: "companyId", as: "companyRepresentatives" });
User.hasMany(CompanyRepresentative, { foreignKey: "representativeId", as: "representativeOf" });
User.hasMany(CompanyRepresentative, { foreignKey: "authorizedBy", as: "authorizedRepresentatives" });
User.hasMany(CompanyRepresentative, { foreignKey: "revokedBy", as: "revokedRepresentatives" });

// CompanyStaff associations
CompanyStaff.belongsTo(User, { foreignKey: "companyId", as: "company" });
CompanyStaff.belongsTo(User, { foreignKey: "staffId", as: "staff" });
CompanyStaff.belongsTo(User, { foreignKey: "invitedBy", as: "inviter" });
CompanyStaff.belongsTo(User, { foreignKey: "removedBy", as: "remover" });
User.hasMany(CompanyStaff, { foreignKey: "companyId", as: "companyStaff" });
User.hasMany(CompanyStaff, { foreignKey: "staffId", as: "staffOf" });
User.hasMany(CompanyStaff, { foreignKey: "invitedBy", as: "invitedStaff" });
User.hasMany(CompanyStaff, { foreignKey: "removedBy", as: "removedStaff" });

// Organization Join Request associations
OrganizationJoinRequest.belongsTo(User, { foreignKey: "organizationId", as: "organization" });
OrganizationJoinRequest.belongsTo(User, { foreignKey: "userId", as: "user" });
OrganizationJoinRequest.belongsTo(User, { foreignKey: "cancelledBy", as: "cancelledByUser" });
OrganizationJoinRequest.belongsTo(User, { foreignKey: "approvedBy", as: "approvedByUser" });
User.hasMany(OrganizationJoinRequest, { foreignKey: "organizationId", as: "organizationJoinRequests" });
User.hasMany(OrganizationJoinRequest, { foreignKey: "userId", as: "joinRequests" });
User.hasMany(OrganizationJoinRequest, { foreignKey: "cancelledBy", as: "cancelledJoinRequests" });
User.hasMany(OrganizationJoinRequest, { foreignKey: "approvedBy", as: "approvedJoinRequests" });

// Organization membership associations are now handled through CompanyStaff model

const IndustryCategory = require("./IndustryCategory")(sequelize, DataTypes);
const IndustrySubcategory = require("./IndustrySubcategory")(sequelize, DataTypes);
const IndustrySubsubCategory = require("./IndustrySubsubCategory")(sequelize, DataTypes);


// IndustryCategory ↔ IndustrySubcategory
IndustryCategory.hasMany(IndustrySubcategory, {
  foreignKey: "industryCategoryId",
  as: "subcategories",
  onDelete: "CASCADE",
});
IndustrySubcategory.belongsTo(IndustryCategory, {
  foreignKey: "industryCategoryId",
  as: "category",
});

// IndustrySubcategory ↔ IndustrySubsubCategory
IndustrySubcategory.hasMany(IndustrySubsubCategory, {
  foreignKey: "industrySubcategoryId",
  as: "subsubs",
  onDelete: "CASCADE",
});
IndustrySubsubCategory.belongsTo(IndustrySubcategory, {
  foreignKey: "industrySubcategoryId",
  as: "subcategory",
});


const attachIndustryTaxonomy = (Model) => {
  Model.belongsTo(IndustryCategory, {
    as: "industryCategory",
    foreignKey: { name: "industryCategoryId", allowNull: true },
    onDelete: "SET NULL",
  });
  Model.belongsTo(IndustrySubcategory, {
    as: "industrySubcategory",
    foreignKey: { name: "industrySubcategoryId", allowNull: true },
    onDelete: "SET NULL",
  });
  Model.belongsTo(IndustrySubsubCategory, {
    as: "industrySubsubCategory",
    foreignKey: { name: "industrySubsubCategoryId", allowNull: true },
    onDelete: "SET NULL",
  });
};

// Attach to all main entities
attachIndustryTaxonomy(Job);
attachIndustryTaxonomy(Event);
attachIndustryTaxonomy(Service);
attachIndustryTaxonomy(Product);
attachIndustryTaxonomy(Tourism);
attachIndustryTaxonomy(Funding);
attachIndustryTaxonomy(Moment);
attachIndustryTaxonomy(Need);


const UserIndustryCategory = require("./userIndustryCategory")(sequelize, DataTypes);
const UserIndustrySubcategory = require("./userIndustrySubcategory")(sequelize, DataTypes);
const UserIndustrySubsubCategory = require("./userIndustrySubsubCategory")(sequelize, DataTypes);


// User ↔ IndustryCategory (M:N)
User.belongsToMany(IndustryCategory, {
  through: UserIndustryCategory,
  as: "industryCategories",
  foreignKey: "userId",
  otherKey: "industryCategoryId",
  uniqueKey: false, // 👈 stop Sequelize from making its own long unique key
});

IndustryCategory.belongsToMany(User, {
  through: UserIndustryCategory,
  as: "users",
  foreignKey: "industryCategoryId",
  otherKey: "userId",
  uniqueKey: false, // 👈 same here
});


// User ↔ IndustrySubcategory (M:N)
User.belongsToMany(IndustrySubcategory, {
  through: UserIndustrySubcategory,
  foreignKey: "userId",
  otherKey: "industrySubcategoryId",
  as: "industrySubcategories",
});
IndustrySubcategory.belongsToMany(User, {
  through: UserIndustrySubcategory,
  foreignKey: "industrySubcategoryId",
  otherKey: "userId",
  as: "users",
});

User.belongsToMany(IndustrySubsubCategory, {
  through: "user_industry_subsubcategories",
  as: "industrySubsubCategories",
  foreignKey: "userId",
  otherKey: "industrySubsubCategoryId",
  uniqueKey: false, // ✅ stop Sequelize from naming it too long
});

IndustrySubsubCategory.belongsToMany(User, {
  through: "user_industry_subsubcategories",
  as: "users",
  foreignKey: "industrySubsubCategoryId",
  otherKey: "userId",
  uniqueKey: false,
});


// Call associate methods for models that have them
if (Connection.associate) {
  Connection.associate({ User });
}

if (Job.associate) {
  Job.associate({ User });
}

if (UserIdentity.associate) {
  UserIdentity.associate({ User, Identity });
}

if (UserGoal.associate) {
  UserGoal.associate({ User, Goal });
}

if (Need.associate) {
  Need.associate({
    User,
    Category,
    Subcategory,
    SubsubCategory,
    Identity,
    Comment,
    IndustryCategory,
    IndustrySubcategory,
    IndustrySubsubCategory,
  });
}

if (Moment.associate) {
  Moment.associate({
    User,
    Category,
    Subcategory,
    SubsubCategory,
    IndustryCategory,
    IndustrySubcategory,
    IndustrySubsubCategory,
    Comment,
  });
}

// MeetingRequest ↔ MeetingParticipant associations
MeetingRequest.hasMany(MeetingParticipant, { 
  foreignKey: "meetingRequestId", 
  as: "participants",
  onDelete: 'CASCADE'
});
MeetingParticipant.belongsTo(MeetingRequest, { 
  foreignKey: "meetingRequestId", 
  as: "meetingRequest"
});

// MeetingParticipant ↔ User associations  
MeetingParticipant.belongsTo(User, { 
  foreignKey: "userId", 
  as: "user"
});
User.hasMany(MeetingParticipant, { 
  foreignKey: "userId", 
  as: "meetingParticipants"
});

module.exports = {
   UserIdentityInterest,
  UserCategoryInterest,
  UserSubcategoryInterest,
  UserSubsubCategoryInterest,

  UserIndustryCategory,
  UserIndustrySubcategory,
  UserIndustrySubsubCategory,


  IndustryCategory,
  IndustrySubcategory,
  IndustrySubsubCategory,


  Category,
  Subcategory,
  UserCategory,
  UserSubcategory, UserSubsubCategory,
  Identity, UserIdentity,
  Connection,
  ConnectionRequest,
  Notification,
  SubsubCategory,
  sequelize,
  User,
  Profile,
  VerificationToken,
 
  Goal,
  UserGoal,
  Event,
  EventRegistration,
  Job,
  JobApplication,
  // Export job audience association models
  JobIdentity,
  JobCategory,
  JobSubcategory,
  JobSubsubCategory,
  Message,
  Conversation,
  // Export event audience association models
  EventIdentity,
  EventCategory,
  EventSubcategory,
  EventSubsubCategory,
  // Export service model and audience association models
  Service,
  ServiceIdentity,
  ServiceCategory,
  ServiceSubcategory,
  ServiceSubsubCategory,
  // Export product model and audience association models
  Product,
  ProductIdentity,
  ProductCategory,
  ProductSubcategory,
  ProductSubsubCategory,
  // Export tourism model and audience association models
  Tourism,
  TourismIdentity,
  TourismCategory,
  TourismSubcategory,
  TourismSubsubCategory,
  // Export funding model and audience association models
  Funding,
  FundingIdentity,
  FundingCategory,
  FundingSubcategory,
  FundingSubsubCategory,
  // Export moment model and audience association models
  Moment,
  MomentIdentity,
  MomentCategory,
  MomentSubcategory,
  MomentSubsubCategory,
  // Export need model and audience association models
  Need,
  NeedIdentity,
  NeedCategory,
  NeedSubcategory,
  NeedSubsubCategory,
  // Export meeting request model
  MeetingRequest,
  // Export user settings model
  UserSettings,
  AdminSettings,
  Report,
  UserBlock,
  Contact,
  Support,
  // Portfolio models
  WorkSample,
  Gallery,

  MeetingParticipant,

  // Social interaction models
  Like,
  Comment,
  Repost,

  GeneralCategory,
  GeneralSubcategory,
  GeneralSubsubCategory,

  // Company management models
  CompanyRepresentative,
  CompanyStaff,
  CompanyInvitation,

  // Organization join request model
  OrganizationJoinRequest,
};
