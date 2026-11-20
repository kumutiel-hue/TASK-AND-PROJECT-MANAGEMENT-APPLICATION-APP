import React, { useEffect, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ClipboardList,
  Code2,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  LogOut,
  MoreHorizontal,
  Palette,
  Plus,
  Rocket,
  Search,
  Settings,
  Users,
  Wrench,
} from "lucide-react";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");
function apiFetch(url, options = {}) {
  return fetch(url, { ...options, credentials: "include" });
}

const SETTINGS_STORAGE_KEY = "taskflow-settings";
const NOTIFICATION_READ_STORAGE_KEY = "taskflow-read-notifications";
const DEFAULT_SETTINGS = {
  profile: { name: "John Doe", email: "" },
  weekStartsOn: "Monday",
  compactView: false,
  darkMode: false,
  notifications: {
    taskAssignments: true,
    dueDateReminders: true,
    projectUpdates: true,
    weeklySummary: false,
  },
};

const primaryNavigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Projects", icon: FolderKanban },
  { label: "Tasks", icon: ListTodo },
  { label: "Calendar", icon: CalendarDays },
];

const secondaryNavigation = [
  { label: "Notifications", icon: Bell },
  { label: "Team", icon: Users },
  { label: "Settings", icon: Settings },
];

const projectLifecycleStages = [
  {
    title: "Requirement Analysis",
    description: "Capture user needs, scope, and constraints.",
    icon: ClipboardList,
  },
  {
    title: "Planning",
    description: "Sequence work, assign owners, and set milestones.",
    icon: CalendarDays,
  },
  {
    title: "UI Design",
    description: "Create and review user flows and interface designs.",
    icon: Palette,
  },
  {
    title: "Development",
    description: "Build and integrate the planned features.",
    icon: Code2,
  },
  {
    title: "Testing",
    description: "Validate behavior, quality, and readiness.",
    icon: FlaskConical,
  },
  {
    title: "Deployment",
    description: "Release the tested project to its users.",
    icon: Rocket,
  },
  {
    title: "Maintenance",
    description: "Monitor, support, and improve after launch.",
    icon: Wrench,
  },
];

function getProjectLifecycleStageProgress(projectProgress, stageIndex) {
  const progress = Math.max(0, Math.min(100, Number(projectProgress) || 0));
  const stageProgress = (progress / 100) * projectLifecycleStages.length - stageIndex;
  return Math.round(Math.max(0, Math.min(1, stageProgress)) * 100);
}

const navigationPaths = {
  Dashboard: "dashboard",
  Projects: "projects",
  Tasks: "tasks",
  Calendar: "calendar",
  Notifications: "notifications",
  Team: "team",
  Settings: "settings",
  Login: "login",
  Register: "register",
};

function readNavigationRoute(hash) {
  const segments = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (segments[0] === "projects" && segments[1]) {
    return { page: "Project Details", projectId: segments[1], invitationToken: "" };
  }
  if (segments[0] === "register") {
    return { page: "Register", projectId: null, invitationToken: segments[1] || "" };
  }
  const page = Object.keys(navigationPaths).find((label) => navigationPaths[label] === segments[0]);
  return { page: page || "Dashboard", projectId: null, invitationToken: "" };
}

function Avatar({ initials, color = "avatar-purple", small = false }) {
  return <span className={`avatar ${color}${small ? " avatar-small" : ""}`}>{initials}</span>;
}

function SectionHeading({ title, action }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

function AppFooter({ auth = false }) {
  return (
    <footer className={`app-footer${auth ? " auth-footer" : ""}`}>
      <span>© {new Date().getFullYear()} NexaFlow</span>
      <span>Next-generation workflow management</span>
    </footer>
  );
}

function formatProjectDate(value) {
  if (!value) return "Not set";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatCalendarDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCalendarDateLabel(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function daysUntilDate(value) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date - today) / 86400000);
}

