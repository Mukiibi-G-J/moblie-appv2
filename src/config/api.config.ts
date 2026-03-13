// API Configuration
// Set USE_TEST_ENV to true to use test environment
export const USE_TEST_ENV = false; // Change to false for production

// Test Environment Configuration
// Option 1: Use localhost (requires ADB port forwarding for Android)
//   For Android: Run "adb reverse tcp:8000 tcp:8000" in terminal
//   Then use: 'http://localhost:8000'
// Option 2: Use your computer's IP address (device must be on same WiFi)
//   Find your IP: Windows: ipconfig | findstr IPv4
//   Then use: 'http://YOUR_IP:8000' (e.g., 'http://10.10.0.3:8000')
export const TEST_API_BASE_URL = 'http://localhost:8000'; // Change to your IP if not using ADB reverse
export const TEST_TENANT_SCHEMA = 'hardwareworld';

// Production Environment (uses tenant-based subdomains)
// Base URL will be constructed as: https://{tenant}.zentroapp-backend.com
export const PROD_BASE_URL = 'https://zentroapp-backend.com';
