'use client'

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase";
import { ConnectCalendar } from "@/components/ConnectCalendar";
import Image from 'next/image';

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
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const toast = useToast();

    useEffect(() => {
        fetchUserProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        return () => {
            if (previewUrl && previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

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
                console.log('Profile data:', data);
                if (data.profile_picture_url) {
                    console.log('Setting profile picture URL:', data.profile_picture_url);
                    setPreviewUrl(data.profile_picture_url);
                }
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (previewUrl && previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(previewUrl);
            }

            setProfilePicture(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleRemoveImage = () => {
        if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
        }
        setProfilePicture(null);
        setPreviewUrl(null);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            // Only handle file upload if a new file was selected
            let profile_picture_url = previewUrl;
            if (profilePicture) {
                const fileExt = profilePicture.name.split('.').pop();
                const fileName = `${user.id}-${Date.now()}.${fileExt}`;

                console.log('Attempting upload to bucket: profile-pictures');
                const { error: uploadError } = await supabase.storage
                    .from('profile-pictures')
                    .upload(fileName, profilePicture);

                if (uploadError) {
                    console.error('Upload error details:', uploadError);
                    throw uploadError;
                }

                // Get the public URL using the proper method
                const { data: { publicUrl } } = supabase.storage
                    .from('profile-pictures')
                    .getPublicUrl(fileName);

                console.log('Public URL generated:', publicUrl);
                profile_picture_url = publicUrl;
            }

            // Save profile information
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    name,
                    description,
                    email: user.email,
                    profile_picture_url,
                });

            if (profileError) throw profileError;

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
                    <label htmlFor="name" className="block text-md font-medium text-gray-700">Profile Picture</label>
                    <div className="mt-2 flex flex-col space-y-3">
                        <div className="relative w-20 h-20">
                            <label htmlFor="profile-picture" className="cursor-pointer block">
                                {previewUrl ? (
                                    <>
                                        <div className="relative w-20 h-20 rounded-full overflow-hidden hover:opacity-90 transition-opacity">
                                            <Image
                                                src={previewUrl}
                                                alt="Profile preview"
                                                fill
                                                style={{ objectFit: 'cover' }}
                                                onError={(e) => {
                                                    console.error('Error loading image:', e);
                                                    console.log('Failed URL:', previewUrl);
                                                }}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleRemoveImage();
                                            }}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </>
                                ) : (
                                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    </div>
                                )}
                            </label>
                            <input
                                id="profile-picture"
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="hidden"
                            />
                        </div>
                        <div>
                            <span className="text-sm text-teal-600 hover:text-teal-500 cursor-pointer" onClick={() => document.getElementById('profile-picture')?.click()}>
                                {previewUrl ? 'Change photo' : 'Upload photo'}
                            </span>
                            <p className="text-xs text-gray-500 mt-1">JPG, PNG or GIF (max. 2MB)</p>
                        </div>
                    </div>
                </div>

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
                <div className=''>
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
