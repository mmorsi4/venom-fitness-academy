import React, { useRef, useState, useCallback, useEffect } from "react";
import { Camera, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraCaptureProps {
  onCapture: (blob: Blob, dataUrl: string) => void;
  onCancel: () => void;
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let isActive = true;

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        
        if (!isActive) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        if (isActive) {
          setError("Could not access camera. Please ensure permissions are granted.");
          console.error("Camera error:", err);
        }
      }
    };

    startCamera();

    return () => {
      isActive = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Ensure srcObject is maintained if component re-renders
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  });

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn("Video not ready yet");
      return;
    }

    const canvas = document.createElement("canvas");
    
    // Target size is 200x200
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Crop to square from the center safely
    const size = Math.floor(Math.min(video.videoWidth, video.videoHeight));
    const startX = Math.floor((video.videoWidth - size) / 2);
    const startY = Math.floor((video.videoHeight - size) / 2);

    // Fill white background for JPEG safety
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 200, 200);

    ctx.drawImage(video, startX, startY, size, size, 0, 0, 200, 200);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          stopCamera();
          onCapture(blob, dataUrl);
        }
      },
      "image/jpeg",
      0.85
    );
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  return (
    <div className="relative flex flex-col items-center bg-black rounded-lg overflow-hidden max-w-sm mx-auto">
      {error ? (
        <div className="p-8 text-center text-red-400">
          <p>{error}</p>
          <Button variant="outline" className="mt-4 text-black" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onCanPlay={(e) => {
              e.currentTarget.play().catch(err => console.error("Play error:", err));
            }}
            className="w-full aspect-square object-cover"
          />
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-center gap-4">
            <Button variant="destructive" size="icon" className="rounded-full h-12 w-12" onClick={handleCancel}>
              <X className="w-5 h-5" />
            </Button>
            <Button variant="default" size="icon" className="rounded-full h-12 w-12 bg-white text-black hover:bg-gray-200" onClick={capturePhoto}>
              <Camera className="w-6 h-6" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
