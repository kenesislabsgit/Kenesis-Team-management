import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';

import { APP_CONFIG } from '../constants';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  onClose: (id: string) => void;
}

export const Toast = ({ id, message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, APP_CONFIG.TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const icons = {
    success: <CheckCircle2 className="text-green-500" size={20} />,
    error: <XCircle className="text-red-500" size={20} />,
    info: <Info className="text-blue-500" size={20} />,
    warning: <AlertCircle className="text-yellow-500" size={20} />,
  };

  const colors = {
    success: "bg-green-50 border-green-100",
    error: "bg-red-50 border-red-100",
    info: "bg-blue-50 border-blue-100",
    warning: "bg-yellow-50 border-yellow-100",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-4 shadow-xl min-w-[300px] max-w-md",
        colors[type]
      )}
    >
      <div className="shrink-0">{icons[type]}</div>
      <p className="flex-1 text-sm font-medium text-gray-800">{message}</p>
      <button 
        onClick={() => onClose(id)}
        className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600 transition-colors"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
};

export const ToastContainer = ({ toasts, onClose }: { toasts: any[], onClose: (id: string) => void }) => (
  <div className="fixed bottom-8 right-8 z-[200] flex flex-col gap-3">
    <AnimatePresence>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </AnimatePresence>
  </div>
);
