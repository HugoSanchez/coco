'use client'

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase";
import { ConnectCalendar } from "@/components/ConnectCalendar";

interface ProfileSetupProps {
    onComplete: () => void;
}

export function ProfileSetup({ onComplete }: ProfileSetupProps) {
    const [name, setName] = useState('');
    const [userName, setUserName] = useState('');
    const [description, setDescription] = useState('');
    const [profilePicture, setProfilePicture] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showValidation, setShowValidation] = useState(false);

    const toast = useToast();

    useEffect(() => {
        fetchUserProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchUserProfile = async () => {
        try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user found');

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        if (data) {
            setName(data.name || '');
            setDescription(data.description || '');
            // Note: We can't pre-fill the file input, but we can show the existing profile picture URL if needed
        }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
    };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsLoading(true);
    e.preventDefault();
    try {
        // Get the current user from supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user found');

        // Initialize profile picture url
        let profilePictureUrl = '';

        // Upload profile picture if one was selected
        // This is a supabase storage bucket that allows
        // you to upload images and get a public url for them
        if (profilePicture) {
            const fileExt = profilePicture.name.split('.').pop();
            const fileName = `${user.id}${Math.random()}.${fileExt}`;
            const { error: uploadError, data } = await supabase.storage
            .from('profile-pictures')
            .upload(fileName, profilePicture);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
            .from('profile-pictures')
            .getPublicUrl(fileName);

            profilePictureUrl = publicUrl;
        }

        // Update or insert profile information
        const { error: upsertError } = await supabase
            .from('profiles')
            .upsert({
            id: user.id,
            name,
            description,
            email: user.email,
            profile_picture_url: profilePictureUrl,
            });

        if (upsertError) throw upsertError;

        toast.toast({
            title: "Success",
            description: "Profile updated successfully!",
            color: "success",
        });

        onComplete();

        } catch (error) {
            console.error('Error updating profile:', error);
            toast.toast({
                title: "Error",
                description: "Failed to update profile. Please try again.",
                color: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit} className="space-y-8">

            <div>
                <label htmlFor="name" className="block text-md font-medium text-gray-700">Name</label>
                <p className='text-sm text-gray-500 mb-2'>Your public name, to be displayed on your calendar</p>
                <Input
                    id="name"
                    type="text"
                    value={name}
                    required
                    onChange={(e) => setName(e.target.value)}
                    onInvalid={(e) => e.preventDefault()}
                    className='autofill:bg-white transition-none text-gray-700'
                />
                {showValidation && !name && (
                    <p className="text-red-500 text-sm mt-1">Please fill in this field.</p>
                )}
                <p className='text-xs text-gray-500 my-2'>http://coco-cal.com/book/{name.toLowerCase().replace(' ', '-')}</p>
            </div>
            <div>
                <label htmlFor="description" className="block text-md font-medium text-gray-700">Calendar Description</label>
                <p className='text-sm text-gray-500 mb-2'>Help your clients understand what they are booking.</p>
                <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className='autofill:bg-white transition-none text-gray-700'
                rows={3}
                />
            </div>
            <div className='pt-8'>
            <Button
                type="submit"
                disabled={isLoading || !name}
                className='h-12 w-full shadow-sm bg-teal-400 hover:bg-teal-400 hover:opacity-90'
            >
                {isLoading ? 'Saving...' : 'Continue'}
            </Button>
            </div>
            </form>

        </div>
    );
}

/**
 *
 */
