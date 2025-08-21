// --- CONFIGURATION ---
const MEDIAMTX_IP = window.location.hostname;
const MEDIAMTX_HLS_PORT = 8888;
const MEDIAMTX_WEBRTC_PORT = 8889;
const API_BASE_URL = `/api/v3`;

// Cache configuration
const CACHE_DURATION = 30000; // 30 seconds
const HEALTH_CHECK_INTERVAL = 10000; // 10 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
// --- END CONFIGURATION ---

export interface Camera {
  id: string;
  name: string;
  source: string;
  status: 'online' | 'offline' | 'error' | 'checking';
  isActive: boolean;
  location?: string;
  quality?: 'HD' | 'FHD' | '4K';
  hlsUrl?: string;
  webrtcUrl?: string;
  lastSeen?: number;
  errorCount?: number;
  metadata?: {
    fps?: number;
    resolution?: string;
    bitrate?: number;
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires: number;
}

interface HealthStatus {
  [cameraId: string]: {
    status: Camera['status'];
    lastCheck: number;
    errorCount: number;
  };
}

class CameraStore {
  private cameras: Camera[] = [];
  private listeners: (() => void)[] = [];
  private cache = new Map<string, CacheEntry<any>>();
  private healthCheckInterval?: number;
  private healthStatus: HealthStatus = {};
  private isLoading = false;
  private abortController?: AbortController;

  constructor() {
    this.loadCameras();
    this.startHealthMonitoring();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', this.cleanup.bind(this));
  }

