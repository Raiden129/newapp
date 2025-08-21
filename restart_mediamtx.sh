#!/bin/bash

# MediaMTX Restart Script
# This script safely restarts MediaMTX with the new configuration

echo "=== MediaMTX Restart Script ==="
echo "Date: $(date)"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "This script should not be run as root"
   exit 1
fi

# Check if MediaMTX is running
echo "Checking MediaMTX service status..."
if systemctl is-active --quiet mediamtx; then
    echo "✓ MediaMTX service is running"
    
    # Stop the service
    echo "Stopping MediaMTX service..."
    sudo systemctl stop mediamtx
    
    # Wait for service to stop
    sleep 3
    
    # Check if stopped
    if systemctl is-active --quiet mediamtx; then
        echo "✗ Failed to stop MediaMTX service"
        echo "Attempting to force stop..."
        sudo systemctl kill -9 mediamtx
        sleep 2
    else
        echo "✓ MediaMTX service stopped successfully"
    fi
else
    echo "MediaMTX service is not running"
fi

# Backup current configuration
echo "Backing up current configuration..."
if [ -f /etc/mediamtx/mediamtx.yml ]; then
    sudo cp /etc/mediamtx/mediamtx.yml /etc/mediamtx/mediamtx.yml.backup.$(date +%Y%m%d_%H%M%S)
    echo "✓ Configuration backed up"
else
    echo "No existing configuration found"
fi

# Copy new configuration
echo "Installing new configuration..."
if [ -f "optimized_mediamtx_config.txt" ]; then
    sudo cp optimized_mediamtx_config.txt /etc/mediamtx/mediamtx.yml
    echo "✓ New configuration installed"
else
    echo "✗ New configuration file not found"
    exit 1
fi

# Set proper permissions
echo "Setting configuration permissions..."
sudo chown mediamtx:mediamtx /etc/mediamtx/mediamtx.yml
sudo chmod 644 /etc/mediamtx/mediamtx.yml
echo "✓ Permissions set"

# Start MediaMTX service
echo "Starting MediaMTX service..."
sudo systemctl start mediamtx

# Wait for service to start
sleep 5

# Check service status
echo "Checking service status..."
if systemctl is-active --quiet mediamtx; then
    echo "✓ MediaMTX service started successfully"
    
    # Check for any immediate errors
    echo "Checking for startup errors..."
    sleep 2
    journalctl -u mediamtx --since "1 minute ago" | grep -E "(ERR|WAR)" | head -5
    
    echo ""
    echo "=== Restart Complete ==="
    echo "MediaMTX has been restarted with the new configuration"
    echo "Check logs: journalctl -u mediamtx -f"
    echo "Check status: systemctl status mediamtx"
    
else
    echo "✗ Failed to start MediaMTX service"
    echo "Checking service logs..."
    journalctl -u mediamtx --since "1 minute ago" | tail -20
    exit 1
fi