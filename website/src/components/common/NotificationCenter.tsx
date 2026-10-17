import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, X, ExternalLink, Info, TrendingUp, Truck, CreditCard } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import { cn } from '../../lib/utils';

export const NotificationCenter: React.FC = () => {
  const { notifications, isOpen, setIsOpen, markAsRead, markAllRead } = useNotificationStore();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'trade':
        return <TrendingUp className="w-4 h-4 text-emerald-600" />;
      case 'transport':
        return <Truck className="w-4 h-4 text-sky-600" />;
      case 'payment':
        return <CreditCard className="w-4 h-4 text-amber-600" />;
      default:
        return <Info className="w-4 h-4 text-indigo-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      {/* Slide-out Panel */}
      <div className="relative w-full sm:w-96 bg-white h-full shadow-2xl border-l border-slate-200 z-10 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-slate-900 text-sm">Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllRead}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 hover:underline"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No new notifications. Everything is up to date!
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  markAsRead(n.id);
                  if (n.link) {
                    navigate(n.link);
                    setIsOpen(false);
                  }
                }}
                className={cn(
                  'p-4 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 text-left',
                  !n.read && 'bg-emerald-50/40'
                )}
              >
                <div className="mt-0.5 p-2 rounded-xl bg-slate-100 flex-shrink-0 self-start">
                  {getIcon(n.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <h5 className={cn('text-xs font-bold text-slate-900', !n.read && 'text-emerald-950')}>
                      {n.title}
                    </h5>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-emerald-600 flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.body}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">{n.createdAt}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
