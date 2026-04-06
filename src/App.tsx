import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { GoogleGenAI } from "@google/genai";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer, ToastType } from './components/Toast';
import { Modal, ModalType } from './components/Modal';
import { DataService } from './services/dataService';
import { AIService, AIAnalysisResult } from './services/aiService';
import { ChoppingBlock } from './components/ChoppingBlock';
import { 
  AttendanceRecord, 
  UserProfile, 
  DailyReport, 
  LeaveRequest,
  AppNotification,
  BrainstormIdea,
  ReviewCycle,
  ChatMessage
} from './types';
import { 
  Search, 
  Bell, 
  Clock, 
  MapPin, 
  Camera, 
  CheckCircle2, 
  AlertCircle,
  ShieldAlert,
  FileText,
  Plus,
  Trash2,
  Send,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Users,
  Briefcase,
  Home,
  Plane,
  MoreVertical,
  Activity,
  LogOut,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  ExternalLink,
  ListChecks,
  XCircle,
  Bot,
  Sparkles,
  Trophy,
  Zap,
  Lightbulb
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, differenceInHours, differenceInDays, startOfDay, endOfDay, subDays } from 'date-fns';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { APP_CONFIG } from './constants';

// --- Firebase Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const StatCard = ({ title, value, subtitle, icon: Icon, trend, color, trendType }: any) => (
  <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{title}</p>
        <h3 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">{value}</h3>
        <p className="mt-1 text-[10px] text-gray-500">
          <span className={cn("font-medium", trendType === 'up' ? "text-green-500" : "text-red-500")}>
            {trendType === 'up' ? '▲' : '▼'} {trend}
          </span> {subtitle}
        </p>
      </div>
      <div className={cn("rounded-lg p-2", color)}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  </div>
);