function formatFileSize(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function App() {
  const [activePage, setActivePage] = useState(() => readNavigationRoute(window.location.hash).page);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentWorkspaceName, setCurrentWorkspaceName] = useState("Acme Workspace");
  const [invitationToken, setInvitationToken] = useState(() => readNavigationRoute(window.location.hash).invitationToken);
  const [authChecking, setAuthChecking] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authEmailNotice, setAuthEmailNotice] = useState("");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsFeedback, setSettingsFeedback] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState("");
  const [readNotificationIds, setReadNotificationIds] = useState([]);
  const [notificationStorageError, setNotificationStorageError] = useState("");
  const [serverNotifications, setServerNotifications] = useState([]);
  const [serverNotificationsLoading, setServerNotificationsLoading] = useState(false);
  const [serverNotificationsError, setServerNotificationsError] = useState("");
  const [notificationFilter, setNotificationFilter] = useState("All");
  const [apiStatus, setApiStatus] = useState({ state: "checking", message: "" });
  const [query, setQuery] = useState("");
  const searchInputRef = useRef(null);
  const [projectsData, setProjectsData] = useState([]);
  const [tasksData, setTasksData] = useState([]);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => formatCalendarDateKey(new Date()));
  const [calendarEventsData, setCalendarEventsData] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [calendarEventModal, setCalendarEventModal] = useState(false);
  const [editingCalendarEventId, setEditingCalendarEventId] = useState(null);
  const [calendarEventForm, setCalendarEventForm] = useState({
    title: "",
    description: "",
    date: formatCalendarDateKey(new Date()),
    kind: "Meeting",
  });
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [projectModal, setProjectModal] = useState(null);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(() => readNavigationRoute(window.location.hash).projectId);
  const [projectDetails, setProjectDetails] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectDetailsTab, setProjectDetailsTab] = useState("Overview");
  const [projectDetailsLoading, setProjectDetailsLoading] = useState(false);
  const [projectDetailsError, setProjectDetailsError] = useState("");
  const [projectActivity, setProjectActivity] = useState([]);
  const [projectActivityLoading, setProjectActivityLoading] = useState(false);
  const [projectActivityError, setProjectActivityError] = useState("");
  const [projectFiles, setProjectFiles] = useState([]);
  const [projectFilesLoading, setProjectFilesLoading] = useState(false);
  const [projectFilesError, setProjectFilesError] = useState("");
  const [projectFileUploading, setProjectFileUploading] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamAccounts, setTeamAccounts] = useState([]);
  const [teamAccountsError, setTeamAccountsError] = useState("");
  const [teamInvitations, setTeamInvitations] = useState([]);
  const [teamFeedback, setTeamFeedback] = useState("");
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [teamModal, setTeamModal] = useState(false);
  const [editingTeamMemberId, setEditingTeamMemberId] = useState(null);
  const [teamForm, setTeamForm] = useState({
    name: "",
    email: "",
    role: "Team Member",
  });
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [tasksLoadFailed, setTasksLoadFailed] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [taskModal, setTaskModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskProjectFilter, setTaskProjectFilter] = useState("");
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    project: "",
    status: "To Do",
    priority: "Medium",
    assignee: "",
    assigneeUser: "",
    dueDate: "",
  });
  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    status: "Planning",
    priority: "Medium",
    manager: "",
    teamMembers: [],
    startDate: "",
    dueDate: "",
    progress: 0,
  });

  const navigateTo = (page, projectId = null) => {
    const destination = page === "Project Details"
      ? `#/projects/${projectId}`
      : page === "Register" && projectId
        ? `#/register/${projectId}`
      : `#/${navigationPaths[page]}`;
    if (window.location.hash !== destination) {
      window.history.pushState({ page, projectId }, "", destination);
    }
    setActivePage(page);
    setSelectedProjectId(page === "Project Details" ? projectId : null);
    setInvitationToken(page === "Register" ? projectId || "" : "");
  };

  useEffect(() => {
    const handleSearchShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch(`${API_BASE_URL}/api/auth/me`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error(`Could not check the current session (${response.status})`);
        return response.json();
      })
      .then((body) => {
        if (!controller.signal.aborted && body?.user) {
          setCurrentUser(body.user);
          setCurrentWorkspaceName(body.workspace?.name || "Acme Workspace");
          setSettings((current) => ({
            ...current,
            profile: { name: body.user.name, email: body.user.email },
            notifications: body.user.notificationPreferences || current.notifications,
          }));
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setAuthError(error.message || "Could not check the current session");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setAuthChecking(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (currentUser && (activePage === "Login" || activePage === "Register")) {
      window.history.replaceState({ page: "Dashboard" }, "", "#/dashboard");
      setActivePage("Dashboard");
      setSelectedProjectId(null);
    }
  }, [activePage, currentUser]);

  useEffect(() => {
    if (!authChecking && !currentUser && activePage !== "Login" && activePage !== "Register") {
      navigateTo("Login");
    }
  }, [activePage, authChecking, currentUser]);

  useEffect(() => {
    const syncNavigation = () => {
      const route = readNavigationRoute(window.location.hash);
      const canonicalHash = route.page === "Project Details"
        ? `#/projects/${route.projectId}`
        : `#/${navigationPaths[route.page]}`;
      if (window.location.hash !== canonicalHash) {
        window.history.replaceState(window.history.state, "", canonicalHash);
      }
      setActivePage(route.page);
      setSelectedProjectId(route.projectId);
      setInvitationToken(route.invitationToken);
      setProjectDetails(null);
      setProjectTasks([]);
      setProjectDetailsError("");
    };

    syncNavigation();
    window.addEventListener("popstate", syncNavigation);
    window.addEventListener("hashchange", syncNavigation);
    return () => {
      window.removeEventListener("popstate", syncNavigation);
      window.removeEventListener("hashchange", syncNavigation);
    };
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Saved settings have an invalid format.");
        }
        const savedProfile = parsed.profile && typeof parsed.profile === "object" ? parsed.profile : {};
        const savedNotifications = parsed.notifications && typeof parsed.notifications === "object"
          ? parsed.notifications
          : {};
        setSettings({
          profile: {
            name: typeof savedProfile.name === "string" ? savedProfile.name : DEFAULT_SETTINGS.profile.name,
            email: typeof savedProfile.email === "string" ? savedProfile.email : DEFAULT_SETTINGS.profile.email,
          },
          weekStartsOn: parsed.weekStartsOn === "Sunday" ? "Sunday" : "Monday",
          compactView: parsed.compactView === true,
          darkMode: parsed.darkMode === true,
          notifications: {
            taskAssignments: typeof savedNotifications.taskAssignments === "boolean"
              ? savedNotifications.taskAssignments
              : DEFAULT_SETTINGS.notifications.taskAssignments,
            dueDateReminders: typeof savedNotifications.dueDateReminders === "boolean"
              ? savedNotifications.dueDateReminders
              : DEFAULT_SETTINGS.notifications.dueDateReminders,
            projectUpdates: typeof savedNotifications.projectUpdates === "boolean"
              ? savedNotifications.projectUpdates
              : DEFAULT_SETTINGS.notifications.projectUpdates,
            weeklySummary: typeof savedNotifications.weeklySummary === "boolean"
              ? savedNotifications.weeklySummary
              : DEFAULT_SETTINGS.notifications.weeklySummary,
          },
        });
      }
    } catch (error) {
      setSettingsError(`Could not load saved settings: ${error.message || "Browser storage is unavailable."}`);
    } finally {
      setSettingsLoaded(true);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
          throw new Error("Saved notification state has an invalid format.");
        }
        setReadNotificationIds(parsed);
      }
    } catch (error) {
      setNotificationStorageError(`Could not load notification state: ${error.message || "Browser storage is unavailable."}`);
    }
  }, []);

  const updateSettings = (updates) => {
    setSettings((current) => ({ ...current, ...updates }));
    setSettingsError("");
    setSettingsFeedback("");
  };

  const updateCurrentUser = (updates) => {
    setCurrentUser((user) => ({ ...user, ...updates }));
    setSettingsError("");
    setSettingsFeedback("");
  };

  const updatePasswordForm = (updates) => {
    setPasswordForm((form) => ({ ...form, ...updates }));
    setPasswordError("");
    setPasswordFeedback("");
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    const registering = activePage === "Register";
    setAuthError("");
    setAuthEmailNotice("");
    if (registering && authForm.password !== authForm.confirmPassword) {
      setAuthError("The passwords do not match.");
      return;
    }

    setAuthBusy(true);
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/api/auth/${registering ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(registering ? { name: authForm.name } : {}),
            ...(registering && invitationToken ? { invitationToken } : {}),
            email: authForm.email,
            password: authForm.password,
          }),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Could not authenticate");
      setCurrentUser(body.user);
      setCurrentWorkspaceName(body.workspace?.name || currentWorkspaceName);
      setAuthEmailNotice(body.emailNotificationStatus === "not_configured"
        ? "Email alerts are not configured. Add SMTP settings to server/.env and restart the API."
        : body.emailNotificationStatus === "failed"
          ? "The email alert could not be delivered. Check the SMTP settings and API logs."
          : "");
      setSettings((current) => ({
        ...current,
        profile: { name: body.user.name, email: body.user.email },
        notifications: body.user.notificationPreferences || current.notifications,
      }));
      setAuthForm({ name: "", email: "", password: "", confirmPassword: "" });
      setSettingsError("");
      navigateTo("Dashboard");
    } catch (error) {
      setAuthError(error.message || "Could not authenticate");
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    setAuthError("");
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST" });
      if (!response.ok) throw new Error(`Could not sign out (${response.status})`);
      setCurrentUser(null);
      setAuthForm({ name: "", email: "", password: "", confirmPassword: "" });
      setAuthEmailNotice("");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordError("");
      setPasswordFeedback("");
      navigateTo("Login");
    } catch (error) {
      setAuthError(error.message || "Could not sign out");
    }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setSettingsError("");
    setSettingsFeedback("");
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: currentUser.name.trim(),
          email: currentUser.email.trim(),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Could not update account profile");
      const preferencesResponse = await apiFetch(`${API_BASE_URL}/api/auth/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationPreferences: settings.notifications }),
      });
      const preferencesBody = await preferencesResponse.json();
      if (!preferencesResponse.ok) {
        throw new Error(preferencesBody.message || "Could not update notification preferences");
      }
      setCurrentUser({
        ...body.user,
        notificationPreferences: preferencesBody.notificationPreferences,
      });
      const updatedSettings = {
        ...settings,
        profile: { name: body.user.name, email: body.user.email },
        notifications: preferencesBody.notificationPreferences,
      };
      setSettings(updatedSettings);
      try {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
      } catch (error) {
        setSettingsError(`Account settings were saved, but local appearance preferences could not be stored: ${error.message || "Browser storage is unavailable."}`);
        return;
      }
      setSettingsFeedback("Profile and preferences saved.");
    } catch (error) {
      setSettingsError(error.message || "Could not save settings");
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (passwordBusy) return;
    setPasswordError("");
    setPasswordFeedback("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    setPasswordBusy(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/auth/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Could not change password");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordFeedback(body.message || "Password updated.");
    } catch (error) {
      setPasswordError(error.message || "Could not change password");
    } finally {
      setPasswordBusy(false);
    }
  };

  const loadProjects = () => {
    setProjectsLoading(true);
    setProjectError("");
    apiFetch(`${API_BASE_URL}/api/projects`)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load projects (${response.status})`);
        return response.json();
      })
      .then(setProjectsData)
      .catch((error) => setProjectError(error.message || "Could not load projects"))
      .finally(() => setProjectsLoading(false));
  };

  const loadTasks = () => {
    setTasksLoading(true);
    setTasksError("");
    setTasksLoadFailed(false);
    apiFetch(`${API_BASE_URL}/api/tasks`)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load tasks (${response.status})`);
        return response.json();
      })
      .then(setTasksData)
      .catch((error) => {
        setTasksError(error.message || "Could not load tasks");
        setTasksLoadFailed(true);
      })
      .finally(() => setTasksLoading(false));
  };

  const loadCalendarEvents = () => {
    setCalendarLoading(true);
    setCalendarError("");
    apiFetch(`${API_BASE_URL}/api/events`)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load calendar events (${response.status})`);
        return response.json();
      })
      .then(setCalendarEventsData)
      .catch((error) => setCalendarError(error.message || "Could not load calendar events"))
      .finally(() => setCalendarLoading(false));
  };

  const loadTeam = () => {
    setTeamLoading(true);
    setTeamError("");
    apiFetch(`${API_BASE_URL}/api/team`)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load team (${response.status})`);
        return response.json();
      })
      .then(setTeamMembers)
      .catch((error) => setTeamError(error.message || "Could not load team"))
      .finally(() => setTeamLoading(false));
  };

  const loadTeamAccounts = () => {
    setTeamAccountsError("");
    apiFetch(`${API_BASE_URL}/api/team/accounts`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load workspace members (${response.status})`);
        return response.json();
      })
      .then(setTeamAccounts)
      .catch((error) => setTeamAccountsError(error.message || "Could not load workspace members"));
  };

  const loadTeamInvitations = () => {
    setTeamError("");
    apiFetch(`${API_BASE_URL}/api/team/invitations`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load invitations (${response.status})`);
        return response.json();
      })
      .then(setTeamInvitations)
      .catch((error) => setTeamError(error.message || "Could not load invitations"));
  };

  const loadServerNotifications = () => {
    setServerNotificationsLoading(true);
    setServerNotificationsError("");
    apiFetch(`${API_BASE_URL}/api/notifications`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load notifications (${response.status})`);
        return response.json();
      })
      .then(setServerNotifications)
      .catch((error) => setServerNotificationsError(error.message || "Could not load notifications"))
      .finally(() => setServerNotificationsLoading(false));
  };

  const loadProjectDetails = async () => {
    if (!selectedProjectId) return;
    setProjectDetailsLoading(true);
    setProjectDetailsError("");
    try {
      const [projectResponse, tasksResponse] = await Promise.all([
        apiFetch(`${API_BASE_URL}/api/projects/${selectedProjectId}`),
        apiFetch(`${API_BASE_URL}/api/tasks`),
      ]);
      if (!projectResponse.ok) throw new Error(`Could not load project (${projectResponse.status})`);
      if (!tasksResponse.ok) throw new Error(`Could not load project tasks (${tasksResponse.status})`);
      const [project, tasks] = await Promise.all([projectResponse.json(), tasksResponse.json()]);
      setProjectDetails(project);
      setProjectTasks(tasks.filter((task) => (task.project?._id || task.project) === project._id));
    } catch (error) {
      setProjectDetailsError(error.message || "Could not load project details");
    } finally {
      setProjectDetailsLoading(false);
    }
  };

  const loadProjectActivity = () => {
    if (!selectedProjectId) return;
    setProjectActivityLoading(true);
    setProjectActivityError("");
    apiFetch(`${API_BASE_URL}/api/projects/${selectedProjectId}/activity`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load project activity (${response.status})`);
        return response.json();
      })
      .then(setProjectActivity)
      .catch((error) => setProjectActivityError(error.message || "Could not load project activity"))
      .finally(() => setProjectActivityLoading(false));
  };

  const loadProjectFiles = () => {
    if (!selectedProjectId) return;
    setProjectFilesLoading(true);
    setProjectFilesError("");
    apiFetch(`${API_BASE_URL}/api/projects/${selectedProjectId}/files`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load project files (${response.status})`);
        return response.json();
      })
      .then(setProjectFiles)
      .catch((error) => setProjectFilesError(error.message || "Could not load project files"))
      .finally(() => setProjectFilesLoading(false));
  };

  useEffect(() => {
    if (!currentUser) return;
    loadServerNotifications();
    if (activePage === "Projects") {
      loadProjects();
      loadTeam();
    }
    if (activePage === "Team") {
      loadTeam();
      loadTeamAccounts();
      if (["Administrator", "Project Manager"].includes(currentUser.role)) loadTeamInvitations();
    }
    if (activePage === "Tasks" || activePage === "Calendar" || activePage === "Dashboard" || activePage === "Notifications") {
      loadTasks();
      loadProjects();
    }
    if (activePage === "Tasks") loadTeamAccounts();
    if (activePage === "Calendar" || activePage === "Dashboard" || activePage === "Notifications") {
      loadCalendarEvents();
    }
    if (activePage === "Project Details") loadProjectDetails();
  }, [activePage, currentUser?._id]);

  useEffect(() => {
    if (activePage !== "Project Details") return;
    if (projectDetailsTab === "Files") loadProjectFiles();
    if (projectDetailsTab === "Activity") loadProjectActivity();
  }, [activePage, projectDetailsTab, selectedProjectId]);

  const openProjectDetails = (project) => {
    setProjectDetails(project);
    setProjectDetailsTab("Overview");
    navigateTo("Project Details", project._id);
  };

  const openTeamMemberModal = (member = null) => {
    setEditingTeamMemberId(member?._id || null);
    setTeamForm(member ? {
      name: member.name || "",
      email: member.email || "",
      role: member.role || "Team Member",
    } : {
      name: "",
      email: "",
      role: "Team Member",
    });
    setTeamError("");
    setTeamModal(true);
  };

  const openCalendarEventModal = (event = null, date = selectedCalendarDate) => {
    setEditingCalendarEventId(event?._id || null);
    setCalendarEventForm(event ? {
      title: event.title || "",
      description: event.description || "",
      date: event.date ? event.date.slice(0, 10) : date,
      kind: event.kind || "Meeting",
    } : {
      title: "",
      description: "",
      date,
      kind: "Meeting",
    });
    setCalendarError("");
    setCalendarEventModal(true);
  };

  const saveCalendarEvent = async (event) => {
    event.preventDefault();
    setCalendarError("");
    try {
      const response = await apiFetch(
        editingCalendarEventId
          ? `${API_BASE_URL}/api/events/${editingCalendarEventId}`
          : `${API_BASE_URL}/api/events`,
        {
          method: editingCalendarEventId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(calendarEventForm),
        },
      );
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Could not save calendar event");
      }
      setSelectedCalendarDate(calendarEventForm.date);
      setCalendarDate(new Date(`${calendarEventForm.date}T00:00:00`));
      setCalendarEventModal(false);
      loadCalendarEvents();
    } catch (error) {
      setCalendarError(error.message || "Could not save calendar event");
    }
  };

  const deleteCalendarEvent = async (event) => {
    if (!window.confirm(`Delete "${event.title}"?`)) return;
    setCalendarError("");
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/events/${event._id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Could not delete calendar event");
      }
      loadCalendarEvents();
    } catch (error) {
      setCalendarError(error.message || "Could not delete calendar event");
    }
  };

  const saveTeamMember = async (event) => {
    event.preventDefault();
    setTeamError("");
    setTeamFeedback("");
    try {
      const response = await apiFetch(
        editingTeamMemberId
          ? `${API_BASE_URL}/api/team/${editingTeamMemberId}`
          : `${API_BASE_URL}/api/team/invitations`,
        {
          method: editingTeamMemberId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(teamForm),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 503) {
          setTeamModal(false);
          setTeamError(body.message || "Invitation was not delivered");
          loadTeam();
          loadTeamInvitations();
          return;
        }
        throw new Error(body.message || "Could not save team member");
      }
      setTeamFeedback(body.emailNotificationStatus === "not_configured"
        ? `${body.message}. Email notifications are not configured.`
        : body.emailNotificationStatus === "failed"
          ? `${body.message}. The email could not be delivered.`
          : body.message || "Team member saved.");
      setTeamModal(false);
      loadTeam();
      loadTeamInvitations();
    } catch (error) {
      setTeamError(error.message || "Could not save team member");
    }
  };

  const deleteTeamMember = async (member) => {
    if (!window.confirm(`Remove ${member.name} from the team?`)) return;
    setTeamError("");
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/team/${member._id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Could not remove team member");
      }
      loadTeam();
    } catch (error) {
      setTeamError(error.message || "Could not remove team member");
    }
  };

  const resendTeamInvitation = async (invitation) => {
    setTeamError("");
    setTeamFeedback("");
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/api/team/invitations/${invitation._id}/resend`,
        { method: "POST" },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Could not resend invitation");
      setTeamFeedback(body.message);
      loadTeamInvitations();
    } catch (error) {
      setTeamError(error.message || "Could not resend invitation");
    }
  };

  const revokeTeamInvitation = async (invitation) => {
    if (!window.confirm(`Revoke the invitation for ${invitation.email}?`)) return;
    setTeamError("");
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/team/invitations/${invitation._id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Could not revoke invitation");
      }
      loadTeam();
      loadTeamInvitations();
    } catch (error) {
      setTeamError(error.message || "Could not revoke invitation");
    }
  };

  const uploadProjectFile = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !selectedProjectId) return;
    setProjectFilesError("");
    setProjectFileUploading(true);
    try {
      const uploadUrlResponse = await apiFetch(
        `${API_BASE_URL}/api/projects/${selectedProjectId}/files/upload-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
          }),
        },
      );
      const uploadDetails = await uploadUrlResponse.json();
      if (!uploadUrlResponse.ok) throw new Error(uploadDetails.message || "Could not prepare file upload");

      const storageResponse = await fetch(uploadDetails.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": uploadDetails.contentType },
        body: file,
      });
      if (!storageResponse.ok) throw new Error(`Storage upload failed (${storageResponse.status})`);

      const finalizeResponse = await apiFetch(`${API_BASE_URL}/api/projects/${selectedProjectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          key: uploadDetails.key,
          contentType: uploadDetails.contentType,
          size: file.size,
        }),
      });
      const savedFile = await finalizeResponse.json();
      if (!finalizeResponse.ok) throw new Error(savedFile.message || "Could not save uploaded file");
      setProjectFiles((files) => [savedFile, ...files]);
    } catch (error) {
      setProjectFilesError(error.message || "Could not upload file");
    } finally {
      setProjectFileUploading(false);
      input.value = "";
    }
  };

  const downloadProjectFile = async (file) => {
    setProjectFilesError("");
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/api/projects/${selectedProjectId}/files/${file._id}/download`,
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Could not download file");
      window.location.assign(body.downloadUrl);
    } catch (error) {
      setProjectFilesError(error.message || "Could not download file");
    }
  };

  const deleteProjectFile = async (file) => {
    if (!window.confirm(`Delete “${file.name}” from this project?`)) return;
    setProjectFilesError("");
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/api/projects/${selectedProjectId}/files/${file._id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Could not delete file");
      }
      setProjectFiles((files) => files.filter((item) => item._id !== file._id));
    } catch (error) {
      setProjectFilesError(error.message || "Could not delete file");
    }
  };

  const openTaskModal = (task = null) => {
    setEditingTaskId(task?._id || null);
    setTaskForm(task ? {
      title: task.title || "",
      description: task.description || "",
      project: task.project?._id || task.project || "",
      status: task.status || "To Do",
      priority: task.priority || "Medium",
      assignee: task.assignee || "",
      assigneeUser: task.assigneeUser?._id || task.assigneeUser || "",
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
    } : {
      title: "",
      description: "",
      project: "",
      status: "To Do",
      priority: "Medium",
      assignee: "",
      assigneeUser: "",
      dueDate: "",
    });
    setTasksError("");
    setTaskModal(true);
  };

  const saveTask = async (event) => {
    event.preventDefault();
    setTasksError("");
    const taskPayload = {
      ...taskForm,
      project: taskForm.project || null,
      dueDate: taskForm.dueDate || null,
    };
    if (taskForm.assigneeUser) {
      taskPayload.assignee = teamAccounts.find((member) => member._id === taskForm.assigneeUser)?.name || "";
    } else {
      delete taskPayload.assigneeUser;
    }
    try {
      const response = await apiFetch(
        editingTaskId
          ? `${API_BASE_URL}/api/tasks/${editingTaskId}`
          : `${API_BASE_URL}/api/tasks`,
        {
          method: editingTaskId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskPayload),
        },
      );
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Could not save task");
      }
      setTaskModal(false);
      loadTasks();
    } catch (error) {
      setTasksError(error.message || "Could not save task");
    }
  };

  const updateTaskStatus = async (task, status) => {
    if (task.status === status) return;
    setTasksError("");
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/tasks/${task._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Could not update task status");
      }
      loadTasks();
    } catch (error) {
      setTasksError(error.message || "Could not update task status");
    }
  };

  const handleTaskDrop = (event, status) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    const task = tasksData.find((item) => item._id === taskId);
    setDraggedTaskId(null);
    if (task) updateTaskStatus(task, status);
  };

  const deleteTask = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    setTasksError("");
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/tasks/${task._id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Could not delete task");
      }
      loadTasks();
    } catch (error) {
      setTasksError(error.message || "Could not delete task");
    }
  };

  const openProjectModal = (project = null) => {
    setProjectModal(project ? "edit" : "create");
    setEditingProjectId(project?._id || null);
    setProjectForm(project ? {
      name: project.name || "",
      description: project.description || "",
      status: project.status || "Planning",
      priority: project.priority || "Medium",
      manager: project.manager || "",
      teamMembers: (project.teamMembers || []).filter(Boolean).map((member) => member._id || member),
      startDate: project.startDate ? project.startDate.slice(0, 10) : "",
      dueDate: project.dueDate ? project.dueDate.slice(0, 10) : "",
      progress: project.progress ?? 0,
    } : {
      name: "",
      description: "",
      status: "Planning",
      priority: "Medium",
      manager: "",
      teamMembers: [],
      startDate: "",
      dueDate: "",
      progress: 0,
    });
  };

  const saveProject = async (event) => {
    event.preventDefault();
    setProjectError("");
    const endpoint = editingProjectId
      ? `${API_BASE_URL}/api/projects/${editingProjectId}`
      : `${API_BASE_URL}/api/projects`;

    try {
      const response = await apiFetch(endpoint, {
        method: editingProjectId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...projectForm,
          startDate: projectForm.startDate || null,
          dueDate: projectForm.dueDate || null,
          progress: Number(projectForm.progress),
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Could not save project");
      }
      setProjectModal(null);
      loadProjects();
      if (activePage === "Project Details") loadProjectDetails();
    } catch (error) {
      setProjectError(error.message || "Could not save project");
    }
  };

  const deleteProject = async (project) => {
    if (!window.confirm(`Delete "${project.name}"?`)) return;
    setProjectError("");
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/projects/${project._id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Could not delete project");
      }
      loadProjects();
    } catch (error) {
      setProjectError(error.message || "Could not delete project");
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    apiFetch(`${API_BASE_URL}/api/health`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`API health check failed (${response.status})`);
        }
        return response.json();
      })
      .then((health) => {
        setApiStatus({
          state: health.database === "connected" ? "connected" : "database",
          message: health.database === "connected" ? "API and database connected" : "API is running; database is not connected",
        });
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setApiStatus({ state: "offline", message: error.message || "API is unavailable" });
        }
      });

    return () => controller.abort();
  }, []);

  const completedTaskCount = tasksData.filter((task) => task.status === "Completed").length;
  const openTaskCount = tasksData.length - completedTaskCount;
  const overdueTaskCount = tasksData.filter((task) =>
    task.status !== "Completed" && task.dueDate && daysUntilDate(task.dueDate) < 0,
  ).length;
  const completionRate = tasksData.length
    ? Math.round((completedTaskCount / tasksData.length) * 100)
    : 0;
  const dashboardProjects = projectsData
    .filter((project) =>
      `${project.name} ${project.manager || ""}`.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 4);
  const dashboardDeadlines = [
    ...projectsData
      .filter((project) => project.dueDate)
      .map((project) => ({
        id: `project-${project._id}`,
        title: project.name,
        context: "Project",
        date: project.dueDate.slice(0, 10),
        color: "violet",
      })),
    ...tasksData
      .filter((task) => task.dueDate && task.status !== "Completed")
      .map((task) => ({
        id: `task-${task._id}`,
        title: task.title,
        context: task.project?.name || "Task",
        date: task.dueDate.slice(0, 10),
        color: task.priority === "High" ? "orange" : "blue",
      })),
    ...calendarEventsData
      .filter((event) => event.kind === "Deadline")
      .map((event) => ({
        id: `event-${event._id}`,
        title: event.title,
        context: "Calendar",
        date: event.date.slice(0, 10),
        color: "green",
      })),
  ]
    .map((item) => ({ ...item, daysUntil: daysUntilDate(item.date) }))
    .filter((item) => item.daysUntil >= 0 && item.daysUntil <= 7)
    .sort((first, second) => first.date.localeCompare(second.date));
  const taskStatusCounts = ["To Do", "In Progress", "Review", "Completed"].map((status) => ({
    status,
    count: tasksData.filter((task) => task.status === status).length,
  }));
  const recentlyUpdatedTasks = [...tasksData]
    .sort((first, second) =>
      new Date(second.updatedAt || second.createdAt || 0) - new Date(first.updatedAt || first.createdAt || 0),
    )
    .slice(0, 4);
  const dashboardLoadErrors = [
    projectError,
    tasksLoadFailed ? tasksError : "",
    calendarError,
  ].filter(Boolean);

  const formattedDate = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const weekStartIndex = settings.weekStartsOn === "Sunday" ? 0 : 1;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const calendarWeekdays = weekdays.slice(weekStartIndex).concat(weekdays.slice(0, weekStartIndex));
  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(calendarDate);
  const firstCalendarDay = new Date(calendarYear, calendarMonth, 1);
  const firstGridOffset = (firstCalendarDay.getDay() - weekStartIndex + 7) % 7;
  const calendarStart = new Date(calendarYear, calendarMonth, 1 - firstGridOffset);
  const calendarCells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
  const calendarEvents = [
    ...calendarEventsData.map((event) => ({
      id: `event-${event._id}`,
      _id: event._id,
      title: event.title,
      description: event.description,
      date: event.date.slice(0, 10),
      color: event.kind === "Meeting" ? "green" : event.kind === "Deadline" ? "orange" : "blue",
      kind: event.kind,
      editable: true,
    })),
    ...projectsData
      .filter((project) => project.dueDate)
      .map((project) => ({
        id: `project-${project._id}`,
        title: project.name,
        date: project.dueDate.slice(0, 10),
        color: "violet",
        kind: "Project",
        editable: false,
      })),
    ...tasksData
      .filter((task) => task.dueDate)
      .map((task) => ({
        id: `task-${task._id}`,
        title: task.title,
        date: task.dueDate.slice(0, 10),
        color: task.priority === "High" ? "orange" : "blue",
        kind: "Task",
        editable: false,
      })),
  ];
  const selectedCalendarEvents = calendarEvents.filter((event) => event.date === selectedCalendarDate);
  const generatedNotificationItems = [
    ...projectsData
      .filter((project) => project.dueDate)
      .map((project) => {
        const date = project.dueDate.slice(0, 10);
        const daysUntil = daysUntilDate(date);
        return {
          id: `project-deadline-${project._id}`,
          category: "Projects",
          title: daysUntil < 0 ? "Project deadline overdue" : daysUntil === 0 ? "Project due today" : "Project deadline coming up",
          detail: `${project.name} · ${formatProjectDate(date)}`,
          date,
          daysUntil,
          projectId: project._id,
        };
      }),
    ...tasksData
      .filter((task) => task.dueDate)
      .map((task) => {
        const date = task.dueDate.slice(0, 10);
        const daysUntil = daysUntilDate(date);
        return {
          id: `task-deadline-${task._id}`,
          category: "Tasks",
          title: daysUntil < 0 ? "Task overdue" : daysUntil === 0 ? "Task due today" : "Task due soon",
          detail: `${task.title} · ${formatProjectDate(date)}`,
          date,
          daysUntil,
        };
      }),
    ...calendarEventsData
      .map((event) => {
        const date = event.date.slice(0, 10);
        const daysUntil = daysUntilDate(date);
        return {
          id: `calendar-event-${event._id}`,
          category: "Calendar",
          title: daysUntil < 0 ? "Event has passed" : daysUntil === 0 ? "Event today" : "Upcoming event",
          detail: `${event.title} · ${formatProjectDate(date)}`,
          date,
          daysUntil,
        };
      }),
  ]
    .filter((item) => item.daysUntil >= -7 && item.daysUntil <= 7)
    .sort((first, second) => first.date.localeCompare(second.date));
  const apiNotificationItems = serverNotifications.map((notification) => ({
    id: `server-${notification._id}`,
    serverId: notification._id,
    category: notification.kind === "project_update" ? "Projects" : "Tasks",
    title: notification.title,
    detail: notification.body,
    date: notification.createdAt.slice(0, 10),
    daysUntil: 0,
    serverRead: Boolean(notification.readAt),
    link: notification.link,
    projectId: notification.link.startsWith("#/projects/")
      ? notification.link.slice("#/projects/".length)
      : null,
  }));
  const notificationItems = [...apiNotificationItems, ...generatedNotificationItems];
  const isNotificationRead = (item) => item.serverId
    ? item.serverRead
    : readNotificationIds.includes(item.id);
  const unreadNotificationCount = notificationItems.filter(
    (item) => !isNotificationRead(item),
  ).length;
  const filteredNotifications = notificationItems.filter((item) => {
    if (notificationFilter === "Unread") return !isNotificationRead(item);
    return notificationFilter === "All" || item.category === notificationFilter;
  });
  const notificationFilterCounts = {
    All: notificationItems.length,
    Unread: unreadNotificationCount,
    Projects: notificationItems.filter((item) => item.category === "Projects").length,
    Tasks: notificationItems.filter((item) => item.category === "Tasks").length,
    Calendar: notificationItems.filter((item) => item.category === "Calendar").length,
  };
  const notificationLoadErrors = [
    projectError,
    tasksLoadFailed ? tasksError : "",
    calendarError,
    serverNotificationsError,
  ].filter(Boolean);
  const selectedProjectMembers = (projectDetails?.teamMembers || []).filter(Boolean);
  const profileName = currentUser?.name || settings.profile.name.trim() || DEFAULT_SETTINGS.profile.name;
  const profileRole = currentUser?.role || "Team Member";
  const canManageWorkspace = ["Administrator", "Project Manager"].includes(profileRole);
  const isWorkspaceAdministrator = profileRole === "Administrator";
  const profileInitials = profileName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const profileFirstName = profileName.split(/\s+/)[0];
  const activeNavigationPage = activePage === "Project Details" ? "Projects" : activePage;

  const saveReadNotificationIds = (ids) => {
    try {
      window.localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(ids));
      setReadNotificationIds(ids);
      setNotificationStorageError("");
    } catch (error) {
      setNotificationStorageError(`Could not save notification state: ${error.message || "Browser storage is unavailable."}`);
    }
  };

  const markNotificationRead = async (id) => {
    const item = notificationItems.find((notification) => notification.id === id);
    if (!item || isNotificationRead(item)) return;
    if (item.serverId) {
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/notifications/${item.serverId}/read`, {
          method: "PATCH",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Could not mark notification as read");
        setServerNotifications((notifications) => notifications.map((notification) =>
          notification._id === item.serverId ? { ...notification, readAt: body.readAt } : notification,
        ));
      } catch (error) {
        setNotificationStorageError(error.message || "Could not mark notification as read");
      }
      return;
    }
    saveReadNotificationIds([...readNotificationIds, item.id]);
  };

  const markAllNotificationsRead = async () => {
    saveReadNotificationIds([
      ...new Set([
        ...readNotificationIds,
        ...generatedNotificationItems.map((item) => item.id),
      ]),
    ]);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/notifications/read-all`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Could not mark notifications as read");
      }
      const readAt = new Date().toISOString();
      setServerNotifications((notifications) => notifications.map((notification) => ({
        ...notification,
        readAt: notification.readAt || readAt,
      })));
    } catch (error) {
      setNotificationStorageError(error.message || "Could not mark notifications as read");
    }
  };

  const openNotification = (notification) => {
    markNotificationRead(notification.id);
    if (notification.projectId) {
      setProjectDetails(null);
      setProjectDetailsTab("Overview");
      navigateTo("Project Details", notification.projectId);
    } else if (notification.link) {
      const route = readNavigationRoute(notification.link);
      navigateTo(route.page);
    } else {
      navigateTo(notification.category === "Tasks" ? "Tasks" : "Calendar");
    }
  };

  if (authChecking) {
    return (
      <main className="auth-loading" aria-live="polite">
        <span className="brand-mark"><Check size={19} strokeWidth={3} /></span>
        <p>Checking your NexaFlow session…</p>
      </main>
    );
  }

  if (!currentUser) {
    const registering = activePage === "Register";
    return (
      <div className="auth-page">
        <main className="auth-screen">
          <a className="brand auth-brand" href="#/dashboard" aria-label="NexaFlow">
            <span className="brand-mark"><Check size={19} strokeWidth={3} /></span>
            <span>NexaFlow</span>
          </a>
          <section className="auth-card">
            <p className="auth-tagline">Next-generation workflow management</p>
            <p className="eyebrow">{registering ? "GET STARTED" : "WELCOME BACK"}</p>
            <h1>{registering ? "Create your account" : "Sign in to NexaFlow"}</h1>
            <p className="auth-description">
              {registering
                ? `Create an account to join ${currentWorkspaceName}.`
                : "Enter your account details to continue to your workspace."}
            </p>

            {authError && <div className="api-notice offline auth-error" role="alert"><strong>{authError}</strong></div>}

            <form className="auth-form" onSubmit={submitAuth}>
              {registering && (
                <label>
                  Full name
                  <input
                    autoComplete="name"
                    maxLength={100}
                    onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                    required
                    value={authForm.name}
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  autoComplete="email"
                  maxLength={254}
                  onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                  required
                  type="email"
                  value={authForm.email}
                />
              </label>
              <label>
                Password
                <input
                  autoComplete={registering ? "new-password" : "current-password"}
                  maxLength={128}
                  minLength={registering ? 8 : undefined}
                  onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                  required
                  type="password"
                  value={authForm.password}
                />
              </label>
              {registering && (
                <>
                  <label>
                    Confirm password
                    <input
                      autoComplete="new-password"
                      maxLength={128}
                      minLength={8}
                      onChange={(event) => setAuthForm({ ...authForm, confirmPassword: event.target.value })}
                      required
                      type="password"
                      value={authForm.confirmPassword}
                    />
                  </label>
                  <p className="auth-hint">
                    Use at least 8 characters. {invitationToken ? "Use the email address that received this invitation." : "Registration requires an invitation except during initial workspace setup."}
                  </p>
                </>
              )}
              <button className="button button-primary auth-submit" disabled={authBusy} type="submit">
                {authBusy ? "Please wait…" : registering ? "Create account" : "Sign in"}
              </button>
            </form>

            <p className="auth-switch">
              {registering ? "Already have an account?" : "New to NexaFlow?"}
              <button
                onClick={() => {
                  setAuthError("");
                  navigateTo(registering ? "Login" : "Register");
                }}
                type="button"
              >
                {registering ? "Sign in" : "Create account"}
              </button>
            </p>
            {registering && <p className="auth-workspace-note">Workspace members currently share the same projects, tasks, team, and calendar.</p>}
          </section>
        </main>
        <AppFooter auth />
      </div>
    );
  }

  return (
    <div className={`app-shell${settings.compactView ? " compact-view" : ""}${settings.darkMode ? " dark-mode" : ""}`}>
      <aside className="sidebar">
        <a
          className="brand"
          href="#/dashboard"
          aria-label="NexaFlow home"
        >
          <span className="brand-mark"><Check size={19} strokeWidth={3} /></span>
          <span>NexaFlow</span>
        </a>
        <div className="workspace-picker">
          <span className="workspace-dot">{currentWorkspaceName[0] || "W"}</span>
          <span className="workspace-name">{currentWorkspaceName}</span>
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          {primaryNavigation.map(({ label, icon: Icon }) => (
            <a
              className={`nav-item${activeNavigationPage === label ? " active" : ""}`}
              key={label}
              href={`#/${navigationPaths[label]}`}
              aria-label={label}
              aria-current={activeNavigationPage === label ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <p className="nav-caption nav-caption-spaced">ORGANIZATION</p>
        <nav className="main-nav" aria-label="Organization navigation">
          {secondaryNavigation.map(({ label, icon: Icon }) => (
            <a
              className={`nav-item${activeNavigationPage === label ? " active" : ""}`}
              key={label}
              href={`#/${navigationPaths[label]}`}
              aria-label={label}
              aria-current={activeNavigationPage === label ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Notifications" && unreadNotificationCount > 0 && (
                <span className="nav-count">{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-mini">
            <Avatar initials={profileInitials} color="avatar-photo" />
            <span className="profile-copy"><strong>{profileName}</strong><small>{profileRole}</small></span>
            <MoreHorizontal size={19} />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                aria-label="Search projects"
                ref={searchInputRef}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects..."
                value={query}
              />
              <kbd>Ctrl/⌘ K</kbd>
            </label>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => navigateTo("Notifications")} type="button">
              <Bell size={18} />
              {unreadNotificationCount > 0 && <span aria-label={`${unreadNotificationCount} unread notifications`} />}
            </button>
            <button className="top-profile" type="button" onClick={() => navigateTo("Settings")}>
              <Avatar initials={profileInitials} color="avatar-photo" />
              <span><strong>{profileName}</strong><small>{profileRole}</small></span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>

        {activePage === "Dashboard" ? (
          <div className="page-content">
            {authEmailNotice && (
              <div className="api-notice offline" role="status">
                <div>
                  <strong>Email notification not sent</strong>
                  <span>{authEmailNotice}</span>
                </div>
              </div>
            )}
            <div className="welcome-row">
              <div>
                <p className="eyebrow">{formattedDate}</p>
                <h1>Good morning, {profileFirstName} <span className="wave">✦</span></h1>
                <p className="subheading">Here&apos;s what&apos;s happening with your projects today.</p>
              </div>
              <div className="welcome-actions">
                {canManageWorkspace && (
                  <button className="button button-primary" type="button" onClick={() => { navigateTo("Projects"); openProjectModal(); }}>
                    <Plus size={17} /> New Project
                  </button>
                )}
              </div>
            </div>

            {apiStatus.state !== "connected" && (
              <div className={`api-notice ${apiStatus.state}`} role="status">
                <span className="api-indicator" />
                <div>
                  <strong>{apiStatus.state === "checking" ? "Checking API connection" : apiStatus.state === "offline" ? "API is unavailable" : "Database connection needs attention"}</strong>
                  <span>{apiStatus.state === "checking" ? "Connecting to your API…" : apiStatus.message}</span>
                </div>
              </div>
            )}

            {dashboardLoadErrors.length > 0 && (
              <div className="api-notice offline" role="alert">
                <div>
                  <strong>Some dashboard data could not be loaded.</strong>
                  <span>{dashboardLoadErrors.join(" · ")}</span>
                </div>
                <button className="text-button" type="button" onClick={() => {
                  loadProjects();
                  loadTasks();
                  loadCalendarEvents();
                }}>
                  Try again
                </button>
              </div>
            )}

            <section className="stats-grid" aria-label="Project statistics">
              <article className="stat-card">
                <div className="stat-top"><span>Total Projects</span><span className="stat-icon violet-icon"><FolderKanban size={18} /></span></div>
                <strong className="stat-number">{projectsLoading ? "—" : projectsData.length}</strong>
                <p>Across this workspace</p>
              </article>
              <article className="stat-card">
                <div className="stat-top"><span>Completed Tasks</span><span className="stat-icon green-icon"><Check size={18} /></span></div>
                <strong className="stat-number">{tasksLoading ? "—" : completedTaskCount}</strong>
                <p>{completionRate}% of {tasksLoading ? "—" : tasksData.length} tasks</p>
              </article>
              <article className="stat-card">
                <div className="stat-top"><span>Pending Tasks</span><span className="stat-icon orange-icon"><Clock3 size={18} /></span></div>
                <strong className="stat-number">{tasksLoading ? "—" : openTaskCount}</strong>
                <p>{tasksLoading ? "—" : overdueTaskCount} overdue</p>
              </article>
              <article className="stat-card">
                <div className="stat-top"><span>Upcoming Deadlines</span><span className="stat-icon blue-icon"><CalendarDays size={18} /></span></div>
                <strong className="stat-number">{projectsLoading || tasksLoading || calendarLoading ? "—" : dashboardDeadlines.length}</strong>
                <p><span className="trend-muted">Next 7 days</span></p>
              </article>
            </section>

            <section className="overview-grid">
              <article className="panel activity-chart-panel">
                <SectionHeading title="Tasks by status" />
                <div className="task-status-list">
                  {taskStatusCounts.map(({ status, count }) => (
                    <div className="task-status-row" key={status}>
                      <span>{status}</span>
                      <div className="task-status-track">
                        <span
                          className={`task-status-fill task-status-${status.toLowerCase().replaceAll(" ", "-")}`}
                          style={{ width: `${tasksData.length ? (count / tasksData.length) * 100 : 0}%` }}
                        />
                      </div>
                      <strong>{tasksLoading ? "—" : count}</strong>
                    </div>
                  ))}
                  {!tasksLoading && tasksData.length === 0 && <p className="task-status-empty">No tasks yet.</p>}
                </div>
              </article>

              <article className="panel task-overview-panel">
                <SectionHeading title="Tasks Overview" />
                <div className="donut-area">
                  <div
                    className="donut-chart"
                    style={{
                      background: tasksData.length
                        ? `conic-gradient(#39bb8a 0 ${completionRate}%, #6656e7 ${completionRate}% 100%)`
                        : undefined,
                    }}
                  >
                    <div className="donut-center">
                      <strong>{tasksLoading ? "—" : tasksData.length}</strong>
                      <span>Total Tasks</span>
                    </div>
                  </div>
                  <div className="donut-legend">
                    <span><i className="legend-dot green-dot" /> Completed <strong>{tasksLoading ? "—" : completedTaskCount}</strong></span>
                    <span><i className="legend-dot violet-dot" /> Open <strong>{tasksLoading ? "—" : openTaskCount}</strong></span>
                    <span><i className="legend-dot gray-dot" /> Overdue <strong>{tasksLoading ? "—" : overdueTaskCount}</strong></span>
                  </div>
                </div>
              </article>
            </section>

            <section className="lower-grid">
              <article className="panel projects-panel">
                <SectionHeading
                  title="Recent Projects"
                  action={<button className="text-button" onClick={() => navigateTo("Projects")} type="button">View all <ChevronRight size={15} /></button>}
                />
                <div className="project-list">
                  {projectsLoading ? (
                    <p className="empty-search">Loading projects...</p>
                  ) : dashboardProjects.map((project) => (
                    <div className="project-row" key={project._id}>
                      <span className="project-marker violet" />
                      <div className="project-name">
                        <strong>{project.name}</strong>
                        <span>{project.manager || "Unassigned"}</span>
                      </div>
                      <span className="project-due">{formatProjectDate(project.dueDate)}</span>
                      <div className="progress-cell">
                        <div className="progress-track"><span className="violet" style={{ width: `${project.progress || 0}%` }} /></div>
                        <small>{project.progress || 0}%</small>
                      </div>
                      <span className={`status-pill status-${project.status.toLowerCase().replaceAll(" ", "-")}`}>
                        {project.status}
                      </span>
                    </div>
                  ))}
                  {!projectsLoading && dashboardProjects.length === 0 && (
                    <p className="empty-search">
                      {projectsData.length
                        ? `No projects match “${query}”.`
                        : "No projects yet. Create your first project to get started."}
                    </p>
                  )}
                </div>
              </article>

              <article className="panel deadlines-panel">
                <SectionHeading title="Upcoming Deadlines" />
                <div className="deadline-list">
                  {dashboardDeadlines.slice(0, 5).map((deadline) => (
                    <div className="deadline-row" key={deadline.id}>
                      <span className={`deadline-marker ${deadline.color}`} />
                      <span className="deadline-copy"><strong>{deadline.title}</strong><small>{deadline.context}</small></span>
                      <span className="deadline-date">{formatProjectDate(deadline.date)}</span>
                    </div>
                  ))}
                  {!projectsLoading && !tasksLoading && !calendarLoading && dashboardDeadlines.length === 0 && (
                    <p className="empty-search">No deadlines in the next 7 days.</p>
                  )}
                </div>
                <button className="calendar-link" onClick={() => navigateTo("Calendar")} type="button">View calendar <ChevronRight size={15} /></button>
              </article>
            </section>

            <article className="panel activity-panel">
              <SectionHeading title="Recently Updated Tasks" action={<button className="text-button" onClick={() => navigateTo("Tasks")} type="button">View all <ChevronRight size={15} /></button>} />
              <div className="activity-list">
                {recentlyUpdatedTasks.map((task) => (
                  <div className="activity-row" key={task._id}>
                    <span className={`task-status-indicator task-status-${task.status.toLowerCase().replaceAll(" ", "-")}`} />
                    <p><strong>{task.title}</strong> · {task.project?.name || "No project"}</p>
                    <span>{formatProjectDate(task.updatedAt || task.createdAt)}</span>
                  </div>
                ))}
                {!tasksLoading && recentlyUpdatedTasks.length === 0 && (
                  <p className="empty-search">No tasks have been added yet.</p>
                )}
              </div>
            </article>
          </div>
        ) : activePage === "Projects" ? (
          <div className="page-content">
            <div className="welcome-row">
              <div>
                <p className="eyebrow">PROJECT MANAGEMENT</p>
                <h1>Projects</h1>
                <p className="subheading">Create, organize, and track all workspace projects.</p>
              </div>
              {canManageWorkspace && (
                <button className="button button-primary" type="button" onClick={() => openProjectModal()}>
                  <Plus size={17} /> New Project
                </button>
              )}
            </div>

            {projectError && <div className="api-notice offline" role="alert"><strong>{projectError}</strong></div>}

            <section className="panel projects-page-panel">
              <SectionHeading
                title={`${projectsData.length} project${projectsData.length === 1 ? "" : "s"}`}
                action={<button className="text-button" type="button" onClick={loadProjects}>Refresh</button>}
              />
              {projectsLoading ? (
                <p className="projects-empty">Loading projects...</p>
              ) : projectsData.length === 0 ? (
                <p className="projects-empty">
                  {canManageWorkspace ? "No projects yet. Create your first project to get started." : "No projects have been added to this workspace yet."}
                </p>
              ) : (
                <div className="projects-table">
                  {projectsData
                    .filter((project) =>
                      `${project.name} ${project.manager || ""}`.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((project) => (
                      <div className="projects-table-row" key={project._id}>
                        <span className="project-marker violet" />
                        <div className="project-name">
                          <strong>{project.name}</strong>
                          <span>{project.description || "No description"}</span>
                        </div>
                        <span className={`status-pill status-${project.status.toLowerCase().replaceAll(" ", "-")}`}>
                          {project.status}
                        </span>
                        <span className="project-manager">{project.manager || "Unassigned"}</span>
                        <div className="progress-cell">
                          <div className="progress-track"><span className="violet" style={{ width: `${project.progress}%` }} /></div>
                          <small>{project.progress}%</small>
                        </div>
                        <div className="project-actions">
                          <button type="button" onClick={() => openProjectDetails(project)}>View</button>
                          {canManageWorkspace && (
                            <>
                              <button type="button" onClick={() => openProjectModal(project)}>Edit</button>
                              <button type="button" className="delete-action" onClick={() => deleteProject(project)}>Delete</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </div>
        ) : activePage === "Project Details" ? (
          <div className="page-content project-details-page">
            <button className="project-back-link" type="button" onClick={() => navigateTo("Projects")}>
              <ChevronLeft size={15} /> All projects
            </button>
            {projectDetailsLoading ? (
              <section className="panel project-details-empty">Loading project details...</section>
            ) : projectDetailsError ? (
              <section className="panel project-details-empty" role="status">
                <strong>Couldn&apos;t load project</strong>
                <span>{projectDetailsError}</span>
                <button className="button button-outline" type="button" onClick={loadProjectDetails}>Try again</button>
              </section>
            ) : projectDetails ? (
              <>
                <header className="project-details-header">
                  <div>
                    <p className="eyebrow">PROJECT WORKSPACE</p>
                    <div className="project-title-line">
                      <h1>{projectDetails.name}</h1>
                      <span className={`status-pill status-${projectDetails.status.toLowerCase().replaceAll(" ", "-")}`}>
                        {projectDetails.status}
                      </span>
                    </div>
                    <p className="subheading">
                      Managed by {projectDetails.manager || "Unassigned"} · {formatProjectDate(projectDetails.startDate)} – {formatProjectDate(projectDetails.dueDate)}
                    </p>
                  </div>
                  {canManageWorkspace && (
                    <button className="button button-outline" type="button" onClick={() => openProjectModal(projectDetails)}>
                      Edit Project
                    </button>
                  )}
                </header>

                <div className="project-progress-panel panel">
                  <div className="project-progress-copy">
                    <span>Project progress</span>
                    <strong>{projectDetails.progress}%</strong>
                  </div>
                  <div className="project-progress-track">
                    <span style={{ width: `${projectDetails.progress}%` }} />
                  </div>
                </div>

                <nav className="project-tabs" aria-label="Project details sections">
                  {["Overview", "Tasks", "Team", "Files", "Activity"].map((tab) => (
                    <button
                      className={projectDetailsTab === tab ? "active" : ""}
                      key={tab}
                      onClick={() => setProjectDetailsTab(tab)}
                      type="button"
                    >
                      {tab}
                      {tab === "Tasks" && <span>{projectTasks.length}</span>}
                    </button>
                  ))}
                </nav>

                {projectDetailsTab === "Overview" ? (
                  <>
                    <div className="project-detail-grid">
                      <div className="project-detail-main">
                        <article className="panel project-description-panel">
                          <SectionHeading title="Overview" />
                          <p>{projectDetails.description || "No project description has been added yet."}</p>
                        </article>
                        <article className="panel project-metadata-panel">
                          <SectionHeading title="Project details" />
                          <div className="project-metadata-grid">
                            <div><span>Start date</span><strong>{formatProjectDate(projectDetails.startDate)}</strong></div>
                            <div><span>End date</span><strong>{formatProjectDate(projectDetails.dueDate)}</strong></div>
                            <div><span>Priority</span><strong className={`priority-pill priority-${projectDetails.priority.toLowerCase()}`}>{projectDetails.priority}</strong></div>
                            <div><span>Project manager</span><strong>{projectDetails.manager || "Unassigned"}</strong></div>
                          </div>
                        </article>
                      </div>
                      <aside className="panel project-team-panel">
                        <SectionHeading
                          title="Team members"
                          action={<button className="text-button" type="button" onClick={() => setProjectDetailsTab("Team")}>View all</button>}
                        />
                        {selectedProjectMembers.length === 0 ? (
                          <div className="project-team-empty">
                            <span>No members assigned yet.</span>
                            <button className="text-button" type="button" onClick={() => openProjectModal(projectDetails)}>Assign members</button>
                          </div>
                        ) : (
                          <div className="project-team-list">
                            {selectedProjectMembers.slice(0, 5).map((member, index) => (
                              <div className="project-team-member" key={member._id}>
                                <Avatar
                                  initials={member.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                                  color={["avatar-purple", "avatar-blue", "avatar-orange"][index % 3]}
                                />
                                <span><strong>{member.name}</strong><small>{member.role}</small></span>
                              </div>
                            ))}
                          </div>
                        )}
                      </aside>
                    </div>
                    <section className="panel project-lifecycle-panel" aria-label="Project life cycle">
                      <div className="project-lifecycle-heading">
                        <div>
                          <h2>Project life cycle</h2>
                          <p>Stage indicators are estimated from overall project progress.</p>
                        </div>
                        <span>{projectDetails.progress}% overall</span>
                      </div>
                      <div className="project-lifecycle-grid">
                        {projectLifecycleStages.map(({ title, description, icon: Icon }, index) => {
                          const stageProgress = getProjectLifecycleStageProgress(projectDetails.progress, index);
                          const stageStatus = stageProgress === 100
                            ? "Complete"
                            : stageProgress > 0
                              ? "In progress"
                              : "Upcoming";
                          return (
                            <article className="project-lifecycle-stage" key={title}>
                              <div className="project-lifecycle-stage-heading">
                                <span className="project-lifecycle-icon"><Icon size={16} /></span>
                                <span className="project-lifecycle-index">Stage {index + 1}</span>
                              </div>
                              <h3>{title}</h3>
                              <p>{description}</p>
                              <div
                                className="project-lifecycle-track"
                                role="progressbar"
                                aria-label={`${title} progress`}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={stageProgress}
                                aria-valuetext={`${stageProgress}% ${stageStatus.toLowerCase()}`}
                              >
                                <span style={{ width: `${stageProgress}%` }} />
                              </div>
                              <div className="project-lifecycle-stage-status">
                                <span>{stageStatus}</span>
                                <strong>{stageProgress}%</strong>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  </>
                ) : projectDetailsTab === "Tasks" ? (
                  <section className="panel project-related-tasks">
                    <SectionHeading title={`Project tasks (${projectTasks.length})`} />
                    {projectTasks.length === 0 ? (
                      <p className="projects-empty">No tasks are linked to this project yet.</p>
                    ) : (
                      <div className="project-task-list">
                        {projectTasks.map((task) => (
                          <div className="project-task-row" key={task._id}>
                            <div><strong>{task.title}</strong><span>{task.assignee || "Unassigned"}</span></div>
                            <span className="task-status-label">{task.status}</span>
                            <span className={`priority-pill priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                            <span className="project-task-date">{formatProjectDate(task.dueDate)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ) : projectDetailsTab === "Team" ? (
                  <section className="panel project-related-team">
                    <SectionHeading
                      title={`Assigned members (${selectedProjectMembers.length})`}
                      action={canManageWorkspace
                        ? <button className="text-button" type="button" onClick={() => openProjectModal(projectDetails)}>Edit members</button>
                        : null}
                    />
                    {selectedProjectMembers.length === 0 ? (
                      <p className="projects-empty">No team members are assigned to this project.</p>
                    ) : (
                      <div className="team-member-grid">
                        {selectedProjectMembers.map((member, index) => (
                          <article className="team-member-card" key={member._id}>
                            <div className="team-member-heading">
                              <Avatar
                                initials={member.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                                color={["avatar-purple", "avatar-blue", "avatar-orange"][index % 3]}
                              />
                              <span className={`team-role role-${member.role.toLowerCase().replaceAll(" ", "-")}`}>
                                {member.role}
                              </span>
                            </div>
                            <h3>{member.name}</h3>
                            <a className="team-member-email" href={`mailto:${member.email}`}>{member.email}</a>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                ) : projectDetailsTab === "Files" ? (
                  <section className="panel project-related-files">
                    <SectionHeading
                      title={`Project files (${projectFiles.length})`}
                      action={canManageWorkspace && (
                        <label className="button button-primary file-upload-button">
                          {projectFileUploading ? "Uploading…" : "Upload file"}
                          <input
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.txt,.csv"
                            disabled={projectFileUploading}
                            onChange={uploadProjectFile}
                            type="file"
                          />
                        </label>
                      )}
                    />
                    {projectFilesError && <div className="api-notice offline" role="alert"><strong>{projectFilesError}</strong></div>}
                    {projectFilesLoading ? (
                      <p className="projects-empty">Loading files...</p>
                    ) : projectFiles.length === 0 ? (
                      <div className="project-details-empty">
                        <strong>No files uploaded yet</strong>
                        <span>Upload a document or image for this project. Maximum file size is 25 MB.</span>
                      </div>
                    ) : (
                      <div className="project-file-list">
                        {projectFiles.map((file) => (
                          <article className="project-file-row" key={file._id}>
                            <div>
                              <strong>{file.name}</strong>
                              <span>{formatFileSize(file.size)} · {formatProjectDate(file.createdAt)}</span>
                            </div>
                            <div className="project-file-actions">
                              <button type="button" onClick={() => downloadProjectFile(file)}>Download</button>
                              {canManageWorkspace && (
                                <button className="delete-action" type="button" onClick={() => deleteProjectFile(file)}>Delete</button>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                ) : (
                  <section className="panel project-related-activity">
                    <SectionHeading
                      title="Project activity"
                      action={<button className="text-button" type="button" onClick={loadProjectActivity}>Refresh</button>}
                    />
                    {projectActivityError && <div className="api-notice offline" role="alert"><strong>{projectActivityError}</strong></div>}
                    {projectActivityLoading ? (
                      <p className="projects-empty">Loading activity...</p>
                    ) : projectActivity.length === 0 ? (
                      <div className="project-details-empty">
                        <strong>No activity recorded yet</strong>
                        <span>Project and task changes will appear here.</span>
                      </div>
                    ) : (
                      <div className="project-activity-list">
                        {projectActivity.map((item) => (
                          <article className="project-activity-row" key={item._id}>
                            <span className="project-activity-marker" />
                            <div>
                              <p>{item.summary}</p>
                              <span>{item.actor?.name || "Workspace member"} · {formatProjectDate(item.createdAt)}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            ) : (
              <section className="panel project-details-empty">
                <strong>No project selected</strong>
                <button className="button button-outline" type="button" onClick={() => navigateTo("Projects")}>Back to projects</button>
              </section>
            )}
          </div>
        ) : activePage === "Tasks" ? (
          <div className="page-content tasks-page">
            <div className="welcome-row">
              <div>
                <p className="eyebrow">WORKSPACE WORK</p>
                <h1>Tasks</h1>
                <p className="subheading">Plan work, set priorities, and track progress across projects.</p>
              </div>
              {canManageWorkspace && (
                <button className="button button-primary" type="button" onClick={() => openTaskModal()}>
                  <Plus size={17} /> Add Task
                </button>
              )}
            </div>

            {tasksError && tasksData.length > 0 && <div className="api-notice offline" role="alert"><strong>{tasksError}</strong></div>}

            <div className="tasks-toolbar">
              <label className="task-project-filter">
                <span>Project</span>
                <select value={taskProjectFilter} onChange={(event) => setTaskProjectFilter(event.target.value)}>
                  <option value="">All projects</option>
                  {projectsData.map((project) => (
                    <option value={project._id} key={project._id}>{project.name}</option>
                  ))}
                </select>
              </label>
              <button className="button button-outline" type="button" onClick={loadTasks}>Refresh</button>
            </div>

            {tasksLoading ? (
              <section className="panel tasks-empty">Loading tasks...</section>
            ) : tasksLoadFailed ? (
              <section className="panel tasks-empty task-load-error" role="status">
                <strong>Couldn&apos;t load tasks</strong>
                <span>Check that the API is running, then try again.</span>
                <button className="button button-outline" type="button" onClick={loadTasks}>Try again</button>
              </section>
            ) : tasksData.length === 0 ? (
              <section className="panel tasks-empty">
                <ListTodo size={25} />
                <strong>No tasks yet</strong>
                <span>Create a task to start organizing your work.</span>
                <button className="button button-primary" type="button" onClick={() => openTaskModal()}>
                  <Plus size={15} /> Add Task
                </button>
              </section>
            ) : (
              <div className="task-board">
                {["To Do", "In Progress", "Review", "Completed"].map((status) => {
                  const visibleTasks = tasksData.filter((task) => {
                    const projectId = task.project?._id || task.project || "";
                    const matchesProject = !taskProjectFilter || projectId === taskProjectFilter;
                    const searchable = `${task.title} ${task.assignee || ""} ${task.project?.name || ""}`.toLowerCase();
                    return task.status === status && matchesProject && searchable.includes(query.toLowerCase());
                  });

                  return (
                    <section
                      className="task-column"
                      key={status}
                      aria-label={`${status} tasks`}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleTaskDrop(event, status)}
                    >
                      <div className="task-column-heading">
                        <h2>{status}</h2>
                        <span>{visibleTasks.length}</span>
                      </div>
                      <div className="task-card-list">
                        {visibleTasks.map((task) => (
                          <article
                            className={`task-card${draggedTaskId === task._id ? " task-card-dragging" : ""}`}
                            key={task._id}
                            draggable={canManageWorkspace || (task.assigneeUser?._id || task.assigneeUser) === currentUser._id}
                            onDragStart={(event) => {
                              event.dataTransfer.setData("text/plain", task._id);
                              event.dataTransfer.effectAllowed = "move";
                              setDraggedTaskId(task._id);
                            }}
                            onDragEnd={() => setDraggedTaskId(null)}
                          >
                            <div className="task-card-top">
                              <span className={`priority-pill priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                              {canManageWorkspace && (
                                <button type="button" className="task-delete" aria-label={`Delete ${task.title}`} onClick={() => deleteTask(task)}>×</button>
                              )}
                            </div>
                            <h3>{task.title}</h3>
                            {task.description && <p className="task-description">{task.description}</p>}
                            <span className="task-project-name">{task.project?.name || "No project"}</span>
                            <div className="task-card-meta">
                              <span>{task.assignee || "Unassigned"}</span>
                              {task.dueDate && (
                                <time dateTime={task.dueDate}>
                                  {new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
                                    new Date(`${task.dueDate.slice(0, 10)}T00:00:00`),
                                  )}
                                </time>
                              )}
                            </div>
                            <div className="task-card-actions">
                              {canManageWorkspace && <button type="button" onClick={() => openTaskModal(task)}>Edit</button>}
                              <select
                                aria-label={`Change status for ${task.title}`}
                                disabled={!canManageWorkspace && (task.assigneeUser?._id || task.assigneeUser) !== currentUser._id}
                                value={task.status}
                                onChange={(event) => updateTaskStatus(task, event.target.value)}
                              >
                                {["To Do", "In Progress", "Review", "Completed"].map((option) => (
                                  <option key={option}>{option}</option>
                                ))}
                              </select>
                            </div>
                          </article>
                        ))}
                        {visibleTasks.length === 0 && <p className="task-column-empty">No tasks</p>}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        ) : activePage === "Calendar" ? (
          <div className="page-content calendar-page">
            <div className="welcome-row">
              <div>
                <p className="eyebrow">WORKSPACE SCHEDULE</p>
                <h1>Calendar</h1>
                <p className="subheading">Select a day to review its schedule or create a calendar event.</p>
              </div>
              {canManageWorkspace && (
                <button className="button button-primary" type="button" onClick={() => openCalendarEventModal()}>
                  <Plus size={17} /> New event
                </button>
              )}
            </div>

            {calendarError && !calendarEventModal && (
              <div className="api-notice offline" role="alert">
                <strong>{calendarError}</strong>
                <button className="text-button" type="button" onClick={loadCalendarEvents}>Try again</button>
              </div>
            )}

            <section className="panel calendar-panel">
              <div className="calendar-toolbar">
                <div className="calendar-title">
                  <button
                    className="calendar-nav"
                    type="button"
                    aria-label="Previous month"
                    onClick={() => {
                      const month = new Date(calendarYear, calendarMonth - 1, 1);
                      setCalendarDate(month);
                      setSelectedCalendarDate(formatCalendarDateKey(month));
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <h2>{monthLabel}</h2>
                  <button
                    className="calendar-nav"
                    type="button"
                    aria-label="Next month"
                    onClick={() => {
                      const month = new Date(calendarYear, calendarMonth + 1, 1);
                      setCalendarDate(month);
                      setSelectedCalendarDate(formatCalendarDateKey(month));
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <button className="button button-outline" type="button" onClick={() => {
                  const today = new Date();
                  setCalendarDate(today);
                  setSelectedCalendarDate(formatCalendarDateKey(today));
                }}>
                  Today
                </button>
              </div>

              <div className="calendar-weekdays" aria-hidden="true">
                {calendarWeekdays.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {calendarCells.map((date) => {
                  const isCurrentMonth = date.getMonth() === calendarMonth;
                  const isToday = date.toDateString() === new Date().toDateString();
                  const dateKey = formatCalendarDateKey(date);
                  const isSelected = dateKey === selectedCalendarDate;
                  const dayEvents = calendarEvents.filter((event) =>
                    event.date === dateKey,
                  );

                  return (
                    <div
                      className={`calendar-cell${isCurrentMonth ? "" : " outside-month"}${isToday ? " today" : ""}${isSelected ? " selected" : ""}`}
                      key={dateKey}
                    >
                      <button
                        className="calendar-day"
                        type="button"
                        aria-label={`Select ${formatCalendarDateLabel(dateKey)}`}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedCalendarDate(dateKey);
                          if (!isCurrentMonth) setCalendarDate(new Date(date.getFullYear(), date.getMonth(), 1));
                        }}
                      >
                        {date.getDate()}
                      </button>
                      <div className="calendar-events">
                        {dayEvents.slice(0, 3).map((event) => (
                          <button
                            className={`calendar-event ${event.color}`}
                            type="button"
                            key={event.id}
                            title={`${event.kind}: ${event.title}`}
                            onClick={() => setSelectedCalendarDate(event.date)}
                          >
                            {event.title}
                          </button>
                        ))}
                        {dayEvents.length > 3 && (
                          <button
                            className="calendar-more"
                            type="button"
                            onClick={() => setSelectedCalendarDate(dateKey)}
                            aria-label={`Show all ${dayEvents.length} events for ${formatCalendarDateLabel(dateKey)}`}
                          >
                            +{dayEvents.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel calendar-agenda" aria-live="polite">
              <div className="calendar-agenda-heading">
                <div>
                  <p className="eyebrow">DAY SCHEDULE</p>
                  <h2>{formatCalendarDateLabel(selectedCalendarDate)}</h2>
                </div>
                {canManageWorkspace && (
                  <button className="button button-outline" type="button" onClick={() => openCalendarEventModal(null, selectedCalendarDate)}>
                    <Plus size={15} /> Add event
                  </button>
                )}
              </div>
              {calendarLoading ? (
                <p className="calendar-agenda-empty">Loading calendar events...</p>
              ) : selectedCalendarEvents.length === 0 ? (
                <div className="calendar-agenda-empty">
                  <span>No events on this day.</span>
                  {canManageWorkspace && (
                    <button className="text-button" type="button" onClick={() => openCalendarEventModal(null, selectedCalendarDate)}>
                      Create an event
                    </button>
                  )}
                </div>
              ) : (
                <div className="calendar-agenda-list">
                  {selectedCalendarEvents.map((event) => (
                    <article className="calendar-agenda-event" key={event.id}>
                      <span className={`calendar-kind ${event.color}`}>{event.kind}</span>
                      <div className="calendar-agenda-copy">
                        <strong>{event.title}</strong>
                        {event.description && <p>{event.description}</p>}
                      </div>
                      {event.editable && canManageWorkspace && (
                        <div className="calendar-agenda-actions">
                          <button type="button" onClick={() => openCalendarEventModal(event)}>Edit</button>
                          <button type="button" className="delete-action" onClick={() => deleteCalendarEvent(event)}>Delete</button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="calendar-legend" aria-label="Calendar legend">
              <span><i className="legend-dot green-dot" /> Meetings</span>
              <span><i className="legend-dot orange-dot" /> Events</span>
              <span><i className="legend-dot violet-dot" /> Projects</span>
              <span><i className="legend-dot blue-dot" /> Tasks</span>
            </section>
          </div>
        ) : activePage === "Team" ? (
          <div className="page-content team-page">
            <div className="welcome-row">
              <div>
                <p className="eyebrow">WORKSPACE DIRECTORY</p>
                <h1>Team</h1>
                <p className="subheading">Manage {currentWorkspaceName} members, roles, and invitations.</p>
              </div>
              {canManageWorkspace && (
                <button className="button button-primary" type="button" onClick={() => openTeamMemberModal()}>
                  <Plus size={17} /> Invite Member
                </button>
              )}
            </div>

            {teamFeedback && <div className="settings-success" role="status">{teamFeedback}</div>}
            {teamError && teamMembers.length > 0 && (
              <div className="api-notice offline" role="alert"><strong>{teamError}</strong></div>
            )}

            <section className="panel team-directory-panel">
              <SectionHeading
                title={`${teamMembers.length} team member${teamMembers.length === 1 ? "" : "s"}`}
                action={<button className="text-button" type="button" onClick={loadTeam}>Refresh</button>}
              />
              {teamLoading ? (
                <p className="team-empty">Loading team members...</p>
              ) : teamError && teamMembers.length === 0 ? (
                <div className="team-empty team-load-error" role="status">
                  <strong>Couldn&apos;t load team members</strong>
                  <span>{teamError}</span>
                  <button className="button button-outline" type="button" onClick={loadTeam}>Try again</button>
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="team-empty">
                  <Users size={27} />
                  <strong>Your workspace has no members</strong>
                  <span>Invite people to collaborate in this workspace.</span>
                </div>
              ) : (
                <div className="team-member-grid">
                  {teamMembers
                    .filter((member) =>
                      `${member.name} ${member.email} ${member.role}`.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((member, index) => (
                      <article className="team-member-card" key={member._id}>
                        <div className="team-member-heading">
                          <Avatar
                            initials={member.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                            color={["avatar-purple", "avatar-blue", "avatar-orange"][index % 3]}
                          />
                          <span className={`team-role role-${member.role.toLowerCase().replaceAll(" ", "-")}`}>
                            {member.role}
                          </span>
                        </div>
                        <h3>{member.name}</h3>
                        <a className="team-member-email" href={`mailto:${member.email}`}>{member.email}</a>
                        <span className={`team-member-status${member.status === "Pending" ? " pending" : ""}`}>
                          {member.status || "Active"}
                        </span>
                        <div className="team-member-actions">
                          {member.status !== "Pending" && canManageWorkspace && (isWorkspaceAdministrator || !member.account) && (
                            <button type="button" onClick={() => openTeamMemberModal(member)}>Edit</button>
                          )}
                          {member.status !== "Pending" && isWorkspaceAdministrator && (
                            <button type="button" className="delete-action" onClick={() => deleteTeamMember(member)}>Remove</button>
                          )}
                        </div>
                      </article>
                    ))}
                  {teamMembers.filter((member) =>
                    `${member.name} ${member.email} ${member.role}`.toLowerCase().includes(query.toLowerCase()),
                  ).length === 0 && <p className="team-search-empty">No members match “{query}”.</p>}
                </div>
              )}
            </section>

            {canManageWorkspace && (
              <section className="panel team-invitations-panel">
                <SectionHeading title={`Pending invitations (${teamInvitations.length})`} action={
                  <button className="text-button" type="button" onClick={loadTeamInvitations}>Refresh</button>
                } />
                {teamInvitations.length === 0 ? (
                  <p className="projects-empty">There are no pending invitations.</p>
                ) : (
                  <div className="team-invitation-list">
                    {teamInvitations.map((invitation) => (
                      <article className="team-invitation-row" key={invitation._id}>
                        <div>
                          <strong>{invitation.name}</strong>
                          <span>{invitation.email} · {invitation.role}</span>
                          <small>Expires {formatProjectDate(invitation.expiresAt)}</small>
                        </div>
                        <div className="team-member-actions">
                          {(isWorkspaceAdministrator || invitation.role !== "Project Manager") && (
                            <button type="button" onClick={() => resendTeamInvitation(invitation)}>Resend</button>
                          )}
                          {isWorkspaceAdministrator && (
                            <button className="delete-action" type="button" onClick={() => revokeTeamInvitation(invitation)}>Revoke</button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        ) : activePage === "Settings" ? (
          <div className="page-content settings-page">
            <div className="welcome-row">
              <div>
                <p className="eyebrow">YOUR WORKSPACE</p>
                <h1>Settings</h1>
                <p className="subheading">Manage your profile and NexaFlow preferences.</p>
              </div>
              <div className="settings-header-actions">
                <button className="button button-outline" onClick={logout} type="button"><LogOut size={16} /> Sign out</button>
                <button className="button button-primary" disabled={!settingsLoaded} form="settings-form" type="submit">
                  Save changes
                </button>
              </div>
            </div>

            {authError && <div className="api-notice offline" role="alert"><strong>{authError}</strong></div>}
            {settingsError && <div className="api-notice offline" role="alert"><strong>{settingsError}</strong></div>}
            {settingsFeedback && <div className="settings-success" role="status">{settingsFeedback}</div>}

            <form className="settings-form" id="settings-form" onSubmit={saveSettings}>
              <section className="panel settings-panel" id="profile-settings">
                <div className="settings-section-heading">
                  <span className="settings-section-icon"><Users size={17} /></span>
                  <div>
                    <h2>Profile</h2>
                    <p>Update the name and contact details shown in your workspace.</p>
                  </div>
                </div>
                <div className="settings-profile">
                  <Avatar initials={profileInitials} color="avatar-photo" />
                  <div><strong>{profileName}</strong><span>{profileRole}</span></div>
                </div>
                <div className="settings-field-grid">
                  <label>
                    Full name
                    <input
                      autoComplete="name"
                      maxLength={100}
                      required
                      value={currentUser.name}
                      onChange={(event) => updateCurrentUser({ name: event.target.value })}
                    />
                  </label>
                  <label>
                    Email address
                    <input
                      autoComplete="email"
                      maxLength={254}
                      required
                      type="email"
                      value={currentUser.email}
                      onChange={(event) => updateCurrentUser({ email: event.target.value })}
                    />
                  </label>
                </div>
                <div className="settings-role">
                  <span>Workspace role</span>
                  <strong>{profileRole}</strong>
                  <small>Roles are managed by your workspace administrator.</small>
                </div>
              </section>

              <section className="panel settings-panel" id="preference-settings">
                <div className="settings-section-heading">
                  <span className="settings-section-icon"><CalendarDays size={17} /></span>
                  <div>
                    <h2>Preferences</h2>
                    <p>Choose how NexaFlow presents your calendar and workspace.</p>
                  </div>
                </div>
                <div className="settings-preferences-grid">
                  <label className="settings-select-field">
                    Week starts on
                    <select
                      value={settings.weekStartsOn}
                      onChange={(event) => updateSettings({ weekStartsOn: event.target.value })}
                    >
                      <option>Monday</option>
                      <option>Sunday</option>
                    </select>
                    <small>This also changes the calendar layout.</small>
                  </label>
                  <label className="settings-toggle">
                    <span>
                      <strong>Compact layout</strong>
                      <small>Reduce spacing across dashboard panels and lists.</small>
                    </span>
                    <input
                      checked={settings.compactView}
                      onChange={(event) => updateSettings({ compactView: event.target.checked })}
                      type="checkbox"
                    />
                  </label>
                  <label className="settings-toggle">
                    <span>
                      <strong>Dark mode</strong>
                      <small>Use a darker color theme across NexaFlow.</small>
                    </span>
                    <input
                      checked={settings.darkMode}
                      onChange={(event) => updateSettings({ darkMode: event.target.checked })}
                      type="checkbox"
                    />
                  </label>
                </div>
              </section>

              <section className="panel settings-panel" id="notification-settings">
                <div className="settings-section-heading">
                  <span className="settings-section-icon"><Bell size={17} /></span>
                  <div>
                    <h2>Notifications</h2>
                    <p>Choose which workspace alerts you want to receive by email.</p>
                  </div>
                </div>
                <div className="settings-notification-list">
                  {[
                    ["taskAssignments", "Task assignments", "When a task is assigned to you."],
                    ["dueDateReminders", "Due-date reminders", "The day before assigned tasks are due (UTC), with due-day catch-up."],
                    ["projectUpdates", "Project updates", "Changes to projects across your workspace."],
                    ["weeklySummary", "Weekly summary", "A summary of activity and upcoming work."],
                  ].map(([key, title, description]) => (
                    <label className="settings-toggle" key={key}>
                      <span>
                        <strong>{title}</strong>
                        <small>{description}</small>
                      </span>
                      <input
                        checked={settings.notifications[key]}
                        onChange={(event) => updateSettings({
                          notifications: {
                            ...settings.notifications,
                            [key]: event.target.checked,
                          },
                        })}
                        type="checkbox"
                      />
                    </label>
                  ))}
                </div>
                <p className="settings-disclaimer">Preferences are saved to your account. Email delivery requires SMTP; due-date reminders use UTC.</p>
              </section>

              <div className="settings-save-row">
                <span>Changes are saved only after you select Save changes.</span>
                <button className="button button-primary" disabled={!settingsLoaded} type="submit">Save changes</button>
              </div>
            </form>

            <form className="settings-form password-form" onSubmit={changePassword}>
              <section className="panel settings-panel" id="password-settings">
                <div className="settings-section-heading">
                  <span className="settings-section-icon"><LockKeyhole size={17} /></span>
                  <div>
                    <h2>Change password</h2>
                    <p>Verify your current password before choosing a new one.</p>
                  </div>
                </div>
                {passwordError && <div className="api-notice offline" role="alert"><strong>{passwordError}</strong></div>}
                {passwordFeedback && <div className="settings-success" role="status">{passwordFeedback}</div>}
                <div className="settings-field-grid password-field-grid">
                  <label>
                    Current password
                    <input
                      autoComplete="current-password"
                      disabled={passwordBusy}
                      maxLength={128}
                      onChange={(event) => updatePasswordForm({ currentPassword: event.target.value })}
                      required
                      type="password"
                      value={passwordForm.currentPassword}
                    />
                  </label>
                  <label>
                    New password
                    <input
                      autoComplete="new-password"
                      disabled={passwordBusy}
                      maxLength={128}
                      minLength={8}
                      onChange={(event) => updatePasswordForm({ newPassword: event.target.value })}
                      required
                      type="password"
                      value={passwordForm.newPassword}
                    />
                  </label>
                  <label>
                    Confirm new password
                    <input
                      autoComplete="new-password"
                      disabled={passwordBusy}
                      maxLength={128}
                      minLength={8}
                      onChange={(event) => updatePasswordForm({ confirmPassword: event.target.value })}
                      required
                      type="password"
                      value={passwordForm.confirmPassword}
                    />
                  </label>
                </div>
                <p className="settings-disclaimer">Use 8–128 characters. Other active sessions will be signed out.</p>
                <div className="password-submit-row">
                  <button className="button button-primary" disabled={passwordBusy} type="submit">
                    {passwordBusy ? "Updating…" : "Update password"}
                  </button>
                </div>
              </section>
            </form>
          </div>
        ) : activePage === "Notifications" ? (
          <div className="page-content notifications-page">
            <div className="welcome-row">
              <div>
                <p className="eyebrow">WORKSPACE UPDATES</p>
                <h1>Notifications</h1>
                <p className="subheading">Recent overdue items and work coming up in the next 7 days.</p>
              </div>
              <button
                className="button button-outline"
                disabled={unreadNotificationCount === 0}
                onClick={markAllNotificationsRead}
                type="button"
              >
                Mark all as read
              </button>
            </div>

            {notificationLoadErrors.length > 0 && (
              <div className="api-notice offline" role="alert">
                <div>
                  <strong>Some updates could not be loaded.</strong>
                  <span>{notificationLoadErrors.join(" · ")}</span>
                </div>
                <button className="text-button" type="button" onClick={() => {
                  loadProjects();
                  loadTasks();
                  loadCalendarEvents();
                }}>
                  Try again
                </button>
              </div>
            )}
            {notificationStorageError && (
              <div className="api-notice offline" role="alert"><strong>{notificationStorageError}</strong></div>
            )}

            <section className="panel notification-center">
              <nav className="notification-filters" aria-label="Notification filters">
                {["All", "Unread", "Projects", "Tasks", "Calendar"].map((filter) => (
                  <button
                    className={notificationFilter === filter ? "active" : ""}
                    key={filter}
                    onClick={() => setNotificationFilter(filter)}
                    aria-pressed={notificationFilter === filter}
                    type="button"
                  >
                    {filter}
                    <span>{notificationFilterCounts[filter]}</span>
                  </button>
                ))}
              </nav>

              {projectsLoading || tasksLoading || calendarLoading || serverNotificationsLoading ? (
                <div className="notification-empty">Loading updates...</div>
              ) : filteredNotifications.length === 0 ? (
                <div className="notification-empty">
                  <span className="notification-empty-icon"><Bell size={20} /></span>
                  <strong>{notificationFilter === "Unread" ? "You are all caught up" : "No notifications yet"}</strong>
                  <span>
                    {notificationFilter === "Unread"
                      ? "There are no unread updates."
                      : "Upcoming deadlines and calendar events will appear here."}
                  </span>
                </div>
              ) : (
                <div className="notification-list">
                  {filteredNotifications.map((notification) => {
                        const isRead = isNotificationRead(notification);
                    const Icon = notification.category === "Tasks"
                      ? ListTodo
                      : notification.category === "Projects"
                        ? FolderKanban
                        : CalendarDays;
                    return (
                      <article
                        className={`notification-item${isRead ? " read" : " unread"}`}
                        key={notification.id}
                      >
                        <span className={`notification-item-icon ${notification.category.toLowerCase()}`}>
                          <Icon size={17} />
                        </span>
                        <div className="notification-item-copy">
                          <div className="notification-item-title">
                            {!isRead && <span className="notification-unread-dot" />}
                            <strong>{notification.title}</strong>
                            <span className="notification-category">{notification.category}</span>
                          </div>
                          <p>{notification.detail}</p>
                          <time dateTime={`${notification.date}T00:00:00`}>
                            {formatProjectDate(notification.date)}
                          </time>
                        </div>
                        <div className="notification-item-actions">
                          <button type="button" onClick={() => openNotification(notification)}>Open</button>
                          {!isRead && (
                            <button type="button" onClick={() => markNotificationRead(notification.id)}>
                              Mark read
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              <p className="notification-disclaimer">Updates are generated from current project, task, and calendar data. Read status is saved in this browser.</p>
            </section>
          </div>
        ) : (
          <section className="coming-soon">
            <div className="coming-icon">
              {activePage === "Projects" ? <FolderKanban size={26} /> : activePage === "Tasks" ? <ListTodo size={26} /> : activePage === "Calendar" ? <CalendarDays size={26} /> : activePage === "Notifications" ? <Bell size={26} /> : <Users size={26} />}
            </div>
            <p className="eyebrow">TASKFLOW WORKSPACE</p>
            <h1>{activePage}</h1>
            <p>This area is not available yet. Use the workspace navigation to choose another section.</p>
            <button className="button button-outline" onClick={() => navigateTo("Dashboard")} type="button"><ChevronLeft size={16} /> Back to dashboard</button>
          </section>
        )}
      </main>
      <AppFooter />
      {projectModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setProjectModal(null);
        }}>
          <form className="project-modal" onSubmit={saveProject}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">PROJECT DETAILS</p>
                <h2>{editingProjectId ? "Edit project" : "Create project"}</h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setProjectModal(null)}>×</button>
            </div>
            {projectError && <div className="form-error">{projectError}</div>}
            {teamError && <div className="form-error" role="alert">{teamError}</div>}
            <label>
              Project name
              <input
                required
                maxLength={120}
                value={projectForm.name}
                onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                maxLength={2000}
                value={projectForm.description}
                onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Status
                <select value={projectForm.status} onChange={(event) => setProjectForm({ ...projectForm, status: event.target.value })}>
                  <option>Planning</option>
                  <option>In Progress</option>
                  <option>On Hold</option>
                  <option>Completed</option>
                </select>
              </label>
              <label>
                Priority
                <select value={projectForm.priority} onChange={(event) => setProjectForm({ ...projectForm, priority: event.target.value })}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>
              <label>
                Manager
                <input
                  maxLength={100}
                  value={projectForm.manager}
                  onChange={(event) => setProjectForm({ ...projectForm, manager: event.target.value })}
                />
              </label>
              <label>
                Start date
                <input
                  type="date"
                  value={projectForm.startDate}
                  onChange={(event) => setProjectForm({ ...projectForm, startDate: event.target.value })}
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  value={projectForm.dueDate}
                  onChange={(event) => setProjectForm({ ...projectForm, dueDate: event.target.value })}
                />
              </label>
              <label className="project-member-picker">
                Team members
                <select
                  multiple
                  size={4}
                  value={projectForm.teamMembers}
                  onChange={(event) => setProjectForm({
                    ...projectForm,
                    teamMembers: Array.from(event.currentTarget.selectedOptions, (option) => option.value),
                  })}
                >
                  {teamMembers.filter((member) => member.status !== "Pending").map((member) => (
                    <option value={member._id} key={member._id}>{member.name} · {member.role}</option>
                  ))}
                </select>
                <small>
                  {teamMembers.some((member) => member.status !== "Pending")
                    ? "Select one or more members from the Team directory."
                    : "Add team members first to assign them to this project."}
                </small>
              </label>
              <label className="progress-field">
                Progress ({projectForm.progress}%)
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={projectForm.progress}
                  onChange={(event) => setProjectForm({ ...projectForm, progress: event.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button button-outline" onClick={() => setProjectModal(null)}>Cancel</button>
              <button type="submit" className="button button-primary">{editingProjectId ? "Save changes" : "Create project"}</button>
            </div>
          </form>
        </div>
      )}
      {taskModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setTaskModal(false);
        }}>
          <form className="project-modal task-modal" onSubmit={saveTask}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">TASK DETAILS</p>
                <h2>{editingTaskId ? "Edit task" : "Create task"}</h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setTaskModal(false)}>×</button>
            </div>
            {tasksError && <div className="form-error" role="alert">{tasksError}</div>}
            <label>
              Task title
              <input
                required
                maxLength={160}
                value={taskForm.title}
                onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                maxLength={2000}
                value={taskForm.description}
                onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Project
                <select value={taskForm.project} onChange={(event) => setTaskForm({ ...taskForm, project: event.target.value })}>
                  <option value="">No project</option>
                  {projectsData.map((project) => (
                    <option value={project._id} key={project._id}>{project.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select value={taskForm.status} onChange={(event) => setTaskForm({ ...taskForm, status: event.target.value })}>
                  <option>To Do</option>
                  <option>In Progress</option>
                  <option>Review</option>
                  <option>Completed</option>
                </select>
              </label>
              <label>
                Priority
                <select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value })}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>
              <label>
                Assignee
                <select
                  value={taskForm.assigneeUser}
                  onChange={(event) => {
                    const assigneeUser = event.target.value;
                    setTaskForm({
                      ...taskForm,
                      assigneeUser,
                      assignee: teamAccounts.find((member) => member._id === assigneeUser)?.name || "",
                    });
                  }}
                >
                  <option value="">{taskForm.assignee ? `${taskForm.assignee} (unlinked)` : "Unassigned"}</option>
                  {teamAccounts.map((member) => (
                    <option value={member._id} key={member._id}>{member.name} · {member.role}</option>
                  ))}
                </select>
              </label>
              <label>
                Due date
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button button-outline" onClick={() => setTaskModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary">{editingTaskId ? "Save changes" : "Create task"}</button>
            </div>
          </form>
        </div>
      )}
      {calendarEventModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCalendarEventModal(false);
        }}>
          <form className="project-modal calendar-event-modal" onSubmit={saveCalendarEvent}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">CALENDAR</p>
                <h2>{editingCalendarEventId ? "Edit event" : "Create event"}</h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setCalendarEventModal(false)}>×</button>
            </div>
            {calendarError && <div className="form-error" role="alert">{calendarError}</div>}
            <label>
              Event title
              <input
                autoFocus
                maxLength={120}
                required
                value={calendarEventForm.title}
                onChange={(event) => setCalendarEventForm({ ...calendarEventForm, title: event.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                maxLength={1000}
                value={calendarEventForm.description}
                onChange={(event) => setCalendarEventForm({ ...calendarEventForm, description: event.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Date
                <input
                  required
                  type="date"
                  value={calendarEventForm.date}
                  onChange={(event) => setCalendarEventForm({ ...calendarEventForm, date: event.target.value })}
                />
              </label>
              <label>
                Event type
                <select
                  value={calendarEventForm.kind}
                  onChange={(event) => setCalendarEventForm({ ...calendarEventForm, kind: event.target.value })}
                >
                  <option>Meeting</option>
                  <option>Deadline</option>
                  <option>Reminder</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button button-outline" onClick={() => setCalendarEventModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary">{editingCalendarEventId ? "Save changes" : "Create event"}</button>
            </div>
          </form>
        </div>
      )}
      {teamModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setTeamModal(false);
        }}>
          <form className="project-modal team-modal" onSubmit={saveTeamMember}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">TEAM DIRECTORY</p>
                <h2>{editingTeamMemberId ? "Edit member" : "Invite team member"}</h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setTeamModal(false)}>×</button>
            </div>
            {teamError && <div className="form-error" role="alert">{teamError}</div>}
            {!editingTeamMemberId && (
              <p className="settings-disclaimer">They will receive a one-time email invitation to join {currentWorkspaceName}.</p>
            )}
            <label>
              Full name
              <input
                autoComplete="name"
                required
                maxLength={100}
                value={teamForm.name}
                onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })}
              />
            </label>
            <label>
              Email
              <input
                autoComplete="email"
                required
                type="email"
                maxLength={254}
                disabled={Boolean(editingTeamMemberId && teamMembers.find((member) => member._id === editingTeamMemberId)?.account)}
                value={teamForm.email}
                onChange={(event) => setTeamForm({ ...teamForm, email: event.target.value })}
              />
            </label>
            <label>
              Workspace role
              <select
                disabled={Boolean(editingTeamMemberId && teamMembers.find((member) => member._id === editingTeamMemberId)?.account && !isWorkspaceAdministrator)}
                value={teamForm.role}
                onChange={(event) => setTeamForm({ ...teamForm, role: event.target.value })}
              >
                {editingTeamMemberId && <option>Administrator</option>}
                <option>Project Manager</option>
                <option>Team Member</option>
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="button button-outline" onClick={() => setTeamModal(false)}>Cancel</button>
              <button type="submit" className="button button-primary">
                {editingTeamMemberId ? "Save changes" : "Send invitation"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
