import posthog from 'posthog-js';

/**
 * Initialize PostHog analytics
 * Call this before React renders
 */
export const initPostHog = () => {
  if (typeof window !== 'undefined' && process.env.REACT_APP_POSTHOG_KEY) {
    posthog.init(process.env.REACT_APP_POSTHOG_KEY, {
      api_host: 'https://us.i.posthog.com',
      capture_pageview: false, // We'll do this manually for SPA
      capture_pageleave: true,
      autocapture: true, // Clicks, inputs, form submits
      session_recording: {
        maskAllInputs: false,
        maskInputOptions: { password: true }
      },
      // Disable in development if needed
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') {
          // Optionally disable in dev - uncomment to disable
          // posthog.opt_out_capturing();
        }
      }
    });
  }
  return posthog;
};

/**
 * Identify a user after login
 */
export const identifyUser = (user) => {
  if (user && user.id) {
    posthog.identify(String(user.id), {
      email: user.email,
      name: user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.email,
      role: user.role,
      department: user.department
    });
  }
};

/**
 * Reset user identity on logout
 */
export const resetUser = () => {
  posthog.reset();
};

export { posthog };
