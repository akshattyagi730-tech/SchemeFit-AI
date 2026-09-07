// Global setup — env only. DB connection is opt-in per integration suite via useTestDb().
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET ||= 'test-session-secret-value-at-least-32-characters-long';
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR = './var/test-uploads';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';
