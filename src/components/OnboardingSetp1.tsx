import React, { useState } from 'react';
import { ProfileSetup } from './ProfileSetup';
import { ConnectCalendar } from './ConnectCalendar';


export function OnboardingStep1() {
  const [isProfileSaved, setIsProfileSaved] = useState(false);

  return (
    <div className="space-y-8">
        <h2 className="text-2xl font-bold">Step 1: Profile Setup</h2>
        <ProfileSetup onComplete={() => setIsProfileSaved(true)} />
        <div>
            <h3 className="text-xl font-semibold mb-4">Connect Your Calendar</h3>
            <ConnectCalendar />
        </div>
    </div>
  );
}