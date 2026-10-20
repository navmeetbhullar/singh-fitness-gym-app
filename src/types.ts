/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Exercise {
  id: string;
  name: string;
  sets: string;
  completed: boolean;
  tutorial: string;
  precautions: string[];
  steps: string[];
  youtubeUrl: string;
}

export interface DayRoutine {
  day: string; // "Monday", "Tuesday", etc.
  exercises: Exercise[];
  isRestDay: boolean;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  description: string;
  weeklyRoutine: DayRoutine[];
  price?: number;
}

export interface DietPlan {
  id: string;
  name: string;
  description: string;
  meals: {
    id: string;
    name: string;
    desc: string;
    completed: boolean;
  }[];
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  address: string;
  height: number; // cm
  weight: number; // kg
  targetWeight: number; // kg
  preferredShift: "Morning Shift" | "Evening Shift";
  goals: string;
  memberId: string;
  status: "Active" | "Expiring Soon" | "Expired" | "Pending Approval";
  joinedDate: string;
  expiryDate: string;
  streak: number;
  points: number;
  referrals: number;
  trainerName: string;
  trainerPhone: string;
  workoutPlanId: string;
  dietPlanId: string;
  trainerNote: string;
  waterIntake: number; // liters
  sleepHours: number; // hours
  weightHistory: { date: string; weight: number }[];
  attendanceHistory: string[]; // dates of attendance e.g. ["2026-07-01", "2026-07-02"]
  absentDays: number; // to trigger absentee alerts
  role?: "member" | "admin" | "pending" | "visitor";
  email?: string;
  gymAccess?: string;
  membershipDuration?: string;
  completedExercises?: string[];
  completedMeals?: string[];
  referredByCode?: string; // referral code typed at sign-up; admin awards the bonus on approval
}

// Public leaderboard entry (one per member, doc id = member uid).
// Holds only what other members are allowed to see.
export interface LeaderboardEntry {
  id: string;
  name: string;
  points: number;
  streak: number;
}

export interface GymAnnouncement {
  id: string;
  date: string;
  author: string;
  title: string;
  content: string;
  important: boolean;
}

export interface GymNotification {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  type: "warning" | "info" | "success" | "motivational" | "admin_alert";
  read: boolean;
  forAdmin?: boolean;
  memberId?: string; // who the notification is for: a member uid, or "all" for broadcasts
}

export interface PlanChangeRequest {
  id: string;
  memberId: string;
  memberName: string;
  currentPlanName: string;
  requestedPlanName: string;
  timestamp: string;
  status: "Pending" | "Approved" | "Rejected";
}

// ==========================================
// PRE-CONFIGURED STUNNING DEFAULT MOCK DATA
// ==========================================

