# Camera System Troubleshooting Guide

## Issues Identified

Based on your logs, the following issues have been identified and addressed:

### 1. HLS Part Duration Changes (iOS Client Errors)
**Problem**: Frequent part duration changes causing iOS client errors
```
WAR [HLS] [muxer cam4] part duration changed from 299ms to 300ms - this will cause an error in iOS clients
WAR [HLS] [muxer cam1] part duration changed from 200ms to 4.44s - this will cause an error in iOS clients
```

**Solution**: 
- Changed from Low-Latency HLS to Standard HLS
- Fixed segment duration to 4s (was 2s)
- Fixed part duration to 400ms (was 200ms)
- Increased segment count to 6 (was 3)

### 2. RTP Packet Loss
**Problem**: Significant packet loss on multiple cameras
```
WAR [path cam2] [RTSP source] 915 RTP packets lost
WAR [path cam1] [RTSP source] 1052 RTP packets lost
```

**Solution**:
- Removed UDP transport, using TCP only for stability
- Increased buffer sizes from 2MB to 8MB
- Increased timeouts for unstable sources
- Added fallback streams for critical cameras

### 3. Network Connectivity Issues
**Problem**: cam3_fixed can't connect to 192.168.0.4:554
```
ERR [path cam3_fixed] [RTSP source] dial tcp 192.168.0.4:554: connect: no route to host
```

**Solution**:
- Added retry mechanism with delays
- Increased connection timeouts
- Added network diagnostics script

### 4. Panel Mode Issues
**Problem**: Cameras showing as inactive despite streams working

**Solution**:
- Fixed camera loading logic to default cameras as active
- Improved health monitoring with conservative status changes
- Added force refresh method for panel mode
- Increased health check timeouts

### 5. Frequent Loading Screens
**Problem**: Video player experiencing frequent loading states

**Solution**:
- Improved stream stability with larger buffers
- Fixed HLS configuration for consistent playback
- Enhanced error handling and retry logic

## Configuration Changes Made

### MediaMTX Configuration (`optimized_mediamtx_config.txt`)

#### HLS Settings (Fixed for iOS Compatibility)
```yaml
hlsVariant: standard          # Was: lowLatency
hlsSegmentCount: 6            # Was: 3
hlsSegmentDuration: 4s        # Was: 2s
hlsPartDuration: 400ms        # Was: 200ms
hlsMuxerCloseAfter: 60s      # Was: 30s
```

#### Network Stability
```yaml
rtspTransports: [tcp]         # Was: [tcp, udp]
rtspUDPReadBufferSize: 4194304 # Was: 2097152
readTimeout: 30s              # Was: 10s
writeTimeout: 30s             # Was: 10s
writeQueueSize: 8192          # Was: 4096
```

#### Camera-Specific Optimizations
```yaml
paths:
  cam1:
    rtspUDPReadBufferSize: 8388608  # 8MB buffer
    rtspTimeout: 45s
    fallback: cam1_backup
    sourceOnDemand: no              # Always connected
```

### Camera Store Improvements (`optimized_camera_store.ts`)

#### Health Monitoring
- Increased timeout from 3s to 5s
- Conservative status changes (requires 3 failures before marking as error)
- Better handling of 404 responses (stream starting up)
- Prevents status flickering

#### Panel Mode Support
- Added `forceRefreshCameraStatus()` method
- Added `getCamerasForPanel()` method
- Default cameras to active status
- Improved error handling

## Troubleshooting Steps

### Step 1: Run Network Diagnostics
```bash
./network_diagnostics.sh
```

This script will:
- Test camera connectivity
- Check network performance
- Verify MediaMTX service status
- Show recent errors

### Step 2: Restart MediaMTX with New Configuration
```bash
./restart_mediamtx.sh
```

This script will:
- Safely stop MediaMTX
- Backup current configuration
- Install new configuration
- Restart service
- Verify successful startup

### Step 3: Monitor Logs
```bash
# Watch MediaMTX logs in real-time
journalctl -u mediamtx -f

# Check for specific errors
journalctl -u mediamtx --since "10 minutes ago" | grep -E "(ERR|WAR)"
```

### Step 4: Test Camera Streams
1. Check HLS streams: `http://your-ip:8888/hls/cam1/index.m3u8`
2. Check WebRTC: `http://your-ip:8889/cam1/whep`
3. Verify panel mode loads cameras correctly

## Expected Improvements

After applying these changes:

1. **HLS Stability**: No more part duration change warnings
2. **Reduced Packet Loss**: TCP-only transport should eliminate UDP packet loss
3. **Better Connectivity**: Increased timeouts and retry mechanisms
4. **Panel Mode**: Cameras should show as active and load properly
5. **Stream Stability**: Reduced loading screens and interruptions

## Monitoring and Maintenance

### Daily Checks
- Monitor MediaMTX logs for errors
- Check camera status in panel mode
- Verify stream quality and stability

### Weekly Checks
- Run network diagnostics
- Check system resources (CPU, memory, disk)
- Review error logs for patterns

### Monthly Checks
- Update MediaMTX to latest version
- Review and optimize configuration
- Check camera firmware updates

## Troubleshooting Commands

### Check MediaMTX Status
```bash
systemctl status mediamtx
```

### View Real-time Logs
```bash
journalctl -u mediamtx -f
```

### Check Configuration
```bash
sudo cat /etc/mediamtx/mediamtx.yml
```

### Test Camera Connectivity
```bash
# Test specific camera
ping 192.168.0.2
telnet 192.168.0.2 554

# Test HLS stream
curl -I http://localhost:8888/hls/cam1/index.m3u8
```

### Restart Service
```bash
sudo systemctl restart mediamtx
```

## Support

If issues persist after applying these fixes:

1. Run the network diagnostics script
2. Collect MediaMTX logs: `journalctl -u mediamtx --since "1 hour ago" > mediamtx_logs.txt`
3. Check system resources: `top`, `free -h`, `df -h`
4. Verify network configuration: `ip addr show`, `ip route`

The optimized configuration should resolve the majority of the issues you're experiencing. The key changes focus on stability over low latency, which should provide a more reliable streaming experience.