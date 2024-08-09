'use client'

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase";

interface ProfileSetupProps {
    onComplete: () => void;
}

export function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  
  const toast = useToast();

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePicture(e.target.files[0]);
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
                <p className='text-sm text-gray-500 mb-2'>This is the name that will be displayed on your calendar.</p>
                <Input
                    id="name"
                    type="text"
                    value={name}
                    required
                    onChange={(e) => setName(e.target.value)}
                    onInvalid={(e) => e.preventDefault()}
                    className='autofill:bg-white transition-none'
                />
                {showValidation && !name && (
                    <p className="text-red-500 text-sm mt-1">Please fill in this field.</p>
                )}
            </div>
            <div>
                <label htmlFor="description" className="block text-md font-medium text-gray-700">Calendar Description</label>
                <p className='text-sm text-gray-500 mb-2'>This description will appear when sharing your calendar with your clients. 
                    Help them understand what you are offering.</p>
                <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                />
            </div>
            <div>
                <label htmlFor="profilePicture" className="block text-sm font-medium text-gray-700">Profile Picture</label>
                <p className='text-sm text-gray-500 mb-2'>We recommend using the same as your instagram profile.</p>
                    <Input
                    id="profilePicture"
                    type="file"
                    onChange={handleProfilePictureChange}
                    accept="image/*"
                    />
            </div>
            <Button 
                type="submit" 
                disabled={isLoading || !name} 
                className='mt-32 h-12 w-full shadow-sm bg-teal-400 hover:bg-teal-400 hover:opacity-90'
            >
                {isLoading ? 'Saving...' : 'Save Profile'}
            </Button>
            </form>
        
        </div>
    );
}

/**
 *  
 */