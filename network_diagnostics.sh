#!/bin/bash

# Network Diagnostics Script for Camera System
# This script helps diagnose network connectivity issues with cameras

echo "=== Camera System Network Diagnostics ==="
echo "Timestamp: $(date)"
echo ""

# Check network interfaces
echo "=== Network Interfaces ==="
ip addr show | grep -E "inet.*192\.168" | head -5
echo ""

# Check routing table
echo "=== Routing Table ==="
ip route | grep "192.168" | head -5
echo ""

# Test camera connectivity
echo "=== Camera Connectivity Test ==="

# Camera IPs from your config
CAMERAS=("192.168.0.2" "192.168.0.3" "192.168.0.4" "192.168.0.8")

for camera in "${CAMERAS[@]}"; do
    echo "Testing $camera..."
    
    # Ping test
    if ping -c 3 -W 2 "$camera" >/dev/null 2>&1; then
        echo "  ✓ Ping: SUCCESS"
    else
        echo "  ✗ Ping: FAILED"
    fi
    
    # Port test (RTSP port 554)
    if timeout 5 bash -c "</dev/tcp/$camera/554" 2>/dev/null; then
        echo "  ✓ Port 554: OPEN"
    else
        echo "  ✗ Port 554: CLOSED/UNREACHABLE"
    fi
    
    # Traceroute
    echo "  Traceroute to $camera:"
    traceroute -m 5 -w 1 "$camera" 2>/dev/null | head -3 | sed 's/^/    /'
    echo ""
done

# Check MediaMTX status
echo "=== MediaMTX Status ==="
if pgrep mediamtx >/dev/null; then
    echo "✓ MediaMTX is running (PID: $(pgrep mediamtx))"
    
    # Check if ports are listening
    for port in 8554 8888 8889 9997; do
        if netstat -tlnp 2>/dev/null | grep ":$port " >/dev/null; then
            echo "✓ Port $port: LISTENING"
        else
            echo "✗ Port $port: NOT LISTENING"
        fi
    done
else
    echo "✗ MediaMTX is not running"
fi
echo ""

# Check system resources
echo "=== System Resources ==="
echo "CPU Load: $(uptime | awk -F'load average:' '{print $2}')"
echo "Memory Usage: $(free -h | grep Mem | awk '{print $3"/"$2}')"
echo "Disk Usage: $(df -h / | tail -1 | awk '{print $5}')"
echo ""

# Check network statistics
echo "=== Network Statistics ==="
echo "TCP Connections: $(netstat -an | grep ESTABLISHED | wc -l)"
echo "UDP Connections: $(netstat -an | grep UDP | wc -l)"
echo ""

# Check for packet loss indicators
echo "=== Packet Loss Check ==="
if dmesg | grep -i "packet loss\|rtp.*lost\|network.*unstable" | tail -3 >/dev/null; then
    echo "Recent packet loss warnings:"
    dmesg | grep -i "packet loss\|rtp.*lost\|network.*unstable" | tail -3 | sed 's/^/  /'
else
    echo "No recent packet loss warnings found"
fi
echo ""

# Recommendations
echo "=== Recommendations ==="
echo "1. If ping fails: Check physical network connections and camera power"
echo "2. If port 554 is closed: Check camera RTSP service and firewall settings"
echo "3. If traceroute shows high latency: Check network congestion or cable quality"
echo "4. If MediaMTX ports aren't listening: Restart MediaMTX service"
echo "5. For packet loss: Consider using TCP-only transport and increasing buffer sizes"
echo ""

echo "=== End of Diagnostics ==="