'use client';

import { useEffect, useState, useRef } from 'react';
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  UID,
} from 'agora-rtc-sdk-ng';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users } from 'lucide-react';

interface AgoraVideoRoomProps {
  amaId: string;
  channelName: string;
  token: string;
  appId: string;
  uid: number;
  userRole: 'publisher' | 'subscriber';
  onLeave?: () => void;
}

export function AgoraVideoRoom({
  amaId,
  channelName,
  token,
  appId,
  uid,
  userRole,
  onLeave,
}: AgoraVideoRoomProps) {
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [participants, setParticipants] = useState<number>(1);
  const [remoteUsers, setRemoteUsers] = useState<Map<UID, IAgoraRTCRemoteUser>>(new Map());
  const [isConnecting, setIsConnecting] = useState(true);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const videoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Create Agora client
        const client = AgoraRTC.createClient({
          mode: 'live',
          codec: 'vp8',
        });
        clientRef.current = client;

        await client.setClientRole(userRole === 'publisher' ? 'host' : 'audience');

        // Event listeners
        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType);

          if (mediaType === 'video') {
            setRemoteUsers((prev) => {
              const updated = new Map(prev);
              updated.set(user.uid, user);
              return updated;
            });
          }

          if (mediaType === 'audio') {
            user.audioTrack?.play();
          }

          setParticipants((prev) => prev + 1);
        });

        client.on('user-unpublished', (user, mediaType) => {
          if (mediaType === 'video') {
            setRemoteUsers((prev) => {
              const updated = new Map(prev);
              updated.delete(user.uid);
              return updated;
            });
          }
          setParticipants((prev) => Math.max(1, prev - 1));
        });

        client.on('user-left', (user) => {
          setRemoteUsers((prev) => {
            const updated = new Map(prev);
            updated.delete(user.uid);
            return updated;
          });
          setParticipants((prev) => Math.max(1, prev - 1));
        });

        // Join channel with uid from token
        await client.join(appId, channelName, token, uid);
        setIsJoined(true);

        // Create and publish tracks if publisher
        if (userRole === 'publisher') {
          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
          audioTrackRef.current = audioTrack;
          videoTrackRef.current = videoTrack;

          // Play local video
          if (localVideoRef.current) {
            videoTrack.play(localVideoRef.current);
          }

          await client.publish([audioTrack, videoTrack]);
        }

        setIsConnecting(false);
      } catch (error) {
        console.error('[Agora Video] Error:', error);
        setIsConnecting(false);
      }
    };

    init();

    return () => {
      // Cleanup
      if (audioTrackRef.current) {
        audioTrackRef.current.close();
      }
      if (videoTrackRef.current) {
        videoTrackRef.current.close();
      }
      if (clientRef.current) {
        clientRef.current.leave();
      }
    };
  }, [amaId, channelName, token, appId, userRole]);

  const toggleMute = async () => {
    if (!audioTrackRef.current) return;

    if (isMuted) {
      await audioTrackRef.current.setEnabled(true);
      setIsMuted(false);
    } else {
      await audioTrackRef.current.setEnabled(false);
      setIsMuted(true);
    }
  };

  const toggleVideo = async () => {
    if (!videoTrackRef.current) return;

    if (isVideoOff) {
      await videoTrackRef.current.setEnabled(true);
      setIsVideoOff(false);
    } else {
      await videoTrackRef.current.setEnabled(false);
      setIsVideoOff(true);
    }
  };

  const handleLeave = async () => {
    if (audioTrackRef.current) {
      audioTrackRef.current.close();
    }
    if (videoTrackRef.current) {
      videoTrackRef.current.close();
    }
    if (clientRef.current) {
      await clientRef.current.leave();
    }
    setIsJoined(false);
    onLeave?.();
  };

  if (isConnecting) {
    return (
      <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl border border-purple-500/30 p-8 text-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-purple-500/30 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Video className="w-8 h-8 text-purple-300" />
          </div>
          <p className="text-white font-medium">Connecting to video room...</p>
          <p className="text-gray-400 text-sm mt-2">Please wait</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl border border-purple-500/30 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-white font-medium">Video Room Active</span>
        </div>
        <div className="flex items-center gap-2 text-gray-300">
          <Users className="w-4 h-4" />
          <span className="text-sm">{participants} participants</span>
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Local video (publisher only) */}
        {userRole === 'publisher' && (
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <div ref={localVideoRef} className="w-full h-full" />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <VideoOff className="w-12 h-12 text-gray-500" />
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
              You (Host)
            </div>
          </div>
        )}

        {/* Remote videos */}
        {Array.from(remoteUsers.values()).map((user) => (
          <RemoteVideo key={user.uid} user={user} />
        ))}

        {/* Placeholder if no remote users */}
        {remoteUsers.size === 0 && userRole === 'subscriber' && (
          <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Waiting for host...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {userRole === 'publisher' && (
          <>
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full transition-all ${
                isMuted
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full transition-all ${
                isVideoOff
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
              }`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          </>
        )}

        <button
          onClick={handleLeave}
          className="p-4 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
          title="Leave video room"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>

      {/* Role indicator */}
      <div className="mt-4 text-center">
        <span className="text-xs text-gray-400">
          {userRole === 'publisher' ? 'You are hosting this video AMA' : 'Viewer mode'}
        </span>
      </div>
    </div>
  );
}

// Remote video component
function RemoteVideo({ user }: { user: IAgoraRTCRemoteUser }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user.videoTrack && containerRef.current) {
      user.videoTrack.play(containerRef.current);
    }

    return () => {
      if (user.videoTrack) {
        user.videoTrack.stop();
      }
    };
  }, [user]);

  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
        Participant {user.uid}
      </div>
    </div>
  );
}
