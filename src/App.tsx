/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, FormEvent } from "react";
import { 
  DEFAULT_WORKOUT_PLANS, 
  DEFAULT_DIET_PLANS, 
  Member, 
  WorkoutPlan, 
  DietPlan, 
  GymAnnouncement, 
  GymNotification, 
  PlanChangeRequest,
  Exercise
} from "./types";
import { saveDocument, deleteDocument, subscribeCollection, seedCollectionIfEmpty, getCollectionData, auth, getDocument, googleProvider } from "./firebase";
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  updateProfile,
  User as FirebaseUser 
} from "firebase/auth";

import BoardingPass from "./components/BoardingPass";
import NotificationCenter from "./components/NotificationCenter";
import SwipeableMonthCalendar from "./components/SwipeableMonthCalendar";
import { QRCodeSVG } from "qrcode.react";

// Lazy-loaded heavy components for smaller initial bundle
const WeightChart = React.lazy(() => import("./components/WeightChart"));
const AttendanceScanner = React.lazy(() => import("./components/AttendanceScanner"));

// Attendance QR token — must match the value in AttendanceScanner.tsx
const ATTENDANCE_TOKEN = "singh-fitness-gym-attend-v1";

import { 
  Dumbbell, 
  Flame, 
  QrCode, 
  Check, 
  Droplet, 
  Plus, 
  Minus, 
  Home, 
  ClipboardList, 
  Trophy, 
  User, 
  X, 
  Sparkles, 
  Clock, 
  Moon, 
  Scale, 
  Utensils, 
  Camera, 
  Phone, 
  ChevronRight, 
  Search, 
  TrendingDown, 
  AlertTriangle, 
  AlertCircle,
  Send, 
  Sliders, 
  Bell, 
  Activity, 
  DollarSign, 
  LogOut, 
  Info,
  Play,
  LayoutDashboard,
  Users,
  Trash2,
  FileText
} from "lucide-react";

