import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, CheckCircle2, Info, HelpCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export type ModalType = 'confirm' | 'alert' | 'info' | 'warning';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: ModalType;
  confirmLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
}

export const Modal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  type = 'info', 
  confirmLabel = 'Confirm', 
  cancelLabel = 'Cancel',
  isSubmitting = false
}: ModalProps) => {
  const icons = {
    confirm: <HelpCircle className="text-blue-500" size={32} />,
    alert: <AlertTriangle className="text-red-500" size={32} />,
    info: <Info className="text-blue-500" size={32} />,
    warning: <AlertTriangle className="text-yellow-500" size={32} />,
  };

  const colors = {
    confirm: "bg-blue-50",
    alert: "bg-red-50",
    info: "bg-blue-50",
    warning: "bg-yellow-50",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className={cn("flex items-center justify-center py-8", colors[type])}>
              {icons[type]}
            </div>
            <div className="p-8 text-center">
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
              
              <div className="mt-8 flex flex-col gap-3">
                {onConfirm && (
                  <button
                    onClick={onConfirm}
                    disabled={isSubmitting}
                    className={cn(
                      "w-full rounded-2xl py-4 text-sm font-bold text-white transition-all shadow-lg",
                      type === 'alert' ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" : "bg-black hover:bg-gray-900 shadow-black/10",
                      isSubmitting && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isSubmitting ? 'Processing...' : confirmLabel}
                  </button>
                )}
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="w-full rounded-2xl bg-gray-100 py-4 text-sm font-bold text-gray-600 hover:bg-gray-200 transition-all"
                >
                  {onConfirm ? cancelLabel : 'Close'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
