import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friendName: string;
}

export function VideoCallDialog({ open, onOpenChange, friendName }: VideoCallDialogProps) {
  const { toast } = useToast();
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (open) {
      startCall();
    } else {
      endCall();
    }

    return () => {
      endCall();
    };
  }, [open]);

  const startCall = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setStream(mediaStream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }
      toast({
        title: 'Call started',
        description: `Video call with ${friendName}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not access camera/microphone',
        variant: 'destructive',
      });
    }
  };

  const endCall = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
      }
    }
  };

  const handleEndCall = () => {
    endCall();
    onOpenChange(false);
    toast({
      title: 'Call ended',
      description: 'Video call has been disconnected',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Video Call with {friendName}</DialogTitle>
        </DialogHeader>

        <div className="relative flex-1 bg-gray-900">
          {/* Local video */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {!isVideoOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center text-white">
                <VideoOff className="h-16 w-16 mx-auto mb-2 opacity-50" />
                <p>Video is off</p>
              </div>
            </div>
          )}

          {/* Remote video placeholder */}
          <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg">
            <div className="w-full h-full flex items-center justify-center text-white">
              <div className="text-center">
                <div className="w-12 h-12 bg-[#2ec2b3] rounded-full flex items-center justify-center mx-auto mb-2">
                  {friendName[0]}
                </div>
                <p className="text-xs">Connecting...</p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4">
            <Button
              size="lg"
              variant={isVideoOn ? 'secondary' : 'destructive'}
              onClick={toggleVideo}
              className="rounded-full w-14 h-14"
            >
              {isVideoOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </Button>
            <Button
              size="lg"
              variant={isAudioOn ? 'secondary' : 'destructive'}
              onClick={toggleAudio}
              className="rounded-full w-14 h-14"
            >
              {isAudioOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </Button>
            <Button
              size="lg"
              variant="destructive"
              onClick={handleEndCall}
              className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}