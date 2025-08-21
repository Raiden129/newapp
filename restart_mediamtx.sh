#!/bin/bash

# MediaMTX Restart Script
# This script safely restarts MediaMTX with the new optimized configuration

echo "=== MediaMTX Restart Script ==="
echo "Timestamp: $(date)"
echo ""

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
    echo "✓ Running with sufficient privileges"
else
    echo "⚠️  This script may need sudo privileges to restart services"
fi
echo ""

# Backup current configuration
echo "=== Backup Current Configuration ==="
if [ -f "/etc/mediamtx/mediamtx.yml" ]; then
    cp /etc/mediamtx/mediamtx.yml /etc/mediamtx/mediamtx.yml.backup.$(date +%Y%m%d_%H%M%S)
    echo "✓ Configuration backed up"
elif [ -f "/etc/mediamtx/mediamtx.yaml" ]; then
    cp /etc/mediamtx/mediamtx.yaml /etc/mediamtx/mediamtx.yaml.backup.$(date +%Y%m%d_%H%M%S)
    echo "✓ Configuration backed up"
else
    echo "⚠️  No existing configuration found to backup"
fi
echo ""

# Check current MediaMTX status
echo "=== Current MediaMTX Status ==="
if pgrep mediamtx >/dev/null; then
    echo "✓ MediaMTX is currently running (PID: $(pgrep mediamtx))"
    CURRENT_PID=$(pgrep mediamtx)
else
    echo "✗ MediaMTX is not currently running"
    CURRENT_PID=""
fi
echo ""

# Stop MediaMTX if running
if [ ! -z "$CURRENT_PID" ]; then
    echo "=== Stopping MediaMTX ==="
    echo "Stopping MediaMTX process $CURRENT_PID..."
    
    # Try graceful shutdown first
    kill -TERM $CURRENT_PID
    
    # Wait for graceful shutdown
    for i in {1..10}; do
        if ! kill -0 $CURRENT_PID 2>/dev/null; then
            echo "✓ MediaMTX stopped gracefully"
            break
        fi
        echo "Waiting for graceful shutdown... ($i/10)"
        sleep 1
    done
    
    # Force kill if still running
    if kill -0 $CURRENT_PID 2>/dev/null; then
        echo "Force killing MediaMTX..."
        kill -KILL $CURRENT_PID
        sleep 2
    fi
    
    # Verify stopped
    if ! pgrep mediamtx >/dev/null; then
        echo "✓ MediaMTX successfully stopped"
    else
        echo "✗ Failed to stop MediaMTX"
        exit 1
    fi
    echo ""
fi

# Copy new configuration
echo "=== Installing New Configuration ==="
if [ -f "optimized_mediamtx_config.txt" ]; then
    # Determine config file location
    if [ -d "/etc/mediamtx" ]; then
        CONFIG_DIR="/etc/mediamtx"
        CONFIG_FILE="mediamtx.yml"
    elif [ -d "/opt/mediamtx" ]; then
        CONFIG_DIR="/opt/mediamtx"
        CONFIG_FILE="mediamtx.yml"
    else
        echo "⚠️  MediaMTX config directory not found, using current directory"
        CONFIG_DIR="."
        CONFIG_FILE="mediamtx.yml"
    fi
    
    # Copy configuration
    cp optimized_mediamtx_config.txt "$CONFIG_DIR/$CONFIG_FILE"
    echo "✓ New configuration copied to $CONFIG_DIR/$CONFIG_FILE"
    
    # Set proper permissions
    chmod 644 "$CONFIG_DIR/$CONFIG_FILE"
    echo "✓ Configuration permissions set"
else
    echo "✗ New configuration file not found"
    exit 1
fi
echo ""

# Start MediaMTX
echo "=== Starting MediaMTX ==="
echo "Starting MediaMTX with new configuration..."

# Try to start MediaMTX
if command -v mediamtx >/dev/null 2>&1; then
    # Start in background
    nohup mediamtx "$CONFIG_DIR/$CONFIG_FILE" > mediamtx.log 2>&1 &
    NEW_PID=$!
    
    # Wait a moment for startup
    sleep 3
    
    # Check if started successfully
    if kill -0 $NEW_PID 2>/dev/null; then
        echo "✓ MediaMTX started successfully (PID: $NEW_PID)"
    else
        echo "✗ Failed to start MediaMTX"
        exit 1
    fi
else
    echo "✗ MediaMTX executable not found in PATH"
    echo "Please ensure MediaMTX is properly installed"
    exit 1
fi
echo ""

# Verify startup
echo "=== Verifying Startup ==="
sleep 5

if pgrep mediamtx >/dev/null; then
    NEW_PID=$(pgrep mediamtx)
    echo "✓ MediaMTX is running (PID: $NEW_PID)"
    
    # Check if ports are listening
    echo "Checking service ports..."
    for port in 8554 8888 8889 9997; do
        if netstat -tlnp 2>/dev/null | grep ":$port " >/dev/null; then
            echo "✓ Port $port: LISTENING"
        else
            echo "⚠️  Port $port: NOT LISTENING (may still be starting)"
        fi
    done
else
    echo "✗ MediaMTX failed to start"
    echo "Check mediamtx.log for error details"
    exit 1
fi
echo ""

# Show recent logs
echo "=== Recent Logs ==="
if [ -f "mediamtx.log" ]; then
    echo "Last 10 lines of MediaMTX log:"
    tail -10 mediamtx.log | sed 's/^/  /'
else
    echo "No log file found yet"
fi
echo ""

echo "=== MediaMTX Restart Complete ==="
echo "✓ MediaMTX has been restarted with the new configuration"
echo "✓ Check the logs for any startup errors"
echo "✓ Test camera streams to ensure they're working properly"
echo ""
echo "To monitor logs in real-time: tail -f mediamtx.log"
echo "To check status: ./network_diagnostics.sh"