export default function App() {
  // --- Database State (source of truth: Firebase, cached in localStorage) ---
  const [members, setMembers] = useState<Member[]>([]);
  const [announcements, setAnnouncements] = useState<GymAnnouncement[]>([]);
  const [notifications, setNotifications] = useState<GymNotification[]>([]);
  const [planRequests, setPlanRequests] = useState<PlanChangeRequest[]>([]);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [dietPlans, setDietPlans] = useState<DietPlan[]>([]);

  // --- Active Session Management ---
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeRole, setActiveRole] = useState<"member" | "admin" | "visitor" | "pending" | "expired">("pending");
  const [activeMemberId, setActiveMemberId] = useState<string>("");

  // Tabs
  const [activeMemberTab, setActiveMemberTab] = useState<"home" | "fitness" | "progress" | "profile">("home");
  const [activeAdminTab, setActiveAdminTab] = useState<"dashboard" | "members" | "settings">("dashboard");

  // Section Shifters
  const [activeSettingsSection, setActiveSettingsSection] = useState<"payment" | "announcement" | "workout" | "diet" | "qr">("payment");
  const [activeFitnessSection, setActiveFitnessSection] = useState<"workout" | "diet">("workout");
  const [activePerformanceSection, setActivePerformanceSection] = useState<"report" | "leaderboard">("report");

  // Current selected member to view details in Admin Panel
  const [inspectedMemberId, setInspectedMemberId] = useState<string>("member-satnam");
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [activePopupType, setActivePopupType] = useState<"active" | "today" | "expiring" | "pending" | null>(null);
  const [popupSearchQuery, setPopupSearchQuery] = useState("");

  // --- UI Interactive State ---
  const [showScanner, setShowScanner] = useState(false);
  const [scanningState, setScanningState] = useState<"idle" | "reading" | "success" | "expired">("idle");
  const [showVideoModal, setShowVideoModal] = useState<Exercise | null>(null);
  
  // Modals for members to update data
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [newWeightInput, setNewWeightInput] = useState("");
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [newSleepInput, setNewSleepInput] = useState("");

  // Plan Explorer Change Modal
  const [showPlanRequestModal, setShowPlanRequestModal] = useState(false);

  // Admin Assignment Drawer State
  const [assigningMember, setAssigningMember] = useState<Member | null>(null);
  const [selectedWorkoutPlan, setSelectedWorkoutPlan] = useState("power-builder");
  const [selectedDietPlan, setSelectedDietPlan] = useState("clean-bulk");
  const [trainerNoteInput, setTrainerNoteInput] = useState("");
  const [membershipDurationInput, setMembershipDurationInput] = useState("3 Months");

  // Admin New Plan Creation State
  const [bWorkoutName, setBWorkoutName] = useState("");
  const [bWorkoutDesc, setBWorkoutDesc] = useState("");
  const [bWorkoutFocus, setBWorkoutFocus] = useState("Muscle gain");
  const [bWorkoutPrice, setBWorkoutPrice] = useState("1499");

  // Detailed Workout Day Schedules
  const [bSelectedDay, setBSelectedDay] = useState("Monday");
  const [bExerciseName, setBExerciseName] = useState("");
  const [bExerciseSets, setBExerciseSets] = useState("4 sets x 10 reps");
  const [bExerciseTutorial, setBExerciseTutorial] = useState("");
  const [bExercisePrecautions, setBExercisePrecautions] = useState("");
  const [bExerciseSteps, setBExerciseSteps] = useState("");
  const [bExerciseVideoUrl, setBExerciseVideoUrl] = useState("");

  const [bWorkoutDays, setBWorkoutDays] = useState<{ [day: string]: Exercise[] }>({
    "Monday": [],
    "Tuesday": [],
    "Wednesday": [],
    "Thursday": [],
    "Friday": [],
    "Saturday": [],
    "Sunday": []
  });

  const [bDietName, setBDietName] = useState("");
  const [bDietDesc, setBDietDesc] = useState("");
  const [bDietProtein, setBDietProtein] = useState("150");
  const [bDietCarbs, setBDietCarbs] = useState("200");
  const [bDietFats, setBDietFats] = useState("65");

  // Detailed Dietary Meals State
  const [bMealName, setBMealName] = useState("");
  const [bMealDesc, setBMealDesc] = useState("");
  const [bDietMeals, setBDietMeals] = useState<{ id: string; name: string; desc: string; completed: boolean }[]>([]);

  // Gym Config State (QR code / UPI configurations)
  const [gymConfig, setGymConfig] = useState({
    upiId: "pay@singh-fitness",
    qrCodeUrl: ""
  });

  // Admin Payment Configuration State
  const [bUpiId, setBUpiId] = useState("");
  const [bQrCodeUrl, setBQrCodeUrl] = useState("");

  useEffect(() => {
    setBUpiId(gymConfig.upiId);
    setBQrCodeUrl(gymConfig.qrCodeUrl);
  }, [gymConfig]);

  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState("");
  const [newAnnouncementContent, setNewAnnouncementContent] = useState("");

  // Search Members Filter
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [leaderboardSearchQuery, setLeaderboardSearchQuery] = useState("");

  // Clock
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  // Visitor Registration state
  const [regForm, setRegForm] = useState({
    name: "",
    phone: "",
    address: "",
    height: 178,
    weight: 79.5,
    targetWeight: 75.0,
    preferredShift: "Morning Shift" as "Morning Shift" | "Evening Shift",
    goals: "Muscle Gain & Strength",
    gymAccess: "Full gym plus cardio [ 1700 rupee/month ]",
    referralCode: ""
  });
  const [regStep, setRegStep] = useState<1 | 2>(1); // 1: Info, 2: Payment checkout
  const [renewalDuration, setRenewalDuration] = useState("1 Month");

  // Toast banner
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);

  // --- Firebase Auth Form State & Handlers ---
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // --- Auth State Change Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const profile = await getDocument<Member>("members", user.uid);
          if (profile) {
            setActiveMemberId(user.uid);
            // Update roles
            if (profile.role === "admin") {
              setActiveRole("admin");
            } else if (profile.status === "Pending Approval") {
              setActiveRole("pending");
            } else if (profile.status === "Expired") {
              setActiveRole("expired");
            } else {
              setActiveRole("member");
            }
          } else {
            // Profile doesn't exist yet, we will show the registration form in the visitor layout
            setRegForm(prev => ({
              ...prev,
              name: prev.name || user.displayName || ""
            }));
            setActiveMemberId("");
            setActiveRole("visitor");
          }
        } catch (err) {
          console.error("Auth state loading error:", err);
        }
      } else {
        setActiveMemberId("");
        setActiveRole("visitor"); // Visitor represents unauthenticated or unregistered
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, [members]);

  const handleGoogleSignIn = async () => {
    setAuthError("");
    setAuthSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
      triggerToast("Successfully signed in with Google! Checking profile... 🔐");
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      let msg = err.message || "Failed to sign in with Google.";
      if (msg.includes("auth/popup-blocked")) {
        msg = "The sign-in popup was blocked. Please allow popups for this site or try again.";
      }
      setAuthError(msg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSubmitRegistration = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setAuthError("No authenticated user found. Please sign in with Google first.");
      return;
    }
    if (!regForm.phone || !regForm.address) {
      setAuthError("Please fill out your phone number and address.");
      return;
    }
    setAuthError("");
    setAuthSubmitting(true);
    try {
      let refererId = "";
      if (regForm.referralCode) {
        const cleanedCode = regForm.referralCode.trim().toUpperCase();
        // Always fetch fresh from Firebase — local `members` state may be empty
        // for new visitors who haven't yet triggered a full data load.
        const allMembers = members.length > 0 ? members : await getCollectionData<Member>("members");
        const matchedMember = allMembers.find(m => {
          if (!m.memberId) return false;
          const mCode = `SINGH_FITNESS${m.name.toUpperCase().replace(/\s+/g, "").slice(0, 6)}${m.memberId.split("-").pop()}`;
          return mCode === cleanedCode;
        });

        if (matchedMember) {
          refererId = matchedMember.id;
        } else {
          setAuthError("Referral code not found. Please double-check the code (format: SINGH_FITNESS + name + ID digits) or leave the field empty to skip.");
          setAuthSubmitting(false);
          return;
        }
      }

      const newMember: Member = {
        id: currentUser.uid,
        name: regForm.name || currentUser.displayName || "New Member",
        phone: regForm.phone,
        address: regForm.address,
        height: Number(regForm.height) || 175,
        weight: Number(regForm.weight) || 75,
        targetWeight: Number(regForm.targetWeight) || 72,
        preferredShift: regForm.preferredShift,
        goals: regForm.goals || "General Fitness",
        memberId: "AG-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000),
        status: "Pending Approval",
        joinedDate: new Date().toISOString().split("T")[0],
        expiryDate: "",
        streak: 0,
        points: 100,
        referrals: 0,
        trainerName: "Unassigned",
        trainerPhone: "",
        workoutPlanId: "",
        dietPlanId: "",
        trainerNote: "Welcome to Singh Fitness Gym! Awaiting administrator verification and onboarding.",
        waterIntake: 0.8,
        sleepHours: 7.0,
        weightHistory: [{ date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }), weight: Number(regForm.weight) || 75 }],
        attendanceHistory: [],
        absentDays: 0,
        role: "member",
        email: currentUser.email || "",
        gymAccess: regForm.gymAccess
      };

      await saveDocument("members", newMember);
      setMembers(prev => prev.some(m => m.id === newMember.id) ? prev.map(m => m.id === newMember.id ? newMember : m) : [...prev, newMember]);

      if (refererId) {
        const referer = members.find(m => m.id === refererId);
        if (referer) {
          const updatedReferer = {
            ...referer,
            referrals: (referer.referrals || 0) + 1,
            points: (referer.points || 0) + 100
          };
          await saveDocument("members", updatedReferer);
          setMembers(prev => prev.map(m => m.id === refererId ? updatedReferer : m));
          
          const refNotif: GymNotification = {
            id: `ref-notif-${Date.now()}`,
            timestamp: "Just Now",
            title: "🎁 Referral Bonus Earned!",
            message: `Your friend ${newMember.name} joined using your code! You've received +100 PTS and 1 successful referral!`,
            type: "success",
            read: false
          };
          await saveDocument("notifications", refNotif);
          setNotifications(prev => [refNotif, ...prev]);
        }
      }

      // Push admin notification for review
      const regAlert: GymNotification = {
        id: `notif-admin-reg-${Date.now()}`,
        timestamp: "Just Now",
        title: "🔔 New Member Registration",
        message: `${newMember.name} registered under ${newMember.gymAccess}. Review shift (${newMember.preferredShift})!`,
        type: "warning",
        read: false,
        forAdmin: true
      };
      await saveDocument("notifications", regAlert);
      setNotifications(prev => [regAlert, ...prev]);

      triggerToast("Application submitted! Awaiting approval. 📋");
      
      setActiveMemberId(currentUser.uid);
      setActiveRole("pending");
      setRegStep(1);
    } catch (err: any) {
      console.error("Registration submit error:", err);
      setAuthError(err.message || "Failed to submit registration. Please try again.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      triggerToast("Signed out successfully. 👋");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  // --- Effects: load from Firebase, cache in localStorage ---
  useEffect(() => {
    async function initDb() {
      try {
        // Members, announcements, notifications: load from Firebase (no fake seed data)
        const loadedMembers = await getCollectionData<Member>("members");
        const loadedAnnouncements = await getCollectionData<GymAnnouncement>("announcements");
        const loadedNotifs = await getCollectionData<GymNotification>("notifications");

        // Workout & diet plans: seed defaults on first run so admin has a starting library
        const loadedWorkoutPlans = await seedCollectionIfEmpty("workoutPlans", DEFAULT_WORKOUT_PLANS);
        const loadedDietPlans = await seedCollectionIfEmpty("dietPlans", DEFAULT_DIET_PLANS);

        // Gym payment configuration: seed defaults if not yet set
        const loadedConfigs = await seedCollectionIfEmpty<{ id: string; upiId?: string; qrCodeUrl?: string }>("gymConfig", [
          { id: "settings", upiId: "pay@singh-fitness", qrCodeUrl: "" }
        ]);
        const currentConfig = loadedConfigs.find(c => c.id === "settings") || { upiId: "pay@singh-fitness", qrCodeUrl: "" };
        setGymConfig({
          upiId: currentConfig.upiId || "pay@singh-fitness",
          qrCodeUrl: currentConfig.qrCodeUrl || ""
        });

        setMembers(loadedMembers);
        setAnnouncements(loadedAnnouncements);
        setNotifications(loadedNotifs);
        setWorkoutPlans(loadedWorkoutPlans);
        setDietPlans(loadedDietPlans);
      } catch (e) {
        console.error("Failed to load Firebase data:", e);
      } finally {
        setIsLoading(false);
      }
    }
    initDb();

    // Real-time listener for planRequests — updates instantly on both admin and member sessions
    const unsubscribePlanRequests = subscribeCollection<PlanChangeRequest>("planRequests", (items) => {
      setPlanRequests(items);
    });

    return () => {
      unsubscribePlanRequests();
    };
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'singh_fitness_gym_members' && e.newValue) setMembers(JSON.parse(e.newValue));
      if (e.key === 'singh_fitness_gym_announcements' && e.newValue) setAnnouncements(JSON.parse(e.newValue));
      if (e.key === 'singh_fitness_gym_notifs' && e.newValue) setNotifications(JSON.parse(e.newValue));
      if (e.key === 'singh_fitness_gym_plan_requests' && e.newValue) setPlanRequests(JSON.parse(e.newValue));
      if (e.key === 'singh_fitness_gym_workout_plans' && e.newValue) setWorkoutPlans(JSON.parse(e.newValue));
      if (e.key === 'singh_fitness_gym_diet_plans' && e.newValue) setDietPlans(JSON.parse(e.newValue));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    localStorage.setItem("singh_fitness_gym_members", JSON.stringify(members));
    members.forEach((m) => {
      saveDocument("members", m);
    });
  }, [members, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    localStorage.setItem("singh_fitness_gym_announcements", JSON.stringify(announcements));
    announcements.forEach((a) => {
      saveDocument("announcements", a);
    });
  }, [announcements, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    localStorage.setItem("singh_fitness_gym_notifs", JSON.stringify(notifications));
    notifications.forEach((n) => {
      saveDocument("notifications", n);
    });
  }, [notifications, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    localStorage.setItem("singh_fitness_gym_plan_requests", JSON.stringify(planRequests));
    planRequests.forEach((pr) => {
      saveDocument("planRequests", pr);
    });
  }, [planRequests, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    localStorage.setItem("singh_fitness_gym_workout_plans", JSON.stringify(workoutPlans));
    workoutPlans.forEach((wp) => {
      saveDocument("workoutPlans", wp);
    });
  }, [workoutPlans, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    localStorage.setItem("singh_fitness_gym_diet_plans", JSON.stringify(dietPlans));
    dietPlans.forEach((dp) => {
      saveDocument("dietPlans", dp);
    });
  }, [dietPlans, isLoading]);

  // Current real-time Clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setCurrentDate(now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Toast Trigger helper ---
  const triggerToast = (text: string) => {
    setToastText(text);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  // --- Get current logged in member entity ---
  const currentMember = members.find(m => m.id === activeMemberId) || members[0];

  // Derived greeting shift message
  const getShiftGreeting = (member: Member) => {
    const preferred = member.preferredShift;
    if (preferred === "Morning Shift") {
      return `Good Morning, ${member.name.split(" ")[0]}! Rise and grind for your Morning shift.`;
    } else {
      return `Good Evening, ${member.name.split(" ")[0]}! Let's crush your Evening workout.`;
    }
  };

  // --- Handlers for Member Portal ---

  // Checkbox: toggle exercise check status
  const handleToggleExercise = (exerciseId: string) => {
    setMembers(prev => prev.map(m => {
      if (m.id === currentMember.id) {
        const completed = m.completedExercises || [];
        const isCompleted = completed.includes(exerciseId);
        const nextCompleted = isCompleted 
          ? completed.filter(id => id !== exerciseId)
          : [...completed, exerciseId];

        let pointsAward = 0;

        // Check if all exercises of today are completed
        const mActivePlan = workoutPlans.find(p => p.id === m.workoutPlanId) || workoutPlans[0];
        const mDayName = new Date().toLocaleDateString([], { weekday: "long" });
        const mTodayRoutine = mActivePlan?.weeklyRoutine.find(r => r.day === mDayName) || mActivePlan?.weeklyRoutine[0];

        let isDailyCompleteBonus = false;
        let isDailyCompleteRemoved = false;

        if (mTodayRoutine && !mTodayRoutine.isRestDay && mTodayRoutine.exercises.length > 0) {
          const wasAllCompleted = mTodayRoutine.exercises.every(ex => completed.includes(ex.id));
          const isAllCompleted = mTodayRoutine.exercises.every(ex => nextCompleted.includes(ex.id));

          if (!wasAllCompleted && isAllCompleted) {
            pointsAward += 10;
            isDailyCompleteBonus = true;
          } else if (wasAllCompleted && !isAllCompleted) {
            pointsAward -= 10;
            isDailyCompleteRemoved = true;
          }
        }

        if (!isCompleted) {
          if (isDailyCompleteBonus) {
            triggerToast("All exercises done! +10 PTS Perfect Day Bonus! 🎉");
            
            const newLog: GymNotification = {
              id: `notif-ex-all-${Date.now()}`,
              timestamp: "Just Now",
              title: "🏆 Perfect Workout Day!",
              message: `You completed every single exercise scheduled for today! Added +10 PTS Bonus!`,
              type: "success",
              read: false
            };
            setNotifications(prevNotifs => [newLog, ...prevNotifs]);
          } else {
            triggerToast("Exercise Checked! 👍");
          }
        } else {
          if (isDailyCompleteRemoved) {
            triggerToast("Uncompleted workout. -10 PTS Perfect Day Bonus removed.");
          } else {
            triggerToast("Exercise unchecked.");
          }
        }

        return {
          ...m,
          completedExercises: nextCompleted,
          points: Math.max(0, m.points + pointsAward),
          streak: m.streak === 0 && !isCompleted ? 1 : m.streak
        };
      }
      return m;
    }));
  };

  // Checkbox: toggle meal check status
  const handleToggleMeal = (mealId: string) => {
    setMembers(prev => prev.map(m => {
      if (m.id === currentMember.id) {
        const completed = m.completedMeals || [];
        const isCompleted = completed.includes(mealId);
        const nextCompleted = isCompleted
          ? completed.filter(id => id !== mealId)
          : [...completed, mealId];

        const pointsAward = isCompleted ? -15 : 15;
        if (!isCompleted) {
          triggerToast("Meal Consumed! +15 PTS. Clean fuel! 🥗");
        } else {
          triggerToast("Meal un-checked. -15 PTS.");
        }

        return {
          ...m,
          completedMeals: nextCompleted,
          points: Math.max(0, m.points + pointsAward)
        };
      }
      return m;
    }));
  };

  // Hydration increase / decrease
  const handleAdjustWater = (qty: number) => {
    setMembers(prev => prev.map(m => {
      if (m.id === currentMember.id) {
        const nextWater = Math.max(0, parseFloat((m.waterIntake + qty).toFixed(2)));
        if (qty > 0) {
          triggerToast(`Hydrated! Current Intake: ${nextWater}L. +5 PTS`);
          return { ...m, waterIntake: nextWater, points: m.points + 5 };
        }
        return { ...m, waterIntake: nextWater };
      }
      return m;
    }));
  };

  // Log new weight (Progress page modal)
  const handleSaveWeight = (e: FormEvent) => {
    e.preventDefault();
    const wVal = parseFloat(newWeightInput);
    if (!isNaN(wVal) && wVal > 30 && wVal < 250) {
      setMembers(prev => prev.map(m => {
        if (m.id === currentMember.id) {
          const todayStr = new Date().toLocaleDateString([], { month: "short", day: "2-digit" });
          const newHistory = [...m.weightHistory];
          // Replace or insert
          const existIdx = newHistory.findIndex(h => h.date === todayStr);
          if (existIdx >= 0) {
            newHistory[existIdx].weight = wVal;
          } else {
            newHistory.push({ date: todayStr, weight: wVal });
          }
          if (newHistory.length > 6) newHistory.shift();

          triggerToast(`Weight registered: ${wVal} kg. Streak Points +20!`);
          return {
            ...m,
            weight: wVal,
            weightHistory: newHistory,
            points: m.points + 20
          };
        }
        return m;
      }));
      setShowWeightModal(false);
    } else {
      alert("Please enter a realistic weight (30-250 kg).");
    }
  };

  // Log new sleep (Progress page modal)
  const handleSaveSleep = (e: FormEvent) => {
    e.preventDefault();
    const sVal = parseFloat(newSleepInput);
    if (!isNaN(sVal) && sVal >= 0 && sVal <= 24) {
      setMembers(prev => prev.map(m => {
        if (m.id === currentMember.id) {
          triggerToast(`Logged ${sVal} hours of rest. Recoup points +15!`);
          return {
            ...m,
            sleepHours: sVal,
            points: m.points + 15
          };
        }
        return m;
      }));
      setShowSleepModal(false);
    } else {
      alert("Please enter sleep hours between 0 and 24.");
    }
  };

  // Submit request to shift plan
  const handleRequestPlanChange = (planName: string) => {
    const newReq: PlanChangeRequest = {
      id: `req-${Date.now()}`,
      memberId: currentMember.id,
      memberName: currentMember.name,
      currentPlanName: workoutPlans.find(p => p.id === currentMember.workoutPlanId)?.name || "Default Plan",
      requestedPlanName: planName,
      timestamp: "Today",
      status: "Pending"
    };

    setPlanRequests(prev => [newReq, ...prev]);
    
    // Add Notification to Admin
    const adminAlert: GymNotification = {
      id: `notif-admin-req-${Date.now()}`,
      timestamp: "Just Now",
      title: "📋 New Plan Change Request",
      message: `${currentMember.name} has requested to shift to: ${planName}.`,
      type: "info",
      read: false,
      forAdmin: true
    };
    setNotifications(prev => [adminAlert, ...prev]);

    setShowPlanRequestModal(false);
    triggerToast("Plan change request submitted to Coach Singh Fitness! 🤝");
  };

  // --- Scanner Check-In Action (QR Code scan simulation) ---
  const handleCheckInScan = () => {
    setScanningState("reading");
    
    setTimeout(() => {
      // Check if membership is expired
      if (currentMember.status === "Expired") {
        setScanningState("expired");
        triggerToast("Scanner Rejected: Membership Expired 🛑");
        return;
      }

      setScanningState("success");
      
      // Update streak and add 100 PTS
      setMembers(prev => prev.map(m => {
        if (m.id === currentMember.id) {
          const todayString = new Date().toISOString().split("T")[0];
          const hasAttendedToday = m.attendanceHistory.includes(todayString);
          
          if (hasAttendedToday) {
            triggerToast("Already Checked-In for today! 🏋️");
            return m;
          }

          return {
            ...m,
            streak: m.streak + 1,
            points: m.points + 100,
            attendanceHistory: [...m.attendanceHistory, todayString],
            absentDays: 0
          };
        }
        return m;
      }));

      // Log notification
      const checkInAlert: GymNotification = {
        id: `notif-chk-${Date.now()}`,
        timestamp: "Just Now",
        title: "🔥 Attendance Marked!",
        message: "Your attendance QR scan has been successfully authenticated. Streak +1, Points +100!",
        type: "success",
        read: false
      };
      setNotifications(prev => [checkInAlert, ...prev]);

      setTimeout(() => {
        setShowScanner(false);
        setScanningState("idle");
      }, 1500);

    }, 2000);
  };

  // Helper to map exercise ID to names
  const getExerciseName = (exId: string) => {
    for (const plan of workoutPlans) {
      for (const day of plan.weeklyRoutine) {
        if (day.exercises) {
          const exercise = day.exercises.find(e => e.id === exId);
          if (exercise) return exercise.name;
        }
      }
    }
    return exId.replace(/-/g, " ").toUpperCase();
  };

  // Download Member Progress PDF
  const handleDownloadMonthlyProgress = async () => {
    if (!currentMember) return;
    
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      
      // Theme colors
      const primaryColor = [23, 23, 23]; // Neutral 900
      const accentColor = [250, 204, 21]; // Yellow 400
      const textColor = [50, 50, 50];
      const lightGray = [245, 245, 245];
      
      // Header Banner
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 40, "F");
      
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(0, 40, 210, 3, "F");
      
      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("SINGH_FITNESS GYM", 15, 18);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(180, 180, 180);
      doc.text("MEMBER MONTHLY PROGRESS REPORT", 15, 26);
      doc.text(`DATE: ${new Date().toLocaleDateString()}`, 155, 18);
      doc.text("PORTAL: MOBILE-MEMBER", 155, 26);
      
      // Section 1: Profile Summary
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("I. MEMBER PROFILE SUMMARY", 15, 55);
      
      // Draw thin underline
      doc.setDrawColor(220, 220, 220);
      doc.line(15, 58, 195, 58);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      
      const leftColX = 15;
      const rightColX = 110;
      let currentY = 66;
      
      doc.setFont("helvetica", "bold"); doc.text("Full Name:", leftColX, currentY);
      doc.setFont("helvetica", "normal"); doc.text(currentMember.name, leftColX + 35, currentY);
      
      doc.setFont("helvetica", "bold"); doc.text("Member ID:", rightColX, currentY);
      doc.setFont("helvetica", "normal"); doc.text(currentMember.memberId || "Pending", rightColX + 35, currentY);
      
      currentY += 8;
      doc.setFont("helvetica", "bold"); doc.text("Access Status:", leftColX, currentY);
      doc.setFont("helvetica", "normal"); doc.text(currentMember.status, leftColX + 35, currentY);
      
      doc.setFont("helvetica", "bold"); doc.text("Joined Date:", rightColX, currentY);
      doc.setFont("helvetica", "normal"); doc.text(currentMember.joinedDate || "N/A", rightColX + 35, currentY);
      
      currentY += 8;
      doc.setFont("helvetica", "bold"); doc.text("Fitness Goal:", leftColX, currentY);
      doc.setFont("helvetica", "normal"); doc.text(currentMember.goals || "N/A", leftColX + 35, currentY);
      
      doc.setFont("helvetica", "bold"); doc.text("Preferred Shift:", rightColX, currentY);
      doc.setFont("helvetica", "normal"); doc.text(currentMember.preferredShift || "N/A", rightColX + 35, currentY);

      currentY += 8;
      doc.setFont("helvetica", "bold"); doc.text("Total Points:", leftColX, currentY);
      doc.setFont("helvetica", "normal"); doc.text(`${currentMember.points || 0} PTS`, leftColX + 35, currentY);
      
      doc.setFont("helvetica", "bold"); doc.text("Current Streak:", rightColX, currentY);
      doc.setFont("helvetica", "normal"); doc.text(`${currentMember.streak || 0} Days`, rightColX + 35, currentY);
      
      // Section 2: Weight Goals and History
      currentY += 16;
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("II. WEIGHT LOSS & GOAL TRACKING", 15, currentY);
      
      doc.line(15, currentY + 3, 195, currentY + 3);
      currentY += 10;
      
      // Goal Callout Box
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.rect(15, currentY, 180, 18, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`Starting/Latest Weight: ${currentMember.weight} kg`, 20, currentY + 11);
      doc.text(`Target Goal weight: ${currentMember.targetWeight || 70} kg`, 115, currentY + 11);
      
      currentY += 25;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("Monthly Weight Entry Records", 15, currentY);
      currentY += 6;
      
      // Table Header
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(15, currentY, 180, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Record Date", 25, currentY + 5.5);
      doc.text("Recorded Weight (kg)", 115, currentY + 5.5);
      
      currentY += 8;
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont("helvetica", "normal");
      
      const history = currentMember.weightHistory || [];
      if (history.length === 0) {
        doc.text("No historical records logged yet.", 25, currentY + 6);
        currentY += 10;
      } else {
        history.forEach((entry, idx) => {
          if (idx % 2 === 1) {
            doc.setFillColor(248, 248, 248);
            doc.rect(15, currentY, 180, 7, "F");
          }
          doc.text(entry.date, 25, currentY + 5);
          doc.text(`${entry.weight} kg`, 115, currentY + 5);
          currentY += 7;
        });
      }
      
      // Section 3: Exercises Completed
      currentY += 12;
      if (currentY > 210) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("III. EXERCISES COMPLETED THIS MONTH", 15, currentY);
      
      doc.line(15, currentY + 3, 195, currentY + 3);
      currentY += 10;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      
      const completed = currentMember.completedExercises || [];
      if (completed.length === 0) {
        doc.text("No exercises checked off this month yet. Complete assigned sets in Fitness Tab!", 15, currentY + 2);
        currentY += 10;
      } else {
        doc.text(`You have fully completed ${completed.length} exercises logged in the system:`, 15, currentY + 2);
        currentY += 8;
        
        completed.forEach((exId) => {
          if (currentY > 265) {
            doc.addPage();
            currentY = 20;
          }
          const name = getExerciseName(exId);
          doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
          // bullet point
          doc.rect(16, currentY + 1.5, 3, 3, "F");
          doc.text(name, 24, currentY + 4);
          currentY += 6.5;
        });
      }
      
      // Page frame or bottom line
      doc.setDrawColor(230, 230, 230);
      doc.line(15, 275, 195, 275);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text("Generated by Singh Fitness Gym Ledger - Maintain absolute discipline and consistency.", 15, 281);
      
      doc.save(`${currentMember.name.replace(/\s+/g, "_")}_Monthly_Progress.pdf`);
      triggerToast("Monthly Progress PDF successfully generated and downloaded!");
    } catch (err) {
      console.error("PDF generation failed:", err);
      triggerToast("Error producing PDF.");
    }
  };

  // Download Admin Comprehensive Gym Report
  const handleDownloadAdminGymReport = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      
      // Theme colors
      const primaryColor = [23, 23, 23]; // Neutral 900 (Black/Gray)
      const accentColor = [239, 68, 68]; // Red 500 (Admin Accent)
      const textColor = [50, 50, 50];
      const lightGray = [245, 245, 245];
      const today = new Date("2026-07-05");
      
      // --- PAGE 1: EXECUTIVE DASHBOARD SUMMARY ---
      // Header Banner
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 40, "F");
      
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(0, 40, 210, 3, "F");
      
      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("SINGH_FITNESS GYM - OWNER CONTROL PANEL", 15, 18);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(180, 180, 180);
      doc.text("COMPREHENSIVE GYM SYSTEM AUDIT REPORT", 15, 26);
      doc.text(`DATE GENERATED: ${today.toLocaleDateString()}`, 150, 18);
      doc.text("PORTAL: OWNER-ADMIN", 150, 26);
      
      // Executive counters
      const activeCount = members.filter(m => m.status === "Active" || m.status === "Expiring Soon").length;
      const expiringCount = members.filter(m => m.status === "Expiring Soon").length;
      const pendingCount = members.filter(m => m.status === "Pending Approval").length;
      const todayString = today.toISOString().split("T")[0];
      const todayAttendeesCount = members.filter(m => m.attendanceHistory?.includes(todayString)).length;
      
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("I. SYSTEM METRIC AUDIT", 15, 55);
      
      doc.setDrawColor(220, 220, 220);
      doc.line(15, 58, 195, 58);
      
      // Draw grid boxes for high-level metrics
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.rect(15, 64, 85, 20, "F");
      doc.rect(110, 64, 85, 20, "F");
      doc.rect(15, 88, 85, 20, "F");
      doc.rect(110, 88, 85, 20, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("ACTIVE MEMBERS ACCESS LOGS", 20, 71);
      doc.setFontSize(14);
      doc.text(`${activeCount} Members`, 20, 79);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("TODAY'S SCAN GATE ATTENDEES", 115, 71);
      doc.setFontSize(14);
      doc.text(`${todayAttendeesCount} Checked-In`, 115, 79);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("MEMBERSHIPS EXPIRING SOON", 20, 95);
      doc.setFontSize(14);
      doc.text(`${expiringCount} Pending Renewal`, 20, 103);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("PENDING ONBOARDING APPLICATIONS", 115, 95);
      doc.setFontSize(14);
      doc.text(`${pendingCount} Awaiting Plan`, 115, 103);
      
      // Calculate Most Active vs Least Active Day
      const dayOfWeekCount: { [key: string]: number } = {
        "Sunday": 0, "Monday": 0, "Tuesday": 0, "Wednesday": 0, "Thursday": 0, "Friday": 0, "Saturday": 0
      };
      let totalAttendanceLogs = 0;
      members.forEach(m => {
        (m.attendanceHistory || []).forEach(dateStr => {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
            if (dayOfWeekCount[dayName] !== undefined) {
              dayOfWeekCount[dayName]++;
              totalAttendanceLogs++;
            }
          }
        });
      });
      
      let mostActiveDay = "N/A";
      let mostActiveCount = -1;
      let leastActiveDay = "N/A";
      let leastActiveCount = Infinity;
      
      const days = Object.keys(dayOfWeekCount);
      if (totalAttendanceLogs > 0) {
        days.forEach(day => {
          const count = dayOfWeekCount[day];
          if (count > mostActiveCount) {
            mostActiveCount = count;
            mostActiveDay = day;
          }
          if (count < leastActiveCount) {
            leastActiveCount = count;
            leastActiveDay = day;
          }
        });
      }
      if (leastActiveCount === Infinity) leastActiveDay = "N/A";
      
      // Calculate Performers
      const approvedMembers = members.filter(m => m.status !== "Pending Approval");
      let highestPerformer: Member | null = null;
      let lowestPerformer: Member | null = null;
      if (approvedMembers.length > 0) {
        highestPerformer = approvedMembers.reduce((p, c) => (p.points > c.points ? p : c));
        lowestPerformer = approvedMembers.reduce((p, c) => (p.points < c.points ? p : c));
      }
      
      // Calculate Referral Member
      let mostReferralMember: Member | null = null;
      const referrers = approvedMembers.filter(m => (m.referrals || 0) > 0);
      if (referrers.length > 0) {
        mostReferralMember = referrers.reduce((p, c) => ((p.referrals || 0) > (c.referrals || 0) ? p : c));
      }
      
      // Calculate New Member
      const sortedByJoin = [...members]
        .filter(m => m.joinedDate)
        .sort((a, b) => new Date(b.joinedDate).getTime() - new Date(a.joinedDate).getTime());
      const newMember = sortedByJoin[0];
      
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("II. SYSTEM INTELLIGENCE & PERFORMANCE", 15, 125);
      doc.line(15, 128, 195, 128);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      
      let currentY = 136;
      doc.setFont("helvetica", "bold"); doc.text("Most Active Gym Day:", 15, currentY);
      doc.setFont("helvetica", "normal"); doc.text(`${mostActiveDay} (${mostActiveCount} scan-ins)`, 75, currentY);
      
      currentY += 8;
      doc.setFont("helvetica", "bold"); doc.text("Least Active Gym Day:", 15, currentY);
      doc.setFont("helvetica", "normal"); doc.text(`${leastActiveDay} (${leastActiveCount === Infinity || leastActiveCount === -1 ? 0 : leastActiveCount} scan-ins)`, 75, currentY);
      
      currentY += 8;
      doc.setFont("helvetica", "bold"); doc.text("Highest Performer:", 15, currentY);
      doc.setFont("helvetica", "normal"); doc.text(highestPerformer ? `${highestPerformer.name} (${highestPerformer.points} PTS)` : "N/A", 75, currentY);
      
      currentY += 8;
      doc.setFont("helvetica", "bold"); doc.text("Lowest Performer:", 15, currentY);
      doc.setFont("helvetica", "normal"); doc.text(lowestPerformer ? `${lowestPerformer.name} (${lowestPerformer.points} PTS)` : "N/A", 75, currentY);
      
      currentY += 8;
      doc.setFont("helvetica", "bold"); doc.text("Most Referral Member:", 15, currentY);
      doc.setFont("helvetica", "normal"); doc.text(mostReferralMember ? `${mostReferralMember.name} (${mostReferralMember.referrals} invitations)` : "N/A", 75, currentY);
      
      currentY += 8;
      doc.setFont("helvetica", "bold"); doc.text("Newest Registered Member:", 15, currentY);
      doc.setFont("helvetica", "normal"); doc.text(newMember ? `${newMember.name} (Joined ${newMember.joinedDate})` : "N/A", 75, currentY);
      
      // Footer page 1
      doc.setDrawColor(230, 230, 230);
      doc.line(15, 275, 195, 275);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text("Page 1 of 3 - Singh Fitness Gym System Audit Report", 15, 281);
      
      // --- PAGE 2: ABSENCE, INACTIVITY & ENGAGEMENT AUDIT ---
      doc.addPage();
      
      // Header Page 2
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 22, "F");
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(0, 22, 210, 2, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("SINGH_FITNESS GYM - SYSTEM AUDIT REPORT", 15, 12);
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text("ABSENCE, CHRONIC INACTIVITY & ENGAGEMENT LOGS", 15, 18);
      
      // Absent list
      const mostAbsentMembers = [...approvedMembers]
        .sort((a, b) => (b.absentDays || 0) - (a.absentDays || 0))
        .slice(0, 5);
        
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("III. CHRONIC ABSENTEEISM LOGS (Top 5)", 15, 38);
      doc.line(15, 41, 195, 41);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      
      currentY = 49;
      if (mostAbsentMembers.length === 0) {
        doc.text("No absences logged in the system.", 15, currentY);
        currentY += 10;
      } else {
        mostAbsentMembers.forEach((m, idx) => {
          doc.setFont("helvetica", "bold");
          doc.text(`${idx + 1}. ${m.name}`, 15, currentY);
          doc.setFont("helvetica", "normal");
          doc.text(`Absent for: ${m.absentDays || 0} consecutive days  •  Contact: ${m.phone}`, 65, currentY);
          currentY += 7.5;
        });
      }
      
      // Inactivity segments
      const inactive1Month: string[] = [];
      const inactive2Month: string[] = [];
      const inactive3Month: string[] = [];
      
      approvedMembers.forEach(m => {
        let lastActiveDate: Date | null = null;
        if (m.attendanceHistory && m.attendanceHistory.length > 0) {
          const timestamps = m.attendanceHistory.map(dStr => new Date(dStr).getTime());
          lastActiveDate = new Date(Math.max(...timestamps));
        } else if (m.joinedDate) {
          lastActiveDate = new Date(m.joinedDate);
        }
        
        if (lastActiveDate) {
          const diffTime = today.getTime() - lastActiveDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays >= 90) {
            inactive3Month.push(`${m.name} (Last active ${diffDays} days ago)`);
          } else if (diffDays >= 60) {
            inactive2Month.push(`${m.name} (Last active ${diffDays} days ago)`);
          } else if (diffDays >= 30) {
            inactive1Month.push(`${m.name} (Last active ${diffDays} days ago)`);
          }
        }
      });
      
      currentY += 10;
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("IV. INACTIVITY SEGMENTS (Not Seen/Not Checked-In)", 15, currentY);
      doc.line(15, currentY + 3, 195, currentY + 3);
      currentY += 11;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("A. Inactive > 3 Months (Critical Dropout Alert)", 15, currentY);
      currentY += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      if (inactive3Month.length === 0) {
        doc.text("No members fall in this segment.", 20, currentY);
        currentY += 7;
      } else {
        inactive3Month.forEach(item => {
          doc.text(`• ${item}`, 20, currentY);
          currentY += 6;
        });
      }
      
      currentY += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("B. Inactive > 2 Months (High Attrition Risk)", 15, currentY);
      currentY += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      if (inactive2Month.length === 0) {
        doc.text("No members fall in this segment.", 20, currentY);
        currentY += 7;
      } else {
        inactive2Month.forEach(item => {
          doc.text(`• ${item}`, 20, currentY);
          currentY += 6;
        });
      }
      
      currentY += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("C. Inactive > 1 Month (Early Warning Signal)", 15, currentY);
      currentY += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      if (inactive1Month.length === 0) {
        doc.text("No members fall in this segment.", 20, currentY);
        currentY += 7;
      } else {
        inactive1Month.forEach(item => {
          doc.text(`• ${item}`, 20, currentY);
          currentY += 6;
        });
      }
      
      // Footer page 2
      doc.setDrawColor(230, 230, 230);
      doc.line(15, 275, 195, 275);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text("Page 2 of 3 - Singh Fitness Gym System Audit Report", 15, 281);
      
      // --- PAGE 3: COMPREHENSIVE MEMBERS LEDGER (MEMBERS DATA) ---
      doc.addPage();
      
      // Header Page 3
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 22, "F");
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(0, 22, 210, 2, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("SINGH_FITNESS GYM - SYSTEM AUDIT REPORT", 15, 12);
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text("COMPREHENSIVE MEMBER AUDIT LEDGER", 15, 18);
      
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("V. REGISTERED SYSTEM MEMBERS RECORD DATA", 15, 38);
      doc.line(15, 41, 195, 41);
      
      currentY = 49;
      
      // Table Header
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(15, currentY, 180, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("Name", 18, currentY + 5.5);
      doc.text("Member ID", 58, currentY + 5.5);
      doc.text("Status", 92, currentY + 5.5);
      doc.text("Shift", 124, currentY + 5.5);
      doc.text("Points", 156, currentY + 5.5);
      doc.text("Joined Date", 176, currentY + 5.5);
      
      currentY += 8;
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      
      members.forEach((m, idx) => {
        if (currentY > 265) {
          // Footer page 3 inside page break
          doc.setDrawColor(230, 230, 230);
          doc.line(15, 275, 195, 275);
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(140, 140, 140);
          doc.text("Page 3 of 3 - Singh Fitness Gym System Audit Report", 15, 281);
          
          doc.addPage();
          
          // Header Page 3 (continued)
          doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.rect(0, 0, 210, 22, "F");
          doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
          doc.rect(0, 22, 210, 2, "F");
          
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.text("SINGH_FITNESS GYM - SYSTEM AUDIT REPORT", 15, 12);
          doc.setFontSize(8);
          doc.setTextColor(180, 180, 180);
          doc.text("COMPREHENSIVE MEMBER AUDIT LEDGER (CONTINUED)", 15, 18);
          
          currentY = 32;
          
          // Table Header (continued)
          doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.rect(15, currentY, 180, 8, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.text("Name", 18, currentY + 5.5);
          doc.text("Member ID", 58, currentY + 5.5);
          doc.text("Status", 92, currentY + 5.5);
          doc.text("Shift", 124, currentY + 5.5);
          doc.text("Points", 156, currentY + 5.5);
          doc.text("Joined Date", 176, currentY + 5.5);
          
          currentY += 8;
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
        }
        
        if (idx % 2 === 1) {
          doc.setFillColor(248, 248, 248);
          doc.rect(15, currentY, 180, 7, "F");
        }
        
        doc.text(m.name, 18, currentY + 5);
        doc.text(m.memberId || "Pending", 58, currentY + 5);
        doc.text(m.status, 92, currentY + 5);
        doc.text(m.preferredShift || "Morning Shift", 124, currentY + 5);
        doc.text(`${m.points || 0} PTS`, 156, currentY + 5);
        doc.text(m.joinedDate || "N/A", 176, currentY + 5);
        currentY += 7;
      });
      
      // Final Footer on Page 3
      doc.setDrawColor(230, 230, 230);
      doc.line(15, 275, 195, 275);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text("Page 3 of 3 - Singh Fitness Gym System Audit Report", 15, 281);
      
      doc.save(`Singh Fitness_Gym_System_Audit_${today.toISOString().split("T")[0]}.pdf`);
      triggerToast("System Audit Gym Report PDF generated and downloaded!");
    } catch (err) {
      console.error("Admin PDF report failed:", err);
      triggerToast("Failed to compile admin report.");
    }
  };

  // --- Handlers for Admin Portal ---

  // Admin approves a registered member or pending request
  const handleApproveMember = (e: FormEvent) => {
    e.preventDefault();
    if (!assigningMember) return;

    setMembers(prev => prev.map(m => {
      if (m.id === assigningMember.id) {
        // Calculate expiration date based on selected duration
        const now = new Date();
        const durationMonths = membershipDurationInput === "3 Months" ? 3 : membershipDurationInput === "2 Months" ? 2 : 1;
        now.setMonth(now.getMonth() + durationMonths);
        const expStr = now.toISOString().split("T")[0];
        const joinStr = new Date().toISOString().split("T")[0];

        // Generate dynamic customized member code
        const codeNum = Math.floor(1000 + Math.random() * 9000);
        const memberIdStr = `AG-2026-${codeNum}`;

        triggerToast(`Membership approved! Active ID: ${memberIdStr}`);

        // Add Notification for newly approved member
        const welcomeNotif: GymNotification = {
          id: `welcome-${Date.now()}`,
          timestamp: "Just Now",
          title: "🎉 Welcome to Singh Fitness Gym Premium!",
          message: `Your account has been fully verified and approved by Coach Singh Fitness! Assigned: ${
            workoutPlans.find(p => p.id === selectedWorkoutPlan)?.name
          }. Check your Fitness and Profile tabs!`,
          type: "success",
          read: false
        };

        // Remove the welcomeNotif from admin, we will append it so the member sees it when they log in!
        setNotifications(prev => [welcomeNotif, ...prev]);

        const approvedM = {
          ...m,
          status: "Active" as const,
          memberId: memberIdStr,
          joinedDate: joinStr,
          expiryDate: expStr,
          membershipDuration: membershipDurationInput,
          workoutPlanId: selectedWorkoutPlan,
          dietPlanId: selectedDietPlan,
          trainerNote: trainerNoteInput || "Get started on your compound forms today!",
          trainerName: "Coach Singh Fitness",
          trainerPhone: "+91 99999-88888",
          points: m.points + 200 // Bonus on onboarding!
        };

        saveDocument("members", approvedM);
        return approvedM;
      }
      return m;
    }));

    setAssigningMember(null);
  };

  // Admin approves a plan change request
  // Admin approves a plan change request
  const handleApprovePlanChange = async (reqId: string, memberId: string, targetPlanName: string) => {
    // Find target plan ID from name
    const planId = workoutPlans.find(p => p.name === targetPlanName)?.id || "power-builder";
    const dietId = dietPlans.find(p => p.name.includes("Keto") && targetPlanName.includes("Keto"))?.id || "clean-bulk";

    // Update Request status in state and Firebase immediately
    const updatedReq = planRequests.find(r => r.id === reqId);
    if (updatedReq) {
      const approvedReq = { ...updatedReq, status: "Approved" as const };
      setPlanRequests(prev => prev.map(r => r.id === reqId ? approvedReq : r));
      await saveDocument("planRequests", approvedReq);
    }

    // Shift member plan in state and Firebase immediately
    setMembers(prev => prev.map(m => {
      if (m.id === memberId) {
        const updatedM = {
          ...m,
          workoutPlanId: planId,
          dietPlanId: dietId,
          trainerNote: `Shifted to your requested plan: ${targetPlanName}.`
        };
        saveDocument("members", updatedM);
        return updatedM;
      }
      return m;
    }));

    // Trigger Notification for the member
    const planShiftNotif: GymNotification = {
      id: `shift-approved-${Date.now()}`,
      timestamp: "Just Now",
      title: "📋 Plan Change Approved!",
      message: `Your coach approved your request. Your workout curriculum has successfully updated to ${targetPlanName}!`,
      type: "success",
      read: false
    };
    setNotifications(prev => [planShiftNotif, ...prev]);

    triggerToast("Approved and updated member's active plan curriculum! 🏋️");
  };

  // Admin disapproves a plan change request
  const handleDisapprovePlanChange = async (reqId: string, targetPlanName: string) => {
    const updatedReq = planRequests.find(r => r.id === reqId);
    if (updatedReq) {
      const rejectedReq = { ...updatedReq, status: "Rejected" as const };
      setPlanRequests(prev => prev.map(r => r.id === reqId ? rejectedReq : r));
      await saveDocument("planRequests", rejectedReq);
    }

    const planShiftNotif: GymNotification = {
      id: `shift-rejected-${Date.now()}`,
      timestamp: "Just Now",
      title: "❌ Plan Change Declined",
      message: `Your coach reviewed your request for ${targetPlanName} and advised to stick with your current curriculum for now.`,
      type: "warning",
      read: false
    };
    setNotifications(prev => [planShiftNotif, ...prev]);
    triggerToast("Shift request rejected and member notified. ⛔");
  };

  // Admin deletes a plan change request
  const handleDeletePlanChange = async (reqId: string) => {
    setPlanRequests(prev => prev.filter(r => r.id !== reqId));
    triggerToast("Shift request deleted from history. 🗑️");
    await deleteDocument("planRequests", reqId);
  };

  const handleAddExerciseToDay = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!bExerciseName) {
      triggerToast("Error: Please enter an exercise name.");
      return;
    }
    const newEx: Exercise = {
      id: `ex-build-${Date.now()}`,
      name: bExerciseName,
      sets: bExerciseSets || "4 sets x 10 reps",
      completed: false,
      tutorial: bExerciseTutorial || "Perform with standard controlled form.",
      precautions: bExercisePrecautions ? bExercisePrecautions.split("\n").map(p => p.trim()).filter(Boolean) : [],
      steps: bExerciseSteps ? bExerciseSteps.split("\n").map(s => s.trim()).filter(Boolean) : ["Position yourself carefully.", "Execute with clean, controlled motion."],
      youtubeUrl: bExerciseVideoUrl || ""
    };

    setBWorkoutDays(prev => ({
      ...prev,
      [bSelectedDay]: [...prev[bSelectedDay], newEx]
    }));

    triggerToast(`Added "${bExerciseName}" to ${bSelectedDay}!`);
    setBExerciseName("");
    setBExerciseTutorial("");
    setBExercisePrecautions("");
    setBExerciseSteps("");
    setBExerciseVideoUrl("");
  };

  const handleRemoveExerciseFromDay = (day: string, exId: string) => {
    setBWorkoutDays(prev => ({
      ...prev,
      [day]: prev[day].filter(e => e.id !== exId)
    }));
    triggerToast(`Removed from ${day}`);
  };

  const handleAddMealToPlan = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!bMealName || !bMealDesc) {
      triggerToast("Error: Meal Name and description/items are required.");
      return;
    }
    const newMeal = {
      id: `meal-build-${Date.now()}`,
      name: bMealName,
      desc: bMealDesc,
      completed: false
    };
    setBDietMeals(prev => [...prev, newMeal]);
    triggerToast(`Added meal "${bMealName}"!`);
    setBMealName("");
    setBMealDesc("");
  };

  const handleRemoveMealFromPlan = (mealId: string) => {
    setBDietMeals(prev => prev.filter(m => m.id !== mealId));
    triggerToast("Removed meal from plan template.");
  };

  const handleCreateWorkoutPlan = (e: FormEvent) => {
    e.preventDefault();
    if (!bWorkoutName || !bWorkoutDesc) {
      triggerToast("Error: Workout plan name and description are required.");
      return;
    }
    
    const totalExercises = (Object.values(bWorkoutDays) as Exercise[][]).reduce((sum, list) => sum + list.length, 0);
    if (totalExercises === 0) {
      triggerToast("Error: Please add at least one exercise to a weekday.");
      return;
    }

    const weeklyRoutine = Object.keys(bWorkoutDays).map(day => ({
      day,
      isRestDay: bWorkoutDays[day].length === 0,
      exercises: bWorkoutDays[day]
    }));

    const newId = `workout-plan-${Date.now()}`;
    const newPlan: WorkoutPlan = {
      id: newId,
      name: bWorkoutName,
      description: bWorkoutDesc,
      price: Number(bWorkoutPrice) || 0,
      weeklyRoutine: weeklyRoutine
    };

    setWorkoutPlans(prev => [...prev, newPlan]);
    triggerToast(`Created "${bWorkoutName}" with ${totalExercises} exercises!`);
    setBWorkoutName("");
    setBWorkoutDesc("");
    setBWorkoutPrice("1499");
    setBWorkoutDays({
      "Monday": [],
      "Tuesday": [],
      "Wednesday": [],
      "Thursday": [],
      "Friday": [],
      "Saturday": [],
      "Sunday": []
    });
  };

  const handleCreateDietPlan = (e: FormEvent) => {
    e.preventDefault();
    if (!bDietName || !bDietDesc) {
      triggerToast("Error: Diet plan name and description are required.");
      return;
    }
    if (bDietMeals.length === 0) {
      triggerToast("Error: Please add at least one meal to your diet plan template.");
      return;
    }

    const newId = `diet-plan-${Date.now()}`;
    const newPlan: DietPlan = {
      id: newId,
      name: bDietName,
      description: `${bDietDesc} • Protein: ${bDietProtein}g, Carbs: ${bDietCarbs}g, Fats: ${bDietFats}g`,
      meals: bDietMeals
    };

    setDietPlans(prev => [...prev, newPlan]);
    triggerToast(`Created Diet Plan "${bDietName}" with ${bDietMeals.length} meals!`);
    setBDietName("");
    setBDietDesc("");
    setBDietProtein("150");
    setBDietCarbs("200");
    setBDietFats("65");
    setBDietMeals([]);
  };

  // Admin posts a new announcement
  const handleCreateAnnouncement = (e: FormEvent) => {
    e.preventDefault();
    if (!newAnnouncementTitle || !newAnnouncementContent) return;

    const newAnn: GymAnnouncement = {
      id: `ann-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      author: "Coach Singh Fitness (Owner)",
      title: newAnnouncementTitle,
      content: newAnnouncementContent,
      important: true
    };

    setAnnouncements(prev => [newAnn, ...prev]);

    // Broadcast notification to all members
    const broadcastNotif: GymNotification = {
      id: `ann-broad-${Date.now()}`,
      timestamp: "Just Now",
      title: `📢 Announcement: ${newAnnouncementTitle}`,
      message: newAnnouncementContent,
      type: "info",
      read: false
    };
    setNotifications(prev => [broadcastNotif, ...prev]);

    setNewAnnouncementTitle("");
    setNewAnnouncementContent("");
    triggerToast("Global Announcement broadcasted successfully! 📢");
  };

  // Admin saves the payment configuration (UPI and QR code)
  const handleSavePaymentConfig = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const updatedConfig = {
        id: "settings",
        upiId: bUpiId || "pay@singh_fitness",
        qrCodeUrl: bQrCodeUrl || ""
      };
      await saveDocument("gymConfig", updatedConfig);
      setGymConfig({
        upiId: bUpiId || "pay@singh_fitness",
        qrCodeUrl: bQrCodeUrl || ""
      });
      triggerToast("Payment configuration saved successfully! 💳");
    } catch (err: any) {
      console.error("Error saving payment config:", err);
      alert("Failed to save payment configuration: " + err.message);
    }
  };

  // --- Handlers for Visitor Registration ---
  const handleVisitorRegister = (e: FormEvent) => {
    e.preventDefault();
    if (!regForm.name || !regForm.phone || !regForm.address) {
      alert("Please fill in all core contact fields.");
      return;
    }
    setRegStep(2); // Go to checkout page
  };

  const handleCompletePaymentAndSubmit = () => {
    const tempId = `member-temp-${Date.now()}`;
    const newPendingMember: Member = {
      id: tempId,
      name: regForm.name,
      phone: regForm.phone,
      address: regForm.address,
      height: Number(regForm.height),
      weight: Number(regForm.weight),
      preferredShift: regForm.preferredShift,
      goals: regForm.goals,
      targetWeight: Number(regForm.targetWeight),
      memberId: "AG-PENDING",
      status: "Pending Approval",
      joinedDate: new Date().toISOString().split("T")[0],
      expiryDate: "",
      streak: 0,
      points: 100,
      referrals: 0,
      trainerName: "Unassigned",
      trainerPhone: "",
      workoutPlanId: "",
      dietPlanId: "",
      trainerNote: "Pending transaction verification and plan configuration.",
      waterIntake: 0.8,
      sleepHours: 7.0,
      weightHistory: [{ date: "Jul 03", weight: Number(regForm.weight) }],
      attendanceHistory: [],
      absentDays: 0
    };

    // Add to members database
    setMembers(prev => [newPendingMember, ...prev]);

    // Generate Admin notification
    const regAlert: GymNotification = {
      id: `notif-admin-reg-${Date.now()}`,
      timestamp: "Just Now",
      title: "🔔 New Member Registration",
      message: `${regForm.name} registered and paid. Review shift (${regForm.preferredShift}) & assign custom curriculum!`,
      type: "warning",
      read: false,
      forAdmin: true
    };
    setNotifications(prev => [regAlert, ...prev]);

    // Log user directly as pending status
    setActiveMemberId(tempId);
    setActiveRole("pending");
    setRegStep(1);
    setRegForm({
      name: "",
      phone: "",
      address: "",
      height: 178,
      weight: 79.5,
      targetWeight: 79.5,
      preferredShift: "Morning Shift",
      goals: "Muscle Gain & Strength",
      gymAccess: "",
      referralCode: ""
    });

    triggerToast("UPI Transaction Logged! Awaiting Owner Approval. 💳");
  };

  // Mark all notifications read
  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => {
      if (activeRole === "admin" && n.forAdmin) return { ...n, read: true };
      if (activeRole !== "admin" && !n.forAdmin) return { ...n, read: true };
      return n;
    }));
    triggerToast("All notifications marked as read.");
  };

  // Clear all notifications
  const handleClearAll = () => {
    const toRemove = notifications.filter(n => activeRole === "admin" ? n.forAdmin : !n.forAdmin);
    toRemove.forEach(n => {
      deleteDocument("notifications", n.id);
    });
    setNotifications(prev => {
      if (activeRole === "admin") {
        return prev.filter(n => !n.forAdmin);
      } else {
        return prev.filter(n => n.forAdmin);
      }
    });
    triggerToast("Notifications feed cleared.");
  };

  const handleToggleRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: !n.read } : n));
  };

  // --- Calculations for UI ---
  const activeWorkoutPlan = workoutPlans.find(p => p.id === currentMember?.workoutPlanId) || workoutPlans[0];
  const activeDietPlan = dietPlans.find(d => d.id === currentMember?.dietPlanId) || dietPlans[0];

  // Exercises checklist for ONLY today (simulate getting matching day e.g. Friday)
  const currentDayName = new Date().toLocaleDateString([], { weekday: "long" }); // e.g. Friday
  // Fallback to Monday if Rest Day or not found in routine
  const todayRoutine = activeWorkoutPlan?.weeklyRoutine?.find(r => r.day === currentDayName) || activeWorkoutPlan?.weeklyRoutine?.[0];

  // Leaderboard data calculation
  const calculatedLeaderboard = members
    .filter(m => m.status !== "Pending Approval")
    .map(m => ({
      name: m.name,
      points: m.points,
      streak: m.streak,
      badge: m.streak >= 14 ? "Streak Legend 🔥" : m.points >= 1500 ? "Consistency Pro ⭐" : "Power Lifter 💪",
      isCurrentUser: m.id === currentMember.id
    }))
    .sort((a, b) => b.points - a.points)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  // Admin filter members
  const filteredAdminMembers = members.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
                        m.memberId.toLowerCase().includes(memberSearchQuery.toLowerCase());
    return matchSearch;
  });

  const activeCount = members.filter(m => m.status === "Active" || m.status === "Expiring Soon").length;
  const expiringCount = members.filter(m => m.status === "Expiring Soon").length;
  const pendingCount = members.filter(m => m.status === "Pending Approval").length;
  const todayString = new Date().toISOString().split("T")[0];
  const todayAttendeesCount = members.filter(m => m.attendanceHistory?.includes(todayString)).length;

  if (isLoading || authChecking) {
    return (
      <div className="h-full w-full overflow-y-auto bg-[#020202] text-white font-sans flex flex-col items-center justify-center relative select-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-yellow-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="z-10 text-center space-y-6 max-w-sm px-6">
          <div className="w-16 h-16 bg-yellow-400/10 border-2 border-yellow-400 rounded-2xl flex items-center justify-center text-yellow-400 mx-auto animate-spin">
            <Dumbbell size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">
              Singh Fitness <span className="text-yellow-400">Gym</span>
            </h1>
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-mono mt-1">Connecting securely...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-[#020202] text-white font-sans relative pb-28 md:pb-8" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
      
      {/* 1. LIQUID GLASS BACKDROP GLOWS */}
      <div className="absolute top-[-150px] left-[-150px] w-[350px] md:w-[600px] h-[350px] md:h-[600px] bg-yellow-500/10 rounded-full blur-[100px] md:blur-[160px] pointer-events-none"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-amber-500/10 rounded-full blur-[80px] md:blur-[140px] pointer-events-none"></div>
      <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] bg-yellow-600/5 rounded-full blur-[150px] pointer-events-none"></div>

      {/* 2. DYNAMIC REAL-TIME TOAST */}
      {showToast && (
        <div className="fixed top-24 right-6 z-50 bg-neutral-950/90 border border-yellow-400 text-yellow-400 px-6 py-4 rounded-2xl shadow-[0_10px_30px_rgba(250,204,21,0.2)] flex items-center gap-3 animate-slideIn">
          <Sparkles size={18} className="animate-pulse" />
          <span className="font-black text-xs uppercase tracking-wider">{toastText}</span>
        </div>
      )}

      {/* Real database-backed Auth and Multi-role management systems active */}

      {/* 4. MAIN GYM HEADER PORTAL */}
      <header className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between mt-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase leading-none">
              Singh Fitness <span className="text-yellow-400">Gym</span>
            </h1>
            <p className="text-[9px] uppercase tracking-widest text-white/40 font-black mt-1">
              {activeRole === "admin" ? "Owner Control System" : "Member Portal"}
            </p>
          </div>
        </div>

        {/* Real-Time Status Clock */}
        <div className="hidden lg:flex items-center gap-6 bg-white/[0.02] border border-white/[0.08] rounded-2xl px-4 py-2 text-xs font-mono tracking-widest text-white/60">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-yellow-400" />
            <span>{currentTime}</span>
          </div>
          <div className="h-4 w-[1px] bg-white/10"></div>
          <div>{currentDate}</div>
        </div>

        {/* Notification Bell + Profile Card */}
        <div className="flex items-center gap-4">
          {(activeRole === "member" || activeRole === "admin") && (
            <NotificationCenter
              notifications={notifications}
              isAdmin={activeRole === "admin"}
              onMarkAllRead={handleMarkAllRead}
              onClearAll={handleClearAll}
              onToggleRead={handleToggleRead}
            />
          )}

          {currentUser && (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[9px] text-white/40 uppercase tracking-widest font-black leading-none">Session Profile</p>
                <p className="text-xs font-mono font-bold text-yellow-400 mt-1">
                  {activeRole === "admin" ? "Coach Singh Fitness" : currentMember?.name}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full border border-yellow-400/50 p-0.5 bg-neutral-900 flex items-center justify-center text-xs font-black text-yellow-400 uppercase">
                {activeRole === "admin" ? "CA" : currentMember?.name.split(" ").map(n => n[0]).join("")}
              </div>
              {activeRole === "admin" && (
                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="p-2 w-10 h-10 bg-white/5 hover:bg-red-500/20 hover:text-red-400 border border-white/10 rounded-full transition-all cursor-pointer flex items-center justify-center text-white/60"
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* 5. VISITOR REGISTRATION VIEW (FIREBASE AUTHENTICATION INTERFACE) */}
      {activeRole === "visitor" && (
        <main className="max-w-2xl mx-auto px-4 py-12">
          {currentUser === null ? (
            /* Google Sign In Card */
            <div className="bg-white/[0.02] border border-white/[0.08] backdrop-blur-2xl rounded-[32px] p-6 md:p-10 shadow-2xl relative text-center max-w-md mx-auto">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 rounded-bl-full pointer-events-none"></div>
              
              <div className="w-16 h-16 bg-yellow-400/10 border border-yellow-400/20 rounded-2xl flex items-center justify-center text-yellow-400 mx-auto mb-6 shadow-[0_0_20px_rgba(250,204,21,0.08)]">
                <Dumbbell size={28} />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white">Gym Entry Portal</h2>
              <p className="text-xs text-white/40 uppercase tracking-wider mt-1 mb-8">
                Sign in securely with Google to access your membership details
              </p>

              {authError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3.5 rounded-xl mb-6 flex items-center gap-2 text-left">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authSubmitting}
                className="w-full py-4 bg-white text-black hover:bg-neutral-100 disabled:opacity-50 active:scale-[0.98] transition-all font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl flex items-center justify-center gap-3 cursor-pointer"
              >
                {authSubmitting ? (
                  <span className="animate-pulse">Authenticating...</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Onboarding Registration Form */
            <div className="bg-white/[0.02] border border-white/[0.08] backdrop-blur-2xl rounded-[32px] p-6 md:p-10 shadow-2xl relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 rounded-bl-full pointer-events-none"></div>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-yellow-400/10 border border-yellow-400/20 rounded-2xl flex items-center justify-center text-yellow-400 mx-auto mb-4 shadow-[0_0_20px_rgba(250,204,21,0.08)]">
                  <Dumbbell size={28} />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-white">Onboarding Registration</h2>
                <p className="text-xs text-white/40 uppercase tracking-wider mt-1">
                  Complete your Singh Fitness Gym fitness profile & subscription payment
                </p>
              </div>

              {authError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3.5 rounded-xl mb-6 flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Steps Indicator */}
              <div className="flex items-center justify-center gap-3 mb-8">
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  regStep === 1 
                    ? "bg-yellow-400 border-yellow-400 text-black" 
                    : "bg-white/5 border-white/10 text-white/50"
                }`}>
                  Step 1: Personal Details
                </div>
                <div className="h-[1px] w-6 bg-white/20"></div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  regStep === 2 
                    ? "bg-yellow-400 border-yellow-400 text-black" 
                    : "bg-white/5 border-white/10 text-white/50"
                }`}>
                  Step 2: Subscription Access & Payment
                </div>
              </div>

              <form onSubmit={regStep === 1 ? (e) => { e.preventDefault(); setRegStep(2); } : handleSubmitRegistration} className="space-y-6">
                {regStep === 1 ? (
                  /* Step 1: Personal details */
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="text-[10px] font-black uppercase text-white/40 tracking-wider block mb-2">Full Name</label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. Navmeet Singh"
                          value={regForm.name}
                          onChange={e => setRegForm({...regForm, name: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-white/40 tracking-wider block mb-2">Email Address (Google Account)</label>
                        <input
                          disabled
                          type="email"
                          value={currentUser.email || ""}
                          className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-white/50 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="text-[10px] font-black uppercase text-white/40 tracking-wider block mb-2">Phone Number</label>
                        <input
                          required
                          type="tel"
                          pattern="[0-9]{10}"
                          maxLength={10}
                          title="Please enter exactly 10 digits"
                          placeholder="e.g. 9876543210"
                          value={regForm.phone}
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setRegForm({...regForm, phone: val});
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-white/40 tracking-wider block mb-2">Residential Address</label>
                        <input
                          required
                          type="text"
                          placeholder="Street No, Area, City"
                          value={regForm.address}
                          onChange={e => setRegForm({...regForm, address: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-white/40 tracking-wider block mb-2">Height (cm)</label>
                        <input
                          required
                          type="number"
                          value={regForm.height}
                          onChange={e => setRegForm({...regForm, height: Number(e.target.value)})}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-white/40 tracking-wider block mb-2">Weight (kg)</label>
                        <input
                          required
                          type="number"
                          value={regForm.weight}
                          onChange={e => setRegForm({...regForm, weight: Number(e.target.value)})}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-white/40 tracking-wider block mb-2">Target Weight (kg)</label>
                        <input
                          required
                          type="number"
                          value={regForm.targetWeight}
                          onChange={e => setRegForm({...regForm, targetWeight: Number(e.target.value)})}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-white/40 tracking-wider block mb-2">Preferred Shift</label>
                        <select
                          value={regForm.preferredShift}
                          onChange={e => setRegForm({...regForm, preferredShift: e.target.value as "Morning Shift" | "Evening Shift"})}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400 select-none"
                        >
                          <option value="Morning Shift">Morning Shift</option>
                          <option value="Evening Shift">Evening Shift</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-white/40 tracking-wider block mb-3">Fitness Goals (Select all that apply)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          "General strength",
                          "Fat loss",
                          "Fat gain",
                          "Muscle gain",
                          "Cardiovascular Endurance",
                          "Flexibility & Posture"
                        ].map(option => {
                          const isSelected = regForm.goals.toLowerCase().includes(option.toLowerCase());
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => {
                                let currentGoals = regForm.goals ? regForm.goals.split(", ").map(g => g.trim()).filter(Boolean) : [];
                                const existIndex = currentGoals.findIndex(g => g.toLowerCase() === option.toLowerCase());
                                if (existIndex >= 0) {
                                  currentGoals.splice(existIndex, 1);
                                } else {
                                  currentGoals.push(option);
                                }
                                setRegForm({
                                  ...regForm,
                                  goals: currentGoals.join(", ")
                                });
                              }}
                              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all text-xs cursor-pointer ${
                                isSelected
                                  ? "bg-yellow-400/10 border-yellow-400 text-yellow-400 font-bold shadow-[0_0_12px_rgba(250,204,21,0.08)]"
                                  : "bg-black/40 border-white/10 text-white/70 hover:border-white/20"
                              }`}
                            >
                              <div className={`w-4.5 h-4.5 rounded-md flex items-center justify-center border transition-colors ${
                                isSelected ? "border-yellow-400 bg-yellow-400 text-black" : "border-white/25 bg-transparent"
                              }`}>
                                {isSelected && <Check size={12} strokeWidth={3} />}
                              </div>
                              <span>{option}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-white/40 tracking-wider block mb-2">Referral Code (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. SINGH_FITNESSJOHN1234"
                        value={regForm.referralCode}
                        onChange={e => setRegForm({...regForm, referralCode: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400 font-mono uppercase"
                      />
                      <p className="text-[10px] text-white/35 mt-1">If a friend referred you, enter their unique code to give them bonus points!</p>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 active:scale-[0.98] transition-all text-black font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-4"
                    >
                      Continue to Payment & Review
                      <ChevronRight size={14} />
                    </button>
                  </div>
                ) : (
                  /* Step 2: Access Selection & QR code payment */
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black uppercase text-white/40 tracking-wider block mb-3">Choose Your Gym Access Plan</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          {
                            key: "Full gym plus cardio [ 1700 rupee/month ]",
                            title: "Full Gym + Cardio",
                            price: "₹1,700",
                            desc: "Premium unrestricted access to all strength machinery & high-end cardiovascular zone."
                          },
                          {
                            key: "Full gym without cardio [ 1200 rupee/month ]",
                            title: "Full Gym (No Cardio)",
                            price: "₹1,200",
                            desc: "Complete strength training floor access. Does not include the premium cardio floor machines."
                          }
                        ].map(plan => {
                          const isSelected = regForm.gymAccess === plan.key;
                          return (
                            <button
                              key={plan.key}
                              type="button"
                              onClick={() => setRegForm({ ...regForm, gymAccess: plan.key })}
                              className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between h-40 cursor-pointer ${
                                isSelected
                                  ? "bg-yellow-400/10 border-yellow-400 text-white shadow-[0_0_15px_rgba(250,204,21,0.12)]"
                                  : "bg-black/40 border-white/10 text-white/70 hover:border-white/20"
                              }`}
                            >
                              <div>
                                <div className="flex justify-between items-center">
                                  <h4 className="font-black text-sm uppercase tracking-wide">{plan.title}</h4>
                                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                    isSelected ? "border-yellow-400 bg-yellow-400" : "border-white/30"
                                  }`}>
                                    {isSelected && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                                  </div>
                                </div>
                                <p className="text-[10px] text-white/50 mt-2 leading-relaxed">{plan.desc}</p>
                              </div>
                              <p className="text-lg font-black text-yellow-400 font-mono mt-2">{plan.price} <span className="text-xs text-white/40 font-normal">/ Month</span></p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-6 mt-6 text-center">
                      <h3 className="text-sm font-black uppercase tracking-tight mb-2 text-white">Onboarding Subscription Payment</h3>
                      <p className="text-[11px] text-white/40 uppercase tracking-wider mb-6">
                        {gymConfig.qrCodeUrl ? "Scan QR Code below to make payment" : "Please transfer to the UPI ID listed below"}
                      </p>
                      
                      {gymConfig.qrCodeUrl ? (
                        <div className="max-w-xs mx-auto bg-white p-5 rounded-3xl mb-6 shadow-2xl">
                          <img
                            src={gymConfig.qrCodeUrl}
                            alt="Payment QR Code"
                            referrerPolicy="no-referrer"
                            className="w-48 h-48 mx-auto rounded-xl object-contain"
                          />
                          <div className="text-center mt-3 text-black animate-pulse">
                            <p className="text-[9px] font-black uppercase text-black/50 tracking-widest">Singh Fitness Gym Merchant QR</p>
                            <p className="text-xs font-mono font-bold mt-1">UPI ID: {gymConfig.upiId}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="max-w-sm mx-auto bg-yellow-400/5 border border-yellow-400/20 p-5 rounded-2xl mb-6 text-center">
                          <p className="text-[9px] font-black uppercase text-yellow-400 tracking-widest">Singh Fitness Gym Direct UPI Transfer</p>
                          <p className="text-lg font-mono font-black text-white mt-1.5 select-all">{gymConfig.upiId}</p>
                          <p className="text-[10px] text-white/40 mt-2">Tap/Hold the UPI ID to copy, then pay using any UPI App (GPay, PhonePe, Paytm)</p>
                        </div>
                      )}

                      <div className="space-y-3 max-w-sm mx-auto text-left bg-white/5 border border-white/5 p-4 rounded-xl text-xs">
                        <div className="flex justify-between">
                          <span className="text-white/50">Plan Selected:</span>
                          <span className="font-bold text-yellow-400">{regForm.gymAccess.split(" [")[0]}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Monthly Cost:</span>
                          <span className="font-bold font-mono text-white">
                            {regForm.gymAccess.includes("1700") ? "₹1,700" : "₹1,200"} / Month
                          </span>
                        </div>
                        <div className="h-[1px] bg-white/10"></div>
                        <div className="flex justify-between text-yellow-400 font-bold">
                          <span>Total Paid Amount:</span>
                          <span>{regForm.gymAccess.includes("1700") ? "₹1,700" : "₹1,200"} INR</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setRegStep(1)}
                        className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest rounded-2xl border border-white/10 transition-colors cursor-pointer"
                      >
                        Back to Details
                      </button>
                      <button
                        type="submit"
                        disabled={authSubmitting}
                        className="flex-[2] py-4 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 active:scale-[0.98] transition-all text-black font-black text-xs uppercase tracking-widest rounded-2xl shadow-[0_4px_20px_rgba(250,204,21,0.25)] flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {authSubmitting ? (
                          <span className="animate-pulse">Submitting Application...</span>
                        ) : (
                          <>
                            Submit Application & Notify Admin
                            <Check size={14} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}
        </main>
      )}

      {/* 6. MEMBER STATUS: PENDING VIEW */}
      {activeRole === "pending" && (
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="bg-white/[0.02] border border-white/[0.08] backdrop-blur-2xl rounded-[32px] p-8 md:p-12 shadow-2xl relative">
            <div className="w-16 h-16 bg-yellow-400/10 border border-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock size={28} className="text-yellow-400 animate-spin" />
            </div>
            
            <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">Awaiting Gym Approval</h2>
            <p className="text-sm text-yellow-400/80 font-bold uppercase tracking-wider mb-6">Payment and registration details under review</p>

            <p className="text-xs text-white/50 leading-relaxed max-w-md mx-auto mb-8">
              Hello <span className="text-white font-bold">{currentMember.name}</span>, thank you for completing your premium enrollment! Our owner and head dietician, Coach Singh Fitness, is currently reviewing your weight ({currentMember.weight} kg), height ({currentMember.height} cm), and goals ({currentMember.goals}) to configure your custom workout days and macros list.
            </p>

            <div className="p-4 bg-white/5 rounded-2xl max-w-sm mx-auto border border-white/5 text-left mb-8">
              <h4 className="text-[10px] uppercase font-black tracking-widest text-white/40 mb-3">Your Registration Summary</h4>
              <div className="space-y-1.5 text-xs text-white/70">
                <p>Phone: <span className="font-mono text-white">{currentMember.phone}</span></p>
                <p>Address: <span className="text-white">{currentMember.address}</span></p>
                <p>Preferred Shift: <span className="font-bold text-yellow-400">{currentMember.preferredShift}</span></p>
                <p>Assigned Trainer: <span className="text-white">Coach Singh Fitness (Awaiting approval)</span></p>
              </div>
            </div>


          </div>
        </main>
      )}

      {/* 6.5 MEMBER STATUS: EXPIRED VIEW */}
      {activeRole === "expired" && (
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="bg-neutral-950 border border-red-500/30 backdrop-blur-2xl rounded-[32px] p-8 md:p-12 shadow-[0_0_50px_rgba(239,68,68,0.1)] relative">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={28} className="text-red-500 animate-pulse" />
            </div>
            
            <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">Membership Expired</h2>
            <p className="text-sm text-red-400 font-bold uppercase tracking-wider mb-6">Access Restricted</p>

            <p className="text-xs text-white/60 leading-relaxed max-w-md mx-auto mb-8">
              Hello <span className="text-white font-bold">{currentMember.name}</span>, your membership plan has expired. To restore your premium access to workout schedules, dietary tracking, daily check-ins, and analytics, please renew your subscription using the secure QR payment gateway below.
            </p>

            {/* Price Selection */}
            <div className="mb-8 space-y-3 max-w-sm mx-auto text-left">
              <label className="text-[10px] uppercase font-black tracking-widest text-white/40 block">Select Plan Duration</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "1 Month", price: "₹1,700" },
                  { label: "2 Months", price: "₹3,200" },
                  { label: "3 Months", price: "₹4,500" }
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setRenewalDuration(p.label)}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      renewalDuration === p.label
                        ? "bg-red-500/10 border-red-500 text-white font-bold"
                        : "bg-white/[0.02] border-white/5 text-white/60 hover:bg-white/[0.04]"
                    }`}
                  >
                    <p className="text-xs font-black uppercase">{p.label}</p>
                    <p className="text-[10px] text-yellow-400 font-bold mt-1">{p.price}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Gateway Payment Details */}
            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 mb-8 max-w-md mx-auto space-y-4">
              <h4 className="text-[10px] uppercase font-black tracking-widest text-white/40">Secure QR Gateway Transfer</h4>
              
              <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/5">
                {gymConfig.qrCodeUrl ? (
                  <div className="bg-white p-3 rounded-xl mb-3">
                    <img 
                      src={gymConfig.qrCodeUrl} 
                      alt="UPI QR Code" 
                      className="w-40 h-40 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-40 h-40 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 mb-3 text-white/30 text-[10px] uppercase tracking-wider font-bold">
                    No QR Setup Yet
                  </div>
                )}
                <p className="text-[10px] text-white/50 uppercase tracking-wider">Scan using GPay, PhonePe, Paytm, or BHIM</p>
                <p className="text-xs font-mono font-bold text-white mt-1.5 select-all">UPI ID: {gymConfig.upiId}</p>
              </div>
            </div>

            {/* Action Submit */}
            <button
              onClick={async () => {
                const updatedM = {
                  ...currentMember,
                  status: "Pending Approval" as const,
                  membershipDuration: renewalDuration
                };
                setMembers(prev => prev.map(m => m.id === currentMember.id ? updatedM : m));
                setActiveRole("pending");
                await saveDocument("members", updatedM);

                // Add renewal request notification for coach
                const renewalReqNotif: GymNotification = {
                  id: `renewal-req-${Date.now()}`,
                  timestamp: "Just Now",
                  title: "⚠️ Renewal Request Submitted",
                  message: `${currentMember.name} has requested membership renewal for: ${renewalDuration}.`,
                  type: "info",
                  read: false
                };
                setNotifications(prev => [renewalReqNotif, ...prev]);
                triggerToast("Renewal request submitted! Awaiting owner verification. 🤝");
              }}
              className="w-full max-w-md py-4 bg-red-500 hover:bg-red-400 active:scale-[0.98] transition-all rounded-2xl font-black text-xs text-white uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer shadow-[0_8px_20px_rgba(239,68,68,0.2)] border-t border-white/20"
            >
              Request Renewal Approval
              <Check size={14} />
            </button>
          </div>
        </main>
      )}

      {/* 7. MEMBER ACTIVE PORTAL */}
      {activeRole === "member" && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6 pb-28">
          
          {/* B. TAB CONTENT */}

          {/* HOME TAB */}
          {activeMemberTab === "home" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Side: greeting, scan QR, streak, expiring notification */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Greeting Header & Scanner Trigger */}
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row lg:flex-col items-center justify-between gap-4">
                  <div className="text-center md:text-left lg:text-center">
                    <h2 className="text-lg font-black uppercase tracking-tight text-white">Daily Onboarding</h2>
                    <p className="text-xs text-white/50 leading-relaxed mt-1">
                      {getShiftGreeting(currentMember)}
                    </p>
                  </div>
                  
                  {/* Glowing QR Attendance button */}
                  {currentMember.attendanceHistory?.includes(todayString) ? (
                    <div className="w-full md:w-auto lg:w-full py-4 px-6 bg-green-500/10 border border-green-500/20 rounded-2xl text-center flex items-center justify-center gap-2 text-green-400">
                      <Check size={16} className="text-green-400 shrink-0" />
                      <span className="text-xs uppercase font-black tracking-widest">Attendance Marked Till Next Day</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setScanningState("idle");
                        setShowScanner(true);
                      }}
                      className="w-full md:w-auto lg:w-full py-4 px-6 bg-yellow-400 hover:bg-yellow-300 active:scale-[0.98] transition-all rounded-2xl font-black text-xs text-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(250,204,21,0.25)] border-t border-white/20 shrink-0 cursor-pointer"
                    >
                      <QrCode size={16} />
                      Mark Attendance
                    </button>
                  )}
                </div>

                {/* Streak Card */}
                <div className="bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/15 rounded-3xl p-6 shadow-xl relative overflow-hidden flex justify-between items-center">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-400/5 rounded-bl-full pointer-events-none"></div>
                  <div>
                    <span className="text-[9px] text-yellow-400 font-black uppercase tracking-widest block">Consistency Streak</span>
                    <p className="text-2xl font-black text-white mt-1">
                      {currentMember.streak} Days Active
                    </p>
                    <span className="text-[10px] text-white/40 block mt-1">Keep it up! Your goals are within reach.</span>
                  </div>
                  <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-[0_4px_12px_rgba(250,204,21,0.3)] shrink-0">
                    <Flame size={24} className="text-black fill-black animate-pulse" />
                  </div>
                </div>

                {/* Membership Expiring Status Alert */}
                <div className={`p-6 rounded-3xl border transition-all shadow-xl relative overflow-hidden ${
                  currentMember.status === "Expiring Soon"
                    ? "bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent border-orange-500/35 shadow-[0_0_20px_rgba(249,115,22,0.15)]"
                    : "bg-white/[0.02] border-white/[0.08]"
                }`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Membership Status</span>
                      <span className="text-sm font-bold text-white mt-1 block">
                        {currentMember.membershipDuration || "3-Month Flex Pass"}
                      </span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      currentMember.status === "Expiring Soon" 
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse" 
                        : "bg-green-500/15 text-green-400 border border-green-500/20"
                    }`}>
                      {currentMember.status === "Expiring Soon" ? "Expiring Soon! ⚠️" : "Premium Member"}
                    </span>
                  </div>

                  {currentMember.status === "Expiring Soon" ? (
                    <div className="space-y-3.5">
                      <p className="text-xs text-orange-400/90 leading-relaxed font-bold">
                        Warning: Your subscription ends in 3 days on July 6, 2026. Keep your streak alive!
                      </p>
                      <button
                        onClick={() => { window.location.hash = 'renew'; setActiveRole('expired'); }}
                        className="w-full py-2.5 bg-orange-500 hover:bg-orange-400 transition-colors text-white font-black text-[10px] uppercase tracking-widest rounded-xl"
                      >
                        Renew Subscription (₹1,700 / month)
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-white/50 leading-relaxed font-medium">
                      Active until: <span className="font-mono font-bold text-white">{currentMember.expiryDate}</span>. Enjoy unlimited access.
                    </div>
                  )}
                </div>

                {/* Announcements widget */}
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-3xl p-6 shadow-xl relative">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.04]">
                    <Bell size={14} className="text-yellow-400" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-white/60">Owners Announcements</h3>
                  </div>
                  
                  <div className="space-y-4 pr-1">
                    {announcements.map(ann => (
                      <div key={ann.id} className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-xl text-left">
                        <div className="flex justify-between items-baseline mb-1">
                          <h4 className="text-xs font-bold text-yellow-400">{ann.title}</h4>
                          <span className="text-[8px] font-mono text-white/30">{ann.date}</span>
                        </div>
                        <p className="text-[11px] text-white/70 leading-normal">{ann.content}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Side: Daily Workout checkboxes, Diet checklist, Sleep, Water */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* 1. Daily Workout Checklist ONLY */}
                <div className="bg-white/[0.02] border border-white/[0.08] backdrop-blur-2xl rounded-[32px] p-6 shadow-2xl">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tight text-white">Daily Workout Schedule</h3>
                      <p className="text-xs text-white/40 uppercase tracking-widest font-black mt-1">
                        Active Curriculum: {activeWorkoutPlan.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full font-black uppercase">
                        {currentDayName}
                      </span>
                    </div>
                  </div>

                  {todayRoutine.isRestDay ? (
                    <div className="text-center py-10 bg-white/[0.01] rounded-2xl border border-dashed border-white/10 text-white/40">
                      <p className="text-xl">🧘 Sunday Rest Day</p>
                      <p className="text-xs mt-1">Enjoy recovery, hydrate well, and relax!</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pr-1">
                      {todayRoutine.exercises.map(ex => (
                        <div
                          key={ex.id}
                          className="flex items-center justify-between p-3.5 bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.04] hover:border-white/10 rounded-2xl transition-all"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Checkbox button */}
                            <button
                              onClick={() => handleToggleExercise(ex.id)}
                              className="w-5.5 h-5.5 rounded-lg border border-white/20 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              {currentMember.completedExercises?.includes(ex.id) && (
                                <div className="w-3.5 h-3.5 rounded-md bg-yellow-400 flex items-center justify-center">
                                  <Check size={11} className="text-black" strokeWidth={3} />
                                </div>
                              )}
                            </button>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{ex.name}</p>
                              <p className="text-[10px] text-white/40 font-mono mt-0.5">{ex.sets}</p>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => setShowVideoModal(ex)}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase text-yellow-400 tracking-wider flex items-center gap-1 transition-colors"
                          >
                            <Play size={10} className="fill-yellow-400 text-yellow-400" />
                            Guide
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Diet Daily Checklist */}
                <div className="bg-white/[0.02] border border-white/[0.08] backdrop-blur-2xl rounded-[32px] p-6 shadow-2xl">
                  <div className="mb-4">
                    <h3 className="text-lg font-black uppercase tracking-tight text-white">Daily Meals Nutrition</h3>
                    <p className="text-xs text-white/40 uppercase tracking-widest font-black mt-1">
                      Assigned Menu Plan: {activeDietPlan.name}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeDietPlan.meals.map(meal => (
                      <div
                        key={meal.id}
                        onClick={() => handleToggleMeal(meal.id)}
                        className="p-3.5 bg-white/[0.01] hover:bg-white/[0.02] border border-white/[0.04] rounded-2xl flex items-start gap-3 cursor-pointer transition-all"
                      >
                        <div className="w-5 h-5 rounded-lg border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                          {currentMember.completedMeals?.includes(meal.id) && (
                            <div className="w-3.5 h-3.5 rounded-md bg-yellow-400 flex items-center justify-center">
                              <Check size={11} className="text-black" strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">{meal.name}</h4>
                          <p className="text-[10px] text-white/55 mt-1 leading-normal">{meal.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Sleep & Water Trackers (Combined Row) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Water Hydration */}
                  <div className="bg-white/[0.02] border border-white/[0.08] rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Hydration Goal</span>
                      <p className="text-xl font-black text-white mt-1">
                        {currentMember.waterIntake}L <span className="text-xs text-white/30 font-normal">/ 4.0L Target</span>
                      </p>
                    </div>

                    {/* Blue dynamic animated liquid level bar */}
                    <div className="w-full bg-white/5 h-4 rounded-full overflow-hidden my-4 border border-white/5 relative">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                        style={{ width: `${Math.min(100, (currentMember.waterIntake / 4.0) * 100)}%` }}
                      ></div>
                    </div>

                    <div className="flex gap-2.5">
                      <button
                        onClick={() => handleAdjustWater(-0.25)}
                        className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold flex justify-center items-center gap-1 cursor-pointer"
                      >
                        <Minus size={12} /> -250ml
                      </button>
                      <button
                        onClick={() => handleAdjustWater(0.25)}
                        className="flex-1 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black rounded-xl text-xs font-black flex justify-center items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} /> +250ml
                      </button>
                    </div>
                  </div>

                  {/* Sleep Tracker */}
                  <div className="bg-white/[0.02] border border-white/[0.08] rounded-3xl p-5 shadow-xl flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Recovery Hours</span>
                      <p className="text-xl font-black text-white mt-1">
                        {currentMember.sleepHours} Hrs <span className="text-xs text-white/30 font-normal">/ 8.0 Hrs Target</span>
                      </p>
                    </div>

                    <div className="my-4 text-xs text-white/50 leading-relaxed font-medium">
                      Optimal muscle fiber synthesis requires continuous 8-hour deep sleep. Current status is {currentMember.sleepHours >= 8 ? "Excellent" : "Slightly Deprived"}.
                    </div>

                    <button
                      onClick={() => {
                        setNewSleepInput(currentMember.sleepHours.toString());
                        setShowSleepModal(true);
                      }}
                      className="w-full py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white flex justify-center items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                    >
                      <Moon size={14} className="text-yellow-400" />
                      Log Sleep Recovery
                    </button>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* FITNESS TAB */}
          {activeMemberTab === "fitness" && (
            <div className="space-y-8 max-w-5xl mx-auto">
              
              {/* Plan Intro Banner */}
              <div className="bg-gradient-to-r from-yellow-500/10 via-transparent to-transparent border border-white/[0.08] backdrop-blur-xl rounded-[32px] p-6 shadow-2xl relative">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-[9px] text-yellow-400 font-black uppercase tracking-widest block">Coach Recommendation</span>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-white mt-1">{activeWorkoutPlan.name}</h2>
                    <p className="text-xs text-white/50 mt-1">{activeWorkoutPlan.description}</p>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl max-w-xs text-left">
                    <p className="text-[9px] uppercase font-black tracking-widest text-white/40">Trainer Feedback</p>
                    <p className="text-xs text-white/80 mt-1 leading-normal">
                      "{currentMember.trainerNote || "Ready to execute the daily schedules!"}"
                    </p>
                  </div>
                </div>
              </div>

              {/* Fitness Section Shifter */}
              <div className="flex justify-center mb-6">
                <div className="bg-white/5 border border-white/10 p-1 rounded-2xl flex gap-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => setActiveFitnessSection("workout")}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
                      activeFitnessSection === "workout"
                        ? "bg-yellow-400 text-black shadow-[0_4px_12px_rgba(250,204,21,0.25)] font-black"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    🏋️ Workout Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFitnessSection("diet")}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
                      activeFitnessSection === "diet"
                        ? "bg-yellow-400 text-black shadow-[0_4px_12px_rgba(250,204,21,0.25)] font-black"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    🥗 Dietary Plan
                  </button>
                </div>
              </div>

              {/* Weekly Schedule Details Accordion */}
              {activeFitnessSection === "workout" && (
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-[32px] p-6 shadow-2xl animate-fadeIn">
                <h3 className="text-lg font-black uppercase tracking-tight text-white mb-6">Weekly Training Calendar</h3>
                
                <div className="space-y-4">
                  {activeWorkoutPlan.weeklyRoutine.map(routine => (
                    <div 
                      key={routine.day}
                      className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-left"
                    >
                      <div className="flex items-center gap-4 shrink-0 min-w-[120px]">
                        <span className="text-xs font-black uppercase tracking-wider text-yellow-400">{routine.day}</span>
                        {routine.isRestDay && (
                          <span className="text-[10px] bg-yellow-400/10 text-yellow-400 font-bold px-2 py-0.5 rounded uppercase">Rest</span>
                        )}
                      </div>

                      {routine.isRestDay ? (
                        <p className="text-xs text-white/40 flex-1 leading-normal">
                          Allow muscle tissue inflammation to dissipate. Do active stretching, light walks, or yoga exercises.
                        </p>
                      ) : (
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {routine.exercises.map(ex => (
                            <button
                              key={ex.id}
                              onClick={() => setShowVideoModal(ex)}
                              className="p-2.5 bg-white/5 hover:bg-white/10 active:scale-95 transition-all border border-white/5 rounded-xl text-left truncate flex items-center justify-between group cursor-pointer"
                            >
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-white block truncate">{ex.name}</span>
                                <span className="text-[9px] font-mono text-white/40">{ex.sets}</span>
                              </div>
                              <Play size={10} className="text-yellow-400 fill-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1.5" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Diet Onboarding Details */}
              {activeFitnessSection === "diet" && (
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-[32px] p-6 shadow-2xl animate-fadeIn">
                <h3 className="text-lg font-black uppercase tracking-tight text-white mb-6">Assigned Nutritional Macros</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-white/5 rounded-2xl text-center">
                    <p className="text-[9px] uppercase font-black tracking-widest text-white/40">Daily Protein</p>
                    <p className="text-xl font-mono font-black text-yellow-400 mt-1">170g</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl text-center">
                    <p className="text-[9px] uppercase font-black tracking-widest text-white/40">Daily Carbs</p>
                    <p className="text-xl font-mono font-black text-white mt-1">280g</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl text-center">
                    <p className="text-[9px] uppercase font-black tracking-widest text-white/40">Daily Healthy Fats</p>
                    <p className="text-xl font-mono font-black text-white mt-1">75g</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {activeDietPlan.meals.map(meal => (
                    <div 
                      key={meal.id}
                      className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-2xl flex justify-between items-start text-left"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-white">{meal.name}</h4>
                        <p className="text-xs text-white/60 leading-normal mt-1">{meal.desc}</p>
                      </div>
                      <span className="text-[9px] bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded font-black uppercase shrink-0">
                        Macro Balanced
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Explore other plans */}
              {activeFitnessSection === "workout" && (
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-[32px] p-6 shadow-2xl text-center animate-fadeIn">
                <h3 className="text-lg font-black uppercase tracking-tight text-white mb-2">Explore Training Curriculums</h3>
                <p className="text-xs text-white/40 uppercase tracking-widest font-black mb-8">Need to change your program? Ask Coach Singh Fitness.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {workoutPlans.map(plan => (
                    <div 
                      key={plan.id}
                      className="p-5 bg-white/[0.01] border border-white/[0.05] rounded-2xl text-left flex flex-col justify-between"
                    >
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-tight text-white">{plan.name}</h4>
                        <p className="text-xs text-white/50 mt-1 leading-relaxed">{plan.description}</p>
                      </div>
                      <div className="mt-6 flex justify-between items-center pt-4 border-t border-white/[0.04]">
                        <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">Premium Access</span>
                        {currentMember.workoutPlanId === plan.id ? (
                          <span className="text-[10px] bg-green-500/15 border border-green-500/25 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase">
                            Currently Active
                          </span>
                        ) : planRequests.find(r => r.memberId === currentMember.id && r.requestedPlanName === plan.name)?.status === "Pending" ? (
                          <button
                            disabled
                            className="px-3.5 py-1.5 bg-yellow-400/50 text-black/50 font-black text-[10px] uppercase tracking-wider rounded-lg cursor-not-allowed"
                          >
                            Requested
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRequestPlanChange(plan.name)}
                            className="px-3.5 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                          >
                            Request Shift
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}

            </div>
          )}

          {/* PROGRESS TAB */}
          {activeMemberTab === "progress" && (
            <div className="space-y-6 max-w-5xl mx-auto">
              
              {/* Performance Section Shifter */}
              <div className="flex justify-center mb-6">
                <div className="bg-white/5 border border-white/10 p-1 rounded-2xl flex gap-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => setActivePerformanceSection("report")}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
                      activePerformanceSection === "report"
                        ? "bg-yellow-400 text-black shadow-[0_4px_12px_rgba(250,204,21,0.25)] font-black"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    📊 Progress Report
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePerformanceSection("leaderboard")}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
                      activePerformanceSection === "leaderboard"
                        ? "bg-yellow-400 text-black shadow-[0_4px_12px_rgba(250,204,21,0.25)] font-black"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    🏆 Leaderboard
                  </button>
                </div>
              </div>

              {/* Report Section */}
              {activePerformanceSection === "report" && (
                <>
                  {/* Monthly Export CTA Panel */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/[0.02] border border-white/[0.08] p-5 rounded-3xl gap-4 animate-fadeIn">
                    <div>
                      <h3 className="text-xs font-black uppercase text-white tracking-wider">Download PDF Summary</h3>
                      <p className="text-[10px] text-white/40 mt-1">Export a beautifully structured overview of weight checks, streaks, and completed sets.</p>
                    </div>
                    <button
                      onClick={handleDownloadMonthlyProgress}
                      className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-[0_2px_8px_rgba(250,204,21,0.2)]"
                    >
                      Download Monthly Progress
                    </button>
                  </div>

                  {/* Metrics Sparkline Block */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
                
                {/* Weight Loss Card */}
                <div className="bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl rounded-3xl p-6 shadow-xl relative">
                  <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Weight Goal Check</span>
                  <div className="flex justify-between items-baseline mt-2 mb-4">
                    <p className="text-3xl font-black text-white">{currentMember.weight} kg</p>
                    <span className="text-xs font-bold text-green-400">Target: {currentMember.targetWeight} kg</span>
                  </div>
                  
                  {/* Miniature progress track */}
                  <div className="w-full bg-white/5 h-2 rounded-full mb-4">
                    <div className="h-full bg-green-400 rounded-full" style={{ width: "82%" }}></div>
                  </div>

                  <button
                    onClick={() => {
                      setNewWeightInput(currentMember.weight.toString());
                      setShowWeightModal(true);
                    }}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase text-white tracking-widest border border-white/10 transition-colors"
                  >
                    Log New Weight Check
                  </button>
                </div>

                {/* Total Points Card */}
                <div className="bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl rounded-3xl p-6 shadow-xl relative flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Total Points Balance</span>
                    <p className="text-3xl font-black text-yellow-400 mt-2">{currentMember.points} PTS</p>
                  </div>
                  <p className="text-[10px] text-white/50 mt-3">
                    Obtained through daily attendance check-ins, finishing scheduled workouts, and macro logs.
                  </p>
                </div>

                {/* Gym Badges */}
                <div className="bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl rounded-3xl p-6 shadow-xl relative">
                  <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Earned Standing Badge</span>
                  <div className="flex items-center gap-3.5 mt-4">
                    <div className="w-11 h-11 rounded-xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center shrink-0">
                      <Trophy size={18} className="text-yellow-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">Consistency Legend</h4>
                      <p className="text-[10px] text-white/40">Streak is greater than 10 sessions</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Weight Loss Progress Graph */}
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-[32px] p-6 shadow-2xl">
                <div className="mb-4">
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">Weight Loss Progress</h3>
                  <p className="text-xs text-white/40 uppercase tracking-widest font-black mt-1">
                    Visualizing historical weight check-ins relative to target weight goal
                  </p>
                </div>
                <React.Suspense fallback={<div className="h-64 flex items-center justify-center text-white/50 text-xs">Loading Chart...</div>}>
                  <WeightChart
                    weightHistory={currentMember.weightHistory}
                    targetWeight={currentMember.targetWeight || 75}
                  />
                </React.Suspense>
              </div>

              {/* Swipeable Monthly Attendance Calendar Integration */}
              <SwipeableMonthCalendar
                attendanceHistory={currentMember.attendanceHistory}
                completedExercises={currentMember.completedExercises}
                completedMeals={currentMember.completedMeals}
                joinedDate={currentMember.joinedDate}
              />
              </>
              )}

              {/* Achievements & Leaderboard (All in One) */}
              {activePerformanceSection === "leaderboard" && (() => {
                const filteredLeaderboard = calculatedLeaderboard.filter(user =>
                  user.name.toLowerCase().includes(leaderboardSearchQuery.toLowerCase())
                );
                return (
                  <div className="bg-white/[0.02] border border-white/[0.08] rounded-[32px] p-6 shadow-2xl animate-fadeIn">
                    <div className="text-center mb-5 max-w-sm mx-auto">
                      <h3 className="text-lg font-black uppercase tracking-tight text-white">Weekly Member Standing</h3>
                      <p className="text-xs text-white/40 uppercase tracking-widest font-black mt-1">Earn points through absolute daily consistency</p>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-6 max-w-md mx-auto">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <Search size={15} className="text-white/40" />
                      </div>
                      <input
                        type="text"
                        value={leaderboardSearchQuery}
                        onChange={(e) => setLeaderboardSearchQuery(e.target.value)}
                        placeholder="Search for friends or gym peers..."
                        className="w-full py-2.5 pl-11 pr-10 bg-white/5 hover:bg-white/[0.08] focus:bg-white/[0.08] border border-white/10 focus:border-yellow-400/50 rounded-2xl text-xs text-white placeholder-white/30 focus:outline-none transition-all"
                      />
                      {leaderboardSearchQuery && (
                        <button
                          onClick={() => setLeaderboardSearchQuery("")}
                          className="absolute inset-y-0 right-3.5 flex items-center text-white/40 hover:text-white/80 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {filteredLeaderboard.length === 0 ? (
                        <div className="text-center py-10 bg-white/[0.01] border border-white/5 rounded-2xl">
                          <p className="text-xs text-white/40">No gym peers found matching "{leaderboardSearchQuery}"</p>
                        </div>
                      ) : (
                        filteredLeaderboard.map((user, index) => (
                          <div
                            key={index}
                            className={`p-3.5 rounded-2xl border flex items-center justify-between text-left transition-all ${
                              user.isCurrentUser
                                ? "bg-yellow-400 text-black border-yellow-400 shadow-lg font-bold"
                                : "bg-white/[0.01] border-white/5 text-white"
                            }`}
                          >
                            <div className="flex items-center gap-3.5">
                              <span className="font-mono font-black text-sm w-5 text-center">#{user.rank}</span>
                              <div>
                                <p className="text-xs font-black truncate">{user.name}</p>
                                <span className={`text-[9px] uppercase ${user.isCurrentUser ? "text-black/60 font-black" : "text-white/40"}`}>
                                  {user.badge}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="text-xs font-black">{user.points} PTS</p>
                              <p className={`text-[9px] ${user.isCurrentUser ? "text-black/70" : "text-white/40"}`}>
                                Streak: {user.streak} Days
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>
          )}

          {/* PROFILE TAB */}
          {activeMemberTab === "profile" && (
            <BoardingPass
              member={currentMember}
              onCopyReferral={(code) => triggerToast(`Copied referral code: ${code}`)}
              onSignOut={handleSignOut}
            />
          )}

          {/* Floating Footer Navigation Bar (Icons Only, No names) */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full flex items-center gap-6 shadow-[0_12px_40px_rgba(0,0,0,0.5)] z-50">
            <button
              onClick={() => setActiveMemberTab("home")}
              className={`p-3 rounded-full transition-all cursor-pointer ${
                activeMemberTab === "home" 
                  ? "bg-yellow-400 text-black scale-110 shadow-[0_0_15px_rgba(250,204,21,0.4)]" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
              title="Home"
            >
              <Home size={20} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setActiveMemberTab("fitness")}
              className={`p-3 rounded-full transition-all cursor-pointer ${
                activeMemberTab === "fitness" 
                  ? "bg-yellow-400 text-black scale-110 shadow-[0_0_15px_rgba(250,204,21,0.4)]" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
              title="Fitness"
            >
              <Dumbbell size={20} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setActiveMemberTab("progress")}
              className={`p-3 rounded-full transition-all cursor-pointer ${
                activeMemberTab === "progress" 
                  ? "bg-yellow-400 text-black scale-110 shadow-[0_0_15px_rgba(250,204,21,0.4)]" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
              title="Progress"
            >
              <Trophy size={20} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setActiveMemberTab("profile")}
              className={`p-3 rounded-full transition-all cursor-pointer ${
                activeMemberTab === "profile" 
                  ? "bg-yellow-400 text-black scale-110 shadow-[0_0_15px_rgba(250,204,21,0.4)]" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
              title="Profile"
            >
              <User size={20} strokeWidth={2.5} />
            </button>
          </div>

        </div>
      )}

      {/* 8. ADMIN DASHBOARD PORTAL */}
      {activeRole === "admin" && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6 pb-28">
          
          {/* B. ADMIN CONTENT */}

          {/* ADMIN DASHBOARD TAB */}
          {activeAdminTab === "dashboard" && (
            <div className="space-y-8">
              
              {/* Quick Action reports bar with PDF Generation */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/[0.02] border border-white/[0.08] p-5 rounded-3xl gap-4 animate-fadeIn">
                <div>
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">System Reports Panel</h3>
                  <p className="text-[10px] text-white/40 mt-1">Compile comprehensive member metric sheets, inactivity/absence alerts, and onboarding analytics.</p>
                </div>
                <button
                  onClick={handleDownloadAdminGymReport}
                  className="px-4 py-2.5 bg-red-500 hover:bg-red-400 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-[0_4px_12px_rgba(239,68,68,0.3)] flex items-center gap-2 border border-red-500/20 active:scale-[0.98] focus:outline-none"
                >
                  <FileText size={12} />
                  Download Gym Report (PDF)
                </button>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                
                <button 
                  onClick={() => setActivePopupType("active")}
                  className="bg-white/[0.02] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.05] rounded-2xl p-5 shadow-xl text-left transition-all cursor-pointer group active:scale-[0.98] focus:outline-none"
                >
                  <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block group-hover:text-white/60 transition-colors">Active Members</span>
                  <div className="flex justify-between items-baseline mt-1">
                    <p className="text-3xl font-black text-white">{activeCount}</p>
                    <span className="text-[10px] text-red-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">View All →</span>
                  </div>
                </button>

                <button 
                  onClick={() => setActivePopupType("today")}
                  className="bg-white/[0.02] border border-white/[0.08] hover:border-yellow-400/30 hover:bg-white/[0.05] rounded-2xl p-5 shadow-xl text-left transition-all cursor-pointer group active:scale-[0.98] focus:outline-none"
                >
                  <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block group-hover:text-white/60 transition-colors">Today Attendees</span>
                  <div className="flex justify-between items-baseline mt-1">
                    <p className="text-3xl font-black text-yellow-400">{todayAttendeesCount}</p>
                    <span className="text-[10px] text-yellow-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">View All →</span>
                  </div>
                </button>

                <button 
                  onClick={() => setActivePopupType("expiring")}
                  className="bg-white/[0.02] border border-white/[0.08] hover:border-orange-500/30 hover:bg-white/[0.05] rounded-2xl p-5 shadow-xl text-left relative overflow-hidden transition-all cursor-pointer group active:scale-[0.98] focus:outline-none"
                >
                  <div className="absolute top-0 right-0 w-8 h-8 bg-orange-500/15 flex items-center justify-center rounded-bl-xl text-orange-400">
                    <AlertTriangle size={12} className="animate-pulse" />
                  </div>
                  <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block group-hover:text-white/60 transition-colors">Expiring Soon</span>
                  <div className="flex justify-between items-baseline mt-1">
                    <p className="text-3xl font-black text-orange-400">{expiringCount}</p>
                    <span className="text-[10px] text-orange-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">View All →</span>
                  </div>
                </button>

                <button 
                  onClick={() => setActivePopupType("pending")}
                  className="bg-white/[0.02] border border-white/[0.08] hover:border-cyan-400/30 hover:bg-white/[0.05] rounded-2xl p-5 shadow-xl text-left transition-all cursor-pointer group active:scale-[0.98] focus:outline-none"
                >
                  <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block group-hover:text-white/60 transition-colors">Pending Approvals</span>
                  <div className="flex justify-between items-baseline mt-1">
                    <p className="text-3xl font-black text-cyan-400">{pendingCount}</p>
                    <span className="text-[10px] text-cyan-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">View All →</span>
                  </div>
                </button>

              </div>

              {/* Pending Approvals List */}
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-[32px] p-6 shadow-2xl">
                <div className="mb-6">
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">Pending Registrations</h3>
                  <p className="text-xs text-white/40 uppercase tracking-widest font-black mt-1">Review onboarding applicants and assign routines</p>
                </div>

                <div className="space-y-4">
                  {members.filter(m => m.status === "Pending Approval").length > 0 ? (
                    members.filter(m => m.status === "Pending Approval").map(m => (
                      <div 
                        key={m.id}
                        className="p-5 bg-white/[0.01] border border-white/[0.04] rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left"
                      >
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h4 className="font-black text-sm text-white">{m.name}</h4>
                            <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-cyan-400/10 text-cyan-400 uppercase">Awaiting Assignment</span>
                          </div>
                          <div className="text-[11px] text-white/50 space-y-0.5 mt-2">
                            <p>Phone: <span className="text-white font-mono">{m.phone}</span> • Address: <span className="text-white">{m.address}</span></p>
                            <p>Metrics: <span className="text-yellow-400 font-bold">{m.weight} kg</span> • Preferred Shift: <span className="text-white">{m.preferredShift}</span></p>
                            <p>Plan Selected: <span className="text-yellow-400 font-bold uppercase">{m.gymAccess || "Full Gym + Cardio"}</span></p>
                            <p>Fitness Goal: <span className="text-yellow-400 font-black">{m.goals}</span></p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setAssigningMember(m);
                            setTrainerNoteInput(`Onboarding note: Focus on ${m.goals}. Begin with basic stretching.`);
                          }}
                          className="px-4 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-colors cursor-pointer shrink-0"
                        >
                          Configure Curriculum
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-white/30 text-xs">No pending member registrations. Excellent!</div>
                  )}
                </div>
              </div>

              {/* Plan change Requests list */}
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-[32px] p-6 shadow-2xl">
                <div className="mb-6">
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">Member Plan Shift Requests</h3>
                  <p className="text-xs text-white/40 uppercase tracking-widest font-black mt-1">Requests from members to transfer to alternative training plans</p>
                </div>

                <div className="space-y-4">
                  {planRequests.length > 0 ? (
                    planRequests.map(req => (
                      <div 
                        key={req.id}
                        className="p-5 bg-white/[0.01] border border-white/[0.04] rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-white">{req.memberName}</h4>
                            <span className="text-[9px] text-white/30 font-mono">({req.timestamp})</span>
                          </div>
                          <p className="text-xs text-white/50 mt-1">
                            Current Plan: <span className="text-white/80 font-bold">{req.currentPlanName}</span> → Requested Shift: <span className="text-yellow-400 font-black">{req.requestedPlanName}</span>
                          </p>
                        </div>

                        <div>
                          {req.status === "Pending" ? (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                onClick={() => handleApprovePlanChange(req.id, req.memberId, req.requestedPlanName)}
                                className="px-3.5 py-2 bg-green-500 hover:bg-green-400 text-white font-black text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleDisapprovePlanChange(req.id, req.requestedPlanName)}
                                className="px-3.5 py-2 bg-red-500/20 border border-red-500/50 hover:bg-red-500/40 text-red-500 hover:text-white font-black text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                              >
                                Disapprove
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row items-center gap-3">
                              <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded ${
                                req.status === "Approved" ? "text-green-400 bg-green-400/15" : "text-red-400 bg-red-400/15"
                              }`}>
                                Shift {req.status} {req.status === "Approved" ? "✓" : "✕"}
                              </span>
                              <button
                                onClick={() => handleDeletePlanChange(req.id)}
                                className="text-white/40 hover:text-white transition-colors cursor-pointer p-1"
                                title="Delete Record"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-white/30 text-xs">No plan shift requests filed.</div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ADMIN MEMBERS TAB */}
          {activeAdminTab === "members" && (
            <div className="space-y-6">
              
              {/* Search Bar */}
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 flex items-center gap-3">
                <Search size={18} className="text-white/40" />
                <input
                  type="text"
                  placeholder="Search members by Name or Member ID..."
                  value={memberSearchQuery}
                  onChange={e => setMemberSearchQuery(e.target.value)}
                  className="bg-transparent border-none focus:outline-none w-full text-sm text-white placeholder-white/30"
                />
              </div>

              {/* Members Grid Ledger */}
              <div className="text-left space-y-4">
                <h3 className="text-xs font-black uppercase text-white/40 tracking-widest pl-1">All Member Logs ({filteredAdminMembers.length})</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAdminMembers.map(m => (
                    <div 
                      key={m.id}
                      onClick={() => {
                        setInspectedMemberId(m.id);
                        setIsInspectorOpen(true);
                      }}
                      className="p-5 rounded-3xl border bg-white/[0.01] border-white/5 hover:bg-white/[0.04] hover:border-white/12 transition-all cursor-pointer flex flex-col justify-between gap-4 group"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-black text-base text-white group-hover:text-red-500 transition-colors">{m.name}</h4>
                          <p className="text-[10px] font-mono text-white/40 mt-1">{m.memberId || "Pending Verification"}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                          m.status === "Pending Approval" ? "bg-cyan-500/10 text-cyan-400" :
                          m.status === "Expiring Soon" ? "bg-orange-500/15 text-orange-400 animate-pulse" :
                          "bg-green-500/15 text-green-400"
                        }`}>
                          {m.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t border-white/[0.04] pt-3.5 mt-1">
                        <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider">Goal: {m.goals.split(", ")[0]}</span>
                        <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          Inspect Account →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating On-Screen Member Inspector Drawer/Modal */}
              {isInspectorOpen && (
                <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4">
                  {/* Backdrop */}
                  <div 
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    onClick={() => setIsInspectorOpen(false)}
                  ></div>
                  
                  {/* Modal Container: Bottom sheet on mobile, centered modal on desktop */}
                  <div className="relative w-full max-w-lg bg-neutral-950/95 border-t md:border border-white/10 rounded-t-[32px] md:rounded-[32px] p-6 pb-16 md:pb-16 shadow-2xl space-y-6 z-10 max-h-[85vh] md:max-h-[90vh] overflow-y-auto custom-scrollbar text-left animate-slideUp md:animate-fadeIn">
                    
                    {/* Bottom-sheet indicator handle for mobile devices */}
                    <div className="w-12 h-1 bg-white/20 rounded-full mx-auto -mt-2 mb-2 md:hidden" />
                    
                    {/* Stable Top Header Row with Close Button */}
                    <div className="flex justify-between items-center pb-3 border-b border-white/[0.05]">
                      <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Gym Member Ledger File</span>
                      <button 
                        onClick={() => setIsInspectorOpen(false)}
                        className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all cursor-pointer border border-white/10 text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                      >
                        Close ×
                      </button>
                    </div>

                    {(() => {
                      const member = members.find(m => m.id === inspectedMemberId);
                      if (!member) {
                        return <div className="p-8 text-center text-white/30 text-xs">Select a member to view details.</div>;
                      }

                      // Helper inside scope for rendering last 7 days of compliance
                      const getLast7Days = () => {
                        const days = [];
                        for (let i = 6; i >= 0; i--) {
                          const d = new Date();
                          d.setDate(d.getDate() - i);
                          days.push(d);
                        }
                        return days;
                      };

                      return (
                        <>
                          {/* Header Details */}
                          <div className="flex justify-between items-start pb-4 border-b border-white/[0.05]">
                            <div>
                              <h3 className="text-xl font-black uppercase text-white leading-tight">{member.name}</h3>
                              <p className="text-xs text-yellow-400 font-bold mt-1.5 uppercase tracking-wider">{member.goals} • {member.preferredShift}</p>
                              <p className="text-[10px] text-white/40 mt-1 font-mono">DB ID: {member.id}</p>
                            </div>
                            <span className={`text-[10px] px-2.5 py-1 rounded font-bold uppercase whitespace-nowrap ${
                              member.status === "Pending Approval" ? "bg-cyan-500/10 text-cyan-400" :
                              member.status === "Expiring Soon" ? "bg-orange-500/15 text-orange-400 animate-pulse" :
                              "bg-green-500/15 text-green-400"
                            }`}>
                              {member.status}
                            </span>
                          </div>

                          {/* General contact list */}
                          <div className="grid grid-cols-2 gap-4 text-xs bg-white/[0.01] p-4 rounded-2xl border border-white/[0.03]">
                            <div>
                              <span className="text-white/40 block mb-0.5">Phone Contact</span>
                              <span className="font-mono text-white font-bold">{member.phone}</span>
                            </div>
                            <div>
                              <span className="text-white/40 block mb-0.5">Address</span>
                              <span className="text-white truncate block">{member.address}</span>
                            </div>
                            <div className="mt-1">
                              <span className="text-white/40 block mb-0.5">Height / Weight</span>
                              <span className="text-white font-bold">{member.height}cm / {member.weight}kg</span>
                            </div>
                            <div className="mt-1">
                              <span className="text-white/40 block mb-0.5">Join Date</span>
                              <span className="text-white font-mono">{member.joinedDate || "Pending"}</span>
                            </div>
                          </div>

                          {/* Member progress states */}
                          <div className="space-y-3.5">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Member Standing Metrics</h4>
                            
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div className="p-3 bg-white/5 rounded-xl">
                                <p className="text-[8px] uppercase text-white/40">Streak</p>
                                <p className="text-sm font-black text-white">{member.streak} Days</p>
                              </div>
                              <div className="p-3 bg-white/5 rounded-xl">
                                <p className="text-[8px] uppercase text-white/40">Standing Points</p>
                                <p className="text-sm font-black text-yellow-400">{member.points} PTS</p>
                              </div>
                              <div className="p-3 bg-white/5 rounded-xl">
                                <p className="text-[8px] uppercase text-white/40">Referrals</p>
                                <p className="text-sm font-black text-white">{member.referrals} friends</p>
                              </div>
                            </div>

                            {/* Swipeable Monthly Calendar Integration */}
                            <SwipeableMonthCalendar
                              attendanceHistory={member.attendanceHistory}
                              completedExercises={member.completedExercises}
                              completedMeals={member.completedMeals}
                              joinedDate={member.joinedDate}
                            />
                          </div>

                          {/* Weight Loss & History Tracker with Swipeable Weight Graph */}
                          <div className="space-y-4 border-t border-white/5 pt-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Weight Loss & Goals Track</h4>
                            
                            {(() => {
                              const startingWeight = member.weightHistory && member.weightHistory.length > 0 ? member.weightHistory[0].weight : member.weight;
                              const currentWeight = member.weight;
                              const targetWeight = member.targetWeight || 75;
                              const weightLost = startingWeight - currentWeight;
                              const isLossGoal = startingWeight > targetWeight;
                              const progressPercent = Math.min(100, Math.max(0, isLossGoal 
                                ? ((startingWeight - currentWeight) / (startingWeight - targetWeight)) * 100 
                                : ((currentWeight - startingWeight) / (targetWeight - startingWeight)) * 100
                              ));

                              return (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-3 gap-3 text-center">
                                    <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded-xl">
                                      <p className="text-[8px] uppercase text-white/40">Starting Weight</p>
                                      <p className="text-sm font-black text-white">{startingWeight} kg</p>
                                    </div>
                                    <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded-xl">
                                      <p className="text-[8px] uppercase text-white/40">Current Weight</p>
                                      <p className="text-sm font-black text-yellow-400">{currentWeight} kg</p>
                                    </div>
                                    <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded-xl">
                                      <p className="text-[8px] uppercase text-white/40">Target Goal</p>
                                      <p className="text-sm font-black text-white">{targetWeight} kg</p>
                                    </div>
                                  </div>

                                  {/* Goal progress bar */}
                                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1.5">
                                    <div className="flex justify-between text-[10px] uppercase font-black">
                                      <span className="text-white/50">Goal Progress</span>
                                      <span className={weightLost >= 0 ? "text-green-400" : "text-orange-400"}>
                                        {weightLost >= 0 
                                          ? `🏆 Lost ${weightLost.toFixed(1)} kg so far`
                                          : `📈 Gained ${Math.abs(weightLost).toFixed(1)} kg`}
                                      </span>
                                    </div>
                                    <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden border border-white/5">
                                      <div 
                                        className="bg-gradient-to-r from-yellow-500 to-amber-400 h-full rounded-full transition-all duration-500"
                                        style={{ width: `${progressPercent || 1}%` }}
                                      ></div>
                                    </div>
                                  </div>

                                  {/* Monthly Interactive Weight Graph with Swipe / Switcher */}
                                  <React.Suspense fallback={<div className="h-64 flex items-center justify-center text-white/50 text-xs">Loading Chart...</div>}>
                                    <WeightChart
                                      weightHistory={member.weightHistory}
                                      targetWeight={targetWeight}
                                    />
                                  </React.Suspense>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Plans assignment display */}
                          <div className="space-y-2 border-t border-white/5 pt-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Assigned Curriculum</h4>
                            <div className="p-4 bg-white/5 rounded-xl text-xs space-y-1">
                              <p>Workout: <span className="font-bold text-white">{workoutPlans.find(p => p.id === member.workoutPlanId)?.name || "Unassigned"}</span></p>
                              <p>Dietary: <span className="font-bold text-white">{dietPlans.find(d => d.id === member.dietPlanId)?.name || "Unassigned"}</span></p>
                              {member.trainerNote && (
                                <p className="text-white/55 italic mt-1.5 border-t border-white/5 pt-1.5">
                                  Note: "{member.trainerNote}"
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Change Plans Feature (Admin Direct Change without request) */}
                          <div className="space-y-4 border-t border-white/5 pt-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Modify Workout & Diet Plans</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[9px] uppercase font-black text-white/40 tracking-wider block mb-1">Workout Plan</label>
                                <select
                                  value={member.workoutPlanId || ""}
                                  onChange={async (e) => {
                                    const val = e.target.value;
                                    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, workoutPlanId: val } : m));
                                    const updatedMember = { ...member, workoutPlanId: val };
                                    await saveDocument("members", updatedMember);
                                    triggerToast(`Workout plan updated for ${member.name}! 🏋️`);
                                  }}
                                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400 font-bold"
                                >
                                  <option value="">-- Unassigned --</option>
                                  {workoutPlans.map(wp => (
                                    <option key={wp.id} value={wp.id} className="bg-neutral-950 text-white">{wp.name}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-[9px] uppercase font-black text-white/40 tracking-wider block mb-1">Diet Plan</label>
                                <select
                                  value={member.dietPlanId || ""}
                                  onChange={async (e) => {
                                    const val = e.target.value;
                                    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, dietPlanId: val } : m));
                                    const updatedMember = { ...member, dietPlanId: val };
                                    await saveDocument("members", updatedMember);
                                    triggerToast(`Diet plan updated for ${member.name}! 🥗`);
                                  }}
                                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400 font-bold"
                                >
                                  <option value="">-- Unassigned --</option>
                                  {dietPlans.map(dp => (
                                    <option key={dp.id} value={dp.id} className="bg-neutral-950 text-white">{dp.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="text-[9px] uppercase font-black text-white/40 tracking-wider block mb-1">Trainer Note</label>
                              <input
                                type="text"
                                placeholder="Add special instructions, e.g. limit heavy squats..."
                                defaultValue={member.trainerNote || ""}
                                onBlur={async (e) => {
                                    const val = e.target.value;
                                    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, trainerNote: val } : m));
                                    const updatedMember = { ...member, trainerNote: val };
                                    await saveDocument("members", updatedMember);
                                    triggerToast(`Trainer note updated for ${member.name}! 📝`);
                                }}
                                className="w-full bg-black border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-yellow-400"
                              />
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ADMIN SETTINGS TAB */}
          {activeAdminTab === "settings" && (
            <div className="space-y-6 max-w-4xl mx-auto">
              
              {/* Settings Section Shifter */}
              <div className="w-full">
                <div className="bg-white/5 border border-white/10 p-1 rounded-xl grid grid-cols-5 gap-1 shadow-lg">
                  {[
                    { id: "payment", label: "Payment" },
                    { id: "announcement", label: "Broadcast" },
                    { id: "workout", label: "Workout" },
                    { id: "diet", label: "Diet" },
                    { id: "qr", label: "QR Code" }
                  ].map(sect => (
                    <button
                      key={sect.id}
                      type="button"
                      onClick={() => setActiveSettingsSection(sect.id as any)}
                      className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-tight text-center transition-all cursor-pointer truncate ${
                        activeSettingsSection === sect.id
                          ? "bg-red-500 text-white shadow-[0_2px_8px_rgba(239,68,68,0.25)]"
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {sect.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment & UPI Configurations Card */}
              {activeSettingsSection === "payment" && (
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-[32px] p-6 text-left shadow-2xl animate-fadeIn">
                <div className="mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.08)]">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-white">Payment & UPI Configurations</h3>
                    <p className="text-xs text-white/40 uppercase tracking-widest font-black mt-1">Configure Gym Merchant UPI ID & Payment QR Code image URL</p>
                  </div>
                </div>

                <form onSubmit={handleSavePaymentConfig} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-white/40 block mb-2">Gym Merchant UPI ID</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. pay@singh_fitness"
                        value={bUpiId}
                        onChange={e => setBUpiId(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-white/40 block mb-2">Payment QR Code Image URL (Leave blank to show only UPI ID)</label>
                      <input
                        type="text"
                        placeholder="e.g. https://domain.com/my-qr-code.png"
                        value={bQrCodeUrl}
                        onChange={e => setBQrCodeUrl(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-4">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">
                      * Onboarding members will see this configuration instantly.
                    </p>
                    <button
                      type="submit"
                      className="py-3 px-6 bg-yellow-400 hover:bg-yellow-300 active:scale-[0.98] transition-all text-black font-black text-xs uppercase tracking-widest rounded-xl shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check size={14} strokeWidth={3} />
                      Save Payment Config
                    </button>
                  </div>
                </form>
              </div>
              )}

              {/* Send Announcements form */}
              {activeSettingsSection === "announcement" && (
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-[32px] p-6 text-left shadow-2xl animate-fadeIn">
                <div className="mb-6">
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">Broadcast Announcement</h3>
                  <p className="text-xs text-white/40 uppercase tracking-widest font-black mt-1">Broadcast direct message to all member feeds instantly</p>
                </div>

                <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-white/40 block mb-2">Message Header Title</label>
                    <input
                      type="text"
                      placeholder="e.g. 🧘 Yoga session, protein bar discount..."
                      value={newAnnouncementTitle}
                      onChange={e => setNewAnnouncementTitle(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-white/40 block mb-2">Content Message Body</label>
                    <textarea
                      rows={3}
                      placeholder="Write message contents here..."
                      value={newAnnouncementContent}
                      onChange={e => setNewAnnouncementContent(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500 resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="py-3 px-6 bg-red-500 hover:bg-red-400 active:scale-[0.98] transition-all text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send size={12} />
                    Broadcast Global Feed Announcement
                  </button>
                </form>
              </div>
              )}

              {/* Workout Plan Builder Card */}
              {activeSettingsSection === "workout" && (
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-[32px] p-6 text-left shadow-2xl flex flex-col justify-between animate-fadeIn">
                  <div>
                    <div className="mb-6">
                      <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                        <Dumbbell size={24} className="text-yellow-400" />
                        Workout Plan Builder
                      </h3>
                      <p className="text-xs text-white/40 uppercase tracking-widest font-black mt-1">Design training schedules with customized pricing, daily routines, precautions & tutorial video links</p>
                    </div>

                    <form onSubmit={handleCreateWorkoutPlan} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black uppercase text-white/40 block mb-2">Workout Plan Title Name</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Hypertrophy Muscle Shred, Powerlift Max..."
                            value={bWorkoutName}
                            onChange={e => setBWorkoutName(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-white/40 block mb-2">Plan Goal Focus</label>
                          <select
                            value={bWorkoutFocus}
                            onChange={e => setBWorkoutFocus(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500 cursor-pointer"
                          >
                            <option value="General strength">General strength</option>
                            <option value="Fat loss">Fat loss</option>
                            <option value="Fat gain">Fat gain</option>
                            <option value="Muscle gain">Muscle gain</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black uppercase text-white/40 block mb-2">Price Tag Fee (INR)</label>
                          <div className="relative">
                            <span className="absolute left-4 top-3 text-sm text-white/40 font-mono">₹</span>
                            <input
                              type="number"
                              required
                              placeholder="1499"
                              value={bWorkoutPrice}
                              onChange={e => setBWorkoutPrice(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-white/40 block mb-2">Plan Summary Description</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. High intensity 5-day cycle split compound overload..."
                            value={bWorkoutDesc}
                            onChange={e => setBWorkoutDesc(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500"
                          />
                        </div>
                      </div>

                      {/* Day-by-day nested curriculum builder */}
                      <div className="border-t border-white/10 pt-6 mt-6">
                        <h4 className="text-xs font-black uppercase tracking-wider text-yellow-400 mb-4 flex items-center gap-1.5">
                          <ClipboardList size={14} />
                          Granular Weekdays Routine Builder
                        </h4>
                        
                        <div className="bg-black/40 border border-white/5 rounded-2xl p-4 mb-6">
                          <label className="text-[10px] font-black uppercase text-white/40 block mb-2">Select Target Weekday to design</label>
                          <div className="flex flex-wrap gap-1 mb-4">
                            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => {
                              const count = bWorkoutDays[day]?.length || 0;
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => setBSelectedDay(day)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                                    bSelectedDay === day 
                                      ? "bg-yellow-400 text-black shadow-md" 
                                      : "bg-white/5 text-white/60 hover:text-white"
                                  }`}
                                >
                                  {day.slice(0,3)}
                                  {count > 0 && <span className="bg-neutral-800 text-yellow-400 text-[9px] px-1.5 py-0.5 rounded-full font-mono font-black">{count}</span>}
                                </button>
                              );
                            })}
                          </div>

                          {/* Exercises added in selected day */}
                          <div className="mb-4 space-y-2 pr-1">
                            <p className="text-[10px] font-black uppercase text-white/30">Current scheduled exercises on {bSelectedDay}:</p>
                            {bWorkoutDays[bSelectedDay]?.length === 0 ? (
                              <p className="text-xs text-white/40 italic py-2 bg-white/[0.01] border border-dashed border-white/5 rounded-xl text-center">Rest Day / No exercises defined yet. Add them below!</p>
                            ) : (
                              bWorkoutDays[bSelectedDay].map(ex => (
                                <div key={ex.id} className="flex items-start justify-between bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs">
                                  <div className="space-y-1 text-left">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-white">{ex.name}</span>
                                      <span className="bg-yellow-400/10 text-yellow-400 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono">{ex.sets}</span>
                                    </div>
                                    <p className="text-[10px] text-white/50">{ex.tutorial}</p>
                                    {ex.precautions && ex.precautions.length > 0 && (
                                      <p className="text-[9px] text-red-400/70">⚠️ Precautions: {ex.precautions.join(", ")}</p>
                                    )}
                                    {ex.youtubeUrl && (
                                      <span className="inline-flex items-center gap-1 text-[9px] text-yellow-400 font-bold bg-yellow-400/5 px-1.5 py-0.5 rounded border border-yellow-400/10">
                                        <Play size={8} /> Video tutorial included
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveExerciseFromDay(bSelectedDay, ex.id)}
                                    className="p-1.5 text-white/40 hover:text-red-400 transition-colors"
                                    title="Delete Exercise"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Add exercise inline subform */}
                          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-3 mt-4">
                            <p className="text-[10px] font-black uppercase text-white/60">➕ Add Exercise to {bSelectedDay}</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[9px] font-black uppercase text-white/40">Exercise Name</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Incline DB Press, Hack Squat"
                                  value={bExerciseName}
                                  onChange={e => setBExerciseName(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-black uppercase text-white/40">Sets & Reps</label>
                                <input
                                  type="text"
                                  placeholder="e.g. 4 sets x 12, 10, 8, 6 reps"
                                  value={bExerciseSets}
                                  onChange={e => setBExerciseSets(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[9px] font-black uppercase text-white/40">Video / YouTube Tutorial Link (Optional)</label>
                                <input
                                  type="url"
                                  placeholder="https://www.youtube.com/watch?v=..."
                                  value={bExerciseVideoUrl}
                                  onChange={e => setBExerciseVideoUrl(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-black uppercase text-white/40">Instructions / Tutorial Description</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Keep chest up, lower till thighs parallel..."
                                  value={bExerciseTutorial}
                                  onChange={e => setBExerciseTutorial(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[9px] font-black uppercase text-white/40">Precautions (One per line)</label>
                                <textarea
                                  rows={2}
                                  placeholder="e.g. Do not lock out knees at top&#10;Avoid rounding your lower back"
                                  value={bExercisePrecautions}
                                  onChange={e => setBExercisePrecautions(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400 resize-none"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-black uppercase text-white/40">Step-by-step Execution Steps (One per line)</label>
                                <textarea
                                  rows={2}
                                  placeholder="e.g. Unrack the bar carefully&#10;Lower in a slow, controlled 3-second eccentric phase&#10;Explode upward powerfully"
                                  value={bExerciseSteps}
                                  onChange={e => setBExerciseSteps(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400 resize-none"
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleAddExerciseToDay}
                              className="w-full py-2 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-widest rounded-lg transition-all border border-white/10 flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Plus size={10} />
                              Confirm & Add Exercise to {bSelectedDay}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        type="submit"
                        className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Dumbbell size={14} />
                        Publish Completed Workout Plan Template
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Diet Plan Builder Card */}
              {activeSettingsSection === "diet" && (
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-[32px] p-6 text-left shadow-2xl flex flex-col justify-between animate-fadeIn">
                  <div>
                    <div className="mb-6">
                      <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                        <Flame size={24} className="text-yellow-400" />
                        Dietary Plan Builder
                      </h3>
                      <p className="text-xs text-white/40 uppercase tracking-widest font-black mt-1">Design daily macro targets and customized meals templates with full ingredients lists</p>
                    </div>

                    <form onSubmit={handleCreateDietPlan} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black uppercase text-white/40 block mb-2">Diet Plan Title Name</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. High Protein Keto bulk, Clean Cutting diet..."
                            value={bDietName}
                            onChange={e => setBDietName(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-white/40 block mb-2">Dietary Instructions / Global Rules</label>
                          <input
                            type="text"
                            required
                            placeholder="Specify general rules, e.g. Drink 4L water, avoid sugars..."
                            value={bDietDesc}
                            onChange={e => setBDietDesc(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-black uppercase text-white/40 block mb-1">Target Protein (g)</label>
                          <input
                            type="number"
                            required
                            placeholder="150"
                            value={bDietProtein}
                            onChange={e => setBDietProtein(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-white/40 block mb-1">Target Carbs (g)</label>
                          <input
                            type="number"
                            required
                            placeholder="200"
                            value={bDietCarbs}
                            onChange={e => setBDietCarbs(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-white/40 block mb-1">Target Fats (g)</label>
                          <input
                            type="number"
                            required
                            placeholder="65"
                            value={bDietFats}
                            onChange={e => setBDietFats(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                          />
                        </div>
                      </div>

                      {/* Custom meals nested items builder */}
                      <div className="border-t border-white/10 pt-6 mt-6">
                        <h4 className="text-xs font-black uppercase tracking-wider text-yellow-400 mb-4 flex items-center gap-1.5">
                          <Utensils size={14} />
                          Custom Daily Meals Builder
                        </h4>
                        
                        <div className="bg-black/40 border border-white/5 rounded-2xl p-4 mb-6">
                          {/* List of currently designed meals */}
                          <div className="mb-4 space-y-2">
                            <p className="text-[10px] font-black uppercase text-white/30">Meals Added to Plan Template:</p>
                            {bDietMeals.length === 0 ? (
                              <p className="text-xs text-white/40 italic py-2 bg-white/[0.01] border border-dashed border-white/5 rounded-xl text-center">No meals added to plan template yet. Create them below!</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-1">
                                {bDietMeals.map(meal => (
                                  <div key={meal.id} className="flex items-start justify-between bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs">
                                    <div className="space-y-1 text-left font-sans">
                                      <span className="font-black text-white uppercase tracking-tight block text-[11px] text-yellow-400">{meal.name}</span>
                                      <p className="text-[10px] text-white/60 leading-relaxed whitespace-pre-wrap">{meal.desc}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMealFromPlan(meal.id)}
                                      className="p-1.5 text-white/40 hover:text-red-400 transition-colors"
                                      title="Delete Meal"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Add meal subform */}
                          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-3 mt-4">
                            <p className="text-[10px] font-black uppercase text-white/60">➕ Add Meal Template</p>
                            
                            <div>
                              <label className="text-[9px] font-black uppercase text-white/40">Meal Title / Name</label>
                              <input
                                type="text"
                                placeholder="e.g. Power Breakfast, Pre-Workout Meal, Lean Dinner"
                                value={bMealName}
                                onChange={e => setBMealName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400"
                              />
                            </div>
                            
                            <div>
                              <label className="text-[9px] font-black uppercase text-white/40">Ingredients, Portions, & Instructions</label>
                              <textarea
                                rows={3}
                                placeholder="e.g. 5 boiled egg whites, 1 cup oats cooked in water, 1 tbsp organic honey.&#10;Consume with 1 glass green tea."
                                value={bMealDesc}
                                onChange={e => setBMealDesc(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400 resize-none"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={handleAddMealToPlan}
                              className="w-full py-2 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-widest rounded-lg transition-all border border-white/10 flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Plus size={10} />
                              Confirm & Add Meal to Template List
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 mt-4"
                      >
                        <Flame size={14} />
                        Publish Completed Dietary Plan Template
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Attendance QR Generator Section */}
              {activeSettingsSection === "qr" && (
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-[32px] p-6 shadow-2xl text-center animate-fadeIn">
                <h3 className="text-lg font-black uppercase tracking-tight text-white mb-2">Generate Attendance QR Code</h3>
                <p className="text-xs text-white/40 uppercase tracking-widest font-black mb-8">Mount this code at gym exit/entry. Members scan this to log attendance.</p>

                <div className="bg-white p-5 rounded-3xl inline-block shadow-xl border border-white/10">
                  <div className="bg-white p-2 rounded-2xl">
                    <QRCodeSVG
                      value={ATTENDANCE_TOKEN}
                      size={200}
                      bgColor="#ffffff"
                      fgColor="#0a0a0a"
                      level="H"
                      imageSettings={{
                        src: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHRleHQgeT0iMThcIiBmb250LXNpemU9IjE4IiBmb250LXdlaWdodD0iYm9sZCI+QTwvdGV4dD48L3N2Zz4=",
                        height: 30,
                        width: 30,
                        excavate: true,
                      }}
                    />
                  </div>
                  <div className="text-black text-center mt-3">
                    <p className="text-[10px] font-black uppercase text-black/50 tracking-widest">Singh Fitness Fitness Gate Terminal</p>
                    <p className="text-xs font-mono font-bold mt-0.5">Terminal ID: GATE-ATTEND-2026</p>
                  </div>
                </div>

                <div className="max-w-md mx-auto mt-6 text-xs text-white/50 leading-relaxed font-medium">
                  Gate security validates checks against timestamp. Scanning provides points +100 and records check-ins inside progress heatmaps automatically.
                </div>
                <button
                  onClick={() => window.print()}
                  className="mt-5 px-6 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-[0_4px_12px_rgba(250,204,21,0.2)] cursor-pointer flex items-center gap-2 mx-auto"
                >
                  🖨️ Print QR Code for Gym Entrance
                </button>
              </div>
              )}

            </div>
          )}

          {/* Admin Floating Footer Navigation Bar (Icons Only) */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full flex items-center gap-6 shadow-[0_12px_40px_rgba(0,0,0,0.5)] z-50">
            <button
              onClick={() => setActiveAdminTab("dashboard")}
              type="button"
              className={`p-3 rounded-full transition-all cursor-pointer ${
                activeAdminTab === "dashboard" 
                  ? "bg-red-500 text-white scale-110 shadow-[0_0_15px_rgba(239,68,68,0.4)]" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
              title="Dashboard"
            >
              <LayoutDashboard size={20} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setActiveAdminTab("members")}
              type="button"
              className={`p-3 rounded-full transition-all cursor-pointer ${
                activeAdminTab === "members" 
                  ? "bg-red-500 text-white scale-110 shadow-[0_0_15px_rgba(239,68,68,0.4)]" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
              title="Members Ledger"
            >
              <Users size={20} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setActiveAdminTab("settings")}
              type="button"
              className={`p-3 rounded-full transition-all cursor-pointer ${
                activeAdminTab === "settings" 
                  ? "bg-red-500 text-white scale-110 shadow-[0_0_15px_rgba(239,68,68,0.4)]" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
              title="Settings & Builders"
            >
              <Sliders size={20} strokeWidth={2.5} />
            </button>
          </div>

        </div>
      )}

      {/* 9. ATTENDANCE SCANNING MODAL - Real Camera Scanner */}
      {showScanner && (
        <React.Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md text-yellow-400">Loading Scanner...</div>}>
          <AttendanceScanner
            memberStatus={currentMember?.status || ""}
            onSuccess={() => {
              setScanningState("success");
              setMembers(prev => prev.map(m => {
                if (m.id === currentMember.id) {
                  const todayString = new Date().toISOString().split("T")[0];
                  const hasAttendedToday = m.attendanceHistory.includes(todayString);
                  if (hasAttendedToday) {
                    triggerToast("Already Checked-In for today! 🏋️");
                    return m;
                  }
                  return {
                    ...m,
                    streak: m.streak + 1,
                    points: m.points + 100,
                    attendanceHistory: [...m.attendanceHistory, todayString],
                    absentDays: 0
                  };
                }
                return m;
              }));
              const checkInAlert: GymNotification = {
                id: `notif-chk-${Date.now()}`,
                timestamp: new Date().toISOString(),
                title: "Attendance Confirmed ✅",
                message: "Your attendance QR scan has been successfully authenticated. Streak +1, Points +100!",
                type: "success",
                read: false,
                forAdmin: false
              };
              setNotifications(prev => [checkInAlert, ...prev]);
              triggerToast("Attendance Marked! Streak +1, Points +100 🏋️");
              setTimeout(() => setShowScanner(false), 2000);
            }}
            onExpired={() => {
              setScanningState("expired");
              triggerToast("Scanner Rejected: Membership Expired 🛑");
            }}
            onClose={() => {
              setShowScanner(false);
              setScanningState("idle");
            }}
          />
        </React.Suspense>
      )}

      {/* 10. MODAL: LOG WEIGHT UPDATES */}
      {showWeightModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fadeIn">
          <div className="bg-neutral-950 border border-white/10 rounded-3xl p-6 max-w-sm w-full relative shadow-2xl">
            <button
              onClick={() => setShowWeightModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X size={16} />
            </button>

            <h3 className="text-base font-black uppercase text-white mb-2">Weight Registration</h3>
            <p className="text-xs text-white/40 uppercase tracking-widest font-black mb-5">Current standing: {currentMember.weight} kg</p>

            <form onSubmit={handleSaveWeight} className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase text-white/40 block mb-2">Enter Weight check (kg)</label>
                <input
                  required
                  type="number"
                  step="0.1"
                  value={newWeightInput}
                  onChange={e => setNewWeightInput(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition-colors"
              >
                Log Checked Metric
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 11. MODAL: LOG SLEEP HOURS */}
      {showSleepModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fadeIn">
          <div className="bg-neutral-950 border border-white/10 rounded-3xl p-6 max-w-sm w-full relative shadow-2xl">
            <button
              onClick={() => setShowSleepModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X size={16} />
            </button>

            <h3 className="text-base font-black uppercase text-white mb-2">Sleep Recovery Check</h3>
            <p className="text-xs text-white/40 uppercase tracking-widest font-black mb-5">Recorded: {currentMember.sleepHours} Hrs</p>

            <form onSubmit={handleSaveSleep} className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase text-white/40 block mb-2">Continuous Hours slept</label>
                <input
                  required
                  type="number"
                  step="0.5"
                  value={newSleepInput}
                  onChange={e => setNewSleepInput(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition-colors"
              >
                Log Recovery Hours
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 12. EXERCISE DETAIL VIDEO MODAL */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[70] animate-fadeIn">
          <div className="bg-neutral-950 border border-white/10 rounded-[32px] p-6 max-w-2xl w-full relative shadow-2xl text-left max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setShowVideoModal(null)}
              className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="mb-4">
              <span className="text-[9px] text-yellow-400 font-black uppercase tracking-widest">Exercise Training Manual</span>
              <h3 className="text-xl font-black uppercase text-white mt-1">{showVideoModal.name}</h3>
              <p className="text-xs font-mono text-white/40 mt-0.5">{showVideoModal.sets}</p>
            </div>

            {/* Video Demonstration Mockup */}
            <div className="w-full aspect-video bg-neutral-900 rounded-2xl border border-white/5 relative overflow-hidden flex items-center justify-center mb-6">
              {/* Embed mock video placeholder image using dynamic CSS styled overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 flex flex-col justify-between p-4 z-10">
                <span className="text-[10px] uppercase font-bold tracking-wider text-yellow-400 self-start bg-neutral-950/70 px-2 py-1 rounded">
                  Demonstration Video Active
                </span>
                <div className="self-center flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-yellow-400 hover:scale-110 active:scale-95 text-black rounded-full flex items-center justify-center shadow-[0_0_20px_#facc15] cursor-pointer transition-transform">
                    <Play size={24} className="fill-black text-black ml-1" />
                  </div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider drop-shadow-md">Play Form Walkthrough</span>
                </div>
                <p className="text-[9px] text-white/50 text-right">Owner Upload ID: {showVideoModal.id}</p>
              </div>
              <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(#facccd_1px,transparent_1px)] [background-size:16px_16px] opacity-10"></div>
            </div>

            {/* Steps & Safety Precautions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-white/80 leading-relaxed font-medium">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-2">Step-by-step Execution</h4>
                <ol className="list-decimal pl-4 space-y-2">
                  {showVideoModal.steps.map((st, i) => (
                    <li key={i}>{st}</li>
                  ))}
                </ol>
              </div>

              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2">Safety Precautions</h4>
                <ul className="list-disc pl-4 space-y-2 text-red-300/90">
                  {showVideoModal.precautions.map((pr, i) => (
                    <li key={i}>{pr}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5">
              <p className="text-[10px] text-white/40 text-left font-medium">
                Core: {showVideoModal.tutorial}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN STATISTICS DETAILED POPUPS */}
      {activePopupType && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 animate-fadeIn">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => {
              setActivePopupType(null);
              setPopupSearchQuery("");
            }}
          ></div>
          
          {/* Modal Container */}
          <div className="relative w-full max-w-5xl bg-neutral-950 border border-white/10 rounded-[32px] p-6 shadow-2xl z-10 max-h-[90vh] flex flex-col text-left">
            
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b border-white/[0.05] shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase text-yellow-400 tracking-widest">
                  {activePopupType === "active" && "Active Members Ledger"}
                  {activePopupType === "today" && "Today's Attendance Logs"}
                  {activePopupType === "expiring" && "Expiring Members Alert"}
                  {activePopupType === "pending" && "Pending Approvals Queue"}
                </span>
                <h3 className="text-xl font-black uppercase text-white mt-1">
                  {activePopupType === "active" && `Active Members (${members.filter(m => m.status === "Active" || m.status === "Expiring Soon").length})`}
                  {activePopupType === "today" && `Today's Attendees (${members.filter(m => {
                    const todayString = new Date().toISOString().split("T")[0];
                    return m.attendanceHistory?.includes(todayString);
                  }).length})`}
                  {activePopupType === "expiring" && `Expiring Soon (${members.filter(m => m.status === "Expiring Soon").length})`}
                  {activePopupType === "pending" && `Pending Registrations (${members.filter(m => m.status === "Pending Approval").length})`}
                </h3>
                <p className="text-xs text-white/40 mt-1">
                  {activePopupType === "active" && "Showing all members with active access to facilities."}
                  {activePopupType === "today" && "Members logged as present at the gateway terminal today."}
                  {activePopupType === "expiring" && "Members whose access packages are nearing expiration date."}
                  {activePopupType === "pending" && "Onboarding applications awaiting program & diet configuration."}
                </p>
              </div>
              <button 
                onClick={() => {
                  setActivePopupType(null);
                  setPopupSearchQuery("");
                }}
                className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all cursor-pointer border border-white/10 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 focus:outline-none"
              >
                Dismiss ×
              </button>
            </div>

            {/* Search Input for modal */}
            <div className="my-4 shrink-0">
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-3 flex items-center gap-3">
                <Search size={16} className="text-white/40" />
                <input
                  type="text"
                  placeholder="Search by Name, Member ID, or Phone..."
                  value={popupSearchQuery}
                  onChange={e => setPopupSearchQuery(e.target.value)}
                  className="bg-transparent border-none focus:outline-none w-full text-xs text-white placeholder-white/30"
                />
                {popupSearchQuery && (
                  <button 
                    onClick={() => setPopupSearchQuery("")}
                    className="text-white/40 hover:text-white text-xs px-2"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable member list / grid */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4">
              {(() => {
                let list: Member[] = [];
                if (activePopupType === "active") {
                  list = members.filter(m => m.status === "Active" || m.status === "Expiring Soon");
                } else if (activePopupType === "today") {
                  const todayString = new Date().toISOString().split("T")[0];
                  list = members.filter(m => m.attendanceHistory?.includes(todayString));
                } else if (activePopupType === "expiring") {
                  list = members.filter(m => m.status === "Expiring Soon");
                } else if (activePopupType === "pending") {
                  list = members.filter(m => m.status === "Pending Approval");
                }

                if (popupSearchQuery.trim()) {
                  const query = popupSearchQuery.toLowerCase().trim();
                  list = list.filter(m => 
                    m.name.toLowerCase().includes(query) ||
                    (m.memberId && m.memberId.toLowerCase().includes(query)) ||
                    (m.phone && m.phone.toLowerCase().includes(query))
                  );
                }

                if (list.length === 0) {
                  return (
                    <div className="text-center py-16 text-white/30 text-xs bg-white/[0.01] border border-white/[0.03] rounded-2xl">
                      No matching members found. Try adjusting your search query.
                    </div>
                  );
                }

                if (activePopupType === "pending") {
                  return (
                    <div className="space-y-4">
                      {list.map(m => (
                        <div 
                          key={m.id}
                          className="p-5 bg-white/[0.01] border border-white/[0.04] hover:bg-white/[0.03] hover:border-white/10 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left transition-all"
                        >
                          <div>
                            <div className="flex items-center gap-2.5">
                              <h4 className="font-black text-sm text-white">{m.name}</h4>
                              <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-cyan-400/10 text-cyan-400 uppercase">Awaiting Assignment</span>
                            </div>
                            <div className="text-[11px] text-white/50 space-y-0.5 mt-2">
                              <p>Phone: <span className="text-white font-mono">{m.phone}</span> • Address: <span className="text-white">{m.address}</span></p>
                              <p>Metrics: <span className="text-yellow-400 font-bold">{m.weight} kg</span> • Preferred Shift: <span className="text-white">{m.preferredShift}</span></p>
                              <p>Plan Selected: <span className="text-yellow-400 font-bold uppercase">{m.gymAccess || "Full Gym + Cardio"}</span></p>
                              <p>Fitness Goal: <span className="text-yellow-400 font-black">{m.goals}</span></p>
                            </div>
                          </div>

                          <div className="flex gap-2 shrink-0 self-end md:self-center">
                            <button
                              onClick={() => {
                                setInspectedMemberId(m.id);
                                setIsInspectorOpen(true);
                              }}
                              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                            >
                              Inspect Account
                            </button>
                            <button
                              onClick={() => {
                                setAssigningMember(m);
                                setTrainerNoteInput(`Onboarding note: Focus on ${m.goals}. Begin with basic stretching.`);
                              }}
                              className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-[0_0_10px_rgba(250,204,21,0.2)]"
                            >
                              Configure Curriculum
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {list.map(m => {
                      const wPlanName = workoutPlans.find(p => p.id === m.workoutPlanId)?.name || "Not Configured";
                      const dPlanName = dietPlans.find(d => d.id === m.dietPlanId)?.name || "Not Configured";
                      
                      return (
                        <div 
                          key={m.id}
                          onClick={() => {
                            setInspectedMemberId(m.id);
                            setIsInspectorOpen(true);
                          }}
                          className="p-5 rounded-2xl border bg-white/[0.01] border-white/5 hover:bg-white/[0.03] hover:border-white/10 transition-all cursor-pointer flex flex-col justify-between gap-4 group text-left"
                        >
                          <div>
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-black text-sm text-white group-hover:text-red-500 transition-colors">{m.name}</h4>
                                <p className="text-[9px] font-mono text-white/40 mt-1">{m.memberId || "Pending Verification"}</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                m.status === "Pending Approval" ? "bg-cyan-500/10 text-cyan-400" :
                                m.status === "Expiring Soon" ? "bg-orange-500/15 text-orange-400 animate-pulse" :
                                "bg-green-500/15 text-green-400"
                              }`}>
                                {m.status}
                              </span>
                            </div>
                            
                            <div className="mt-3.5 space-y-1 text-[10px] text-white/50">
                              <p>Shift: <span className="text-white font-medium">{m.preferredShift}</span></p>
                              <p>Phone: <span className="text-white font-mono">{m.phone}</span></p>
                              <p>Program: <span className="text-yellow-400 font-medium">{wPlanName}</span></p>
                              <p>Diet Menu: <span className="text-cyan-400 font-medium">{dPlanName}</span></p>
                            </div>
                          </div>

                          <div className="flex justify-between items-center border-t border-white/[0.04] pt-3 mt-1 shrink-0">
                            <span className="text-[9px] text-white/40 uppercase font-mono tracking-wider max-w-[150px] truncate">
                              Goal: {m.goals.split(", ")[0]}
                            </span>
                            <span className="text-[9px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                              Inspect Account →
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}

      {/* 13. ADMIN INTERVENTION FORM DRAWER (Assignment Modal) */}
      {assigningMember && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fadeIn">
          <div className="bg-neutral-950 border border-white/10 rounded-[32px] p-6 max-w-md w-full relative shadow-2xl text-left">
            <button
              onClick={() => setAssigningMember(null)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X size={16} />
            </button>

            <div className="mb-6">
              <span className="text-[9px] text-yellow-400 font-black uppercase tracking-widest">Verify & Onboard</span>
              <h3 className="text-lg font-black uppercase text-white mt-1">Configure Onboarding Card</h3>
              <p className="text-xs text-white/40 mt-1">Assign custom plans for: <span className="font-bold text-white">{assigningMember.name}</span></p>
            </div>

            <form onSubmit={handleApproveMember} className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase text-white/40 block mb-2">Select Workout Program Plan</label>
                <select
                  value={selectedWorkoutPlan}
                  onChange={e => setSelectedWorkoutPlan(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500"
                >
                  {workoutPlans.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-white/40 block mb-2">Select Diet Menu Plan</label>
                <select
                  value={selectedDietPlan}
                  onChange={e => setSelectedDietPlan(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500"
                >
                  {dietPlans.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-white/40 block mb-2">Membership Term Duration</label>
                <select
                  value={membershipDurationInput}
                  onChange={e => setMembershipDurationInput(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500"
                >
                  <option value="1 Month">1 Month Access</option>
                  <option value="2 Months">2 Months Access</option>
                  <option value="3 Months">3 Months (Premium Pack)</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-white/40 block mb-2">Custom Trainer/Dietician Notes</label>
                <textarea
                  rows={2}
                  value={trainerNoteInput}
                  onChange={e => setTrainerNoteInput(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500 resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setAssigningMember(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-colors cursor-pointer"
                >
                  Onboard & Activate ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