export const DEFAULT_WORKOUT_PLANS: WorkoutPlan[] = [
  {
    id: "power-builder",
    name: "Power Builder (Intermediate)",
    description: "Focuses on compound lifting form, strength progression, and solid muscle density.",
    weeklyRoutine: [
      {
        day: "Monday",
        isRestDay: false,
        exercises: [
          {
            id: "pb-1",
            name: "Barbell Bench Press",
            sets: "4 Sets Ã— 8 Reps",
            completed: false,
            tutorial: "The bench press builds upper-body power. Ensure you maintain a natural arch in your lower back with feet planted.",
            precautions: [
              "Do not flare your elbows excessively (keep them at roughly a 45-degree angle).",
              "Never drop the bar quickly to your chest; control the eccentric phase.",
              "Use a spotter or safety bars if lifting near maximum weight."
            ],
            steps: [
              "Lie flat on your back on the bench. Grip the barbell with hands slightly wider than shoulder-width.",
              "Brace your core, squeeze your shoulder blades, and unrack the bar.",
              "Lower the barbell under strict control until it lightly touches your mid-chest.",
              "Push the bar back up explosively while pushing your feet into the floor."
            ],
            youtubeUrl: "https://www.youtube.com/embed/rT7DgCr-3pg"
          },
          {
            id: "pb-2",
            name: "Overhead Barbell Press",
            sets: "3 Sets Ã— 10 Reps",
            completed: false,
            tutorial: "The core vertical pushing exercise for rounded, powerful shoulders and stable core mechanics.",
            precautions: [
              "Avoid bending your spine backwards; squeeze your glutes and abs tight.",
              "Keep your forearms perfectly vertical under the barbell."
            ],
            steps: [
              "Clean the bar to your shoulders or rack it at collarbone level. Grip slightly wider than shoulder-width.",
              "Brace your entire body and press the bar straight overhead, moving your head back slightly as the bar passes your face.",
              "Lock out the weight overhead with your head pushed slightly forward ('push your head through the window').",
              "Slowly lower back down to your upper collarbones."
            ],
            youtubeUrl: "https://www.youtube.com/embed/2yjwXTZQDDI"
          }
        ]
      },
      {
        day: "Tuesday",
        isRestDay: false,
        exercises: [
          {
            id: "pb-3",
            name: "Conventional Deadlift",
            sets: "4 Sets Ã— 5 Reps",
            completed: false,
            tutorial: "The king of posterior chain exercises. Trains hamstrings, glutes, lats, and spinal erectors.",
            precautions: [
              "Never round your lower back under load.",
              "Keep the barbell scraping against your shins throughout the vertical pull."
            ],
            steps: [
              "Stand with feet hip-width apart, shins about an inch from the bar.",
              "Hinge at your hips and grip the bar. Flat back, chest proud, drag shoulder blades back.",
              "Push through your feet, driving the floor away, and stand upright, locking hips out at the top.",
              "Hinge back down under control to return the bar to the floor."
            ],
            youtubeUrl: "https://www.youtube.com/embed/op9kVnGEyI8"
          }
        ]
      },
      {
        day: "Wednesday",
        isRestDay: false,
        exercises: [
          {
            id: "pb-4",
            name: "Barbell Squats",
            sets: "4 Sets Ã— 6 Reps",
            completed: false,
            tutorial: "Standard barbell back squat targets quadriceps, glutes, and full-body core stability.",
            precautions: [
              "Keep knees aligned with toes; do not let them collapse inward (valgus collapse).",
              "Ensure your heels remain firmly flat on the floor."
            ],
            steps: [
              "Rest the barbell securely on your upper traps. Unrack and take two small steps back.",
              "Inhale deeply into your abdomen, hinge at hips, and sink down till thighs are parallel to the floor.",
              "Drive back up firmly through the mid-foot, keeping your spine neutral."
            ],
            youtubeUrl: "https://www.youtube.com/embed/ultWZbUMSG8"
          }
        ]
      },
      {
        day: "Thursday",
        isRestDay: false,
        exercises: [
          {
            id: "pb-5",
            name: "Incline Dumbbell Press",
            sets: "3 Sets Ã— 10 Reps",
            completed: false,
            tutorial: "Targets the upper clavicular head of the chest for full balanced development.",
            precautions: [
              "Keep wrist straight; don't let the weights drift behind your head.",
              "Do not bounce dumbells at the bottom range."
            ],
            steps: [
              "Sit on a 30-degree inclined bench holding dumbells on your knees.",
              "Kick weights up to shoulders, lie back, press them up together to start.",
              "Lower dumbbells slowly with elbows tucked slightly until they are near chest height, then press back up."
            ],
            youtubeUrl: "https://www.youtube.com/embed/8iPntxTxwx0"
          }
        ]
      },
      {
        day: "Friday",
        isRestDay: false,
        exercises: [
          {
            id: "pb-6",
            name: "Barbell Rows",
            sets: "4 Sets Ã— 8 Reps",
            completed: false,
            tutorial: "Builds absolute back thickness and a heavy grip.",
            precautions: [
              "Keep your torso steady at about a 45-degree angle; do not stand up to complete the rep.",
              "Avoid jerking the weight up using momentum."
            ],
            steps: [
              "Hinge forward at the hips with a flat back, grip the bar with a pronated grip.",
              "Pull the bar to your lower ribs, driving elbows high and squeezing your shoulder blades tight.",
              "Slowly lower back down until arms are fully extended."
            ],
            youtubeUrl: "https://www.youtube.com/embed/RQU8wJHbAeo"
          }
        ]
      },
      {
        day: "Saturday",
        isRestDay: false,
        exercises: [
          {
            id: "pb-7",
            name: "Romanian Deadlift",
            sets: "3 Sets Ã— 12 Reps",
            completed: false,
            tutorial: "Isolates the hamstrings and glutes through an intense hip hinge stretching mechanic.",
            precautions: [
              "Do not bend the knees excessively; this is a hinge, not a squat.",
              "Stop descending once you feel your hamstrings reach maximum stretch."
            ],
            steps: [
              "Stand with barbell at hip height. Unlock your knees slightly.",
              "Hinge backward at your hips, pushing your butt far back, letting the bar slide down your thighs.",
              "Squeeze your glutes to drive hips forward and return to standing."
            ],
            youtubeUrl: "https://www.youtube.com/embed/JCXUYuzw01M"
          }
        ]
      },
      {
        day: "Sunday",
        isRestDay: true,
        exercises: []
      }
    ]
  },
  {
    id: "keto-shred",
    name: "Keto Shred (Fat Loss)",
    description: "High intensity supersets combined with functional movements to accelerate fat burning.",
    weeklyRoutine: [
      {
        day: "Monday",
        isRestDay: false,
        exercises: [
          {
            id: "ks-1",
            name: "Dumbbell Thrusters",
            sets: "4 Sets Ã— 15 Reps",
            completed: false,
            tutorial: "A full body compound exercise that spikes heart rate and torches calories.",
            precautions: ["Maintain a rigid spine.", "Do not let knees buckle."],
            steps: [
              "Hold dumbells at collarbone level, squat deep.",
              "Drive up explosively and press dumbbells straight overhead in one smooth fluid movement."
            ],
            youtubeUrl: "https://www.youtube.com/embed/M95_8D2b9v0"
          }
        ]
      },
      {
        day: "Tuesday",
        isRestDay: false,
        exercises: [
          {
            id: "ks-2",
            name: "Burpees",
            sets: "3 Sets Ã— 20 Reps",
            completed: false,
            tutorial: "The ultimate metabolic bodyweight conditioning exercise.",
            precautions: ["Land with soft knees during the vertical jump.", "Protect your wrists."],
            steps: [
              "From standing, drop to a squat, kick feet back to a push-up stance.",
              "Perform a push-up, jump feet back under chest, and jump high into the air clapping above your head."
            ],
            youtubeUrl: "https://www.youtube.com/embed/qLBImHhCXCg"
          }
        ]
      },
      { day: "Wednesday", isRestDay: true, exercises: [] },
      {
        day: "Thursday",
        isRestDay: false,
        exercises: [
          {
            id: "ks-3",
            name: "Kettlebell Swings",
            sets: "4 Sets Ã— 25 Reps",
            completed: false,
            tutorial: "High intensity posterior chain training for power and cardiovascular endurance.",
            precautions: ["Do not squat. Hinge your hips.", "The movement must be driven by glute snap, not arm pulling."],
            steps: [
              "Hinge, pull kettlebell back under hips, snap hips forward explosively to swing the bell to chest height."
            ],
            youtubeUrl: "https://www.youtube.com/embed/sSESeQ5tU68"
          }
        ]
      },
      { day: "Friday", isRestDay: false, exercises: [] },
      { day: "Saturday", isRestDay: false, exercises: [] },
      { day: "Sunday", isRestDay: true, exercises: [] }
    ]
  }
];

