/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		serverComponentsExternalPackages: ['@supabase/supabase-js']
	},
	images: {
		domains: [
			// 'xkllkwizcdkydgwzvkdg.supabase.co', // PROD Supabase project
			'edyluyrleinpebjhxay.supabase.co' // DEV Supabase project
		]
	}
}

module.exports = nextConfig