const AttendanceRow = ({ record, userProfile, onPhotoClick }: { record: AttendanceRecord, userProfile?: UserProfile, onPhotoClick: (url: string) => void, key?: string }) => {
  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    if (timestamp instanceof Timestamp) return format(timestamp.toDate(), 'hh:mm a');
    if (timestamp instanceof Date) return format(timestamp, 'hh:mm a');
    return 'Just now';
  };

  return (
    <tr className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {record.checkInPhoto ? (
            <div className="relative group">
              <img 
                src={record.checkInPhoto} 
                alt="Proof" 
                onClick={() => onPhotoClick(record.checkInPhoto!)}
                className="h-12 w-12 rounded-xl object-cover border-2 border-white shadow-sm cursor-zoom-in hover:scale-110 transition-transform"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-white shadow-sm" />
            </div>
          ) : (
            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400 border-2 border-white shadow-sm">
              {userProfile?.name?.split(' ').map(n => n[0]).join('') || 'U'}
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-gray-800 leading-tight">{userProfile?.name || 'Unknown User'}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">{userProfile?.role || 'Worker'}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-xs font-medium text-gray-600">{record.date}</td>
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-gray-800">
            {formatTime(record.checkInTime)}
          </span>
          <span className="text-[10px] text-gray-400 uppercase tracking-tighter">Check In</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-gray-800">
            {record.checkOutTime ? formatTime(record.checkOutTime) : '--:--'}
          </span>
          <span className="text-[10px] text-gray-400 uppercase tracking-tighter">Check Out</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div className={cn("h-1.5 w-1.5 rounded-full", record.totalHours && record.totalHours >= APP_CONFIG.STANDARD_WORK_DAY_HOURS ? "bg-green-500" : "bg-orange-500")} />
          <span className="text-xs font-bold">{record.totalHours?.toFixed(1) || '0.0'} hrs</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={cn(
          "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
          record.status === 'present' ? "bg-green-100 text-green-700" : 
          record.status === 'late' ? "bg-red-100 text-red-700 animate-pulse" :
          record.status === 'wfh' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
        )}>
          {record.status}
        </span>
      </td>
    </tr>
  );
};

const RoleSelection = ({ onSelect }: { onSelect: (role: 'founder' | 'admin' | 'employee' | 'intern') => void }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-2xl"
    >
      <div className="text-center mb-12">
        <h2 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter">Choose Your Role</h2>
        <p className="text-gray-400 text-lg">Select your position to customize your experience.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { id: 'founder', label: 'Founder', icon: Users, desc: 'Co-founder access to personal tracking and team overview.' },
          { id: 'employee', label: 'Employee', icon: Briefcase, desc: 'Track your daily work, tasks, and leave.' },
          { id: 'intern', label: 'Intern', icon: Clock, desc: 'Log your working hours and daily progress.' }
        ].map((role) => (
          <button
            key={role.id}
            onClick={() => onSelect(role.id as any)}
            className="group relative overflow-hidden rounded-3xl bg-[#1a1a1a] p-8 text-left border border-white/5 hover:border-orange-500/50 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="rounded-2xl bg-orange-500/10 p-4 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
                <role.icon size={32} />
              </div>
              <ArrowUpRight className="text-gray-600 group-hover:text-orange-500 transition-all" size={24} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">{role.label}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{role.desc}</p>
          </button>
        ))}
      </div>
    </motion.div>
  </div>
);

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [allReports, setAllReports] = useState<DailyReport[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [todayReport, setTodayReport] = useState<DailyReport | null>(null);
  const [newTodo, setNewTodo] = useState('');
  const [reportLink, setReportLink] = useState('');
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const calculateLeaveBalance = () => {
    const currentYear = new Date().getFullYear();
    const approvedLeaves = leaves.filter(l => {
      const isApproved = l.status === 'approved';
      const isLeave = l.type === 'leave';
      const start = parseISO(l.startDate);
      const isInCurrentYear = start.getFullYear() === currentYear;
      return isApproved && isLeave && isInCurrentYear;
    });

    const totalDays = approvedLeaves.reduce((acc, curr) => {
      const start = parseISO(curr.startDate);
      const end = parseISO(curr.endDate);
      // differenceInDays(end, start) + 1 to include both start and end dates
      return acc + (differenceInDays(end, start) + 1);
    }, 0);

    return totalDays;
  };

  const leaveBalance = calculateLeaveBalance();
  const leavePercentage = Math.min((leaveBalance / APP_CONFIG.ANNUAL_LEAVE_LIMIT) * 100, 100);

  const [isCheckOutConfirmOpen, setIsCheckOutConfirmOpen] = useState(false);
  const [selectedReportForTasks, setSelectedReportForTasks] = useState<DailyReport | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [roleFilter, setRoleFilter] = useState<'all' | 'founder' | 'employee' | 'intern'>('all');
  const [brainstormIdeas, setBrainstormIdeas] = useState<BrainstormIdea[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [botMessages, setBotMessages] = useState<ChatMessage[]>([]);
  const [botInput, setBotInput] = useState('');
  const [isBotLoading, setIsBotLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [newIdeaTitle, setNewIdeaTitle] = useState('');
  const [newIdeaDescription, setNewIdeaDescription] = useState('');
  const [newIdeaCategory, setNewIdeaCategory] = useState<'idea' | 'todo' | 'discussion'>('idea');

  // Production Toast & Modal State
  const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastType }[]>([]);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: ModalType;
    confirmLabel?: string;
    onConfirm?: () => void;
    isSubmitting?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const showModal = (config: Omit<typeof modalConfig, 'isOpen'>) => {
    setModalConfig({ ...config, isOpen: true });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const filteredUsers = allUsers.filter(u => roleFilter === 'all' || u.role === roleFilter);
  const filteredAttendance = allAttendance.filter(a => {
    if (roleFilter === 'all') return true;
    const userProfile = allUsers.find(u => u.uid === a.uid);
    return userProfile?.role === roleFilter;
  });
  const [leaveType, setLeaveType] = useState<'leave' | 'wfh'>('leave');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveStartDate, setLeaveStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [leaveEndDate, setLeaveEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const submitLeaveRequest = async () => {
    if (!leaveReason.trim()) return;
    if (new Date(leaveEndDate) < new Date(leaveStartDate)) {
      alert("End date cannot be before start date.");
      return;
    }
    await handleLeaveRequest(leaveType, leaveReason, leaveStartDate, leaveEndDate);
    setIsLeaveModalOpen(false);
    setLeaveReason('');
    setLeaveStartDate(format(new Date(), 'yyyy-MM-dd'));
    setLeaveEndDate(format(new Date(), 'yyyy-MM-dd'));
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Auth & Profile ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profileData = userDoc.data() as UserProfile;
            setProfile(profileData);
            if (!profileData.role) {
              setShowRoleSelection(true);
            } else if (profileData.role === 'admin' && activeTab === 'dashboard') {
              setActiveTab('analytics');
            }
          } else {
            // First user logic: If no users exist, this user is the admin
            const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
            if (usersSnap.empty) {
              const firstProfile: UserProfile = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || 'Admin',
                email: firebaseUser.email || '',
                role: 'admin',
                photoURL: firebaseUser.photoURL || undefined
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), firstProfile);
              setProfile(firstProfile);
              setActiveTab('analytics');
              setShowRoleSelection(false);
            } else {
              setShowRoleSelection(true);
            }
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      } else {
        setProfile(null);
        setShowRoleSelection(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleRoleSelect = async (selectedRole: 'founder' | 'admin' | 'employee' | 'intern') => {
    if (!user) return;
    const newProfile: UserProfile = {
      uid: user.uid,
      name: user.displayName || 'User',
      email: user.email || '',
      role: selectedRole,
      photoURL: user.photoURL || undefined
    };
    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
      setShowRoleSelection(false);
      if (selectedRole === 'admin' || selectedRole === 'founder') {
        setActiveTab('analytics');
      } else {
        setActiveTab('dashboard');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
    }
  };

  // --- Data Listeners ---
  useEffect(() => {
    if (!user) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Attendance (Personal)
    const qAttendance = query(collection(db, 'attendance'), where('uid', '==', user.uid), orderBy('date', 'desc'));
    const unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
      setAttendance(data);
      
      // Find the latest record for today (could be multiple shifts)
      const todayRecords = data.filter(r => r.date === todayStr).sort((a, b) => {
        const timeA = a.checkInTime instanceof Timestamp ? a.checkInTime.toMillis() : Date.now();
        const timeB = b.checkInTime instanceof Timestamp ? b.checkInTime.toMillis() : Date.now();
        return timeB - timeA;
      });
      
      setTodayRecord(todayRecords[0] || null);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'attendance'));

    // Reports (Personal)
    const qReports = query(collection(db, 'dailyReports'), where('uid', '==', user.uid));
    const unsubReports = onSnapshot(qReports, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyReport));
      setDailyReports(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'dailyReports'));

    // Notifications (Personal)
    const qNotifications = query(collection(db, 'notifications'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'), limit(20));
    const unsubNotifications = onSnapshot(qNotifications, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'));

    // Leaves (Personal)
    const qLeaves = query(collection(db, 'leaves'), where('uid', '==', user.uid));
    const unsubLeaves = onSnapshot(qLeaves, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
      setLeaves(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'leaves'));

    let unsubAllUsers: (() => void) | undefined;
    let unsubAllAttendance: (() => void) | undefined;
    let unsubAllReports: (() => void) | undefined;
    let unsubAllLeaves: (() => void) | undefined;

    // Admin/Founder Only: All Users & All Attendance
    if (profile?.role === 'admin' || profile?.role === 'founder') {
      unsubAllUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        setAllUsers(snapshot.docs.map(d => d.data() as UserProfile));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

      const qAllAttendance = query(collection(db, 'attendance'), orderBy('date', 'desc'), limit(50));
      unsubAllAttendance = onSnapshot(qAllAttendance, (snapshot) => {
        setAllAttendance(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'attendance'));

      const qAllReports = query(collection(db, 'dailyReports'), orderBy('date', 'desc'), limit(100));
      unsubAllReports = onSnapshot(qAllReports, (snapshot) => {
        setAllReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyReport)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'dailyReports'));

      const qAllLeaves = query(collection(db, 'leaves'), orderBy('startDate', 'desc'), limit(50));
      unsubAllLeaves = onSnapshot(qAllLeaves, (snapshot) => {
        setAllLeaves(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'leaves'));

      // Brainstorm (All)
      const qBrainstorm = query(collection(db, 'brainstorm'), orderBy('createdAt', 'desc'));
      const unsubBrainstorm = onSnapshot(qBrainstorm, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BrainstormIdea));
        setBrainstormIdeas(data);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'brainstorm'));

      return () => {
        unsubAttendance();
        unsubReports();
        unsubNotifications();
        unsubLeaves();
        if (unsubAllUsers) unsubAllUsers();
        if (unsubAllAttendance) unsubAllAttendance();
        if (unsubAllReports) unsubAllReports();
        if (unsubAllLeaves) unsubAllLeaves();
        unsubBrainstorm();
      };
    }

    // Brainstorm (All) - for non-admins too
    const qBrainstorm = query(collection(db, 'brainstorm'), orderBy('createdAt', 'desc'));
    const unsubBrainstorm = onSnapshot(qBrainstorm, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BrainstormIdea));
      setBrainstormIdeas(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'brainstorm'));

    return () => {
      unsubAttendance();
      unsubReports();
      unsubNotifications();
      unsubLeaves();
      unsubBrainstorm();
      if (unsubAllUsers) unsubAllUsers();
      if (unsubAllAttendance) unsubAllAttendance();
      if (unsubAllReports) unsubAllReports();
      if (unsubAllLeaves) unsubAllLeaves();
    };
  }, [user, profile]);

  const [currentCycle, setCurrentCycle] = useState<ReviewCycle | null>(null);

  // Review Cycle Subscription
  useEffect(() => {
    if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'founder')) {
      setCurrentCycle(null);
      return;
    }
    const q = query(collection(db, 'reviewCycles'), orderBy('startDate', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setCurrentCycle({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ReviewCycle);
      } else {
        setCurrentCycle(null);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'reviewCycles'));
    return () => unsubscribe();
  }, [user, profile]);

  // Chat Messages Subscription
  useEffect(() => {
    if (!user) {
      setBotMessages([]);
      return;
    }
    const q = query(
      collection(db, 'chatMessages'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBotMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'chatMessages'));
    return () => unsubscribe();
  }, [user]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [botMessages]);

  // Review Cycle Reminders Logic
  useEffect(() => {
    if (!user || !currentCycle || currentCycle.status !== 'active') return;

    const checkReminders = async () => {
      const now = new Date();
      const endDate = currentCycle.endDate instanceof Timestamp ? currentCycle.endDate.toDate() : new Date(currentCycle.endDate);
      const diffDays = differenceInDays(endDate, now);
      const diffHours = differenceInHours(endDate, now);
      
      const sent = currentCycle.remindersSent || [];
      const newSent = [...sent];
      let shouldUpdate = false;

      // Week 2 Reminder (7 days before)
      if (diffDays <= 7 && diffDays > 1 && !sent.includes('week2')) {
        await addDoc(collection(db, 'notifications'), {
          uid: user.uid,
          title: "Governance Reminder",
          message: "We are in the final week of the current review cycle. Prepare your outcomes for the upcoming ballot.",
          type: 'info',
          read: false,
          createdAt: serverTimestamp()
        });
        newSent.push('week2');
        shouldUpdate = true;
      }

      // Day Before Reminder
      if (diffHours <= 24 && diffHours > 0 && !sent.includes('dayBefore')) {
        await addDoc(collection(db, 'notifications'), {
          uid: user.uid,
          title: "Ballot Tomorrow",
          message: "The performance review ballot starts tomorrow. Make sure your daily reports are up to date.",
          type: 'warning',
          read: false,
          createdAt: serverTimestamp()
        });
        newSent.push('dayBefore');
        shouldUpdate = true;
      }

      // Day Of Reminder
      if (isSameDay(now, endDate) && !sent.includes('dayOf')) {
        await addDoc(collection(db, 'notifications'), {
          uid: user.uid,
          title: "Ballot Day",
          message: "Today is the performance review ballot day. The Admin will initiate the voting window soon.",
          type: 'warning',
          read: false,
          createdAt: serverTimestamp()
        });
        newSent.push('dayOf');
        shouldUpdate = true;
      }

      if (shouldUpdate && profile?.role === 'admin') {
        // Only admin updates the cycle doc to avoid race conditions/multiple writes
        await updateDoc(doc(db, 'reviewCycles', currentCycle.id!), {
          remindersSent: newSent
        });
      }
    };

    checkReminders();
  }, [user, currentCycle, profile?.role]);

  // --- Derived State ---
  useEffect(() => {
    if (!todayRecord) {
      setTodayReport(null);
      setReportLink('');
      setNewTodo('');
      return;
    }
    
    // If checked out, we don't show the current report (user wants it empty/fresh)
    if (todayRecord.checkOutTime) {
      setTodayReport(null);
      setReportLink('');
      setNewTodo('');
      return;
    }

    const report = dailyReports.find(r => r.attendanceId === todayRecord.id);
    setTodayReport(report || null);
    if (report) {
      setReportLink(report.reportUrl || '');
    } else {
      setReportLink('');
    }
  }, [dailyReports, todayRecord]);

  useEffect(() => {
    if (profile) {
      setEditDisplayName(profile.name || user?.displayName || '');
      if (profile.preferences) {
        setEmailNotifications(profile.preferences.emailNotifications);
        setPushNotifications(profile.preferences.pushNotifications);
      }
    }
  }, [profile, user]);

  const handleCheckMissingReports = async (targetDate?: string) => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'founder')) return;
    
    setIsAuditing(true);
    const dateStr = targetDate || format(new Date(), 'yyyy-MM-dd');
    
    try {
      // 1. Fetch all data needed for audit
      const usersSnap = await getDocs(collection(db, 'users'));
      const attendanceSnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', dateStr)));
      const reportsSnap = await getDocs(query(collection(db, 'dailyReports'), where('date', '==', dateStr)));
      
      const allUsersList = usersSnap.docs.map(doc => doc.data());
      const attendanceList = attendanceSnap.docs.map(doc => doc.data());
      const reportsList = reportsSnap.docs.map(doc => doc.data());
      
      // 2. Identify users who are present but have no report
      const presentUids = attendanceList
        .filter(a => a.status === 'present' || a.status === 'wfh')
        .map(a => a.uid);
        
      const reportedUids = reportsList.map(r => r.uid);
      
      const missingUids = presentUids.filter(uid => !reportedUids.includes(uid));
      
      if (missingUids.length === 0) {
        if (!targetDate) addToast("Great news! Everyone who checked in has submitted their report for today.", "success");
        return;
      }

      // 3. Create notifications for founders/admins
      const admins = allUsersList.filter(u => u.role === 'admin' || u.role === 'founder');
      const missingUsersNames = missingUids.map(uid => {
        const u = allUsersList.find(user => user.uid === uid);
        return u?.name || 'Unknown User';
      });

      const auditMessage = `Audit complete for ${dateStr}. The following team members have NOT submitted their daily reports: ${missingUsersNames.join(', ')}.`;

      for (const admin of admins) {
        await addDoc(collection(db, 'notifications'), {
          uid: admin.uid,
          title: `${APP_CONFIG.BRAND_NAME.split(' ')[0]} AI: Report Audit`,
          message: auditMessage,
          type: 'warning',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      // 4. (Optional) Notify the users themselves as a reminder
      for (const uid of missingUids) {
        await addDoc(collection(db, 'notifications'), {
          uid: uid,
          title: `${APP_CONFIG.BRAND_NAME.split(' ')[0]} AI: Missing Report`,
          message: `Our records show you checked in today but haven't submitted your daily report yet. Please submit it before the end of the day!`,
          type: 'error',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      if (!targetDate) addToast(`Audit complete. Found ${missingUids.length} missing reports. Notifications sent to founders and respective team members.`, "info");
      
      // Mark this date as audited to prevent duplicate auto-triggers
      if (targetDate) {
        localStorage.setItem(`audit_complete_${targetDate}`, 'true');
      }
    } catch (err) {
      console.error("Audit failed:", err);
      if (!targetDate) addToast("Failed to run report audit.", "error");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  // --- Actions ---
  useEffect(() => {
    if (profile && (profile.role === 'admin' || profile.role === 'founder')) {
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      const hasAudited = localStorage.getItem(`audit_complete_${yesterday}`);
      
      if (!hasAudited) {
        console.log("Running automatic daily report audit for:", yesterday);
        handleCheckMissingReports(yesterday);
      }
    }
  }, [profile]);

  const handleCheckInClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check file size
    if (file.size > APP_CONFIG.MAX_FILE_SIZE_BYTES) {
      if (file.type.startsWith('image/')) {
        // We will compress it below
      } else {
        addToast(`File is too large. Please upload a file smaller than ${APP_CONFIG.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`, "warning");
        return;
      }
    }

    const processImage = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            // Reduced max dimension for better storage efficiency
            const maxDimension = APP_CONFIG.MAX_IMAGE_DIMENSION; 

            if (width > height) {
              if (width > maxDimension) {
                height *= maxDimension / width;
                width = maxDimension;
              }
            } else {
              if (height > maxDimension) {
                width *= maxDimension / height;
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            // Reduced quality for significant storage savings
            resolve(canvas.toDataURL('image/jpeg', APP_CONFIG.IMAGE_QUALITY));
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
    };

    try {
      const base64String = file.type.startsWith('image/') 
        ? await processImage(file) 
        : await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });

      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          // Check for lateness
          let status: 'present' | 'late' = 'present';
          const deadline = new Date(now);
          deadline.setHours(APP_CONFIG.CHECK_IN_DEADLINE_HOUR, APP_CONFIG.CHECK_IN_DEADLINE_MINUTE, 0, 0);
          
          if (now > deadline) {
            status = 'late';
          }

          await addDoc(collection(db, 'attendance'), {
            uid: user.uid,
            date: todayStr,
            checkInTime: serverTimestamp(),
            checkInLocation: location,
            checkInPhoto: base64String,
            status: status
          });

          // Add notification
          await addDoc(collection(db, 'notifications'), {
            uid: user.uid,
            title: 'Shift Started',
            message: `You checked in successfully at ${format(new Date(), 'hh:mm a')}.`,
            type: 'success',
            read: false,
            createdAt: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'attendance');
        }
      }, (err) => addToast("Geolocation is required for check-in.", "error"));
    } catch (err) {
      console.error("Error processing file:", err);
      addToast("Failed to process image. Please try again.", "error");
    }
  };

  const handleCheckOut = async () => {
    if (!user || !todayRecord?.id) return;
    
    setIsCheckOutConfirmOpen(true);
  };

  const confirmCheckOut = async () => {
    if (!user || !todayRecord?.id) return;
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      try {
        const checkInTime = todayRecord.checkInTime instanceof Timestamp ? todayRecord.checkInTime.toDate() : new Date();
        const checkOutTime = new Date();
        const hours = differenceInHours(checkOutTime, checkInTime);

        await updateDoc(doc(db, 'attendance', todayRecord.id), {
          checkOutTime: serverTimestamp(),
          checkOutLocation: location,
          totalHours: hours
        });
        
        // Add notification
        await addDoc(collection(db, 'notifications'), {
          uid: user.uid,
          title: 'Shift Ended',
          message: `You checked out successfully. Total duration: ${hours.toFixed(1)} hours.`,
          type: 'info',
          read: false,
          createdAt: serverTimestamp()
        });

        setIsCheckOutConfirmOpen(false);
        addToast("Check-out successful!", "success");
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'attendance');
      }
    }, (err) => addToast("Geolocation is required for check-out.", "error"));
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTodo.trim()) return;
    
    // Restriction: Only if checked in
    if (!todayRecord || todayRecord.checkOutTime) {
      addToast("Please check in before adding tasks to your to-do list.", "warning");
      return;
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const newItem = { task: newTodo.trim(), completed: false };
    try {
      if (todayReport?.id) {
        await updateDoc(doc(db, 'dailyReports', todayReport.id), {
          todoList: [...(todayReport.todoList || []), newItem]
        });
      } else {
        await addDoc(collection(db, 'dailyReports'), {
          uid: user.uid,
          date: todayStr,
          attendanceId: todayRecord.id,
          todoList: [newItem]
        });
      }
      setNewTodo('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'dailyReports');
    }
  };

  const handleToggleTodo = async (index: number) => {
    if (!todayReport?.id || !todayReport.todoList) return;
    const newList = [...todayReport.todoList];
    newList[index] = { ...newList[index], completed: !newList[index].completed };
    try {
      await updateDoc(doc(db, 'dailyReports', todayReport.id), {
        todoList: newList
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'dailyReports');
    }
  };

  const handleDeleteTodo = async (index: number) => {
    if (!todayReport?.id || !todayReport.todoList) return;
    const newList = todayReport.todoList.filter((_, i) => i !== index);
    try {
      await updateDoc(doc(db, 'dailyReports', todayReport.id), {
        todoList: newList
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'dailyReports');
    }
  };

  const handleViewReport = (url?: string) => {
    if (!url) return;
    window.open(url, '_blank');
  };

  const handleReportLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reportLink.trim()) return;

    // Restriction: Only if checked in
    if (!todayRecord || todayRecord.checkOutTime) {
      addToast("Please check in before submitting your report link.", "warning");
      return;
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    try {
      if (todayReport?.id) {
        await updateDoc(doc(db, 'dailyReports', todayReport.id), {
          reportUrl: reportLink.trim()
        });
      } else {
        await addDoc(collection(db, 'dailyReports'), {
          uid: user.uid,
          date: todayStr,
          attendanceId: todayRecord.id,
          reportUrl: reportLink.trim()
        });
      }
      setReportLink('');
      addToast("Report link saved successfully!", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'dailyReports');
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    try {
      await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id!), { read: true })));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications');
    }
  };

  const handleUpdateLeaveStatus = async (leaveId: string, status: 'approved' | 'rejected', uid: string) => {
    if (profile?.role !== 'admin') return;
    try {
      await updateDoc(doc(db, 'leaves', leaveId), { status });
      
      // Notify user
      await addDoc(collection(db, 'notifications'), {
        uid,
        title: `Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: `Your leave request has been ${status} by an administrator.`,
        type: status === 'approved' ? 'success' : 'error',
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'leaves');
    }
  };

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    }
  };

  const handleUpdateUserRole = async (uid: string, newRole: 'founder' | 'admin' | 'employee' | 'intern') => {
    if (profile?.role !== 'admin') return;
    
    // If an admin is assigning a new admin, they are resigning
    const isResigning = newRole === 'admin' && uid !== user?.uid;

    const updateAction = async () => {
      try {
        if (isResigning) {
          // 1. Promote new admin
          await updateDoc(doc(db, 'users', uid), { role: 'admin' });
          // 2. Demote current user to founder
          await updateDoc(doc(db, 'users', user!.uid), { role: 'founder' });
          
          // Update local profile to reflect change immediately
          setProfile(prev => prev ? { ...prev, role: 'founder' } : null);
          setActiveTab('dashboard');
        } else {
          await updateDoc(doc(db, 'users', uid), { role: newRole });
        }

        addToast("User role updated successfully", "success");
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'users');
      } finally {
        closeModal();
      }
    };

    if (isResigning) {
      showModal({
        title: "Transfer Admin Status",
        message: "Are you sure you want to transfer Admin status? You will lose all administrative powers and become a regular Founder.",
        type: "alert",
        confirmLabel: "Transfer Status",
        onConfirm: updateAction
      });
    } else {
      updateAction();
    }
  };

  const handleBotChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botInput.trim() || !user || isBotLoading) return;

    const userMsgText = botInput;
    setBotInput('');
    setIsBotLoading(true);

    try {
      // 1. Save user message to Firestore
      await addDoc(collection(db, 'chatMessages'), {
        uid: user.uid,
        role: 'user',
        text: userMsgText,
        createdAt: serverTimestamp()
      });

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      let { users, attendance, reports } = await DataService.getAllDataForAnalysis();
      
      // Filter data for non-admins to ensure privacy
      if (profile?.role !== 'admin' && profile?.role !== 'founder') {
        users = users.filter(u => u.uid === user.uid);
        attendance = attendance.filter(a => a.uid === user.uid);
        reports = reports.filter(r => r.uid === user.uid);
      }
      
      // Include chat history for context
      const historyContext = botMessages.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are the ${APP_CONFIG.BRAND_NAME} AI Assistant. You have access to the team's data.
        Current User: ${profile?.name} (${profile?.role})
        Team Data: ${JSON.stringify({ users, attendance, reports })}
        
        Recent Chat History:
        ${historyContext}
        
        User Question: ${userMsgText}
        
        Provide a concise, professional, and helpful answer based on the data and history. Use Markdown for formatting.`,
      });

      const botMsgText = response.text || "I'm sorry, I couldn't process that.";
      
      // 2. Save bot response to Firestore
      await addDoc(collection(db, 'chatMessages'), {
        uid: user.uid,
        role: 'bot',
        text: botMsgText,
        createdAt: serverTimestamp()
      });

    } catch (err) {
      console.error("Bot chat failed:", err);
      // We don't save error messages to Firestore usually, just show them locally
      setBotMessages(prev => [...prev, { uid: user.uid, role: 'bot', text: "I'm having trouble connecting to my brain right now. Please try again later.", createdAt: new Date() }]);
    } finally {
      setIsBotLoading(false);
    }
  };

  const handleTriggerAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { users, attendance, reports } = await DataService.getAllDataForAnalysis();
      const result = await AIService.analyzePerformance(users, attendance, reports);
      setAiAnalysis(result);
    } catch (err) {
      console.error("AI Analysis failed:", err);
      addToast("AI Analysis failed. Please try again later.", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePostIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newIdeaTitle.trim() || !newIdeaDescription.trim()) return;

    try {
      await addDoc(collection(db, 'brainstorm'), {
        uid: user.uid,
        authorName: user.displayName || 'User',
        title: newIdeaTitle.trim(),
        description: newIdeaDescription.trim(),
        category: newIdeaCategory,
        status: 'open',
        createdAt: serverTimestamp(),
        upvotes: []
      });
      setNewIdeaTitle('');
      setNewIdeaDescription('');
      setNewIdeaCategory('idea');
      addToast("Idea posted successfully!", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'brainstorm');
    }
  };

  const handleUpvoteIdea = async (ideaId: string, upvotes: string[]) => {
    if (!user) return;
    const hasUpvoted = upvotes.includes(user.uid);
    const newUpvotes = hasUpvoted 
      ? upvotes.filter(id => id !== user.uid)
      : [...upvotes, user.uid];

    try {
      await updateDoc(doc(db, 'brainstorm', ideaId), {
        upvotes: newUpvotes
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'brainstorm');
    }
  };

  const handleUpdateIdeaStatus = async (ideaId: string, newStatus: BrainstormIdea['status']) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'brainstorm', ideaId), {
        status: newStatus
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'brainstorm');
    }
  };

  const handleLeaveRequest = async (type: 'leave' | 'wfh', reason: string, startDate: string, endDate: string) => {
    if (!user || !reason.trim()) {
      addToast("Please provide a reason.", "warning");
      return;
    }

    if (type === 'leave') {
      const requestedDays = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
      if (leaveBalance + requestedDays > APP_CONFIG.ANNUAL_LEAVE_LIMIT) {
        addToast(`You only have ${APP_CONFIG.ANNUAL_LEAVE_LIMIT - leaveBalance} days of leave remaining for this year.`, "warning");
        return;
      }
    }

    try {
      await addDoc(collection(db, 'leaves'), {
        uid: user.uid,
        startDate,
        endDate,
        reason,
        type,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      addToast("Request submitted successfully!", "success");
      setIsLeaveModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'leaves');
    }
  };

  const Leaderboard = ({ data }: { data: AIAnalysisResult['leaderboard'] }) => (
    <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Performance Leaderboard</h3>
          <p className="text-xs text-gray-500 mt-1">Top contributors based on AI analysis.</p>
        </div>
        <Trophy className="text-orange-500" size={24} />
      </div>
      <div className="space-y-4">
        {data.sort((a, b) => a.rank - b.rank).slice(0, 5).map((entry) => (
          <div key={entry.uid} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100 group hover:border-orange-500 transition-all">
            <div className="flex items-center gap-4">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs",
                entry.rank === 1 ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-600"
              )}>
                {entry.rank}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{entry.name}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{entry.role}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-orange-500">{entry.contributionScore.toFixed(0)}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Score</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-gray-400">{APP_CONFIG.BRAND_NAME} Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="flex justify-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center font-bold text-2xl text-black shadow-[0_0_20px_rgba(242,125,38,0.3)]">{APP_CONFIG.BRAND_NAME.split(' ')[0][0]}</div>
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase">{APP_CONFIG.BRAND_NAME.split(' ')[0]} <span className="text-primary">{APP_CONFIG.BRAND_NAME.split(' ')[1]}</span></h1>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Worker Tracking System</h2>
            <p className="text-gray-400">Secure workspace monitoring for Founders, Interns, and Employees.</p>
          </div>
          <button
            onClick={handleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-6 py-4 text-lg font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="h-6 w-6" />
            Sign in with Google
          </button>
          <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold">Authorized Access Only</p>
        </div>
      </div>
    );
  }

  if (showRoleSelection) {
    return <RoleSelection onSelect={handleRoleSelect} />;
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#f5f5f5] text-gray-900 overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} profile={profile} onLogout={handleLogout} />
        
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange} 
        />
        
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <header className="sticky top-0 z-10 flex items-center justify-between bg-white/80 px-8 py-4 backdrop-blur-md border-b border-gray-100">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                {activeTab === 'dashboard' && 'My Dashboard'}
                {activeTab === 'attendance' && 'Attendance Log'}
                {activeTab === 'leaves' && 'Leave & WFH'}
                {activeTab === 'reports' && 'Daily Reports'}
                {activeTab === 'analytics' && 'Team Analytics'}
                {activeTab === 'bot' && 'AI Analytics Bot'}
                {activeTab === 'brainstorm' && `${APP_CONFIG.BRAND_NAME.split(' ')[0]} Brainstorm`}
                {activeTab === 'chopping-block' && 'The Chopping Block'}
                {activeTab === 'settings' && 'Account Settings'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">System Active • {format(new Date(), 'hh:mm a')}</p>
              </div>
            </div>
            
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search records..." 
                    className="rounded-full bg-gray-100 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 w-64"
                  />
                </div>
                <div className="relative">
                  <button 
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className="relative rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200 transition-all"
                  >
                    <Bell size={20} />
                    {notifications.filter(n => !n.read).length > 0 && (
                      <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-500 border-2 border-white" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isNotificationsOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setIsNotificationsOpen(false)} 
                        />
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-2 w-80 rounded-2xl bg-white p-4 shadow-2xl border border-gray-100 z-50 overflow-hidden"
                        >
                          <div className="flex items-center justify-between mb-4 px-2">
                            <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                            <button 
                              onClick={handleMarkAllNotificationsRead}
                              className="text-[10px] font-bold text-orange-500 uppercase tracking-widest hover:text-orange-600"
                            >
                              Mark all read
                            </button>
                          </div>
                          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                            {notifications.length === 0 ? (
                              <div className="py-8 text-center text-gray-400">
                                <Bell size={24} className="mx-auto mb-2 opacity-20" />
                                <p className="text-xs italic">No notifications yet</p>
                              </div>
                            ) : (
                              notifications.map((n) => (
                                <div 
                                  key={n.id} 
                                  onClick={() => handleMarkNotificationRead(n.id!)}
                                  className={cn(
                                    "p-3 rounded-xl transition-all cursor-pointer border",
                                    n.read ? "bg-white border-transparent" : "bg-orange-50/50 border-orange-100"
                                  )}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={cn(
                                      "mt-1 h-2 w-2 rounded-full shrink-0",
                                      n.type === 'info' ? "bg-blue-500" :
                                      n.type === 'success' ? "bg-green-500" :
                                      n.type === 'warning' ? "bg-yellow-500" : "bg-red-500"
                                    )} />
                                    <div>
                                      <p className="text-xs font-bold text-gray-900">{n.title}</p>
                                      <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                                      <p className="text-[8px] text-gray-400 mt-1 uppercase font-bold">
                                        {n.createdAt instanceof Timestamp ? format(n.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
          </header>

          <div className="p-8 space-y-8">
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <StatCard title="Hours Today" value={todayRecord?.totalHours?.toFixed(1) || '0.0'} subtitle="vs 8.0 target" icon={Clock} trend="0.0" trendType="up" color="bg-orange-500" />
                  <StatCard 
                    title="Check-in Time" 
                    value={todayRecord?.checkInTime ? (todayRecord.checkInTime instanceof Timestamp ? format(todayRecord.checkInTime.toDate(), 'hh:mm a') : 'Just now') : '--:--'} 
                    subtitle="Arrival proof logged" 
                    icon={MapPin} 
                    trend="On time" 
                    trendType="up" 
                    color="bg-blue-500" 
                  />
                  <StatCard title="Tasks Pending" value={todayReport?.todoList?.length || 0} subtitle="To-do list active" icon={CheckCircle2} trend="3 completed" trendType="up" color="bg-green-500" />
                  <StatCard title="Monthly Attendance" value={`${attendance.length}/22`} subtitle="Working days" icon={CalendarIcon} trend="95%" trendType="up" color="bg-purple-500" />
                </div>

                {(profile?.role === 'admin' || profile?.role === 'founder') && (
                  <div className="rounded-2xl bg-gradient-to-r from-black to-gray-800 p-6 text-white shadow-xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <Sparkles size={24} />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold">AI Team Insights</h4>
                        <p className="text-xs text-gray-400">Generate a comprehensive performance analysis using {APP_CONFIG.BRAND_NAME.split(' ')[0]} AI.</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleTriggerAIAnalysis}
                      disabled={isAnalyzing}
                      className={cn(
                        "rounded-xl px-6 py-3 text-sm font-bold transition-all flex items-center gap-2",
                        isAnalyzing ? "bg-gray-700 text-gray-400 cursor-not-allowed" : "bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20"
                      )}
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Zap size={18} />
                          Trigger Analysis
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                  {/* Workspace Access Card */}
                  <div className="lg:col-span-1 rounded-2xl bg-white p-8 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[400px]">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Workspace Access</h3>
                      <p className="text-xs text-gray-500 mb-8">Secure login/logout with geolocation and photo proof.</p>
                      
                      {(!todayRecord || todayRecord.checkOutTime) ? (
                        <div className="space-y-6">
                          <div className="rounded-xl bg-orange-50 p-6 border border-orange-100">
                            <p className="text-sm text-orange-800 font-medium leading-relaxed">
                              {todayRecord?.checkOutTime 
                                ? "Shift completed! You can start another shift if needed. Your location and a photo proof will be recorded."
                                : "Welcome back! Please check in to start your shift. Your location and a photo proof will be recorded."}
                            </p>
                          </div>
                          <button 
                            onClick={handleCheckInClick}
                            className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-6 py-4 text-white font-bold hover:opacity-90 transition-all shadow-lg shadow-orange-500/20"
                          >
                            <Camera size={20} />
                            {todayRecord?.checkOutTime ? "Start Another Shift" : "Check In Now"}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between p-4 rounded-xl bg-green-50 border border-green-100">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <Clock size={20} />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Shift Started</p>
                                <p className="text-lg font-black text-green-900">
                                  {todayRecord.checkInTime ? (todayRecord.checkInTime instanceof Timestamp ? format(todayRecord.checkInTime.toDate(), 'hh:mm a') : 'Just now') : 'Just now'}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Shift Progress</h4>
                            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: '45%' }} />
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-gray-500">
                              <span>0.0 HRS</span>
                              <span>8.0 HRS TARGET</span>
                            </div>
                          </div>

                          <button 
                            onClick={handleCheckOut}
                            className="flex w-full items-center justify-center gap-3 rounded-xl bg-black px-6 py-4 text-white font-bold hover:bg-gray-900 transition-all"
                          >
                            <LogOut size={20} />
                            Check Out
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-6 border-t border-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-gray-400" />
                        <span className="text-[10px] font-medium text-gray-400">Workspace: Main HQ</span>
                      </div>
                      <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Verified</span>
                    </div>
                  </div>

                  {/* To-Do List Card */}
                  <div className="lg:col-span-2 rounded-2xl bg-white p-8 shadow-sm border border-gray-100 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Daily To-Do List</h3>
                        <p className="text-xs text-gray-500 mt-1">Plan your day and track progress.</p>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                        <CheckCircle2 size={20} />
                      </div>
                    </div>

                    <form onSubmit={handleAddTodo} className="mb-6 flex gap-2">
                      <input 
                        type="text" 
                        value={newTodo}
                        onChange={(e) => setNewTodo(e.target.value)}
                        placeholder={(!todayRecord || todayRecord.checkOutTime) ? "Check in to add tasks..." : "What needs to be done today?"}
                        disabled={!todayRecord || !!todayRecord.checkOutTime}
                        className={cn(
                          "flex-1 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20",
                          (!todayRecord || todayRecord.checkOutTime) && "opacity-50 cursor-not-allowed"
                        )}
                      />
                      <button 
                        type="submit"
                        disabled={!todayRecord || !!todayRecord.checkOutTime}
                        className={cn(
                          "rounded-xl bg-black px-6 py-3 text-sm font-bold text-white hover:bg-gray-900 transition-all",
                          (!todayRecord || todayRecord.checkOutTime) && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        Add Task
                      </button>
                    </form>

                    <div className="flex-1 space-y-3 overflow-y-auto max-h-[250px] pr-2">
                      {todayReport?.todoList?.map((todo, i) => (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={i} 
                          className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100 group hover:border-orange-200 transition-all"
                        >
                          <div 
                            onClick={() => handleToggleTodo(i)}
                            className={cn(
                              "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer",
                              todo.completed ? "bg-orange-500 border-orange-500 text-white" : "border-gray-200 text-transparent"
                            )}
                          >
                            <Check size={12} />
                          </div>
                          <span className={cn("flex-1 text-sm font-medium transition-all", todo.completed ? "text-gray-400 line-through" : "text-gray-700")}>
                            {todo.task}
                          </span>
                          <button 
                            onClick={() => handleDeleteTodo(i)}
                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </motion.div>
                      )) || (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                          <Plus size={32} className="mb-2 opacity-20" />
                          <p className="text-sm italic">No tasks added for today yet.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Leaderboard Card (Dashboard) */}
                  {aiAnalysis && (
                    <div className="lg:col-span-3">
                      <Leaderboard data={aiAnalysis.leaderboard} />
                    </div>
                  )}
                </div>

                {/* Daily Report Section */}
                <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Daily Report Link</h3>
                      <p className="text-xs text-gray-500 mt-1">Provide a link to your daily report (e.g., Google Doc) before checking out.</p>
                    </div>
                    <FileText className="text-gray-400" size={24} />
                  </div>

                  {todayReport?.reportUrl ? (
                    <div className="flex items-center justify-between p-6 rounded-2xl bg-blue-50 border border-blue-100">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                          <ExternalLink size={24} />
                        </div>
                        <div className="max-w-[200px] md:max-w-md">
                          <p className="text-sm font-bold text-blue-900">Report Link Submitted</p>
                          <p className="text-xs text-blue-600 truncate">{todayReport.reportUrl}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleViewReport(todayReport.reportUrl)}
                          className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-blue-600 border border-blue-200 hover:bg-blue-100 transition-all flex items-center gap-2"
                        >
                          <ExternalLink size={14} />
                          Open Link
                        </button>
                        <button 
                          onClick={() => {
                            setReportLink(todayReport.reportUrl || '');
                            // Scroll to input or just let them edit
                          }}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-all"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <form onSubmit={handleReportLinkSubmit} className={cn("mt-6", (todayReport?.reportUrl || !todayRecord || todayRecord.checkOutTime) && "opacity-60 hover:opacity-100 transition-opacity")}>
                    <div className="flex gap-4">
                      <div className="relative flex-1">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                          <ExternalLink size={18} />
                        </div>
                        <input 
                          type="url"
                          value={reportLink}
                          onChange={(e) => setReportLink(e.target.value)}
                          placeholder={(!todayRecord || todayRecord.checkOutTime) ? "Check in to submit report link..." : "Paste your Google Doc or report link here..."}
                          disabled={!todayRecord || !!todayRecord.checkOutTime}
                          className={cn(
                            "w-full bg-gray-50 border border-gray-100 rounded-xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all",
                            (!todayRecord || todayRecord.checkOutTime) && "opacity-50 cursor-not-allowed"
                          )}
                          required
                        />
                      </div>
                      <button 
                        type="submit"
                        disabled={!todayRecord || !!todayRecord.checkOutTime}
                        className={cn(
                          "rounded-xl bg-black px-8 py-4 text-sm font-bold text-white hover:bg-gray-900 transition-all shadow-xl",
                          (!todayRecord || todayRecord.checkOutTime) && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {todayReport?.reportUrl ? 'Update Link' : 'Save Link'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="rounded-3xl bg-white p-8 shadow-sm border border-gray-100">
                  <h3 className="text-xl font-black text-gray-900 mb-6">Profile Information</h3>
                  <div className="flex items-center gap-8 mb-8">
                    <div className="relative group">
                      <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-400 overflow-hidden border-4 border-white shadow-lg">
                        {user?.photoURL ? (
                          <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          user?.displayName?.[0] || 'U'
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">{user?.displayName}</h4>
                      <p className="text-sm text-gray-500">{user?.email}</p>
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-[10px] font-bold text-orange-600 uppercase tracking-widest">
                        {profile?.role}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Display Name</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={editDisplayName} 
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          className="flex-1 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        />
                        <button 
                          onClick={() => handleUpdateProfile({ name: editDisplayName })}
                          className="rounded-xl bg-black px-4 py-2 text-xs font-bold text-white hover:bg-gray-900 transition-all"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email Address</label>
                      <input 
                        type="email" 
                        value={user?.email || ''} 
                        disabled
                        className="w-full rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm text-gray-500 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-8 shadow-sm border border-gray-100">
                  <h3 className="text-xl font-black text-gray-900 mb-6">System Preferences</h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between py-4 border-b border-gray-50">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Email Notifications</p>
                        <p className="text-xs text-gray-500">Receive daily summaries and shift alerts via email.</p>
                      </div>
                      <div 
                        onClick={() => {
                          const newVal = !emailNotifications;
                          setEmailNotifications(newVal);
                          handleUpdateProfile({ preferences: { emailNotifications: newVal, pushNotifications } });
                        }}
                        className={cn(
                          "h-6 w-11 rounded-full relative cursor-pointer transition-colors",
                          emailNotifications ? "bg-orange-500" : "bg-gray-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                          emailNotifications ? "right-1" : "left-1"
                        )} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-4 border-b border-gray-50">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Push Notifications</p>
                        <p className="text-xs text-gray-500">Get real-time updates on your desktop or mobile.</p>
                      </div>
                      <div 
                        onClick={() => {
                          const newVal = !pushNotifications;
                          setPushNotifications(newVal);
                          handleUpdateProfile({ preferences: { emailNotifications, pushNotifications: newVal } });
                        }}
                        className={cn(
                          "h-6 w-11 rounded-full relative cursor-pointer transition-colors",
                          pushNotifications ? "bg-orange-500" : "bg-gray-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                          pushNotifications ? "right-1" : "left-1"
                        )} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-4">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Dark Mode</p>
                        <p className="text-xs text-gray-500">Switch between light and dark themes (Coming Soon).</p>
                      </div>
                      <div className="h-6 w-11 rounded-full bg-gray-200 relative cursor-not-allowed opacity-50">
                        <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-red-50 p-8 border border-red-100">
                  <h3 className="text-xl font-black text-red-900 mb-2">Danger Zone</h3>
                  <p className="text-sm text-red-700 mb-6">Once you delete your account, there is no going back. Please be certain.</p>
                  <button 
                    onClick={() => addToast("Account deletion is restricted. Please contact your administrator.", "warning")}
                    className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'attendance' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avg. Shift Duration</p>
                    <p className="text-3xl font-black mt-1">8.4 <span className="text-xs font-medium text-gray-400">hrs</span></p>
                  </div>
                  <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">On-Time Arrival</p>
                    <p className="text-3xl font-black mt-1 text-green-500">92%</p>
                  </div>
                  <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Days Present</p>
                    <p className="text-3xl font-black mt-1">{attendance.length}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between p-6 border-b border-gray-50">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Monthly Attendance Log</h3>
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-gray-400 hover:text-gray-600"><ChevronLeft size={16} /></button>
                      <span className="text-xs font-bold text-gray-800">{format(new Date(), 'MMMM yyyy')}</span>
                      <button className="p-1 text-gray-400 hover:text-gray-600"><ChevronRight size={16} /></button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <tr>
                          <th className="px-6 py-4">Worker</th>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Check In</th>
                          <th className="px-6 py-4">Check Out</th>
                          <th className="px-6 py-4">Duration</th>
                          <th className="px-6 py-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {attendance.map((record) => (
                          <AttendanceRow 
                            key={record.id} 
                            record={record} 
                            userProfile={profile || undefined} 
                            onPhotoClick={setSelectedPhoto}
                          />
                        ))}
                        {attendance.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic text-sm">No attendance records found for this period.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'leaves' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Leave & WFH Requests</h3>
                    <p className="text-sm text-gray-500 mt-1">Submit and track your time-off requests.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setLeaveType('leave');
                      setIsLeaveModalOpen(true);
                    }}
                    className="rounded-xl bg-black px-6 py-3 text-sm font-bold text-white hover:bg-gray-900 transition-all shadow-lg"
                  >
                    New Request
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-6 border-b border-gray-50">
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">My Request History</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            <tr>
                              <th className="px-6 py-4">Type</th>
                              <th className="px-6 py-4">Duration</th>
                              <th className="px-6 py-4">Reason</th>
                              <th className="px-6 py-4">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 text-xs">
                            {leaves.map((leave) => (
                              <tr key={leave.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", leave.type === 'leave' ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500")}>
                                      {leave.type === 'leave' ? <Plane size={16} /> : <Home size={16} />}
                                    </div>
                                    <span className="font-bold capitalize">{leave.type}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-600">{leave.startDate} - {leave.endDate}</td>
                                <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{leave.reason}</td>
                                <td className="px-6 py-4">
                                  <span className={cn(
                                    "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                    leave.status === 'approved' ? "bg-green-100 text-green-700" : 
                                    leave.status === 'pending' ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                                  )}>
                                    {leave.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {leaves.length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">No requests found.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {(profile?.role === 'admin') && (
                      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                          <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Admin: All Team Requests</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              <tr>
                                <th className="px-6 py-4">Worker</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Duration</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-xs">
                              {allLeaves.map((leave) => {
                                const userProfile = allUsers.find(u => u.uid === leave.uid);
                                return (
                                  <tr key={leave.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                          {userProfile?.name?.[0] || 'U'}
                                        </div>
                                        <span className="font-bold">{userProfile?.name || 'Unknown'}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 capitalize font-medium">{leave.type}</td>
                                    <td className="px-6 py-4 text-gray-500">{leave.startDate} - {leave.endDate}</td>
                                    <td className="px-6 py-4">
                                      <span className={cn(
                                        "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                        leave.status === 'approved' ? "bg-green-100 text-green-700" : 
                                        leave.status === 'pending' ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                                      )}>
                                        {leave.status}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4">
                                      {leave.status === 'pending' && (
                                        <div className="flex items-center gap-2">
                                          <button 
                                            onClick={() => handleUpdateLeaveStatus(leave.id!, 'approved', leave.uid)}
                                            className="rounded bg-green-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-green-600"
                                          >
                                            Approve
                                          </button>
                                          <button 
                                            onClick={() => handleUpdateLeaveStatus(leave.id!, 'rejected', leave.uid)}
                                            className="rounded bg-red-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-red-600"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                              {allLeaves.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No team requests found.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Leave Balance</h4>
                        <button 
                          onClick={() => setIsPolicyModalOpen(true)}
                          className="text-[10px] font-bold text-orange-500 hover:text-orange-600 uppercase tracking-widest"
                        >
                          View Policy
                        </button>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs mb-2">
                            <span className="font-medium text-gray-600">Annual Leave</span>
                            <span className="font-bold text-gray-900">{leaveBalance} / {APP_CONFIG.ANNUAL_LEAVE_LIMIT} days</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full bg-orange-500" style={{ width: `${leavePercentage}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-6 text-white shadow-lg shadow-orange-500/20">
                      <h4 className="text-sm font-bold mb-2">Need a break?</h4>
                      <p className="text-xs text-orange-100 leading-relaxed mb-4">Make sure to submit your leave requests at least 48 hours in advance for approval.</p>
                      <button 
                        onClick={() => setIsPolicyModalOpen(true)}
                        className="w-full rounded-lg bg-white/20 py-2 text-xs font-bold hover:bg-white/30 transition-all"
                      >
                        View Policy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Daily Reports</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {profile?.role === 'admin' || profile?.role === 'founder' 
                      ? 'View and manage daily report links from the entire team.' 
                      : 'Access your previously submitted report links.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {(profile?.role === 'admin' || profile?.role === 'founder' ? allReports : dailyReports)
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((report) => {
                      const reportUser = allUsers.find(u => u.uid === report.uid) || profile;
                      const completedCount = report.todoList?.filter(t => t.completed).length || 0;
                      const totalCount = report.todoList?.length || 0;
                      
                      return (
                        <motion.div
                          key={report.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ y: -5 }}
                          className="group rounded-2xl bg-white p-6 shadow-sm border border-gray-100 hover:border-orange-500 hover:shadow-xl hover:shadow-orange-500/5 transition-all"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
                              <FileText size={24} />
                            </div>
                            <div className="flex gap-2">
                              {report.reportUrl && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewReport(report.reportUrl);
                                  }}
                                  className="h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-orange-500 transition-all"
                                  title="Open Report Link"
                                >
                                  <ExternalLink size={16} />
                                </button>
                              )}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedReportForTasks(report);
                                }}
                                className="h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-orange-500 transition-all"
                                title="View Tasks"
                              >
                                <ListChecks size={16} />
                              </button>
                            </div>
                          </div>
                          
                          <div className="mb-4">
                            <button 
                              onClick={() => handleViewReport(report.reportUrl)}
                              className="text-left group/date"
                            >
                              <h4 className="text-lg font-black text-gray-900 leading-tight group-hover/date:text-orange-500 transition-colors">
                                {format(parseISO(report.date), 'MMMM do, yy')}
                              </h4>
                            </button>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Daily Summary</p>
                          </div>

                          <div className="mb-4 space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                              <span className="text-gray-400">Task Completion</span>
                              <span className={cn(completedCount === totalCount && totalCount > 0 ? "text-green-500" : "text-orange-500")}>
                                {completedCount}/{totalCount} Done
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                              <div 
                                className={cn("h-full transition-all duration-500", completedCount === totalCount && totalCount > 0 ? "bg-green-500" : "bg-orange-500")} 
                                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }} 
                              />
                            </div>
                          </div>

                          {(profile?.role === 'admin' || profile?.role === 'founder') && (
                            <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-gray-50 border border-gray-100">
                              <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold">
                                {reportUser?.name?.[0] || 'U'}
                              </div>
                              <span className="text-[10px] font-bold text-gray-600 truncate">{reportUser?.name}</span>
                            </div>
                          )}

                          <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Submitted</span>
                            <button 
                              onClick={() => setSelectedReportForTasks(report)}
                              className="text-[10px] font-bold text-orange-500 uppercase tracking-widest hover:translate-x-1 transition-transform flex items-center gap-1"
                            >
                              Details <ChevronRight size={12} />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  
                  {((profile?.role === 'admin' || profile?.role === 'founder' ? allReports : dailyReports).length === 0) && (
                    <div className="col-span-full py-20 text-center">
                      <div className="mx-auto h-20 w-20 rounded-full bg-gray-50 flex items-center justify-center text-gray-200 mb-4">
                        <FileText size={40} />
                      </div>
                      <p className="text-gray-400 italic">No reports found yet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'bot' && (profile?.role === 'admin' || profile?.role === 'founder') && (
              <div className="flex flex-col h-[calc(100vh-7rem)]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">AI Analytics Bot</h3>
                    <p className="text-sm text-gray-500">Intelligent performance analysis and team insights.</p>
                  </div>
                  {(profile?.role === 'admin' || profile?.role === 'founder') && (
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={handleTriggerAIAnalysis}
                        disabled={isAnalyzing}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all shadow-lg",
                          isAnalyzing ? "bg-gray-400 cursor-not-allowed" : "bg-orange-500 hover:bg-orange-600 shadow-orange-500/20"
                        )}
                      >
                        {isAnalyzing ? (
                          <>
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            Weekly Analysis
                          </>
                        )}
                      </button>

                      <button 
                        onClick={() => handleCheckMissingReports()}
                        disabled={isAuditing}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all shadow-lg",
                          isAuditing ? "bg-gray-400 cursor-not-allowed" : "bg-black hover:bg-gray-900 shadow-black/10"
                        )}
                      >
                        {isAuditing ? (
                          <>
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Auditing...
                          </>
                        ) : (
                          <>
                            <ShieldAlert size={14} />
                            Audit Reports
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {botMessages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <div className="h-16 w-16 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 mb-4">
                          <Bot size={32} />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900">How can I help you today?</h4>
                        <p className="text-sm text-gray-500 max-w-xs mx-auto">Ask me about team performance, attendance trends, or project progress.</p>
                      </div>
                    )}
                    {botMessages.map((msg, i) => (
                      <div key={msg.id || i} className={cn(
                        "flex w-full",
                        msg.role === 'user' ? "justify-end" : "justify-start"
                      )}>
                        <div className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                          msg.role === 'user' 
                            ? "bg-black text-white rounded-tr-none" 
                            : "bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200"
                        )}>
                          {msg.role === 'bot' ? (
                            <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-800 prose-pre:text-white">
                              <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>
                          ) : (
                            msg.text
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                    {isBotLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-2xl px-4 py-3 text-sm border border-gray-200 rounded-tl-none flex items-center gap-2">
                          <div className="flex gap-1">
                            <motion.div 
                              animate={{ y: [0, -5, 0] }}
                              transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                              className="h-1.5 w-1.5 rounded-full bg-gray-400" 
                            />
                            <motion.div 
                              animate={{ y: [0, -5, 0] }}
                              transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                              className="h-1.5 w-1.5 rounded-full bg-gray-400" 
                            />
                            <motion.div 
                              animate={{ y: [0, -5, 0] }}
                              transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                              className="h-1.5 w-1.5 rounded-full bg-gray-400" 
                            />
                          </div>
                          <span className="text-xs text-gray-400 font-medium">Bot is thinking...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleBotChat} className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2">
                    <input 
                      type="text" 
                      value={botInput}
                      onChange={(e) => setBotInput(e.target.value)}
                      placeholder={isBotLoading ? "Bot is typing..." : "Ask the AI Bot..."}
                      disabled={isBotLoading}
                      className="flex-1 rounded-xl bg-white border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-50"
                    />
                    <button 
                      type="submit"
                      disabled={isBotLoading || !botInput.trim()}
                      className="rounded-xl bg-black p-3 text-white hover:bg-gray-900 transition-all shadow-lg disabled:bg-gray-400"
                    >
                      <Send size={20} />
                    </button>
                  </form>
                </div>

                {aiAnalysis && (
                  <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-8">
                      <div className="rounded-3xl bg-black p-8 text-white shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="h-10 w-10 rounded-xl bg-orange-500 flex items-center justify-center">
                            <Zap size={24} className="text-white" />
                          </div>
                          <h4 className="text-xl font-bold">AI Performance Summary</h4>
                        </div>
                        <p className="text-gray-400 leading-relaxed mb-8">{aiAnalysis.summary}</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Top Performer</p>
                            <p className="text-lg font-black text-orange-500">{aiAnalysis.topPerformer}</p>
                          </div>
                          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Team Health</p>
                            <p className="text-lg font-black text-green-500">Excellent</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl bg-white p-8 shadow-sm border border-gray-100">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Strategic Insights</h4>
                        <div className="prose prose-sm max-w-none text-gray-600">
                          {aiAnalysis.insights.split('\n').map((line, i) => (
                            <p key={i} className="mb-4">{line}</p>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-1">
                      <Leaderboard data={aiAnalysis.leaderboard} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'brainstorm' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{APP_CONFIG.BRAND_NAME.split(' ')[0]} Brainstorm</h3>
                    <p className="text-sm text-gray-500 mt-1">Post ideas, to-dos, and discuss future plans.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                  {/* Post Idea Form */}
                  <div className="lg:col-span-1">
                    <div className="rounded-3xl bg-white p-8 shadow-sm border border-gray-100 sticky top-24">
                      <h4 className="text-lg font-bold text-gray-900 mb-6">Post New Idea</h4>
                      <form onSubmit={handlePostIdea} className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Title</label>
                          <input 
                            type="text" 
                            value={newIdeaTitle}
                            onChange={(e) => setNewIdeaTitle(e.target.value)}
                            placeholder="What's your idea?"
                            className="w-full rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Category</label>
                          <select 
                            value={newIdeaCategory}
                            onChange={(e) => setNewIdeaCategory(e.target.value as any)}
                            className="w-full rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                          >
                            <option value="idea">Idea</option>
                            <option value="todo">To-Do</option>
                            <option value="discussion">Discussion</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Description</label>
                          <textarea 
                            value={newIdeaDescription}
                            onChange={(e) => setNewIdeaDescription(e.target.value)}
                            placeholder="Describe it in detail..."
                            rows={4}
                            className="w-full rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                            required
                          />
                        </div>
                        <button 
                          type="submit"
                          className="w-full rounded-xl bg-black py-4 text-sm font-bold text-white hover:bg-gray-900 transition-all shadow-lg"
                        >
                          Post to Forum
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Ideas Feed */}
                  <div className="lg:col-span-2 space-y-6">
                    {brainstormIdeas.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-32 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                        <div className="h-20 w-20 rounded-full bg-gray-50 flex items-center justify-center text-gray-200 mb-6">
                          <Lightbulb size={40} />
                        </div>
                        <h4 className="text-xl font-bold text-gray-900 mb-2">No ideas yet</h4>
                        <p className="text-sm text-gray-500">Be the first to post something!</p>
                      </div>
                    ) : (
                      brainstormIdeas.map((idea) => (
                        <motion.div 
                          key={idea.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-3xl bg-white p-8 shadow-sm border border-gray-100 hover:border-orange-500/30 transition-all group"
                        >
                          <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest",
                                idea.category === 'idea' ? "bg-purple-100 text-purple-600" :
                                idea.category === 'todo' ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
                              )}>
                                {idea.category}
                              </div>
                              <div className={cn(
                                "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest",
                                idea.status === 'open' ? "bg-green-100 text-green-600" :
                                idea.status === 'in-progress' ? "bg-yellow-100 text-yellow-600" :
                                idea.status === 'completed' ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-600"
                              )}>
                                {idea.status}
                              </div>
                            </div>
                            <button 
                              onClick={() => handleUpvoteIdea(idea.id!, idea.upvotes)}
                              className={cn(
                                "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
                                idea.upvotes.includes(user?.uid || '') 
                                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                              )}
                            >
                              <TrendingUp size={14} />
                              {idea.upvotes.length}
                            </button>
                          </div>

                          <h4 className="text-xl font-black text-gray-900 mb-2 group-hover:text-orange-500 transition-colors">{idea.title}</h4>
                          <p className="text-sm text-gray-600 leading-relaxed mb-6 whitespace-pre-wrap">{idea.description}</p>

                          <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                {idea.authorName[0]}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-gray-900">{idea.authorName}</p>
                                <p className="text-[10px] text-gray-400">{idea.createdAt instanceof Timestamp ? format(idea.createdAt.toDate(), 'MMM d, yyyy') : 'Just now'}</p>
                              </div>
                            </div>

                            {(profile?.role === 'admin' || profile?.role === 'founder' || idea.uid === user?.uid) && (
                              <div className="flex items-center gap-2">
                                <select 
                                  value={idea.status}
                                  onChange={(e) => handleUpdateIdeaStatus(idea.id!, e.target.value as any)}
                                  className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-transparent border-none focus:ring-0 cursor-pointer hover:text-orange-500 transition-colors"
                                >
                                  <option value="open">Open</option>
                                  <option value="in-progress">In Progress</option>
                                  <option value="completed">Completed</option>
                                  <option value="archived">Archived</option>
                                </select>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (profile?.role === 'admin' || profile?.role === 'founder') && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Team Analytics</h3>
                    <p className="text-sm text-gray-500 mt-1">Real-time overview of workforce performance and attendance.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={handleTriggerAIAnalysis}
                      disabled={isAnalyzing}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all shadow-lg",
                        isAnalyzing ? "bg-gray-400 cursor-not-allowed" : "bg-orange-500 hover:bg-orange-600 shadow-orange-500/20"
                      )}
                    >
                      <Sparkles size={14} />
                      {isAnalyzing ? "Analyzing..." : "AI Performance Analysis"}
                    </button>
                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
                    {['all', 'founder', 'employee', 'intern'].map((role) => (
                      <button
                        key={role}
                        onClick={() => setRoleFilter(role as any)}
                        className={cn(
                          "px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize",
                          roleFilter === role ? "bg-black text-white shadow-md" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        {role}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                  <StatCard title="Total Workforce" value={filteredUsers.length} subtitle="Active members" icon={Users} trend={`${filteredUsers.filter(u => u.role === 'founder').length} Founders`} trendType="up" color="bg-black" />
                  <StatCard title="Present Today" value={filteredAttendance.filter(a => a.date === format(new Date(), 'yyyy-MM-dd')).length} subtitle="At workspace" icon={CheckCircle2} trend="85%" trendType="up" color="bg-green-500" />
                  <StatCard title="On Leave" value={leaves.filter(l => l.status === 'approved' && isSameDay(parseISO(l.startDate), new Date())).length} subtitle="Approved requests" icon={Plane} trend="0 change" trendType="up" color="bg-red-500" />
                  <StatCard title="Avg. Efficiency" value="94%" subtitle="Team utilization" icon={Activity} trend="2.4%" trendType="up" color="bg-orange-500" />
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                  <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-8">Workforce Attendance Trend</h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={
                          eachDayOfInterval({
                            start: startOfMonth(new Date()),
                            end: endOfMonth(new Date())
                          }).slice(0, 7).map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const dayAttendance = filteredAttendance.filter(a => a.date === dateStr);
                            return {
                              name: format(day, 'EEE'),
                              present: dayAttendance.filter(a => a.status === 'present').length,
                              wfh: dayAttendance.filter(a => a.status === 'wfh').length
                            };
                          })
                        }>
                            <defs>
                              <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={APP_CONFIG.PRIMARY_COLOR} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={APP_CONFIG.PRIMARY_COLOR} stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#999'}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#999'}} />
                          <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)'}} />
                            <Area type="monotone" dataKey="present" stroke={APP_CONFIG.PRIMARY_COLOR} strokeWidth={3} fillOpacity={1} fill="url(#colorPresent)" />
                          <Area type="monotone" dataKey="wfh" stroke="#3b82f6" strokeWidth={3} fillOpacity={0} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-8">Role Distribution</h3>
                    <div className="h-64 w-full flex items-center justify-center relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Founders', value: allUsers.filter(u => u.role === 'founder').length },
                              { name: 'Employees', value: allUsers.filter(u => u.role === 'employee').length },
                              { name: 'Interns', value: allUsers.filter(u => u.role === 'intern').length },
                              { name: 'Admins', value: allUsers.filter(u => u.role === 'admin').length },
                            ]}
                            innerRadius={70}
                            outerRadius={90}
                            paddingAngle={8}
                            dataKey="value"
                          >
                            {[0, 1, 2, 3].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={[APP_CONFIG.PRIMARY_COLOR, '#000000', '#3b82f6', '#10b981'][index]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col items-center justify-center">
                        <span className="text-3xl font-black">
                          {allUsers.filter(u => ['founder', 'employee', 'intern', 'admin'].includes(u.role)).length}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Team</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-50">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recent Team Activity</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <tr>
                          <th className="px-6 py-4">Worker</th>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Check In</th>
                          <th className="px-6 py-4">Check Out</th>
                          <th className="px-6 py-4">Duration</th>
                          <th className="px-6 py-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredAttendance.map((record) => (
                          <AttendanceRow 
                            key={record.id} 
                            record={record} 
                            userProfile={allUsers.find(u => u.uid === record.uid)} 
                            onPhotoClick={setSelectedPhoto}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'chopping-block' && (
              <ChoppingBlock 
                user={user} 
                profile={profile} 
                allUsers={allUsers} 
                addToast={addToast} 
                showModal={showModal} 
                closeModal={closeModal} 
              />
            )}

            {activeTab === 'team-management' && profile?.role === 'admin' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Team Management</h3>
                  <p className="text-sm text-gray-500 mt-1">Manage user roles and permissions across the organization.</p>
                </div>

                <div className="rounded-3xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <tr>
                          <th className="px-6 py-4">User</th>
                          <th className="px-6 py-4">Email</th>
                          <th className="px-6 py-4">Current Role</th>
                          <th className="px-6 py-4">Change Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {allUsers.map((u) => (
                          <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                                  {u.name?.[0] || 'U'}
                                </div>
                                <span className="text-sm font-bold text-gray-900">{u.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest",
                                u.role === 'founder' ? "bg-orange-100 text-orange-600" :
                                u.role === 'admin' ? "bg-purple-100 text-purple-600" :
                                u.role === 'employee' ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
                              )}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <select 
                                value={u.role}
                                onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as any)}
                                disabled={u.uid === user?.uid}
                                className="text-xs font-bold text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 focus:ring-0 cursor-pointer disabled:opacity-50"
                              >
                                <option value="founder">Founder</option>
                                <option value="admin">Admin</option>
                                <option value="employee">Employee</option>
                                <option value="intern">Intern</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
        {/* Photo Viewer Modal */}
        <AnimatePresence>
          {selectedPhoto && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPhoto(null)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm cursor-zoom-out"
            >
              <motion.img 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                src={selectedPhoto} 
                alt="Proof" 
                className="max-h-full max-w-full rounded-2xl shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Leave Request Modal */}
        <AnimatePresence>
          {isLeaveModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
              >
                <h3 className="text-2xl font-black mb-6">New Request</h3>
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Request Type</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setLeaveType('leave')}
                        className={cn(
                          "py-3 rounded-xl text-sm font-bold border transition-all",
                          leaveType === 'leave' ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200" : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        Leave
                      </button>
                      <button 
                        onClick={() => setLeaveType('wfh')}
                        className={cn(
                          "py-3 rounded-xl text-sm font-bold border transition-all",
                          leaveType === 'wfh' ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-200" : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        WFH
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Start Date</label>
                      <input 
                        type="date"
                        value={leaveStartDate}
                        onChange={(e) => setLeaveStartDate(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">End Date</label>
                      <input 
                        type="date"
                        value={leaveEndDate}
                        onChange={(e) => setLeaveEndDate(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Reason</label>
                    <textarea 
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      placeholder="Explain the reason for your request..."
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all h-32 resize-none"
                    />
                  </div>
                  <div className="flex gap-4 pt-2">
                    <button 
                      onClick={() => setIsLeaveModalOpen(false)}
                      className="flex-1 py-4 rounded-2xl text-sm font-bold text-gray-400 hover:bg-gray-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={submitLeaveRequest}
                      className="flex-1 py-4 rounded-2xl text-sm font-bold text-white bg-black hover:bg-gray-900 transition-all shadow-xl"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Policy Modal */}
        <AnimatePresence>
          {isPolicyModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black">Company Policy</h3>
                  <button onClick={() => setIsPolicyModalOpen(false)} className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all">
                    <Plus className="rotate-45" size={24} />
                  </button>
                </div>
                <div className="space-y-6 text-sm text-gray-600">
                  <section>
                    <h4 className="font-bold text-gray-900 mb-2">1. Working Hours</h4>
                    <p>Standard working hours are {APP_CONFIG.STANDARD_WORK_DAY_HOURS} hours per day. Check-in must be completed by {APP_CONFIG.CHECK_IN_DEADLINE_HOUR}:{APP_CONFIG.CHECK_IN_DEADLINE_MINUTE.toString().padStart(2, '0')} AM. Late arrivals must be justified.</p>
                  </section>
                  <section>
                    <h4 className="font-bold text-gray-900 mb-2">2. Leave Requests</h4>
                    <p>Employees are entitled to {APP_CONFIG.ANNUAL_LEAVE_LIMIT} days of annual leave per year. There are no separate sick leaves. All leave requests should be submitted at least {APP_CONFIG.LEAVE_REQUEST_ADVANCE_HOURS} hours in advance. Emergency leaves can be requested on the same day with valid proof.</p>
                  </section>
                  <section>
                    <h4 className="font-bold text-gray-900 mb-2">3. Work From Home</h4>
                    <p>WFH is allowed up to {APP_CONFIG.WFH_WEEKLY_LIMIT} days per week for eligible roles. Geolocation proof is still required for remote check-ins.</p>
                  </section>
                  <section>
                    <h4 className="font-bold text-gray-900 mb-2">4. Daily Reports</h4>
                    <p>A daily PDF report summarizing the day's progress must be uploaded before check-out. Check-out is disabled until the report is submitted.</p>
                  </section>
                </div>
                <button 
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="w-full mt-8 py-4 rounded-2xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-all shadow-xl shadow-orange-100"
                >
                  Got it
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Check-out Confirmation Modal */}
        <AnimatePresence>
          {isCheckOutConfirmOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl text-center"
              >
                <div className="mx-auto h-20 w-20 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 mb-6">
                  <LogOut size={40} />
                </div>
                <h3 className="text-2xl font-black mb-2">End Shift?</h3>
                <p className="text-gray-500 mb-8">Are you sure you want to end your shift for today? This action will record your checkout time and location.</p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setIsCheckOutConfirmOpen(false)}
                    className="flex-1 py-4 rounded-2xl text-sm font-bold text-gray-400 hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmCheckOut}
                    className="flex-1 py-4 rounded-2xl text-sm font-bold text-white bg-black hover:bg-gray-900 transition-all shadow-xl"
                  >
                    Yes, Check Out
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task List Modal */}
        <AnimatePresence>
          {selectedReportForTasks && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-black">Daily Tasks</h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
                      {format(parseISO(selectedReportForTasks.date), 'MMMM do, yyyy')}
                    </p>
                  </div>
                  <button onClick={() => setSelectedReportForTasks(null)} className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all">
                    <Plus className="rotate-45" size={24} />
                  </button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {selectedReportForTasks.todoList?.map((todo, i) => {
                    const isOwner = selectedReportForTasks.uid === user?.uid;
                    return (
                      <div 
                        key={i} 
                        onClick={async () => {
                          if (!isOwner) return;
                          const newList = [...(selectedReportForTasks.todoList || [])];
                          newList[i] = { ...newList[i], completed: !newList[i].completed };
                          try {
                            await updateDoc(doc(db, 'dailyReports', selectedReportForTasks.id!), {
                              todoList: newList
                            });
                            setSelectedReportForTasks({ ...selectedReportForTasks, todoList: newList });
                          } catch (err) {
                            handleFirestoreError(err, OperationType.UPDATE, 'dailyReports');
                          }
                        }}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-xl border border-gray-100 transition-all text-left",
                          isOwner ? "cursor-pointer hover:bg-gray-100 bg-gray-50" : "bg-gray-50/50"
                        )}
                      >
                        <div className={cn(
                          "h-5 w-5 rounded-md flex items-center justify-center transition-all",
                          todo.completed ? "bg-green-500 text-white" : "bg-gray-200 text-transparent"
                        )}>
                          <Check size={12} />
                        </div>
                        <span className={cn("text-sm font-medium", todo.completed ? "text-gray-400 line-through" : "text-gray-700")}>
                          {todo.task}
                        </span>
                      </div>
                    );
                  }) || (
                    <div className="text-center py-8 text-gray-400 italic">No tasks recorded for this day.</div>
                  )}
                </div>

                <button 
                  onClick={() => setSelectedReportForTasks(null)}
                  className="w-full mt-8 py-4 rounded-2xl text-sm font-bold text-white bg-black hover:bg-gray-900 transition-all shadow-xl"
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
