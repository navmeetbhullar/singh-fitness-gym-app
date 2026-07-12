import React, { useState } from "react";
import { Member } from "../types";
import { 
  Copy, 
  Check, 
  MessageSquare, 
  Phone, 
  Users, 
  Clock, 
  Sparkles,
  Award,
  Dumbbell,
  LogOut
} from "lucide-react";

interface BoardingPassProps {
  member: Member;
  onCopyReferral: (code: string) => void;
  onSignOut?: () => void;
}

export default function BoardingPass({ 
  member, 
  onCopyReferral,
  onSignOut
}: BoardingPassProps) {
  const [copied, setCopied] = useState(false);
  const referralCode = `SINGH_FITNESS${member.name.toUpperCase().replace(/\s+/g, "").slice(0, 6)}${member.memberId.split("-").pop()}`;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(referralCode);
      } else {
        // Fallback for older iOS Safari / non-HTTPS contexts
        const textarea = document.createElement("textarea");
        textarea.value = referralCode;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      onCopyReferral(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Still call parent so at least the toast shows the code
      onCopyReferral(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto">
      
      {/* Boarding Pass (Apple Liquid Glass Style Wallet Pass) */}
      <div className="col-span-1 lg:col-span-7 flex flex-col items-center">
        <h3 className="text-sm font-black uppercase text-white/40 tracking-widest mb-4 self-start">
          Digital Boarding Pass
        </h3>
        
        {/* Pass card */}
        <div className="w-full max-w-md bg-white/[0.02] border border-white/[0.08] rounded-[32px] overflow-hidden backdrop-blur-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] relative group">
          {/* Top gloss reflection highlight */}
          <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-t-[32px]"></div>
          
          {/* Background subtle glowing circles */}
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          {/* Header section of Pass */}
          <div className="p-6 bg-white/[0.03] border-b border-white/[0.05] flex justify-between items-center relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                <Dumbbell className="text-yellow-400 w-5 h-5 rotate-45" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-white leading-none">Singh Fitness Fitness</h4>
                <span className="text-[9px] text-yellow-400 font-bold uppercase tracking-widest">Premium Member</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-white/40 uppercase tracking-widest font-black">Gate Tier</p>
              <p className="text-xs font-mono font-bold text-white uppercase tracking-wider">Platinum Elite</p>
            </div>
          </div>

          {/* Main pass body */}
          <div className="p-6 space-y-6 relative z-10">
            {/* Passenger / Member Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Member Name</span>
                <span className="text-base font-black text-white truncate block">{member.name}</span>
              </div>
              <div>
                <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Member ID</span>
                <span className="text-sm font-mono font-bold text-yellow-400 block">{member.memberId}</span>
              </div>
            </div>

            {/* Shift & Goals Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Preferred Shift</span>
                <span className="text-sm font-bold text-white flex items-center gap-1 mt-0.5">
                  <Clock size={13} className="text-yellow-400" />
                  {member.preferredShift}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Fitness Goal</span>
                <span className="text-sm font-bold text-yellow-400/95 truncate block">{member.goals}</span>
              </div>
            </div>

            {/* Dates Row */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/[0.04]">
              <div>
                <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Join Date</span>
                <span className="text-xs font-mono font-medium text-white/80">{member.joinedDate || "N/A"}</span>
              </div>
              <div>
                <span className="text-[9px] text-white/40 uppercase tracking-widest font-black block">Expiry Date</span>
                <span className={`text-xs font-mono font-bold ${member.status === "Expiring Soon" ? "text-orange-400" : "text-white/85"}`}>
                  {member.expiryDate || "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Referrals & Support Contacts */}
      <div className="col-span-1 lg:col-span-5 flex flex-col gap-6">
        
        {/* Referral Card */}
        <div className="bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/5 rounded-bl-full pointer-events-none"></div>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-yellow-400/10 rounded-xl flex items-center justify-center">
              <Users size={16} className="text-yellow-400" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase text-white leading-tight">Refer & Earn</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Invite friends, get free weeks!</p>
            </div>
          </div>

          <p className="text-xs text-white/70 mb-5 leading-relaxed">
            Share your unique referral link. For every friend who signs up and gets approved, you receive <span className="text-yellow-400 font-bold">100 bonus Points</span> and a free week of membership extension!
          </p>

          <div className="space-y-4">
            {/* Clipboard code block */}
            <div className="flex items-center justify-between bg-black/40 border border-white/5 rounded-2xl p-3">
              <div>
                <span className="text-[8px] text-white/40 uppercase tracking-widest font-bold block">Your Referral Code</span>
                <span className="text-sm font-mono font-bold text-white">{referralCode}</span>
              </div>
              <button
                onClick={handleCopy}
                className="p-2.5 bg-white/5 hover:bg-white/10 active:scale-95 transition-all rounded-xl text-yellow-400 border border-white/5 flex items-center gap-1 text-xs"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                <span className="font-bold">{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            {/* Referrals statistics */}
            <div className="flex justify-between items-center p-3.5 bg-white/5 border border-white/5 rounded-2xl">
              <div>
                <span className="text-xs font-bold text-white block">Successful Referrals</span>
                <span className="text-[10px] text-white/40">Approved premium memberships</span>
              </div>
              <span className="text-yellow-400 font-black text-xl flex items-center gap-1.5 bg-yellow-400/10 px-3 py-1 rounded-xl">
                {member.referrals} Joined
              </span>
            </div>
          </div>
        </div>

        {/* Trainer Support Card */}
        <div className="bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl rounded-3xl p-6 shadow-2xl relative">
          
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-base font-black uppercase text-white leading-tight">Assigned Trainer</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">1-on-1 coaching assistance</p>
            </div>
            <span className="text-[10px] bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full font-bold uppercase">
              Support Online
            </span>
          </div>

          <div className="flex items-center gap-4 p-3 bg-white/5 rounded-2xl border border-white/5 mb-4">
            <div className="w-12 h-12 rounded-xl bg-neutral-800 flex items-center justify-center text-base font-bold text-yellow-400 border border-white/10 shrink-0 shadow-[0_0_10px_rgba(250,204,21,0.1)]">
              {member.trainerName.split(" ").pop()?.[0] || "C"}
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">{member.trainerName}</h4>
              <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-wide">Head Coach & Dietician</p>
              <p className="text-[9px] text-white/40">{member.trainerPhone || "Not Configured"}</p>
            </div>
          </div>

          <p className="text-xs text-white/50 mb-5 leading-relaxed">
            Need guidance regarding safety protocols, posture correction, diet variations, or shift timings? Reach out directly via phone or mock message.
          </p>

          <div className="grid grid-cols-2 gap-3.5">
            <a 
              href={`tel:${member.trainerPhone?.replace(/[^0-9+]/g, "") || "+919999988888"}`}
              className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-center text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Phone size={13} className="text-yellow-400" />
              Direct Call
            </a>
            <a 
              href={`https://wa.me/${member.trainerPhone?.replace(/[^0-9]/g, "") || "919999988888"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/20 rounded-xl text-center text-xs font-bold text-yellow-400 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <MessageSquare size={13} className="text-yellow-400" />
              WhatsApp Message
            </a>
          </div>

        </div>

        {/* Sign Out Section */}
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 active:scale-[0.99] border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-[24px] text-center text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg shadow-red-500/5"
          >
            <LogOut size={14} />
            Sign Out of Account
          </button>
        )}

      </div>

    </div>
  );
}
