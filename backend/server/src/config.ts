// Required environment variables validation
const requiredEnvVars = ['BASE_URL', 'PORT', 'DATA_PATH'] as const;
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

export const config = {
    dataPath: process.env.DATA_PATH!,
    port: parseInt(process.env.PORT!),
    baseUrl: process.env.BASE_URL!
} as const;

// Type for the config object
export type Config = typeof config;