export const DEFAULT_DIET_PLANS: DietPlan[] = [
  {
    id: "clean-bulk",
    name: "Clean Bulk (Muscle Gain)",
    description: "High-protein, moderate-carb diet designed to facilitate clean muscular building while minimizing fat storage.",
    meals: [
      { id: "cb-m1", name: "Meal 1: Breakfast", desc: "4 Egg Whites, 1 Whole Egg, 100g Rolled Oats, 1 Scoop Whey Protein", completed: false },
      { id: "cb-m2", name: "Meal 2: Mid-Day Snack", desc: "1 Apple, 30g Almonds, 150g Low Fat Greek Yogurt", completed: false },
      { id: "cb-m3", name: "Meal 3: Lunch", desc: "150g Grilled Chicken Breast, 1 Bowl Steamed Brown Rice, SautÃ©ed Spinach", completed: false },
      { id: "cb-m4", name: "Meal 4: Pre-Workout", desc: "1 Large Banana, 1 Rice Cake with Peanut Butter, 1 cup Black Coffee", completed: false },
      { id: "cb-m5", name: "Meal 5: Dinner", desc: "150g SautÃ©ed Salmon/Paneer, Baked Sweet Potatoes, Stir-fry Broccoli", completed: false }
    ]
  },
  {
    id: "keto-shred-diet",
    name: "Ketogenic Shred (Fat Loss)",
    description: "High healthy fats, moderate protein, ultra-low carbohydrates to prompt fat adaptation.",
    meals: [
      { id: "ks-m1", name: "Meal 1: Breakfast", desc: "3 Scrambled Eggs in Butter, Half Avocado, SautÃ©ed Spinach", completed: false },
      { id: "ks-m2", name: "Meal 2: Lunch", desc: "Grilled Salmon, Large Leafy Green Salad with Olive Oil Dressing", completed: false },
      { id: "ks-m3", name: "Meal 3: Snack", desc: "Handful of Macadamia nuts or Walnuts", completed: false },
      { id: "ks-m4", name: "Meal 4: Dinner", desc: "Tofu or Grilled Chicken Breast cooked in Butter, roasted Asparagus", completed: false }
    ]
  }
];

