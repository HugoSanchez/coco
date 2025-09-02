// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

const env =
	process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'
const defaultRate = env === 'production' ? 0.1 : 1.0
const tracesRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE || defaultRate)

Sentry.init({
	dsn: 'https://0633e3f34cafdbb2c85f44ccdd8aad04@o4509870378450944.ingest.de.sentry.io/4509870399946832',

	// Define how likely traces are sampled. Lower in production to control volume.
	tracesSampleRate: isNaN(tracesRate) ? defaultRate : tracesRate,

	// Enable logs to be sent to Sentry
	enableLogs: true,

	// Set environment explicitly for filtering
	environment: env,

	// Setting this option to true will print useful information to the console while you're setting up Sentry.
	debug: false
})
