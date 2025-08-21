import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from './ui/button';
import { VideoPlayer } from './VideoPlayer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cameraStore, type Camera } from '../lib/camera-store';
import { 
  Maximize2, 
  Grid3X3, 
  Square, 
  RotateCw, 
  Menu, 
  X, 
  Home, 
  Monitor,
  Sun,
  Moon,
  Minimize2,
  AlertTriangle,
  Wifi,
  WifiOff
} from 'lucide-react';

interface PanelModeProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onExitFullscreen: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

interface CameraStatus {
  [cameraId: string]: {
    status: 'loading' | 'playing' | 'error' | 'stalled';
    lastUpdate: number;
    errorMessage?: string;
  };
}

export function PanelMode({ 
  isFullscreen, 
  onToggleFullscreen, 
  onExitFullscreen,
  isDarkMode,
  onToggleDarkMode 
}: PanelModeProps) {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [twoCamLayout, setTwoCamLayout] = useState<'auto' | 'horizontal' | 'vertical'>('auto');
  const [fiveCamLayout, setFiveCamLayout] = useState<'grid' | 'featured'>('grid');
  const [showControls, setShowControls] = useState(false);
  const [cameraStatuses, setCameraStatuses] = useState<CameraStatus>({});
  const [isVisible, setIsVisible] = useState(true);
  
  // Refs for performance optimization
  const controlsTimeoutRef = useRef<number>();
  const visibilityTimeoutRef = useRef<number>();

  // Memoized active cameras to prevent unnecessary re-renders
  const activeCameras = useMemo(() => 
    cameras.filter(camera => camera.isActive), 
    [cameras]
  );

  // Auto-hide controls in fullscreen after inactivity
  useEffect(() => {
    if (!isFullscreen) return;

    const handleMouseMove = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isFullscreen]);

  // Page visibility API for performance optimization
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Delay before pausing to avoid rapid toggling
        visibilityTimeoutRef.current = window.setTimeout(() => {
          setIsVisible(false);
        }, 5000);
      } else {
        if (visibilityTimeoutRef.current) {
          clearTimeout(visibilityTimeoutRef.current);
        }
        setIsVisible(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, []);

  // Camera store subscription with performance optimization
  useEffect(() => {
    let isSubscribed = true;
    
    const handleCamerasChange = () => {
      if (isSubscribed) {
        setCameras(cameraStore.getCameras());
      }
    };
    
    handleCamerasChange();
    const unsubscribe = cameraStore.subscribe(handleCamerasChange);
    
    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, []);

  // Optimized grid layout calculation
  const getGridLayout = useCallback((count: number, layout: string) => {
    if (count === 0) return '';
    if (count === 1) return 'grid-cols-1 grid-rows-1';
    if (count === 2) {
      return layout === 'vertical' ? 'grid-cols-1 grid-rows-2' : 'grid-cols-2 grid-rows-1';
    }
    if (count === 3) return 'grid-cols-2 grid-rows-2';
    if (count === 4) return 'grid-cols-2 grid-rows-2';
    if (count === 5) {
      return layout === 'featured' ? 'grid-cols-6 grid-rows-3' : 'grid-cols-3 grid-rows-2';
    }
    if (count === 6) {
      return layout === 'featured' ? 'grid-cols-6 grid-rows-3' : 'grid-cols-3 grid-rows-2';
    }
    return 'grid-cols-3 grid-rows-3';
  }, []);

  // Optimized camera style calculation
  const getCameraStyle = useCallback((index: number, total: number, layout: string) => {
    if (total === 1) return '';
    if (total === 3) {
      return index === 0 ? 'col-span-2' : '';
    }
    if (layout === 'featured') {
      if (total === 5) {
        const styles = [
          'col-span-4 row-span-2',
          'col-start-5 row-start-1 col-span-2',
          'col-start-5 row-start-2 col-span-2',
          'col-start-1 row-start-3 col-span-3',
          'col-start-4 row-start-3 col-span-3'
        ];
        return styles[index] || '';
      } else if (total === 6) {
        const styles = [
          'col-span-4 row-span-2',
          'col-start-5 row-start-1 col-span-2',
          'col-start-5 row-start-2 col-span-2',
          'col-start-1 row-start-3 col-span-2',
          'col-start-3 row-start-3 col-span-2',
          'col-start-5 row-start-3 col-span-2'
        ];
        return styles[index] || '';
      }
    }
    return '';
  }, []);

  // Camera status handlers
  const handleCameraStatusChange = useCallback((cameraId: string, status: 'loading' | 'playing' | 'error' | 'stalled') => {
    setCameraStatuses(prev => ({
      ...prev,
      [cameraId]: {
        ...prev[cameraId],
        status,
        lastUpdate: Date.now()
      }
    }));
  }, []);

  const handleCameraError = useCallback((cameraId: string, error: string) => {
    setCameraStatuses(prev => ({
      ...prev,
      [cameraId]: {
        ...prev[cameraId],
        status: 'error',
        errorMessage: error,
        lastUpdate: Date.now()
      }
    }));
  }, []);

  // Enhanced camera status management
  const getCameraStatus = useCallback((cameraId: string) => {
    const camera = cameras.find(c => c.id === cameraId);
    const statusInfo = cameraStatuses[cameraId];
    
    if (!camera) return 'error';
    if (!camera.isActive) return 'inactive';
    if (camera.status === 'offline') return 'offline';
    if (statusInfo?.status === 'error') return 'error';
    if (statusInfo?.status === 'stalled') return 'stalled';
    if (statusInfo?.status === 'playing') return 'playing';
    if (camera.status === 'online') return 'loading';
    
    return 'checking';
  }, [cameras, cameraStatuses]);

  // Optimized camera rendering with status handling
  const renderCamera = useCallback((camera: Camera, index: number, total: number, layout: string) => {
    const status = getCameraStatus(camera.id);
    const isVisible = !isFullscreen || isVisible;
    
    if (!isVisible) return null;

    return (
      <div
        key={camera.id}
        className={`relative bg-black rounded-lg overflow-hidden ${
          getCameraStyle(index, total, layout)
        }`}
      >
        <VideoPlayer
          camera={camera}
          onStatusChange={(status) => handleCameraStatusChange(camera.id, status)}
          onError={(error) => handleCameraError(camera.id, error)}
          autoPlay={camera.isActive}
          muted={true}
          showControls={false}
          className="w-full h-full"
        />
        
        {/* Enhanced status overlay */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            status === 'playing' ? 'bg-green-500 text-white' :
            status === 'loading' ? 'bg-yellow-500 text-white' :
            status === 'error' ? 'bg-red-500 text-white' :
            status === 'stalled' ? 'bg-orange-500 text-white' :
            status === 'offline' ? 'bg-gray-500 text-white' :
            'bg-blue-500 text-white'
          }`}>
            {status === 'playing' ? 'Live' :
             status === 'loading' ? 'Loading...' :
             status === 'error' ? 'Error' :
             status === 'stalled' ? 'Stalled' :
             status === 'offline' ? 'Offline' :
             'Checking...'}
          </div>
          
          {/* Connection quality indicator */}
          {status === 'playing' && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-white">Live</span>
            </div>
          )}
        </div>
        
        {/* Camera name overlay */}
        <div className="absolute bottom-2 left-2">
          <div className="px-2 py-1 rounded bg-black/50 text-white text-sm font-medium">
            {camera.name}
          </div>
        </div>
        
        {/* Error message overlay */}
        {status === 'error' && cameraStatuses[camera.id]?.errorMessage && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75">
            <div className="text-center p-4">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-400 text-sm">{cameraStatuses[camera.id]?.errorMessage}</p>
            </div>
          </div>
        )}
      </div>
    );
  }, [cameras, cameraStatuses, isFullscreen, isVisible, getCameraStatus, handleCameraStatusChange, handleCameraError, getCameraStyle]);

  // Optimized grid rendering
  const renderGrid = useCallback((cameras: Camera[], layout: string) => {
    if (cameras.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <Monitor className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No cameras available</p>
          </div>
        </div>
      );
    }

    const gridClass = getGridLayout(cameras.length, layout);
    
    return (
      <div className={`grid gap-2 ${gridClass}`}>
        {cameras.map((camera, index) => 
          renderCamera(camera, index, cameras.length, layout)
        )}
      </div>
    );
  }, [renderCamera, getGridLayout]);

  // Memoize layout calculation
  const currentLayout = useMemo(() => {
    return getGridLayout(
      activeCameras.length,
      activeCameras.length === 2 ? twoCamLayout :
      (activeCameras.length === 5 || activeCameras.length === 6) ? fiveCamLayout : 'auto'
    );
  }, [activeCameras.length, twoCamLayout, fiveCamLayout, getGridLayout]);

  // Calculate stream health stats
  const streamStats = useMemo(() => {
    const total = activeCameras.length;
    const playing = Object.values(cameraStatuses).filter(s => s.status === 'playing').length;
    const errors = Object.values(cameraStatuses).filter(s => s.status === 'error').length;
    
    return { total, playing, errors };
  }, [activeCameras.length, cameraStatuses]);

  // Full-screen mode rendering
  if (isFullscreen) {
    return (
      <div className="h-screen w-screen bg-black relative overflow-hidden">
        {/* Floating controls toggle */}
        <Button
          onClick={() => setShowControls(!showControls)}
          className="fixed top-4 left-4 z-50 bg-black/70 hover:bg-black/90 border-gray-600 transition-all duration-200"
          size="sm"
          variant="outline"
        >
          {showControls ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>

        {/* Stream health indicator */}
        {streamStats.total > 0 && (
          <div className="fixed top-4 right-4 z-50 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm">
            <div className="flex items-center gap-2">
              <StatusIndicator status={streamStats.errors > 0 ? 'error' : streamStats.playing > 0 ? 'playing' : 'loading'} />
              <span>{streamStats.playing}/{streamStats.total}</span>
            </div>
          </div>
        )}

        {/* Slide-out controls panel */}
        <div className={`fixed top-0 left-0 h-full w-80 bg-background/95 backdrop-blur-md border-r border-border z-40 transform transition-transform duration-300 ${
          showControls ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Monitor className="w-6 h-6 text-primary" />
                <h1 className="text-xl font-semibold">SecureCam</h1>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleDarkMode}
                className="w-9 h-9 p-0"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            </div>

            {/* Panel controls */}
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Panel Mode</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{streamStats.total} active cameras</p>
                  {streamStats.total > 0 && (
                    <p>{streamStats.playing} playing, {streamStats.errors} errors</p>
                  )}
                </div>
              </div>

              {activeCameras.length === 2 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Layout</label>
                  <Select value={twoCamLayout} onValueChange={(value: any) => setTwoCamLayout(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="horizontal">
                        <div className="flex items-center gap-2">
                          <RotateCw className="w-4 h-4 rotate-90" />
                          Horizontal
                        </div>
                      </SelectItem>
                      <SelectItem value="vertical">
                        <div className="flex items-center gap-2">
                          <RotateCw className="w-4 h-4" />
                          Vertical
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(activeCameras.length === 5 || activeCameras.length === 6) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Layout</label>
                  <Select value={fiveCamLayout} onValueChange={(value: any) => setFiveCamLayout(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Grid</SelectItem>
                      <SelectItem value="featured">Featured</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {activeCameras.length > 0 && (
                <Button onClick={handleStopAll} variant="destructive" className="w-full">
                  <Square className="w-4 h-4 mr-2" />
                  Stop All Cameras
                </Button>
              )}
            </div>

            {/* Navigation */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Navigation</h4>
              <div className="space-y-1">
                <Button
                  onClick={onExitFullscreen}
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Home
                </Button>
                <Button
                  onClick={onToggleFullscreen}
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <Minimize2 className="w-4 h-4 mr-2" />
                  Exit Fullscreen
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Camera grid - full viewport */}
        {activeCameras.length > 0 ? (
          <div className="h-full w-full">
            <div className={`grid gap-0 h-full ${currentLayout}`}>
              {activeCameras.map((camera, index) => (
                <CameraView
                  key={camera.id}
                  camera={camera}
                  index={index}
                  total={activeCameras.length}
                  layout={activeCameras.length === 5 || activeCameras.length === 6 ? fiveCamLayout : ''}
                  isVisible={isVisible}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-white">
              <Grid3X3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-medium mb-2">No Active Cameras</h3>
              <p className="text-muted-foreground mb-4">
                Start cameras to view them in panel mode.
              </p>
              <Button 
                onClick={onExitFullscreen}
                variant="outline"
                className="bg-white/10 border-white/20 hover:bg-white/20"
              >
                <Home className="w-4 h-4 mr-2" />
                Go to Home
              </Button>
            </div>
          </div>
        )}

        {/* Click overlay to hide controls */}
        {showControls && (
          <div 
            className="fixed inset-0 z-30 bg-black/20"
            onClick={() => setShowControls(false)}
          />
        )}
      </div>
    );
  }

  // Regular mode (non-fullscreen)
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Panel Mode</h2>
          <div className="text-muted-foreground space-y-1">
            <p>Camera monitoring • {streamStats.total} active cameras</p>
            {streamStats.total > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <StatusIndicator status={streamStats.errors > 0 ? 'error' : streamStats.playing > 0 ? 'playing' : 'loading'} />
                <span>{streamStats.playing} playing, {streamStats.errors} errors</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={onToggleFullscreen} variant="outline" size="sm">
            <Maximize2 className="w-4 h-4 mr-2" />
            Fullscreen
          </Button>

          {activeCameras.length === 2 && (
            <Select value={twoCamLayout} onValueChange={(value: any) => setTwoCamLayout(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="horizontal">
                  <div className="flex items-center gap-2">
                    <RotateCw className="w-4 h-4 rotate-90" />
                    Horizontal
                  </div>
                </SelectItem>
                <SelectItem value="vertical">
                  <div className="flex items-center gap-2">
                    <RotateCw className="w-4 h-4" />
                    Vertical
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          )}

          {(activeCameras.length === 5 || activeCameras.length === 6) && (
            <Select value={fiveCamLayout} onValueChange={(value: any) => setFiveCamLayout(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid</SelectItem>
                <SelectItem value="featured">Featured</SelectItem>
              </SelectContent>
            </Select>
          )}
          
          {activeCameras.length > 0 && (
            <Button onClick={handleStopAll} variant="destructive" size="sm">
              <Square className="w-4 h-4 mr-2" />
              Stop All
            </Button>
          )}
        </div>
      </div>

      {activeCameras.length > 0 ? (
        <div className="h-[calc(100vh-200px)] w-full">
          <div className={`grid gap-4 h-full ${currentLayout}`}>
            {activeCameras.map((camera, index) => (
              <CameraView
                key={camera.id}
                camera={camera}
                index={index}
                total={activeCameras.length}
                layout={activeCameras.length === 5 || activeCameras.length === 6 ? fiveCamLayout : ''}
                isVisible={isVisible}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-200px)] flex items-center justify-center bg-muted rounded-lg">
          <div className="text-center">
            <Grid3X3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-medium mb-2">No Active Cameras</h3>
            <p className="text-muted-foreground mb-4">
              Start cameras from the Home tab to view them in panel mode.
            </p>
            <Button variant="outline" onClick={onExitFullscreen}>
              <Monitor className="w-4 h-4 mr-2" />
              Go to Home
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}