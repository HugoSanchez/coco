'use client'

import React, { useEffect, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"

interface ProfileSetupProps {
    onComplete: () => void;
}

export function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const toast = useToast();
  const supabase = useSupabaseClient();

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePicture(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    console.log('HEEELLOO')
    /** 
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('No user found');

      let profilePictureUrl = '';

      // Upload profile picture if one was selected
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
    */
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
            onChange={(e) => setName(e.target.value)}
            required
            />
        </div>
        <div>
            <label htmlFor="description" className="block text-md font-medium text-gray-700">Calendar Description</label>
            <p className='text-sm text-gray-500 mb-2'>This description will appear when sharing your calendar with your clients. 
                Help them understand what they are are booking.</p>
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
        </form>
        <Button type="submit" disabled={isLoading} className='mt-12 h-12 w-full bg-emerald-400 hover:bg-emerald-300'>
            {isLoading ? 'Saving...' : 'Save Profile'}
        </Button>
    </div>
  );
}

/**
 *  
 */