import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  orderBy, 
  limit,
  Timestamp,
  getDocs,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, ReviewCycle, Ballot } from '../types';
import { format, addDays, isAfter } from 'date-fns';
import { APP_CONFIG } from '../constants';
import { 
  Shield, 
  AlertTriangle, 
  Skull, 
  CheckCircle2, 
  ChevronRight, 
  Lock, 
  Users,
  TrendingDown,
  MessageSquare,
  Vote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ChoppingBlockProps {
  user: any;
  profile: UserProfile | null;
  allUsers: UserProfile[];
  addToast: (message: string, type?: any) => void;
  showModal: (config: any) => void;
  closeModal: () => void;
}

export function ChoppingBlock({ user, profile, allUsers, addToast, showModal, closeModal }: ChoppingBlockProps) {
  const [currentCycle, setCurrentCycle] = useState<ReviewCycle | null>(null);
  const [lastCycles, setLastCycles] = useState<ReviewCycle[]>([]);
  const [myBallot, setMyBallot] = useState<Ballot | null>(null);
  const [allBallots, setAllBallots] = useState<Ballot[]>([]);
  const [scores, setScores] = useState<{ [uid: string]: { score: number; reason: string } }>({});
  const [threshold, setThreshold] = useState(APP_CONFIG.CHOPPING_BLOCK_THRESHOLD);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editCycle, setEditCycle] = useState<{
    startDate: string;
    endDate: string;
    status: 'active' | 'voting' | 'completed';
    threshold: number;
  }>({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), APP_CONFIG.CHOPPING_BLOCK_CYCLE_DAYS), 'yyyy-MM-dd'),
    status: 'active',
    threshold: APP_CONFIG.CHOPPING_BLOCK_THRESHOLD
  });

  const founders = allUsers.filter(u => u.role === 'founder' || u.role === 'admin');
  const otherFounders = founders.filter(u => u.uid !== user?.uid);

  useEffect(() => {
    if (currentCycle?.threshold) {
      setThreshold(currentCycle.threshold);
    }
  }, [currentCycle]);

  useEffect(() => {
    if (!user) return;

    // Listen to current/recent cycles
    const q = query(collection(db, 'reviewCycles'), orderBy('startDate', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cycles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReviewCycle));
      setLastCycles(cycles);
      
      const activeOrVoting = cycles.find(c => c.status === 'active' || c.status === 'voting');
      setCurrentCycle(activeOrVoting || cycles[0] || null);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!currentCycle?.id || !user) return;

    // Check if I've voted
    const q = query(
      collection(db, 'ballots'), 
      where('cycleId', '==', currentCycle.id),
      where('voterUid', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setMyBallot({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Ballot);
      } else {
        setMyBallot(null);
      }
    });

    return () => unsubscribe();
  }, [currentCycle?.id, user]);

  useEffect(() => {
    if (!currentCycle?.id) {
      setAllBallots([]);
      return;
    }

    // Fetch all ballots for current cycle
    const q = query(collection(db, 'ballots'), where('cycleId', '==', currentCycle.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllBallots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ballot)));
    }, (err) => {
      console.error("Ballots snapshot error:", err);
    });

    return () => unsubscribe();
  }, [currentCycle?.id]);

  const handleStartVoting = async () => {
    if (!currentCycle) {
      // Create first cycle
      await addDoc(collection(db, 'reviewCycles'), {
        startDate: serverTimestamp(),
        endDate: Timestamp.fromDate(addDays(new Date(), APP_CONFIG.CHOPPING_BLOCK_CYCLE_DAYS)),
        status: 'voting',
        threshold: threshold,
        remindersSent: []
      });
    } else {
      await updateDoc(doc(db, 'reviewCycles', currentCycle.id!), {
        status: 'voting',
        threshold: threshold
      });
    }
  };

  const handleUpdateCycle = async () => {
    if (!currentCycle?.id) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'reviewCycles', currentCycle.id), {
        startDate: Timestamp.fromDate(new Date(editCycle.startDate)),
        endDate: Timestamp.fromDate(new Date(editCycle.endDate)),
        status: editCycle.status,
        threshold: editCycle.threshold
      });
      setIsManageModalOpen(false);
    } catch (err) {
      console.error("Failed to update cycle:", err);
      addToast("Failed to update cycle. Check permissions.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCycle = async () => {
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'reviewCycles'), {
        startDate: Timestamp.fromDate(new Date(editCycle.startDate)),
        endDate: Timestamp.fromDate(new Date(editCycle.endDate)),
        status: editCycle.status,
        threshold: editCycle.threshold,
        remindersSent: []
      });
      setIsManageModalOpen(false);
    } catch (err) {
      console.error("Failed to create cycle:", err);
      addToast("Failed to create cycle. Check permissions.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCycle = async () => {
    if (!currentCycle?.id) return;
    
    showModal({
      title: "Delete Cycle",
      message: "Are you sure you want to delete this cycle? This will NOT delete ballots, but the cycle will be gone.",
      type: "alert",
      confirmLabel: "Delete",
      onConfirm: async () => {
        setIsSubmitting(true);
        try {
          await deleteDoc(doc(db, 'reviewCycles', currentCycle.id!));
          setIsManageModalOpen(false);
          addToast("Cycle deleted successfully", "success");
        } catch (err) {
          console.error("Failed to delete cycle:", err);
          addToast("Failed to delete cycle", "error");
        } finally {
          setIsSubmitting(false);
          closeModal();
        }
      }
    });
  };

  const openManageModal = () => {
    if (currentCycle) {
      const start = currentCycle.startDate instanceof Timestamp ? currentCycle.startDate.toDate() : new Date(currentCycle.startDate);
      const end = currentCycle.endDate instanceof Timestamp ? currentCycle.endDate.toDate() : new Date(currentCycle.endDate);
      setEditCycle({
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
        status: currentCycle.status,
        threshold: currentCycle.threshold
      });
    } else {
      setEditCycle({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(addDays(new Date(), APP_CONFIG.CHOPPING_BLOCK_CYCLE_DAYS), 'yyyy-MM-dd'),
        status: 'active',
        threshold: APP_CONFIG.CHOPPING_BLOCK_THRESHOLD
      });
    }
    setIsManageModalOpen(true);
  };

  const handleSubmitBallot = async () => {
    if (!currentCycle?.id || !user) return;
    
    // Validate all other founders are scored
    const scoredUids = Object.keys(scores);
    if (scoredUids.length !== otherFounders.length) {
      addToast("Please score all other founders.", "warning");
      return;
    }

    // Validate reasons are provided
    if (scoredUids.some(uid => !scores[uid].reason.trim())) {
      addToast("Please provide a reason for each score.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'ballots'), {
        cycleId: currentCycle.id,
        voterUid: user.uid,
        scores: otherFounders.map(f => ({
          targetUid: f.uid,
          score: scores[f.uid].score,
          reason: scores[f.uid].reason
        })),
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to submit ballot:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveCycle = async () => {
    if (!currentCycle?.id) return;

    const resolveAction = async () => {
      // Calculate scores
      const totalScores: { [uid: string]: number } = {};
      const voterCounts: { [uid: string]: number } = {};
      founders.forEach(f => {
        totalScores[f.uid] = 0;
        voterCounts[f.uid] = 0;
      });

      allBallots.forEach(b => {
        b.scores.forEach(s => {
          if (totalScores[s.targetUid] !== undefined) {
            totalScores[s.targetUid] += s.score;
            voterCounts[s.targetUid] += 1;
          }
        });
      });

      // Average scores
      const avgScores: { [uid: string]: number } = {};
      const underperformerUids: string[] = [];
      
      Object.keys(totalScores).forEach(uid => {
        const avg = voterCounts[uid] > 0 ? totalScores[uid] / voterCounts[uid] : APP_CONFIG.SCORE_DEFAULT; // Default to configured default if no votes (safe)
        avgScores[uid] = avg;
        
        if (avg < threshold) {
          underperformerUids.push(uid);
        }
      });

      await updateDoc(doc(db, 'reviewCycles', currentCycle.id!), {
        status: 'completed',
        underperformerUids,
        results: avgScores,
        endDate: serverTimestamp()
      });

      // Create next cycle
      await addDoc(collection(db, 'reviewCycles'), {
        startDate: serverTimestamp(),
        endDate: Timestamp.fromDate(addDays(new Date(), APP_CONFIG.CHOPPING_BLOCK_CYCLE_DAYS)),
        status: 'active',
        threshold: threshold
      });
      
      addToast("Cycle resolved successfully", "success");
      closeModal();
    };

    if (allBallots.length < founders.length) {
      showModal({
        title: "Resolve Cycle",
        message: `Only ${allBallots.length}/${founders.length} founders have voted. Resolve anyway?`,
        type: "warning",
        confirmLabel: "Resolve Anyway",
        onConfirm: resolveAction
      });
    } else {
      resolveAction();
    }
  };

  const handleResetGovernance = async () => {
    showModal({
      title: "Reset Governance",
      message: "Are you sure you want to reset all governance data? This will delete all cycles and ballots.",
      type: "alert",
      confirmLabel: "Reset All",
      onConfirm: async () => {
        setIsSubmitting(true);
        try {
          const cyclesSnap = await getDocs(collection(db, 'reviewCycles'));
          const ballotsSnap = await getDocs(collection(db, 'ballots'));
          
          const batch = writeBatch(db);
          cyclesSnap.docs.forEach(d => batch.delete(d.ref));
          ballotsSnap.docs.forEach(d => batch.delete(d.ref));
          
          await batch.commit();
          addToast("Governance data reset successfully.", "success");
        } catch (err) {
          console.error("Failed to reset governance:", err);
          addToast("Failed to reset governance", "error");
        } finally {
          setIsSubmitting(false);
          closeModal();
        }
      }
    });
  };

  const getFounderStatus = (uid: string) => {
    const completedCycles = lastCycles.filter(c => c.status === 'completed');
    if (completedCycles.length === 0) return 'safe';

    const lastCycle = completedCycles[0];
    const prevCycle = completedCycles[1];

    const wasUnderLast = lastCycle.underperformerUids?.includes(uid);
    const wasUnderPrev = prevCycle ? prevCycle.underperformerUids?.includes(uid) : false;

    if (wasUnderLast && wasUnderPrev) return 'penalty';
    if (wasUnderLast) return 'warning';
    return 'safe';
  };

  const allVoted = allBallots.length === founders.length;

  if (profile?.role !== 'founder' && profile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Lock size={48} className="text-gray-200 mb-4" />
        <h3 className="text-xl font-bold text-gray-900">Restricted Access</h3>
        <p className="text-sm text-gray-500 max-w-md mt-2">
          The Chopping Block is a private governance system reserved for {APP_CONFIG.BRAND_NAME.split(' ')[0]} founders.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-gray-900">{APP_CONFIG.BRAND_NAME.split(' ')[0]} Chopping Block</h3>
          <p className="text-sm text-gray-500 mt-1">Founder performance governance & secret ballot.</p>
        </div>
        <div className="flex items-center gap-3">
          {profile?.role === 'admin' && (
            <button 
              onClick={openManageModal}
              className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-200 transition-all flex items-center gap-2"
            >
              <Shield size={18} />
              Manage Cycle
            </button>
          )}
          {profile?.role === 'admin' && currentCycle?.status === 'active' && (
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Failure Threshold</label>
                <input 
                  type="number" 
                  step="0.1" 
                  min="0" 
                  max="10"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <button 
                onClick={handleStartVoting}
                className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2"
              >
                <Vote size={18} />
                Start Voting Window
              </button>
            </div>
          )}
          {profile?.role === 'admin' && currentCycle?.status === 'voting' && (
            <button 
              onClick={handleResolveCycle}
              className="rounded-xl bg-black px-6 py-3 text-sm font-bold text-white hover:bg-gray-900 transition-all shadow-lg flex items-center gap-2"
            >
              <CheckCircle2 size={18} />
              Resolve Cycle
            </button>
          )}
        </div>
      </div>

      {/* Admin Management Modal */}
      <AnimatePresence>
        {isManageModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">
                  {currentCycle ? 'Modify Cycle' : 'Schedule New Cycle'}
                </h3>
                <button onClick={() => setIsManageModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <Lock size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Start Date</label>
                  <input 
                    type="date" 
                    value={editCycle.startDate}
                    onChange={(e) => setEditCycle(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">End Date</label>
                  <input 
                    type="date" 
                    value={editCycle.endDate}
                    onChange={(e) => setEditCycle(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Status</label>
                  <select 
                    value={editCycle.status}
                    onChange={(e) => setEditCycle(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
                  >
                    <option value="active">Active (Preparation)</option>
                    <option value="voting">Voting (Ballot Open)</option>
                    <option value="completed">Completed (Results Final)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Failure Threshold (0-10)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    max="10"
                    value={editCycle.threshold}
                    onChange={(e) => setEditCycle(prev => ({ ...prev, threshold: parseFloat(e.target.value) }))}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button 
                  onClick={currentCycle ? handleUpdateCycle : handleCreateCycle}
                  disabled={isSubmitting}
                  className="w-full rounded-2xl bg-orange-500 py-4 text-sm font-bold text-white hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
                >
                  {isSubmitting ? 'Processing...' : currentCycle ? 'Update Cycle' : 'Create Cycle'}
                </button>
                {currentCycle && (
                  <button 
                    onClick={handleDeleteCycle}
                    disabled={isSubmitting}
                    className="w-full rounded-2xl bg-red-50 py-4 text-sm font-bold text-red-600 hover:bg-red-100 transition-all"
                  >
                    Delete Cycle
                  </button>
                )}
                <button 
                  onClick={() => setIsManageModalOpen(false)}
                  className="w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Status Board */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {founders.map(founder => {
          const status = getFounderStatus(founder.uid);
          return (
            <div key={founder.uid} className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold overflow-hidden border-2 border-white shadow-md">
                  {founder.photoURL ? (
                    <img src={founder.photoURL} alt={founder.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    founder.name[0]
                  )}
                </div>
                <div className={cn(
                  "absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-white flex items-center justify-center shadow-sm",
                  status === 'safe' ? "bg-green-500" : status === 'warning' ? "bg-yellow-500" : "bg-red-500"
                )}>
                  {status === 'safe' ? <Shield size={12} className="text-white" /> : 
                   status === 'warning' ? <AlertTriangle size={12} className="text-white" /> : 
                   <Skull size={12} className="text-white" />}
                </div>
              </div>
              <h4 className="text-sm font-bold text-gray-900">{founder.name}</h4>
              <p className={cn(
                "text-[10px] font-bold uppercase tracking-widest mt-1",
                status === 'safe' ? "text-green-500" : status === 'warning' ? "text-yellow-500" : "text-red-500"
              )}>
                {status === 'safe' ? "Safe" : status === 'warning' ? "On Chopping Block" : "Penalty Triggered"}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Voting Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Developer Testing Tools (Admin Only) */}
          {import.meta.env.VITE_DEV_MODE === 'true' && profile?.role === 'admin' && (
            <div className="rounded-3xl bg-orange-50 p-8 border border-orange-200 border-dashed">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-orange-500 flex items-center justify-center text-white">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-orange-900">Developer Testing Tools</h4>
                  <p className="text-xs text-orange-700">Use these to test the governance logic without waiting 2 weeks.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={handleStartVoting}
                  className="px-4 py-2 rounded-xl bg-white border border-orange-200 text-xs font-bold text-orange-700 hover:bg-orange-100 transition-all"
                >
                  1. Force Start Voting
                </button>
                <button 
                  onClick={handleResolveCycle}
                  className="px-4 py-2 rounded-xl bg-white border border-orange-200 text-xs font-bold text-orange-700 hover:bg-orange-100 transition-all"
                >
                  2. Force Resolve Cycle
                </button>
                <button 
                  onClick={handleResetGovernance}
                  className="px-4 py-2 rounded-xl bg-red-500 text-xs font-bold text-white hover:bg-red-600 transition-all"
                >
                  Reset All Governance
                </button>
              </div>
            </div>
          )}

          <div className="rounded-3xl bg-white p-8 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-lg font-bold text-gray-900">Secret Ballot</h4>
                <p className="text-xs text-gray-500 mt-1">Score your fellow founders (0-10) based on their outcomes this cycle.</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500">
                <Vote size={24} />
              </div>
            </div>

            {currentCycle?.status !== 'voting' ? (
              <div className="py-12 text-center">
                <Lock size={32} className="mx-auto text-gray-200 mb-4" />
                <p className="text-sm text-gray-400 italic">Voting is currently closed for this cycle.</p>
              </div>
            ) : myBallot ? (
              <div className="py-12 text-center bg-green-50 rounded-2xl border border-green-100">
                <CheckCircle2 size={32} className="mx-auto text-green-500 mb-4" />
                <h5 className="text-lg font-bold text-green-900">Ballot Cast Successfully</h5>
                <p className="text-sm text-green-600 mt-1">Your anonymous vote has been recorded.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {otherFounders.map(f => (
                  <div key={f.uid} className="p-6 rounded-2xl bg-gray-50 border border-gray-100 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center font-bold text-gray-400 border border-gray-200">
                        {f.name[0]}
                      </div>
                      <div className="flex-1">
                        <h5 className="text-sm font-bold text-gray-900">{f.name}</h5>
                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Co-Founder</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Score (0-10)</span>
                          <input 
                            type="number" 
                            step="0.1" 
                            min="0" 
                            max="10"
                            value={scores[f.uid]?.score || ''}
                            onChange={(e) => setScores(prev => ({ ...prev, [f.uid]: { ...prev[f.uid], score: parseFloat(e.target.value) } }))}
                            className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                          />
                        </div>
                      </div>
                    </div>
                    <textarea 
                      placeholder={`Why this score for ${f.name.split(' ')[0]}? (Required)`}
                      value={scores[f.uid]?.reason || ''}
                      onChange={(e) => setScores(prev => ({ ...prev, [f.uid]: { ...prev[f.uid], reason: e.target.value } }))}
                      rows={2}
                      className="w-full rounded-xl bg-white border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                    />
                  </div>
                ))}
                <button 
                  onClick={handleSubmitBallot}
                  disabled={isSubmitting}
                  className="w-full rounded-2xl bg-black py-4 text-sm font-bold text-white hover:bg-gray-900 transition-all shadow-xl flex items-center justify-center gap-2"
                >
                  {isSubmitting ? "Submitting..." : "Cast Secret Ballot"}
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Anonymized Reasons (Shown after cycle completion OR when all votes are in) */}
          {(currentCycle?.status === 'completed' || allVoted) && allBallots.length > 0 && (
            <div className="rounded-3xl bg-white p-8 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-bold text-gray-900">Cycle Feedback (Anonymized)</h4>
                {allVoted && currentCycle?.status === 'voting' && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-[10px] font-bold text-green-600 uppercase tracking-widest">
                    All Votes In - Previewing Results
                  </span>
                )}
              </div>
              <div className="space-y-6">
                {founders.map(f => {
                  const founderBallots = allBallots.flatMap(b => b.scores.filter(s => s.targetUid === f.uid));
                  if (founderBallots.length === 0) return null;
                  
                  const avgScore = founderBallots.reduce((acc, curr) => acc + curr.score, 0) / founderBallots.length;
                  const isFailing = avgScore < threshold;

                  return (
                    <div key={f.uid} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold">
                            {f.name[0]}
                          </div>
                          <h5 className="text-xs font-bold text-gray-900">Feedback for {f.name}</h5>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avg Score:</span>
                          <span className={cn(
                            "text-sm font-black",
                            isFailing ? "text-red-500" : "text-green-500"
                          )}>
                            {avgScore.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {founderBallots.map((s, i) => (
                          <div key={i} className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-gray-400">Score: {s.score}</span>
                            </div>
                            <p className="text-xs text-gray-600 italic leading-relaxed">
                              "{s.reason}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rules & Info */}
        <div className="space-y-6">
          <div className="rounded-3xl bg-black p-8 text-white shadow-xl">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Shield size={20} className="text-orange-500" />
              The Rules
            </h4>
            <ul className="space-y-4 text-xs text-gray-400 leading-relaxed">
              <li className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 font-bold">1</div>
                <p><span className="text-white font-bold">Point-Based Scoring:</span> Founders score each other from 0 to 10 based on outcomes.</p>
              </li>
              <li className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 font-bold">2</div>
                <p><span className="text-white font-bold">The Threshold:</span> Anyone with an average score below <span className="text-orange-400 font-bold">{threshold.toFixed(1)}</span> is an "Underperformer".</p>
              </li>
              <li className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 font-bold">3</div>
                <p><span className="text-white font-bold">Warning:</span> First time underperforming results in a "Chopping Block" warning.</p>
              </li>
              <li className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 font-bold">4</div>
                <p><span className="text-white font-bold">Penalty:</span> Underperforming for 2 consecutive cycles triggers a <span className="text-red-400 font-bold">{APP_CONFIG.CHOPPING_BLOCK_EQUITY_PENALTY}% Equity Dilution</span>.</p>
              </li>
              <li className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 font-bold">5</div>
                <p><span className="text-white font-bold">Redemption:</span> Scoring above the threshold in the next cycle clears the warning.</p>
              </li>
            </ul>
          </div>

          {currentCycle && (
            <div className="rounded-3xl bg-white p-8 shadow-sm border border-gray-100">
              <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-widest">Cycle Progress</h4>
              <div className="space-y-4">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Status</span>
                  <span className={cn(
                    "font-bold uppercase",
                    currentCycle.status === 'active' ? "text-blue-500" :
                    currentCycle.status === 'voting' ? "text-orange-500" : "text-green-500"
                  )}>{currentCycle.status}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Ends On</span>
                  <span className="text-gray-900 font-bold">
                    {currentCycle.endDate instanceof Timestamp ? format(currentCycle.endDate.toDate(), 'MMM d, yyyy') : 'TBD'}
                  </span>
                </div>
                <div className="pt-4">
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-orange-500" style={{ width: currentCycle.status === 'completed' ? '100%' : currentCycle.status === 'voting' ? '75%' : '25%' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
