import React, { useState, useEffect } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, Shield } from 'lucide-react';

interface WebrtcCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callerName: string;
  callerRole: string;
  callType?: 'audio' | 'video';
}

export const WebrtcCallModal: React.FC<WebrtcCallModalProps> = ({
  isOpen,
  onClose,
  callerName,
  callerRole,
  callType = 'video',
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === 'video');
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen) {
      setCallDuration(0);
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col items-center">
        {/* Call Banner */}
        <div className="w-full p-4 flex items-center justify-between border-b border-slate-800/80 text-white">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <Shield className="w-3.5 h-3.5" /> End-to-End Encrypted WebRTC Call
          </div>
          <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded-md text-slate-300">
            {formatTimer(callDuration)}
          </span>
        </div>

        {/* Video / Avatar Canvas */}
        <div className="relative w-full h-80 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-6">
          {isVideoOn ? (
            <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-800">
              <img
                src="https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80"
                alt="Caller video stream"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg text-white text-xs">
                {callerName} ({callerRole})
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-emerald-600/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 text-3xl font-bold mb-4 shadow-lg shadow-emerald-500/20 animate-pulse">
                {callerName.charAt(0)}
              </div>
              <h3 className="text-xl font-bold text-white">{callerName}</h3>
              <p className="text-xs text-slate-400 mt-1 capitalize">{callerRole} • Connected</p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="w-full p-6 bg-slate-950/60 flex items-center justify-center gap-5 border-t border-slate-800">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-4 rounded-full transition-all ${
              isMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500' : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`p-4 rounded-full transition-all ${
              !isVideoOn ? 'bg-rose-500/20 text-rose-400 border border-rose-500' : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title={isVideoOn ? 'Turn Off Video' : 'Turn On Video'}
          >
            {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>

          <button
            onClick={onClose}
            className="p-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 transition-transform active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
