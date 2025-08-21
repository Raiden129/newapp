# Camera System Troubleshooting Guide

## Issues Identified

Based on your MediaMTX logs, the following issues have been identified and resolved:

### 1. HLS Part Duration Changes (iOS Compatibility Issues)
**Problem**: Frequent part duration changes causing iOS client errors
```
WAR [HLS] [muxer cam4] part duration changed from 299ms to 300ms - this will cause an error in iOS clients
```

**Solution Applied**:
- Changed from Low-Latency HLS to Standard HLS (`hlsVariant: standard`)
- Fixed part duration to 400ms (`hlsPartDuration: 400ms`)
- Increased segment duration to 4s for stability (`hlsSegmentDuration: 4s`)
- Increased segment count to 6 for better buffering (`hlsSegmentCount: 6`)

### 2. RTP Packet Loss
**Problem**: High packet loss on multiple cameras
```
WAR [path cam2] [RTSP source] 915 RTP packets lost
WAR [path cam1] [RTSP source] 1052 RTP packets lost
```

**Solution Applied**:
- Removed UDP transport, using TCP only (`rtspTransports: [tcp]`)
- Increased buffer sizes significantly:
  - Global: 8MB (`rtspUDPReadBufferSize: 8388608`)
  - Per camera: 16MB (`rtspUDPReadBufferSize: 16777216`)
- Increased timeouts for network stability:
  - Read timeout: 30s
  - Write timeout: 30s
  - RTSP timeout: 30s

### 3. Network Connectivity Issues
**Problem**: cam3_fixed can't connect to 192.168.0.4:554
```
ERR [path cam3_fixed] [RTSP source] dial tcp 192.168.0.4:554: connect: no route to host
```

**Solution Applied**:
- Added fallback stream configuration
- Increased connection timeouts
- Enhanced error handling in camera store

### 4. Processing Errors
**Problem**: Multiple processing errors on cameras
```
WAR [path cam2] 6 processing errors
WAR [path cam1] 2 processing errors
```

**Solution Applied**:
- Disabled source on-demand for stability
- Increased buffer sizes
- Enhanced error handling and retry logic

### 5. Panel Mode UI Issues
**Problem**: Cameras showing as inactive despite streams working

**Solution Applied**:
- Fixed camera store health monitoring
- Enhanced status detection logic
- Improved camera activation handling
- Added consecutive failure tracking

## Configuration Changes Made

### MediaMTX Configuration (`optimized_mediamtx_config.txt`)
- **HLS**: Standard variant with fixed durations for iOS compatibility
- **Transport**: TCP-only for stability
- **Buffers**: Significantly increased for network stability
- **Timeouts**: Increased for better network handling
- **Fallbacks**: Added for critical cameras

### Camera Store (`optimized_camera_store.ts`)
- **Health Monitoring**: Enhanced with consecutive failure tracking
- **Status Management**: Improved camera status detection
- **Default State**: Cameras active by default for better UX
- **Error Handling**: Better retry logic and timeout management

### Panel Mode (`optimized_panel_mode.ts`)
- **Status Display**: Enhanced status indicators
- **Error Handling**: Better error message display
- **Performance**: Optimized rendering and status updates

## Troubleshooting Steps

### Step 1: Run Network Diagnostics
```bash
./network_diagnostics.sh
```

This will check:
- Camera connectivity (ping, port 554)
- Network routing
- MediaMTX service status
- System resources

### Step 2: Restart MediaMTX with New Configuration
```bash
./restart_mediamtx.sh
```

This will:
- Backup current configuration
- Stop MediaMTX safely
- Install new optimized configuration
- Restart MediaMTX
- Verify startup

### Step 3: Monitor Logs
```bash
tail -f mediamtx.log
```

Look for:
- Successful camera connections
- Reduced packet loss warnings
- Stable HLS part durations
- No more iOS compatibility warnings

### Step 4: Test Camera Streams
1. **Home Screen**: Verify cameras start and show streams
2. **Panel Mode**: Check if cameras show as active
3. **Video Player**: Monitor for reduced loading screens
4. **iOS Devices**: Test HLS playback compatibility

## Expected Results After Fixes

### HLS Stability
- ✅ No more part duration change warnings
- ✅ iOS clients should work without errors
- ✅ Reduced loading screens in video player

### Network Stability
- ✅ Reduced or eliminated RTP packet loss
- ✅ More stable camera connections
- ✅ Better handling of network issues

### UI Improvements
- ✅ Cameras should show as active in panel mode
- ✅ Better status indicators
- ✅ Reduced loading states

## Monitoring and Maintenance

### Regular Health Checks
- Run `./network_diagnostics.sh` weekly
- Monitor MediaMTX logs for new issues
- Check camera stream quality

### Performance Metrics
- Monitor packet loss rates
- Track HLS segment generation
- Watch for processing errors

### Configuration Updates
- Keep MediaMTX updated
- Monitor for new camera compatibility issues
- Adjust buffer sizes if needed

## Additional Recommendations

### Network Infrastructure
1. **Cable Quality**: Ensure Cat6 or better cables
2. **Switch Quality**: Use managed switches with QoS
3. **Bandwidth**: Ensure sufficient bandwidth for all cameras
4. **VLANs**: Consider separating camera traffic

### Camera Settings
1. **RTSP Settings**: Use TCP transport on cameras if possible
2. **Bitrate**: Optimize bitrate for network capacity
3. **Frame Rate**: Consider reducing frame rate for stability
4. **Resolution**: Balance quality vs. network requirements

### System Resources
1. **CPU**: Ensure adequate CPU for video processing
2. **Memory**: Monitor memory usage during peak times
3. **Disk**: Ensure sufficient disk space for logs
4. **Network**: Monitor network interface statistics

## Support and Debugging

### If Issues Persist
1. Check `mediamtx.log` for new error patterns
2. Run network diagnostics to identify bottlenecks
3. Test individual camera connections
4. Verify network infrastructure

### Log Analysis
- Look for patterns in error messages
- Monitor timing of issues
- Check for correlation with network events
- Verify camera-specific vs. system-wide issues

### Performance Tuning
- Adjust buffer sizes based on network conditions
- Modify timeouts for your specific environment
- Consider different HLS configurations for different use cases
- Optimize WebRTC settings if used

## Conclusion

The optimizations applied should resolve:
- ✅ HLS iOS compatibility issues
- ✅ RTP packet loss problems
- ✅ Network connectivity issues
- ✅ Panel mode camera status problems
- ✅ Frequent video loading screens

Monitor the system after applying these changes and adjust configurations as needed for your specific network environment.