  // Cache utilities
  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache<T>(key: string, data: T, duration = CACHE_DURATION): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expires: Date.now() + duration
    });
  }

  // Network utilities with retry logic
  private async fetchWithRetry(url: string, options: RequestInit = {}, retries = MAX_RETRIES): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      if (!response.ok && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.fetchWithRetry(url, options, retries - 1);
      }

      return response;
    } catch (error) {
      if (retries > 0 && error.name !== 'AbortError') {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Optimized camera loading with caching and batching
  async loadCameras(forceRefresh = false): Promise<void> {
    if (this.isLoading && !forceRefresh) return;
    
    const cacheKey = 'cameras_list';
    if (!forceRefresh) {
      const cached = this.getCached<Camera[]>(cacheKey);
      if (cached) {
        this.cameras = cached;
        this.notifyListeners();
        return;
      }
    }

    this.isLoading = true;
    this.abortController?.abort();
    this.abortController = new AbortController();

    try {
      // Get paths list
      const pathsResponse = await this.fetchWithRetry(`${API_BASE_URL}/paths/list`);
      const pathsData = await pathsResponse.json();

      if (!pathsData.items || pathsData.items.length === 0) {
        this.cameras = [];
        this.setCache(cacheKey, []);
        this.notifyListeners();
        return;
      }

      // Batch fetch configurations with concurrent requests (limited to 5 at a time)
      const chunks = this.chunkArray(pathsData.items, 5);
      const allConfigs: any[] = [];

      for (const chunk of chunks) {
        if (this.abortController.signal.aborted) break;

        const configPromises = chunk.map(async (item: any) => {
          try {
            const response = await this.fetchWithRetry(
              `${API_BASE_URL}/config/paths/get/${item.name}`,
              { signal: this.abortController!.signal }
            );
            return await response.json();
          } catch (error) {
            console.warn(`Failed to load config for ${item.name}:`, error);
            return { name: item.name, source: 'unknown', error: true };
          }
        });

        const chunkConfigs = await Promise.all(configPromises);
        allConfigs.push(...chunkConfigs);
      }

      if (this.abortController.signal.aborted) return;

      // Transform and enhance camera data
      this.cameras = allConfigs
        .filter(config => config && config.name)
        .map((config: any) => {
          const existingCamera = this.cameras.find(c => c.id === config.name);
          const isActive = existingCamera?.isActive ?? true; // Default to active for new cameras
          
          return {
            id: config.name,
            name: this.formatCameraName(config.name),
            source: config.source || 'unknown',
            status: config.error ? 'error' : (this.healthStatus[config.name]?.status || 'checking'),
            isActive: isActive,
            hlsUrl: this.generateHlsUrl(config.name),
            webrtcUrl: this.generateWebrtcUrl(config.name),
            lastSeen: existingCamera?.lastSeen || Date.now(),
            errorCount: this.healthStatus[config.name]?.errorCount || 0,
            metadata: existingCamera?.metadata || {}
          } as Camera;
        });

      // Cache results
      this.setCache(cacheKey, this.cameras);
      
    } catch (error) {
      console.error('Error loading cameras:', error);
      // Don't clear cameras on error, keep existing data
    } finally {
      this.isLoading = false;
      this.notifyListeners();
    }
  }

  // Utility functions
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private formatCameraName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private generateHlsUrl(cameraName: string): string {
    return `/hls/${cameraName}/index.m3u8`;
  }

  private generateWebrtcUrl(cameraName: string): string {
    return `${window.location.protocol}//${MEDIAMTX_IP}:${MEDIAMTX_WEBRTC_PORT}/${cameraName}/whep`;
  }

  // Health monitoring system
  private startHealthMonitoring(): void {
    this.healthCheckInterval = window.setInterval(() => {
      this.checkCamerasHealth();
    }, HEALTH_CHECK_INTERVAL);
  }

  private async checkCamerasHealth(): Promise<void> {
    if (this.cameras.length === 0) return;

    const healthChecks = this.cameras.map(async (camera) => {
      try {
        // Quick health check via HLS manifest with longer timeout
        const response = await fetch(camera.hlsUrl!, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000) // Increased timeout to 5s
        });

        let newStatus: Camera['status'];
        if (response.ok) {
          newStatus = 'online';
        } else if (response.status === 404) {
          // 404 might mean stream is starting up, don't mark as offline immediately
          newStatus = this.healthStatus[camera.id]?.status === 'online' ? 'online' : 'checking';
        } else {
          newStatus = 'offline';
        }

        const currentHealth = this.healthStatus[camera.id] || { status: 'checking', lastCheck: 0, errorCount: 0 };
        
        // Only increment error count for actual failures
        const errorCount = response.ok ? 0 : currentHealth.errorCount + 1;
        
        this.healthStatus[camera.id] = {
          status: newStatus,
          lastCheck: Date.now(),
          errorCount: errorCount
        };

        // Update camera status if changed, but be more conservative about marking as offline
        if (camera.status !== newStatus) {
          // Only mark as offline after multiple consecutive failures
          if (newStatus === 'offline' && errorCount < 3) {
            newStatus = 'checking';
          }
          this.updateCameraStatus(camera.id, newStatus);
        }

      } catch (error) {
        const currentHealth = this.healthStatus[camera.id] || { status: 'checking', lastCheck: 0, errorCount: 0 };
        const errorCount = currentHealth.errorCount + 1;
        
        // Don't immediately mark as error, give it a few attempts
        let newStatus: Camera['status'] = 'checking';
        if (errorCount >= 3) {
          newStatus = 'error';
        } else if (currentHealth.status === 'online') {
          // Keep online status for a few failures to prevent flickering
          newStatus = 'online';
        }
        
        this.healthStatus[camera.id] = {
          status: newStatus,
          lastCheck: Date.now(),
          errorCount: errorCount
        };

        if (camera.status !== newStatus) {
          this.updateCameraStatus(camera.id, newStatus);
        }
      }
    });

    await Promise.allSettled(healthChecks);
  }

  private updateCameraStatus(id: string, status: Camera['status']): void {
    const camera = this.cameras.find(c => c.id === id);
    if (camera && camera.status !== status) {
      camera.status = status;
      camera.lastSeen = status === 'online' ? Date.now() : camera.lastSeen;
      camera.errorCount = this.healthStatus[id]?.errorCount || 0;
      this.invalidateCache();
      this.notifyListeners();
    }
  }

  // Public API methods (optimized)
  getCameras(): Camera[] {
    return [...this.cameras];
  }

  getActiveCameras(): Camera[] {
    return this.cameras.filter(camera => camera.isActive);
  }

  getOnlineCameras(): Camera[] {
    return this.cameras.filter(camera => camera.status === 'online');
  }

  getCameraById(id: string): Camera | undefined {
    return this.cameras.find(camera => camera.id === id);
  }

  getCameraStats() {
    const total = this.cameras.length;
    const online = this.cameras.filter(c => c.status === 'online').length;
    const active = this.cameras.filter(c => c.isActive).length;
    const errors = this.cameras.filter(c => c.status === 'error').length;
    
    return { total, online, active, errors };
  }

  // Optimized update method
  updateCamera(id: string, updates: Partial<Camera>): void {
    const camera = this.cameras.find(c => c.id === id);
    if (!camera) return;

    // Merge updates efficiently
    Object.assign(camera, {
      ...updates,
      lastSeen: updates.status === 'online' ? Date.now() : camera.lastSeen
    });

    this.invalidateCache();
    this.notifyListeners();
  }

  // Enhanced camera management
  async addCamera(camera: Omit<Camera, 'id' | 'status' | 'isActive' | 'hlsUrl' | 'webrtcUrl'>): Promise<boolean> {
    const payload = {
      source: camera.source,
      rtspTransport: 'tcp',
      sourceOnDemand: false, // Keep streams always available for better performance
      sourceOnDemandStartTimeout: '10s',
      sourceOnDemandCloseAfter: '120s',
      rtspUDPReadBufferSize: 8388608 // 8MB buffer for stability
    };

    try {
      const response = await this.fetchWithRetry(
        `${API_BASE_URL}/config/paths/add/${camera.name}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      if (response.ok) {
        await this.loadCameras(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error adding camera:', error);
      return false;
    }
  }

  // Force refresh camera status for panel mode
  async forceRefreshCameraStatus(): Promise<void> {
    // Clear health status cache to force fresh checks
    this.healthStatus = {};
    
    // Reload cameras with fresh data
    await this.loadCameras(true);
    
    // Trigger immediate health check
    await this.checkCamerasHealth();
  }

  // Get cameras with forced refresh for panel mode
  async getCamerasForPanel(): Promise<Camera[]> {
    // Force refresh when accessing panel mode
    await this.forceRefreshCameraStatus();
    return this.cameras.filter(camera => camera.isActive);
  }

  async removeCamera(id: string): Promise<boolean> {
    try {
      const response = await this.fetchWithRetry(
        `${API_BASE_URL}/config/paths/delete/${id}`,
        { method: 'POST' }
      );

      if (response.ok) {
        // Remove from health tracking
        delete this.healthStatus[id];
        await this.loadCameras(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting camera:', error);
      return false;
    }
  }

  // Optimized toggle with batching support
  toggleCamera(id: string): void {
    const camera = this.cameras.find(c => c.id === id);
    if (!camera) return;

    camera.isActive = !camera.isActive;
    this.invalidateCache();
    this.notifyListeners();
  }

  toggleMultipleCameras(ids: string[]): void {
    let changed = false;
    
    ids.forEach(id => {
      const camera = this.cameras.find(c => c.id === id);
      if (camera) {
        camera.isActive = !camera.isActive;
        changed = true;
      }
    });

    if (changed) {
      this.invalidateCache();
      this.notifyListeners();
    }
  }

  stopAllCameras(): void {
    let changed = false;
    
    this.cameras.forEach(camera => {
      if (camera.isActive) {
        camera.isActive = false;
        changed = true;
      }
    });

    if (changed) {
      this.invalidateCache();
      this.notifyListeners();
    }
  }

  startAllOnlineCameras(): void {
    let changed = false;
    
    this.cameras.forEach(camera => {
      if (camera.status === 'online' && !camera.isActive) {
        camera.isActive = true;
        changed = true;
      }
    });

    if (changed) {
      this.invalidateCache();
      this.notifyListeners();
    }
  }

  // Enhanced subscription system
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  subscribeToCamera(cameraId: string, listener: (camera: Camera | undefined) => void): () => void {
    const wrapper = () => {
      const camera = this.getCameraById(cameraId);
      listener(camera);
    };
    
    return this.subscribe(wrapper);
  }

  // Cache management
  private invalidateCache(): void {
    this.cache.delete('cameras_list');
  }

  clearCache(): void {
    this.cache.clear();
  }

  // Cleanup
  private cleanup(): void {
    this.abortController?.abort();
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  destroy(): void {
    this.cleanup();
    this.listeners = [];
    this.cameras = [];
    this.healthStatus = {};
    this.cache.clear();
  }

  // Throttled notification system
  private notifyTimeout?: number;
  private notifyListeners(): void {
    if (this.notifyTimeout) return;
    
    this.notifyTimeout = window.setTimeout(() => {
      this.listeners.forEach(listener => {
        try {
          listener();
        } catch (error) {
          console.error('Error in store listener:', error);
        }
      });
      this.notifyTimeout = undefined;
    }, 16); // ~60fps throttling
  }
}

// Singleton instance with cleanup
export const cameraStore = new CameraStore();

// Development utilities
if (process.env.NODE_ENV === 'development') {
  (window as any).cameraStore = cameraStore;
}