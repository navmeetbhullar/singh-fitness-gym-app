import React, { useState } from "react";
import { GymNotification } from "../types";
import { Bell, CheckCheck, Trash2, ShieldAlert, Sparkles, AlertTriangle, Info, MessageSquare } from "lucide-react";

interface NotificationCenterProps {
  notifications: GymNotification[];
  isAdmin: boolean;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onToggleRead: (id: string) => void;
}

export default function NotificationCenter({
  notifications,
  isAdmin,
  onMarkAllRead,
  onClearAll,
  onToggleRead
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Filter notifications relevant to active role (Admin gets forAdmin, Member gets general)
  const filteredNotifs = notifications.filter(n => {
    if (isAdmin) {
      return n.forAdmin === true;
    } else {
      return !n.forAdmin;
    }
  });

  const unreadCount = filteredNotifs.filter(n => !n.read).length;

  return (
    <div className="relative">
      {/* Trigger Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all rounded-xl flex items-center justify-center relative cursor-pointer"
        title="Notifications Feed"
      >
        <Bell size={18} className={`${unreadCount > 0 ? "text-yellow-400 animate-swing" : "text-white/80"}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 text-black font-black text-[10px] rounded-full flex items-center justify-center border-2 border-[#050505] shadow-[0_0_10px_rgba(250,204,21,0.5)]">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Backdrop for click away close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-transparent cursor-default" 
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Dropdown Card (Apple Liquid Glass frosted style) */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 md:w-96 bg-neutral-950/95 border border-white/10 backdrop-blur-2xl rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden z-50 animate-fadeIn origin-top-right">
          
          {/* Dropdown Header */}
          <div className="p-4 bg-white/[0.03] border-b border-white/[0.05] flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-white/40 tracking-wider">
                Notifications Center ({filteredNotifs.length})
              </span>
              {unreadCount > 0 && (
                <span className="bg-yellow-400/20 text-yellow-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                  {unreadCount} New
                </span>
              )}
            </div>
            <div className="flex gap-2.5">
              {filteredNotifs.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      onMarkAllRead();
                    }}
                    className="text-[10px] font-bold uppercase text-yellow-400 hover:underline flex items-center gap-1 bg-transparent cursor-pointer"
                    title="Mark all as read"
                  >
                    <CheckCheck size={12} />
                    All Read
                  </button>
                  <button
                    onClick={() => {
                      onClearAll();
                    }}
                    className="text-[10px] font-bold uppercase text-red-400 hover:underline flex items-center gap-1 bg-transparent cursor-pointer ml-1"
                    title="Clear all"
                  >
                    <Trash2 size={11} />
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Notifications Scroll List */}
          <div className="max-h-[350px] overflow-y-auto custom-scrollbar divide-y divide-white/[0.03]">
            {filteredNotifs.length > 0 ? (
              filteredNotifs.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => onToggleRead(notif.id)}
                  className={`p-4 transition-colors cursor-pointer text-left flex gap-3.5 ${
                    notif.read ? "bg-transparent opacity-60" : "bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  {/* Visual Icons based on notification type */}
                  <div className="shrink-0 mt-0.5">
                    {notif.type === "warning" && (
                      <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/25 flex items-center justify-center text-orange-400">
                        <AlertTriangle size={15} />
                      </div>
                    )}
                    {notif.type === "success" && (
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/25 flex items-center justify-center text-green-400">
                        <Sparkles size={15} />
                      </div>
                    )}
                    {notif.type === "motivational" && (
                      <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center text-yellow-400">
                        <MessageSquare size={15} />
                      </div>
                    )}
                    {notif.type === "admin_alert" && (
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400">
                        <ShieldAlert size={15} />
                      </div>
                    )}
                    {notif.type === "info" && (
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
                        <Info size={15} />
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h4 className={`text-xs font-bold truncate ${notif.read ? "text-white/70" : "text-white"}`}>
                        {notif.title}
                      </h4>
                      <span className="text-[9px] font-mono text-white/40 shrink-0 ml-2">{notif.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-white/60 leading-relaxed mb-2">
                      {notif.message}
                    </p>
                    
                    {/* Read indicator dots */}
                    {!notif.read && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-white/30 text-xs flex flex-col items-center justify-center gap-2">
                <Bell size={24} className="text-white/10" />
                <span>No active alerts or notices.</span>
              </div>
            )}
          </div>

          {/* Footer block */}
          <div className="p-3.5 bg-white/[0.01] border-t border-white/[0.05] text-center">
            <span className="text-[9px] font-mono tracking-widest text-white/30 uppercase">
              Singh Fitness Gym Security Rules Active
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
