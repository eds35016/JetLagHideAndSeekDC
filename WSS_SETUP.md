# Team Server WSS (WebSocket Secure) Setup

This directory contains both HTTP/WS and HTTPS/WSS versions of the team server:

- `team-server.js` - Original HTTP server with WebSocket support
- `team-server-wss.js` - HTTPS server with WebSocket Secure (WSS) support

## WSS Server Setup

The WSS server requires SSL certificates to function. Here are your options:

### Option 1: Environment Variables (Recommended for Production)
Set the following environment variables with your SSL certificate content:
```bash
export SSL_KEY="-----BEGIN PRIVATE KEY-----\n[your private key content]\n-----END PRIVATE KEY-----"
export SSL_CERT="-----BEGIN CERTIFICATE-----\n[your certificate content]\n-----END CERTIFICATE-----"
```

### Option 2: Certificate Files (Development)
1. Create an `ssl` directory in your project root
2. Place your certificate files:
   - `ssl/private-key.pem` - Your private key
   - `ssl/certificate.pem` - Your certificate

Update the `sslOptions` in `team-server-wss.js`:
```javascript
const sslOptions = {
    key: readFileSync(join(__dirname, 'ssl', 'private-key.pem')),
    cert: readFileSync(join(__dirname, 'ssl', 'certificate.pem'))
};
```

### Option 3: Self-Signed Certificates (Development Only)
For development/testing, generate self-signed certificates:

```bash
# Generate private key and certificate
openssl req -x509 -newkey rsa:4096 -keyout ssl/private-key.pem -out ssl/certificate.pem -days 365 -nodes

# When prompted, you can use these values:
# Country Name: US
# State: Your State
# City: Your City
# Organization: Your Organization
# Organizational Unit: IT Department
# Common Name: localhost (IMPORTANT for local testing)
# Email: your@email.com
```

## Running the Servers

### HTTP/WS Server (Original)
```bash
node team-server.js
```
- WebSocket endpoint: `ws://localhost:3001/ws/teams`
- REST API: `http://localhost:3001/api/teams/`

### HTTPS/WSS Server (New)
```bash
node team-server-wss.js
```
- WebSocket Secure endpoint: `wss://localhost:3443/ws/teams`
- REST API: `https://localhost:3443/api/teams/`

## Client Configuration

To use the WSS server, update your client code to connect to:
- `wss://localhost:3443/ws/teams` instead of `ws://localhost:3001/ws/teams`
- `https://localhost:3443/api/teams/` instead of `http://localhost:3001/api/teams/`

## Security Notes

1. **Self-signed certificates** will show security warnings in browsers - this is normal for development
2. **Production environments** should use certificates from a trusted Certificate Authority (CA)
3. **Firewall settings** may need to be updated to allow HTTPS traffic on port 3443
4. **Load balancers** and **reverse proxies** should be configured to handle WSS connections properly

## Troubleshooting

- **"SSL certificates not configured" error**: Follow the setup steps above
- **Browser security warnings**: Accept the self-signed certificate for development
- **Connection refused**: Check that the server is running and firewall allows the port
- **WebSocket connection fails**: Ensure your client supports WSS and trusts the certificate
