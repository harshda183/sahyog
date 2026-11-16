
import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const TOKEN_KEY = "sahyog_token";
async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}

const STORAGE = {
  accounts: "sahyog_accounts",
  user: "sahyog_user",
  courses: "sahyog_courses",
  feedback: "sahyog_feedback",
  checklist: "sahyog_checklist",
};

const INITIAL_COURSES = [
  {
    id: "math",
    title: "Introduction to Mathematics",
    category: "Mathematics",
    level: "Beginner",
    duration: "20 min",
    icon: "📐",
    progress: 0,
    description: "Build confidence with basic mathematical ideas.",
  },
  {
    id: "science",
    title: "Basics of Science",
    category: "Science",
    level: "Beginner",
    duration: "15 min",
    icon: "🔬",
    progress: 0,
    description: "Explore introductory science concepts step by step.",
  },
  {
    id: "english",
    title: "English Communication",
    category: "English",
    level: "Beginner",
    duration: "25 min",
    icon: "📖",
    progress: 0,
    description: "Practice clear and effective communication.",
  },
];

const CHECKS = [
  ["keyboard", "I can navigate using the Tab key."],
  ["focus", "I can see which control is focused."],
  ["contrast", "Text is readable with high contrast enabled."],
  ["text", "The page works with larger text enabled."],
  ["speech", "Text-to-speech can be played."],
  ["labels", "Forms have understandable labels."],
  ["mobile", "Navigation works on a narrow screen."],
];

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The app can still work during the current session.
  }
}

