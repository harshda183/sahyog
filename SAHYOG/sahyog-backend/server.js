import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
app.use(express.json());

// MongoDB collections (Mongoose models)
const userSchema = new mongoose.Schema({
  _id: { type: String, default: () => crypto.randomUUID() },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true, versionKey: false });

const courseSchema = new mongoose.Schema({
  _id: String,
  title: { type: String, required: true },
  category: String,
  level: String,
  duration: String,
  icon: String,
  description: String,
}, { versionKey: false });

const progressSchema = new mongoose.Schema({
  _id: String, // userId:courseId
  userId: { type: String, required: true, index: true },
  courseId: { type: String, required: true },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  updatedAt: { type: Date, default: Date.now },
}, { versionKey: false });

const feedbackSchema = new mongoose.Schema({
  _id: { type: String, default: () => crypto.randomUUID() },
  name: { type: String, required: true, trim: true },
  organisation: { type: String, default: "" },
  message: { type: String, required: true, trim: true },
  userId: { type: String, required: true, index: true },
  submittedAt: { type: Date, default: Date.now },
}, { versionKey: false });

const checklistSchema = new mongoose.Schema({
  _id: String, // userId
  userId: { type: String, required: true, unique: true },
  answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now },
}, { versionKey: false });

const User = mongoose.model("User", userSchema);
const Course = mongoose.model("Course", courseSchema);
const Progress = mongoose.model("Progress", progressSchema);
const Feedback = mongoose.model("Feedback", feedbackSchema);
const Checklist = mongoose.model("Checklist", checklistSchema);

const initialCourses = [
  { _id: "math", title: "Introduction to Mathematics", category: "Mathematics", level: "Beginner", duration: "20 min", icon: "📐", description: "Build confidence with basic mathematical ideas." },
  { _id: "science", title: "Basics of Science", category: "Science", level: "Beginner", duration: "15 min", icon: "🔬", description: "Explore introductory science concepts step by step." },
  { _id: "english", title: "English Communication", category: "English", level: "Beginner", duration: "25 min", icon: "📖", description: "Practice clear and effective communication." },
];

const sessions = new Map();

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function passwordMatches(password, stored) {
  const [salt, original] = (stored || "").split(":");
  if (!salt || !original) return false;
  const check = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(check, Buffer.from(original, "hex"));
}
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const userId = sessions.get(token);
  if (!userId) return res.status(401).json({ message: "Please log in again." });
  req.userId = userId;
  next();
}

app.get("/api/health", (_req, res) => res.json({ status: "ok", message: "Sahyog backend is running" }));

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name?.trim() || !email?.trim() || !password || password.length < 6)
      return res.status(400).json({ message: "Name, valid email and password (minimum 6 characters) are required." });
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ message: "This email is already registered. Please log in." });
    const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash: hashPassword(password) });
    const token = crypto.randomUUID(); sessions.set(token, user._id);
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) { next(error); }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: String(email || "").trim().toLowerCase() });
    if (!user || !passwordMatches(password || "", user.passwordHash))
      return res.status(401).json({ message: "Incorrect email or password." });
    const token = crypto.randomUUID(); sessions.set(token, user._id);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) { next(error); }
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  sessions.delete(token);
  res.json({ message: "Logged out successfully." });
});

app.get("/api/courses", requireAuth, async (req, res, next) => {
  try {
    const [courses, progressRows] = await Promise.all([
      Course.find().lean(), Progress.find({ userId: req.userId }).lean(),
    ]);
    const progressByCourse = new Map(progressRows.map((row) => [row.courseId, row.progress]));
    res.json(courses.map((course) => ({ id: course._id, ...course, progress: progressByCourse.get(course._id) ?? 0 })));
  } catch (error) { next(error); }
});

app.patch("/api/courses/:id/progress", requireAuth, async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id).lean();
    if (!course) return res.status(404).json({ message: "Course not found." });
    const progress = Number(req.body?.progress);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100)
      return res.status(400).json({ message: "Progress must be between 0 and 100." });
    await Progress.findByIdAndUpdate(`${req.userId}:${req.params.id}`, {
      _id: `${req.userId}:${req.params.id}`, userId: req.userId, courseId: req.params.id, progress, updatedAt: new Date(),
    }, { upsert: true, new: true, runValidators: true });
    res.json({ id: course._id, ...course, progress });
  } catch (error) { next(error); }
});

app.get("/api/feedback", requireAuth, async (req, res, next) => {
  try {
    const items = await Feedback.find({ userId: req.userId }).sort({ submittedAt: -1 }).lean();
    res.json(items.map((item) => ({ id: item._id, ...item })));
  } catch (error) { next(error); }
});
app.post("/api/feedback", requireAuth, async (req, res, next) => {
  try {
    const { name, organisation, message } = req.body || {};
    if (!name?.trim() || !message?.trim())
      return res.status(400).json({ message: "Name and feedback message are required." });
    const item = await Feedback.create({ name: name.trim(), organisation: (organisation || "").trim(), message: message.trim(), userId: req.userId });
    res.status(201).json({ id: item._id, name: item.name, organisation: item.organisation, message: item.message, userId: item.userId, submittedAt: item.submittedAt.toISOString() });
  } catch (error) { next(error); }
});

app.get("/api/checklist", requireAuth, async (req, res, next) => {
  try {
    const record = await Checklist.findById(req.userId).lean();
    res.json(record?.answers || {});
  } catch (error) { next(error); }
});
app.put("/api/checklist", requireAuth, async (req, res, next) => {
  try {
    const answers = req.body || {};
    await Checklist.findByIdAndUpdate(req.userId, { _id: req.userId, userId: req.userId, answers, updatedAt: new Date() }, { upsert: true, new: true });
    res.json(answers);
  } catch (error) { next(error); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.code === 11000) return res.status(409).json({ message: "This email is already registered. Please log in." });
  res.status(500).json({ message: "Something went wrong on the server. Check the backend terminal for details." });
});

async function start() {
  if (!MONGODB_URI) {
    console.error("Missing MONGODB_URI. Create a .env file using .env.example and add your MongoDB connection string.");
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  await Course.bulkWrite(initialCourses.map((course) => ({ updateOne: { filter: { _id: course._id }, update: { $setOnInsert: course }, upsert: true } })));
  app.listen(PORT, () => console.log(`Sahyog backend running at http://localhost:${PORT} (MongoDB connected)`));
}

start().catch((error) => {
  console.error("Could not connect to MongoDB:", error.message);
  process.exit(1);
});
