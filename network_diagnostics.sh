#!/bin/bash

# Network Diagnostics Script for Camera System
# This script helps diagnose network connectivity issues with cameras

echo "=== Camera Network Diagnostics ==="
echo "Date: $(date)"
echo ""

# Check network interfaces
echo "=== Network Interfaces ==="
ip addr show | grep -E "inet.*192\.168\.0" | head -5
echo ""

# Check routing table
echo "=== Routing Table ==="
ip route | grep "192.168.0"
echo ""

# Test camera connectivity
echo "=== Camera Connectivity Test ==="

cameras=(
    "192.168.0.2:554"
    "192.168.0.3:554"
    "192.168.0.4:554"
    "192.168.0.8:554"
)

for camera in "${cameras[@]}"; do
    ip=$(echo $camera | cut -d: -f1)
    port=$(echo $camera | cut -d: -f2)
    
    echo "Testing $camera..."
    
    # Test basic connectivity
    if ping -c 1 -W 2 $ip > /dev/null 2>&1; then
        echo "  ✓ Ping successful"
    else
        echo "  ✗ Ping failed"
    fi
    
    # Test port connectivity
    if timeout 3 bash -c "</dev/tcp/$ip/$port" > /dev/null 2>&1; then
        echo "  ✓ Port $port accessible"
    else
        echo "  ✗ Port $port not accessible"
    fi
    
    # Test RTSP connection
    if command -v curl > /dev/null 2>&1; then
        if timeout 5 curl -s --connect-timeout 3 "rtsp://$ip:$port" > /dev/null 2>&1; then
            echo "  ✓ RTSP connection successful"
        else
            echo "  ✗ RTSP connection failed"
        fi
    fi
    
    echo ""
done

# Check MediaMTX service status
echo "=== MediaMTX Service Status ==="
if systemctl is-active --quiet mediamtx; then
    echo "✓ MediaMTX service is running"
    echo "Service status:"
    systemctl status mediamtx --no-pager -l | head -10
else
    echo "✗ MediaMTX service is not running"
fi
echo ""

# Check MediaMTX logs for recent errors
echo "=== Recent MediaMTX Errors ==="
if command -v journalctl > /dev/null 2>&1; then
    journalctl -u mediamtx --since "10 minutes ago" | grep -E "(ERR|WAR)" | tail -10
else
    echo "journalctl not available"
fi
echo ""

# Check network performance
echo "=== Network Performance ==="
echo "Testing bandwidth to cameras..."

for camera in "${cameras[@]}"; do
    ip=$(echo $camera | cut -d: -f1)
    echo "Testing $ip..."
    
    # Test latency
    if ping -c 3 -W 2 $ip > /dev/null 2>&1; then
        avg_latency=$(ping -c 3 -W 2 $ip | grep "avg" | awk -F'/' '{print $5}')
        echo "  Average latency: ${avg_latency}ms"
    else
        echo "  Latency test failed"
    fi
    
    # Test packet loss
    if ping -c 10 -W 2 $ip > /dev/null 2>&1; then
        packet_loss=$(ping -c 10 -W 2 $ip | grep "packet loss" | awk '{print $6}')
        echo "  Packet loss: $packet_loss"
    else
        echo "  Packet loss test failed"
    fi
    
    echo ""
done

# Check system resources
echo "=== System Resources ==="
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1
echo "Memory Usage:"
free -h | grep "Mem:"
echo "Disk Usage:"
df -h / | tail -1
echo ""

# Check for network errors
echo "=== Network Error Counters ==="
if command -v netstat > /dev/null 2>&1; then
    echo "Network interface errors:"
    netstat -i | grep -E "(Iface|eth|wlan)" | head -5
else
    echo "netstat not available"
fi
echo ""

echo "=== Diagnostics Complete ==="
echo "Run this script again if issues persist"
echo "Check MediaMTX logs: journalctl -u mediamtx -f"