export default function App() {
  const [accounts, setAccounts] = useState(() =>
    readStorage(STORAGE.accounts, [])
  );

  const [user, setUser] = useState(() =>
    readStorage(STORAGE.user, null)
  );

  const [authMode, setAuthMode] = useState("register");

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [authMessage, setAuthMessage] = useState("");

  const [courses, setCourses] = useState(() =>
    readStorage(STORAGE.courses, INITIAL_COURSES)
  );

  const [page, setPage] = useState("Dashboard");
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [quizMessage, setQuizMessage] = useState("");

  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [checklist, setChecklist] = useState(() =>
    readStorage(STORAGE.checklist, {})
  );

  const [feedbackForm, setFeedbackForm] = useState({
    name: "",
    organisation: "",
    message: "",
  });

  const [feedbackStatus, setFeedbackStatus] = useState("");

  useEffect(() => saveStorage(STORAGE.accounts, accounts), [accounts]);
  useEffect(() => saveStorage(STORAGE.user, user), [user]);
  useEffect(() => saveStorage(STORAGE.courses, courses), [courses]);
  useEffect(() => saveStorage(STORAGE.checklist, checklist), [checklist]);
  useEffect(() => {
    if (!user || !localStorage.getItem(TOKEN_KEY)) return;
    apiRequest("/api/courses").then(setCourses).catch((error) => console.error(error.message));
    apiRequest("/api/checklist").then(setChecklist).catch((error) => console.error(error.message));
  }, [user]);
  useEffect(() => {
    if (!user || !localStorage.getItem(TOKEN_KEY)) return;
    apiRequest("/api/checklist", { method: "PUT", body: JSON.stringify(checklist) })
      .catch((error) => console.error(error.message));
  }, [checklist, user]);

  const selectedCourse = courses.find(
    (course) => course.id === selectedCourseId
  );

  const averageProgress = useMemo(() => {
    if (!courses.length) return 0;

    return Math.round(
      courses.reduce((sum, course) => sum + course.progress, 0) /
        courses.length
    );
  }, [courses]);

  const completedCourses = courses.filter(
    (course) => course.progress >= 100
  ).length;

  // TEXT TO SPEECH
  function speak(message) {
    if (!speechEnabled || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(message);
    speech.rate = 0.9;

    window.speechSynthesis.speak(speech);
  }

  function stopSpeech() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  // REGISTER AND LOGIN
  async function handleAuthentication(event) {
    event.preventDefault();
    setAuthMessage("");
    try {
      const endpoint = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const result = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({ name: authForm.name.trim(), email: authForm.email.trim().toLowerCase(), password: authForm.password }),
      });
      localStorage.setItem(TOKEN_KEY, result.token);
      setUser(result.user);
      setAuthForm({ name: "", email: "", password: "" });
      setPage("Dashboard");
    } catch (error) {
      setAuthMessage(error.message);
    }
  }

  async function logout() {
    stopSpeech();
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch {
      // End the local session even if the server is unavailable.
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setSelectedCourseId(null);
    setAuthMode("login");
    setPage("Dashboard");
    setAuthMessage("");
  }

  // OPEN COURSE
  function openCourse(course) {
    setSelectedCourseId(course.id);
    setSelectedAnswer("");
    setQuizMessage("");
    setPage("Lesson");
    setMobileMenuOpen(false);
  }

  // QUIZ AND PROGRESS
  function submitQuiz(event) {
    event.preventDefault();

    if (!selectedCourse || !selectedAnswer) return;

    if (selectedAnswer === "different") {
      setCourses((current) =>
        current.map((course) =>
          course.id === selectedCourse.id
            ? {
                ...course,
                progress: Math.min(100, course.progress + 10),
              }
            : course
        )
      );

      apiRequest(`/api/courses/${selectedCourse.id}/progress`, {
        method: "PATCH",
        body: JSON.stringify({ progress: Math.min(100, selectedCourse.progress + 10) }),
      }).catch((error) => console.error(error.message));

      setQuizMessage(
        "Correct! Your course progress increased by 10%."
      );

      speak("Correct. Your course progress has been updated.");
    } else {
      setQuizMessage(
        "Good try! Think about how different learners need different ways to access content."
      );
    }
  }

  // NGO FEEDBACK
  async function submitFeedback(event) {
    event.preventDefault();
    try {
      await apiRequest("/api/feedback", { method: "POST", body: JSON.stringify(feedbackForm) });
      setFeedbackForm({ name: "", organisation: "", message: "" });
      setFeedbackStatus("Thank you! Your feedback has been saved on the Sahyog server.");
    } catch (error) {
      setFeedbackStatus(error.message);
    }
  }

  const navigation = [
    ["Dashboard", "⌂"],
    ["My Learning", "▤"],
    ["Progress", "◷"],
    ["Accessibility", "♿"],
    ["About Sahyog", "ⓘ"],
    ["NGO Feedback", "✉"],
    ["Accessibility Test", "✓"],
  ];

  // LOGIN SCREEN
  if (!user) {
    return (
      <div
        className={`app auth-screen ${
          largeText ? "large-text" : ""
        } ${highContrast ? "high-contrast" : ""}`}
      >
        <section className="panel auth-card">
          <Brand />

          <p className="eyebrow">WELCOME TO SAHYOG</p>

          <h1>
            {authMode === "register"
              ? "Create your student account"
              : "Welcome back"}
          </h1>

          <p className="page-description">
            {authMode === "register"
              ? "Register to explore accessible learning."
              : "Log in using your demo account details."}
          </p>

          <form
            className="sahyog-form"
            onSubmit={handleAuthentication}
          >
            {authMode === "register" && (
              <label>
                Full name
                <input
                  value={authForm.name}
                  onChange={(event) =>
                    setAuthForm({
                      ...authForm,
                      name: event.target.value,
                    })
                  }
                  required
                />
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                value={authForm.email}
                onChange={(event) =>
                  setAuthForm({
                    ...authForm,
                    email: event.target.value,
                  })
                }
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm({
                    ...authForm,
                    password: event.target.value,
                  })
                }
                required
              />
            </label>

            <button className="primary-btn" type="submit">
              {authMode === "register"
                ? "Create account"
                : "Log in"}
            </button>
          </form>

          {authMessage && (
            <p className="form-message" role="alert">
              {authMessage}
            </p>
          )}

          <p className="auth-switch">
            {authMode === "register"
              ? "Already registered?"
              : "New to Sahyog?"}{" "}
            <button
              className="text-btn"
              type="button"
              onClick={() => {
                setAuthMode(
                  authMode === "register" ? "login" : "register"
                );
                setAuthMessage("");
              }}
            >
              {authMode === "register"
                ? "Log in"
                : "Create an account"}
            </button>
          </p>

          <p className="small-note">
            Demo only: account details are stored in this browser.
            Do not use a real or reused password.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div
      className={`app ${largeText ? "large-text" : ""} ${
        highContrast ? "high-contrast" : ""
      }`}
    >
      {/* SIDEBAR */}
      <aside
        className={`sidebar ${
          mobileMenuOpen ? "sidebar-open" : ""
        }`}
      >
        <Brand />

        <p className="nav-label">MAIN MENU</p>

        <nav aria-label="Main navigation">
          {navigation.map(([label, icon]) => (
            <button
              key={label}
              type="button"
              className={`nav-item ${
                page === label ? "active" : ""
              }`}
              onClick={() => {
                setPage(label);
                setSelectedCourseId(null);
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon" aria-hidden="true">
                {icon}
              </span>
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-help">
          <div className="help-icon">💬</div>
          <h3>Learning support</h3>
          <p>
            Take your time. You can learn at a pace that feels
            comfortable.
          </p>
          <button
            type="button"
            onClick={() =>
              speak(
                "Take your time. You can learn at a pace that feels comfortable."
              )
            }
          >
            Hear support message
          </button>
        </div>

        <div className="sidebar-bottom">
          <div className="avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{user.name}</strong>
            <span>Demo student</span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu"
              type="button"
              onClick={() =>
                setMobileMenuOpen((open) => !open)
              }
              aria-label="Toggle navigation"
            >
              ☰
            </button>

            <div>
              <p className="topbar-date">YOUR LEARNING SPACE</p>
              <h2>
                {page === "Lesson" ? "Learning lesson" : page}
              </h2>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              className="secondary-btn"
              type="button"
              onClick={() => setPage("Accessibility")}
            >
              ♿ Accessibility
            </button>

            <button
              className="secondary-btn"
              type="button"
              onClick={logout}
            >
              Log out
            </button>
          </div>
        </header>

        {/* DASHBOARD */}
        {page === "Dashboard" && (
          <section className="page-section">
            <div className="welcome-banner">
              <div className="welcome-copy">
                <span className="welcome-label">
                  WELCOME, {user.name.toUpperCase()}
                </span>

                <h1>
                  Every learner is unique.
                  <br />
                  So is your learning journey.
                </h1>

                <p>
                  Explore lessons, learn at your own pace, and
                  celebrate every step.
                </p>

                <button
                  className="welcome-btn"
                  type="button"
                  onClick={() => setPage("My Learning")}
                >
                  Explore my learning →
                </button>
              </div>

              <div className="welcome-art" aria-hidden="true">
                📚 ✦
              </div>
            </div>

            <div className="section-heading">
              <div>
                <p className="eyebrow">YOUR OVERVIEW</p>
                <h2>Your learning at a glance</h2>
              </div>

              <button
                className="text-btn"
                onClick={() => setPage("Progress")}
              >
                View progress →
              </button>
            </div>

            <div className="stats-grid">
              <StatCard
                icon="📚"
                value={courses.length}
                label="Courses started"
              />

              <StatCard
                icon="✓"
                value={completedCourses}
                label="Courses completed"
              />

              <StatCard
                icon="📈"
                value={`${averageProgress}%`}
                label="Average progress"
              />
            </div>

            <div className="section-heading">
              <div>
                <p className="eyebrow">CONTINUE LEARNING</p>
                <h2>Your courses</h2>
              </div>

              <button
                className="text-btn"
                onClick={() => setPage("My Learning")}
              >
                See all →
              </button>
            </div>

            <div className="course-grid">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onOpen={openCourse}
                />
              ))}
            </div>

            <div className="panel recommendation-panel">
              <p className="eyebrow">LEARNING SUGGESTION</p>
              <h2>Your next step</h2>
              <p>
                {courses.find((course) => course.progress < 100)
                  ?.description ||
                  "You have completed all sample courses. Great work!"}
              </p>
              <p className="small-note">
                Sample recommendation based on course status.
                This is not an AI-generated prediction.
              </p>
            </div>
          </section>
        )}

        {/* MY LEARNING */}
        {page === "My Learning" && (
          <section className="page-section">
            <p className="eyebrow">YOUR COURSES</p>
            <h1>My Learning</h1>
            <p className="page-description">
              Choose a course and continue at your own pace.
            </p>

            <div className="course-grid">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onOpen={openCourse}
                />
              ))}
            </div>
          </section>
        )}

        {/* LESSON */}
        {page === "Lesson" && selectedCourse && (
          <section className="page-section">
            <button
              className="back-btn"
              type="button"
              onClick={() => setPage("My Learning")}
            >
              ← Back to courses
            </button>

            <div className="lesson-header">
              <div>
                <p className="eyebrow">
                  {selectedCourse.category.toUpperCase()}
                </p>
                <h1>{selectedCourse.title}</h1>
                <p>{selectedCourse.description}</p>
              </div>

              <div className="lesson-icon">
                {selectedCourse.icon}
              </div>
            </div>

            <div className="panel lesson-content">
              <div className="lesson-toolbar">
                <span className="lesson-tag">SAMPLE LESSON</span>

                <button
                  className="secondary-btn"
                  type="button"
                  onClick={() =>
                    speak(
                      `${selectedCourse.title}. ${selectedCourse.description}. Learning is a journey. Take your time and review the topic.`
                    )
                  }
                >
                  🔊 Listen to lesson
                </button>
              </div>

              <h2>Learning at your own pace</h2>

              <p>
                Accessible learning means providing different
                ways for students to understand and interact with
                educational content. Some learners may prefer
                reading, while others may benefit from listening,
                visual explanations, or additional practice.
              </p>

              <div className="learning-note">
                <strong>Learning tip</strong>
                <p>
                  Use accessibility settings to adjust text size,
                  contrast, and text-to-speech.
                </p>
              </div>

              <h3>Check your understanding</h3>

              <p>
                Which approach can help make digital learning
                more accessible?
              </p>

              <form onSubmit={submitQuiz}>
                <div className="quiz-options">
                  <label className="quiz-option">
                    <input
                      type="radio"
                      name="quiz"
                      value="same"
                      checked={selectedAnswer === "same"}
                      onChange={(event) => {
                        setSelectedAnswer(event.target.value);
                        setQuizMessage("");
                      }}
                    />
                    <span>
                      Provide exactly the same method to every learner.
                    </span>
                  </label>

                  <label className="quiz-option">
                    <input
                      type="radio"
                      name="quiz"
                      value="different"
                      checked={selectedAnswer === "different"}
                      onChange={(event) => {
                        setSelectedAnswer(event.target.value);
                        setQuizMessage("");
                      }}
                    />
                    <span>
                      Offer different ways to access learning content.
                    </span>
                  </label>

                  <label className="quiz-option">
                    <input
                      type="radio"
                      name="quiz"
                      value="remove"
                      checked={selectedAnswer === "remove"}
                      onChange={(event) => {
                        setSelectedAnswer(event.target.value);
                        setQuizMessage("");
                      }}
                    />
                    <span>Remove accessibility support.</span>
                  </label>
                </div>

                <button
                  className="primary-btn"
                  type="submit"
                  disabled={!selectedAnswer}
                >
                  Submit answer
                </button>
              </form>

              {quizMessage && (
                <p className="quiz-feedback" role="status">
                  {quizMessage}
                </p>
              )}

              <p className="small-note">
                Course progress:{" "}
                {courses.find(
                  (course) => course.id === selectedCourse.id
                )?.progress ?? selectedCourse.progress}%
              </p>
            </div>
          </section>
        )}

        {/* PROGRESS */}
        {page === "Progress" && (
          <section className="page-section">
            <p className="eyebrow">YOUR ACHIEVEMENTS</p>
            <h1>Learning progress</h1>

            <p className="page-description">
              Your progress is stored in this browser for this demo.
            </p>

            <div className="stats-grid">
              <StatCard
                icon="📚"
                value={courses.length}
                label="Courses started"
              />

              <StatCard
                icon="✓"
                value={completedCourses}
                label="Courses completed"
              />

              <StatCard
                icon="📈"
                value={`${averageProgress}%`}
                label="Average progress"
              />
            </div>

            <div className="panel progress-panel">
              <h2>Course progress</h2>

              {courses.map((course) => (
                <ProgressRow key={course.id} course={course} />
              ))}
            </div>
          </section>
        )}

        {/* ACCESSIBILITY */}
        {page === "Accessibility" && (
          <section className="page-section">
            <p className="eyebrow">MAKE LEARNING COMFORTABLE</p>
            <h1>Accessibility settings</h1>

            <p className="page-description">
              Choose the settings that make this demonstration
              easier to use.
            </p>

            <div className="settings-grid">
              <SettingCard
                icon="🔠"
                title="Larger text"
                description="Increase text size across the app."
                checked={largeText}
                onChange={setLargeText}
              />

              <SettingCard
                icon="◐"
                title="High contrast"
                description="Strengthen text and background contrast."
                checked={highContrast}
                onChange={setHighContrast}
              />

              <SettingCard
                icon="🔊"
                title="Text-to-speech"
                description="Listen to supported lesson and help messages."
                checked={speechEnabled}
                onChange={(value) => {
                  setSpeechEnabled(value);
                  if (!value) stopSpeech();
                }}
              />
            </div>

            <div className="panel">
              <h2>Keyboard navigation</h2>
              <p>
                Use Tab to move between controls, Shift + Tab to
                move backwards, and Enter or Space to activate a
                focused button.
              </p>
            </div>

            <div className="panel">
              <h2>Try text-to-speech</h2>
              <p>Play a sample accessibility message.</p>

              <button
                className="primary-btn"
                type="button"
                onClick={() =>
                  speak(
                    "Welcome to Sahyog. Learning should be accessible to everyone."
                  )
                }
              >
                🔊 Listen to sample
              </button>

              <button
                className="secondary-btn"
                type="button"
                onClick={stopSpeech}
              >
                Stop audio
              </button>
            </div>

            <p className="small-note">
              Voice and gesture interaction are planned capabilities,
              not implemented in this frontend demonstration.
            </p>
          </section>
        )}

        {/* ABOUT */}
        {page === "About Sahyog" && (
          <section className="page-section">
            <p className="eyebrow">ABOUT THE PROJECT</p>
            <h1>About Sahyog</h1>

            <div className="panel">
              <h2>Learning for everyone</h2>

              <p>
                Sahyog is an adaptive e-learning platform concept
                designed to make digital education more accessible,
                inclusive, and personalized for students with visual,
                hearing, motor, and learning difficulties.
              </p>

              <h3>Problem we aim to address</h3>

              <p>
                Traditional e-learning platforms may rely on one
                standard way of reading, listening, and interacting.
                This can create barriers for students who need
                alternative ways to access information.
              </p>

              <h3>Our objectives</h3>

              <ul>
                <li>Provide accessible ways to use learning content.</li>
                <li>Support personalized learning pathways.</li>
                <li>Give feedback and educational guidance.</li>
                <li>Help students monitor their learning progress.</li>
              </ul>

              <h3>Technology stack</h3>

              <ul>
                <li>React 18 – Frontend</li>
                <li>Python Flask – Backend</li>
                <li>TensorFlow 2.x – Machine learning</li>
                <li>MongoDB – Database</li>
                <li>SpeechRecognition – Voice processing</li>
                <li>PyTesseract – Text extraction from images</li>
              </ul>

              <h3>Current prototype status</h3>

              <p>
                This frontend demonstrates sample login, courses,
                quizzes, browser-based progress, accessibility
                settings, and local feedback. Backend APIs, database
                integration, trained machine-learning models, OCR,
                and full voice or gesture interaction are not
                connected yet.
              </p>
            </div>
          </section>
        )}

        {/* NGO FEEDBACK */}
        {page === "NGO Feedback" && (
          <section className="page-section">
            <p className="eyebrow">HELP US IMPROVE</p>
            <h1>NGO feedback</h1>

            <p className="page-description">
              Share comments about Sahyog. Do not enter private
              student information.
            </p>

            <form
              className="panel sahyog-form"
              onSubmit={submitFeedback}
            >
              <label>
                Your name
                <input
                  value={feedbackForm.name}
                  onChange={(event) =>
                    setFeedbackForm({
                      ...feedbackForm,
                      name: event.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                NGO / organisation
                <input
                  value={feedbackForm.organisation}
                  onChange={(event) =>
                    setFeedbackForm({
                      ...feedbackForm,
                      organisation: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Feedback
                <textarea
                  rows="5"
                  value={feedbackForm.message}
                  onChange={(event) =>
                    setFeedbackForm({
                      ...feedbackForm,
                      message: event.target.value,
                    })
                  }
                  required
                  placeholder="What works well? What could be improved?"
                />
              </label>

              <button className="primary-btn" type="submit">
                Save feedback
              </button>

              {feedbackStatus && (
                <p className="form-message" role="status">
                  {feedbackStatus}
                </p>
              )}
            </form>

            <p className="small-note">
              Demo only: feedback is saved in this browser. It is
              not sent to an NGO or server.
            </p>
          </section>
        )}

        {/* ACCESSIBILITY TEST */}
        {page === "Accessibility Test" && (
          <section className="page-section">
            <p className="eyebrow">MANUAL REVIEW</p>
            <h1>Accessibility test checklist</h1>

            <p className="page-description">
              Try each item and tick it after checking. This is
              not an accessibility certification.
            </p>

            <div className="panel checklist-panel">
              {CHECKS.map(([id, label]) => (
                <label className="checklist-item" key={id}>
                  <input
                    type="checkbox"
                    checked={Boolean(checklist[id])}
                    onChange={(event) =>
                      setChecklist((current) => ({
                        ...current,
                        [id]: event.target.checked,
                      }))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}

              <p>
                <strong>
                  {CHECKS.filter(([id]) => checklist[id]).length} of{" "}
                  {CHECKS.length} checks completed
                </strong>
              </p>

              <button
                className="secondary-btn"
                type="button"
                onClick={() => setChecklist({})}
              >
                Reset checklist
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// BRAND
function Brand() {
  return (
    <div className="brand">
      <div className="brand-logo">S</div>
      <div>
        <h2>Sahyog</h2>
        <span>Learning for everyone</span>
      </div>
    </div>
  );
}

// COURSE CARD
function CourseCard({ course, onOpen }) {
  return (
    <article className="course-card">
      <div className="course-art">
        <span className="course-emoji">{course.icon}</span>
        <span className="course-level">{course.level}</span>
      </div>

      <div className="course-body">
        <span className="course-category">{course.category}</span>
        <h3>{course.title}</h3>
        <p>{course.description}</p>

        <div className="course-progress-label">
          <span>Progress</span>
          <strong>{course.progress}%</strong>
        </div>

        <div
          className="progress-track"
          role="progressbar"
          aria-label={`${course.title} progress`}
          aria-valuenow={course.progress}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            className="progress-fill"
            style={{ width: `${course.progress}%` }}
          />
        </div>

        <div className="course-footer">
          <span>◷ {course.duration}</span>
          <button type="button" onClick={() => onOpen(course)}>
            Open lesson →
          </button>
        </div>
      </div>
    </article>
  );
}

// STATISTICS CARD
function StatCard({ icon, value, label }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

// PROGRESS ROW
function ProgressRow({ course }) {
  return (
    <div className="progress-row">
      <div className="progress-row-top">
        <strong>{course.title}</strong>
        <span>{course.progress}%</span>
      </div>

      <div
        className="progress-track"
        role="progressbar"
        aria-label={`${course.title} progress`}
        aria-valuenow={course.progress}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          className="progress-fill"
          style={{ width: `${course.progress}%` }}
        />
      </div>
    </div>
  );
}

// ACCESSIBILITY SETTING
function SettingCard({
  icon,
  title,
  description,
  checked,
  onChange,
}) {
  return (
    <div className="panel setting-card">
      <div className="setting-icon" aria-hidden="true">
        {icon}
      </div>

      <div className="setting-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <label className="switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-label={title}
        />
        <span className="switch-slider" />
      </label>
    </div>
  );
}
