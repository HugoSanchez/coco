/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		serverComponentsExternalPackages: ['@supabase/supabase-js']
	},
	images: {
		domains: ['xkllkwizcdkydgwzvkdg.supabase.co'] // Replace with your Supabase project URL
	}
}

module.exports = nextConfig
